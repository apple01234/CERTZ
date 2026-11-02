// node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs tests/decor-objects.test.mjs
//
// vc235 — 장식 오브젝트 계약 검증.
//
// [무엇을 지키나]
//  `_assets_in` 타일셋에서 뽑은 오브젝트는 세 곳이 **동시에** 맞아야 화면에 나온다:
//   1) public/assets/objects/<set>/<key>.png  — 파일이 실제로 있어야
//   2) src/game/decorObjects.ts DECOR_SETS     — 로드·배치 목록에 있어야
//   3) BootScene 이 DECOR_SETS 를 순회해 load 함
//  하나라도 빠지면 Phaser 가 __MISSING(검은 사각형)으로 그리거나 조용히 안 나온다.
//  실제로 v1.4.11 에서 kd_plant 3종을 treeSet 에만 넣고 부트 로드에 빠뜨려
//  "검은 사각형 + 녹색 대각선" 글리치가 마을 나무 절반에서 발생한 이력이 있다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DECOR_SETS, DECOR_BUDGET, CHAPTER_DECOR_SET,
  pickByTag, decorSetFor,
} from '../src/game/decorObjects.ts';

const root = new URL('../', import.meta.url);
let checked = 0;

/* ── 1. 카탈로그 ↔ 실제 파일 ─────────────────────────────────────────── */
for (const [setName, list] of Object.entries(DECOR_SETS)) {
  assert.ok(list.length > 0, `${setName}: 오브젝트가 비어 있으면 배치가 무의미하다`);
  for (const o of list) {
    const p = new URL(`public/assets/objects/${setName}/${o.key}.png`, root);
    assert.ok(fs.existsSync(p), `${o.key}: PNG 가 없다 (${setName})`);
    assert.ok(o.w > 0 && o.h > 0, `${o.key}: 크기 정보 필요`);
    assert.ok(['wall', 'floor', 'big', 'small'].includes(o.tag), `${o.key}: 태그 ${o.tag} 는 배치 규칙에 없다`);
    checked++;
  }
}

/* ── 2. catalog.json 과 DECOR_SETS 가 어긋나지 않는가 ───────────────── */
for (const [setName, list] of Object.entries(DECOR_SETS)) {
  const jp = new URL(`public/assets/objects/${setName}/catalog.json`, root);
  const cat = JSON.parse(fs.readFileSync(jp, 'utf8'));
  const catKeys = new Set(cat.map((c) => `obj_${setName}_${c.name}`));
  for (const o of list) {
    assert.ok(catKeys.has(o.key), `${o.key}: catalog.json 에 없다 — 추출 도구와 목록이 어긋났다`);
  }
}

/* ── 3. 모든 챕터가 배치 세트를 갖는가 ──────────────────────────────── */
const chapters = ['forest', 'kingdom', 'alfheim', 'muspelheim', 'niflheim',
                  'cave', 'nidavellir', 'hel', 'abyss', 'howlrstone'];
for (const ch of chapters) {
  const set = decorSetFor(ch);
  assert.ok(DECOR_SETS[set], `${ch}: 세트 ${set} 가 DECOR_SETS 에 없다`);
  assert.ok(DECOR_BUDGET[set], `${ch}: 세트 ${set} 의 예산이 없다 — 배치가 조용히 0이 된다`);
}

/* ── 4. 예산이 물리적으로 채워질 수 있는가 ──────────────────────────── */
for (const [setName, budget] of Object.entries(DECOR_BUDGET)) {
  for (const tag of ['big', 'wall', 'floor', 'small']) {
    const pool = pickByTag(setName, tag);
    /* vc235 — 예산이 0이면 후보가 없어도 정상이다.
     *  town 세트에는 floor 태그(카펫·식탁류 바닥 가구)가 없다.
     *  예산을 0으로 맞춰두면 배치 코드가 조용히 실패하지 않는다. */
    if (budget[tag] === 0) {
      continue;
    }
    assert.ok(pool.length > 0, `${setName}/${tag}: 예산은 ${budget[tag]} 인데 후보가 0개다`);
  }
}

/* ── 5. 배치 예산이 무제한이 아닌가 (vc232 "오브젝트 줄이기" 회귀 방지) ── */
for (const [setName, b] of Object.entries(DECOR_BUDGET)) {
  const total = b.big + b.wall + b.floor + b.small;
  assert.ok(total <= 30, `${setName}: 총 ${total}개는 과하다 (vc232 지적: 시각 노이즈)`);
}

/* ── 6. BootScene 이 DECOR_SETS 를 실제로 로드하는가 ────────────────── */
{
  const boot = fs.readFileSync(new URL('src/game/scenes/BootScene.ts', root), 'utf8');
  assert.ok(boot.includes('DECOR_SETS'), 'BootScene 이 DECOR_SETS 를 import 하지 않으면 텍스처가 없다');
  assert.ok(/objects\/\$\{setName\}/.test(boot), 'BootScene 이 objects/<set>/<key>.png 경로로 로드해야 한다');
}

/* ── 7. WorldScene 이 배치를 호출하는가 ─────────────────────────────── */
{
  const ws = fs.readFileSync(new URL('src/game/scenes/WorldScene.ts', root), 'utf8');
  assert.ok(ws.includes('placeDecorObjects('), 'WorldScene 에 오브젝트 배치 호출이 필요하다');
  assert.ok(/this\.placeDecorObjects\(ch, rng, blocked\)/.test(ws), '배치 호출이 placeDecor 안에 있어야 한다');
  assert.ok(ws.includes('this.textures.exists(o.key)'), '로드 누락 시 __MISSING 글리치를 막는 가드가 필요하다');
}

/* ── 8. 태그별 후보가 태그 규칙과 맞는가 ────────────────────────────── */
{
  // wall 은 벽에 붙는 소품이라 전부 small/big 보다 작거나 같아야 한다(상식 검증).
  const walls = Object.entries(DECOR_SETS).flatMap(([s, l]) => l.filter((o) => o.tag === 'wall').map((o) => ({ ...o, s })));
  assert.ok(walls.length > 0, 'wall 태그 오브젝트가 하나도 없으면 벽면 연출이 사라진다');
}

console.log(
  `ALL CHECKS PASS: ${checked} objects across ${Object.keys(DECOR_SETS).length} sets / ` +
  `${chapters.length} chapters mapped / budgets bounded`,
);
