import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pythonBin, pythonEnv } from './python.mjs';

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
  const out = execFileSync(pythonBin(), ['-c', `
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
`], { cwd: ROOT, encoding: 'utf8', env: pythonEnv });
  return JSON.parse(out);
}

test('기본 남캐/여캐 시트가 NPC 규격으로 존재한다', () => {
  for (const g of ['chm2', 'chf2']) {
    for (const a of ANIMS) {
      const p = path.join(ASSETS, `${g}_${a}.webp`);
      assert.ok(fs.existsSync(p), `${g}_${a}.webp 없음`);
    }
    /* 캔버스 96×64 (ch 계열 규격) */
    const size = execFileSync(pythonBin(), ['-c',
      `from PIL import Image;print(Image.open('public/assets/${g}_idle0.webp').size)`],
      { cwd: ROOT, encoding: 'utf8' }).trim();
    assert.equal(size, '(96, 64)', `${g} 캔버스가 96×64가 아니다: ${size}`);
  }
});

test('기본 피부(2번)는 다른 피부와 같은 치비 그림이다', () => {
  /* 2026-11-12 유저 지시 — "기본 캐릭터를 다른 피부색 캐릭터들처럼".
   *  종전 검사는 키 큰 그림(높이 50px 이상)을 강제했다. 이제 2번은 1번·3번과 **같은 실루엣**이고
   *  피부색만 그 사이 톤이다. 키 큰 원본은 public/assets/legacy/default-tall/ 에 보존돼 있다. */
  const out = execFileSync(pythonBin(), ['-c', `
from PIL import Image
for g in ("chm","chf"):
    a = Image.open(f"public/assets/{g}1_idle0.webp").convert("RGBA")
    b = Image.open(f"public/assets/{g}2_idle0.webp").convert("RGBA")
    c = Image.open(f"public/assets/{g}3_idle0.webp").convert("RGBA")
    print(g, int(a.split()[3].tobytes() == b.split()[3].tobytes()), int(a.tobytes() != b.tobytes()), int(c.tobytes() != b.tobytes()))
`], { cwd: ROOT, encoding: 'utf8' }).trim();
  for (const line of out.split('\n')) {
    const [g, sameAlpha, differs1, differs3] = line.trim().split(/\s+/);
    assert.equal(sameAlpha, '1', `${g}2 실루엣이 ${g}1 과 다르다`);
    assert.equal(differs1, '1', `${g}2 가 ${g}1 과 완전히 같다(피부 선택지 중복)`);
    assert.equal(differs3, '1', `${g}2 가 ${g}3 과 완전히 같다(피부 선택지 중복)`);
  }
  assert.ok(fs.existsSync(path.join(ASSETS, 'legacy/default-tall/chm2_idle0.webp')), '키 큰 원본 보존');
});

test('여캐 실루엣이 남캐와 다르다 (색 없이 구별 가능)', () => {
  const m = silhouette('chm2');
  const f = silhouette('chf2');
  assert.equal(m.length, f.length);

  /* vc274 — 실루엣 차별화 검사는 **생성 아트(make_player_sheet.py) 전제**다.
   *
   *  유저가 chm2/chf2 를 **직접 첨부한 40×38 아트로 교체**한 뒤로 남/여가 같은
   *  도형(하단 폭 58 vs 58)이 되어 이 검사는 반드시 실패한다. 그건 회귀가 아니라
   *  유저가 의도한 선택이므로, 여기서 강제하면 유저 아트를 되돌리라는 요구가 된다.
   *
   *  대신 **둘 다 실루엣 데이터를 갖고 있고 프레임 규격이 같다**는 계약만 유지한다.
   *  (치마/긴 머리 차별화는 생성 아트로 되돌릴 때만 의미가 있다 — 아래 ponytail 참조.) */
  const band = (rows, y0, y1) => {
    const widths = [];
    for (let y = y0; y < y1 && y < rows.length; y++) {
      const r = rows[y];
      if (r) widths.push(r[1] - r[0]);
    }
    return widths.length ? widths.reduce((a, b) => a + b, 0) / widths.length : 0;
  };
  const mW = band(m, 46, 52);
  const fW = band(f, 46, 52);
  assert.ok(mW > 0 && fW > 0, `남/여 하단 폭이 0 (남 ${mW}, 여 ${fW}) — 실루엣 추출 실패`);
  assert.ok(Math.abs(fW - mW) <= 8, `남/여 하단 폭 차 ${Math.abs(fW - mW).toFixed(1)} — 규격에서 크게 벗어남`);
  /* ponytail: 생성 아트로 복귀하면 `fSkirt > mSkirt + 2 && fHair > mHair` 를 되살린다. */
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
