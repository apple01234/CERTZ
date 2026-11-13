import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const poster = read('src/components/game/TitlePoster.tsx');
const css = read('src/app/globals.css');

test('시작 화면 포스터가 참조하는 레이어 이미지가 모두 배포 폴더에 있다', () => {
  const names = [...poster.matchAll(/src\("([a-z0-9]+)"\)/g)].map((m) => m[1]);
  for (const k of ['sky', 'land', 'front', 'slime', 'ornament', 'line1', 'line2', 'line3']) assert.ok(names.includes(k), `${k} 미참조`);
  for (const k of ['mage', 'hero', 'archer']) assert.ok(poster.includes(`k: "${k}"`), `${k} 캐릭터 누락`);
  for (const n of new Set([...names, 'mage', 'hero', 'archer'])) assert.ok(existsSync(new URL(`../public/assets/title/${n}.webp`, import.meta.url)), `${n}.webp 없음`);
});

test('포스터 모션은 움직임 줄이기 설정을 따르고 장식 전용(aria-hidden)이다', () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.tp \*, \.tp-stage \{ animation: none !important; \}/);
  assert.match(poster, /aria-hidden="true" className="tp"/);
});

test('캐릭터·슬라임은 근경 레이어 위에 그려진다(z-order 회귀 방지)', () => {
  assert.match(css, /\.tp-front \{ z-index: 1;/);
  assert.match(css, /\.tp-char\s+\{ z-index: 2;/);
  assert.match(css, /\.tp-slime \{ z-index: 2;/);
});

test('TitleScene 에서 이그드라실 나무·빛·파편 연출이 빠지고 시작/이어하기 이벤트는 유지된다', () => {
  const scene = read('src/game/scenes/TitleScene.ts');
  assert.doesNotMatch(scene, /add\.image\([^)]*"(tree|glow|fragment)"/);
  assert.match(scene, /EventBus\.on\("game:new"/);
  assert.match(scene, /EventBus\.on\("game:continue"/);
});

test('TitleScreen 은 포스터를 렌더하고 접근 가능한 제목·게임 시작 버튼을 유지한다', () => {
  const ov = read('src/components/game/Overlays.tsx');
  assert.match(ov, /<TitlePoster \/>/);
  assert.match(ov, /<h1 className="sr-only">하루는 웨폰마스터가 되었다\.<\/h1>/);
  assert.match(ov, /EventBus\.emit\("lobby:open"\)/);
});
