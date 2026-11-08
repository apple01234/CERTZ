import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pythonBin, pythonEnv } from './python.mjs';

/**
 * 바닥 텍스처 회귀 — vc252 → vc259 (지시 #1 "타일맵 배치가 어색함" / "보라색 지형이
 * 반복된 직사각형 패턴").
 *
 * [진짜 원인] `ground_slate`·`ground_ash`·`ground_violet`·`ground_cavern` 은 **5색뿐**이었다.
 *  scripts/make_stone_floors.py 가 `ground_violet`(5색 얼룩)의 팔레트만 치환해 만들었기
 *  때문에 4종이 **완전히 같은 도형**이었고, 게다가 96px 격자가 그대로 보였다.
 *  `ground_meadow` 는 3색이라 64px 체커보드가 보였다(마을·초원 = 가장 오래 보는 화면).
 *
 * [종전 테스트의 한계] "색 수가 정확히 5" · "회색조가 아님" 만 검사했다. 즉 **얼룩이어도
 *  통과**했다. 그래서 문제를 못 잡았다. 기준을 "격자가 안 보이는가"로 바꾼다.
 *
 * [이 테스트가 막는 것]
 *  1) 5색 얼룩 타일로 되돌아가는 것   → colors >= 100
 *  2) 96px 격자가 다시 보이는 것       → seam ratio < 1.5 (타일 경계 이음새가 내부 이웃차이 수준)
 *  3) 단일 색에 가까운 평면으로 회귀    → 최빈색 점유 < 50%
 *  4) 256px 규격이 깨지는 것            → size 256
 */

const ROOT = path.resolve(import.meta.dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** 이식성: python3 가 없는 환경(Windows)은 tests/python.mjs 가 찾아준다.
 *  종전엔 'python3' 하드코딩이라 Windows 에서 이 파일 전체가 실패했다.
 *  vc274 — 후보 탐색을 중복 구현하지 않고 단일 출처(pythonBin)를 쓴다.
 *  PYTHONUTF8 은 python.mjs 가 자체 env 로 처리한다. */
const PY = pythonBin();

function floorStats(names) {
  const out = execFileSync(PY, ['scripts/floor_stats.py', ...names], { cwd: ROOT, encoding: 'utf8', env: pythonEnv });
  return JSON.parse(out);
}

/** seam(경계 이음새) / 내부 이웃차이 비율. 1.0 근처면 격자가 안 보인다. */
function seamRatio(name) {
  const py = `
from PIL import Image
im=Image.open('public/assets/ground/${name}.png').convert('RGB')
w,h=im.size; px=im.load()
inner=sum(abs(px[x,y][0]-px[x+1,y][0])+abs(px[x,y][1]-px[x+1,y][1])+abs(px[x,y][2]-px[x+1,y][2]) for y in range(h) for x in range(w-1))/(3*h*(w-1))
slr=sum(abs(px[0,y][i]-px[w-1,y][i]) for y in range(h) for i in range(3))/(3*h)
stb=sum(abs(px[x,0][i]-px[x,h-1][i]) for x in range(w) for i in range(3))/(3*w)
print(round(slr/max(inner,0.01),3), round(stb/max(inner,0.01),3))
`;
  const [lr, tb] = execFileSync(PY, ['-c', py], { cwd: ROOT, encoding: 'utf8', env: pythonEnv }).trim().split(/\s+/).map(Number);
  return { lr, tb };
}

/** 교체된 5종 — 256px 무이음새 고색수 타일이어야 한다. */
const SWAPPED = ['ground_meadow', 'ground_slate', 'ground_ash', 'ground_violet', 'ground_cavern',
  /* vc278 — P3 대안. DCSS(CC0) 32px 는 32px 격자가 드러나(lag=32) 도입을 취소하고,
   * 기존 지면의 실제 결함 2건을 프로젝트 내 CC0 256px 로 교체했다.
   *   ground_sand   84×84·58색·이음선 비율 1.4e7 → tile_gold  256px·1045색·seam 0.84/0.99
   *   ground_forest 96×96·29색·가로 이음선 1.98 → tile_rust  256px· 808색·seam 1.21/0.85
   * 두 타일 모두 이 목록에 넣어 256px 규격·색 수·seam 기준을 계속 강제한다. */
  'ground_sand', 'ground_forest'];

test('5색 얼룩 타일로 회귀하지 않았다', () => {
  const s = floorStats(SWAPPED);
  for (const k of SWAPPED) {
    assert.ok(s[k].colors >= 100, `${k} 색 수가 ${s[k].colors} — 5색 얼룩으로 회귀(>=100 필요)`);
    assert.ok(s[k].grayRatio < 0.5, `${k} 회색조 비율 ${s[k].grayRatio} — 무채색 노이즈로 회귀`);
  }
  /* meadow 는 3색 단색이었다 — 가장 큰 회귀 지점이라 따로 못박는다. */
  assert.ok(s.ground_meadow.colors >= 1000, `ground_meadow 색 수 ${s.ground_meadow.colors} — 3색 체커보드로 회귀`);
});

test('96px/64px 격자가 다시 보이지 않는다 (seam ratio)', () => {
  for (const k of SWAPPED) {
    const r = seamRatio(k);
    /* 1.0 = 경계 이음새가 내부 노이즈와 동일 → 격자 없음.
     *  종전 5색 타일은 2.4~3.4 였다(경계가 내부의 2~3배로 튐 = 격자). */
    assert.ok(r.lr < 1.5, `${k} seamLR ${r.lr} — 좌우 격자 보임(<1.5 필요)`);
    assert.ok(r.tb < 1.5, `${k} seamTB ${r.tb} — 상하 격자 보임(<1.5 필요)`);
  }
});

test('평면 단색으로 퇴화하지 않았다 (최빈색 점유)', () => {
  const py = `
from PIL import Image
from collections import Counter
for n in ${JSON.stringify(SWAPPED)}:
    im=Image.open(f'public/assets/ground/{n}.png').convert('RGB')
    c=Counter(im.getdata()); tot=im.width*im.height
    print(n, round(100*c.most_common(1)[0][1]/tot,1))
`;
  const out = execFileSync(PY, ['-c', py], { cwd: ROOT, encoding: 'utf8', env: pythonEnv }).trim().split(/\r?\n/);
  for (const line of out) {
    const [n, pct] = line.split(/\s+/);
    assert.ok(Number(pct) < 50, `${n} 최빈색 ${pct}% — 단색에 가깝다(반복 티)`);
  }
});

test('교체된 지면이 256px 규격이다', () => {
  /* vc274 — 종전엔 `print(n, size)` 의 출력을 공백으로 split 해 `size` 를 뽑았는데,
   *  PIL 이 돌려주는 튜플 문자열 `(256, 256)` 안에 공백이 있어 실제로는 `(256,` 만
   *  잡혔다. 그래서 이 검사는 **항상** 실패하는 상태였다(에셋과 무관한 파싱 버그).
   *  쉼표 기준으로 정확히 파싱한다. */
  const py = `
from PIL import Image
for n in ${JSON.stringify(SWAPPED)}:
    w, h = Image.open(f'public/assets/ground/{n}.png').size
    print(n, w, h)
`;
  const out = execFileSync(PY, ['-c', py], { cwd: ROOT, encoding: 'utf8', env: pythonEnv }).trim().split(/\r?\n/);
  assert.equal(out.length, SWAPPED.length, '교체된 지면 전부를 검사해야 한다');
  for (const line of out) {
    const [n, w, h] = line.trim().split(/\s+/);
    assert.equal(w, '256', `${n} 너비 ${w} — 256 이 아니다`);
    assert.equal(h, '256', `${n} 높이 ${h} — 256 이 아니다`);
  }
});

test('회전 아틀라스 생성기가 다시 생기지 않았다', () => {
  /* 근본 원인 스크립트. 되살아나면 같은 얼룩이 재생성된다. */
  assert.equal(fs.existsSync(path.join(ROOT, 'scripts/make_stone_floors.py')), false,
    'make_stone_floors.py 가 다시 추가됐다 — 5색 얼룩 재생성 경로');
  for (const k of ['ground_slate_atlas', 'ground_ash_atlas']) {
    assert.equal(fs.existsSync(path.join(ROOT, `public/assets/ground/${k}.png`)), false,
      `${k}.png 가 남아 있다 — 얼룩 타일의 회전본`);
  }
});

test('렌더러가 아틀라스 없이 원본 타일을 그대로 반복한다', () => {
  const src = read('src/game/fx/AuthoredMapLayers.ts');
  assert.equal(src.includes('groundAtlasOf'), false, '폐기된 아틀라스 조회가 남아 있다');
  assert.equal(src.includes('GROUND_ATLAS_FRAMES'), false, '폐기된 아틀라스 프레임 참조가 남아 있다');
  /* vc275 — 256px 무이음새 원본을 **확대/축소 없이** 1:1 로 반복해야 한다.
   *  setTileScale 로 늘리면 pixelArt 게임에서 픽셀 폭이 들쭉날쭉해진다(화질 저하 금지).
   *  셀마다 잘라 붙이되 전역 위상(setTilePosition)으로 무늬 연속성을 유지한다. */
  assert.equal(/setTileScale/.test(src), false, '타일을 확대/축소하면 픽셀아트 화질이 깨진다');
  assert.match(src, /setTilePosition\(b\.x % periodX, b\.y % periodY\)/);
});

test('Phaser4 addTilesetImage 8번째 인자를 프레임 수로 쓰지 않는다', () => {
  /* [함정] Phaser4 의 8번째 인자는 tileOffset(객체)이다. 숫자를 넘기면 타입 오류가 나고,
   *  프레임은 Tileset 이 이미지 크기로 updateTileData 를 호출해 자동 계산한다.
   *  vc275 — 지면/경로/구조물은 Tilemap 이 아니라 클리핑된 TileSprite 밴드로 그린다.
   *  따라서 이 함정을 다시 밟을 경로가 없어야 한다(Tilemap 재도입 금지). */
  const src = read('src/game/fx/AuthoredMapLayers.ts');
  assert.equal(/addTilesetImage\([^)]*,\s*atlasFrames\s*\)/.test(src), false, '프레임 수를 8번째 인자로 넘기고 있다');
  assert.equal(/scene\.make\.tilemap/.test(src), false, 'Tilemap 지면 렌더가 다시 도입됐다 — 셀 경계 침범이 재발한다');
  assert.match(src, /scene\.add\.tileSprite\(b\.x, b\.y, b\.w, b\.h, role\.key\)/);
});

test('노이즈 바닥을 쓰던 테마가 새 석재를 가리킨다', () => {
  const themes = read('src/game/tileThemes.ts');
  /* tile_dark/tile_stone 등이 ground_slate/ground_ash 를 그대로 쓰되,
   * 이제 두 파일 자체가 256px 무이음새 타일이다. 매핑이 사라지면 다른 텍스처로 새는 것을 막는다. */
  for (const key of ['tile_dark', 'tile_stone', 'tile_basalt', 'tile_ash']) {
    assert.match(themes, new RegExp(`${key}:\\s*"ground_(slate|ash)"`), `${key} 매핑이 바뀌었다`);
  }
});

