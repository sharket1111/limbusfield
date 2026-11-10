// ============================================================
//  CPU 인공지능
// ============================================================
'use strict';

function cpuChooseTarget(p) {
  const opp = others(p);
  if (G.difficulty === 'easy') return pick(opp);
  // 체력이 낮은 상대를 노리되, 가끔은 무작위
  if (Math.random() < 0.25) return pick(opp);
  return [...opp].sort((a, b) => a.hp - b.hp)[0];
}

function scoreAttack(p, cards) {
  const info = buildAttack(cards);
  let s = info.atk;
  if (info.fx.includes('twice')) s *= 1.8;
  if (info.fx.includes('all')) s *= 0.7 * Math.max(1, others(p).length);
  if (info.fx.includes('pierce')) s += 2;
  for (const f of ['bleed', 'burn', 'fragile', 'lifesteal', 'drainmp', 'holy']) if (info.fx.includes(f)) s += 1.5;
  if (info.fx.includes('stun')) s += 3;
  if (cards[0].type === 'miracle') s -= cards[0].mp * 0.4; // MP 아끼기
  return s;
}

async function cpuTurn(p) {
  await sleep(500);

  // 1) 무료 행동: 회복 / 정화 / MP / 드로우
  for (let guard = 0; guard < 5 && p.alive; guard++) {
    const hpLow = p.hp <= (G.difficulty === 'hard' ? 22 : 16);
    const hasBad = p.status.bleed || p.status.burn || p.status.fragile;
    let use = null;
    if (hpLow) {
      use = p.hand.find((c) => c.type === 'item' && c.kind === 'heal')
        || p.hand.find((c) => c.type === 'miracle' && c.kind === 'heal' && p.mp >= c.mp);
    }
    if (!use && hasBad) use = p.hand.find((c) => c.type === 'item' && c.kind === 'cure');
    if (!use && p.mp < 5 && p.hand.some((c) => c.type === 'miracle')) use = p.hand.find((c) => c.type === 'item' && c.kind === 'mp');
    if (!use && p.hand.length <= 5) use = p.hand.find((c) => c.type === 'item' && c.kind === 'draw');
    if (!use && G.difficulty !== 'easy' && p.hp > 20 && Math.random() < 0.3) use = p.hand.find((c) => c.kind === 'gamble');
    if (!use) break;
    await useSupport(p, use, p);
    if (checkEnd()) return;
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
  for (const m of p.hand.filter((c) => c.type === 'miracle' && c.kind === 'attack' && p.mp >= c.mp)) options.push([m]);

  // 3) 방해 기적
  const disrupt = p.hand.filter((c) => c.type === 'miracle' && (c.kind === 'stun' || c.kind === 'steal') && p.mp >= c.mp);

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
    const target = cpuChooseTarget(p);
    await performAttack(p, best, [target]);
    return;
  }

  if (disrupt.length) {
    await useSupport(p, disrupt[0], cpuChooseTarget(p));
    return;
  }

  // 4) 기도
  const n = drawCards(p, 1);
  gainMp(p, 2);
  log(`${pname(p)} 🙏 기도했습니다 (카드 ${n}장, MP +2)`);
  clearStage(`${p.avatar} ${p.name} 🙏 기도`);
  renderAll();
  await sleep(600);
}

function cpuDefend(p, info) {
  if (info.fx.includes('pierce')) return [];
  const usable = p.hand.filter((c) => c.type === 'armor' && armorMatches(c, info.attr));
  if (!usable.length) return [];
  if (G.difficulty === 'easy') return Math.random() < 0.6 ? [pick(usable)] : [];

  const nullify = usable.find((c) => hasFx(c, 'nullify'));
  if (nullify && info.atk >= 9) return [nullify];

  const normal = usable.filter((c) => !hasFx(c, 'nullify')).sort((a, b) => b.def - a.def);
  if (info.atk <= 2 && p.hp > 15) return [];
  const chosen = [];
  let def = 0;
  const mult = p.status.fragile ? 0.5 : 1;
  for (const c of normal) {
    if (def * mult >= info.atk) break;
    chosen.push(c);
    def += c.def;
  }
  // 위험하지 않다면 방어구 1장만 쓰기
  if (G.difficulty === 'normal' && p.hp - info.atk > 20 && chosen.length > 1) return chosen.slice(0, 1);
  return chosen;
}
