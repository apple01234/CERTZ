/**
 * vc225 — `setupInput` 분리 검증 (라운드 1)
 *
 * `WorldScene.setupInput` 은 1,861줄 단일 함수였다(`docs/VC223_ARCH_AUDIT.md`).
 * 위험도가 가장 낮은 두 조각을 먼저 모듈로 옮겼고, 이 테스트는 **동작이 그대로인지**만 본다.
 *
 * 실행: node --test tests/input-extraction.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_KEYS, KEY_ALIAS, fillKeyObjects } from "../src/game/scenes/input/keyRegistration.ts";
import { SkillInputBuffer, SKILL_BUFFER_MS } from "../src/game/scenes/input/skillBuffer.ts";

/* ─────────────── 키 등록 ─────────────── */

test("ALL_KEYS 에 재배치 가능한 모든 키가 있다", () => {
  const keys = ALL_KEYS.split(",");
  for (const k of ["W", "A", "S", "D", "UP", "DOWN", "LEFT", "RIGHT", "SPACE", "ESC", "TAB"]) {
    assert.ok(keys.includes(k), `${k} 누락 — 이동/UI 키가 빠지면 조작 불가`);
  }
  // v1.4.35 — 숫자열·문자열이 빠지면 keymap 에 배정돼 있어도 이벤트가 생기지 않는다
  for (const k of ["ONE", "TWO", "THREE", "FOUR", "FIVE", "Q", "E", "R", "Z", "X", "C"]) {
    assert.ok(keys.includes(k), `${k} 누락 — 재배치 단축키가 먹지 않는다`);
  }
});

test("숫자키·ESC 별칭이 keymap 표기와 매핑된다", () => {
  assert.equal(KEY_ALIAS.ONE, "1");
  assert.equal(KEY_ALIAS.FIVE, "5");
  assert.equal(KEY_ALIAS.ZERO, "0");
  assert.equal(KEY_ALIAS.ESC, "Escape");
});

test("fillKeyObjects 는 한 글자 키·SPACE·별칭을 모두 등록한다", () => {
  const raw = Object.fromEntries(ALL_KEYS.split(",").map((k) => [k, { code: k }]));
  const keyObjs = {};
  fillKeyObjects(raw, keyObjs);

  assert.deepEqual(keyObjs.W, { code: "W" });
  assert.deepEqual(keyObjs.Q, { code: "Q" });
  assert.deepEqual(keyObjs.SPACE, { code: "SPACE" });
  // 별칭 — keymap 은 "1" 로 조회하는데 Phaser 코드는 ONE
  assert.deepEqual(keyObjs["1"], { code: "ONE" });
  assert.deepEqual(keyObjs["0"], { code: "ZERO" });
  assert.deepEqual(keyObjs.Escape, { code: "ESC" });
});

test("fillKeyObjects 는 다중 글자 코드(UP/ESC 등)를 직접 등록하지 않는다", () => {
  // 원본 규칙: 한 글자이거나 SPACE 일 때만 직접 등록. UP 같은 코드는 별칭이 없으면 미등록.
  const raw = Object.fromEntries(ALL_KEYS.split(",").map((k) => [k, { code: k }]));
  const keyObjs = {};
  fillKeyObjects(raw, keyObjs);
  assert.equal(keyObjs.UP, undefined, "UP 은 별칭 경로가 없어 직접 등록되지 않아야 한다");
  assert.equal(keyObjs.TAB, undefined);
});

/* ─────────────── 스킬 버퍼 ─────────────── */

function mockCaster(state = "idle") {
  const calls = [];
  const c = { state, calls };
  const names = { s1: "useSkill1", s2: "useSkill2", s3: "useSkill3", s4: "useSkill4", s5: "useSkill5", s5b: "useSkill5b" };
  for (const [id, fn] of Object.entries(names)) {
    c[fn] = () => calls.push(id);
  }
  return c;
}

test("idle 이면 즉시 발동한다", () => {
  const buf = new SkillInputBuffer();
  const p = mockCaster("idle");
  buf.queue("s1", 1000);
  assert.equal(buf.flush(p, 1000), true);
  assert.deepEqual(p.calls, ["s1"]);
  assert.equal(buf.pending, null, "발동 후 버퍼가 비어야 한다");
});

test("모션 중이면 보관했다가 idle 이 되면 발동한다", () => {
  const buf = new SkillInputBuffer();
  const p = mockCaster("attack");
  buf.queue("s3", 1000);
  assert.equal(buf.flush(p, 1010), false, "모션 중엔 발동하지 않는다");
  assert.equal(buf.pending, "s3", "입력이 사라지면 안 된다");

  p.state = "idle";
  assert.equal(buf.flush(p, 1200), true);
  assert.deepEqual(p.calls, ["s3"]);
});

test("300ms 를 넘긴 입력은 버린다 (경계값 포함)", () => {
  const buf = new SkillInputBuffer();
  const p = mockCaster("idle");

  // 정확히 300ms — 만료 아님 (원본은 > 비교)
  buf.queue("s2", 1000);
  assert.equal(buf.flush(p, 1000 + SKILL_BUFFER_MS), true, "경계값은 살아 있어야 한다");

  // 301ms — 만료
  buf.queue("s2", 1000);
  assert.equal(buf.flush(p, 1001 + SKILL_BUFFER_MS), false);
  assert.equal(buf.pending, null, "만료된 입력은 비운다");
  assert.deepEqual(p.calls, ["s2"], "만료 입력은 발동하지 않는다");
});

test("플레이어가 없으면 버퍼를 유지한다", () => {
  const buf = new SkillInputBuffer();
  buf.queue("s4", 1000);
  assert.equal(buf.flush(null, 1000), false);
  assert.equal(buf.pending, "s4", "씬 미준비 시 입력을 잃으면 안 된다");
});

test("발동 전에 버퍼를 비워 중복 발동을 막는다", () => {
  const buf = new SkillInputBuffer();
  let reentered = false;
  const p = mockCaster("idle");
  p.useSkill1 = () => {
    p.calls.push("s1");
    // 실행 중 flush 가 다시 불려도 두 번 발동하면 안 된다
    reentered = buf.flush(p, 1000);
  };
  buf.queue("s1", 1000);
  buf.flush(p, 1000);
  assert.deepEqual(p.calls, ["s1"]);
  assert.equal(reentered, false, "재진입 flush 는 발동하지 않아야 한다");
});

test("나중 입력이 이전 입력을 대체한다", () => {
  const buf = new SkillInputBuffer();
  const p = mockCaster("attack");
  buf.queue("s1", 1000);
  buf.queue("s5", 1050); // 대기 중 다른 스킬 — 최신 입력 우선
  p.state = "idle";
  buf.flush(p, 1060);
  assert.deepEqual(p.calls, ["s5"]);
});

test("s5b 제2궁극기도 발동한다", () => {
  const buf = new SkillInputBuffer();
  const p = mockCaster("idle");
  buf.queue("s5b", 1000);
  buf.flush(p, 1000);
  assert.deepEqual(p.calls, ["s5b"]);
});

test("clear() 는 대기 입력을 제거한다", () => {
  const buf = new SkillInputBuffer();
  buf.queue("s1", 1000);
  buf.clear();
  const p = mockCaster("idle");
  assert.equal(buf.flush(p, 1000), false);
  assert.deepEqual(p.calls, []);
});
