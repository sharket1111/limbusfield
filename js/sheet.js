// ============================================================
//  캐릭터 스탯(카드팩마다) · 공격 유형과 내성 · 나만의 키워드
//  - 스탯은 기본값에서 올리면 포인트를 쓰고, 내리면 포인트를 돌려받습니다.
//    합계가 RULES.statBudget 이하여야 대전 규격입니다.
//  - 나만의 키워드는 기본 키워드(화상·출혈·진동·파열·침잠·호흡)의 동작을 그대로 하고,
//    발동할 때마다 직접 넣은 특수 효과가 함께 발동합니다. 만들 때 팩 코스트를 씁니다.
// ============================================================
'use strict';

// ---------------- 공격 유형 / 내성 ----------------
const DTYPES = {
  slash:  { name: '참격', icon: '🗡' },
  pierce: { name: '관통', icon: '➶' },
  blunt:  { name: '타격', icon: '🔨' },
};
// [배율, 이름, 포인트]  — 내성이 좋을수록 포인트를 쓰고, 약할수록 돌려받음
const RES_LEVELS = [[0.5, '내성', 4], [0.75, '견딤', 2], [1, '보통', 0], [1.5, '약점', -2], [2, '치명', -4]];
const resInfo = (v) => RES_LEVELS.find(([m]) => m === v) || RES_LEVELS[2];

// 기본 카드의 공격 유형
const DTYPE_BY_ID = {
  w_cutter: 'slash', w_notice: 'slash', w_hammer: 'blunt', w_lantern: 'blunt', w_contract: 'pierce', w_mask: 'pierce',
  w_clock: 'pierce', w_censer: 'blunt', w_saw: 'slash', w_scythe: 'slash', w_shredder: 'slash', w_needle: 'pierce',
  w_vine: 'slash', w_plate: 'blunt', w_tray: 'blunt', w_gavel: 'blunt', w_baton: 'blunt', w_dagger: 'pierce',
  w_shears: 'slash', w_dun: 'pierce', w_crowbar: 'blunt', w_bell: 'blunt', w_spear: 'pierce', w_furnace: 'blunt',
};
function dtypeOf(c) {
  if (!c) return 'blunt';
  if (DTYPES[c.dtype]) return c.dtype;
  const base = String(c.id || '').replace(/^p\d+_/, '');
  return DTYPE_BY_ID[base] || (c.type === 'ego' ? 'pierce' : 'blunt');
}
const resOf = (p, dtype) => (p && p.res && DTYPES[dtype] ? p.res[dtype] || 1 : 1);

// ---------------- 캐릭터 스탯 ----------------
// [최소, 최대, 한 칸, 기본] — 한 칸에 1포인트
const SHEET_RANGE = { hp: [60, 150, 5, 100], sp: [-20, 25, 5, 0], stg: [20, 70, 5, 40] };
const SHEET_LABEL = { hp: '체력', sp: '시작 정신력', stg: '흐트러짐 상한' };
const PASSIVE_ON = { turnStart: '턴 시작 시', hit: '공격 적중 시', hurt: '피격 시', clashWin: '합 승리 시', kill: '적 처치 시' };
const PASSIVE_MULT = { turnStart: 1.4, hit: 1, hurt: 0.9, clashWin: 0.7, kill: 0.5 };

function defaultSheet() {
  return { hp: 100, sp: 0, stg: 40, res: { slash: 1, pierce: 1, blunt: 1 }, passives: [] };
}

function normalizeSheet(s) {
  const out = defaultSheet();
  if (!s || typeof s !== 'object') return out;
  for (const [k, [lo, hi, step]] of Object.entries(SHEET_RANGE)) {
    const v = Math.round((+s[k] || 0) / step) * step;
    out[k] = Number.isFinite(+s[k]) ? Math.max(lo, Math.min(hi, v)) : out[k];
  }
  for (const d of Object.keys(DTYPES)) {
    const v = s.res && +s.res[d];
    out.res[d] = RES_LEVELS.some(([m]) => m === v) ? v : 1;
  }
  out.passives = (Array.isArray(s.passives) ? s.passives : []).slice(0, RULES.maxPassives).map((ps) => {
    if (!ps || !PASSIVE_ON[ps.on]) return null;
    const e = normalizeEffect({ ...(ps.e || {}), when: 'use' });
    if (!e || EFFECT_DEFS[e.key].preRoll) return null;
    return { on: ps.on, e };
  }).filter(Boolean);
  return out;
}

function passiveCost(ps) {
  const v = effectValue({ ...ps.e, when: 'use' }) * (PASSIVE_MULT[ps.on] || 1);
  return v <= 0 ? 0 : Math.max(1, Math.round(v / 2));
}

function sheetPoints(sh) {
  let pts = 0;
  for (const [k, [, , step, def]] of Object.entries(SHEET_RANGE)) pts += (sh[k] - def) / step;
  for (const d of Object.keys(DTYPES)) pts += resInfo(sh.res[d])[2];
  for (const ps of sh.passives) pts += passiveCost(ps);
  return Math.round(pts);
}

function sheetSummary(sh) {
  const points = sheetPoints(sh);
  return { points, budget: RULES.statBudget, valid: points <= RULES.statBudget };
}

function passiveText(ps) {
  return `[${PASSIVE_ON[ps.on]}] ${effectText(ps.e).replace(/^\[[^\]]*\]\s*/, '')}`;
}

// 경기 시작 시 플레이어에게 스탯 적용
function applySheet(p, sheetIn) {
  const sh = normalizeSheet(sheetIn);
  p.maxHp = sh.hp;
  p.hp = sh.hp;
  p.sp = sh.sp;
  p.stgMax = sh.stg;
  p.stg = sh.stg;
  p.res = { ...sh.res };
  p.passives = sh.passives;
}

// 패시브 발동
function firePassives(p, on, enemy = null) {
  if (!p || !p.alive || !p.passives || !p.passives.length) return;
  for (const ps of p.passives) {
    if (ps.on !== on) continue;
    let foe = enemy;
    if (!foe && ps.e.target === 'enemy' && on === 'turnStart') {
      const opp = others(p);
      foe = opp.length ? pick(opp) : null;
    }
    if (ps.e.target === 'enemy' && (!foe || !foe.alive)) continue;
    log(`${pname(p)} <span class="passive">✦ 패시브</span> ${passiveText(ps)}`);
    applyEffect(ps.e, p, foe);
  }
}

// ---------------- 나만의 키워드 ----------------
const KW_BASES = ['burn', 'bleed', 'tremor', 'rupture', 'sinking', 'poise'];
const KW_ID_RE = /^(p\d+_)?k_[a-z0-9_]+$/i;

function normalizeKeyword(k) {
  if (!k || typeof k !== 'object') return null;
  return {
    id: /^k_[a-z0-9_]+$/i.test(k.id || '') ? k.id : newId('k'),
    name: cleanText(k.name, 8) || '새 키워드',
    base: KW_BASES.includes(k.base) ? k.base : 'burn',
    hue: Math.max(0, Math.min(359, Math.round(+k.hue || 0))),
    fx: (Array.isArray(k.fx) ? k.fx : []).slice(0, 3).map((e) => {
      const n = normalizeEffect({ ...(e || {}), when: 'use' });
      return n && !EFFECT_DEFS[n.key].preRoll ? n : null;
    }).filter(Boolean),
  };
}

// 키워드를 만드는 데 드는 팩 코스트
function keywordCost(k) {
  const fx = (k.fx || []).reduce((s, e) => s + Math.max(0, effectValue({ ...e, when: 'use' })), 0);
  return 4 + Math.round(fx * 0.8);
}

const kwIconHTML = (base, hue) => `<i class="kwi kw-${base}"${hue ? ` style="filter:hue-rotate(${hue}deg)"` : ''}></i>`;

// KEYWORDS에 등록 (id는 그대로 — 경기에서는 앞에 플레이어 번호를 붙여 등록)
function registerKeyword(k, id = k.id) {
  const b = KEYWORDS[k.base];
  if (!b || !KW_ID_RE.test(id)) return;
  KEYWORDS[id] = {
    name: k.name, icon: kwIconHTML(k.base, k.hue), emoji: b.emoji, debuff: b.debuff, base: k.base, custom: true,
    fx: k.fx, desc: `${b.name} 기반 — ${b.desc}${k.fx.length ? ` · 발동 시: ${k.fx.map((e) => effectText(e).replace(/^\[[^\]]*\]\s*/, '')).join(', ')}` : ''}`,
  };
}
function clearCustomKeywords(previewOnly = false) {
  for (const id of Object.keys(KEYWORDS)) if (KEYWORDS[id].custom && (!previewOnly || KEYWORDS[id].preview)) delete KEYWORDS[id];
}
// 공방에서 편집 중인 팩의 키워드를 이름 그대로 미리 등록 (설명·코스트 계산용)
function previewKeywords(list) {
  clearCustomKeywords(true);
  for (const k of list || []) { registerKeyword(k); if (KEYWORDS[k.id]) KEYWORDS[k.id].preview = true; }
}

// 기본 키워드 계열: 기본 키워드 + 그것을 바탕으로 만든 나만의 키워드
const kwFamily = (base) => Object.keys(KEYWORDS).filter((k) => k === base || KEYWORDS[k].base === base);

// 나만의 키워드의 특수 효과 발동 (보유자 = 자신, enemy = 관련된 상대)
function kwFire(holder, key, enemy) {
  const kw = KEYWORDS[key];
  if (!kw || !kw.fx || !kw.fx.length || !holder.alive) return;
  log(`${pname(holder)} ${kw.icon} ${kw.name} 특수 효과 발동`);
  for (const e of kw.fx) {
    if (e.target === 'enemy' && (!enemy || !enemy.alive)) continue;
    applyEffect(e, holder, enemy);
  }
}

// 카드·패시브·키워드 효과 안의 나만의 키워드 id에 플레이어 번호 붙이기
function nsEffect(e, ns) {
  if (!e) return e;
  const out = { ...e };
  if (out.kw && /^k_/i.test(out.kw)) out.kw = `${ns}_${out.kw}`;
  return out;
}
function nsCard(c, ns) {
  const out = { ...c, id: `${ns}_${c.id}`, effects: (c.effects || []).map((e) => nsEffect(e, ns)) };
  if (Array.isArray(c.coins)) out.coins = c.coins.map((x) => ({ ...x, fx: (x.fx || []).map((e) => nsEffect(e, ns)) }));
  return out;
}
