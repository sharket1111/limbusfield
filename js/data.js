// ============================================================
//  카드 데이터 — 이 파일만 고치면 카드 이름/수치/장수를 바꿀 수 있습니다.
// ============================================================
//  type   : weapon(무기) | armor(방어구) | ego(E.G.O) | item(도구) | trade(거래)
//  attr   : phys(물리) | fire(화염) | frost(냉기) | light(광휘) | shadow(그림자) | all(모든 속성 — 방어구 전용)
//  count  : 덱에 들어가는 장수
//  price  : 가격(원). 매입/매각할 때 이 값으로 거래됩니다. E.G.O는 모두 0원
//  rarity : 1 일반 / 2 희귀 / 3 전설 (테두리 색만 다름)
//
//  weapon : atk, plus(보조 무기 — 다른 무기에 덧붙일 수 있음), fx(특수효과)
//  armor  : (수비 스킬) kind: guard(가드)|evade(회피)|counter(반격), def(수비 위력), fx
//  ego    : cost(소모 정신력), kind: attack|heal|cure|steal|stun, power, fx
//  item   : kind: heal|sp|won|cure|draw|gamble, power
//  trade  : kind: buy(매입)|sell(매각)|exchange(환전) — 상대가 막을 수 없음
//
//  coins  : (선택) 코인 목록 [{ power, fx: [효과] }]. 없으면 기본 코인(RULES.coins개 × coinPower)
//  effects: (선택) 카드 효과 [{ when: use|hit, target: enemy|self, key, pot, cnt }] — 키워드는 js/keywords.js 참고
//
//  fx 목록 (특수 능력)
//    pierce     : 관통 — 가드 불가 (합·회피·반격은 가능)
//    lifesteal  : 준 피해의 절반만큼 회복
//    drainsp    : 대상 정신력 10 흡수
//    mind       : 피해를 입힌 대상의 정신력 -10
//    all        : 다른 모든 플레이어 공격
//    twice      : 같은 대상에게 2회 공격
//    holy       : 공격 후 자신 HP 5 회복
//    reflect    : (가드) 막아낸 피해의 절반을 공격자에게 되돌림
//    nullify    : (가드) 공격을 완전히 무효화 (관통 제외)
// ============================================================

const ATTR = {
  phys:   { name: '물리',   color: '#c9c9c9', icon: '⚔' },
  fire:   { name: '화염',   color: '#ff7a3d', icon: '🔥' },
  frost:  { name: '냉기',   color: '#6fd3ff', icon: '❄' },
  light:  { name: '광휘',   color: '#ffe37a', icon: '✦' },
  shadow: { name: '그림자', color: '#b98cff', icon: '☾' },
  all:    { name: '전속성', color: '#7dffb3', icon: '◈' },
};


const FX_TEXT = {
  pierce: '방어 무시', lifesteal: '흡혈', drainsp: '정신력 흡수 10', mind: '정신 피해 10', all: '전체 공격',
  twice: '2회 공격', holy: '자신 HP +5', reflect: '피해 절반 반사', nullify: '공격 무효화',
};

const CARDS = [
  // ---------------- 무기 ----------------
  { id: 'w_cutter',   type: 'weapon', name: '사무용 커터',        attr: 'phys',   atk: 5,  count: 4, price: 3, rarity: 1, plus: true,
    flavor: '19층 서류 보관실에서 지급되는 기본 지급품.' },
  { id: 'w_notice',   type: 'weapon', name: '해고 통지서',        attr: 'phys',   atk: 8,  count: 3, price: 5, rarity: 1, effects: [{ when: 'hit', target: 'enemy', key: 'bleed', pot: 3, cnt: 3 }],
    flavor: '종이에 베인 상처는 생각보다 오래간다.' },
  { id: 'w_hammer',   type: 'weapon', name: '결산 망치',          attr: 'phys',   atk: 12, count: 3, price: 6, rarity: 1, effects: [{ when: 'hit', target: 'enemy', key: 'tremor', pot: 3, cnt: 3 }],
    flavor: '분기 마감마다 무언가를 내려친다.' },
  { id: 'w_lantern',  type: 'weapon', name: '철야의 랜턴',        attr: 'fire',   atk: 10, count: 3, price: 6, rarity: 1, effects: [{ when: 'hit', target: 'enemy', key: 'burn', pot: 3, cnt: 3 }],
    flavor: '꺼지지 않는 불. 퇴근하지 못한 자들의 온기.' },
  { id: 'w_contract', type: 'weapon', name: '서리 낀 계약서',     attr: 'frost',  atk: 10, count: 3, price: 6, rarity: 1, effects: [{ when: 'hit', target: 'enemy', key: 'fragile', pot: 0, cnt: 2 }],
    flavor: '서명한 순간부터 손끝이 얼어붙는다.' },
  { id: 'w_mask',     type: 'weapon', name: '웃는 면접관의 가면', attr: 'shadow', atk: 8,  count: 2, price: 8, rarity: 2, fx: ['drainsp'], effects: [{ when: 'hit', target: 'enemy', key: 'sinking', pot: 2, cnt: 2 }],
    flavor: '“당신의 장점을 말해 보세요.”' },
  { id: 'w_clock',    type: 'weapon', name: '멈춘 시계탑의 바늘', attr: 'phys',   atk: 16, count: 2, price: 10, rarity: 2, effects: [{ when: 'hit', target: 'enemy', key: 'rupture', pot: 2, cnt: 2 }],
    flavor: '정오에서 영원히 멈춘 시침.' },
  { id: 'w_censer',   type: 'weapon', name: '순례자의 향로',      attr: 'light',  atk: 12, count: 2, price: 8, rarity: 2, fx: ['holy'],
    flavor: '흔들 때마다 뒷골목에 성가가 울린다.' },
  { id: 'w_saw',      type: 'weapon', name: '반복 재생 톱날',     attr: 'phys',   atk: 6,  count: 2, price: 6, rarity: 2, fx: ['twice'],
    coins: [{ power: 2, fx: [{ when: 'heads', target: 'enemy', key: 'rupture', pot: 1, cnt: 1 }] }, { power: 2, fx: [{ when: 'heads', target: 'enemy', key: 'rupture', pot: 1, cnt: 1 }] }, { power: 2, fx: [{ when: 'heads', target: 'enemy', key: 'rupture', pot: 1, cnt: 1 }] }],
    flavor: '같은 장면을, 같은 상처를, 몇 번이고.' },
  { id: 'w_scythe',   type: 'weapon', name: '연체 이자의 낫',     attr: 'shadow', atk: 14, count: 2, price: 10, rarity: 2, fx: ['lifesteal'], effects: [{ when: 'hit', target: 'enemy', key: 'sinking', pot: 3, cnt: 2 }],
    flavor: '빌린 것은 반드시 피로 돌려받는다.' },
  { id: 'w_shredder', type: 'weapon', name: '폐기물 분쇄기',      attr: 'phys',   atk: 8,  count: 2, price: 8, rarity: 2, fx: ['all'],
    flavor: '구역 전체를 대상으로 하는 정리 해고.' },
  { id: 'w_needle',   type: 'weapon', name: '재봉사의 바늘',      attr: 'phys',   atk: 4,  count: 3, price: 4, rarity: 1, plus: true, fx: ['pierce'],
    flavor: '갑옷의 이음새만을 찾아 들어간다.' },
  { id: 'w_vine',     type: 'weapon', name: '녹슨 철조망 채찍',   attr: 'phys',   atk: 6,  count: 2, price: 4, rarity: 1, plus: true, effects: [{ when: 'hit', target: 'enemy', key: 'bleed', pot: 2, cnt: 2 }],
    flavor: '둥지 바깥 울타리에서 뜯어 왔다.' },
  { id: 'w_plate',    type: 'weapon', name: '도금된 명패',        attr: 'phys',   atk: 2,  count: 2, price: 20, rarity: 2,
    flavor: '휘두르기엔 볼품없지만, 팔면 꽤 값이 나간다.' },
  { id: 'w_tray',     type: 'weapon', name: '은박 결재판',        attr: 'phys',   atk: 2,  count: 2, price: 12, rarity: 1,
    flavor: '결재 서류보다 판 자체가 더 비싸다.' },
  { id: 'w_gavel',    type: 'weapon', name: '판결의 의사봉',      attr: 'phys',   atk: 10, count: 2, price: 7, rarity: 2, fx: ['mind'], effects: [{ when: 'hit', target: 'enemy', key: 'tremorBurst', pot: 0, cnt: 0 }],
    flavor: '탕, 탕, 탕. 세 번 울리면 누구든 고개를 숙인다.' },
  { id: 'w_baton',    type: 'weapon', name: '과충전 경찰봉',      attr: 'phys',   atk: 8,  count: 2, price: 8, rarity: 2,
    effects: [{ when: 'use', target: 'self', key: 'charge', pot: 0, cnt: 4 }],
    coins: [{ power: 2, fx: [] }, { power: 2, fx: [{ when: 'use', target: 'self', key: 'chargeBoost', pot: 6, cnt: 3 }] }],
    flavor: '스위치를 누를 때마다 손잡이가 뜨거워진다.' },
  { id: 'w_dagger',   type: 'weapon', name: '숨 고르는 단검',     attr: 'phys',   atk: 6,  count: 2, price: 6, rarity: 1,
    effects: [{ when: 'use', target: 'self', key: 'poise', pot: 3, cnt: 3 }],
    coins: [{ power: 2, fx: [] }, { power: 2, fx: [] }, { power: 2, fx: [{ when: 'heads', target: 'self', key: 'poise', pot: 2, cnt: 1 }] }],
    flavor: '들이쉬고, 내쉬고, 찌른다.' },
  { id: 'w_shears',   type: 'weapon', name: '검붉은 재단 가위',   attr: 'phys',   atk: 8,  count: 2, price: 7, rarity: 2,
    coins: [
      { power: 3, fx: [{ when: 'use', target: 'self', key: 'pwrIfKw', kw: 'bleed', pot: 3, cnt: 0 }] },
      { power: 3, fx: [{ when: 'heads', target: 'enemy', key: 'bleed', pot: 2, cnt: 2 }] },
      { power: 3, fx: [{ when: 'hit', target: 'enemy', key: 'kwBurst', kw: 'bleed', pot: 0, cnt: 0 }] },
    ],
    flavor: '피가 묻은 천일수록 더 깔끔하게 잘린다.' },
  { id: 'w_dun',      type: 'weapon', name: '끝없는 독촉장',      attr: 'shadow', atk: 6,  count: 2, price: 6, rarity: 2,
    coins: [
      { power: 2, fx: [{ when: 'use', target: 'self', key: 'reuse', pot: 0, cnt: 2 }] },
      { power: 2, fx: [{ when: 'use', target: 'self', key: 'pwrOneSided', pot: 4, cnt: 0 }] },
      { power: 2, fx: [{ when: 'heads', target: 'enemy', key: 'stealWon', pot: 5, cnt: 0 }] },
    ],
    flavor: '갚을 때까지, 몇 번이고 다시 찾아온다.' },
  { id: 'w_crowbar',  type: 'weapon', name: '해체 작업용 쇠지레', attr: 'phys',   atk: 9,  count: 2, price: 6, rarity: 1,
    coins: [
      { power: 3, fx: [{ when: 'use', target: 'self', key: 'pwrClash', pot: 3, cnt: 0 }] },
      { power: 3, fx: [{ when: 'heads', target: 'enemy', key: 'breakArmor', pot: 0, cnt: 0 }] },
    ],
    flavor: '방패든 갑옷이든, 이음새부터 뜯어낸다.' },
  { id: 'w_bell',     type: 'weapon', name: '얼어붙은 종',        attr: 'frost',  atk: 14, count: 1, price: 10, rarity: 2, effects: [{ when: 'hit', target: 'enemy', key: 'stun', pot: 0, cnt: 0 }],
    flavor: '종이 울리면 모두가 그 자리에 멈춘다.' },
  { id: 'w_spear',    type: 'weapon', name: '별을 삼킨 창',       attr: 'light',  atk: 24, count: 1, price: 20, rarity: 3,
    coins: [{ power: 4, fx: [] }, { power: 4, fx: [] }], effects: [{ when: 'use', target: 'self', key: 'poise', pot: 3, cnt: 2 }],
    flavor: '하늘에서 별 하나가 사라진 밤, 이 창이 발견되었다.' },
  { id: 'w_furnace',  type: 'weapon', name: '심장 용광로',        attr: 'fire',   atk: 18, count: 1, price: 20, rarity: 3, fx: ['all'], effects: [{ when: 'hit', target: 'enemy', key: 'burn', pot: 4, cnt: 3 }],
    flavor: '한 사람의 열망이 도시 한 블록을 태웠다.' },

  // ---------------- 방어구 ----------------
  { id: 'a_badge',    type: 'armor', kind: 'guard', name: '사원증 목걸이',      attr: 'all',    def: 4,  count: 5, price: 2, rarity: 1,
    flavor: '적어도 신원 확인은 된다.' },
  { id: 'a_suit',     type: 'armor', kind: 'guard', name: '방탄 정장',          attr: 'phys',   def: 8,  count: 6, price: 4, rarity: 1,
    flavor: '해결사 사무소 표준 복장.' },
  { id: 'a_coat',     type: 'armor', kind: 'guard', name: '방화 코트',          attr: 'fire',   def: 12, count: 3, price: 6, rarity: 1,
    flavor: '그을음 냄새가 빠지지 않는다.' },
  { id: 'a_cloak',    type: 'armor', kind: 'evade', name: '눈보라 망토',        attr: 'frost',  def: 12, count: 3, price: 6, rarity: 1,
    flavor: '추위를 추위로 막는다.' },
  { id: 'a_goggle',   type: 'armor', kind: 'counter', name: '차광 고글',          attr: 'light',  def: 12, count: 3, price: 6, rarity: 1,
    flavor: '너무 밝은 것은 보지 않는 편이 낫다.' },
  { id: 'a_veil',     type: 'armor', kind: 'evade', name: '그림자 장막',        attr: 'shadow', def: 12, count: 3, price: 6, rarity: 1,
    flavor: '보이지 않으면 해칠 수도 없다.' },
  { id: 'a_shield',   type: 'armor', kind: 'guard', name: '강화 진압 방패',      attr: 'phys',   def: 14, count: 3, price: 8, rarity: 2,
    flavor: '경비 부서에서 몰래 가져왔다.' },
  { id: 'a_umbrella', type: 'armor', kind: 'guard', name: '찢어진 장우산',      attr: 'all',    def: 6,  count: 4, price: 3, rarity: 1,
    flavor: '비는 못 막아도 칼은 조금 막는다.' },
  { id: 'a_mirror',   type: 'armor', kind: 'guard', name: '되묻는 거울',        attr: 'all',    def: 8,  count: 2, price: 10, rarity: 2, fx: ['reflect'],
    flavor: '“그건 당신 이야기 아닌가요?”' },
  { id: 'a_charm',    type: 'armor', kind: 'guard', name: '무효 결재 도장',     attr: 'all',    def: 0,  count: 1, price: 15, rarity: 3, fx: ['nullify'],
    flavor: '반려. 그 공격은 없었던 일이 된다.' },
  { id: 'd_step',     type: 'armor', kind: 'evade',   name: '뒷걸음질 스텝',     attr: 'all',    def: 9,  count: 3, price: 4, rarity: 1,
    flavor: '맞서지 않는다. 그저 반 발짝 물러설 뿐.' },
  { id: 'd_parry',    type: 'armor', kind: 'counter', name: '받아치기 자세',     attr: 'phys',   def: 11, count: 3, price: 6, rarity: 1,
    flavor: '들어오는 힘을 그대로 돌려준다.' },
  { id: 'd_ember',    type: 'armor', kind: 'counter', name: '불씨 되받기',       attr: 'fire',   def: 10, count: 2, price: 6, rarity: 2,
    effects: [{ when: 'hit', target: 'enemy', key: 'burn', pot: 3, cnt: 2 }],
    flavor: '불은 불로 갚는다.' },
  { id: 'd_mist',     type: 'armor', kind: 'evade',   name: '안개 걸음',         attr: 'all',    def: 7,  count: 2, price: 5, rarity: 2,
    coins: [{ power: 3, fx: [] }, { power: 3, fx: [] }, { power: 3, fx: [{ when: 'heads', target: 'self', key: 'poise', pot: 2, cnt: 1 }] }],
    flavor: '골목 안개 속으로 녹아든다.' },

  // ---------------- E.G.O (정신력 소모) ----------------
  { id: 'e_flame',    type: 'ego', name: '소각 의식',     kind: 'attack', attr: 'fire',   cost: 10, power: 12, count: 2, price: 0, rarity: 1, effects: [{ when: 'hit', target: 'enemy', key: 'burn', pot: 4, cnt: 2 }],
    flavor: '기밀문서와 함께.' },
  { id: 'e_frost',    type: 'ego', name: '냉동 보관',     kind: 'attack', attr: 'frost',  cost: 10, power: 12, count: 2, price: 0, rarity: 1, effects: [{ when: 'hit', target: 'enemy', key: 'fragile', pot: 0, cnt: 2 }],
    flavor: '나중에 처리하기로 한다.' },
  { id: 'e_judge',    type: 'ego', name: '최종 감사',     kind: 'attack', attr: 'light',  cost: 20, power: 22, count: 1, price: 0, rarity: 2,
    flavor: '모든 비리가 빛 아래 드러난다.' },
  { id: 'e_whisper',  type: 'ego', name: '복도의 속삭임', kind: 'attack', attr: 'shadow', cost: 15, power: 10, count: 2, price: 0, rarity: 2, fx: ['all', 'mind'],
    flavor: '누가 먼저 시작했는지는 아무도 모른다.' },
  { id: 'e_mend',     type: 'ego', name: '응급 봉합',     kind: 'heal',   cost: 10, power: 20, count: 3, price: 0, rarity: 1,
    flavor: '흉터는 남겠지만.' },
  { id: 'e_purify',   type: 'ego', name: '정화 절차',     kind: 'cure',   cost: 5, count: 2, price: 0, rarity: 1,
    flavor: '모든 이상 상태를 초기화합니다.' },
  { id: 'e_steal',    type: 'ego', name: '자산 압류',     kind: 'steal',  cost: 12, count: 2, price: 0, rarity: 2,
    flavor: '대상의 카드 1장을 무작위로 빼앗는다.' },
  { id: 'e_stun',     type: 'ego', name: '정신 오염',     kind: 'stun',   cost: 12, count: 2, price: 0, rarity: 2,
    flavor: '대상은 다음 턴 아무것도 할 수 없다. (대상 정신력 -10)' },

  // ---------------- 도구 ----------------
  { id: 'i_pill',     type: 'item', name: '진통제',         kind: 'heal',   power: 12, count: 4, price: 4, rarity: 1,
    flavor: '아픈 건 내일의 나에게.' },
  { id: 'i_ampoule',  type: 'item', name: '고농축 앰플',     kind: 'heal',   power: 30, count: 1, price: 12, rarity: 2,
    flavor: '부작용은 서류에 적혀 있지 않다.' },
  { id: 'i_coffee',   type: 'item', name: '야근용 캔커피',   kind: 'sp',     power: 10, count: 3, price: 3, rarity: 1,
    flavor: '세 번째 캔부터 손이 떨린다.' },
  { id: 'i_calm',     type: 'item', name: '안정제 패치',     kind: 'sp',     power: 20, count: 2, price: 6, rarity: 1,
    flavor: '붙이는 순간 세상이 조금 조용해진다.' },
  { id: 'i_wallet',   type: 'item', name: '주운 지갑',       kind: 'won',    power: 20, count: 2, price: 10, rarity: 1,
    flavor: '주인은 아마 더 이상 필요 없을 것이다.' },
  { id: 'i_antidote', type: 'item', name: '해독 키트',       kind: 'cure',             count: 2, price: 4, rarity: 1,
    flavor: '대부분의 것에 효과가 있다. 대부분.' },
  { id: 'i_supply',   type: 'item', name: '보급 요청서',     kind: 'draw',   power: 2,  count: 3, price: 4, rarity: 1,
    flavor: '카드 2장을 뽑는다.' },
  { id: 'i_box',      type: 'item', name: '수상한 택배 상자', kind: 'gamble',           count: 2, price: 5, rarity: 2,
    flavor: '발신인 불명. 열어 볼까?' },

  // ---------------- 거래 (막을 수 없음) ----------------
  { id: 't_buy',      type: 'trade', name: '매입 계약서',     kind: 'buy',      count: 3, price: 5, rarity: 1,
    flavor: '상대 손패에서 무작위로 1장을 보고, 그 가격을 내고 사들일지 고른다.' },
  { id: 't_sell',     type: 'trade', name: '강매 영수증',     kind: 'sell',     count: 3, price: 5, rarity: 1,
    flavor: '내 카드 1장을 상대에게 강제로 판다. 돈이 없으면 정신력, 그다음 HP로 받아낸다.' },
  { id: 't_exchange', type: 'trade', name: '환전소 번호표',   kind: 'exchange', count: 3, price: 8, rarity: 2,
    flavor: 'HP·정신력·돈을 1:1로 자유롭게 다시 나눈다. 합계는 그대로.' },
];

// ---------------- 뒷골목의 밤 이벤트 ----------------
// 밤이 되면 카드를 뽑을 때 일정 확률로 아래 이벤트가 대신 나옵니다 (손패에 들어가지 않고 즉시 발동).
const NIGHT_EVENTS = {
  sweeper: { name: '청소부', icon: '🧹', weight: 6, damages: [10, 20, 30],
    flavor: '밤의 뒷골목에서는 아무도 살아남지 못한다.' },
  fuel:    { name: '연료통', icon: '🛢', weight: 4, gains: [['hp', 10], ['sp', 10], ['won', 10]],
    flavor: '청소부들이 흘리고 간 것. 무언가에 쓸 수 있다.' },
};

const RULES = {
  maxHp: 100,
  startHand: 7,
  maxHand: 10,
  drawPerTurn: 1,
  // 정신력
  minSp: -45,
  maxSp: 45,
  // 합 (무기 vs 방어구)
  coins: 3,          // 공격·방어 양쪽이 던지는 코인 수
  coinPower: 2,      // 앞면 1개당 위력
  // 돈 (매입·매각·환전에 사용)
  startWon: 20,
  maxWon: 99,
  // 뒷골목의 밤
  nightTurn: 100,    // 이 턴(모든 플레이어 턴 합산)부터 밤 시작
  nightChance: 0.3,  // 밤에 카드를 뽑을 때 이벤트가 나올 확률
  // 흐트러짐
  staggerMax: 40,    // 흐트러짐 게이지 (피격 피해만큼 감소, 0이 되면 흐트러짐)
  staggerRegen: 5,   // 자기 턴 시작 시 회복량
  staggerMult: 1.5,  // 흐트러짐 상태에서 받는 피해 배율
  // 카드팩 / 코스트
  packBudget: 150,   // 팩 코스트 상한 (카드 코스트 × 장수의 합)
  packMin: 20,       // 개인 덱으로 쓰려면 필요한 최소 장수
  // 멀티
  turnTimeout: 90,   // 원격 플레이어 턴 제한 시간(초) — 넘기면 자동 기도
  defendTimeout: 40, // 방어 선택 제한 시간(초) — 넘기면 그대로 받기
};

const CPU_NAMES = ['해결사 K', '수습사원 R', '배달부 J', '중개인 M', '사서 Q', '경비원 T', '연구원 V'];
const CPU_AVATARS = ['🦊', '🐺', '🦉', '🐍', '🦇', '🐈‍⬛', '🕷'];
