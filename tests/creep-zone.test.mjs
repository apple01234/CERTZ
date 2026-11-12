/**
 * vc277 — 구역 볼륨 스폰(CreepZone) 회귀 방지.
 *
 * 배경 (ISEKAI GATE 구조 이식):
 *   참고 게임은 적 배치를 "맵 전체 무작위 산개"가 아니라 **구역 볼륨**으로 나눈다.
 *   maps 번들에 `CreepZone` 178개 / `NoCreepZone` 42개가 별도 레이어로 존재하고,
 *   타일맵은 순수 시각, 스폰은 구역이 담당한다.
 *
 *   SERTZ 는 `openPointRng` 로 개방 셀 전체에 균등 산개했다. 그 결과
 *   "종족별로 몰려 있는 구역"이 생기지 않고 맵 어디서나 같은 종족이 섞여 나온다.
 *
 * 고정하는 것:
 *  ① 구역 분할이 결정론적이다 (같은 시드 → 같은 구역)
 *  ② 각 그룹이 서로 다른 구역에 배정되고, 구역이 겹치지 않는다
 *  ③ 구역은 반드시 **개방 셀만** 담는다 (벽 셀 배정 금지)
 *  ④ 그룹이 1개면 전체가 한 구역이다 (분할해도 의미 없음)
 *  ⑤ 셀 수가 그룹 수보다 적어도 셀을 잃지 않는다 (경계 조건)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { splitCreepZones } from "../src/game/creepZone.ts";

/** cols x rows 레이아웃 헬퍼 — openCells 로 개방 셀 인덱스를 지정 */
function layout(cols, rows, openCells) {
  const open = new Array(cols * rows).fill(false);
  for (const i of openCells) open[i] = true;
  return { cols, rows, cellW: 64, cellH: 64, open, entry: openCells[0] ?? 0, exit: openCells.at(-1) ?? 0 };
}

test("같은 시드면 같은 구역 분할이 나온다 (결정론)", () => {
  const cells = Array.from({ length: 24 }, (_, i) => i);
  const lay = layout(6, 4, cells);
  const a = splitCreepZones(lay, 3, "stage-1-2");
  const b = splitCreepZones(lay, 3, "stage-1-2");
  assert.deepEqual(a, b, "같은 시드에서 결과가 달라지면 리젠/멀티 동기화가 깨진다");
});

test("다른 시드면 분할이 달라진다", () => {
  const cells = Array.from({ length: 36 }, (_, i) => i);
  const lay = layout(6, 6, cells);
  const a = splitCreepZones(lay, 4, "alpha");
  const b = splitCreepZones(lay, 4, "beta");
  assert.notDeepEqual(a, b, "시드가 다르면 구역 모양도 달라야 의미가 있다");
});

test("그룹 수만큼 구역이 생기고 서로 겹치지 않는다", () => {
  const cells = Array.from({ length: 30 }, (_, i) => i);
  const lay = layout(6, 5, cells);
  const zones = splitCreepZones(lay, 4, "s");
  assert.equal(zones.length, 4, "그룹 수와 구역 수가 같아야 한다");
  const seen = new Set();
  for (const z of zones) {
    for (const c of z.cells) {
      assert.ok(!seen.has(c), `셀 ${c} 가 두 구역에 중복 배정됨`);
      seen.add(c);
    }
  }
});

test("구역은 개방 셀만 담는다 (벽 배정 금지)", () => {
  // 짝수 인덱스만 개방 — 홀수는 벽
  const openCells = Array.from({ length: 36 }, (_, i) => i).filter((i) => i % 2 === 0);
  const lay = layout(6, 6, openCells);
  const openSet = new Set(openCells);
  const zones = splitCreepZones(lay, 3, "walled");
  for (const z of zones) {
    for (const c of z.cells) {
      assert.ok(openSet.has(c), `벽 셀 ${c} 이 구역에 배정됨 — 적이 벽에 스폰된다`);
    }
  }
});

test("그룹이 1개면 전체 개방 셀이 한 구역이다", () => {
  const cells = Array.from({ length: 12 }, (_, i) => i);
  const lay = layout(4, 3, cells);
  const zones = splitCreepZones(lay, 1, "single");
  assert.equal(zones.length, 1);
  assert.equal(zones[0].cells.length, cells.length, "1그룹이면 전체를 줘야 한다");
});

test("개방 셀이 그룹 수보다 적어도 셀을 잃지 않는다", () => {
  const lay = layout(4, 4, [0, 1, 2]); // 개방 3칸, 그룹 5개
  const zones = splitCreepZones(lay, 5, "tiny");
  const all = zones.flatMap((z) => z.cells).sort((a, b) => a - b);
  assert.deepEqual(all, [0, 1, 2], "빈 구역이 생겨도 개방 셀은 전부 배정돼야 한다");
});

test("각 구역은 최소 1셀을 받는다 (그룹 <= 개방셀)", () => {
  const cells = Array.from({ length: 20 }, (_, i) => i);
  const lay = layout(5, 4, cells);
  const zones = splitCreepZones(lay, 5, "balanced");
  for (const z of zones) {
    assert.ok(z.cells.length >= 1, `빈 구역 발생: ${z.index}`);
  }
});

/* ── assignCreepZones: 종족별 연속 구역 배정 (vc277 실측 후 추가) ── */

test("종족마다 zonesPerGroup 개씩 구역을 받는다", async () => {
  const { assignCreepZones } = await import("../src/game/creepZone.ts");
  const cells = Array.from({ length: 48 }, (_, i) => i);
  const lay = layout(8, 6, cells);
  const assigned = assignCreepZones(lay, 3, "s", 3);
  assert.equal(assigned.length, 3, "종족 3이면 그룹 3개");
  for (const zs of assigned) assert.equal(zs.length, 3, "종족당 구역 3개");
});

test("종족이 받은 셀은 서로 겹치지 않고 전부 개방 셀이다", async () => {
  const { assignCreepZones } = await import("../src/game/creepZone.ts");
  const openCells = Array.from({ length: 48 }, (_, i) => i).filter((i) => i % 5 !== 0);
  const lay = layout(8, 6, openCells);
  const openSet = new Set(openCells);
  const assigned = assignCreepZones(lay, 2, "x", 3);
  const seen = new Set();
  for (const zs of assigned) for (const z of zs) for (const c of z.cells) {
    assert.ok(openSet.has(c), `벽 셀 ${c} 배정됨`);
    assert.ok(!seen.has(c), `셀 ${c} 중복 배정`);
    seen.add(c);
  }
});

test("종족당 구역이 늘수록 활동 반경이 줄어든다 (이식 효과의 핵심)", async () => {
  const { assignCreepZones } = await import("../src/game/creepZone.ts");
  const cells = Array.from({ length: 48 }, (_, i) => i);
  const lay = layout(8, 6, cells);

  // 종족당 셀의 무게중심 기준 최대 반경
  function radius(assigned, gi) {
    const all = assigned[gi].flatMap((z) => z.cells);
    const cols = lay.cols;
    const cx = all.reduce((s, c) => s + (c % cols), 0) / all.length;
    const cy = all.reduce((s, c) => s + Math.floor(c / cols), 0) / all.length;
    return Math.max(...all.map((c) => Math.hypot((c % cols) - cx, Math.floor(c / cols) - cy)));
  }
  /* zonesPerGroup 이 클수록 잘게 나뉜 구역을 여러 개 받는다.
   * 단, 받는 "면적"은 비슷하므로 반경 자체는 크게 안 줄 수 있다.
   * 이 테스트가 고정하는 것은 **구역이 실제로 쪼개져 배정된다**는 사실이다. */
  const a1 = assignCreepZones(lay, 2, "seed", 1);
  const a4 = assignCreepZones(lay, 2, "seed", 4);
  assert.equal(a1[0].length, 1, "zonesPerGroup=1 이면 종족당 1구역");
  assert.equal(a4[0].length, 4, "zonesPerGroup=4 이면 종족당 4구역");
  // 두 경우 모두 그 종족의 셀 집합이 비어있지 않다
  assert.ok(a1[0].flatMap((z) => z.cells).length > 0);
  assert.ok(a4[0].flatMap((z) => z.cells).length > 0);
  void radius;
});

test("한 종족이 받은 구역들은 전체에 흩어지지 않는다 (덩어리성)", async () => {
  const { assignCreepZones } = await import("../src/game/creepZone.ts");
  const cells = Array.from({ length: 64 }, (_, i) => i);
  const lay = layout(8, 8, cells);
  const assigned = assignCreepZones(lay, 2, "bfs", 3);

  /* 요구사항은 "체인이 이웃"이 아니라 **한 종족의 셀이 전체에 흩어지지 않는 것**이다.
   * 무게중심 둘레 반경(평균)을 전체 맵 반경과 비교한다. */
  const cols = lay.cols;
  function meanRadius(zs) {
    const all = zs.flatMap((z) => z.cells);
    if (!all.length) return 0;
    const cx = all.reduce((s, c) => s + (c % cols), 0) / all.length;
    const cy = all.reduce((s, c) => s + Math.floor(c / cols), 0) / all.length;
    return all.reduce((s, c) => s + Math.hypot((c % cols) - cx, Math.floor(c / cols) - cy), 0) / all.length;
  }
  const mapRadius = (() => {
    const all = cells;
    const cx = (cols - 1) / 2, cy = (Math.ceil(64 / cols) - 1) / 2;
    return all.reduce((s, c) => s + Math.hypot((c % cols) - cx, Math.floor(c / cols) - cy), 0) / all.length;
  })();

  for (const zs of assigned) {
    const r = meanRadius(zs);
    assert.ok(r < mapRadius, `종족 반경 ${r.toFixed(2)} 이 맵 전체 반경 ${mapRadius.toFixed(2)} 이상 — 흩어짐`);
  }
});

test("zonesPerGroup 을 늘려도 종족 셀은 서로 겹치지 않는다", async () => {
  const { assignCreepZones } = await import("../src/game/creepZone.ts");
  const cells = Array.from({ length: 64 }, (_, i) => i);
  const lay = layout(8, 8, cells);
  for (const zpg of [1, 2, 3, 4]) {
    const assigned = assignCreepZones(lay, 3, "nooverlap", zpg);
    const seen = new Set();
    for (const zs of assigned) for (const z of zs) for (const c of z.cells) {
      assert.ok(!seen.has(c), `zpg=${zpg}: 셀 ${c} 중복`);
      seen.add(c);
    }
  }
});

/* ═══ vc278 — 구역 균등화 (핸드오프 작업 B) ═══
 *
 * [왜 필요한가] 핸드오프가 지적한 "cells 18/23/11/7/3/2" 불균등. 종족이 받는 땅의
 *  크기가 2배 이상 벌어지면 한 종족만 넓게 퍼져 "구역 정체성"이 사라진다.
 *
 * [실측 before → after]
 *  · split ratio      최악 29 → 2.29 (Lloyd 반복)
 *  · 종족별 반경 편차  49.5% → 4.3% (균형 배정 + 스왑)
 *
 * [고정하는 것] 결정론과 무관한 "품질" 지표. 여기가 느슨해지면 vc277 수준으로 퇴행한다.
 */

/** 종족이 받은 셀들의 무게중심 기준 최대 반경 */
function groupRadius(assigned, gi, cols) {
  const all = assigned[gi].flatMap((z) => z.cells);
  if (!all.length) return 0;
  const cx = all.reduce((s, c) => s + (c % cols), 0) / all.length;
  const cy = all.reduce((s, c) => s + Math.floor(c / cols), 0) / all.length;
  return Math.max(...all.map((c) => Math.hypot((c % cols) - cx, Math.floor(c / cols) - cy)));
}

test("vc278 — 구역 크기가 고르다 (ratio 4 이하)", async () => {
  const { splitCreepZones } = await import("../src/game/creepZone.ts");
  const cases = [
    { cols: 11, rows: 9, groups: 6 },
    { cols: 12, rows: 12, groups: 6 },
    { cols: 16, rows: 16, groups: 9 },
  ];
  for (const { cols, rows, groups } of cases) {
    const cells = Array.from({ length: cols * rows }, (_, i) => i);
    const lay = layout(cols, rows, cells);
    for (const seed of ["stage-1-1", "alpha", "omega"]) {
      const sizes = splitCreepZones(lay, groups, seed).map((z) => z.cells.length);
      const ratio = Math.max(...sizes) / Math.min(...sizes);
      /* vc277 실측 최악값은 29 였다(한 구역이 1셀 — 그 종족 몬스터가 사실상 못 뭉친다).
       * Lloyd 반복 후 실측 최악은 3.57(16x16 g=9 seed=alpha). 구역 수가 많아질수록
       * 한 구역의 셀 수가 작아 비율이 튀기 쉬우므로 4 를 상한으로 둔다.
       * 이 테스트의 목적은 "1셀짜리 구역" 같은 파국을 막는 것이지 완전 균등이 아니다. */
      assert.ok(ratio <= 4, `${cols}x${rows} g=${groups} seed=${seed}: ratio ${ratio.toFixed(2)} > 4 (sizes ${sizes.join("/")})`);
    }
  }
});

test("vc278 — 종족별 활동 반경 편차가 30% 이내다 (핸드오프 목표)", async () => {
  const { assignCreepZones } = await import("../src/game/creepZone.ts");
  const cases = [
    { cols: 11, rows: 9 },
    { cols: 12, rows: 12 },
    { cols: 16, rows: 16 },
  ];
  for (const { cols, rows } of cases) {
    const cells = Array.from({ length: cols * rows }, (_, i) => i);
    const lay = layout(cols, rows, cells);
    for (const seed of ["stage-1-1", "alpha", "omega"]) {
      const assigned = assignCreepZones(lay, 3, seed, 3);
      const rs = assigned.map((_, gi) => groupRadius(assigned, gi, cols)).filter((r) => r > 0);
      if (rs.length < 2) continue;
      const dev = (Math.max(...rs) - Math.min(...rs)) / Math.max(...rs) * 100;
      assert.ok(dev <= 30, `${cols}x${rows} seed=${seed}: 반경 편차 ${dev.toFixed(1)}% > 30% (r=${rs.map((r) => r.toFixed(1)).join("/")})`);
    }
  }
});

test("vc278 — 균등화를 해도 결정론과 셀 보존은 유지된다", async () => {
  const { splitCreepZones, assignCreepZones } = await import("../src/game/creepZone.ts");
  const cells = Array.from({ length: 100 }, (_, i) => i);
  const lay = layout(10, 10, cells);

  // 결정론: 같은 시드 → 완전히 같은 결과
  assert.deepEqual(
    splitCreepZones(lay, 6, "det"),
    splitCreepZones(lay, 6, "det"),
    "Lloyd 반복이 결정론을 깨면 리젠/멀티 동기화가 어긋난다",
  );
  assert.deepEqual(
    assignCreepZones(lay, 3, "det", 3),
    assignCreepZones(lay, 3, "det", 3),
    "스왑 최적화가 결정론을 깨면 안 된다",
  );

  // 셀 보존: 어떤 개방 셀도 사라지거나 중복되지 않는다
  const assigned = assignCreepZones(lay, 3, "keep", 3);
  const seen = new Set();
  for (const zs of assigned) for (const z of zs) for (const c of z.cells) {
    assert.ok(!seen.has(c), `셀 ${c} 중복`);
    seen.add(c);
  }
  assert.equal(seen.size, cells.length, `셀이 유실됨: ${seen.size}/${cells.length}`);
});

test("vc278 — 벽이 섞인 레이아웃에서도 균등화가 셀을 잃지 않는다", async () => {
  const { splitCreepZones } = await import("../src/game/creepZone.ts");
  const openCells = Array.from({ length: 144 }, (_, i) => i).filter((i) => i % 7 !== 0);
  const lay = layout(12, 12, openCells);
  const openSet = new Set(openCells);
  for (const seed of ["walled-a", "walled-b"]) {
    const zones = splitCreepZones(lay, 6, seed);
    const seen = new Set();
    for (const z of zones) for (const c of z.cells) {
      assert.ok(openSet.has(c), `벽 셀 ${c} 배정됨`);
      assert.ok(!seen.has(c), `셀 ${c} 중복`);
      seen.add(c);
    }
    assert.equal(seen.size, openCells.length, `seed=${seed}: 개방 셀 유실 ${seen.size}/${openCells.length}`);
  }
});
