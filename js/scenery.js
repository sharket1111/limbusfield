// ============================================================
//  배경(뒷골목 일러스트)과 화면 가장자리 프레임 — 모두 코드로 그림
//  색은 css/frame.css의 테마 변수를 따름
// ============================================================
'use strict';

function seededRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function buildBackstreet() {
  const rng = seededRng(1717);
  const r = (a, b) => a + rng() * (b - a);
  const o = [];
  const HORIZON = 640;

  o.push(`<defs>
    <linearGradient id="bgSky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" class="sky-top"/><stop offset=".55" class="sky-mid"/><stop offset="1" class="sky-low"/>
    </linearGradient>
    <linearGradient id="bgSmog" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" class="smog-a" stop-opacity="0"/><stop offset=".5" class="smog-a" stop-opacity=".55"/><stop offset="1" class="smog-a" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="bgGround" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" class="ground-far"/><stop offset="1" class="ground-near"/>
    </linearGradient>
    <linearGradient id="bgCone" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" class="lamp" stop-opacity=".55"/><stop offset="1" class="lamp" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="bgGlow"><stop offset="0" class="lamp" stop-opacity=".9"/><stop offset="1" class="lamp" stop-opacity="0"/></radialGradient>
    <radialGradient id="bgVignette" cx=".5" cy=".55" r=".75">
      <stop offset=".55" class="vig" stop-opacity="0"/><stop offset="1" class="vig" stop-opacity=".85"/>
    </radialGradient>
    <filter id="bgNeon" x="-30%" y="-60%" width="160%" height="220%">
      <feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>`);

  // 하늘
  o.push('<rect width="1600" height="900" fill="url(#bgSky)"/>');

  // 먼 빌딩 숲
  const windows = (x, y, w, h, gap, chance, cls) => {
    const out = [];
    for (let wy = y + 10; wy < y + h - 6; wy += gap) {
      for (let wx = x + 5; wx < x + w - 6; wx += gap * 0.8) {
        if (rng() < chance) out.push(`<rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="${(gap * 0.35).toFixed(1)}" height="${(gap * 0.45).toFixed(1)}" class="${cls}${rng() < 0.08 ? ' flk' : ''}"/>`);
      }
    }
    return out.join('');
  };
  // 중앙의 거대한 탑
  o.push(`<g class="far2">
    <path d="M730,${HORIZON} L730,180 L760,150 L760,90 L790,70 L790,20 L810,20 L810,70 L840,90 L840,150 L870,180 L870,${HORIZON} Z"/>
    <path d="M800,20 L800,-30" stroke-width="3" class="antenna"/></g>`);
  o.push(`<circle cx="800" cy="-26" r="4" class="beacon"/>`);
  o.push(windows(735, 190, 130, HORIZON - 190, 14, 0.35, 'win2'));
  for (let i = 0; i < 22; i++) {
    const w = r(40, 120), h = r(260, 620), x = r(-40, 1600);
    if (x > 700 && x < 900) continue;
    o.push(`<rect x="${x.toFixed(0)}" y="${(HORIZON - h).toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" class="far"/>`);
    if (rng() < 0.5) {
      o.push(`<path d="M${(x + w / 2).toFixed(0)},${(HORIZON - h).toFixed(0)} l0,-${r(20, 60).toFixed(0)}" class="antenna" stroke-width="2"/>`);
      if (rng() < 0.6) o.push(`<circle cx="${(x + w / 2).toFixed(0)}" cy="${(HORIZON - h - 30).toFixed(0)}" r="2.5" class="beacon"/>`);
    }
    o.push(windows(x, HORIZON - h, w, h, 13, 0.18, 'win'));
  }
  // 스모그
  o.push(`<rect x="0" y="430" width="1600" height="300" fill="url(#bgSmog)"/>`);

  // 중간 건물
  for (let i = 0; i < 14; i++) {
    const w = r(90, 200), h = r(140, 300), x = 300 + i * 75 + r(-30, 30);
    if (x > 1250) break;
    const y = 720 - h;
    o.push(`<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" class="mid"/>`);
    if (rng() < 0.5) o.push(`<rect x="${(x + w * 0.6).toFixed(0)}" y="${(y - 26).toFixed(0)}" width="22" height="26" rx="3" class="mid"/><path d="M${(x + w * 0.6 + 4).toFixed(0)},${y} l0,-10 M${(x + w * 0.6 + 18).toFixed(0)},${y} l0,-10" class="antenna" stroke-width="2"/>`);
    o.push(windows(x, y, w, h, 18, 0.22, 'win3'));
  }

  // 골목 바닥
  o.push(`<path d="M0,900 L430,740 L1170,740 L1600,900 Z" fill="url(#bgGround)"/>`);
  o.push(`<path d="M800,742 L800,900" class="laneline" stroke-dasharray="14 18"/>`);
  // 웅덩이 (네온 반사)
  o.push(`<ellipse cx="640" cy="820" rx="120" ry="14" class="puddle p1"/><ellipse cx="1020" cy="860" rx="160" ry="16" class="puddle p2"/><ellipse cx="860" cy="770" rx="70" ry="7" class="puddle p3"/>`);

  // 왼쪽 벽
  const wallL = 'M0,0 L430,130 L430,740 L0,900 Z';
  const wallR = 'M1600,0 L1170,130 L1170,740 L1600,900 Z';
  o.push(`<path d="${wallL}" class="wall"/><path d="${wallR}" class="wall wall-r"/>`);
  // 벽돌 줄 (원근)
  for (let y = 40; y < 900; y += 42) {
    const yi = 130 + (y / 900) * 610;
    o.push(`<path d="M0,${y} L430,${yi.toFixed(0)}" class="brick"/><path d="M1600,${y} L1170,${yi.toFixed(0)}" class="brick"/>`);
  }
  // 배관
  o.push(`<path d="M70,20 L70,880 M95,30 L95,875" class="pipe"/><path d="M1520,30 L1520,875" class="pipe"/>
    <path d="M70,300 L180,330 M1520,420 L1400,444" class="pipe"/>`);
  // 실외기
  const ac = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" class="acunit"/><circle cx="${x + w * 0.35}" cy="${y + h / 2}" r="${h * 0.3}" class="acfan"/>`;
  o.push(ac(200, 430, 70, 46) + ac(1300, 520, 80, 50) + ac(310, 230, 54, 36));
  // 비상계단 (오른쪽)
  o.push(`<path d="M1230,250 L1330,232 M1230,330 L1330,314 M1230,250 L1330,314 M1230,330 L1330,396 M1230,410 L1330,396" class="rail"/>`);

  // 네온 간판
  const neon = (x, y, w, h, text, cls, vertical = false) => `<g class="neon ${cls}" filter="url(#bgNeon)">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" class="neon-box"/>
    ${vertical
      ? text.split('').map((ch, i) => `<text x="${x + w / 2}" y="${y + 30 + i * 30}" text-anchor="middle" class="neon-text">${ch}</text>`).join('')
      : `<text x="${x + w / 2}" y="${y + h / 2 + 8}" text-anchor="middle" class="neon-text">${text}</text>`}
  </g>`;
  o.push(neon(150, 290, 170, 46, '해결사 사무소', 'n1'));
  o.push(neon(250, 560, 120, 40, '뒷골목 식당', 'n4'));
  o.push(neon(1240, 450, 120, 40, '24시 수선', 'n2'));
  o.push(neon(1440, 300, 44, 130, '현금대출', 'n3', true));

  // 전선과 전구
  o.push(`<path d="M380,170 Q800,300 1220,160" class="wire"/><path d="M300,120 Q760,230 1290,110" class="wire"/>`);
  for (const [x, y] of [[560, 232], [800, 262], [1040, 228], [640, 196], [980, 192]]) {
    o.push(`<path d="M${x},${y - 14} L${x},${y}" class="wire"/><circle cx="${x}" cy="${y + 4}" r="18" fill="url(#bgGlow)" class="bulb-glow"/><circle cx="${x}" cy="${y + 4}" r="4" class="bulb"/>`);
  }

  // 가로등
  o.push(`<path d="M1110,742 L1110,430 Q1110,410 1090,410 L1050,410" class="pole"/>
    <path d="M1030,410 L1070,410 L1062,420 L1038,420 Z" class="pole-head"/>
    <path d="M1038,420 L1062,420 L1160,742 L940,742 Z" fill="url(#bgCone)"/>
    <ellipse cx="1050" cy="742" rx="110" ry="10" class="lamp-pool"/>`);
  // 쓰레기 봉투 / 상자
  o.push(`<path d="M380,760 q20,-40 50,-10 q16,30 -10,40 q-40,10 -40,-30 Z" class="junk"/>
    <rect x="1180" y="720" width="56" height="40" class="junk"/><rect x="1196" y="694" width="40" height="28" class="junk junk2"/>`);

  // 비네트
  o.push('<rect width="1600" height="900" fill="url(#bgVignette)"/>');

  return `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">${o.join('')}</svg>`;
}

function initScenery() {
  const bg = document.getElementById('bg');
  if (bg) bg.innerHTML = buildBackstreet() + '<div class="rain"></div>';
  updateFrameClock();
  setInterval(updateFrameClock, 20000);
}

// 가장자리 시계 (뒷골목의 밤이면 NIGHT)
function updateFrameClock() {
  const clock = document.getElementById('frame-clock');
  if (!clock) return;
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
  clock.textContent = `BACKSTREET · ${hh}:${mm} · ${document.body.classList.contains('night') ? 'NIGHT' : 'DUSK'}`;
}

document.addEventListener('DOMContentLoaded', initScenery);
