/**
 * 보스 바 계약 — 절대 HP 숫자를 보여 주는가.
 *
 * [왜 필요한가]
 *  vc288 이전 보스 바에는 **퍼센트만** 있었다(`{Math.ceil(pct)}%`).
 *  그래서 "체력이 얼마나 남았나"는 알 수 있어도 "이 보스가 원래 얼마나 단단한가"는
 *  알 수 없었다. 후반 보스 HP 가 10만을 넘어가면 1% 차이가 1,000 이라 체감이 안 된다.
 *
 *  유저 요구의 반대편이기도 하다 — "모든 주요 보스는 단순 체력 많은 몬스터가 되어서는
 *  안 된다"는 말은 체력을 **보여 주지 말라**는 뜻이 아니라, 체력 외에 패턴·형태가
 *  있어야 한다는 뜻이다. 체력 수치는 오히려 정직하게 보여 줘야 한다.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const SRC = readFileSync("src/components/game/Overlays.tsx", "utf8");

/** BossBar 함수 본문만 뽑는다 (주석 제거 — 주석에 적힌 예시 문구에 속지 않도록). */
function bossBarBody() {
  const start = SRC.indexOf("export function BossBar");
  assert.ok(start >= 0, "BossBar 컴포넌트를 찾지 못했다");
  /* 다음 export 선언까지 */
  const next = SRC.indexOf("\nexport function", start + 10);
  const raw = SRC.slice(start, next > 0 ? next : undefined);
  /* JSX 주석 {/* ... *\/} 와 // 줄주석을 걷어낸다. */
  return raw
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .split("\n")
    .filter((l) => !/^\s*(\*|\/\/)/.test(l))
    .join("\n");
}

test("보스 바가 hp / maxHp 절대값을 렌더한다", () => {
  const body = bossBarBody();
  assert.match(body, /boss\.hp/, "boss.hp 를 쓰지 않는다 — 절대 HP 가 표시되지 않는다");
  assert.match(body, /boss\.maxHp/, "boss.maxHp 를 쓰지 않는다");
  /* toLocaleString 으로 자릿수 구분 — 100000 vs 100,000 은 가독성이 다르다 */
  assert.match(body, /toLocaleString\(\)/, "큰 수에 자릿수 구분이 없다");
});

test("퍼센트 표시가 사라지지 않았다 (절대값 추가가 기존 정보를 지우면 안 된다)", () => {
  const body = bossBarBody();
  assert.match(body, /pct/, "pct 계산이 사라졌다");
  assert.match(body, /\{Math\.ceil\(pct\)\}%/, "퍼센트 표시가 사라졌다");
});

test("compact(가로 폰)에서는 퍼센트만 유지한다 (좁은 화면 배려)", () => {
  const body = bossBarBody();
  /* HP 표시 블록은 "compact ? (" 바로 뒤에 <>{Math.ceil(pct)}%</> 가 오는 형태다.
   * 위치 추정 대신 그 패턴 자체를 찾는다 — 파일 어디에 있든 잡힌다. */
  assert.match(
    body,
    /compact\s*\?\s*\(\s*<>\{Math\.ceil\(pct\)\}%<\/>\s*\)/,
    "compact 분기가 퍼센트 단독 표시가 아니다 — 좁은 화면에서 HP 숫자까지 나와 넘칠 수 있다",
  );
});

test("HP 가 음수로 표시되지 않는다 (죽는 순간 -1 이 보이면 안 된다)", () => {
  const body = bossBarBody();
  /* Math.max(0, ...) 로 하한을 두거나, pct 처럼 clamp 한 값을 써야 한다. */
  assert.match(
    body,
    /Math\.max\(0,\s*Math\.ceil\(boss\.hp\)\)|Math\.max\(0,[^)]*boss\.hp/,
    "boss.hp 에 0 하한이 없다 — 처치 직후 음수가 표시될 수 있다",
  );
});
