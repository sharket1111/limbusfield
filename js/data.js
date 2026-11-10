// ============================================================
//  카드 데이터 — 이 파일만 고치면 카드 이름/수치/장수를 바꿀 수 있습니다.
// ============================================================
//  type   : weapon(무기) | armor(방어구) | miracle(기적) | item(도구)
//  attr   : phys(물리) | fire(화염) | frost(냉기) | light(광휘) | shadow(그림자) | all(모든 속성 — 방어구 전용)
//  count  : 덱에 들어가는 장수
//  rarity : 1 일반 / 2 희귀 / 3 전설 (테두리 색만 다름)
//
//  weapon : atk, plus(보조 무기 — 다른 무기에 덧붙일 수 있음), fx(특수효과)
//  armor  : def, fx
//  miracle: mp(소모), kind: attack|heal|cure|steal|stun|mpgain, power, fx
//  item   : kind: heal|mp|cure|draw|gamble, power
//
//  fx 목록
//    bleed      : 피해를 입힌 대상에 출혈(3턴) — 공격할 때마다 3 피해
//    burn       : 화상(3턴) — 턴 시작 시 3 피해
//    fragile    : 취약(2턴) — 방어력 절반
//    stun       : 기절 — 다음 턴 건너뜀
//    pierce     : 방어구 무시
//    lifesteal  : 준 피해의 절반만큼 회복
//    drainmp    : 대상 MP 3 흡수
//    all        : 다른 모든 플레이어 공격
//    twice      : 같은 대상에게 2회 공격
//    holy       : 공격 후 자신 HP 3 회복
//    reflect    : (방어구) 막은 피해의 절반을 공격자에게 되돌림
//    nullify    : (방어구) 공격을 완전히 무효화 (관통 제외)
// ============================================================

const ATTR = {
  phys:   { name: '물리',   color: '#c9c9c9', icon: '⚔' },
  fire:   { name: '화염',   color: '#ff7a3d', icon: '🔥' },
  frost:  { name: '냉기',   color: '#6fd3ff', icon: '❄' },
  light:  { name: '광휘',   color: '#ffe37a', icon: '✦' },
  shadow: { name: '그림자', color: '#b98cff', icon: '☾' },
  all:    { name: '전속성', color: '#7dffb3', icon: '◈' },
};

const STATUS = {
  bleed:   { name: '출혈', icon: '🩸', desc: '공격할 때마다 3 피해 (3턴)' },
  burn:    { name: '화상', icon: '🔥', desc: '턴 시작 시 3 피해 (3턴)' },
  fragile: { name: '취약', icon: '💔', desc: '방어력 절반 (2턴)' },
  stun:    { name: '기절', icon: '💫', desc: '다음 턴을 건너뜀' },
};

const FX_TEXT = {
  bleed: '출혈 부여', burn: '화상 부여', fragile: '취약 부여', stun: '기절 부여',
  pierce: '방어 무시', lifesteal: '흡혈', drainmp: 'MP 흡수 3', all: '전체 공격',
  twice: '2회 공격', holy: '자신 HP +3', reflect: '피해 절반 반사', nullify: '공격 무효화',
};

const CARDS = [
  // ---------------- 무기 ----------------
  { id: 'w_cutter',   type: 'weapon', name: '사무용 커터',        attr: 'phys',   atk: 3,  count: 4, rarity: 1, plus: true,
    flavor: '19층 서류 보관실에서 지급되는 기본 지급품.' },
  { id: 'w_notice',   type: 'weapon', name: '해고 통지서',        attr: 'phys',   atk: 4,  count: 3, rarity: 1, fx: ['bleed'],
    flavor: '종이에 베인 상처는 생각보다 오래간다.' },
  { id: 'w_hammer',   type: 'weapon', name: '결산 망치',          attr: 'phys',   atk: 6,  count: 3, rarity: 1,
    flavor: '분기 마감마다 무언가를 내려친다.' },
  { id: 'w_lantern',  type: 'weapon', name: '철야의 랜턴',        attr: 'fire',   atk: 5,  count: 3, rarity: 1, fx: ['burn'],
    flavor: '꺼지지 않는 불. 퇴근하지 못한 자들의 온기.' },
  { id: 'w_contract', type: 'weapon', name: '서리 낀 계약서',     attr: 'frost',  atk: 5,  count: 3, rarity: 1, fx: ['fragile'],
    flavor: '서명한 순간부터 손끝이 얼어붙는다.' },
  { id: 'w_mask',     type: 'weapon', name: '웃는 면접관의 가면', attr: 'shadow', atk: 4,  count: 2, rarity: 2, fx: ['drainmp'],
    flavor: '“당신의 장점을 말해 보세요.”' },
  { id: 'w_clock',    type: 'weapon', name: '멈춘 시계탑의 바늘', attr: 'phys',   atk: 8,  count: 2, rarity: 2,
    flavor: '정오에서 영원히 멈춘 시침.' },
  { id: 'w_censer',   type: 'weapon', name: '순례자의 향로',      attr: 'light',  atk: 6,  count: 2, rarity: 2, fx: ['holy'],
    flavor: '흔들 때마다 뒷골목에 성가가 울린다.' },
  { id: 'w_saw',      type: 'weapon', name: '반복 재생 톱날',     attr: 'phys',   atk: 3,  count: 2, rarity: 2, fx: ['twice'],
    flavor: '같은 장면을, 같은 상처를, 몇 번이고.' },
  { id: 'w_scythe',   type: 'weapon', name: '연체 이자의 낫',     attr: 'shadow', atk: 7,  count: 2, rarity: 2, fx: ['lifesteal'],
    flavor: '빌린 것은 반드시 피로 돌려받는다.' },
  { id: 'w_shredder', type: 'weapon', name: '폐기물 분쇄기',      attr: 'phys',   atk: 4,  count: 2, rarity: 2, fx: ['all'],
    flavor: '구역 전체를 대상으로 하는 정리 해고.' },
  { id: 'w_needle',   type: 'weapon', name: '재봉사의 바늘',      attr: 'phys',   atk: 2,  count: 3, rarity: 1, plus: true, fx: ['pierce'],
    flavor: '갑옷의 이음새만을 찾아 들어간다.' },
  { id: 'w_vine',     type: 'weapon', name: '녹슨 철조망 채찍',   attr: 'phys',   atk: 3,  count: 2, rarity: 1, plus: true, fx: ['bleed'],
    flavor: '둥지 바깥 울타리에서 뜯어 왔다.' },
  { id: 'w_bell',     type: 'weapon', name: '얼어붙은 종',        attr: 'frost',  atk: 7,  count: 1, rarity: 2, fx: ['stun'],
    flavor: '종이 울리면 모두가 그 자리에 멈춘다.' },
  { id: 'w_spear',    type: 'weapon', name: '별을 삼킨 창',       attr: 'light',  atk: 12, count: 1, rarity: 3,
    flavor: '하늘에서 별 하나가 사라진 밤, 이 창이 발견되었다.' },
  { id: 'w_furnace',  type: 'weapon', name: '심장 용광로',        attr: 'fire',   atk: 10, count: 1, rarity: 3, fx: ['burn', 'all'],
    flavor: '한 사람의 열망이 도시 한 블록을 태웠다.' },

  // ---------------- 방어구 ----------------
  { id: 'a_badge',    type: 'armor', name: '사원증 목걸이',      attr: 'all',    def: 2, count: 4, rarity: 1,
    flavor: '적어도 신원 확인은 된다.' },
  { id: 'a_suit',     type: 'armor', name: '방탄 정장',          attr: 'phys',   def: 4, count: 4, rarity: 1,
    flavor: '해결사 사무소 표준 복장.' },
  { id: 'a_coat',     type: 'armor', name: '방화 코트',          attr: 'fire',   def: 6, count: 2, rarity: 1,
    flavor: '그을음 냄새가 빠지지 않는다.' },
  { id: 'a_cloak',    type: 'armor', name: '눈보라 망토',        attr: 'frost',  def: 6, count: 2, rarity: 1,
    flavor: '추위를 추위로 막는다.' },
  { id: 'a_goggle',   type: 'armor', name: '차광 고글',          attr: 'light',  def: 6, count: 2, rarity: 1,
    flavor: '너무 밝은 것은 보지 않는 편이 낫다.' },
  { id: 'a_veil',     type: 'armor', name: '그림자 장막',        attr: 'shadow', def: 6, count: 2, rarity: 1,
    flavor: '보이지 않으면 해칠 수도 없다.' },
  { id: 'a_shield',   type: 'armor', name: '강화 진압 방패',      attr: 'phys',   def: 7, count: 2, rarity: 2,
    flavor: '경비 부서에서 몰래 가져왔다.' },
  { id: 'a_umbrella', type: 'armor', name: '찢어진 장우산',      attr: 'all',    def: 3, count: 3, rarity: 1,
    flavor: '비는 못 막아도 칼은 조금 막는다.' },
  { id: 'a_mirror',   type: 'armor', name: '되묻는 거울',        attr: 'all',    def: 4, count: 2, rarity: 2, fx: ['reflect'],
    flavor: '“그건 당신 이야기 아닌가요?”' },
  { id: 'a_charm',    type: 'armor', name: '무효 결재 도장',     attr: 'all',    def: 0, count: 1, rarity: 3, fx: ['nullify'],
    flavor: '반려. 그 공격은 없었던 일이 된다.' },

  // ---------------- 기적 ----------------
  { id: 'm_flame',    type: 'miracle', name: '소각 의식',     kind: 'attack', attr: 'fire',   mp: 3, power: 6, count: 2, rarity: 1, fx: ['burn'],
    flavor: '기밀문서와 함께.' },
  { id: 'm_frost',    type: 'miracle', name: '냉동 보관',     kind: 'attack', attr: 'frost',  mp: 3, power: 6, count: 2, rarity: 1, fx: ['fragile'],
    flavor: '나중에 처리하기로 한다.' },
  { id: 'm_judge',    type: 'miracle', name: '최종 감사',     kind: 'attack', attr: 'light',  mp: 6, power: 11, count: 1, rarity: 2,
    flavor: '모든 비리가 빛 아래 드러난다.' },
  { id: 'm_whisper',  type: 'miracle', name: '복도의 속삭임', kind: 'attack', attr: 'shadow', mp: 5, power: 5, count: 2, rarity: 2, fx: ['all'],
    flavor: '누가 먼저 시작했는지는 아무도 모른다.' },
  { id: 'm_mend',     type: 'miracle', name: '응급 봉합',     kind: 'heal',   mp: 3, power: 10, count: 3, rarity: 1,
    flavor: '흉터는 남겠지만.' },
  { id: 'm_purify',   type: 'miracle', name: '정화 절차',     kind: 'cure',   mp: 2, count: 2, rarity: 1,
    flavor: '모든 이상 상태를 초기화합니다.' },
  { id: 'm_steal',    type: 'miracle', name: '자산 압류',     kind: 'steal',  mp: 4, count: 2, rarity: 2,
    flavor: '대상의 카드 1장을 무작위로 빼앗는다.' },
  { id: 'm_stun',     type: 'miracle', name: '정신 오염',     kind: 'stun',   mp: 4, count: 2, rarity: 2,
    flavor: '대상은 다음 턴 아무것도 할 수 없다.' },

  // ---------------- 도구 ----------------
  { id: 'i_pill',     type: 'item', name: '진통제',         kind: 'heal',   power: 6,  count: 4, rarity: 1,
    flavor: '아픈 건 내일의 나에게.' },
  { id: 'i_ampoule',  type: 'item', name: '고농축 앰플',     kind: 'heal',   power: 15, count: 1, rarity: 2,
    flavor: '부작용은 서류에 적혀 있지 않다.' },
  { id: 'i_coffee',   type: 'item', name: '야근용 캔커피',   kind: 'mp',     power: 6,  count: 3, rarity: 1,
    flavor: '세 번째 캔부터 손이 떨린다.' },
  { id: 'i_antidote', type: 'item', name: '해독 키트',       kind: 'cure',             count: 2, rarity: 1,
    flavor: '대부분의 것에 효과가 있다. 대부분.' },
  { id: 'i_supply',   type: 'item', name: '보급 요청서',     kind: 'draw',   power: 2,  count: 3, rarity: 1,
    flavor: '카드 2장을 뽑는다.' },
  { id: 'i_box',      type: 'item', name: '수상한 택배 상자', kind: 'gamble',           count: 2, rarity: 2,
    flavor: '발신인 불명. 열어 볼까?' },
];

const RULES = {
  maxHp: 40,
  startMp: 8,
  maxMp: 20,
  startHand: 7,
  maxHand: 10,
  drawPerTurn: 1,
};

const CPU_NAMES = ['해결사 K', '수습사원 R', '청소부 J', '중개인 M', '사서 Q', '경비원 T', '연구원 V'];
const CPU_AVATARS = ['🦊', '🐺', '🦉', '🐍', '🦇', '🐈‍⬛', '🕷'];
