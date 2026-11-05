import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 연출 대사창 UI — "AI 티 나지 않게" 개선 (vc250, 지시 #5).
 *
 * [무엇이 AI 티였나 — 실제 코드에서 확인한 것]
 *  1) 매 줄마다 조작 설명문이 깔려 있었다:
 *     "스페이스·탭으로 건너뛰기 (꾹 누르면 빠르게)" / "...계속 ▸ (꾹 누르면 빠르게)" / "...닫기"
 *     → 사람이 만든 게임은 아는 조작법을 문장으로 반복 설명하지 않는다.
 *       게다가 줄마다 문장 길이가 달라 하단 정렬이 흔들린다.
 *  2) 타이핑 중 커서가 텍스트 편집기 문자 `▌`(U+258C) 였다.
 *     → "입력 중"으로 읽혀 대사창이 폼 필드처럼 보인다.
 *  3) 초상화가 `h-14 w-14 self-start` 로 고정 높이라, 긴 대사에서 텍스트 블록과
 *     기준선이 어긋나 프레임이 떠 보였다.
 *
 * [수정 원칙] 조작법은 **문장이 아니라 기호**로. 진행은 깜빡이는 화살표(▸/✕),
 *  키 힌트는 첫 줄에서 한 번만. 커서는 얇은 막대. 초상화는 stretch.
 */

const ROOT = path.resolve(import.meta.dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('조작 설명문이 대화창에서 사라졌다', () => {
  const src = read('src/components/game/DialogueBox.tsx');
  /* 주석(설명)에는 사유가 적혀 있으므로 제외하고, 실제 JSX 문자열만 검사한다 */
  const code = src
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith('*') && !t.startsWith('/*') && !t.startsWith('//') && !t.startsWith('{/*');
    })
    .join('\n');
  for (const bad of ['건너뛰기 (꾹 누르면 빠르게)', '계속 ▸ (꾹 누르면 빠르게)', '스페이스·탭으로 닫기']) {
    assert.equal(code.includes(bad), false, `조작 설명문이 남아 있다: ${bad}`);
  }
});

test('진행 표시는 기호로 한다', () => {
  const src = read('src/components/game/DialogueBox.tsx');
  /* 마지막 줄이면 ✕, 아니면 ▸ — 문장이 아닌 기호 */
  assert.ok(src.includes('"▸"'), '계속 기호(▸)가 없다');
  assert.ok(src.includes('"✕"'), '닫기 기호(✕)가 없다');
  /* 깜빡임은 CSS 키프레임(dialogueNudge)으로 */
  assert.ok(src.includes('dialogueNudge'), '진행 애니메이션 참조가 없다');
  const css = read('src/app/globals.css');
  assert.match(css, /@keyframes dialogueNudge/);
  /* 접근성: 장식이므로 aria-hidden */
  assert.match(src, /aria-hidden="true"[\s\S]{0,200}▸|aria-hidden="true"[\s\S]{0,200}✕/);
});

test('타이핑 커서가 텍스트 편집기 문자(▌)가 아니다', () => {
  const src = read('src/components/game/DialogueBox.tsx');
  assert.equal(src.includes('"▌"'), false, '텍스트 커서 문자(▌)가 남아 있다');
  /* 얇은 막대로 대체 */
  assert.match(src, /w-\[2px\]/);
});

test('초상화가 텍스트 블록 높이에 맞춰 늘어난다', () => {
  const src = read('src/components/game/DialogueBox.tsx');
  /* self-start + 고정 h-14 는 긴 대사에서 어긋난다 */
  assert.equal(/h-14 w-14 shrink-0 self-start/.test(src), false, '고정 높이 초상화가 남아 있다');
  assert.match(src, /self-stretch/);
});

test('조작 키 안내는 첫 줄에서 한 번만 나온다', () => {
  const src = read('src/components/game/DialogueBox.tsx');
  /* idx === 0 조건이 있어야 매 줄 반복되지 않는다 */
  assert.match(src, /idx === 0 && shown\.length >= line\.length/);
});

test('키보드 조작(스페이스/엔터)은 그대로 동작한다', () => {
  /* UI 문구만 바꾸고 실제 조작을 깨면 안 된다 */
  const src = read('src/components/game/DialogueBox.tsx');
  assert.match(src, /e\.code === "Space"/);
  assert.match(src, /e\.code === "Enter"/);
});
