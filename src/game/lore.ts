/**
 * lore.ts — SERTZ 세계관 정본 (vc191 · 기획서 반영)
 *
 * 출처: 사용자 제공 「영준 프린세스」 기획서(라일락 월드 / 그랜드 플래닛 / 제로 세계 3부).
 *  이 파일은 스토리·지역·세력·속성의 **단일 진실 공급원**이다.
 *  stages.ts(지역/챕터), data.ts(대사), classes.ts(직업), 속성 상호작용이 모두 여기를 참조한다.
 *
 * ── 3부 구조 ──
 *  1부 라일락 월드     : 인피니트보석(라이트/다크니스)을 둘러싼 5왕국 전쟁. 최종 보스 스칼렛.
 *  2부 그랜드 플래닛   : 파괴된 행성의 파편이 행성들로 재편. 빛과 어둠의 마도서. 다크 플래닛 컴퍼니.
 *  3부 제로 세계       : 미지의 최종장. 25가문 전체가 얽힌다.
 *
 * ── 힘의 체계 ──
 *  웨폰마스터 3등급: 순력(혈통) < 혼력(원소 구체) < 초력(자력·초월)
 *  초월자 5속성   : 빛 · 생명 · 시간 · 힘 · 마법
 *  원소 9종       : 불 · 물 · 바람 · 전기 · 땅 · 자연 · 얼음 · 빛 · 어둠
 *  어빌리티 계층  : 원소 어빌리티 < 영역 어빌리티 < 초월 어빌리티(마스터)
 */

/* ═════════════════════════ 1. 세계 ═════════════════════════ */

export type WorldKey = "lilac" | "grand" | "zero";

export interface WorldDef {
  key: WorldKey;
  name: string;
  /** 몇 부(1기/2기/3기) */
  act: number;
  subtitle: string;
  /** 이 세계를 규정하는 핵심 유물/개념 */
  core: string;
}

export const WORLDS: Record<WorldKey, WorldDef> = {
  lilac: {
    key: "lilac",
    name: "라일락 월드",
    act: 1,
    subtitle: "인피니트보석을 둘러싼 다섯 왕국",
    core: "인피니트 라이트 다크니스 스톤",
  },
  grand: {
    key: "grand",
    name: "그랜드 플래닛",
    act: 2,
    subtitle: "부서진 행성의 파편이 별이 된 세계",
    core: "빛과 어둠의 마도서",
  },
  zero: {
    key: "zero",
    name: "제로 세계",
    act: 3,
    subtitle: "모든 것이 시작되고 끝나는 미지",
    core: "심장유물 · 운명의 어빌리티",
  },
};

/* ═════════════════════════ 2. 왕국 / 지역 ═════════════════════════ */

export interface KingdomDef {
  key: string;
  name: string;
  /** 통치 가문 */
  family: string;
  /** 대표 원소 */
  element: ElementKey;
  /** 지형적 특징 (건물·내부맵 설계 근거) */
  terrain: string;
  /** 이 지역만의 규칙 (12-b 건물/NPC 기능 설계 근거) */
  rule: string;
}

/** 라일락 월드 5왕국 — 1기 무대 */
export const KINGDOMS: KingdomDef[] = [
  {
    key: "edeliona",
    name: "에델리오나",
    family: "에델리오나",
    element: "light",
    terrain: "하늘로 올라간 중부 왕국 · 공중에 뜬 성",
    rule: "빛의 가문이 다스린다. 스칼렛이 왕조를 되찾은 뒤 어둠의 힘으로 잠식되었다.",
  },
  {
    key: "estevan",
    name: "에스테반",
    family: "에스테반",
    element: "water",
    terrain: "수상도시 · 주변이 온통 바다, 상어전함으로 이동",
    rule: "수상전투 최강. 배 밖으로 나가면 이동 수단이 없다.",
  },
  {
    key: "krenrelb",
    name: "크렌렐브",
    family: "크렌렐브",
    element: "earth",
    terrain: "산악 · 광맥 지대",
    rule: "에델리오나와 에크레디트의 혼혈 가문이 세운 땅. 대지의 힘.",
  },
  {
    key: "idenmir",
    name: "이덴미르",
    family: "이덴미르",
    element: "ice",
    terrain: "눈과 얼음 · 클로체스 가문의 후손이 세운 땅",
    rule: "과거 스노리카 왕가의 잔재. 혹한이 모든 것을 얼린다.",
  },
  {
    key: "ecredit",
    name: "에크레디트",
    family: "에크레디트",
    element: "nature",
    terrain: "거대 수림 · 생명이 넘치는 땅",
    rule: "페르디트 후손의 자연 가문. 생명의 초월자 루시의 고향.",
  },
  {
    key: "kaliya",
    name: "칼리야",
    family: "—",
    element: "wind",
    terrain: "동양풍 산악 왕국 · 도사와 수호자의 마을",
    rule: "도술과 고대공학. 일반적인 방법으로는 도수관에 들어갈 수 없다.",
  },
  {
    key: "event",
    name: "에벤트",
    family: "그래스트",
    element: "wind",
    terrain: "결계와 높은 산 · 다른 세계에서 넘어온 이들의 나라",
    rule: "우주의 힘. 대공립천문대가 있으며 다른 행성의 좌표를 읽는다.",
  },
];

/* ═════════════════════════ 3. 가문 (25) ═════════════════════════ */

export type FamilyStatus = "main" | "fallen" | "neutral";

export interface FamilyDef {
  key: string;
  name: string;
  world: WorldKey;
  element: ElementKey;
  status: FamilyStatus;
  /** 한 줄 설명 (기획서 원문 요약) */
  note: string;
}

/* 기획서 원문 표식 그대로 옮긴다 — * = 15가문, # = 몰락한 5가문, 무표 = 중립 5가문.
 *  (라일락 5 / 그랜드 11 / 제로 9 = 25) */
export const FAMILIES: FamilyDef[] = [
  /* ── 라일락 월드 ── */
  { key: "edeliona_f", name: "에델리오나", world: "lilac", element: "light", status: "main", note: "에델리오나 왕가 · 스칼렛의 가문 · 빛" },
  { key: "estevan_f", name: "에스테반", world: "lilac", element: "water", status: "main", note: "에스테반 왕가 · 카르텔의 가문 · 물" },
  { key: "krenrelb_f", name: "크렌렐브", world: "lilac", element: "earth", status: "neutral", note: "혼혈 가문 · 시엘의 가문 · 대지" },
  { key: "idenmir_f", name: "이덴미르", world: "lilac", element: "ice", status: "main", note: "클로체스 후손 · 아덴의 가문 · 눈" },
  { key: "ecredit_f", name: "에크레디트", world: "lilac", element: "nature", status: "main", note: "페르디트 후손 · 루시의 가문 · 자연" },
  /* ── 그랜드 플래닛 ── */
  { key: "grast_f", name: "그래스트", world: "grand", element: "light", status: "main", note: "세르니움 왕가 · 리안의 가문 · 우주" },
  { key: "destiny_f", name: "데스티니", world: "grand", element: "light", status: "main", note: "태양을 상징 · 아리와 라일락의 가문" },
  { key: "fate_f", name: "페이트", world: "grand", element: "dark", status: "main", note: "달을 상징 · 루나의 가문" },
  { key: "carion_f", name: "카르리온", world: "grand", element: "dark", status: "fallen", note: "몰락한 5대 가문 · 페르온의 가문 · 암흑" },
  { key: "ariano_f", name: "아리아노", world: "grand", element: "light", status: "main", note: "가주가 초월자급 · 란의 가문 · 아트" },
  { key: "elizabeth_f", name: "엘리자베스-플래임", world: "grand", element: "fire", status: "main", note: "자력 초월자 가주 · 제니퍼의 가문 · 불" },
  { key: "orpheus_f", name: "오르페우스", world: "grand", element: "light", status: "neutral", note: "오르/페우스로 분열된 비운의 가문 · 제르의 가문 · 마법" },
  { key: "selina_f", name: "셀리나", world: "grand", element: "dark", status: "neutral", note: "고유 무기 가문 · 시아의 가문" },
  { key: "ignition_f", name: "이그니션", world: "grand", element: "fire", status: "neutral", note: "대장장이 가문 · 솔라플레임이그니션소드를 만든 곳" },
  { key: "jillian_f", name: "질리언", world: "grand", element: "dark", status: "main", note: "네오시티 가문 · 캐스터의 가문 · 조종" },
  { key: "reverse_f", name: "리버스", world: "grand", element: "dark", status: "neutral", note: "리버스 사이버 지배 · 반전과 기계공학" },
  { key: "pertiez_f", name: "페르티에스", world: "grand", element: "dark", status: "fallen", note: "몰락한 5대 가문 · 다크 플래닛 컴퍼니 · 지배" },
  /* ── 제로 세계 ── */
  { key: "everforce_f", name: "에버포스", world: "zero", element: "electric", status: "main", note: "이나즈마 영주 · 벨리카의 가문 · 번개" },
  { key: "sentinel_f", name: "샌티널", world: "zero", element: "earth", status: "main", note: "카투스 영주 · 비에르의 가문 · 모래" },
  { key: "carter_f", name: "카르테르", world: "zero", element: "light", status: "main", note: "메이트 영주 · 에이리의 가문 · 체스와 저울" },
  { key: "cloches_f", name: "클로체스", world: "zero", element: "ice", status: "fallen", note: "스노리카 왕가 · 차가운 혹한의 왕국 · 얼음" },
  { key: "lavaise_f", name: "라바이즈", world: "zero", element: "fire", status: "fallen", note: "인페르노 영주 · 피닉스의 가문 · 용암" },
  { key: "ianfeus_f", name: "이안페우스", world: "zero", element: "nature", status: "fallen", note: "생명이 변하는 곳 / 어둠의 성전 — 페우스 발동 시 생명조작" },
  { key: "yuwol_f", name: "유월", world: "zero", element: "earth", status: "main", note: "석암 영주 · 종려의 가문 · 바위" },
  { key: "hanasaki_f", name: "하나사키", world: "zero", element: "wind", status: "main", note: "풍추화설 영주 · 카즈하의 가문 · 바람" },
];

/** 총계 검증용 — 기획서 "15가문 + 몰락 5 + 중립 5 = 25" */
export const FAMILY_TOTALS = {
  main: FAMILIES.filter((f) => f.status === "main").length,
  fallen: FAMILIES.filter((f) => f.status === "fallen").length,
  neutral: FAMILIES.filter((f) => f.status === "neutral").length,
  all: FAMILIES.length,
};

/* ═════════════════════════ 4. 원소 ═════════════════════════ */

export type ElementKey =
  | "fire" | "water" | "wind" | "electric" | "earth"
  | "nature" | "ice" | "light" | "dark" | "none";

export interface ElementDef {
  key: ElementKey;
  name: string;
  /** 대표 색 (이펙트·UI) */
  hex: number;
  /** 강한 상대 */
  strong: ElementKey[];
  /** 약한 상대 */
  weak: ElementKey[];
}

/**
 * 원소 9종 상성 — 기획서의 "속성 상호작용"을 게임 규칙으로 옮긴 것.
 *  · 대립축: 불↔물 / 얼음↔불 / 빛↔어둠 / 전기↔땅 / 바람↔땅 / 자연↔어둠
 *  · 순환축: 물→전기(전도), 전기→바람(이온), 바람→불(확산), 불→자연(소거), 자연→물(흡수)
 */
export const ELEMENTS: Record<ElementKey, ElementDef> = {
  /* 대립축 — 서로 강함/약함이 대칭이다(한쪽이 강하면 반대쪽은 약하다). */
  fire: { key: "fire", name: "불", hex: 0xff6a3d, strong: ["ice", "nature"], weak: ["water", "earth"] },
  water: { key: "water", name: "물", hex: 0x3da5ff, strong: ["fire", "earth"], weak: ["electric", "nature"] },
  wind: { key: "wind", name: "바람", hex: 0x8ef0c0, strong: ["earth"], weak: ["ice", "electric"] },
  electric: { key: "electric", name: "전기", hex: 0xffe14d, strong: ["water", "wind"], weak: ["earth"] },
  earth: { key: "earth", name: "땅", hex: 0xc08a4a, strong: ["electric", "fire"], weak: ["wind", "water"] },
  nature: { key: "nature", name: "자연", hex: 0x6ee06e, strong: ["water"], weak: ["fire", "ice", "dark"] },
  ice: { key: "ice", name: "얼음", hex: 0xa8e0ff, strong: ["wind", "nature"], weak: ["fire"] },
  /* 빛 ↔ 어둠은 상호 상극 — 서로에게 강하고(치명타) 서로에게 약하다(불안정). */
  light: { key: "light", name: "빛", hex: 0xfff2c4, strong: ["dark"], weak: ["dark"] },
  dark: { key: "dark", name: "어둠", hex: 0x8a63d2, strong: ["light", "nature"], weak: ["light"] },
  none: { key: "none", name: "무속성", hex: 0xffffff, strong: [], weak: [] },
};

/** 상성 배율 — 게임 규칙값 */
export const ELEM_MULT = { strong: 1.5, normal: 1.0, weak: 0.7, same: 0.85 } as const;

/** 공격 원소 → 방어 원소 배율 */
export function elemMultiplier(atk: ElementKey, def: ElementKey): number {
  if (atk === "none" || def === "none") return ELEM_MULT.normal;
  if (atk === def) return ELEM_MULT.same;
  /* 빛 ↔ 어둠 상호 상극 — 서로에게 강하다(치명타). weak 쪽 규칙보다 우선. */
  if ((atk === "light" && def === "dark") || (atk === "dark" && def === "light")) return ELEM_MULT.strong;
  const a = ELEMENTS[atk];
  if (a.strong.includes(def)) return ELEM_MULT.strong;
  if (a.weak.includes(def)) return ELEM_MULT.weak;
  return ELEM_MULT.normal;
}

/* ═════════════════════════ 5. 웨폰마스터 / 초월자 ═════════════════════════ */

export type MasterGrade = "sullyeok" | "honlyeok" | "choryeok";

export const MASTER_GRADES: Record<MasterGrade, { name: string; desc: string; rank: number }> = {
  honlyeok: { name: "혼력", desc: "원소의 구체가 선택했거나 스스로 각성한 자", rank: 1 },
  sullyeok: { name: "순력", desc: "가문·혈통으로 힘을 물려받은 자", rank: 2 },
  choryeok: { name: "초력", desc: "초월의 경지에 스스로 이른 자", rank: 3 },
};

export type TranscendKey = "light" | "life" | "time" | "power" | "magic";

export const TRANSCENDERS: Record<TranscendKey, { name: string; branches: string[] }> = {
  light: { name: "빛", branches: ["창조의 빛(빛)", "파괴의 빛(어둠)", "태양의 빛", "달의 빛", "우주의 빛"] },
  life: { name: "생명", branches: ["자연의 생명(치유)", "지배의 생명(절망)", "생성의 생명(융합)"] },
  time: { name: "시간", branches: ["멈춰버린 시계", "뒤틀린 시계", "돌아간 시계", "운명의 시계", "반복되는 시계"] },
  power: { name: "힘", branches: ["무술의 힘", "무기의 힘"] },
  magic: { name: "마법", branches: ["주문의 마법", "주술의 마법"] },
};

/** 어빌리티 3계층 — 스킬 개편(#10)의 뼈대 */
export const ABILITY_TIERS = [
  { key: "elem", name: "원소 어빌리티", desc: "원소를 담아 내보내는 기본 기술" },
  { key: "field", name: "영역 어빌리티", desc: "주위에 원소 영역을 펼쳐 강화·공격" },
  { key: "master", name: "초월 어빌리티", desc: "초월자만이 쓰는 최종 기술" },
] as const;

/* ═════════════════════════ 6. 인물 ═════════════════════════ */

export interface CharacterDef {
  key: string;
  name: string;
  /** 원래 이름(개명 전) — 대사/문서에서 병기 */
  former?: string;
  role: string;
  element: ElementKey;
  /** 소속 가문 key */
  family?: string;
  /** 보스 여부 */
  boss?: boolean;
}

export const CHARACTERS: CharacterDef[] = [
  /* 라일락 — 1기 */
  { key: "scarlet", name: "스칼렛 에델리오나", former: "정륜", role: "어둠의 군주 · 에델리오나 여왕", element: "dark", family: "edeliona_f", boss: true },
  { key: "veronica", name: "베로니카", former: "원정", role: "군단장 — 어둠의 주술사", element: "dark" },
  { key: "dean", name: "딘", former: "기범", role: "군단장 — 흑마법사", element: "dark" },
  { key: "harold", name: "해롤드", former: "수경", role: "군단장 — 저주받은 괴물(크라켄)", element: "water", boss: true },
  { key: "feron", name: "페르슈타인 카르리온", former: "담현", role: "군단장 — 암흑의 그림자", element: "dark", family: "carion_f", boss: true },
  { key: "youngprince", name: "영준프린세스", role: "군단장 — 항복한 왕국의 왕녀", element: "light" },
  { key: "cartel", name: "카르데니스 에스테반", former: "준모", role: "에스테반 국왕", element: "water", family: "estevan_f" },
  { key: "aden", name: "아덴하르 이덴미르", former: "강은", role: "에스테반 총리", element: "ice", family: "idenmir_f" },
  { key: "riel", name: "리엘", former: "정현", role: "칼리야의 도사 — 검술·도술 스승", element: "wind" },
  { key: "ciel", name: "카시엘로아 크렌렐브", former: "예진", role: "칼리야 촌장", element: "earth", family: "krenrelb_f" },
  { key: "rian", name: "에벤트이안 그래스트", former: "윤지", role: "에벤트 왕자", element: "light", family: "grast_f" },
  { key: "lucy", name: "루시페르 에크레디트", former: "선우", role: "생명의 초월자", element: "nature", family: "ecredit_f" },
  { key: "zer", name: "제르이안 오르페우스", former: "준석", role: "마법의 초월자", element: "light", family: "orpheus_f" },
  { key: "ari", name: "아리스텔라 데스티니", former: "유진", role: "검의 초월자", element: "fire", family: "destiny_f" },
  { key: "ran", name: "아리아노 란", former: "성화", role: "아트메이커", element: "light", family: "ariano_f" },
  { key: "lilac", name: "라일락 데스티니", role: "펜던트의 주인 · 이야기의 발단", element: "light", family: "destiny_f" },
  { key: "rashion", name: "라시온", role: "고대의 재앙 — 부활한 강자", element: "dark", boss: true },
  { key: "dio", name: "디오", role: "데스크니스 가의 막내 — 사념체 동화", element: "dark", boss: true },
  { key: "register", name: "레지스터", role: "반란군 시스터즈의 리더", element: "none" },
  { key: "richard", name: "리처드", role: "에델리오나 기사단장 · 왕가의 검", element: "light" },

  /* 그랜드 플래닛 — 2기 */
  { key: "luna", name: "루나스텔라 페이트", role: "달의 가문 · 페이트", element: "dark", family: "fate_f" },
  { key: "jennifer", name: "제니퍼 엘리자베스", role: "불의 초월자", element: "fire", family: "elizabeth_f" },
  { key: "velika", name: "벨리카", role: "번개의 웨폰마스터 · 에버포스", element: "electric", family: "everforce_f" },

  /* 제로 세계 — 3기 */
  { key: "haru", name: "하루", role: "고아에서 검의 주인이 된 자 (플레이어가 이름을 정한다)", element: "light" },
];

/* ═════════════════════════ 7. 핵심 주제 ═════════════════════════ */

/** 기획서의 중심 문장 — 대사·연출에서 반복 인용되는 축 */
export const THEME_LINE =
  "세상에는 세 가지 사람이 있어. 누군가를 죽이는 사람, 두려움에 도망치는 사람, " +
  "그리고 그 죽음에서 누군가를 살리는 사람.";

/** 3부 각각의 부제 — UI/컷씬 타이틀에 쓴다 */
export const ACT_TITLES = ["라일락", "그랜드 플래닛", "제로 세계"] as const;
