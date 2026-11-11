// ============================================================
//  CPU 인공지능
// ============================================================
'use strict';

function cpuChooseTarget(p) {
  const opp = others(p);
  if (G.difficulty === 'easy') return pick(opp);
  // 흐트러진 상대(방어 불가, 피해 1.5배)를 우선
  const broken = opp.filter((q) => has(q, 'staggered'));
  if (broken.length && Math.random() < 0.5) return pick(broken);
  // 체력이 낮은 상대를 노리되, 가끔은 무작위
  if (Math.random() < 0.25) return pick(opp);
  return shuffle([...opp]).sort((a, b) => a.hp - b.hp)[0];
}

// E.G.O를 쓸 때 남겨둘 최소 정신력
function egoFloor() {
  return { easy: RULES.minSp + 1, normal: -20, hard: -10 }[G.difficulty];
}
const cpuCanEgo = (p, c) => canPayEgo(p, c) && p.sp - c.cost >= egoFloor();

function scoreAttack(p, cards) {
  const info = buildAttack(cards);
  let s = info.atk + info.coinMax * headChance(p.sp);
  const fxs = info.effects.concat(...info.coins.map((c) => c.fx || []));
  for (const e of fxs) s += KEYWORDS[e.key] ? ((e.pot || 0) + (e.cnt || 0)) * 0.6 : e.key === 'stun' ? 6 : 2;
  if (info.fx.includes('twice')) s *= 1.8;
  if (info.fx.includes('all')) s = (s - info.atk * (1 - headChance(p.sp))) * 0.7 * Math.max(1, others(p).length);
  else if (info.weight > 1) s *= 1 + 0.75 * (Math.min(info.weight, others(p).length) - 1);
  if (info.fx.includes('pierce')) s += 4;
  for (const f of ['lifesteal', 'drainsp', 'mind', 'holy']) if (info.fx.includes(f)) s += 3;
  if (cards[0].type === 'ego') s -= cards[0].cost * 0.35; // 정신력 아끼기
  return s;
}

async function cpuTurn(p) {
  await sleep(500);

  // 1) 무료 행동: 회복 / 정화 / 정신력 / 돈 / 드로우 / 구매
  for (let guard = 0; guard < 6 && p.alive; guard++) {
    const hpLow = p.hp <= (G.difficulty === 'hard' ? 40 : 30);
    const hasBad = ['bleed', 'burn', 'rupture', 'sinking', 'fragile'].some((k) => has(p, k) && p.status[k].pot + p.status[k].cnt >= 3);
    const card = (pred) => p.hand.find(pred);
    let use = null;
    if (hpLow) use = card((c) => c.type === 'item' && c.kind === 'heal') || card((c) => c.type === 'ego' && c.kind === 'heal' && cpuCanEgo(p, c));
    if (!use && p.sp <= (G.difficulty === 'hard' ? -10 : -20)) use = card((c) => c.type === 'item' && c.kind === 'sp');
    if (!use && hasBad) use = card((c) => c.type === 'item' && c.kind === 'cure');
    // 급하지 않은 도구는 공격 수단이 없을 때만 (도구를 쓰면 턴이 끝남)
    const canAttack = p.hand.some((c) => c.type === 'weapon' || (c.type === 'ego' && c.kind === 'attack' && cpuCanEgo(p, c)));
    if (!use && !canAttack) {
      use = card((c) => c.type === 'item' && c.kind === 'won');
      if (!use && p.hand.length <= 5 && (!isNight() || p.hp > 40)) use = card((c) => c.type === 'item' && c.kind === 'draw');
      if (!use && G.difficulty !== 'easy' && p.hp > 40) use = card((c) => c.kind === 'gamble');
      if (!use) use = card((c) => c.type === 'item' && c.kind === 'custom' && !itemHitsEnemy(c));
    }
    if (use) {
      await useSupport(p, use, p);
      return;   // 어떤 행동이든 턴 종료
    }
    // 환전: 체력이 위험하면 돈·정신력을 HP로
    const ex = card((c) => c.type === 'trade' && c.kind === 'exchange');
    if (ex) {
      const plan = cpuExchangePlan(p);
      if (plan) {
        await tradeExchange(p, ex, plan);
        return;
      }
    }
    break;
  }
  if (!p.alive) return;

  // 2) 공격 후보 만들기
  const weapons = p.hand.filter((c) => c.type === 'weapon');
  const pluses = weapons.filter((c) => c.plus);
  const options = [];
  for (const w of weapons) {
    const extra = G.difficulty === 'easy' ? [] : pluses.filter((x) => x !== w);
    options.push([w, ...extra]);
    if (extra.length) options.push([w]);
  }
  for (const e of p.hand.filter((c) => c.type === 'ego' && c.kind === 'attack' && cpuCanEgo(p, c))) options.push([e]);

  // 3) 방해 E.G.O
  const disrupt = p.hand.filter((c) => (c.type === 'ego' && (c.kind === 'stun' || c.kind === 'steal') && cpuCanEgo(p, c)) || itemHitsEnemy(c));

  // 거래 후보: 강매(판매 킬 포함) / 매입
  const trade = cpuTradeOption(p);
  const bestAtk = options.length ? Math.max(...options.map((o) => scoreAttack(p, o))) : 0;
  if (trade && (trade.score > bestAtk || (G.difficulty === 'easy' && Math.random() < 0.3))) {
    if (trade.kind === 'sell') await tradeSell(p, trade.card, trade.goods, trade.target);
    else await tradeBuy(p, trade.card, trade.target, async (item) => cpuWantsBuy(p, item));
    return;
  }

  if (options.length) {
    let best;
    if (G.difficulty === 'easy') best = pick(options);
    else best = options.map((o) => [o, scoreAttack(p, o)]).sort((a, b) => b[1] - a[1])[0][0];

    // 보조 무기는 아껴두기도 함 (보통 난이도)
    if (G.difficulty === 'normal' && best.length > 2 && Math.random() < 0.4) best = best.slice(0, 2);

    if (disrupt.length && Math.random() < 0.2) {
      await useSupport(p, disrupt[0], cpuChooseTarget(p));
      return;
    }
    await performAttack(p, best, [cpuChooseTarget(p)]);
    return;
  }

  if (disrupt.length) {
    await useSupport(p, disrupt[0], cpuChooseTarget(p));
    return;
  }

  // 4) 기도
  pray(p);
  if (p.alive) clearStage(`${p.avatar} ${p.name} 🙏 기도`);
  renderAll();
  await sleep(600);
}

// 대응 선택: { mode: none|clash|guard|evade|counter, cards }
// 각 선택지의 "예상 받는 피해 − 예상 주는 피해 + 카드 소모 비용"이 가장 낮은 것을 고름
function cpuDefend(p, info, attacker) {
  const none = { mode: 'none', cards: [] };
  const pierce = info.fx.includes('pierce');
  const usable = (c) => c.type === 'armor' && armorMatches(c, info.attr);
  const weapons = p.hand.filter((c) => c.type === 'weapon');
  const guards = p.hand.filter((c) => usable(c) && defKind(c) === 'guard' && !pierce);
  const evades = p.hand.filter((c) => usable(c) && defKind(c) === 'evade');
  const counters = p.hand.filter((c) => usable(c) && defKind(c) === 'counter');

  const base = clashStats(info.atk, info.coins, attacker.sp, 0, [], p.sp, false);
  if (G.difficulty === 'easy') {
    const opts = [];
    if (guards.length) opts.push({ mode: 'guard', cards: [pick(guards)] });
    if (evades.length) opts.push({ mode: 'evade', cards: [pick(evades)] });
    if (counters.length) opts.push({ mode: 'counter', cards: [pick(counters)] });
    if (weapons.length) opts.push({ mode: 'clash', cards: [pick(weapons)] });
    return opts.length && Math.random() < 0.7 ? pick(opts) : none;
  }
  // 위험 회피 성향: 체력이 낮을수록 받는 피해를 더 무겁게
  const fear = p.hp < 35 ? 1.6 : p.hp < 60 ? 1.2 : 1;
  const cost = (cards) => cards.reduce((s, c) => s + cardUse(c), 0) * (G.difficulty === 'hard' ? 0.25 : 0.35);
  let best = { ...none, score: base.expA * fear };
  if (info.atk + info.coinMax <= 6 && p.hp > 40) return none;   // 약한 공격은 그냥 맞음

  const consider = (mode, cards, taken, dealt) => {
    const score = taken * fear - dealt * 0.8 + cost(cards);
    if (score < best.score) best = { mode, cards, score };
  };

  // 무효화 가드
  const nullify = guards.find((c) => hasFx(c, 'nullify'));
  if (nullify && info.atk >= 16) consider('guard', [nullify], 0, 0);

  // 가드: 방어력이 높은 것부터 하나씩 쌓아 보며 가장 좋은 조합
  const gsorted = guards.filter((c) => !hasFx(c, 'nullify')).sort((a, b) => b.def - a.def);
  const gset = [];
  for (const c of gsorted) {
    gset.push(c);
    const st = clashStats(info.atk, info.coins, attacker.sp, armorDef(p, gset), defenseCoins(gset), p.sp, true);
    consider('guard', [...gset], st.exp, 0);
  }
  // 회피 / 반격
  for (const c of evades) {
    const st = clashStats(info.atk, info.coins, attacker.sp, armorDef(p, [c]), defenseCoins([c]), p.sp, true);
    consider('evade', [c], (1 - st.win - st.tie) * st.expA, 0);
  }
  for (const c of counters) {
    const st = clashStats(info.atk, info.coins, attacker.sp, armorDef(p, [c]), defenseCoins([c]), p.sp, true);
    const ok = st.win + st.tie;
    const pow = armorDef(p, [c]) + defenseCoins([c]).reduce((s, x) => s + x.power * headChance(p.sp), 0);
    consider('counter', [c], (1 - ok) * st.expA, ok * pow);
  }
  // 합: 무기(+보조 무기)
  const pluses = weapons.filter((c) => c.plus);
  for (const w of weapons) {
    const sets = [[w]];
    if (G.difficulty === 'hard') { const extra = pluses.filter((x) => x !== w); if (extra.length) sets.push([w, ...extra]); }
    for (const set of sets) {
      const dinfo = buildAttack(set);
      const st = clashSim(info.atk, info.coins, attacker.sp, dinfo.atk, dinfo.coins, p.sp, 200);
      consider('clash', set, st.exp, st.expD);
    }
  }
  return { mode: best.mode, cards: best.cards };
}

// ------------------------------------------------------------
//  거래 AI
// ------------------------------------------------------------
// 카드의 '쓸모' (낮을수록 팔아치우기 좋음)
function cardUse(c) {
  if (c.type === 'weapon') return c.atk + fxOf(c).length * 3;
  if (c.type === 'armor') return c.def * ({ guard: 0.9, evade: 1, counter: 1.1 }[defKind(c)] || 0.9) + fxOf(c).length * 6;
  if (c.type === 'ego') return 14;
  if (c.type === 'trade') return 8;
  if (c.kind === 'custom') return 8;
  return { heal: (c.power || 0) * 0.8, sp: c.power * 0.6, won: 6, cure: 6, draw: 8, gamble: 6 }[c.kind] || 5;
}

function cpuTradeOption(p) {
  const opp = others(p);
  if (!opp.length) return null;
  let best = null;
  const sellCard = p.hand.find((c) => c.type === 'trade' && c.kind === 'sell');
  if (sellCard) {
    for (const goods of p.hand) {
      if (goods === sellCard || !goods.price) continue;
      for (const t of opp) {
        // 돈과 정신력(양수)으로 못 내는 만큼 HP가 깎임
        const hpHit = Math.max(0, goods.price - t.won - Math.max(0, t.sp));
        const gain = Math.min(goods.price, t.won);
        let score = hpHit * 1.1 + gain * 0.4 - cardUse(goods) * 0.7;
        if (hpHit >= t.hp) score += 100; // 판매 킬
        if (!best || score > best.score) best = { kind: 'sell', card: sellCard, goods, target: t, score };
      }
    }
  }
  const buyCard = p.hand.find((c) => c.type === 'trade' && c.kind === 'buy');
  if (buyCard && p.won >= 4 && p.hand.length < RULES.maxHand) {
    const t = [...opp].sort((a, b) => b.hand.length - a.hand.length)[0];
    const score = t.hand.length ? 4 + Math.min(p.won, 20) * 0.2 : -99;
    if (!best || score > best.score) best = { kind: 'buy', card: buyCard, target: t, score };
  }
  return best && best.score > 2 ? best : null;
}

function cpuWantsBuy(p, item) {
  const price = item.price || 0;
  if (price === 0) return true;          // 공짜(E.G.O 등)는 무조건
  if (price > p.won) return false;
  return cardUse(item) >= price * 0.8 || (G.difficulty === 'hard' && p.won - price >= 10);
}

// 환전 계획: 위험할 때 돈·정신력 일부를 HP로 돌림
function cpuExchangePlan(p) {
  const L = exchangeLimits(p);
  const danger = p.hp <= (G.difficulty === 'hard' ? 35 : 25);
  if (!danger) return null;
  const keepSp = Math.max(L.sp[0], Math.min(p.sp, G.difficulty === 'easy' ? 0 : 10));
  let hp = Math.min(L.hp[1], L.total - keepSp);
  let won = L.total - keepSp - hp;
  if (won > L.won[1]) { hp += won - L.won[1]; won = L.won[1]; }
  if (hp - p.hp < 8) return null;          // 별 차이 없으면 아껴둠
  return { hp, sp: keepSp, won };
}
