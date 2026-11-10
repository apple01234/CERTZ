import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

/* vc291 — Windows 하드코딩 경로를 걷어냈다. 종전 `C:\\coding\\CERTZ` 는
 *  개발자 PC 에서만 맞고 리눅스 CI·컨테이너에서는 ENOENT 로 5개 테스트가
 *  통째로 실패했다(경로 문제를 게임 결함으로 오독하게 만든다).
 *  테스트 파일 위치 기준 상대경로로 해석하므로 어느 OS 에서도 맞는다. */
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/* ═══ vc287 — 프롤로그 cinematic:state 짝 맞춤 ═══
 *
 * [왜 필요한가] GameRoot 는 `cinematic:state.active` 하나만 믿고 HUD 를 숨긴다
 *  (GameRoot.tsx:204-209 — "별도 복구 경로 없이 이 플래그만 신뢰한다").
 *  따라서 active:true 가 한 번이라도 짝을 못 맞추면 **HUD 가 영구히 사라진다.**
 *
 * [과거 결함] vc283 1차 구현은 cleanup() 안에서만 active:false 를 발신했다.
 *  그런데 cleanup 에 닿는 길은 next()/skip 두 가지뿐이라, 프롤로그가 떠 있는 채
 *  씬이 내려가면(exitToMenu·재시작·강제 종료) active:true 가 미해제로 남았다.
 *  vc284 에서 events.once("shutdown", ...) 을 추가해 고쳤다.
 *
 * 이 테스트는 그 계약이 되돌려지지 않게 고정한다.
 */
test('black prologue is removed; opening uses the shared cinematic owner', async () => {
  const world = strip(await readFile(path.join(ROOT, "src/game/scenes/WorldScene.ts"), "utf8"));
  assert.equal(world.includes("showPrologue"), false);
  assert.match(world, /playTutorialCinematic/);
  const owner = strip(await readFile(path.join(ROOT, "src/game/fx/sceneCinematic.ts"), "utf8"));
  assert.match(owner, /events.once\("shutdown", shutdown\)/);
  assert.match(owner, /events.off\("shutdown", shutdown\)/);
  assert.match(owner, /announce\(false\)/);
});

test('cinematic:state 는 true/false 쌍으로만 발신된다', async () => {
  const src = await readFile(path.join(ROOT, "src/game/scenes/WorldScene.ts"), "utf8");
  const code = strip(src);
  const trues = (code.match(/cinematic:state["']\s*,\s*\{\s*active:\s*true\s*\}/g) ?? []).length;
  const falses = (code.match(/cinematic:state["']\s*,\s*\{\s*active:\s*false\s*\}/g) ?? []).length;

  assert.ok(trues > 0, "cinematic:state active:true 발신이 없다");
  assert.ok(
    falses >= trues,
    `해제(false) ${falses}건 < 발신(true) ${trues}건 — 짝이 맞지 않으면 HUD 가 영구히 숨는다`,
  );
});

test('GameRoot 는 cinematic:state 만으로 HUD 를 결정한다 (플래그 계약)', async () => {
  const src = await readFile(path.join(ROOT, "src/components/game/useGameUi.ts"), "utf8");
  assert.match(
    strip(src),
    /EventBus\.on\(\s*["']cinematic:state["']/,
    "GameRoot 가 cinematic:state 를 구독하지 않는다",
  );
});
