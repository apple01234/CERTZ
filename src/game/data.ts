/**
 * SERTZ 게임 데이터 (v2.0)
 *  - 스테이지/몬스터/보스 정의는 stages.ts (9챕터 × 10구역 생성기)에서 재수출
 *  - v1.5 스토리 대사 전면 복원 (아뜰란티스 7보석 스토리라인 — 사용자 지시 #19)
 *  - v1.9 아이템/BM(버프·펫·치장) 유지 + 강화 12단계 확장 (메이플 스타포스식)
 */
import { CHAPTERS, ENEMIES, type ChapterKey } from "./stages";
import type { FamilyKey } from "./classes";

/* ================= 스테이지/전투 데이터 (stages.ts 생성기) ================= */

export {
  CHAPTERS,
  STAGES,
  NEXT_STAGE,
  PREV_STAGE,
  STAGE_SHORT,
  STAGE_THEME,
  ENEMIES,
  BOSS_DEFS,
  parseStage,
  chapterSpec,
  stageScale,
  resolveStage,
  stageIntro,
} from "./stages";

export type {
  ChapterKey,
  StageKey,
  EnemyKey,
  EnemyDef,
  QuestDef,
  BossKey,
  BossDef,
  BossAttackKind,
  StageDef,
} from "./stages";

/** 몬스터 골드 드롭 조정 계수 (사용자 지시 #6 — 골드 과다 수정) */
export const GOLD_DROP_SCALE = 0.62;

/** 강화 비용 — 단계별 눈덩이 곡선 (높은 단계일수록 골드 소모 급증 → 골드 싱크) */
export function upgradeCost(slot: "weapon" | "armor", level: number): number {
  const base = slot === "weapon" ? 45 : 38;
  return Math.round(base * Math.pow(1.45, level));
}

/* ================= 아이템 (v1.9 유지) ================= */

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

/** 장비 강화 상한 (v2.0 — 메이플 스타포스식 +12 확장, 구 세이브 +5 호환) */
export const UPGRADE_MAX = 12;
/** 강화 성공률 (%) — 현재 단계 인덱스 (0=+0→+1, … 11=+11→+12) */
export const UPGRADE_RATES = [100, 85, 70, 55, 40, 35, 30, 25, 20, 15, 12, 10];
/** 강화 하락 시작 단계 (+9 이상 실패 시 1단계 하락 — 스타포스식 리스크) */
export const UPGRADE_FALLBACK_FROM = 9;

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

/* ================= 스토리 대사 (v1.5 원문 복원 — 아뜰란티스 7보석 라인) ================= */

export const DIALOGUES: Record<string, DialogueDef> = {
  /* ================= 공통 / 인트로 ================= */
  introNamed: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "{name}…! 좋은 이름이야. 바다가 기억할 이름이야.",
      "칼립소 할머니가 물거품이 되어 사라지기 전, 마지막으로 남긴 말 — 기억하지?",
      "'뒷산 폐허의 신전으로 가라.' 자, {name}. 인어의 숙명이 시작된다!",
    ],
  },
  villageIntro: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "{name}, 나는 아부디토스. 네 펜던트에 깃든 정령이지.",
      "옛날 아뜰란티스 — 아홉 해역이 하나였던 대륙. 그 대륙이 흩어진 뒤, 일곱 개의 보석이 각 해역에 흩어졌어.",
      "보석이 한 곳에 모이면 세계가 멸망한다… 는 말은 내가 거짓말을 하고 있을지도? 후후.",
      "아무튼! 마을 동쪽 차원문을 지나면 서쪽 숲의 신전. 출발 전에 라고스 아저씨에게 물약을 챙기자, {name}!",
    ],
  },
  villager1: {
    speaker: "마을 주민",
    lines: [
      "어머, {name}! 칼립소 할머니를 따라가기로 했구나.",
      "차원문 너머 숲엔 늑대들이 돌아다녀. 물약 꼭 챙기고 다녀오렴.",
      "…할머니는 좋은 분이었어. 갑자기 물거품처럼 사라지셨다는 게 아직도 믿기지가 않아.",
    ],
  },
  villager2: {
    speaker: "마을 아이",
    lines: [
      "{name} 형아도 이제 진짜 모험가다! 부러워요.",
      "저는 마을 우물을 지키고 있을게요. 우물 물은 아프면 꼭 필요하답니다!",
      "할머니가 자주 그랬어요. '바다는 기억한다'라고… 무슨 뜻일까요?",
    ],
  },
  /* ================= 제2장 숲의 신전 ================= */
  intro: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "저기 하늘로 빛 기둥이 솟았어 — 보석의 기운이야, {name}!",
      "숲의 신전은 저쪽. 신전에 도착하면 네가 해야 할 일을 자세히 말해 줄게.",
      "숲이 어두우니, 빛나는 기둥과 화살표를 따라가 보자.",
    ],
  },
  fragment: {
    speaker: "{name}",
    lines: [
      "이게… 보석의 흔적! 손안에서 뜨거워진다.",
      "아부디토스, 이거 진짜 보석이야?",
      "…흔적이야. 진짜 보석은 각 해역의 괴물들이 삼켰지. 하지만 훌륭한 시작이야, {name}!",
    ],
  },
  fragment2: {
    speaker: "{name}",
    lines: [
      "또 하나의 보석의 흔적… 몸속에서 바다가 출렁인다.",
      "아부디토스, 이 흔적도 어딘가의 보석이 삼킨 조각이야?",
      "…그래. 흔적이 모이면 진짜 보석의 위치가 드러나. 훌륭해, {name}!",
    ],
  },
  wolfRoutDone: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "능대 무리가 완전히 흩어졌어!",
      "…그런데 이상해. 무리의 왕이 없었어. 저마다 뭔가에 이끌리듯 동쪽으로 달려갔었지.",
      "보석의 기운이 숲을 지나 바다로 흘러가고 있어, {name}.",
    ],
  },
  wolvesDone: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "숲의 신전이 조금씩 눈을 뜨고 있어! 저기 차원문이 열리고 있어!",
      "저 문 너머는 쿠소디아 왕국 — 선박의 왕국이지. 왕을 만나면 바다를 건널 수 있어.",
      "가자, {name}. 아홉 해역 순행이 시작된다!",
    ],
  },
  /* ================= 제3장 쿠소디아 왕국 ================= */
  kingdomIntro: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "쿠소디아 왕국에 도착했어. 왕족은 알프헤임과 동맹을 맺은 유서 깊은 왕국이지.",
      "…그런데 늪지대가 이상해. 보석의 기운을 먹고 자란 식인초가 왕국을 위협하고 있어.",
      "기사단을 도우면 왕에게 갈 수 있을 거야. 대사 하나가 백 금자리지, {name}!",
    ],
  },
  swampDone: {
    speaker: "쿠소디아 기사단장",
    lines: [
      "훌륭하다, 젊은 모험가여! 왕국의 은혜를 잊지 않겠다.",
      "왕께서 그대를 왕성에서 기다리신다. 저 차원문 너머 왕성으로 들어가게.",
      "…한 가지 더. 왕성 앞 동상이 며칠 전부터 이상하게 울고 있다는 소문이 있네…",
    ],
  },
  kingdomDone: {
    speaker: "라이언 드 쿠소디아 국왕",
    lines: [
      "잘 왔네, 모험가. 나는 쿠소디아의 왕 라이언이다.",
      "그대가 인어의 후예라는 것 — 나는 알고 있네. 옥새를 받아라.",
      "이 옥새를 들고 샘에 서면, 요정들이 왕족으로 인식해 알프헤임으로 안내할 것이다.",
      "폐하… 늪지의 동상이 니드호그로 변했다는 급보가! — 자, {name}. 서두르게!",
    ],
  },
  /* ================= 제4장 알프헤임 성전 ================= */
  alfheimIntro: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "알프헤임에 도착했어… 하지만 공기가 무거워.",
      "니드호그 — 원래 알프헤임의 숲을 지키던 드래곤이었지. 지금은 탐식에 물들어 성전을 삼켰어.",
      "저 하수인들은 니드호그의 전령. 놈들이 의식을 마치기 전에 끊어야 해.",
      "여왕 요정에게 '절제의 검'을 받을 수 있도록, 먼저 하수인들을 정리하자, {name}!",
    ],
  },
  minionPurgeDone: {
    speaker: "알프헤임의 여왕 요정",
    lines: [
      "어서 오게, 인어의 후예여. 나는 이 해역의 여왕이다.",
      "이 검의 이름은 '절제의 검' — 인어들이 괴물을 상대하기 위해 만든 일곱 성물 중 하나다.",
      "조심하게. 성물은 인어의 피를 가진 자만 발동시킬 수 있고… 발동하면 힘을 강제로 끌어당겨. 대가가 있을 테니.",
      "니드호그는 저 성전 한가운데에서 대기하고 있네. 준비되면 가게, {name}!",
    ],
  },
  bossIntroNidhog: {
    speaker: "탐식의 드래곤 니드호그",
    lines: [
      "…빛나는 것이 보이는군. 인어의 피… 좋아, 좋아!",
      "내 위장 속 보석이 네 것을 부러워하겠군. 탐식의 드래곤이 네게 뭐라 말해줬으면 좋겠느냐!",
      "먹어 주마, 후예여! 이 성전째로!",
    ],
  },
  guardianDone: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "니드호그를 물리쳤어! 저기, 떨어진 빛 — 그게 '숲(탐식)의 보석'이야!",
      "…그런데 {name}, 네 얼굴이 창백해. 절제의 검이 수명을 끌어갔어… 시동무기는 무겁다.",
      "여왕이 성문을 열어 줬어. 다음은 극열의 해역 무스펠헤임. 쉬어가며 가자!",
    ],
  },
  /* ================= 제5장 무스펠헤임 ================= */
  muspelIntro: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "무스펠헤임 — 극열의 해역이야. 1년 주기로 열이 변하는 바다지.",
      "하필 오늘이 열이 가장 강해지는 '극열의 날'이야. 화염 정령들이 네빌라를 뒤덮고 있어!",
      "저기 구조되어 있는 호족 소녀가 보여? 엘렌. 먼저 구해 주자, {name}!",
    ],
  },
  spiritPurgeDone: {
    speaker: "호족 소녀 엘렌",
    lines: [
      "고마워! 넌 인어가 아니지? …그래도 강하네.",
      "수르트가 화염 정령들을 이끌고 지하도시를 내려앉히려고 해.",
      "촌장님이 성물 보물고를 열어 주셨어. '자선의 목걸이'를 가져 가! 행운을 빌어.",
    ],
  },
  bossIntroSurt: {
    speaker: "분노의 정령 수르트",
    lines: [
      "작은 것… 내 영역을 침범했느냐!",
      "오늘의 태양은 내 것이다. 불의 정령이 막강해지는 날 — 네가 온 날이 바로 그날!",
      "재로 돌아가라, 인어의 후예!!",
    ],
  },
  surtDone: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "수르트가 무너졌어! 그런데… 저기 검은 화살이 뭔지?",
      "『인내의 창 — 사라져라.』",
      "…누구야?! 불의 보석이, 수르트의 것도 전부 저 사내한테…! 사라졌어, {name}!",
      "기억을 잃은 인어라… '루안'이라 자칭했어. 우리와 같은… 인어의 피를 가진 자야.",
    ],
  },
  /* ================= 제6장 니플헤임 ================= */
  niflIntro: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "니플헤임이야… 숨만 쉴어도 몸이 얼어붙는 극한의 해역.",
      "저 앞 얼음의 성전에 마법사가 있대. 얼음의 보석을 지키고 있어서… 돕고 나면 정보를 얻을지도?",
      "그리고 조심해 — '탐욕의 늑대 펜리르'가 이 해역을 배회하고 있어. 보석을 두 개나 삼킨 괴물이야!",
    ],
  },
  frostRoutDone: {
    speaker: "마법사 흐레스",
    lines: [
      "…고맙군, 젊은이. 나는 흐레스. 이 성전의 수호자였다.",
      "펜리르에게 얼음의 보석을 빼앗겼다. 놈은 폭풍의 늑대였던 것 — 보석을 삼키고 변질되었지.",
      "성전 보물고의 '친절의 반지'를 가져가게. 탐욕을 베는 검이 되길.",
      "…저 녀석이 온다. 얼음의 성전으로 도망쳐라! 서두르게!",
    ],
  },
  bossIntroFenrir: {
    speaker: "탐욕의 늑대 펜리르",
    lines: [
      "이것이… 네가 말한 운명이라는 것인가, 칼립소…!",
      "보석 두 개의 힘을 지닌 나에게 — 인간이 무엇을 할 수 있겠느냐!",
      "네 보석까지 삼켜 주마, 후예여!!",
    ],
  },
  fenrirDone: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "펜리르가 쓰러졌어! 폭풍(탐욕)의 보석과 얼음(질투)의 보석 — 두 개를 한 번에 되찾았어!",
      "…{name}, 저기 사람이 있어. …루안이야!",
      "『시동무기는 사용자에게 귀속된다. 네가 쓴 성물은 네 것이야.』 …뭐야, 갑자기 등장해서 정보만 던지고 가네.",
      "어쨌든 보석이 네 개. 다음은 스바르트알프헤임 — 어둠 요정들의 지하야.",
    ],
  },
  /* ================= 제7장 스바르트알프헤임 ================= */
  caveIntro: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "스바르트알프헤임 — 알프헤임 아래에 숨은 어둠 요정들의 해역이야.",
      "여긴 옛 아뜰란티스 사람들이 빛나던 수정을 캐던 곳이래.",
      "지금은 어둠이 수정을 삼켰어. 물든 거미와 골렘이 돌아다녀. 여왕을 돕자, {name}!",
    ],
  },
  spiderDone: {
    speaker: "땅의 요정 여왕",
    lines: [
      "지하가 다시 빛을 머금기 시작했네. 고맙다, 인어의 피를 지닌 자여.",
      "…들려주겠다. 헬 — 무스펠헤임과 니플헤임 사이의 절벽 너머.",
      "대전쟁의 유일한 생존자 두 인어가 있었지. 하나는 칼립소… 다른 하나는 그 여동생 '헬'이야.",
      "헬이 무엇을 숨기고 있는지는… 스스로 확인하게. 난쟁이들의 해역으로 가게.",
    ],
  },
  caveDone: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "지하 반대편 차원문이 열리고 있어!",
      "저 문 너머는 니다벨리르 — 난쟁이들의 해역이야. 스콜과 하티가 해와 달을 삼켰다던데…",
    ],
  },
  /* ================= 제8장 니다벨리르 ================= */
  nidavellirIntro: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "이다벨리르… 아니, 니다벨리르 — 난쟁이들의 해역이야. 룬 광산이 유명하지.",
      "…하늘이 어두워. 해와 달의 기운이 사라졌어. 스콜과 하티 — 교만의 쌍두 늑대가 깨어난 거야!",
      "광산 곳곳에 룬 골렘이 폭주하고 있어. 마을을 구하고, 성물 '겸손의 지팡이'를 찾자!",
    ],
  },
  runePurgeDone: {
    speaker: "난쟁이 광산 조합장",
    lines: [
      "광산이 우리 것으로 돌아왔구나! 대단한 실력이네, 작은 영웅.",
      "이 지팡이를 가져가게. '겸손의 지팡이' — 교만을 꺾는 유일한 성물이지.",
      "스콜과 하티는 광산 최심부의 룬 제단에 잠들어 있네. 해와 달을 되돌려 다오!",
    ],
  },
  bossIntroSkoll: {
    speaker: "교만의 쌍두 스콜&하티",
    lines: [
      "해는 내 것이고, 달도 내 것이다!",
      "하늘을 삼킨 우리가 — 작은 인간 따위에게 굴복하겠느냐!",
      "교만은 꺾이지 않아. 부서져라!",
    ],
  },
  skollDone: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "쌍두가 소멸했어! …{name}, 봐! 하늘에 해와 달이 돌아왔어!",
      "저기 빛나는 것 — '하늘(교만)의 보석'이야. 이제 여섯 개!",
      "마지막 단서는 헬. …{name}, 아부디토스로서 네게 부탁할 게 있어. 무슨 일이 있어도… 나를 믿어 줘.",
    ],
  },
  /* ================= 제9장 헬 ================= */
  helIntro: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "헬의 절벽이야. 칼립소 할머니의 여동생 — 헬이 자기 이름을 딴 해역이지.",
      "대전쟁 이후 아무도 여기 못 들어왔어. 절벽을 지키는 하운드들을 먼저 정리하자.",
      "…그리고 {name}. 여기서 네가 '진실'을 알게 될 거야. 각오하고 가자.",
    ],
  },
  houndPurgeDone: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "절벽이 비었어! 저기 헬의 저택… 일기장이 있어.",
      "『…칼립소의 두 손주. 쌍둥이 — 하나는 언니가, 하나는 내가 데리고 갔다. 루안… 네가 그 아이로구나…』",
      "{name}, 루안은 네… 쌍둥이 남매야. 칼립소 할머니의 다른 손주. 지금까지 우연이라고 생각했던 만남이…",
      "그리고 저기 — 대지의 결정. '희망의 방패'와 함께 절벽의 주인 그람이 기다리고 있어.",
    ],
  },
  bossIntroGram: {
    speaker: "대지의 괴물 그람",
    lines: [
      "…인어의 피. 봉인된 주인의 냄새다.",
      "나는 그람. 비탄이 만든 쌍두의 용. 헬 님을 지키는 자.",
      "…가라. 하지 않겠다면 — 갈라 놓겠다.",
    ],
  },
  gramDone: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "그람까지 쓰러뜨렸어! 대지(비탄)의 보석 — 일곱 개를 전부 모았어, {name}!",
      "…그리고 이제, 진실을 말할 시간이야.",
      "나는 펜던트의 정령이 아니야. 대전쟁을 일으킨 '대악마 아부디토스' — 네가 모은 보석이 모두 나를 되살릴 수단이었지!",
      "『바다의 보석 — 하라.』 …바다의 보석까지 빼앗겼어! 네가 인어로서 품고 있던 마지막 보석…",
      "{name}, 이건… 나도 몰랐어. …아니, 몰랐던 척을 했던 걸지도. 미안해!",
    ],
  },
  /* ================= 제10장 아뜰란티스 — 최종 ================= */
  abyssIntro: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "…{name}. 배가 침몰하고 있어 — 요르문간드! 바다의 수호신이야.",
      "『…펜던트를 든 자여. 나는 너희를 공격한 것이 아니다. 대악마의 기운을 쫓은 것뿐. — 삼켜 주마. 왕좌로.』",
      "요르문간드가 우리를 삼켰어… 어디로 가는 거지? …{name}, 잠깐. 저기 왕좌의 불빛…",
      "왕좌를 지키는 유령들을 정리하면 길이 열려. 마지막이야, {name}.",
    ],
  },
  wraithDone: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "왕좌 앞이 비었다… 이제 마지막 전투만 남았어.",
      "{name}, 손을 봐. 네가 모은 여섯 보석의 빛… 네 마음이 빛나고 있어.",
      "칼립소가 말했었지 — '마지막 성물은 마음속에 있다'고.",
      "근면의 활. 마음의 빛을 내면 발동된대. 심호흡… 진정해. 우리가 함께할게!",
    ],
  },
  bossIntroAbudditos: {
    speaker: "대악마 아부디토스",
    lines: [
      "『후후… 왔구나, 후예여. 나의 일곱 힘이 모두 돌아왔다.』",
      "『펜던트의 정령? 아부디토스? 그래, 그게 내 이름이다. 세계를 갈라놓은 대악마의 이름이지.』",
      "『성물? 웃기지 마라. 인어는 멸종했다. 발동시킬 자조차 없는 죽은 전설 — 』",
      "『…아니. 네가 있구나. 칼립소의 피를 이은 마지막 후예여 — 재미있게 구경해 주마!』",
    ],
  },
  victory: {
    speaker: "요르문간드",
    lines: [
      "『…끝났군. 대악마 아부디토스의 기운이 소멸했다.』",
      "『인어의 후예여. 일곱 성물의 빛이 하나가 되어, 마물들은 힘을 잃고 잠들 것이다.』",
      "『아홉 왕국은 다시 교류를 시작하리라. 이 바다의 이름은 — 아뜰란티스로 부르게 되리라.』",
      "『…인어의 힘을 모두 쓴 너희는 이제 인간이 될 것이다. 아쉬우냐? — 아니겠지. 새로운 모험이 시작됐으니.』",
    ],
  },
  /* ================= 구 보스 (정의 유지 — 표기만 갱신) ================= */
  bossIntroGuardian: {
    speaker: "심연의 수호자",
    lines: [
      "…보석의 빛을 든 자여. 여기서 끝장내 주지.",
      "가라앉은 아뜰란티스처럼, 너의 세계도 어둠에 잠길 것이다!",
    ],
  },
  bossIntroBehemoth: {
    speaker: "눈보라의 거수",
    lines: [
      "…이 뿌리는 이제 심연의 것이다. 얼어붙어라!",
      "아뜰란티스가 그랬던 것처럼, 너희의 숨결도 얼음 아래 가라앉힐 것이다!",
    ],
  },
  bossIntroLord: {
    speaker: "심연의 군주",
    lines: [
      "작은 보석 수집가가 여기까지 왔군…",
      "나는 가라앉은 왕국의 원한이다. 아뜰란티스와 함께, 모든 것이 심연으로 귀할 것이다!",
      "보석의 빛도, 이 세계도, 네 이름조차도 — 전부 잊히리라!",
    ],
  },
  behemothDone: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "거수가 무너지자 얼어붙은 차원문이 녹아나고 있어!",
      "…그런데 저 마지막 문에서 느껴지는 기운은 달라. 왕좌로 가는 길이야.",
      "마지막이야, {name}. 준비됐지?",
    ],
  },
  /* ================= 여관 (v2.2 — 실내 취침 연출) ================= */
  innkeeper: {
    speaker: "여관 주인 로안",
    lines: [
      "어서 오세요, {name}. 여관 '쉼터'예요.",
      "숙박은 20G — 따뜻한 침대에서 푹 자면 HP/MP가 전부 회복돼요.",
      "잠깐 동안 몸이 개운해지는 버프 효과도 따라와요. 쉬어 갈까요?",
    ],
  },
  innkeeperNoMoney: {
    speaker: "여관 주인 로안",
    lines: [
      "앗, 골드가 부족하네요… 숙박비는 20G예요.",
      "밖에서 몬스터나 잡고 오면 금방 모이지 않을까? 죄송해요~",
    ],
  },
  innkeeperSlept: {
    speaker: "여관 주인 로안",
    lines: ["좋은 잠자리였나요? 천천히 가세요, 모험가님!"],
  },
  /* ================= 전직 (v1.8 클래스 트리) ================= */
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
  /* ================= 반복 토벌 의뢰 수주 (v2.3 — NPC 수주 게이트, 지시 #4) ================= */
  merchantRepeat: {
    speaker: "상인 라고스",
    lines: [
      "오, {name}! 그 근방 소문 다 들었어. 토벌 실력이 대단하다며?",
      "의뢰판에 네 눈짐을 띤 토벌 의뢰가 붙었어. 구역 스토리를 끝낸 곳이라면 언제든 반복 수주할 수 있어!",
      "의뢰를 수주하면 퀘스트창에 [반복] 토벌 의뢰가 떠. 목표를 채울 때마다 골드와 경험치를 받지.",
      "자, 오늘의 의뢰 — 수주해 가게!",
    ],
  },
  /* __FILLER_DIALOGUES__ */
};

/* ================= 구역 안내 대사 자동 생성 (구역별 탐험 분위기 대사) ================= */

const WALK_AMBIENT: Record<ChapterKey, string[]> = {
  forest: [
    "숲의 신전 폐허가 점점 가까워져. 돌기둥 사이로 보석 기운이 새어 나오고 있어.",
    "나뭇잎 사이로 심연의 기운이 배어 나와. {name}, 물약 상태 확인했지?",
    "이 늑대들… 보석 기운에 미친 것 같아. 발소리가 점점 요란해진다.",
  ],
  kingdom: [
    "쿠소디아의 함대가 늪지 너머에 정박해 있어. 왕국의 기을 본다?",
    "식인초들이 점점 왕국 성벽 쪽으로 번지고 있어. 시간이 없다, {name}!",
    "기사단이 이 근방을 순찰 중이래. 조금만 더 버티면 왕성 초대장이 올 거야.",
  ],
  alfheim: [
    "성전의 기둥이 하나씩 불이 꺼지듯 어두워지고 있어… 니드호그가 깨어나는 소리.",
    "요정들의 노래가 아까까지 들렸는데… 이제는 하수인의 낮은 울림만 남았어.",
    "여왕의 가호가 네를 지켜보고 있어. 서두르자, {name}!",
  ],
  muspelheim: [
    "지열이 발밑을 태운다. 극열의 날이 다가올수록 정령들이 포악해져.",
    "멀리 지하도시의 첨탑이 보여. 엘렌이 그 안에 갇혀 있대.",
    "용암이 올라오는 소리… 무스펠헤임의 심장이 뛰고 있어, {name}.",
  ],
  niflheim: [
    "내쉰 숨이 얼음 결정이 돼. 극한의 해역은 이름대로야.",
    "얼음 성전의 불빛이 저기 희미하게 보여. 흐레스라는 마법사가 있대.",
    "펜리르의 발자국이… 커지고 있어. 절대 정면 승부하지 마. 아직은!",
  ],
  cave: [
    "수정 광맥이 흐릿하게 빛나. 어둠 요정들이 이곳을 지키고 있어.",
    "거미줄이 점점 촘촘해져. 둥지가 가까워졌다는 증거야, {name}.",
    "여왕의 목소리가 뿌리를 타고 들려와. '아직이다…' 라고.",
  ],
  nidavellir: [
    "룬 각인이 빛나는 광산. 난쟁이 조합의 망치 소리가 들리지?",
    "폭주한 골렘이 광맥을 부숴대. 해와 달이 없으니 기계도 미쳐 돌아가.",
    "광산 최심부에 룬 제단이 있대. 스콜과 하티가 거기 잠들어 있대, {name}.",
  ],
  hel: [
    "절벽 아래 전쟁의 잔재가 늘어서 있어. 대전쟁의 흉터야.",
    "헬 하운드의 눈이 어둠 속에서 반짝여… 지지 말고 앞서 가자.",
    "저기 저택 불빛… 칼립소 할머니의 여동생이 그곳에 있다고 했지.",
  ],
  abyss: [
    "가라앉은 대륙의 폐허… 옛 아뜰란티스의 자국이 바닥마다 보여.",
    "왕좌의 불빛이 점점 커진다. 대악마의 기운이… 숨을 쉬고 있어.",
    "요르문간드의 울림이 바다를 타고 와. 마지막이야, {name}.",
  ],
};

for (const spec of CHAPTERS) {
  const lines = WALK_AMBIENT[spec.key];
  for (let i = 0; i < 3; i++) {
    DIALOGUES[`ch${spec.num}Walk${i + 1}`] = {
      speaker: "펜던트의 정령 아부디토스",
      lines: [lines[i]],
    };
  }
  DIALOGUES[`eliteWarn${spec.num}`] = {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "…{name}, 잠깐. 이 구역의 기운이 뒤틀리고 있어.",
      `정예 ${ENEMIES[spec.main].name} — 무리의 대장이 우리를 기다리고 있어.`,
      "물약을 챙기고, 상대의 공격 패턴을 봐가며 싸우자!",
    ],
  };
  DIALOGUES[`bossApproach${spec.num}`] = {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      `제${spec.num}장의 심장부 — ${spec.title}의 왕좌가 눈앞이야.`,
      "마지막 물약 확인, 장비 점검… 그리고 {name}, 긴장 풀어. 우리가 함께야.",
      "문을 열자. 이 해역의 진짜 주인을 만나러!",
    ],
  };
}

/* ================= 전직 스토리 (v2.0 — 사용자 지시 #13) ================= */
/*  2차/3차 전직마다 직업 계열 고유 스토리 퀘스트 체인 (퀘스트 + 컷씬 대사 + 보상) */

export type JobStoryStep = {
  id: string;
  type: "hunt" | "collect" | "elite";
  title: string;
  desc: string;
  need?: number;
  /** hunt 단계 — 현재 해역의 대표 몬스터로 동적 치환 (null = 어떤 몬스터든) */
  targetLabel: string;
  dialogue: string;
  reward: number;
  expReward: number;
};

export type JobStoryDef = {
  family: FamilyKey;
  tier: 2 | 3;
  title: string;
  startDialogue: string;
  doneDialogue: string;
  reward: { gold: number; ap: number; buffKey?: BuffKey };
  steps: JobStoryStep[];
};

const JOB_SPKR: Record<FamilyKey, string> = {
  warrior: "전사 계열의 시조 '강철의 마르테'",
  ranger: "궁수 계열의 시조 '바람의 세이렌'",
  mage: "마법사 계열의 시조 '만개한 세이렌'",
};

function jobStory(family: FamilyKey, tier: 2 | 3): JobStoryDef {
  const nameOf: Record<FamilyKey, string> = { warrior: "전사", ranger: "궁수", mage: "마법사" };
  const stepBase = tier === 2 ? 10 : 22;
  const title =
    family === "warrior"
      ? tier === 2 ? "강철의 각오" : "전장의 정점"
      : family === "ranger"
        ? tier === 2 ? "바람의 재능" : "천공의 사수"
        : tier === 2 ? "마나의 문" : "심연의 지혜";
  return {
    family,
    tier,
    title: `${nameOf[family]} 계열 전직 스토리 — ${title}`,
    startDialogue: `js${family}${tier}Start`,
    doneDialogue: `js${family}${tier}Done`,
    reward: {
      gold: tier === 2 ? 400 : 1200,
      ap: tier === 2 ? 5 : 10,
      buffKey: tier === 2 ? "buff_atk" : "buff_exp",
    },
    steps: [
      {
        id: "s1",
        type: "hunt",
        title: tier === 2 ? "[전직 스토리] 무장 훈련" : "[전직 스토리] 정예 사냥",
        desc: `지금 머무는 해역의 몬스터 ${stepBase}마리를 처치하고 실전 감각을 되찾자.`,
        need: stepBase,
        targetLabel: "지금 해역의 몬스터",
        dialogue: `js${family}${tier}Step1`,
        reward: tier === 2 ? 150 : 400,
        expReward: tier === 2 ? 220 : 800,
      },
      {
        id: "s2",
        type: "collect",
        title: tier === 2 ? "[전직 스토리] 가호의 증표" : "[전직 스토리] 유산의 조각",
        desc: "보석의 흔적 1개를 회수해 계열의 시조에게 바치자. (해역 어디든 빛나는 흔적)",
        targetLabel: "보석의 흔적",
        dialogue: `js${family}${tier}Step2`,
        reward: tier === 2 ? 180 : 500,
        expReward: tier === 2 ? 260 : 900,
      },
      {
        id: "s3",
        type: "elite",
        title: tier === 2 ? "[전직 스토리] 시조의 시험" : "[전직 스토리] 심연의 정예",
        desc: "전직관에서 시조가 소환한 시험 상대를 쓰러뜨리자. (카이엔에게 말 걸기)",
        targetLabel: "시험 상대",
        dialogue: `js${family}${tier}Step3`,
        reward: tier === 2 ? 250 : 800,
        expReward: tier === 2 ? 400 : 1400,
      },
    ],
  };
}

export const JOBSTORY: Record<FamilyKey, Record<2 | 3, JobStoryDef>> = {
  warrior: { 2: jobStory("warrior", 2), 3: jobStory("warrior", 3) },
  ranger: { 2: jobStory("ranger", 2), 3: jobStory("ranger", 3) },
  mage: { 2: jobStory("mage", 2), 3: jobStory("mage", 3) },
};

/* 전직 스토리 대사 (계열 × 차수 × 단계) */
const JS_LINES: Record<FamilyKey, Record<2 | 3, { start: string[]; s1: string[]; s2: string[]; s3: string[]; done: string[] }>> = {
  warrior: {
    2: {
      start: ["『…왔는가, 후예여. 나는 강철의 마르테 — 최초의 전사다.』", "『전사의 힘은 검이 아니라 '버틸 결심'에서 나온다. 몸으로 보여라!』"],
      s1: ["『좋다. 검이 몸에 붙기 시작했군.』", "『하지만 힘만으로는 전장을 못 넘는다. 다음을 보여라.』"],
      s2: ["『…그 빛, 옛 전우들의 가호와 같다.』", "『인정한다. 이제 마지막 시험 — 내 앞에서 쓰러져라!』"],
      s3: ["『…통과다. 그 상처, 숨김없이 받아냈군.』", "『오늘부로 너는 진정한 전사다. 강철의 각오를 이어받아라!』"],
      done: ["『앞으로 맞서는 적이 강할수록 — 너의 검은 더 무거워질 것이다.』", "『기대하마, 전사여.』"],
    },
    3: {
      start: ["『시간이 흘렀군, 전사여. 3차 계승의 시간이다.』", "『이번 시험은 전장 그 자체. 죽음의 냄새를 견뎌라!』"],
      s1: ["『전장의 냄새를 익혔군. 하지만 아직 부족하다.』", "『전사의 검은 무게를 견디는 자의 것이다!』"],
      s2: ["『그 조각… 전설의 전사들의 유산이다.』", "『그 무게를 감당할 자만이 정점에 선다!』"],
      s3: ["『…심연의 정예를 베어냈군.』", "『인정한다. 지금이야말로 — 전장의 정점에 서라!』"],
      done: ["『너의 이름은 이제 전설의 한 페이지가 될 것이다.』", "『서라, 워로드(팔라딘). 바다가 너를 기억한다!』"],
    },
  },
  ranger: {
    2: {
      start: ["『…바람을 타고 왔구나. 나는 바람의 세이렌 — 최초의 궁수다.』", "『활은 멀리를 보는 자의 무기다. 네 '눈'을 보여라!』"],
      s1: ["『호오, 바람의 흐름을 읽기 시작했군.』", "『하지만 시야가 좁다. 더 넓은 세계를 봐라!』"],
      s2: ["『…그 빛을 겨눌 수 있었나. 눈이 트였군.』", "『인정한다. 마지막으로 — 나에게 화살을 쏘아라!』"],
      s3: ["『…단 한 발로 나를 흘렬케 했군.』", "『오늘부로 너는 진정한 궁수다. 바람의 재능을 이어받아라!』"],
      done: ["『바람이 네 편이 될 것이다. 어디에 있든.』", "『즐겁게 쏘아라, 궁수여!』"],
    },
    3: {
      start: ["『천공의 자리가 비어 있었다. 이제 네가 오를 때다.』", "『최후의 시험 — 심연을 겨누어라!』"],
      s1: ["『심연의 움직임을 한 발로 읽다니.』", "『하지만 천공은 그 정도가 아니다! 더 쏴라!』"],
      s2: ["『…유산의 조각을 화살처럼 다루다니.』", "『그 눈이라면 — 하늘 위까지 닿는다!』"],
      s3: ["『심연의 정예를 격추했군. 완벽하다.』", "『오르라! 천공의 사수가 되어라!』"],
      done: ["『이제 네 화살은 지평선 너머의 어둠도 꿰뚫는다.』", "『날아라, 이글아이(템페스트)!』"],
    },
  },
  mage: {
    2: {
      start: ["『…마나가 네게 궁금해하고 있구나. 나는 만개한 세이렌 — 최초의 마법사다.』", "『마법은 지식이 아니라 '질문'이다. 물어봐라, 세계에!』"],
      s1: ["『오, 마나와 호흡이 맞기 시작했군.』", "『하지만 아직 얕다. 더 깊이 물어봐라!』"],
      s2: ["『…보석의 문답을 읽었군.』", "『인정한다. 마지막 시험 — 나의 마법을 받아라!』"],
      s3: ["『…정면에서 받아냈군. 훌륭하다.』", "『오늘부로 너는 진정한 마법사다. 마나의 문을 열어라!』"],
      done: ["『세계의 모든 마나가 네 질문에 답할 것이다.』", "『쓰고 싶은 만큼 써라, 마법사여!』"],
    },
    3: {
      start: ["『심연의 지혜… 마지막 문이 열리는군.』", "『이번 시험은 '심연 그 자체'. 견뎌라!』"],
      s1: ["『심연의 파동을 마나로 짜냈군.』", "『하지만 심연은 무한하다. 더 들어가라!』"],
      s2: ["『…유산의 문장을 해독했다니.』", "『그 지혜라면 — 심연의 왕좌도 뒤집을 수 있다!』"],
      s3: ["『심연의 정예를 지식으로 제압했군.』", "『완성이다. 심연의 지혜를 받아라!』"],
      done: ["『이제 너의 마법은 세계의 법칙을 다시 쓸 것이다.』", "『일어나라, 아크메이지(세이지)!』"],
    },
  },
};

for (const fam of ["warrior", "ranger", "mage"] as FamilyKey[]) {
  for (const tier of [2, 3] as const) {
    const L = JS_LINES[fam][tier];
    const base = `js${fam}${tier}`;
    DIALOGUES[`${base}Start`] = { speaker: JOB_SPKR[fam], lines: L.start };
    DIALOGUES[`${base}Step1`] = { speaker: JOB_SPKR[fam], lines: L.s1 };
    DIALOGUES[`${base}Step2`] = { speaker: JOB_SPKR[fam], lines: L.s2 };
    DIALOGUES[`${base}Step3`] = { speaker: JOB_SPKR[fam], lines: L.s3 };
    DIALOGUES[`${base}Done`] = { speaker: JOB_SPKR[fam], lines: L.done };
  }
}

/* ================= 스탯 자동 배분 (v2.0 — 사용자 지시 #18, 메이플 4:1 감각) ================= */

export const AUTO_ALLOC: Record<FamilyKey, { str: number; dex: number; int: number; luk: number }> = {
  warrior: { str: 4, dex: 1, int: 0, luk: 0 }, // 힘 4 : 민첩 1
  ranger: { str: 1, dex: 4, int: 0, luk: 0 }, // 민첩 4 : 힘 1
  mage: { str: 0, dex: 0, int: 4, luk: 1 }, // 지력 4 : 행운 1
};

/** AP를 계열 배분 비율로 나눠 담는다 (남는 AP는 주스탯에 몰아줌) */
export function autoAllocPlan(family: FamilyKey, ap: number): { str: number; dex: number; int: number; luk: number } {
  const r = AUTO_ALLOC[family];
  const total = r.str + r.dex + r.int + r.luk;
  const out = { str: 0, dex: 0, int: 0, luk: 0 };
  if (total === 0 || ap <= 0) return out;
  const keys: (keyof typeof out)[] = ["str", "dex", "int", "luk"];
  let left = ap;
  // 라운드 로빈 배분 — 4:1 비율 유지
  let round = 0;
  while (left > 0) {
    for (const k of keys) {
      if (left <= 0) break;
      if (r[k] > 0 && round < r[k]) {
        out[k]++;
        left--;
      }
    }
    if (keys.every((k) => r[k] === 0 || round >= r[k])) {
      // 비율 1사이클 완료 → 주스탯 몰아주기
      const main = keys.reduce((a, b) => (r[a] >= r[b] ? a : b));
      out[main] += left;
      left = 0;
    }
    round++;
  }
  return out;
}
