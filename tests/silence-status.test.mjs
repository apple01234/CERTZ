/**
 * 침묵(스킬 봉인) 상태이상 계약 (REVAMP_100 개편 후보 "침묵당한 손쓸 수 없음").
 *
 * [왜 필요한가]
 *  지금까지 상태이상은 중독·출혈·감속뿐이라 플레이어는 **항상 스킬을 쓸 수 있었다.**
 *  그래서 위협이 "체력이 줄어든다" 하나로 수렴했다. 침묵이 있으면 "지금은 스킬을
 *  아끼고 평타로 버텨야 한다"는 판단이 생긴다 — 전투에 선택지가 늘어난다.
 *
 * [설계 판단]
 *  스킬만 막고 이동·평타는 그대로 둔다. 둘까지 막으면 진짜 "손쓸 수 없음"이 되어
 *  조작 불능이 된다(재미가 아니라 짜증).
 *  지속시간은 중첩하지 않고 더 긴 쪽을 쓴다 — 짧은 침묵이 긴 침묵을 깎으면 안 된다.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const PLAYER = readFileSync("src/game/entities/Player.ts", "utf8");
const PLAYER_CODE = PLAYER.split("\n")
  .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
  .join("\n");
const BOSS = readFileSync("src/game/entities/Boss.ts", "utf8");
const BOSS_CODE = BOSS.split("\n")
  .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
  .join("\n");

test("침묵 필드와 접근자가 있다", () => {
  assert.match(PLAYER_CODE, /private silenceMs = 0;/, "silenceMs 필드가 없다");
  assert.match(PLAYER_CODE, /applySilence\(ms: number\)/, "applySilence 가 없다");
  assert.match(PLAYER_CODE, /isSilenced\(\): boolean/, "isSilenced 가 없다");
  assert.match(PLAYER_CODE, /silenceRemain\(\): number/, "silenceRemain 이 없다");
});

test("침묵은 더 긴 쪽으로만 갱신된다 (짧은 침묵이 긴 침묵을 깎지 않는다)", () => {
  const idx = PLAYER_CODE.indexOf("applySilence(ms: number)");
  assert.ok(idx >= 0, "applySilence 를 찾지 못했다");
  const block = PLAYER_CODE.slice(idx, idx + 400);
  assert.match(block, /Math\.max\(this\.silenceMs, ms\)/, "중첩 규칙이 Math.max 가 아니다");
  assert.match(block, /if \(ms <= 0\) return/, "0 이하 입력 가드가 없다");
});

test("모든 스킬 진입점이 침묵에 막힌다 (6곳)", () => {
  /* 새 스킬이 추가되면 여기 숫자가 늘어난다 — 그때 가드를 빠뜨리면 잡힌다.
   *
   * 주의 1: useSkill5 는 블록 주석 종료 기호와 같은 줄에 있어서
   *   주석 줄을 제거한 CODE 에서 통째로 사라진다. 그래서 원본 소스에서 찾는다.
   * 주의 2: 가드는 `isSilenced()` 메서드 호출이 아니라 **필드 직접 검사**다.
   *   tests/rea-skill-runtime.test.mjs 가 Player 메서드 일부만 추출해 가짜 클래스로
   *   실행하는데, 추출 목록에 없는 메서드를 부르면 그 테스트가 깨진다(실제로 깨졌다).
   *   `this.silenceMs > 0` 은 가짜 객체에서 undefined > 0 === false 라 안전하다. */
  const entries = ["useSkill1()", "useSkill2()", "useSkill3()", "useSkill4()", "useSkill5()", "useSkill5b()"];
  for (const e of entries) {
    const idx = PLAYER.indexOf(e);
    assert.ok(idx >= 0, `${e} 를 찾지 못했다`);
    const body = PLAYER.slice(idx, idx + 220);
    assert.match(body, /if \(this\.silenceMs > 0\) return/, `${e} 에 침묵 가드가 없다`);
  }
});

test("침묵 잔여시간이 틱마다 줄어든다 (영구 봉인 방지)", () => {
  assert.match(
    PLAYER_CODE,
    /this\.silenceMs = Math\.max\(0, this\.silenceMs - ms\)/,
    "silenceMs 감소가 없다 — 한 번 걸리면 영구히 스킬을 못 쓴다",
  );
});

test("HUD 가 침묵을 표시한다 (버튼이 왜 안 눌리는지 알 수 있어야 한다)", () => {
  const hud = readFileSync("src/components/game/HUD.tsx", "utf8");
  assert.match(hud, /침묵/, "HUD 에 침묵 라벨이 없다");
  const bus = readFileSync("src/components/game/EventBus.ts", "utf8");
  assert.match(bus, /"poison" \| "bleed" \| "slow" \| "silence"/, "HudState.dots 타입에 silence 가 없다");
});

test("WorldScene 이 침묵을 hud 로 내보낸다", () => {
  const w = readFileSync("src/game/scenes/WorldScene.ts", "utf8");
  assert.match(w, /kind: "silence"/, "WorldScene 이 silence 를 dots 에 넣지 않는다");
  assert.match(w, /silenceRemain\(\)/, "Player.silenceRemain 을 읽지 않는다");
});

test("보스가 침묵을 실제로 건다 (상태이상이 죽은 코드가 아니다)", () => {
  /* 방어막 반격에서 건다 — "방어막 뒤에 뭔가 온다"를 배우게 하는 지점.
   * 본문에 주석이 길어 고정 길이로 자르면 놓친다(실제로 겪었다). 경계로 자른다. */
  const idx = BOSS.indexOf("private doShieldBurst(");
  assert.ok(idx >= 0, "doShieldBurst 를 찾지 못했다");
  const end = BOSS.indexOf("\n  private ", idx + 20);
  const block = BOSS.slice(idx, end > 0 ? end : idx + 3000);
  assert.match(block, /player\.applySilence\?\.\(/, "보스가 applySilence 를 호출하지 않는다");
});

test("PlayerLike2 가 applySilence 를 optional 로 선언한다 (테스트 더미 호환)", () => {
  assert.match(BOSS_CODE, /applySilence\?\(ms: number\): void;/, "PlayerLike2 에 applySilence 가 없다");
});
