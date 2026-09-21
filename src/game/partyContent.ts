/**
 * v1.4.3 (작업4) — 파티 콘텐츠 2종: 파티 시너지 콤보 + 파티 퀘스트 보드(일일)
 *
 *  ① 파티 시너지 콤보 — 파티원 직업 계열 조합에 따른 실전 버프 (EXP/골드 곱산):
 *    · 서로 다른 계열 2종 이상  : 모험의 단합   (EXP +10%)
 *    · 서로 다른 계열 3종 이상  : 전투 대장정   (EXP +12% · GOLD +10%) — 위와 중첩
 *    · 같은 계열 2명 이상       : 일심동체      (GOLD +12%)
 *    · 4인 완전 편성(3계열+)    : 만능 원정대   (EXP +15% · GOLD +15%) — 위와 중첩
 *    · 솔로(파티 없음)          : 단독 가호     (EXP +5%) — 솔로 유저 소외 방지
 *    → WorldScene 킬 플로우에서 매 처치마다 반영, PartyWidget에 실시간 표시.
 *
 *  ② 파티 퀘스트 보드 — 하루 3개의 파티 미션(풀 6종에서 날짜 기반 결정적 선택):
 *    파티 중일 때만 카운트되며, 수령 시 파티 중이면 풀 보상 / 솔로면 50%
 *    ("같이 하면 더 크게 받는다" — 파티 가입 동기 + 솔로도 보상 단절 없음).
 *
 *  밸런스 원칙: 기존 파티 사냥 보너스(+8%/명)·동행 보너스(+4%/명)와 합산되지만
 *  시너지 총량은 EXP +37%/GOLD +37% 상한으로 과도한 인플레 방지.
 */
import type { NetParty } from "./net";

/* ================= ① 파티 시너지 콤보 ================= */

export type PartySynergy = {
  id: string;
  name: string;
  desc: string;
  expPct: number;
  goldPct: number;
  color: string;
};

/** 직업 키 → 계열 (union.ts familyOfChar와 동일 규칙 — 순환 import 회피용 로컬 역산) */
export function familyOfCls(cls: string | null): "warrior" | "ranger" | "mage" | "thief" | null {
  if (!cls) return null;
  if (cls === "warrior" || cls === "ranger" || cls === "mage" || cls === "thief") return cls;
  if (/^(berserker|guardian|warlord|paladin|warbringer|crusader)$/.test(cls)) return "warrior";
  if (/^(sniper|windrunner|eagleeye|tempest|deadeye|skylord)$/.test(cls)) return "ranger";
  if (/^(archmage|sage|stormbringer|chronicle|arclord|eternal)$/.test(cls)) return "mage";
  if (/^(rogue|ninja|assassin|phantom|shadowlord|blademaster)$/.test(cls)) return "thief";
  return null;
}

/** 파티 스냅샷 → 발동 중인 시너지 목록 (UI 표시 + 킬 플로우 합산 양소출) */
export function partySynergies(party: NetParty | null): PartySynergy[] {
  if (!party || party.members.length < 2) return [];
  const fams = party.members.map((m) => familyOfCls(m.cls)).filter((f): f is NonNullable<typeof f> => f !== null);
  const distinct = new Set(fams);
  const sameFamMax = Math.max(...[...distinct].map((f) => fams.filter((x) => x === f).length), 0);
  const out: PartySynergy[] = [];
  if (distinct.size >= 2) {
    out.push({ id: "unity", name: "모험의 단합", desc: "서로 다른 계열 2종+ — EXP +10%", expPct: 10, goldPct: 0, color: "#7ddcff" });
  }
  if (distinct.size >= 3) {
    out.push({ id: "campaign", name: "전투 대장정", desc: "서로 다른 계열 3종+ — EXP +12% · 골드 +10%", expPct: 12, goldPct: 10, color: "#c08aff" });
  }
  if (sameFamMax >= 2) {
    out.push({ id: "unison", name: "일심동체", desc: "같은 계열 2명+ — 골드 +12%", expPct: 0, goldPct: 12, color: "#8fe84a" });
  }
  if (party.members.length >= 4 && distinct.size >= 3) {
    out.push({ id: "fullsquad", name: "만능 원정대", desc: "4인 완전 편성 — EXP +15% · 골드 +15%", expPct: 15, goldPct: 15, color: "#ffd76a" });
  }
  return out;
}

/** 솔로 가호 — 파티 없이 사냥할 때 EXP +5% (매처치 반영) */
export const SOLO_BLESS_EXP_PCT = 5;

/** 시너지 합산 (킬 플로우 1회 호출용) */
export function synergyTotals(party: NetParty | null): { expPct: number; goldPct: number } {
  let expPct = 0, goldPct = 0;
  for (const s of partySynergies(party)) { expPct += s.expPct; goldPct += s.goldPct; }
  return { expPct, goldPct };
}

/* ================= ② 파티 퀘스트 보드 (일일) ================= */

export type PartyMissionKind = "kill" | "boss" | "portal" | "collect" | "time" | "elite";

export type PartyMissionDef = {
  id: string;
  kind: PartyMissionKind;
  title: string;
  need: number;
  gold: number;
  exp: number;
  unit: string;
};

export const PARTY_MISSION_POOL: PartyMissionDef[] = [
  { id: "pkill", kind: "kill", title: "파티 합동 사냥", need: 40, gold: 3000, exp: 600, unit: "마리" },
  { id: "pboss", kind: "boss", title: "파티 보스 토벌", need: 1, gold: 5000, exp: 1200, unit: "마리" },
  { id: "pportal", kind: "portal", title: "파티 원정 이동", need: 5, gold: 2000, exp: 400, unit: "회" },
  { id: "pcollect", kind: "collect", title: "파티 결정 조사", need: 3, gold: 3500, exp: 800, unit: "개" },
  { id: "ptime", kind: "time", title: "파티 순찰 근무", need: 15, gold: 2500, exp: 500, unit: "분" },
  { id: "pelite", kind: "elite", title: "파티 정예 사냥", need: 1, gold: 4000, exp: 1000, unit: "마리" },
];

export type PartyBoardState = {
  day: string;
  progress: Record<string, number>;  // missionId → 진행량
  claimed: Record<string, boolean>;  // missionId → 수령 여부
  missionIds: string[];              // 오늘의 3개 미션
};

const BOARD_KEY = "sertz.party.board.v1";
const DAY_MS = 86400000;

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 날짜 기반 결정적 3종 선택 (풀 6종 → day 해시로 회전) */
function pickDailyMissions(day: string): string[] {
  let h = 0;
  for (let i = 0; i < day.length; i++) h = (h * 31 + day.charCodeAt(i)) >>> 0;
  const idx: number[] = [];
  let cur = h % PARTY_MISSION_POOL.length;
  while (idx.length < 3) {
    if (!idx.includes(cur)) idx.push(cur);
    cur = (cur + 1 + (h % 3)) % PARTY_MISSION_POOL.length;
  }
  return idx.map((i) => PARTY_MISSION_POOL[i].id);
}

let boardCache: PartyBoardState | null = null;

/** 오늘의 파티 보드 상태 — 날짜가 바뀌면 자동 리셋 */
export function partyBoard(): PartyBoardState {
  const day = todayKey();
  if (boardCache && boardCache.day === day) return boardCache;
  try {
    const raw = window.localStorage.getItem(BOARD_KEY);
    if (raw) {
      const d = JSON.parse(raw) as PartyBoardState;
      if (d.day === day) {
        boardCache = { day, progress: d.progress ?? {}, claimed: d.claimed ?? {}, missionIds: d.missionIds?.length === 3 ? d.missionIds : pickDailyMissions(day) };
        return boardCache;
      }
    }
  } catch { /* 파싱 실패 — 신규 생성 */ }
  boardCache = { day, progress: {}, claimed: {}, missionIds: pickDailyMissions(day) };
  writeBoard();
  return boardCache;
}

function writeBoard() {
  if (!boardCache) return;
  try { window.localStorage.setItem(BOARD_KEY, JSON.stringify(boardCache)); } catch { /* 저장 불가 무시 */ }
}

/** 파티 보드 진행 누적 — 파티 중일 때만 카운트 (WorldScene 훅에서 호출) */
export function partyBoardTick(kind: PartyMissionKind, n = 1): PartyMissionDef | null {
  const b = partyBoard();
  let touched: PartyMissionDef | null = null;
  for (const id of b.missionIds) {
    const def = PARTY_MISSION_POOL.find((m) => m.id === id);
    if (!def || def.kind !== kind || b.claimed[id]) continue;
    if (b.progress[id] >= def.need) continue;
    b.progress[id] = Math.min(def.need, (b.progress[id] ?? 0) + n);
    touched = def;
  }
  if (touched) writeBoard();
  return touched;
}

/** 미션 수령 — 파티 중이면 풀 보상, 솔로면 50% (소수 첫째 자리 반올림) */
export function claimPartyMission(id: string, inParty: boolean): { ok: boolean; gold: number; exp: number; mission?: PartyMissionDef } {
  const b = partyBoard();
  const def = PARTY_MISSION_POOL.find((m) => m.id === id);
  if (!def) return { ok: false, gold: 0, exp: 0 };
  if (b.claimed[id] || (b.progress[id] ?? 0) < def.need) return { ok: false, gold: 0, exp: 0 };
  const mul = inParty ? 1 : 0.5;
  const gold = Math.round(def.gold * mul);
  const exp = Math.round(def.exp * mul);
  b.claimed[id] = true;
  writeBoard();
  return { ok: true, gold, exp, mission: def };
}

/** 남은 오늘 시간(ms) — UI 표시용 */
export function partyBoardResetsIn(): number {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  return next - now.getTime();
}

/** E2E/디버그 훅 — 보드 상태 노출 */
export function __partyBoardForTest(): PartyBoardState | null {
  return boardCache;
}
