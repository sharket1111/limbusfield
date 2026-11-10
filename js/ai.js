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
    // 보급 구매: 손패가 적을 때 (밤에는 체력이 충분할 때만)
    if (p.hand.length <= 4 && (!isNight() || p.hp > 45) && buyCard(p)) {
      renderAll();
      await sleep(400);
      if (checkEnd()) return;
      continue;
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
