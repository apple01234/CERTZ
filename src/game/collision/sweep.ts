/**
 * 스윕(swept) 충돌 판정 — 빠른 이동체의 터널링(tunneling) 방지
 *
 * 문제: 프레임마다 "현재 위치"만 검사하면, 빠른 이동체(돌진베기 640px/s, 투사체 등)는
 *       프레임 사이 구간을 건너뛰어 얇은 벽/몸통을 뚫고 지나칠 수 있다.
 * 해결: 이전 위치 → 현재 위치의 "이동 선분"이 대상 AABB와 겹치는지 검사한다
 *       (Liang–Barsky 슬랩 방식). 프레임이 아무리 짧아도 이동 경로 전체가 판정 대상이 된다.
 *
 *       from ●━━━━━━━━━━▶ ● to
 *                 ┌────┐
 *                 │대상│  ← 프레임 사이를 지나쳐도 선분이 겹치면 명중
 *                 └────┘
 */

/**
 * 선분 (ax,ay)→(bx,by) 가 중심 (cx,cy), 반폭/반높이 (halfW,halfH)인 AABB와 겹치는지 검사.
 * @returns true = 이동 구간 어딘가에서 충돌
 */
export function segmentHitsRect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  halfW: number,
  halfH: number
): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  let tMin = 0; // 선분 시작(0) ~ 끝(1)
  let tMax = 1;

  /* X 슬랩 — 선분의 x 범위와 박스의 x 범위가 겹치는 구간 [t1,t2]를 누적으로 좁힘 */
  if (Math.abs(dx) < 1e-8) {
    // 수직 이동: 시작 x가 박스 x 범위 밖이면 절대 겹치지 않음
    if (ax < cx - halfW || ax > cx + halfW) return false;
  } else {
    let t1 = (cx - halfW - ax) / dx;
    let t2 = (cx + halfW - ax) / dx;
    if (t1 > t2) {
      const t = t1;
      t1 = t2;
      t2 = t;
    }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }

  /* Y 슬랩 — 동일 */
  if (Math.abs(dy) < 1e-8) {
    if (ay < cy - halfH || ay > cy + halfH) return false;
  } else {
    let t1 = (cy - halfH - ay) / dy;
    let t2 = (cy + halfH - ay) / dy;
    if (t1 > t2) {
      const t = t1;
      t1 = t2;
      t2 = t;
    }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }

  return true; // 두 슬랩의 겹침 구간이 존재 → 선분이 박스를 관통
}

/** 스윕 판정 대상 — hitW/hitH(근접 판정용 크기)를 가진 엔티티(Enemy/Boss 등) */
export interface SweepTarget {
  x: number;
  y: number;
  hitW: number;
  hitH: number;
}

/**
 * 이동 선분이 대상의 몸통 AABB(hitW/hitH + margin)와 겹치는지 검사.
 * margin: 판정 관용치(px) — 근접 게임 특성상 4~8px 권장.
 */
export function sweptHitsTarget(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  target: SweepTarget,
  margin = 6
): boolean {
  return segmentHitsRect(
    fromX,
    fromY,
    toX,
    toY,
    target.x,
    target.y,
    target.hitW / 2 + margin,
    target.hitH / 2 + margin
  );
}
