/**
 * floor-band-coverage.test.mjs — vc275 P1b 전수 검증
 *
 * 유저 지적: "건물 주변과 일부 맵 경계가 잘린 듯 보인다", "갈색 바닥과 초록색 바닥이
 * 부자연스럽게 맞닿는다", 그리고 "타일이 잘린 건지 / 카메라 문제인지 / 맵 경계가 잘못
 * 생성된 건지 구분하라".
 *
 * [구분 결과]
 *  · 카메라 문제 아님 — viewZoom() 반영 후 월드가 뷰보다 작은 경우는 실내 832×832 뿐이고
 *    그건 의도된 확대 연출이다. 필드/던전은 전부 뷰보다 크다.
 *  · 맵 경계 생성 문제 아님 — lay.open 그리드는 연결성 테스트가 이미 보장한다.
 *  · **타일 배치 문제 맞음** — 지면/경로/구조물 레이어가 unit(28·32px) 격자로 그려져
 *    셀(145~153px)과 어긋났다. 중심점 판정이라 경계에서 침범(bleed)과 미달(miss)이
 *    동시에 발생했다.
 *
 * 이 테스트는 **165개 authored 스테이지 전부**에서
 *   ① 밴드가 셀 경계에 정확히 붙고
 *   ② 경로/구조물이 요구되는 셀을 빠짐없이, 넘치지도 않게 덮는지
 * 를 검사한다. 하나라도 어긋나면 "잘린 듯/틈" 이 재발한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { authoredRoomLayout } from '../src/game/authoredLayouts.ts';
import { renderAuthoredMapLayers } from '../src/game/fx/AuthoredMapLayers.ts';
import { STAGES } from '../src/game/stages.ts';

const manifest = JSON.parse(fs.readFileSync(new URL('../public/assets/ground/manifest.json', import.meta.url)));
const existingProp = key => ['dungeon', 'forest', 'town'].some(set => fs.existsSync(new URL(`../public/assets/objects/${set}/${key}.png`, import.meta.url)));

function makeScene() {
  const bands = [];
  return {
    bands,
    textures: { exists: key => key in manifest || existingProp(key), get: key => ({ getSourceImage: () => manifest[key] }) },
    add: {
      image: (x, y, key) => ({ x, y, key, name: '',
        setOrigin() { return this; }, setScale(s) { this.scale = s; return this; },
        setDepth() { return this; }, setName(n) { this.name = n; return this; }, setTint() { return this; } }),
      tileSprite: (x, y, w, h, key) => {
        const ts = { x, y, w, h, key, name: '', tilePosition: { x: 0, y: 0 },
          setOrigin() { return this; }, setDepth() { return this; }, setTint() { return this; },
          setName(n) { this.name = n; return this; },
          setTilePosition(tx, ty) { this.tilePosition = { x: tx, y: ty }; return this; },
          destroy() {} };
        bands.push(ts); return ts;
      },
    },
    events: { once: () => {} },
  };
}

/** 밴드가 덮는 셀 집합 (밴드 좌표는 셀 경계에 정렬돼 있으므로 반올림으로 정확히 나뉜다) */
function coveredCells(bands, cols, rows, cellW, cellH) {
  const covered = new Set();
  for (const b of bands) {
    const c0 = Math.round(b.x / cellW), c1 = Math.round((b.x + b.w) / cellW);
    const r0 = Math.round(b.y / cellH), r1 = Math.round((b.y + b.h) / cellH);
    assert.ok(c0 >= 0 && c1 <= cols && r0 >= 0 && r1 <= rows,
      `band ${b.x},${b.y} ${b.w}x${b.h} escapes the ${cols}x${rows} grid`);
    for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) covered.add(r * cols + c);
  }
  return covered;
}

test('vc275 — 모든 authored 스테이지에서 지면 밴드가 셀 경계를 넘지도 비지도 않는다', () => {
  const keys = Object.values(STAGES).filter(s => authoredRoomLayout(s.key, s.width, s.height)?.authored).map(s => s.key);
  assert.ok(keys.length >= 160, `authored 스테이지가 ${keys.length}개뿐 — 조사 범위가 줄었다`);

  let totalBands = 0;
  for (const key of keys) {
    const def = STAGES[key];
    const lay = authoredRoomLayout(key, def.width, def.height);
    const scene = makeScene();
    const result = renderAuthoredMapLayers(scene, lay, () => {});
    assert.ok(result, `${key}: authored layers render`);

    const { cols, rows, cellW, cellH } = lay;
    const byRole = { ground: [], paths: [], structures: [] };
    for (const b of scene.bands) {
      const role = String(b.name).replace('rea:', '');
      assert.ok(role in byRole, `${key}: unexpected band name ${b.name}`);
      byRole[role].push(b);

      /* ① 셀 경계 정렬 — 어긋나면 셀을 침범하거나 틈이 생긴다.
       *  밴드 좌표는 Math.round(c * cellW) 로 만들어지므로 **정수 픽셀**이다.
       *  검증은 "그 좌표가 어떤 셀 인덱스의 반올림 경계와 정확히 일치하는가"로 한다.
       *  (cellH 가 143.75 같은 소수여도 round(2*143.75)=288 이므로 정확히 맞는다.
       *   인접 밴드가 같은 경계값을 공유하므로 틈·겹침이 생기지 않는다.) */
      const onGrid = (v, cell) => v === Math.round(Math.round(v / cell) * cell);
      for (const v of [b.x, b.x + b.w]) {
        assert.ok(onGrid(v, cellW), `${key}: band x=${v} is not an integer cell boundary (cellW=${cellW})`);
      }
      for (const v of [b.y, b.y + b.h]) {
        assert.ok(onGrid(v, cellH), `${key}: band y=${v} is not an integer cell boundary (cellH=${cellH})`);
      }
      /* ② 무늬 위상 — 인접 밴드가 한 장처럼 이어지려면 전역 좌표의 나머지여야 한다. */
      const size = manifest[b.key].width;
      assert.equal(b.tilePosition.x, b.x % size, `${key}: ${b.key} phase x`);
      assert.equal(b.tilePosition.y, b.y % size, `${key}: ${b.key} phase y`);
    }
    totalBands += scene.bands.length;

    /* ③ 역할별 셀 커버리지가 요구 집합과 **정확히** 일치해야 한다.
     *    빠진 셀 = 지면색 구멍(miss), 넘친 셀 = 통로/벽 침범(bleed). */
    const check = (role, want) => {
      const covered = coveredCells(byRole[role], cols, rows, cellW, cellH);
      const missing = [], extra = [];
      for (let cell = 0; cell < cols * rows; cell++) {
        const has = covered.has(cell);
        const needs = want(cell);
        if (needs && !has) missing.push(cell);
        if (!needs && has) extra.push(cell);
      }
      assert.deepEqual(missing, [], `${key}/${role}: ${missing.length}개 셀이 비었다 (지면색 구멍)`);
      assert.deepEqual(extra, [], `${key}/${role}: ${extra.length}개 셀을 침범했다`);
    };
    check('ground', () => true);
    check('paths', cell => !!lay.authored.paths[cell]);
    check('structures', cell => !lay.open[cell]);
  }
  assert.ok(totalBands > 0, 'bands were emitted');
});
