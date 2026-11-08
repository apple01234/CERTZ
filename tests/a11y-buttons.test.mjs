/**
 * 접근성: 버튼이 "접근성 이름"을 갖는지에 대한 계약.
 *
 * [무엇을 고정하나]
 *  화면의 `<button>` 은 접근성 이름이 있어야 스크린리더가 "버튼"이 아니라
 *  "채팅 접기 버튼" 처럼 읽는다. 이름의 우선순위는
 *  aria-label > 텍스트 콘텐츠 > title 이다.
 *
 * [왜 정적 분석이 아니라 실측인가]
 *  정적 정규식으로 "라벨 없는 버튼"을 세려다 **세 번 연속 오탐**했다:
 *    · aria-label 이 다음 줄에 있는 경우를 놓침
 *    · `{mode === "login" ? "로그인" : "..."}` 같은 삼항식 텍스트를 못 읽음
 *    · 여러 줄에 걸친 속성을 한 줄로 자름
 *
 *  그래서 실제 브라우저 DOM 에서 측정했다(헤드리스 Chrome + CDP):
 *    로비 화면   버튼 2개  · 이름 없음 0
 *    인게임 화면 버튼 16개 · 이름 없음 0
 *
 * [그래서 이 테스트가 하는 일]
 *  DOM 측정은 브라우저가 필요해 CI 에서 돌리기 어렵다. 대신 **회귀 방지용 계약**만 둔다:
 *   ① 아이콘 전용 버튼(SVG 만 있는 것)은 aria-label 을 반드시 가진다
 *   ② 그 규칙을 지키는 대표 컴포넌트들이 실제로 그렇게 쓰여 있다
 *
 *  ponytail: 완전한 DOM 감사가 필요하면 헤드리스 브라우저 테스트로 옮긴다.
 *   지금은 규칙 위반을 소스에서 잡는 것으로 충분하다(측정 결과 위반 0).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

/** 파일에서 `<button ...>` 여는 태그를 괄호 균형으로 뽑는다. */
function buttonTags(src) {
  const out = [];
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!/<button\b/.test(lines[i])) continue;
    let tag = "";
    let depth = 0;
    let done = false;
    for (let k = i; k < Math.min(i + 18, lines.length) && !done; k++) {
      const line = lines[k];
      tag += line + "\n";
      for (const ch of line) {
        if (ch === "{") depth++;
        else if (ch === "}") depth--;
      }
      if (depth <= 0 && /\/?>/.test(line) && (k > i || /<button[^>]*\/?>/.test(line))) done = true;
    }
    out.push({ line: i + 1, tag });
  }
  return out;
}

/* 아이콘이 상시 노출되는 대표 컴포넌트들 */
const ICON_HEAVY = [
  "src/components/game/ChatBox.tsx",
  "src/components/game/HUD.tsx",
  "src/components/game/TouchControls.tsx",
];

test("아이콘 전용 버튼은 aria-label 을 가진다", () => {
  const violations = [];
  for (const f of ICON_HEAVY) {
    const src = readFileSync(f, "utf8");
    for (const { line, tag } of buttonTags(src)) {
      /* 여는 태그 안에 svg/img 가 있고 텍스트가 없으면 아이콘 전용 */
      const hasIcon = /<svg|<img|<GameIcon|<Icon/.test(tag);
      const hasText = />[^<>{}]*[가-힣A-Za-z][^<>{}]*</.test(tag);
      if (hasIcon && !hasText && !/aria-label=|title=/.test(tag)) {
        violations.push(`${f}:${line}`);
      }
    }
  }
  assert.deepEqual(violations, [], `아이콘 전용인데 이름이 없는 버튼: ${violations.join(", ")}`);
});

test("ChatBox 접기 버튼은 상태에 따라 라벨이 바뀐다 (열림/닫힘 구분)", () => {
  const src = readFileSync("src/components/game/ChatBox.tsx", "utf8");
  /* 접기 버튼은 collapsed 상태로 라벨·title 이 둘 다 바뀌어야 한다 */
  assert.match(src, /aria-label=\{collapsed \?/, "접기 버튼에 상태별 aria-label 이 없다");
  assert.match(src, /title=\{collapsed \?/, "접기 버튼에 상태별 title 이 없다");
});

test("HUD 스킬/기능 버튼에 aria-label 이 있다", () => {
  const src = readFileSync("src/components/game/HUD.tsx", "utf8");
  const labels = (src.match(/aria-label=/g) || []).length;
  assert.ok(labels >= 5, `HUD 의 aria-label 이 ${labels}개뿐이다 — 기능 버튼이 늘면 라벨도 늘어야 한다`);
});

test("모달/패널에 role 또는 aria-modal 이 있다 (스크린리더가 대화상자로 인식)", () => {
  const panels = readFileSync("src/components/game/Panels.tsx", "utf8");
  const hasRole = /role="dialog"|role="alertdialog"|aria-modal=/.test(panels);
  assert.ok(hasRole, "Panels.tsx 의 모달에 role=\"dialog\" 또는 aria-modal 이 없다");
});
