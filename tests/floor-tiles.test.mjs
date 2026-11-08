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

/** seam(경계 이음새) / 내부 이웃차이 비율. 1.0 근처면 격자가 안 보인다.
 *
 *  ═══ vc283 (지면을 DCSS CC0 32px 픽셀아트로 교체하면서 발견한 측정 버그) ═══
 *  [증상] 새 지면 7종이 이 테스트에서 전부 seam 1.5~2.0 으로 "격자 보임" 판정됐다.
 *
 *  [원인] 이 지면들은 `32px → 4x4 패킹(128px) → NEAREST 2x(256px)` 로 만들어져
 *   **모든 소스 픽셀이 2x2 블록으로 복제**돼 있다. 그래서 가로 인접쌍의 절반이
 *   diff=0 이 되어 `inner` 기준선이 정확히 **절반**로 줄어든다. 반면 wrap 경계는
 *   서로 다른 실제 픽셀끼리 비교하므로 그대로다 → 비율이 2배로 부풀려진다.
 *   실측(ground_meadow): 256px 1.899 → 128px 0.946. 즉 **이음선은 없었다.**
 *   (128px = 다운샘플해서 원본 해상도로 되돌린 것 = 위상이 같은 상태)
 *
 *  [해결] 인접 diff 가 0 인 쌍(확대 복제분)을 제외하고 `inner` 를 잰다.
 *   확대 배수에 무관하게 "실제로 다른 이웃 픽셀 사이의 거칠기"만 남으므로,
 *   NEAREST 확대본과 원본 256px 타일을 같은 잣대로 비교할 수 있다.
 *   확대가 없는 타일(예: ground_dirt 84px)은 제외분이 0이라 종전과 동일하게 동작한다. */
function seamRatio(name) {
  const py = `
from PIL import Image
im=Image.open('public/assets/ground/${name}.png').convert('RGB')
w,h=im.size; px=im.load()
def d(p,q):
    return abs(p[0]-q[0])+abs(p[1]-q[1])+abs(p[2]-q[2])
# 내부 거칠기 — '실제로 다른' 이웃쌍만 센다 (확대 복제분 diff=0 은 분모에서 제외)
s=0; n=0
for y in range(h):
    for x in range(w-1):
        v=d(px[x,y],px[x+1,y])
        if v:
            s+=v; n+=1
inner=s/max(n,1)/3
# wrap 경계도 같은 규칙으로(0 인 쌍 제외) — 대부분 0 이 아니지만 일관성 유지
s2=0; n2=0
for y in range(h):
    v=d(px[0,y],px[w-1,y])
    if v:
        s2+=v; n2+=1
slr=s2/max(n2,1)/3
s3=0; n3=0
for x in range(w):
    v=d(px[x,0],px[x,h-1])
    if v:
        s3+=v; n3+=1
stb=s3/max(n3,1)/3
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
    /* ═══ vc283 — 기준을 "색이 많을수록 좋다"에서 "얼룩/격자가 아니다"로 교정 ═══
     *  종전 기준(>=100색, meadow 는 >=1000색)은 **수채화 사진풍 타일을 통과시키는**
     *  문턱이었다. 실제로 그 기준을 만족하던 ground_meadow 는 1330색의 흐릿한
     *  수채화였고, 사용자가 "흐릿한 풀밭 vs 선명한 도트 캐릭터"를 지적한 원인이었다.
     *  픽셀아트는 반대로 색이 **적다** — DCSS CC0 32px 유래 5종은 273~691색이다.
     *
     *  그래서 "색 수" 자체를 품질 지표로 쓰지 않는다. 진짜 회귀 신호는
     *  (a) 5색 얼룩(=<20색)으로 되돌아가는 것  (b) 단색 퇴화(최빈색 과점)
     *  (c) 격자 노출(seam)  세 가지다. 색 수는 하한만 아주 느슨하게 둔다. */
    assert.ok(s[k].colors >= 20, `${k} 색 수가 ${s[k].colors} — 5색 얼룩/단색으로 회귀(>=20 필요)`);
    assert.ok(s[k].grayRatio < 0.5, `${k} 회색조 비율 ${s[k].grayRatio} — 무채색 노이즈로 회귀`);
  }
  /* meadow 는 과거 3색 체커보드였던 최대 회귀 지점 — 단색 퇴화만 별도로 못박는다.
   *  (색 수 상한을 강제하면 "색이 많아야 좋다"는 옛 오해가 되살아난다.) */
  assert.ok(s.ground_meadow.colors >= 20, `ground_meadow 색 수 ${s.ground_meadow.colors} — 3색 체커보드로 회귀`);
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

/* ═══ vc283 — seam ratio 만으로는 "반복 격자"를 못 잡는다 ═══
 *
 * [왜 이 테스트가 필요한가]
 *  위 seam 측정은 경계 이음새가 **내부 거칠기와 비슷한가**만 본다. 그런데 실제
 *  사용자 지적("사각형으로 뚝 끊기는 지형")의 정체는 이음새가 아니라
 *  **텍스처가 짧은 주기로 완전히 반복되는 것**이었다.
 *  실측: vc283 1차 지면은 32px 원본 타일 **하나를 16번 복붙**해 만들어서
 *  lag 64px 에서 자기상관이 **1.000**(=완전 동일)이었다. 화면에는 64px 격자가 보인다.
 *  그런데 seam ratio 로는 0.94~1.01 로 "정상" 판정됐다 — 통과시키는 지표가 틀렸다.
 *
 *  반대로 인위적 체커보드도 seam ratio 는 1.000 으로 통과한다(셀 내부가 단색이라
 *  내부 거칠기가 0에 가까워 비율이 무의미해진다). 두 지표는 서로 다른 결함을 잡는다.
 *
 * [측정] 가로 방향 자기상관(lag 64px). 1.0 이면 그 주기로 완전 반복 = 격자.
 *  같은 32px 타일을 2x 확대해 붙이면 반드시 64px 주기가 생기므로 이 값이 1.0 이 된다.
 *  회전/반전 변형을 섞어 패킹하면 같은 격자가 반복되지 않아 값이 낮아진다.
 *
 * [임계 0.5] 실측 근거:
 *   같은 타일 16장 복붙         → 1.000 (격자)
 *   소스 3종만 섞기(회전없이)    → 0.829 (여전히 격자)
 *   변형 24종 셔플              → -0.006 ~ 0.210 (격자 없음)
 *  0.5 는 "격자 있음"과 "없음" 사이의 명확한 골짜기다. */
test('짧은 주기 반복 격자가 없다 (자기상관 lag 64px)', () => {
  const py = `
from PIL import Image
import numpy as np
for n in ${JSON.stringify(SWAPPED)}:
    a = np.asarray(Image.open(f'public/assets/ground/{n}.png').convert('L')).astype(np.float32)
    x = a - a.mean(); den = float((x*x).sum())
    lag = 64
    c = float((x[:, :a.shape[1]-lag] * x[:, lag:]).sum()/den*(a.shape[1]/(a.shape[1]-lag))) if den > 1e-6 else 1.0
    print(n, round(c, 4))
`;
  const out = execFileSync(PY, ['-c', py], { cwd: ROOT, encoding: 'utf8', env: pythonEnv }).trim().split(/\r?\n/);
  assert.equal(out.length, SWAPPED.length, '교체된 지면 전부를 검사해야 한다');
  for (const line of out) {
    const [n, c] = line.trim().split(/\s+/);
    assert.ok(Number(c) < 0.5,
      `${n} lag64 자기상관 ${c} — 64px 주기로 반복되는 격자가 보인다(<0.5 필요). ` +
      `같은 32px 타일을 16번 복붙하면 1.000 이 된다.`);
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

/* ═══ vc283 리뷰 반영 — "흐림(blur)"을 실제로 재는 지표가 없었다 ═══
 *
 * [리뷰 지적] 위 테스트들(색 수 / seam / 자기상관)은 **전부 옛 수채화 타일도 통과**한다.
 *  실측(d3233b4f 의 ground_meadow): colors=1330, top=1.1%, lag64=-0.197, seam 1.09/0.99
 *  → colors>=20 ✅, top<50% ✅, lag64<0.5 ✅, seam<1.5 ✅. 즉 "흐릿한 풀밭"이 전부 통과한다.
 *  사용자가 지적한 1순위 결함이 바로 그 흐림인데, 어떤 지표도それを 보지 않았다.
 *
 * [무엇이 흐림과 픽셀아트를 가르나 — 실측]
 *  **내부 거칠기(인접 픽셀 평균 절대차)** 가 유일하게 갈랐다:
 *    옛 수채화 : 1.67 ~ 3.10   (그라데이션이 매끄러워 이웃 픽셀이 거의 같다)
 *    새 픽셀아트: 8.02 ~ 16.48  (도트 경계에서 값이 계단처럼 튄다)
 *  5~10배 차이라 임계를 넉넉히 잡아도 방향이 명확하다.
 *
 *  [주의] 확대(NEAREST 2x)는 같은 픽셀을 복제해 인접 diff 0 인 쌍을 만든다.
 *  그래서 diff 0 인 쌍은 **분모에서 제외**하고 잰다(seamRatio 와 같은 이유·같은 규칙).
 *
 * [임계 5.0] 옛 타일 최대 3.10 / 새 타일 최소 8.02 → 5.0 은 양쪽에서 1.6배 이상 여유.
 *  이 테스트는 "흐릿한 수채화로 되돌아가는 것"을 잡는다. */
test('지면이 흐릿한 수채화로 되돌아가지 않았다 (내부 거칠기)', () => {
  const py = `
from PIL import Image
for n in ${JSON.stringify(SWAPPED)}:
    im = Image.open(f'public/assets/ground/{n}.png').convert('RGB')
    px = im.load(); w, h = im.size
    s = 0; cnt = 0
    for y in range(h):
        for x in range(w - 1):
            a, b = px[x, y], px[x + 1, y]
            d = abs(a[0]-b[0]) + abs(a[1]-b[1]) + abs(a[2]-b[2])
            if d:                      # 확대 복제분(diff=0)은 제외
                s += d; cnt += 1
    print(n, round(s / max(cnt, 1) / 3, 2))
`;
  const out = execFileSync(PY, ['-c', py], { cwd: ROOT, encoding: 'utf8', env: pythonEnv }).trim().split(/\r?\n/);
  assert.equal(out.length, SWAPPED.length, '교체된 지면 전부를 검사해야 한다');
  for (const line of out) {
    const [n, v] = line.trim().split(/\s+/);
    assert.ok(Number(v) >= 5.0,
      `${n} 내부 거칠기 ${v} — 흐릿한 수채화로 회귀(>=5.0 필요). ` +
      `옛 수채화 타일은 1.67~3.10, 픽셀아트는 8.02~16.48 이었다.`);
  }
});

test('노이즈 바닥을 쓰던 테마가 새 석재를 가리킨다', () => {
  const themes = read('src/game/tileThemes.ts');
  /* tile_dark/tile_stone 등이 ground_slate/ground_ash 를 그대로 쓰되,
   * 이제 두 파일 자체가 256px 무이음새 타일이다. 매핑이 사라지면 다른 텍스처로 새는 것을 막는다. */
  for (const key of ['tile_dark', 'tile_stone', 'tile_basalt', 'tile_ash']) {
    assert.match(themes, new RegExp(`${key}:\\s*"ground_(slate|ash)"`), `${key} 매핑이 바뀌었다`);
  }
});

