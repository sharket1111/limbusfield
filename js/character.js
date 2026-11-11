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
function clashDuration(d) {
  const n = Math.max(d.aCoins.length, d.dCoins.length);
  return 350 + n * 200 + 150 + 1150;
}

function validateClash(d) {
  if (!d || typeof d !== 'object') return null;
  const coins = (arr) => (Array.isArray(arr) ? arr.slice(0, 16).map((c) => ({ h: c && c.h ? 1 : 0, p: Math.max(0, Math.min(99, +c.p || 0)), r: Math.max(0, Math.min(9, +c.r || 0)) })) : []);
  const refs = (arr) => (Array.isArray(arr) ? arr.slice(0, 8).map((r) => ({ uid: +r.uid || 0, id: String(r.id || '') })) : []);
  return {
    aId: +d.aId, dId: +d.dId,
    mode: ['clash', 'open', 'nullify'].includes(d.mode) ? d.mode : 'open',
    result: ['atk', 'def', 'tie', 'open', 'nullify'].includes(d.result) ? d.result : 'open',
    aBase: +d.aBase || 0, dBase: +d.dBase || 0, pa: +d.pa || 0, pd: +d.pd || 0,
    aCoins: coins(d.aCoins), dCoins: coins(d.dCoins), aCards: refs(d.aCards), dCards: refs(d.dCards),
    gear: d.gear === 'orb' ? 'orb' : 'blade', attr: ATTR[d.attr] ? d.attr : 'phys', stag: d.stag ? 1 : 0,
    spd: Math.max(0.05, Math.min(2, +d.spd || 1)),
  };
}

function renderClash(d) {
  const st = $('#stage');
  if (!st || !d) return;
  const A = G.players.find((p) => p.id === d.aId), D = G.players.find((p) => p.id === d.dId);
  if (!A || !D) return;
  const token = String(Date.now() + Math.random());
  st.dataset.token = token;
  const live = () => st.dataset.token === token;
  const T = (ms, fn) => setTimeout(() => { if (live()) fn(); }, ms * d.spd);
  const attrColor = ATTR[d.attr].color;
  const cardNames = (refs) => refs.map(resolveCard).filter(Boolean).map((c) => `<span>「${c.name}」</span>`).join('');
  const dGear = d.mode === 'open' ? null : 'shield';
  const armorColor = (() => { const c = d.dCards.map(resolveCard).find(Boolean); return c && ATTR[c.attr] ? ATTR[c.attr].color : '#9aa4b2'; })();

  st.classList.remove('pop');
  st.innerHTML = `
    <div class="arena" style="--spd:${d.spd}">
      <div class="arena-title">${d.mode === 'clash' ? '⚔ 합 ⚔' : d.mode === 'nullify' ? '🛑 무효화' : '⚔ 일방 공격'}</div>
      <div class="fighter left enter" data-side="a">
        <div class="f-coins"></div>
        <div class="f-pow">${d.aBase}</div>
        <div class="f-body">${charSVG(A.look, { gear: d.gear, gearColor: attrColor })}</div>
        <div class="f-name">${A.name}</div>
        <div class="f-cards">${cardNames(d.aCards)}</div>
      </div>
      <div class="impact"></div>
      <div class="clash-banner"></div>
      <div class="fighter right enter" data-side="d">
        <div class="f-coins"></div>
        <div class="f-pow">${d.mode === 'clash' ? d.dBase : ''}</div>
        <div class="f-body flip">${charSVG(D.look, { gear: dGear, gearColor: armorColor })}</div>
        <div class="f-name">${D.name}${d.stag ? ' <span class="neg">💢</span>' : ''}</div>
        <div class="f-cards">${cardNames(d.dCards) || (d.mode === 'open' ? `<span class="muted">${d.stag ? '흐트러짐' : '무방비'}</span>` : '')}</div>
      </div>
    </div>`;
  const fa = $('.fighter.left', st), fd = $('.fighter.right', st);
  const powA = $('.f-pow', fa), powD = $('.f-pow', fd);
  const banner = $('.clash-banner', st), impact = $('.impact', st);
  requestAnimationFrame(() => requestAnimationFrame(() => { fa.classList.remove('enter'); fd.classList.remove('enter'); }));

  // 코인 공개
  const n = Math.max(d.aCoins.length, d.dCoins.length);
  let sumA = d.aBase, sumD = d.dBase;
  const coinEl = (c) => `<span class="coin ${c.h ? 'head' : 'tail'} ${c.r ? 'reuse' : ''} flip-in">${c.h ? c.p + (c.r ? '↻' : '') : '○'}</span>`;
  const bump = (el) => { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); };
  for (let i = 0; i < n; i++) {
    T(350 + i * 200, () => {
      const ca = d.aCoins[i], cd = d.dCoins[i];
      if (ca) { $('.f-coins', fa).insertAdjacentHTML('beforeend', coinEl(ca)); if (ca.h) { sumA += ca.p; powA.textContent = sumA; bump(powA); } }
      if (cd && d.mode === 'clash') { $('.f-coins', fd).insertAdjacentHTML('beforeend', coinEl(cd)); if (cd.h) { sumD += cd.p; powD.textContent = sumD; bump(powD); } }
    });
  }
  const tc = 350 + n * 200 + 150;
  T(tc - 60, () => { powA.textContent = d.pa; if (d.mode === 'clash') powD.textContent = d.pd; });

  if (d.mode === 'clash') {
    T(tc, () => { fa.classList.add('lunge'); fd.classList.add('lunge'); });
    T(tc + 260, () => { impact.classList.add('show'); st.classList.add('shake'); fa.classList.add('swing'); fd.classList.add('swing'); });
    T(tc + 520, () => {
      st.classList.remove('shake');
      if (d.result === 'atk') {
        powA.classList.add('win'); powD.classList.add('lose');
        fa.classList.add('strike'); fd.classList.add('hurt');
        banner.textContent = `${A.name} 합 승리!`;
      } else if (d.result === 'def') {
        powD.classList.add('win'); powA.classList.add('lose');
        fd.classList.add('strike'); fa.classList.add('hurt');
        banner.textContent = `${D.name} 합 승리!`;
      } else {
        fa.classList.add('recoil'); fd.classList.add('recoil');
        banner.textContent = '상쇄';
      }
      banner.classList.add('show');
    });
  } else if (d.mode === 'open') {
    T(tc, () => { fa.classList.add('dash'); });
    T(tc + 280, () => { fa.classList.add('swing'); impact.classList.add('show', 'on-def'); st.classList.add('shake'); fd.classList.add('hurt'); });
    T(tc + 560, () => { st.classList.remove('shake'); banner.textContent = `위력 ${d.pa}${d.stag ? ' · 흐트러짐 ×1.5' : ''}`; banner.classList.add('show'); });
  } else {
    T(tc, () => { fa.classList.add('dash'); fd.classList.add('guard'); });
    T(tc + 280, () => { fa.classList.add('swing'); impact.classList.add('show', 'on-def', 'block'); });
    T(tc + 520, () => { fa.classList.add('recoil'); banner.textContent = '무효!'; banner.classList.add('show'); });
  }
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
