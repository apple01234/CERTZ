/**
 * 보스 방어막 남은시간 게이지 계약 (REVAMP_100 개편 후보 "보스 방어막 게이지").
 *
 * [왜 필요한가]
 *  심연의 결정 방어막(ShieldCast)은 **시간제 무적**이다 — 2.6초(카오스) / 3.2초.
 *  종전엔 배너로 "피해 무효"만 알려 주고 **언제 끝나는지**는 알 수 없었다.
 *  그래서 플레이어는 헛스윙만 하다가 종료 직후 반격(MagicBurst)을 맞았다.
 *
 * [설계 판단]
 *  방어막을 "HP 게이지"로 바꾸지 않았다. 그건 밸런스 변경이고, 현재 계약은
 *  "시간제 무적"이다. 대신 남은 시간을 오라 바깥 링의 각도로 그린다.
 *  남은 시간의 단일 출처는 `modeTimer` 이며, 게이지는 그것을 **읽기만** 한다.
 *
 * [정리]
 *  게이지와 타이머는 doShieldBurst(정상 종료)와 destroyPool(씬 전환·사망) 양쪽에서
 *  정리돼야 한다. 한쪽만 하면 파란 호가 허공에 남는다.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const SRC = readFileSync("src/game/entities/Boss.ts", "utf8");
const CODE = SRC.split("\n")
  .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
  .join("\n");

/** 메서드 본문을 다음 메서드 경계까지 자른다. */
function methodBody(sig) {
  const idx = CODE.indexOf(sig);
  assert.ok(idx >= 0, `${sig} 를 찾지 못했다`);
  const end = CODE.indexOf("\n  private ", idx + sig.length);
  const endPub = CODE.indexOf("\n  destroyPool(", idx + sig.length);
  const cands = [end, endPub].filter((x) => x > 0);
  return CODE.slice(idx, cands.length ? Math.min(...cands) : undefined);
}

test("방어막 게이지 필드가 선언돼 있다", () => {
  assert.match(CODE, /private shieldGauge: Phaser\.GameObjects\.Graphics \| null = null;/, "shieldGauge 필드가 없다");
  assert.match(CODE, /private shieldGaugeTimer: Phaser\.Time\.TimerEvent \| null = null;/, "shieldGaugeTimer 필드가 없다");
});

test("게이지가 남은 시간을 modeTimer 에서 읽는다 (중복 계산 금지)", () => {
  const b = methodBody("private startShieldCast()");
  assert.match(b, /this\.modeTimer\s*\/\s*shieldMs/, "modeTimer 비율로 그리지 않는다 — 남은 시간이 실제와 어긋난다");
  /* shieldMs 는 setMode 에 넣은 값과 같아야 한다 */
  assert.match(b, /const shieldMs = this\.chaos \? 2600 : 3200/, "shieldMs 가 setMode 값과 다르다");
  assert.match(b, /setMode\("shieldHold", this\.chaos \? 2600 : 3200\)/, "setMode 지속시간이 바뀌었다 — shieldMs 도 같이 고쳐야 한다");
});

test("게이지가 실제로 그려진다 (빈 Graphics 만 만들고 끝나지 않는다)", () => {
  const b = methodBody("private startShieldCast()");
  assert.match(b, /g\.lineStyle\(/, "선 스타일이 없다");
  assert.match(b, /g\.arc\(/, "호를 그리지 않는다");
  assert.match(b, /g\.strokePath\(\)/, "stroke 를 호출하지 않는다");
  assert.match(b, /g\.clear\(\)/, "매 틱 지우지 않으면 호가 겹쳐 쌓인다");
});

test("방어막 종료 시 게이지가 정리된다", () => {
  const b = methodBody("private doShieldBurst(");
  assert.match(b, /this\.shieldGaugeTimer\?\.remove\(\)/, "doShieldBurst 가 타이머를 정리하지 않는다");
  assert.match(b, /this\.shieldGauge\?\.destroy\(\)/, "doShieldBurst 가 Graphics 를 파괴하지 않는다");
  assert.match(b, /this\.shieldGauge = null/, "doShieldBurst 가 참조를 비우지 않는다");
});

test("씬 정리 시에도 게이지가 정리된다 (허공에 남지 않도록)", () => {
  const b = methodBody("destroyPool(");
  assert.match(b, /this\.shieldGaugeTimer\?\.remove\(\)/, "destroyPool 이 타이머를 정리하지 않는다");
  assert.match(b, /this\.shieldGauge\?\.destroy\(\)/, "destroyPool 이 Graphics 를 파괴하지 않는다");
});
