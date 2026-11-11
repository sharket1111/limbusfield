// ============================================================
//  카드 공방 — 웹에서 직접 카드와 카드팩을 만들고 저장 (브라우저 localStorage)
// ============================================================
'use strict';

const CUSTOM_KEY = 'af_custom_cards';   // 예전 형식 (카드팩 도입 전)
const PACKS_KEY = 'af_packs';
const ACTIVE_KEY = 'af_active_pack';
const TYPES = ['weapon', 'armor', 'ego', 'item'];
const MAX_COINS = 6;
const newId = (pre) => pre + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ---------------- 검증 (가져온 JSON도 모두 이걸 거침) ----------------
const cleanText = (v, max) => String(v == null ? '' : v).replace(/[<>&"'`\\]/g, '').slice(0, max);
const num = (v, lo, hi, def = 0) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def;
};
const IMG_RE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

function normalizeEffect(e, coin = false) {
  if (!e || !EFFECT_DEFS[e.key]) return null;
  const d = EFFECT_DEFS[e.key];
  if (d.coinOnly && !coin) return null;
  let when = d.preRoll ? 'use' : ['use', 'hit', 'heads'].includes(e.when) ? e.when : 'hit';
  if (!coin && when === 'heads') when = 'hit';
  if (coin && !d.preRoll && when === 'use') when = 'hit';
  const out = {
    when,
    target: d.preRoll ? 'self' : e.target === 'self' ? 'self' : 'enemy',
    key: e.key,
    pot: num(e.pot, d.signed ? -45 : 0, 99),
    cnt: num(e.cnt, 0, 99),
  };
  if (d.kwSel) {
    // 기본 키워드 목록 또는 나만의 키워드 id
    const list = d.kwSel === 'custom' ? [] : KW_SEL[d.kwSel];
    out.kw = list.includes(e.kw) || KW_ID_RE.test(e.kw || '') ? e.kw : list[0];
    if (!out.kw) return null;
  }
  if (e.key === 'reuse') out.cnt = num(e.cnt, 1, 5, 1);
  return out;
}

function normalizeCard(c) {
  if (!c || !TYPES.includes(c.type)) return null;
  const out = {
    id: /^c_[a-z0-9_]+$/i.test(c.id || '') ? c.id : newId('c'),
    custom: true,
    enabled: c.enabled !== false,
    type: c.type,
    name: cleanText(c.name, 20) || '이름 없는 카드',
    flavor: cleanText(c.flavor, 80),
    price: num(c.price, 0, 99, 5),
    count: num(c.count, 1, 5, 1),
    rarity: num(c.rarity, 1, 3, 1),
    sin: SINS[c.sin] ? c.sin : '',
    img: typeof c.img === 'string' && IMG_RE.test(c.img) && c.img.length < 400000 ? c.img : '',
    effects: (Array.isArray(c.effects) ? c.effects : []).map((e) => normalizeEffect(e)).filter(Boolean).slice(0, 8),
  };
  if (c.type !== 'item') {
    const attrs = c.type === 'armor' ? Object.keys(ATTR) : Object.keys(ATTR).filter((k) => k !== 'all');
    out.attr = attrs.includes(c.attr) ? c.attr : 'phys';
    out.coins = (Array.isArray(c.coins) ? c.coins : []).slice(0, MAX_COINS).map((x) => ({
      power: num(x && x.power, 0, 30, 2),
      fx: (Array.isArray(x && x.fx) ? x.fx : []).map((e) => normalizeEffect(e, true)).filter(Boolean).slice(0, 4),
    }));
  }
  const allowFx = { weapon: ['all', 'pierce', 'twice', 'lifesteal'], ego: ['all', 'pierce'], armor: ['reflect'], item: [] }[c.type];
  out.fx = (Array.isArray(c.fx) ? c.fx : []).filter((f) => allowFx.includes(f));
  if (c.type === 'weapon') { out.atk = num(c.atk, 0, 60, 8); out.plus = !!c.plus; }
  if (c.type === 'weapon' || c.type === 'ego') {
    out.weight = num(c.weight, 1, 5, 1);
    out.dtype = DTYPES[c.dtype] ? c.dtype : 'slash';
  }
  if (c.type === 'armor') { out.def = num(c.def, 0, 60, 8); out.kind = ['guard', 'evade', 'counter'].includes(c.kind) ? c.kind : 'guard'; }
  if (c.type === 'ego') { out.kind = 'attack'; out.power = num(c.power, 0, 60, 10); out.cost = egoSpCost(out); out.egoFx = normalizeEgoFx(c.egoFx); }
  if (c.type === 'item') out.kind = 'custom';
  return out;
}

function normalizePack(pk) {
  if (!pk) return null;
  return {
    id: /^p_[a-z0-9_]+$/i.test(pk.id || '') ? pk.id : newId('p'),
    name: cleanText(pk.name, 20) || '카드팩',
    cards: (Array.isArray(pk.cards) ? pk.cards : []).map(normalizeCard).filter(Boolean).slice(0, 60),
    sheet: normalizeSheet(pk.sheet),
    keywords: (Array.isArray(pk.keywords) ? pk.keywords : []).map(normalizeKeyword).filter(Boolean).slice(0, RULES.maxKeywords),
  };
}

// ---------------- 카드팩 저장 / 불러오기 ----------------
function getPacks() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(PACKS_KEY) || 'null'); } catch { raw = null; }
  if (!Array.isArray(raw)) {
    // 예전 형식 이전: 카드 목록 하나 → 「내 카드팩」
    let old = [];
    try { old = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]'); } catch { old = []; }
    const packs = [normalizePack({ name: '내 카드팩', cards: Array.isArray(old) ? old : [] })];
    try { localStorage.setItem(PACKS_KEY, JSON.stringify(packs)); } catch { /* 무시 */ }
    return packs;
  }
  const packs = raw.map(normalizePack).filter(Boolean);
  return packs.length ? packs : [normalizePack({ name: '내 카드팩', cards: [] })];
}

function savePacks(packs) {
  try {
    localStorage.setItem(PACKS_KEY, JSON.stringify(packs));
    return true;
  } catch {
    toast('저장 공간이 부족합니다. 이미지가 큰 카드를 줄이거나 지워 주세요.', 'bad');
    return false;
  }
}

function getActivePackId() {
  try { return localStorage.getItem(ACTIVE_KEY) || ''; } catch { return ''; }
}
function setActivePackId(id) {
  try { localStorage.setItem(ACTIVE_KEY, id); } catch { /* 무시 */ }
}
function getActivePack() {
  const packs = getPacks();
  return packs.find((p) => p.id === getActivePackId()) || packs[0];
}
// 팩에서 「덱에 넣기」로 표시된 카드
const packCards = (pack) => (pack ? pack.cards.filter((c) => c.enabled !== false) : []);
function getCustomCards() { return packCards(getActivePack()); }

function templateCard(type, keep = {}) {
  const base = { name: keep.name || '새 카드', img: keep.img || '', flavor: keep.flavor || '', sin: keep.sin || '', price: keep.price ?? 5,
    count: keep.count ?? 2, rarity: keep.rarity ?? 1, id: keep.id, enabled: keep.enabled !== false };
  const coins3 = () => [0, 1, 2].map(() => ({ power: 2, fx: [] }));
  if (type === 'weapon') return normalizeCard({ ...base, type, attr: 'phys', atk: 8, coins: coins3(), fx: [], effects: [] });
  if (type === 'armor') return normalizeCard({ ...base, type, kind: 'guard', attr: 'phys', def: 8, coins: [], fx: [], effects: [] });
  if (type === 'ego') return normalizeCard({ ...base, type, attr: 'fire', power: 10, cost: 10, coins: coins3(), fx: [], effects: [] });
  return normalizeCard({ ...base, type: 'item', effects: [{ when: 'use', target: 'self', key: 'heal', pot: 10, cnt: 0 }] });
}

// ---------------- 이미지 축소 ----------------
function readImage(file) {
  return new Promise((res, rej) => {
    if (!file || !/^image\//.test(file.type)) return rej(new Error('이미지 파일이 아닙니다'));
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 240;
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(img.width * k));
        cv.height = Math.max(1, Math.round(img.height * k));
        const ctx = cv.getContext('2d');
        ctx.fillStyle = '#141218';
        ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        res(cv.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => rej(new Error('이미지를 읽을 수 없습니다'));
      img.src = fr.result;
    };
    fr.onerror = () => rej(new Error('파일을 읽을 수 없습니다'));
    fr.readAsDataURL(file);
  });
}

// ---------------- 편집 화면 ----------------
const ED = { packs: [], packId: '', cur: null };
const edPack = () => ED.packs.find((p) => p.id === ED.packId) || ED.packs[0];

function openWorkshop() {
  ED.packs = getPacks();
  ED.packId = getActivePack().id;
  const pk = edPack();
  ED.cur = pk.cards[0] ? JSON.parse(JSON.stringify(pk.cards[0])) : templateCard('weapon');
  $('#title').classList.remove('show');
  $('#workshop').classList.add('show');
  renderWorkshop();
}

function closeWorkshop() {
  $('#workshop').classList.remove('show');
  $('#title').classList.add('show');
  updateTitleInfo();
}

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}
function setPath(obj, path, val) {
  const keys = path.split('.');
  const last = keys.pop();
  const o = keys.reduce((x, k) => x[k], obj);
  o[last] = val;
}

function effectRow(e, path, ctx) {
  const armor = ED.cur.type === 'armor';
  const W = armor ? WHEN_TEXT_ARMOR : WHEN_TEXT;
  let whens;
  if (ED.cur.type === 'item') whens = ['use'];
  else if (ctx === 'coin') whens = ['hit', 'heads'];
  else whens = ['use', 'hit'];
  const keys = Object.keys(EFFECT_DEFS).filter((k) => ctx === 'coin' || !EFFECT_DEFS[k].coinOnly);
  const d = EFFECT_DEFS[e.key];
  const pre = !!d.preRoll;
  // 효과 목록: 코인이면 「던지기 전」 효과를 위쪽 그룹으로
  const opt = (k) => `<option value="${k}" ${e.key === k ? 'selected' : ''}>${EFFECT_DEFS[k].label}</option>`;
  const keyOptions = ctx === 'coin'
    ? `<optgroup label="던지기 전 (위력·재사용)">${keys.filter((k) => EFFECT_DEFS[k].preRoll).map(opt).join('')}</optgroup>
       <optgroup label="적중 효과">${keys.filter((k) => !EFFECT_DEFS[k].preRoll).map(opt).join('')}</optgroup>`
    : keys.map(opt).join('');
  return `<div class="eff-row">
    ${pre ? '<span class="eff-fixed">던지기 전</span>' : `<select data-f="${path}.when">${whens.map((w) => `<option value="${w}" ${e.when === w ? 'selected' : ''}>${W[w]}</option>`).join('')}</select>`}
    ${pre ? '' : `<select data-f="${path}.target"><option value="enemy" ${e.target === 'enemy' ? 'selected' : ''}>${armor ? '공격자' : '상대'}</option><option value="self" ${e.target === 'self' ? 'selected' : ''}>자신</option></select>`}
    <select data-f="${path}.key">${keyOptions}</select>
    ${d.kwSel ? kwSelect(d.kwSel, e.kw, `data-f="${path}.kw"`) : ''}
    ${d.pot ? `<label>${d.potLabel || '위력'} <input type="number" data-f="${path}.pot" data-num value="${e.pot}" min="${d.signed ? -45 : 0}" max="99"></label>` : ''}
    ${d.cnt ? `<label>${d.cntLabel || '횟수'} <input type="number" data-f="${path}.cnt" data-num value="${e.cnt}" min="0" max="99"></label>` : ''}
    <button class="btn small del" data-act="del" data-path="${path}" title="삭제">✕</button>
  </div>`;
}

// 키워드 선택 상자: 기본 키워드 + 지금 팩의 나만의 키워드
function kwChoices(sel) {
  const mine = (edPack() ? edPack().keywords : []).map((k) => k.id);
  return sel === 'custom' ? mine : [...KW_SEL[sel], ...mine];
}
function kwSelect(sel, cur, attrs) {
  const list = kwChoices(sel);
  if (!list.length) return '<span class="muted small">먼저 「✴ 나만의 키워드」를 만드세요</span>';
  return `<select ${attrs}>${list.map((k) => `<option value="${k}" ${cur === k ? 'selected' : ''}>${kwPlain(k)}</option>`).join('')}</select>`;
}

// E.G.O 연출 설정 칸: 무기 · 복장 · 대사 · 배경 + 미리보기
function egoFxForm(c) {
  const f = normalizeEgoFx(c.egoFx);
  c.egoFx = f;
  return `<h3>E.G.O 연출 <span class="muted small">E.G.O를 쓸 때 나오는 연출과 합 장면의 모습</span></h3>
    <div class="ws-grid egofx">
      <label>무기 <select data-f="egoFx.gear">${EGO_GEARS.map(([k, l]) => `<option value="${k}" ${f.gear === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label>무기 색 <input type="color" data-f="egoFx.gearColor" value="${f.gearColor}"></label>
      <label>복장 <select data-f="egoFx.outfit"><option value="">평소 옷 그대로</option>${LOOK_OPTIONS.outfit.map(([k, l]) => `<option value="${k}" ${f.outfit === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label>복장 색 <span class="egofx-color"><input type="color" data-f="egoFx.outfitColor" value="${f.outfitColor || '#2c3440'}" ${f.outfitColor ? '' : 'data-unset="1"'}>
        ${f.outfitColor ? '<button class="btn small" data-act="egoOutfitColorOff">그대로</button>' : '<span class="muted small">평소 색</span>'}</span></label>
      <label>배경 <select data-f="egoFx.bg">${EGO_BGS.map(([k, l]) => `<option value="${k}" ${f.bg === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      ${f.bg === 'color' ? `<label>배경 색 <input type="color" data-f="egoFx.bgColor" value="${f.bgColor}"></label>` : ''}
      ${f.bg === 'img' ? `<label>배경 사진 <span><label class="btn small">📷 고르기<input type="file" accept="image/*" id="ws-egobg-in" hidden></label> ${f.bgImg ? '<span class="pos small">✔</span>' : '<span class="muted small">없음</span>'}</span></label>` : ''}
    </div>
    <label class="ws-flavor">대사 <input data-f="egoFx.quote" maxlength="60" value="${f.quote}" placeholder="비우면 카드 설명이 대사로 나옵니다"></label>
    <button class="btn small" data-act="egoPreview">▶ 연출 미리보기</button>`;
}

function packInfoHTML(pack) {
  previewKeywords(pack.keywords);
  const s = packSummary(packCards(pack), pack.keywords);
  const kwCost = pack.keywords.reduce((t, k) => t + keywordCost(k), 0);
  const sh = sheetSummary(pack.sheet);
  return `<b>${pack.name}</b> — 코스트 <b class="${s.overBudget ? 'neg' : 'pos'}">${s.cost}</b> / ${RULES.packBudget}${kwCost ? ` <span class="muted">(키워드 ${kwCost} 포함)</span>` : ''}
    · <b class="${s.tooSmall ? 'neg' : 'pos'}">${s.count}장</b> (개인 덱 최소 ${RULES.packMin})
    · 스탯 <b class="${sh.valid ? 'pos' : 'neg'}">${sh.points}</b> / ${sh.budget}
    · ${s.valid && sh.valid ? '<span class="pos">✔ 대전 규격</span>' : `<span class="neg">✖ ${!sh.valid ? '스탯 포인트 초과' : s.overBudget ? '코스트 초과' : '장수 부족'}</span>`}`;
}

function renderWorkshop() {
  const c = ED.cur;
  const pack = edPack();
  previewKeywords(pack.keywords);
  // 팩 선택줄
  $('#ws-pack').innerHTML = ED.packs.map((p) => `<option value="${p.id}" ${p.id === pack.id ? 'selected' : ''}>${p.name} (${p.cards.length}종)</option>`).join('');
  $('#ws-pack-info').innerHTML = packInfoHTML(pack);

  // 왼쪽: 팩의 카드 목록
  $('#ws-list').innerHTML = pack.cards.length
    ? pack.cards.map((x) => `<div class="ws-item ${x.id === c.id ? 'cur' : ''}" data-id="${x.id}">
        ${cardHTML(x)}
        <label class="ws-on"><input type="checkbox" data-toggle="${x.id}" ${x.enabled !== false ? 'checked' : ''}> 덱에 넣기 ×${x.count}</label>
      </div>`).join('')
    : '<p class="muted">이 팩에는 아직 카드가 없습니다.<br>오른쪽에서 만들고 저장하세요.</p>';

  const t = c.type;
  const attrs = t === 'armor' ? Object.keys(ATTR) : Object.keys(ATTR).filter((k) => k !== 'all');
  const fxOpts = { weapon: [['all', '전체 공격'], ['pierce', '방어 무시 (가드 불가)'], ['twice', '2회 공격'], ['lifesteal', '흡혈']],
    ego: [['all', '전체 공격'], ['pierce', '방어 무시 (가드 불가)']], armor: c.kind === 'guard' ? [['reflect', '반사 (막아낸 피해의 절반 반사)']] : [], item: [] }[t];
  const statLabel = { weapon: '공격력', armor: '수비 위력', ego: '위력' }[t];
  const statKey = { weapon: 'atk', armor: 'def', ego: 'power' }[t];

  $('#ws-form').innerHTML = `
    <div class="ws-grid">
      <label>이름 <input data-f="name" maxlength="20" value="${c.name}"></label>
      <label>종류
        <select data-f="type">${TYPES.map((x) => `<option value="${x}" ${t === x ? 'selected' : ''}>${TYPE_NAME[x]}</option>`).join('')}</select>
      </label>
      ${t !== 'item' ? `<label>속성 (색·아이콘)
        <select data-f="attr">${attrs.map((k) => `<option value="${k}" ${c.attr === k ? 'selected' : ''}>${ATTR[k].icon} ${ATTR[k].name}</option>`).join('')}</select>
      </label>` : ''}
      ${statKey ? `<label>${statLabel} <input type="number" data-f="${statKey}" data-num min="0" max="60" value="${c[statKey]}"></label>` : ''}
      ${t === 'armor' ? `<label>수비 종류
        <select data-f="kind">${[['guard', '🛡 가드 (여러 장 동시)'], ['evade', '💨 회피'], ['counter', '↩ 반격']].map(([k, l]) => `<option value="${k}" ${c.kind === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      </label>` : ''}
      ${t === 'ego' ? `<label title="카드 코스트 × 5 (최대 60)">소모 정신력 (자동) <input type="number" value="${egoSpCost(normalizeCard(c) || c)}" disabled></label>` : ''}
      ${t === 'weapon' || t === 'ego' ? `<label>공격 유형
        <select data-f="dtype">${Object.entries(DTYPES).map(([k, v]) => `<option value="${k}" ${dtypeOf(c) === k ? 'selected' : ''}>${v.icon} ${v.name}</option>`).join('')}</select></label>` : ''}
      ${t === 'weapon' || t === 'ego' ? `<label title="한 번에 맞는 사람 수. 고른 대상 + 나머지 상대 중 무작위">공격 가중치 (맞는 사람 수)
        <input type="number" data-f="weight" data-num min="1" max="5" value="${c.weight || 1}" ${c.fx.includes('all') ? 'disabled' : ''}></label>` : ''}
      <label>가격(안) <input type="number" data-f="price" data-num min="0" max="99" value="${c.price}"></label>
      <label>덱 장수 <input type="number" data-f="count" data-num min="1" max="5" value="${c.count}"></label>
      <label>죄악 (카드 색)
        <select data-f="sin"><option value="" ${!c.sin ? 'selected' : ''}>자동 (속성에 따라)</option>${Object.entries(SINS).map(([k, v]) => `<option value="${k}" ${c.sin === k ? 'selected' : ''}>● ${v.name}</option>`).join('')}</select>
      </label>
      <label>등급
        <select data-f="rarity" data-num>${[1, 2, 3].map((r) => `<option value="${r}" ${c.rarity === r ? 'selected' : ''}>${['일반', '희귀', '전설'][r - 1]}</option>`).join('')}</select>
      </label>
    </div>
    <div class="ws-img">
      <span>사진</span>
      <label class="btn small">📷 사진 고르기<input type="file" accept="image/*" id="ws-img-in" hidden></label>
      ${c.img ? '<button class="btn small" data-act="noimg">사진 지우기</button>' : '<span class="muted small">카드 배경으로 쓰입니다 (자동으로 작게 줄여 저장)</span>'}
    </div>
    <label class="ws-flavor">설명 <input data-f="flavor" maxlength="80" value="${c.flavor}" placeholder="카드 아래에 나오는 짧은 글"></label>
    ${fxOpts.length || t === 'weapon' ? `<div class="ws-checks">
      ${t === 'weapon' ? `<label><input type="checkbox" data-flag="plus" ${c.plus ? 'checked' : ''}> 보조 무기 (다른 무기에 덧붙이기)</label>` : ''}
      ${fxOpts.map(([k, l]) => `<label><input type="checkbox" data-fx="${k}" ${c.fx.includes(k) ? 'checked' : ''}> ${l}</label>`).join('')}
    </div>` : ''}

    ${t === 'ego' ? egoFxForm(c) : ''}
    <h3>${t === 'item' ? '사용 효과' : '카드 효과'} <span class="muted small">${t === 'armor' ? '수비 시 / 수비 성공 시 (반격 성공 시 적중 효과처럼 발동)' : t === 'item' ? '사용하면 바로 발동' : '사용 시 / 적중 시'}</span></h3>
    <div class="eff-list">${c.effects.map((e, i) => effectRow(e, `effects.${i}`, 'card')).join('') || '<p class="muted small">효과 없음</p>'}</div>
    <button class="btn small" data-act="addEff" data-path="effects">+ 효과 추가</button>

    ${t !== 'item' ? `
    <h3>코인 <span class="muted small">${t === 'armor' && c.kind === 'guard'
      ? `가드는 기본 코인 ${RULES.coins}개(+${RULES.coinPower})에 더해 이 코인을 던집니다`
      : t === 'armor' ? `회피·반격은 이 코인을 던집니다 (없으면 기본 코인 ${RULES.coins}개)`
      : '이 카드는 아래 코인을 던집니다. 앞면이면 코인 위력이 더해집니다'}</span></h3>
    <div class="coin-list">${c.coins.map((coin, i) => `
      <div class="coin-box">
        <div class="coin-head">
          <span class="coin head">${coin.power}</span> <b>코인 ${i + 1}</b>
          <label>위력 <input type="number" data-f="coins.${i}.power" data-num min="0" max="30" value="${coin.power}"></label>
          <button class="btn small del" data-act="del" data-path="coins.${i}">코인 삭제</button>
        </div>
        ${coin.fx.map((e, j) => effectRow(e, `coins.${i}.fx.${j}`, 'coin')).join('')}
        <button class="btn small" data-act="addCoinEff" data-path="coins.${i}.fx">+ 코인 효과</button>
      </div>`).join('') || `<p class="muted small">${t === 'armor' ? '추가 코인 없음' : '코인 없음 — 기본 위력만으로 공격합니다'}</p>`}</div>
    ${c.coins.length < MAX_COINS ? '<button class="btn small" data-act="addCoin">+ 코인 추가</button>' : ''}` : ''}
  `;
  renderWsPreview();
}

function renderWsPreview() {
  const c = normalizeCard(ED.cur) || ED.cur;
  const d = describeCard(c);
  $('#ws-preview').innerHTML = `
    <div class="ws-prev-card">${cardHTML(c, { big: true })}</div>
    <div class="ws-prev-text"><b>${c.name}</b> <span class="cost-tag">코스트 ${cardCost(c)}</span>
      <span class="muted small">× ${c.count}장 = ${cardCost(c) * c.count}</span>
      <div class="muted small">${d.head}</div>
      <div class="fx-lines">${d.lines.map((l) => `<span>${l}</span>`).join('')}</div>
      <div class="flavor">${c.flavor || ''}</div></div>`;
}

function commitPacks() {
  if (!savePacks(ED.packs)) return false;
  setActivePackId(ED.packId);
  return true;
}

function wsSave() {
  const c = normalizeCard(ED.cur);
  if (!c) return;
  const pack = edPack();
  if (pack.cards.length >= 60 && !pack.cards.some((x) => x.id === c.id)) { toast('한 팩에는 최대 60종까지 넣을 수 있습니다', 'bad'); return; }
  const before = pack.cards;
  const i = pack.cards.findIndex((x) => x.id === c.id);
  pack.cards = [...pack.cards];
  if (i >= 0) pack.cards[i] = c; else pack.cards.push(c);
  if (!commitPacks()) { pack.cards = before; return; }
  ED.cur = JSON.parse(JSON.stringify(c));
  toast(`「${c.name}」 저장 완료`);
  renderWorkshop();
}

function exportPack(pack) {
  const data = { format: 'anomaly-field-pack', version: 2, name: pack.name, cards: pack.cards, sheet: pack.sheet, keywords: pack.keywords };
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${pack.name || 'cardpack'}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function initWorkshop() {
  initPackExtras();
  $('#btn-workshop').onclick = openWorkshop;
  $('#ws-back').onclick = closeWorkshop;

  // 팩 관리
  $('#ws-pack').onchange = (e) => {
    ED.packId = e.target.value;
    setActivePackId(ED.packId);
    const pk = edPack();
    ED.cur = pk.cards[0] ? JSON.parse(JSON.stringify(pk.cards[0])) : templateCard('weapon');
    renderWorkshop();
  };
  $('#ws-pack-new').onclick = () => {
    const name = cleanText(prompt('새 카드팩 이름', '새 카드팩') || '', 20);
    if (!name) return;
    const pk = normalizePack({ name, cards: [] });
    ED.packs.push(pk);
    ED.packId = pk.id;
    if (!commitPacks()) { ED.packs.pop(); return; }
    ED.cur = templateCard('weapon');
    renderWorkshop();
  };
  $('#ws-pack-rename').onclick = () => {
    const pk = edPack();
    const name = cleanText(prompt('카드팩 이름', pk.name) || '', 20);
    if (!name) return;
    pk.name = name;
    commitPacks();
    renderWorkshop();
  };
  $('#ws-pack-del').onclick = () => {
    const pk = edPack();
    if (ED.packs.length <= 1) { toast('팩이 하나뿐이라 지울 수 없습니다. 카드만 지워 주세요.', 'bad'); return; }
    if (!confirm(`카드팩 「${pk.name}」과 안의 카드 ${pk.cards.length}종을 모두 지울까요?`)) return;
    ED.packs = ED.packs.filter((p) => p !== pk);
    ED.packId = ED.packs[0].id;
    commitPacks();
    const np = edPack();
    ED.cur = np.cards[0] ? JSON.parse(JSON.stringify(np.cards[0])) : templateCard('weapon');
    renderWorkshop();
  };

  // 카드
  $('#ws-new').onclick = () => { ED.cur = templateCard('weapon'); renderWorkshop(); };
  $('#ws-save').onclick = wsSave;
  $('#ws-copy').onclick = () => {
    ED.cur = normalizeCard({ ...JSON.parse(JSON.stringify(ED.cur)), id: '', name: ED.cur.name.slice(0, 16) + ' 사본' });
    renderWorkshop();
    toast('사본을 만들었습니다. 저장해야 팩에 추가됩니다.');
  };
  $('#ws-del').onclick = () => {
    const pack = edPack();
    const i = pack.cards.findIndex((x) => x.id === ED.cur.id);
    if (i < 0) { ED.cur = templateCard('weapon'); renderWorkshop(); return; }
    if (!confirm(`「${pack.cards[i].name}」을(를) 삭제할까요?`)) return;
    const before = pack.cards;
    pack.cards = pack.cards.filter((_, k) => k !== i);
    if (!commitPacks()) { pack.cards = before; return; }
    ED.cur = pack.cards[0] ? JSON.parse(JSON.stringify(pack.cards[0])) : templateCard('weapon');
    renderWorkshop();
  };
  $('#ws-export').onclick = () => exportPack(edPack());
  $('#ws-import').onchange = async (ev) => {
    const f = ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      // 새 형식 { name, cards } 또는 예전 형식 [카드...]
      const raw = Array.isArray(data) ? { name: f.name.replace(/\.json$/i, ''), cards: data } : data;
      const pk = normalizePack({ name: raw.name, cards: raw.cards, sheet: raw.sheet, keywords: raw.keywords });
      if (!pk.cards.length && !pk.keywords.length) { toast('불러올 카드가 없습니다', 'bad'); return; }
      pk.id = newId('p');
      pk.cards = pk.cards.map((x) => ({ ...x, id: newId('c') }));
      ED.packs.push(pk);
      ED.packId = pk.id;
      if (!commitPacks()) { ED.packs.pop(); return; }
      ED.cur = pk.cards[0] ? JSON.parse(JSON.stringify(pk.cards[0])) : templateCard('weapon');
      toast(`카드팩 「${pk.name}」 (${pk.cards.length}종)을 불러왔습니다`);
      renderWorkshop();
    } catch {
      toast('JSON 파일을 읽을 수 없습니다', 'bad');
    }
  };

  // 목록 클릭 / 덱 포함 토글
  $('#ws-list').addEventListener('click', (ev) => {
    const pack = edPack();
    const tg = ev.target.closest('[data-toggle]');
    if (tg) {
      const x = pack.cards.find((k) => k.id === tg.dataset.toggle);
      if (x) {
        x.enabled = tg.checked;
        commitPacks();
        if (ED.cur.id === x.id) ED.cur.enabled = x.enabled;
        $('#ws-pack-info').innerHTML = packInfoHTML(pack);
      }
      return;
    }
    const item = ev.target.closest('.ws-item');
    if (item) {
      const x = pack.cards.find((k) => k.id === item.dataset.id);
      if (x) { ED.cur = JSON.parse(JSON.stringify(x)); renderWorkshop(); }
    }
  });

  const form = $('#ws-form');
  // 값 입력: 미리보기만 갱신
  form.addEventListener('input', (ev) => {
    const el = ev.target;
    if (!el.dataset.f || el.tagName === 'SELECT') return;
    setPath(ED.cur, el.dataset.f, el.dataset.num !== undefined ? Number(el.value) : el.value);
    renderWsPreview();
  });
  // 선택 / 체크: 구조가 바뀔 수 있으니 다시 그림
  form.addEventListener('change', async (ev) => {
    const el = ev.target;
    if (el.id === 'ws-egobg-in') {
      try { ED.cur.egoFx.bgImg = await readImage(el.files[0]); renderWorkshop(); } catch (e) { toast(e.message, 'bad'); }
      return;
    }
    if (el.id === 'ws-img-in') {
      try {
        ED.cur.img = await readImage(el.files[0]);
        renderWorkshop();
      } catch (e) { toast(e.message, 'bad'); }
      return;
    }
    if (el.dataset.flag) { ED.cur[el.dataset.flag] = el.checked; renderWsPreview(); return; }
    if (el.dataset.fx) {
      const set = new Set(ED.cur.fx);
      el.checked ? set.add(el.dataset.fx) : set.delete(el.dataset.fx);
      ED.cur.fx = [...set];
      renderWsPreview();
      return;
    }
    if (!el.dataset.f) return;
    if (el.dataset.f === 'type') {
      ED.cur = templateCard(el.value, ED.cur);
      renderWorkshop();
      return;
    }
    setPath(ED.cur, el.dataset.f, el.dataset.num !== undefined ? Number(el.value) : el.value);
    if (el.tagName === 'SELECT') {
      // 효과 종류가 바뀌면 기본값 정리
      if (/\.key$/.test(el.dataset.f)) {
        const e = getPath(ED.cur, el.dataset.f.replace(/\.key$/, ''));
        const d = EFFECT_DEFS[e.key];
        if (d.preRoll) {
          e.when = 'use';
          e.target = 'self';
          e.pot = { chargeBoost: 4, reuse: 0 }[e.key] ?? 3;
          e.cnt = { chargeBoost: 3, pwrHighSp: 20, reuse: 1 }[e.key] ?? 0;
        } else if (e.when === 'use' && /^coins/.test(el.dataset.f)) e.when = 'hit';
        if (d.kwSel && !kwChoices(d.kwSel).includes(e.kw)) e.kw = kwChoices(d.kwSel)[0];
        if (!d.pot) e.pot = 0;
        if (!d.cnt) e.cnt = 0;
        if (d.pot && !e.pot) e.pot = 2;
        if (d.cnt && !e.cnt) e.cnt = 2;
        if (['kwBurst', 'breakArmor', 'stealWon'].includes(e.key)) e.target = 'enemy';
        if (['heal', 'sp', 'won', 'draw', 'cure', 'poise', 'charge'].includes(e.key)) e.target = 'self';
      }
      renderWorkshop();
    } else renderWsPreview();
  });
  // 버튼
  form.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const c = ED.cur;
    const act = b.dataset.act;
    if (act === 'addEff') {
      if (c.effects.length >= 8) return;
      c.effects.push(c.type === 'item'
        ? { when: 'use', target: 'self', key: 'heal', pot: 10, cnt: 0 }
        : { when: 'hit', target: 'enemy', key: 'bleed', pot: 2, cnt: 2 });
    } else if (act === 'addCoin') {
      if (c.coins.length < MAX_COINS) c.coins.push({ power: 2, fx: [] });
    } else if (act === 'addCoinEff') {
      const list = getPath(c, b.dataset.path);
      if (list.length < 4) list.push({ when: 'heads', target: 'enemy', key: 'burn', pot: 2, cnt: 1 });
    } else if (act === 'del') {
      const parts = b.dataset.path.split('.');
      const idx = +parts.pop();
      getPath(c, parts.join('.')).splice(idx, 1);
    } else if (act === 'noimg') {
      c.img = '';
    } else if (act === 'egoOutfitColorOff') {
      c.egoFx.outfitColor = '';
    } else if (act === 'egoPreview') {
      previewEgoCine(normalizeCard(c) || c);
      return;
    }
    renderWorkshop();
  });
}

// ------------------------------------------------------------
//  캐릭터 스탯 / 나만의 키워드 편집 창 (지금 공방에서 고른 팩)
// ------------------------------------------------------------
// 효과 한 줄 (패시브·키워드 특수 효과용): 대상 / 효과 / 키워드 / 위력 / 횟수
function fxRow(e, path, dataAttr, selfLabel = '자신', enemyLabel = '상대') {
  const keys = Object.keys(EFFECT_DEFS).filter((k) => !EFFECT_DEFS[k].coinOnly && !EFFECT_DEFS[k].preRoll);
  const d = EFFECT_DEFS[e.key];
  return `<div class="eff-row">
    <select ${dataAttr}="${path}.target"><option value="enemy" ${e.target === 'enemy' ? 'selected' : ''}>${enemyLabel}</option><option value="self" ${e.target === 'self' ? 'selected' : ''}>${selfLabel}</option></select>
    <select ${dataAttr}="${path}.key">${keys.map((k) => `<option value="${k}" ${e.key === k ? 'selected' : ''}>${EFFECT_DEFS[k].label}</option>`).join('')}</select>
    ${d.kwSel ? kwSelect(d.kwSel, e.kw, `${dataAttr}="${path}.kw"`) : ''}
    ${d.pot ? `<label>${d.potLabel || '위력'} <input type="number" ${dataAttr}="${path}.pot" data-num value="${e.pot}" min="${d.signed ? -45 : 0}" max="99"></label>` : ''}
    ${d.cnt ? `<label>${d.cntLabel || '횟수'} <input type="number" ${dataAttr}="${path}.cnt" data-num value="${e.cnt}" min="0" max="99"></label>` : ''}
    <button class="btn small del" data-del="${path}" title="삭제">✕</button>
  </div>`;
}
const newFx = () => ({ when: 'use', target: 'self', key: 'poise', pot: 2, cnt: 2 });
// 효과 종류를 바꿨을 때 기본값 정리
function fixFx(e) {
  const d = EFFECT_DEFS[e.key];
  if (!d) return;
  if (d.kwSel && !kwChoices(d.kwSel).includes(e.kw)) e.kw = kwChoices(d.kwSel)[0];
  if (!d.pot) e.pot = 0; else if (!e.pot) e.pot = 2;
  if (!d.cnt) e.cnt = 0; else if (!e.cnt) e.cnt = 2;
}

function renderSheet() {
  const pk = edPack();
  pk.sheet = normalizeSheet(pk.sheet);
  const sh = pk.sheet, sum = sheetSummary(sh);
  const stepRow = (k) => {
    const [lo, hi, step, def] = SHEET_RANGE[k];
    const pts = (sh[k] - def) / step;
    return `<div class="sh-row"><span class="sh-label">${SHEET_LABEL[k]}</span>
      <input type="range" min="${lo}" max="${hi}" step="${step}" value="${sh[k]}" data-sh="${k}" data-num>
      <b class="sh-val">${sh[k]}</b><span class="sh-pts ${pts > 0 ? 'neg' : pts < 0 ? 'pos' : ''}">${pts > 0 ? '-' : pts < 0 ? '+' : ''}${Math.abs(pts)}P</span></div>`;
  };
  $('#sheet-pack').textContent = `— ${pk.name}`;
  $('#sheet-body').innerHTML = `
    <div class="sh-sum ${sum.valid ? '' : 'over'}">스탯 포인트 <b>${sum.points}</b> / ${sum.budget}
      <span class="muted small">기본값에서 올리면 포인트를 쓰고, 내리면 돌려받습니다. 상한을 넘으면 대전에 쓸 수 없습니다.</span></div>
    <h3>기본 능력치</h3>
    ${stepRow('hp')}${stepRow('sp')}${stepRow('stg')}
    <h3>내성 <span class="muted small">받는 피해 배율 — 공격 유형마다</span></h3>
    ${Object.entries(DTYPES).map(([d, v]) => {
      const cur = sh.res[d];
      return `<div class="sh-row"><span class="sh-label">${v.icon} ${v.name} 내성</span>
        <select data-sh="res.${d}" data-num>${RES_LEVELS.map(([m, nm, p]) => `<option value="${m}" ${cur === m ? 'selected' : ''}>${nm} ×${m} (${p > 0 ? '-' : p < 0 ? '+' : '±'}${Math.abs(p)}P)</option>`).join('')}</select></div>`;
    }).join('')}
    <h3>패시브 <span class="muted small">조건이 되면 자동으로 발동 (최대 ${RULES.maxPassives}개)</span></h3>
    ${sh.passives.map((ps, i) => `<div class="sh-passive">
        <select data-sh="passives.${i}.on">${Object.entries(PASSIVE_ON).map(([k, l]) => `<option value="${k}" ${ps.on === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        ${fxRow(ps.e, `passives.${i}.e`, 'data-sh').replace(`data-del="passives.${i}.e"`, `data-del="passives.${i}"`)}
        <span class="sh-pts neg">-${passiveCost(ps)}P</span>
      </div>`).join('') || '<p class="muted small">패시브 없음</p>'}
    ${sh.passives.length < RULES.maxPassives ? '<button class="btn small" data-add="passive">+ 패시브 추가</button>' : ''}`;
}

function renderKwm() {
  const pk = edPack();
  previewKeywords(pk.keywords);
  const total = pk.keywords.reduce((s, k) => s + keywordCost(k), 0);
  $('#kwm-body').innerHTML = `
    <p class="muted small">기본 키워드를 바탕으로 이름·색을 바꾸고, <b>발동할 때마다</b> 함께 나가는 특수 효과를 넣습니다.
      만든 키워드는 이 팩의 카드 효과(「나만의 키워드 부여」)와 패시브에서 쓸 수 있고, 만드는 코스트가 팩 코스트에 더해집니다.
      지금 합계 <b>${total}</b> (최대 ${RULES.maxKeywords}개)</p>
    ${pk.keywords.map((k, i) => `<div class="kwm-box">
      <div class="kwm-head">
        <span class="kwm-icon">${KEYWORDS[k.id] ? KEYWORDS[k.id].icon : kwIconHTML(k.base, k.hue)}</span>
        <input data-kw="${i}.name" maxlength="8" value="${k.name}">
        <label>기반 <select data-kw="${i}.base">${KW_BASES.map((b) => `<option value="${b}" ${k.base === b ? 'selected' : ''}>${KEYWORDS[b].emoji} ${KEYWORDS[b].name}</option>`).join('')}</select></label>
        ${k.img ? '' : `<label class="kwm-hue">색 <input type="range" min="0" max="359" value="${k.hue}" data-kw="${i}.hue" data-num></label>`}
        <label class="btn small">🖼 그림 올리기<input type="file" accept="image/*" data-kwimg="${i}" hidden></label>
        <button class="btn small" data-kwdraw="${i}">✏ 직접 그리기</button>
        ${k.img ? `<button class="btn small" data-kwnoimg="${i}">기본 아이콘</button>` : ''}
        <span class="cost-tag">코스트 ${keywordCost(k)}</span>
        <button class="btn small del" data-delkw="${i}">키워드 삭제</button>
      </div>
      <div class="muted small">${KEYWORDS[k.base].name}처럼 동작: ${KEYWORDS[k.base].desc}</div>
      <div class="kwm-fx">${k.fx.map((e, j) => fxRow(e, `${i}.fx.${j}`, 'data-kw', '보유자', '상대')).join('') || '<span class="muted small">특수 효과 없음</span>'}</div>
      ${k.fx.length < 3 ? `<button class="btn small" data-addfx="${i}">+ 발동 시 특수 효과</button>` : ''}
    </div>`).join('') || '<p class="muted">아직 만든 키워드가 없습니다.</p>'}`;
  $('#kwm-add').disabled = pk.keywords.length >= RULES.maxKeywords;
}

// ---- 키워드 아이콘 그리기 판 (96×96) ----
const DRAW = { kw: null, color: '#ff3b5c', size: 8, erase: false, last: null };
function openDrawPad(k) {
  if (!k) return;
  DRAW.kw = k;
  const cv = $('#draw-canvas'), ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  if (k.img) { const im = new Image(); im.onload = () => ctx.drawImage(im, 0, 0, cv.width, cv.height); im.src = k.img; }
  $('#draw-modal').classList.add('show');
}
function initDrawPad() {
  const cv = $('#draw-canvas'), ctx = cv.getContext('2d');
  const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * cv.width, y: ((e.clientY - r.top) / r.height) * cv.height }; };
  const stroke = (a, b) => {
    ctx.globalCompositeOperation = DRAW.erase ? 'destination-out' : 'source-over';
    ctx.strokeStyle = DRAW.color; ctx.fillStyle = DRAW.color;
    ctx.lineWidth = DRAW.size; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  };
  cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); DRAW.last = pos(e); stroke(DRAW.last, { x: DRAW.last.x + 0.1, y: DRAW.last.y }); });
  cv.addEventListener('pointermove', (e) => { if (!DRAW.last) return; const p = pos(e); stroke(DRAW.last, p); DRAW.last = p; });
  const up = () => { DRAW.last = null; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  $('#draw-color').oninput = (e) => { DRAW.color = e.target.value; DRAW.erase = false; $('#draw-erase').classList.remove('on'); };
  $('#draw-size').oninput = (e) => { DRAW.size = +e.target.value; };
  $('#draw-erase').onclick = (e) => { DRAW.erase = !DRAW.erase; e.target.classList.toggle('on', DRAW.erase); };
  $('#draw-clear').onclick = () => ctx.clearRect(0, 0, cv.width, cv.height);
  $('#draw-cancel').onclick = () => $('#draw-modal').classList.remove('show');
  $('#draw-ok').onclick = () => {
    if (DRAW.kw) DRAW.kw.img = cv.toDataURL('image/png');
    $('#draw-modal').classList.remove('show');
    renderKwm();
  };
}

function initPackExtras() {
  initDrawPad();
  const sheetM = $('#sheet-modal'), kwM = $('#kw-modal');
  const save = () => { commitPacks(); renderWorkshop(); };
  $('#ws-sheet').onclick = () => { renderSheet(); sheetM.classList.add('show'); };
  $('#ws-kw').onclick = () => { renderKwm(); kwM.classList.add('show'); };
  $('#sheet-close').onclick = () => { save(); sheetM.classList.remove('show'); };
  $('#kwm-close').onclick = () => { save(); kwM.classList.remove('show'); };
  $('#sheet-reset').onclick = () => { edPack().sheet = defaultSheet(); renderSheet(); };

  // 스탯
  const body = $('#sheet-body');
  const onSheet = (el, rerender) => {
    const path = el.dataset.sh;
    if (!path) return;
    const sh = edPack().sheet;
    setPath(sh, path, el.dataset.num !== undefined ? Number(el.value) : el.value);
    if (/\.key$/.test(path)) fixFx(getPath(sh, path.replace(/\.key$/, '')));
    edPack().sheet = normalizeSheet(sh);
    if (rerender) renderSheet();
  };
  body.addEventListener('change', (e) => onSheet(e.target, true));
  body.addEventListener('input', (e) => {
    if (e.target.type !== 'range') return;
    onSheet(e.target, false);
    const row = e.target.closest('.sh-row');
    if (row) $('.sh-val', row).textContent = e.target.value;
    const sum = sheetSummary(edPack().sheet);
    const box = $('.sh-sum', body);
    box.classList.toggle('over', !sum.valid);
    $('b', box).textContent = sum.points;
  });
  body.addEventListener('click', (e) => {
    const sh = edPack().sheet;
    if (e.target.dataset.add === 'passive' && sh.passives.length < RULES.maxPassives) sh.passives.push({ on: 'turnStart', e: newFx() });
    else if (e.target.dataset.del) { const m = e.target.dataset.del.match(/^passives\.(\d+)/); if (m) sh.passives.splice(+m[1], 1); }
    else return;
    renderSheet();
  });

  // 나만의 키워드
  const kb = $('#kwm-body');
  const onKw = (el, rerender) => {
    const path = el.dataset.kw;
    if (!path) return;
    const list = edPack().keywords;
    setPath(list, path, el.dataset.num !== undefined ? Number(el.value) : el.value);
    if (/\.key$/.test(path)) fixFx(getPath(list, path.replace(/\.key$/, '')));
    edPack().keywords = list.map(normalizeKeyword).filter(Boolean);
    if (rerender) renderKwm();
  };
  kb.addEventListener('change', async (e) => {
    if (e.target.dataset.kwimg !== undefined) {
      const f = e.target.files && e.target.files[0];
      const k = edPack().keywords[+e.target.dataset.kwimg];
      if (!f || !k) return;
      try { k.img = await shrinkIcon(f); renderKwm(); } catch { toast('그림을 읽을 수 없습니다', 'bad'); }
      return;
    }
    onKw(e.target, true);
  });
  kb.addEventListener('input', (e) => {
    if (e.target.type === 'range') { onKw(e.target, false); const ic = e.target.closest('.kwm-box'); if (ic) $('.kwm-icon', ic).innerHTML = kwIconHTML(getPath(edPack().keywords, e.target.dataset.kw.replace(/\.hue$/, '')).base, +e.target.value); }
    else if (e.target.dataset.kw && /\.name$/.test(e.target.dataset.kw)) onKw(e.target, false);
  });
  kb.addEventListener('click', (e) => {
    const list = edPack().keywords;
    const t = e.target.dataset;
    if (t.kwdraw !== undefined) { openDrawPad(list[+t.kwdraw]); return; }
    if (t.kwnoimg !== undefined) { list[+t.kwnoimg].img = ''; }
    else if (t.addfx !== undefined) { const k = list[+t.addfx]; if (k && k.fx.length < 3) k.fx.push({ ...newFx(), key: 'sp', target: 'enemy', pot: -3 }); }
    else if (t.delkw !== undefined) {
      const k = list[+t.delkw];
      if (!k || !confirm(`「${k.name}」 키워드를 지울까요? 이 키워드를 쓰는 카드 효과는 동작하지 않게 됩니다.`)) return;
      list.splice(+t.delkw, 1);
    } else if (t.del) { const m = t.del.match(/^(\d+)\.fx\.(\d+)$/); if (m) list[+m[1]].fx.splice(+m[2], 1); }
    else return;
    edPack().keywords = list.map(normalizeKeyword).filter(Boolean);
    renderKwm();
  });
  $('#kwm-add').onclick = () => {
    const pk = edPack();
    if (pk.keywords.length >= RULES.maxKeywords) return;
    pk.keywords.push(normalizeKeyword({ name: '새 키워드', base: 'bleed', hue: 200, fx: [] }));
    renderKwm();
  };
}

// 타이틀 / 멀티 로비의 팩 선택 상자 채우기
function fillPackSelect(sel) {
  if (!sel) return;
  const packs = getPacks();
  const active = getActivePack().id;
  sel.innerHTML = packs.map((p) => {
    const s = packSummary(packCards(p));
    return `<option value="${p.id}" ${p.id === active ? 'selected' : ''}>${p.name} — ${s.count}장 · 코스트 ${s.cost}${s.valid ? '' : ' (규격 외)'}</option>`;
  }).join('');
}

function updateTitleInfo() {
  fillPackSelect($('#in-pack'));
  fillPackSelect($('#mp-pack'));
  const pk = getActivePack();
  const s = packSummary(packCards(pk));
  const el = $('#custom-info');
  if (el) el.textContent = s.count ? `선택한 팩 「${pk.name}」: ${s.count}장 · 코스트 ${s.cost}/${RULES.packBudget}` : '';
}

document.addEventListener('DOMContentLoaded', () => {
  initWorkshop();
  updateTitleInfo();
  for (const id of ['#in-pack', '#mp-pack']) {
    const sel = $(id);
    if (sel) sel.addEventListener('change', (e) => { setActivePackId(e.target.value); updateTitleInfo(); if (typeof netPackChanged === 'function') netPackChanged(); });
  }
});
