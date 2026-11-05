import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 프롭 타일 배수 정규화 — vc253 (지시 #1 "오브젝트가 크기에 맞게 잘리지 않음").
 *
 * [실측한 문제] 프롭 원본 크기가 제각각이고 타일(셀) 배수가 아니었다:
 *   torch 28×52 / chest 48×40 / anvil 52×36 / bookshelf 64×128
 *   tree_pink 65×80 / rock_monument 100×89 / house_blue 160×112
 * 셀은 cellW=mapW/cols ≈ 144, cellH=mapH/rows ≈ 128.
 * 52px 토치를 그대로 깔면 0.36칸짜리 오브젝트가 격자 사이에 어중간하게 걸린다.
 *
 * [해결] 원본이 차지할 칸 수(0.5칸 단위)를 정하고, 그 칸에 정확히 맞는 배율을 계산한다.
 * 이 테스트는 그 계산이 실제 프롭 크기에서 셀 배수로 떨어지는지 확인한다.
 */

const ROOT = path.resolve(import.meta.dirname, '..');

/** AuthoredMapLayers.snapPropScale 과 동일한 식 (순수 함수로 복제 — 렌더 없이 검증) */
function snapPropScale(srcW, srcH, baseScale, cellW, cellH) {
  const cellsW = Math.max(0.5, Math.round((srcW * baseScale) / cellW * 2) / 2);
  const cellsH = Math.max(0.5, Math.round((srcH * baseScale) / cellH * 2) / 2);
  const fit = Math.min((cellsW * cellW) / srcW, (cellsH * cellH) / srcH);
  return Math.max(0.5, Math.min(2.5, fit));
}

/* 실제 프롭 크기 (public/assets/objects 실측) */
const PROPS = [
  { key: 'obj_dungeon_torch', w: 28, h: 52 },
  { key: 'obj_dungeon_chest', w: 48, h: 40 },
  { key: 'obj_dungeon_anvil', w: 52, h: 36 },
  { key: 'obj_dungeon_bookshelf', w: 64, h: 128 },
  { key: 'obj_forest_tree_pink', w: 65, h: 80 },
  { key: 'obj_forest_rock_monument', w: 100, h: 89 },
  { key: 'obj_town_house_blue', w: 160, h: 112 },
];

const CELL_W = 144; // 1900 / 13  (authoredLayouts: cols = floor(mapW/144))
const CELL_H = 128;

test('정규화 후 프롭의 주축이 셀의 반 칸 배수에 맞는다', () => {
  /* [왜 한 축만인가] 종횡비를 보존해야 스프라이트가 찌그러지지 않는다.
   *  따라서 가로/세로 중 **큰 쪽(주축)** 만 셀 배수에 정확히 맞추고, 다른 축은
   *  비율에 따라 따라온다. 둘 다 강제로 맞추면 픽셀아트가 늘어난다. */
  const bad = [];
  for (const p of PROPS) {
    const s = snapPropScale(p.w, p.h, 1, CELL_W, CELL_H);
    const outW = p.w * s;
    const outH = p.h * s;
    /* 주축 = 셀 대비 점유가 큰 축 */
    const relW = outW / CELL_W;
    const relH = outH / CELL_H;
    const major = relW >= relH ? relW : relH;
    const cell = relW >= relH ? CELL_W : CELL_H;
    const majorPx = relW >= relH ? outW : outH;
    const off = Math.abs(major / 0.5 - Math.round(major / 0.5)) * 0.5 * cell;
    if (off > 1) bad.push(`${p.key}: 주축 ${majorPx.toFixed(1)}px = ${major.toFixed(3)}칸 (오차 ${off.toFixed(1)}px)`);
  }
  assert.deepEqual(bad, [], `주축이 격자에 안 맞는 프롭:\n${bad.join('\n')}`);
});

test('프롭이 셀을 넘지 않는다', () => {
  const over = [];
  for (const p of PROPS) {
    const s = snapPropScale(p.w, p.h, 1, CELL_W, CELL_H);
    /* 2칸을 넘는 프롭은 없다 — 넘으면 맵을 덮어 통행 판정과 어긋난다 */
    if (p.w * s > CELL_W * 2 + 1 || p.h * s > CELL_H * 2 + 1) {
      over.push(`${p.key}: ${(p.w * s).toFixed(0)}×${(p.h * s).toFixed(0)}`);
    }
  }
  assert.deepEqual(over, [], `셀 2칸 초과: ${over.join(', ')}`);
});

test('프롭이 너무 작아지지 않는다 (가시성)', () => {
  /* 0.5배 미만으로 줄면 점처럼 보인다 — 최소 배율 보장 확인 */
  for (const p of PROPS) {
    const s = snapPropScale(p.w, p.h, 1, CELL_W, CELL_H);
    assert.ok(s >= 0.5, `${p.key} 배율 ${s.toFixed(2)} < 0.5`);
    const px = Math.max(p.w * s, p.h * s);
    assert.ok(px >= 30, `${p.key} 최대변 ${px.toFixed(0)}px — 너무 작다`);
  }
});

test('원본 크기가 변해도 계산이 깨지지 않는다 (경계값)', () => {
  /* 아주 작은/큰 프롭, baseScale 이 다른 경우 */
  for (const [w, h, bs] of [[8, 8, 1], [400, 300, 1], [64, 128, 2], [28, 52, 0.7]]) {
    const s = snapPropScale(w, h, bs, CELL_W, CELL_H);
    assert.ok(Number.isFinite(s) && s > 0, `(${w}×${h}, ${bs}) → ${s}`);
    assert.ok(s >= 0.5 && s <= 2.5, `(${w}×${h}, ${bs}) 배율 범위 밖: ${s}`);
  }
});

test('배치 좌표가 반 칸 격자에 스냅되고 셀 경계를 넘지 않는다', () => {
  /* vc253 — 0.28셀 밀어낸 임의 좌표를 그대로 쓰면 격자 사이에 걸린다.
   *  [함정] 단순 반올림은 앵커를 다음 셀(벽)로 넘긴다. 0.78셀은 1.0 으로 반올림되어
   *   Math.floor(y/cell) 이 c+1 이 되고, "edge decor must sit on walkable ground"
   *   불변식이 깨졌다. snapInCell 은 넘치면 그 셀 중앙으로 당긴다. */
  const snapInCell = (v, cell, idx) => {
    const half = cell * 0.5;
    const snapped = Math.round(v / half) * half;
    /* 경계값은 부동소수 오차로 셀이 뒤집히므로 쓰지 않는다 → 넘치면 중앙으로 */
    if (snapped >= (idx + 1) * cell || snapped <= idx * cell) return idx * cell + half;
    return snapped;
  };
  const nudge = 0.28;
  for (const c of [1, 2, 5, 11]) {
    for (const side of ['n', 's', 'w', 'e']) {
      let px = (c + 0.5) * CELL_W;
      let py = (c + 0.5) * CELL_H;
      if (side === 'n') py -= CELL_H * nudge;
      if (side === 's') py += CELL_H * nudge;
      if (side === 'w') px -= CELL_W * nudge;
      if (side === 'e') px += CELL_W * nudge;
      const sx = snapInCell(px, CELL_W, c), sy = snapInCell(py, CELL_H, c);
      /* ① 셀 경계를 넘지 않아야 한다 — 넘으면 벽으로 판정된다 */
      assert.ok(Math.floor(sx / CELL_W) === c, `c=${c} side=${side} px=${sx} → 셀 ${Math.floor(sx / CELL_W)} (기대 ${c})`);
      assert.ok(Math.floor(sy / CELL_H) === c, `c=${c} side=${side} py=${sy} → 셀 ${Math.floor(sy / CELL_H)} (기대 ${c})`);
      /* ② 반 칸 격자점에 있어야 한다 */
      const offX = Math.abs(sx / (CELL_W * 0.5) - Math.round(sx / (CELL_W * 0.5))) * CELL_W * 0.5;
      const offY = Math.abs(sy / (CELL_H * 0.5) - Math.round(sy / (CELL_H * 0.5))) * CELL_H * 0.5;
      assert.ok(offX < 0.01 && offY < 0.01, `c=${c} side=${side} → (${sx}, ${sy}) 격자 이탈`);
    }
  }
});

test('구현이 실제로 정규화를 쓰고 있다(회귀 방지)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/game/fx/AuthoredMapLayers.ts'), 'utf8');
  assert.ok(src.includes('snapPropScale'), 'snapPropScale 이 없다');
  /* prop 과 propNoCollide 둘 다 적용해야 한쪽만 남아 크기가 갈라지지 않는다 */
  const uses = (src.match(/setScale\(snapPropScale\(/g) || []).length;
  assert.ok(uses >= 2, `setScale(snapPropScale(...)) 적용 지점이 ${uses}개 — prop/propNoCollide 둘 다 필요`);
  assert.ok(src.includes('snapInCell'), '좌표 스냅이 없다');
});
