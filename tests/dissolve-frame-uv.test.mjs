/**
 * vc271 — 몬스터 사망 dissolve 가 아틀라스 전체를 그리던 버그 회귀 고정.
 *
 * 실제 버그: spawnDissolve 가 opts.frame 을 받고도 쓰지 않아 셰이더가 UV 0..1,
 * 즉 **아틀라스 전체**를 샘플링했다. 그래서 사망 이펙트에 타일맵·다른 스프라이트가 튀었다.
 *
 * 이 테스트는 소스 계약을 검사한다(실제 GPU 렌더는 헤드리스로 확인할 수 없다):
 *  1) 프래그먼트가 uUV 로 uv 를 변환해 텍스처를 샘플링한다.
 *  2) 프레임 UV 사각형을 프레임 cut 값에서 계산해 유니폼으로 넘긴다.
 *  3) frame 이 없으면 0..1 로 남아 단일 이미지 텍스처가 깨지지 않는다.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const src = readFileSync('src/game/fx/DissolveFX.ts', 'utf8');

test('프래그먼트가 프레임 UV 사각형으로 텍스처를 샘플링한다', () => {
  assert.match(src, /uniform\s+vec4\s+uUV/, 'uUV 유니폼이 선언되어야 한다');
  assert.match(src, /mix\(uUV\.xy,\s*uUV\.zw,\s*outTexCoord\)/, 'uv 를 프레임 사각형으로 변환해야 한다');
  assert.match(src, /texture2D\(uTex,\s*uv\)/, '변환한 uv 로 샘플링해야 한다');
  // 아틀라스 전체를 그대로 쓰는 종전 경로가 남아 있으면 버그가 되살아난다.
  assert.doesNotMatch(src, /vec4\s+src\s*=\s*texture2D\(uTex,\s*outTexCoord\)/, '프레임 무시 경로가 남아 있으면 안 된다');
});

test('프레임 cut 값에서 UV 사각형을 계산해 유니폼으로 넘긴다', () => {
  assert.match(src, /cutX/, '프레임의 cutX 를 읽어야 한다');
  assert.match(src, /cutWidth/);
  assert.match(src, /cutHeight/);
  assert.match(src, /setUniform\("uUV",\s*\[/, 'uUV 를 실제로 넘겨야 한다');
});

test('frame 이 없을 때는 0..1 기본값을 유지한다', () => {
  assert.match(src, /let\s+uv\s*=\s*\{\s*x0:\s*0,\s*y0:\s*0,\s*x1:\s*1,\s*y1:\s*1\s*\}/,
    'frame 미지정 시 전체 텍스처를 쓰는 기본값이 필요하다');
});

test('호출부가 프레임 이름을 넘긴다', () => {
  const enemy = readFileSync('src/game/entities/Enemy.ts', 'utf8');
  assert.match(enemy, /frame:\s*this\.frame\?\.name/, 'Enemy 가 현재 프레임 이름을 넘겨야 한다');
});
