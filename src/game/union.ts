/**
 * v1.0.18 — 유니온 시스템 (메이플스토리 유니온 재현 — 계정 단위 성장)
 *
 *  · 유니온 레벨   : 레벨 60 이상 캐릭터의 레벨 합산 (slots.ts unionLevelOf)
 *  · 유니온 등급   : 브론즈(500) → … → 별(6000) 11단계, 등급업 시 그리드 확장 + 배치 인원 증가
 *  · 유니온 그리드 : 계열별 폴리오미노 블록(전사/궁수/마법사/도적, 레벨 구간별 크기 상승)을
 *                    드래그앤드롭 배치 + 회전 + 자동 추천 배치
 *  · 지역 효과     : 계열·차지 칸 수 비례 누적 → 전 캐릭터에 즉시 적용 (syncExtBonus에서 합산)
 *  · 유니온 코인   : 유니온 레벨업·일일 보상·레이드 클리어 → 상점(소비템/확장권)/시간제 버프/아티팩트
 *  · 유니온 레이드 : 배치 캐릭터가 AI 파티원으로 참전하는 다단계 보스전 (일 1회, 난이도 3종)
 *  · 유니온 아티팩트: 코인으로 성장시키는 계정 단위 영구 성장 요소 6종
 *
 *  저장: sertz_union_v1 (계정 공유 — 캐릭터 세이브와 분리)
 */
import type { SlotsStore, CharMeta } from "./slots";
import { loadSlots, expandSlots, unionLevelOf, charUnionContribution } from "./slots";

export const UNION_KEY = "sertz_union_v1";

/* ================= 등급 테이블 ================= */

export type UnionGrade = { name: string; need: number; color: string };
/** 브론즈 → 별 11단계 (need = 유니온 레벨 합산 컷)
 *  v1.0.19 (B-2) — 유니온 레벨 공식이 "60까지 100% + 초과분 10레벨당 1"로 바뀌어
 *  1인당 최대 기여 79(·Lv250), 16슬롯 최대 합산 ~1264 → 임계값을 새 스케일에 맞춰 재조정 */
export const UNION_GRADES: UnionGrade[] = [
  { name: "브론즈", need: 0, color: "#c98f5a" },
  { name: "실버", need: 60, color: "#cfd8e3" },
  { name: "골드", need: 140, color: "#ffd76a" },
  { name: "플래티넘", need: 240, color: "#8fe8d8" },
  { name: "마스터", need: 360, color: "#a8ecff" },
  { name: "그랜드마스터", need: 500, color: "#c08aff" },
  { name: "가디언", need: 650, color: "#7aa8ff" },
  { name: "슈프림", need: 800, color: "#ff9d6a" },
  { name: "스카이", need: 950, color: "#9fe8ff" },
  { name: "문", need: 1100, color: "#e8e8ff" },
  { name: "별", need: 1250, color: "#fff3a8" },
];

export function unionGradeOf(level: number): { idx: number; grade: UnionGrade; next: UnionGrade | null; nextNeed: number } {
  let idx = 0;
  for (let i = 0; i < UNION_GRADES.length; i++) {
    if (level >= UNION_GRADES[i].need) idx = i;
  }
  const grade = UNION_GRADES[idx];
  const next = idx + 1 < UNION_GRADES.length ? UNION_GRADES[idx + 1] : null;
  return { idx, grade, next, nextNeed: next ? next.need : grade.need };
}

/* ================= 그리드 규격 ================= */

export const UNION_COLS = 13;
export const UNION_ROWS = 9;
/** 등급별 최대 배치 인원 — 8명에서 등급마다 +1 (최대 18) */
export function maxPlacedOf(gradeIdx: number): number {
  return Math.min(18, 8 + gradeIdx);
}

/* ================= 폴리오미노 (계열 × 레벨 구간) =================
 *  셀 좌표 [c, r] — rot: 0/90/180/270도 회전은 rotateCells로 계산
 *  FamilyKey는 아래 "지역 효과" 섹션에서 선언 (v1.0.19 — 해적 계열 포함 5계열) */

/** 계열별 기본 블록 — 레벨 구간(60~99 / 100~199 / 200+)마다 크기 상승 */
const SHAPE_TABLE: Record<FamilyKey, [number, number][][]> = {
  /* 전사 — 견고한 2×2 사각 → 십자 확장 */
  warrior: [
    [[0, 0], [1, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
    [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [1, 2]],
  ],
  /* 궁수 — L자 기동형 */
  ranger: [
    [[0, 0], [0, 1], [0, 2], [1, 2]],
    [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2], [1, 1]],
    [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2], [3, 2], [1, 1], [2, 1]],
  ],
  /* 마법사 — I자 마나 기둥 */
  mage: [
    [[0, 0], [0, 1], [0, 2]],
    [[0, 0], [0, 1], [0, 2], [0, 3], [1, 1]],
    [[0, 0], [0, 1], [0, 2], [0, 3], [1, 1], [1, 2], [2, 1]],
  ],
  /* 도적 — S자 그림자 */
  thief: [
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [3, 2]],
    [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [3, 2], [0, 1], [3, 0]],
  ],
  /* v1.0.19 — 해적 계열 (현직 4직업이 없어 실배치 되지 않음 — 폴리오미노 완결성용) */
  pirate: [
    [[0, 0], [1, 0], [1, 1]],
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2]],
  ],
};

export function familyOfChar(meta: CharMeta | undefined): FamilyKey | null {
  const cls = meta?.cls;
  if (!cls) return null;
  if (cls === "warrior") return "warrior";
  if (cls === "ranger") return "ranger";
  if (cls === "mage") return "mage";
  if (cls === "thief") return "thief";
  /* 전직 키도 계열 역산 (2차/3차/4차 키) */
  if (/^(berserker|guardian|warlord|paladin|warbringer|crusader)$/.test(cls)) return "warrior";
  if (/^(sniper|windrunner|eagleeye|tempest|deadeye|skylord)$/.test(cls)) return "ranger";
  if (/^(archmage|sage|stormbringer|chronicle|arclord|eternal)$/.test(cls)) return "mage";
  if (/^(assassin|swashbuckler|nightblade|duelist|shadowlord|blademaster)$/.test(cls)) return "thief";
  return null;
}

/** 캐릭터 레벨 구간 → 폴리오미노 선택 (0: 60~99, 1: 100~199, 2: 200+) */
function shapeBand(lv: number): number {
  if (lv >= 200) return 2;
  if (lv >= 100) return 1;
  return 0;
}

export function shapeOfChar(meta: CharMeta): [number, number][] {
  const fam = familyOfChar(meta) ?? "warrior";
  const band = shapeBand(meta.lv);
  return SHAPE_TABLE[fam][band].map((c) => [...c] as [number, number]);
}

/** 셀 회전 (0/1/2/3 = 0/90/180/270°) — 회전 후 정규화(최소 c/r 0으로) */
export function rotateCells(cells: [number, number][], rot: number): [number, number][] {
  let out = cells.map((c) => [...c] as [number, number]);
  for (let t = ((rot % 4) + 4) % 4; t > 0; t--) {
    out = out.map(([c, r]) => [-r, c] as [number, number]);
  }
  const minC = Math.min(...out.map((x) => x[0]));
  const minR = Math.min(...out.map((x) => x[1]));
  return out.map(([c, r]) => [c - minC, r - minR] as [number, number]);
}

/** 배치된 절대 셀 목록 */
export function placedCells(rot: number, r: number, c: number, cells: [number, number][]): [number, number][] {
  return rotateCells(cells, rot).map(([dc, dr]) => [c + dc, r + dr] as [number, number]);
}

/* ================= 지역 효과 =================
 *
 * v1.0.19 (B-2) — 메이플 지시서 규칙으로 개편:
 *  ① 효과는 "배치된 캐릭터 1명당" 발생 (칸 수 비례 폐지 — 폴리오미노는 연출로 유지)
 *  ② 계열별 효과 분리: 전사=방어력/HP · 궁수=공격력% · 마법사=마력% · 도적=크리확률/크리뎀 · 해적=HP/버프효과
 *  ③ 캐릭터 레벨 구간에 따라 등급 B/A/S/SS가 매겨지고 등급 배율만큼 증폭
 *  ④ 수치는 아래 상수 표 한 곳에서 관리 — 밸런스 조정 용이
 */

export type FamilyKey = "warrior" | "ranger" | "mage" | "thief" | "pirate";

/** 배치 등급 — 캐릭터 레벨 구간별 (메이플 B/A/S/SS) */
export type PlaceGrade = "B" | "A" | "S" | "SS";
export const PLACE_GRADES: { grade: PlaceGrade; minLv: number; mult: number; color: string }[] = [
  { grade: "B", minLv: 60, mult: 1.0, color: "#9fb3d9" },
  { grade: "A", minLv: 100, mult: 1.6, color: "#8fe8d8" },
  { grade: "S", minLv: 150, mult: 2.4, color: "#ffd76a" },
  { grade: "SS", minLv: 200, mult: 3.2, color: "#ff8ab0" },
];

/** 캐릭터 레벨 → 배치 등급 (60 미만은 배치 불가) */
export function placeGradeOf(lv: number): { grade: PlaceGrade; mult: number; color: string } | null {
  if (lv < 60) return null;
  let out = PLACE_GRADES[0];
  for (const g of PLACE_GRADES) if (lv >= g.minLv) out = g;
  return { grade: out.grade, mult: out.mult, color: out.color };
}

/** 계열별 1인당 효과 (B등급 기준 수치 — 상수 한 곳에서 밸런스 조정)
 *  해적 계열은 현직 4직업(전사/궁수/마법사/도적)이 없어 미사용 — 표는 규칙 완결성을 위해 유지 */
export const FAMILY_EFFECTS: Record<FamilyKey, { def: number; hp: number; atkPct: number; crit: number; critDmg: number; buffPct: number; label: string; color: string }> = {
  warrior: { def: 6, hp: 120, atkPct: 0, crit: 0, critDmg: 0, buffPct: 0, label: "전사 계열 — 방어력·HP", color: "#ff9d8a" },
  ranger: { def: 0, hp: 0, atkPct: 1.6, crit: 0, critDmg: 0, buffPct: 0, label: "궁수 계열 — 공격력%", color: "#a8ecff" },
  mage: { def: 0, hp: 0, atkPct: 1.4, crit: 0, critDmg: 0, buffPct: 0, label: "마법사 계열 — 마력%", color: "#c9a8ff" },
  thief: { def: 0, hp: 0, atkPct: 0, crit: 0.9, critDmg: 2.5, buffPct: 0, label: "도적 계열 — 크리확률·크리뎀", color: "#b8ffb8" },
  pirate: { def: 0, hp: 150, atkPct: 0, crit: 0, critDmg: 0, buffPct: 1.5, label: "해적 계열 — HP·버프 효과", color: "#ffd76a" },
};

/* ================= 아티팩트 ================= */

export type ArtifactDef = { key: string; name: string; desc: (lv: number) => string; max: number; cost: (lv: number) => number };
export const ARTIFACTS: ArtifactDef[] = [
  { key: "art_atk", name: "용맹의 문장", desc: (lv) => `공격력 +${lv * 3}`, max: 10, cost: (lv) => 12 + lv * 8 },
  { key: "art_hp", name: "세계수의 가지", desc: (lv) => `최대 HP +${lv * 90}`, max: 10, cost: (lv) => 10 + lv * 7 },
  { key: "art_crit", name: "매의 눈동자", desc: (lv) => `크리티컬 확률 +${(lv * 0.6).toFixed(1)}%p`, max: 10, cost: (lv) => 14 + lv * 9 },
  { key: "art_gold", name: "난쟁이의 지갑", desc: (lv) => `골드 획득량 +${lv * 3}%`, max: 10, cost: (lv) => 12 + lv * 8 },
  { key: "art_def", name: "대지의 방패", desc: (lv) => `방어력 +${lv * 4}`, max: 10, cost: (lv) => 10 + lv * 6 },
  { key: "art_speed", name: "질풍의 깃털", desc: (lv) => `이동속도 +${lv * 0.8}%`, max: 5, cost: (lv) => 18 + lv * 12 },
];

/* ================= 시간제 유니온 버프 ================= */

export type UnionBuffDef = { key: string; name: string; desc: string; minutes: number; cost: number };
export const UNION_BUFFS: UnionBuffDef[] = [
  { key: "ub_atk", name: "유니온 공격 진격", desc: "공격력 +12%", minutes: 30, cost: 8 },
  { key: "ub_gold", name: "유니온 골드 수확", desc: "골드 획득량 +25%", minutes: 30, cost: 6 },
  { key: "ub_def", name: "유니온 방어 결계", desc: "방어력 +25%", minutes: 30, cost: 6 },
  { key: "ub_exp", name: "유니온 훈련 명령", desc: "경험치 획득 +20%", minutes: 60, cost: 12 },
];

/* ================= 레이드 ================= */

export type RaidDiff = 0 | 1 | 2;
export const RAID_DIFFS: { name: string; boss: string; hp: number; coin: number; req: number; color: string }[] = [
  { name: "노말", boss: "수문장 거인 베히모스", hp: 60000, coin: 14, req: 3, color: "#8fe84a" },
  { name: "하드", boss: "심연의 감시자 니드호그", hp: 220000, coin: 30, req: 6, color: "#a8ecff" },
  { name: "카오스", boss: "차원의 군주 아비슬로드", hp: 900000, coin: 64, req: 10, color: "#ff8ab0" },
];

/* ================= 저장소 ================= */

export type Placement = { charId: string; rot: number; r: number; c: number };

export type UnionStore = {
  v: 1;
  coins: number;
  placements: Placement[];
  artifacts: Record<string, number>;
  buffs: { key: string; until: number }[];
  lastDaily: string;
  raidDone: string; // "YYYY-MM-DD|diff" — 금일 레이드 클리어 기록
  seenLv: number;   // 코인 지급용 — 마지막 확인 유니온 레벨
};

const DEFAULT_UNION: UnionStore = { v: 1, coins: 0, placements: [], artifacts: {}, buffs: [], lastDaily: "", raidDone: "", seenLv: 0 };

let cache: UnionStore | null = null;

export function loadUnion(): UnionStore {
  if (cache) return cache;
  if (typeof window === "undefined") return { ...DEFAULT_UNION };
  try {
    const raw = window.localStorage.getItem(UNION_KEY);
    if (raw) {
      const d = JSON.parse(raw) as UnionStore;
      cache = { ...DEFAULT_UNION, ...d, artifacts: { ...(d.artifacts ?? {}) }, buffs: Array.isArray(d.buffs) ? d.buffs : [], placements: Array.isArray(d.placements) ? d.placements : [] };
      return cache;
    }
  } catch {
    /* 파싱 실패 — 기본값 */
  }
  cache = { ...DEFAULT_UNION };
  return cache;
}

export function writeUnion(s: UnionStore) {
  cache = s;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(UNION_KEY, JSON.stringify(s));
  } catch {
    /* 무시 */
  }
}

export function addCoins(n: number) {
  const u = loadUnion();
  u.coins = Math.max(0, u.coins + n);
  writeUnion(u);
}

/* ================= 효과 계산 ================= */

export type UnionEffects = {
  /** 계열별 배치 인원 (v1.0.19 — 칸 수 → 인원 단위 변경) */
  counts: Record<FamilyKey, number>;
  atk: number;
  hp: number;
  def: number;
  crit: number;
  critDmg: number;
  atkPct: number;
  speedPct: number;
  goldPct: number;
  /** 표시용 — 계열 이름 → 효과 요약 */
  lines: { label: string; value: string; color: string }[];
};

export function activeBuffValues(u: UnionStore): { atkPct: number; goldPct: number; defPct: number; expPct: number } {
  const now = Date.now();
  const out = { atkPct: 0, goldPct: 0, defPct: 0, expPct: 0 };
  u.buffs = u.buffs.filter((b) => b.until > now);
  for (const b of u.buffs) {
    if (b.key === "ub_atk") out.atkPct += 12;
    else if (b.key === "ub_gold") out.goldPct += 25;
    else if (b.key === "ub_def") out.defPct += 25;
    else if (b.key === "ub_exp") out.expPct += 20;
  }
  return out;
}

/** 유니온 전체 효과 — 배치 캐릭터 1명당 계열 효과 × 배치 등급(B/A/S/SS) + 유니온 등급 + 아티팩트 합산.
 *  v1.0.19 (B-2) — 칸 수 비례에서 "배치 인원 × 등급 배율" 방식으로 개편 (지시서 B-2 규칙).
 *  시간제 버프는 activeBuffValues로 별도 합산 (WorldScene syncExtBonus). */
export function unionEffects(u: UnionStore, slots: SlotsStore): UnionEffects {
  const counts: Record<FamilyKey, number> = { warrior: 0, ranger: 0, mage: 0, thief: 0, pirate: 0 };
  const eff: UnionEffects = { counts, atk: 0, hp: 0, def: 0, crit: 0, critDmg: 0, atkPct: 0, speedPct: 0, goldPct: 0, lines: [] };
  /* ① 배치 캐릭터 1명당 — 계열 기본 효과 × 레벨 구간 등급 배율 */
  for (const p of u.placements) {
    const meta = slots.chars[p.charId];
    if (!meta) continue;
    const pg = placeGradeOf(meta.lv);
    if (!pg) continue; // 60 미만 배치 불가
    const fam = familyOfChar(meta);
    if (!fam) continue;
    const y = FAMILY_EFFECTS[fam];
    counts[fam] += 1;
    eff.def += y.def * pg.mult;
    eff.hp += y.hp * pg.mult;
    eff.atkPct += y.atkPct * pg.mult;
    eff.crit += y.crit * pg.mult;
    eff.critDmg += y.critDmg * pg.mult;
  }
  /* ② 효과 총람(미리보기) 라인 — 계열별 인원 + 합산 수치 */
  (Object.keys(counts) as FamilyKey[]).forEach((fam) => {
    const n = counts[fam];
    if (n <= 0) return;
    const y = FAMILY_EFFECTS[fam];
    const parts: string[] = [];
    if (y.def) parts.push(`방어력 +${Math.round(y.def * n)}`);
    if (y.hp) parts.push(`HP +${Math.round(y.hp * n)}`);
    if (y.atkPct) parts.push(`${fam === "mage" ? "마력" : "공격력"} +${(y.atkPct * n).toFixed(1)}%`);
    if (y.crit) parts.push(`크리 +${(y.crit * n).toFixed(1)}%p`);
    if (y.critDmg) parts.push(`크리뎀 +${(y.critDmg * n).toFixed(1)}%p`);
    eff.lines.push({ label: y.label, value: `${n}명 · ${parts.join(" · ")}`, color: y.color });
  });
  /* ③ 유니온 등급 보너스 — 등급 idx당 전체 공격력% +0.4 */
  const uLv = unionLevelOf(slots);
  const { idx } = unionGradeOf(uLv);
  eff.atkPct += idx * 0.4;
  /* ④ 아티팩트 */
  const art = u.artifacts;
  eff.atk += (art.art_atk ?? 0) * 3;
  eff.hp += (art.art_hp ?? 0) * 90;
  eff.crit += (art.art_crit ?? 0) * 0.6;
  eff.goldPct += (art.art_gold ?? 0) * 3;
  eff.def += (art.art_def ?? 0) * 4;
  eff.speedPct += (art.art_speed ?? 0) * 0.8;
  return eff;
}

/** 레이드 전투력 — 배치 캐릭터 기여 레벨 합 × 계열 계수 (v1.0.19 — 기여 레벨 공식 적용) */
export function raidPower(u: UnionStore, slots: SlotsStore): { power: number; allies: { name: string; fam: FamilyKey | null; lv: number; color: string }[] } {
  const FAM_MULT: Record<FamilyKey, number> = { warrior: 1.15, ranger: 1.1, mage: 1.1, thief: 1.0, pirate: 1.05 };
  let power = 0;
  const allies: { name: string; fam: FamilyKey | null; lv: number; color: string }[] = [];
  for (const p of u.placements) {
    const meta = slots.chars[p.charId];
    if (!meta || meta.lv < 60) continue;
    const fam = familyOfChar(meta);
    power += charUnionContribution(meta.lv) * (fam ? FAM_MULT[fam] : 1);
    allies.push({ name: meta.name, fam, lv: meta.lv, color: meta.cls === "warrior" ? "#ff9d8a" : meta.cls === "ranger" ? "#a8ecff" : meta.cls === "mage" ? "#c9a8ff" : "#b8ffb8" });
  }
  return { power: Math.round(power), allies };
}

/** 그리드 점유 맵 — 배치 가능 여부 검사 */
export function occupancy(u: UnionStore, slots: SlotsStore): Map<string, string> {
  const map = new Map<string, string>();
  for (const p of u.placements) {
    const meta = slots.chars[p.charId];
    if (!meta) continue;
    for (const [c, r] of placedCells(p.rot, p.r, p.c, shapeOfChar(meta))) {
      map.set(`${c},${r}`, p.charId);
    }
  }
  return map;
}

/** 배치 검사 — 경계 내 + 중복 없음 */
export function canPlace(u: UnionStore, slots: SlotsStore, p: Placement): boolean {
  const meta = slots.chars[p.charId];
  if (!meta) return false;
  const occ = occupancy(u, slots);
  for (const [c, r] of placedCells(p.rot, p.r, p.c, shapeOfChar(meta))) {
    if (c < 0 || r < 0 || c >= UNION_COLS || r >= UNION_ROWS) return false;
    const owner = occ.get(`${c},${r}`);
    if (owner && owner !== p.charId) return false;
  }
  return true;
}

/** 자동 추천 배치 — 기여 레벨 높은 순서로 좌상단부터 빈 자리에 배치 (효과 최대화: 계열 다양성 우선 배치) */
export function autoArrange(u: UnionStore, slots: SlotsStore): Placement[] {
  const { idx } = unionGradeOf(unionLevelOf(slots));
  const cap = maxPlacedOf(idx);
  const roster = Object.values(slots.chars)
    .filter((c) => c.lv >= 60 && familyOfChar(c))
    .sort((a, b) => b.lv - a.lv);
  const next: UnionStore = { ...u, placements: [] };
  const out: Placement[] = [];
  /* 계열 인터리브 — 전사/궁수/마법사/도적 순서로 돌려 배치해 지역 효과가 고루 퍼지게 */
  const byFam: Record<FamilyKey, CharMeta[]> = { warrior: [], ranger: [], mage: [], thief: [], pirate: [] };
  for (const c of roster) byFam[familyOfChar(c) ?? "warrior"].push(c);
  const queue: CharMeta[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const fam of Object.keys(byFam) as FamilyKey[]) {
      const c = byFam[fam].shift();
      if (c) {
        queue.push(c);
        added = true;
      }
    }
  }
  const occ = new Map<string, string>();
  for (const meta of queue) {
    if (out.length >= cap) break;
    const cells = shapeOfChar(meta);
    let done = false;
    for (let rot = 0; rot < 4 && !done; rot++) {
      for (let r = 0; r < UNION_ROWS && !done; r++) {
        for (let c = 0; c < UNION_COLS && !done; c++) {
          const abs = placedCells(rot, r, c, cells);
          let ok = true;
          for (const [cc, rr] of abs) {
            if (cc < 0 || rr < 0 || cc >= UNION_COLS || rr >= UNION_ROWS || occ.has(`${cc},${rr}`)) {
              ok = false;
              break;
            }
          }
          if (ok) {
            for (const [cc, rr] of abs) occ.set(`${cc},${rr}`, meta.id);
            out.push({ charId: meta.id, rot, r, c });
            done = true;
          }
        }
      }
    }
  }
  next.placements = out;
  writeUnion(next);
  return out;
}

/* ================= 일일 보상 / 레벨업 코인 ================= */

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 유니온 레벨 상승분 코인 정산 + 일일 보상 수령 — 패널 오픈 시 호출. 새로 오른 레벨 수 반환
 *  v1.0.19 — 유니온 레벨 산출을 unionLevelOf 공식으로 일원화 */
export function unionDailyAndLevelup(): { coins: number; lvUps: number; dailyTaken: boolean } {
  const u = loadUnion();
  const slots = loadSlots();
  const lv = unionLevelOf(slots);
  let coins = 0;
  let lvUps = 0;
  if (u.seenLv === 0 && lv > 0) {
    u.seenLv = lv; // 첫 확인 — 소급 지급 없음
  } else if (lv > u.seenLv) {
    lvUps = lv - u.seenLv;
    coins += lvUps * 2;
    u.seenLv = lv;
  }
  let dailyTaken = false;
  if (u.lastDaily !== today() && lv >= 60) {
    u.lastDaily = today();
    coins += 5;
    dailyTaken = true;
  }
  if (coins > 0) u.coins += coins;
  writeUnion(u);
  return { coins, lvUps, dailyTaken };
}

/** 유니온 버프 구매 — 코인 차감 + 만료 시각 등록. 성공 시 버프 정의 반환 */
export function buyUnionBuff(key: string): UnionBuffDef | null {
  const def = UNION_BUFFS.find((b) => b.key === key);
  if (!def) return null;
  const u = loadUnion();
  if (u.coins < def.cost) return null;
  u.coins -= def.cost;
  const now = Date.now();
  const exist = u.buffs.find((b) => b.key === key);
  if (exist) exist.until = Math.max(exist.until, now) + def.minutes * 60000;
  else u.buffs.push({ key, until: now + def.minutes * 60000 });
  writeUnion(u);
  return def;
}

/** 슬롯 확장권 — 유니온 코인 60개 소모 */
export function buySlotExpand(): boolean {
  const u = loadUnion();
  if (u.coins < 60) return false;
  u.coins -= 60;
  writeUnion(u);
  return expandSlots();
}

/** 유니온 레이드 클리어 정산 */
export function raidClear(diff: RaidDiff): { coin: number } {
  const u = loadUnion();
  const d = RAID_DIFFS[diff];
  u.coins += d.coin;
  u.raidDone = `${today()}|${diff}`;
  writeUnion(u);
  return { coin: d.coin };
}

export function raidDoneToday(): RaidDiff | null {
  const u = loadUnion();
  if (!u.raidDone.includes("|")) return null;
  const [d, diff] = u.raidDone.split("|");
  if (d !== today()) return null;
  return (parseInt(diff, 10) || 0) as RaidDiff;
}

export function spendCoins(n: number): boolean {
  const u = loadUnion();
  if (u.coins < n) return false;
  u.coins -= n;
  writeUnion(u);
  return true;
}
