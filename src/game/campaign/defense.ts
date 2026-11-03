/** Short, finite protection encounters; no farming or loot-based failure penalty. */
import type { Vec } from "./battle.ts";
export type Defense = {
  target: string;
  time: number;
  integrity: number;
  attackAt: number;
  nextSpawn: number;
  kills: number;
  enemies: (Vec & { hp: number; attackAt: number })[];
  anchor: Vec;
  status: "defending" | "won" | "lost";
};
export function createDefense(target: string, anchor: Vec): Defense {
  return {
    target,
    anchor,
    time: 0,
    integrity: 100,
    attackAt: 0,
    nextSpawn: 0,
    kills: 0,
    enemies: [],
    status: "defending",
  };
}
export function stepDefense(
  d: Defense,
  player: Vec,
  attack: boolean,
  dt: number,
) {
  if (d.status !== "defending") return d;
  dt = Math.min(50, Math.max(0, dt));
  d.time += dt;
  if (d.time >= d.nextSpawn && d.time < 6500) {
    const side = Math.floor(d.time / 2000) % 2 === 0 ? -1 : 1;
    d.enemies.push({
      x: Math.max(65, Math.min(955, d.anchor.x + side * 200)),
      y: Math.max(165, d.anchor.y - 150),
      hp: 16,
      attackAt: 0,
    });
    d.nextSpawn += 2000;
  }
  for (const e of d.enemies) {
    const dx = d.anchor.x - e.x,
      dy = d.anchor.y - e.y,
      n = Math.hypot(dx, dy);
    if (n > 25) {
      e.x += ((dx / n) * 70 * dt) / 1000;
      e.y += ((dy / n) * 70 * dt) / 1000;
    } else if (d.time >= e.attackAt) {
      d.integrity -= 12;
      e.attackAt = d.time + 900;
    }
  }
  if (attack && d.time >= d.attackAt) {
    d.attackAt = d.time + 260;
    for (const e of d.enemies)
      if (Math.hypot(player.x - e.x, player.y - e.y) < 220) e.hp -= 16;
  }
  const alive = d.enemies.filter((e) => e.hp > 0);
  d.kills += d.enemies.length - alive.length;
  d.enemies = alive;
  if (d.integrity <= 0) d.status = "lost";
  else if (d.time >= 8000) d.status = "won";
  return d;
}
