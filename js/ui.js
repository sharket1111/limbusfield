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

// E.G.O 카드: 금테 액자 + 원형 그림 + 위력/코인 + 효과 글
const EGO_GRADE = (cost) => (cost <= 10 ? 'Ⅰ' : cost <= 20 ? 'Ⅱ' : cost <= 30 ? 'Ⅲ' : cost <= 45 ? 'Ⅳ' : 'Ⅴ');
function egoCardHTML(c, opt = {}) {
  const sin = SINS[sinOf(c)];
  const atk = c.kind === 'attack';
  const dt = atk ? DTYPES[dtypeOf(c)] : null;
  const nCoins = Array.isArray(c.coins) ? c.coins.length : RULES.coins;
  const coinPow = Array.isArray(c.coins) && c.coins.length ? c.coins[0].power : RULES.coinPower;
  const sub = { attack: '', heal: `HP +${c.power}`, cure: '상태 이상 해제', steal: '카드 강탈', stun: '대상 기절' }[c.kind] || '';
  const strip = (t) => t.replace(/<[^>]+>/g, '').replace(/^\[[^\]]*\]\s*/, '');
  const lines = (c.effects || []).slice(0, 2).map((e) => `<span>${KEYWORDS[e.key] ? KEYWORDS[e.key].icon : ''}${strip(effectText(e))}</span>`);
  if (!lines.length && sub) lines.push(`<span>${sub}</span>`);
  if (fxOf(c).includes('all')) lines.push('<span>전체 공격</span>');
  let img = '';
  if (c.img) { ensureImgStyle(c); img = ` has-img cimg-${c.id}`; }
  return `<div class="card ego-card t-ego r${c.rarity || 1} ${opt.big ? 'big' : ''} ${opt.cls || ''}" style="--sin:${sin.color};--sin2:${shade(sin.color, -0.5)};--sin3:${shade(sin.color, 0.35)}" ${opt.uid ? `data-uid="${c.uid}"` : ''}>
    <div class="eg-top"><span class="eg-tag">E.G.O</span><span class="eg-grade" title="등급">${EGO_GRADE(c.cost)}</span></div>
    <div class="eg-risk" title="정신력 소모">🧠 정신력 <b>-${c.cost}</b></div>
    <div class="eg-art${img}">${img ? '' : '<span>✧</span>'}</div>
    <div class="eg-gem" title="${sin.name}">${sin.name[0]}</div>
    <div class="eg-name">${c.name}</div>
    <div class="eg-stats">${atk ? `<b class="eg-pow">${c.power}</b><span class="eg-coins">${'<i></i>'.repeat(Math.min(5, nCoins))}<small>+${coinPow}</small></span>${dt ? `<span class="eg-dt" title="${dt.name}">${dt.icon}</span>` : ''}` : `<b class="eg-sub">${sub}</b>`}</div>
    <div class="eg-txt">${lines.join('')}</div>
    <span class="c-cost" title="코스트">${cardCost(c)}</span>
  </div>`;
}

function cardHTML(c, opt = {}) {
  if (c.type === 'ego') return egoCardHTML(c, opt);
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
      ${(() => {
        const atk = c.type === 'weapon' || (c.type === 'ego' && c.kind === 'attack');
        const dt = atk ? DTYPES[dtypeOf(c)] : null;
        return `<div class="c-badge" title="${dt ? dt.name : a ? a.name : TYPE_NAME[c.type]}"><span>${dt ? dt.icon : a ? a.icon : glyph}</span></div>`;
      })()}
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
  if (c.type === 'weapon' || (c.type === 'ego' && c.kind === 'attack')) parts.push(`${DTYPES[dtypeOf(c)].icon} ${DTYPES[dtypeOf(c)].name}`);
  if (c.type === 'armor') parts.push(`${DEF_KIND[defKind(c)]} · 수비 위력 ${c.def}`);
  if (c.type === 'ego') parts.push(`위력 ${c.power} · 정신력 ${c.cost} 소모`);
  if (a) parts.push(`${a.icon} ${a.name}`);
  fxOf(c).forEach((f) => parts.push(FX_TEXT[f]));
  if (c.weight > 1 && !fxOf(c).includes('all')) parts.push(`가중치 ${c.weight} (최대 ${c.weight}명 공격)`);
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
    <div style="width:${(p.stg / (p.stgMax || RULES.staggerMax)) * 100}%"></div><span>${st ? '💢 흐트러짐' : `흐트러짐 ${p.stg}`}</span></div>`;
}

const handCount = (p) => (p.handCount != null ? p.handCount : p.hand.length);
const ctrlBadge = (p) => (G.mode === 'solo' ? '' : `<span class="ctrl ${p.ctrl}">${p.ctrl === 'cpu' ? 'CPU' : '👤'}</span>`);

// ------------------------------------------------------------
//  전투 무대 (메인 화면): 모든 플레이어가 캐릭터로 서 있고, 발 밑에 HP·흐트러짐·정신력·키워드
//  나는 왼쪽, 다른 사람들은 오른쪽 (4명 이상이면 앞뒤 두 줄)
// ------------------------------------------------------------
function fieldLayout(n) {
  const spread = (k, a, b) => (k === 1 ? [(a + b) / 2] : Array.from({ length: k }, (_, i) => a + ((b - a) * i) / (k - 1)));
  if (n <= 3) return spread(n, 54, 86).map((x) => ({ x, b: 4, s: 1, z: 3 }));
  // 4명 이상: 앞줄·뒷줄을 번갈아 지그재그로
  return spread(n, 46, 90).map((x, i) => (i % 2 ? { x, b: 15, s: 0.86, z: 2 } : { x, b: 2, s: 1, z: 4 }));
}

const fieldTargeting = () => {
  const c = G.dragCard || (G.humanResolve && !G.acting ? G.sel.main : null);
  return !!c && needsTarget(c);
};

// ------------------------------------------------------------
//  대상 화살표: 끌어다 놓는 중(파랑) / 대상 지정됨(노랑) / 적이 나를 노림(빨강)
// ------------------------------------------------------------
const ARROW_DEFS = `<defs>${['blue', 'yellow', 'red'].map((c) => `<marker id="ah-${c}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto"><path d="M0,0 L10,5 L0,10 L3,5 Z" class="ah ${c}"/></marker>`).join('')}</defs>`;
let ARROW_TIMER = 0;
function pfAnchor(pid, fr) {
  const el = document.querySelector(`#fighters .pf[data-pid="${pid}"] .f-fig`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2 - fr.left, y: r.top + r.height * 0.42 - fr.top };
}
function arrowPath(a, b) {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const lift = Math.max(36, dist * 0.32);
  // 끝을 조금 앞에서 멈춰 화살촉이 캐릭터에 묻히지 않게
  const mx = (a.x + b.x) / 2, my = Math.min(a.y, b.y) - lift;
  const k = Math.max(0, 1 - 18 / Math.max(1, dist));
  const ex = mx + (b.x - mx) * k, ey = my + (b.y - my) * k;
  return `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`;
}
function drawArrows(pointer) {
  const svg = $('#arrows'), field = $('#field');
  if (!svg || !field || !G.players.length) return;
  const fr = field.getBoundingClientRect();
  const out = [];
  const add = (from, to, cls) => { if (from && to) out.push(`<path class="arw ${cls}" d="${arrowPath(from, to)}" marker-end="url(#ah-${cls})"/>`); };
  const meA = pfAnchor(G.meId, fr);
  if (G.defendReq && G.defendReq.attacker) add(pfAnchor(G.defendReq.attacker.id, fr), meA, 'red');
  if (G.dragCard) {
    let to = null;
    if (DRAG.over) to = pfAnchor(+DRAG.over.dataset.pid, fr);
    else if (pointer) to = { x: pointer.x - fr.left, y: pointer.y - fr.top };
    add(meA, to, 'blue');
  } else if (G.humanResolve && !G.acting && G.sel.target && G.sel.target.alive) {
    add(meA, pfAnchor(G.sel.target.id, fr), 'yellow');
  }
  svg.innerHTML = ARROW_DEFS + out.join('');
}

function renderField() {
  const box = $('#fighters');
  if (!box) return;
  const st = $('#field-street');
  if (st && !st.firstChild) st.innerHTML = streetSVG() + '<div class="rain"></div>';
  const mine = me();
  const others = G.players.filter((p) => p.id !== G.meId);
  const lay = fieldLayout(others.length);
  const spots = [[mine, { x: 20, b: 4, s: 1.06, z: 5 }], ...others.map((p, i) => [p, lay[i]])];
  const targeting = fieldTargeting();
  const cur = G.players[G.current];
  const keep = new Set();
  for (const [p, pos] of spots) {
    if (!p) continue;
    keep.add(String(p.id));
    const look = p.look || randomLook(p.name);
    const lookKey = JSON.stringify(look);
    let el = box.querySelector(`.pf[data-pid="${p.id}"]`);
    if (!el || el.dataset.look !== lookKey) {
      if (el) el.remove();
      el = document.createElement('div');
      el.className = 'pf';
      el.dataset.pid = p.id;
      el.dataset.look = lookKey;
      el.innerHTML = `<div class="pf-turn">▼</div><div class="pf-aim">🎯</div><div class="pf-sk"></div>
        <div class="f-fig"><div class="ff-base"></div><svg class="ff-ring"></svg>
          <div class="f-body ${p.id === G.meId ? '' : 'flip'}">${charSVG(look, { gear: null })}</div></div>
        <div class="f-foot"></div>`;
      el.onclick = () => { if (!DRAG.used) onTargetClick(p.id); };
      box.appendChild(el);
    }
    const stag = has(p, 'staggered');
    const team = p.id === G.meId ? 'me' : 'foe';
    el.className = `pf t-${team} ${p.alive ? '' : 'dead'} ${cur === p && !G.over ? 'active' : ''}`
      + ` ${targeting && p.alive && p.id !== G.meId ? 'targetable' : ''} ${G.sel.target && G.sel.target.id === p.id ? 'targeted' : ''}`
      + ` ${G.defendReq && G.defendReq.attacker === p ? 'attacking' : ''} ${p.id === G.meId && G.defendReq ? 'defending' : ''}`;
    el.style.cssText = `left:${pos.x}%;bottom:${pos.b}%;--s:${pos.s};z-index:${pos.z}`;
    el.title = `${p.name} — HP ${p.hp}/${p.maxHp || RULES.maxHp} · 흐트러짐 ${p.stg}/${p.stgMax || RULES.staggerMax}\n${resLine(p)}`
      + (p.passives && p.passives.length ? `\n패시브: ${p.passives.map((ps) => passiveText(ps).replace(/<[^>]+>/g, '')).join(' / ')}` : '');
    $('.ff-base', el).className = `ff-base t-${team}`;
    // 머리 위: 고른 스킬 (나) / 지금 쓰는 공격 (나를 노리는 적)
    const sk = $('.pf-sk', el);
    const skCards = p.id === G.meId && G.sel.main && !G.defendReq ? [G.sel.main, ...G.sel.plus]
      : G.defendReq && G.defendReq.attacker === p ? G.defendReq.info.cards : [];
    sk.innerHTML = skCards.map((c) => `<span class="pk-hex" style="--sin:${SINS[sinOf(c)].color}" title="${c.name}">${c.type === 'weapon' || c.kind === 'attack' ? DTYPES[dtypeOf(c)].icon : '✧'}<b>${c.atk || c.power || ''}</b></span>`).join('');
    const ring = $('.ff-ring', el);
    ring.outerHTML = ringSVG(p, stag);
    $('.f-foot', el).outerHTML = footHTML(p, {
      stag,
      extra: `${G.mode === 'solo' || p.id === G.meId ? '' : `<i class="ctrl ${p.ctrl}">${p.ctrl === 'cpu' ? 'CPU' : '👤'}</i>`}🂠 ${handCount(p)} · <span class="won">${p.won}안</span>`,
    });
  }
  $$('.pf', box).forEach((el) => { if (!keep.has(el.dataset.pid)) el.remove(); });
  $('#field').classList.toggle('aiming', targeting);
  drawArrows();
  clearTimeout(ARROW_TIMER);
  ARROW_TIMER = setTimeout(() => drawArrows(), 400);   // 자리 이동 애니메이션이 끝난 뒤 다시
  const hint = $('#field-hint');
  if (hint) {
    const overP = DRAG.over ? G.players.find((q) => q.id === +DRAG.over.dataset.pid) : null;
    hint.textContent = G.dragCard ? (overP && (G.dragCard.type === 'weapon' || G.dragCard.kind === 'attack') ? `${overP.name}: ${resLine(overP)}` : needsTarget(G.dragCard) ? '공격할 상대에게 놓으세요' : '무대에 놓으면 사용합니다')
      : G.humanResolve && !G.acting && !G.defendReq ? '카드를 상대에게 끌어다 놓아 사용' : '';
  }
}

// ------------------------------------------------------------
//  카드 끌어다 놓기: 손패 카드를 적 캐릭터 위에 놓으면 그 대상에게 사용
//  (대상이 필요 없는 카드는 무대 아무 곳에나 놓으면 사용)
// ------------------------------------------------------------
const DRAG = { card: null, el: null, ghost: null, x0: 0, y0: 0, pid: null, moved: false, used: false, over: null };

function dragStart() {
  const r = DRAG.el.getBoundingClientRect();
  const g = DRAG.el.cloneNode(true);
  g.classList.add('drag-ghost');
  g.style.width = r.width + 'px';
  g.style.height = r.height + 'px';
  document.body.appendChild(g);
  DRAG.ghost = g;
  DRAG.el.classList.add('dragging');
  DRAG.moved = true;
  G.dragCard = DRAG.card;
  G.hover = DRAG.card;
  renderField();
  renderInfo();
}

function dragMove(x, y) {
  const g = DRAG.ghost;
  g.style.transform = `translate(${x - g.offsetWidth / 2}px, ${y - g.offsetHeight * 0.75}px) rotate(-4deg)`;
  const hit = document.elementFromPoint(x, y);
  const pf = hit && hit.closest('.pf');
  const inField = !!(hit && hit.closest('#field'));
  if (DRAG.over) DRAG.over.classList.remove('drop-over');
  DRAG.over = null;
  const okTarget = pf && pf.classList.contains('targetable');
  if (okTarget) { pf.classList.add('drop-over'); DRAG.over = pf; }
  g.classList.toggle('can-drop', !!okTarget || (!needsTarget(DRAG.card) && inField));
  DRAG.inField = inField;
  if (needsTarget(DRAG.card)) drawArrows({ x, y });
  const hint = $('#field-hint');
  if (hint) {
    const overP = DRAG.over ? G.players.find((q) => q.id === +DRAG.over.dataset.pid) : null;
    hint.textContent = overP && (DRAG.card.type === 'weapon' || DRAG.card.kind === 'attack') ? `${overP.name}: ${resLine(overP)}` : needsTarget(DRAG.card) ? '공격할 상대에게 놓으세요' : '무대에 놓으면 사용합니다';
  }
}

function dragEnd(useIt) {
  const card = DRAG.card, over = DRAG.over, inField = DRAG.inField;
  if (DRAG.ghost) DRAG.ghost.remove();
  if (DRAG.el) DRAG.el.classList.remove('dragging');
  if (over) over.classList.remove('drop-over');
  const moved = DRAG.moved;
  Object.assign(DRAG, { card: null, el: null, ghost: null, pid: null, moved: false, over: null, inField: false });
  G.dragCard = null;
  if (moved) { DRAG.used = true; setTimeout(() => { DRAG.used = false; }, 0); }
  if (!moved) return;
  if (useIt && card && G.humanResolve && !G.acting) {
    if (needsTarget(card)) {
      if (over) return dropUse(card, G.players.find((q) => q.id === +over.dataset.pid));
    } else if (inField) return dropUse(card, null);
  }
  renderAll();
}

// 끌어다 놓으면 그 카드와 대상을 고르기만 함 — 오른쪽 기어(START)를 눌러야 확정
//  이미 무기를 골랐고 끈 카드가 보조 무기면 보조 칸에 추가
function dropUse(card, target) {
  const s = G.sel;
  if (s.main && s.main.type === 'weapon' && card.type === 'weapon' && card.plus && s.main.uid !== card.uid) {
    if (!s.plus.some((c) => c.uid === card.uid)) s.plus.push(card);
  } else if (!(s.main && s.main.uid === card.uid)) G.sel = { main: card, plus: [], target: s.target, goods: null };
  if (target) G.sel.target = target;
  renderAll();
}

function initDrag() {
  const hand = $('#hand');
  hand.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.card');
    if (!el || e.button > 0 || G.defendReq || !G.humanResolve || G.acting) return;
    const card = me().hand.find((c) => c && c.uid === +el.dataset.uid);
    if (!card || card.type === 'armor') return;
    Object.assign(DRAG, { card, el, x0: e.clientX, y0: e.clientY, pid: e.pointerId, moved: false });
  });
  window.addEventListener('pointermove', (e) => {
    if (!DRAG.card || e.pointerId !== DRAG.pid) return;
    if (!DRAG.moved) {
      const dx = e.clientX - DRAG.x0, dy = e.clientY - DRAG.y0;
      if (Math.hypot(dx, dy) < 12) return;
      // 터치에서 옆으로 미는 건 손패 넘기기
      if (e.pointerType !== 'mouse' && Math.abs(dx) > Math.abs(dy)) { DRAG.card = null; return; }
      dragStart();
    }
    e.preventDefault();
    dragMove(e.clientX, e.clientY);
  }, { passive: false });
  window.addEventListener('pointerup', (e) => { if (DRAG.card && e.pointerId === DRAG.pid) dragEnd(true); });
  window.addEventListener('pointercancel', (e) => { if (DRAG.card && e.pointerId === DRAG.pid) dragEnd(false); });
}

function renderMe() {
  const p = me();
  const myTurn = !!G.humanResolve;
  // 왼쪽 아래: 육각 초상화 둘레에 HP·흐트러짐 원형 게이지, 위쪽에 보유 E.G.O 색 보석, 정신력 원
  //  초상화를 꾹 누르면 E.G.O 선택 화면
  const stag = has(p, 'staggered');
  $('#me').innerHTML = `
    <div class="me-card me-hud ${myTurn ? 'active' : ''} ${G.defendReq ? 'under-attack' : ''} ${p.alive ? '' : 'dead'}">
      ${profileHTML(p)}
      <div class="mh-stats">
        <div class="mh-name">${p.name} <span class="me-turn">${G.defendReq ? '⚠ 공격받는 중' : myTurn ? '▶ 내 차례' : G.over ? '' : '대기 중'}</span></div>
        <div class="mh-res"><span class="mh-res-t">내성 정보</span>${Object.entries(DTYPES).map(([d, v]) => {
          const m = resOf(p, d);
          return `<span class="${m < 1 ? 'good' : m > 1 ? 'bad' : ''}" title="${v.name} ${resInfo(m)[1]}">${v.icon}${m.toFixed(2)}</span>`;
        }).join('')}</div>
        <div class="mh-line">흐트러짐 <b class="${stag ? 'neg' : ''}">${stag ? '💢 흐트러짐' : `${p.stg}/${p.stgMax || RULES.staggerMax}`}</b> · <span class="won">${p.won}안</span> · 앞면 ${Math.round(headChance(p.sp) * 100)}%</div>
        <div class="mh-line muted">E.G.O ${egoCount(p)}/${RULES.maxEgo} — 초상화를 꾹 누르면 E.G.O 선택</div>
      </div>
    </div>`;
  bindProfilePress();

  const hand = $('#hand');
  const sel = G.sel;
  const order = { ego: -1, weapon: 0, trade: 2, item: 3, armor: 4 };
  const val = (c) => c.atk || c.def || c.cost || 0;
  // 보관한 E.G.O는 손패에 보이지 않음 — 초상화를 꾹 눌러 E.G.O 선택 화면에서 고름
  const sorted = [...p.hand].filter((c) => c && c.type !== 'ego').sort((a, b) => order[a.type] - order[b.type] || val(b) - val(a));
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
  }).join('').replace(/(<div class="card ego-card[\s\S]*?)(<div class="card (?!ego-card))/, '$1<div class="ego-sep"></div>$2') || `<div class="muted empty-hand">${p.alive ? '손패가 없습니다' : '탈락 — 관전 중'}</div>`;
  $$('.card', hand).forEach((el) => {
    el.onclick = () => { if (!DRAG.used) onHandClick(+el.dataset.uid); };
    el.onmouseenter = () => { G.hover = p.hand.find((c) => c && c.uid === +el.dataset.uid); renderInfo(); };
  });

  // 버튼
  const act = $('#btn-act');
  const prev0 = $('#preview');
  renderSlots();
  const cap = $('#gear-cap');
  if (G.defendReq) {
    const R = G.defendReq;
    cap.textContent = R.picked.length ? { clash: '⚔ 합!', guard: '🛡 가드', evade: '💨 회피', counter: '↩ 반격' }[R.mode] : '그대로 받기';
    act.disabled = false;
    act.classList.add('ready');
    $('#btn-pray').disabled = true;
    $('#btn-cancel').disabled = !R.picked.length;
    prev0.innerHTML = defPreview();
    return;
  }
  const st = actionState();
  cap.textContent = myTurn ? st.label : G.over ? '게임 종료' : '상대 차례';
  act.disabled = !myTurn || !st.ok || G.acting;
  act.classList.toggle('ready', !act.disabled);
  $('#btn-pray').disabled = !myTurn || G.acting;
  $('#btn-cancel').disabled = !myTurn || G.acting || !sel.main;

  // 공격 미리보기
  const prev = $('#preview');
  if (sel.main && (sel.main.type === 'weapon' || sel.main.kind === 'attack')) {
    const info = buildAttack([sel.main, ...sel.plus]);
    const a = ATTR[info.attr];
    prev.innerHTML = `<span style="color:${a.color}">${a.icon} ${a.name}</span> 위력 <b>${info.atk}</b> ~ ${info.atk + info.coinMax}${info.fx.includes('twice') ? ' ×2' : ''}
      · ${DTYPES[info.dtype].icon} ${DTYPES[info.dtype].name}
      ${sel.target ? ` → ${sel.target.avatar} ${sel.target.name}${resTag(sel.target, info.dtype)}${has(sel.target, 'staggered') ? ' <span class="neg">💢 흐트러짐 (피해 1.5배)</span>' : ''}` : ''}
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

// 대상의 내성 표시 (보통이면 빈칸)
function resTag(p, dtype) {
  const m = resOf(p, dtype);
  if (m === 1) return '';
  return ` <span class="${m > 1 ? 'pos' : 'neg'}">(${DTYPES[dtype].name} ${resInfo(m)[1]} ×${m})</span>`;
}
function resLine(p) {
  return Object.entries(DTYPES).map(([d, v]) => `${v.icon}${v.name} ${resInfo(resOf(p, d))[1]} ×${resOf(p, d)}`).join(' · ');
}

// 육각 초상화 + 둘레 게이지(HP 바깥, 흐트러짐 안쪽) + E.G.O 보석 + 정신력 원 + HP 숫자
const PROF_ARC_A0 = 145, PROF_ARC_A1 = -145;   // 아래쪽이 비는 호 (290°)
function profArc(r) {
  const pt = (a) => [50 + r * Math.cos((a * Math.PI) / 180), 50 - r * Math.sin((a * Math.PI) / 180)];
  const [x0, y0] = pt(-125), [x1, y1] = pt(-55 + 360);
  return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 1 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}
function profileHTML(p) {
  const maxHp = p.maxHp || RULES.maxHp, stgMax = p.stgMax || RULES.staggerMax;
  const stag = has(p, 'staggered');
  const hp = Math.max(0, Math.min(100, (p.hp / maxHp) * 100));
  const sg = stag ? 100 : Math.max(0, Math.min(100, (p.stg / stgMax) * 100));
  const egos = p.hand.filter((c) => c && c.type === 'ego');
  // E.G.O 보석: 위쪽 호를 따라 (왼쪽 위 → 오른쪽 위)
  const gems = Array.from({ length: RULES.maxEgo }, (_, i) => {
    const a = (150 - i * 30) * (Math.PI / 180);
    const x = 50 + 54 * Math.cos(a), y = 50 - 54 * Math.sin(a);
    const c = egos[i];
    const cls = !c ? 'empty' : canPayEgo(p, c) ? 'ok' : 'no';
    return `<i class="pg ${cls}" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;${c ? `--sin:${SINS[sinOf(c)].color}` : ''}" title="${c ? `${c.name} — 정신력 ${c.cost}` : '빈 E.G.O 칸'}"></i>`;
  }).join('');
  return `<div class="mh-face" id="my-profile" title="꾹 누르면 E.G.O 선택">
    <svg class="mh-ring" viewBox="0 0 100 100" aria-hidden="true">
      <path class="trk" d="${profArc(45)}" pathLength="100"/>
      <path class="hp" d="${profArc(45)}" pathLength="100" stroke-dasharray="${hp.toFixed(1)} 100"/>
      <path class="trk s" d="${profArc(39)}" pathLength="100"/>
      <path class="stg ${stag ? 'broken' : ''}" d="${profArc(39)}" pathLength="100" stroke-dasharray="${sg.toFixed(1)} 100"/>
    </svg>
    <div class="mh-hex">${p.look ? portraitSVG(p.look) : p.avatar}</div>
    ${gems}
    <b class="mh-hpn">${p.hp}</b>
    <span class="mh-sp" style="--spc:${spColor(p.sp)}" title="정신력 ${p.sp}">${p.sp}</span>
  </div>`;
}

// 초상화 꾹 누르기(또는 오른쪽 클릭) → E.G.O 선택 화면
let PRESS_T = 0;
function bindProfilePress() {
  const el = $('#my-profile');
  if (!el) return;
  const cancel = () => { clearTimeout(PRESS_T); el.classList.remove('pressing'); };
  el.onpointerdown = (e) => {
    cancel();
    el.classList.add('pressing');
    PRESS_T = setTimeout(() => { el.classList.remove('pressing'); openEgoPick(); }, 450);
    e.preventDefault();
  };
  el.onpointerup = cancel;
  el.onpointerleave = cancel;
  el.oncontextmenu = (e) => { e.preventDefault(); cancel(); openEgoPick(); };
}

function openEgoPick() {
  const p = me();
  if (!p) return;
  const egos = p.hand.filter((c) => c && c.type === 'ego');
  const canUse = !!G.humanResolve && !G.acting && !G.defendReq;
  $('#egopick-list').innerHTML = egos.length ? egos.map((c) => {
    const ok = canPayEgo(p, c);
    return `<div class="ep-item ${ok ? '' : 'no-sp'} ${G.sel.main && G.sel.main.uid === c.uid ? 'picked' : ''}" data-ego="${c.uid}">
      ${egoCardHTML(c, { big: true })}
      <div class="ep-desc">${describeCard(c).lines.map((l) => `<span>${l}</span>`).join('')}</div>
      <span class="ep-state">${!ok ? '정신력 부족' : canUse ? '눌러서 선택' : '내 차례에 선택 가능'}</span>
    </div>`;
  }).join('') : '<p class="muted">보유한 E.G.O가 없습니다. 덱에서 E.G.O 카드를 얻으면 여기에 쌓입니다 (최대 5개).</p>';
  $('#egopick-foot').innerHTML = `${profileHTML(p)}
    <div class="ep-res"><b>내성 정보</b>${Object.entries(DTYPES).map(([d, v]) => {
      const m = resOf(p, d);
      return `<span class="${m < 1 ? 'good' : m > 1 ? 'bad' : ''}">${v.icon} ${v.name} <b>${m.toFixed(2)}</b> <small>${resInfo(m)[1]}</small></span>`;
    }).join('')}</div>`;
  $('#egopick').classList.add('show');
}

// 가운데 아래: 고른 스킬 칸 (주 스킬 1개 + 보조 무기들) → 대상
function slotHTML(c, role) {
  if (!c) return `<div class="slot empty ${role}"><span>${role === 'main' ? '스킬' : '보조'}</span></div>`;
  const sin = SINS[sinOf(c)];
  const val = c.type === 'weapon' ? c.atk : c.type === 'ego' ? c.power || c.cost : c.type === 'armor' ? c.def : '';
  const glyph = c.type === 'weapon' || (c.type === 'ego' && c.kind === 'attack') ? DTYPES[dtypeOf(c)].icon : c.type === 'ego' ? '✧' : c.type === 'trade' ? '💱' : c.type === 'armor' ? DEF_GLYPH[defKind(c)] : '✚';
  return `<div class="slot ${role} filled" data-slot="${c.uid}" style="--sin:${sin.color};--sin2:${shade(sin.color, -0.5)}" title="${c.name} (눌러서 빼기)">
    <span class="sl-g">${glyph}</span><b>${val}</b><em>${c.name}</em></div>`;
}
function renderSlots() {
  const box = $('#slots');
  if (!box) return;
  const p = me(), s = G.sel;
  if (G.defendReq) {
    const picked = defPicked();
    box.innerHTML = `<span class="sl-tag def">대응</span>${picked.map((c, i) => slotHTML(c, i ? 'plus' : 'main')).join('') || slotHTML(null, 'main')}`;
  } else {
    const canPlus = s.main && s.main.type === 'weapon' && p.hand.some((c) => c && c.type === 'weapon' && c.plus && c !== s.main && !s.plus.includes(c));
    const t = s.target;
    box.innerHTML = `<span class="sl-tag">${G.humanResolve ? '스킬' : '대기'}</span>${slotHTML(s.main, 'main')}${s.plus.map((c) => slotHTML(c, 'plus')).join('')}${canPlus ? slotHTML(null, 'plus') : ''}
      <span class="sl-arrow">➤</span><div class="slot-target ${t ? 'on' : ''}">${t ? `${t.look ? portraitSVG(t.look) : ''}<b>${t.name}</b>` : '<span>대상</span>'}</div>`;
  }
  $$('.slot.filled', box).forEach((el) => (el.onclick = () => { if (G.humanResolve || G.defendReq) onHandClick(+el.dataset.slot); }));
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
  renderField();
  renderMe();
  renderInfo();
  const left = RULES.nightTurn - G.turn;
  $('#round').textContent = G.turn;
  $('#night-tag').innerHTML = isNight() ? '<span class="night-tag">🌙 뒷골목의 밤</span>' : left <= 20 ? `<span class="muted small">밤까지 ${left}턴</span>` : '';
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
  if (main.type === 'trade') return { label: { buy: '🛒 매입 (턴 종료)', sell: '💸 강매 (턴 종료)', exchange: '💱 환전 (턴 종료)' }[main.kind], ok: true };
  if (main.type === 'weapon') return { label: '⚔ 공격', ok: true };
  if (main.type === 'ego' && main.kind === 'attack') return { label: '✧ E.G.O 공격', ok: true };
  if (main.type === 'ego' && (main.kind === 'steal' || main.kind === 'stun')) return { label: '✧ E.G.O 발현 (턴 종료)', ok: true };
  if (main.type === 'item') return { label: '사용 (턴 종료)', ok: true };
  return { label: '사용 (턴 종료)', ok: true };
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
  if (c.type !== 'armor') return false;
  return !(defKind(c) === 'guard' && info.fx.includes('pierce'));
}
function defWhyNot(c) {
  if (c.type !== 'weapon' && c.type !== 'armor') return '무기(합)나 수비 카드만 낼 수 있습니다';
  return '방어 무시 공격에는 가드를 쓸 수 없습니다';
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
// 휴대폰: 가능하면 전체 화면 + 가로 고정 (안 되면 세로일 때 안내 화면이 덮음)
function lockLandscape() {
  if (!matchMedia('(pointer: coarse)').matches) return;
  const el = document.documentElement;
  const lock = () => (screen.orientation && screen.orientation.lock ? screen.orientation.lock('landscape') : Promise.reject());
  try {
    const fs = !document.fullscreenElement && el.requestFullscreen ? el.requestFullscreen() : Promise.resolve();
    fs.then(lock).catch(() => {});
  } catch { /* 지원 안 함 */ }
}

function enterGameScreen() {
  $('#log').innerHTML = '';
  $('#fighters').innerHTML = '';
  clearStageLocal('');
  lockLandscape();
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
  const sh = sheetSummary(pack.sheet);
  if (!sh.valid) { toast(`「${pack.name}」의 캐릭터 스탯 포인트가 상한을 넘습니다 (${sh.points}/${sh.budget}). 카드 공방에서 고쳐 주세요`, 'bad'); return; }
  if (deckMode === 'personal') {
    const s = packSummary(cards, pack.keywords);
    if (!s.valid) {
      toast(s.tooSmall ? `개인 덱은 ${RULES.packMin}장 이상이어야 합니다 (현재 ${s.count}장)` : `팩 코스트가 상한(${RULES.packBudget})을 넘습니다 (현재 ${s.cost})`, 'bad');
      return;
    }
  }
  const cpuN = +$('#in-cpu').value;
  const names = shuffle([...CPU_NAMES]);
  const avs = shuffle([...CPU_AVATARS]);
  const players = [{ name, avatar: '🜲', ctrl: 'local', look: getLook(),
    pack: { name: pack.name, cards: deckMode === 'base' ? [] : cards, sheet: pack.sheet, keywords: pack.keywords } }];
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

// ------------------------------------------------------------
//  키워드 아이콘 바꾸기 (이 기기에서만)
// ------------------------------------------------------------
function renderKwIcons() {
  const cur = getKwIcons();
  $('#kwicons-list').innerHTML = KW_ICON_KEYS.map((k) => `<div class="kwi-row">
      <span class="kwi-prev">${KEYWORDS[k].icon}</span><b>${KEYWORDS[k].name}</b>
      <label class="btn small">그림 고르기<input type="file" accept="image/png,image/webp,image/jpeg,image/gif" data-kwfile="${k}" hidden></label>
      ${cur[k] ? `<button class="btn small" data-kwreset="${k}">기본으로</button>` : '<span class="muted small">기본 아이콘</span>'}
    </div>`).join('');
}

// 그림을 96px 정사각형 PNG로 줄임 (투명 배경 유지)
function shrinkIcon(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const n = 96, cv = document.createElement('canvas');
      cv.width = cv.height = n;
      const k = Math.min(n / img.width, n / img.height);
      const w = img.width * k, h = img.height * k;
      cv.getContext('2d').drawImage(img, (n - w) / 2, (n - h) / 2, w, h);
      URL.revokeObjectURL(url);
      res(cv.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('bad image')); };
    img.src = url;
  });
}

function initKwIcons() {
  applyKwIcons();
  $('#btn-kwicons').onclick = () => { renderKwIcons(); $('#kwicons').classList.add('show'); };
  $('#kwicons-close').onclick = () => $('#kwicons').classList.remove('show');
  $('#kwicons-reset').onclick = () => { for (const k of KW_ICON_KEYS) saveKwIcon(k, null); renderKwIcons(); toast('기본 아이콘으로 되돌렸습니다'); };
  $('#kwicons-list').addEventListener('change', async (e) => {
    const k = e.target.dataset.kwfile;
    const f = e.target.files && e.target.files[0];
    if (!k || !f) return;
    try {
      const url = await shrinkIcon(f);
      if (!saveKwIcon(k, url)) { toast('저장 공간이 부족합니다', 'bad'); return; }
      renderKwIcons();
      renderAll();
    } catch { toast('그림을 읽을 수 없습니다', 'bad'); }
  });
  $('#kwicons-list').addEventListener('click', (e) => {
    const k = e.target.dataset.kwreset;
    if (k) { saveKwIcon(k, null); renderKwIcons(); renderAll(); }
  });
}

function initUI() {
  initKwIcons();
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
  initDrag();
  $('#egopick-close').onclick = () => $('#egopick').classList.remove('show');
  $('#egopick-list').addEventListener('click', (e) => {
    const it = e.target.closest('[data-ego]');
    if (!it) return;
    const p = me(), c = p.hand.find((x) => x && x.uid === +it.dataset.ego);
    if (!c) return;
    if (!G.humanResolve || G.acting || G.defendReq) { toast('내 차례에만 E.G.O를 고를 수 있습니다'); return; }
    if (!canPayEgo(p, c)) { toast(`정신력이 부족합니다 (${c.cost} 필요)`, 'bad'); return; }
    G.sel = { main: c, plus: [], target: G.sel.target, goods: null };
    G.hover = c;
    $('#egopick').classList.remove('show');
    renderAll();
  });
  window.addEventListener('resize', () => drawArrows());
  $('#btn-log').onclick = () => document.body.classList.toggle('log-open');
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
