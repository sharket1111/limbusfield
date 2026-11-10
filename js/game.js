// ============================================================
//  게임 엔진 + 화면
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
  players: [],
  deck: [],
  discard: [],
  current: 0,
  turn: 0,      // 모든 플레이어의 턴을 합산한 수
  round: 1,
  over: false,
  speed: 1,
  difficulty: 'normal',
  sel: { main: null, plus: [], target: null, goods: null },
  humanResolve: null,
  acting: false,
  hover: null,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms * G.speed));
const isNight = () => G.turn >= RULES.nightTurn;

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
//  덱 / 플레이어
// ------------------------------------------------------------
function makeDeck() {
  const d = [];
  for (const c of CARDS) for (let i = 0; i < c.count; i++) d.push({ ...c, uid: uidSeq++ });
  return shuffle(d);
}

function makePlayer(id, name, avatar, human) {
  return {
    id, name, avatar, human,
    hp: RULES.maxHp, sp: 0, won: RULES.startWon,
    hand: [],
    status: { bleed: 0, burn: 0, fragile: 0, stun: 0, panic: 0 },
    alive: true,
    dmgDealt: 0,
  };
}

// 카드 뽑기. 뒷골목의 밤에는 일정 확률로 이벤트(청소부/연료통)가 대신 나옴
function drawCards(p, n = 1) {
  let got = 0;
  for (let i = 0; i < n; i++) {
    if (!p.alive) break;
    // 밤 이벤트는 손패가 가득 차 있어도 발생
    if (isNight() && Math.random() < RULES.nightChance) {
      nightEvent(p);
      continue;
    }
    if (p.hand.length >= RULES.maxHand) break;
    if (!G.deck.length) {
      if (!G.discard.length) break;
      G.deck = shuffle(G.discard);
      G.discard = [];
      log('<i>버려진 카드를 다시 섞어 덱을 만들었습니다.</i>');
    }
    p.hand.push(G.deck.pop());
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
    if (p.human) toast(`${ev.icon} 청소부 습격! ${dmg} 피해`, 'bad');
    damage(p, dmg, `${ev.icon} 청소부`);
    changeSp(p, -5, true);
  } else {
    const [what, amt] = pick(ev.gains);
    const label = { hp: `HP +${amt}`, sp: `정신력 +${amt}`, won: `+${amt}원` }[what];
    showEvent(p, ev, `<span class="pos">${label}</span>`);
    log(`${ev.icon} ${pname(p)} 이(가) <b>${ev.name}</b>을(를) 주웠습니다 (${label})`);
    if (p.human) toast(`${ev.icon} 연료통! ${label}`);
    if (what === 'hp') heal(p, amt);
    else if (what === 'sp') changeSp(p, amt);
    else gainWon(p, amt);
  }
}

function discardCard(p, card) {
  const i = p.hand.findIndex((c) => c.uid === card.uid);
  if (i >= 0) p.hand.splice(i, 1);
  G.discard.push(card);
}

const alive = () => G.players.filter((p) => p.alive);
const human = () => G.players.find((p) => p.human);
const others = (p) => G.players.filter((q) => q.alive && q !== p);

// ------------------------------------------------------------
//  로그 / 연출
// ------------------------------------------------------------
function pname(p) {
  return `<b class="pn ${p.human ? 'me' : ''}">${p.avatar} ${p.name}</b>`;
}
function cname(c) {
  return `<span class="cn r${c.rarity || 1}">「${c.name}」</span>`;
}

function log(html) {
  const box = $('#log');
  const el = document.createElement('div');
  el.className = 'log-line';
  el.innerHTML = html;
  box.prepend(el);
  while (box.children.length > 80) box.lastChild.remove();
}

function toast(text, kind = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.textContent = text;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

function panelOf(p) {
  return document.querySelector(`[data-pid="${p.id}"]`);
}

function floatText(p, text, cls) {
  const panel = panelOf(p);
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
  const st = $('#stage');
  st.innerHTML = html;
  st.classList.remove('pop');
  void st.offsetWidth;
  st.classList.add('pop');
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

function clearStage(text = '') {
  $('#stage').innerHTML = text ? `<div class="stage-idle">${text}</div>` : '';
}

// ------------------------------------------------------------
//  HP / 정신력 / 돈 / 상태
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
  if (got > 0) floatText(p, `+${got}원`, 'won');
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
    floatText(payer, `-${fromWon}원`, 'spdown');
    gainWon(receiver, fromWon);
  }
  const parts = [`${fromWon}원`];
  if (fromSp) parts.push(`정신력 ${fromSp}`);
  if (fromHp) parts.push(`<span class="neg">HP ${fromHp}</span>`);
  return parts.join(' + ');
}

function kill(p, killer = null) {
  p.alive = false;
  for (const c of [...p.hand]) discardCard(p, c);
  log(`💀 ${pname(p)} 이(가) 쓰러졌습니다.`);
  toast(`${p.name} 탈락!`, 'bad');
  // 누군가 쓰러지면: 처치자는 고양, 나머지는 동요
  for (const q of alive()) changeSp(q, q === killer ? 15 : -5, true);
}

function changeSp(p, n, quiet = false) {
  if (!p.alive || n === 0) return;
  const before = p.sp;
  p.sp = Math.max(RULES.minSp, Math.min(RULES.maxSp, p.sp + n));
  const got = p.sp - before;
  if (got && !quiet) floatText(p, (got > 0 ? '+' : '') + got + ' SP', got > 0 ? 'sp' : 'spdown');
  if (p.sp <= RULES.minSp && !p.status.panic) {
    p.status.panic = 1;
    log(`😱 ${pname(p)} 의 정신력이 무너졌습니다! <b class="neg">공황</b> 상태`);
    if (p.human) toast('공황 상태! 다음 턴을 쉽니다', 'bad');
  }
}

// 정신력에 따른 코인 앞면 확률: 50% + 정신력% (5% ~ 95%)
function headChance(sp) {
  return Math.max(0.05, Math.min(0.95, 0.5 + sp / 100));
}

function rollCoins(p) {
  const chance = headChance(p.sp);
  const coins = [];
  for (let i = 0; i < RULES.coins; i++) coins.push(Math.random() < chance);
  return coins;
}
const heads = (coins) => coins.filter(Boolean).length;

function coinsHTML(coins) {
  return coins.map((h) => `<span class="coin ${h ? 'head' : 'tail'}">${h ? '●' : '○'}</span>`).join('');
}

// 합 결과 분포 (방어자 기준 승/무/패 확률, 예상 피해)
function clashStats(atkBase, spA, defBase, spD, useArmor) {
  const n = RULES.coins, cp = RULES.coinPower;
  const binom = (pr) => {
    const out = [];
    for (let k = 0; k <= n; k++) {
      let c = 1;
      for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1);
      out.push(c * pr ** k * (1 - pr) ** (n - k));
    }
    return out;
  };
  const A = binom(headChance(spA));
  const D = useArmor ? binom(headChance(spD)) : [1];
  let win = 0, tie = 0, lose = 0, exp = 0, max = 0;
  for (let i = 0; i < A.length; i++) for (let j = 0; j < D.length; j++) {
    const a = atkBase + i * cp, d = useArmor ? defBase + j * cp : 0, pr = A[i] * D[j];
    if (d > a) win += pr;
    else if (d === a) tie += pr;
    else { lose += pr; exp += pr * (a - d); max = Math.max(max, a - d); }
  }
  return { win, tie, lose, exp, max };
}

function applyStatus(p, fx) {
  if (!p.alive) return;
  const set = { bleed: 3, burn: 3, fragile: 2, stun: 1 };
  for (const f of fx) {
    if (set[f] !== undefined) {
      p.status[f] = Math.max(p.status[f], set[f]);
      log(`${pname(p)}에게 ${STATUS[f].icon} ${STATUS[f].name} 부여`);
    }
  }
}

function cureAll(p) {
  p.status = { ...p.status, bleed: 0, burn: 0, fragile: 0 };
}

// ------------------------------------------------------------
//  전투 처리
// ------------------------------------------------------------
// 공격 정보 계산 (주 무기 + 보조 무기들, 또는 E.G.O 1장)
function buildAttack(cards) {
  const main = cards[0];
  const isEgo = main.type === 'ego';
  let atk = isEgo ? main.power : 0;
  const fx = new Set();
  for (const c of cards) {
    if (!isEgo) atk += c.atk;
    fxOf(c).forEach((f) => fx.add(f));
  }
  return { atk, attr: main.attr, fx: [...fx], cards, name: cards.map((c) => c.name).join(' + ') };
}

function armorMatches(armor, attr) {
  return armor.attr === 'all' || armor.attr === attr;
}

function armorDef(target, armors) {
  let def = armors.reduce((s, a) => s + a.def, 0);
  if (target.status.fragile > 0) def = Math.floor(def / 2);
  return def;
}

async function performAttack(attacker, cards, targets) {
  const info = buildAttack(cards);
  if (cards[0].type === 'ego') changeSp(attacker, -cards[0].cost);
  for (const c of cards) discardCard(attacker, c);

  if (info.fx.includes('all')) targets = others(attacker);
  const tText = info.fx.includes('all') ? '<b>전원</b>' : targets.map(pname).join(', ');
  const a = ATTR[info.attr];
  showStage(attacker, cards, tText,
    `<span style="color:${a.color}">${a.icon} ${a.name}</span> 위력 <b>${info.atk}</b> + 코인` +
    (info.fx.length ? ' · ' + info.fx.map((f) => FX_TEXT[f]).join(', ') : ''));
  log(`${pname(attacker)} ▶ ${tText} : ${cards.map(cname).join(' + ')} <span class="muted">(${a.icon}${info.atk})</span>`);
  renderAll();
  await sleep(700);

  // 출혈: 공격할 때마다 피해
  if (attacker.status.bleed > 0) {
    damage(attacker, 5, '🩸 출혈');
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

// 한 번의 적중 판정: 방어구를 냈다면 무기 vs 방어구 합
async function resolveHit(attacker, target, info) {
  const pierce = info.fx.includes('pierce');
  const armors = pierce ? [] : (target.human ? await humanDefend(target, attacker, info) : cpuDefend(target, info, attacker));
  for (const ar of armors) discardCard(target, ar);

  // 무효화: 합 없이 막음
  if (armors.some((x) => hasFx(x, 'nullify'))) {
    showClash(attacker, info, null, null, target, armors, null, null, 'nullify');
    log(`${pname(target)} ${armors.map(cname).join(' + ')} 🛑 공격을 무효화했습니다!`);
    floatText(target, '무효', 'block');
    changeSp(target, 5, true);
    changeSp(attacker, -3, true);
    renderAll();
    await sleep(900);
    return;
  }

  const ca = rollCoins(attacker);
  const pa = info.atk + heads(ca) * RULES.coinPower;

  if (!armors.length) {
    showClash(attacker, info, ca, pa, target, [], null, null, 'open');
    log(`${pname(attacker)} 위력 <b>${pa}</b> ${coinsHTML(ca)} → ${pname(target)} 무방비${pierce ? ' (관통)' : ''}`);
    renderAll();
    await sleep(800);
    landHit(attacker, target, pa, info);
    return;
  }

  // 합
  const cd = rollCoins(target);
  const def = armorDef(target, armors);
  const pd = def + heads(cd) * RULES.coinPower;
  const result = pa > pd ? 'atk' : pd > pa ? 'def' : 'tie';
  showClash(attacker, info, ca, pa, target, armors, cd, pd, result);
  log(`⚔ 합! ${pname(attacker)} <b>${pa}</b> ${coinsHTML(ca)} vs ${coinsHTML(cd)} <b>${pd}</b> ${pname(target)} ${armors.map(cname).join(' + ')}`);
  renderAll();
  await sleep(1200);

  if (result === 'atk') {
    log(`${pname(attacker)} 합 승리! ${pa - pd} 피해`);
    changeSp(attacker, 5, true);
    changeSp(target, -5, true);
    landHit(attacker, target, pa - pd, info);
  } else if (result === 'def') {
    floatText(target, '합 승리', 'sp');
    log(`${pname(target)} 합 승리! 공격을 완전히 막아냈습니다.`);
    changeSp(target, 5, true);
    changeSp(attacker, -5, true);
    if (armors.some((x) => hasFx(x, 'reflect'))) {
      const back = Math.floor(pa / 2);
      if (back > 0) damage(attacker, back, '🪞 반사 피해', target);
    }
  } else {
    log('합 무승부 — 공격과 방어가 상쇄되었습니다.');
    floatText(target, '상쇄', 'block');
  }
}

function showClash(attacker, info, ca, pa, target, armors, cd, pd, result) {
  const aSide = `
    <div class="clash-side">
      <div>${pname(attacker)}</div>
      <div class="stage-cards">${info.cards.map((c) => cardHTML(c, { big: true })).join('')}</div>
      ${ca ? `<div class="coins">${coinsHTML(ca)}</div>
      <div class="clash-pow ${result === 'atk' || result === 'open' ? 'win' : result === 'def' ? 'lose' : ''}">${pa}</div>` : ''}
    </div>`;
  let dSide;
  if (result === 'open') {
    dSide = `<div class="clash-side"><div>${pname(target)}</div><div class="open-guard">무방비</div></div>`;
  } else {
    dSide = `
      <div class="clash-side">
        <div>${pname(target)}</div>
        <div class="stage-cards">${armors.map((c) => cardHTML(c, { big: true })).join('')}</div>
        ${cd ? `<div class="coins">${coinsHTML(cd)}</div>
        <div class="clash-pow ${result === 'def' ? 'win' : result === 'atk' ? 'lose' : ''}">${pd}</div>` : '<div class="clash-pow win">무효</div>'}
      </div>`;
  }
  popStage(`
    <div class="stage-head">${result === 'open' ? '⚔ 공격' : '⚔ <b>합</b> ⚔'}</div>
    <div class="clash">${aSide}<div class="clash-vs">VS</div>${dSide}</div>`);
}

// 피해 적중 공통 처리
function landHit(attacker, target, dmg, info) {
  if (dmg <= 0) return;
  damage(target, dmg, `<span class="muted">${info.name}</span> 피격`, attacker);
  attacker.dmgDealt += dmg;
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
  applyStatus(target, info.fx);
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
  if (kind === 'heal') {
    const got = heal(p, card.power);
    log(`${pname(p)} HP ${got} 회복`);
  } else if (kind === 'sp') {
    changeSp(p, card.power);
    log(`${pname(p)} 정신력 ${card.power} 회복`);
  } else if (kind === 'won') {
    gainWon(p, card.power);
    log(`${pname(p)} ${card.power}원 획득`);
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
    else if (roll === 3) { gainWon(p, 25); log('📦 상자 속에는 현금 다발이! 25원 획득'); }
    else { const n = drawCards(p, 3); log(`📦 상자 속에서 카드 ${n}장 발견!`); }
  } else if (kind === 'steal') {
    if (target.hand.length) {
      const c = pick(target.hand);
      target.hand.splice(target.hand.indexOf(c), 1);
      if (p.hand.length < RULES.maxHand) p.hand.push(c); else G.discard.push(c);
      log(`${pname(p)} 이(가) ${pname(target)}의 카드를 압류했습니다${p.human ? ': ' + cname(c) : ''}`);
      if (target.human) toast(`「${c.name}」을(를) 빼앗겼습니다!`, 'bad');
    } else {
      log(`${pname(target)}의 손패가 비어 있습니다.`);
    }
  } else if (kind === 'stun') {
    target.status.stun = 1;
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
  changeSp(p, 10);
  log(`${pname(p)} 🙏 기도했습니다 (${tossed ? `${cname(tossed)} 버림, ` : ''}카드 ${n}장, 정신력 +10)`);
}

// ------------------------------------------------------------
//  거래: 매입 / 매각 / 환전 (상대가 막을 수 없음)
// ------------------------------------------------------------
// 매입: 상대 손패에서 무작위 1장 공개 → 살지 결정 (decide: async (card) => bool)
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
  showStage(p, [item], `${pname(target)}의 카드`, `가격 <b class="won">₩${price}</b>`);
  renderAll();
  await sleep(500);
  const ok = p.won >= price && (await decide(item));
  if (!ok) {
    log(`${pname(p)} 이(가) ${pname(target)}의 ${p.human || target.human ? cname(item) : '카드'}를 사지 않았습니다.`);
    return;
  }
  const paid = pay(p, target, price);
  target.hand.splice(target.hand.indexOf(item), 1);
  if (p.hand.length < RULES.maxHand) p.hand.push(item); else G.discard.push(item);
  log(`🛒 ${pname(p)} 이(가) ${pname(target)}에게서 ${cname(item)}을(를) 매입 (${paid})`);
  if (target.human) toast(`「${item.name}」을(를) ₩${price}에 매입당했습니다`, 'bad');
  renderAll();
  await sleep(600);
}

// 매각: 내 카드 1장을 상대에게 강제로 판매
async function tradeSell(p, card, goods, target) {
  discardCard(p, card);
  p.hand.splice(p.hand.indexOf(goods), 1);
  const price = goods.price || 0;
  showStage(p, [card, goods], pname(target), `판매가 <b class="won">₩${price}</b> — 거부할 수 없음`);
  log(`💸 ${pname(p)} 이(가) ${pname(target)}에게 ${cname(goods)}을(를) ₩${price}에 강매`);
  renderAll();
  await sleep(700);
  const paid = pay(target, p, price);
  if (target.alive) {
    if (target.hand.length < RULES.maxHand) target.hand.push(goods); else G.discard.push(goods);
  } else {
    G.discard.push(goods);
  }
  log(`${pname(target)} 지불: ${paid}`);
  if (target.human) toast(`「${goods.name}」을(를) ₩${price}에 강매당했습니다`, 'bad');
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

async function tradeExchange(p, card, plan) {
  discardCard(p, card);
  const L = exchangeLimits(p);
  const ok = plan && plan.hp + plan.sp + plan.won === L.total &&
    ['hp', 'sp', 'won'].every((k) => plan[k] >= L[k][0] && plan[k] <= L[k][1]);
  if (!ok) return;
  const before = `HP ${p.hp} / SP ${p.sp} / ₩${p.won}`;
  const dhp = plan.hp - p.hp, dsp = plan.sp - p.sp, dwon = plan.won - p.won;
  p.hp = plan.hp;
  p.sp = plan.sp;
  p.won = plan.won;
  showStage(p, [card], pname(p), `${before} → <b>HP ${p.hp} / SP ${p.sp} / ₩${p.won}</b>`);
  log(`💱 ${pname(p)} 환전: ${before} → HP ${p.hp} / SP ${p.sp} / ₩${p.won}`);
  if (dhp) floatText(p, (dhp > 0 ? '+' : '') + dhp, dhp > 0 ? 'heal' : 'dmg');
  else if (dsp) floatText(p, (dsp > 0 ? '+' : '') + dsp + ' SP', dsp > 0 ? 'sp' : 'spdown');
  else if (dwon) floatText(p, (dwon > 0 ? '+' : '') + dwon + '원', 'won');
  renderAll();
  await sleep(700);
}

const isFreeAction = (c) => c.type === 'item' || (c.type === 'ego' && ['heal', 'cure'].includes(c.kind)) ||
  (c.type === 'trade' && c.kind === 'exchange');
const needsTarget = (c) =>
  (c.type === 'trade' && (c.kind === 'buy' || c.kind === 'sell')) ||
  (c.type === 'weapon' && !hasFx(c, 'all')) ||
  (c.type === 'ego' && (c.kind === 'stun' || c.kind === 'steal' || (c.kind === 'attack' && !hasFx(c, 'all'))));
// E.G.O는 정신력이 최저치 아래로 떨어지지 않을 때만 사용 가능
const canPayEgo = (p, c) => p.sp - c.cost > RULES.minSp;

// ------------------------------------------------------------
//  턴 진행
// ------------------------------------------------------------
async function runGame() {
  while (!G.over) {
    const p = G.players[G.current];
    if (p.alive) {
      await takeTurn(p);
      if (checkEnd()) break;
    }
    G.current = (G.current + 1) % G.players.length;
    if (G.current === 0) G.round++;
  }
}

async function takeTurn(p) {
  G.turn++;
  if (G.turn === RULES.nightTurn) {
    document.body.classList.add('night');
    log('<div class="turn-mark night-mark">🌙 뒷골목의 밤이 찾아왔습니다. 이제 카드를 뽑을 때 청소부가 나타날 수 있습니다.</div>');
    toast('🌙 뒷골목의 밤이 시작되었습니다', 'bad');
    await sleep(900);
  }
  renderAll();
  clearStage(`${p.avatar} ${p.name}의 차례`);
  log(`<div class="turn-mark">— TURN ${G.turn} · ${p.name} —</div>`);
  await sleep(450);

  // 화상
  if (p.status.burn > 0) {
    damage(p, 5, '🔥 화상');
    renderAll();
    await sleep(350);
    if (!p.alive) return;
  }

  const panicking = p.status.panic > 0;
  const skip = p.status.stun > 0 || panicking;
  if (!skip) {
    const n = drawCards(p, RULES.drawPerTurn);
    if (p.human && n) toast('카드 1장을 뽑았습니다');
    renderAll();
    if (!p.alive) return;
    if (!n) await sleep(500);
  }
  renderAll();

  if (skip) {
    if (panicking) {
      log(`${pname(p)} 😱 공황 상태라 행동할 수 없습니다. 정신을 추스릅니다... (정신력 0으로 회복)`);
      floatText(p, '공황', 'block');
      p.sp = 0;
    } else {
      log(`${pname(p)} 💫 기절해서 행동할 수 없습니다`);
      floatText(p, '기절', 'block');
    }
    await sleep(800);
  } else if (p.human) {
    await humanTurn(p);
  } else {
    await cpuTurn(p);
  }

  // 턴 종료 시 상태 감소
  for (const k of ['bleed', 'burn', 'fragile', 'stun', 'panic']) if (p.status[k] > 0) p.status[k]--;
  renderAll();
}

function checkEnd() {
  if (G.over) return true;
  const me = human();
  const live = alive();
  if (!me.alive) {
    endGame(false, live.length + 1);
    return true;
  }
  if (live.length === 1) {
    endGame(true, 1);
    return true;
  }
  return false;
}

function endGame(win, rank) {
  G.over = true;
  const s = loadStats();
  if (win) s.win++; else s.lose++;
  saveStats(s);
  const me = human();
  $('#result-title').textContent = win ? '최후의 생존자' : '퇴근 실패';
  $('#result-title').className = win ? 'win' : 'lose';
  $('#result-body').innerHTML = `
    <p>${win ? '구역의 모든 경쟁자를 제압했습니다.' : `${rank}위로 탈락했습니다.`}</p>
    <p class="muted">진행한 턴: ${G.turn} · 입힌 피해: ${me.dmgDealt}</p>
    <p class="muted">통산 전적 ${s.win}승 ${s.lose}패</p>`;
  $('#result').classList.add('show');
}

// ------------------------------------------------------------
//  사람 플레이어
// ------------------------------------------------------------
function humanTurn() {
  G.sel = { main: null, plus: [], target: null, goods: null };
  return new Promise((res) => {
    G.humanResolve = res;
    renderAll();
  });
}

function endHumanTurn() {
  const r = G.humanResolve;
  G.humanResolve = null;
  G.sel = { main: null, plus: [], target: null, goods: null };
  if (r) r();
}

function onHandClick(uid) {
  const me = human();
  const card = me.hand.find((c) => c.uid === uid);
  if (!card) return;
  G.hover = card;
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
    toast('방어구는 공격을 받을 때 사용합니다');
  } else {
    G.sel = { main: card, plus: [], target: s.target, goods: null };
  }
  renderAll();
}

function onTargetClick(pid) {
  if (!G.humanResolve || G.acting) return;
  const t = G.players.find((p) => p.id === pid);
  if (!t || !t.alive || t.human) return;
  G.sel.target = G.sel.target === t ? null : t;
  renderAll();
}

function actionState() {
  const me = human();
  const { main, target } = G.sel;
  if (!main) return { label: '카드를 선택하세요', ok: false };
  if (main.type === 'ego' && !canPayEgo(me, main)) return { label: `정신력 부족 (${main.cost} 소모)`, ok: false };
  if (main.type === 'trade' && main.kind === 'sell' && !G.sel.goods) return { label: '팔 카드를 선택하세요', ok: false };
  if (needsTarget(main) && !target) return { label: '대상을 선택하세요', ok: false };
  if (main.type === 'trade') return { label: { buy: '🛒 매입 (턴 종료)', sell: '💸 강매 (턴 종료)', exchange: '💱 환전 (턴 유지)' }[main.kind], ok: true };
  if (main.type === 'weapon') return { label: '⚔ 공격', ok: true };
  if (main.type === 'ego' && main.kind === 'attack') return { label: '✧ E.G.O 공격', ok: true };
  if (main.type === 'ego' && (main.kind === 'steal' || main.kind === 'stun')) return { label: '✧ E.G.O 발현 (턴 종료)', ok: true };
  return { label: '사용 (턴 유지)', ok: true };
}

async function onAction() {
  const st = actionState();
  if (!st.ok || G.acting) return;
  const me = human();
  const { main, plus, target } = G.sel;
  G.acting = true;
  renderAll();
  try {
    if (main.type === 'trade') {
      if (main.kind === 'exchange') {
        const plan = await humanExchange(me);
        if (plan) await tradeExchange(me, main, plan);
        G.sel = { main: null, plus: [], target: G.sel.target, goods: null };
        G.acting = false;
        renderAll();
        return;
      }
      if (main.kind === 'buy') await tradeBuy(me, main, target, (item) => humanBuyDecide(me, target, item));
      else await tradeSell(me, main, G.sel.goods, target);
      G.acting = false;
      checkEnd();
      endHumanTurn();
      return;
    }
    if (main.type === 'weapon' || (main.type === 'ego' && main.kind === 'attack')) {
      await performAttack(me, [main, ...plus], target ? [target] : []);
      G.acting = false;
      endHumanTurn();
    } else if (isFreeAction(main)) {
      await useSupport(me, main, me);
      G.sel = { main: null, plus: [], target: G.sel.target, goods: null };
      G.acting = false;
      if (checkEnd()) { endHumanTurn(); return; }
      renderAll();
    } else {
      await useSupport(me, main, target);
      G.acting = false;
      endHumanTurn();
    }
  } catch (e) {
    G.acting = false;
    console.error(e);
  }
}

async function onPray() {
  if (!G.humanResolve || G.acting) return;
  const me = human();
  G.acting = true;
  pray(me);
  if (me.alive) clearStage('🙏 기도');
  await sleep(400);
  G.acting = false;
  endHumanTurn();
}

// 매입 결정 창
function humanBuyDecide(me, target, item) {
  return new Promise((res) => {
    const modal = $('#dialog');
    modal.querySelector('.dlg-box').innerHTML = `
      <h2>매입</h2>
      <p>${pname(target)}의 손패에서 이 카드가 나왔습니다.</p>
      <div class="def-cards">${cardHTML(item, { big: true })}</div>
      <p>가격 <b class="won">₩${item.price || 0}</b> <span class="muted">(보유 ₩${me.won})</span></p>
      <div class="def-actions">
        <button class="btn primary" id="dlg-yes">🛒 매입</button>
        <button class="btn" id="dlg-no">사지 않기</button>
      </div>`;
    const done = (v) => { modal.classList.remove('show'); res(v); };
    $('#dlg-yes').onclick = () => done(true);
    $('#dlg-no').onclick = () => done(false);
    modal.classList.add('show');
  });
}

// 환전 창: HP / 정신력 / 돈을 합계를 유지한 채 재배분
function humanExchange(me) {
  return new Promise((res) => {
    const L = exchangeLimits(me);
    const plan = { hp: me.hp, sp: me.sp, won: me.won };
    const modal = $('#dialog');
    const label = { hp: '❤ HP', sp: '🧠 정신력', won: '₩ 돈' };
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

// 방어 선택 창 — 방어구를 내면 무기 vs 방어구 합
function humanDefend(me, attacker, info) {
  const armors = me.hand.filter((c) => c.type === 'armor');
  if (!armors.length) return Promise.resolve([]);
  return new Promise((res) => {
    const chosen = new Set();
    const modal = $('#defend');
    const a = ATTR[info.attr];
    const cp = RULES.coinPower, n = RULES.coins;

    const draw = () => {
      const picked = armors.filter((c) => chosen.has(c.uid));
      let preview;
      if (picked.some((c) => hasFx(c, 'nullify'))) {
        preview = '공격을 <b class="pos">무효화</b>합니다';
      } else {
        const st = clashStats(info.atk, attacker.sp, armorDef(me, picked), me.sp, picked.length > 0);
        preview = picked.length
          ? `합 승률 <b class="pos">${Math.round(st.win * 100)}%</b> · 무승부 ${Math.round(st.tie * 100)}% · 패배 <b class="neg">${Math.round(st.lose * 100)}%</b>
             <div>예상 피해 평균 <b class="neg">${st.exp.toFixed(1)}</b> · 최대 ${st.max} <span class="muted">(현재 HP ${me.hp})</span></div>`
          : `무방비 — 피해 <b class="neg">${info.atk} ~ ${info.atk + n * cp}</b> (평균 ${st.exp.toFixed(1)}) <span class="muted">(현재 HP ${me.hp})</span>`;
      }
      modal.querySelector('.def-box').innerHTML = `
        <h2>공격받고 있습니다!</h2>
        <div class="def-attack">
          ${pname(attacker)} 의 <b>${info.name}</b><br>
          <span class="big-atk" style="color:${a.color}">${a.icon} ${a.name} ${info.atk}</span> <span class="muted">+ 코인 ${n}개 (앞면당 +${cp})</span>
          ${info.fx.length ? `<div class="muted">${info.fx.map((f) => FX_TEXT[f]).join(' · ')}</div>` : ''}
        </div>
        <div class="sp-line">정신력 — 나 <b>${me.sp}</b> (앞면 ${Math.round(headChance(me.sp) * 100)}%) · 상대 <b>${attacker.sp}</b> (앞면 ${Math.round(headChance(attacker.sp) * 100)}%)</div>
        <h3>🛡 방어구로 합 <span class="muted small">${a.name} 또는 전속성만 · 방어 위력 = 방어력 합계 + 코인${me.status.fragile ? ' · <span class="neg">💔 취약: 방어력 절반</span>' : ''}</span></h3>
        <div class="def-cards">${armors.map((c) => {
          const ok = armorMatches(c, info.attr);
          return `<div class="def-slot ${ok ? '' : 'disabled'} ${chosen.has(c.uid) ? 'chosen' : ''}" data-uid="${c.uid}">${cardHTML(c)}</div>`;
        }).join('')}</div>
        <div class="def-preview">${preview}</div>
        <div class="def-actions">
          <button class="btn primary" id="def-ok">${picked.length ? '⚔ 합!' : '그대로 받기'}</button>
        </div>`;
      $$('.def-slot', modal).forEach((el) => {
        el.onclick = () => {
          if (el.classList.contains('disabled')) return;
          const uid = +el.dataset.uid;
          chosen.has(uid) ? chosen.delete(uid) : chosen.add(uid);
          draw();
        };
      });
      $('#def-ok').onclick = () => {
        modal.classList.remove('show');
        res(armors.filter((c) => chosen.has(c.uid)));
      };
    };
    draw();
    modal.classList.add('show');
  });
}

// ------------------------------------------------------------
//  렌더링
// ------------------------------------------------------------
const TYPE_NAME = { weapon: '무기', armor: '방어구', ego: 'E.G.O', item: '도구', trade: '거래' };

function cardHTML(c, opt = {}) {
  const a = ATTR[c.attr] || null;
  let stat = '';
  if (c.type === 'weapon') stat = `<div class="c-stat atk">${c.atk}</div>`;
  else if (c.type === 'armor') stat = `<div class="c-stat def">${c.def}</div>`;
  else if (c.type === 'ego') stat = `<div class="c-stat egoc">${c.cost}<small>SP</small></div>`;
  else if (c.type === 'trade') stat = `<div class="c-stat trd">${{ buy: '🛒', sell: '💸', exchange: '💱' }[c.kind]}</div>`;
  else stat = `<div class="c-stat itm">◆</div>`;

  let sub = '';
  if (c.type === 'ego') {
    sub = { attack: `${c.power} 위력`, heal: `HP +${c.power}`, cure: '상태 해제', steal: '카드 강탈', stun: '기절' }[c.kind];
  } else if (c.type === 'trade') {
    sub = { buy: '매입', sell: '강매', exchange: '환전' }[c.kind];
  } else if (c.type === 'item') {
    sub = { heal: `HP +${c.power}`, sp: `정신력 +${c.power}`, won: `+${c.power}원`, cure: '상태 해제', draw: `${c.power}장 뽑기`, gamble: '???' }[c.kind];
  }
  const tags = [...fxOf(c).map((f) => FX_TEXT[f]), c.plus ? '보조' : null].filter(Boolean);

  return `<div class="card t-${c.type} r${c.rarity || 1} ${opt.big ? 'big' : ''} ${opt.cls || ''}" ${opt.uid ? `data-uid="${c.uid}"` : ''}>
    <div class="c-top"><span class="c-type">${TYPE_NAME[c.type]}</span>${a ? `<span class="c-attr" style="color:${a.color}" title="${a.name}">${a.icon}</span>` : ''}</div>
    ${stat}
    <div class="c-name">${c.name}</div>
    ${sub ? `<div class="c-sub">${sub}</div>` : ''}
    <div class="c-tags">${tags.map((t) => `<span>${t}</span>`).join('')}</div>
    <div class="c-price">₩${c.price || 0}</div>
  </div>`;
}

function statusHTML(p) {
  return Object.entries(p.status)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `<span class="st" title="${STATUS[k].name}: ${STATUS[k].desc}">${STATUS[k].icon}${v}</span>`)
    .join('');
}

function bar(cur, max, cls) {
  return `<div class="bar ${cls}"><div style="width:${(cur / max) * 100}%"></div><span>${cur}</span></div>`;
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

function renderOpponents() {
  const box = $('#opponents');
  const targeting = G.humanResolve && !G.acting && G.sel.main && needsTarget(G.sel.main);
  box.innerHTML = G.players.filter((p) => !p.human).map((p) => `
    <div class="opp ${p.alive ? '' : 'dead'} ${G.players[G.current] === p && !G.over ? 'active' : ''}
      ${targeting && p.alive ? 'targetable' : ''} ${G.sel.target === p ? 'targeted' : ''}" data-pid="${p.id}">
      <div class="opp-av">${p.avatar}</div>
      <div class="opp-info">
        <div class="opp-name">${p.name} <span class="st-row">${statusHTML(p)}</span></div>
        ${bar(p.hp, RULES.maxHp, 'hp')}
        ${spBar(p)}
        <div class="opp-hand">🂠 × ${p.hand.length} <span class="won">₩ ${p.won}</span></div>
      </div>
    </div>`).join('');
  $$('.opp', box).forEach((el) => (el.onclick = () => onTargetClick(+el.dataset.pid)));
}

function renderMe() {
  const me = human();
  const myTurn = !!G.humanResolve;
  $('#me').innerHTML = `
    <div class="me-card ${myTurn ? 'active' : ''}" data-pid="${me.id}">
      <div class="opp-av">${me.avatar}</div>
      <div class="opp-info">
        <div class="opp-name">${me.name} <span class="st-row">${statusHTML(me)}</span></div>
        ${bar(me.hp, RULES.maxHp, 'hp')}
        ${spBar(me)}
        <div class="opp-hand"><span class="won">₩ ${me.won}</span> · 코인 앞면 ${Math.round(headChance(me.sp) * 100)}%</div>
      </div>
    </div>`;

  const hand = $('#hand');
  const sel = G.sel;
  const order = { weapon: 0, ego: 1, trade: 2, item: 3, armor: 4 };
  const val = (c) => c.atk || c.def || c.cost || 0;
  const sorted = [...me.hand].sort((a, b) => order[a.type] - order[b.type] || val(b) - val(a));
  hand.innerHTML = sorted.map((c) => {
    let cls = '';
    if (sel.main && sel.main.uid === c.uid) cls = 'sel-main';
    else if (sel.goods && sel.goods.uid === c.uid) cls = 'sel-goods';
    else if (sel.plus.some((x) => x.uid === c.uid)) cls = 'sel-plus';
    else if (myTurn && sel.main && sel.main.type === 'weapon' && c.type === 'weapon' && c.plus) cls = 'can-plus';
    if (c.type === 'ego' && !canPayEgo(me, c)) cls += ' no-sp';
    return cardHTML(c, { uid: true, cls });
  }).join('') || '<div class="muted empty-hand">손패가 없습니다</div>';
  $$('.card', hand).forEach((el) => {
    el.onclick = () => onHandClick(+el.dataset.uid);
    el.onmouseenter = () => { G.hover = me.hand.find((c) => c.uid === +el.dataset.uid); renderInfo(); };
  });

  // 버튼
  const st = actionState();
  const act = $('#btn-act');
  act.textContent = myTurn ? st.label : '상대 차례';
  act.disabled = !myTurn || !st.ok || G.acting;
  $('#btn-pray').disabled = !myTurn || G.acting;
  $('#btn-cancel').disabled = !myTurn || G.acting || !sel.main;

  // 공격 미리보기
  const prev = $('#preview');
  if (sel.main && (sel.main.type === 'weapon' || sel.main.kind === 'attack')) {
    const info = buildAttack([sel.main, ...sel.plus]);
    const a = ATTR[info.attr];
    prev.innerHTML = `<span style="color:${a.color}">${a.icon} ${a.name}</span> 위력 <b>${info.atk}</b> ~ ${info.atk + RULES.coins * RULES.coinPower}${info.fx.includes('twice') ? ' ×2' : ''}
      ${sel.target ? ` → ${sel.target.avatar} ${sel.target.name}` : ''}
      ${sel.main.type === 'weapon' && me.hand.some((c) => c.plus && c.type === 'weapon' && c !== sel.main && !sel.plus.includes(c)) ? '<span class="muted"> · 보조 무기를 덧붙일 수 있음</span>' : ''}`;
  } else if (sel.main && sel.main.type === 'trade') {
    const t = sel.target ? ` → ${sel.target.avatar} ${sel.target.name}` : '';
    prev.innerHTML = {
      buy: `🛒 상대 손패에서 무작위 1장을 보고 살지 결정합니다${t}`,
      sell: sel.goods ? `💸 「${sel.goods.name}」을(를) <b class="won">₩${sel.goods.price || 0}</b>에 강매${t}` : '💸 팔 카드를 손패에서 고르세요 (비쌀수록 이득)',
      exchange: '💱 HP·정신력·돈을 1:1로 다시 나눕니다',
    }[sel.main.kind];
  } else if (myTurn) {
    prev.innerHTML = '<span class="muted">무기·E.G.O로 공격하거나, 도구를 쓰거나, 기도해서 턴을 넘기세요.</span>';
  } else {
    prev.innerHTML = '';
  }
}

function renderInfo() {
  const c = G.hover;
  const box = $('#info');
  if (!c) { box.innerHTML = '<span class="muted">카드를 누르거나 마우스를 올리면 설명이 표시됩니다.</span>'; return; }
  const a = ATTR[c.attr];
  const parts = [];
  if (c.type === 'weapon') parts.push(`공격력 ${c.atk}`);
  if (c.type === 'armor') parts.push(`방어력 ${c.def}`);
  if (c.type === 'ego') parts.push(`정신력 ${c.cost} 소모`);
  if (a) parts.push(`${a.icon} ${a.name}`);
  fxOf(c).forEach((f) => parts.push(FX_TEXT[f]));
  if (c.plus) parts.push('보조 무기 — 다른 무기에 덧붙여 공격력 합산');
  parts.push(`가격 ₩${c.price || 0}`);
  box.innerHTML = `<b class="cn r${c.rarity || 1}">${c.name}</b> <span class="muted">${parts.join(' · ')}</span><div class="flavor">${c.flavor || ''}</div>`;
}

function renderAll() {
  if (!G.players.length) return;
  renderOpponents();
  renderMe();
  renderInfo();
  const left = RULES.nightTurn - G.turn;
  $('#round').innerHTML = `TURN ${G.turn}` + (isNight() ? ' <span class="night-tag">🌙 뒷골목의 밤</span>'
    : left <= 20 ? ` <span class="muted small">밤까지 ${left}턴</span>` : '');
  $('#deckcount').textContent = `덱 ${G.deck.length} · 버림 ${G.discard.length}`;
}

// ------------------------------------------------------------
//  시작
// ------------------------------------------------------------
function startGame() {
  const name = ($('#in-name').value || '').trim() || '관리자';
  const cpuN = +$('#in-cpu').value;
  G.difficulty = $('#in-diff').value;
  G.speed = +$('#in-speed').value;
  $('#in-speed-game').value = String(G.speed);
  try { localStorage.setItem('af_name', name); } catch { /* 무시 */ }

  uidSeq = 1;
  G.deck = makeDeck();
  G.discard = [];
  G.turn = 0;
  G.round = 1;
  G.over = false;
  G.acting = false;
  G.humanResolve = null;
  G.hover = null;
  document.body.classList.remove('night');

  const names = shuffle([...CPU_NAMES]);
  const avs = shuffle([...CPU_AVATARS]);
  G.players = [makePlayer(0, name, '🜲', true)];
  for (let i = 0; i < cpuN; i++) G.players.push(makePlayer(i + 1, names[i], avs[i], false));
  G.players.forEach((p) => drawCards(p, RULES.startHand));
  G.current = rand(G.players.length);

  $('#log').innerHTML = '';
  $('#title').classList.remove('show');
  $('#result').classList.remove('show');
  $('#game').classList.add('show');
  log(`<b>전투 개시.</b> ${G.players[G.current].name}부터 시작합니다.`);
  renderAll();
  runGame();
}

function init() {
  try { $('#in-name').value = localStorage.getItem('af_name') || ''; } catch { /* 무시 */ }
  const s = loadStats();
  $('#stats').textContent = s.win + s.lose ? `통산 ${s.win}승 ${s.lose}패` : '';

  $('#btn-start').onclick = startGame;
  $('#btn-again').onclick = startGame;
  $('#btn-title').onclick = () => {
    $('#result').classList.remove('show');
    $('#game').classList.remove('show');
    $('#title').classList.add('show');
    document.body.classList.remove('night');
    const st = loadStats();
    $('#stats').textContent = `통산 ${st.win}승 ${st.lose}패`;
  };
  $('#btn-act').onclick = onAction;
  $('#btn-pray').onclick = onPray;
  $('#btn-cancel').onclick = () => { G.sel = { main: null, plus: [], target: null, goods: null }; renderAll(); };
  $$('.open-rules').forEach((b) => (b.onclick = () => $('#rules').classList.add('show')));
  $('#rules-close').onclick = () => $('#rules').classList.remove('show');
  $('#btn-gallery').onclick = () => {
    const night = Object.values(NIGHT_EVENTS).map((e) => `<div class="g-item"><div class="card night-gallery"><div class="night-icon">${e.icon}</div><div class="c-name">${e.name}</div></div>
      <div class="flavor">${e.flavor}<br><span class="muted">뒷골목의 밤 전용 · ${e.damages ? `뽑으면 ${e.damages.join('/')} 피해` : 'HP 10 / 정신력 10 / 10원 중 하나'}</span></div></div>`).join('');
    $('#gallery-list').innerHTML = CARDS.map((c) => `<div class="g-item">${cardHTML(c)}<div class="flavor">${c.flavor || ''} <span class="muted">×${c.count}</span></div></div>`).join('') + night;
    $('#gallery').classList.add('show');
  };
  $('#gallery-close').onclick = () => $('#gallery').classList.remove('show');
  $('#in-speed-game').onchange = (e) => (G.speed = +e.target.value);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      $('#rules').classList.remove('show');
      $('#gallery').classList.remove('show');
      if (G.humanResolve && !G.acting) { G.sel = { main: null, plus: [], target: null, goods: null }; renderAll(); }
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
