// ============================================================
//  캐릭터 — 코드로 그리는 2D 캐릭터(SVG), 꾸미기 화면, 합 연출
//  외형(look)은 정해진 선택지와 #rrggbb 색만 허용 → 그대로 SVG에 넣어도 안전
// ============================================================
'use strict';

const LOOK_KEY = 'af_look';
const LOOK_OPTIONS = {
  hair:   [['short', '짧은 머리'], ['bob', '단발'], ['long', '긴 머리'], ['spiky', '삐죽 머리'], ['ponytail', '포니테일'], ['bald', '민머리']],
  eyes:   [['normal', '기본'], ['sharp', '날카로운'], ['closed', '감은 눈'], ['glow', '빛나는 눈']],
  outfit: [['suit', '정장'], ['coat', '롱코트'], ['hoodie', '후드'], ['armor', '갑옷'], ['uniform', '제복']],
  acc:    [['none', '없음'], ['tie', '넥타이'], ['scarf', '목도리'], ['glasses', '안경'], ['mask', '마스크'], ['hat', '중절모'], ['horns', '뿔']],
};
const LOOK_COLORS = {
  skin:        ['#f6d7bd', '#eec29f', '#d9a27a', '#b57a52', '#8a5638', '#e8e2f2'],
  hairColor:   ['#2b2530', '#5a3a28', '#a8743a', '#e3c27a', '#d8d8de', '#b8323a', '#3a5fb0', '#6a3fa0'],
  eyeColor:    ['#3b2a1f', '#2c4f8f', '#3f7a4a', '#a8323a', '#c99a2a', '#7a3fb0'],
  outfitColor: ['#2c3440', '#1d1d24', '#6b2a2a', '#2f4a3a', '#3a3f6b', '#7a5a2a', '#d8d2c4', '#5a2a5a'],
  accColor:    ['#c0392b', '#d9a54a', '#2a6fd1', '#1f8a5b', '#e8e2d6', '#1d1820', '#a03ad1'],
};
const LOOK_LABEL = { skin: '피부', hairColor: '머리 색', eyeColor: '눈 색', outfitColor: '옷 색', accColor: '장신구 색', hair: '머리 모양', eyes: '눈', outfit: '옷', acc: '장신구' };

const HEX_RE = /^#[0-9a-f]{6}$/i;
const optOk = (k, v) => LOOK_OPTIONS[k].some(([id]) => id === v);

function normalizeLook(l) {
  if (!l || typeof l !== 'object') return null;
  const out = {};
  for (const k of Object.keys(LOOK_COLORS)) out[k] = HEX_RE.test(l[k] || '') ? l[k].toLowerCase() : LOOK_COLORS[k][0];
  for (const k of Object.keys(LOOK_OPTIONS)) out[k] = optOk(k, l[k]) ? l[k] : LOOK_OPTIONS[k][0][0];
  return out;
}

// 이름을 씨앗으로 한 무작위 외형 (CPU용 — 같은 이름은 같은 모습)
function randomLook(seed = '') {
  let h = 2166136261;
  for (const ch of String(seed) + Math.random().toString().slice(0, seed ? 0 : 6)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const r = (n) => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return Math.abs(h) % n; };
  const look = {};
  for (const k of Object.keys(LOOK_COLORS)) look[k] = LOOK_COLORS[k][r(LOOK_COLORS[k].length)];
  for (const k of Object.keys(LOOK_OPTIONS)) look[k] = LOOK_OPTIONS[k][r(LOOK_OPTIONS[k].length)][0];
  return look;
}

function getLook() {
  try { return normalizeLook(JSON.parse(localStorage.getItem(LOOK_KEY) || 'null')) || randomLook('me'); }
  catch { return randomLook('me'); }
}
function saveLook(l) { try { localStorage.setItem(LOOK_KEY, JSON.stringify(l)); } catch { /* 무시 */ } }

// 색 밝기 조절 (amt: -1 ~ 1)
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// ------------------------------------------------------------
//  캐릭터 그리기 (viewBox 0 0 120 160, 정면, 오른손에 장비)
//  opts.gear: blade | orb | shield | null,  opts.gearColor
// ------------------------------------------------------------
function charSVG(lookIn, opts = {}) {
  const L = normalizeLook(lookIn) || randomLook('x');
  const O = L.outfitColor, OD = shade(O, -0.35), OL = shade(O, 0.18), S = L.skin, SD = shade(S, -0.15);
  const H = L.hairColor, HD = shade(H, -0.25), A = L.accColor, E = L.eyeColor;
  const line = '#1d1820';
  const pants = L.outfit === 'coat' ? shade(O, -0.5) : shade(O, -0.45);
  const parts = [];

  // 그림자
  parts.push('<ellipse cx="60" cy="152" rx="30" ry="5" fill="#000" opacity=".22"/>');
  // 뒷머리 / 후드
  if (L.outfit === 'hoodie') parts.push(`<ellipse cx="60" cy="60" rx="33" ry="30" fill="${OD}"/>`);
  if (L.hair === 'bob') parts.push(`<path d="M34,50 Q31,84 44,82 L76,82 Q89,84 86,50 Z" fill="${HD}"/>`);
  if (L.hair === 'long') parts.push(`<path d="M34,46 Q27,106 44,110 L76,110 Q93,106 86,46 Z" fill="${HD}"/>`);
  if (L.hair === 'ponytail') parts.push(`<path d="M80,38 Q106,46 98,90 Q92,72 82,60 Z" fill="${HD}"/>`);
  // 뒷팔
  parts.push(`<g class="arm-back"><rect x="31" y="80" width="10" height="30" rx="5" fill="${OD}"/><circle cx="36" cy="112" r="5" fill="${SD}"/></g>`);
  // 다리
  parts.push(`<rect x="47" y="112" width="10" height="34" rx="3" fill="${pants}"/><rect x="63" y="112" width="10" height="34" rx="3" fill="${pants}"/>
    <ellipse cx="51" cy="148" rx="8" ry="4" fill="${line}"/><ellipse cx="69" cy="148" rx="8" ry="4" fill="${line}"/>`);
  // 몸통 (옷)
  const torso = 'M40,80 Q60,73 80,80 L78,118 L42,118 Z';
  switch (L.outfit) {
    case 'coat':
      parts.push(`<path d="M37,80 Q60,72 83,80 L86,138 L34,138 Z" fill="${O}"/>
        <path d="M60,84 L60,138" stroke="${OD}" stroke-width="2"/>
        <path d="M48,78 L60,98 L72,78" fill="none" stroke="${OL}" stroke-width="4"/>
        <rect x="38" y="110" width="44" height="5" fill="${OD}"/>
        <circle cx="64" cy="100" r="1.8" fill="${OL}"/><circle cx="64" cy="122" r="1.8" fill="${OL}"/>`);
      break;
    case 'hoodie':
      parts.push(`<path d="${torso}" fill="${O}"/>
        <rect x="47" y="100" width="26" height="12" rx="4" fill="${OD}"/>
        <path d="M55,80 L54,94 M65,80 L66,94" stroke="#f4f1ea" stroke-width="1.5"/>`);
      break;
    case 'armor':
      parts.push(`<path d="${torso}" fill="${OD}"/>
        <path d="M45,82 Q60,77 75,82 L72,104 Q60,110 48,104 Z" fill="${OL}" stroke="${line}" stroke-width="1"/>
        <path d="M60,84 L60,104" stroke="${O}" stroke-width="1.5"/>
        <circle cx="40" cy="83" r="9" fill="${OL}" stroke="${line}" stroke-width="1"/><circle cx="80" cy="83" r="9" fill="${OL}" stroke="${line}" stroke-width="1"/>
        <rect x="42" y="110" width="36" height="6" fill="${shade(O, -0.55)}"/>`);
      break;
    case 'uniform':
      parts.push(`<path d="${torso}" fill="${O}"/>
        <rect x="51" y="73" width="18" height="8" rx="2" fill="${OD}"/>
        <rect x="38" y="78" width="10" height="4" rx="1" fill="#d9a54a"/><rect x="72" y="78" width="10" height="4" rx="1" fill="#d9a54a"/>
        <circle cx="60" cy="88" r="1.8" fill="#d9a54a"/><circle cx="60" cy="96" r="1.8" fill="#d9a54a"/><circle cx="60" cy="104" r="1.8" fill="#d9a54a"/>
        <rect x="42" y="109" width="36" height="5" fill="${line}"/><rect x="57" y="108" width="6" height="7" fill="#d9a54a"/>`);
      break;
    default: // suit
      parts.push(`<path d="${torso}" fill="${O}"/>
        <path d="M53,78 L60,98 L67,78 Z" fill="#f4f1ea"/>
        <path d="M51,79 L58,102 M69,79 L62,102" stroke="${OD}" stroke-width="2.5"/>
        <circle cx="60" cy="108" r="1.6" fill="${OD}"/>`);
  }
  // 목 장신구
  if (L.acc === 'tie') parts.push(`<path d="M58,80 L62,80 L63.5,85 L61.5,99 L58.5,99 L56.5,85 Z" fill="${A}" stroke="${line}" stroke-width=".6"/>`);
  if (L.acc === 'scarf') parts.push(`<rect x="45" y="71" width="30" height="9" rx="4.5" fill="${A}"/><path d="M68,77 L74,100 L66,98 L63,78 Z" fill="${shade(A, -0.15)}"/>`);
  // 머리
  parts.push(`<rect x="55" y="68" width="10" height="10" fill="${SD}"/>
    <circle cx="36.5" cy="53" r="4" fill="${SD}"/><circle cx="83.5" cy="53" r="4" fill="${SD}"/>
    <circle cx="60" cy="50" r="24" fill="${S}"/>`);
  // 눈
  switch (L.eyes) {
    case 'sharp':
      parts.push(`<path d="M46,53 L56,51.5 L55,56.5 Z M74,53 L64,51.5 L65,56.5 Z" fill="${E}"/>
        <path d="M45,48 L56,50 M75,48 L64,50" stroke="${line}" stroke-width="1.8" stroke-linecap="round"/>`);
      break;
    case 'closed':
      parts.push(`<path d="M47,55 Q51,58.5 55,55 M65,55 Q69,58.5 73,55" fill="none" stroke="${line}" stroke-width="1.8" stroke-linecap="round"/>`);
      break;
    case 'glow':
      parts.push(`<ellipse cx="51" cy="54" rx="3.4" ry="4.4" fill="${A}" class="eye-glow"/><ellipse cx="69" cy="54" rx="3.4" ry="4.4" fill="${A}" class="eye-glow"/>
        <circle cx="51" cy="54" r="1.4" fill="#fff"/><circle cx="69" cy="54" r="1.4" fill="#fff"/>`);
      break;
    default:
      parts.push(`<ellipse cx="51" cy="54" rx="3" ry="4.2" fill="${E}"/><ellipse cx="69" cy="54" rx="3" ry="4.2" fill="${E}"/>
        <circle cx="52" cy="52.5" r="1.1" fill="#fff"/><circle cx="70" cy="52.5" r="1.1" fill="#fff"/>`);
  }
  if (L.acc !== 'mask') parts.push(`<path d="M56,64 Q60,66.5 64,64" fill="none" stroke="${line}" stroke-width="1.4" stroke-linecap="round"/>`);
  // 앞머리
  switch (L.hair) {
    case 'spiky':
      parts.push(`<path d="M34,52 L29,34 L42,37 L43,21 L54,31 L60,15 L66,31 L77,21 L78,37 L91,34 L86,52 Q80,39 60,39 Q40,39 34,52 Z" fill="${H}"/>`);
      break;
    case 'bob':
      parts.push(`<path d="M35,54 Q33,24 60,23 Q87,24 85,54 Q82,40 72,42 L60,35 L48,42 Q38,40 35,54 Z" fill="${H}"/>`);
      break;
    case 'bald':
      parts.push(`<path d="M44,32 Q52,28 58,30" fill="none" stroke="#fff" stroke-width="2" opacity=".35" stroke-linecap="round"/>`);
      break;
    default: // short, long, ponytail
      parts.push(`<path d="M36,51 Q35,24 60,24 Q85,24 84,51 Q79,38 67,40 Q61,33 52,40 Q42,39 36,51 Z" fill="${H}"/>`);
  }
  // 얼굴 장신구
  if (L.acc === 'glasses') parts.push(`<g fill="none" stroke="${line}" stroke-width="1.6"><circle cx="51" cy="54" r="6"/><circle cx="69" cy="54" r="6"/><path d="M57,54 L63,54 M45,53 L38,51 M75,53 L82,51"/></g>`);
  if (L.acc === 'mask') parts.push(`<path d="M39,58 Q60,54 81,58 Q79,74 60,76 Q41,74 39,58 Z" fill="${A}" stroke="${line}" stroke-width=".8"/><path d="M44,64 L76,64" stroke="${shade(A, -0.25)}" stroke-width="1"/>`);
  if (L.acc === 'hat') parts.push(`<ellipse cx="60" cy="31" rx="31" ry="5.5" fill="${A}" stroke="${line}" stroke-width=".8"/>
    <path d="M42,31 Q43,11 60,11 Q77,11 78,31 Z" fill="${A}" stroke="${line}" stroke-width=".8"/><rect x="42.5" y="24" width="35" height="4" fill="${shade(A, -0.4)}"/>`);
  if (L.acc === 'horns') parts.push(`<path d="M44,32 Q36,18 42,10 Q44,22 50,28 Z M76,32 Q84,18 78,10 Q76,22 70,28 Z" fill="${A}" stroke="${line}" stroke-width=".8"/>`);
  // 앞팔 + 장비
  let gear = '';
  const gc = HEX_RE.test(opts.gearColor || '') ? opts.gearColor : '#c9c9c9';
  if (opts.gear === 'blade') {
    gear = `<g transform="translate(84 110) rotate(-38)"><rect x="-2.5" y="-50" width="5" height="46" rx="1" fill="${gc}" stroke="${line}" stroke-width=".8"/>
      <path d="M-2.5,-50 L0,-56 L2.5,-50 Z" fill="${gc}" stroke="${line}" stroke-width=".8"/>
      <rect x="-8" y="-5" width="16" height="4" rx="1" fill="#6b5a3a"/><rect x="-2" y="-1" width="4" height="9" fill="#3a2a1f"/></g>`;
  } else if (opts.gear === 'orb') {
    gear = `<circle cx="88" cy="106" r="10" fill="${gc}" opacity=".35" class="orb-glow"/><circle cx="88" cy="106" r="6" fill="${gc}" stroke="#fff" stroke-width="1"/>`;
  } else if (opts.gear === 'shield') {
    gear = `<path d="M74,84 L96,79 L96,108 Q95,122 85,128 Q75,122 74,108 Z" fill="${gc}" stroke="${line}" stroke-width="1.2"/>
      <path d="M85,86 L85,122 M77,100 L94,98" stroke="${shade(gc, -0.35)}" stroke-width="1.5"/>`;
  }
  parts.push(`<g class="arm-front"><rect x="79" y="80" width="10" height="28" rx="5" fill="${O}"/><circle cx="84" cy="110" r="5" fill="${S}"/>${gear}</g>`);

  const vb = opts.bust ? '24 8 72 72' : '0 0 120 160';
  return `<svg class="char-svg${opts.bust ? ' bust' : ''}" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${parts.join('')}</svg>`;
}

const portraitSVG = (look) => charSVG(look, { bust: true });

// ------------------------------------------------------------
//  합 연출 — 방장과 참가자 모두 같은 데이터로 각자 재생
//  d = { aId, dId, mode: clash|open|nullify, result: atk|def|tie|open|nullify,
//        aBase, dBase, aCoins:[{h,p,r}], dCoins, pa, pd, aCards:[ref], dCards:[ref], gear, attr, stag, spd }
// ------------------------------------------------------------
// 연출 시간표 (호스트와 참가자가 같은 값으로 계산)
const CL_T = { intro: 560, round: 680, hit: 320, tail: 1050 };

// 이긴 쪽이 남은 코인으로 때리는 계획 { side, base, coins } (없으면 null)
function strikePlan(d) {
  if (d.mode === 'open') return { side: 'a', base: d.aBase, coins: d.aCoins };
  if (d.mode === 'clash' && d.strike && d.strike.s !== 't') return { side: d.strike.s, base: d.strike.s === 'a' ? d.aBase : d.dBase, coins: d.strike.coins };
  return null;
}

function clashTimes(d) {
  const t = { roundsEnd: 0, strikeAt: 0, hits: [], tc: 0, end: 0 };
  const plan = strikePlan(d);
  if (d.mode === 'clash') {
    t.roundsEnd = CL_T.intro + d.rounds.length * CL_T.round;
    if (!plan) { t.end = t.roundsEnd + 1100; return t; }
    t.strikeAt = t.roundsEnd + 420;
  } else if (d.mode === 'open') {
    t.strikeAt = CL_T.intro;
  } else {
    t.tc = 380 + Math.max(d.aCoins.length, d.dCoins.length) * 200 + 150;
    t.end = t.tc + 1350;
    return t;
  }
  const n = Math.max(1, plan.coins.length);
  for (let i = 0; i < n; i++) t.hits.push(t.strikeAt + 330 + i * CL_T.hit);
  t.end = t.hits[n - 1] + CL_T.tail;
  return t;
}
const clashDuration = (d) => clashTimes(d).end;

function validateClash(d) {
  if (!d || typeof d !== 'object') return null;
  const coins = (arr) => (Array.isArray(arr) ? arr.slice(0, 16).map((c) => ({ h: c && c.h ? 1 : 0, p: Math.max(0, Math.min(99, +(c && c.p) || 0)), r: Math.max(0, Math.min(9, +(c && c.r) || 0)) })) : []);
  const refs = (arr) => (Array.isArray(arr) ? arr.slice(0, 8).map((r) => ({ uid: +r.uid || 0, id: String(r.id || '') })) : []);
  const num = (x) => Math.max(-999, Math.min(999, Math.round(+x || 0)));
  const side = (x) => (['a', 'd', 't'].includes(x) ? x : 't');
  const out = {
    aId: +d.aId, dId: +d.dId,
    mode: ['clash', 'open', 'nullify', 'guard', 'evade', 'counter'].includes(d.mode) ? d.mode : 'open',
    result: ['atk', 'def', 'tie', 'open', 'nullify'].includes(d.result) ? d.result : 'open',
    dmg: Math.max(0, Math.min(999, +d.dmg || 0)), dmgTo: d.dmgTo === 'a' ? 'a' : d.dmgTo === 'd' ? 'd' : '',
    aBase: num(d.aBase), dBase: num(d.dBase), pa: num(d.pa), pd: num(d.pd),
    aCoins: coins(d.aCoins), dCoins: coins(d.dCoins), aCards: refs(d.aCards), dCards: refs(d.dCards),
    gear: d.gear === 'orb' ? 'orb' : 'blade', attr: ATTR[d.attr] ? d.attr : 'phys', stag: d.stag ? 1 : 0,
    spd: Math.max(0.05, Math.min(2, +d.spd || 1)),
    rounds: Array.isArray(d.rounds) ? d.rounds.slice(0, 12).map((r) => ({ a: coins(r && r.a), d: coins(r && r.d), pa: num(r && r.pa), pd: num(r && r.pd), w: side(r && r.w) })) : [],
    strike: d.strike && typeof d.strike === 'object' ? { s: side(d.strike.s), coins: coins(d.strike.coins) } : null,
  };
  out.aN = Math.max(0, Math.min(16, Number.isFinite(+d.aN) && d.aN !== undefined ? +d.aN : out.aCoins.length));
  out.dN = Math.max(0, Math.min(16, Number.isFinite(+d.dN) && d.dN !== undefined ? +d.dN : out.dCoins.length));
  return out;
}

// 연출 방식: full(전체 화면) | inline(무대 안)
function cineMode() {
  try { return localStorage.getItem('af_cine') === 'inline' ? 'inline' : 'full'; } catch { return 'full'; }
}
function setCineMode(m) { try { localStorage.setItem('af_cine', m); } catch { /* 무시 */ } }

// 키워드 아이콘 줄 (캐릭터 발밑)
function statusIcons(p, withSp = true) {
  const out = [];
  for (const [k, v] of Object.entries(p.status || {})) {
    if (!v || v.cnt <= 0 || !KEYWORDS[k]) continue;
    const kw = KEYWORDS[k];
    out.push(`<span class="si ${kw.debuff ? 'bad' : 'good'}">${kw.icon}<b>${kw.countOnly ? v.cnt : v.pot}</b>${kw.countOnly ? '' : `<small>${v.cnt}</small>`}</span>`);
  }
  if (withSp) out.push(`<span class="si sp">🧠<b>${p.sp}</b></span>`);
  return out.join('');
}

// 정신력 색: -45 빨강 → 0 회색 → 45 하늘색
function spColor(sp) {
  const t = Math.max(-1, Math.min(1, sp / RULES.maxSp));
  const gray = [150, 150, 158], to = t < 0 ? [255, 59, 48] : [111, 211, 255], k = Math.abs(t);
  return '#' + gray.map((v, i) => Math.round(v + (to[i] - v) * k).toString(16).padStart(2, '0')).join('');
}

// 타원 호 (y가 아래로 커지는 좌표, 각도 a0에서 a1로 줄어드는 방향 = 앞쪽을 지나감)
function ellArc(cx, cy, rx, ry, a0, a1) {
  const pt = (a) => [cx + rx * Math.cos((a * Math.PI) / 180), cy + ry * Math.sin((a * Math.PI) / 180)];
  const [x0, y0] = pt(a0), [x1, y1] = pt(a1);
  return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${rx} ${ry} 0 ${Math.abs(a0 - a1) > 180 ? 1 : 0} 0 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}
const RING_HP = ellArc(100, 26, 92, 24, 205, -25);
const RING_STG = ellArc(100, 26, 75, 16, 198, -18);

// 발 밑 잘린 원형 게이지: 바깥 호 = HP (10칸), 그 위(안쪽) 얇은 호 = 흐트러짐 게이지
function ringSVG(p, stag) {
  const team = p.id === G.meId ? 'me' : 'foe';
  const hp = Math.max(0, Math.min(100, (p.hp / RULES.maxHp) * 100));
  const sg = stag ? 100 : Math.max(0, Math.min(100, (p.stg / RULES.staggerMax) * 100));
  return `<svg class="ff-ring t-${team}" viewBox="0 0 200 56" preserveAspectRatio="none" aria-hidden="true">
    <path class="trk" d="${RING_HP}" pathLength="100"/>
    <path class="hp" d="${RING_HP}" pathLength="100" stroke-dasharray="${hp.toFixed(1)} 100"/>
    <path class="seg" d="${RING_HP}" pathLength="100"/>
    <path class="trk s" d="${RING_STG}" pathLength="100"/>
    <path class="stg${stag ? ' broken' : ''}" d="${RING_STG}" pathLength="100" stroke-dasharray="${sg.toFixed(1)} 100"/>
  </svg>`;
}
const setRingHp = (svg, hp) => { const el = svg && $('.hp', svg); if (el) el.setAttribute('stroke-dasharray', `${Math.max(0, Math.min(100, (hp / RULES.maxHp) * 100)).toFixed(1)} 100`); };

// 캐릭터 발 밑 글자: 빨간 HP 숫자 + 정신력(색으로 상태 표시) / 키워드 아이콘 / 이름
function footHTML(p, opts = {}) {
  const team = p.id === G.meId ? 'me' : 'foe';
  const staggered = opts.stag || (p.status && p.status.staggered && p.status.staggered.cnt > 0);
  return `<div class="f-foot t-${team}">
    <div class="ff-row">
      <b class="ff-hpn">${p.hp}</b>
      <span class="ff-sp" style="--spc:${spColor(p.sp)}" title="정신력 ${p.sp}"><b>${p.sp}</b></span>
    </div>
    <div class="f-status">${statusIcons(p, false)}</div>
    <div class="ff-name">${p.name}${staggered ? ' <span class="stag">💢 흐트러짐</span>' : ''}</div>
  </div>`;
}

// 충돌 순간의 금색 지그재그 선
function burstSVG(seed) {
  const rng = seededRng(seed);
  const lines = [];
  for (let i = 0; i < 14; i++) {
    let x = rng() * 100, y = rng() * 56;
    const pts = [[x, y]];
    for (let k = 0; k < 6; k++) {
      x += (rng() < 0.5 ? -1 : 1) * (4 + rng() * 10);
      y += (rng() < 0.5 ? -1 : 1) * (3 + rng() * 8);
      pts.push([x, y]);
    }
    lines.push(`<polyline points="${pts.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ')}" style="animation-delay:${(rng() * 0.12).toFixed(2)}s"/>`);
  }
  for (let i = 0; i < 8; i++) {
    const x = (rng() * 100).toFixed(1);
    lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="56" class="vline" style="animation-delay:${(rng() * 0.15).toFixed(2)}s"/>`);
  }
  return `<svg class="burst" viewBox="0 0 100 56" preserveAspectRatio="none">${lines.join('')}</svg>`;
}

// 사선 레터박스 + 금빛 섬광 테두리
const LETTERBOX = `<svg class="lbox" viewBox="0 0 100 56" preserveAspectRatio="none">
  <defs><linearGradient id="lbGold" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#fff3c9" stop-opacity="0"/><stop offset=".25" stop-color="#ffe7a8"/><stop offset=".6" stop-color="#e0a84a"/><stop offset="1" stop-color="#fff3c9" stop-opacity=".2"/>
  </linearGradient></defs>
  <polygon points="72,0 100,0 100,15" class="lb-fill"/>
  <polygon points="0,36 0,56 34,56" class="lb-fill"/>
  <polyline points="70,-1 101,16" class="lb-gold"/><polyline points="76,-1 101,12" class="lb-gold thin"/>
  <polyline points="-1,35 35,57" class="lb-gold"/><polyline points="-1,40 28,57" class="lb-gold thin"/>
</svg>`;

let STREET_CACHE = '';
const streetSVG = () => (STREET_CACHE || (STREET_CACHE = buildBackstreet()));

// 합 연출 (림버스식)
//  두 캐릭터가 가운데로 다가와 머리 위에 스킬 띠(위력 육각 + 이름 + 코인)를 띄우고,
//  합을 할 때마다 코인을 다시 던져 부딪힘 → 진 쪽 코인이 하나씩 깨짐 → 이긴 쪽이 남은 코인으로 연타
const POSES = ['engage', 'clinch', 'knock', 'strike', 'dash', 'hurt', 'recoil', 'lunge', 'guard', 'evade'];
function renderClash(d) {
  if (!d) return;
  const A = G.players.find((p) => p.id === d.aId), D = G.players.find((p) => p.id === d.dId);
  if (!A || !D) return;
  const full = cineMode() === 'full';
  const box = full ? $('#cine') : $('#stage');
  if (!box) return;
  const token = String(Date.now() + Math.random());
  box.dataset.token = token;
  const live = () => box.dataset.token === token;
  const T = (ms, fn) => setTimeout(() => { if (live()) fn(); }, ms * d.spd);
  const tm = clashTimes(d), plan = strikePlan(d);
  const attrColor = ATTR[d.attr].color;
  const aCards = d.aCards.map(resolveCard).filter(Boolean), dCards = d.dCards.map(resolveCard).filter(Boolean);
  const armorColor = dCards[0] && ATTR[dCards[0].attr] ? ATTR[dCards[0].attr].color : '#9aa4b2';
  const GEAR = { open: null, evade: null, clash: 'blade', counter: 'blade', guard: 'shield', nullify: 'shield' };
  const dGear = GEAR[d.mode];
  const contested = ['clash', 'guard', 'evade', 'counter'].includes(d.mode);
  const modeName = { clash: '합', guard: '가드', evade: '회피', counter: '반격', nullify: '무효화', open: '일방 공격' }[d.mode];
  const skillName = aCards.map((c) => c.name).join(' + ') || '공격';
  const lines = aCards.length ? describeCard(aCards[0]).lines.slice(0, 6) : [];
  const total = d.stag && d.dmgTo === 'd' ? Math.ceil(d.dmg * RULES.staggerMult) : d.dmg;
  const order = G.players.filter((p) => p.alive || p.id === d.dId);
  const sinCol = (c) => (c && SINS[sinOf(c)] ? SINS[sinOf(c)].color : '#9aa4b2');
  const sinVars = (hex) => `--sin:${hex};--sin2:${shade(hex, -0.55)};--sin3:${shade(hex, 0.45)}`;
  const isClash = d.mode === 'clash';
  const aN = isClash ? d.aN : d.aCoins.length, dN = isClash ? d.dN : d.dCoins.length;
  const pips = (n) => '<i></i>'.repeat(n);
  const team = (p) => (p.id === G.meId ? 'me' : 'foe');

  const skA = `<div class="f-skill sk-a" style="${sinVars(sinCol(aCards[0]))}">
      <div class="sk-pips">${pips(aN)}</div>
      <div class="sk-row"><div class="sk-badge"><small class="sk-bonus"></small><b class="sk-pow">${d.aBase}</b></div><div class="sk-name">${skillName}</div></div>
    </div>`;
  const skD = d.mode === 'open' ? '' : `<div class="f-skill sk-d k-${d.mode}" style="${sinVars(sinCol(dCards[0]))}">
      <div class="sk-pips">${pips(dN)}</div>
      <div class="sk-row"><div class="sk-name">${isClash ? '' : `<small class="sk-kind">${modeName}</small>`}${dCards.map((c) => c.name).join(' + ') || '방어'}</div><div class="sk-badge def"><small class="sk-bonus"></small><b class="sk-pow">${contested ? d.dBase : '∞'}</b></div></div>
    </div>`;

  box.classList.remove('pop');
  box.innerHTML = `
    <div class="arena ${full ? 'big' : ''} m-${d.mode}" style="--spd:${d.spd};--attr:${attrColor}">
      <div class="cam">
        <div class="street">${streetSVG()}<div class="rain"></div></div>
        <div class="floor"></div>
        <div class="fighter left enter">
          ${skA}
          <div class="f-fig"><div class="ff-base t-${team(A)}"></div>${ringSVG(A, false)}<div class="f-body">${charSVG(A.look, { gear: d.gear, gearColor: attrColor })}</div><div class="f-hit"></div></div>
          ${footHTML(A)}
        </div>
        <div class="fighter right enter">
          ${skD}
          <div class="f-fig"><div class="ff-base t-${team(D)}"></div>${ringSVG(D, d.stag)}<div class="f-body flip">${charSVG(D.look, { gear: dGear, gearColor: armorColor })}</div><div class="f-hit"></div></div>
          ${footHTML(D, { stag: d.stag })}
        </div>
        <div class="impact"></div>
        <div class="clash-count"><small>합</small><b>0</b></div>
      </div>
      ${burstSVG(Math.floor(Math.random() * 1e6))}
      ${LETTERBOX}
      <div class="sk-lines sk-info">${lines.map((l, i) => `<div class="sk-line" style="animation-delay:${(0.25 + i * 0.08) * d.spd}s">${l}</div>`).join('')}</div>
      <div class="who"><b>${A.name}</b> ▶ <b>${D.name}</b> · ${modeName}</div>
      <div class="total ${total ? '' : 'none'}"><small>TOTAL</small><b>0</b></div>
      <div class="chain">${order.map((p) => `<span class="ch ${p.id === d.aId ? 'atk' : p.id === d.dId ? 'def' : ''} ${p.alive ? '' : 'dead'}">${portraitSVG(p.look)}</span>`).join('<i class="link"></i>')}</div>
      <div class="clash-banner"></div>
      ${full ? '<div class="skip">눌러서 넘기기</div>' : ''}
    </div>`;
  if (full) {
    box.classList.add('show');
    box.onclick = () => { box.dataset.token = ''; box.classList.remove('show'); };
    const st = $('#stage');
    if (st) st.innerHTML = `<div class="stage-idle">⚔ ${A.name} ▶ ${D.name}</div>`;
  }
  const ar = $('.arena', box);
  const fa = $('.fighter.left', ar), fd = $('.fighter.right', ar);
  const sA = $('.sk-a', ar), sD = $('.sk-d', ar);
  const powA = $('.sk-pow', sA), powD = sD ? $('.sk-pow', sD) : null;
  const banner = $('.clash-banner', ar), impact = $('.impact', ar), cam = $('.cam', ar);
  const totalEl = $('.total b', ar), cnt = $('.clash-count', ar);

  // 도우미
  const re = (el, cls) => { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
  const pose = (el, ...cls) => { el.classList.remove(...POSES); if (cls.length) el.classList.add(...cls); };
  const bump = (el) => el && re(el, 'bump');
  const shake = () => { re(box, 'shake'); T(300, () => box.classList.remove('shake')); };
  const win = (sk) => sk && sk.classList.add('win');
  const lose = (sk) => sk && sk.classList.add('lose');
  const say = (t) => { banner.textContent = t; re(banner, 'show'); };
  const pipCls = (c) => (c ? (c.h ? 'h' + (c.r ? ' r' : '') : 't') : '');
  // 남은 코인(left개)은 앞/뒷면 표시, 그 뒤는 깨진 코인
  const setPips = (sk, coins, left) => { if (sk) $$('.sk-pips i', sk).forEach((pip, i) => { pip.className = i < left ? pipCls(coins[i]) : 'x'; }); };
  const breakPip = (sk, i) => { const pip = sk && $$('.sk-pips i', sk)[i]; if (pip) pip.className = 'x brk'; };
  // HP 줄이기 + TOTAL 올리기 (from → to, 표시용 누적 피해)
  const hpEl = d.dmgTo === 'a' ? fa : fd, hpWho = d.dmgTo === 'a' ? A : D;
  const countTo = (from, to) => {
    if (!total || to === from) return;
    const t0 = performance.now(), dur = 240 * d.spd;
    const step = (t) => {
      if (!live()) return;
      const k = Math.min(1, (t - t0) / dur);
      const v = Math.round(from + (to - from) * k);
      totalEl.textContent = v;
      if (d.dmgTo) {
        const hpLeft = Math.max(0, hpWho.hp - v);
        const num = $('.ff-hpn', hpEl);
        setRingHp($('.ff-ring', hpEl), hpLeft);
        if (num) { num.textContent = hpLeft; re(num, 'hit'); }
      }
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  requestAnimationFrame(() => requestAnimationFrame(() => {
    fa.classList.remove('enter'); fd.classList.remove('enter');
    if (isClash) { fa.classList.add('engage'); fd.classList.add('engage'); }
    ar.classList.add('on');
  }));

  // ---- 합: 여러 번 부딪히며 코인을 깨뜨림 ----
  if (isClash) {
    let aLeft = d.aN, dLeft = d.dN;
    d.rounds.forEach((r, i) => {
      const t0 = CL_T.intro + i * CL_T.round;
      T(t0, () => {
        sA.classList.remove('rwin'); sD.classList.remove('rwin');
        setPips(sA, r.a, aLeft); setPips(sD, r.d, dLeft);
        powA.textContent = r.pa; powD.textContent = r.pd; bump(powA); bump(powD);
        $('b', cnt).textContent = i + 1; re(cnt, 'show');
        pose(fa, 'clinch'); pose(fd, 'clinch');
        re(fa, 'swing'); re(fd, 'swing');
      });
      T(t0 + 250, () => {
        re(impact, 'show'); shake();
        if (i === 0) ar.classList.add('burst-on');
        if (r.w === 'a') { if (dLeft > 0) breakPip(sD, --dLeft); pose(fd, 'knock'); pose(fa, 'engage'); sA.classList.add('rwin'); re(fd.querySelector('.f-fig'), 'flash'); }
        else if (r.w === 'd') { if (aLeft > 0) breakPip(sA, --aLeft); pose(fa, 'knock'); pose(fd, 'engage'); sD.classList.add('rwin'); re(fa.querySelector('.f-fig'), 'flash'); }
        else { pose(fa, 'knock'); pose(fd, 'knock'); }
      });
      T(t0 + 520, () => { pose(fa, 'engage'); pose(fd, 'engage'); fa.classList.remove('swing'); fd.classList.remove('swing'); });
    });
    T(tm.roundsEnd, () => {
      cnt.classList.remove('show');
      if (!plan) { pose(fa, 'recoil'); pose(fd, 'recoil'); say('상쇄'); return; }
      const W = plan.side === 'a' ? A : D;
      win(plan.side === 'a' ? sA : sD); lose(plan.side === 'a' ? sD : sA);
      say(`${W.name} 합 승리`);
    });
  }

  // ---- 이긴 쪽(일방 공격이면 공격자)이 남은 코인으로 연타 ----
  if (plan) {
    const wEl = plan.side === 'a' ? fa : fd, lEl = plan.side === 'a' ? fd : fa;
    const wSk = plan.side === 'a' ? sA : sD, wPow = plan.side === 'a' ? powA : powD;
    const coins = plan.coins;
    const incs = coins.length ? coins.map((c, k) => (k ? 0 : plan.base) + (c.h ? c.p : 0)) : [plan.base];
    const sumInc = incs.reduce((s, x) => s + x, 0) || 1;
    let cum = 0, shown = 0, pow = plan.base;
    T(tm.strikeAt, () => {
      setPips(wSk, [], coins.length);
      if (wPow) { wPow.textContent = plan.base; bump(wPow); }
      banner.classList.remove('show');
      pose(wEl, isClash ? 'strike' : 'dash');
      cam.classList.add('zoom');
    });
    incs.forEach((inc, k) => T(tm.hits[k], () => {
      const c = coins[k];
      if (c) {
        const pip = wSk && $$('.sk-pips i', wSk)[k];
        if (pip) pip.className = pipCls(c);
        if (c.h) pow += c.p;
      }
      if (wPow) { wPow.textContent = pow; bump(wPow); }
      re(wEl, 'swing');
      re($('.f-hit', lEl), 'show');
      re(lEl.querySelector('.f-fig'), 'flash');
      pose(lEl, k === incs.length - 1 ? 'hurt' : 'knock');
      if (k === incs.length - 1) re(lEl, 'hurtanim');
      ar.classList.add('burst-on');
      shake();
      cum += inc;
      const to = Math.round((total * cum) / sumInc);
      countTo(shown, to); shown = to;
    }));
    if (!isClash) T(tm.hits[tm.hits.length - 1] + 200, () => say(d.stag ? '흐트러짐 — 피해 ×1.5' : '일방 공격'));
  }

  // ---- 수비 스킬: 한 번 던져 비교 ----
  if (!isClash && d.mode !== 'open') {
    const n = Math.max(d.aCoins.length, d.dCoins.length);
    let sumA = d.aBase, sumD = d.dBase;
    const flip = (sk, c, i) => { const pip = $$('.sk-pips i', sk)[i]; if (pip) pip.className = pipCls(c); };
    for (let i = 0; i < n; i++) {
      T(380 + i * 200, () => {
        const ca = d.aCoins[i], cd = d.dCoins[i];
        if (ca) { flip(sA, ca, i); if (ca.h) { sumA += ca.p; powA.textContent = sumA; bump(powA); } }
        if (cd && sD && contested) { flip(sD, cd, i); if (cd.h) { sumD += cd.p; powD.textContent = sumD; bump(powD); } }
      });
    }
    const tc = tm.tc;
    T(tc - 60, () => {
      powA.textContent = d.pa;
      if (powD && contested) powD.textContent = d.pd;
      const bonusA = d.pa - d.aBase - d.aCoins.reduce((s, c) => s + (c.h ? c.p : 0), 0);
      if (bonusA > 0) $('.sk-bonus', sA).textContent = '+' + bonusA;
    });
    const hurtD = () => { pose(fd, 'hurt'); re(fd, 'hurtanim'); re($('.f-hit', fd), 'show'); };
    const hurtA = () => { pose(fa, 'hurt'); re(fa, 'hurtanim'); re($('.f-hit', fa), 'show'); };
    const hit = (extra = '') => {
      impact.classList.add('show', ...extra.split(' ').filter(Boolean));
      ar.classList.add('burst-on');
      cam.classList.add('zoom');
      shake();
    };
    if (d.mode === 'guard') {
      T(tc, () => { pose(fa, 'dash'); pose(fd, 'guard'); });
      T(tc + 280, () => { re(fa, 'swing'); hit(d.result === 'def' ? 'on-def block' : 'on-def'); });
      T(tc + 540, () => {
        if (d.result === 'def') { win(sD); lose(sA); pose(fa, 'recoil'); say('가드!'); }
        else { win(sA); hurtD(); say(`가드 — ${d.pd} 경감`); countTo(0, total); }
      });
    } else if (d.mode === 'evade') {
      T(tc, () => pose(fa, 'dash'));
      T(tc + 280, () => {
        re(fa, 'swing');
        if (d.result === 'def') pose(fd, 'evade');
        else { hit('on-def'); hurtD(); }
      });
      T(tc + 540, () => {
        if (d.result === 'def') { win(sD); lose(sA); say('회피!'); }
        else { win(sA); lose(sD); say('회피 실패'); countTo(0, total); }
      });
    } else if (d.mode === 'counter') {
      T(tc, () => pose(fa, 'dash'));
      T(tc + 280, () => { re(fa, 'swing'); re(fd, 'swing'); hit('on-def block'); });
      T(tc + 520, () => {
        if (d.result === 'def') { win(sD); lose(sA); hurtA(); say('반격!'); }
        else { win(sA); lose(sD); hurtD(); say('반격 실패'); }
        countTo(0, total);
      });
    } else {
      T(tc, () => { pose(fa, 'dash'); pose(fd, 'guard'); });
      T(tc + 280, () => { re(fa, 'swing'); hit('on-def block'); });
      T(tc + 520, () => { pose(fa, 'recoil'); say('무효'); });
    }
  }
  if (full) T(tm.end - 120, () => box.classList.remove('show'));
}

// ------------------------------------------------------------
//  꾸미기 화면
// ------------------------------------------------------------
const CE = { look: null, pose: '' };

function openCharEdit() {
  CE.look = getLook();
  CE.pose = '';
  for (const id of ['#title', '#multi', '#workshop', '#game']) $(id).classList.remove('show');
  $('#charedit').classList.add('show');
  renderCharEdit();
}

function renderCharEdit() {
  const L = CE.look;
  const name = cleanText(($('#in-name').value || '').trim(), 10) || '관리자';
  const gear = CE.pose === 'guard' ? 'shield' : CE.pose === 'cast' ? 'orb' : 'blade';
  $('#ce-preview').innerHTML = `
    <div class="ce-stage">
      <div class="fighter ce-fighter ${CE.pose}">
        <div class="f-body">${charSVG(L, { gear, gearColor: gear === 'shield' ? '#7fa3d6' : gear === 'orb' ? '#b98cff' : '#d0d4dc' })}</div>
        <div class="f-name">${name}</div>
      </div>
    </div>
    <div class="ce-poses">
      ${[['', '대기'], ['swing', '공격'], ['guard', '방어'], ['cast', 'E.G.O'], ['hurt', '피격']].map(([k, l]) => `<button class="btn small ${CE.pose === k ? 'on' : ''}" data-pose="${k}">${l}</button>`).join('')}
    </div>
    <div class="ce-portrait">${portraitSVG(L)}<span class="muted small">패널 초상화</span></div>`;

  const optRow = (k) => `<div class="ce-row"><span class="ce-label">${LOOK_LABEL[k]}</span><div class="ce-opts">
    ${LOOK_OPTIONS[k].map(([id, label]) => `<button class="btn small ${L[k] === id ? 'on' : ''}" data-opt="${k}" data-val="${id}">${label}</button>`).join('')}</div></div>`;
  const colorRow = (k) => `<div class="ce-row"><span class="ce-label">${LOOK_LABEL[k]}</span><div class="ce-opts">
    ${LOOK_COLORS[k].map((c) => `<button class="swatch ${L[k] === c ? 'on' : ''}" style="background:${c}" data-color="${k}" data-val="${c}" title="${c}"></button>`).join('')}
    <label class="swatch custom" title="직접 고르기"><input type="color" data-pick="${k}" value="${L[k]}">🎨</label></div></div>`;
  $('#ce-form').innerHTML = [
    optRow('hair'), colorRow('hairColor'), optRow('eyes'), colorRow('eyeColor'), colorRow('skin'),
    optRow('outfit'), colorRow('outfitColor'), optRow('acc'), colorRow('accColor'),
  ].join('');
}

function initCharEdit() {
  $('#btn-char').onclick = openCharEdit;
  $('#ce-back').onclick = () => { $('#charedit').classList.remove('show'); showTitle(); };
  $('#ce-random').onclick = () => { CE.look = randomLook(); renderCharEdit(); };
  $('#ce-save').onclick = () => {
    saveLook(CE.look);
    toast('캐릭터를 저장했습니다');
    if (typeof netLookChanged === 'function') netLookChanged();
  };
  $('#ce-preview').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pose]');
    if (b) { CE.pose = b.dataset.pose; renderCharEdit(); }
  });
  $('#ce-form').addEventListener('click', (e) => {
    const b = e.target.closest('[data-opt],[data-color]');
    if (!b) return;
    const k = b.dataset.opt || b.dataset.color;
    CE.look[k] = b.dataset.val;
    CE.look = normalizeLook(CE.look);
    renderCharEdit();
  });
  $('#ce-form').addEventListener('input', (e) => {
    const k = e.target.dataset.pick;
    if (!k) return;
    CE.look[k] = e.target.value;
    CE.look = normalizeLook(CE.look);
    $('#ce-preview .f-body').innerHTML = charSVG(CE.look, { gear: 'blade', gearColor: '#d0d4dc' });
  });
  $('#ce-form').addEventListener('change', (e) => { if (e.target.dataset.pick) renderCharEdit(); });
}

document.addEventListener('DOMContentLoaded', initCharEdit);
