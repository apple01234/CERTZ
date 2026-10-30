/**
 * autotile.ts — 4비트 이웃 마스크 오토타일 (v c204)
 *
 * 왜 필요한가
 * -----------
 * SERTZ 지면은 TileSprite 하나를 맵 전체에 반복하는 방식이라, 열린 영역과 벽이
 * 만나는 경계가 표현되지 않는다. 그래서 지형이 "같은 무늬가 끝없이 반복"되는
 * 것으로 보인다(유저 지적: "타일맵이 똑같음").
 *
 * 이 모듈은 RPG Maker MV 가 쓰는 방식과 같은 **이웃 비트마스크 → 패턴 인덱스**
 * 선택을 한다. 규칙은 게임 빌드에서 실측으로 역산했다(tools/autotile_derive.py):
 * WYDTTM 의 맵 23개를 분석하면 같은 오토타일 블록에서 이웃 마스크가 같으면
 * 같은 패턴이 선택되는 비율이 86~100%였다. 즉 "상/하/좌/우 중 같은 계열이
 * 이웃에 있는가"의 4비트로 패턴이 결정된다.
 *
 * 마스크
 * ------
 *   1 = 위가 같은 계열
 *   2 = 아래가 같은 계열
 *   4 = 왼쪽이 같은 계열
 *   8 = 오른쪽이 같은 계열
 *
 * 패턴 인덱스는 0~15 이고, 렌더러가 이 인덱스를 텍스처 키로 바꾼다.
 * 텍스처가 없는 인덱스는 `fallback` 으로 흘러가므로, 아틀라스를 일부만
 * 준비해도 화면이 깨지지 않는다.
 */

/** 4비트 이웃 마스크 (1=상 2=하 4=좌 8=우) */
export type NeighborMask = number;

export const BIT_UP = 1;
export const BIT_DOWN = 2;
export const BIT_LEFT = 4;
export const BIT_RIGHT = 8;

/**
 * 셀 격자에서 (c, r) 위치의 이웃 마스크를 계산한다.
 *
 * @param isSame  두 셀이 "같은 계열"(예: 둘 다 열린 땅)인지 판정하는 함수.
 *                격자 밖은 이웃 없음으로 본다.
 */
export function maskAt(
  cols: number,
  rows: number,
  c: number,
  r: number,
  isSame: (c1: number, r1: number, c2: number, r2: number) => boolean,
): NeighborMask {
  let m = 0;
  if (r > 0 && isSame(c, r, c, r - 1)) m |= BIT_UP;
  if (r < rows - 1 && isSame(c, r, c, r + 1)) m |= BIT_DOWN;
  if (c > 0 && isSame(c, r, c - 1, r)) m |= BIT_LEFT;
  if (c < cols - 1 && isSame(c, r, c + 1, r)) m |= BIT_RIGHT;
  return m;
}

/**
 * 배열 기반 격자(open 같은 boolean[])에서 이웃 마스크를 계산한다.
 * `open[idx] === true` 인 셀들끼리 같은 계열로 본다.
 */
export function openMaskAt(
  open: boolean[] | Uint8Array,
  cols: number,
  rows: number,
  c: number,
  r: number,
): NeighborMask {
  const at = (cc: number, rr: number) => {
    if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) return false;
    return !!open[rr * cols + cc];
  };
  if (!at(c, r)) return 0;
  let m = 0;
  if (at(c, r - 1)) m |= BIT_UP;
  if (at(c, r + 1)) m |= BIT_DOWN;
  if (at(c - 1, r)) m |= BIT_LEFT;
  if (at(c + 1, r)) m |= BIT_RIGHT;
  return m;
}

/**
 * 16개 마스크에 대한 기본 패턴 배정.
 *
 * 값은 "아틀라스에서 몇 번째 칸을 쓸 것인가"일 뿐이며, 실제 텍스처 키로의
 * 변환은 렌더러가 한다. 0 = 완전 고립, 15 = 사방이 같은 계열.
 * 경계(가장자리)를 별도 칸으로 두는 고전 방식과 달리, 여기서는
 * "내부/경계"만 구분하고 구체적 모양은 텍스처 쪽에서 담당한다.
 */
export const DEFAULT_PATTERN: Record<NeighborMask, number> = {
  0: 0,   // 고립
  1: 1,   // 위만 연결 (아래·좌·우 경계)
  2: 2,
  3: 3,   // 상하 연결 (좌우 경계)
  4: 4,
  5: 5,   // 상+좌 (오른아래 모서리)
  6: 6,   // 하+좌
  7: 7,   // 상하좌 (오른쪽만 경계)
  8: 8,
  9: 9,   // 상+우
  10: 10, // 하+우
  11: 11, // 상하우 (왼쪽만 경계)
  12: 12, // 좌우
  13: 13, // 상좌우 (아래만 경계)
  14: 14, // 하좌우 (위만 경계)
  15: 15, // 내부 (사방 연결)
};

/** 마스크 → 패턴 인덱스. 배정표를 바꾸고 싶으면 이 함수만 교체한다. */
export function patternFor(mask: NeighborMask): number {
  return DEFAULT_PATTERN[mask] ?? 15;
}

/**
 * 아틀라스 준비 상태를 보고 실제로 쓸 텍스처 키를 고른다.
 *
 * @param base     기본 텍스처 키 (예: "tile_grass")
 * @param pattern  patternFor() 결과
 * @param has      텍스처 존재 확인 함수 (scene.textures.exists)
 * @param fallback 아틀라스가 전혀 없을 때 쓸 키
 *
 * 규칙: `${base}_at${pattern}` → 없으면 `${base}_at15` → 없으면 fallback.
 * 이렇게 하면 아틀라스 일부만 있어도 화면이 깨지지 않는다.
 */
export function autotileKey(
  base: string,
  pattern: number,
  has: (key: string) => boolean,
  fallback: string,
): string {
  const exact = `${base}_at${pattern}`;
  if (has(exact)) return exact;
  const inner = `${base}_at15`;
  if (has(inner)) return inner;
  return fallback;
}

/**
 * 아틀라스가 한 장도 준비돼 있지 않은지 검사한다.
 * true 면 오토타일을 건너뛰고 기존 단일 타일 경로를 써야 한다.
 */
export function needsFallback(base: string, has: (key: string) => boolean): boolean {
  if (has(`${base}_at15`)) return false;
  for (let p = 0; p < 16; p++) if (has(`${base}_at${p}`)) return false;
  return true;
}
