// 대화 선택지 방향키 — 키보드 내비게이션 계약 + 인덱스 이동 순수 로직
// 실행: node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs --test tests/dialogue-choice-keys.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
/** 주석을 걷어낸 실제 코드만 남긴다 (주석 속 옛 규칙/설명에 테스트가 속지 않게). */
const codeOnly = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

let checks = 0;
const ok = (name, cond) => { assert.ok(cond, `✗ ${name}`); checks++; };
const eq = (n, a, b) => { assert.deepEqual(a, b, `✗ ${n}`); checks++; };

/* ═══ 1. 선택지 인덱스 이동 규칙 (컴포넌트와 같은 산식) ═══
 * DialogueBox 는 setChoiceIdx((i) => (i+1) % n) / ((i-1+n) % n) 을 쓴다.
 * 여기서 같은 식을 재현해 **래핑**이 맞는지 수치로 고정한다. */
{
  const down = (i, n) => (i + 1) % n;
  const up = (i, n) => (i - 1 + n) % n;
  const N = 3;
  eq("↓ 0→1", down(0, N), 1);
  eq("↓ 1→2", down(1, N), 2);
  eq("↓ 2→0 (마지막에서 처음으로)", down(2, N), 0);
  eq("↑ 0→2 (처음에서 마지막으로)", up(0, N), 2);
  eq("↑ 1→0", up(1, N), 0);
  eq("↑ 2→1", up(2, N), 1);
  /* N=2 */
  eq("N2 ↓ 0→1", down(0, 2), 1);
  eq("N2 ↓ 1→0", down(1, 2), 0);
  eq("N2 ↑ 0→1", up(0, 2), 1);
  /* N=1 은 항상 0 (선택지 하나면 이동 없음) */
  eq("N1 ↓ 0→0", down(0, 1), 0);
  eq("N1 ↑ 0→0", up(0, 1), 0);
  /* 인덱스는 항상 [0, n) 범위 — 어떤 반복에서도 이탈 없음 */
  let bad = 0;
  for (const n of [1, 2, 3, 4, 5]) {
    let i = 0;
    for (let k = 0; k < 50; k++) {
      i = down(i, n); if (i < 0 || i >= n) bad++;
      i = up(i, n); if (i < 0 || i >= n) bad++;
    }
  }
  eq("반복 이동 후에도 인덱스가 범위를 벗어나지 않는다", bad, 0);
}

/* ═══ 2. 소스 계약 — DialogueBox 가 실제로 키보드 내비게이션을 갖는가 ═══ */
{
  const src = codeOnly(read("src/components/game/DialogueBox.tsx"));

  /* (a) 키 핸들러가 있고 ArrowUp/ArrowDown 을 **e.code** 로 판정한다 (한글 IME 안전) */
  ok("keydown 리스너 등록", /addEventListener\(\s*["']keydown["']/.test(src));
  ok("ArrowDown 을 e.code 로 판정", /e\.code\s*===\s*["']ArrowDown["']/.test(src));
  ok("ArrowUp 을 e.code 로 판정", /e\.code\s*===\s*["']ArrowUp["']/.test(src));
  ok("Enter/NumpadEnter/Space 확정", /["']Enter["']/.test(src) && /["']NumpadEnter["']/.test(src) && /["']Space["']/.test(src));
  ok("preventDefault 로 기본동작 차단", /preventDefault\(\)/.test(src));

  /* (b) 입력 포커스 중 무시 */
  ok("input/textarea 포커스 중 무시", /HTMLInputElement/.test(src) && /HTMLTextAreaElement/.test(src));

  /* (c) 선택 상태가 실제 이벤트와 연결 */
  ok("dialogue:choice 발신", /emit\(\s*["']dialogue:choice["']/.test(src));
  ok("dialogue:done 발신", /emit\(\s*["']dialogue:done["']/.test(src));

  /* (d) 시각적 강조 — 선택 항목에만 ▸ 마커와 강조 클래스 */
  ok("선택 항목에 ▸ 마커", /▸/.test(read("src/components/game/DialogueBox.tsx")));
  ok("선택 상태로 클래스 분기", /sel\s*\?/.test(src));
  ok("테두리 강조 클래스", /border-\[#ffd98a\]/.test(src));

  /* (e) 터치/마우스 경로 유지 */
  ok("onPointerDown 유지 (터치 지원)", /onPointerDown/.test(src));

  /* (f) ★ 게임 이동 잠금 — 기존 ui:panelKeys 재사용 (새 이벤트 아님) */
  ok("ui:panelKeys 로 게임 이동 잠금", /emit\(\s*["']ui:panelKeys["']/.test(src));
  ok("잠금 해제(active:false) 있음", /active:\s*false/.test(src));

  /* (g) 조건부 훅 금지 — 훅은 early return 위에 있어야 한다.
   *  실제 소스의 줄 위치로 비교한다(공백/개행 문자열 매칭은 취약). */
  const lines = read("src/components/game/DialogueBox.tsx").split("\n");
  const isComment = (l) => /^\s*(\/\/|\*|\/\*)/.test(l);
  const retLine = lines.findIndex((l) => !isComment(l) && /if \(!dialogue\) return null/.test(l));
  const hookLine = lines.findIndex((l) => !isComment(l) && /if \(!hasChoices\)\s*return;/.test(l));
  ok("early return 이 존재", retLine > 0);
  ok("내비게이션 훅이 early return 위에 있다", hookLine > 0 && hookLine < retLine);
}

/* ═══ 3. WorldScene 이 ui:panelKeys 를 실제로 소비하는가 (재사용 전제 검증) ═══ */
{
  const ws = read("src/game/scenes/WorldScene.ts");
  ok("WorldScene 이 ui:panelKeys 를 구독한다", /EventBus\.on\(\s*["']ui:panelKeys["']/.test(ws));
  ok("WorldScene 이 해제도 한다", /EventBus\.off\(\s*["']ui:panelKeys["']/.test(ws));
}

/* ═══ 4. 기존 패턴(Panels.useListNav)과 같은 규칙을 쓰는지 ═══ */
{
  const panels = codeOnly(read("src/components/game/Panels.tsx"));
  const dlg = codeOnly(read("src/components/game/DialogueBox.tsx"));
  for (const key of ["ArrowDown", "ArrowUp"]) {
    ok(`Panels 와 DialogueBox 모두 ${key} 를 e.code 로 본다`,
      new RegExp(`e\\.code\\s*===\\s*["']${key}["']`).test(panels) &&
      new RegExp(`e\\.code\\s*===\\s*["']${key}["']`).test(dlg));
  }
  ok("Panels 도 ui:panelKeys 를 쓴다 (동일 게이트)", /["']ui:panelKeys["']/.test(panels));
}

console.log(`dialogue-choice-keys: ${checks} checks OK`);
