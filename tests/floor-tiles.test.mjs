import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

/**
 * 바닥 텍스처 회귀 — vc252 (지시 #1 "타일맵 배치가 어색하고 오브젝트가 잘리지 않음").
 *
 * [실제 문제] `ground_slate`·`ground_ash` 는 96×96 이지만 **100% 순수 회색조**이고
 *  색이 75~95단계로 흩어진 Perlin 노이즈를 3배 확대한 것이었다. 돌의 경계·줄눈·하이라이트가
 *  전혀 없어서, 맵에 깔면 바닥이 아니라 **회색 노이즈/정전기**로 보인다.
 *  이 둘이 `tile_dark`·`tile_stone`·`tile_path_dark`·`tile_basalt`·`tile_ash` 의 기본값이라
 *  어두운 스테이지(동굴·폐허·용암) 대부분이 노이즈 바닥이 된다.
 *
 * [수리] 품질이 검증된 `ground_violet` 의 **돌 구조(줄눈·하이라이트 위치)를 그대로** 쓰고
 *  팔레트만 석재로 변환한다(scripts/make_stone_floors.py). 구조를 새로 그리면 톤이 어긋난다.
 *  추가로 회전·반전 4변형 아틀라스를 만들어 셀마다 섞어 반복 주기를 4배로 늘린다.
 *
 * [이 테스트가 막는 것]
 *  1) 무채색 노이즈 바닥으로 되돌아가는 것(grayRatio=1)
 *  2) 대비를 과하게 키워 "조각조각 튀는" 바닥이 되는 것
 *  3) 아틀라스 없이 단일 타일로 되돌아가 반복 티가 다시 보이는 것
 */

const ROOT = path.resolve(import.meta.dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function floorStats(names) {
  const out = execFileSync('python3', ['scripts/floor_stats.py', ...names], { cwd: ROOT, encoding: 'utf8' });
  return JSON.parse(out);
}

test('석재 바닥이 순수 회색조 노이즈가 아니다', () => {
  const s = floorStats(['ground_slate', 'ground_ash', 'ground_violet']);
  for (const k of ['ground_slate', 'ground_ash']) {
    assert.ok(s[k].grayRatio < 0.02, `${k} 가 회색조다(grayRatio=${s[k].grayRatio}) — 노이즈로 회귀`);
    assert.ok(s[k].avgSat > 0.08, `${k} 채도가 너무 낮다(${s[k].avgSat}) — 색조 없음`);
    assert.equal(s[k].colors, 5, `${k} 색 수가 5가 아니다(${s[k].colors}) — 팔레트 매핑이 깨졌다`);
  }
  /* 원본(ground_violet)도 색조가 있어야 한다 — 이게 구조 공급원이다 */
  assert.ok(s.ground_violet.avgSat > 0.3);
});

test('대비가 원본 수준을 넘지 않는다(조각조각 튀는 바닥 방지)', () => {
  const s = floorStats(['ground_slate', 'ground_ash', 'ground_violet']);
  const base = s.ground_violet.neighborDiff;
  for (const k of ['ground_slate', 'ground_ash']) {
    assert.ok(
      s[k].neighborDiff <= base * 1.3,
      `${k} 이웃차이 ${s[k].neighborDiff} > 원본 ${base}*1.3 — 대비 과다`
    );
  }
});

test('변형 아틀라스가 4프레임 세로 구조로 존재한다', () => {
  for (const k of ['ground_slate_atlas', 'ground_ash_atlas']) {
    const p = path.join(ROOT, `public/assets/ground/${k}.png`);
    assert.ok(fs.existsSync(p), `${k}.png 없음`);
    const size = execFileSync('python3', ['-c', `from PIL import Image;print(Image.open('${p}').size)`], { encoding: 'utf8' }).trim();
    assert.equal(size, '(96, 384)', `${k} 크기가 96×384(4프레임)가 아니다: ${size}`);
  }
});

test('렌더러가 아틀라스를 쓰고 프레임을 섞는다', () => {
  const src = read('src/game/fx/AuthoredMapLayers.ts');
  assert.ok(src.includes('groundAtlasOf'), '아틀라스 조회가 없다');
  assert.ok(src.includes('GROUND_ATLAS_FRAMES'), '프레임 수 참조가 없다');
  /* 프레임 선택이 셀 좌표 기반이어야 한다(고정값이면 변형이 안 섞인다) */
  assert.match(src, /const v = .*c \* 7 \+ r \* 13/s);
  /* 프레임 번호 = 변형행 * sourceCols + 원본조각 */
  assert.match(src, /return 1 \+ v \* sourceCols \+ \(base - 1\) % sourceCols/);
});

test('Phaser4 addTilesetImage 8번째 인자를 프레임 수로 쓰지 않는다', () => {
  /* [함정] Phaser4 의 8번째 인자는 tileOffset(객체)이다. 숫자를 넘기면 타입 오류가 나고,
   *  프레임은 Tileset 이 이미지 크기로 updateTileData 를 호출해 자동 계산한다. */
  const src = read('src/game/fx/AuthoredMapLayers.ts');
  assert.equal(/addTilesetImage\([^)]*,\s*atlasFrames\s*\)/.test(src), false, '프레임 수를 8번째 인자로 넘기고 있다');
  assert.match(src, /addTilesetImage\(tilesetKey, tilesetKey, unit, unit, 0, 0, 1\)/);
});

test('노이즈 바닥을 쓰던 테마가 새 석재를 가리킨다', () => {
  const themes = read('src/game/tileThemes.ts');
  /* tile_dark/tile_stone 등이 ground_slate/ground_ash 를 그대로 쓰되,
   * 이제 두 파일 자체가 진짜 돌바닥이다. 매핑이 사라지면 다른 텍스처로 새는 것을 막는다. */
  for (const key of ['tile_dark', 'tile_stone', 'tile_basalt', 'tile_ash']) {
    assert.match(themes, new RegExp(`${key}:\\s*"ground_(slate|ash)"`), `${key} 매핑이 바뀌었다`);
  }
});
