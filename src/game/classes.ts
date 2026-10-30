/**
 * 전직 시스템 — 메이플스토리 모험가 구조 참고 다차원 클래스 트리 (v1.8)
 *  - 1차(Lv10) 계열 선택 → 2차(Lv30) 세부 직업 선택 → 3차(Lv60) 최종 승격
 *  - 자유 전직(메이플 자유전직 재현): 2차 이상에서 같은 계열 내 반대 경로로 전환 (골드 소모, 횟수 무제한)
 *  - 보너스는 경로(1차→2차→3차) 누적 합산 — 기존 v1.7 전직자(cls=warrior 등) 스탯 완전 동일 유지
 *  - 세이브에는 현재 클래스키 하나만 저장 (구 세이브 호환: null / 1차키)
 */

export const JOB_LEVELS = { t1: 10, t2: 30, t3: 50, t4: 100 } as const;
/** 자유 전직 비용 (골드) — 메이플 메소 소모 자유전직 재현 */
export const FREE_JOB_COST = 5000;

/* ═══ v3.0.8 디자인 개편 — 클래스별 스킬 아이콘 (RPG Icons Pixel Art) ═══
 *  /assets/skillicon/<cls>_<slot>.webp — TouchControls 스킬 버튼에 표시.
 *  없는 조합은 기존 lucide 아이콘 폴백 (기능 무영향).
 *  v3.0.10 — "base" 키 추가: 미전직(cls=null) 상태에서도 아이콘이 나오도록
 *  (기존엔 전직 전엔 lucide 폴백이라 "스킬 아이콘 적용 안 됨"으로 보였음) */
/* vc185 (지시 #1 — "4차·5차 스킬 아직 안 바뀜") — 5차 궁극기 아이콘도 직업별 필드로 편입.
 *  종전엔 WorldScene 이 s5Icon 을 "/assets/skillicon/ultimate_s5.webp" 로 하드코딩해
 *  **모든 직업이 같은 아이콘**을 썼다. 궁극기 이름·연출이 달라도 버튼 그림이 같으니
 *  "스킬이 안 바뀐다"로 체감됐다. s5bIcon 도 함께 추가(2차 궁극기 버튼이 1차 아이콘을 재사용하던 버그). */
export const SKILL_ICONS: Partial<Record<ClassKey | "base", { s1Icon: string; s2Icon: string; s3Icon?: string; s4Icon?: string; s5Icon?: string; s5bIcon?: string }>> = {
  base: { s1Icon: "/assets/skillicon/base_s1.webp", s2Icon: "/assets/skillicon/base_s2.webp" },
  warrior: { s1Icon: "/assets/skillicon/warrior_s1.webp", s2Icon: "/assets/skillicon/warrior_s2.webp" },
  berserker: { s1Icon: "/assets/skillicon/berserker_s1.webp", s2Icon: "/assets/skillicon/berserker_s2.webp" },
  guardian: { s1Icon: "/assets/skillicon/guardian_s1.webp", s2Icon: "/assets/skillicon/guardian_s2.webp" },
  ranger: { s1Icon: "/assets/skillicon/ranger_s1.webp", s2Icon: "/assets/skillicon/ranger_s2.webp" },
  sniper: { s1Icon: "/assets/skillicon/sniper_s1.webp", s2Icon: "/assets/skillicon/sniper_s2.webp" },
  windrunner: { s1Icon: "/assets/skillicon/windrunner_s1.webp", s2Icon: "/assets/skillicon/windrunner_s2.webp" },
  mage: { s1Icon: "/assets/skillicon/mage_s1.webp", s2Icon: "/assets/skillicon/mage_s2.webp" },
  archmage: { s1Icon: "/assets/skillicon/archmage_s1.webp", s2Icon: "/assets/skillicon/archmage_s2.webp" },
  sage: { s1Icon: "/assets/skillicon/sage_s1.webp", s2Icon: "/assets/skillicon/sage_s2.webp" },
  thief: { s1Icon: "/assets/skillicon/thief_s1.webp", s2Icon: "/assets/skillicon/thief_s2.webp" },
  warlord: { s1Icon: "/assets/skillicon/warlord_s1.webp", s2Icon: "/assets/skillicon/warlord_s2.webp", s3Icon: "/assets/skillicon/warlord_s3.webp" },
  paladin: { s1Icon: "/assets/skillicon/paladin_s1.webp", s2Icon: "/assets/skillicon/paladin_s2.webp", s3Icon: "/assets/skillicon/paladin_s3.webp" },
  eagleeye: { s1Icon: "/assets/skillicon/eagleeye_s1.webp", s2Icon: "/assets/skillicon/eagleeye_s2.webp", s3Icon: "/assets/skillicon/eagleeye_s3.webp" },
  tempest: { s1Icon: "/assets/skillicon/tempest_s1.webp", s2Icon: "/assets/skillicon/tempest_s2.webp", s3Icon: "/assets/skillicon/tempest_s3.webp" },
  stormbringer: { s1Icon: "/assets/skillicon/stormbringer_s1.webp", s2Icon: "/assets/skillicon/stormbringer_s2.webp", s3Icon: "/assets/skillicon/stormbringer_s3.webp" },
  chronicle: { s1Icon: "/assets/skillicon/chronicle_s1.webp", s2Icon: "/assets/skillicon/chronicle_s2.webp", s3Icon: "/assets/skillicon/chronicle_s3.webp" },
  assassin: { s1Icon: "/assets/skillicon/assassin_s1.webp", s2Icon: "/assets/skillicon/assassin_s2.webp" },
  swashbuckler: { s1Icon: "/assets/skillicon/swashbuckler_s1.webp", s2Icon: "/assets/skillicon/swashbuckler_s2.webp" },
  warbringer: { s1Icon: "/assets/skillicon/warbringer_s1.webp", s2Icon: "/assets/skillicon/warbringer_s2.webp", s3Icon: "/assets/skillicon/warbringer_s3.webp", s4Icon: "/assets/skillicon/warbringer_s4.webp", s5Icon: "/assets/skillicon/warbringer_s5.webp", s5bIcon: "/assets/skillicon/warbringer_s5b.webp" },
  crusader: { s1Icon: "/assets/skillicon/crusader_s1.webp", s2Icon: "/assets/skillicon/crusader_s2.webp", s3Icon: "/assets/skillicon/crusader_s3.webp", s4Icon: "/assets/skillicon/crusader_s4.webp", s5Icon: "/assets/skillicon/crusader_s5.webp", s5bIcon: "/assets/skillicon/crusader_s5b.webp" },
  deadeye: { s1Icon: "/assets/skillicon/deadeye_s1.webp", s2Icon: "/assets/skillicon/deadeye_s2.webp", s3Icon: "/assets/skillicon/deadeye_s3.webp", s4Icon: "/assets/skillicon/deadeye_s4.webp", s5Icon: "/assets/skillicon/deadeye_s5.webp", s5bIcon: "/assets/skillicon/deadeye_s5b.webp" },
  skylord: { s1Icon: "/assets/skillicon/skylord_s1.webp", s2Icon: "/assets/skillicon/skylord_s2.webp", s3Icon: "/assets/skillicon/skylord_s3.webp", s4Icon: "/assets/skillicon/skylord_s4.webp", s5Icon: "/assets/skillicon/skylord_s5.webp", s5bIcon: "/assets/skillicon/skylord_s5b.webp" },
  arclord: { s1Icon: "/assets/skillicon/arclord_s1.webp", s2Icon: "/assets/skillicon/arclord_s2.webp", s3Icon: "/assets/skillicon/arclord_s3.webp", s4Icon: "/assets/skillicon/arclord_s4.webp", s5Icon: "/assets/skillicon/arclord_s5.webp", s5bIcon: "/assets/skillicon/arclord_s5b.webp" },
  eternal: { s1Icon: "/assets/skillicon/eternal_s1.webp", s2Icon: "/assets/skillicon/eternal_s2.webp", s3Icon: "/assets/skillicon/eternal_s3.webp", s4Icon: "/assets/skillicon/eternal_s4.webp", s5Icon: "/assets/skillicon/eternal_s5.webp", s5bIcon: "/assets/skillicon/eternal_s5b.webp" },
  nightblade: { s1Icon: "/assets/skillicon/nightblade_s1.webp", s2Icon: "/assets/skillicon/nightblade_s2.webp", s3Icon: "/assets/skillicon/nightblade_s3.webp" },
  duelist: { s1Icon: "/assets/skillicon/duelist_s1.webp", s2Icon: "/assets/skillicon/duelist_s2.webp", s3Icon: "/assets/skillicon/duelist_s3.webp" },
  shadowlord: { s1Icon: "/assets/skillicon/shadowlord_s1.webp", s2Icon: "/assets/skillicon/shadowlord_s2.webp", s3Icon: "/assets/skillicon/shadowlord_s3.webp", s4Icon: "/assets/skillicon/shadowlord_s4.webp", s5Icon: "/assets/skillicon/shadowlord_s5.webp", s5bIcon: "/assets/skillicon/shadowlord_s5b.webp" },
  blademaster: { s1Icon: "/assets/skillicon/blademaster_s1.webp", s2Icon: "/assets/skillicon/blademaster_s2.webp", s3Icon: "/assets/skillicon/blademaster_s3.webp", s4Icon: "/assets/skillicon/blademaster_s4.webp", s5Icon: "/assets/skillicon/blademaster_s5.webp", s5bIcon: "/assets/skillicon/blademaster_s5b.webp" },
  /* v1.2.1 — 해적 계열 전용 아이콘. 종전엔 항목 자체가 없어 lucide 폴백으로 떨어졌다.
   *  32x32 픽셀 버퍼로 직접 그렸다(외부 에셋 미사용 — 라이선스 문제 없음).
   *  3차/4차는 2차 스킬을 승계하므로 s1/s2는 2차 그림을 그대로 쓴다. */
  pirate: { s1Icon: "/assets/skillicon/pirate_s1.webp", s2Icon: "/assets/skillicon/pirate_s2.webp", s3Icon: "/assets/skillicon/raider_s3.webp" },
  raider: { s1Icon: "/assets/skillicon/raider_s1.webp", s2Icon: "/assets/skillicon/raider_s2.webp", s3Icon: "/assets/skillicon/raider_s3.webp", s4Icon: "/assets/skillicon/raider_s4.webp" },
  corsair: { s1Icon: "/assets/skillicon/corsair_s1.webp", s2Icon: "/assets/skillicon/corsair_s2.webp", s3Icon: "/assets/skillicon/corsair_s3.webp", s4Icon: "/assets/skillicon/corsair_s4.webp" },
  stormcaptain: { s1Icon: "/assets/skillicon/corsair_s1.webp", s2Icon: "/assets/skillicon/corsair_s2.webp", s3Icon: "/assets/skillicon/stormcaptain_s3.webp" },
  powdermaster: { s1Icon: "/assets/skillicon/raider_s1.webp", s2Icon: "/assets/skillicon/raider_s2.webp", s3Icon: "/assets/skillicon/powdermaster_s3.webp" },
  seaking: { s1Icon: "/assets/skillicon/corsair_s1.webp", s2Icon: "/assets/skillicon/corsair_s2.webp", s3Icon: "/assets/skillicon/seaking_s3.webp", s4Icon: "/assets/skillicon/seaking_s4.webp", s5Icon: "/assets/skillicon/seaking_s5.webp", s5bIcon: "/assets/skillicon/seaking_s5b.webp" },
  dreadnought: { s1Icon: "/assets/skillicon/raider_s1.webp", s2Icon: "/assets/skillicon/raider_s2.webp", s3Icon: "/assets/skillicon/dreadnought_s3.webp", s4Icon: "/assets/skillicon/dreadnought_s4.webp", s5Icon: "/assets/skillicon/dreadnought_s5.webp", s5bIcon: "/assets/skillicon/dreadnought_s5b.webp" },
};

export type Tier = 1 | 2 | 3 | 4;
export type FamilyKey = "warrior" | "ranger" | "mage" | "thief" | "pirate";
export type ClassKey =
  | FamilyKey /* 1차 */
  | "berserker" | "guardian" /* 전사 2차 */
  | "sniper" | "windrunner" /* 궁수 2차 */
  | "archmage" | "sage" /* 마법사 2차 */
  | "assassin" | "swashbuckler" /* 도적 2차 */
  | "warlord" | "paladin" /* 전사 3차 */
  | "eagleeye" | "tempest" /* 궁수 3차 */
  | "stormbringer" | "chronicle" /* 마법사 3차 */
  | "nightblade" | "duelist" /* 도적 3차 */
  | "warbringer" | "crusader" /* 전사 4차 (Lv100) */
  | "deadeye" | "skylord" /* 궁수 4차 */
  | "arclord" | "eternal" /* 마법사 4차 */
  | "shadowlord" | "blademaster" /* 도적 4차 */
  /* v1.1.9 — 5번째 계열: 해적(pirate). 바다·항해·화약 모티프.
   *  계열 4종 구조(1차 1 + 2차 2 + 3차 2 + 4차 2)를 그대로 따른다.
   *  이름은 메이플스토리에서 차용하지 않고 북유럽 신화(바다·항해·뇌운)에서 새로 지었다. */
  | "raider" | "corsair" /* 해적 2차 */
  | "stormcaptain" | "powdermaster" /* 해적 3차 */
  | "seaking" | "dreadnought"; /* 해적 4차 */

export type ClassDef = {
  key: ClassKey;
  tier: Tier;
  /** 상위 클래스키 (t2 → 1차키, t3 → 2차키, t1 → null) */
  parent: ClassKey | null;
  /** 클래스명 (HUD 배지/이름표) */
  name: string;
  /** 칭호 (전직 배너) */
  title: string;
  /** UI 강조색 (css) */
  color: string;
  /** 게임 내 마커색 (hex) */
  hex: number;
  /** 공격력 가산 (%) — 체인 합산 후 atkTotal에 곱함 */
  atkPct: number;
  /** 크리티컬 가산 (%p) */
  critAdd: number;
  /** 방어력 가산 */
  defAdd: number;
  /** 전직 즉시 최대 HP 가산 (누적 합산) */
  hpAdd: number;
  /** 전직 즉시 최대 MP 가산 (누적 합산) */
  mpAdd: number;
  /** 이동속도 가산 (%) — 체인 합산 후 속도에 곱함 */
  speedPct: number;
  /** 스킬 쿨다운 배율 (곱 누적 — 낮을수록 좋음) */
  cdMult: number;
  /** 스킬 피해 배율 (곱 누적) */
  skillMult: number;
  /* v1.4.30 (#2 사냥/보스 밸런스) — 직업 특화 피해 가산 (%p, 체인 합산)
   *  보스 특화(전사·스나이퍼-데드아이·아크메이지-아크로드·어세신-섀도우로드)는
   *  bossDmgPct, 사냥 특화(윈드러너-스카이로드·세이지-이터널·스와시버클러-블레이드마스터)는
   *  mobDmgPct가 높다 — 라인별 정체성 부여. */
  bossDmgPct: number;
  mobDmgPct: number;
  desc: string;
};

/* ================= 1차 — 계열 선택 (Lv10, v1.7 수치 그대로 유지) ================= */

const WARRIOR: ClassDef = {
  key: "warrior", tier: 1, parent: null,
  name: "전사", title: "검사",
  color: "#ff9a8a", hex: 0xff9a8a,
  atkPct: 18, critAdd: 0, defAdd: 0, hpAdd: 120, mpAdd: 0, speedPct: 0,
  bossDmgPct: 8, mobDmgPct: 0,
  cdMult: 1, skillMult: 1,
  desc: "끈질긴 생명력과 무모한 화력. 앞에 서는 자의 길.",
};
const RANGER: ClassDef = {
  key: "ranger", tier: 1, parent: null,
  name: "궁수", title: "궁도",
  color: "#7dffa8", hex: 0x7dffa8,
  atkPct: 8, critAdd: 12, defAdd: 0, hpAdd: 60, mpAdd: 20, speedPct: 15,
  bossDmgPct: 0, mobDmgPct: 8,
  cdMult: 1, skillMult: 1,
  desc: "치명타와 기동성의 대가. 붓처럼 지도를 달린다.",
};
const MAGE: ClassDef = {
  key: "mage", tier: 1, parent: null,
  name: "마법사", title: "주술사",
  color: "#a5b9ff", hex: 0xa5b9ff,
  atkPct: 30, critAdd: 4, defAdd: 0, hpAdd: 30, mpAdd: 60, speedPct: 0,
  bossDmgPct: 0, mobDmgPct: 6,
  cdMult: 1, skillMult: 1,
  desc: "세계의 마나를 화력으로 바꾼다. 유리 대포. — \"마법은 지혜가 곧 힘이다.\"",
};
/* v2.9 (사용자 지시 #9) — 4번째 계열 도적 추가: 빠른 연타와 치명타 특화 */
const THIEF: ClassDef = {
  key: "thief", tier: 1, parent: null,
  name: "도적", title: "그림자 검객",
  color: "#e8c0ff", hex: 0xe8c0ff,
  atkPct: 10, critAdd: 16, defAdd: 0, hpAdd: 70, mpAdd: 20, speedPct: 20,
  bossDmgPct: 6, mobDmgPct: 2,
  cdMult: 0.9, skillMult: 1,
  desc: "그림자처럼 다가와 단검으로 목을 후린다. 치명타와 회피의 달인. — \"보물은 스스로 걸어온다. 내가 훔칠 뿐.\"",
};

/* v1.1.9 (#개편 — 계열 확장) — 5번째 계열: 해적.
 *  설계 의도: 기존 4계열과 전투 리듬을 다르게 가져간다.
 *   · 전사=맷집·근접 / 궁수=치명·기동 / 마법사=고화력·유리 / 도적=연타·암습
 *   · 해적=**넓은 광역 + 아군 버프** — 혼자 강한 계열이 아니라 판을 키우는 계열.
 *  이름은 북유럽 신화의 바다·항해·뇌운에서 따왔다(저작권 안전). */
const PIRATE: ClassDef = {
  key: "pirate", tier: 1, parent: null,
  name: "해적", title: "항해자",
  color: "#ffd76a", hex: 0xffd76a,
  atkPct: 14, critAdd: 6, defAdd: 4, hpAdd: 90, mpAdd: 20, speedPct: 8,
  bossDmgPct: 2, mobDmgPct: 10,
  cdMult: 0.95, skillMult: 1.05,
  desc: "배 한 척으로 세계를 떠도는 자. 넓게 쓸어버리고, 동료를 끌어올린다. — \"항구 없이도 살아남는 법을 안다.\"",
};

/* ================= 2차 — 세부 직업 선택 (Lv30, 계열별 2종) ================= */

const BERSERKER: ClassDef = {
  key: "berserker", tier: 2, parent: "warrior",
  name: "버서커", title: "광전사",
  color: "#ff7a5c", hex: 0xff7a5c,
  atkPct: 18, critAdd: 6, defAdd: 0, hpAdd: 80, mpAdd: 0, speedPct: 0,
  bossDmgPct: 12, mobDmgPct: 0,
  cdMult: 1, skillMult: 1.05,
  desc: "공격에 공격을 더한다. 방어는 사치.",
};
const GUARDIAN: ClassDef = {
  key: "guardian", tier: 2, parent: "warrior",
  name: "가디언", title: "수호자",
  color: "#ffb08a", hex: 0xffb08a,
  atkPct: 6, critAdd: 0, defAdd: 8, hpAdd: 160, mpAdd: 0, speedPct: 5,
  bossDmgPct: 8, mobDmgPct: 0,
  cdMult: 1, skillMult: 1,
  desc: "아군의 방패. 무너지지 않는 성벽.",
};
const SNIPER: ClassDef = {
  key: "sniper", tier: 2, parent: "ranger",
  name: "스나이퍼", title: "매의 눈",
  color: "#5cff8f", hex: 0x5cff8f,
  atkPct: 10, critAdd: 18, defAdd: 0, hpAdd: 40, mpAdd: 0, speedPct: 0,
  bossDmgPct: 10, mobDmgPct: 4,
  cdMult: 1, skillMult: 1.05,
  desc: "한 발로 끝낸다. 치명타의 신.",
};
const WINDRUNNER: ClassDef = {
  key: "windrunner", tier: 2, parent: "ranger",
  name: "윈드러너", title: "질풍",
  color: "#9dffc4", hex: 0x9dffc4,
  atkPct: 6, critAdd: 6, defAdd: 0, hpAdd: 60, mpAdd: 20, speedPct: 10,
  bossDmgPct: 0, mobDmgPct: 12,
  cdMult: 0.9, skillMult: 1,
  desc: "바람보다 빠른 연사와 기동.",
};
const ARCHMAGE: ClassDef = {
  key: "archmage", tier: 2, parent: "mage",
  name: "아크메이지", title: "대마법사",
  color: "#8fa6ff", hex: 0x8fa6ff,
  atkPct: 22, critAdd: 0, defAdd: 0, hpAdd: 20, mpAdd: 40, speedPct: 0,
  bossDmgPct: 10, mobDmgPct: 4,
  cdMult: 1, skillMult: 1.15,
  desc: "한 방의 화력을 세계 끝까지.",
};
const SAGE: ClassDef = {
  key: "sage", tier: 2, parent: "mage",
  name: "세이지", title: "현자",
  color: "#c3cfff", hex: 0xc3cfff,
  atkPct: 10, critAdd: 4, defAdd: 3, hpAdd: 60, mpAdd: 80, speedPct: 0,
  bossDmgPct: 2, mobDmgPct: 8,
  cdMult: 0.85, skillMult: 1.05, // v1.4.30 (#7) — 세이지 1→1.05 (이터널 라인 화력 지원)
  desc: "무한 마나와 짧은 회전. 지혜의 전투.",
};

/* ================= 3차 — 승격 (Lv50, 2차 경로 자동 이어짐) ================= */

/* ── 해적 2차 ─────────────────────────────────────────────── */
/* 레이더 — 화약·포격 특화: 느리지만 넓게 터진다 */
const RAIDER: ClassDef = {
  key: "raider", tier: 2, parent: "pirate",
  name: "레이더", title: "약탈자",
  color: "#ffb347", hex: 0xffb347,
  atkPct: 20, critAdd: 4, defAdd: 0, hpAdd: 60, mpAdd: 0, speedPct: 0,
  bossDmgPct: 4, mobDmgPct: 16,
  cdMult: 1, skillMult: 1.1,
  desc: "화약 한 통이면 충분하다. 범위가 곧 화력.",
};
/* 코세어 — 선상 백병 특화: 근접 연타 + 기동 */
const CORSAIR: ClassDef = {
  key: "corsair", tier: 2, parent: "pirate",
  name: "코세어", title: "선상 검객",
  color: "#ffdf8a", hex: 0xffdf8a,
  atkPct: 12, critAdd: 14, defAdd: 2, hpAdd: 80, mpAdd: 0, speedPct: 14,
  bossDmgPct: 8, mobDmgPct: 6,
  cdMult: 0.9, skillMult: 1,
  desc: "흔들리는 갑판 위에서도 정확하다. 빠른 손이 곧 목숨.",
};

const WARLORD: ClassDef = {
  key: "warlord", tier: 3, parent: "berserker",
  name: "워로드", title: "전장의 지배자",
  color: "#ff5c3c", hex: 0xff5c3c,
  atkPct: 20, critAdd: 8, defAdd: 0, hpAdd: 100, mpAdd: 0, speedPct: 5,
  bossDmgPct: 12, mobDmgPct: 0,
  cdMult: 1, skillMult: 1.1,
  desc: "전장 그 자체가 무기. 최전선의 절대자.",
};
const PALADIN: ClassDef = {
  key: "paladin", tier: 3, parent: "guardian",
  name: "팔라딘", title: "성기사",
  color: "#ffd29a", hex: 0xffd29a,
  atkPct: 8, critAdd: 4, defAdd: 12, hpAdd: 200, mpAdd: 20, speedPct: 5,
  bossDmgPct: 8, mobDmgPct: 2,
  cdMult: 1, skillMult: 1,
  desc: "빛의 맹세로 서는 자. 불굴의 성벽.",
};
const EAGLEEYE: ClassDef = {
  key: "eagleeye", tier: 3, parent: "sniper",
  name: "이글아이", title: "절대 명중",
  color: "#3cff7a", hex: 0x3cff7a,
  atkPct: 12, critAdd: 20, defAdd: 0, hpAdd: 60, mpAdd: 20, speedPct: 5,
  bossDmgPct: 14, mobDmgPct: 4,
  cdMult: 0.95, skillMult: 1.1,
  desc: "매는 두 번 쏘지 않는다.",
};
const TEMPEST: ClassDef = {
  key: "tempest", tier: 3, parent: "windrunner",
  name: "템페스트", title: "폭풍의 화신",
  color: "#b9ffe0", hex: 0xb9ffe0,
  atkPct: 8, critAdd: 8, defAdd: 0, hpAdd: 80, mpAdd: 40, speedPct: 10,
  bossDmgPct: 0, mobDmgPct: 14,
  cdMult: 0.85, skillMult: 1.05,
  desc: "폭풍처럼 몰아치는 화망.",
};
const STORMBRINGER: ClassDef = {
  key: "stormbringer", tier: 3, parent: "archmage",
  name: "스톰브링어", title: "폭풍소환자",
  color: "#6f8cff", hex: 0x6f8cff,
  atkPct: 25, critAdd: 4, defAdd: 0, hpAdd: 40, mpAdd: 50, speedPct: 0,
  bossDmgPct: 12, mobDmgPct: 6,
  cdMult: 0.95, skillMult: 1.2,
  desc: "하늘의 분노를 부리는 종단의 마법사.",
};
const CHRONICLE: ClassDef = {
  key: "chronicle", tier: 3, parent: "sage",
  name: "크로니컬", title: "서사의 기록자",
  color: "#e2e8ff", hex: 0xe2e8ff,
  atkPct: 14, critAdd: 6, defAdd: 6, hpAdd: 100, mpAdd: 100, speedPct: 5,
  bossDmgPct: 4, mobDmgPct: 10,
  cdMult: 0.8, skillMult: 1.12, // v1.4.30 (#7) — 크로니컬 1.05→1.12
  desc: "모든 마법의 순환을 통괄하는 현자의 정점.",
};

/* ================= 도적 2차/3차 (v2.9) ================= */

const ASSASSIN: ClassDef = {
  key: "assassin", tier: 2, parent: "thief",
  name: "어세신", title: "암살자",
  color: "#d89aff", hex: 0xd89aff,
  atkPct: 14, critAdd: 14, defAdd: 0, hpAdd: 40, mpAdd: 10, speedPct: 10,
  bossDmgPct: 12, mobDmgPct: 0,
  cdMult: 0.85, skillMult: 1.1,
  desc: "한 방의 치명타. 그림자 속의 죽음.",
};
const SWASHBUCKLER: ClassDef = {
  key: "swashbuckler", tier: 2, parent: "thief",
  name: "스와시버클러", title: "검객",
  color: "#f0c8ff", hex: 0xf0c8ff,
  atkPct: 12, critAdd: 8, defAdd: 4, hpAdd: 90, mpAdd: 20, speedPct: 10,
  bossDmgPct: 2, mobDmgPct: 8,
  cdMult: 0.9, skillMult: 1,
  desc: "화려한 연타로 적을 농락한다. 바다의 검객.",
};
const NIGHTBLADE: ClassDef = {
  key: "nightblade", tier: 3, parent: "assassin",
  name: "나이트블레이드", title: "야경의 칼날",
  color: "#c08aff", hex: 0xc08aff,
  atkPct: 18, critAdd: 16, defAdd: 0, hpAdd: 60, mpAdd: 30, speedPct: 10,
  bossDmgPct: 14, mobDmgPct: 2,
  cdMult: 0.8, skillMult: 1.15,
  desc: "어둠이 곧 무기. 베이고 나서 보이지 않는다.",
};
const DUELIST: ClassDef = {
  key: "duelist", tier: 3, parent: "swashbuckler",
  name: "듀얼리스트", title: "결투의 정점",
  color: "#ffd8ff", hex: 0xffd8ff,
  atkPct: 16, critAdd: 10, defAdd: 6, hpAdd: 120, mpAdd: 30, speedPct: 10,
  bossDmgPct: 8, mobDmgPct: 6,
  cdMult: 0.85, skillMult: 1.1,
  desc: "일대일 결투에서 무적. 쌍단검의 화신.",
};

/* ================= 4차 — 각성 (Lv100, 사용자 지시 #9) ================= */

/* ── 해적 3차 ─────────────────────────────────────────────── */
/* 스톰캡틴 — 폭풍 항해: 광역 뇌우 + 아군 가속 */
const STORMCAPTAIN: ClassDef = {
  key: "stormcaptain", tier: 3, parent: "raider",
  name: "스톰캡틴", title: "폭풍의 선장",
  /* vc204 (지시서 #4) — "같은 텍스트 색깔의 직업은 같은 직업".
   *  부모 raider 가 해적 계열 #ffb347 인데 여기만 #8fe8ff(청록)로 계통에서 벗어났다.
   *  같은 계통의 powdermaster(#ff9a5c) 와도 어긋나 색만 보고 계통을 알 수 없었다.
   *  → 부모 계열의 밝은 변주로 맞춘다(폭풍의 청록은 스킬 FX 색으로만 쓴다). */
  color: "#ffd88a", hex: 0xffd88a,
  atkPct: 26, critAdd: 6, defAdd: 4, hpAdd: 120, mpAdd: 40, speedPct: 8,
  bossDmgPct: 10, mobDmgPct: 16,
  cdMult: 0.9, skillMult: 1.2,
  desc: "폭풍을 등지고 항해한다. 배가 지나간 자리에 뇌우가 남는다.",
};
/* 파우더마스터 — 화약의 정점: 설치형 지뢰 + 광범위 폭발 */
const POWDERMASTER: ClassDef = {
  key: "powdermaster", tier: 3, parent: "raider",
  name: "파우더마스터", title: "화약 장인",
  color: "#ff9a5c", hex: 0xff9a5c,
  atkPct: 30, critAdd: 2, defAdd: 0, hpAdd: 90, mpAdd: 20, speedPct: 0,
  bossDmgPct: 18, mobDmgPct: 12,
  cdMult: 1, skillMult: 1.25,
  desc: "터지는 순간만이 그의 작품이다.",
};

const WARBRINGER: ClassDef = {
  key: "warbringer", tier: 4, parent: "warlord",
  name: "워브링어", title: "전쟁의 화신",
  color: "#ff3c1c", hex: 0xff3c1c,
  atkPct: 30, critAdd: 10, defAdd: 5, hpAdd: 300, mpAdd: 0, speedPct: 5,
  bossDmgPct: 18, mobDmgPct: 4,
  cdMult: 0.9, skillMult: 1.25,
  desc: "전쟁 그 자체. 세계를 가르는 일격.",
};
const CRUSADER: ClassDef = {
  key: "crusader", tier: 4, parent: "paladin",
  name: "크루세이더", title: "심판의 빛",
  color: "#ffe29a", hex: 0xffe29a,
  atkPct: 15, critAdd: 8, defAdd: 20, hpAdd: 400, mpAdd: 40, speedPct: 5,
  bossDmgPct: 12, mobDmgPct: 6,
  cdMult: 0.9, skillMult: 1.15,
  desc: "불굴의 성벽이 심판의 검을 든다.",
};
const DEADEYE: ClassDef = {
  key: "deadeye", tier: 4, parent: "eagleeye",
  name: "데드아이", title: "신의 시선",
  color: "#1cff5c", hex: 0x1cff5c,
  atkPct: 20, critAdd: 30, defAdd: 0, hpAdd: 120, mpAdd: 40, speedPct: 10,
  bossDmgPct: 18, mobDmgPct: 6,
  cdMult: 0.85, skillMult: 1.25,
  desc: "모든 화살은 신의 심판이 된다.",
};
const SKYLORD: ClassDef = {
  key: "skylord", tier: 4, parent: "tempest",
  name: "스카이로드", title: "하늘의 지배자",
  color: "#ccffe8", hex: 0xccffe8,
  atkPct: 15, critAdd: 12, defAdd: 0, hpAdd: 160, mpAdd: 80, speedPct: 20,
  bossDmgPct: 2, mobDmgPct: 18,
  cdMult: 0.75, skillMult: 1.2,
  desc: "바람이 그의 명령을 기다린다.",
};
const ARCLORD: ClassDef = {
  key: "arclord", tier: 4, parent: "stormbringer",
  name: "아크로드", title: "마나의 절대자",
  color: "#5c7cff", hex: 0x5c7cff,
  atkPct: 35, critAdd: 8, defAdd: 0, hpAdd: 100, mpAdd: 120, speedPct: 0,
  bossDmgPct: 16, mobDmgPct: 8,
  cdMult: 0.85, skillMult: 1.35,
  desc: "한 발의 마법이 지평선을 지운다.",
};
const ETERNAL: ClassDef = {
  key: "eternal", tier: 4, parent: "chronicle",
  name: "이터널", title: "시간을 초월한 자",
  /* vc204 (#4) — 부모 chronicle(#e2e8ff) 과 132도 벗어난 순백이었다.
   *  마법사 계열 색으로 맞춘다. */
  color: "#d8deff", hex: 0xd8deff,
  atkPct: 24, critAdd: 10, defAdd: 10, hpAdd: 220, mpAdd: 200, speedPct: 10,
  /* v1.4.30 (#7 이터널 실성능 강화) — skillMult 1.2→1.4·atkPct 18→24:
   *  특화는 사냥(mob)+보스 골고루 — 지속전 강점(짧은 쿨·CC·힐)이 실제 화력으로 이어지게. */
  bossDmgPct: 14, mobDmgPct: 14,
  cdMult: 0.7, skillMult: 1.4, // v1.4.30 (#7) — 이터널 1.2→1.4 (실성능 강화 핵심 레버)
  desc: "모든 마법이 그의 이름 앞에 무릎 꿇는다.",
};
const SHADOWLORD: ClassDef = {
  key: "shadowlord", tier: 4, parent: "nightblade",
  name: "섀도우로드", title: "그림자 군주",
  color: "#a86aff", hex: 0xa86aff,
  atkPct: 25, critAdd: 25, defAdd: 0, hpAdd: 150, mpAdd: 60, speedPct: 15,
  bossDmgPct: 18, mobDmgPct: 2,
  cdMult: 0.7, skillMult: 1.3,
  desc: "그림자가 그를 따라 세계를 덮는다.",
};
const BLADEMASTER: ClassDef = {
  key: "blademaster", tier: 4, parent: "duelist",
  name: "블레이드마스터", title: "검의 극한",
  color: "#ffaaff", hex: 0xffaaff,
  atkPct: 22, critAdd: 18, defAdd: 8, hpAdd: 220, mpAdd: 60, speedPct: 15,
  bossDmgPct: 8, mobDmgPct: 10,
  cdMult: 0.75, skillMult: 1.25,
  desc: "단검 두 자루로 신을 벤다.",
};

/* ── 해적 4차 ─────────────────────────────────────────────── */
/* 씨킹 — 바다의 지배자: 광역 해일 + 아군 전체 버프(계열 정체성 완성) */
const SEAKING: ClassDef = {
  key: "seaking", tier: 4, parent: "stormcaptain",
  name: "씨킹", title: "바다의 왕",
  /* vc204 (#4) — 부모 stormcaptain 계열(#ffd88a)로 맞춘다. 4차는 가장 밝은 변주. */
  color: "#fff0b8", hex: 0xfff0b8,
  atkPct: 28, critAdd: 10, defAdd: 8, hpAdd: 240, mpAdd: 120, speedPct: 12,
  bossDmgPct: 20, mobDmgPct: 14,
  cdMult: 0.78, skillMult: 1.35,
  desc: "해일이 그의 손끝에서 시작된다. 함께 싸우는 자 모두가 강해진다.",
};
/* 드레드노트 — 무쌍 포격: 전장을 지우는 화력 */
const DREADNOUGHT: ClassDef = {
  key: "dreadnought", tier: 4, parent: "powdermaster",
  name: "드레드노트", title: "무쌍 포격",
  color: "#ff6a3d", hex: 0xff6a3d,
  atkPct: 34, critAdd: 14, defAdd: 0, hpAdd: 180, mpAdd: 60, speedPct: 6,
  bossDmgPct: 26, mobDmgPct: 8,
  cdMult: 0.85, skillMult: 1.45,
  desc: "한 발의 포성이 전장을 침묵시킨다.",
};

export const CLASSES: Record<ClassKey, ClassDef> = {
  warrior: WARRIOR, ranger: RANGER, mage: MAGE, thief: THIEF,
  berserker: BERSERKER, guardian: GUARDIAN,
  sniper: SNIPER, windrunner: WINDRUNNER,
  archmage: ARCHMAGE, sage: SAGE,
  assassin: ASSASSIN, swashbuckler: SWASHBUCKLER,
  warlord: WARLORD, paladin: PALADIN,
  eagleeye: EAGLEEYE, tempest: TEMPEST,
  stormbringer: STORMBRINGER, chronicle: CHRONICLE,
  nightblade: NIGHTBLADE, duelist: DUELIST,
  warbringer: WARBRINGER, crusader: CRUSADER,
  deadeye: DEADEYE, skylord: SKYLORD,
  arclord: ARCLORD, eternal: ETERNAL,
  shadowlord: SHADOWLORD, blademaster: BLADEMASTER,
  /* v1.1.9 — 해적 계열 */
  pirate: PIRATE, raider: RAIDER, corsair: CORSAIR,
  stormcaptain: STORMCAPTAIN, powdermaster: POWDERMASTER,
  seaking: SEAKING, dreadnought: DREADNOUGHT,
};

/** 1차 계열 4종 (초기 전직 선택지 — v2.9 도적 추가) */
export const CLASS_LIST: ClassDef[] = [WARRIOR, RANGER, MAGE, THIEF, PIRATE];

/* ================= 헬퍼 ================= */

export function isClassKey(v: unknown): v is ClassKey {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(CLASSES, v);
}

/** 세이브 문자열 → 정의 (무효값 null 방지) */
export function classDef(key?: string | null): ClassDef | null {
  return isClassKey(key) ? CLASSES[key] : null;
}

/** 루트(1차) 계열키 — 계열별 전투 방식 분기(스킬 등)에 사용 */
export function familyOf(key?: string | null): FamilyKey | null {
  const chain = chainOf(key);
  if (chain.length === 0) return null;
  return chain[0].key as FamilyKey;
}

/** 경로 체인 — [1차, 2차?, 3차?] */
export function chainOf(key?: string | null): ClassDef[] {
  const out: ClassDef[] = [];
  let cur = classDef(key);
  while (cur) {
    out.unshift(cur);
    cur = classDef(cur.parent);
  }
  return out;
}

/** v1.2.0 (#13) — 현재 직업이 2차 이상이면 그 계열의 "2차 직업 키"를 반환 (외형 시트용).
 *  3·4차는 부모 체인을 거슬러 2차 직업의 외형을 승계한다 (워로드→버서커 외형 등).
 *  1차/무직은 null — 기본 성별/피부 시트 사용. */
export function tier2RootOf(key?: string | null): ClassKey | null {
  const chain = chainOf(key);
  if (chain.length < 2) return null;
  return chain[1].key;
}

/* ================= v1.0.14 피드백#2 — 계열(8 기본 직업) 매핑 =================
 *  유저 지시: "직업 별로 기준이 전직 차수 직업 포함이 아니라 계열 즉 총 8개의 직업들 중 랭킹을 계산해"
 *  이 게임의 계열 = 2차 직업 8종이 각각 루트인 전직 라인 (3·4차는 2차의 승계 — tier2RootOf와 동일 구조):
 *    berserker(버서커)   ← berserker · warlord · warbringer
 *    guardian(가디언)    ← guardian · paladin · crusader
 *    sniper(스나이퍼)    ← sniper · eagleeye · deadeye
 *    windrunner(윈드러너) ← windrunner · tempest · skylord
 *    archmage(아크메이지) ← archmage · stormbringer · arclord
 *    sage(세이지)        ← sage · chronicle · eternal
 *    assassin(어세신)    ← assassin · nightblade · shadowlord
 *    swashbuckler(스와시버클러) ← swashbuckler · duelist · blademaster
 *  1차(전사/궁수/마법사/도적)·무직은 아직 계열을 선택 전 — null (직업별 랭킹에서는 "전체"로만 조회). */

/** 8계열 루트(2차) 클래스키 — 직업별 랭킹 필터 칩 목록 (?job= 값)
 *  vc181 (지시 — "해적류 직업 랭킹 등록 안됨") — 해적 계열 2종(raider/corsair)이
 *  이 목록에 없어 랭킹 필터 칩에도, 직업별 순위 집계에도 아예 등장하지 않았다. 추가. */
export const BRANCH_KEYS: ClassKey[] = [
  "berserker", "guardian", "sniper", "windrunner",
  "archmage", "sage", "assassin", "swashbuckler",
  "raider", "corsair", // 해적 2차 2갈래 (stormcaptain/powdermaster → raider, seaking/dreadnought → raider·corsair)
];

/** 클래스키 → 소속 계열(2차 루트) 정규화. 1차/무직/미지 키는 null.
 *  예) warbringer → "berserker", eternal → "sage", warrior → null */
export function clsToBranch(key?: string | null): ClassKey | null {
  const chain = chainOf(key);
  if (chain.length < 2) return null;
  return chain[1].key;
}

export type ClassBonus = {
  atkPct: number;
  critAdd: number;
  defAdd: number;
  hpAdd: number;
  mpAdd: number;
  speedPct: number;
  cdMult: number;
  skillMult: number;
  bossDmgPct: number;
  mobDmgPct: number;
};

/** 경로 누적 보너스 — 합산은 합, 배율은 곱 */
export function bonusOf(key?: string | null): ClassBonus {
  const acc: ClassBonus = {
    atkPct: 0, critAdd: 0, defAdd: 0, hpAdd: 0, mpAdd: 0, speedPct: 0,
    cdMult: 1, skillMult: 1, bossDmgPct: 0, mobDmgPct: 0,
  };
  for (const d of chainOf(key)) {
    acc.atkPct += d.atkPct;
    acc.critAdd += d.critAdd;
    acc.defAdd += d.defAdd;
    acc.hpAdd += d.hpAdd;
    acc.mpAdd += d.mpAdd;
    acc.speedPct += d.speedPct;
    acc.cdMult *= d.cdMult;
    acc.skillMult *= d.skillMult;
    acc.bossDmgPct += d.bossDmgPct;
    acc.mobDmgPct += d.mobDmgPct;
  }
  return acc;
}

/** 다음 전직 단계 (4차 완료면 null) */
export function nextTierOf(key?: string | null): Tier | null {
  const cur = classDef(key);
  const next = (cur ? cur.tier + 1 : 1) as Tier;
  return next <= 4 ? next : null;
}

/** 다음 단계 요구 레벨 (완료 상태면 null) */
export function nextJobLevel(key?: string | null): number | null {
  const t = nextTierOf(key);
  return t === null ? null : JOB_LEVELS[`t${t}`];
}

/** 지금 전직/승격 가능 여부 — 다음 단계 요구 레벨 달성 */
export function canJobNow(lv: number, key?: string | null): boolean {
  const need = nextJobLevel(key);
  return need !== null && lv >= need;
}

/** 다음 전직 선택지 — 미전직: 1차 3계열 / 1차: 계열별 2차 2종 / 2차: 경로 3차 1종 */
export function jobOptions(key?: string | null): ClassDef[] {
  const cur = classDef(key);
  if (!cur) return CLASS_LIST;
  const next = nextTierOf(cur.key);
  if (next === null) return [];
  return Object.values(CLASSES).filter((d) => d.tier === next && d.parent === cur.key);
}

/** 자유 전직 대상 — 같은 단계·같은 계열의 반대 경로 (2차 이상) */
export function freeJobOption(key?: string | null): ClassDef | null {
  const cur = classDef(key);
  if (!cur || cur.tier < 2) return null;
  const alt = Object.values(CLASSES).find(
    (d) => d.tier === cur.tier && d.parent === cur.parent && d.key !== cur.key
  );
  return alt ?? null;
}

/* v3.0.6 (지시 #2/#4 — "2차에서 스킬이 변하는게 없다" + "겹치는 스킬 하나도 없게"):
 *  Z(주력기)/C(기동기)를 클래스 "고유" 메커니즘으로 전면 분리.
 *  1차 4계열 + 2차 8직업 = 12종 Z + 12종 C — 서로 다른 직업(형제 포함) 간 메커니즘 0개 공유.
 *  3차/4차는 계열 승격이므로 2차기의 "강화판"을 사용 (전직마다 기존 스킬 강화 — 지시) —
 *  resolveSkill1/2Of 헬퍼가 체인을 거슬러 최상위 정의를 찾는다. */
export type Skill1Kind =
  | "spin" /* warrior — 360° 회전베기 */
  | "volley" /* ranger — 부채꼴 관통 화살 */
  | "bolt" /* mage — 대관통 매직 볼트 */
  | "bladestorm" /* thief — 전방 다연발 단검 투척 (전사 회전베기와 겹침 제거) */
  | "ragespin" /* berserker — 파괴의 회전베기: 회전 + 명중 출혈 */
  | "wallsmash" /* guardian — 성벽 강타: 전방 대참격 + 지진파 + 방어 버프 */
  | "snipe" /* sniper — 매의 관통 화살: 즉발 히트스캔 저격 (무한 관통 라인) */
  | "gustarrow" /* windrunner — 회오리 화살: 적을 끌어당기는 회오리 투사체 */
  | "arcbolt" /* archmage — 아크 볼트: 착탄 광역 폭발 대형 볼트 */
  | "purify" /* sage — 정화의 파동: 확산 파동 링, 타격당 자힐 */
  | "shadowexec" /* assassin — 그림자 참수: 최근접 적 점멸 + 출혈 강타 */
  | "flurrydance" /* swashbuckler — 연타 난무: 전방 5연속 속공 */
  /* v1.1.9 — 해적 계열. "넓게 쓸어버린다"가 계열 정체성. */
  | "cannonblast" /* raider — 포격: 전방 대형 폭발탄 */
  | "cutlassdance" /* corsair — 커틀러스 난무: 전방 광범위 3연속 베기 */
  /* vc179 (지시 #6·#10) — 해적 3·4차 고유기. 종전엔 3·4차가 SKILL1_KIND에 없어
   *  2차 스킬로 폴백됐고, 그래서 "해적 스킬이 별로"였다. 계열 정체성(화약·함포·심해)을
   *  단계별로 확장: 3차=광역 폭격, 4차=바다를 부수는 일격. */
  | "manowar"     /* stormcaptain — 현측 전열포: 좌우 2열 함포 일제사격 + 폭발 */
  | "dreadvolley"; /* seaking — 심해 포격진: 적을 추적하는 3연 포탄 + 해일 */

export type Skill2Kind =
  | "dash" /* warrior — 돌진 + 종착 충격파 */
  | "windstep" /* ranger — 질풍 차지 + 종착 후퇴사격 */
  | "blink" /* mage — 점멸 + 양단 마나 폭발 */
  | "shadowveil" /* thief — 그림자 숨기: 즉발 초단거리 텔레포트, 다음 기본공격 강화 */
  | "savagerush" /* berserker — 살상 돌진: 종착 분노 폭발 + 공격 버프 */
  | "bulwarkdash" /* guardian — 불굴 돌진: 종착 지진파 + 방어 버프 */
  | "falconwind" /* sniper — 매의 질풍: 돌진 후 3발 부채꼴 저격 */
  | "windslash" /* windrunner — 질풍 가르기: 돌진 경로에 관통 화살 잔상 */
  | "grandblink" /* archmage — 대전이 점멸: 양단 대폭발 (반경 1.5배) */
  | "cycleblink" /* sage — 순환 점멸: MP 회복 + 경로 마나 흡수 */
  | "ambushdash" /* assassin — 암습 돌진: 경로상 적 출혈 부여 */
  | "flashydash" /* swashbuckler — 화려한 돌진: 경로 연타 + 화려한 검 잔상 */
  /* v1.1.9 — 해적 계열 기동기 */
  | "smokestep"   /* raider — 연막 측면: 짧은 도약 + 착지 폭발 */
  | "grappleswing"; /* corsair — 갈고리 그네: 먼 거리 도약 + 경로 타격 */

/* v3.0.6 — 1차+2차 12종 고유 정의 (3차/4차는 resolveSkill1Of가 계열 체인에서 승계) */
export const SKILL1_KIND: Partial<Record<ClassKey, Skill1Kind>> = {
  warrior: "spin",
  ranger: "volley",
  mage: "bolt",
  thief: "bladestorm",
  /* vc179 — 1차 해적 전용기: 레이더(2차)의 총격을 1차에서 조기 승계.
   *  v1.2.4에서 1차 해적이 테이블에 없어 resolveSkill1Of가 null → 전사 회전베기 폴백으로
   *  "해적인데 검을 돌린다"가 됐다. 해적 정체성(총)을 1차부터 부여한다. */
  pirate: "cannonblast",
  berserker: "ragespin",
  guardian: "wallsmash",
  sniper: "snipe",
  windrunner: "gustarrow",
  archmage: "arcbolt",
  sage: "purify",
  assassin: "shadowexec",
  swashbuckler: "flurrydance",
  /* v1.1.9 — 해적 */
  raider: "cannonblast",
  corsair: "cutlassdance",
  /* vc179 (지시 #6·#10) — 해적 3·4차: 종전엔 없어서 2차로 폴백(직업 구현 미완) */
  stormcaptain: "manowar",
  seaking: "dreadvolley",
  powdermaster: "dreadvolley",
  dreadnought: "manowar",
  /* v1.4.36 (유저 지시 #12 "스킬 강화 및 개편 & 아예 교체 한거 맞음??") —
   *  종전 3·4차 16직업의 Z(주력기)가 SKILL1_KIND 에 없어 resolveSkill1Of 가
   *  2차 스킬을 그대로 승계했다(실측: 3·4차 고유 4/20). 계열 정체성 안에서
   *  상위 메커니즘을 배정해 20/20 고유화. 실행부는 기존 skill1* 를 쓰며,
   *  sTier 로 배율·반경·부가효과가 자동 강화된다(3차/4차 전용 오라 연출 포함). */
  warlord: "wallsmash",      // 3차 전사 — 방벽 강타
  warbringer: "ragespin",    // 4차 전사 — 파괴의 회전베기
  crusader: "wallsmash",     // 4차 전사 — 성역 강타
  paladin: "ragespin",       // 4차 전사 — 심판의 회전
  eagleeye: "snipe",         // 3차 궁수 — 매안 저격
  tempest: "gustarrow",      // 3차 궁수 — 폭풍 화살
  deadeye: "snipe",          // 4차 궁수 — 사신 저격
  skylord: "gustarrow",      // 4차 궁수 — 천공 화살
  stormbringer: "arcbolt",   // 3차 마법 — 뇌전 볼트
  chronicle: "purify",       // 3차 마법 — 기록의 정화
  arclord: "arcbolt",        // 4차 마법 — 아크 폭발
  eternal: "purify",         // 4차 마법 — 영원의 정화
  nightblade: "shadowexec",  // 3차 도적 — 야습 참수
  duelist: "flurrydance",    // 3차 도적 — 결투 난무
  shadowlord: "shadowexec",  // 4차 도적 — 그림자 참수
  blademaster: "flurrydance",// 4차 도적 — 검무 난무
};

export const SKILL2_KIND: Partial<Record<ClassKey, Skill2Kind>> = {
  warrior: "dash",
  ranger: "windstep",
  mage: "blink",
  thief: "shadowveil",
  /* vc178 — 1차 해적 기동기: 레이더(2차)의 연막 측면 조기 승계 (1차 스킬과 세트). */
  pirate: "smokestep",
  berserker: "savagerush",
  guardian: "bulwarkdash",
  sniper: "falconwind",
  windrunner: "windslash",
  archmage: "grandblink",
  sage: "cycleblink",
  assassin: "ambushdash",
  swashbuckler: "flashydash",
  /* v1.1.9 — 해적 */
  raider: "smokestep",
  corsair: "grappleswing",
  /* vc179 (지시 #10) — 해적 3·4차 기동기 승계(없으면 2차 폴백 = 직업 미구현 체감) */
  stormcaptain: "grappleswing",
  powdermaster: "smokestep",
  seaking: "grappleswing",
  dreadnought: "smokestep",
  /* v1.4.36 (지시 #12) — 3·4차 C(기동기) 16직업 고유화 (종전 4/20 → 20/20).
   *  Z 와 동일 원칙: 계열 정체성 안에서 상위 이동기를 배정, sTier 로 자동 강화. */
  warlord: "bulwarkdash",      // 3차 전사
  warbringer: "savagerush",    // 4차 전사
  crusader: "savagerush",      // 4차 전사
  paladin: "bulwarkdash",      // 4차 전사
  eagleeye: "falconwind",      // 3차 궁수
  tempest: "windslash",        // 3차 궁수
  deadeye: "falconwind",       // 4차 궁수
  skylord: "windslash",        // 4차 궁수
  stormbringer: "grandblink",  // 3차 마법
  chronicle: "cycleblink",     // 3차 마법
  arclord: "grandblink",       // 4차 마법
  eternal: "cycleblink",       // 4차 마법
  nightblade: "ambushdash",    // 3차 도적
  duelist: "flashydash",       // 3차 도적
  shadowlord: "ambushdash",    // 4차 도적
  blademaster: "flashydash",   // 4차 도적
};

/** 스킬 종류 승계 — 현재 클래스부터 루트까지 거슬러 처음 정의된 종류 (3차/4차는 2차기 강화판)
 *
 *  vc179 (지시 #9) 조사 기록: 이 함수는 이미 올바르다. chainOf()가 unshift로
 *  [루트 … 현재]를 만들므로 `length-1`부터 도는 것이 곧 "현재 → 루트"다.
 *  1차/2차 스킬이 같아 보이는 실제 원인은 **전직이 적용되지 않는 것**(지시 #8)과
 *  pirate=raider가 둘 다 "cannonblast"인 중복 매핑이었다. */
export function resolveSkill1Of(key?: string | null): Skill1Kind | null {
  const chain = chainOf(key);
  for (let i = chain.length - 1; i >= 0; i--) {
    const k = SKILL1_KIND[chain[i].key];
    if (k) return k;
  }
  return null;
}

export function resolveSkill2Of(key?: string | null): Skill2Kind | null {
  const chain = chainOf(key);
  for (let i = chain.length - 1; i >= 0; i--) {
    const k = SKILL2_KIND[chain[i].key];
    if (k) return k;
  }
  return null;
}

/* v3.0.2 (사용자 지시 #10 — "전직을 해도 스킬이 안바뀜") → v3.0.3 확장:
 *  클래스별 스킬 5슬롯 테이블 — [기본공격, 주력기(Z), 기동기(C), 3차기(V), 4차기(B)]
 *  v3.0.3 (지시 — "3차에는 스킬 3개, 4차는 4개"):
 *   - 3차 클래스부터 스킬 3개 (s3 해금), 4차는 스킬 4개 (s4 해금)
 *   - 각 상위직은 고유 메커니즘을 가진다 (세이지 계열=힐/빛, 암살 계열=출혈 등)
 *   - 1차/2차 라벨은 s3/s4 자리가 빈 문자열 — Player getter가 계열 기본값 처리
 *  v3.0.6 — Z/C 라벨을 신규 고유 메커니즘과 일치시킴 (성벽 강타/정화의 파동/그림자 참수/연타 난무/칼날 폭풍) */
export const SKILL_LABELS: Partial<Record<ClassKey, [string, string, string, string, string]>> = {
  berserker: ["광폭 연타", "파괴의 회전베기", "살상 돌진", "", ""],
  guardian: ["수호 참격", "성벽 강타", "불굴 돌진", "", ""],
  sniper: ["저격 사격", "매의 관통 화살", "매의 질풍", "", ""],
  windrunner: ["질풍 연사", "회오리 화살", "질풍 가르기", "", ""],
  archmage: ["대폭발 마법탄", "아크 볼트", "대전이 점멸", "", ""],
  sage: ["현자의 마법탄", "정화의 파동 (자힐+MP)", "순환 점멸", "", ""],
  assassin: ["암살 연타", "그림자 참수", "암습 돌진", "", ""],
  swashbuckler: ["화려한 연타", "연타 난무", "화려한 돌진", "", ""],
  warlord: ["지배의 참격", "전장 선회베기", "전장 돌파", "전장의 함성", ""],
  paladin: ["성검 참격", "심판의 회전베기", "빛의 돌진", "성역 — 빛의 결계", ""],
  eagleeye: ["신관 사격", "절명 화살", "매의 부리", "절사명중 사격", ""],
  tempest: ["폭풍 연사", "폭풍 화망", "폭풍 질주", "폭풍의 눈", ""],
  stormbringer: ["뇌전 마법탄", "스톰 볼트", "뇌우 점멸", "낙뢰 소환", ""],
  chronicle: ["서사의 마법탄", "크로니 볼트", "시간 점멸", "시간 왜곡", ""],
  nightblade: ["야경 연타", "야그림자 회전베기", "야간 돌진", "그림자 칼날", ""],
  duelist: ["결투 연타", "결투의 회전베기", "결투 돌진", "연격 무도", ""],
  /* v3.0.4 — 4차 전용 고유 3차기 (기존 3차 스킬 재탕 금지 — 겹침 0) */
  warbringer: ["종언의 참격", "전쟁의 회오리", "파멸 돌진", "피의 격노", "종언의 일격"],
  crusader: ["천벌의 참격", "성역의 회전베기", "심판 돌진", "성흔 폭발", "심판의 빛기둥"],
  deadeye: ["신의 사격", "심판의 화살", "차원 사격", "화살 폭우", "신의 화살비"],
  skylord: ["천공 연사", "하늘의 화망", "천공 질주", "하늘의 희망", "천공의 폭풍"],
  arclord: ["절대 마법탄", "아크로드 볼트", "차원 점멸", "연쇄 번개", "마나 붕괴"],
  eternal: ["영겁의 마법탄", "이터널 볼트", "영원의 점멸", "중력 붕괴", "영원의 고리"],
  shadowlord: ["심연 연타", "암흑 회전베기", "그림자 돌진", "그림자 지뢰", "그림자 군주"],
  blademaster: ["신살 연타", "쌍검 회전베기", "극한 돌진", "파동 검기", "검무 — 극한"],
  /* vc179 (지시 #6·#10) — 해적 7직업 라벨. 종전엔 해적이 이 표에 아예 없어서
   *  전 슬롯이 계열 기본값으로 떨어져 "해적 스킬 구현이 덜 됐다"로 보였다.
   *  Z=화약, C=기동, V=해적 고유 3차기, B=4차 궁극기 순. */
  pirate: ["권총 사격", "포격", "연막 측면", "", ""],
  raider: ["산탄 사격", "포격", "연막 측면", "", ""],
  corsair: ["쌍권총 난사", "커틀러스 난무", "갈고리 사슬", "", ""],
  stormcaptain: ["폭풍 사격", "현측 전열포", "닻 사슬", "뇌우 소환", ""],
  powdermaster: ["화약 연사", "폭약 부설", "도화선 도약", "지뢰 부설", ""],
  seaking: ["해왕 사격", "심해 포격진", "갈고리 사슬", "만조", "침몰의 종"],
  dreadnought: ["무쌍 포격", "전탄 발사", "철갑 돌파", "전탄 일제사격", "무쌍 포격 — 극"],
};

/* v3.0.3 — 클래스별 스킬 메커니즘 디스패치 키.
 *  3차(V)/4차(B) 스킬은 클래스 "계열"이 아니라 클래스 "고유" 구현으로 간다.
 *  같은 메커니즘을 공유하는 클래스는 같은 키를 쓰되 수치/색이 클래스 배지색을 따른다. */
/* v3.0.4 (사용자 지시 #4 — "직업 및 세부직업 별로 겹치는 스킬 하나도 없게"):
 *  16개 상위직이 전부 서로 다른 3차기(V) 메커니즘을 갖는다.
 *  3차 8종(기존) + 4차 전용 신규 8종. 한 메커니즘을 공유하는 클래스는 더 이상 없다. */
export type Skill3Kind =
  | "warcry"      /* warlord(3차) — 전장의 함성: 광역+자신 공격력 버프 */
  | "sanctuary"   /* paladin(3차) — 성역: 빛의 결계 필드 (적 딜링+자힐) */
  | "trueshot"    /* eagleeye(3차) — 절사명중: 확정크리 관통 저격 */
  | "tornado"     /* tempest(3차) — 폭풍의 눈: 다수 회오리 투사체 */
  | "thunder"     /* stormbringer(3차) — 낙뢰: 다수 적에게 하늘에서 직격 */
  | "timewarp"    /* chronicle(3차) — 시간 왜곡: 감속 필드 */
  | "shadowblad"  /* nightblade(3차) — 그림자 칼날: 회전 오비트 */
  | "flurry"      /* duelist(3차) — 연격 무도: 연속 급습+흡혈 */
  | "bloodrage"   /* warbringer(4차) — 피의 격노: 광역 출혈+공격/신속 동시 버프 */
  | "holynova"    /* crusader(4차) — 성흔 폭발: 즉발 광역 빛 폭발+보호막 */
  | "arrowrain"   /* deadeye(4차) — 화살 폭우: 조준 지점 하늘에서 화살 쏟아짐 */
  | "cyclone"     /* skylord(4차) — 폭풍 소용돌이: 느리지만 전부 관통하는 대형 회오리 */
  | "chainlight"  /* arclord(4차) — 연쇄 번개: 적→적으로 도약하는 번개 */
  | "gravity"     /* eternal(4차) — 중력 붕괴: 적을 한 점으로 끌어당긴 뒤 폭발 */
  | "shadowmine"  /* shadowlord(4차) — 그림자 지뢰: 접촉 시 출혈 폭발 지뢰 설치 */
  | "swordaura"   /* blademaster(4차) — 파동 검기: 전방 전부 관통하는 검기 파동 */
  /* v1.1.9 — 해적 계열 3차·4차기 (기존 16종과 메커니즘 겹침 0) */
  | "stormcall"   /* stormcaptain(3차) — 뇌우 소환: 광역 낙뢰 + 아군 가속 */
  | "minefield"   /* powdermaster(3차) — 지뢰 부설: 접근하면 연쇄 폭발하는 지뢰 4기 */
  | "tidalwave"   /* seaking(4차) — 만조: 전방을 쓸고 가는 거대 해일 */
  | "broadside";  /* dreadnought(4차) — 전탄 발사: 양현 포격이 전장을 덮는다 */

export type Skill4Kind =
  | "doomsday"    /* warbringer — 종언의 일격: 돌진 후 대폭발 */
  | "judgment"    /* crusader — 심판의 빛기둥: 다수 빛 기둥+성방어 */
  | "godarrow"    /* deadeye — 신의 화살비: 유도 화살 8발 */
  | "skystorm"    /* skylord — 천공의 폭풍: 나선 회오리+신속 */
  | "manaburst"   /* arclord — 마나 붕괴: MP 소모 대폭발 */
  | "eternalloop" /* eternal — 영원의 고리: 광역 기절(시간 정지) */
  | "shadowclon"  /* shadowlord — 그림자 군주: 그림자 분신 자폭 */
  | "bladedance" /* blademaster — 검무: 적 사이 점멸 연격 */
  /* v1.1.9 — 해적 계열 4차 궁극 2종 */
  | "maelstrom"   /* seaking — 침몰의 종: 거대 소용돌이가 전장을 삼킨다 */
  | "decksweep";  /* dreadnought — 무쌍 포격: 8방향 동시 폭격 */

/* v3.0.4 — 16개 상위직 전부 고유 메커니즘 (겹침 0) */
export const SKILL3_KIND: Partial<Record<ClassKey, Skill3Kind>> = {
  warlord: "warcry",
  paladin: "sanctuary",
  eagleeye: "trueshot",
  tempest: "tornado",
  stormbringer: "thunder",
  chronicle: "timewarp",
  nightblade: "shadowblad",
  duelist: "flurry",
  warbringer: "bloodrage",
  crusader: "holynova",
  deadeye: "arrowrain",
  skylord: "cyclone",
  arclord: "chainlight",
  eternal: "gravity",
  shadowlord: "shadowmine",
  blademaster: "swordaura",
  /* v1.1.9 — 해적 */
  stormcaptain: "stormcall",
  powdermaster: "minefield",
  seaking: "tidalwave",
  dreadnought: "broadside",
};

export const SKILL4_KIND: Partial<Record<ClassKey, Skill4Kind>> = {
  warbringer: "doomsday",
  crusader: "judgment",
  deadeye: "godarrow",
  skylord: "skystorm",
  arclord: "manaburst",
  eternal: "eternalloop",
  shadowlord: "shadowclon",
  blademaster: "bladedance",
  /* v1.1.9 — 해적 */
  seaking: "maelstrom",
  dreadnought: "decksweep",
};

/** GM/전직 패널용 스킬 설명 — 3차기/4차기 (v3.0.4 — 16종 전부 고유) */
export const SKILL3_DESC: Record<Skill3Kind, string> = {
  warcry: "광역 외침 + 자신 공격력 버프",
  sanctuary: "빛의 결계 — 적 타격 + 결계 내 자힐",
  trueshot: "확정 크리티컬 관통 저격",
  tornado: "다수 회오리 투사체 발사",
  thunder: "하늘에서 낙뢰 다수 직격",
  timewarp: "시간 왜곡 필드 — 적 감속 · 자신 HP 틱 회복 (v3.0.7 힐러 강화)",
  shadowblad: "그림자 칼날이 주위를 선회",
  flurry: "연속 급습 + 피해 흡수",
  bloodrage: "광역 출혈 + 공격력·신속 동시 버프",
  holynova: "즉발 빛 폭발 + 성스러운 보호막",
  arrowrain: "조준 지점에 화살이 쏟아지는 폭우",
  cyclone: "대형 토네이도 2기 + 잔풍 4기 — 적을 빨아들이며 짓부순다",
  chainlight: "적에서 적으로 도약하는 연쇄 번개",
  gravity: "적을 한 점으로 끌어모아 폭발",
  shadowmine: "접촉 시 출혈 폭발하는 지뢰 3기 설치",
  swordaura: "전방을 전부 관통하는 거대 검기 파동",
  /* v1.1.9 — 해적 */
  stormcall: "광역 낙뢰 폭풍 + 자신 신속",
  minefield: "접근하면 연쇄 폭발하는 지뢰 4기 부설",
  tidalwave: "전방을 쓸고 가는 거대 해일 — 광범위 넉백",
  broadside: "양현 전탄 발사 — 부채꼴 3방향 동시 폭격",
};
export const SKILL4_DESC: Record<Skill4Kind, string> = {
  doomsday: "돌진 후 종언의 대폭발",
  judgment: "빛기둥 심판 + 성스러운 방어",
  godarrow: "유도되는 신의 화살 8발",
  skystorm: "나선 미니 토네이도 12기 + 중심 대형 회오리 + 신속",
  manaburst: "MP를 태워 대폭발",
  eternalloop: "시간 정지 — 광역 기절 · 자신 HP 25% + MP 50% 회복 (v3.0.7 힐러 정점)",
  shadowclon: "그림자 분신 자폭",
  bladedance: "적 사이를 점멸하는 검무",
  /* v1.1.9 — 해적 */
  maelstrom: "거대 소용돌이가 전장을 삼키고 적을 끌어당긴다",
  decksweep: "8방향 동시 폭격 — 전장 전체를 지운다",
};

/* v3.2.0 — 5차 궁극기 (지시: "5차스킬(200렙), 쿨타임 1분, ㅈㄴ 강력하고 화려한 궁극기")
 *  · 해금: 레벨 200 (최종 레벨 캡) — 전직 티어 무관
 *  · 쿨타임: 60초 고정 (cdMult 미적용 — "쿨타임 1분" 그대로)
 *  · MP 100 소모, 계열(warrior/ranger/mage/thief)별 화려한 전용 연출 + 대미지 계수는
 *    4차 궁극기의 2배 이상 (롤 대미지 계수 합산 ~20배급)
 * v3.3.0 (지시 #2 — "세부 직업별로 5차(궁극기)가 달라야지!!"):
 *  · 4차 세부직업 8종 전부 "고유 궁극기"로 분리 (기존 계열 공용 → 겹침 0)
 *  · 4차 미달 플레이어는 기존 계열 궁극기 그대로 폴백 (하위 호환) */
export type Skill5Key =
  | FamilyKey
  | "warbringer" | "crusader" | "deadeye" | "skylord"
  | "arclord" | "eternal" | "shadowlord" | "blademaster"
  /* vc194 — 전 직업 고유 궁극기화.
   *  종전엔 30직업이 13종을 공유해 stormbringer 가 mage 궁극기를,
   *  dreadnought 가 pirate 궁극기를 쓰는 정체성 불일치가 있었다.
   *  아래 17키를 추가해 30직업 = 30궁극기 1:1 매핑을 만든다. */
  | "berserker" | "guardian" | "warlord" | "paladin"
  | "sniper" | "windrunner" | "eagleeye" | "tempest" | "stormbringer"
  | "archmage" | "sage" | "chronicle"
  | "assassin" | "swashbuckler" | "nightblade" | "duelist"
  | "raider" | "corsair" | "stormcaptain" | "powdermaster" | "seaking" | "dreadnought";
/* vc206 (지시 #6) — 궁극기 보유 직업 = **4차 10직업 전용**.
 *  유저 지시: "1~3차 직업 궁극기를 없애고 4차만 5차전직이 가능하니 4차 직업 궁극기 2개를 강하게 개편"
 *  5차 전직은 4차에서만 가능하므로, 1~3차·계열 기본 직업은 궁극기를 갖지 않는다. */
export const ULT_CLASSES: Set<string> = new Set([
  "warbringer", "crusader",      // 전사
  "deadeye", "skylord",          // 궁수
  "arclord", "eternal",          // 마법사
  "shadowlord", "blademaster",   // 도적
  "seaking", "dreadnought",      // 해적
]);

export const SKILL5_INFO: Record<Skill5Key, { name: string; desc: string }> = {
  /* ── 계열 폴백 (1~3차에서 5차 해금 시) ── */
  warrior: {
    name: "천멸 — 대붕괴 검격",
    desc: "하늘이 갈라지는 6연속 초거대 참격 후 대붕괴 종결 일격 — 광역 출혈 + 공격력 대버프",
  },
  ranger: {
    name: "천강 — 무한 화살비",
    desc: "하늘에서 유도 화살 26연발 + 관통 화우 12발 — 화염 필드로 전장을 태운다",
  },
  mage: {
    name: "종막 — 아르카나 대폭발",
    desc: "운석 8발 낙하 + 만물의 원소 종막 폭발 — 피해량이 가장 높은 광역 마법",
  },
  /* v1.1.9 — 해적 계열 궁극기(계열 폴백). 4차 미달 해적이 200레벨에서 쓴다. */
  pirate: {
    name: "만조 — 대양 항로",
    desc: "거대한 해일이 전장을 관통하고 뇌운에서 낙뢰가 쏟아진다 — 범위가 가장 넓은 계열 궁극기",
  },
  thief: {
    name: "심연 — 그림자 참수극",
    desc: "적 사이를 점멸하며 전원을 참수한 뒤 심연 뉴클리어 폭발 — 출혈 중첩",
  },
  /* ── 4차 세부직업 8종 전용 궁극기 (v3.3.0) ── */
  warbringer: {
    name: "천멸극 — 종언의 대붕괴",
    desc: "워브링어 전용. 참격 9연속이 전장을 갈라놓고, 분노의 대붕괴 일격이 지평선을 지운다 — 전투 중 출혈이 끊이지 않는다",
  },
  crusader: {
    name: "성흔극 — 심판의 강림",
    desc: "크루세이더 전용. 하늘에서 성스러운 빛기둥 9개가 떨어져 심판하고, 강림한 성검이 전원을 정화 — 자신은 완전 회복",
  },
  deadeye: {
    name: "신시극 — 절사명중",
    desc: "데드아이 전용. 빗나가지 않는 유도 화살 32연발(전부 확정 크리티컬) + 신의 저격선 3연사로 전장을 관통한다",
  },
  skylord: {
    name: "천풍극 — 라스트 템페스트",
    desc: "스카이로드 전용. 초대형 회오리 14기가 하늘을 뒤틀고 연쇄 낙뢰가 전장을 씻는다 — 신속 대버프",
  },
  arclord: {
    name: "종막극 — 아르카나 오버로드",
    desc: "아크로드 전용. 운석 12발 + 마나 붕괴 3중 폭발 — 잔여 MP를 전부 태워 피해량이 증가한다",
  },
  eternal: {
    name: "영겁극 — 시간 붕괴",
    desc: "이터널 전용. 시간을 정지시키고 7중 잔상 폭발로 시간 자체를 갈라놓는다 — 피해의 잔상이 두 번 울린다",
  },
  shadowlord: {
    name: "심연극 — 그림자 군주 강림",
    desc: "섀도우로드 전용. 그림자 군주로 강림해 10연속 참수 + 분신 3기가 전장을 지배 — 심연 뉴클리어로 마무리",
  },
  blademaster: {
    name: "극의 — 무한 검무",
    desc: "블레이드마스터 전용. 무한 검무 50연타로 전장을 텔레포트하며 점점 빠르게, 한 컷 한 컷 한층 깊게 베어 건너고(연타 화력 강화 — 시작 0.1초→마지막 0.02초), 정점에서 교차하는 쌍검 극의 일격으로 종결한다 — 붉은 死 기운이 검무를 따라든다",
  },

  /* ══════════════════════════════════════════════════════════════════════════
   * vc194 — 17직업 전용 궁극기 (docs/ULTIMATE_DESIGN.md 설계서 기준)
   *
   *  종전엔 30직업이 13종을 공유했다(최대 6직업이 한 궁극기를 공유).
   *  각 직업의 전투 구조가 실제로 달라지도록 '판정 형태'를 분리했다:
   *   단일집중 / 전방관통 / 지면장악 / 연쇄도약 / 광역지속 / 소환 / 무적기습 …
   * ══════════════════════════════════════════════════════════════════════════ */

  /* ── 전사 (묵직·지면장악·통제) ── */
  berserker: {
    name: "광란 — 백절불굴",
    desc: "버서커 전용. 잃은 체력에 비례해 연격이 늘어난다(최대 12연격) — 체력이 낮을수록 더 사납게 베어내는 역설 구조. 종결 시 핏빛 폭류가 지면을 갈라놓는다",
  },
  guardian: {
    name: "철벽 — 천년 방패",
    desc: "가디언 전용. 거대한 보호막 성역을 세워 성역 안의 적을 계속 밀어낸다 — 피해보다 지면 통제에 특화. 성역이 굳는 순간 적들은 파도처럼 밀려난다",
  },
  warlord: {
    name: "군림 — 대지 분쇄",
    desc: "워로드 전용. 전방으로 3연 도약 강타, 착지마다 십자 균열이 남아 그 위 적을 지속 경직시킨다 — 세 번의 착지로 균열이 완성된다",
  },
  paladin: {
    name: "성역 — 심판의 빛",
    desc: "팔라딘 전용. 하늘에서 빛기둥 9개가 예고 후 순차 낙하한다 — 적은 정화되고 자신은 회복되는 양면 구조. 마지막에 성검이 강림한다",
  },

  /* ── 궁수 (정밀·관통·연쇄) ── */
  sniper: {
    name: "일격 — 천리 관통",
    desc: "스나이퍼 전용. 3초 조준 후 단 한 발 — 방어력을 완전히 무시하고 확정 크리티컬로 관통한다. 단일 대상 집중형이라 보스에 압도적이다",
  },
  windrunner: {
    name: "질풍 — 무한 궤적",
    desc: "윈드러너 전용. 시전 중에도 이동할 수 있고, 지나간 경로에 화살이 남아 뒤따라오는 적을 재타격한다 — 이동형 궁극기",
  },
  eagleeye: {
    name: "천안 — 표적 소거",
    desc: "이글아이 전용. 화면 내 모든 적의 머리에 표식을 찍고 동시다발 저격을 퍼붓는다 — 분산형 광역 저격",
  },
  tempest: {
    name: "폭풍 — 연쇄 낙뢰",
    desc: "템페스트 전용. 하나의 번개가 적에서 적으로 최대 12회 도약한다 — 밀집 대형에 극도로 강한 연쇄형",
  },
  stormbringer: {
    name: "뇌신 — 천공 붕괴",
    desc: "스톰브링어 전용. 하늘을 뇌운으로 덮고 4초간 무작위 낙뢰를 쏟아부은 뒤 종결 뇌격으로 마무리한다 — 지역 전체를 태우는 광역 지속형",
  },

  /* ── 마법 (발광·시간·기록) ── */
  archmage: {
    name: "종막 — 아르카나 대폭발",
    desc: "아크메이지 전용. 운석 8발이 궤적을 남기며 낙하하고 원소 종막 폭발로 수렴한다 — 피해량 최상위 광역 마법",
  },
  sage: {
    name: "현자 — 시간 정지",
    desc: "세이지 전용. 적 전체를 시간 정지로 얼린 뒤 자유롭게 공격하고, 해제 순간 누적 피해가 한 번에 폭발한다 — 시간을 다루는 유일한 궁극기",
  },
  chronicle: {
    name: "기록 — 세계 재기록",
    desc: "크로니클 전용. 최근 3초간 입힌 피해를 다시 한 번 재적용한다 — 페이지가 넘어가듯 화면이 쓸리며 딜 타임라인이 두 번 울린다",
  },

  /* ── 도적 (기습·연격·처형) ── */
  assassin: {
    name: "암살 — 그림자 참수",
    desc: "어쌔신 전용. HP 30% 이하 적을 즉사시킨다(보스 제외) — 처형 특화. 적 등 뒤에서 칼날이 번뜩이고 그림자만 남는다",
  },
  swashbuckler: {
    name: "쾌검 — 난무",
    desc: "스워시버클러 전용. 1.5초간 18연격하며 매 타격마다 위치를 옮긴다 — 전방위 난무형",
  },
  nightblade: {
    name: "야인 — 소리 없는 칼날",
    desc: "나이트블레이드 전용. 시전 중 무적 상태로 사라졌다가 적 등 뒤에서 나타나며 첫 타격에 3배 피해를 준다 — 무적 기습형",
  },
  duelist: {
    name: "결투 — 일검 승부",
    desc: "듀얼리스트 전용. 가장 가까운 적 하나와 1대1 결투를 벌여 그 적에게만 6배 피해를 준다 — 단일 결투형",
  },

  /* ── 해적 (포격·소환·해일) ── */
  raider: {
    name: "약탈 — 화염 약탈",
    desc: "레이더 전용. 불길이 지면을 타고 퍼져나가며 지속 피해 장판을 남긴다 — 확산형 화염",
  },
  corsair: {
    name: "해적왕 — 함포 일제사격",
    desc: "코르세어 전용. 16방향으로 포탄이 동시 발사된다 — 방사형 포격. 배경에 함선 실루엣이 나타나 일제히 발포한다",
  },
  stormcaptain: {
    name: "폭풍선장 — 뇌운 항해",
    desc: "스톰캡틴 전용. 뇌운을 뚫고 범선이 화면을 가로지르며 지나간 자리에 폭뢰를 남긴다 — 소환형",
  },
  powdermaster: {
    name: "화약 — 대폭연",
    desc: "파우더마스터 전용. 설치된 화약이 0.2초 간격으로 10회 순차 폭발한다 — 연쇄 폭발형",
  },
  seaking: {
    name: "해왕 — 대해일",
    desc: "시킹 전용. 화면 한쪽에서 거대 해일이 밀려와 전장을 쓸고 지나간다 — 최대 범위 해일형",
  },
  dreadnought: {
    name: "공포 — 종말 포격",
    desc: "드레드노트 전용. 하늘이 갈라지며 거대 포신이 드러나고 궤도 포격이 낙하해 3단 폭발과 방사형 충격파를 일으킨다 — 최대 화력 포격형",
  },
};

/** v3.3.0 — 5차 궁극기 종류 승계: 4차 세부직업이면 고유 궁극기, 아니면 계열 폴백
 *  vc194 — 전 직업 고유화: 30직업 전부 자기 키를 갖도록 목록을 전 직업으로 확장.
 *   (종전 8개만 등재 → 나머지는 계열 폴백으로 뭉쳐 stormbringer=mage 같은 불일치 발생) */
const TIER4_ULTIMATES: readonly string[] = [
  /* 기존 8종 */
  "warbringer", "crusader", "deadeye", "skylord", "arclord", "eternal", "shadowlord", "blademaster",
  /* vc194 신규 22종 — 1~3차 직업까지 포함해 30직업 1:1 매핑 */
  "berserker", "guardian", "warlord", "paladin",
  "sniper", "windrunner", "eagleeye", "tempest", "stormbringer",
  "archmage", "sage", "chronicle",
  "assassin", "swashbuckler", "nightblade", "duelist",
  "raider", "corsair", "stormcaptain", "powdermaster", "seaking", "dreadnought",
];
export function resolveSkill5Of(key?: string | null): Skill5Key {
  const chain = chainOf(key);
  /* vc194 — 전 직업 고유화.
   *  종전 조건은 `chain.length >= 4` 라서 **4차 직업만** 고유 궁극기를 받았다.
   *  그래서 1~3차 직업(sniper·sage·assassin·raider 등)은 계열 폴백으로 뭉쳤다.
   *  이제 TIER4_ULTIMATES 에 전 직업이 등재돼 있으므로, 체인 길이와 무관하게
   *  **현재 직업 키가 목록에 있으면 그 키를 그대로** 궁극기 키로 쓴다.
   *  (계열 폴백은 목록에 없는 무직·미구현 키에만 남는다) */
  if (key && TIER4_ULTIMATES.includes(key)) return key as Skill5Key;
  if (chain.length >= 4) {
    const leaf = chain[chain.length - 1].key;
    if (TIER4_ULTIMATES.includes(leaf)) return leaf as Skill5Key;
  }
  return familyOf(key) ?? "warrior";
}

/* vc146 (#2) — 5차 제2궁극기 (유저 지시: "5차전직 2번째 스킬(2번째 궁극기 = 쿨타임 2분 —
 *  2분이라는 긴 시간에 맞는 엄청난 스킬)"). 1차 궁극기(SKILL5_INFO·60초)와 전부 겹치지 않는
 *  12종(계열 폴백 4 + 4차 세부직업 전용 8). 쿨타임 120초 고정(cdMult 미적용) · MP 150. */
export type Skill5BKey = Skill5Key;
export const SKILL5B_INFO: Record<Skill5BKey, { name: string; desc: string }> = {
  /* ── 계열 폴백 (1~3차에서 5차 해금 시) ──
   *  vc183 — 극딜 설계 문서 기준으로 계열 폴백을 재정의했다. 문서의 10계열 중
   *  각 계열 대표 1종을 폴백으로 삼는다(전사=광전사·궁수=저격수·마법사=원소대마도사·
   *  도적=그림자암살자·해적=중포격수). 4차 전용 궁극기는 아래에서 개별 정의. */
  warrior: {
    name: "멸체마참: 진·핏빛 사선",
    desc: "체력을 태워 최종 피해를 증폭한다 — 전방 360도 검기가 0.1초 간격으로 지면을 베어내고, 종료 시 지면이 십자로 파열하며 거대한 핏빛 기둥이 폭발한다 (10초·6m·자해 연동 증폭)",
  },
  ranger: {
    name: "시공관통: 궤적탄",
    desc: "3초 차징으로 적 방어를 무시하는 에너지를 축적한 뒤, 화면 전방을 완전히 관통하는 시안 레이저를 발사한다. 궤적선은 지면에 잔상으로 남아 지속 다단히트 (5초·폭3m×길이25m·방어력 무시)",
  },
  mage: {
    name: "원소 붕괴: 초신성",
    desc: "화염 구체와 빙결 구체가 중앙으로 회전·수축한 뒤 복합 초신성으로 폭발한다 — 범위 내 적은 빙결과 화염 지속 피해를 동시에 받는다 (4초·10m)",
  },
  pirate: {
    name: "총력 포격: 레드 헤일",
    desc: "화면 전체에 붉은 격자 락온이 뜬 뒤 대구경 함포가 무차별 낙하해 검은 연기와 화염으로 전장을 덮는다 (8초·화면 전체·연막 내 치명타 증가)",
  },
  thief: {
    name: "무영신겁: 나선난무",
    desc: "자취를 감춘 뒤 보스를 중심으로 8방향 분신이 초고속 교차 돌진한다 — 보랏빛 단검 궤적이 화면을 그물처럼 덮고 시전 중 무적 (3초·화면 전체)",
  },
  /* ── 4차 세부직업 8종 전용 — 문서 10계열을 leaf 직업에 1:1 대응 ── */
  warbringer: {
    name: "멸체마참: 진·핏빛 사선",
    desc: "광전사 계열 최종형. 체력을 태울수록 최종 피해가 증폭되고, 전방 360도 검기가 0.1초 간격으로 지면을 베어낸 뒤 십자 파열과 핏빛 기둥 폭발로 종결한다 (10초·6m)",
  },
  crusader: {
    name: "성령의 망치: 주정",
    desc: "성기사 계열 최종형. 공중에 차원의 문이 열려 거대한 황금 망치가 낙하하고, 충격파가 범위 내 적을 기절시킨다. 지면에 남은 신성 지대는 지속 피해와 함께 아군 방어를 올린다 (8초·8m)",
  },
  deadeye: {
    name: "시공관통: 궤적탄",
    desc: "저격수 계열 최종형. 3초 차징 후 방어력을 완전히 무시하는 시안 레이저가 화면을 관통한다 — 잔상 궤적이 지속 다단히트를 넣는다 (5초·관통 100%)",
  },
  skylord: {
    name: "바람의 환영: 백호난무",
    desc: "환영 궁수 계열 최종형. 지정 지점에 바람 토네이도가 서고, 캐릭터 주변 4방향에서 분신이 에메랄드 유령화살을 전방위 집중 사격한다 — 적 이동속도 70% 감소 (6초·5m)",
  },
  arclord: {
    name: "원소 붕괴: 초신성",
    desc: "원소 대마도사 계열 최종형. 화염·빙결 구체가 수축한 뒤 복합 초신성으로 터지며 광역 빙결과 화염 지속 피해를 남긴다 (4초·10m)",
  },
  eternal: {
    name: "심연의 구속: 흑소멸",
    desc: "암흑 사제 계열 최종형. 보스 위치에 지옥의 문을 열어 행동 불능으로 구속하고, 심연의 손길이 지면에서 솟아 연속 찌르기 후 블랙홀로 수축·소멸한다 (5초·7m·Bind)",
  },
  shadowlord: {
    name: "무영신겁: 나선난무",
    desc: "그림자 암살자 계열 최종형. 8방향 분신이 초고속 교차 돌진하며 보랏빛 궤적 그물을 만들고, 시전 내내 무적이다 (3초·화면 전체)",
  },
  blademaster: {
    name: "절멸의 체인 쾌검",
    desc: "사슬 검사 계열 최종형. 가시 사슬을 양손으로 잡고 광범위 회전 난무 — 사슬 끝에서 마찰 스파크와 혈랑이 치솟으며 심각한 중첩 출혈을 남긴다 (7초·5.5m)",
  },

  /* ══════════════════════════════════════════════════════════════════════════
   * vc194 — 17직업 제2궁극기 (쿨 120초 · MP 150).
   *  1차 궁극기(SKILL5_INFO)와 **이름·구조가 겹치지 않게** 별개로 설계했다.
   *  1차가 "직업 정체성의 정점"이라면, 2차는 "전장을 바꾸는 사건"에 가깝다.
   * ══════════════════════════════════════════════════════════════════════════ */

  /* ── 전사 ── */
  berserker: {
    name: "혈전: 최후의 일격",
    desc: "체력이 1이 될 때까지 스스로를 태운다 — 남은 HP를 전부 피해로 환산해 전방을 갈라버리고, 시전 후 5초간 무적·흡혈로 버틴다 (HP 1 고정·3.5초)",
  },
  guardian: {
    name: "불락: 영원의 방벽",
    desc: "아군 전원에게 8초간 피해 무효 방벽을 부여하고 자신은 방벽 안에서 도발한다 — 파티 생존을 책임지는 유일한 수호 궁극기 (8초·아군 전체)",
  },
  warlord: {
    name: "패왕: 천하통일",
    desc: "전장을 세 구역으로 갈라 각 구역에 거병을 소환해 동시에 짓밟는다 — 분할 정복형. 3방향에서 군세가 밀려온다 (6초·화면 3분할)",
  },
  paladin: {
    name: "천형: 최후의 심판",
    desc: "거대한 심판의 저울이 하늘에 나타나 적의 죄를 무게로 달아 피해를 정한다 — 적 HP가 높을수록 더 큰 피해를 주는 역비례 구조 (5초·화면 전체)",
  },

  /* ── 궁수 ── */
  sniper: {
    name: "사선: 사거리 밖",
    desc: "화면 밖에서 저격한다 — 적이 인식하지 못한 채로 12발이 날아와 각기 다른 부위를 관통한다. 발사 지점이 화면에 보이지 않는 유일한 궁극기 (4초·전 맵)",
  },
  windrunner: {
    name: "선풍: 바람의 기억",
    desc: "지금까지 지나온 이동 경로를 따라 바람 화살이 되돌아온다 — 플레이어가 얼마나 움직였는지가 피해량이 되는 이동 연동형 (5초·경로 전체)",
  },
  eagleeye: {
    name: "천리안: 세계 조준",
    desc: "화면 전체를 조준경으로 전환해 적을 하나씩 탭하면 그 지점에 저격이 떨어진다 — 수동 지정형. 최대 8개 지점 동시 폭격 (6초·수동 조준)",
  },
  tempest: {
    name: "풍신: 대순환",
    desc: "거대한 회오리 3개가 전장을 순환하며 적을 빨아들여 중앙에 모은 뒤 한 번에 터뜨린다 — 집결형 (6초·3순환)",
  },
  stormbringer: {
    name: "뇌왕: 세계수의 뇌격",
    desc: "세계수의 뿌리를 타고 번개가 솟아올라 하늘과 땅을 잇는 기둥이 된다 — 수직형 낙뢰. 기둥에 닿은 적은 계속 감전된다 (7초·수직 기둥)",
  },

  /* ── 마법 ── */
  archmage: {
    name: "창세: 원소 대순환",
    desc: "불·얼음·번개·대지 네 원소가 순차적으로 전장을 덮고, 마지막에 네 원소가 융합해 단일 폭발을 일으킨다 — 4단 속성 순환형 (8초·4속성)",
  },
  sage: {
    name: "무한: 영겁의 서고",
    desc: "지금까지 사용한 모든 스킬을 역순으로 한 번씩 재발동한다 — 기록 재생형. 플레이 이력이 곧 궁극기가 된다 (9초·스킬 이력 연동)",
  },
  chronicle: {
    name: "완결: 마지막 페이지",
    desc: "전장의 모든 피해 기록을 펼쳐 보여주고, 그 총합의 절반을 모든 적에게 재분배한다 — 누적 피해 분배형 (6초·전 피해 집계)",
  },

  /* ── 도적 ── */
  assassin: {
    name: "그림자: 존재 말소",
    desc: "대상 하나의 존재를 지운다 — 3초간 그림자로 스며들어 완전 무적, 해제 시 대상 최대 HP의 40%를 관통 피해로 준다 (보스 20%) (4초·단일 말소)",
  },
  swashbuckler: {
    name: "무쌍: 백인 참격",
    desc: "100번의 참격을 1.5초에 압축한다 — 매 참격이 개별 판정이고 마지막 한 번은 8배 피해. 화면에 참격 잔상이 겹겹이 남는다 (1.5초·100연격)",
  },
  nightblade: {
    name: "무음: 침묵의 장막",
    desc: "전장에 소리 없는 장막을 드리워 적의 인식을 차단하고, 장막 안에서 매번 다른 각도로 기습한다 — 은신 지속형. 장막이 걷히면 피해가 한꺼번에 표시된다 (7초·은신)",
  },
  duelist: {
    name: "명예: 최후의 결투",
    desc: "전장의 모든 적을 배제하고 가장 강한 적 하나와만 1대1 공간으로 끌고 간다 — 결투 공간형. 그 적을 쓰러뜨리면 남은 적 전원에 공포를 건다 (8초·1대1)",
  },

  /* ── 해적 ── */
  raider: {
    name: "약탈왕: 불타는 항로",
    desc: "지면에 불길 항로를 그어 적을 한 줄로 유인하고 그 위를 달리며 전부 베어낸다 — 유인·돌파형 (6초·직선 항로)",
  },
  corsair: {
    name: "함대: 전 함포 발포",
    desc: "바다 위 함대 6척을 소환해 화면을 향해 일제 사격한다 — 함대 소환형. 6방향에서 포탄이 교차한다 (7초·6척)",
  },
  stormcaptain: {
    name: "항해: 폭풍의 눈",
    desc: "폭풍의 눈을 소환해 그 중심에 서면 무적이며, 눈이 이동하며 지나간 자리의 적을 전부 휩쓸어 간다 — 이동 무적형 (8초·이동)",
  },
  powdermaster: {
    name: "점화: 연쇄 폭연",
    desc: "전장 곳곳에 화약을 설치한 뒤 한 번에 점화한다 — 설치형. 24개 지점이 연쇄 폭발하고 마지막에 거대 화염 기둥이 솟는다 (5초·24연쇄)",
  },
  seaking: {
    name: "해신: 침묵의 심연",
    desc: "전장을 물로 채워 적을 가라앉힌다 — 수몰형. 물속에서 적 이동속도 절반, 6초 후 물이 빠지며 수압 피해가 일괄 적용된다 (6초·수몰)",
  },
  dreadnought: {
    name: "종말: 최후의 포성",
    desc: "화면 전체를 조준선으로 덮고 12발의 초대형 포탄을 순차 낙하시킨다 — 최종 포격형. 마지막 한 발은 화면 절반을 지운다 (9초·12발)",
  },
};

/* v3.3.0 (지시 #1 — "5차에서도 스킬들 다 강화 되어야지!!"):
 *  5차 각성 시 스킬 1~4 전체가 강화된다.
 *  · 강화 수단: Player.sTier가 5를 반환 (기존 tier 0~4 배율 사다리가 +1칸 연장)
 *    → 모든 스킬 공식의 계수/타수/반경이 5차 기준으로 상향
 *  · 추가: 스킬 피해 +12% (FIFTH_SKILL_MULT), 쿨타임 -15% (FIFTH_CD_MULT)
 *  · 스킬 이름 뒤에 "·극" 접미어 (Player 이름 getter에서 처리) */
export const FIFTH_SKILL_MULT = 1.12;
export const FIFTH_CD_MULT = 0.85;
/** 5차 각성 요구 레벨 (1차 궁극기 해금 레벨) */
export const FIFTH_LEVEL = 200;
/* vc147 (#18) — 궁극기 고정 피해 배율 (유저 지시 "5차 1번째 스킬은 데미지 300% 배율, 2번쨰는 500% 배율"):
 *  1차 궁극기(SKILL5_INFO)는 ×300%, 제2궁극기(SKILL5B_INFO)는 ×500%.
 *  궁극기 시전 중 rollDamage는 이 배율 하나로 계산된다 (기존 n차 사다리×SKILL_PWR×FIFTH_SKILL_MULT
 *  중복 적용을 대체 — 요구치 그대로 3.0배/5.0배가 되도록 단일 배율로 승화). */
export const FIFTH1_MULT = 3.0;
export const FIFTH2_MULT = 5.0;

/** HUD 표기용 — "전사 · 검사" / 2차 이상 "버서커" */
export function classLabel(key?: string | null): string {
  const chain = chainOf(key);
  if (chain.length === 0) return "";
  if (chain.length === 1) return `${chain[0].name} · ${chain[0].title}`;
  return `${chain[chain.length - 1].name}`;
}
