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
  type: "collect" | "hunt" | "reach" | "boss" | "talk";
  title: string;
  desc: string;
  need?: number; // hunt 몇 마리 / talk 몇 명
  /** hunt 대상 몬스터 키 (판정/안내용) */
  targetKey?: EnemyKey;
  targetLabel: string; // 가독성용 목표명
  reward?: number; // 완료 골드 보상 (2D MMORPG 기본 요소)
  /** 완료 경험치 보상 — 장기 성장 곡선의 핵심 지급원 */
  expReward?: number;
  /** 완료 직후 재생할 마일스톤 대사 (체인 연결 스토리) */
  dialogue?: string;
};

export type BossKey = "guardian" | "behemoth" | "abysslord";

/** 보스 공격 패턴 종류 (페이즈별 풀에서 랜덤 선택) */
export type BossAttackKind = "slam" | "charge" | "volley" | "ring" | "zones" | "summon";

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
  /** 페이즈별 공격 패턴 풀 (HP 66%/33% 기준 전환) */
  patterns: { p1: BossAttackKind[]; p2: BossAttackKind[]; p3: BossAttackKind[] };
  /** 소환 패턴이 있을 때 불러올 잡몹 */
  summonKey?: EnemyKey;
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
  /** 메인 체인 완료 후 무한 반복 토벌 의뢰 (파밍/오버레벨링 — 체감 플레이타임 확장) */
  repeat?: { targetKey: EnemyKey; need: number; gold: number; exp: number; title: string; desc: string };
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
        type: "talk",
        title: "마을 주민과 인사",
        desc: "주민에게 가까이 가서 E키(모바일은 버튼)로 대화해 보자.",
        need: 2,
        targetLabel: "마을 주민",
        expReward: 25,
      },
      {
        id: "v1",
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
        expReward: 35,
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
        expReward: 40,
      },
      {
        id: "f2",
        type: "hunt",
        title: "늑대 무리 소멸",
        desc: "심연 기운에 미친 늑대 무리 10마리를 더 처치하자!",
        need: 10,
        targetKey: "wolf",
        targetLabel: "늑대",
        reward: 110,
        expReward: 90,
        dialogue: "wolfRoutDone",
      },
      {
        id: "f3",
        type: "collect",
        title: "숲 깊은 곳의 반응",
        desc: "늑대들이 지키던 곳에서 또 하나의 빛이 느껴진다.",
        targetLabel: "세계수 파편",
        reward: 60,
        expReward: 45,
      },
      {
        id: "f4",
        type: "reach",
        title: "다음 지역으로",
        desc: "열린 차원문에 닿아 알프헤임으로 이동하자.",
        targetLabel: "차원문",
        dialogue: "wolvesDone",
      },
    ],
    enemies: [{ key: "wolf", count: 4 }],
    boss: false,
    repeat: {
      targetKey: "wolf",
      need: 8,
      gold: 70,
      exp: 70,
      title: "[반복] 늑대 토벌 의뢰",
      desc: "마을 토벌 의뢰 — 늑대를 계속 사냥해 골드와 경험치를 얻자.",
    },
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
        expReward: 65,
      },
      {
        id: "a1",
        type: "collect",
        title: "경계의 빛",
        desc: "하수인들이 숨겨둔 세계수의 파편을 되찾자.",
        targetLabel: "세계수 파편",
        reward: 80,
        expReward: 55,
      },
      {
        id: "a2",
        type: "hunt",
        title: "하수인 대소탕",
        desc: "수호자를 부르는 의식을 막자 — 하수인 12마리 처치!",
        need: 12,
        targetKey: "minion",
        targetLabel: "심연 하수인",
        reward: 150,
        expReward: 140,
        dialogue: "minionPurgeDone",
      },
      {
        id: "a3",
        type: "boss",
        title: "심연의 수호자",
        desc: "알프헤임을 잠식한 심연의 수호자를 쓰러뜨리자!",
        targetLabel: "심연의 수호자",
        reward: 220,
        expReward: 200,
      },
      {
        id: "a4",
        type: "reach",
        title: "지하로 이동",
        desc: "열린 차원문에 닿아 스바르트알프헤임 동굴로 이동하자.",
        targetLabel: "차원문",
        dialogue: "guardianDone",
      },
    ],
    enemies: [{ key: "minion", count: 5 }],
    boss: true,
    bossKey: "guardian",
    repeat: {
      targetKey: "minion",
      need: 10,
      gold: 95,
      exp: 95,
      title: "[반복] 경계 순찰 의뢰",
      desc: "알프헤임 순찰 — 하수인을 계속 처치해 훈련하자.",
    },
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
        expReward: 65,
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
        expReward: 80,
      },
      {
        id: "c2",
        type: "hunt",
        title: "수정 골렘 파괴",
        desc: "거미들을 조종하는 수정 골렘 4기를 부숴 버리자.",
        need: 4,
        targetKey: "golem",
        targetLabel: "수정 골렘",
        reward: 130,
        expReward: 110,
      },
      {
        id: "c3",
        type: "hunt",
        title: "동굴 정화",
        desc: "거미 둥지를 완전히 태우자 — 거미 10마리 처치!",
        need: 10,
        targetKey: "spider",
        targetLabel: "동굴 거미",
        reward: 160,
        expReward: 150,
        dialogue: "spiderDone",
      },
      {
        id: "c4",
        type: "collect",
        title: "뿌리 속의 잔광",
        desc: "세계수 뿌리 사이에서 마지막 잔광이 느껴진다.",
        targetLabel: "세계수 파편",
        reward: 70,
        expReward: 70,
      },
      {
        id: "c5",
        type: "reach",
        title: "설원으로 이동",
        desc: "열린 차원문에 닿아 니플헤임으로 이동하자.",
        targetLabel: "차원문",
        dialogue: "caveDone",
      },
    ],
    enemies: [
      { key: "spider", count: 5 },
      { key: "golem", count: 3 },
    ],
    boss: false,
    repeat: {
      targetKey: "spider",
      need: 10,
      gold: 115,
      exp: 115,
      title: "[반복] 둥지 소개 의뢰",
      desc: "동굴 탐사자 협회 의뢰 — 거미를 계속 사냥하자.",
    },
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
        expReward: 120,
      },
      {
        id: "n1",
        type: "hunt",
        title: "얼음 골렘 격파",
        desc: "뿌리를 얼리고 있는 얼음 골렘 4기를 격파하자.",
        need: 4,
        targetKey: "icegolem",
        targetLabel: "얼음 골렘",
        reward: 170,
        expReward: 150,
      },
      {
        id: "n2",
        type: "collect",
        title: "얼음 속의 파편",
        desc: "얼음 결정 사이에서 세계수 파편의 빛이 반짝인다.",
        targetLabel: "세계수 파편",
        reward: 100,
        expReward: 90,
      },
      {
        id: "n3",
        type: "hunt",
        title: "설원 정화",
        desc: "보스의 권속인 서리 늑대 12마리를 처치하자!",
        need: 12,
        targetKey: "frostwolf",
        targetLabel: "서리 늑대",
        reward: 210,
        expReward: 190,
        dialogue: "frostRoutDone",
      },
      {
        id: "n4",
        type: "boss",
        title: "눈보라의 거수",
        desc: "얼어붙은 뿌리를 지키는 거수를 쓰러뜨리자!",
        targetLabel: "눈보라의 거수",
        reward: 320,
        expReward: 300,
      },
      {
        id: "n5",
        type: "reach",
        title: "최후의 차원문",
        desc: "열린 차원문 너머 심연의 왕좌로 향하자.",
        targetLabel: "차원문",
        dialogue: "behemothDone",
      },
    ],
    enemies: [
      { key: "frostwolf", count: 4 },
      { key: "icegolem", count: 3 },
    ],
    boss: true,
    bossKey: "behemoth",
    repeat: {
      targetKey: "frostwolf",
      need: 12,
      gold: 145,
      exp: 145,
      title: "[반복] 설원 순찰 의뢰",
      desc: "니플헤임 정찰 의뢰 — 서리 늑대를 계속 사냥하자.",
    },
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
        expReward: 140,
      },
      {
        id: "y1",
        type: "collect",
        title: "살켜진 빛",
        desc: "군주가 삼키지 못한 마지막 파편을 회수하자.",
        targetLabel: "세계수 파편",
        reward: 120,
        expReward: 110,
      },
      {
        id: "y2",
        type: "hunt",
        title: "왕좌 앞길 열기",
        desc: "심연 유령 10마리를 처치해 왕좌의 문을 열자!",
        need: 10,
        targetKey: "wraith",
        targetLabel: "심연 유령",
        reward: 240,
        expReward: 220,
        dialogue: "wraithDone",
      },
      {
        id: "y3",
        type: "boss",
        title: "심연의 군주",
        desc: "세계수의 마지막 파편을 삼킨 심연의 군주를 쓰러뜨리자!",
        targetLabel: "심연의 군주",
        reward: 600,
        expReward: 450,
      },
    ],
    enemies: [{ key: "wraith", count: 4 }],
    boss: true,
    bossKey: "abysslord",
    repeat: {
      targetKey: "wraith",
      need: 12,
      gold: 165,
      exp: 165,
      title: "[반복] 왕좌 정찰 의뢰",
      desc: "심연의 기운이 강해지고 있다 — 유령을 계속 처치하자.",
    },
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
    exp: 20,
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
    exp: 30,
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
    exp: 40,
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
    exp: 58,
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
    exp: 50,
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
    exp: 66,
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
    exp: 62,
    gold: [28, 40],
    dropHp: 0.32,
    dropMp: 0.26,
  },
};

export const BOSS_DEFS: Record<BossKey, BossDef> = {
  guardian: {
    key: "guardian",
    name: "심연의 수호자",
    hp: 950,
    atk: 15,
    speed: 92,
    exp: 320,
    gold: 260,
    tex: "boss",
    orbTint: 0x9d7aff,
    introDialogue: "bossIntroGuardian",
    patterns: {
      p1: ["slam", "charge", "volley"],
      p2: ["slam", "charge", "volley", "ring"],
      p3: ["slam", "charge", "volley", "ring", "zones"],
    },
  },
  behemoth: {
    key: "behemoth",
    name: "눈보라의 거수",
    hp: 1500,
    atk: 18,
    speed: 84,
    exp: 500,
    gold: 380,
    tex: "boss2",
    orbTint: 0x8ad4ff,
    introDialogue: "bossIntroBehemoth",
    patterns: {
      p1: ["slam", "volley", "zones"],
      p2: ["slam", "charge", "volley", "zones", "ring"],
      p3: ["slam", "charge", "volley", "zones", "ring"],
    },
  },
  abysslord: {
    key: "abysslord",
    name: "심연의 군주",
    hp: 2200,
    atk: 22,
    speed: 98,
    exp: 800,
    gold: 600,
    tex: "boss3",
    orbTint: 0xff5a7a,
    introDialogue: "bossIntroLord",
    patterns: {
      p1: ["volley", "charge", "slam"],
      p2: ["volley", "charge", "ring", "zones"],
      p3: ["volley", "charge", "ring", "zones", "summon"],
    },
    summonKey: "wraith",
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
  | "ring_vital"
  | "buff_atk"
  | "buff_def"
  | "buff_spd"
  | "buff_exp"
  | "pet_slime"
  | "pet_pixie"
  | "cos_dawn"
  | "cos_gold"
  | "cos_abyss"
  | "cos_wings";

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
  kind: "consumable" | "weapon" | "armor" | "accessory" | "buff" | "pet" | "cosmetic";
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
  /* ---- BM (v1.9): 버프 물약 / 펫 / 치장 ---- */
  buff_atk: { key: "buff_atk", kind: "buff", name: "분노의 물약", icon: "item_buff_atk", price: 60, tier: "rare" },
  buff_def: { key: "buff_def", kind: "buff", name: "수호의 물약", icon: "item_buff_def", price: 55, tier: "rare" },
  buff_spd: { key: "buff_spd", kind: "buff", name: "신속의 물약", icon: "item_buff_spd", price: 50, tier: "rare" },
  buff_exp: { key: "buff_exp", kind: "buff", name: "지혜의 물약", icon: "item_buff_exp", price: 90, tier: "rare" },
  pet_slime: { key: "pet_slime", kind: "pet", name: "슬라임 젤리", icon: "pet_slime", price: 280, tier: "rare" },
  pet_pixie: { key: "pet_pixie", kind: "pet", name: "요정 핑크이", icon: "pet_pixie", price: 520, tier: "epic" },
  cos_dawn: { key: "cos_dawn", kind: "cosmetic", name: "새벽빛 오라", icon: "cos_dawn", price: 200, tier: "rare" },
  cos_gold: { key: "cos_gold", kind: "cosmetic", name: "황금 오라", icon: "cos_gold", price: 200, tier: "rare" },
  cos_abyss: { key: "cos_abyss", kind: "cosmetic", name: "심연 오라", icon: "cos_abyss", price: 260, tier: "epic" },
  cos_wings: { key: "cos_wings", kind: "cosmetic", name: "요정 날개", icon: "cos_wings", price: 340, tier: "epic" },
};

/** 강화 1단계당 보너스 */
export const UPGRADE_BONUS = { weaponAtk: 2, armorDef: 1 } as const;

/* ================= BM (v1.9 — 버프/펫/치장, 메이플 BM 감각) ================= */

export type BuffKey = "buff_atk" | "buff_def" | "buff_spd" | "buff_exp";
export type PetKey = "pet_slime" | "pet_pixie";
export type CosmeticKey = "cos_dawn" | "cos_gold" | "cos_abyss" | "cos_wings";

/** 버프 물약 효과 — 사용 시 지속시간 동안 적용 (같은 버프 재사용 시 시간 갱신) */
export type BuffDef = {
  key: BuffKey;
  name: string;
  icon: string;
  desc: string;
  duration: number;
  color: string;
  price: number;
};
export const BUFF_DEFS: Record<BuffKey, BuffDef> = {
  buff_atk: { key: "buff_atk", name: "분노의 물약", icon: "item_buff_atk", desc: "공격력 +25%", duration: 60_000, color: "#ff8a8a", price: 60 },
  buff_def: { key: "buff_def", name: "수호의 물약", icon: "item_buff_def", desc: "방어력 +8", duration: 60_000, color: "#8fb8ff", price: 55 },
  buff_spd: { key: "buff_spd", name: "신속의 물약", icon: "item_buff_spd", desc: "이동속도 +25%", duration: 60_000, color: "#9af0c8", price: 50 },
  buff_exp: { key: "buff_exp", name: "지혜의 물약", icon: "item_buff_exp", desc: "경험치 +50%", duration: 120_000, color: "#e8a8ff", price: 90 },
};

/** 펫 정의 — 플레이어를 따라다니며 드롭 자동 줍기 + 골드 보너스 */
export type PetDef = {
  key: PetKey;
  name: string;
  icon: string;
  desc: string;
  bonusGoldPct: number;
  price: number;
};
export const PET_DEFS: Record<PetKey, PetDef> = {
  pet_slime: { key: "pet_slime", name: "슬라임 젤리", icon: "pet_slime", desc: "드롭 자동 줍기 · 골드 +10%", bonusGoldPct: 10, price: 280 },
  pet_pixie: { key: "pet_pixie", name: "요정 핑크이", icon: "pet_pixie", desc: "드롭 자동 줍기 · 골드 +20%", bonusGoldPct: 20, price: 520 },
};

/** 치장 아이템 — 플레이어 뒤에 따라붙는 오라 연출 (전투 능력 없음, 순수 치장) */
export type CosmeticDef = {
  key: CosmeticKey;
  name: string;
  icon: string;
  desc: string;
  price: number;
  tint: number;
};
export const COSMETIC_DEFS: Record<CosmeticKey, CosmeticDef> = {
  cos_dawn: { key: "cos_dawn", name: "새벽빛 오라", icon: "cos_dawn", desc: "하늘빛 후광", price: 200, tint: 0x7dc0ff },
  cos_gold: { key: "cos_gold", name: "황금 오라", icon: "cos_gold", desc: "금빛 후광", price: 200, tint: 0xffd76a },
  cos_abyss: { key: "cos_abyss", name: "심연 오라", icon: "cos_abyss", desc: "보라빛 후광", price: 260, tint: 0xa875ff },
  cos_wings: { key: "cos_wings", name: "요정 날개", icon: "cos_wings", desc: "반짝임 입자 트레일", price: 340, tint: 0xbaf3ff },
};

/** 상점 판매 목록 (표시 순서 — BM 섹션은 kind로 분리 렌더) */
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
  "buff_atk",
  "buff_def",
  "buff_spd",
  "buff_exp",
  "pet_slime",
  "pet_pixie",
  "cos_dawn",
  "cos_gold",
  "cos_abyss",
  "cos_wings",
];

export type DialogueDef = { speaker: string; lines: string[] };

export const DIALOGUES: Record<string, DialogueDef> = {
  introNamed: {
    speaker: "요정 아리",
    lines: [
      "{name}…! 좋은 이름이야. 세계수가 기억할 이름이야.",
      "자, {name}. 오늘부터 네 모험이 시작돼!",
    ],
  },
  villageIntro: {
    speaker: "요정 아리",
    lines: [
      "{name}, 드디어 모험을 떠나는 날이네!",
      "저 아래 가라앉은 아뜰란티스 — 옛 바다의 대륙이 잠들어 있는 곳이야.",
      "그 폐허에서 번져 나온 심연이 세계수 이그드라실을 뒤틀고 있어.",
      "마을 동쪽 차원문을 지나면 뿌리숲. 세계수의 파편이 떨어졌어!",
      "출발 전에 라고스 아저씨에게 물약을 챙기면 좋아. 갔다 와, {name}!",
    ],
  },
  villager1: {
    speaker: "마을 주민",
    lines: [
      "어머, {name}! 드디어 모험가가 되려구?",
      "차원문 너머 숲엔 늑대들이 돌아다녀. 물약 꼭 챙기고 다녀오렴.",
      "…요즘 밤마다 땅 밑에서 이상한 소리가 들려.",
      "아뜰란티스의 폐허가 다시 숨을 쉬기 시작한 게 분명해. 조심하게!",
    ],
  },
  villager2: {
    speaker: "마을 아이",
    lines: [
      "{name} 형아도 이제 진짜 모험가다! 부러워요.",
      "저는 마을 우물을 지키고 있을게요. 우물 물은 아프면 꼭 필요하답니다!",
      "전설의 모험가들도 처음엔 다 마을에서 출발했대요.",
      "꼭 이겨요, {name} 형아!",
    ],
  },
  intro: {
    speaker: "요정 아리",
    lines: [
      "{name}, 봤어? 저기 하늘로 빛 기둥이 솟았어.",
      "세계수의 파편이 떨어진 거야. 파편은 이그드라실의 힘 그 자체야.",
      "심연도 그 빛을 노리고 있어. 서두르자!",
      "숲이 어두우니, 빛나는 기둥과 화살표를 따라가 보자.",
    ],
  },
  fragment: {
    speaker: "{name}",
    lines: [
      "이게… 세계수의 파편! 몸에 힘이 넘쳐흘러.",
      "공격력이 올라간 것 같아. 이제 이 검으로 숲을 지키자!",
    ],
  },
  wolfRoutDone: {
    speaker: "요정 아리",
    lines: [
      "늑대 무리가 완전히 흩어졌어!",
      "…그런데 이상해. 무리의 왕이 없었어. 저마다 뭔가에 이끌리듯 동쪽으로 달려갔었지.",
      "심연의 기운이 숲을 지나 더 깊은 곳으로 흘러가고 있어, {name}.",
    ],
  },
  wolvesDone: {
    speaker: "요정 아리",
    lines: [
      "숲이 조금씩 눈을 뜨고 있어! 저기 차원문이 열리고 있어!",
      "빛나는 차원문으로 들어가면 알프헤임에 도착할 거야.",
      "가자, {name}. 심연의 근원을 향해 더 내려가 보자!",
    ],
  },
  alfheimIntro: {
    speaker: "요정 아리",
    lines: [
      "알프헤임에 도착했어… 하지만 공기가 무거워.",
      "심연의 기운이야. 요정들의 숲이 통째로 잠식당하고 있어.",
      "저 하수인들은 심연의 전령 — 놈들이 의식을 마치기 전에 끊어야 해.",
      "하수인들을 먼저 정리하자, {name}!",
    ],
  },
  minionPurgeDone: {
    speaker: "요정 아리",
    lines: [
      "하수인들이 전부 물러났어! 의식은 막았어.",
      "…하지만 의식의 진앙에서 기운이 모이고 있어. 뭔가가 깨어나는 중이야.",
      "준비됐지, {name}? 심연의 수호자가 올 거야!",
    ],
  },
  bossIntroGuardian: {
    speaker: "심연의 수호자",
    lines: [
      "…세계수의 빛을 든 자여. 여기서 끝장내 주지.",
      "가라앉은 아뜰란티스처럼, 너의 세계도 어둠에 잠길 것이다!",
    ],
  },
  guardianDone: {
    speaker: "요정 아리",
    lines: [
      "수호자를 쓰러뜨렸는데도… 심연이 사라지지 않아!",
      "수호자는 경계의 문지기일 뿐이었어. 근원은 세계수 뿌리가 뚫고 내려간 더 깊은 곳…",
      "저기 새 차원문이 열렸어! 동굴에서 두 번째 파편 빛이 느껴져. 가자, {name}!",
    ],
  },
  caveIntro: {
    speaker: "요정 아리",
    lines: [
      "스바르트알프헤임… 세계수의 뿌리가 꿰뚫은 지하 동굴이야.",
      "여긴 옛 아뜰란티스 사람들이 빛나던 수정을 캐던 곳이래.",
      "지금은 어둠이 수정을 삼켰어. 심연에 물든 거미와 골렘이 돌아다녀. 조심해!",
      "파편의 빛기둥과 화살표를 따라가 보자, {name}.",
    ],
  },
  fragment2: {
    speaker: "{name}",
    lines: [
      "두 번째 파편! 온몸에 세계수 뿌리의 힘이 스며든다…",
      "어둠이 깊어질수록 이 빛은 더 밝아져.",
      "동굴을 정리하고, 설원 너머로 나아가자!",
    ],
  },
  spiderDone: {
    speaker: "요정 아리",
    lines: [
      "거미 둥지가 완전히 정리됐어! 동굴의 수정이 다시 빛을 내기 시작해.",
      "…{name}, 봐. 뿌리를 타고 위쪽이 아니라 아래쪽으로 얼음기운이 흘러.",
      "심연의 근원은 더 깊은 곳에 있어. 마지막 파편도 그 근처에 있대.",
    ],
  },
  caveDone: {
    speaker: "요정 아리",
    lines: [
      "동굴 반대편 차원문이 열리고 있어!",
      "저 문 너머는 니플헤임 — 세계수에서 가장 추운 뿌리 끝이야.",
    ],
  },
  niflIntro: {
    speaker: "요정 아리",
    lines: [
      "니플헤임이야… 숨만 쉴어도 몸이 얼어붙는 곳.",
      "설원의 서리 늑대들이 파편의 빛을 가리고 있어!",
      "보스는 얼어붙은 뿌리 한가운데 잠들어 있대. '눈보라의 거수'…",
      "먼저 힘을 비교해 보고, 뿌리를 지키는 '그것'을 처리하자, {name}.",
    ],
  },
  frostRoutDone: {
    speaker: "요정 아리",
    lines: [
      "설원이 조용해졌어… 이제 얼어붙은 뿌리의 주인만 남았어.",
      "{name}, 곧 보스전이야. 물약 확인했지?",
      "이기면 마지막 차원문이 열려. 진정하고 가자!",
    ],
  },
  bossIntroBehemoth: {
    speaker: "눈보라의 거수",
    lines: [
      "…이 뿌리는 이제 심연의 것이다. 얼어붙어라!",
      "아뜰란티스가 그랬던 것처럼, 너희의 숨결도 얼음 아래 가라앉힐 것이다!",
    ],
  },
  behemothDone: {
    speaker: "요정 아리",
    lines: [
      "거수가 무너지자 얼어붙은 차원문이 녹아나고 있어!",
      "…그런데 저 마지막 문에서 느껴지는 기운은 달라. 심연의 왕좌로 가는 길이야.",
      "마지막이야, {name}. 준비됐지?",
    ],
  },
  abyssIntro: {
    speaker: "요정 아리",
    lines: [
      "…여기가 심연의 왕좌야. 아뜰란티스의 침몰이 시작된 바로 그 자리…",
      "세계수의 마지막 파편이 저 안에 있어.",
      "왕좌를 지키는 유령들을 정리하면 군주가 나타날 거야.",
      "군주를 쓰러뜨리면 세계수의 빛이 돌아와. 부탁해, {name}!",
    ],
  },
  wraithDone: {
    speaker: "요정 아리",
    lines: [
      "왕좌 앞이 비었다… 이제 마지막 전투만 남았어.",
      "{name}, 네 손에 세 개의 파편 빛이 모여 있어.",
      "심호흡 한번 하고… 진정해. 세계수가 함께할 거야!",
    ],
  },
  bossIntroLord: {
    speaker: "심연의 군주",
    lines: [
      "작은 파편 수집가가 여기까지 왔군…",
      "나는 가라앉은 왕국의 원한이다. 아뜰란티스와 함께, 모든 것이 심연으로 귀할 것이다!",
      "세계수의 빛도, 이 세계도, 네 이름조차도 — 전부 잊히리라!",
    ],
  },
  victory: {
    speaker: "요정 아리",
    lines: [
      "해냈어, {name}…! 세계수의 빛이 모든 뿌리를 따라 퍼지고 있어!",
      "동굴도, 설원도, 심연의 왕좌도 다시 빛을 되찾았어.",
      "가라앉은 아뜰란티스의 영혼들도 이제 평온해질 거야.",
      "고마워… 이 모험은 이제 진짜 전설이 될 거야!",
    ],
  },
  jobMaster: {
    speaker: "직업 교관 카이엔",
    lines: [
      "어서 오게, {name}. 나는 모험가들에게 길을 열어 주는 직업 교관 카이엔이다.",
      "이제 네 몸에 흐르는 힘이 꽤 뚜렷해졌군. 전직할 자격이 있는지 보자!",
      "전사·궁수·마법사 — 세 계열 중 하나를 택하면 2차, 3차로 더 깊이 들어갈 수 있어.",
      "계열 안에서 방향이 바뀌고 싶으면 언제든 자유 전직을 찾아오게. 골드만 있으면 된다!",
      "자, 결정하게. 네 가호를 새겨 주마!",
    ],
  },
};
