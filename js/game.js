// ============================================================
//  게임 엔진 (규칙 처리). 화면은 ui.js, 네트워크는 net.js
//  플레이어 조작 방식(ctrl): local(이 기기) | remote(온라인 상대) | cpu
//  G.mode: solo(혼자) | host(방장 — 엔진 실행) | client(참가자 — 화면만)
// ============================================================
'use strict';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const rand = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rand(arr.length)];
const fxOf = (c) => c.fx || [];
const hasFx = (c, f) => fxOf(c).includes(f);

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let uidSeq = 1;

const G = {
  mode: 'solo',
  meId: 0,
  players: [],
  shared: { deck: [], discard: [] },
  deckMode: 'mixed',      // base | mixed | personal
  current: 0,
  turn: 0,                // 모든 플레이어의 턴을 합산한 수
  round: 1,
  over: false,
  speed: 1,
  difficulty: 'normal',
  defs: {},               // 카드 id → 정의
  sel: { main: null, plus: [], target: null, goods: null },
  humanResolve: null,
  defendReq: null,
  acting: false,
  hover: null,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms * G.speed));
const isNight = () => G.turn >= RULES.nightTurn;
const netFx = (k, d) => { if (G.mode === 'host' && typeof Net !== 'undefined') Net.fx(k, d); };

// ------------------------------------------------------------
//  저장 (전적)
// ------------------------------------------------------------
function loadStats() {
  try { return JSON.parse(localStorage.getItem('af_stats')) || { win: 0, lose: 0 }; }
  catch { return { win: 0, lose: 0 }; }
}
function saveStats(s) {
  try { localStorage.setItem('af_stats', JSON.stringify(s)); } catch { /* 무시 */ }
}

// ------------------------------------------------------------
//  카드 정의 / 이미지
// ------------------------------------------------------------
const IMG_RULES = new Map();
function ensureImgStyle(c) {
  if (!c.img || !/^[A-Za-z0-9_]+$/.test(c.id || '')) return;
  if (IMG_RULES.get(c.id) === c.img) return;
  IMG_RULES.set(c.id, c.img);
  let el = document.getElementById('card-imgs');
  if (!el) { el = document.createElement('style'); el.id = 'card-imgs'; document.head.appendChild(el); }
  el.textContent = [...IMG_RULES].map(([id, img]) =>
    `.cimg-${id}{background-image:linear-gradient(180deg,rgba(10,8,12,0) 55%,rgba(10,8,12,.85) 100%),url("${img}")}`).join('\n');
}
function registerDefs(list) {
  for (const c of list) { G.defs[c.id] = c; ensureImgStyle(c); }
}
const cardRef = (c) => ({ uid: c.uid, id: c.id });
function resolveCard(r) {
  const d = r && G.defs[r.id];
  return d ? { ...d, uid: r.uid } : null;
}
const instances = (defs) => {
  const out = [];
  for (const c of defs) for (let i = 0; i < (c.count || 1); i++) out.push({ ...c, uid: uidSeq++ });
  return out;
};
// 다른 플레이어의 팩과 id가 겹치지 않게
const nsCards = (cards, ns) => cards.map((c) => ({ ...c, id: `${ns}_${c.id}` }));

// CPU용 개인 덱: 기본 카드에서 코스트 상한 안으로 무작위 구성
function cpuPackDefs() {
  const pool = shuffle(instances(CARDS));
  const picked = [];
  let cost = 0;
  for (const c of pool) {
    const k = cardCost(c);
    if (cost + k > RULES.packBudget) continue;
    picked.push(c);
    cost += k;
  }
  return picked;
}

// ------------------------------------------------------------
//  플레이어 / 덱
// ------------------------------------------------------------
function makePlayer(id, name, avatar, ctrl) {
  return {
    id, name, avatar, ctrl,
    hp: RULES.maxHp, sp: 0, won: RULES.startWon, stg: RULES.staggerMax,
    hand: [],
    pile: null,
    status: newStatus(),
    alive: true,
    dmgDealt: 0,
  };
}

const me = () => G.players.find((p) => p.id === G.meId);
const human = me;
const alive = () => G.players.filter((p) => p.alive);
const others = (p) => G.players.filter((q) => q.alive && q !== p);
const pileOf = (p) => (G.deckMode === 'personal' && p.pile ? p.pile : G.shared);

// 카드 뽑기. 뒷골목의 밤에는 일정 확률로 이벤트(청소부/연료통)가 대신 나옴
function drawCards(p, n = 1) {
  let got = 0;
  const pile = pileOf(p);
  for (let i = 0; i < n; i++) {
    if (!p.alive) break;
    if (isNight() && Math.random() < RULES.nightChance) {
      nightEvent(p);
      continue;
    }
    if (p.hand.length >= RULES.maxHand) break;
    if (!pile.deck.length) {
      if (!pile.discard.length) break;
      pile.deck = shuffle(pile.discard);
      pile.discard = [];
      log(`<i>${G.deckMode === 'personal' ? p.name + '의 ' : ''}버려진 카드를 다시 섞어 덱을 만들었습니다.</i>`);
    }
    p.hand.push(pile.deck.pop());
    got++;
  }
  return got;
}

function nightEvent(p) {
  const entries = Object.entries(NIGHT_EVENTS);
  let r = Math.random() * entries.reduce((s, [, e]) => s + e.weight, 0);
  const [key, ev] = entries.find(([, e]) => (r -= e.weight) < 0) || entries[0];
  if (key === 'sweeper') {
    const dmg = pick(ev.damages);
    showEvent(p, ev, `<span class="neg">${dmg} 피해</span>`);
    log(`${ev.icon} <b class="neg">${ev.name}</b>이(가) ${pname(p)}을(를) 덮쳤습니다!`);
    toastTo(p, `${ev.icon} 청소부 습격! ${dmg} 피해`, 'bad');
    damage(p, dmg, `${ev.icon} 청소부`);
    changeSp(p, -5, true);
  } else {
    const [what, amt] = pick(ev.gains);
    const label = { hp: `HP +${amt}`, sp: `정신력 +${amt}`, won: `+${amt}안` }[what];
    showEvent(p, ev, `<span class="pos">${label}</span>`);
    log(`${ev.icon} ${pname(p)} 이(가) <b>${ev.name}</b>을(를) 주웠습니다 (${label})`);
    toastTo(p, `${ev.icon} 연료통! ${label}`);
    if (what === 'hp') heal(p, amt);
    else if (what === 'sp') changeSp(p, amt);
    else gainWon(p, amt);
  }
}

function discardCard(p, card) {
  const i = p.hand.findIndex((c) => c.uid === card.uid);
  if (i >= 0) p.hand.splice(i, 1);
  pileOf(p).discard.push(card);
}
const toDiscard = (p, card) => pileOf(p).discard.push(card);
function giveCard(p, card) {
  if (p.alive && p.hand.length < RULES.maxHand) p.hand.push(card); else toDiscard(p, card);
}

// ------------------------------------------------------------
//  로그 / 연출 (방장이면 참가자에게도 전달)
// ------------------------------------------------------------
function pname(p) {
  return `<b class="pn ${p.id === G.meId ? 'me' : ''}" data-pn="${p.id}">${p.avatar} ${p.name}</b>`;
}
function cname(c) {
  return `<span class="cn r${c.rarity || 1}">「${c.name}」</span>`;
}

function log(html) {
  logLocal(html);
  netFx('log', { html });
}
function logLocal(html) {
  const box = $('#log');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'log-line';
  el.innerHTML = html;
  // 내 이름 강조는 보는 사람 기준
  $$('[data-pn]', el).forEach((n) => n.classList.toggle('me', +n.dataset.pn === G.meId));
  box.prepend(el);
  while (box.children.length > 80) box.lastChild.remove();
}

function toast(text, kind = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.textContent = text;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 2400);
}
function toastAll(text, kind = '') {
  toast(text, kind);
  netFx('toast', { text, kind });
}
// 특정 플레이어에게만 보이는 알림
function toastTo(p, text, kind = '') {
  if (!p) return;
  if (p.ctrl === 'local') toast(text, kind);
  else if (p.ctrl === 'remote' && typeof Net !== 'undefined') Net.toastTo(p, text, kind);
}

function floatText(p, text, cls) {
  floatLocal(p.id, text, cls);
  netFx('float', { pid: p.id, text, cls });
}
function floatLocal(pid, text, cls) {
  const panel = document.querySelector(`[data-pid="${pid}"]`);
  if (!panel) return;
  const r = panel.getBoundingClientRect();
  const f = document.createElement('div');
  f.className = 'float ' + cls;
  f.textContent = text;
  f.style.left = r.left + r.width / 2 + 'px';
  f.style.top = r.top + r.height / 3 + 'px';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1300);
  if (cls === 'dmg') {
    panel.classList.remove('hit');
    void panel.offsetWidth;
    panel.classList.add('hit');
  }
}

function popStage(html) {
  stageLocal(html);
  netFx('stage', { html });
}
function stageLocal(html) {
  const st = $('#stage');
  st.innerHTML = html;
  st.classList.remove('pop');
  void st.offsetWidth;
  st.classList.add('pop');
}
function clearStage(text = '') {
  clearStageLocal(text);
  netFx('clear', { text });
}
function clearStageLocal(text) {
  $('#stage').innerHTML = text ? `<div class="stage-idle">${text}</div>` : '';
}
function setNight(on) {
  document.body.classList.toggle('night', on);
  if (typeof updateFrameClock === 'function') updateFrameClock();
  netFx('night', { on });
}

function showStage(attacker, cards, targetText, extra = '') {
  popStage(`
    <div class="stage-head">${pname(attacker)} <span class="arrow">▶</span> ${targetText}</div>
    <div class="stage-cards">${cards.map((c) => cardHTML(c, { big: true })).join('')}</div>
    ${extra ? `<div class="stage-extra">${extra}</div>` : ''}`);
}

function showEvent(p, ev, result) {
  popStage(`
    <div class="stage-head">🌙 뒷골목의 밤 — ${pname(p)}</div>
    <div class="night-card"><div class="night-icon">${ev.icon}</div><div class="night-name">${ev.name}</div>
      <div class="flavor">${ev.flavor}</div></div>
    <div class="stage-extra">${result}</div>`);
}

// ------------------------------------------------------------
//  HP / 정신력 / 돈 / 흐트러짐
// ------------------------------------------------------------
function damage(p, n, source = '', killer = null) {
  if (!p.alive || n <= 0) return;
  p.hp = Math.max(0, p.hp - n);
  floatText(p, '-' + n, 'dmg');
  if (source) log(`${pname(p)}: ${source} <span class="neg">-${n}</span>`);
  if (p.hp <= 0) kill(p, killer);
}

function heal(p, n) {
  if (!p.alive || n <= 0) return 0;
  const before = p.hp;
  p.hp = Math.min(RULES.maxHp, p.hp + n);
  const got = p.hp - before;
  if (got > 0) floatText(p, '+' + got, 'heal');
  return got;
}

function gainWon(p, n) {
  const before = p.won;
  p.won = Math.max(0, Math.min(RULES.maxWon, p.won + n));
  const got = p.won - before;
  if (got > 0) floatText(p, `+${got}안`, 'won');
  return got;
}

// 지불: 돈 → (모자라면) 정신력(0까지) → HP 순서로 냄. 받는 쪽은 실제로 낸 돈만 받음
function pay(payer, receiver, amount) {
  let left = amount;
  const fromWon = Math.min(payer.won, left);
  payer.won -= fromWon;
  left -= fromWon;
  let fromSp = 0, fromHp = 0;
  if (left > 0 && payer.sp > 0) {
    fromSp = Math.min(payer.sp, left);
    left -= fromSp;
    changeSp(payer, -fromSp);
  }
  if (left > 0) {
    fromHp = left;
    damage(payer, fromHp, '', receiver);
  }
  if (fromWon > 0) {
    floatText(payer, `-${fromWon}안`, 'spdown');
    gainWon(receiver, fromWon);
  }
  const parts = [`${fromWon}안`];
  if (fromSp) parts.push(`정신력 ${fromSp}`);
  if (fromHp) parts.push(`<span class="neg">HP ${fromHp}</span>`);
  return parts.join(' + ');
}

function kill(p, killer = null) {
  p.alive = false;
  for (const c of [...p.hand]) discardCard(p, c);
  log(`💀 ${pname(p)} 이(가) 쓰러졌습니다.`);
  toastAll(`${p.name} 탈락!`, 'bad');
  // 누군가 쓰러지면: 처치자는 고양, 나머지는 동요
  for (const q of alive()) changeSp(q, q === killer ? 15 : -5, true);
}

function changeSp(p, n, quiet = false) {
  if (!p.alive || n === 0) return;
  const before = p.sp;
  p.sp = Math.max(RULES.minSp, Math.min(RULES.maxSp, p.sp + n));
  const got = p.sp - before;
  if (got && !quiet) floatText(p, (got > 0 ? '+' : '') + got + ' SP', got > 0 ? 'sp' : 'spdown');
  if (p.sp <= RULES.minSp && !has(p, 'panic')) {
    addStatus(p, 'panic', 0, 1, true);
    log(`😱 ${pname(p)} 의 정신력이 무너졌습니다! <b class="neg">공황</b> 상태`);
    toastTo(p, '공황 상태! 다음 턴을 쉽니다', 'bad');
  }
}

// 흐트러짐 피해: 게이지가 0이 되면 흐트러짐
function staggerDamage(p, n) {
  if (!p.alive || n <= 0 || has(p, 'staggered')) return;
  p.stg = Math.max(0, p.stg - n);
  if (p.stg === 0) {
    addStatus(p, 'staggered', 0, 1, true);
    log(`💢 ${pname(p)} <b class="neg">흐트러짐!</b> 다음 턴을 쉬고, 대응할 수 없으며, 받는 피해 ${RULES.staggerMult}배`);
    floatText(p, '흐트러짐!', 'dmg');
    toastTo(p, '💢 흐트러짐! 다음 턴을 쉬고 대응할 수 없습니다', 'bad');
  }
}

// 정신력에 따른 코인 앞면 확률: 50% + 정신력% (5% ~ 95%)
function headChance(sp) {
  return Math.max(0.05, Math.min(0.95, 0.5 + sp / 100));
}

const defaultCoins = () => Array.from({ length: RULES.coins }, () => ({ power: RULES.coinPower, fx: [] }));

// 코인 목록을 던져 [{ coin, head, power, reused }] 반환
// 재사용 코인: 앞면이면 같은 코인을 다시 던지고, 앞면이 나올 때마다 위력이 한 번 더 더해짐
function rollWith(coins, chance, rnd = Math.random) {
  return coins.map((coin) => {
    const head = rnd() < chance;
    let power = coin.power, reused = 0;
    if (head && coin.reuse) {
      while (reused < coin.reuse && rnd() < chance) { power += coin.power; reused++; }
    }
    return { coin, head, power, reused };
  });
}
const rollCoins = (p, coins) => rollWith(coins, headChance(p.sp));
const coinSum = (rolls) => rolls.reduce((s, r) => s + (r.head ? r.power : 0), 0);

// 림버스식 합: 남은 코인을 매번 다시 던져 위력을 비교하고, 진 쪽은 마지막 코인 1개가 깨짐
//  마지막 코인까지 깨진 쪽이 합에서 짐 (무승부는 코인 유지, 최대 횟수를 넘기면 상쇄)
//  반환: { rounds: [{ a, d, pa, pd, w }], winner: 'a' | 'd' | 't', aLeft, dLeft }
function runClash(aBase, aCoins, chA, dBase, dCoins, chD, rnd = Math.random) {
  let aLeft = aCoins.slice(), dLeft = dCoins.slice();
  const rounds = [];
  for (let i = 0; i < RULES.clashMaxRounds; i++) {
    const a = rollWith(aLeft, chA, rnd), d = rollWith(dLeft, chD, rnd);
    const pa = aBase + coinSum(a), pd = dBase + coinSum(d);
    const w = pa > pd ? 'a' : pd > pa ? 'd' : 't';
    rounds.push({ a, d, pa, pd, w });
    if (w === 'a') { dLeft = dLeft.slice(0, -1); if (!dLeft.length) return { rounds, winner: 'a', aLeft, dLeft }; }
    if (w === 'd') { aLeft = aLeft.slice(0, -1); if (!aLeft.length) return { rounds, winner: 'd', aLeft, dLeft }; }
  }
  return { rounds, winner: 't', aLeft, dLeft };
}

// 합 결과 예측 (몬테카를로, 고정 시드라 화면이 흔들리지 않음) — 방어자 기준
//  win/tie/lose 확률, exp: 받는 피해 기대값, expD: 주는 피해 기대값, max: 받는 최대 피해
function clashSim(aBase, aCoins, spA, dBase, dCoins, spD, n = 400) {
  const rnd = seededRng(7919);
  const chA = headChance(spA), chD = headChance(spD);
  let win = 0, tie = 0, lose = 0, exp = 0, expD = 0, max = 0, rounds = 0;
  for (let i = 0; i < n; i++) {
    const r = runClash(aBase, aCoins, chA, dBase, dCoins, chD, rnd);
    rounds += r.rounds.length;
    if (r.winner === 'a') { const dmg = planTotal(hitPlan(aBase, rollWith(r.aLeft, chA, rnd), aCoins.length)); lose++; exp += dmg; max = Math.max(max, dmg); }
    else if (r.winner === 'd') { win++; expD += planTotal(hitPlan(dBase, rollWith(r.dLeft, chD, rnd), dCoins.length)); }
    else tie++;
  }
  return { win: win / n, tie: tie / n, lose: lose / n, exp: exp / n, expD: expD / n, max, rounds: rounds / n };
}

function coinsHTML(rolls) {
  return rolls.map((r) => `<span class="coin ${r.head ? 'head' : 'tail'}${r.reused ? ' reuse' : ''}" title="코인 위력 ${r.coin.power}${r.reused ? ` · 재사용 ${r.reused}회` : ''}">${r.head ? r.power + (r.reused ? '↻' : '') : '○'}</span>`).join('');
}

// 위력 분포: 기본값 + 코인들(각자 위력)의 앞면 합
function powerDist(base, coins, chance) {
  let dist = new Map([[base, 1]]);
  for (const c of coins) {
    const next = new Map();
    for (const [v, pr] of dist) {
      next.set(v + c.power, (next.get(v + c.power) || 0) + pr * chance);
      next.set(v, (next.get(v) || 0) + pr * (1 - chance));
    }
    dist = next;
  }
  return dist;
}

// 합 결과 분포 (방어자 기준 승/무/패 확률, 예상 피해)
function clashStats(atkBase, atkCoins, spA, defBase, defCoins, spD, useArmor) {
  const A = powerDist(atkBase, atkCoins, headChance(spA));
  const D = useArmor ? powerDist(defBase, defCoins, headChance(spD)) : new Map([[0, 1]]);
  let win = 0, tie = 0, lose = 0, exp = 0, max = 0, expD = 0, expA = 0;
  for (const [a, pa] of A) for (const [d, pd] of D) {
    const pr = pa * pd;
    expA += pr * a;
    if (d > a) { win += pr; expD += pr * (d - a); }
    else if (d === a) tie += pr;
    else { lose += pr; exp += pr * (a - d); max = Math.max(max, a - d); }
  }
  // exp: 공격자가 이겼을 때 차이의 기대값, expD: 방어자가 이겼을 때 차이의 기대값, expA: 공격 위력 기대값
  return { win, tie, lose, exp, max, expD, expA };
}

// ------------------------------------------------------------
//  전투 처리
// ------------------------------------------------------------
// 코인: 주 카드의 코인(없으면 기본 코인) + 보조 무기의 커스텀 코인
function buildAttack(cards) {
  const main = cards[0];
  const isEgo = main.type === 'ego';
  let atk = isEgo ? main.power : 0;
  const fx = new Set();
  const effects = [];
  let coins = Array.isArray(main.coins) ? main.coins.map((c) => ({ ...c })) : defaultCoins();
  cards.forEach((c, i) => {
    if (!isEgo) atk += c.atk;
    fxOf(c).forEach((f) => fx.add(f));
    effects.push(...(c.effects || []));
    if (i > 0 && Array.isArray(c.coins)) coins = coins.concat(c.coins.map((x) => ({ ...x })));
  });
  const coinMax = coins.reduce((s, c) => s + c.power, 0);
  // 공격 가중치: 이 공격에 맞는 사람 수 (주 카드 기준)
  const weight = Math.max(1, Math.min(5, Math.round(+main.weight || 1)));
  return { atk, attr: main.attr, fx: [...fx], effects, coins, coinMax, cards, weight, name: cards.map((c) => c.name).join(' + ') };
}

// 수비 코인
//  가드: 기본 코인 + 가드 카드들의 커스텀 코인
//  회피·반격: 카드의 커스텀 코인(없으면 기본 코인)
function defenseCoins(armors) {
  if (armors.length === 1 && armors[0].kind !== 'guard') {
    return Array.isArray(armors[0].coins) && armors[0].coins.length ? armors[0].coins.map((x) => ({ ...x })) : defaultCoins();
  }
  let coins = defaultCoins();
  for (const a of armors) if (Array.isArray(a.coins)) coins = coins.concat(a.coins.map((x) => ({ ...x })));
  return coins;
}
const DEF_KIND = { guard: '가드', evade: '회피', counter: '반격' };
const defKind = (c) => (c && DEF_KIND[c.kind] ? c.kind : 'guard');

function armorMatches(armor, attr) {
  return armor.attr === 'all' || armor.attr === attr;
}

function armorDef(target, armors) {
  let def = armors.reduce((s, a) => s + a.def, 0);
  if (has(target, 'fragile')) def = Math.floor(def / 2);
  return def;
}

async function performAttack(attacker, cards, targets) {
  const info = buildAttack(cards);
  if (cards[0].type === 'ego') changeSp(attacker, -cards[0].cost);
  for (const c of cards) discardCard(attacker, c);

  if (info.fx.includes('all')) targets = others(attacker);
  else if (info.weight > 1 && targets.length) {
    // 가중치: 고른 대상 + 나머지 상대 중 무작위로 (가중치 - 1)명
    const main = targets[0];
    const extra = shuffle(others(attacker).filter((q) => q !== main)).slice(0, info.weight - 1);
    targets = [main, ...extra];
  }
  const tText = info.fx.includes('all') ? '<b>전원</b>' : targets.map(pname).join(', ');
  const a = ATTR[info.attr];
  showStage(attacker, cards, tText,
    `<span style="color:${a.color}">${a.icon} ${a.name}</span> 위력 <b>${info.atk}</b> + 코인 ${info.coins.length}개` +
    (info.fx.length ? ' · ' + info.fx.map((f) => FX_TEXT[f]).join(', ') : '') + (info.weight > 1 && !info.fx.includes('all') ? ` · 가중치 ${info.weight}` : ''));
  log(`${pname(attacker)} ▶ ${tText} : ${cards.map(cname).join(' + ')} <span class="muted">(${a.icon}${info.atk})</span>`);
  renderAll();
  await sleep(700);

  // 사용 시 효과 (자신 대상)
  applyEffects(info.effects.filter((e) => e.when === 'use' && e.target === 'self'), attacker, null);

  // 출혈: 공격할 때마다 피해
  if (has(attacker, 'bleed')) {
    triggerOnAttack(attacker);
    renderAll();
    await sleep(350);
    if (!attacker.alive) return;
  }

  const hits = info.fx.includes('twice') ? 2 : 1;
  for (const t of targets) {
    for (let h = 0; h < hits; h++) {
      if (!t.alive || !attacker.alive) break;
      await resolveHit(attacker, t, info);
      renderAll();
      await sleep(450);
    }
  }

  if (info.fx.includes('holy') && attacker.alive) {
    heal(attacker, 5);
    log(`${pname(attacker)} ✦ 성스러운 기운으로 HP 5 회복`);
  }
  renderAll();
}

// 던지기 전 효과(조건부 위력, 충전 소모, 재사용)를 적용한 이번 합의 코인
// ctx: { foe: 상대, clash: 합 중인지 }
function prepareCoins(p, coins, ctx = {}) {
  const boosts = [];
  const out = coins.map((c) => {
    let power = c.power, reuse = 0;
    for (const e of c.fx || []) {
      const pot = e.pot || 0;
      let why = '';
      if (e.key === 'chargeBoost' && p.status.charge.cnt >= (e.cnt || 0)) {
        useCount(p, 'charge', e.cnt || 0);
        why = `⚡ 충전 ${e.cnt} 소모`;
      } else if (e.key === 'pwrOneSided' && !ctx.clash) why = '일방 공격';
      else if (e.key === 'pwrClash' && ctx.clash) why = '합';
      else if (e.key === 'pwrIfKw' && ctx.foe && has(ctx.foe, e.kw)) why = `상대 ${kwName(e.kw)}`;
      else if (e.key === 'pwrLowHp' && p.hp <= RULES.maxHp / 2) why = '빈사';
      else if (e.key === 'pwrHighSp' && p.sp >= (e.cnt || 0)) why = `정신력 ${e.cnt} 이상`;
      else if (e.key === 'reuse') reuse += e.cnt || 1;
      if (why) { power += pot; boosts.push(`${why} +${pot}`); }
    }
    return { ...c, power, reuse };
  });
  if (boosts.length) log(`${pname(p)} 🪙 코인 강화: ${boosts.join(', ')}`);
  return out;
}

// 공격받았을 때의 대응 선택 — { mode: none|clash|guard|evade|counter, cards: [...] }
//  clash  : 무기 1장(+보조 무기) — 속성 제한 없음
//  guard  : 가드 카드 여러 장 (관통이면 불가)
//  evade / counter : 해당 카드 1장
//  수비 카드는 공격과 같은 속성이거나 전속성이어야 함
function validDefense(p, info, resp) {
  const none = { mode: 'none', cards: [] };
  if (!resp || !Array.isArray(resp.cards)) return none;
  const uniq = resp.cards.filter((c, i, arr) => c && arr.indexOf(c) === i && p.hand.includes(c));
  if (!uniq.length) return none;
  if (resp.mode === 'clash') {
    const [main, ...rest] = uniq;
    if (!main || main.type !== 'weapon') return none;
    return { mode: 'clash', cards: [main, ...rest.filter((c) => c.type === 'weapon' && c.plus)] };
  }
  const ok = (c) => c.type === 'armor' && armorMatches(c, info.attr);
  if (resp.mode === 'guard') {
    if (info.fx.includes('pierce')) return none;
    const g = uniq.filter((c) => ok(c) && defKind(c) === 'guard');
    return g.length ? { mode: 'guard', cards: g } : none;
  }
  if (resp.mode === 'evade' || resp.mode === 'counter') {
    const c = uniq.find((x) => ok(x) && defKind(x) === resp.mode);
    return c ? { mode: resp.mode, cards: [c] } : none;
  }
  return none;
}

async function defendFor(p, attacker, info) {
  if (has(p, 'staggered')) {
    log(`${pname(p)} 💢 흐트러져서 대응할 수 없습니다`);
    return { mode: 'none', cards: [] };
  }
  let resp;
  if (p.ctrl === 'local') resp = await humanDefend(p, attacker, info);
  else if (p.ctrl === 'remote') resp = await Net.askDefend(p, attacker, info);
  else resp = cpuDefend(p, info, attacker);
  return validDefense(p, info, resp);
}

// 반격·회피 카드로 만드는 "공격 정보" (반격 피해와 효과 적용용)
function defenseInfo(card, power) {
  return { atk: power, attr: card.attr === 'all' ? 'phys' : card.attr, fx: fxOf(card).filter((f) => !['reflect', 'nullify'].includes(f)),
    effects: (card.effects || []).filter((e) => e.when === 'hit'), coins: [], coinMax: 0, cards: [card], name: card.name };
}

async function resolveHit(attacker, target, info) {
  // 사용 시 효과 (대상에게)
  applyEffects(info.effects.filter((e) => e.when === 'use' && e.target === 'enemy'), attacker, target);
  if (!target.alive) return;

  const pierce = info.fx.includes('pierce');
  const resp = await defendFor(target, attacker, info);
  const dcards = resp.cards;
  for (const c of dcards) discardCard(target, c);
  if (resp.mode !== 'clash') for (const c of dcards) applyEffects((c.effects || []).filter((e) => e.when === 'use'), target, attacker);

  // 무효화 가드
  if (resp.mode === 'guard' && dcards.some((x) => hasFx(x, 'nullify'))) {
    const ms = showClash(attacker, info, null, null, target, dcards, null, null, 'nullify', 'nullify', 0, '');
    log(`${pname(target)} ${dcards.map(cname).join(' + ')} 🛑 공격을 무효화했습니다!`);
    renderAll();
    await sleep(ms);
    floatText(target, '무효', 'block');
    changeSp(target, 5, true);
    changeSp(attacker, -3, true);
    renderAll();
    return;
  }

  // ---- 합: 무기 vs 무기 (림버스식 — 코인을 하나씩 깨뜨림) ----
  if (resp.mode === 'clash') {
    const dinfo = buildAttack(dcards);
    const aCoins = prepareCoins(attacker, info.coins, { foe: target, clash: true });
    const dCoins = prepareCoins(target, dinfo.coins, { foe: attacker, clash: true });
    const cl = runClash(info.atk, aCoins, headChance(attacker.sp), dinfo.atk, dCoins, headChance(target.sp));
    const result = cl.winner === 'a' ? 'atk' : cl.winner === 'd' ? 'def' : 'tie';
    const W = cl.winner === 'a' ? attacker : target, L = cl.winner === 'a' ? target : attacker;
    const winfo = cl.winner === 'a' ? info : dinfo;
    let strike = [], dmg = 0, plan = [];
    if (cl.winner !== 't') {
      strike = rollCoins(W, cl.winner === 'a' ? cl.aLeft : cl.dLeft);
      const n = cl.winner === 'a' ? aCoins.length : dCoins.length;
      plan = hitPlan(winfo.atk, strike, n, cl.winner === 'a' && info.fx.includes('all'));
      dmg = planTotal(plan);
    }
    const last = cl.rounds[cl.rounds.length - 1];
    const ms = showClash(attacker, info, last.a, last.pa, target, dcards, last.d, last.pd, 'clash', result, dmg,
      result === 'atk' ? 'd' : result === 'def' ? 'a' : '', dinfo.atk,
      { aN: aCoins.length, dN: dCoins.length, rounds: cl.rounds, strike: { s: cl.winner, coins: strike, hits: packHits(plan) } });
    log(`⚔ 합 ×${cl.rounds.length}! ${pname(attacker)} vs ${pname(target)} ${dcards.map(cname).join(' + ')} — ${cl.rounds.map((r) => `<b class="${r.w === 'a' ? 'neg' : r.w === 'd' ? 'pos' : ''}">${r.pa}:${r.pd}</b>`).join(' · ')}`);
    renderAll();
    await sleep(ms);
    if (cl.winner === 't') {
      log('합 무승부 — 두 공격이 상쇄되었습니다.');
      floatText(target, '상쇄', 'block');
      return;
    }
    log(`${pname(W)} 합 승리! 남은 코인 ${strike.length}개로 ${plan.length}회 공격 ${coinsHTML(strike)}`);
    changeSp(W, 5, true); changeSp(L, -5, true);
    strikeHits(W, L, winfo, plan);
    return;
  }

  const contested = resp.mode !== 'none';
  const ca = rollCoins(attacker, prepareCoins(attacker, info.coins, { foe: target, clash: contested }));
  const pa = info.atk + coinSum(ca);

  // 무방비
  if (!contested) {
    const plan = hitPlan(info.atk, ca, info.coins.length, info.fx.includes('all'));
    const total = planTotal(plan);
    const ms = showClash(attacker, info, ca, pa, target, [], null, null, 'open', 'open', total, 'd', 0,
      { strike: { s: 'a', coins: ca, hits: packHits(plan) } });
    log(`${pname(attacker)} ${coinsHTML(ca)} → ${pname(target)} 무방비 ${plan.length}회 공격${info.fx.includes('all') ? ' (광역: 앞면만 적중)' : ''}${pierce ? ' (관통)' : ''}`);
    renderAll();
    await sleep(ms);
    strikeHits(attacker, target, info, plan);
    return;
  }

  // ---- 수비 스킬: 가드 / 회피 / 반격 ----
  const cd = rollCoins(target, prepareCoins(target, defenseCoins(dcards), { foe: attacker, clash: true }));
  const base = armorDef(target, dcards);
  const pd = base + coinSum(cd);
  const kindName = DEF_KIND[resp.mode];
  const headFx = () => { for (const r of cd) if (r.head) applyEffects((r.coin.fx || []).filter((e) => e.when === 'heads'), target, attacker); };
  const successFx = () => {
    for (const c of dcards) applyEffects((c.effects || []).filter((e) => e.when === 'hit'), target, attacker);
    for (const r of cd) applyEffects((r.coin.fx || []).filter((e) => e.when === 'hit'), target, attacker);
  };

  if (resp.mode === 'guard') {
    const dmg = Math.max(0, pa - pd);
    const ms = showClash(attacker, info, ca, pa, target, dcards, cd, pd, 'guard', dmg ? 'atk' : 'def', dmg, dmg ? 'd' : '', base);
    log(`🛡 가드! ${pname(attacker)} <b>${pa}</b> ${coinsHTML(ca)} vs ${coinsHTML(cd)} <b>${pd}</b> ${pname(target)} ${dcards.map(cname).join(' + ')}`);
    renderAll();
    await sleep(ms);
    headFx();
    if (dmg === 0) {
      floatText(target, '가드!', 'block');
      log(`${pname(target)} 가드로 공격을 완전히 막아냈습니다.`);
      changeSp(target, 5, true); changeSp(attacker, -3, true);
      successFx();
    } else {
      log(`${pname(target)} 가드로 ${pa - dmg} 경감 — ${dmg} 피해`);
      landHit(attacker, target, dmg, info, ca);
    }
    if (dcards.some((x) => hasFx(x, 'reflect'))) {
      const back = Math.floor(Math.min(pa, pd) / 2);
      if (back > 0) damage(attacker, back, '🪞 반사 피해', target);
    }
    return;
  }

  const success = pd >= pa;
  const card = dcards[0];
  const ms = showClash(attacker, info, ca, pa, target, dcards, cd, pd, resp.mode, success ? 'def' : 'atk',
    success ? (resp.mode === 'counter' ? pd : 0) : pa, success ? (resp.mode === 'counter' ? 'a' : '') : 'd', base);
  log(`${resp.mode === 'evade' ? '💨' : '↩'} ${kindName}! ${pname(attacker)} <b>${pa}</b> ${coinsHTML(ca)} vs ${coinsHTML(cd)} <b>${pd}</b> ${pname(target)} ${cname(card)}`);
  renderAll();
  await sleep(ms);
  headFx();
  if (!success) {
    log(`${pname(target)} ${kindName} 실패 — 공격을 그대로 받습니다`);
    landHit(attacker, target, pa, info, ca);
    return;
  }
  successFx();
  if (resp.mode === 'evade') {
    floatText(target, '회피!', 'block');
    log(`${pname(target)} 공격을 회피했습니다!`);
    changeSp(target, 5, true); changeSp(attacker, -3, true);
  } else {
    floatText(target, '반격!', 'sp');
    log(`${pname(target)} 반격 성공! ${pd} 피해로 되받아칩니다`);
    changeSp(target, 5, true); changeSp(attacker, -5, true);
    landHit(target, attacker, pd, defenseInfo(card, pd), []);
  }
}

// 2D 합 연출: 데이터를 만들어 이 화면에서 재생하고, 참가자에게도 보냄. 연출 길이(ms) 반환
//  mode: open | clash | guard | evade | counter | nullify,  result: atk(공격 측 우세) | def(수비 측 우세) | tie ...
//  dmg / dmgTo: 연출에 표시할 피해와 받는 쪽('d' 대상, 'a' 공격자)
function showClash(attacker, info, ca, pa, target, dcards, cd, pd, mode, result, dmg = 0, dmgTo = '', dBase = 0, extra = {}) {
  const pack = (rolls) => (rolls || []).map((r) => ({ h: r.head ? 1 : 0, p: r.power, r: r.reused || 0 }));
  const d = validateClash({
    aN: extra.aN, dN: extra.dN,
    rounds: (extra.rounds || []).map((r) => ({ a: pack(r.a), d: pack(r.d), pa: r.pa, pd: r.pd, w: r.w })),
    strike: extra.strike ? { s: extra.strike.s, coins: pack(extra.strike.coins), hits: extra.strike.hits || [] } : null,
    aId: attacker.id, dId: target.id, mode, result,
    aBase: info.atk, dBase, aCoins: pack(ca), dCoins: pack(cd), pa: pa || 0, pd: pd || 0,
    aCards: info.cards.map(cardRef), dCards: dcards.map(cardRef),
    gear: info.cards[0].type === 'ego' ? 'orb' : 'blade', attr: info.attr,
    stag: has(target, 'staggered') ? 1 : 0, spd: G.speed, dmg, dmgTo,
  });
  renderClash(d);
  netFx('clash', d);
  return clashDuration(d);
}

// 코인별 타격 계획
//  기본 공격력은 원래 코인 수(n)로 나눠 각 코인에 싣고, 앞면이면 그 코인의 위력이 더해짐
//  광역(전체 공격)은 앞면 코인만 적중 — 뒷면 코인은 빗나감
//  반환: [{ dmg, roll, miss }]
function hitPlan(base, rolls, n, aoe) {
  if (!rolls.length) return [{ dmg: base, roll: null, miss: false }];
  n = Math.max(1, n, rolls.length);
  const share = (i) => Math.floor((base * (i + 1)) / n) - Math.floor((base * i) / n);
  return rolls.map((r, i) => ({ dmg: share(i) + (r.head ? r.power : 0), roll: r, miss: !!aoe && !r.head }));
}
const planTotal = (plan) => plan.reduce((s, h) => s + (h.miss ? 0 : h.dmg), 0);
const packHits = (plan) => plan.map((h) => ({ d: h.dmg, m: h.miss ? 1 : 0 }));

// 코인마다 한 번씩 때림 (치명타·흐트러짐 배율·코인 효과·파열/침잠은 타격마다, 정신력·흡수·카드 적중 효과는 한 번)
function strikeHits(attacker, target, info, plan) {
  let dealt = 0, landed = 0;
  const stag = has(target, 'staggered');
  plan.forEach((h, i) => {
    if (!target.alive) return;
    const tag = plan.length > 1 ? ` ${i + 1}타` : '';
    if (h.miss) { log(`${pname(attacker)}${tag} 뒷면 — <span class="muted">빗나감</span>`); return; }
    landed++;
    let dmg = rollCrit(attacker, h.dmg);
    if (stag) dmg = Math.ceil(dmg * RULES.staggerMult);
    if (dmg > 0) {
      damage(target, dmg, `<span class="muted">${info.name}${tag}</span>${stag ? ' 💢' : ''} 피격`, attacker);
      staggerDamage(target, dmg);
      dealt += dmg;
    }
    if (h.roll) applyEffects((h.roll.coin.fx || []).filter((e) => e.when === 'hit' || (e.when === 'heads' && h.roll.head)), attacker, target);
    triggerOnHit(target, attacker);
  });
  if (!landed) {
    floatText(target, '빗나감', 'block');
    log(`${pname(attacker)}의 공격이 ${pname(target)}에게 모두 빗나갔습니다`);
    return 0;
  }
  attacker.dmgDealt += dealt;
  changeSp(attacker, 5, true);
  changeSp(target, -Math.max(2, Math.floor(dealt / 2)), true);
  if (info.fx.includes('lifesteal') && attacker.alive && dealt) {
    const got = heal(attacker, Math.floor(dealt / 2));
    if (got) log(`${pname(attacker)} 흡혈로 HP ${got} 회복`);
  }
  if (info.fx.includes('drainsp') && target.alive) {
    log(`${pname(attacker)} 이(가) ${pname(target)}의 정신력 10 흡수`);
    changeSp(target, -10);
    changeSp(attacker, 10);
  }
  if (info.fx.includes('mind') && target.alive) {
    log(`${pname(target)} 🌀 정신 피해 — 정신력 -10`);
    changeSp(target, -10);
  }
  if (target.alive) applyEffects(info.effects.filter((e) => e.when === 'hit'), attacker, target);
  return dealt;
}

// 피해 적중 공통 처리 (한 번에 들어가는 피해: 가드 후 피해, 반격 등)
function landHit(attacker, target, dmg, info, rolls = []) {
  if (dmg <= 0) return;
  dmg = rollCrit(attacker, dmg);
  if (has(target, 'staggered')) {
    const up = Math.ceil(dmg * RULES.staggerMult);
    log(`💢 흐트러진 상대에게 ${dmg} → <b>${up}</b> 피해`);
    dmg = up;
  }
  damage(target, dmg, `<span class="muted">${info.name}</span> 피격`, attacker);
  attacker.dmgDealt += dmg;
  staggerDamage(target, dmg);
  changeSp(attacker, 5, true);
  changeSp(target, -Math.max(2, Math.floor(dmg / 2)), true);

  if (info.fx.includes('lifesteal') && attacker.alive) {
    const got = heal(attacker, Math.floor(dmg / 2));
    if (got) log(`${pname(attacker)} 흡혈로 HP ${got} 회복`);
  }
  if (info.fx.includes('drainsp') && target.alive) {
    log(`${pname(attacker)} 이(가) ${pname(target)}의 정신력 10 흡수`);
    changeSp(target, -10);
    changeSp(attacker, 10);
  }
  if (info.fx.includes('mind') && target.alive) {
    log(`${pname(target)} 🌀 정신 피해 — 정신력 -10`);
    changeSp(target, -10);
  }
  // 적중 시 효과 (카드) / 코인 효과 (적중 시, 앞면 적중 시)
  applyEffects(info.effects.filter((e) => e.when === 'hit'), attacker, target);
  for (const r of rolls) {
    applyEffects((r.coin.fx || []).filter((e) => e.when === 'hit' || (e.when === 'heads' && r.head)), attacker, target);
  }
  // 피격 키워드: 파열, 침잠
  triggerOnHit(target, attacker);
}

// ------------------------------------------------------------
//  도구 / 보조 E.G.O
// ------------------------------------------------------------
async function useSupport(p, card, target) {
  if (card.type === 'ego') changeSp(p, -card.cost, true);
  discardCard(p, card);
  const tgtText = target && target !== p ? pname(target) : pname(p);
  showStage(p, [card], tgtText);
  log(`${pname(p)} ${cname(card)} 사용`);

  const kind = card.kind;
  if (kind === 'custom' || (card.custom && card.effects)) {
    const enemy = target && target !== p ? target : null;
    applyEffects((card.effects || []).filter((e) => e.target === 'self' || enemy), p, enemy);
  } else if (kind === 'heal') {
    const got = heal(p, card.power);
    log(`${pname(p)} HP ${got} 회복`);
  } else if (kind === 'sp') {
    changeSp(p, card.power);
    log(`${pname(p)} 정신력 ${card.power} 회복`);
  } else if (kind === 'won') {
    gainWon(p, card.power);
    log(`${pname(p)} ${card.power}안 획득`);
  } else if (kind === 'cure') {
    cureAll(p);
    floatText(p, '정화', 'heal');
    log(`${pname(p)} 모든 이상 상태 해제`);
  } else if (kind === 'draw') {
    const n = drawCards(p, card.power);
    log(`${pname(p)} 카드 ${n}장 획득`);
  } else if (kind === 'gamble') {
    const roll = rand(5);
    if (roll === 0) { heal(p, 25); log('📦 상자 속에는 구급 상자가! HP 25 회복'); }
    else if (roll === 1) { damage(p, 12, '📦 상자가 폭발했다!'); }
    else if (roll === 2) { changeSp(p, 15); log('📦 상자 속에는 진정 향초가! 정신력 15 회복'); }
    else if (roll === 3) { gainWon(p, 25); log('📦 상자 속에는 현금 다발이! 25안 획득'); }
    else { const n = drawCards(p, 3); log(`📦 상자 속에서 카드 ${n}장 발견!`); }
  } else if (kind === 'steal') {
    if (target.hand.length) {
      const c = pick(target.hand);
      target.hand.splice(target.hand.indexOf(c), 1);
      giveCard(p, c);
      log(`${pname(p)} 이(가) ${pname(target)}의 카드를 압류했습니다`);
      toastTo(p, `「${c.name}」을(를) 압류했습니다`);
      toastTo(target, `「${c.name}」을(를) 빼앗겼습니다!`, 'bad');
    } else {
      log(`${pname(target)}의 손패가 비어 있습니다.`);
    }
  } else if (kind === 'stun') {
    addStatus(target, 'stun', 0, 1, true);
    log(`${pname(target)} 💫 정신이 오염되어 다음 턴을 쉽니다 (정신력 -10)`);
    floatText(target, '기절', 'dmg');
    changeSp(target, -10, true);
  }
  renderAll();
  await sleep(600);
}

// 기도: 손패가 가득 차 있으면 가장 쓸모없는 카드 1장을 버리고 뽑음
function pray(p) {
  let tossed = null;
  if (p.hand.length >= RULES.maxHand) {
    const val = (c) => (c.type === 'armor' ? c.def * 0.8 : c.type === 'weapon' ? c.atk : 10) + (c.rarity || 1) * 3;
    tossed = [...p.hand].sort((a, b) => val(a) - val(b))[0];
    discardCard(p, tossed);
  }
  const n = drawCards(p, 1);
  log(`${pname(p)} 🙏 기도했습니다 (${tossed ? `${cname(tossed)} 버림, ` : ''}카드 ${n}장)`);
}

// ------------------------------------------------------------
//  거래: 매입 / 매각 / 환전 (상대가 막을 수 없음)
// ------------------------------------------------------------
// 매입 결정: 조작 방식에 따라
function buyDeciderFor(p, target) {
  if (p.ctrl === 'local') return (item) => humanBuyDecide(p, target, item);
  if (p.ctrl === 'remote') return (item) => Net.ask(p, 'buy', { item: cardRef(item), targetId: target.id }, 30, false);
  return async (item) => cpuWantsBuy(p, item);
}

async function tradeBuy(p, card, target, decide) {
  discardCard(p, card);
  showStage(p, [card], pname(target));
  log(`${pname(p)} ${cname(card)} → ${pname(target)}`);
  renderAll();
  await sleep(500);
  if (!target.hand.length) {
    log(`${pname(target)}의 손패가 비어 있어 살 것이 없습니다.`);
    return;
  }
  const item = pick(target.hand);
  const price = item.price || 0;
  showStage(p, [item], `${pname(target)}의 카드`, `가격 <b class="won">${price}안</b>`);
  renderAll();
  await sleep(500);
  const ok = p.won >= price && (await decide(item)) === true;
  if (!ok || !target.hand.includes(item)) {
    log(`${pname(p)} 이(가) ${pname(target)}의 카드를 사지 않았습니다.`);
    return;
  }
  const paid = pay(p, target, price);
  target.hand.splice(target.hand.indexOf(item), 1);
  giveCard(p, item);
  log(`🛒 ${pname(p)} 이(가) ${pname(target)}에게서 ${cname(item)}을(를) 매입 (${paid})`);
  toastTo(target, `「${item.name}」을(를) ${price}안에 매입당했습니다`, 'bad');
  renderAll();
  await sleep(600);
}

// 매각: 내 카드 1장을 상대에게 강제로 판매
async function tradeSell(p, card, goods, target) {
  discardCard(p, card);
  p.hand.splice(p.hand.indexOf(goods), 1);
  const price = goods.price || 0;
  showStage(p, [card, goods], pname(target), `판매가 <b class="won">${price}안</b> — 거부할 수 없음`);
  log(`💸 ${pname(p)} 이(가) ${pname(target)}에게 ${cname(goods)}을(를) ${price}안에 강매`);
  renderAll();
  await sleep(700);
  const paid = pay(target, p, price);
  if (target.alive) giveCard(target, goods); else toDiscard(target, goods);
  log(`${pname(target)} 지불: ${paid}`);
  toastTo(target, `「${goods.name}」을(를) ${price}안에 강매당했습니다`, 'bad');
  renderAll();
  await sleep(600);
}

// 환전: HP·정신력·돈을 합계를 유지한 채 재배분
function exchangeLimits(p) {
  return {
    total: p.hp + p.sp + p.won,
    hp: [1, RULES.maxHp],
    sp: [Math.min(p.sp, 0), RULES.maxSp],   // 정신력은 0(또는 현재값) 아래로는 못 내림
    won: [0, RULES.maxWon],
  };
}

function validExchange(p, plan) {
  const L = exchangeLimits(p);
  return !!plan && ['hp', 'sp', 'won'].every((k) => Number.isInteger(plan[k]) && plan[k] >= L[k][0] && plan[k] <= L[k][1]) &&
    plan.hp + plan.sp + plan.won === L.total;
}

async function tradeExchange(p, card, plan) {
  if (!validExchange(p, plan)) return false;
  discardCard(p, card);
  const before = `HP ${p.hp} / SP ${p.sp} / ${p.won}안`;
  const dhp = plan.hp - p.hp, dsp = plan.sp - p.sp, dwon = plan.won - p.won;
  p.hp = plan.hp;
  p.sp = plan.sp;
  p.won = plan.won;
  showStage(p, [card], pname(p), `${before} → <b>HP ${p.hp} / SP ${p.sp} / ${p.won}안</b>`);
  log(`💱 ${pname(p)} 환전: ${before} → HP ${p.hp} / SP ${p.sp} / ${p.won}안`);
  if (dhp) floatText(p, (dhp > 0 ? '+' : '') + dhp, dhp > 0 ? 'heal' : 'dmg');
  else if (dsp) floatText(p, (dsp > 0 ? '+' : '') + dsp + ' SP', dsp > 0 ? 'sp' : 'spdown');
  else if (dwon) floatText(p, (dwon > 0 ? '+' : '') + dwon + '안', 'won');
  renderAll();
  await sleep(700);
  return true;
}

const itemHitsEnemy = (c) => c.type === 'item' && (c.effects || []).some((e) => e.target === 'enemy');
const needsTarget = (c) => itemHitsEnemy(c) ||
  (c.type === 'trade' && (c.kind === 'buy' || c.kind === 'sell')) ||
  (c.type === 'weapon' && !hasFx(c, 'all')) ||
  (c.type === 'ego' && (c.kind === 'stun' || c.kind === 'steal' || (c.kind === 'attack' && !hasFx(c, 'all'))));
// E.G.O는 정신력이 최저치 아래로 떨어지지 않을 때만 사용 가능
const canPayEgo = (p, c) => p.sp - c.cost > RULES.minSp;

// ------------------------------------------------------------
//  행동 실행 — 이 기기의 클릭과 원격 플레이어의 행동이 모두 여기를 거침
//  a = { act: 'pray' | 'play', main: uid, plus: [uid], target: pid, goods: uid, plan: {hp, sp, won} }
//  반환: { ok, ended, msg }
// ------------------------------------------------------------
async function executeAction(p, a) {
  const R = (ended, ok = true, msg = '') => ({ ended, ok, msg });
  if (!a || typeof a !== 'object') return R(false, false, '잘못된 행동입니다');
  if (a.act === 'pray') {
    pray(p);
    if (p.alive) clearStage(`${p.avatar} ${p.name} 🙏 기도`);
    renderAll();
    await sleep(500);
    return R(true);
  }
  const card = p.hand.find((c) => c.uid === a.main);
  if (!card) return R(false, false, '그 카드가 손에 없습니다');
  const target = a.target != null ? G.players.find((q) => q.id === a.target && q.alive && q !== p) : null;
  if (card.type === 'armor') return R(false, false, '방어구는 공격받을 때 사용합니다');
  if (card.type === 'ego' && !canPayEgo(p, card)) return R(false, false, '정신력이 부족합니다');
  if (needsTarget(card) && !target) return R(false, false, '대상을 선택하세요');

  if (card.type === 'weapon' || (card.type === 'ego' && card.kind === 'attack')) {
    let plus = [];
    if (card.type === 'weapon') {
      plus = [...new Set(a.plus || [])].map((u) => p.hand.find((c) => c.uid === u))
        .filter((c) => c && c !== card && c.type === 'weapon' && c.plus);
    }
    await performAttack(p, [card, ...plus], target ? [target] : []);
    return R(true);
  }
  if (card.type === 'trade') {
    if (card.kind === 'exchange') {
      const ok = await tradeExchange(p, card, a.plan);
      return R(ok, ok, ok ? '' : '환전 값이 올바르지 않습니다');
    }
    if (card.kind === 'buy') {
      await tradeBuy(p, card, target, buyDeciderFor(p, target));
      return R(true);
    }
    const goods = p.hand.find((c) => c.uid === a.goods && c !== card);
    if (!goods) return R(false, false, '팔 카드를 선택하세요');
    await tradeSell(p, card, goods, target);
    return R(true);
  }
  // 어떤 카드를 쓰든 턴이 끝남 (대상이 필요 없는 카드는 자신에게)
  await useSupport(p, card, needsTarget(card) ? target : p);
  return R(true);
}

// 원격 플레이어의 턴: 행동을 받아 실행, 턴이 끝날 때까지 반복
async function remoteTurn(p) {
  for (let i = 0; i < 15; i++) {
    if (!p.alive || G.over) return;
    if (p.ctrl !== 'remote') { await cpuTurn(p); return; }   // 도중에 연결이 끊기면 CPU가 이어받음
    const a = await Net.ask(p, 'turn', {}, RULES.turnTimeout, { act: 'pray', timeout: true });
    if (a && a.timeout) log(`${pname(p)} ⏱ 시간 초과 — 자동으로 기도합니다`);
    const r = await executeAction(p, a);
    if (!r.ok) toastTo(p, r.msg, 'bad');
    if (r.ended || checkEnd()) return;
  }
  pray(p);
}

// ------------------------------------------------------------
//  턴 진행
// ------------------------------------------------------------
async function runGame() {
  const session = G.session;
  while (!G.over && G.session === session) {
    const p = G.players[G.current];
    if (p.alive) {
      await takeTurn(p);
      if (G.session !== session) return;
      if (checkEnd()) break;
    }
    G.current = (G.current + 1) % G.players.length;
    if (G.current === 0) G.round++;
  }
}

async function takeTurn(p) {
  G.turn++;
  if (G.turn === RULES.nightTurn) {
    setNight(true);
    log('<div class="turn-mark night-mark">🌙 뒷골목의 밤이 찾아왔습니다. 이제 카드를 뽑을 때 청소부가 나타날 수 있습니다.</div>');
    toastAll('🌙 뒷골목의 밤이 시작되었습니다', 'bad');
    await sleep(900);
  }
  renderAll();
  clearStage(`${p.avatar} ${p.name}의 차례`);
  log(`<div class="turn-mark">— TURN ${G.turn} · ${p.name} —</div>`);
  await sleep(450);

  // 흐트러짐 게이지 회복
  if (!has(p, 'staggered')) p.stg = Math.min(RULES.staggerMax, p.stg + RULES.staggerRegen);

  // 화상
  if (has(p, 'burn')) {
    triggerTurnStart(p);
    renderAll();
    await sleep(350);
    if (!p.alive) return;
  }

  const staggered = has(p, 'staggered');
  const panicking = has(p, 'panic');
  const skip = has(p, 'stun') || panicking || staggered;
  if (!skip) {
    const n = drawCards(p, RULES.drawPerTurn);
    if (n) toastTo(p, '카드 1장을 뽑았습니다');
    renderAll();
    if (!p.alive) return;
    if (!n) await sleep(500);
  }
  renderAll();

  if (skip) {
    if (staggered) {
      log(`${pname(p)} 💢 흐트러져서 행동할 수 없습니다. 자세를 바로잡습니다... (흐트러짐 게이지 회복)`);
      floatText(p, '흐트러짐', 'block');
      p.status.staggered = { pot: 0, cnt: 0 };
      p.stg = RULES.staggerMax;
    }
    if (panicking) {
      log(`${pname(p)} 😱 공황 상태라 행동할 수 없습니다. 정신을 추스릅니다... (정신력 0으로 회복)`);
      floatText(p, '공황', 'block');
      p.sp = 0;
    }
    if (!staggered && !panicking) {
      log(`${pname(p)} 💫 기절해서 행동할 수 없습니다`);
      floatText(p, '기절', 'block');
    }
    await sleep(800);
  } else if (p.ctrl === 'local') {
    await humanTurn(p);
  } else if (p.ctrl === 'remote') {
    await remoteTurn(p);
  } else {
    await cpuTurn(p);
  }

  decayStatus(p);
  renderAll();
}

function checkEnd() {
  if (G.over) return true;
  const live = alive();
  if (G.mode === 'solo') {
    if (!me().alive) { endGame(false, live.length + 1); return true; }
    if (live.length === 1) { endGame(true, 1); return true; }
    return false;
  }
  if (live.length <= 1) {
    endMatch(live[0] || null);
    return true;
  }
  return false;
}

function endGame(win, rank) {
  G.over = true;
  const s = loadStats();
  if (win) s.win++; else s.lose++;
  saveStats(s);
  showResult(win ? '최후의 생존자' : '퇴근 실패', win,
    `<p>${win ? '구역의 모든 경쟁자를 제압했습니다.' : `${rank}위로 탈락했습니다.`}</p>
     <p class="muted">진행한 턴: ${G.turn} · 입힌 피해: ${me().dmgDealt}</p>
     <p class="muted">통산 전적 ${s.win}승 ${s.lose}패</p>`);
}

// 멀티: 승자 결정
function endMatch(winner) {
  G.over = true;
  if (G.mode === 'host') Net.end(winner);
  showMatchResult(winner ? winner.id : null);
}

// ------------------------------------------------------------
//  경기 시작
//  cfg.players: [{ name, avatar, ctrl, cid?, pack?: { name, cards } }]
//  cfg.deckMode: base | mixed | personal
// ------------------------------------------------------------
function startMatch(cfg) {
  G.session = (G.session || 0) + 1;
  uidSeq = 1;
  G.mode = cfg.mode;
  G.deckMode = cfg.deckMode;
  G.speed = cfg.speed;
  G.difficulty = cfg.difficulty;
  G.meId = cfg.meId;
  G.turn = 0;
  G.round = 1;
  G.over = false;
  G.acting = false;
  G.humanResolve = null;
  G.defendReq = null;
  G.hover = null;
  G.sel = { main: null, plus: [], target: null, goods: null };
  G.defs = {};
  registerDefs(CARDS);

  G.players = cfg.players.map((x, i) => {
    const p = makePlayer(i, x.name, x.avatar, x.ctrl);
    p.cid = x.cid;
    p.look = normalizeLook(x.look) || randomLook(x.name);
    p.packName = x.pack ? x.pack.name : '';
    p.packDefs = x.pack && x.pack.cards.length ? nsCards(x.pack.cards, `p${i}`) : [];
    registerDefs(p.packDefs);
    return p;
  });

  // 덱 구성
  G.shared = { deck: [], discard: [] };
  if (G.deckMode === 'personal') {
    for (const p of G.players) {
      const defs = p.packDefs.length ? p.packDefs : null;
      p.pile = { deck: shuffle(defs ? instances(defs) : cpuPackDefs().map((c) => ({ ...c, uid: uidSeq++ }))), discard: [] };
    }
  } else {
    const extra = G.deckMode === 'mixed' ? G.players.flatMap((p) => p.packDefs) : [];
    G.shared.deck = shuffle(instances([...CARDS, ...extra]));
  }
  G.players.forEach((p) => drawCards(p, RULES.startHand));
  G.current = rand(G.players.length);

  if (cfg.onReady) cfg.onReady();
  enterGameScreen();
  log(`<b>전투 개시.</b> ${G.players[G.current].name}부터 시작합니다.` +
    (G.deckMode === 'personal' ? ' <span class="muted">(개인 덱)</span>' : ''));
  renderAll();
  runGame();
}
