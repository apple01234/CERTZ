/** Selected Evernote documents 3/4/6/7/8; later, unwritten events are not story quests. */
import type { BossDef, CHAPTERS, QuestDef } from "./stages";

type Chapter = (typeof CHAPTERS)[number];
export type GrandPlanetBossKey = "littlestar" | "jade" | "reversecore" | "fabian" | "snorikaking";
export type GrandPlanetDialogue = { speaker: string; lines: string[] };

export const GRAND_PLANET_ROUTE = ["dlcstargate", "dlcprisma", "dlcreverse", "dlcneocity"] as const;
export const GRAND_PLANET_CANON_END = "dlcneocity10";

function beat(sub: number, dialogue: string, title: string, desc: string, type: QuestDef["type"] = "talk", targetKey?: QuestDef["targetKey"]) {
  return {
    sub, dialogue,
    quest: { id: dialogue, type, title, desc, need: type === "hunt" ? 4 : 1,
      targetLabel: title, targetKey, dialogue, reward: 180 + sub * 15, expReward: 160 + sub * 25 },
  };
}

/** Stable chapter/map IDs preserve old equipment, travel and saved class contracts. */
export const GRAND_PLANET_CHAPTERS: Partial<Record<Chapter["key"], Partial<Chapter>>> = {
  dlcstargate: {
    title: "그랜드 플레닛 1 — 스타게이트", subtitle: "문지기의 장미 · 뒤틀린 지면 · 우주고래",
    intro: "gpDeparture", boss: "littlestar" as Chapter["boss"], bossDone: "gpWhale",
    lvGate: { enter: 0, mid: 0 },
    beats: [
      beat(1, "gpDeparture", "선발대의 선물", "라일락 연합의 선물을 확인하고 워프아일랜드로 향한다."),
      beat(2, "gpBoundary", "게이트의 경계", "스칼렛이 게이트의 봉인을 걷는 모습을 지켜본다."),
      beat(3, "gpLittleStar", "장미를 바라보는 문지기", "스타게이트의 관리자 리틀스타에게 길을 묻는다."),
      beat(4, "gpRose", "행성의 동력원", "리틀스타가 장미를 지키는 이유를 조사한다.", "collect"),
      beat(5, "gpGround", "뒤틀리는 지면", "뒤틀린 지면에서 안전한 길을 찾는다.", "reach"),
      beat(6, "gpDrain", "방문자의 힘", "방문자의 원소를 흡수하는 장미의 흔적을 확인한다.", "collect"),
      beat(7, "gpStand", "동료가 만든 장벽", "발밑이 무너져도 동료의 장벽을 믿고 전진한다.", "reach"),
      beat(8, "gpVirus", "우주의 감염", "뒤틀린 지면의 잔영 네 체를 막고 장미로 접근한다.", "hunt", "wraith"),
      beat(9, "gpRoseCore", "장미의 핵", "방문자를 붙드는 동력핵을 찾아 문지기의 보호를 끊는다.", "collect"),
      beat(10, "gpLittleStarFight", "스타게이트의 문지기", "행성과 하나가 된 리틀스타를 제압해 장미의 힘을 끊는다.", "boss"),
    ],
    repeat: { need: 6, gold: 180, exp: 180, title: "[원정] 별의 잔영", desc: "본편 진행과 별도로 스타게이트의 잔영을 정리한다." },
  },
  dlcprisma: {
    title: "그랜드 플레닛 2 — 프라이즈 프리즈마", subtitle: "마법수정 · 아이리스의 루프 · 제이드의 분신",
    intro: "gpPrisma", boss: "jade" as Chapter["boss"], bossDone: "gpIrisThanks",
    lvGate: { enter: 0, mid: 0 },
    beats: [
      beat(1, "gpPrisma", "마법공학의 도시", "우주고래에서 내려 시장 제이드의 의뢰를 듣는다."),
      beat(2, "gpIris", "아이리스의 안내", "연구소에서 아이리스와 에너지 코어의 상태를 확인한다."),
      beat(3, "gpCrystal", "마법수정과 중앙코어", "수정을 억제하는 중앙코어의 기록을 찾는다.", "collect"),
      beat(4, "gpTea", "라벤더 꽃차", "수면 성분이 든 차와 준비된 해독제를 확인한다.", "collect"),
      beat(5, "gpLoop", "357번째 루프", "아이리스가 반복해 온 시간을 듣고 같은 실패를 피한다."),
      beat(6, "gpJadePlan", "시장의 실험", "제이드가 도시보다 자신의 힘을 택했다는 사실을 확인한다."),
      beat(7, "gpClones", "마공학 에너지 분신", "중앙코어로 가는 길의 분신 네 기를 막는다.", "hunt", "runegolem"),
      beat(8, "gpLucyShield", "자연의 장막", "루시가 아이리스를 보호하는 동안 중앙코어의 틈으로 접근한다.", "reach"),
      beat(9, "gpWaterBlade", "살리기 위한 물의 칼날", "아이리스에게 물의 원소를 담은 단검을 전달한다.", "collect"),
      beat(10, "gpJadeFight", "제이드와 마법수정", "분신과 방어막의 빈틈을 이용해 흡수된 동료를 구한다.", "boss"),
    ],
    repeat: { need: 6, gold: 220, exp: 220, title: "[원정] 공방의 기계", desc: "도시의 서사와 별도로 공방의 폭주 기계를 점검한다." },
  },
  dlcreverse: {
    title: "그랜드 플레닛 3 — 리버스 사이버", subtitle: "독가스의 기록 · 엘버트와 패트릭 · 푸른 수국",
    intro: "gpReverse", boss: undefined, bossDone: "gpHydrangea",
    lvGate: { enter: 0, mid: 0 },
    beats: [
      beat(1, "gpReverse", "안개 속 안내", "패트릭의 안내를 따라가기 전 엘버트의 경고를 듣는다."),
      beat(2, "gpElbert", "세비지 플레이스", "위장용 파츠를 받아 지하의 반란군에게 합류한다.", "collect"),
      beat(3, "gpTrain", "궤도를 벗어난 열차", "벽을 뚫고 나온 열차의 전투 드론 네 기를 막는다.", "hunt", "minion"),
      beat(4, "gpJennifer", "제니퍼와 지하전력소", "제니퍼와 함께 출입칩을 확보한다.", "collect"),
      beat(5, "gpGasDiary", "제조연구 120일차", "가스로 사람을 기계화한 연구일지를 회수한다.", "collect"),
      beat(6, "gpIrisReturn", "안개의 보안관", "보안관으로 위장한 아이리스와 컨트롤타워에서 만난다."),
      beat(7, "gpPatrick", "아버지의 고백", "패트릭과 엘버트의 이야기를 끝까지 듣는다."),
      beat(8, "gpCoreFight", "독가스 제어 중단", "컨트롤타워 AI를 파괴해 독가스 공급을 끊는다.", "boss"),
      beat(9, "gpRescue", "아직 갚지 못한 빚", "제니퍼의 불기둥과 텔레포트건이 엘버트를 구하는 곳으로 향한다.", "reach"),
      beat(10, "gpHydrangea", "푸른 수국 한 송이", "희생자를 추모하고 복구를 시작하는 도시를 지켜본다."),
    ],
    repeat: { need: 6, gold: 240, exp: 240, title: "[원정] 지하선로 점검", desc: "도시 복구와 별도로 남은 순찰 기계를 점검한다." },
  },
  dlcneocity: {
    title: "그랜드 플레닛 4 — 네오시티", subtitle: "다섯 도장 · 무너진 경계 · 축제와 기억",
    intro: "gpNeo", boss: undefined, bossDone: "gpGrandfather",
    lvGate: { enter: 0, mid: 0 },
    beats: [
      beat(1, "gpNeo", "지도에 없는 행성", "외부지역에서 원소의 코인으로 분수대의 문을 연다.", "collect"),
      beat(2, "gpFiveSeals", "다섯 도장의 규칙", "외부·내부·중립지역의 차이와 도장의 조건을 듣는다."),
      beat(3, "gpBaron", "운명의 도장", "바론의 동전과 이름에 반응하는 기록을 조사한다.", "collect"),
      beat(4, "gpFabian", "힘의 도장", "파비앙의 돌진을 피하고 반격의 빈틈을 노려 대련한다.", "boss"),
      beat(5, "gpCourage", "용기의 열쇠", "리안의 용기와 모은 도장으로 중앙타워의 문을 연다.", "collect"),
      beat(6, "gpRavid", "라비드의 중립지역", "내부지역으로 보였던 공간의 균열을 확인한다.", "collect"),
      beat(7, "gpPocket", "마공학 포켓", "아이리스가 보낸 좌표를 분수대 석판에 맞춘다.", "collect"),
      beat(8, "gpFestival", "축제의 세 임무", "호위·회수·정보팀의 합류 지점으로 이동한다.", "reach"),
      beat(9, "gpFalseIris", "가짜 아이리스", "귀쥐의 위장을 확인하고 이동용 꽃으로 감옥을 빠져나온다.", "collect"),
      beat(10, "gpGrandfather", "내면의 거울", "과거만을 비추는 그림 앞에서 리안과 할아버지의 기억을 듣는다."),
    ],
    repeat: { need: 6, gold: 260, exp: 260, title: "[원정] 네오시티 대련", desc: "공개된 이야기 이후의 결말을 만들지 않고 대련만 반복한다." },
  },
};

/** The source tells no journeys/defeats in these maps; preserve them as optional expeditions. */
export const GRAND_PLANET_EXPLORATIONS = {
  dlcmech: { title: "자유 원정 — 메카닉 블러드시티", setting: "그랜드 플레닛의 기계무덤. 지정 문서에는 이 지역 여정의 결말이 없다." },
  dlcswallow: { title: "자유 원정 — 다크스왈로해브니스", setting: "그랜드 플레닛의 대공전함. 본편의 다음 사건으로 확정하지 않는 원정 구역이다." },
  dlcocean: { title: "자유 원정 — 오션 코멘", setting: "유메의 꿈의 영역이 감싸는 혜성. 꿈임을 인지하거나 동료가 깨워야 수면에서 벗어날 수 있다." },
  dlcopinicia: { title: "자유 원정 — 오피니시아", setting: "가문들이 자리한 도시. 그래스트·아리아노·오르페우스 등의 관계는 가문 기록에서 확인한다." },
  dlcnovel: { title: "자유 원정 — 노벨 플로스", setting: "비밀의 화원. 넬리야와 꽃의 원소에 관한 정보가 남아 있다." },
  dlcsernium: { title: "자유 원정 — 세르니움", setting: "리안 일행의 고향. 태양의 데스티니, 달의 페이트, 우주의 그래스트와 이어진 도시이다." },
} as const;

/* ────────────────────────── 정본 가문 등록부 (7.txt) ────────────────────────── */

/**
 * vc267 (P7a 정본 감사) — 7.txt 「영준프린세스-가문 정리본」의 25가문.
 *
 * 왜 코드로 옮겼나
 *   7.txt 에 25가문이 표로 정리돼 있는데 게임 코드에는 16가문만 남아 있었다.
 *   특히 제로세계 6가문(에버포스·샌티널·카르테르·클로체스·라바이즈·유월·하나사키)이
 *   통째로 빠져 "세계가 셋"이라는 정본 골격이 코드에서 확인되지 않았다.
 *   이름만 흩어 놓으면 또 지워지므로 **단일 출처 테이블**로 고정하고 테스트가 강제한다.
 *
 * 계약
 *   · 표시 문자열 전용. 세이브 키가 아니다(stage/questId/classKey 와 무관).
 *   · 원소는 `data.ts` 의 `ElemKey` 부분집합으로만 적는다 — 새 원소를 만들지 않는다.
 *     7.txt 의 '체스와 저울'/'아트'/'조종'/'반전'처럼 ElemKey 에 없는 힘은
 *     `power` 에 정본 표기를 그대로 남기고 element 는 "none" 으로 둔다.
 *   · fallen/true15 표시는 7.txt 의 #/* 표기를 그대로 옮긴 것이다.
 */
export type CanonFamily = {
  key: string;
  /** 한국어 가문명 (정본 표기 그대로) */
  name: string;
  /** 소속 세계 */
  world: "lilac" | "grand" | "zero";
  /** 정본 3.txt 의 힘 표기 */
  power: string;
  /** ElemKey 부분집합 — 대응 원소가 없으면 "none" */
  element: "fire" | "water" | "wind" | "electric" | "earth" | "nature" | "ice" | "light" | "dark" | "none";
  /** 7.txt 의 * 표시 — 15가문 */
  true15: boolean;
  /** 7.txt 의 # 표시 — 몰락한 가문 */
  fallen: boolean;
  /** vc279 — 정본 7.txt 의 영주/가주 이름("가문의 X" 표기). 없으면 null.
   *
   *  [왜 추가했나] 7.txt 는 가문마다 영주(또는 가주)를 명시한다:
   *    에버포스=벨리카 / 샌티널=비에르 / 카르테르=에이리 / 라바이즈=피닉스 /
   *    유월=종려 / 하나사키=카즈하 / 페르티에스=레이지스 …
   *  그런데 코드에는 이름만 있고 **영주 정보가 통째로 빠져 있었다**(vc278 대조:
   *  비에르·에이리·피닉스·종려·카즈하·레이지스 6개가 src/game 어디에도 없음).
   *  도감·대사에서 "○○ 가문의 영주"를 쓰려면 정본 이름이 필요하다.
   *
   *  [주의] 정본에 사람 이름이 없는 가문(이그니션='대장장이의 가문', 리버스=설명만)은
   *  null 로 둔다. **없는 이름을 만들어내지 않는다**(지시서 §0-1). */
  lord: string | null;
  /** 영주의 칭호 — '영주' | '가주' | '왕' 등 정본 표기 그대로. lord 가 null 이면 null. */
  lordTitle: string | null;
};

/** 7.txt 순서 그대로. 라일락 월드 5 · 그랜드 플레닛 13 · 제로세계 7 = 25가문. */
export const CANON_FAMILIES: readonly CanonFamily[] = [
  /* 라일락 월드 */
  { key: "edeliona", name: "에델리오나", world: "lilac", power: "빛과 어둠", element: "light", true15: true, lord: "스칼렛", lordTitle: "여왕", fallen: false },
  { key: "esteban", name: "에스테반", world: "lilac", power: "물", element: "water", true15: true, lord: "카르텔", lordTitle: "가주", fallen: false },
  { key: "crenrelve", name: "크렌렐브", world: "lilac", power: "대지", element: "earth", true15: false, lord: "시엘", lordTitle: "가주", fallen: false },
  { key: "idenmir", name: "이덴미르", world: "lilac", power: "눈", element: "ice", true15: true, lord: "아덴", lordTitle: "가주", fallen: false },
  { key: "ecredit", name: "에크레디트", world: "lilac", power: "자연과 제작", element: "nature", true15: true, lord: "루시", lordTitle: "가주", fallen: false },
  /* 그랜드 플레닛 */
  { key: "grast", name: "그래스트", world: "grand", power: "우주", element: "light", true15: true, lord: "리안", lordTitle: "가주", fallen: false },
  { key: "destiny", name: "데스티니", world: "grand", power: "태양", element: "fire", true15: true, lord: "아리", lordTitle: "가주", fallen: false },
  { key: "fate", name: "페이트", world: "grand", power: "달", element: "ice", true15: true, lord: "루나", lordTitle: "가주", fallen: false },
  { key: "carrion", name: "카르리온", world: "grand", power: "어둠", element: "dark", true15: true, lord: "페르온", lordTitle: "가주", fallen: true },
  { key: "ariano", name: "아리아노", world: "grand", power: "아트", element: "none", true15: true, lord: "란", lordTitle: "가주", fallen: false },
  { key: "flame", name: "엘리자베스-플래임", world: "grand", power: "불", element: "fire", true15: true, lord: "제니퍼", lordTitle: "가주", fallen: false },
  { key: "orpheus", name: "오르페우스", world: "grand", power: "주문과 주술", element: "dark", true15: false, lord: "제르", lordTitle: "가주", fallen: false },
  { key: "selina", name: "셀리나", world: "grand", power: "무기", element: "none", true15: false, lord: "시아", lordTitle: "가주", fallen: false },
  { key: "ignition", name: "이그니션", world: "grand", power: "도공", element: "fire", true15: false, lord: null, lordTitle: null, fallen: false },
  { key: "jillian", name: "질리언", world: "grand", power: "조종", element: "none", true15: true, lord: "캐스터", lordTitle: "가주", fallen: false },
  { key: "reverse", name: "리버스", world: "grand", power: "반전", element: "electric", true15: false, lord: null, lordTitle: null, fallen: false },
  { key: "pertiers", name: "페르티에스", world: "grand", power: "지배", element: "dark", true15: true, lord: "레이지스", lordTitle: "가주", fallen: true },
  /* 제로세계 — 이 7가문이 코드에 전혀 없었다 */
  { key: "everforce", name: "에버포스", world: "zero", power: "번개", element: "electric", true15: true, lord: "벨리카", lordTitle: "영주", fallen: false },
  { key: "sentinel", name: "샌티널", world: "zero", power: "모래", element: "earth", true15: true, lord: "비에르", lordTitle: "영주", fallen: false },
  { key: "carter", name: "카르테르", world: "zero", power: "저울과 체스", element: "none", true15: true, lord: "에이리", lordTitle: "영주", fallen: false },
  { key: "cloches", name: "클로체스", world: "zero", power: "얼음", element: "ice", true15: false, lord: "클로체스", lordTitle: "가주", fallen: true },
  { key: "ravais", name: "라바이즈", world: "zero", power: "용암", element: "fire", true15: false, lord: "피닉스", lordTitle: "영주", fallen: true },
  { key: "yuwol", name: "유월", world: "zero", power: "바위", element: "earth", true15: true, lord: "종려", lordTitle: "영주", fallen: false },
  { key: "hanasaki", name: "하나사키", world: "zero", power: "바람", element: "wind", true15: true, lord: "카즈하", lordTitle: "영주", fallen: false },
  /* 스노리카는 왕국명(6.txt). 클로체스 가문의 왕국이므로 가문 목록과 분리해 둔다. */
] as const;

/** 왕국·도시 이름 — 가문이 아닌 것들. 표시용 단일 출처. */
export const CANON_PLACES = {
  lilacWorld: "라일락 월드",
  grandPlanet: "그랜드 플레닛",
  zeroWorld: "제로세계",
  snorika: "스노리카",
  sernium: "세르니움",
  opinisia: "오피니시아",
  neocity: "네오시티",
} as const;

/** 가문명 빠른 조회 — HUD/도감에서 이름만 필요할 때. */
export const CANON_FAMILY_BY_NAME: Readonly<Record<string, CanonFamily>> = Object.fromEntries(
  CANON_FAMILIES.map((f) => [f.name, f]),
);

/** vc279 — 영주 이름 빠른 조회. 대사에서 "○○ 가문의 영주"를 쓸 때.
 *  정본에 사람 이름이 없는 가문(이그니션·리버스)은 undefined. 만들어내지 않는다. */
export const CANON_FAMILY_BY_LORD: Readonly<Record<string, CanonFamily>> = Object.fromEntries(
  CANON_FAMILIES.filter((f) => f.lord !== null).map((f) => [f.lord as string, f]),
);

/**
 * vc279 — 가문의 정본 한 줄 소개. 대사·도감 공용.
 *
 * 정본 7.txt 의 표기를 그대로 조합한다. 없는 정보(영주 이름)는 문장에서
 * **생략**한다 — "null 영주" 같은 문구가 나오면 안 되고, 추측으로 채우지도 않는다.
 *
 * @example familyBlurb(CANON_FAMILY_BY_NAME["에버포스"])
 *   → "에버포스 — 번개. 벨리카 영주. 15가문."
 */
export function familyBlurb(f: CanonFamily): string {
  const parts: string[] = [`${f.power}.`];
  if (f.lord) parts.push(`${f.lord} ${f.lordTitle ?? "영주"}.`);
  if (f.fallen) parts.push("몰락한 가문.");
  else if (f.true15) parts.push("15가문.");
  return `${f.name} — ${parts.join(" ")}`;
}

/**
 * vc279 (P7c) — 스토리 선택지 정본. `storyChoices[key]` 에는 **id** 가 저장되고,
 * 표시에는 label 을 쓴다. 이 표가 id↔label 의 단일 출처다.
 *
 * [왜 정본 모듈에 두나] 선택지 문구는 스토리 정본(1.txt)에서 나온 것이므로
 * 시나리오 파일과 분리해 한 곳에서만 관리한다. 시나리오/lilacScenarios.ts 의
 * `choice` 스텝과 이 표가 **같은 id 집합**이어야 하며, 테스트가 그것을 강제한다.
 *
 * [주의] key 와 id 는 식별자다 — **절대 바꾸지 않는다**(세이브 호환).
 * label(표시 문구)만 바꿀 수 있다.
 */
export const CANON_STORY_CHOICES: Readonly<Record<string, readonly { id: string; label: string }[]>> = {
  /* 1.txt — 라일락의 질문 "너는 어떤 사람이 되고 싶니?" 에 대한 세 갈래.
   * 정본에 네 번째 갈래는 없다. */
  haruWho: [
    { id: "kill", label: "누군가를 죽이는 사람" },
    { id: "flee", label: "두려움에 도망치는 사람" },
    { id: "save", label: "누군가를 살리는 사람" },
  ],
};

/** 저장된 id 를 표시 라벨로 바꾼다. 없으면 undefined(대사 원문 유지). */
export function storyChoiceLabel(key: string, id: string | undefined): string | undefined {
  if (!id) return undefined;
  return CANON_STORY_CHOICES[key]?.find((o) => o.id === id)?.label;
}

/** Directly merge only these keys into BOSS_DEFS; existing training bosses keep their identities. */export const GRAND_PLANET_BOSSES: Record<GrandPlanetBossKey, Omit<BossDef, "key"> & { key: GrandPlanetBossKey }> = {
  littlestar: {
    key: "littlestar", name: "리틀스타 · 장미의 동력핵", hp: 24000, atk: 48, speed: 80, exp: 1700, gold: 900,
    tex: "boss3", orbTint: 0xe895df, introDialogue: "gpLittleStarFight", sig: "zones",
    patterns: { p1: ["zones", "ring"], p2: ["zones", "ring", "quake"], p3: ["zones", "ring", "quake", "beam"] },
  },
  jade: {
    key: "jade", name: "제이드 · 마공학 에너지 분신", hp: 32000, atk: 54, speed: 96, exp: 2200, gold: 1100,
    tex: "boss_vord", orbTint: 0x56e8e0, introDialogue: "gpJadeFight", sig: "summon", summonKey: "runegolem",
    patterns: { p1: ["slam", "beam"], p2: ["summon", "shieldcast", "beam"], p3: ["summon", "shieldcast", "beam", "crystalburst"] },
  },
  reversecore: {
    key: "reversecore", name: "컨트롤타워 AI", hp: 36000, atk: 56, speed: 64, exp: 2400, gold: 1200,
    tex: "boss", orbTint: 0x72cda0, introDialogue: "gpCoreFight", sig: "thunderfall",
    patterns: { p1: ["zones", "thunderfall"], p2: ["zones", "thunderfall", "beam"], p3: ["zones", "thunderfall", "beam", "counter"] },
  },
  fabian: {
    key: "fabian", name: "힘의 부호 파비앙 · 대련", hp: 26000, atk: 50, speed: 120, exp: 1800, gold: 900,
    tex: "boss_fenrir", orbTint: 0xffba80, introDialogue: "gpFabian", sig: "counter",
    patterns: { p1: ["charge", "slam"], p2: ["charge", "slam", "counter"], p3: ["charge", "counter", "slam"] },
  },
  snorikaking: {
    key: "snorikaking", name: "클로체스 · 얼어붙은 심장", hp: 28000, atk: 50, speed: 96, exp: 1800, gold: 1000,
    tex: "boss_hati", orbTint: 0xb4e5ff, introDialogue: "snowKing", sig: "frostnova",
    patterns: { p1: ["volley", "frostnova"], p2: ["frostnova", "zones", "charge"], p3: ["frostnova", "zones", "beam"] },
  },
};

/** Bosses away from the chapter's end are explicit; Neo City's ending remains a conversation. */
export const GRAND_PLANET_STAGE_BOSSES = { dlcreverse8: "reversecore", dlcneocity4: "fabian" } as const;

export const SNORIKA_ENTRY = "snorika1";
export const SNORIKA_END = "snorika6";
export const SNORIKA_STORY = {
  title: "눈의 왕국 스노리카", source: "지정 문서 6 — 눈의왕국 스노리카",
  template: "howlrstone2", groundTex: "tile_snow", pathTex: "tile_ice", bg: "#101b34",
  returnStage: "youngprincessv", bossAt: 5, boss: "snorikaking" as const,
  beats: [
    beat(1, "snowBook", "천문대의 수상한 책", "벨리카·란·넬리야가 받은 책을 조사한다.", "collect"),
    beat(2, "snowChess", "눈사람을 만드는 아이", "체스가 간직한 친구의 이야기를 듣는다."),
    beat(3, "snowHeart", "얼어붙은 심장의 사명", "친구를 살리려 했던 체스와 설원의 마녀의 거래를 확인한다."),
    beat(4, "snowAriano", "아트필드와 번개의 장막", "란의 그림 장벽과 벨리카의 번개 사이로 빠져나갈 길을 연다.", "reach"),
    beat(5, "snowKing", "즉위식의 얼음 검", "얼어붙은 왕의 공격을 피하며 스칼렛이 출구를 여는 시간을 번다.", "boss"),
    beat(6, "snowReturn", "변하는 것과 변하지 않는 것", "책의 마지막 장을 보고 천문대로 돌아간다."),
  ],
};

export const GRAND_PLANET_DIALOGUES: Record<string, GrandPlanetDialogue> = {
  gpDeparture: { speaker: "라일락 연합", lines: ["전쟁이 끝나고 선발대는 신의도시 세르니움으로 향할 준비를 마쳤다.", "팔찌, 귀걸이, 성배, 펜던트, 로켓과 책. 동료들은 각자의 선물을 간직했다."] },
  gpBoundary: { speaker: "스칼렛", lines: ["라일락 월드와 그랜드 플레닛 사이의 게이트를 열겠어.", "세계를 잇는 문 너머에서 너희의 여정이 이어질 거야."] },
  gpLittleStar: { speaker: "리틀스타", lines: ["나는 스타게이트의 관리자이자 그랜드 플레닛의 문지기다.", "이 장미는 행성을 움직이는 동력원 중 하나이지."] },
  gpRose: { speaker: "리안", lines: ["행성과 장미가 연결되어 있어. 문지기의 말만 믿고 지나가서는 안 돼.", "저 장미가 무엇을 힘의 원천으로 삼는지 확인하자."] },
  gpGround: { speaker: "아리", lines: ["지면이 뒤틀리고 있어요. 앞으로 가기가 어렵습니다.", "장미 쪽으로 갈 길을 찾아야겠어요."] },
  gpDrain: { speaker: "리틀스타", lines: ["나의 힘은 어디에서 오느냐고?", "이곳에 온 너희들에게서 오는 것이지."] },
  gpStand: { speaker: "아리", lines: ["뒤에서 밀어주는 힘이 있어요. 장벽 같은 느낌입니다.", "제 말을 믿고 행성을 공격하세요. 장미도 함께 파괴될 거예요."] },
  gpVirus: { speaker: "리안", lines: ["누군가 문을 막기 위해 우주의 감염을 이용했어.", "지금은 장미에 붙잡히지 않게 동료들과 길을 열자."] },
  gpRoseCore: { speaker: "리안", lines: ["장미를 파괴시켜!", "문지기와 행성이 같은 힘으로 움직이고 있어."] },
  gpLittleStarFight: { speaker: "리틀스타", lines: ["이 행성이 나라고 해도 과언이 아니지.", "너희의 힘을 이 별의 동력으로 삼겠다."] },
  gpWhale: { speaker: "리안", lines: ["장미가 무너지자 뒤틀리던 지면도 잠잠해졌다.", "마침 시간이 됐네. 저 우주고래를 타면 프라이즈 프리즈마로 갈 수 있어."] },
  gpPrisma: { speaker: "제이드", lines: ["나는 프라이즈 프리즈마의 시장 제이드다.", "마법수정의 힘에 문제가 생겼어. 밖에 있는 아이리스를 찾아가 봐."] },
  gpIris: { speaker: "아이리스", lines: ["마법수정이 도시의 힘을 만들고 중앙코어가 그 힘을 억제해요.", "제대로 알지 못한 채 손대면 도시 전체가 위험해져요."] },
  gpCrystal: { speaker: "리안", lines: ["에너지 중앙코어와 마법수정은 서로 영향을 주고 있어.", "아이리스가 무엇을 멈추려 하는지 기록부터 살펴보자."] },
  gpTea: { speaker: "리엘", lines: ["이건 수면 성분이 강한 라벤더 꽃차야.", "이미 준비한 해독제가 있어. 방심하지 말고 동료들을 깨우자."] },
  gpLoop: { speaker: "아이리스", lines: ["357번째 루프예요. 같은 실패를 다시 겪고 싶지 않아요.", "이번에는 제이드가 도시를 희생시키는 걸 막아야 해요."] },
  gpJadePlan: { speaker: "제이드", lines: ["프라이즈 프리즈마가 없어지는 건 상관없어.", "나는 이 에너지를 내 힘으로 만들 거니까."] },
  gpClones: { speaker: "리안", lines: ["자신의 에너지로 분신을 만들었어. 동료들 사이를 갈라놓으려는 거야.", "흩어지지 말고 코어로 접근하자."] },
  gpLucyShield: { speaker: "루시", lines: ["내 장막 안에 있어. 아이리스는 내가 보호할게.", "더 공격하면 흡수된 동료들도 위험해져."] },
  gpWaterBlade: { speaker: "루시", lines: ["너의 물의 원소는 치유의 힘을 가지고 있어.", "소중한 사람을 살리겠다는 마음으로 그 단검을 사용해."] },
  gpJadeFight: { speaker: "제이드", lines: ["에너지 분신들이여, 저들을 막아라.", "마법수정의 힘도, 너희의 힘도 전부 내 것이 될 것이다."] },
  gpIrisThanks: { speaker: "아이리스", lines: ["흡수됐던 사람들이 돌아왔어요. 이제 이 도시를 다시 돌볼 수 있겠어요.", "받은 도움은 잊지 않을게요. 다음 도시에서도 포켓으로 연락해 주세요."] },
  gpReverse: { speaker: "엘버트", lines: ["그 안내원을 따라가면 위험해요. 먼저 저를 따라오세요.", "이 도시에서는 사이보그 위장 파츠가 필요해요."] },
  gpElbert: { speaker: "엘버트", lines: ["여긴 세비지 플레이스예요. 반란군들이 숨어 지내는 곳이죠.", "저는 얼음의 구체로 힘을 얻은 웨폰마스터예요."] },
  gpTrain: { speaker: "리안", lines: ["열차가 벽을 뚫었어. 정해진 선로를 달리는 시스템이 이런 실수를 할 리 없어.", "전력소와 컨트롤타워로 나눠서 원인을 찾아보자."] },
  gpJennifer: { speaker: "제니퍼", lines: ["지하전력소로 간다면 나도 함께 가지.", "엘버트, 이번에는 혼자 위험을 짊어지지 마."] },
  gpGasDiary: { speaker: "제조연구 일지", lines: ["웨폰마스터의 힘을 추출해 연구를 완성했다.", "120일차. 가스를 살포하자 사람들은 기억을 잃고 기계가 되었다."] },
  gpIrisReturn: { speaker: "아이리스", lines: ["보안관의 옷을 빌렸을 뿐이에요. 은혜를 갚으러 왔어요.", "출입칩도 있어요. 텔레포트건으로 타워 안으로 가죠."] },
  gpPatrick: { speaker: "패트릭", lines: ["혼력이라는 이유로 아내를 잃었다. 아들마저 잃고 싶지 않았다.", "알버트의 이름을 엘버트로 바꾸고 숨겼다. 그러나 그 보호가 도시와 아이에게 상처를 남겼구나."] },
  gpCoreFight: { speaker: "엘버트", lines: ["감정을 없앤 건 가스만이 아니야. 사람들을 바꿔버린 선택이야.", "이 제어를 멈출 거야. 더는 사람들의 기억을 빼앗게 두지 않겠어."] },
  gpRescue: { speaker: "제니퍼", lines: ["이그니션 플레임 불릿 오브 파이어!", "엘버트, 아직 빚을 갚기로 한 약속은 남아 있잖아. 함께 돌아가자."] },
  gpHydrangea: { speaker: "엘버트", lines: ["가스가 멈추고 도시는 다시 제자리로 돌아오기 시작했다.", "희생자를 기리는 곳에 마지막 푸른 수국 한 송이가 피어 있었다. 후회와 사과를 잊지 않기 위해."] },
  gpNeo: { speaker: "리안", lines: ["네오시티는 컴퍼니가 만든 세계야. 지도에 없다고 해서 존재하지 않는 것은 아니지.", "원소의 코인을 분수에 모으면 다른 공간으로 들어갈 수 있어."] },
  gpFiveSeals: { speaker: "리엘의 스승", lines: ["외부·내부·중립지역의 경계가 무너지고 있네.", "힘, 용기, 지혜, 운명, 선택. 다섯 도장을 열쇠로 바꾸어 타워의 문을 열어야 하네."] },
  gpBaron: { speaker: "리엘", lines: ["바론은 이름을 알고 있는 대상과 동전에 기록으로 간섭하고 있어.", "상대의 허를 찌르는 바꿔치기. 스승님이 처음 가르쳐 주신 기술이지."] },
  gpFabian: { speaker: "힘의 부호 파비앙", lines: ["이 링에서는 원소의 힘보다 몸의 움직임을 시험한다.", "리안, 네가 가진 용기가 어디까지 버티는지 보겠다."] },
  gpCourage: { speaker: "리안", lines: ["떨어질 것 같다고 멈추는 대신, 떨어지지 않을 거라고 믿었어요.", "모은 도장은 열쇠가 되고, 마지막 용기의 열쇠는 내가 맡을게."] },
  gpRavid: { speaker: "리엘의 스승", lines: ["우리가 내부지역이라고 믿었던 이곳은 라비드가 만든 중립지역이네.", "붕괴를 막으려 버티고 있던 자와 그가 남긴 프로그램을 구분해야 해."] },
  gpPocket: { speaker: "아이리스", lines: ["마공학 포켓을 확인하세요. 좌표를 분수대 석판에 맞추면 연결할 수 있어요.", "심장유물을 회수한 흔적을 없애려는 컴퍼니를 추적해야 해요."] },
  gpFestival: { speaker: "아이리스", lines: ["호위팀은 귀족들을 지키고, 회수팀은 문서를 추적해 주세요. 정보팀은 연락을 유지할게요.", "오늘 밤 네오시티 컨벤션홀에서 합류해요."] },
  gpFalseIris: { speaker: "리엘의 스승", lines: ["저자는 아이리스가 아니네. 수호자의 기술을 훔친 귀쥐야.", "미리 준비한 이동용 꽃이 있네. 동료들과 진짜 연락처로 돌아가자."] },
  gpGrandfather: { speaker: "리안", lines: ["이 그림은 과거를 보여줘. 미래를 보여주는 그림은 아니야.", "할아버지는 직접 사람들을 만나고 오감으로 세계를 확인하라고 하셨어.", "그랜드 플레닛의 사람들을 기억할 수 있도록 지도를 선물로 받고 싶었지.", "지정된 2기 기록은 이 기억과 무도회를 향하는 장면까지 남아 있다. 이후의 결말은 아직 기록되지 않았다."] },
  snowBook: { speaker: "란", lines: ["천문대에서 받은 책에 눈의 왕국 스노리카라고 적혀 있어요.", "페이지가 혼자 넘어가요. 파란빛이 우리를 책 속으로 끌어당기고 있어요!"] },
  snowChess: { speaker: "체스", lines: ["친구가 하늘의 오로라가 되었대요. 눈사람으로 다시 돌아올 수 있다고 믿어요.", "추운 밤에 혼자 있지 않도록 목도리와 외투를 주고 싶어요."] },
  snowHeart: { speaker: "스칼렛", lines: ["체스는 친구를 살리려고 설원의 마녀에게 심장을 넘겼어.", "심장과 기억이 얼어붙고 친구를 살리겠다는 사명만 남은 채 왕이 되었지."] },
  snowAriano: { speaker: "란", lines: ["아트필드로 장벽을 만들겠어요. 벨리카, 번개의 장막을 부탁해요.", "스칼렛이 출구를 여는 동안 모두 함께 버텨요."] },
  snowKing: { speaker: "클로체스", lines: ["자네들은 나를 알 수도 있지만, 나는 너희를 모른다.", "좋은 날에 소란을 피우다니. 내 얼음의 검을 피할 수 있겠는가."] },
  snowReturn: { speaker: "벨리카", lines: ["책의 끝에서 왕은 보석으로도 친구를 살리지 못했다. 그 분노로 눈과 얼음이 녹아 왕국이 사라졌어.", "웨폰마스터의 시작을 물었던 우리에게 변하는 것과 변하지 않는 것을 보여주고 싶었던 걸까.", "책을 덮고 천문대로 돌아왔다. 우리의 모험은 아직 끝나지 않았어."] },
};
