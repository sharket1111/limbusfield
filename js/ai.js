// ============================================================
//  CPU 인공지능
// ============================================================
'use strict';

function cpuChooseTarget(p) {
  const opp = others(p);
  if (G.difficulty === 'easy') return pick(opp);
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
  let s = info.atk;
  if (info.fx.includes('twice')) s *= 1.8;
  if (info.fx.includes('all')) s *= 0.7 * Math.max(1, others(p).length);
  if (info.fx.includes('pierce')) s += 4;
  for (const f of ['bleed', 'burn', 'fragile', 'lifesteal', 'drainsp', 'mind', 'holy']) if (info.fx.includes(f)) s += 3;
  if (info.fx.includes('stun')) s += 6;
  if (cards[0].type === 'ego') s -= cards[0].cost * 0.35; // 정신력 아끼기
  return s;
}

async function cpuTurn(p) {
  await sleep(500);

  // 1) 무료 행동: 회복 / 정화 / 정신력 / 돈 / 드로우 / 구매
  for (let guard = 0; guard < 6 && p.alive; guard++) {
    const hpLow = p.hp <= (G.difficulty === 'hard' ? 40 : 30);
    const hasBad = p.status.bleed || p.status.burn || p.status.fragile;
    const card = (pred) => p.hand.find(pred);
    let use = null;
    if (hpLow) use = card((c) => c.type === 'item' && c.kind === 'heal') || card((c) => c.type === 'ego' && c.kind === 'heal' && cpuCanEgo(p, c));
    if (!use && p.sp <= (G.difficulty === 'hard' ? -10 : -20)) use = card((c) => c.type === 'item' && c.kind === 'sp');
    if (!use && hasBad) use = card((c) => c.type === 'item' && c.kind === 'cure');
    if (!use) use = card((c) => c.type === 'item' && c.kind === 'won');
    if (!use && p.hand.length <= 5 && (!isNight() || p.hp > 40)) use = card((c) => c.type === 'item' && c.kind === 'draw');
    if (!use && G.difficulty !== 'easy' && p.hp > 40 && Math.random() < 0.3) use = card((c) => c.kind === 'gamble');
    if (use) {
      await useSupport(p, use, p);
      if (checkEnd()) return;
      continue;
    }
    // 환전: 체력이 위험하면 돈·정신력을 HP로
    const ex = card((c) => c.type === 'trade' && c.kind === 'exchange');
    if (ex) {
      const plan = cpuExchangePlan(p);
      if (plan) {
        await tradeExchange(p, ex, plan);
        continue;
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
  const disrupt = p.hand.filter((c) => c.type === 'ego' && (c.kind === 'stun' || c.kind === 'steal') && cpuCanEgo(p, c));

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

// 방어: 낼 방어구 목록을 돌려줌 (내면 무기 vs 방어구 합)
function cpuDefend(p, info, attacker) {
  const usable = p.hand.filter((c) => c.type === 'armor' && armorMatches(c, info.attr));
  if (!usable.length) return [];
  if (G.difficulty === 'easy') return Math.random() < 0.6 ? [pick(usable)] : [];

  const nullify = usable.find((c) => hasFx(c, 'nullify'));
  if (nullify && info.atk >= 16) return [nullify];

  const normal = usable.filter((c) => !hasFx(c, 'nullify')).sort((a, b) => b.def - a.def);
  if (info.atk <= 5 && p.hp > 30) return [];

  // 합 승률이 충분해질 때까지 방어구를 쌓음
  const want = G.difficulty === 'hard' ? 0.7 : 0.55;
  const chosen = [];
  for (const c of normal) {
    chosen.push(c);
    const st = clashStats(info.atk, attacker.sp, armorDef(p, chosen), p.sp, true);
    if (st.win + st.tie >= want) break;
  }
  // 여유가 있으면 방어구를 1장만 쓰기
  if (G.difficulty === 'normal' && p.hp - info.atk > 45 && chosen.length > 1) return chosen.slice(0, 1);
  return chosen;
}

// ------------------------------------------------------------
//  거래 AI
// ------------------------------------------------------------
// 카드의 '쓸모' (낮을수록 팔아치우기 좋음)
function cardUse(c) {
  if (c.type === 'weapon') return c.atk + fxOf(c).length * 3;
  if (c.type === 'armor') return c.def * 0.9 + fxOf(c).length * 6;
  if (c.type === 'ego') return 14;
  if (c.type === 'trade') return 8;
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
