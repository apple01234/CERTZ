import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 레벨 잠금 UI 일관성 — vc247 (지시 #11) 회귀 방지.
 *
 * [요구] "레벨 제한 기능은 잠금 아이콘과 흑백 UI로 표시"
 *  첨부 참고자료(컨텐츠/인벤토리 UI)의 패턴:
 *   · 카드/버튼 외형은 유지(회색 박스로 바꾸지 않음) — 차단이 아니라 "예고된 해금"
 *   · 아이콘은 딤(grayscale) 처리하되 윤곽은 남김
 *   · 자물쇠를 얹고 "Lv.N에 열립니다"(긍정형)로 표기, 레벨 숫자만 노란색
 *
 * [왜 테스트인가] HUD 버튼은 10개가 넘고 개별 인라인 조건으로 잠금을 붙였다.
 *  새 버튼을 추가할 때 잠금 표시를 빠뜨리면 조용히 회귀한다.
 *  또 잠금 규칙이 unlocks.ts 한 곳에서 오는지(이중 관리 금지)를 강제한다.
 */

const ROOT = path.resolve(import.meta.dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('잠금 표시는 공용 컴포넌트 한 곳에서 만든다', () => {
  const lock = read('src/components/game/LockBadge.tsx');
  assert.ok(lock.includes('export function LockBadge'));
  assert.ok(lock.includes('export function LockReason'));
  /* 참고 UI 의 긍정형 문구를 쓴다 — "잠겼습니다" 같은 부정형이 아니라 */
  assert.match(lock, /에 열립니다/);
  assert.equal(lock.includes('잠겼습니다'), false, '부정형 문구가 들어갔다');
  /* 레벨 숫자만 강조 */
  assert.match(lock, /text-amber-300/);
});

test('자물쇠 아이콘이 실제로 존재한다', () => {
  const icon = read('src/components/game/GameIcon.tsx');
  assert.ok(icon.includes('"lock"'), 'lock 아이콘 타입이 없다');
  /* SVG 로 그린다 — 팩에 자물쇠가 없어서 */
  assert.match(icon, /name === "lock"/);
  assert.match(icon, /<svg/);
  /* 딤 처리가 다른 아이콘과 동일해야 한다 */
  assert.match(icon, /opacity-35 grayscale/);
});

test('HUD 가 잠금을 unlocks.ts 규칙으로만 판정한다', () => {
  const hud = read('src/components/game/HUD.tsx');
  assert.ok(hud.includes('unlockLevel'), 'unlockLevel 을 쓰지 않는다');
  assert.ok(hud.includes('isLocked'), 'isLocked 헬퍼가 없다');
  /* 개별 하드코딩 레벨 금지 — 규칙은 unlocks.ts 한 곳 */
  const hardcoded = hud.match(/hud\.lv\s*[<>]=?\s*\d{2,}/g) ?? [];
  assert.deepEqual(hardcoded, [], `HUD 에 하드코딩 레벨 비교가 있다: ${hardcoded.join(', ')}`);
});

test('잠금 대상 기능들이 HUD 에서 표시된다', () => {
  const hud = read('src/components/game/HUD.tsx');
  /* unlocks.ts 에 있는 주요 기능이 HUD 에서 잠금 표시를 갖는지 */
  for (const f of ['content', 'boss', 'union', 'trade', 'rank', 'quest']) {
    assert.ok(hud.includes(`isLocked("${f}")`), `${f} 잠금 표시가 없다`);
  }
});

test('잠긴 기능 클릭 시 안내가 뜬다(막다른 느낌 방지)', () => {
  const panels = read('src/components/game/Panels.tsx');
  assert.ok(panels.includes('LockedPanelNotice'), '잠금 안내 컴포넌트가 없다');
  assert.match(panels, /LockReason/);
  /* 패널 게이트가 unlockLevel 을 참조 */
  assert.match(panels, /unlockLevel\(gate\)/);
});

test('바르가 난이도 잠금에 자물쇠가 붙는다', () => {
  const panels = read('src/components/game/Panels.tsx');
  const idx = panels.indexOf('park.lv < d.minLv');
  assert.ok(idx > 0, '바르가 잠금 판정을 못 찾았다');
  const seg = panels.slice(idx, idx + 1400);
  assert.ok(seg.includes('<GameIcon name="lock"'), '자물쇠 아이콘이 없다');
  assert.ok(seg.includes('LockReason'), '잠금 사유가 공용 컴포넌트를 쓰지 않는다');
});
