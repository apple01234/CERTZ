/**
 * vc276 — 스킬 이펙트 3단 시점 분리 회귀 방지.
 *
 * 고정하는 것 (깨지면 실제 회귀):
 *  ① 세 레이어가 **서로 다른 시점**에 생성된다 (전부 t=0 으로 돌아가면 한 덩어리로 뭉개짐)
 *  ② 사용하는 텍스처 키가 **실제 에셋 파일로 존재**한다 (미로드 키 = 검은 사각형)
 *  ③ 저사양 게이트(fxLevel 0)가 여전히 최상단에서 조기 반환한다 (성능 회귀 방지)
 *  ④ 옵션 미지정 시 stepMs 기본값이 존재한다 (기존 호출부 6곳 무수정 동작)
 *
 * 이펙트는 순수 시각 레이어다 — 이 테스트는 "판정"이 아니라 "생성 시점"만 본다.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = new URL("../", import.meta.url);
const SRC = readFileSync(new URL("src/game/fx/StudioFX.ts", ROOT), "utf8");

test("스킬 임팩트는 시전/먼지/타격 3단으로 시점이 분리된다", () => {
  // spawnSkillImpact 본문만 잘라낸다 (다른 함수의 delayedCall 오탐 방지)
  const start = SRC.indexOf("export function spawnSkillImpact");
  assert.ok(start > 0, "spawnSkillImpact 를 찾지 못함");
  const end = SRC.indexOf("/* ---------------- 5차 궁극기 공통 인트로", start);
  assert.ok(end > start, "함수 끝 경계를 찾지 못함");
  const body = SRC.slice(start, end);

  // ① 지연 헬퍼가 있어야 한다
  assert.match(body, /const delayed = \(ms: number, run: \(\) => void\) =>/, "delayed 헬퍼 누락");

  // ② 세 단계가 서로 다른 지연값을 써야 한다: 0(링) / stepMs(먼지) / stepMs*2(타격)
  assert.match(body, /delayed\(stepMs,/, "먼지 단계가 stepMs 지연을 쓰지 않음");
  assert.match(body, /delayed\(stepMs \* 2,/, "타격 단계가 stepMs*2 지연을 쓰지 않음");

  // ③ 링은 지연 없이 즉시 — 첫 단계가 늦으면 시전 인지가 늦어진다
  const ringBlock = body.slice(body.indexOf("const ring = vfImage"), body.indexOf("if (fxLevel >= 2)"));
  assert.ok(!/delayed\(/.test(ringBlock), "링(시전) 단계는 지연되면 안 됨");

  // ④ three distinct stages must exist
  assert.match(body, /hv2_smoke26/, "먼지 텍스처(발밑) 누락");
  assert.match(body, /vf_impact/, "타격 코어 텍스처 누락");
  assert.match(body, /vf_slash/, "타격 참격 텍스처 누락");
});

test("임팩트 텍스처 키가 실제 에셋으로 존재한다", () => {
  const keys = ["hv2_smoke26", "vf_impact", "vf_slash", "hv2_circle2"];
  for (const k of keys) {
    const found = [".webp", ".png"].some((ext) =>
      existsSync(fileURLToPath(new URL(`public/assets/${k}${ext}`, ROOT))),
    );
    assert.ok(found, `에셋 누락: public/assets/${k}.webp|png — 미로드 키는 검은 사각형이 된다`);
  }
});

test("저사양 게이트가 최상단에서 조기 반환한다", () => {
  const start = SRC.indexOf("export function spawnSkillImpact");
  const body = SRC.slice(start, SRC.indexOf("/* ---------------- 5차 궁극기 공통 인트로", start));
  const gateIdx = body.indexOf("if (fxLevel === 0) return;");
  assert.ok(gateIdx > 0, "fxLevel 0 조기 반환이 사라짐 (모바일 프레임 보호)");
  // 게이트가 어떤 오브젝트 생성보다 앞서야 한다
  for (const call of ["vfImage(scene", "delayed(stepMs"]) {
    const i = body.indexOf(call);
    if (i >= 0) assert.ok(gateIdx < i, `게이트가 ${call} 보다 뒤에 있음`);
  }
});

test("stepMs 기본값이 있어 기존 호출부가 그대로 동작한다", () => {
  assert.match(SRC, /const stepMs = opts\.stepMs \?\? \d+;/, "stepMs 기본값 누락");
  const m = SRC.match(/const stepMs = opts\.stepMs \?\? (\d+);/);
  const ms = Number(m[1]);
  assert.ok(ms > 0 && ms <= 200, `stepMs 기본값이 비현실적: ${ms}ms`);
});
