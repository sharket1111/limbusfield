// ============================================================
//  카드 코스트 — 카드 스펙으로 자동 계산
//  카드 가치(value)를 계산해 1~12 코스트로 환산합니다.
//  팩 코스트 = Σ(코스트 × 장수). 상한(RULES.packBudget)을 넘으면 대전용으로 쓸 수 없습니다.
// ============================================================
'use strict';

const KW_WEIGHT = { burn: 0.5, bleed: 0.5, rupture: 0.5, sinking: 0.25, tremor: 0.2, poise: 0.25 };

// 효과 하나의 가치 (나에게 이로우면 +, 손해면 -)
function effectValue(e) {
  const toEnemy = e.target !== 'self';
  const pot = e.pot || 0, cnt = e.cnt || 0;
  let v = 0;
  const kw = KEYWORDS[e.key];
  if (kw && !kw.countOnly) {
    v = Math.min(30, pot * Math.max(1, cnt) * KW_WEIGHT[e.key]);
    v = kw.debuff === toEnemy ? v : -v;            // 적에게 디버프 / 나에게 버프면 이득
  } else {
    switch (e.key) {
      case 'charge': v = (toEnemy ? -1 : 1) * cnt * 0.3; break;
      case 'fragile': v = (toEnemy ? 1 : -1) * Math.max(1, cnt) * 2.5; break;
      case 'stun': v = toEnemy ? 10 : -10; break;
      case 'tremorBurst': v = toEnemy ? 5 : -5; break;
      case 'stagger': v = (toEnemy ? 1 : -1) * pot * 0.5; break;
      case 'dmg': v = (toEnemy ? 1 : -1) * pot; break;
      case 'heal': v = (toEnemy ? -1 : 1) * pot * 0.8; break;
      case 'sp': v = (toEnemy ? -1 : 1) * pot * 0.4; break;
      case 'won': v = (toEnemy ? -1 : 1) * pot * 0.3; break;
      case 'draw': v = (toEnemy ? -2 : 4) * pot; break;
      case 'cure': v = toEnemy ? -4 : 4; break;
      case 'chargeBoost': v = pot * 0.4; break;
      case 'pwrOneSided': case 'pwrClash': v = pot * 0.3; break;
      case 'pwrIfKw': case 'pwrHighSp': v = pot * 0.25; break;
      case 'pwrLowHp': v = pot * 0.2; break;
      case 'reuse': v = Math.max(1, cnt) * 1.2; break;
      case 'kwBurst': v = toEnemy ? 4 : -4; break;
      case 'customKw': {
        const ck = KEYWORDS[e.kw];
        const base = ck && ck.base ? ck.base : 'burn';
        const extra = ck && ck.fx ? ck.fx.reduce((s, x) => s + Math.abs(effectValue({ ...x, when: 'use' })), 0) : 0;
        v = Math.min(36, pot * Math.max(1, cnt) * (KW_WEIGHT[base] || 0.4) + Math.max(1, cnt) * extra * 0.5);
        v = (ck ? ck.debuff : true) === toEnemy ? v : -v;
        break;
      }
      case 'breakArmor': v = toEnemy ? 6 : -6; break;
      case 'stealWon': v = toEnemy ? pot * 0.4 : 0; break;
      default: v = 0;
    }
  }
  const when = { use: 1, hit: 0.8, heads: 0.5 }[e.when] || 1;
  return v * when;
}

const coinValue = (coins) => (coins || []).reduce((s, c) => s + c.power * 0.5 + (c.fx || []).reduce((t, e) => t + effectValue(e), 0), 0);
const DEFAULT_COIN_VALUE = () => RULES.coins * RULES.coinPower * 0.5;

function cardValue(c) {
  const fx = fxOf(c);
  const eff = (c.effects || []).reduce((s, e) => s + effectValue(e), 0);
  const coins = Array.isArray(c.coins) ? coinValue(c.coins) : DEFAULT_COIN_VALUE();
  let v = 0;
  if (c.type === 'weapon') {
    v = c.atk + coins + eff;
    if (fx.includes('pierce')) v += 4;
    if (fx.includes('lifesteal')) v += c.atk * 0.25 + 2;
    for (const f of ['drainsp', 'mind']) if (fx.includes(f)) v += 3;
    if (fx.includes('holy')) v += 2;
    if (fx.includes('twice')) v *= 1.6;
    if (fx.includes('all')) v *= 1.6;
    else if (c.weight > 1) v *= 1 + 0.3 * (c.weight - 1);
    if (c.plus) v += 1.5;
  } else if (c.type === 'armor') {
    const extra = Array.isArray(c.coins) ? coinValue(c.coins) : 0;
    const kind = c.kind === 'evade' || c.kind === 'counter' ? c.kind : 'guard';
    v = c.def * { guard: 0.9, evade: 1, counter: 1.15 }[kind] + extra + eff;
    if (c.attr === 'all') v *= 1.3;
    if (fx.includes('reflect')) v += 4;
    if (fx.includes('nullify')) v += 15;
  } else if (c.type === 'ego') {
    if (c.kind === 'attack') {
      v = c.power + coins + eff - (c.cost || 0) * 0.25;
      if (fx.includes('pierce')) v += 4;
      if (fx.includes('all')) v *= 1.6;
      else if (c.weight > 1) v *= 1 + 0.3 * (c.weight - 1);
    } else {
      v = { heal: (c.power || 0) * 0.7, cure: 4, steal: 8, stun: 10 }[c.kind] || 5;
      v -= (c.cost || 0) * 0.15;
    }
  } else if (c.type === 'item') {
    v = c.kind === 'custom' ? eff
      : { heal: (c.power || 0) * 0.8, sp: (c.power || 0) * 0.4, won: (c.power || 0) * 0.3, cure: 4, draw: (c.power || 0) * 4, gamble: 5 }[c.kind] || 3;
  } else if (c.type === 'trade') {
    v = 9;
  }
  return v;
}

function cardCost(c) {
  return Math.max(1, Math.min(12, Math.round(cardValue(c) / 3)));
}

// 팩 요약: 총 코스트, 장수, 대전 가능 여부
// keywords: 팩의 나만의 키워드 — 만드는 데 드는 코스트도 팩 코스트에 포함
function packSummary(cards, keywords = []) {
  const list = cards || [];
  if (keywords.length) previewKeywords(keywords);
  const kwCost = keywords.reduce((s, k) => s + keywordCost(k), 0);
  const cost = list.reduce((s, c) => s + cardCost(c) * (c.count || 1), 0) + kwCost;
  const count = list.reduce((s, c) => s + (c.count || 1), 0);
  const overBudget = cost > RULES.packBudget;
  const tooSmall = count < RULES.packMin;
  return { cost, count, overBudget, tooSmall, valid: !overBudget && !tooSmall };
}
