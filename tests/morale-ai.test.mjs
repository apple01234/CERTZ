// vc214 사기 판단(Utility AI) 단위 검증
// 실행: node --experimental-strip-types tests/morale-ai.test.mjs
//
// 이 파일은 morale.ts 의 *행동 계약*을 고정한다. 밸런스 수치를 바꿀 때
// 여기가 깨지면 "적이 더 이상 도망치지 않는다" 같은 회귀를 즉시 알 수 있다.
import { decideMorale, moraleScores } from "../src/game/ai/morale.ts";

let pass = 0, fail = 0;
const t = (n, c, x = "") => {
  if (c) { pass++; console.log(`PASS  ${n} ${x}`); }
  else { fail++; console.log(`FAIL  ${n} ${x}`); }
};
const ctx = (hp, dist, allies = 0, pHp = 1) =>
  ({ hp01: hp, dist, aggro: 300, allies, playerHp01: pHp });

// 1) 만피 → 싸운다
t("만피·근접 → fight", decideMorale(ctx(1.0, 120), null) === "fight");

// 2) 체력이 낮아지면 후퇴로 넘어간다 (히스테리시스 없는 순수 점수 기준)
/* 주의: moraleScores 는 내부 스크래치 Map 을 재사용한다(할당 회피 설계).
 * 따라서 두 시점의 값을 비교하려면 **즉시 number 로 복사**해야 한다.
 * 그냥 Map 을 들고 있으면 둘 다 마지막 평가 결과를 가리킨다(실제로 이 실수로
 * 테스트가 오탐 FAIL 했다). */
const hp50 = moraleScores(ctx(0.5, 120), null).get("retreat");
const hp20 = moraleScores(ctx(0.2, 120), null).get("retreat");
t("체력↓ → retreat 점수↑", hp20 > hp50, `(${hp50.toFixed(3)} → ${hp20.toFixed(3)})`);

// 3) 빈사 + 고립 → 도주 계열
t("빈사 고립 → 도주 계열",
  ["flee", "retreat"].includes(decideMorale(ctx(0.05, 120), null)));

// 4) 동료가 많으면 후퇴 성향이 줄어든다
const solo = moraleScores(ctx(0.15, 120, 0), null).get("retreat");
const pack = moraleScores(ctx(0.15, 120, 3), null).get("retreat");
t("동료↑ → retreat 점수↓", pack < solo, `(${solo.toFixed(3)} → ${pack.toFixed(3)})`);

// 5) 상대가 빈사면 도주 성향이 줄어든다
const vsFull = moraleScores(ctx(0.08, 120, 0, 1.0), null).get("flee");
const vsLow = moraleScores(ctx(0.08, 120, 0, 0.1), null).get("flee");
t("상대 빈사 → flee 점수↓", vsLow < vsFull, `(${vsFull.toFixed(3)} → ${vsLow.toFixed(3)})`);

// 6) 가까울수록 후퇴가 매력적 (멀면 벌릴 이유가 없다)
const near = moraleScores(ctx(0.35, 40), null).get("retreat");
const far = moraleScores(ctx(0.35, 450), null).get("retreat");
t("가까움 → retreat 점수↑", near > far, `(${far.toFixed(3)} < ${near.toFixed(3)})`);

// 7) 모든 점수가 유한하고 -0.1 이상 (bias 로 인한 소폭 음수만 허용)
let ok = true;
for (const hp of [0, 0.1, 0.5, 0.9, 1])
  for (const d of [10, 100, 300, 900]) {
    for (const v of moraleScores(ctx(hp, d), null).values())
      if (!isFinite(v) || v < -0.1) ok = false;
  }
t("모든 점수 유한·비음수", ok);

// 8) 어떤 상황에서도 'fight' 는 선택 가능해야 한다 (0 으로 배제되지 않음).
//    이전 버그: 동료 0 을 곱셈 인자로 써서 fight 가 항상 0 이었다.
t("동료 0 이어도 fight 점수 > 0",
  moraleScores(ctx(1.0, 120, 0), null).get("fight") > 0);

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
