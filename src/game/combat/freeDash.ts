import { segmentHitsRect } from "../collision/sweep";

/** Independent locomotion; no resource, damage or invulnerability. Short cooldown keeps spam honest. */
export const FREE_DASH = { durationMs: 180, speed: 700, cooldownMs: 1000 } as const;
export type DashVector = { x: number; y: number };
export type DashRect = { x: number; y: number; width: number; height: number };

export function freeDashDirection(input: DashVector, facing: DashVector): DashVector {
  for (const v of [input, facing, { x: 1, y: 0 }]) {
    const length = Math.hypot(v.x, v.y);
    if (Number.isFinite(length) && length > 0.01) return { x: v.x / length, y: v.y / length };
  }
  return { x: 1, y: 0 };
}

/** Swept body-center travel against expanded solid bodies and world bounds. */
export function freeDashFraction(
  from: DashVector, travel: DashVector, half: DashVector,
  bounds: DashRect, solids: DashRect[],
): number {
  if (![from.x, from.y, travel.x, travel.y, half.x, half.y,
    bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite) ||
      half.x < 0 || half.y < 0 || bounds.width <= 0 || bounds.height <= 0 ||
      solids.some(r => ![r.x, r.y, r.width, r.height].every(Number.isFinite) || r.width < 0 || r.height < 0)) return 0;
  // Open surface contact permits moving away/along a wall; penetration still blocks.
  // Far below a rendered pixel: this is numeric tolerance, not a smaller hitbox.
  const skin = 1e-7;
  const safe = (t: number) => {
    const x = from.x + travel.x * t, y = from.y + travel.y * t;
    if (x - half.x < bounds.x || x + half.x > bounds.x + bounds.width ||
        y - half.y < bounds.y || y + half.y > bounds.y + bounds.height) return false;
    return !solids.some(r => segmentHitsRect(from.x, from.y, x, y,
      r.x + r.width / 2, r.y + r.height / 2,
      Math.max(0, r.width / 2 + half.x - skin), Math.max(0, r.height / 2 + half.y - skin)));
  };
  if (safe(1)) return 1;
  if (!safe(0)) return 0;
  let low = 0, high = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (low + high) / 2;
    if (safe(mid)) low = mid; else high = mid;
  }
  return low;
}
