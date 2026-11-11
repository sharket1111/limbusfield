// ============================================================
//  키워드(상태 효과) & 카드 효과 시스템
//  - 키워드는 위력(pot)과 횟수(cnt)를 가집니다. 횟수가 0이 되면 사라집니다.
//  - 카드/코인 효과는 { when, target, key, pot, cnt } 형태입니다.
// ============================================================
'use strict';

const KEYWORDS = {
  burn:    { name: '화상', icon: '🔥', debuff: true,  desc: '턴 시작 시 위력만큼 피해를 받고 횟수 -1' },
  bleed:   { name: '출혈', icon: '🩸', debuff: true,  desc: '공격할 때마다 위력만큼 피해를 받고 횟수 -1' },
  tremor:  { name: '진동', icon: '〰', debuff: true,  desc: '「진동 폭발」을 당하면 위력만큼 흐트러짐 피해. 턴 종료 시 횟수 -1' },
  rupture: { name: '파열', icon: '💥', debuff: true,  desc: '피격될 때마다 위력만큼 추가 피해를 받고 횟수 -1' },
  sinking: { name: '침잠', icon: '🌊', debuff: true,  desc: '피격될 때마다 위력만큼 정신력 감소(정신력이 최저면 대신 그만큼 피해), 횟수 -1' },
  poise:   { name: '호흡', icon: '🌬', debuff: false, desc: '공격 적중 시 위력×5% 확률로 치명타(피해 1.2배), 치명타가 나면 횟수 -1. 턴 종료 시 횟수 -1' },
  charge:  { name: '충전', icon: '⚡', debuff: false, countOnly: true, max: 20, desc: '충전량(최대 20). 「충전 소모」 효과에 쓰입니다. 턴 종료 시 -1' },
  fragile: { name: '취약', icon: '💔', debuff: true,  countOnly: true, desc: '방어력 절반. 턴 종료 시 횟수 -1' },
  stun:    { name: '기절', icon: '💫', debuff: true,  countOnly: true, desc: '다음 턴을 건너뜀' },
  panic:   { name: '공황', icon: '😱', debuff: true,  countOnly: true, hidden: true, desc: '정신력 붕괴 — 다음 턴을 건너뜀' },
  staggered: { name: '흐트러짐', icon: '💢', debuff: true, countOnly: true, hidden: true, desc: '흐트러짐 게이지가 0 — 다음 턴을 건너뛰고, 합·가드·회피·반격을 할 수 없으며, 받는 피해 1.5배' },
};

// 턴 종료 시 횟수가 1 줄어드는 키워드
const DECAY_AT_TURN_END = ['tremor', 'poise', 'charge', 'fragile', 'stun', 'panic'];

function newStatus() {
  const s = {};
  for (const k of Object.keys(KEYWORDS)) s[k] = { pot: 0, cnt: 0 };
  return s;
}

const has = (p, k) => p.status[k] && p.status[k].cnt > 0;

function addStatus(p, key, pot = 0, cnt = 0, quiet = false) {
  if (!p.alive || !KEYWORDS[key]) return;
  const kw = KEYWORDS[key];
  const s = p.status[key];
  if (kw.countOnly) {
    s.cnt = Math.min(kw.max || 99, s.cnt + Math.max(1, cnt || pot || 1));
  } else {
    s.pot = Math.min(99, s.pot + (pot || 0));
    s.cnt = Math.min(99, s.cnt + (cnt || 0));
    if (s.cnt <= 0 && s.pot > 0) s.cnt = 1;
    if (s.pot <= 0 && s.cnt > 0) s.pot = 1;
  }
  if (!quiet) log(`${pname(p)}에게 ${kw.icon} ${kw.name} ${kw.countOnly ? s.cnt : `${s.pot}/${s.cnt}`} <span class="muted">(+${kw.countOnly ? Math.max(1, cnt || pot || 1) : `${pot || 0}/${cnt || 0}`})</span>`);
}

function useCount(p, key, n = 1) {
  const s = p.status[key];
  s.cnt = Math.max(0, s.cnt - n);
  if (s.cnt === 0) s.pot = 0;
}

function cureAll(p) {
  for (const k of ['burn', 'bleed', 'tremor', 'rupture', 'sinking', 'fragile']) p.status[k] = { pot: 0, cnt: 0 };
}

function decayStatus(p) {
  for (const k of DECAY_AT_TURN_END) if (has(p, k)) useCount(p, k);
}

function statusHTML(p) {
  return Object.entries(p.status)
    .filter(([, v]) => v.cnt > 0)
    .map(([k, v]) => {
      const kw = KEYWORDS[k];
      const val = kw.countOnly ? v.cnt : `${v.pot}<small>/${v.cnt}</small>`;
      return `<span class="st ${kw.debuff ? 'bad' : 'good'}" title="${kw.name} ${kw.countOnly ? v.cnt : `위력 ${v.pot} / 횟수 ${v.cnt}`} — ${kw.desc}">${kw.icon}${val}</span>`;
    })
    .join('');
}

// ---------------- 키워드 발동 ----------------
// 턴 시작: 화상
function triggerTurnStart(p) {
  if (has(p, 'burn')) {
    const s = p.status.burn;
    damage(p, s.pot, `🔥 화상 (${s.pot})`);
    useCount(p, 'burn');
  }
}

// 공격할 때: 출혈
function triggerOnAttack(p) {
  if (has(p, 'bleed')) {
    const s = p.status.bleed;
    damage(p, s.pot, `🩸 출혈 (${s.pot})`);
    useCount(p, 'bleed');
  }
}

// 피격될 때: 파열, 침잠
function triggerOnHit(target, attacker) {
  if (!target.alive) return;
  if (has(target, 'rupture')) {
    const s = target.status.rupture;
    damage(target, s.pot, `💥 파열 (${s.pot})`, attacker);
    useCount(target, 'rupture');
  }
  if (target.alive && has(target, 'sinking')) {
    const s = target.status.sinking;
    if (target.sp <= RULES.minSp) damage(target, s.pot, `🌊 침잠 — 정신력이 바닥나 피해 (${s.pot})`, attacker);
    else {
      log(`${pname(target)} 🌊 침잠 — 정신력 -${s.pot}`);
      changeSp(target, -s.pot);
    }
    useCount(target, 'sinking');
  }
}

// 치명타 판정: 호흡
function rollCrit(attacker, dmg) {
  if (!has(attacker, 'poise')) return dmg;
  const s = attacker.status.poise;
  if (Math.random() < Math.min(1, s.pot * 0.05)) {
    useCount(attacker, 'poise');
    const crit = Math.floor(dmg * 1.2);
    log(`${pname(attacker)} 🌬 <b>치명타!</b> ${dmg} → ${crit}`);
    floatText(attacker, '치명타!', 'sp');
    return crit;
  }
  return dmg;
}

function tremorBurst(target) {
  if (!has(target, 'tremor')) return;
  const s = target.status.tremor;
  log(`${pname(target)} 〰 <b>진동 폭발!</b> 흐트러짐 피해 ${s.pot}`);
  staggerDamage(target, s.pot);
}

// ---------------- 카드 효과 ----------------
//  when  : use(사용 시) | hit(적중 시) | heads(앞면 적중 시)
//  target: enemy | self
const EFFECT_DEFS = {
  burn:        { label: '화상 부여',  pot: true, cnt: true },
  bleed:       { label: '출혈 부여',  pot: true, cnt: true },
  tremor:      { label: '진동 부여',  pot: true, cnt: true },
  rupture:     { label: '파열 부여',  pot: true, cnt: true },
  sinking:     { label: '침잠 부여',  pot: true, cnt: true },
  poise:       { label: '호흡 부여',  pot: true, cnt: true },
  charge:      { label: '충전 부여',  cnt: true },
  fragile:     { label: '취약 부여',  cnt: true },
  stun:        { label: '기절 부여' },
  tremorBurst: { label: '진동 폭발' },
  stagger:     { label: '흐트러짐 피해', pot: true },
  dmg:         { label: '고정 피해',  pot: true },
  heal:        { label: 'HP 회복',    pot: true },
  sp:          { label: '정신력 증감', pot: true, signed: true },
  won:         { label: '돈 획득',    pot: true },
  draw:        { label: '카드 뽑기',  pot: true },
  cure:        { label: '상태 이상 해제' },
  kwBurst:     { label: '키워드 폭발 (그 위력만큼 피해)', kwSel: 'burst' },
  breakArmor:  { label: '방어구 1장 파괴' },
  stealWon:    { label: '돈 빼앗기', pot: true },
  // ---- 코인 전용: 코인을 던지기 전에 적용 (preRoll) ----
  chargeBoost: { label: '충전 소모 → 위력 증가', pot: true, cnt: true, coinOnly: true, preRoll: true, potLabel: '증가 위력', cntLabel: '소모 충전' },
  pwrOneSided: { label: '일방 공격이면 위력 증가', pot: true, coinOnly: true, preRoll: true, potLabel: '증가 위력' },
  pwrClash:    { label: '합 중이면 위력 증가', pot: true, coinOnly: true, preRoll: true, potLabel: '증가 위력' },
  pwrIfKw:     { label: '대상에게 키워드가 있으면 위력 증가', pot: true, kwSel: 'any', coinOnly: true, preRoll: true, potLabel: '증가 위력' },
  pwrLowHp:    { label: '내 HP 절반 이하면 위력 증가', pot: true, coinOnly: true, preRoll: true, potLabel: '증가 위력' },
  pwrHighSp:   { label: '내 정신력이 기준 이상이면 위력 증가', pot: true, cnt: true, coinOnly: true, preRoll: true, potLabel: '증가 위력', cntLabel: '정신력 기준' },
  reuse:       { label: '코인 재사용 (앞면이면 다시 던짐)', cnt: true, coinOnly: true, preRoll: true, cntLabel: '최대 횟수' },
};

// 키워드를 고르는 효과의 선택지
const KW_SEL = {
  any: ['burn', 'bleed', 'tremor', 'rupture', 'sinking', 'fragile', 'staggered'],
  burst: ['bleed', 'burn', 'rupture', 'sinking', 'tremor'],
};
const kwName = (k) => (KEYWORDS[k] ? KEYWORDS[k].icon + KEYWORDS[k].name : k);

const WHEN_TEXT = { use: '사용 시', hit: '적중 시', heads: '앞면 적중 시' };
const WHEN_TEXT_ARMOR = { use: '수비 시', hit: '수비 성공 시', heads: '앞면일 때' };

function effectText(e, armor = false) {
  const d = EFFECT_DEFS[e.key];
  if (!d) return '';
  const who = e.target === 'self' ? '자신' : '대상';
  const when = (armor ? WHEN_TEXT_ARMOR : WHEN_TEXT)[e.when] || '';
  if (d.preRoll) {
    const pot = e.pot || 0;
    const body = {
      chargeBoost: `충전 ${e.cnt || 0} 소모 → 이 코인 위력 +${pot}`,
      pwrOneSided: `일방 공격이면 이 코인 위력 +${pot}`,
      pwrClash: `합 중이면 이 코인 위력 +${pot}`,
      pwrIfKw: `${armor ? '공격자' : '대상'}에게 ${kwName(e.kw)}이(가) 있으면 이 코인 위력 +${pot}`,
      pwrLowHp: `내 HP가 절반 이하면 이 코인 위력 +${pot}`,
      pwrHighSp: `내 정신력이 ${e.cnt || 0} 이상이면 이 코인 위력 +${pot}`,
      reuse: `앞면이면 이 코인을 다시 던짐 (최대 ${e.cnt || 1}회)`,
    }[e.key];
    return `[던지기 전] ${body}`;
  }
  let body;
  if (KEYWORDS[e.key] && !KEYWORDS[e.key].countOnly) body = `${who}에게 ${KEYWORDS[e.key].name} ${e.pot || 0}/${e.cnt || 0}`;
  else if (e.key === 'charge' || e.key === 'fragile') body = `${who}에게 ${KEYWORDS[e.key].name} ${e.cnt || 1}`;
  else if (e.key === 'stun') body = `${who} 기절`;
  else if (e.key === 'tremorBurst') body = `${who}에게 진동 폭발`;
  else if (e.key === 'stagger') body = `${who}에게 흐트러짐 피해 ${e.pot || 0}`;
  else if (e.key === 'dmg') body = `${who}에게 ${e.pot || 0} 고정 피해`;
  else if (e.key === 'heal') body = `${who} HP +${e.pot || 0}`;
  else if (e.key === 'sp') body = `${who} 정신력 ${(e.pot || 0) >= 0 ? '+' : ''}${e.pot || 0}`;
  else if (e.key === 'won') body = `${who} +${e.pot || 0}안`;
  else if (e.key === 'draw') body = `${who} 카드 ${e.pot || 0}장`;
  else if (e.key === 'cure') body = `${who} 상태 이상 해제`;
  else if (e.key === 'kwBurst') body = `${who}의 ${kwName(e.kw)} 폭발 (위력만큼 ${e.kw === 'tremor' ? '흐트러짐 ' : ''}피해, 횟수 -1)`;
  else if (e.key === 'breakArmor') body = `${who}의 방어구 1장 파괴`;
  else if (e.key === 'stealWon') body = `${who}의 돈 ${e.pot || 0}안 빼앗기`;
  return `[${when}] ${body}`;
}

function applyEffect(e, src, enemy) {
  const t = e.target === 'self' ? src : enemy;
  if (!t || !t.alive || (EFFECT_DEFS[e.key] && EFFECT_DEFS[e.key].preRoll)) return;
  if (KEYWORDS[e.key]) {
    if (e.key === 'stun') { addStatus(t, 'stun', 0, 1); floatText(t, '기절', 'dmg'); }
    else if (KEYWORDS[e.key].hidden) return;
    else addStatus(t, e.key, e.pot || 0, e.cnt || 0);
    return;
  }
  switch (e.key) {
    case 'tremorBurst': tremorBurst(t); break;
    case 'stagger': log(`${pname(t)} 흐트러짐 피해 ${e.pot || 0}`); staggerDamage(t, e.pot || 0); break;
    case 'dmg': damage(t, e.pot || 0, '고정 피해', src); break;
    case 'heal': { const got = heal(t, e.pot || 0); if (got) log(`${pname(t)} HP ${got} 회복`); break; }
    case 'sp': changeSp(t, e.pot || 0); break;
    case 'won': gainWon(t, e.pot || 0); break;
    case 'draw': drawCards(t, e.pot || 0); break;
    case 'cure': cureAll(t); floatText(t, '정화', 'heal'); break;
    case 'kwBurst': {
      const k = e.kw;
      if (!KEYWORDS[k] || !has(t, k)) break;
      const pot = t.status[k].pot;
      if (k === 'tremor') { log(`${pname(t)} 〰 진동 폭발! 흐트러짐 피해 ${pot}`); staggerDamage(t, pot); }
      else damage(t, pot, `${kwName(k)} 폭발`, src);
      useCount(t, k);
      break;
    }
    case 'breakArmor': {
      const armors = t.hand.filter((c) => c && c.type === 'armor');
      if (!armors.length) break;
      const c = pick(armors);
      discardCard(t, c);
      log(`🛡 ${pname(t)}의 ${cname(c)}이(가) 부서졌습니다`);
      toastTo(t, `「${c.name}」이(가) 부서졌습니다!`, 'bad');
      break;
    }
    case 'stealWon': {
      if (t === src) break;
      const n = Math.min(t.won, e.pot || 0);
      if (!n) break;
      t.won -= n;
      gainWon(src, n);
      log(`${pname(src)} 이(가) ${pname(t)}의 돈 ${n}안을 빼앗았습니다`);
      break;
    }
    default: break;
  }
}

function applyEffects(list, src, enemy) {
  for (const e of list || []) applyEffect(e, src, enemy);
}
