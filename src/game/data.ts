/** 스테이지 / 퀘스트 / 적 / 대사 데이터 (전부 오리지널 명칭) */

export type StageKey = "forest" | "alfheim";

export type QuestDef = {
  id: string;
  type: "collect" | "hunt" | "reach" | "boss";
  title: string;
  desc: string;
  need?: number; // hunt 몇 마리
  targetLabel: string; // 가독성용 목표명
  reward?: number; // 완료 골드 보상 (2D MMORPG 기본 요소)
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
  enemies: { key: "wolf" | "minion"; count: number }[];
  boss: boolean;
};

export const STAGES: Record<StageKey, StageDef> = {
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
    ],
    enemies: [{ key: "minion", count: 5 }],
    boss: true,
  },
};

export type EnemyDef = {
  key: "wolf" | "minion";
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

export const ENEMIES: Record<"wolf" | "minion", EnemyDef> = {
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
};

export const BOSS_DEF = {
  key: "boss" as const,
  name: "심연의 수호자",
  hp: 640,
  atk: 15,
  speed: 92,
  exp: 220,
  gold: 200,
};

/* ================= 아이템 (2D MMORPG 기본 요소) ================= */

export type ItemKey =
  | "potion_hp"
  | "potion_mp"
  | "weapon_1"
  | "weapon_2"
  | "weapon_3"
  | "armor_1"
  | "armor_2"
  | "armor_3";

export type ItemDef = {
  key: ItemKey;
  kind: "consumable" | "weapon" | "armor";
  name: string;
  icon: string; // 텍스처 키
  price: number; // 상점 구매가 (0 = 판매 안 함/기본 지급)
  heal?: number; // HP 회복
  restore?: number; // MP 회복
  atk?: number; // 무기 공격력 보너스
  def?: number; // 방어구 방어력
};

export const ITEMS: Record<ItemKey, ItemDef> = {
  potion_hp: { key: "potion_hp", kind: "consumable", name: "HP 물약", icon: "item_potion_hp", price: 30, heal: 50 },
  potion_mp: { key: "potion_mp", kind: "consumable", name: "MP 물약", icon: "item_potion_mp", price: 25, restore: 30 },
  weapon_1: { key: "weapon_1", kind: "weapon", name: "낡은 단검", icon: "item_weapon_1", price: 0, atk: 0 },
  weapon_2: { key: "weapon_2", kind: "weapon", name: "강철 검", icon: "item_weapon_2", price: 110, atk: 6 },
  weapon_3: { key: "weapon_3", kind: "weapon", name: "기사단 대검", icon: "item_weapon_3", price: 260, atk: 14 },
  armor_1: { key: "armor_1", kind: "armor", name: "여행자의 옷", icon: "item_armor_1", price: 0, def: 0 },
  armor_2: { key: "armor_2", kind: "armor", name: "가죽 갑옷", icon: "item_armor_2", price: 95, def: 3 },
  armor_3: { key: "armor_3", kind: "armor", name: "기사단 갑옷", icon: "item_armor_3", price: 230, def: 7 },
};

/** 상점 판매 목록 (표시 순서) */
export const SHOP_STOCK: ItemKey[] = [
  "potion_hp",
  "potion_mp",
  "weapon_2",
  "armor_2",
  "weapon_3",
  "armor_3",
];

export type DialogueDef = { speaker: string; lines: string[] };

export const DIALOGUES: Record<string, DialogueDef> = {
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
  bossIntro: {
    speaker: "심연의 수호자",
    lines: ["…세계수의 빛을 든 자여. 여기서 끝장내 주지."],
  },
  victory: {
    speaker: "요정 아리",
    lines: [
      "정말 해냈어, 세르츠! 알프헤임의 빛이 돌아오고 있어!",
      "이 모험은 언젠가 더 커진 세계로 이어질 거야.",
    ],
  },
};
