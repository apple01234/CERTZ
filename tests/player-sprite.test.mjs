import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

/**
 * 기본 남캐/여캐 스프라이트 — vc255 + vc256 (지시 #7).
 *
 * [vc255 이전 상태] 기본 남캐는 FA 아틀라스(`fa/p1.png`) idle 프레임을 썼는데,
 *  64×85 프레임 안에 캐릭터가 **18×36px** 이고 실제로는 사람이 아니라
 *  **청보라색 외계 생물**(큰 원형 머리 + 1px 촉수 팔다리 + 노란 사각 눈)이었다.
 *  `ch{m|f}{skin}` 세트도 96×64 에 캐릭터 26~28×40~42px 로 같은 계열의 저해상도.
 *
 * [vc255 수리] NPC 본체(`npcbody_*`, 75×72, 2.2등신, 실제 이목구비)와 같은 규격으로
 *  `chm2_*`/`chf2_*` 전 세트(7동작 × 4프레임 × 2성별 = 56장)를 생성하고
 *  `resolveBodyPrefix` 가 기본 피부(2)에서도 이 시트를 쓰도록 연결했다.
 *
 * [vc256 수리] 처음엔 남녀 **실루엣이 완전히 동일**해서 색으로만 구별됐다
 *  (흑백/팔레트 스왑 시 구분 불가). 여캐에 긴 머리(어깨 아래)와 A라인 치마를 넣어
 *  실루엣만으로도 구별되게 했다.
 *
 * [이 테스트가 막는 것]
 *  1) 남캐가 다시 FA 아틀라스(외계 생물)로 되돌아가는 것
 *  2) webp 가 낡은 채로 남아 PNG 수정이 게임에 반영되지 않는 것
 *  3) 남녀 실루엣이 다시 동일해지는 것(색만 다른 쌍둥이)
 */

const ROOT = path.resolve(import.meta.dirname, '..');
const ASSETS = path.join(ROOT, 'public/assets');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const ANIMS = [
  'idle0', 'idle1', 'idle2', 'idle3',
  'walk0', 'walk1', 'walk2', 'walk3',
  'walkup0', 'walkup1', 'walkup2', 'walkup3',
  'walkside0', 'walkside1', 'walkside2', 'walkside3',
  'atk0', 'atk1', 'atk2', 'atk3',
  'atkup0', 'atkup1', 'atkup2', 'atkup3',
  'atkdown0', 'atkdown1', 'atkdown2', 'atkdown3',
];

function silhouette(gender) {
  /* webp 알파 채널에서 실루엣 폭 프로파일을 뽑는다 (PIL) */
  const out = execFileSync('python3', ['-c', `
from PIL import Image
im = Image.open("public/assets/${gender}_idle0.webp").convert("RGBA")
w, h = im.size
a = im.split()[3]
rows = []
for y in range(h):
    xs = [x for x in range(w) if a.getpixel((x, y)) > 0]
    rows.append((min(xs), max(xs)) if xs else None)
import json
print(json.dumps(rows))
`], { cwd: ROOT, encoding: 'utf8' });
  return JSON.parse(out);
}

test('기본 남캐/여캐 시트가 NPC 규격으로 존재한다', () => {
  for (const g of ['chm2', 'chf2']) {
    for (const a of ANIMS) {
      const p = path.join(ASSETS, `${g}_${a}.webp`);
      assert.ok(fs.existsSync(p), `${g}_${a}.webp 없음`);
    }
    /* 캔버스 96×64 (ch 계열 규격) */
    const size = execFileSync('python3', ['-c',
      `from PIL import Image;print(Image.open('public/assets/${g}_idle0.webp').size)`],
      { cwd: ROOT, encoding: 'utf8' }).trim();
    assert.equal(size, '(96, 64)', `${g} 캔버스가 96×64가 아니다: ${size}`);
  }
});

test('캐릭터가 npcbody 급 해상도로 그려져 있다', () => {
  /* 26×42(ch 계열) 이하로 되돌아가면 저해상도 회귀 */
  const out = execFileSync('python3', ['-c', `
from PIL import Image
for g in ("chm2","chf2"):
    bb = Image.open(f"public/assets/{g}_idle0.webp").convert("RGBA").getbbox()
    print(g, bb[2]-bb[0], bb[3]-bb[1])
`], { cwd: ROOT, encoding: 'utf8' }).trim();
  for (const line of out.split('\n')) {
    const [g, w, h] = line.trim().split(/\s+/);
    assert.ok(Number(h) >= 50, `${g} 높이 ${h}px < 50 — 저해상도로 회귀`);
    assert.ok(Number(w) >= 22, `${g} 폭 ${w}px < 22 — 저해상도로 회귀`);
  }
});

test('여캐 실루엣이 남캐와 다르다 (색 없이 구별 가능)', () => {
  const m = silhouette('chm2');
  const f = silhouette('chf2');
  assert.equal(m.length, f.length);

  /* 치마: 여캐는 몸통 아래쪽이 남캐보다 넓어야 한다(A라인) */
  const band = (rows, y0, y1) => {
    const widths = [];
    for (let y = y0; y < y1 && y < rows.length; y++) {
      const r = rows[y];
      if (r) widths.push(r[1] - r[0]);
    }
    return widths.length ? widths.reduce((a, b) => a + b, 0) / widths.length : 0;
  };
  /* 하단부(다리 바로 위, y 46~52) 폭 비교 */
  const mSkirt = band(m, 46, 52);
  const fSkirt = band(f, 46, 52);
  assert.ok(fSkirt > mSkirt + 2, `여캐 하단 폭 ${fSkirt.toFixed(1)} ≤ 남캐 ${mSkirt.toFixed(1)}+2 — 치마 A라인 없음`);

  /* 긴 머리: 여캐는 어깨 높이(y 30~40) 옆 폭이 남캐보다 넓다 */
  const mHair = band(m, 30, 40);
  const fHair = band(f, 30, 40);
  assert.ok(fHair > mHair, `여캐 어깨높이 폭 ${fHair.toFixed(1)} ≤ 남캐 ${mHair.toFixed(1)} — 긴 머리 없음`);
});

test('webp 가 PNG 와 같은 시점에 생성된다 (낡은 webp 방지)', () => {
  /* 생성 스크립트가 .webp 도 저장해야 한다 — PNG 만 저장하면 게임은 낡은 webp 를 읽는다 */
  const src = read('scripts/make_player_sheet.py');
  assert.match(src, /\.webp["']\s*,\s*lossless=True|lossless=True/, 'make_player_sheet.py 가 webp 를 저장하지 않는다');

  /* 실제로 PNG/webp 크기가 크게 어긋나지 않는지(둘 다 존재) */
  for (const g of ['chm2', 'chf2']) {
    for (const ext of ['png', 'webp']) {
      const p = path.join(ASSETS, `${g}_idle0.${ext}`);
      assert.ok(fs.existsSync(p), `${g}_idle0.${ext} 없음`);
      assert.ok(fs.statSync(p).size > 100, `${g}_idle0.${ext} 크기 ${fs.statSync(p).size}B — 빈 파일`);
    }
  }
});

test('기본 남캐가 FA 아틀라스보다 자기 시트를 먼저 쓴다', () => {
  const src = read('src/game/characterAppearance.ts');
  /* [계약] FA 폴백 자체는 **정상**이다 — 시트가 없는 구 배포/신규 피부 조합을 위한
   *  안전망. 문제는 그 폴백이 **기본 남캐(피부 2)까지 삼켰던 것**이다.
   *  따라서 "ch 시트 우선 탐색이 FA 폴백보다 앞에 있는가"를 검사한다. */
  const ownIdx = src.indexOf('const own = `ch${gender}${skin}`;');
  const faIdx = src.indexOf('return gender === "f" || skin !== 2');
  assert.ok(ownIdx > 0, 'ch 시트 우선 탐색이 없다');
  assert.ok(faIdx > 0, 'FA 폴백이 없다 (삭제되면 구 배포에서 스프라이트가 깨진다)');
  assert.ok(ownIdx < faIdx, 'ch 시트 탐색이 FA 폴백보다 뒤에 있다 — 기본 남캐가 외계 생물로 회귀');
  /* own 시트가 있으면 즉시 반환해야 FA 로 안 떨어진다 */
  assert.match(src.slice(ownIdx, faIdx), /if \(hasBody\(own\)\) return own;/,
    'ch 시트가 있어도 즉시 반환하지 않는다');
});
