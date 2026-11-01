/**
 * morale.ts — vc214 Utility AI 기반 "싸울까 도망칠까" 판단
 *
 * 왜 추가하는가
 * -------------
 * 기존 `Enemy` 는 `opts.flee` 라는 **정적 플래그**로만 도주했다(황금 몬스터 전용).
 * 일반 몬스터는 체력이 1 남아도 계속 돌진한다. 그래서
 *   · 후반 챕터에서 잡몹이 떼로 붙으면 "무의미한 죽음"만 반복되고
 *   · 플레이어는 위협받지 않으며(적이 후퇴하지 않으니)
 *   · 전투에 리듬이 없다(항상 최대 공격성).
 *
 * 이 모듈은 `ai/utility.ts` 의 UtilityEvaluator 로 **매 결정 주기마다** 세 후보를 채점한다:
 *   fight  — 계속 싸운다
 *   retreat— 잠시 거리를 벌린다(체력 회복 여지)
 *   flee   — 완전히 도망친다(어그로 해제)
 *
 * 설계 근거 (`agd-ai-behavior-trees-utility-ai` 스킬)
 * ------------------------------------------------
 *  · 모든 고려 항목은 0..1 정규화(Curve). 한 축이 다른 축을 지배하지 않게.
 *  · 체력은 `sigmoid` 로 부드럽게 — 30% 같은 딱 떨어지는 문턱에서 깜빡이지 않게.
 *  · 거리는 종형(band) — 너무 가까우면 retreat 보다 fight 가 유리하고,
 *    너무 멀면 굳이 도망칠 이유가 없다.
 *  · 히스테리시스 0.08 — 임계 근처에서 fight↔retreat 진동을 막는다.
 *  · **틱마다 노드를 만들지 않는다** — 액션 배열과 스크래치 ctx 를 인스턴스에 보관.
 *
 * FSM 은 건드리지 않는다. 여기서 나온 판단을 `Enemy` 가 자기 FSM 상태 선택에
 * 힌트로 쓰고, retreat/flee 일 때만 별도 이동을 적용한다.
 */

import { Curve, UtilityEvaluator, type UtilityAction } from "./utility";

/** 판단에 쓰는 사실(fact). 매 틱 갱신하되 객체는 재사용한다(할당 회피). */
export type MoraleCtx = {
  /** 현재 체력 비율 0..1 */
  hp01: number;
  /** 플레이어까지 거리(px) */
  dist: number;
  /** 이 적의 어그로 반경(px) — 거리 판단의 기준 스케일 */
  aggro: number;
  /** 주변에 같은 편이 몇 마리 있는가(0..N). 여럿이면 덜 도망친다. */
  allies: number;
  /** 플레이어 체력 비율 0..1 — 상대가 빈사면 도망칠 이유가 줄어든다 */
  playerHp01: number;
};

export type Morale = "fight" | "retreat" | "flee";

/** 액션 정의는 모듈 로드 시 1회만 만든다(스킬: 트리는 스폰 때 한 번). */
const ACTIONS: UtilityAction<MoraleCtx>[] = [
  {
    id: "fight",
    // 체력이 높을수록, 적이 많을수록, 상대가 약할수록 싸운다
    considerations: [
      (c) => Curve.sigmoid(c.hp01, 0.45, 10),        // 체력 45% 중심
      (c) => 1 - Curve.sigmoid(Math.min(1, c.dist / Math.max(1, c.aggro)), 0.85, 6), // 가까울수록 싸움
      /* 동료 수를 그대로 곱하면 allies=0 일 때 fight 점수가 0 이 되어
       * 어떤 행동도 선택되지 않는다(실측으로 확인). 0.35 바닥 + 최대 1.0 으로
       * "있으면 더 용감"만 표현한다. */
      (c) => 0.35 + 0.65 * Curve.linear(c.allies, 0, 3),
      (c) => 1 - Curve.linear(c.playerHp01, 0, 1) * 0.5,
    ],
    weights: [1.4, 1.0, 1.6, 0.6],
  },
  {
    id: "retreat",
    // 체력이 중간 이하 + 거리가 가까울 때 잠시 벌린다
    considerations: [
      (c) => Curve.exponential(1 - c.hp01, 0.3, 1.0, 1.5),
      /* retreat = '붙어 있는 위협에서 거리를 벌린다'. 거리가 멀면 벌릴 이유가 없으므로
       * 가까울수록 점수가 높아야 한다(반대면 멀리서 혼자 후퇴하는 이상 동작이 된다).
       * dist 를 0..1 로 정규화해 sigmoid 를 태운다(px 그대로 넣으면 지수 폭락). */
      (c) => 1 - Curve.sigmoid(Math.min(1, c.dist / Math.max(1, c.aggro)), 0.45, 6),
      (c) => 1 - 0.7 * Curve.linear(c.allies, 0, 3), // 여럿이면 덜 후퇴 (동료 0 이어도 1.0)
    ],
    weights: [1.5, 0.8, 1.8],
  },
  {
    id: "flee",
    // 체력이 매우 낮고 동료도 없을 때 완전히 도망
    considerations: [
      /* ض/ 급상승 시작점을 0.60 으로 낮춰 hp 10% 이하에서 retreat 를 확실히 앞지르게 한다. */
      (c) => Curve.exponential(1 - c.hp01, 0.60, 0.98, 2.2),
      (c) => 1 - 0.9 * Curve.linear(c.allies, 0, 2), // 동료 0 이어도 배제되지 않게
      (c) => 0.2 + 0.8 * Curve.linear(c.playerHp01, 0.15, 0.6), // 상대 만피가 아니어도 배제 금지
    ],
    weights: [2.2, 2.4, 0.8],
    bias: -0.04, // 도주는 최후 수단 — 살짝 억제
  },
];

/** 모듈 전역 평가기 — 액션이 불변이므로 재사용해도 안전하다 */
const evaluator = new UtilityEvaluator<MoraleCtx>(ACTIONS, {
  hysteresis: 0.08,
  minScore: 0.05,
});

/**
 * 현재 상황의 사기(morale)를 판정한다.
 * @param prev 직전 판단(히스테리시스 적용용). 없으면 null
 * @returns 판단 결과. 모두 낮으면 fight 가 기본값이다(적은 멈추지 않는다).
 */
export function decideMorale(ctx: MoraleCtx, prev: Morale | null): Morale {
  const id = evaluator.select(ctx, prev);
  if (id === "retreat" || id === "flee") return id;
  return "fight";
}

/** 디버그용 — 각 후보의 점수를 그대로 노출(개발 HUD/테스트에서 사용) */
export function moraleScores(ctx: MoraleCtx, prev: Morale | null): ReadonlyMap<string, number> {
  return evaluator.evaluate(ctx, prev);
}
