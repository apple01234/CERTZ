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

export type Tier = 1 | 2 | 3 | 4;
export type FamilyKey = "warrior" | "ranger" | "mage" | "thief";
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
  | "shadowlord" | "blademaster"; /* 도적 4차 */

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
  desc: string;
};

/* ================= 1차 — 계열 선택 (Lv10, v1.7 수치 그대로 유지) ================= */

const WARRIOR: ClassDef = {
  key: "warrior", tier: 1, parent: null,
  name: "전사", title: "검사",
  color: "#ff9a8a", hex: 0xff9a8a,
  atkPct: 18, critAdd: 0, defAdd: 0, hpAdd: 120, mpAdd: 0, speedPct: 0,
  cdMult: 1, skillMult: 1,
  desc: "끈질긴 생명력과 무모한 화력. 앞에 서는 자의 길.",
};
const RANGER: ClassDef = {
  key: "ranger", tier: 1, parent: null,
  name: "궁수", title: "궁도",
  color: "#7dffa8", hex: 0x7dffa8,
  atkPct: 8, critAdd: 12, defAdd: 0, hpAdd: 60, mpAdd: 20, speedPct: 15,
  cdMult: 1, skillMult: 1,
  desc: "치명타와 기동성의 대가. 붓처럼 지도를 달린다.",
};
const MAGE: ClassDef = {
  key: "mage", tier: 1, parent: null,
  name: "마법사", title: "주술사",
  color: "#a5b9ff", hex: 0xa5b9ff,
  atkPct: 30, critAdd: 4, defAdd: 0, hpAdd: 30, mpAdd: 60, speedPct: 0,
  cdMult: 1, skillMult: 1,
  desc: "세계의 마나를 화력으로 바꾼다. 유리 대포. — \"마법은 지혜가 곧 힘이다.\"",
};
/* v2.9 (사용자 지시 #9) — 4번째 계열 도적 추가: 빠른 연타와 치명타 특화 */
const THIEF: ClassDef = {
  key: "thief", tier: 1, parent: null,
  name: "도적", title: "그림자 검객",
  color: "#e8c0ff", hex: 0xe8c0ff,
  atkPct: 10, critAdd: 16, defAdd: 0, hpAdd: 70, mpAdd: 20, speedPct: 20,
  cdMult: 0.9, skillMult: 1,
  desc: "그림자처럼 다가와 단검으로 목을 후린다. 치명타와 회피의 달인. — \"보물은 스스로 걸어온다. 내가 훔칠 뿐.\"",
};

/* ================= 2차 — 세부 직업 선택 (Lv30, 계열별 2종) ================= */

const BERSERKER: ClassDef = {
  key: "berserker", tier: 2, parent: "warrior",
  name: "버서커", title: "광전사",
  color: "#ff7a5c", hex: 0xff7a5c,
  atkPct: 18, critAdd: 6, defAdd: 0, hpAdd: 80, mpAdd: 0, speedPct: 0,
  cdMult: 1, skillMult: 1.05,
  desc: "공격에 공격을 더한다. 방어는 사치.",
};
const GUARDIAN: ClassDef = {
  key: "guardian", tier: 2, parent: "warrior",
  name: "가디언", title: "수호자",
  color: "#ffb08a", hex: 0xffb08a,
  atkPct: 6, critAdd: 0, defAdd: 8, hpAdd: 160, mpAdd: 0, speedPct: 5,
  cdMult: 1, skillMult: 1,
  desc: "아군의 방패. 무너지지 않는 성벽.",
};
const SNIPER: ClassDef = {
  key: "sniper", tier: 2, parent: "ranger",
  name: "스나이퍼", title: "매의 눈",
  color: "#5cff8f", hex: 0x5cff8f,
  atkPct: 10, critAdd: 18, defAdd: 0, hpAdd: 40, mpAdd: 0, speedPct: 0,
  cdMult: 1, skillMult: 1.05,
  desc: "한 발로 끝낸다. 치명타의 신.",
};
const WINDRUNNER: ClassDef = {
  key: "windrunner", tier: 2, parent: "ranger",
  name: "윈드러너", title: "질풍",
  color: "#9dffc4", hex: 0x9dffc4,
  atkPct: 6, critAdd: 6, defAdd: 0, hpAdd: 60, mpAdd: 20, speedPct: 10,
  cdMult: 0.9, skillMult: 1,
  desc: "바람보다 빠른 연사와 기동.",
};
const ARCHMAGE: ClassDef = {
  key: "archmage", tier: 2, parent: "mage",
  name: "아크메이지", title: "대마법사",
  color: "#8fa6ff", hex: 0x8fa6ff,
  atkPct: 22, critAdd: 0, defAdd: 0, hpAdd: 20, mpAdd: 40, speedPct: 0,
  cdMult: 1, skillMult: 1.15,
  desc: "한 방의 화력을 세계 끝까지.",
};
const SAGE: ClassDef = {
  key: "sage", tier: 2, parent: "mage",
  name: "세이지", title: "현자",
  color: "#c3cfff", hex: 0xc3cfff,
  atkPct: 10, critAdd: 4, defAdd: 3, hpAdd: 60, mpAdd: 80, speedPct: 0,
  cdMult: 0.85, skillMult: 1,
  desc: "무한 마나와 짧은 회전. 지혜의 전투.",
};

/* ================= 3차 — 승격 (Lv50, 2차 경로 자동 이어짐) ================= */

const WARLORD: ClassDef = {
  key: "warlord", tier: 3, parent: "berserker",
  name: "워로드", title: "전장의 지배자",
  color: "#ff5c3c", hex: 0xff5c3c,
  atkPct: 20, critAdd: 8, defAdd: 0, hpAdd: 100, mpAdd: 0, speedPct: 5,
  cdMult: 1, skillMult: 1.1,
  desc: "전장 그 자체가 무기. 최전선의 절대자.",
};
const PALADIN: ClassDef = {
  key: "paladin", tier: 3, parent: "guardian",
  name: "팔라딘", title: "성기사",
  color: "#ffd29a", hex: 0xffd29a,
  atkPct: 8, critAdd: 4, defAdd: 12, hpAdd: 200, mpAdd: 20, speedPct: 5,
  cdMult: 1, skillMult: 1,
  desc: "빛의 맹세로 서는 자. 불굴의 성벽.",
};
const EAGLEEYE: ClassDef = {
  key: "eagleeye", tier: 3, parent: "sniper",
  name: "이글아이", title: "절대 명중",
  color: "#3cff7a", hex: 0x3cff7a,
  atkPct: 12, critAdd: 20, defAdd: 0, hpAdd: 60, mpAdd: 20, speedPct: 5,
  cdMult: 0.95, skillMult: 1.1,
  desc: "매는 두 번 쏘지 않는다.",
};
const TEMPEST: ClassDef = {
  key: "tempest", tier: 3, parent: "windrunner",
  name: "템페스트", title: "폭풍의 화신",
  color: "#b9ffe0", hex: 0xb9ffe0,
  atkPct: 8, critAdd: 8, defAdd: 0, hpAdd: 80, mpAdd: 40, speedPct: 10,
  cdMult: 0.85, skillMult: 1.05,
  desc: "폭풍처럼 몰아치는 화망.",
};
const STORMBRINGER: ClassDef = {
  key: "stormbringer", tier: 3, parent: "archmage",
  name: "스톰브링어", title: "폭풍소환자",
  color: "#6f8cff", hex: 0x6f8cff,
  atkPct: 25, critAdd: 4, defAdd: 0, hpAdd: 40, mpAdd: 50, speedPct: 0,
  cdMult: 0.95, skillMult: 1.2,
  desc: "하늘의 분노를 부리는 종단의 마법사.",
};
const CHRONICLE: ClassDef = {
  key: "chronicle", tier: 3, parent: "sage",
  name: "크로니컬", title: "서사의 기록자",
  color: "#e2e8ff", hex: 0xe2e8ff,
  atkPct: 12, critAdd: 6, defAdd: 6, hpAdd: 100, mpAdd: 100, speedPct: 5,
  cdMult: 0.8, skillMult: 1.05,
  desc: "모든 마법의 순환을 통괄하는 현자의 정점.",
};

/* ================= 도적 2차/3차 (v2.9) ================= */

const ASSASSIN: ClassDef = {
  key: "assassin", tier: 2, parent: "thief",
  name: "어세신", title: "암살자",
  color: "#d89aff", hex: 0xd89aff,
  atkPct: 14, critAdd: 14, defAdd: 0, hpAdd: 40, mpAdd: 10, speedPct: 10,
  cdMult: 0.85, skillMult: 1.1,
  desc: "한 방의 치명타. 그림자 속의 죽음.",
};
const SWASHBUCKLER: ClassDef = {
  key: "swashbuckler", tier: 2, parent: "thief",
  name: "스와시버클러", title: "검객",
  color: "#f0c8ff", hex: 0xf0c8ff,
  atkPct: 12, critAdd: 8, defAdd: 4, hpAdd: 90, mpAdd: 20, speedPct: 10,
  cdMult: 0.9, skillMult: 1,
  desc: "화려한 연타로 적을 농락한다. 바다의 검객.",
};
const NIGHTBLADE: ClassDef = {
  key: "nightblade", tier: 3, parent: "assassin",
  name: "나이트블레이드", title: "야경의 칼날",
  color: "#c08aff", hex: 0xc08aff,
  atkPct: 18, critAdd: 16, defAdd: 0, hpAdd: 60, mpAdd: 30, speedPct: 10,
  cdMult: 0.8, skillMult: 1.15,
  desc: "어둠이 곧 무기. 베이고 나서 보이지 않는다.",
};
const DUELIST: ClassDef = {
  key: "duelist", tier: 3, parent: "swashbuckler",
  name: "듀얼리스트", title: "결투의 정점",
  color: "#ffd8ff", hex: 0xffd8ff,
  atkPct: 16, critAdd: 10, defAdd: 6, hpAdd: 120, mpAdd: 30, speedPct: 10,
  cdMult: 0.85, skillMult: 1.1,
  desc: "일대일 결투에서 무적. 쌍단검의 화신.",
};

/* ================= 4차 — 각성 (Lv100, 사용자 지시 #9) ================= */

const WARBRINGER: ClassDef = {
  key: "warbringer", tier: 4, parent: "warlord",
  name: "워브링어", title: "전쟁의 화신",
  color: "#ff3c1c", hex: 0xff3c1c,
  atkPct: 30, critAdd: 10, defAdd: 5, hpAdd: 300, mpAdd: 0, speedPct: 5,
  cdMult: 0.9, skillMult: 1.25,
  desc: "전쟁 그 자체. 세계를 가르는 일격.",
};
const CRUSADER: ClassDef = {
  key: "crusader", tier: 4, parent: "paladin",
  name: "크루세이더", title: "심판의 빛",
  color: "#ffe29a", hex: 0xffe29a,
  atkPct: 15, critAdd: 8, defAdd: 20, hpAdd: 400, mpAdd: 40, speedPct: 5,
  cdMult: 0.9, skillMult: 1.15,
  desc: "불굴의 성벽이 심판의 검을 든다.",
};
const DEADEYE: ClassDef = {
  key: "deadeye", tier: 4, parent: "eagleeye",
  name: "데드아이", title: "신의 시선",
  color: "#1cff5c", hex: 0x1cff5c,
  atkPct: 20, critAdd: 30, defAdd: 0, hpAdd: 120, mpAdd: 40, speedPct: 10,
  cdMult: 0.85, skillMult: 1.25,
  desc: "모든 화살은 신의 심판이 된다.",
};
const SKYLORD: ClassDef = {
  key: "skylord", tier: 4, parent: "tempest",
  name: "스카이로드", title: "하늘의 지배자",
  color: "#ccffe8", hex: 0xccffe8,
  atkPct: 15, critAdd: 12, defAdd: 0, hpAdd: 160, mpAdd: 80, speedPct: 20,
  cdMult: 0.75, skillMult: 1.2,
  desc: "바람이 그의 명령을 기다린다.",
};
const ARCLORD: ClassDef = {
  key: "arclord", tier: 4, parent: "stormbringer",
  name: "아크로드", title: "마나의 절대자",
  color: "#5c7cff", hex: 0x5c7cff,
  atkPct: 35, critAdd: 8, defAdd: 0, hpAdd: 100, mpAdd: 120, speedPct: 0,
  cdMult: 0.85, skillMult: 1.35,
  desc: "한 발의 마법이 지평선을 지운다.",
};
const ETERNAL: ClassDef = {
  key: "eternal", tier: 4, parent: "chronicle",
  name: "이터널", title: "시간을 초월한 자",
  color: "#ffffff", hex: 0xffffff,
  atkPct: 18, critAdd: 10, defAdd: 10, hpAdd: 220, mpAdd: 200, speedPct: 10,
  cdMult: 0.7, skillMult: 1.2,
  desc: "모든 마법이 그의 이름 앞에 무릎 꿇는다.",
};
const SHADOWLORD: ClassDef = {
  key: "shadowlord", tier: 4, parent: "nightblade",
  name: "섀도우로드", title: "그림자 군주",
  color: "#a86aff", hex: 0xa86aff,
  atkPct: 25, critAdd: 25, defAdd: 0, hpAdd: 150, mpAdd: 60, speedPct: 15,
  cdMult: 0.7, skillMult: 1.3,
  desc: "그림자가 그를 따라 세계를 덮는다.",
};
const BLADEMASTER: ClassDef = {
  key: "blademaster", tier: 4, parent: "duelist",
  name: "블레이드마스터", title: "검의 극한",
  color: "#ffaaff", hex: 0xffaaff,
  atkPct: 22, critAdd: 18, defAdd: 8, hpAdd: 220, mpAdd: 60, speedPct: 15,
  cdMult: 0.75, skillMult: 1.25,
  desc: "단검 두 자루로 신을 벤다.",
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
};

/** 1차 계열 4종 (초기 전직 선택지 — v2.9 도적 추가) */
export const CLASS_LIST: ClassDef[] = [WARRIOR, RANGER, MAGE, THIEF];

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

export type ClassBonus = {
  atkPct: number;
  critAdd: number;
  defAdd: number;
  hpAdd: number;
  mpAdd: number;
  speedPct: number;
  cdMult: number;
  skillMult: number;
};

/** 경로 누적 보너스 — 합산은 합, 배율은 곱 */
export function bonusOf(key?: string | null): ClassBonus {
  const acc: ClassBonus = {
    atkPct: 0, critAdd: 0, defAdd: 0, hpAdd: 0, mpAdd: 0, speedPct: 0,
    cdMult: 1, skillMult: 1,
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

/** HUD 표기용 — "전사 · 검사" / 2차 이상 "버서커" */
export function classLabel(key?: string | null): string {
  const chain = chainOf(key);
  if (chain.length === 0) return "";
  if (chain.length === 1) return `${chain[0].name} · ${chain[0].title}`;
  return `${chain[chain.length - 1].name}`;
}
