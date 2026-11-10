// ============================================================
//  카드 공방 — 웹에서 직접 카드를 만들고 저장 (브라우저 localStorage)
// ============================================================
'use strict';

const CUSTOM_KEY = 'af_custom_cards';
const TYPES = ['weapon', 'armor', 'ego', 'item'];
const MAX_COINS = 6;

// ---------------- 저장 / 불러오기 ----------------
function getCustomCards() {
  try {
    const raw = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]');
    return Array.isArray(raw) ? raw.map(normalizeCard).filter(Boolean) : [];
  } catch { return []; }
}

function saveCustomCards(list) {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
    return true;
  } catch {
    toast('저장 공간이 부족합니다. 이미지가 큰 카드를 줄이거나 지워 주세요.', 'bad');
    return false;
  }
}

// ---------------- 검증 (가져온 JSON도 이걸 거침) ----------------
const cleanText = (v, max) => String(v == null ? '' : v).replace(/[<>&"'`\\]/g, '').slice(0, max);
const num = (v, lo, hi, def = 0) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def;
};
const IMG_RE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

function normalizeEffect(e, coin = false) {
  if (!e || !EFFECT_DEFS[e.key]) return null;
  if (EFFECT_DEFS[e.key].coinOnly && !coin) return null;
  const when = e.key === 'chargeBoost' ? 'use' : ['use', 'hit', 'heads'].includes(e.when) ? e.when : 'hit';
  return {
    when: !coin && when === 'heads' ? 'hit' : when,
    target: e.target === 'self' ? 'self' : 'enemy',
    key: e.key,
    pot: num(e.pot, EFFECT_DEFS[e.key].signed ? -45 : 0, 99),
    cnt: num(e.cnt, 0, 99),
  };
}

function normalizeCard(c) {
  if (!c || !TYPES.includes(c.type)) return null;
  const out = {
    id: /^c_[a-z0-9_]+$/i.test(c.id || '') ? c.id : 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    custom: true,
    enabled: c.enabled !== false,
    type: c.type,
    name: cleanText(c.name, 20) || '이름 없는 카드',
    flavor: cleanText(c.flavor, 80),
    price: num(c.price, 0, 99, 5),
    count: num(c.count, 1, 5, 1),
    rarity: num(c.rarity, 1, 3, 1),
    img: typeof c.img === 'string' && IMG_RE.test(c.img) ? c.img : '',
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
  if (c.type === 'armor') out.def = num(c.def, 0, 60, 8);
  if (c.type === 'ego') { out.kind = 'attack'; out.power = num(c.power, 0, 60, 10); out.cost = num(c.cost, 0, 45, 10); }
  if (c.type === 'item') out.kind = 'custom';
  return out;
}

function templateCard(type, keep = {}) {
  const base = { name: keep.name || '새 카드', img: keep.img || '', flavor: keep.flavor || '', price: keep.price ?? 5,
    count: keep.count ?? 2, rarity: keep.rarity ?? 1, id: keep.id, enabled: keep.enabled !== false };
  const coins3 = () => [0, 1, 2].map(() => ({ power: 2, fx: [] }));
  if (type === 'weapon') return normalizeCard({ ...base, type, attr: 'phys', atk: 8, coins: coins3(), fx: [], effects: [] });
  if (type === 'armor') return normalizeCard({ ...base, type, attr: 'phys', def: 8, coins: [], fx: [], effects: [] });
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
const ED = { list: [], cur: null };

function openWorkshop() {
  ED.list = getCustomCards();
  ED.cur = ED.list[0] ? JSON.parse(JSON.stringify(ED.list[0])) : templateCard('weapon');
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
  // ctx: card | coin, type: 카드 종류
  const armor = ED.cur.type === 'armor';
  const W = armor ? WHEN_TEXT_ARMOR : WHEN_TEXT;
  let whens;
  if (ED.cur.type === 'item') whens = ['use'];
  else if (ctx === 'coin') whens = ['hit', 'heads'];
  else whens = ['use', 'hit'];
  const keys = Object.keys(EFFECT_DEFS).filter((k) => ctx === 'coin' || !EFFECT_DEFS[k].coinOnly);
  const d = EFFECT_DEFS[e.key];
  const isBoost = e.key === 'chargeBoost';
  return `<div class="eff-row">
    ${isBoost ? '<span class="eff-fixed">사용 시</span>' : `<select data-f="${path}.when">${whens.map((w) => `<option value="${w}" ${e.when === w ? 'selected' : ''}>${W[w]}</option>`).join('')}</select>`}
    ${isBoost ? '' : `<select data-f="${path}.target"><option value="enemy" ${e.target === 'enemy' ? 'selected' : ''}>${armor ? '공격자' : '상대'}</option><option value="self" ${e.target === 'self' ? 'selected' : ''}>자신</option></select>`}
    <select data-f="${path}.key">${keys.map((k) => `<option value="${k}" ${e.key === k ? 'selected' : ''}>${EFFECT_DEFS[k].label}</option>`).join('')}</select>
    ${d.pot ? `<label>${d.potLabel || '위력'} <input type="number" data-f="${path}.pot" data-num value="${e.pot}" min="${d.signed ? -45 : 0}" max="99"></label>` : ''}
    ${d.cnt ? `<label>${d.cntLabel || '횟수'} <input type="number" data-f="${path}.cnt" data-num value="${e.cnt}" min="0" max="99"></label>` : ''}
    <button class="btn small del" data-act="del" data-path="${path}" title="삭제">✕</button>
  </div>`;
}

function renderWorkshop() {
  const c = ED.cur;
  // 왼쪽: 내 카드 목록
  $('#ws-list').innerHTML = ED.list.length
    ? ED.list.map((x) => `<div class="ws-item ${x.id === c.id ? 'cur' : ''}" data-id="${x.id}">
        ${cardHTML(x)}
        <label class="ws-on"><input type="checkbox" data-toggle="${x.id}" ${x.enabled !== false ? 'checked' : ''}> 덱에 넣기 ×${x.count}</label>
      </div>`).join('')
    : '<p class="muted">아직 만든 카드가 없습니다.<br>오른쪽에서 만들고 저장하세요.</p>';

  const t = c.type;
  const attrs = t === 'armor' ? Object.keys(ATTR) : Object.keys(ATTR).filter((k) => k !== 'all');
  const fxOpts = { weapon: [['all', '전체 공격'], ['pierce', '관통 (방어 무시)'], ['twice', '2회 공격'], ['lifesteal', '흡혈']],
    ego: [['all', '전체 공격'], ['pierce', '관통 (방어 무시)']], armor: [['reflect', '반사 (합 승리 시 절반 반사)']], item: [] }[t];
  const statLabel = { weapon: '공격력', armor: '방어력', ego: '위력' }[t];
  const statKey = { weapon: 'atk', armor: 'def', ego: 'power' }[t];

  $('#ws-form').innerHTML = `
    <div class="ws-grid">
      <label>이름 <input data-f="name" maxlength="20" value="${c.name}"></label>
      <label>종류
        <select data-f="type" data-struct>${TYPES.map((x) => `<option value="${x}" ${t === x ? 'selected' : ''}>${TYPE_NAME[x]}</option>`).join('')}</select>
      </label>
      ${t !== 'item' ? `<label>속성
        <select data-f="attr">${attrs.map((k) => `<option value="${k}" ${c.attr === k ? 'selected' : ''}>${ATTR[k].icon} ${ATTR[k].name}</option>`).join('')}</select>
      </label>` : ''}
      ${statKey ? `<label>${statLabel} <input type="number" data-f="${statKey}" data-num min="0" max="60" value="${c[statKey]}"></label>` : ''}
      ${t === 'ego' ? `<label>소모 정신력 <input type="number" data-f="cost" data-num min="0" max="45" value="${c.cost}"></label>` : ''}
      <label>가격(원) <input type="number" data-f="price" data-num min="0" max="99" value="${c.price}"></label>
      <label>덱 장수 <input type="number" data-f="count" data-num min="1" max="5" value="${c.count}"></label>
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

    <h3>${t === 'item' ? '사용 효과' : '카드 효과'} <span class="muted small">${t === 'armor' ? '방어 시 / 방어 성공 시' : t === 'item' ? '사용하면 바로 발동' : '사용 시 / 적중 시'}</span></h3>
    <div class="eff-list">${c.effects.map((e, i) => effectRow(e, `effects.${i}`, 'card')).join('') || '<p class="muted small">효과 없음</p>'}</div>
    <button class="btn small" data-act="addEff" data-path="effects">+ 효과 추가</button>

    ${t !== 'item' ? `
    <h3>코인 <span class="muted small">${t === 'armor'
      ? `기본 방어 코인 ${RULES.coins}개(+${RULES.coinPower})에 더해 던지는 코인`
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
    <div class="ws-prev-text"><b>${c.name}</b><div class="muted small">${d.head}</div>
      <div class="fx-lines">${d.lines.map((l) => `<span>${l}</span>`).join('')}</div>
      <div class="flavor">${c.flavor || ''}</div></div>`;
}

function wsSave() {
  const c = normalizeCard(ED.cur);
  if (!c) return;
  const i = ED.list.findIndex((x) => x.id === c.id);
  const next = [...ED.list];
  if (i >= 0) next[i] = c; else next.push(c);
  if (!saveCustomCards(next)) return;
  ED.list = next;
  ED.cur = JSON.parse(JSON.stringify(c));
  toast(`「${c.name}」 저장 완료`);
  renderWorkshop();
}

function initWorkshop() {
  $('#btn-workshop').onclick = openWorkshop;
  $('#ws-back').onclick = closeWorkshop;
  $('#ws-new').onclick = () => { ED.cur = templateCard('weapon'); renderWorkshop(); };
  $('#ws-save').onclick = wsSave;
  $('#ws-copy').onclick = () => {
    ED.cur = normalizeCard({ ...JSON.parse(JSON.stringify(ED.cur)), id: '', name: ED.cur.name + ' 사본' });
    renderWorkshop();
    toast('사본을 만들었습니다. 저장해야 목록에 추가됩니다.');
  };
  $('#ws-del').onclick = () => {
    const i = ED.list.findIndex((x) => x.id === ED.cur.id);
    if (i < 0) { ED.cur = templateCard('weapon'); renderWorkshop(); return; }
    if (!confirm(`「${ED.list[i].name}」을(를) 삭제할까요?`)) return;
    const next = ED.list.filter((_, k) => k !== i);
    if (!saveCustomCards(next)) return;
    ED.list = next;
    ED.cur = next[0] ? JSON.parse(JSON.stringify(next[0])) : templateCard('weapon');
    renderWorkshop();
  };
  $('#ws-export').onclick = () => {
    const blob = new Blob([JSON.stringify(ED.list, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'anomaly-field-cards.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $('#ws-import').onchange = async (ev) => {
    const f = ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const cards = (Array.isArray(data) ? data : []).map(normalizeCard).filter(Boolean);
      if (!cards.length) { toast('불러올 카드가 없습니다', 'bad'); return; }
      const ids = new Set(ED.list.map((x) => x.id));
      const merged = [...ED.list, ...cards.map((x) => (ids.has(x.id) ? { ...x, id: 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) } : x))];
      if (!saveCustomCards(merged)) return;
      ED.list = merged;
      toast(`카드 ${cards.length}장을 불러왔습니다`);
      renderWorkshop();
    } catch {
      toast('JSON 파일을 읽을 수 없습니다', 'bad');
    }
  };

  // 목록 클릭 / 덱 포함 토글
  $('#ws-list').addEventListener('click', (ev) => {
    const tg = ev.target.closest('[data-toggle]');
    if (tg) {
      const x = ED.list.find((k) => k.id === tg.dataset.toggle);
      if (x) { x.enabled = tg.checked; saveCustomCards(ED.list); if (ED.cur.id === x.id) ED.cur.enabled = x.enabled; }
      return;
    }
    const item = ev.target.closest('.ws-item');
    if (item) {
      const x = ED.list.find((k) => k.id === item.dataset.id);
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
        if (e.key === 'chargeBoost') { e.when = 'use'; e.target = 'self'; e.pot = e.pot || 4; e.cnt = e.cnt || 3; }
        else if (e.when === 'use' && /^coins/.test(el.dataset.f)) e.when = 'hit';
        if (!d.pot) e.pot = 0;
        if (!d.cnt) e.cnt = 0;
        if (d.pot && !e.pot) e.pot = 2;
        if (d.cnt && !e.cnt) e.cnt = 2;
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
    }
    renderWorkshop();
  });
}

function updateTitleInfo() {
  const list = getCustomCards().filter((c) => c.enabled !== false);
  const n = list.reduce((s, c) => s + c.count, 0);
  const el = $('#custom-info');
  if (el) el.textContent = list.length ? `내 카드 ${list.length}종 (${n}장) 덱에 포함` : '';
}

document.addEventListener('DOMContentLoaded', () => { initWorkshop(); updateTitleInfo(); });
