import { tier2RootOf, type ClassKey } from "./classes";
import type { ElemKey } from "./data";

export type WeaponMasterStyle = "starter" | "solar" | "life" | "lightning" | "chakram" | "book" | "art" | "shadow" | "copy" | "water" | "hammer";
export type WeaponMasterProfile = {
  style: WeaponMasterStyle;
  name: string;
  mentor: string;
  color: number;
  element: ElemKey;
  startup: number;
  recovery: number;
  pulses: readonly number[];
};

/** Existing branch IDs, advancement and saves stay intact; only S1 inherits this teaching. */
export const WEAPON_MASTER_PROFILES: Partial<Record<ClassKey, WeaponMasterProfile>> = {
  berserker: { style: "solar", mentor: "아리", name: "태양검 · 일광참", color: 0xffbd58, element: "fire", startup: 180, recovery: 150, pulses: [0] },
  guardian: { style: "life", mentor: "루시", name: "생명의 파동 · 치유", color: 0x9df4bb, element: "nature", startup: 240, recovery: 140, pulses: [0] },
  sniper: { style: "lightning", mentor: "벨리카", name: "뇌전 관통 화살", color: 0x8cdfff, element: "electric", startup: 220, recovery: 150, pulses: [0] },
  windrunner: { style: "chakram", mentor: "리안", name: "귀환 차크람 · 꽃의 궤적", color: 0xe4a6ee, element: "nature", startup: 160, recovery: 130, pulses: [0, 200] },
  archmage: { style: "book", mentor: "제르", name: "마도서 · 삼중 술식", color: 0xbea1ff, element: "light", startup: 320, recovery: 180, pulses: [0] },
  sage: { style: "art", mentor: "란", name: "아트 장막 · 치유", color: 0x9be8ec, element: "light", startup: 300, recovery: 180, pulses: [0] },
  assassin: { style: "shadow", mentor: "페르온", name: "그림자 잔향", color: 0xb69aef, element: "dark", startup: 120, recovery: 120, pulses: [0, 140] },
  swashbuckler: { style: "copy", mentor: "하루", name: "카피 · 원소 순환", color: 0xf6e8ae, element: "none", startup: 180, recovery: 140, pulses: [0] },
  corsair: { style: "water", mentor: "카르텔", name: "삼지창 · 물결 쇄도", color: 0x68c7fa, element: "water", startup: 230, recovery: 160, pulses: [0] },
  raider: { style: "hammer", mentor: "제이드", name: "공학망치 · 분신 타격", color: 0xf2ce83, element: "earth", startup: 260, recovery: 180, pulses: [0, 160] },
};

export function weaponMasterProfileOf(cls?: string | null): WeaponMasterProfile | null {
  const branch = tier2RootOf(cls);
  return branch ? WEAPON_MASTER_PROFILES[branch] ?? null : null;
}

export const STARTER_SIGNATURE: WeaponMasterProfile = {
  style: "starter", name: "회전베기", mentor: "기초 수련", color: 0xd9edff, element: "none", startup: 140, recovery: 130, pulses: [0],
};

export type SkillPoint = { x: number; y: number };
export type SignatureZone =
  | { kind: "circle"; x: number; y: number; radius: number }
  | { kind: "beam"; x: number; y: number; angle: number; length: number; width: number }
  | { kind: "sector"; x: number; y: number; angle: number; radius: number; halfAngle: number }
  | { kind: "box"; x: number; y: number; radius: number };

/** One geometry feeds both the startup preview and release-time hit test. */
export function signatureZones(style: WeaponMasterStyle, origin: SkillPoint, aim: SkillPoint, tier: number, pulse = 0): SignatureZone[] {
  const angle = Math.atan2(aim.y, aim.x);
  const forward = (distance: number, side = 0) => ({
    x: origin.x + Math.cos(angle) * distance - Math.sin(angle) * side,
    y: origin.y + Math.sin(angle) * distance + Math.cos(angle) * side,
  });
  const reach = 180 + 16 * tier;
  switch (style) {
    case "starter": return [{ kind: "circle", ...origin, radius: 118 + 16 * tier }];
    case "solar": return [{ kind: "sector", ...origin, angle, radius: reach, halfAngle: Math.PI * 0.38 }];
    case "life": return [{ kind: "circle", ...origin, radius: 130 + 12 * tier }];
    case "lightning": return [{ kind: "beam", ...origin, angle, length: 330 + 24 * tier, width: 42 + 4 * tier }];
    case "chakram": return [{ kind: "beam", ...origin, angle, length: 250 + 16 * tier, width: pulse === 0 ? 66 : 100 }];
    case "book": return [-1, 0, 1].map(side => ({ kind: "circle" as const, ...forward(reach, side * 78), radius: 62 + 4 * tier }));
    case "art": return [{ kind: "box", ...origin, radius: 110 + 10 * tier }];
    case "shadow": return [{ kind: "sector", ...forward(pulse === 0 ? 0 : 110), angle, radius: 160 + 12 * tier, halfAngle: 0.68 }];
    case "copy": return [{ kind: "circle", ...forward(110), radius: 106 + 9 * tier }];
    case "water": return [-1, 0, 1].map(side => ({ kind: "beam" as const, ...origin, angle: angle + side * 0.3, length: 235 + 16 * tier, width: 42 }));
    case "hammer": return [{ kind: "circle", ...forward(pulse === 0 ? 85 : 170, pulse === 0 ? 0 : 65), radius: 92 + 8 * tier }];
  }
}

export function signatureZoneContains(zone: SignatureZone, point: SkillPoint, targetRadius = 0): boolean {
  const dx = point.x - zone.x, dy = point.y - zone.y;
  if (zone.kind === "circle") return Math.hypot(dx, dy) <= zone.radius + targetRadius;
  if (zone.kind === "box") return Math.abs(dx) <= zone.radius + targetRadius && Math.abs(dy) <= zone.radius + targetRadius;
  if (zone.kind === "sector") {
    if (Math.hypot(dx, dy) > zone.radius + targetRadius) return false;
    const difference = Math.atan2(Math.sin(Math.atan2(dy, dx) - zone.angle), Math.cos(Math.atan2(dy, dx) - zone.angle));
    return Math.abs(difference) <= zone.halfAngle + Math.asin(Math.min(1, targetRadius / Math.max(1, Math.hypot(dx, dy))));
  }
  const along = dx * Math.cos(zone.angle) + dy * Math.sin(zone.angle);
  const across = -dx * Math.sin(zone.angle) + dy * Math.cos(zone.angle);
  return along >= -targetRadius && along <= zone.length + targetRadius && Math.abs(across) <= zone.width / 2 + targetRadius;
}

/** Haru remembers the observed element, then cycles it into an existing reaction. */
export function copiedReactionElement(observed: ElemKey): ElemKey {
  const cycle: Partial<Record<ElemKey, ElemKey>> = { nature: "fire", fire: "ice", ice: "nature", water: "electric", earth: "wind", light: "dark", dark: "light" };
  return cycle[observed] ?? observed;
}

export type SkillCastPhase = "startup" | "release" | "recovery" | "complete" | "cancelled";
export type SkillCastPorts = {
  schedule: (delay: number, callback: () => void) => (() => void);
  valid: () => boolean;
  release: (pulse: number, claimTarget: (target: unknown) => boolean) => void;
  phase: (phase: SkillCastPhase) => void;
  cleanup: () => void;
};

/** Owns every delayed release and a cast-wide hit ledger, independent of VFX count/frame rate. */
export function startSignatureCast(timing: Pick<WeaponMasterProfile, "startup" | "recovery" | "pulses">, ports: SkillCastPorts) {
  let phase: SkillCastPhase = "startup";
  let disposed = false;
  const timers: (() => void)[] = [];
  const released = new Set<number>();
  const targets = new Set<unknown>();
  const setPhase = (next: SkillCastPhase) => { phase = next; ports.phase(next); };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const remove of timers) remove();
    timers.length = 0;
    targets.clear();
    ports.cleanup();
  };
  const cancel = () => {
    if (disposed) return;
    setPhase("cancelled");
    dispose();
  };
  const schedule = (delay: number, callback: () => void) => {
    timers.push(ports.schedule(delay, () => {
      if (disposed) return;
      if (!ports.valid()) { cancel(); return; }
      callback();
    }));
  };
  setPhase("startup");
  timing.pulses.forEach((delay, index) => schedule(timing.startup + delay, () => {
    if (released.has(index)) return;
    released.add(index);
    setPhase("release");
    ports.release(index, target => {
      if (disposed || targets.has(target)) return false;
      targets.add(target);
      return true;
    });
  }));
  const releaseEnd = timing.startup + Math.max(0, ...timing.pulses) + 240;
  schedule(releaseEnd, () => setPhase("recovery"));
  schedule(releaseEnd + timing.recovery, () => { setPhase("complete"); dispose(); });
  return { get phase() { return phase; }, cancel };
}

export type SignatureCast = ReturnType<typeof startSignatureCast>;
