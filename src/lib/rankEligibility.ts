/**
 * vc283 (지시 #24 "랭킹 등록 조건을 4차 전직 이상으로 변경") — 랭킹 등록 자격 (순수 모듈).
 *
 * [왜 sapi.ts 에서 분리했나]
 *  `sapi.ts` 는 `next/server` 를 import 하므로 Node 테스트에서 직접 로드할 수 없다.
 *  그런데 "4차 전직 이상만 랭킹에 등록"은 **틀리면 저차 캐릭터가 명예의 전당에 노출되거나
 *  반대로 5차 유저가 목록에서 사라지는** 집계 경계다. 반드시 테스트로 고정해야 한다.
 *  → 판정만 여기로 떼어내 순수 함수로 만들고, sapi.ts 가 이를 재-export 한다
 *    (`sessionCookie.ts` 가 `sapi.ts` 에서 분리된 것과 같은 이유·같은 패턴).
 *
 * [5차 처리]
 *  5차는 별도 tier 값이 아니라 4차에서 **각성**한 상태다 (`Player.sTier` 5, 클래스는 4차 유지).
 *  따라서 `classDef(cls).tier >= 4` 하나로 4차와 5차가 모두 통과하고,
 *  미전직(null)·1~3차만 걸러진다.
 *
 * [세이브 호환]
 *  새 필드를 읽지 않고 기존 `cls` 문자열만 본다 — 구세이브도 그대로 평가된다.
 */
/* [경로] 상대 경로를 쓴다 — 이 모듈은 Node 테스트가 직접 import 하므로
 *  `@/game/classes` 같은 tsconfig 별칭은 해석되지 않는다
 *  (sessionCookie.ts 가 같은 이유로 순수 모듈로 분리된 선례를 따른다). */
import { classDef } from "../game/classes";

/** 이 단계 이상만 랭킹 등록 (4 = 4차 전직) */
export const RANK_MIN_TIER = 4;

/** 세이브 데이터가 랭킹 등록 자격을 갖췄는가 */
export function rankEligible(data: Record<string, unknown>): boolean {
  const d = classDef(typeof data.cls === "string" ? data.cls : null);
  return !!d && d.tier >= RANK_MIN_TIER;
}

/** 화면 표기용 조건 문구 — UI 와 서버가 같은 상수를 공유하게 한다 */
export const RANK_REQUIREMENT_TEXT = "4차 전직을 완료한 캐릭터만 랭킹에 등록됩니다.";
