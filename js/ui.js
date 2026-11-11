// ============================================================
//  화면 그리기 + 이 기기 플레이어의 입력 + 창(방어/매입/환전)
// ============================================================
'use strict';

const TYPE_NAME = { weapon: '무기', armor: '수비', ego: 'E.G.O', item: '도구', trade: '거래' };
const resetSel = (keepTarget = false) => {
  G.sel = { main: null, plus: [], target: keepTarget ? G.sel.target : null, goods: null };
};

// ------------------------------------------------------------
//  카드
// ------------------------------------------------------------
// 카드 테두리의 물감 튄 장식 (카드 id로 모양 고정)
const SPLAT_CACHE = new Map();
function splatterSVG(seed) {
  if (SPLAT_CACHE.has(seed)) return SPLAT_CACHE.get(seed);
  let h = 2166136261;
  for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const rng = seededRng(h >>> 0);
  const blob = (cx, cy, r) => {
    const n = 7 + Math.floor(rng() * 4);
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = r * (0.55 + rng() * 0.6);
      pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`);
    }
    return `<polygon points="${pts.join(' ')}"/>`;
  };
  const out = [];
  // 오른쪽 위에 큰 덩어리, 테두리를 따라 작은 조각들
  out.push(blob(80 + rng() * 8, 12 + rng() * 6, 13 + rng() * 5));
  out.push(blob(90, 30 + rng() * 10, 7 + rng() * 4));
  for (let i = 0; i < 9; i++) {
    const side = Math.floor(rng() * 4);
    const t = rng() * 100;
    const [x, y] = [[t, 3], [97, t], [t, 92], [3, t]][side];
    out.push(blob(x, y, 2 + rng() * 4));
  }
  const svg = `<svg class="c-splat" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${out.join('')}</svg>`;
  SPLAT_CACHE.set(seed, svg);
  return svg;
}

const DEF_GLYPH = { guard: '🛡', evade: '💨', counter: '↩' };

function cardHTML(c, opt = {}) {
  const a = ATTR[c.attr] || null;
  const sin = SINS[sinOf(c)];
  let stat = '', glyph = '◆';
  if (c.type === 'weapon') { stat = `<b class="c-stat atk">${c.atk}</b>`; glyph = a ? a.icon : '⚔'; }
  else if (c.type === 'armor') { stat = `<b class="c-stat def k-${defKind(c)}">${c.def}</b>`; glyph = DEF_GLYPH[defKind(c)]; }
  else if (c.type === 'ego') { stat = `<b class="c-stat egoc">${c.cost}<small>SP</small></b>`; glyph = '✧'; }
  else if (c.type === 'trade') { glyph = { buy: '🛒', sell: '💸', exchange: '💱' }[c.kind]; }
  else { glyph = '✚'; }

  let sub = '';
  if (c.type === 'armor') sub = { guard: '가드', evade: '회피', counter: '반격' }[defKind(c)];
  else if (c.type === 'ego') sub = { attack: `위력 ${c.power}`, heal: `HP +${c.power}`, cure: '상태 해제', steal: '카드 강탈', stun: '기절' }[c.kind];
  else if (c.type === 'trade') sub = { buy: '매입', sell: '강매', exchange: '환전' }[c.kind];
  else if (c.type === 'item') sub = { heal: `HP +${c.power}`, sp: `정신력 +${c.power}`, won: `+${c.power}안`, cure: '상태 해제', draw: `${c.power}장 뽑기`, gamble: '???', custom: '' }[c.kind] || '';
  else if (c.plus) sub = '보조';

  // 키워드 아이콘 (최대 3개)
  const kws = [...new Set((c.effects || []).concat(...(c.coins || []).map((x) => x.fx || []))
    .map((e) => (KEYWORDS[e.key] ? KEYWORDS[e.key].icon : e.kw && KEYWORDS[e.kw] ? KEYWORDS[e.kw].icon : null)).filter(Boolean))].slice(0, 3);
  // 코인 줄: 커스텀 코인은 위력 숫자, 기본 코인은 빈 코인
  const coins = Array.isArray(c.coins) && c.coins.length
    ? c.coins.map((x) => `<i class="${(x.fx || []).length ? 'fx' : ''}">${x.power}</i>`).join('')
    : ['weapon', 'ego', 'armor'].includes(c.type) && !(c.type === 'ego' && c.kind !== 'attack') ? Array.from({ length: RULES.coins }, () => '<i></i>').join('') : '';
  let img = '';
  if (c.img) { ensureImgStyle(c); img = ` has-img cimg-${c.id}`; }

  return `<div class="card t-${c.type} r${c.rarity || 1} ${opt.big ? 'big' : ''} ${opt.cls || ''}" style="--sin:${sin.color};--sin2:${shade(sin.color, -0.45)};--sin3:${shade(sin.color, 0.35)}" ${opt.uid ? `data-uid="${c.uid}"` : ''}>
    <div class="c-art-wrap">
      ${splatterSVG(c.id || c.name)}
      <div class="c-art"><div class="c-art-in${img}">
        ${img ? '' : `<span class="c-glyph">${glyph}</span>`}
        ${kws.length ? `<span class="c-kw">${kws.join('')}</span>` : ''}
        ${stat}
        ${sub ? `<span class="c-sub">${sub}</span>` : ''}
      </div></div>
      <div class="c-badge" title="${a ? a.name : TYPE_NAME[c.type]}"><span>${a ? a.icon : glyph}</span></div>
    </div>
    <div class="c-ribbon"><span class="c-sin" title="${sin.name}">${sin.name[0]}</span><span class="c-name">${c.name}</span></div>
    <div class="c-coinrow">${coins}</div>
    <span class="c-cost" title="코스트">${cardCost(c)}</span>
    <span class="c-price">${c.price || 0}안</span>
  </div>`;
}

// 카드 상세 설명 (정보 칸, 도감, 공방 미리보기 공용)
function describeCard(c) {
  const a = ATTR[c.attr];
  const parts = [`코스트 ${cardCost(c)}`, `${SINS[sinOf(c)].name}`];
  if (c.type === 'weapon') parts.push(`공격력 ${c.atk}`);
  if (c.type === 'armor') parts.push(`${DEF_KIND[defKind(c)]} · 수비 위력 ${c.def}`);
  if (c.type === 'ego') parts.push(`위력 ${c.power} · 정신력 ${c.cost} 소모`);
  if (a) parts.push(`${a.icon} ${a.name}`);
  fxOf(c).forEach((f) => parts.push(FX_TEXT[f]));
  if (c.plus) parts.push('보조 무기 — 다른 무기에 덧붙여 공격력 합산');
  parts.push(`가격 ${c.price || 0}안`);
  const armor = c.type === 'armor';
  const lines = (c.effects || []).map((e) => effectText(e, armor));
  if (Array.isArray(c.coins)) {
    c.coins.forEach((coin, i) => {
      const fx = (coin.fx || []).map((e) => effectText(e, armor)).join(', ');
      lines.push(`🪙 코인${i + 1} (+${coin.power})${fx ? ' — ' + fx : ''}`);
    });
  } else if (['weapon', 'ego', 'armor'].includes(c.type)) {
    lines.push(`🪙 기본 코인 ${RULES.coins}개 (+${RULES.coinPower})`);
  }
  if (c.type === 'armor' && defKind(c) === 'guard' && Array.isArray(c.coins) && c.coins.length) {
    lines.push('🛡 가드는 기본 코인에 이 코인들이 더해집니다');
  }
  return { head: parts.join(' · '), lines };
}

// ------------------------------------------------------------
//  플레이어 패널
// ------------------------------------------------------------
function bar(cur, max, cls, label = cur) {
  return `<div class="bar ${cls}"><div style="width:${Math.max(0, (cur / max) * 100)}%"></div><span>${label}</span></div>`;
}

// 정신력 막대: 가운데가 0, 왼쪽(보라)이 음수, 오른쪽(금색)이 양수
function spBar(p) {
  const half = RULES.maxSp;
  const w = (Math.abs(p.sp) / half) * 50;
  const style = p.sp >= 0 ? `left:50%;width:${w}%` : `left:${50 - w}%;width:${w}%`;
  const face = p.sp >= 25 ? '😤' : p.sp >= 8 ? '🙂' : p.sp > -8 ? '😐' : p.sp > -25 ? '😰' : '😱';
  return `<div class="bar sp ${p.sp < 0 ? 'neg' : ''}" title="정신력 ${p.sp} — 코인 앞면 확률 ${Math.round(headChance(p.sp) * 100)}%">
    <i></i><div style="${style}"></div><span>${face} SP ${p.sp}</span></div>`;
}

function stgBar(p) {
  const st = has(p, 'staggered');
  return `<div class="bar stg ${st ? 'broken' : ''}" title="흐트러짐 게이지 — 피격 피해만큼 줄고, 0이 되면 흐트러짐">
    <div style="width:${(p.stg / RULES.staggerMax) * 100}%"></div><span>${st ? '💢 흐트러짐' : `흐트러짐 ${p.stg}`}</span></div>`;
}

const handCount = (p) => (p.handCount != null ? p.handCount : p.hand.length);
const ctrlBadge = (p) => (G.mode === 'solo' ? '' : `<span class="ctrl ${p.ctrl}">${p.ctrl === 'cpu' ? 'CPU' : '👤'}</span>`);

function renderOpponents() {
  const box = $('#opponents');
  const targeting = G.humanResolve && !G.acting && G.sel.main && needsTarget(G.sel.main);
  box.innerHTML = G.players.filter((p) => p.id !== G.meId).map((p) => `
    <div class="opp ${p.alive ? '' : 'dead'} ${G.players[G.current] === p && !G.over ? 'active' : ''}
      ${targeting && p.alive ? 'targetable' : ''} ${G.sel.target && G.sel.target.id === p.id ? 'targeted' : ''}" data-pid="${p.id}">
      <div class="opp-av">${p.look ? portraitSVG(p.look) : p.avatar}</div>
      <div class="opp-info">
        <div class="opp-name"><span>${ctrlBadge(p)}${p.name}</span> <span class="st-row">${statusHTML(p)}</span></div>
        ${bar(p.hp, RULES.maxHp, 'hp')}
        ${stgBar(p)}
        ${spBar(p)}
        <div class="opp-hand">🂠 × ${handCount(p)} <span class="won">${p.won}안</span></div>
      </div>
    </div>`).join('');
  $$('.opp', box).forEach((el) => (el.onclick = () => onTargetClick(+el.dataset.pid)));
}

function renderMe() {
  const p = me();
  const myTurn = !!G.humanResolve;
  $('#me').innerHTML = `
    <div class="me-card ${myTurn ? 'active' : ''} ${G.defendReq ? 'under-attack' : ''} ${p.alive ? '' : 'dead'}" data-pid="${p.id}">
      <div class="opp-av">${p.look ? portraitSVG(p.look) : p.avatar}</div>
      <div class="opp-info">
        <div class="opp-name">${p.name} <span class="st-row">${statusHTML(p)}</span></div>
        ${bar(p.hp, RULES.maxHp, 'hp')}
        ${stgBar(p)}
        ${spBar(p)}
        <div class="opp-hand"><span class="won">${p.won}안</span> · 코인 앞면 ${Math.round(headChance(p.sp) * 100)}%</div>
      </div>
    </div>`;

  const hand = $('#hand');
  const sel = G.sel;
  const order = { weapon: 0, ego: 1, trade: 2, item: 3, armor: 4 };
  const val = (c) => c.atk || c.def || c.cost || 0;
  const sorted = [...p.hand].filter(Boolean).sort((a, b) => order[a.type] - order[b.type] || val(b) - val(a));
  hand.innerHTML = sorted.map((c) => {
    let cls = '';
    if (G.defendReq) {
      cls = G.defendReq.picked.includes(c.uid) ? 'sel-def' : defCanUse(c, G.defendReq.info) ? 'def-ok' : 'cant';
      return cardHTML(c, { uid: true, cls });
    }
    if (sel.main && sel.main.uid === c.uid) cls = 'sel-main';
    else if (sel.goods && sel.goods.uid === c.uid) cls = 'sel-goods';
    else if (sel.plus.some((x) => x.uid === c.uid)) cls = 'sel-plus';
    else if (myTurn && sel.main && sel.main.type === 'weapon' && c.type === 'weapon' && c.plus) cls = 'can-plus';
    if (c.type === 'ego' && !canPayEgo(p, c)) cls += ' no-sp';
    return cardHTML(c, { uid: true, cls });
  }).join('') || `<div class="muted empty-hand">${p.alive ? '손패가 없습니다' : '탈락 — 관전 중'}</div>`;
  $$('.card', hand).forEach((el) => {
    el.onclick = () => onHandClick(+el.dataset.uid);
    el.onmouseenter = () => { G.hover = p.hand.find((c) => c && c.uid === +el.dataset.uid); renderInfo(); };
  });

  // 버튼
  const act = $('#btn-act');
  const prev0 = $('#preview');
  if (G.defendReq) {
    const R = G.defendReq;
    act.textContent = R.picked.length ? { clash: '⚔ 합!', guard: '🛡 가드', evade: '💨 회피', counter: '↩ 반격' }[R.mode] : '그대로 받기';
    act.disabled = false;
    $('#btn-pray').disabled = true;
    $('#btn-cancel').disabled = !R.picked.length;
    prev0.innerHTML = defPreview();
    return;
  }
  const st = actionState();
  act.textContent = myTurn ? st.label : G.over ? '게임 종료' : '상대 차례';
  act.disabled = !myTurn || !st.ok || G.acting;
  $('#btn-pray').disabled = !myTurn || G.acting;
  $('#btn-cancel').disabled = !myTurn || G.acting || !sel.main;

  // 공격 미리보기
  const prev = $('#preview');
  if (sel.main && (sel.main.type === 'weapon' || sel.main.kind === 'attack')) {
    const info = buildAttack([sel.main, ...sel.plus]);
    const a = ATTR[info.attr];
    prev.innerHTML = `<span style="color:${a.color}">${a.icon} ${a.name}</span> 위력 <b>${info.atk}</b> ~ ${info.atk + info.coinMax}${info.fx.includes('twice') ? ' ×2' : ''}
      ${sel.target ? ` → ${sel.target.avatar} ${sel.target.name}${has(sel.target, 'staggered') ? ' <span class="neg">💢 흐트러짐 (피해 1.5배)</span>' : ''}` : ''}
      ${sel.main.type === 'weapon' && p.hand.some((c) => c && c.plus && c.type === 'weapon' && c !== sel.main && !sel.plus.includes(c)) ? '<span class="muted"> · 보조 무기를 덧붙일 수 있음</span>' : ''}`;
  } else if (sel.main && sel.main.type === 'trade') {
    const t = sel.target ? ` → ${sel.target.avatar} ${sel.target.name}` : '';
    prev.innerHTML = {
      buy: `🛒 상대 손패에서 무작위 1장을 보고 살지 결정합니다${t}`,
      sell: sel.goods ? `💸 「${sel.goods.name}」을(를) <b class="won">${sel.goods.price || 0}안</b>에 강매${t}` : '💸 팔 카드를 손패에서 고르세요 (비쌀수록 이득)',
      exchange: '💱 HP·정신력·돈을 1:1로 다시 나눕니다',
    }[sel.main.kind];
  } else if (myTurn) {
    prev.innerHTML = '<span class="muted">무기·E.G.O로 공격하거나, 도구를 쓰거나, 기도해서 턴을 넘기세요.</span>';
  } else {
    const cur = G.players[G.current];
    prev.innerHTML = cur && !G.over ? `<span class="muted">${cur.avatar} ${cur.name}의 차례입니다…</span>` : '';
  }
}

function renderInfo() {
  const c = G.hover;
  const box = $('#info');
  if (!c) { box.innerHTML = '<span class="muted">카드를 누르거나 마우스를 올리면 설명이 표시됩니다.</span>'; return; }
  const d = describeCard(c);
  box.innerHTML = `<b class="cn r${c.rarity || 1}">${c.name}</b> <span class="muted">${d.head}</span>
    ${d.lines.length ? `<div class="fx-lines">${d.lines.map((l) => `<span>${l}</span>`).join('')}</div>` : ''}
    <div class="flavor">${c.flavor || ''}</div>`;
}

function pileText() {
  if (G.mode === 'client') return G.pileInfo || '';
  const p = me();
  const pile = pileOf(p);
  return `${G.deckMode === 'personal' ? '내 덱' : '덱'} ${pile.deck.length} · 버림 ${pile.discard.length}`;
}

function renderAll() {
  if (!G.players.length || !me()) return;
  renderOpponents();
  renderMe();
  renderInfo();
  const left = RULES.nightTurn - G.turn;
  $('#round').innerHTML = `TURN ${G.turn}` + (isNight() ? ' <span class="night-tag">🌙 뒷골목의 밤</span>'
    : left <= 20 ? ` <span class="muted small">밤까지 ${left}턴</span>` : '');
  $('#deckcount').textContent = pileText();
  $('#mode-tag').textContent = G.mode === 'solo' ? '' : G.mode === 'host' ? '🌐 방장' : '🌐 참가';
  if (G.mode === 'host') Net.queueState();
}

// ------------------------------------------------------------
//  이 기기 플레이어의 턴
// ------------------------------------------------------------
function humanTurn() {
  resetSel();
  return new Promise((res) => {
    G.humanResolve = res;
    renderAll();
  });
}

function endHumanTurn() {
  const r = G.humanResolve;
  G.humanResolve = null;
  resetSel();
  if (typeof r === 'function') r();
}

function onHandClick(uid) {
  const p = me();
  const card = p.hand.find((c) => c && c.uid === uid);
  if (!card) return;
  G.hover = card;
  if (G.defendReq) {
    if (defCanUse(card, G.defendReq.info)) defToggle(card);
    else toast(defWhyNot(card, G.defendReq.info), 'bad');
    renderAll();
    return;
  }
  if (!G.humanResolve || G.acting) { renderAll(); return; }
  const s = G.sel;

  if (s.main && s.main.uid === uid) {
    G.sel = { main: null, plus: [], target: s.target, goods: null };
  } else if (s.main && s.main.type === 'trade' && s.main.kind === 'sell') {
    s.goods = s.goods && s.goods.uid === uid ? null : card;
  } else if (s.plus.some((c) => c.uid === uid)) {
    s.plus = s.plus.filter((c) => c.uid !== uid);
  } else if (card.type === 'weapon' && s.main && s.main.type === 'weapon' && card.plus) {
    s.plus.push(card);
  } else if (card.type === 'armor') {
    toast('수비 카드(가드·회피·반격)는 공격을 받을 때 사용합니다');
  } else {
    G.sel = { main: card, plus: [], target: s.target, goods: null };
  }
  renderAll();
}

function onTargetClick(pid) {
  if (!G.humanResolve || G.acting) return;
  const t = G.players.find((p) => p.id === pid);
  if (!t || !t.alive || t.id === G.meId) return;
  G.sel.target = G.sel.target && G.sel.target.id === t.id ? null : t;
  renderAll();
}

function actionState() {
  const p = me();
  const { main, target } = G.sel;
  if (!main) return { label: '카드를 선택하세요', ok: false };
  if (main.type === 'ego' && !canPayEgo(p, main)) return { label: `정신력 부족 (${main.cost} 소모)`, ok: false };
  if (main.type === 'trade' && main.kind === 'sell' && !G.sel.goods) return { label: '팔 카드를 선택하세요', ok: false };
  if (needsTarget(main) && !target) return { label: '대상을 선택하세요', ok: false };
  if (main.type === 'trade') return { label: { buy: '🛒 매입 (턴 종료)', sell: '💸 강매 (턴 종료)', exchange: '💱 환전 (턴 유지)' }[main.kind], ok: true };
  if (main.type === 'weapon') return { label: '⚔ 공격', ok: true };
  if (main.type === 'ego' && main.kind === 'attack') return { label: '✧ E.G.O 공격', ok: true };
  if (main.type === 'ego' && (main.kind === 'steal' || main.kind === 'stun')) return { label: '✧ E.G.O 발현 (턴 종료)', ok: true };
  if (itemHitsEnemy(main)) return { label: '사용 (턴 종료)', ok: true };
  return { label: '사용 (턴 유지)', ok: true };
}

// 선택 → 행동 데이터
async function buildPayload() {
  const { main, plus, target, goods } = G.sel;
  const a = { act: 'play', main: main.uid, plus: plus.map((c) => c.uid), target: target ? target.id : null, goods: goods ? goods.uid : null };
  if (main.type === 'trade' && main.kind === 'exchange') {
    a.plan = await humanExchange(me());
    if (!a.plan) return null;
  }
  return a;
}

async function onAction() {
  if (G.defendReq) { finishDefend(); return; }
  const st = actionState();
  if (!st.ok || G.acting || !G.humanResolve) return;
  G.acting = true;
  renderAll();
  try {
    const a = await buildPayload();
    if (!a) { G.acting = false; renderAll(); return; }
    if (G.mode === 'client') {
      Net.sendTurn(a);
      return;
    }
    const r = await executeAction(me(), a);
    G.acting = false;
    if (!r.ok) toast(r.msg, 'bad');
    if (r.ended || checkEnd()) { endHumanTurn(); return; }
    resetSel(true);
    renderAll();
  } catch (e) {
    G.acting = false;
    console.error(e);
    renderAll();
  }
}

async function onPray() {
  if (!G.humanResolve || G.acting) return;
  if (G.mode === 'client') { Net.sendTurn({ act: 'pray' }); return; }
  G.acting = true;
  await executeAction(me(), { act: 'pray' });
  G.acting = false;
  endHumanTurn();
}

// ------------------------------------------------------------
//  창: 매입 / 환전 / 방어
// ------------------------------------------------------------
function humanBuyDecide(p, target, item) {
  return new Promise((res) => {
    const modal = $('#dialog');
    modal.querySelector('.dlg-box').innerHTML = `
      <h2>매입</h2>
      <p>${pname(target)}의 손패에서 이 카드가 나왔습니다.</p>
      <div class="def-cards">${cardHTML(item, { big: true })}</div>
      <p>가격 <b class="won">${item.price || 0}안</b> <span class="muted">(보유 ${p.won}안)</span></p>
      <div class="def-actions">
        <button class="btn primary" id="dlg-yes" ${p.won >= (item.price || 0) ? '' : 'disabled'}>🛒 매입</button>
        <button class="btn" id="dlg-no">사지 않기</button>
      </div>`;
    const done = (v) => { modal.classList.remove('show'); res(v); };
    $('#dlg-yes').onclick = () => done(true);
    $('#dlg-no').onclick = () => done(false);
    modal.classList.add('show');
  });
}

function humanExchange(p) {
  return new Promise((res) => {
    const L = exchangeLimits(p);
    const plan = { hp: p.hp, sp: p.sp, won: p.won };
    const modal = $('#dialog');
    const label = { hp: '❤ HP', sp: '🧠 정신력', won: '💰 안(돈)' };
    const draw = () => {
      const sum = plan.hp + plan.sp + plan.won;
      const left = L.total - sum;
      const valid = left === 0 && ['hp', 'sp', 'won'].every((k) => plan[k] >= L[k][0] && plan[k] <= L[k][1]);
      modal.querySelector('.dlg-box').innerHTML = `
        <h2>💱 환전</h2>
        <p class="muted">HP·정신력·돈은 모두 1:1 가치입니다. 합계 <b>${L.total}</b>를 원하는 대로 다시 나누세요.</p>
        <div class="ex-rows">${['hp', 'sp', 'won'].map((k) => `
          <div class="ex-row">
            <span class="ex-label">${label[k]}</span>
            <button class="btn small" data-k="${k}" data-d="-10">-10</button>
            <button class="btn small" data-k="${k}" data-d="-1">-1</button>
            <input type="number" data-k="${k}" value="${plan[k]}" min="${L[k][0]}" max="${L[k][1]}">
            <button class="btn small" data-k="${k}" data-d="1">+1</button>
            <button class="btn small" data-k="${k}" data-d="10">+10</button>
            <button class="btn small" data-k="${k}" data-max="1">최대</button>
            <span class="muted small">${L[k][0]}~${L[k][1]}</span>
          </div>`).join('')}</div>
        <p>남은 값 <b class="${left ? 'neg' : 'pos'}">${left}</b>${left ? ' — 0이 되어야 합니다' : ''}</p>
        <div class="def-actions">
          <button class="btn primary" id="dlg-yes" ${valid ? '' : 'disabled'}>💱 환전</button>
          <button class="btn" id="dlg-no">취소</button>
        </div>`;
      const clamp = (k, v) => Math.max(L[k][0], Math.min(L[k][1], v));
      $$('button[data-k]', modal).forEach((b) => {
        b.onclick = () => {
          const k = b.dataset.k;
          if (b.dataset.max) {
            // 다른 항목을 최소로 줄이고 이 항목에 최대한 몰아줌 (넘치는 값은 다시 나머지에)
            const rest = ['hp', 'sp', 'won'].filter((x) => x !== k);
            rest.forEach((x) => (plan[x] = L[x][0]));
            plan[k] = clamp(k, L.total - rest.reduce((sum, x) => sum + plan[x], 0));
            let over = L.total - (plan.hp + plan.sp + plan.won);
            for (const x of rest) {
              const add = Math.min(over, L[x][1] - plan[x]);
              plan[x] += add;
              over -= add;
            }
          } else plan[k] = clamp(k, plan[k] + +b.dataset.d);
          draw();
        };
      });
      $$('input[data-k]', modal).forEach((inp) => {
        inp.onchange = () => { plan[inp.dataset.k] = clamp(inp.dataset.k, Math.round(+inp.value || 0)); draw(); };
      });
      $('#dlg-yes').onclick = () => { if (valid) { modal.classList.remove('show'); res({ ...plan }); } };
      $('#dlg-no').onclick = () => { modal.classList.remove('show'); res(null); };
    };
    draw();
    modal.classList.add('show');
  });
}

// ------------------------------------------------------------
//  공격받았을 때: 별도 창 없이 손패에서 골라 대응
//  합(무기, +보조) / 가드(여러 장) / 회피 / 반격 — 고른 카드에 따라 자동으로 정해짐
// ------------------------------------------------------------
function humanDefend(p, attacker, info) {
  const hand = p.hand.filter(Boolean);
  if (!hand.some((c) => c.type === 'weapon' || c.type === 'armor')) return Promise.resolve({ mode: 'none', cards: [] });
  return new Promise((res) => {
    G.defendReq = { attacker, info, mode: 'none', picked: [], resolve: res };
    G.hover = info.cards[0] || null;
    toast('⚠ 공격받고 있습니다! 손패에서 대응할 카드를 고르세요', 'bad');
    renderAll();
  });
}

const defKindOf = (c) => (c.type === 'weapon' ? 'clash' : defKind(c));
function defCanUse(c, info) {
  if (c.type === 'weapon') return true;
  if (c.type !== 'armor' || !armorMatches(c, info.attr)) return false;
  return !(defKind(c) === 'guard' && info.fx.includes('pierce'));
}
function defWhyNot(c, info) {
  if (c.type !== 'weapon' && c.type !== 'armor') return '무기(합)나 수비 카드만 낼 수 있습니다';
  if (!armorMatches(c, info.attr)) return `수비 카드는 ${ATTR[info.attr].name} 또는 전속성만 쓸 수 있습니다`;
  return '관통 공격에는 가드를 쓸 수 없습니다';
}
const defPicked = () => {
  const R = G.defendReq, p = me();
  return R && p ? R.picked.map((u) => p.hand.find((c) => c && c.uid === u)).filter(Boolean) : [];
};

function defToggle(c) {
  const R = G.defendReq;
  const k = defKindOf(c);
  if (R.picked.includes(c.uid)) {
    R.picked = R.picked.filter((u) => u !== c.uid);
    if (!R.picked.length) R.mode = 'none';
    return;
  }
  if (k !== R.mode) { R.picked = []; R.mode = k; }
  if (k === 'clash') R.picked = R.picked.length && c.plus ? [...R.picked, c.uid] : [c.uid];
  else if (k === 'guard') R.picked.push(c.uid);
  else R.picked = [c.uid];
}

function defPreview() {
  const R = G.defendReq, p = me(), info = R.info, attacker = R.attacker;
  const picked = defPicked();
  const pct = (x) => Math.round(x * 100) + '%';
  const a = ATTR[info.attr];
  const head = `<b class="big">⚠ ${attacker.avatar} ${attacker.name}의 「${info.name}」</b>
    <span><span style="color:${a.color}">${a.icon} ${a.name}</span> 위력 <b>${info.atk}</b> + 코인 ${info.coins.length}개${info.fx.length ? ' · ' + info.fx.map((f) => FX_TEXT[f]).join(' · ') : ''}</span>`;
  let body;
  if (R.mode === 'none' || !picked.length) {
    const st = clashStats(info.atk, info.coins, attacker.sp, 0, [], p.sp, false);
    body = `<span class="muted">무기 → ⚔합 · 🛡가드(여러 장) · 💨회피 · ↩반격 중에서 고르세요. 그대로 받으면 피해 <b class="neg">${info.atk}~${info.atk + info.coinMax}</b> (평균 ${st.expA.toFixed(1)})</span>`;
  } else if (R.mode === 'clash') {
    const dinfo = buildAttack(picked);
    const st = clashSim(info.atk, info.coins, attacker.sp, dinfo.atk, dinfo.coins, p.sp);
    body = `⚔ 합 승률 <b class="pos">${pct(st.win)}</b>${st.tie >= 0.005 ? ` · 상쇄 ${pct(st.tie)}` : ''} · 패배 <b class="neg">${pct(st.lose)}</b> (평균 ${st.rounds.toFixed(1)}합) — 이기면 남은 코인으로 평균 <b class="pos">${(st.win ? st.expD / st.win : 0).toFixed(1)}</b> 피해, 지면 평균 <b class="neg">${(st.lose ? st.exp / st.lose : 0).toFixed(1)}</b> 받음`;
  } else if (picked.some((c) => hasFx(c, 'nullify'))) {
    body = '🛡 공격을 <b class="pos">무효화</b>합니다';
  } else {
    const st = clashStats(info.atk, info.coins, attacker.sp, armorDef(p, picked), defenseCoins(picked), p.sp, true);
    const ok = st.win + st.tie;
    if (R.mode === 'guard') body = `🛡 가드 ${picked.length}장 — 완전 방어 <b class="pos">${pct(ok)}</b> · 예상 피해 평균 <b class="neg">${st.exp.toFixed(1)}</b> · 최대 ${st.max}`;
    else if (R.mode === 'evade') body = `💨 회피 성공 <b class="pos">${pct(ok)}</b> — 실패하면 그대로 받음 (평균 <b class="neg">${st.expA.toFixed(1)}</b>)`;
    else {
      const pow = armorDef(p, picked) + defenseCoins(picked).reduce((s, c) => s + c.power * headChance(p.sp), 0);
      body = `↩ 반격 성공 <b class="pos">${pct(ok)}</b> — 성공하면 약 <b class="pos">${pow.toFixed(0)}</b> 피해로 되받아침, 실패하면 그대로 받음`;
    }
  }
  return `<div class="def-banner">${head}<span>${body}</span></div>`;
}

// 대응 확정 (none = true면 그대로 받기)
function finishDefend(none = false) {
  const R = G.defendReq;
  if (!R) return;
  const cards = none ? [] : defPicked();
  G.defendReq = null;
  R.resolve({ mode: cards.length ? R.mode : 'none', cards });
  renderAll();
}

// 열려 있는 선택 창 닫기 (시간 초과 등)
function closeDialogs() {
  $('#defend').classList.remove('show');
  $('#dialog').classList.remove('show');
  if (G.defendReq) finishDefend(true);
}

// ------------------------------------------------------------
//  화면 전환 / 결과
// ------------------------------------------------------------
function enterGameScreen() {
  $('#log').innerHTML = '';
  clearStageLocal('');
  document.body.classList.remove('night');
  for (const id of ['#title', '#multi', '#workshop', '#charedit']) $(id).classList.remove('show');
  $('#result').classList.remove('show');
  $('#game').classList.add('show');
  $('#in-speed-game').value = String(G.speed);
  $('#in-speed-game').disabled = G.mode === 'client';
}

function showResult(title, win, body) {
  $('#result-title').textContent = title;
  $('#result-title').className = win ? 'win' : 'lose';
  $('#result-body').innerHTML = body;
  const multi = G.mode !== 'solo';
  $('#btn-again').textContent = multi ? '로비로 돌아가기' : '다시 하기';
  $('#btn-again').style.display = multi && G.mode === 'client' ? 'none' : '';
  $('#btn-title').textContent = multi ? '방 나가기' : '타이틀로';
  closeDialogs();
  $('#result').classList.add('show');
}

function showMatchResult(winnerId) {
  G.over = true;
  G.humanResolve = null;
  const winner = G.players.find((p) => p.id === winnerId);
  const win = winnerId === G.meId;
  const s = loadStats();
  if (win) s.win++; else s.lose++;
  saveStats(s);
  showResult(win ? '최후의 생존자' : winner ? `${winner.name} 승리` : '무승부', win,
    `<p>${win ? '모든 상대를 제압했습니다!' : winner ? `${winner.avatar} ${winner.name}이(가) 마지막까지 살아남았습니다.` : '모두 쓰러졌습니다.'}</p>
     <p class="muted">진행한 턴: ${G.turn}</p>
     ${G.mode === 'client' ? '<p class="muted">방장이 로비로 돌아가면 다음 게임을 기다립니다.</p>' : ''}
     <p class="muted">통산 전적 ${s.win}승 ${s.lose}패</p>`);
  renderAll();
}

function showTitle() {
  for (const id of ['#game', '#multi', '#workshop', '#charedit']) $(id).classList.remove('show');
  $('#result').classList.remove('show');
  closeDialogs();
  document.body.classList.remove('night');
  $('#title').classList.add('show');
  const st = loadStats();
  $('#stats').textContent = st.win + st.lose ? `통산 ${st.win}승 ${st.lose}패` : '';
  if (typeof updateTitleInfo === 'function') updateTitleInfo();
}

// ------------------------------------------------------------
//  혼자 하기
// ------------------------------------------------------------
function startSolo() {
  const name = cleanText(($('#in-name').value || '').trim(), 10) || '관리자';
  try { localStorage.setItem('af_name', name); } catch { /* 무시 */ }
  const deckMode = $('#in-deck').value;
  const pack = getActivePack();
  const cards = packCards(pack);
  if (deckMode !== 'base' && !cards.length) { toast('선택한 카드팩에 카드가 없습니다. 기본 카드로 시작합니다.'); }
  if (deckMode === 'personal') {
    const s = packSummary(cards);
    if (!s.valid) {
      toast(s.tooSmall ? `개인 덱은 ${RULES.packMin}장 이상이어야 합니다 (현재 ${s.count}장)` : `팩 코스트가 상한(${RULES.packBudget})을 넘습니다 (현재 ${s.cost})`, 'bad');
      return;
    }
  }
  const cpuN = +$('#in-cpu').value;
  const names = shuffle([...CPU_NAMES]);
  const avs = shuffle([...CPU_AVATARS]);
  const players = [{ name, avatar: '🜲', ctrl: 'local', look: getLook(), pack: deckMode === 'base' ? null : { name: pack.name, cards } }];
  for (let i = 0; i < cpuN; i++) players.push({ name: names[i], avatar: avs[i], ctrl: 'cpu', pack: null });
  startMatch({ mode: 'solo', meId: 0, players, deckMode: deckMode === 'base' ? 'mixed' : deckMode,
    speed: +$('#in-speed').value, difficulty: $('#in-diff').value });
}

// ------------------------------------------------------------
//  테마 (다크 / 라이트)
// ------------------------------------------------------------
function currentTheme() { return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; }
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('af_theme', t); } catch { /* 무시 */ }
  $$('.theme-toggle').forEach((b) => {
    b.textContent = t === 'light' ? '☀️' : '🌙';
    b.title = t === 'light' ? '라이트 모드 (누르면 다크 모드)' : '다크 모드 (누르면 라이트 모드)';
  });
}

function initUI() {
  applyTheme(currentTheme());
  const cineBtn = $('#btn-cine');
  const cineLabel = () => { cineBtn.textContent = cineMode() === 'full' ? '🎬 전체 화면' : '🎬 무대 안'; };
  cineLabel();
  cineBtn.onclick = () => { setCineMode(cineMode() === 'full' ? 'inline' : 'full'); cineLabel(); toast(cineMode() === 'full' ? '전투 연출: 전체 화면' : '전투 연출: 무대 안'); };
  $$('.theme-toggle').forEach((b) => (b.onclick = () => applyTheme(currentTheme() === 'light' ? 'dark' : 'light')));
  try { $('#in-name').value = localStorage.getItem('af_name') || ''; } catch { /* 무시 */ }
  const s = loadStats();
  $('#stats').textContent = s.win + s.lose ? `통산 ${s.win}승 ${s.lose}패` : '';

  $('#btn-start').onclick = startSolo;
  $('#btn-again').onclick = () => {
    if (G.mode === 'host') { Net.backToLobby(); return; }
    startSolo();
  };
  $('#btn-title').onclick = () => {
    G.session = (G.session || 0) + 1;     // 진행 중인 게임 중단
    if (G.mode !== 'solo' && typeof Net !== 'undefined') Net.leave();
    G.mode = 'solo';
    showTitle();
  };
  $('#btn-act').onclick = onAction;
  $('#btn-pray').onclick = onPray;
  $('#btn-cancel').onclick = () => {
    if (G.defendReq) { G.defendReq.picked = []; G.defendReq.mode = 'none'; renderAll(); return; }
    resetSel(); renderAll();
  };
  $$('.open-rules').forEach((b) => (b.onclick = () => $('#rules').classList.add('show')));
  $('#rules-close').onclick = () => $('#rules').classList.remove('show');
  $('#btn-gallery').onclick = () => {
    const night = Object.values(NIGHT_EVENTS).map((e) => `<div class="g-item"><div class="card night-gallery"><div class="night-icon">${e.icon}</div><div class="c-name">${e.name}</div></div>
      <div class="flavor">${e.flavor}<br><span class="muted">뒷골목의 밤 전용 · ${e.damages ? `뽑으면 ${e.damages.join('/')} 피해` : 'HP 10 / 정신력 10 / 10안 중 하나'}</span></div></div>`).join('');
    $('#gallery-list').innerHTML = [...CARDS, ...getCustomCards()].map((c) => `<div class="g-item">${cardHTML(c)}<div class="g-text"><div class="fx-lines">${describeCard(c).lines.map((l) => `<span>${l}</span>`).join('')}</div><div class="flavor">${c.flavor || ''} <span class="muted">×${c.count}${c.custom ? ' · 내 카드' : ''}</span></div></div></div>`).join('') + night;
    $('#gallery').classList.add('show');
  };
  $('#gallery-close').onclick = () => $('#gallery').classList.remove('show');
  $('#in-speed-game').onchange = (e) => { if (G.mode !== 'client') G.speed = +e.target.value; };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      $('#rules').classList.remove('show');
      $('#gallery').classList.remove('show');
      if (G.humanResolve && !G.acting) { resetSel(); renderAll(); }
    }
  });
}

document.addEventListener('DOMContentLoaded', initUI);
