// ============================================================
//  멀티 플레이 — 방장(host)이 게임 엔진을 돌리고, 참가자(client)는 화면과 입력만 담당
//  연결 방식
//    online : PeerJS(WebRTC P2P). 서버 없이 방 코드로 접속. 공용 중계 서버(0.peerjs.com)로 연결만 맺음
//    local  : 같은 브라우저의 다른 탭끼리 (BroadcastChannel) — 테스트·한 컴퓨터에서 여럿이 할 때
// ============================================================
'use strict';

const PEER_PREFIX = 'anomalyfield-room-';
const PEERJS_URL = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_PLAYERS = 6;
const HEARTBEAT = 3000;
const DEAD_AFTER = 12000;

function loadScript(src) {
  return new Promise((res, rej) => {
    if (window.Peer) return res();
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => res();
    s.onerror = () => rej(new Error('PeerJS를 불러오지 못했습니다 (인터넷 연결 확인)'));
    document.head.appendChild(s);
  });
}
const makeCode = () => Array.from({ length: 5 }, () => CODE_CHARS[rand(CODE_CHARS.length)]).join('');
const withTimeout = (p, ms, msg) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);

// ------------------------------------------------------------
//  전송 계층
// ------------------------------------------------------------
function localHostTransport(code, cb) {
  const ch = new BroadcastChannel('af-room-' + code);
  ch.onmessage = (e) => {
    const m = e.data;
    if (m && m.to === 'host' && typeof m.from === 'string') cb.onMsg(m.from, m.msg);
  };
  return { ready: Promise.resolve(), send: (cid, msg) => ch.postMessage({ to: cid, from: 'host', msg }), drop: () => {}, close: () => ch.close() };
}

function localClientTransport(code, cb) {
  const cid = 'tab-' + Math.random().toString(36).slice(2, 10);
  const ch = new BroadcastChannel('af-room-' + code);
  ch.onmessage = (e) => {
    const m = e.data;
    if (m && m.to === cid && m.from === 'host') cb.onMsg(m.msg);
  };
  return { ready: Promise.resolve(), send: (msg) => ch.postMessage({ to: 'host', from: cid, msg }), close: () => ch.close() };
}

async function peerHostTransport(code, cb) {
  await loadScript(PEERJS_URL);
  const peer = new window.Peer(PEER_PREFIX + code);
  const conns = new Map();
  const ready = new Promise((res, rej) => {
    peer.on('open', () => res());
    peer.on('error', (err) => rej(new Error(err.type === 'unavailable-id' ? '이미 쓰이는 방 코드입니다' : `연결 오류: ${err.type || err.message}`)));
  });
  peer.on('connection', (conn) => {
    conn.on('open', () => conns.set(conn.peer, conn));
    conn.on('data', (d) => cb.onMsg(conn.peer, d));
    conn.on('close', () => { conns.delete(conn.peer); cb.onLeave(conn.peer); });
    conn.on('error', () => { conns.delete(conn.peer); cb.onLeave(conn.peer); });
  });
  peer.on('disconnected', () => { try { peer.reconnect(); } catch { /* 무시 */ } });
  return {
    ready,
    send: (cid, msg) => { const c = conns.get(cid); if (c && c.open) c.send(msg); },
    drop: (cid) => { const c = conns.get(cid); if (c) c.close(); },
    close: () => peer.destroy(),
  };
}

async function peerClientTransport(code, cb) {
  await loadScript(PEERJS_URL);
  const peer = new window.Peer();
  let conn = null;
  const ready = new Promise((res, rej) => {
    peer.on('error', (err) => rej(new Error(err.type === 'peer-unavailable' ? '방을 찾을 수 없습니다. 코드를 확인하세요' : `연결 오류: ${err.type || err.message}`)));
    peer.on('open', () => {
      conn = peer.connect(PEER_PREFIX + code, { reliable: true });
      conn.on('open', () => res());
      conn.on('data', (d) => cb.onMsg(d));
      conn.on('close', () => cb.onClose());
      conn.on('error', () => cb.onClose());
    });
  });
  return {
    ready,
    send: (msg) => { if (conn && conn.open) conn.send(msg); },
    close: () => peer.destroy(),
  };
}

// ------------------------------------------------------------
//  받은 HTML 정리 (참가자 쪽) — 허용한 태그·속성만 남김
// ------------------------------------------------------------
const SAFE_TAGS = new Set(['B', 'I', 'SPAN', 'DIV', 'SMALL', 'BR']);
const SAFE_ATTRS = new Set(['class', 'title', 'style', 'data-pn', 'data-uid']);
function sanitizeHTML(html) {
  const doc = new DOMParser().parseFromString(`<div>${String(html)}</div>`, 'text/html');
  const walk = (el) => {
    for (const ch of [...el.children]) {
      if (!SAFE_TAGS.has(ch.tagName)) { ch.replaceWith(document.createTextNode(ch.textContent)); continue; }
      for (const at of [...ch.attributes]) {
        if (!SAFE_ATTRS.has(at.name) || (at.name === 'style' && /url\s*\(|expression|javascript:/i.test(at.value))) ch.removeAttribute(at.name);
      }
      walk(ch);
    }
  };
  const root = doc.body.firstChild;
  walk(root);
  return root.innerHTML;
}

// ------------------------------------------------------------
//  Net
// ------------------------------------------------------------
const Net = {
  role: null,          // host | client
  kind: 'online',
  code: '',
  tp: null,
  members: [],         // 방장: 참가자 목록 [{ cid, name, pack, lastSeen }]
  settings: { deckMode: 'mixed', costLimit: true, cpus: 0, difficulty: 'normal', speed: 1 },
  pending: new Map(),  // 방장: 응답 대기 rid → { pid, resolve, timer, fallback, cid }
  rid: 0,
  inGame: false,
  stateQueued: false,
  hb: null,
  lastPing: 0,
  lobby: null,         // 참가자: 마지막으로 받은 로비 정보
  turnRid: null,

  myName() { return cleanText(($('#mp-name').value || $('#in-name').value || '').trim(), 10) || '관리자'; },
  myPack() {
    const pk = getActivePack();
    return { name: pk.name, cards: packCards(pk), sheet: pk.sheet, keywords: pk.keywords };
  },

  // ================= 방장 =================
  async host(kind) {
    this.reset();
    this.role = 'host';
    this.kind = kind;
    this.hostPack = this.myPack();
    for (let attempt = 0; attempt < 3; attempt++) {
      this.code = makeCode();
      try {
        const cb = { onMsg: (cid, m) => this.onHostMsg(cid, m), onLeave: (cid) => this.dropMember(cid, '연결이 끊겼습니다') };
        this.tp = kind === 'local' ? localHostTransport(this.code, cb) : await peerHostTransport(this.code, cb);
        await withTimeout(this.tp.ready, 12000, '연결 서버 응답이 없습니다');
        break;
      } catch (e) {
        if (this.tp) this.tp.close();
        this.tp = null;
        if (attempt === 2 || !/이미 쓰이는/.test(e.message)) { toast(e.message, 'bad'); this.reset(); return; }
      }
    }
    this.hb = setInterval(() => this.hostHeartbeat(), HEARTBEAT);
    showLobby();
    this.sendLobby();
  },

  hostHeartbeat() {
    const now = Date.now();
    for (const m of [...this.members]) {
      if (now - m.lastSeen > DEAD_AFTER) this.dropMember(m.cid, '응답이 없어 연결을 끊었습니다');
      else this.tp.send(m.cid, { t: 'ping' });
    }
  },

  onHostMsg(cid, m) {
    if (!m || typeof m !== 'object') return;
    const mem = this.members.find((x) => x.cid === cid);
    if (mem) mem.lastSeen = Date.now();
    switch (m.t) {
      case 'hello': {
        if (mem) return;
        if (this.inGame) { this.tp.send(cid, { t: 'closed', reason: '이미 게임이 진행 중입니다' }); return; }
        if (1 + this.members.length + this.settings.cpus >= MAX_PLAYERS) {
          if (this.settings.cpus > 0) this.settings.cpus--;
          else { this.tp.send(cid, { t: 'closed', reason: `방이 가득 찼습니다 (최대 ${MAX_PLAYERS}명)` }); return; }
        }
        const nm = cleanText(m.name, 10) || '참가자';
        this.members.push({ cid, name: nm, pack: m.pack ? normalizePack(m.pack) : null, look: normalizeLook(m.look) || randomLook(nm), lastSeen: Date.now() });
        toast(`${cleanText(m.name, 10) || '참가자'} 님이 들어왔습니다`);
        this.sendLobby();
        break;
      }
      case 'look':
        if (mem && !this.inGame) { mem.look = normalizeLook(m.look) || mem.look; this.sendLobby(); }
        break;
      case 'pack':
        if (mem && !this.inGame) { mem.pack = m.pack ? normalizePack(m.pack) : null; this.sendLobby(); }
        break;
      case 'pong': break;
      case 'reply': {
        const w = this.pending.get(m.rid);
        if (w && w.cid === cid) { clearTimeout(w.timer); this.pending.delete(m.rid); w.resolve(m.data); }
        break;
      }
      case 'leave':
        this.dropMember(cid, '방을 나갔습니다');
        break;
      default: break;
    }
  },

  dropMember(cid, why) {
    const i = this.members.findIndex((x) => x.cid === cid);
    if (i < 0) return;
    const mem = this.members[i];
    this.members.splice(i, 1);
    if (this.tp && this.tp.drop) this.tp.drop(cid);
    if (this.inGame) {
      const p = G.players.find((x) => x.cid === cid && x.ctrl === 'remote');
      if (p) {
        p.ctrl = 'cpu';
        log(`🔌 ${pname(p)} — ${why}. CPU가 대신 플레이합니다.`);
        for (const [rid, w] of this.pending) if (w.cid === cid) { clearTimeout(w.timer); this.pending.delete(rid); w.resolve(w.fallback); }
        renderAll();
      }
    } else {
      toast(`${mem.name} — ${why}`);
      this.sendLobby();
    }
  },

  packInfo(pack) {
    if (!pack) return null;
    const s = packSummary(pack.cards, pack.keywords || []);
    const sh = sheetSummary(normalizeSheet(pack.sheet));
    return { name: pack.name, count: s.count, cost: s.cost, valid: s.valid && sh.valid, over: s.overBudget, small: s.tooSmall, stat: sh.points, statOver: !sh.valid };
  },

  lobbyView(youCid) {
    const players = [
      { name: this.myName(), kind: 'host', look: getLook(), pack: this.packInfo(this.hostPack), you: youCid === 'host' },
      ...this.members.map((m) => ({ name: m.name, kind: 'remote', look: m.look, pack: this.packInfo(m.pack), you: m.cid === youCid })),
      ...Array.from({ length: this.settings.cpus }, (_, i) => ({ name: `CPU ${i + 1}`, kind: 'cpu', pack: null, you: false })),
    ];
    return { code: this.code, kind: this.kind, players, settings: { ...this.settings }, problem: this.startProblem() };
  },

  sendLobby() {
    if (this.role !== 'host') return;
    for (const m of this.members) this.tp.send(m.cid, { t: 'lobby', ...this.lobbyView(m.cid) });
    renderLobby(this.lobbyView('host'));
  },

  // 시작할 수 없는 이유 (없으면 '')
  startProblem() {
    const total = 1 + this.members.length + this.settings.cpus;
    if (total < 2) return '참가자나 CPU가 1명 이상 있어야 합니다';
    const s = this.settings;
    const humans = [{ name: this.myName(), pack: this.hostPack }, ...this.members];
    for (const h of humans) {
      const info = this.packInfo(h.pack) || { count: 0, cost: 0, small: true, over: false };
      if (s.deckMode === 'personal' && info.count < RULES.packMin) return `${h.name}: 개인 덱은 ${RULES.packMin}장 이상 필요 (현재 ${info.count}장)`;
      if (s.deckMode !== 'base' && s.costLimit && info.over) return `${h.name}: 팩 코스트 초과 (${info.cost}/${RULES.packBudget})`;
      if (s.costLimit && info.statOver) return `${h.name}: 캐릭터 스탯 포인트 초과 (${info.stat}/${RULES.statBudget})`;
    }
    return '';
  },

  startGame() {
    const why = this.startProblem();
    if (why) { toast(why, 'bad'); return; }
    const s = this.settings;
    const names = shuffle([...CPU_NAMES]);
    const avs = shuffle([...CPU_AVATARS]);
    const humanAvs = ['🜲', '🦁', '🐯', '🐻', '🦅', '🐼'];
    // 카드는 덱 방식에 따라, 캐릭터 스탯·나만의 키워드는 항상 가져감
    const usePack = (pk) => (!pk ? null : { ...pk, cards: s.deckMode === 'base' ? [] : pk.cards });
    const players = [
      { name: this.myName(), avatar: humanAvs[0], ctrl: 'local', look: getLook(), pack: usePack(this.hostPack) },
      ...this.members.map((m, i) => ({ name: m.name, avatar: humanAvs[(i + 1) % humanAvs.length], ctrl: 'remote', cid: m.cid, look: m.look, pack: usePack(m.pack) })),
      ...Array.from({ length: s.cpus }, (_, i) => ({ name: names[i], avatar: avs[i], ctrl: 'cpu', pack: null })),
    ];
    this.inGame = true;
    startMatch({
      mode: 'host', meId: 0, players, deckMode: s.deckMode === 'base' ? 'mixed' : s.deckMode,
      speed: s.speed, difficulty: s.difficulty,
      onReady: () => {
        const defs = Object.values(G.defs).filter((c) => c.custom);
        // 나만의 키워드 정의 (이름·기반·색·특수 효과)
        const kws = Object.entries(KEYWORDS).filter(([, k]) => k.custom && !k.preview)
          .map(([id, k]) => ({ id, name: k.name, base: k.base, hue: k.hue || 0, img: k.img || '', fx: k.fx }));
        for (const p of G.players) {
          if (p.ctrl === 'remote') this.tp.send(p.cid, { t: 'start', meId: p.id, defs, kws, speed: s.speed });
        }
      },
    });
  },

  backToLobby() {
    G.session = (G.session || 0) + 1;
    this.inGame = false;
    for (const [, w] of this.pending) { clearTimeout(w.timer); w.resolve(w.fallback); }
    this.pending.clear();
    for (const m of this.members) this.tp.send(m.cid, { t: 'lobbyReturn' });
    G.mode = 'solo';
    showLobby();
    this.sendLobby();
  },

  // ---- 게임 중 (방장) ----
  remotes() { return G.players.filter((p) => p.ctrl === 'remote' && p.cid); },
  fx(k, d) {
    if (this.role !== 'host' || !this.inGame) return;
    for (const p of this.remotes()) this.tp.send(p.cid, { t: 'fx', k, d });
  },
  toastTo(p, text, kind) {
    if (this.role === 'host' && p.cid) this.tp.send(p.cid, { t: 'toast', text, kind });
  },
  queueState() {
    if (this.role !== 'host' || !this.inGame || this.stateQueued) return;
    this.stateQueued = true;
    setTimeout(() => { this.stateQueued = false; this.pushState(); }, 40);
  },
  pushState() {
    if (this.role !== 'host' || !this.inGame) return;
    for (const p of this.remotes()) this.tp.send(p.cid, { t: 'state', s: snapshotFor(p) });
  },
  ask(p, k, d, timeoutSec, fallback) {
    if (this.role !== 'host' || p.ctrl !== 'remote') return Promise.resolve(fallback);
    this.pushState();
    const rid = ++this.rid;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(rid);
        this.tp.send(p.cid, { t: 'cancel', rid });
        resolve(fallback);
      }, timeoutSec * 1000);
      this.pending.set(rid, { pid: p.id, cid: p.cid, resolve, timer, fallback });
      this.tp.send(p.cid, { t: 'ask', rid, k, d, timeout: timeoutSec });
    });
  },
  async askDefend(p, attacker, info) {
    const r = await this.ask(p, 'defend', { attackerId: attacker.id, cards: info.cards.map(cardRef) }, RULES.defendTimeout, null);
    if (!r || typeof r !== 'object' || !Array.isArray(r.uids)) return { mode: 'none', cards: [] };
    return { mode: String(r.mode || 'none'), cards: r.uids.map((u) => p.hand.find((c) => c.uid === u)).filter(Boolean) };
  },
  end(winner) {
    for (const p of this.remotes()) this.tp.send(p.cid, { t: 'end', winnerId: winner ? winner.id : null });
  },

  // ================= 참가자 =================
  async join(kind, code) {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    if (code.length !== 5) { toast('방 코드 5자리를 입력하세요', 'bad'); return; }
    this.reset();
    this.role = 'client';
    this.kind = kind;
    this.code = code;
    setLobbyStatus('연결 중…');
    try {
      const cb = { onMsg: (m) => this.onClientMsg(m), onClose: () => this.hostGone('방장과 연결이 끊겼습니다') };
      this.tp = kind === 'local' ? localClientTransport(code, cb) : await peerClientTransport(code, cb);
      await withTimeout(this.tp.ready, 12000, '방에 연결할 수 없습니다');
      this.tp.send({ t: 'hello', name: this.myName(), pack: this.myPack(), look: getLook() });
      await withTimeout(new Promise((res) => { this.onFirstLobby = res; }), 8000, '방을 찾을 수 없습니다. 코드와 연결 방식을 확인하세요');
      this.lastPing = Date.now();
      this.hb = setInterval(() => { if (Date.now() - this.lastPing > DEAD_AFTER) this.hostGone('방장의 응답이 없습니다'); }, HEARTBEAT);
    } catch (e) {
      toast(e.message, 'bad');
      setLobbyStatus('');
      this.reset();
    }
  },

  onClientMsg(m) {
    if (!m || typeof m !== 'object') return;
    this.lastPing = Date.now();
    switch (m.t) {
      case 'ping': this.tp.send({ t: 'pong' }); break;
      case 'lobby':
        this.lobby = m;
        if (this.onFirstLobby) { this.onFirstLobby(); this.onFirstLobby = null; showLobby(); }
        if (!this.inGame) renderLobby(m);
        break;
      case 'start': {
        G.session = (G.session || 0) + 1;
        G.mode = 'client';
        G.meId = m.meId;
        G.speed = 1;
        G.over = false;
        G.turn = 0;
        G.players = [];
        G.defs = {};
        G.humanResolve = null;
        G.acting = false;
        G.hover = null;
        resetSel();
        clearCustomKeywords();
        for (const k of Array.isArray(m.kws) ? m.kws.slice(0, 24) : []) {
          const id = String(k && k.id || '');
          const n = normalizeKeyword({ ...k, id: 'k_x' });
          if (n && KW_ID_RE.test(id)) registerKeyword(n, id);
        }
        registerDefs(CARDS);
        registerDefs((Array.isArray(m.defs) ? m.defs : []).map((d) => {
          const n = normalizeCard(d);
          if (n && /^[A-Za-z0-9_]{1,60}$/.test(d.id || '')) n.id = d.id;
          return n;
        }).filter(Boolean));
        this.inGame = true;
        enterGameScreen();
        break;
      }
      case 'state':
        if (this.inGame) { applySnapshot(m.s); renderAll(); }
        break;
      case 'fx':
        if (this.inGame) this.applyFx(m.k, m.d || {});
        break;
      case 'toast': toast(String(m.text || ''), m.kind === 'bad' ? 'bad' : ''); break;
      case 'ask': this.onAsk(m); break;
      case 'cancel':
        if (this.turnRid === m.rid) { G.humanResolve = null; this.turnRid = null; toast('⏱ 시간이 초과되었습니다', 'bad'); renderAll(); }
        closeDialogs();
        break;
      case 'end': showMatchResult(m.winnerId); break;
      case 'lobbyReturn':
        this.inGame = false;
        G.mode = 'solo';
        showLobby();
        if (this.lobby) renderLobby(this.lobby);
        break;
      case 'closed': this.hostGone(m.reason || '방이 닫혔습니다'); break;
      default: break;
    }
  },

  applyFx(k, d) {
    if (k === 'clash') renderClash(validateClash(d));
    else if (k === 'egocine') renderEgoCine(validateEgoCine(d));
    else if (k === 'log') logLocal(sanitizeHTML(d.html));
    else if (k === 'stage') stageLocal(sanitizeHTML(d.html));
    else if (k === 'clear') clearStageLocal(sanitizeHTML(d.text || ''));
    else if (k === 'float') floatLocal(+d.pid, String(d.text || ''), String(d.cls || '').replace(/[^a-z]/g, ''));
    else if (k === 'toast') toast(String(d.text || ''), d.kind === 'bad' ? 'bad' : '');
    else if (k === 'night') { document.body.classList.toggle('night', !!d.on); updateFrameClock(); }
  },

  async onAsk(m) {
    const reply = (data) => this.tp.send({ t: 'reply', rid: m.rid, data });
    const d = m.d || {};
    if (m.k === 'turn') {
      this.turnRid = m.rid;
      G.humanResolve = true;
      G.acting = false;
      resetSel();
      toast('내 차례입니다');
      renderAll();
    } else if (m.k === 'defend') {
      const attacker = G.players.find((p) => p.id === d.attackerId);
      const cards = (d.cards || []).map(resolveCard).filter(Boolean);
      if (!attacker || !cards.length || !me()) { reply(null); return; }
      const resp = await humanDefend(me(), attacker, buildAttack(cards));
      reply({ mode: resp.mode, uids: resp.cards.map((c) => c.uid) });
    } else if (m.k === 'buy') {
      const item = resolveCard(d.item);
      const target = G.players.find((p) => p.id === d.targetId);
      if (!item || !target) { reply(false); return; }
      reply(await humanBuyDecide(me(), target, item));
    }
  },

  sendTurn(a) {
    if (this.role !== 'client' || this.turnRid == null) return;
    this.tp.send({ t: 'reply', rid: this.turnRid, data: a });
    this.turnRid = null;
    G.humanResolve = null;
    G.acting = false;
    resetSel();
    renderAll();
  },

  hostGone(reason) {
    if (this.role !== 'client') return;
    toast(reason, 'bad');
    this.reset();
    G.session = (G.session || 0) + 1;
    G.mode = 'solo';
    showTitle();
  },

  // ================= 공통 =================
  leave() {
    if (this.role === 'host' && this.tp) {
      for (const m of this.members) this.tp.send(m.cid, { t: 'closed', reason: '방장이 방을 닫았습니다' });
    } else if (this.role === 'client' && this.tp) {
      this.tp.send({ t: 'leave' });
    }
    this.reset();
  },

  reset() {
    if (this.hb) clearInterval(this.hb);
    for (const [, w] of this.pending) clearTimeout(w.timer);
    const tp = this.tp;
    if (tp) setTimeout(() => tp.close(), 200);   // 마지막 메시지가 나갈 시간
    Object.assign(this, { role: null, tp: null, members: [], pending: new Map(), inGame: false, hb: null, lobby: null, turnRid: null, onFirstLobby: null });
  },
};

// 참가자에게 보낼 상태 (다른 사람의 손패는 장수만)
function snapshotFor(viewer) {
  const pile = pileOf(viewer);
  return {
    turn: G.turn, round: G.round, current: G.current, deckMode: G.deckMode, night: isNight(),
    pile: `${G.deckMode === 'personal' ? '내 덱' : '덱'} ${pile.deck.length} · 버림 ${pile.discard.length}`,
    players: G.players.map((p) => ({
      id: p.id, name: p.name, avatar: p.avatar, ctrl: p.ctrl === 'cpu' ? 'cpu' : 'human',
      hp: p.hp, sp: p.sp, won: p.won, stg: p.stg, status: p.status, alive: p.alive,
      maxHp: p.maxHp, stgMax: p.stgMax, res: p.res, passives: p.passives,
      handCount: p.hand.length, hand: p === viewer ? p.hand.map(cardRef) : null, look: p.look,
    })),
  };
}

// 참가자: 받은 상태 적용
function applySnapshot(s) {
  if (!s || !Array.isArray(s.players)) return;
  const prev = G.sel;
  G.turn = s.turn;
  G.round = s.round;
  G.current = s.current;
  G.deckMode = s.deckMode;
  G.pileInfo = String(s.pile || '');
  document.body.classList.toggle('night', !!s.night);
  G.players = s.players.map((x) => {
    const status = newStatus();
    for (const k of Object.keys(status)) if (x.status && x.status[k]) status[k] = { pot: +x.status[k].pot || 0, cnt: +x.status[k].cnt || 0 };
    return {
      id: +x.id, name: cleanText(x.name, 12), avatar: cleanText(x.avatar, 4), ctrl: x.ctrl === 'cpu' ? 'cpu' : 'human',
      look: normalizeLook(x.look) || randomLook(String(x.name || '')),
      hp: +x.hp, sp: +x.sp, won: +x.won, stg: +x.stg, status, alive: !!x.alive, handCount: +x.handCount,
      ...(() => { const sh = normalizeSheet({ hp: x.maxHp, stg: x.stgMax, res: x.res, passives: x.passives }); return { maxHp: sh.hp, stgMax: sh.stg, res: sh.res, passives: sh.passives }; })(),
      hand: Array.isArray(x.hand) ? x.hand.map(resolveCard).filter(Boolean) : [],
    };
  });
  const m = me();
  if (!m) return;
  const find = (c) => (c ? m.hand.find((h) => h.uid === c.uid) || null : null);
  G.sel = {
    main: find(prev.main), plus: prev.plus.map(find).filter(Boolean),
    target: prev.target ? G.players.find((p) => p.id === prev.target.id) || null : null, goods: find(prev.goods),
  };
  if (G.hover && G.hover.uid) G.hover = find(G.hover) || G.hover;
}

// ------------------------------------------------------------
//  로비 화면
// ------------------------------------------------------------
function setLobbyStatus(text) { const el = $('#mp-status'); if (el) el.textContent = text; }

function showLobby() {
  for (const id of ['#title', '#game', '#workshop', '#charedit']) $(id).classList.remove('show');
  $('#result').classList.remove('show');
  closeDialogs();
  document.body.classList.remove('night');
  $('#multi').classList.add('show');
  $('#mp-entry').style.display = Net.role ? 'none' : '';
  $('#mp-room').style.display = Net.role ? '' : 'none';
  setLobbyStatus('');
}

function renderLobby(v) {
  if (!v) return;
  const isHost = Net.role === 'host';
  $('#mp-roomcode').textContent = v.code;
  $('#mp-kindtag').textContent = v.kind === 'local' ? '같은 브라우저 탭' : '온라인 (P2P)';
  const deckName = { base: '기본 카드만 (공용 덱)', mixed: '기본 + 모두의 카드팩 (공용 덱)', personal: '개인 덱 (각자 자기 팩)' };
  $('#mp-players').innerHTML = v.players.map((p) => {
    const pk = p.pack;
    const packTxt = p.kind === 'cpu' ? (v.settings.deckMode === 'personal' ? '기본 카드로 만든 덱' : '')
      : pk ? `${cleanText(pk.name, 20)} · ${+pk.count || 0}장 · 코스트 ${+pk.cost || 0}/${RULES.packBudget} · 스탯 ${+pk.stat || 0}/${RULES.statBudget} ${pk.valid ? '<span class="pos">✔</span>' : `<span class="neg">${pk.statOver ? '스탯 초과' : pk.over ? '코스트 초과' : '장수 부족'}</span>`}`
        : '<span class="muted">카드팩 없음</span>';
    return `<div class="mp-player ${p.you ? 'you' : ''}">
      <span class="mp-role">${p.kind === 'host' ? '👑 방장' : p.kind === 'cpu' ? '🤖 CPU' : '👤 참가자'}</span>
      <span class="mp-face">${p.look ? portraitSVG(p.look) : ''}</span>
      <b>${cleanText(p.name, 12)}</b>${p.you ? ' <span class="muted">(나)</span>' : ''}
      <span class="mp-pack">${packTxt}</span></div>`;
  }).join('');
  const s = v.settings;
  $('#mp-deck').value = s.deckMode;
  $('#mp-cost').checked = !!s.costLimit;
  $('#mp-cpus').value = String(s.cpus);
  $('#mp-diff').value = s.difficulty;
  $('#mp-speed').value = String(s.speed);
  for (const id of ['#mp-deck', '#mp-cost', '#mp-cpus', '#mp-diff', '#mp-speed']) $(id).disabled = !isHost;
  $('#mp-start').style.display = isHost ? '' : 'none';
  $('#mp-start').disabled = !!v.problem;
  $('#mp-problem').textContent = v.problem || (isHost ? '' : '방장이 시작하기를 기다리는 중…');
  $('#mp-decknote').textContent = deckName[s.deckMode] + (s.costLimit ? ` · 팩 코스트 상한 ${RULES.packBudget}` : ' · 코스트 제한 없음');
}

// 카드팩을 바꾸면 방에 알림
// 캐릭터를 바꾸면 방에 알림
function netLookChanged() {
  if (Net.role === 'host' && !Net.inGame) Net.sendLobby();
  else if (Net.role === 'client' && !Net.inGame && Net.tp) Net.tp.send({ t: 'look', look: getLook() });
}

function netPackChanged() {
  if (Net.role === 'host' && !Net.inGame) { Net.hostPack = Net.myPack(); Net.sendLobby(); }
  else if (Net.role === 'client' && !Net.inGame && Net.tp) Net.tp.send({ t: 'pack', pack: Net.myPack() });
}

function initNet() {
  $('#btn-multi').onclick = () => {
    $('#mp-name').value = $('#in-name').value;
    fillPackSelect($('#mp-pack'));
    showLobby();
  };
  $('#mp-back').onclick = () => { Net.leave(); showTitle(); };
  $('#mp-host').onclick = () => Net.host($('#mp-kind').value);
  $('#mp-join').onclick = () => Net.join($('#mp-kind').value, $('#mp-code').value);
  $('#mp-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#mp-join').click(); });
  $('#mp-leave').onclick = () => { Net.leave(); showLobby(); };
  $('#mp-start').onclick = () => Net.startGame();
  $('#mp-copy').onclick = async () => {
    try { await navigator.clipboard.writeText(Net.code); toast('방 코드를 복사했습니다'); } catch { toast(Net.code); }
  };
  const bind = (id, key, conv) => {
    $(id).addEventListener('change', (e) => {
      if (Net.role !== 'host') return;
      Net.settings[key] = conv(e.target);
      if (key === 'cpus') Net.settings.cpus = Math.max(0, Math.min(MAX_PLAYERS - 1 - Net.members.length, Net.settings.cpus));
      Net.sendLobby();
    });
  };
  bind('#mp-deck', 'deckMode', (el) => (['base', 'mixed', 'personal'].includes(el.value) ? el.value : 'mixed'));
  bind('#mp-cost', 'costLimit', (el) => el.checked);
  bind('#mp-cpus', 'cpus', (el) => +el.value || 0);
  bind('#mp-diff', 'difficulty', (el) => el.value);
  bind('#mp-speed', 'speed', (el) => +el.value || 1);
  $('#mp-name').addEventListener('change', () => {
    $('#in-name').value = $('#mp-name').value;
    if (Net.role === 'host') Net.sendLobby();
  });
  window.addEventListener('beforeunload', () => Net.leave());
}

document.addEventListener('DOMContentLoaded', initNet);
