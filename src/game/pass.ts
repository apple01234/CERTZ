/* =====================================================================
 * v4.5.0 "BM 표준화 & 도파민 시즌제" — 시즌 패스 + 구독(SERTZ 패스)
 *  - 유저 제공 BM 문서 표준 적용: 배틀패스(리텐션+수익 듀얼 장치) + 월정액 구독(LTV 급증)
 *  - 이 파일은 순수 데이터 + 계산 헬퍼만 담당 (Phaser/React 의존 없음)
 *  - 보상 지급은 WorldScene.grantBmGrants가 BmGrant 라인으로 처리한다
 * ===================================================================== */

import type { BmGrant } from "./data";

/* ================= 1. 시즌 패스 (배틀패스 — 월 단위 시즌) =================
 *  BM 문서: "배틀패스의 핵심 가치는 수익보다 리텐션 — 시즌 끝나기 전에
 *  보상 채우기가 매일 로그인할 이유를 만든다. 페이율 5~20%로 일반 IAP보다 전환율 높음."
 *  → 무료 트랙(전원) + 프리미엄 트랙(에메랄드 결제) 이중 구조, 소급 수령 허용. */

/** 레벨 1당 필요 XP */
export const PASS_LV_XP = 100;
/** 시즌 최대 레벨 */
export const PASS_MAX_LV = 30;
/** 프리미엄 트랙 가격 (에메랄드 — GEM_SKUS 55💎 ₩5,500로 충전 가능) */
export const PASS_PREMIUM_PRICE = 30;
/** 시즌 패스 XP 규칙 (WorldScene 훅에서 사용) */
export const PASS_XP_RULES = { hunt: 1, boss: 30, daily: 40, gateWave: 2 } as const;

/** 시즌 키 — 달력 월 단위 (매월 1일 00시 리셋 = 예측 가능한 FOMO 사이클) */
export function seasonKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 시즌 남은 일수 (다음 달 1일까지) */
export function seasonDaysLeft(d = new Date()): number {
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return Math.max(1, Math.ceil((next.getTime() - d.getTime()) / 86400000));
}

/** XP → 패스 레벨 (최대 PASS_MAX_LV) */
export function passLevel(xp: number): number {
  return Math.min(PASS_MAX_LV, Math.floor(xp / PASS_LV_XP));
}

/** 현재 레벨에서 다음 레벨까지 남은 XP */
export function passXpInLv(xp: number): number {
  if (passLevel(xp) >= PASS_MAX_LV) return 0;
  return xp % PASS_LV_XP;
}

/** 도파민 설계: 5레벨마다 상자(변동 보상), 10/20/30에 펫·전설·치장(희소 보상) 배치 */
export const PASS_TRACKS: { free: BmGrant | null; prem: BmGrant | null }[] = [
  /* 1 */ { free: { gold: 3000, label: "골드 3,000G" }, prem: { emerald: 3, label: "에메랄드 +3" } },
  /* 2 */ { free: { item: "potion_hp2", n: 3, label: "상급 HP 물약 ×3" }, prem: { buff: "buff_king", label: "왕의 가호 버프" } },
  /* 3 */ { free: { ticket: 2, label: "뽑기권 ×2" }, prem: { gold: 20000, label: "골드 20,000G" } },
  /* 4 */ { free: { item: "scroll_star", n: 2, label: "강화 주문서 ×2" }, prem: { item: "potion_mp2", n: 5, label: "상급 MP 물약 ×5" } },
  /* 5 */ { free: { item: "chest_silver", n: 1, label: "은 상자 ×1 (마일스톤!)" }, prem: { emerald: 5, label: "에메랄드 +5" } },
  /* 6 */ { free: { gold: 8000, label: "골드 8,000G" }, prem: { item: "scroll_star", n: 5, label: "강화 주문서 ×5" } },
  /* 7 */ { free: { ticket: 3, label: "뽑기권 ×3" }, prem: { item: "potion_hp3", n: 10, label: "고급 HP 물약 ×10" } },
  /* 8 */ { free: { shard: 30, label: "피규어 조각 ×30" }, prem: { item: "chest_silver", n: 2, label: "은 상자 ×2" } },
  /* 9 */ { free: { gold: 12000, label: "골드 12,000G" }, prem: { emerald: 5, label: "에메랄드 +5" } },
  /* 10 */ { free: { item: "chest_gold", n: 1, label: "금 상자 ×1 (마일스톤!)" }, prem: { item: "pet_wisp", label: "위스프 펫 (시즌 한정!)" } },
  /* 11 */ { free: { item: "potion_hp2", n: 5, label: "상급 HP 물약 ×5" }, prem: { gold: 30000, label: "골드 30,000G" } },
  /* 12 */ { free: { ticket: 3, label: "뽑기권 ×3" }, prem: { buff: "buff_king", n: 2, label: "왕의 가호 ×2" } },
  /* 13 */ { free: { item: "scroll_star", n: 4, label: "강화 주문서 ×4" }, prem: { shard: 80, label: "피규어 조각 ×80" } },
  /* 14 */ { free: { gold: 15000, label: "골드 15,000G" }, prem: { emerald: 8, label: "에메랄드 +8" } },
  /* 15 */ { free: { item: "exp_book", n: 2, label: "경험치 책 ×2 (마일스톤!)" }, prem: { item: "chest_gold", n: 2, label: "금 상자 ×2" } },
  /* 16 */ { free: { ticket: 4, label: "뽑기권 ×4" }, prem: { item: "potion_mp3", n: 10, label: "고급 MP 물약 ×10" } },
  /* 17 */ { free: { shard: 50, label: "피규어 조각 ×50" }, prem: { gold: 40000, label: "골드 40,000G" } },
  /* 18 */ { free: { gold: 18000, label: "골드 18,000G" }, prem: { item: "scroll_star", n: 8, label: "강화 주문서 ×8" } },
  /* 19 */ { free: { item: "potion_mp2", n: 5, label: "상급 MP 물약 ×5" }, prem: { emerald: 10, label: "에메랄드 +10" } },
  /* 20 */ { free: { item: "chest_legend", n: 1, label: "전설 상자 ×1 (대마일스톤!)" }, prem: { item: "pet_frost", label: "서리 펫 (시즌 한정!)" } },
  /* 21 */ { free: { gold: 20000, label: "골드 20,000G" }, prem: { buff: "buff_king", n: 3, label: "왕의 가호 ×3" } },
  /* 22 */ { free: { ticket: 5, label: "뽑기권 ×5" }, prem: { shard: 120, label: "피규어 조각 ×120" } },
  /* 23 */ { free: { item: "scroll_star", n: 6, label: "강화 주문서 ×6" }, prem: { gold: 50000, label: "골드 50,000G" } },
  /* 24 */ { free: { shard: 60, label: "피규어 조각 ×60" }, prem: { emerald: 12, label: "에메랄드 +12" } },
  /* 25 */ { free: { item: "chest_gold", n: 2, label: "금 상자 ×2 (마일스톤!)" }, prem: { item: "chest_legend", n: 1, label: "전설 상자 ×1" } },
  /* 26 */ { free: { gold: 25000, label: "골드 25,000G" }, prem: { buff: "buff_king", n: 3, label: "왕의 가호 ×3" } },
  /* 27 */ { free: { ticket: 6, label: "뽑기권 ×6" }, prem: { item: "scroll_star", n: 10, label: "강화 주문서 ×10" } },
  /* 28 */ { free: { shard: 80, label: "피규어 조각 ×80" }, prem: { gold: 60000, label: "골드 60,000G" } },
  /* 29 */ { free: { item: "exp_book", n: 3, label: "경험치 책 ×3" }, prem: { emerald: 15, label: "에메랄드 +15" } },
  /* 30 */ { free: { item: "chest_legend", n: 1, label: "전설 상자 ×1 + 뽑기권 ×10 (최종!)", ticket: 10 }, prem: { item: "cos_rainbow", label: "무지개 오라 치장 + 에메랄드 +20 (최종!)", emerald: 20 } },
];

/* ================= 2. 구독 — SERTZ 패스 (월정액 특전) =================
 *  BM 문서: "게임 내 월정액 — 매일 보석 지급 등. 정기 결제로 LTV 급증
 *  (월 $9.99 구독자 = 연 $120)." → 에메랄드 50💎 / 30일, 잔여기간 이어받기. */

export const SUB_PRICE = 50;
export const SUB_DAYS = 30;
/** 매일 출석 시 지급 (출석 체크에 합산) */
export const SUB_DAILY_EMERALD = 3;
/** 광고 보상 배율 (구독자 2배 — 💎+2·골드+1,000) */
export const SUB_AD_MUL = 2;
/** 구독자 광고 일일 한도 (일반 5 → 8회) */
export const SUB_AD_LIMIT = 8;
/** 광고 무료 상자/버프 일일 한도 */
export const AD_CHEST_PER_DAY = 3;
export const AD_DROP_PER_DAY = 2;

export function subActive(until: number | undefined): boolean {
  return !!until && until > Date.now();
}

/** 구독 잔여 일수 (올림 — 미구독 0) */
export function subDaysLeft(until: number | undefined): number {
  if (!subActive(until)) return 0;
  return Math.max(1, Math.ceil(((until as number) - Date.now()) / 86400000));
}

/* ================= 3. 시즌 미션 (v1.0.1 — 리텐션 미션 보드) =================
 *  BM 문서: "미션은 매일 로그인할 이유" — 일일 미션(당일 리셋) + 주간 미션(월요일 리셋).
 *  보상은 패스 XP로 지급 → 시즌 패스 트랙 보상과 직결 = 미션→패스→보상 3단 도파민 루프.
 *  진행 카운트는 WorldScene 훅(trackMission)이, 수령은 PassPanel(rpg:missionClaim)이 담당. */
export type SeasonMission = { id: string; name: string; target: number; xp: number; hook: MissionHook };
export type MissionHook = "hunt" | "boss" | "closet" | "gate" | "dailyClaim" | "market";

/** 일일 미션 — 매일 00시 리셋 (쿼타는 하루 플레이 30분~1시간 기준) */
export const SEASON_DAILY_MISSIONS: SeasonMission[] = [
  { id: "d_hunt", name: "토벌 50마리", target: 50, xp: 30, hook: "hunt" },
  { id: "d_boss", name: "보스 처치 3마리", target: 3, xp: 50, hook: "boss" },
  { id: "d_closet", name: "균열 던전 입장 1회", target: 1, xp: 40, hook: "closet" },
  { id: "d_gate", name: "게이트 웨이브 2돌파", target: 2, xp: 40, hook: "gate" },
];

/** 주간 미션 — 월요일 00시 리셋 (일일의 약 4~5배 쿼타) */
export const SEASON_WEEKLY_MISSIONS: SeasonMission[] = [
  { id: "w_hunt", name: "토벌 400마리", target: 400, xp: 150, hook: "hunt" },
  { id: "w_boss", name: "보스 처치 15마리", target: 15, xp: 200, hook: "boss" },
  { id: "w_closet", name: "균열 던전 입장 4회", target: 4, xp: 120, hook: "closet" },
  { id: "w_daily", name: "일일 퀘스트 수령 4일", target: 4, xp: 180, hook: "dailyClaim" },
  { id: "w_market", name: "거래소 이용 1회", target: 1, xp: 100, hook: "market" },
];

/** 주차 키 (ISO 주차 — 월요일 기준 리셋) — "2026-W37" 형식 */
export function weekKey(d = new Date()): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; // 일=0 → 7
  t.setUTCDate(t.getUTCDate() + 4 - day); // 해당 주 목요일
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** 훅 이름으로 미션 그룹 조회 (WorldScene.trackMission용) */
export function missionsByHook(hook: MissionHook): { daily: SeasonMission[]; weekly: SeasonMission[] } {
  return {
    daily: SEASON_DAILY_MISSIONS.filter((m) => m.hook === hook),
    weekly: SEASON_WEEKLY_MISSIONS.filter((m) => m.hook === hook),
  };
}
