/** Slot-aware world-space finale geometry. No engine, textures or RNG. */
export type UltimateSlot = 1 | 2;
export type FinaleZone =
  | { kind: "beam"; x: number; y: number; angle: number; length: number; width: number }
  | { kind: "disc"; x: number; y: number; radius: number }
  | { kind: "ring"; x: number; y: number; radius: number; width: number }
  | { kind: "fan"; x: number; y: number; radius: number; angle: number; arc: number };
export type FinalePlan = { motion: string; zones: FinaleZone[] };
const beam = (x: number, y: number, angle: number, length: number, width: number): FinaleZone =>
  ({ kind: "beam", x, y, angle, length, width });
const disc = (x: number, y: number, radius: number): FinaleZone => ({ kind: "disc", x, y, radius });
const ring = (radius: number, width: number): FinaleZone => ({ kind: "ring", x: 0, y: 0, radius, width });
const fan = (radius: number, arc: number): FinaleZone => ({ kind: "fan", x: 0, y: 0, radius, angle: 0, arc });
const spokes = (n: number, radius: number, width: number, phase = 0) =>
  Array.from({ length: n }, (_, i) => beam(0, 0, phase + i * Math.PI * 2 / n, radius, width));

/** Coordinates are local to the cast origin; angle zero is the current aim. */
export function ultimateFinalePlan(cls: string | null, slot: UltimateSlot): FinalePlan | undefined {
  switch (cls) {
    case "warbringer": return slot === 1
      ? { motion: "cleave", zones: [fan(620, Math.PI * 0.78)] }
      : { motion: "fault", zones: [-160, 0, 160].map(y => beam(-180, y, 0, 940, 110)) };
    case "crusader": return slot === 1
      ? { motion: "holy-cross", zones: [beam(-580, 0, 0, 1160, 130), beam(0, -580, Math.PI / 2, 1160, 130)] }
      : { motion: "sanctuary-close", zones: [ring(440, 130), disc(0, 0, 150)] };
    case "deadeye": return slot === 1
      ? { motion: "pierce", zones: [beam(0, 0, 0, 1400, 84)] }
      : { motion: "crossfire", zones: [-0.42, 0, 0.42].map(a => beam(0, 0, a, 860, 62)) };
    case "skylord": return slot === 1
      ? { motion: "wind-fan", zones: [fan(800, Math.PI * 0.64)] }
      : { motion: "vortex", zones: [ring(360, 160), disc(0, 0, 100)] };
    case "arclord": return slot === 1
      ? { motion: "mana-release", zones: [disc(0, 0, 170), ...spokes(8, 650, 100)] }
      : { motion: "pentagon-collapse", zones: Array.from({ length: 5 }, (_, i) => {
        const a = i * Math.PI * 2 / 5;
        const b = (i + 2) * Math.PI * 2 / 5;
        const x = Math.cos(a) * 560, y = Math.sin(a) * 560;
        const dx = Math.cos(b) * 560 - x, dy = Math.sin(b) * 560 - y;
        return beam(x, y, Math.atan2(dy, dx), Math.hypot(dx, dy), 100);
      }) };
    case "eternal": return slot === 1
      ? { motion: "time-split", zones: [beam(-410, -410, Math.PI / 4, 1160, 100), beam(-410, 410, -Math.PI / 4, 1160, 100)] }
      : { motion: "rewind", zones: [ring(480, 110), ring(240, 90), disc(0, 0, 80)] };
    case "shadowlord": return slot === 1
      ? { motion: "shadow-stitch", zones: [beam(-400, -180, 0.42, 900, 110), beam(420, 190, Math.PI - 0.42, 900, 110)] }
      : { motion: "kingdom-seal", zones: [0, 1, 2].map(i => {
        const a = i * Math.PI * 2 / 3 - Math.PI / 2;
        const b = a + Math.PI * 2 / 3;
        const x = Math.cos(a) * 540, y = Math.sin(a) * 540;
        const dx = Math.cos(b) * 540 - x, dy = Math.sin(b) * 540 - y;
        return beam(x, y, Math.atan2(dy, dx), Math.hypot(dx, dy), 130);
      }) };
    case "blademaster": return slot === 1
      ? { motion: "final-draw", zones: [beam(-120, 0, 0, 900, 100)] }
      : { motion: "crossed-blades", zones: [beam(-420, -420, Math.PI / 4, 1188, 150), beam(-420, 420, -Math.PI / 4, 1188, 150)] };
    case "seaking": return slot === 1
      ? { motion: "undertow", zones: [beam(700, 0, Math.PI, 800, 280)] }
      : { motion: "depth-pressure", zones: [ring(270, 140), disc(0, 0, 110)] };
    case "dreadnought": return slot === 1
      ? { motion: "broadside", zones: [disc(120, -230, 190), disc(360, 0, 220), disc(120, 230, 190)] }
      : { motion: "last-shell", zones: [disc(0, 0, 400), ...spokes(4, 620, 90, Math.PI / 4)] };
    default: return undefined;
  }
}

/** Conservative radius used only to collect candidates, never as the hit shape. */
export function finalePlanReach(plan: FinalePlan): number {
  return Math.max(...plan.zones.map(z => Math.hypot(z.x, z.y)
    + (z.kind === "beam" ? Math.hypot(z.length, z.width / 2)
      : z.radius + (z.kind === "ring" ? z.width / 2 : 0))));
}

/** Exact narrow phase; broadphase circles must never become the damage shape. */
export function finaleZoneContains(zone: FinaleZone, x: number, y: number): boolean {
  const dx = x - zone.x, dy = y - zone.y;
  if (zone.kind === "disc") return Math.hypot(dx, dy) <= zone.radius;
  if (zone.kind === "ring") return Math.abs(Math.hypot(dx, dy) - zone.radius) <= zone.width / 2;
  const u = dx * Math.cos(zone.angle) + dy * Math.sin(zone.angle);
  const v = -dx * Math.sin(zone.angle) + dy * Math.cos(zone.angle);
  if (zone.kind === "beam") return u >= 0 && u <= zone.length && Math.abs(v) <= zone.width / 2;
  return Math.hypot(dx, dy) <= zone.radius && Math.abs(Math.atan2(v, u)) <= zone.arc / 2;
}

/** Transform world targets back to cast space, then preserve explicit zone order. */
export function finaleTargetOrder(plan: FinalePlan, ox: number, oy: number, angle: number, x: number, y: number): number {
  const dx = x - ox, dy = y - oy;
  const u = dx * Math.cos(angle) + dy * Math.sin(angle);
  const v = -dx * Math.sin(angle) + dy * Math.cos(angle);
  return plan.zones.findIndex(zone => finaleZoneContains(zone, u, v));
}
