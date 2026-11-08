/**
 * 보스 격노 오라 계약 (REVAMP_ABC_300 B39 "보스 HP 30% 이하 오라").
 *
 * [왜 필요한가]
 *  `enraged` 플래그는 이미 있었지만 이동속도 1.18배·공격력 0.75배에만 영향을 줬다.
 *  **화면에는 아무 표시가 없었다.** 유저는 갑자기 빨라진 보스를 보며 이유를 알 수
 *  없었고, "내가 뭘 잘못했나" 로 오해하기 쉬웠다. 위기 상태는 눈에 보여야 한다.
 *
 * [동작]
 *  페이즈 3 진입(=HP 33% 이하) 시 보스 발밑에 붉은 2중 고리가 90ms 간격으로 맥동한다.
 *  Graphics 하나를 clear() 후 재사용한다 — 자주 도는 지점이라 매 프레임 새로 만들지 않는다.
 *  보스가 죽거나 씬이 바뀌면 destroyPool() 이 타이머와 그래픽을 함께 정리한다.
 *
 * [검증 방식]
 *  Boss.ts 는 Phaser 엔티티라 인스턴스를 만들 수 없다. 소스 계약으로 고정한다.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const SRC = readFileSync("src/game/entities/Boss.ts", "utf8");

/** 주석을 제거한 실제 코드만 남긴다 (주석에 적힌 설명을 코드로 오인하지 않도록). */
function codeOnly(src) {
  return src
    .split("\n")
    .filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l))
    .join("\n");
}

/** `private NAME(` 부터 다음 `\n  private ` 경계까지 잘라낸다. */
function methodBody(name) {
  const code = codeOnly(SRC);
  const start = code.indexOf(`private ${name}(`);
  if (start < 0) return null;
  const rest = code.slice(start);
  const next = rest.indexOf("\n  private ", 1);
  return next > 0 ? rest.slice(0, next) : rest;
}

test("격노 오라 필드가 있다", () => {
  assert.match(SRC, /private enrageAura:\s*Phaser\.GameObjects\.Graphics \| null = null;/);
  assert.match(SRC, /private enrageAuraTimer:\s*Phaser\.Time\.TimerEvent \| null = null;/);
});

test("페이즈 3 진입 시 격노 오라를 켠다", () => {
  const code = codeOnly(SRC);
  /* enraged = true 와 startEnrageAura() 가 같은 블록 안에 있어야 한다.
   * 둘 중 하나만 있으면 "빨라졌는데 이유를 모르는" 상태로 되돌아간다. */
  const idx = code.indexOf("this.enraged = true;");
  assert.ok(idx >= 0, "enraged = true 가 없다");
  const around = code.slice(idx, idx + 400);
  assert.match(around, /this\.startEnrageAura\(\);/, "격노 시 오라를 켜지 않는다");
});

test("오라는 Graphics 를 재사용한다 (매 틱 새로 만들지 않는다)", () => {
  const body = methodBody("startEnrageAura");
  assert.ok(body, "startEnrageAura 메서드를 찾지 못했다");
  /* 한 번 만들고 clear() 로 다시 그린다 */
  assert.match(body, /this\.scene\.add\.graphics\(\)/, "Graphics 를 만들지 않는다");
  assert.match(body, /\.clear\(\)/, "clear() 로 재사용하지 않는다 — 매 틱 할당하면 GC 부담");
  /* 타이머 콜백 안에서 add.graphics 를 또 만들면 매 틱 누수다 */
  const cbStart = body.indexOf("callback:");
  assert.ok(cbStart > 0, "타이머 콜백이 없다");
  const cb = body.slice(cbStart);
  assert.ok(
    !/add\.graphics\(\)/.test(cb),
    "콜백 안에서 Graphics 를 새로 만든다 — 매 90ms 마다 객체가 쌓인다",
  );
});

test("오라는 보스 뒤에 깔린다 (스프라이트를 가리지 않는다)", () => {
  const body = methodBody("startEnrageAura");
  assert.match(body, /setDepth\(this\.depth - 1\)/, "보스 앞에 그려 스프라이트를 가린다");
});

test("보스가 죽으면 오라가 정리된다", () => {
  /* 사망 후에도 붉은 고리가 남으면 시체가 계속 맥동한다. */
  const code = codeOnly(SRC);
  const idx = code.indexOf("destroyPool(");
  assert.ok(idx >= 0, "destroyPool 이 없다");
  const pool = code.slice(idx);
  assert.match(pool, /this\.enrageAuraTimer\?\.remove\(\)/, "오라 타이머를 정리하지 않는다");
  assert.match(pool, /this\.enrageAura\?\.destroy\(\)/, "오라 그래픽을 파괴하지 않는다");
  assert.match(pool, /this\.enrageAura = null;/, "오라 참조를 비우지 않는다");
});
