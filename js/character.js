// ============================================================
//  캐릭터 — 코드로 그리는 2D 캐릭터(SVG), 꾸미기 화면, 합 연출
//  외형(look)은 정해진 선택지와 #rrggbb 색만 허용 → 그대로 SVG에 넣어도 안전
// ============================================================
'use strict';

const LOOK_KEY = 'af_look';
const LOOK_OPTIONS = {
  hair:   [['short', '짧은 머리'], ['bob', '단발'], ['long', '긴 머리'], ['spiky', '삐죽 머리'], ['ponytail', '포니테일'], ['twin', '트윈테일'], ['curly', '곱슬'], ['side', '옆 가르마'], ['mohawk', '모히칸'], ['bald', '민머리']],
  brows:  [['normal', '기본'], ['thick', '두꺼운'], ['angry', '치켜뜬'], ['worried', '처진'], ['none', '없음']],
  eyes:   [['normal', '기본'], ['sharp', '날카로운'], ['round', '동그란'], ['tired', '피곤한'], ['closed', '감은 눈'], ['wink', '윙크'], ['glow', '빛나는 눈'], ['odd', '오드아이']],
  mouth:  [['smile', '미소'], ['flat', '무표정'], ['grin', '활짝'], ['frown', '찡그림'], ['open', '벌린 입'], ['fang', '송곳니']],
  mark:   [['none', '없음'], ['blush', '홍조'], ['scar', '흉터'], ['bandage', '반창고'], ['mole', '점'], ['stitch', '꿰맨 자국']],
  outfit: [['suit', '정장'], ['coat', '롱코트'], ['hoodie', '후드'], ['armor', '갑옷'], ['uniform', '제복'], ['jacket', '재킷'], ['robe', '로브'], ['vest', '조끼']],
  head:   [['none', '없음'], ['hat', '중절모'], ['beret', '베레모'], ['cap', '모자'], ['horns', '뿔'], ['halo', '고리'], ['hairpin', '머리핀'], ['headphones', '헤드폰']],
  face:   [['none', '없음'], ['glasses', '안경'], ['sunglasses', '선글라스'], ['mask', '마스크'], ['eyepatch', '안대'], ['goggles', '고글']],
  neck:   [['none', '없음'], ['tie', '넥타이'], ['scarf', '목도리'], ['ribbon', '리본'], ['choker', '초커']],
  back:   [['none', '없음'], ['cape', '망토'], ['wings', '날개'], ['backpack', '가방'], ['tail', '꼬리']],
};
const LOOK_COLORS = {
  skin:        ['#f6d7bd', '#eec29f', '#d9a27a', '#b57a52', '#8a5638', '#e8e2f2'],
  hairColor:   ['#2b2530', '#5a3a28', '#a8743a', '#e3c27a', '#d8d8de', '#b8323a', '#3a5fb0', '#6a3fa0'],
  eyeColor:    ['#3b2a1f', '#2c4f8f', '#3f7a4a', '#a8323a', '#c99a2a', '#7a3fb0'],
  outfitColor: ['#2c3440', '#1d1d24', '#6b2a2a', '#2f4a3a', '#3a3f6b', '#7a5a2a', '#d8d2c4', '#5a2a5a'],
  pantsColor:  ['#1a1d24', '#2c3440', '#3a2a20', '#4a4a52', '#d8d2c4', '#24324a'],
  accColor:    ['#c0392b', '#d9a54a', '#2a6fd1', '#1f8a5b', '#e8e2d6', '#1d1820', '#a03ad1'],
  neckColor:   ['#c0392b', '#d9a54a', '#2a6fd1', '#1f8a5b', '#e8e2d6', '#1d1820', '#a03ad1'],
  backColor:   ['#6b1f1f', '#1d1820', '#2a3f6b', '#d8d2c4', '#5a2a5a', '#2f4a3a'],
};
// 체형 슬라이더 [최소, 최대, 기본]
const LOOK_SLIDERS = { height: [0.9, 1.12, 1], head: [0.85, 1.2, 1], build: [0.85, 1.2, 1] };
const LOOK_LABEL = {
  skin: '피부', hairColor: '머리 색', eyeColor: '눈 색', outfitColor: '옷 색', pantsColor: '바지 색', accColor: '머리·얼굴 장신구 색', neckColor: '목 장신구 색', backColor: '등 장신구 색',
  hair: '머리 모양', brows: '눈썹', eyes: '눈', mouth: '입', mark: '얼굴 표식', outfit: '옷', head: '머리 장신구', face: '얼굴 장신구', neck: '목 장신구', back: '등 장신구',
};
const SLIDER_LABEL = { height: '키', head: '머리 크기', build: '체격' };

const HEX_RE = /^#[0-9a-f]{6}$/i;
const optOk = (k, v) => LOOK_OPTIONS[k].some(([id]) => id === v);
// 예전 저장 형식(장신구 한 칸 acc)을 새 칸으로
const OLD_ACC = { tie: 'neck', scarf: 'neck', glasses: 'face', mask: 'face', hat: 'head', horns: 'head' };

function normalizeLook(l) {
  if (!l || typeof l !== 'object') return null;
  const src = { ...l };
  if (src.acc && OLD_ACC[src.acc] && !src[OLD_ACC[src.acc]]) src[OLD_ACC[src.acc]] = src.acc;
  if (!src.neckColor && HEX_RE.test(src.accColor || '')) src.neckColor = src.accColor;
  const out = {};
  for (const k of Object.keys(LOOK_COLORS)) out[k] = HEX_RE.test(src[k] || '') ? src[k].toLowerCase() : LOOK_COLORS[k][0];
  if (!HEX_RE.test(src.pantsColor || '')) out.pantsColor = shade(out.outfitColor, -0.45);
  for (const k of Object.keys(LOOK_OPTIONS)) out[k] = optOk(k, src[k]) ? src[k] : LOOK_OPTIONS[k][0][0];
  out.sz = {};
  const sz = src.sz && typeof src.sz === 'object' ? src.sz : {};
  for (const [k, [lo, hi, def]] of Object.entries(LOOK_SLIDERS)) {
    const v = +sz[k];
    out.sz[k] = Number.isFinite(v) ? Math.round(Math.max(lo, Math.min(hi, v)) * 100) / 100 : def;
  }
  return out;
}

// 이름을 씨앗으로 한 무작위 외형 (CPU용 — 같은 이름은 같은 모습)
function randomLook(seed = '') {
  let h = 2166136261;
  for (const ch of String(seed) + Math.random().toString().slice(0, seed ? 0 : 6)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const r = (n) => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return Math.abs(h) % n; };
  const look = { sz: {} };
  for (const k of Object.keys(LOOK_COLORS)) look[k] = LOOK_COLORS[k][r(LOOK_COLORS[k].length)];
  for (const k of Object.keys(LOOK_OPTIONS)) {
    const opts = LOOK_OPTIONS[k];
    // 장신구·표식은 절반쯤은 비워 두기
    look[k] = ['mark', 'head', 'face', 'back'].includes(k) && r(2) ? 'none' : opts[r(opts.length)][0];
  }
  for (const [k, [lo, hi]] of Object.entries(LOOK_SLIDERS)) look.sz[k] = Math.round((lo + ((hi - lo) * (25 + r(51))) / 100) * 100) / 100;
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
//  층: 등 장신구 → 뒷머리 → 뒷팔 → 다리 → 몸통·목 장신구 → 머리(얼굴·앞머리·장신구) → 앞팔
//  체형: 키는 다리 길이, 머리 크기는 목을 기준으로, 체격은 몸통 너비
// ------------------------------------------------------------
function charSVG(lookIn, opts = {}) {
  const L = normalizeLook(lookIn) || normalizeLook(randomLook('x'));
  const O = L.outfitColor, OD = shade(O, -0.35), OL = shade(O, 0.18), S = L.skin, SD = shade(S, -0.15);
  const H = L.hairColor, HD = shade(H, -0.25), A = L.accColor, E = L.eyeColor, N = L.neckColor, B = L.backColor, P = L.pantsColor;
  const line = '#1d1820';
  const { height: hgt, head: hs, build: bw } = L.sz;
  const lift = -(hgt - 1) * 34;                       // 다리가 길어지는 만큼 윗몸을 올림
  const HEADT = `translate(60 70) scale(${hs}) translate(-60 -70)`;
  const BODYT = `translate(60 0) scale(${bw} 1) translate(-60 0)`;
  const back = [], hairBack = [], body = [], neck = [], headF = [];

  // ---- 등 장신구 ----
  if (L.back === 'cape') back.push(`<path d="M38,78 Q60,72 82,78 L96,142 Q60,149 24,142 Z" fill="${B}"/><path d="M38,78 L30,140 M82,78 L90,140" stroke="${shade(B, -0.3)}" stroke-width="2"/>`);
  if (L.back === 'wings') back.push(`<g fill="${B}" stroke="${shade(B, -0.35)}" stroke-width="1">
      <path d="M46,88 Q18,56 4,68 Q12,78 6,92 Q20,88 22,102 Q32,94 46,100 Z"/><path d="M74,88 Q102,56 116,68 Q108,78 114,92 Q100,88 98,102 Q88,94 74,100 Z"/></g>`);
  if (L.back === 'backpack') back.push(`<rect x="40" y="74" width="40" height="12" rx="5" fill="${B}"/>`);
  if (L.back === 'tail') back.push(`<path d="M68,116 Q102,126 100,98 Q98,88 108,84" fill="none" stroke="${B}" stroke-width="6" stroke-linecap="round"/>`);

  // ---- 뒷머리 / 후드 (머리 크기에 맞춰 커짐) ----
  if (L.outfit === 'hoodie') hairBack.push(`<ellipse cx="60" cy="60" rx="33" ry="30" fill="${OD}"/>`);
  if (L.hair === 'bob') hairBack.push(`<path d="M34,50 Q31,84 44,82 L76,82 Q89,84 86,50 Z" fill="${HD}"/>`);
  if (L.hair === 'long') hairBack.push(`<path d="M34,46 Q27,106 44,110 L76,110 Q93,106 86,46 Z" fill="${HD}"/>`);
  if (L.hair === 'ponytail') hairBack.push(`<path d="M80,38 Q106,46 98,90 Q92,72 82,60 Z" fill="${HD}"/>`);
  if (L.hair === 'twin') hairBack.push(`<path d="M37,40 Q16,46 20,98 Q28,80 38,62 Z M83,40 Q104,46 100,98 Q92,80 82,62 Z" fill="${HD}"/>
    <circle cx="36" cy="40" r="3.5" fill="${A}"/><circle cx="84" cy="40" r="3.5" fill="${A}"/>`);
  if (L.hair === 'curly') hairBack.push(`<circle cx="60" cy="46" r="30" fill="${HD}"/><circle cx="34" cy="62" r="9" fill="${HD}"/><circle cx="86" cy="62" r="9" fill="${HD}"/>`);

  // ---- 몸통 (옷) ----
  body.push(`<g class="arm-back"><rect x="31" y="80" width="10" height="30" rx="5" fill="${L.outfit === 'vest' ? '#f4f1ea' : OD}"/><circle cx="36" cy="112" r="5" fill="${SD}"/></g>`);
  const torso = 'M40,80 Q60,73 80,80 L78,118 L42,118 Z';
  switch (L.outfit) {
    case 'coat':
      body.push(`<path d="M37,80 Q60,72 83,80 L86,138 L34,138 Z" fill="${O}"/>
        <path d="M60,84 L60,138" stroke="${OD}" stroke-width="2"/>
        <path d="M48,78 L60,98 L72,78" fill="none" stroke="${OL}" stroke-width="4"/>
        <rect x="38" y="110" width="44" height="5" fill="${OD}"/>
        <circle cx="64" cy="100" r="1.8" fill="${OL}"/><circle cx="64" cy="122" r="1.8" fill="${OL}"/>`);
      break;
    case 'robe':
      body.push(`<path d="M38,80 Q60,72 82,80 L92,142 L28,142 Z" fill="${O}"/>
        <path d="M50,78 L60,112 L70,78" fill="none" stroke="${OL}" stroke-width="3"/>
        <rect x="40" y="108" width="40" height="6" fill="${N}"/><path d="M62,114 L66,130 L60,128 Z" fill="${N}"/>
        <path d="M44,120 L38,142 M76,120 L82,142" stroke="${OD}" stroke-width="1.5"/>`);
      break;
    case 'hoodie':
      body.push(`<path d="${torso}" fill="${O}"/>
        <rect x="47" y="100" width="26" height="12" rx="4" fill="${OD}"/>
        <path d="M55,80 L54,94 M65,80 L66,94" stroke="#f4f1ea" stroke-width="1.5"/>`);
      break;
    case 'armor':
      body.push(`<path d="${torso}" fill="${OD}"/>
        <path d="M45,82 Q60,77 75,82 L72,104 Q60,110 48,104 Z" fill="${OL}" stroke="${line}" stroke-width="1"/>
        <path d="M60,84 L60,104" stroke="${O}" stroke-width="1.5"/>
        <circle cx="40" cy="83" r="9" fill="${OL}" stroke="${line}" stroke-width="1"/><circle cx="80" cy="83" r="9" fill="${OL}" stroke="${line}" stroke-width="1"/>
        <rect x="42" y="110" width="36" height="6" fill="${shade(O, -0.55)}"/>`);
      break;
    case 'uniform':
      body.push(`<path d="${torso}" fill="${O}"/>
        <rect x="51" y="73" width="18" height="8" rx="2" fill="${OD}"/>
        <rect x="38" y="78" width="10" height="4" rx="1" fill="#d9a54a"/><rect x="72" y="78" width="10" height="4" rx="1" fill="#d9a54a"/>
        <circle cx="60" cy="88" r="1.8" fill="#d9a54a"/><circle cx="60" cy="96" r="1.8" fill="#d9a54a"/><circle cx="60" cy="104" r="1.8" fill="#d9a54a"/>
        <rect x="42" y="109" width="36" height="5" fill="${line}"/><rect x="57" y="108" width="6" height="7" fill="#d9a54a"/>`);
      break;
    case 'jacket':
      body.push(`<path d="${torso}" fill="${O}"/>
        <path d="M54,78 L66,78 L65,118 L55,118 Z" fill="#f4f1ea"/>
        <path d="M54,78 L46,90 L52,94 L55,82 Z M66,78 L74,90 L68,94 L65,82 Z" fill="${OL}"/>
        <path d="M55,96 L55,118 M65,96 L65,118" stroke="${OD}" stroke-width="1.5"/>
        <rect x="42" y="112" width="36" height="6" fill="${OD}"/>`);
      break;
    case 'vest':
      body.push(`<path d="${torso}" fill="#f4f1ea"/>
        <path d="M41,80 Q50,76 55,78 L60,100 L58,118 L42,118 Z M79,80 Q70,76 65,78 L60,100 L62,118 L78,118 Z" fill="${O}"/>
        <circle cx="57" cy="106" r="1.4" fill="${OD}"/><circle cx="63" cy="106" r="1.4" fill="${OD}"/>`);
      break;
    default: // suit
      body.push(`<path d="${torso}" fill="${O}"/>
        <path d="M53,78 L60,98 L67,78 Z" fill="#f4f1ea"/>
        <path d="M51,79 L58,102 M69,79 L62,102" stroke="${OD}" stroke-width="2.5"/>
        <circle cx="60" cy="108" r="1.6" fill="${OD}"/>`);
  }
  if (L.back === 'backpack') body.push(`<path d="M46,79 L48,114 M74,79 L72,114" stroke="${shade(B, -0.2)}" stroke-width="3.5"/>`);
  // 목 장신구
  if (L.neck === 'tie') neck.push(`<path d="M58,80 L62,80 L63.5,85 L61.5,99 L58.5,99 L56.5,85 Z" fill="${N}" stroke="${line}" stroke-width=".6"/>`);
  if (L.neck === 'scarf') neck.push(`<rect x="45" y="71" width="30" height="9" rx="4.5" fill="${N}"/><path d="M68,77 L74,100 L66,98 L63,78 Z" fill="${shade(N, -0.15)}"/>`);
  if (L.neck === 'ribbon') neck.push(`<path d="M60,79 L50,74 L50,85 Z M60,79 L70,74 L70,85 Z" fill="${N}" stroke="${line}" stroke-width=".6"/><circle cx="60" cy="79" r="2.6" fill="${shade(N, -0.25)}"/>`);
  if (L.neck === 'choker') neck.push(`<rect x="53" y="72" width="14" height="3.5" rx="1.5" fill="${N}"/><circle cx="60" cy="78" r="1.8" fill="#d9a54a"/>`);

  // ---- 머리 ----
  headF.push(`<rect x="55" y="68" width="10" height="10" fill="${SD}"/>
    <circle cx="36.5" cy="53" r="4" fill="${SD}"/><circle cx="83.5" cy="53" r="4" fill="${SD}"/>
    <circle cx="60" cy="50" r="24" fill="${S}"/>`);
  // 얼굴 표식
  if (L.mark === 'blush') headF.push(`<ellipse cx="46" cy="61" rx="4" ry="2" fill="#ff7a8a" opacity=".5"/><ellipse cx="74" cy="61" rx="4" ry="2" fill="#ff7a8a" opacity=".5"/>`);
  if (L.mark === 'scar') headF.push(`<path d="M45,46 L54,62 M47,51 L50,49.5 M49.5,55.5 L52.5,54 M52,59.5 L55,58" stroke="#a8473a" stroke-width="1.3" stroke-linecap="round"/>`);
  if (L.mark === 'bandage') headF.push(`<g transform="rotate(-18 72 61)"><rect x="66" y="58.5" width="12" height="5" rx="1.5" fill="#f2e2c4" stroke="#c9b089" stroke-width=".5"/><rect x="70.5" y="58.5" width="3" height="5" fill="#e3cfa8"/></g>`);
  if (L.mark === 'mole') headF.push(`<circle cx="67" cy="62" r="1" fill="#3a2a22"/>`);
  if (L.mark === 'stitch') headF.push(`<path d="M66,58 L78,64 M68,57.5 L67,60 M71,59 L70,61.5 M74,60.5 L73,63 M77,62 L76,64.5" stroke="${line}" stroke-width=".9" stroke-linecap="round"/>`);
  // 눈
  const eyeN = (cx) => `<ellipse cx="${cx}" cy="54" rx="3" ry="4.2" fill="${E}"/><circle cx="${cx + 1}" cy="52.5" r="1.1" fill="#fff"/>`;
  const eyeC = (cx) => `<path d="M${cx - 4},55 Q${cx},58.5 ${cx + 4},55" fill="none" stroke="${line}" stroke-width="1.8" stroke-linecap="round"/>`;
  switch (L.eyes) {
    case 'sharp': headF.push(`<path d="M46,53 L56,51.5 L55,56.5 Z M74,53 L64,51.5 L65,56.5 Z" fill="${E}"/>`); break;
    case 'round': headF.push(`<circle cx="51" cy="54" r="4.6" fill="${E}"/><circle cx="69" cy="54" r="4.6" fill="${E}"/><circle cx="52.5" cy="52.3" r="1.6" fill="#fff"/><circle cx="70.5" cy="52.3" r="1.6" fill="#fff"/>`); break;
    case 'tired': headF.push(`<ellipse cx="51" cy="55.5" rx="3" ry="2.4" fill="${E}"/><ellipse cx="69" cy="55.5" rx="3" ry="2.4" fill="${E}"/>
      <path d="M47,53.5 L55,53.5 M65,53.5 L73,53.5" stroke="${line}" stroke-width="1.6" stroke-linecap="round"/><path d="M47.5,59.5 Q51,61 54.5,59.5 M65.5,59.5 Q69,61 72.5,59.5" fill="none" stroke="${SD}" stroke-width="1.2"/>`); break;
    case 'closed': headF.push(eyeC(51) + eyeC(69)); break;
    case 'wink': headF.push(eyeN(51) + eyeC(69)); break;
    case 'glow': headF.push(`<ellipse cx="51" cy="54" rx="3.4" ry="4.4" fill="${A}" class="eye-glow"/><ellipse cx="69" cy="54" rx="3.4" ry="4.4" fill="${A}" class="eye-glow"/>
      <circle cx="51" cy="54" r="1.4" fill="#fff"/><circle cx="69" cy="54" r="1.4" fill="#fff"/>`); break;
    case 'odd': headF.push(eyeN(51) + `<ellipse cx="69" cy="54" rx="3" ry="4.2" fill="${A}"/><circle cx="70" cy="52.5" r="1.1" fill="#fff"/>`); break;
    default: headF.push(eyeN(51) + eyeN(69));
  }
  // 눈썹
  const BR = { normal: 'M46,47.5 Q51,45.5 56,48 M64,48 Q69,45.5 74,47.5', thick: 'M46,47.5 Q51,45 56,47.5 M64,47.5 Q69,45 74,47.5',
    angry: 'M45.5,45.5 L56,49.5 M74.5,45.5 L64,49.5', worried: 'M46,49.5 L56,46 M74,49.5 L64,46' }[L.brows];
  if (BR) headF.push(`<path d="${BR}" fill="none" stroke="${HD}" stroke-width="${L.brows === 'thick' ? 3.2 : 1.8}" stroke-linecap="round"/>`);
  // 입 (마스크면 가려짐)
  if (L.face !== 'mask') {
    const MO = {
      smile: `<path d="M56,64 Q60,66.5 64,64" fill="none" stroke="${line}" stroke-width="1.4" stroke-linecap="round"/>`,
      flat: `<path d="M56.5,64.8 L63.5,64.8" stroke="${line}" stroke-width="1.4" stroke-linecap="round"/>`,
      grin: `<path d="M54.5,63 Q60,69.5 65.5,63 Z" fill="#fff" stroke="${line}" stroke-width="1.1" stroke-linejoin="round"/>`,
      frown: `<path d="M56,66 Q60,63.4 64,66" fill="none" stroke="${line}" stroke-width="1.4" stroke-linecap="round"/>`,
      open: `<ellipse cx="60" cy="65" rx="2.6" ry="2.3" fill="#5a1f24" stroke="${line}" stroke-width=".8"/>`,
      fang: `<path d="M56,64 Q60,66.5 64,64" fill="none" stroke="${line}" stroke-width="1.4" stroke-linecap="round"/><path d="M61,64.9 L61.8,67.4 L62.7,64.6 Z" fill="#fff" stroke="${line}" stroke-width=".4"/>`,
    };
    headF.push(MO[L.mouth]);
  }
  // 앞머리
  switch (L.hair) {
    case 'spiky':
      headF.push(`<path d="M34,52 L29,34 L42,37 L43,21 L54,31 L60,15 L66,31 L77,21 L78,37 L91,34 L86,52 Q80,39 60,39 Q40,39 34,52 Z" fill="${H}"/>`); break;
    case 'bob':
      headF.push(`<path d="M35,54 Q33,24 60,23 Q87,24 85,54 Q82,40 72,42 L60,35 L48,42 Q38,40 35,54 Z" fill="${H}"/>`); break;
    case 'curly':
      headF.push(`<g fill="${H}"><circle cx="40" cy="40" r="8"/><circle cx="50" cy="31" r="9"/><circle cx="62" cy="28" r="9"/><circle cx="74" cy="32" r="9"/><circle cx="82" cy="42" r="7"/><circle cx="36" cy="50" r="5"/><circle cx="85" cy="51" r="5"/></g>`); break;
    case 'side':
      headF.push(`<path d="M35,54 Q32,22 62,22 Q88,24 85,48 Q78,34 64,35 Q50,38 44,58 Q38,50 35,54 Z" fill="${H}"/>`); break;
    case 'mohawk':
      headF.push(`<path d="M37,46 Q40,30 52,27 M83,46 Q80,30 68,27" fill="none" stroke="${H}" stroke-width="3" opacity=".45"/>
        <path d="M53,34 L53,6 L58,14 L60,4 L62,14 L67,6 L67,34 Q60,30 53,34 Z" fill="${H}"/>`); break;
    case 'bald':
      headF.push(`<path d="M44,32 Q52,28 58,30" fill="none" stroke="#fff" stroke-width="2" opacity=".35" stroke-linecap="round"/>`); break;
    default: // short, long, ponytail, twin
      headF.push(`<path d="M36,51 Q35,24 60,24 Q85,24 84,51 Q79,38 67,40 Q61,33 52,40 Q42,39 36,51 Z" fill="${H}"/>`);
  }
  // 얼굴 장신구
  if (L.face === 'glasses') headF.push(`<g fill="none" stroke="${line}" stroke-width="1.6"><circle cx="51" cy="54" r="6"/><circle cx="69" cy="54" r="6"/><path d="M57,54 L63,54 M45,53 L38,51 M75,53 L82,51"/></g>`);
  if (L.face === 'sunglasses') headF.push(`<g stroke="${line}" stroke-width="1.2"><rect x="44" y="50" width="13" height="8" rx="3" fill="${shade(A, -0.6)}"/><rect x="63" y="50" width="13" height="8" rx="3" fill="${shade(A, -0.6)}"/><path d="M57,53 L63,53 M44,52 L37,50 M76,52 L83,50" fill="none"/></g>
    <path d="M46,52 L50,51" stroke="#fff" stroke-width="1" opacity=".5"/>`);
  if (L.face === 'mask') headF.push(`<path d="M39,58 Q60,54 81,58 Q79,74 60,76 Q41,74 39,58 Z" fill="${A}" stroke="${line}" stroke-width=".8"/><path d="M44,64 L76,64" stroke="${shade(A, -0.25)}" stroke-width="1"/>`);
  if (L.face === 'eyepatch') headF.push(`<path d="M38,44 L82,58" stroke="${line}" stroke-width="1.4"/><ellipse cx="69" cy="54.5" rx="6" ry="5.5" fill="${shade(A, -0.55)}" stroke="${line}" stroke-width=".8"/>`);
  if (L.face === 'goggles') headF.push(`<path d="M36,40 Q60,34 84,40" fill="none" stroke="${line}" stroke-width="3"/><circle cx="51" cy="38" r="5.5" fill="${A}" stroke="${line}" stroke-width="1.2"/><circle cx="69" cy="38" r="5.5" fill="${A}" stroke="${line}" stroke-width="1.2"/>
    <circle cx="51" cy="38" r="3" fill="#bfe8ff" opacity=".8"/><circle cx="69" cy="38" r="3" fill="#bfe8ff" opacity=".8"/>`);
  // 머리 장신구
  if (L.head === 'hat') headF.push(`<ellipse cx="60" cy="31" rx="31" ry="5.5" fill="${A}" stroke="${line}" stroke-width=".8"/>
    <path d="M42,31 Q43,11 60,11 Q77,11 78,31 Z" fill="${A}" stroke="${line}" stroke-width=".8"/><rect x="42.5" y="24" width="35" height="4" fill="${shade(A, -0.4)}"/>`);
  if (L.head === 'beret') headF.push(`<path d="M36,36 Q40,16 64,17 Q88,19 86,33 Q62,26 36,36 Z" fill="${A}" stroke="${line}" stroke-width=".8"/><circle cx="64" cy="16" r="2" fill="${shade(A, -0.3)}"/>`);
  if (L.head === 'cap') headF.push(`<path d="M37,38 Q38,17 60,17 Q82,17 83,38 Q60,32 37,38 Z" fill="${A}" stroke="${line}" stroke-width=".8"/><path d="M37,38 Q60,31 83,38 L88,41 Q60,35 34,42 Z" fill="${shade(A, -0.3)}"/>`);
  if (L.head === 'horns') headF.push(`<path d="M44,32 Q36,18 42,10 Q44,22 50,28 Z M76,32 Q84,18 78,10 Q76,22 70,28 Z" fill="${A}" stroke="${line}" stroke-width=".8"/>`);
  if (L.head === 'halo') headF.push(`<ellipse cx="60" cy="14" rx="16" ry="4" fill="none" stroke="${A}" stroke-width="3" class="eye-glow"/>`);
  if (L.head === 'hairpin') headF.push(`<g transform="rotate(-30 76 36)"><rect x="70" y="34" width="12" height="3" rx="1.5" fill="${A}"/><rect x="72" y="38" width="10" height="2.5" rx="1.2" fill="${shade(A, -0.2)}"/></g>`);
  if (L.head === 'headphones') headF.push(`<path d="M36,50 Q34,18 60,18 Q86,18 84,50" fill="none" stroke="${shade(A, -0.3)}" stroke-width="4"/>
    <rect x="30" y="44" width="9" height="16" rx="3.5" fill="${A}" stroke="${line}" stroke-width=".8"/><rect x="81" y="44" width="9" height="16" rx="3.5" fill="${A}" stroke="${line}" stroke-width=".8"/>`);

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
  const sleeve = L.outfit === 'vest' ? '#f4f1ea' : O;
  const armF = `<g class="arm-front"><rect x="79" y="80" width="10" height="28" rx="5" fill="${sleeve}"/><circle cx="84" cy="110" r="5" fill="${S}"/>${gear}</g>`;
  const legs = `<g transform="translate(0 146) scale(1 ${hgt}) translate(0 -146)"><rect x="47" y="112" width="10" height="34" rx="3" fill="${P}"/><rect x="63" y="112" width="10" height="34" rx="3" fill="${P}"/></g>
    <ellipse cx="51" cy="148" rx="8" ry="4" fill="${line}"/><ellipse cx="69" cy="148" rx="8" ry="4" fill="${line}"/>`;

  const svg = [
    '<ellipse cx="60" cy="152" rx="30" ry="5" fill="#000" opacity=".22"/>',
    `<g transform="translate(0 ${lift.toFixed(2)})"><g transform="${BODYT}">${back.join('')}</g><g transform="${HEADT}">${hairBack.join('')}</g></g>`,
    legs,
    `<g transform="translate(0 ${lift.toFixed(2)})"><g transform="${BODYT}">${body.join('')}${neck.join('')}</g>`,
    `<g transform="${HEADT}">${headF.join('')}</g>`,
    `<g transform="${BODYT}">${armF}</g></g>`,
  ];
  // 초상화: 머리 크기·키에 맞춰 얼굴 쪽을 잘라 보여 줌
  const bs = 72 * hs, bcy = 70 - 26 * hs + lift;
  const vb = opts.bust ? `${(60 - bs / 2).toFixed(1)} ${(bcy - bs / 2).toFixed(1)} ${bs.toFixed(1)} ${bs.toFixed(1)}` : '0 0 120 160';
  return `<svg class="char-svg${opts.bust ? ' bust' : ''}" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${svg.join('')}</svg>`;
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
  const st = d.strike;
  if (d.mode === 'open') return { side: 'a', base: d.aBase, coins: st ? st.coins : d.aCoins, hits: st ? st.hits : [] };
  if (d.mode === 'clash' && st && st.s !== 't') return { side: st.s, base: st.s === 'a' ? d.aBase : d.dBase, coins: st.coins, hits: st.hits };
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
    strike: d.strike && typeof d.strike === 'object' ? { s: side(d.strike.s), coins: coins(d.strike.coins),
      hits: Array.isArray(d.strike.hits) ? d.strike.hits.slice(0, 16).map((h) => ({ d: Math.max(0, Math.min(999, +(h && h.d) || 0)), m: h && h.m ? 1 : 0 })) : [] } : null,
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
  const hp = Math.max(0, Math.min(100, (p.hp / (p.maxHp || RULES.maxHp)) * 100));
  const sg = stag ? 100 : Math.max(0, Math.min(100, (p.stg / (p.stgMax || RULES.staggerMax)) * 100));
  return `<svg class="ff-ring t-${team}" viewBox="0 0 200 56" preserveAspectRatio="none" aria-hidden="true">
    <path class="trk" d="${RING_HP}" pathLength="100"/>
    <path class="hp" d="${RING_HP}" pathLength="100" stroke-dasharray="${hp.toFixed(1)} 100"/>
    <path class="seg" d="${RING_HP}" pathLength="100"/>
    <path class="trk s" d="${RING_STG}" pathLength="100"/>
    <path class="stg${stag ? ' broken' : ''}" d="${RING_STG}" pathLength="100" stroke-dasharray="${sg.toFixed(1)} 100"/>
  </svg>`;
}
const setRingHp = (svg, hp, max = RULES.maxHp) => { const el = svg && $('.hp', svg); if (el) el.setAttribute('stroke-dasharray', `${Math.max(0, Math.min(100, (hp / max) * 100)).toFixed(1)} 100`); };

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
    ${opts.extra ? `<div class="ff-extra">${opts.extra}</div>` : ''}
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
  const floatMiss = (el) => { const m = document.createElement('div'); m.className = 'f-miss'; m.textContent = 'MISS'; el.appendChild(m); T(700, () => m.remove()); };
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
        setRingHp($('.ff-ring', hpEl), hpLeft, hpWho.maxHp || RULES.maxHp);
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
    const hits = plan.hits.length ? plan.hits : (coins.length ? coins.map((c, k) => ({ d: (k ? 0 : plan.base) + (c.h ? c.p : 0), m: 0 })) : [{ d: plan.base, m: 0 }]);
    const incs = hits.map((h) => (h.m ? 0 : h.d));
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
      if (hits[k] && hits[k].m) { pose(lEl, 'evade'); floatMiss(lEl); return; }
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
  else T(tm.end + 150, () => { box.innerHTML = ''; });
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
    <label class="swatch custom ${LOOK_COLORS[k].includes(L[k]) ? '' : 'on'}" title="직접 고르기" ${LOOK_COLORS[k].includes(L[k]) ? '' : `style="background:${L[k]}"`}><input type="color" data-pick="${k}" value="${L[k]}">🎨</label></div></div>`;
  const slider = (k) => {
    const [lo, hi] = LOOK_SLIDERS[k];
    return `<div class="ce-row"><span class="ce-label">${SLIDER_LABEL[k]}</span><div class="ce-opts ce-slider">
      <input type="range" min="${lo}" max="${hi}" step="0.01" value="${L.sz[k]}" data-slider="${k}"><b>${Math.round(L.sz[k] * 100)}%</b></div></div>`;
  };
  const sec = (title, rows) => `<div class="ce-sec"><div class="ce-sec-title">${title}</div>${rows.join('')}</div>`;
  $('#ce-form').innerHTML = [
    sec('머리', [optRow('hair'), colorRow('hairColor')]),
    sec('얼굴', [optRow('brows'), optRow('eyes'), colorRow('eyeColor'), optRow('mouth'), optRow('mark'), colorRow('skin')]),
    sec('옷', [optRow('outfit'), colorRow('outfitColor'), colorRow('pantsColor')]),
    sec('장신구', [optRow('head'), optRow('face'), colorRow('accColor'), optRow('neck'), colorRow('neckColor'), optRow('back'), colorRow('backColor')]),
    sec('체형', [slider('height'), slider('head'), slider('build')]),
  ].join('');
}

function ceRedrawPreview() {
  const gear = CE.pose === 'guard' ? 'shield' : CE.pose === 'cast' ? 'orb' : 'blade';
  const fb = $('#ce-preview .f-body');
  if (fb) fb.innerHTML = charSVG(CE.look, { gear, gearColor: gear === 'shield' ? '#7fa3d6' : gear === 'orb' ? '#b98cff' : '#d0d4dc' });
  const pt = $('#ce-preview .ce-portrait');
  if (pt) pt.firstElementChild.outerHTML = portraitSVG(CE.look);
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
    const k = e.target.dataset.pick, sl = e.target.dataset.slider;
    if (sl) {
      CE.look.sz[sl] = +e.target.value;
      CE.look = normalizeLook(CE.look);
      e.target.nextElementSibling.textContent = Math.round(CE.look.sz[sl] * 100) + '%';
      ceRedrawPreview();
      return;
    }
    if (!k) return;
    CE.look[k] = e.target.value;
    CE.look = normalizeLook(CE.look);
    ceRedrawPreview();
  });
  $('#ce-form').addEventListener('change', (e) => { if (e.target.dataset.pick) renderCharEdit(); });
}

document.addEventListener('DOMContentLoaded', initCharEdit);
