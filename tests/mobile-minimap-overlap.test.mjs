// 2026-11-15 — 유저 지시 "모바일에서 돌진 버튼이 맵을 가림".
// 돌진 버튼을 하단 버튼 줄에서 빼 공격 버튼 위에 두고, 좁은 가로 화면에서도 [자동+물약]을 줄 위로 올리며,
// 세로 화면에선 미니맵을 버튼 줄 위로 올린다. 브라우저 실측(844×390·667×375·390×844)에서 미니맵 위 버튼 0개.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const touch = readFileSync('src/components/game/TouchControls.tsx', 'utf8');

test('돌진 버튼은 하단 버튼 줄이 아니라 공격 버튼과 같은 세로 묶음에 있다', () => {
  const col = touch.indexOf('<div className="pointer-events-none flex flex-col items-end gap-1.5">');
  assert.ok(col > 0, '공격 세로 묶음 없음');
  const dash = touch.indexOf('{allows("dash") && <button');
  const atk = touch.indexOf('{allows("attack") && <button');
  assert.ok(col < dash && dash < atk, '돌진이 공격 위(같은 묶음)에 있어야 한다');
  /* 스킬 그리드보다 뒤 — 줄 가운데에 끼지 않는다 */
  assert.ok(touch.indexOf('flex flex-wrap-reverse items-end justify-end') < dash);
});

test('가로 휴대폰 폭(760px 미만)에서도 [자동+물약]을 줄 위로 올린다', () => {
  assert.match(touch, /const CLUSTER_FLOAT_W = 760;/);
  assert.equal((touch.match(/window\.innerWidth < CLUSTER_FLOAT_W/g) ?? []).length, 2);
});

test('세로 화면에선 미니맵을 하단 버튼 줄 위로 올린다', () => {
  const ws = readFileSync('src/game/scenes/WorldScene.ts', 'utf8');
  assert.match(ws, /const mmBottom = cam\.height > cam\.width \? 250 : cam\.width < 700 \? 56 : 14;/);
});
