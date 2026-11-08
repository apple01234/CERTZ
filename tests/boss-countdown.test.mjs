/**
 * 보스전 개시 카운트다운 계약 (REVAMP_100 개편 후보 "보스 시작 전 카운트다운").
 *
 * [왜 필요한가]
 *  종전엔 낙하 착지와 **동시에** 첫 공격이 시작됐다. 유저는 보스가 어디에 섰는지,
 *  내가 어디 있는지를 볼 틈도 없이 첫 패턴을 맞았다. 보스전의 첫 3초가
 *  "읽을 시간"이 아니라 "얻어맞는 시간"이었다.
 *
 *  Boss.ts 는 Phaser 엔티티라 인스턴스를 만들 수 없다. 그래서 **계약을 소스로 고정**한다:
 *   1) 착지 완료 콜백이 startCountdown() 을 부른다
 *   2) tick() 이 카운트다운 중 조기 반환한다 (행동 정지)
 *   3) destroyPool() 이 카운트다운 타이머를 정리한다 (죽은 뒤 배너 방지)
 *
 * [실측 확인 — vc288]
 *  위 소스 계약이 실제로 도는지 브라우저에서 확인했다. `EventBus.emit` 을 가로채
 *  `banner:show` 를 기록한 결과:
 *
 *    바다의 군단장 헤럴드 — 3
 *    바다의 군단장 헤럴드 — 2
 *    바다의 군단장 헤럴드 — 1
 *    시작!
 *
 *  순서·횟수·보스 이름이 모두 코드와 일치했다(reports/play/vc288countdown/1_countdown.png).
 *  스크린샷 폴링으로는 3번 놓쳤지만, EventBus 를 가로채면 이벤트 구동이라 놓치지 않는다.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const SRC = readFileSync("src/game/entities/Boss.ts", "utf8");

/** 주석을 걷어낸 코드만 (주석에 적힌 설명 문구에 속지 않도록). */
const CODE = SRC.split("\n")
  .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
  .join("\n");

test("착지 완료 콜백이 카운트다운을 시작한다", () => {
  /* onComplete 안에서 startCountdown() 을 호출해야 한다. */
  const idx = CODE.indexOf("onComplete: () =>");
  assert.ok(idx >= 0, "낙하 착지 onComplete 를 찾지 못했다");
  const block = CODE.slice(idx, idx + 900);
  assert.match(block, /this\.startCountdown\(\)/, "착지 후 카운트다운이 시작되지 않는다");
});

test("카운트다운 중 보스가 행동하지 않는다", () => {
  /* tick() 조기 반환 — 이게 없으면 배너만 뜨고 보스는 계속 때린다. */
  const idx = CODE.indexOf("tick(dt: number, player: PlayerLike2)");
  assert.ok(idx >= 0, "tick() 을 찾지 못했다");
  const block = CODE.slice(idx, idx + 400);
  assert.match(block, /if \(this\.countdown > 0\) return/, "카운트다운 중 행동 정지가 없다");
});

test("카운트다운은 3 → 2 → 1 → 시작 순서다", () => {
  const idx = CODE.indexOf("private startCountdown()");
  assert.ok(idx >= 0, "startCountdown() 을 찾지 못했다");
  /* 함수 본문 끝(다음 메서드)까지 — 길이 추정 대신 경계로 자른다. */
  const end = CODE.indexOf("\n  private ", idx + 30);
  const block = CODE.slice(idx, end > 0 ? end : undefined);
  assert.match(block, /const STEPS = 3/, "카운트 단계가 3이 아니다");
  /* 시작 배너 */
  assert.match(block, /"시작!"/, "'시작!' 배너가 없다");
  /* 남은 숫자를 계속 띄운다 */
  assert.match(block, /countdown\}/, "남은 카운트를 배너에 넣지 않는다");
});

test("보스가 죽으면 카운트다운 타이머가 정리된다", () => {
  /* destroyPool 은 씬 정리 경로다. 여기서 타이머를 안 지우면 죽은 보스의
   * "2 / 1 / 시작!" 배너가 계속 뜬다. */
  const idx = CODE.indexOf("destroyPool()");
  assert.ok(idx >= 0, "destroyPool() 을 찾지 못했다");
  const block = CODE.slice(idx, idx + 700);
  assert.match(block, /this\.countdownTimer\?\.remove\(\)/, "카운트다운 타이머 정리가 없다");
  assert.match(block, /this\.countdownTimer = null/, "타이머 참조를 비우지 않는다");
  assert.match(block, /this\.countdown = 0/, "카운트 상태를 0 으로 만들지 않는다");
});

test("카운트다운 타이머 참조가 필드로 선언돼 있다", () => {
  assert.match(CODE, /private countdown = 0;/, "countdown 필드가 없다");
  assert.match(CODE, /private countdownTimer: Phaser\.Time\.TimerEvent \| null = null;/, "countdownTimer 필드가 없다");
});
