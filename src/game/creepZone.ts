/**
 * vc277 — 구역 볼륨 스폰(CreepZone).
 *
 * 왜 이 파일이 있나
 * -----------------
 * 참고 게임(ISEKAI GATE)은 적 배치를 두 레이어로 나눈다. maps 번들에
 * `CreepZone` 178개 / `NoCreepZone` 42개가 **타일맵과 별도 오브젝트 레이어**로 존재하고,
 * 16×16 타일맵(154개)은 순수 시각만 담당한다. 즉 "어디에 무엇이 나오는가"는
 * 타일이 아니라 **구역 볼륨**이 결정한다.
 *
 * SERTZ 는 `WorldScene.openPointRng` 로 개방 셀 **전체**에 균등 산개했다.
 * 그래서 맵 어디를 가도 같은 종족이 섞여 나오고, "이 구역은 늑대, 저 구역은 유령" 같은
 * 공간적 정체성이 생기지 않는다.
 *
 * 이 모듈은 개방 셀을 그룹 수만큼 **공간적으로 인접한 구역**으로 쪼갠다.
 * 순수 함수다 — Phaser 를 import 하지 않으므로 노드 테스트에서 그대로 검증된다.
 */

/** 이 모듈이 필요로 하는 레이아웃 최소 형태 (mapgen.RoomLayout 의 부분집합) */
export type CreepLayout = {
  cols: number;
  rows: number;
  /** open[r * cols + c] = 개방 셀 */
  open: boolean[] | Uint8Array;
  entry: number;
};

export type CreepZone = {
  /** 0..groups-1 — 그룹 배정 순서와 같다 */
  index: number;
  /** 이 구역에 속한 셀 인덱스(r * cols + c) */
  cells: number[];
  /** 구역 무게중심(셀 좌표계, 소수) — 디버그/정렬용 */
  cx: number;
  cy: number;
};

/** 문자열 시드 → 32bit 정수 (xorshift 용) */
function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h || 1;
}

/** 결정론적 난수기 — Phaser 없이 같은 시드면 같은 수열 */
function makeRng(seed: number): () => number {
  let x = seed >>> 0;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return x / 4294967296;
  };
}

/**
 * 개방 셀을 `groups` 개의 인접 구역으로 나눈다.
 *
 * 방식: 무작위 **시드 셀**을 groups 개 뽑고, 나머지 셀을 가장 가까운 시드에 배정한다
 * (보로노이 분할). 거리 비교에는 결정론적 타이브레이커를 넣어 같은 시드에서
 * 항상 같은 결과가 나오게 한다. 인접성이 보장되므로 "구역 = 뭉쳐진 영역"이 된다.
 *
 * ── 왜 groups 를 종족 수와 다르게 쓰는가 (vc277 실측 후 수정) ──
 * 처음엔 종족 수만큼 나눴다. 그런데 1-1 스테이지는 개방 셀 57개에 종족 2개라
 * 구역이 **맵 절반씩 2개**로만 갈렸고, 종족당 5마리·3마리가 그 넓은 절반에 흩어져
 * 응집도가 균등 산개와 사실상 같았다(실측 ratio 1.25 → 1.26, 차이 없음).
 *
 * 그래서 호출부는 **구역을 종족 수보다 잘게** 나누고, 종족마다 연속된 구역 몇 개를
 * 배정한다(`zonesPerGroup`). 한 종족의 활동 반경이 좁아져 "이 구역은 개구리"가 보인다.
 *
 * 경계 조건:
 *  · groups <= 1        → 전체 개방 셀을 한 구역으로
 *  · 개방 셀 < groups   → 앞쪽 groups 개 중 셀이 있는 것만 실제 셀을 받는다(빈 구역 허용)
 */
export function splitCreepZones(
  layout: CreepLayout,
  groups: number,
  seed: string,
): CreepZone[] {
  const n = Math.max(1, Math.floor(groups));
  const openCells: number[] = [];
  for (let i = 0; i < layout.open.length; i++) if (layout.open[i]) openCells.push(i);

  // 개방 셀이 없으면 전부 빈 구역 — 호출부가 폴백한다
  if (openCells.length === 0) {
    return Array.from({ length: n }, (_, index) => ({ index, cells: [], cx: 0, cy: 0 }));
  }
  // 그룹 1개 = 분할 의미 없음
  if (n === 1) {
    return [{ index: 0, cells: openCells.slice(), ...centroid(layout, openCells) }];
  }

  const rng = makeRng(hashSeed(seed));
  const cols = layout.cols;

  /* 시드 셀 뽑기 — 중복 없이. 개방 셀이 그룹보다 적으면 있는 만큼만. */
  const seeds: number[] = [];
  const pool = openCells.slice();
  const seedCount = Math.min(n, pool.length);
  for (let i = 0; i < seedCount; i++) {
    const pick = Math.floor(rng() * pool.length);
    seeds.push(pool[pick]);
    pool.splice(pick, 1);
  }

  const buckets: number[][] = Array.from({ length: n }, () => []);
  for (const cell of openCells) {
    const c = cell % cols;
    const r = Math.floor(cell / cols);
    let best = 0;
    let bestD = Infinity;
    for (let s = 0; s < seeds.length; s++) {
      const sc = seeds[s] % cols;
      const sr = Math.floor(seeds[s] / cols);
      // 맨해튼 거리 — 굴 형태(직교 이동)에서 자연스럽다
      const d = Math.abs(c - sc) + Math.abs(r - sr);
      if (d < bestD) { bestD = d; best = s; }
    }
    buckets[best].push(cell);
  }
  /* 셀이 하나도 없는 구역(시드가 서로 붙어 흡수된 경우)은 가장 큰 구역에서 하나를 덜어온다.
   * 빈 구역을 남기면 그 그룹의 몬스터가 통째로 사라진다. */
  for (let i = 0; i < n; i++) {
    if (buckets[i].length > 0) continue;
    let donor = -1;
    let donorLen = 1;
    for (let j = 0; j < n; j++) {
      if (buckets[j].length > donorLen) { donor = j; donorLen = buckets[j].length; }
    }
    if (donor >= 0) buckets[i].push(buckets[donor].pop() as number);
  }

  return buckets.map((cells, index) => ({ index, cells, ...centroid(layout, cells) }));
}

function centroid(layout: CreepLayout, cells: number[]): { cx: number; cy: number } {
  if (cells.length === 0) return { cx: 0, cy: 0 };
  let sx = 0;
  let sy = 0;
  for (const c of cells) {
    sx += c % layout.cols;
    sy += Math.floor(c / layout.cols);
  }
  return { cx: sx / cells.length, cy: sy / cells.length };
}

/**
 * 종족(groups)마다 **공간적으로 뭉친 구역들**을 배정한다.
 *
 * ── 왜 각도 정렬을 버렸나 (vc277 실측) ──
 * 처음엔 잘게 나눈 구역을 무게중심 **각도**로 정렬해 종족당 연속 zpg 개를 줬다.
 * 실측 결과 ratio 가 1.25(이식 전) → 1.20 으로 **오히려 나빠졌고**, 종족별 최대 반경은
 * 개구리 372 / 물고기 758 로 벌어졌다. 각도 정렬은 지형을 무시해서, 목록에서 "연속"이
 * 실제 공간에서 "뭉침"을 뜻하지 않았다(호 모양으로 퍼짐). 마릿수가 적은 스테이지에서는
 * 무작위성이 이를 덮어버려 효과가 사라진다.
 *
 * 지금은 **BFS 성장**을 쓴다. 종족마다 시드 구역 하나에서 시작해, 아직 안 준 구역 중
 * **가장 가까운(무게중심 거리)** 것을 이어 붙인다. 그러면 한 종족이 받는 구역들은
 * 실제 좌표계에서 인접한 덩어리가 된다.
 */
export function assignCreepZones(
  layout: CreepLayout,
  groupCount: number,
  seed: string,
  zonesPerGroup = 3,
): CreepZone[][] {
  const g = Math.max(1, Math.floor(groupCount));
  if (g === 1) {
    const all = openCellList(layout);
    return [[{ index: 0, cells: all, ...centroid(layout, all) }]];
  }
  const zpg = Math.max(1, Math.floor(zonesPerGroup));
  const fine = splitCreepZones(layout, g * zpg, seed);

  const out: CreepZone[][] = Array.from({ length: g }, () => []);
  const used = new Set<number>();

  /* 종족 i 의 시작 구역 — 아직 안 쓴 것 중 앞에서부터. splitCreepZones 가 이미
   * 시드 기반 보로노이 분할이라 순서 자체가 무작위성을 갖는다. */
  for (let gi = 0; gi < g; gi++) {
    let start = fine.findIndex((z, i) => !used.has(i) && z.cells.length > 0);
    if (start < 0) start = fine.findIndex((_, i) => !used.has(i));
    if (start < 0) break;
    used.add(start);
    out[gi].push(fine[start]);

    /* 남은 자리를 BFS 로 채운다 — **이미 받은 구역 전체** 중 가장 가까운 미사용 구역.
     *  직전 구역 하나만 기준으로 삼으면 (2.6,6.1)→(4.1,4.4)→(3.0,3.0) 처럼 되돌아가
     *  체인이 지그재그가 된다(실측). 전체 집합 기준으로 재야 덩어리가 유지된다. */
    while (out[gi].length < zpg) {
      let best = -1;
      let bestD = Infinity;
      for (let i = 0; i < fine.length; i++) {
        if (used.has(i) || fine[i].cells.length === 0) continue;
        let d = Infinity;
        for (const z of out[gi]) {
          const dd = Math.hypot(fine[i].cx - z.cx, fine[i].cy - z.cy);
          if (dd < d) d = dd;
        }
        if (d < bestD) { bestD = d; best = i; }
      }
      if (best < 0) break; // 남은 구역 없음
      used.add(best);
      out[gi].push(fine[best]);
    }
  }
  return out;
}

function openCellList(layout: CreepLayout): number[] {
  const open: number[] = [];
  for (let i = 0; i < layout.open.length; i++) if (layout.open[i]) open.push(i);
  return open;
}
