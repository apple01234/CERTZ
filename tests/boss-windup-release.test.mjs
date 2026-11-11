/**
 * vc275 — 보스 예고(windup)/발동(release) 애니메이션 회귀 고정.
 *
 * 요청 6번("보스 모션 및 프레임 갯수 증가")에 대해 **새 그림을 만들지 않고** 기존 4프레임을
 * 재조합하는 방식으로 대응했다. 여기서는 그 계약이 지켜지는지 확인한다.
 *
 * 실제 버그(이번에 발견): 실행 코드는 `windup`/`release` 애니메이션 키를 요구하는데
 * registerStoryBosses 가 그 키를 **등록하지 않아** 항상 idle 로 폴백됐다 → 연출 변화가 없었다.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const src = readFileSync('src/game/fx/storyBossAssets.ts', 'utf8');
const boss = readFileSync('src/game/entities/Boss.ts', 'utf8');

test('windup/release 애니메이션을 등록한다', () => {
  assert.match(src, /`\$\{b\.texture\}-windup`/, 'windup 키를 등록해야 한다');
  assert.match(src, /`\$\{b\.texture\}-release`/, 'release 키를 등록해야 한다');
});

test('windup 은 attack 프레임을 역순으로 재생한다(예비동작)', () => {
  const m = /const windup[\s\S]{0,400}?frames:\s*\[([^\]]+)\]/.exec(src);
  assert.ok(m, 'windup 프레임 목록이 있어야 한다');
  const order = m[1].split(',').map((s) => Number(s.trim()));
  assert.deepEqual(order, [3, 2, 1, 0], 'windup 은 3→0 역순이어야 한다');
});

test('release 는 정방향 1회 재생이다', () => {
  const m = /const release[\s\S]{0,400}?frames:\s*\[([^\]]+)\][\s\S]{0,200}?repeat:\s*(-?\d+)/.exec(src);
  assert.ok(m, 'release 프레임/반복 설정이 있어야 한다');
  assert.deepEqual(m[1].split(',').map((s) => Number(s.trim())), [0, 1, 2, 3], 'release 는 0→3 정방향');
  assert.equal(Number(m[2]), 0, 'release 는 한 번만 재생해야 한다');
});

test('Boss 실행 코드가 windup/release 키를 실제로 사용한다', () => {
  assert.match(boss, /windup.*release|release.*windup/, 'Boss 가 두 키를 분기해야 한다');
  assert.match(boss, /storyReleaseAt/, '예고 만료 시점을 보관해야 한다');
});

test('기존 atk 루프 애니메이션은 유지된다', () => {
  // 다른 경로가 atk 를 쓰므로 제거하면 안 된다.
  assert.match(src, /\["atk",\s*"attack",\s*9\]/, 'atk 루프 등록을 유지해야 한다');
});
