/** 스테이지 / 퀘스트 / 적 / 보스 / 대사 데이터 (전부 오리지널 명칭) */

export type EnemyKey = "wolf" | "minion" | "spider" | "golem" | "frostwolf" | "icegolem" | "wraith";
export type StageKey = "village" | "forest" | "alfheim" | "cave" | "niflheim" | "abyss";

/** 스토리 진행 순서 — 차원문 체인 (null = 최종 스테이지) */
export const NEXT_STAGE: Record<StageKey, StageKey | null> = {
  village: "forest",
  forest: "alfheim",
  alfheim: "cave",
  cave: "niflheim",
  niflheim: "abyss",
  abyss: null,
};

export type QuestDef = {
  id: string;
  type: "collect" | "hunt" | "reach" | "boss";
  title: string;
  desc: string;
  need?: number; // hunt 몇 마리
  /** hunt 대상 몬스터 키 (판정/안내용) */
  targetKey?: EnemyKey;
  targetLabel: string; // 가독성용 목표명
  reward?: number; // 완료 골드 보상 (2D MMORPG 기본 요소)
};

export type BossKey = "guardian" | "behemoth" | "abysslord";

export type BossDef = {
  key: BossKey;
  name: string;
  hp: number;
  atk: number;
  speed: number;
  exp: number;
  gold: number;
  /** 스프라이트/애니 접두사 (boss / boss2 / boss3) */
  tex: "boss" | "boss2" | "boss3";
  /** 투사체 구슬 틴트 */
  orbTint: number;
  /** 등장 대사 키 */
  introDialogue: string;
};

export type StageDef = {
  key: StageKey;
  name: string;
  subtitle: string;
  width: number;
  height: number;
  groundTint: number;
  flowerCount: number; // F1: 꽃 밀도 억제 — 맵당 10송이 이하
  treeCount: number;
  rockCount: number;
  quests: QuestDef[];
  enemies: { key: EnemyKey; count: number }[];
  boss: boolean;
  bossKey?: BossKey; // boss=true일 때 소환할 보스
};

export const STAGES: Record<StageKey, StageDef> = {
  village: {
    key: "village",
    name: "시작 마을",
    subtitle: "인간들의 마을",
    width: 1500,
    height: 950,
    groundTint: 0x9adf6a,
    flowerCount: 8,
    treeCount: 7,
    rockCount: 2,
    quests: [
      {
        id: "v0",
        type: "reach",
        title: "뿌리숲으로 출발",
        desc: "마을 동쪽 차원문을 지나 뿌리숲에 도착하자.",
        targetLabel: "차원문",
      },
    ],
    enemies: [],
    boss: false,
  },
  forest: {
    key: "forest",
    name: "제1지역",
    subtitle: "이그드라실 뿌리숲",
    width: 2400,
    height: 1350,
    groundTint: 0x9adf6a,
    flowerCount: 10,
    treeCount: 14,
    rockCount: 8,
    quests: [
      {
        id: "f0",
        type: "collect",
        title: "빛나는 파편 찾기",
        desc: "숲 어딘가 빛을 내는 세계수의 파편을 찾아 주워 보자.",
        targetLabel: "세계수 파편",
        reward: 40,
      },
      {
        id: "f1",
        type: "hunt",
        title: "늑대 토벌",
        desc: "뿌리숲을 어지럽히는 이그드라실 늑대 4마리를 처치하자.",
        need: 4,
        targetKey: "wolf",
        targetLabel: "늑대",
        reward: 60,
      },
      {
        id: "f2",
        type: "reach",
        title: "다음 지역으로",
        desc: "열린 차원문에 닿아 알프헤임으로 이동하자.",
        targetLabel: "차원문",
      },
    ],
    enemies: [{ key: "wolf", count: 4 }],
    boss: false,
  },
  alfheim: {
    key: "alfheim",
    name: "제2지역",
    subtitle: "알프헤임 심연 경계",
    width: 1900,
    height: 1080,
    groundTint: 0x8f7fd8,
    flowerCount: 6,
    treeCount: 10,
    rockCount: 10,
    quests: [
      {
        id: "a0",
        type: "hunt",
        title: "하수인 소탕",
        desc: "심연의 하수인 5마리를 처치해 경계를 약하게 만들자.",
        need: 5,
        targetKey: "minion",
        targetLabel: "심연 하수인",
        reward: 80,
      },
      {
        id: "a1",
        type: "boss",
        title: "심연의 수호자",
        desc: "알프헤임을 잠식한 심연의 수호자를 쓰러뜨리자!",
        targetLabel: "심연의 수호자",
        reward: 200,
      },
      {
        id: "a2",
        type: "reach",
        title: "지하로 이동",
        desc: "열린 차원문에 닿아 스바르트알프헤임 동굴로 이동하자.",
        targetLabel: "차원문",
      },
    ],
    enemies: [{ key: "minion", count: 5 }],
    boss: true,
    bossKey: "guardian",
  },
  cave: {
    key: "cave",
    name: "제3지역",
    subtitle: "스바르트알프헤임 동굴",
    width: 2100,
    height: 1200,
    groundTint: 0x8a6a4a,
    flowerCount: 0,
    treeCount: 0,
    rockCount: 14,
    quests: [
      {
        id: "c0",
        type: "collect",
        title: "동굴 깊은 곳의 파편",
        desc: "뿌리가 뚫고 내려간 동굴 어딘가에서 두 번째 파편이 빛나고 있다.",
        targetLabel: "세계수 파편",
        reward: 60,
      },
      {
        id: "c1",
        type: "hunt",
        title: "동굴 거미 소탕",
        desc: "심연에 물든 동굴 거미 6마리를 처치하자.",
        need: 6,
        targetKey: "spider",
        targetLabel: "동굴 거미",
        reward: 90,
      },
      {
        id: "c2",
        type: "reach",
        title: "설원으로 이동",
        desc: "열린 차원문에 닿아 니플헤임으로 이동하자.",
        targetLabel: "차원문",
      },
    ],
    enemies: [
      { key: "spider", count: 5 },
      { key: "golem", count: 3 },
    ],
    boss: false,
  },
  niflheim: {
    key: "niflheim",
    name: "제4지역",
    subtitle: "니플헤임 얼어붙은 뿌리",
    width: 2100,
    height: 1200,
    groundTint: 0xdfeaf8,
    flowerCount: 0,
    treeCount: 10,
    rockCount: 10,
    quests: [
      {
        id: "n0",
        type: "hunt",
        title: "서리 늑대 사냥",
        desc: "설원을 유랑하는 서리 늑대 6마리를 처치하자.",
        need: 6,
        targetKey: "frostwolf",
        targetLabel: "서리 늑대",
        reward: 130,
      },
      {
        id: "n1",
        type: "boss",
        title: "눈보라의 거수",
        desc: "얼어붙은 뿌리를 지키는 거수를 쓰러뜨리자!",
        targetLabel: "눈보라의 거수",
        reward: 280,
      },
      {
        id: "n2",
        type: "reach",
        title: "최후의 차원문",
        desc: "열린 차원문 너머 심연의 왕좌로 향하자.",
        targetLabel: "차원문",
      },
    ],
    enemies: [
      { key: "frostwolf", count: 4 },
      { key: "icegolem", count: 3 },
    ],
    boss: true,
    bossKey: "behemoth",
  },
  abyss: {
    key: "abyss",
    name: "제5지역",
    subtitle: "심연의 왕좌",
    width: 1800,
    height: 1050,
    groundTint: 0x3a2c52,
    flowerCount: 0,
    treeCount: 0,
    rockCount: 12,
    quests: [
      {
        id: "y0",
        type: "hunt",
        title: "심연 유령 소탕",
        desc: "왕좌를 지키는 심연 유령 4마리를 처치하자.",
        need: 4,
        targetKey: "wraith",
        targetLabel: "심연 유령",
        reward: 150,
      },
      {
        id: "y1",
        type: "boss",
        title: "심연의 군주",
        desc: "세계수의 마지막 파편을 삼킨 심연의 군주를 쓰러뜨리자!",
        targetLabel: "심연의 군주",
        reward: 450,
      },
    ],
    enemies: [{ key: "wraith", count: 4 }],
    boss: true,
    bossKey: "abysslord",
  },
};

export type EnemyDef = {
  key: EnemyKey;
  name: string;
  hp: number;
  atk: number;
  speed: number;
  aggro: number;
  exp: number;
  scale?: number;
  /** 골드 드롭 범위 (2D MMORPG 기본 요소) */
  gold: [number, number];
  /** 물약 드롭 확률 */
  dropHp?: number;
  dropMp?: number;
};

export const ENEMIES: Record<EnemyKey, EnemyDef> = {
  wolf: {
    key: "wolf",
    name: "이그드라실 늑대",
    hp: 34,
    atk: 8,
    speed: 128,
    aggro: 280,
    exp: 14,
    gold: [8, 14],
    dropHp: 0.3,
    dropMp: 0.2,
  },
  minion: {
    key: "minion",
    name: "심연 하수인",
    hp: 46,
    atk: 11,
    speed: 104,
    aggro: 300,
    exp: 20,
    gold: [16, 24],
    dropHp: 0.32,
    dropMp: 0.24,
  },
  spider: {
    key: "spider",
    name: "동굴 거미",
    hp: 52,
    atk: 12,
    speed: 118,
    aggro: 300,
    exp: 26,
    gold: [18, 26],
    dropHp: 0.3,
    dropMp: 0.22,
  },
  golem: {
    key: "golem",
    name: "수정 골렘",
    hp: 88,
    atk: 15,
    speed: 74,
    aggro: 240,
    exp: 38,
    gold: [26, 38],
    dropHp: 0.34,
    dropMp: 0.26,
  },
  frostwolf: {
    key: "frostwolf",
    name: "서리 늑대",
    hp: 66,
    atk: 16,
    speed: 142,
    aggro: 320,
    exp: 32,
    gold: [22, 32],
    dropHp: 0.3,
    dropMp: 0.22,
  },
  icegolem: {
    key: "icegolem",
    name: "얼음 골렘",
    hp: 100,
    atk: 18,
    speed: 70,
    aggro: 240,
    exp: 44,
    gold: [30, 42],
    dropHp: 0.34,
    dropMp: 0.26,
  },
  wraith: {
    key: "wraith",
    name: "심연 유령",
    hp: 78,
    atk: 17,
    speed: 96,
    aggro: 320,
    exp: 40,
    gold: [28, 40],
    dropHp: 0.32,
    dropMp: 0.26,
  },
};

export const BOSS_DEFS: Record<BossKey, BossDef> = {
  guardian: {
    key: "guardian",
    name: "심연의 수호자",
    hp: 640,
    atk: 15,
    speed: 92,
    exp: 220,
    gold: 200,
    tex: "boss",
    orbTint: 0x9d7aff,
    introDialogue: "bossIntroGuardian",
  },
  behemoth: {
    key: "behemoth",
    name: "눈보라의 거수",
    hp: 920,
    atk: 18,
    speed: 84,
    exp: 340,
    gold: 280,
    tex: "boss2",
    orbTint: 0x8ad4ff,
    introDialogue: "bossIntroBehemoth",
  },
  abysslord: {
    key: "abysslord",
    name: "심연의 군주",
    hp: 1300,
    atk: 22,
    speed: 98,
    exp: 520,
    gold: 450,
    tex: "boss3",
    orbTint: 0xff5a7a,
    introDialogue: "bossIntroLord",
  },
};

/* ================= 아이템 (2D MMORPG 기본 요소) ================= */

export type ItemKey =
  | "potion_hp"
  | "potion_mp"
  | "weapon_1"
  | "weapon_2"
  | "weapon_3"
  | "weapon_4"
  | "armor_1"
  | "armor_2"
  | "armor_3"
  | "armor_4"
  | "ring_power"
  | "ring_vital";

/** 아이템 등급 (클래식 MMORPG 관례 — 테두리/이름색 구분) */
export type ItemTier = "common" | "rare" | "epic";

/** 장비 강화 상한 (2D MMORPG 기본 요소 — 강화 시스템) */
export const UPGRADE_MAX = 5;
/** 강화 성공률 (%) — 현재 단계 인덱스 (0=+0→+1, … 4=+4→+5) */
export const UPGRADE_RATES = [100, 85, 70, 55, 40];
/** 강화 비용 — 무기/방어구 각 단계 기본가 */
export const UPGRADE_COST = { weapon: 45, armor: 38 } as const;

export type ItemDef = {
  key: ItemKey;
  kind: "consumable" | "weapon" | "armor" | "accessory";
  name: string;
  icon: string; // 텍스처 키
  price: number; // 상점 구매가 (0 = 판매 안 함/기본 지급)
  tier: ItemTier; // 등급 (UI 테두리/이름색)
  heal?: number; // HP 회복
  restore?: number; // MP 회복
  atk?: number; // 무기 공격력 보너스
  def?: number; // 방어구 방어력
  crit?: number; // 장신구 — 크리티컬 확률 증가 (%p)
  maxHp?: number; // 장신구 — 최대 HP 증가
};

export const ITEMS: Record<ItemKey, ItemDef> = {
  potion_hp: { key: "potion_hp", kind: "consumable", name: "HP 물약", icon: "item_potion_hp", price: 30, tier: "common", heal: 50 },
  potion_mp: { key: "potion_mp", kind: "consumable", name: "MP 물약", icon: "item_potion_mp", price: 25, tier: "common", restore: 30 },
  weapon_1: { key: "weapon_1", kind: "weapon", name: "낡은 단검", icon: "item_weapon_1", price: 0, tier: "common", atk: 0 },
  weapon_2: { key: "weapon_2", kind: "weapon", name: "강철 검", icon: "item_weapon_2", price: 110, tier: "rare", atk: 6 },
  weapon_3: { key: "weapon_3", kind: "weapon", name: "기사단 대검", icon: "item_weapon_3", price: 260, tier: "epic", atk: 14 },
  weapon_4: { key: "weapon_4", kind: "weapon", name: "심연의 대검", icon: "item_weapon_4", price: 420, tier: "epic", atk: 20 },
  armor_1: { key: "armor_1", kind: "armor", name: "여행자의 옷", icon: "item_armor_1", price: 0, tier: "common", def: 0 },
  armor_2: { key: "armor_2", kind: "armor", name: "가죽 갑옷", icon: "item_armor_2", price: 95, tier: "rare", def: 3 },
  armor_3: { key: "armor_3", kind: "armor", name: "기사단 갑옷", icon: "item_armor_3", price: 230, tier: "epic", def: 7 },
  armor_4: { key: "armor_4", kind: "armor", name: "수호자의 갑옷", icon: "item_armor_4", price: 380, tier: "epic", def: 10 },
  ring_power: { key: "ring_power", kind: "accessory", name: "힘의 반지", icon: "item_ring_power", price: 150, tier: "rare", crit: 7 },
  ring_vital: { key: "ring_vital", kind: "accessory", name: "생명의 반지", icon: "item_ring_vital", price: 130, tier: "rare", maxHp: 25 },
};

/** 강화 1단계당 보너스 */
export const UPGRADE_BONUS = { weaponAtk: 2, armorDef: 1 } as const;

/** 상점 판매 목록 (표시 순서) */
export const SHOP_STOCK: ItemKey[] = [
  "potion_hp",
  "potion_mp",
  "weapon_2",
  "armor_2",
  "weapon_3",
  "armor_3",
  "weapon_4",
  "armor_4",
  "ring_power",
  "ring_vital",
];

export type DialogueDef = { speaker: string; lines: string[] };

export const DIALOGUES: Record<string, DialogueDef> = {
  villageIntro: {
    speaker: "요정 아리",
    lines: [
      "세르츠, 드디어 모험을 떠나는 날이네!",
      "마을 동쪽 차원문을 지나면 뿌리숲이야. 세계수의 파편이 떨어졌어!",
      "출발 전에 라고스 아저씨에게 물약을 챙기면 좋아. 갔다 와!",
    ],
  },
  villager1: {
    speaker: "마을 주민",
    lines: [
      "어머, 세르츠! 드디어 모험가가 되려구?",
      "차원문 너머 숲엔 늑대들이 돌아다녀. 물약 꼭 챙기고 다녀오렴.",
    ],
  },
  villager2: {
    speaker: "마을 아이",
    lines: [
      "형아도 이제 진짜 모험가다! 부러워요.",
      "저는 마을 우물을 지키고 있을게요. 꼭 이겨요!",
    ],
  },
  intro: {
    speaker: "요정 아리",
    lines: [
      "세르츠! 봤어? 저기 하늘로 빛 기둥이 솟았어.",
      "세계수의 파편이 떨어진 거야. 파편을 찾아 주워 줘!",
      "숲이 어두우니, 빛나는 기둥과 화살표를 따라가 보자.",
    ],
  },
  fragment: {
    speaker: "세르츠",
    lines: [
      "이게… 세계수의 파편! 몸에 힘이 넘쳐흘러.",
      "공격력이 올라간 것 같아. 이제 이 검으로 숲을 지키자!",
    ],
  },
  wolvesDone: {
    speaker: "요정 아리",
    lines: [
      "늑대를 전부 처리했네! 저기 차원문이 열리고 있어!",
      "빛나는 차원문으로 들어가면 알프헤임에 도착할 거야.",
    ],
  },
  alfheimIntro: {
    speaker: "요정 아리",
    lines: [
      "알프헤임에 도착했어… 하지만 공기가 무거워.",
      "심연의 기운이야. 하수인들을 먼저 정리하자!",
    ],
  },
  bossIntroGuardian: {
    speaker: "심연의 수호자",
    lines: ["…세계수의 빛을 든 자여. 여기서 끝장내 주지."],
  },
  guardianDone: {
    speaker: "요정 아리",
    lines: [
      "수호자를 쓰러뜨렸는데도… 심연이 사라지지 않아!",
      "수호자는 경계의 문지기일 뿐이었어. 근원은 세계수 뿌리가 뚫고 내려간 더 깊은 곳…",
      "저기 새 차원문이 열렸어! 동굴에서 두 번째 파편 빛이 느껴져. 가자, 세르츠!",
    ],
  },
  caveIntro: {
    speaker: "요정 아리",
    lines: [
      "스바르트알프헤임… 세계수의 뿌리가 꿰뚫은 지하 동굴이야.",
      "어둠 속엔 심연에 물든 거미와 골렘이 돌아다녀. 조심해!",
      "파편의 빛기둥과 화살표를 따라가 보자.",
    ],
  },
  fragment2: {
    speaker: "세르츠",
    lines: [
      "두 번째 파편! 온몸에 세계수 뿌리의 힘이 스며든다…",
      "어둠이 깊어질수록 이 빛은 더 밝아져. 이제 동굴을 정리하자!",
    ],
  },
  caveDone: {
    speaker: "요정 아리",
    lines: [
      "거미들을 전부 정리했네! 동굴 반대편 차원문이 열리고 있어!",
      "저 문 너머는 니플헤임 — 세계수에서 가장 추운 뿌리 끝이야.",
    ],
  },
  niflIntro: {
    speaker: "요정 아리",
    lines: [
      "니플헤임이야… 숨만 쉴어도 몸이 얼어붙는 곳.",
      "설원의 서리 늑대들이 파편의 빛을 가리고 있어!",
      "먼저 힘을 비교해 보고, 얼어붙은 뿌리를 지키는 '그것'을 처리하자.",
    ],
  },
  bossIntroBehemoth: {
    speaker: "눈보라의 거수",
    lines: ["…이 뿌리는 이제 심연의 것이다. 얼어붙어라!"],
  },
  behemothDone: {
    speaker: "요정 아리",
    lines: [
      "거수가 무너지자 얼어붙은 차원문이 녹아나고 있어!",
      "…그런데 저 마지막 문에서 느껴지는 기운은 달라. 심연의 왕좌로 가는 길이야.",
      "마지막이야, 세르츠. 준비됐지?",
    ],
  },
  abyssIntro: {
    speaker: "요정 아리",
    lines: [
      "…여기가 심연의 왕좌야. 세계수의 마지막 파편이 저 안에 있어.",
      "왕좌를 지키는 유령들을 정리하면 군주가 나타날 거야.",
      "군주를 쓰러뜨리면 세계수의 빛이 돌아와. 부탁해, 세르츠!",
    ],
  },
  bossIntroLord: {
    speaker: "심연의 군주",
    lines: [
      "작은 파편 수집가가 여기까지 왔군…",
      "세계수의 빛도, 이 세계도 전부 심연으로 귀할 것이다!",
    ],
  },
  victory: {
    speaker: "요정 아리",
    lines: [
      "해냈어, 세르츠…! 세계수의 빛이 모든 뿌리를 따라 퍼지고 있어!",
      "동굴도, 설원도, 심연의 왕좌도 다시 빛을 되찾았어.",
      "고마워… 이 모험은 이제 진짜 전설이 될 거야!",
    ],
  },
};
