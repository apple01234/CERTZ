import type { EnemyProfile } from "../stages";
export type EnemyAttackPlan = { kind: "melee" | "ranged" | "charge"; angle: number; reach: number; halfAngle: number };
/** Aim is committed with the warning, not retargeted when the strike releases. */
export function enemyAttackPlan(profile: EnemyProfile | undefined, x: number, y: number): EnemyAttackPlan {
  return { kind: profile?.ranged ? "ranged" : profile?.charge ? "charge" : "melee", angle: Math.atan2(y, x),
    reach: profile?.ranged?.range ?? (profile?.charge ? profile.charge.speed * profile.charge.time / 1000 : 58), halfAngle: Math.PI / 3 };
}
export function enemyMeleeConnects(plan: EnemyAttackPlan, dx: number, dy: number): boolean {
  const dist = Math.hypot(dx, dy);
  return dist <= plan.reach && (dist < .001 || (dx * Math.cos(plan.angle) + dy * Math.sin(plan.angle)) / dist >= Math.cos(plan.halfAngle));
}
