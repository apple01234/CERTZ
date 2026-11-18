// 히트스톱 프리셋 값, 차원문 라벨, 보스 슬로모션 워치독, 상황에 맞지 않는 연출 제거.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HITSTOP, hitStopMs } from "../src/game/fx/hitStopPresets.ts";
import { portalPreview } from "../src/game/portalPreview.ts";
import { STAGES, NEXT_STAGE } from "../src/game/stages.ts";

test("히트스톱 프리셋은 종전 직접 호출 값과 같다", () => {
  assert.deepEqual(
    { ...HITSTOP },
    { hit: 26, reaction: 45, crit: 55, skillTick: 60, kill: 70, skillHeavy: 100, skillFinisher: 120, ultFinisher: 140 },
  );
  assert.equal(hitStopMs("crit"), 55);
  assert.equal(hitStopMs(33), 33);
  assert.equal(hitStopMs(undefined), 26);
});

test("엔티티 코드에 숫자 히트스톱 호출이 남지 않는다", () => {
  for (const f of ["entities/Enemy.ts", "entities/Player.ts"]) {
    const src = readFileSync(new URL(`../src/game/${f}`, import.meta.url), "utf8");
    assert.doesNotMatch(src, /hitStop\??\.?\(\s*\d/, f);
  }
});

test("다음 구역이 보스전이면 차원문 라벨에 보스 표시", () => {
  const before = Object.keys(NEXT_STAGE).find((k) => NEXT_STAGE[k] && STAGES[NEXT_STAGE[k]]?.boss);
  assert.ok(before, "보스 직전 구역이 하나는 있어야 한다");
  assert.match(portalPreview(NEXT_STAGE[before]).text, /보스$/);
});

test("다음 구역이 마을이면 휴식 표시, 없으면 기본 문구", () => {
  const toVillage = Object.keys(NEXT_STAGE).find((k) => NEXT_STAGE[k] && STAGES[NEXT_STAGE[k]]?.isVillage);
  if (toVillage) assert.match(portalPreview(NEXT_STAGE[toVillage]).text, /휴식$/);
  assert.equal(portalPreview(null).text, "→ 다음 지역");
  assert.equal(portalPreview("no_such").text, "→ 다음 지역");
});

test("웨이브 처치 슬로모션·궁극기 조명 펄스는 넣지 않는다", () => {
  const scene = readFileSync(new URL("../src/game/scenes/WorldScene.ts", import.meta.url), "utf8");
  assert.doesNotMatch(scene, /playShortSlowMo|skillLightPulse/);
  assert.doesNotMatch(readFileSync(new URL("../src/game/fx/Lighting.ts", import.meta.url), "utf8"), /pulse\(/);
});

test("슬로모션 워치독 기준 시각은 실제 시각(Date.now)으로 잡는다", () => {
  const src = readFileSync(new URL("../src/game/scenes/WorldScene.ts", import.meta.url), "utf8");
  assert.doesNotMatch(src, /slowmoUntil = this\.time\.now/);
  assert.match(src, /if \(this\.slowmoUntil > 0 && Date\.now\(\) > this\.slowmoUntil\)/);
});
