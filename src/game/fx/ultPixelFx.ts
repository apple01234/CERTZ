/**
 * 궁극기 pixelfx (2026-11-14, 유저 지시 "/pixelfx → 궁극기 전체에 입히기").
 *
 * 4차 10직업 × 1·2차 궁극기 = 20종에 픽셀 이펙트 2개씩을 붙인다.
 *   cast   — 시전 순간, 시전자 발밑
 *   finale — 마지막 wave 순간, 직업과 슬롯에 맞춘 크기와 조준 위치
 * 피해·판정에는 관여하지 않는다(연출만). 같은 직업의 1·2차는 서로 다른 이펙트를 쓴다.
 *
 * 로딩: 부팅 목록(BootScene PIXELFX_SHEETS)에 넣지 않는다 — 넣으면 모든 직업이 40장을 받는다.
 *  현재 직업 4장만 prefetchUltFx 로 받는다(이미 받은 건 재사용). 지역 진입·전직 때 부르고, 다른 직업의 시트는 내린다.
 *  아직 못 받았으면 받기를 걸고, 1.5초 안에 도착하면 그때 늦게라도 재생한다(첫 시전 누락 방지).
 * 크기: 시트 한 장의 풀린 메모리를 약 13MB 이하로 골랐다(모바일). 운석·대폭발·핵 등 30~97MB 시트는 제외.
 */
import type Phaser from "phaser";
import { ensureFxSheet, playFx, unloadFxSheet } from "./pixelfxBridge";
import { STARTER_PIXELFX } from "../assetSelection";
import { classDef } from "../classes";
import { BOSS_PIXELFX } from "./pixelFxSheets";
import { ultimateFinalePlan, type FinalePlan } from "./ultFinalePlan";

type UltFx = { cast: string; finale: string };
type Pair = { s5: UltFx; s5b: UltFx };

export const ULT_PIXELFX: Record<string, Pair> = {
  warbringer:  { s5: { cast: "rage", finale: "energy-crack" },          s5b: { cast: "heavy-cleave", finale: "hammer-smash" } },
  crusader:    { s5: { cast: "shield-block", finale: "healing-bloom" },         s5b: { cast: "blessing", finale: "divine-shield" } },
  deadeye:     { s5: { cast: "sparks-glow", finale: "hit-spark" },        s5b: { cast: "orbit-rings", finale: "bullet-impact" } },
  skylord:     { s5: { cast: "haste", finale: "leaf-storm" },           s5b: { cast: "storm", finale: "thunderclap" } },
  arclord:     { s5: { cast: "arcane-orb", finale: "plasma-explosion" }, s5b: { cast: "pentagram", finale: "ball-lightning" } },
  eternal:     { s5: { cast: "crystal-shard", finale: "ice-spikes" },    s5b: { cast: "time-stop", finale: "implosion" } },
  shadowlord:  { s5: { cast: "shadow-flames", finale: "scythe-reap" },   s5b: { cast: "summon-rise", finale: "eclipse" } },
  blademaster: { s5: { cast: "sword-slash", finale: "double-slash" },   s5b: { cast: "blink-in", finale: "whip-crack" } },
  seaking:     { s5: { cast: "splash", finale: "water-jet" },            s5b: { cast: "whirlpool", finale: "wave-crash" } },
  dreadnought: { s5: { cast: "blunt-hit", finale: "shockwave-big" }, s5b: { cast: "muzzle-shotgun", finale: "fire-tornado" } },
};

const CAST_SCALE = 1.2;
export const ULT_FINALE_CUE_MS = { 1: 190, 2: 260 } as const;

type FinaleLayout = { size: number; forward?: number; directional?: boolean };

/** 긴 변의 월드 크기와 전방 배치. 픽셀 시트마다 프레임 크기가 다르다. */
const FINALE_LAYOUT: Record<string, readonly [FinaleLayout, FinaleLayout]> = {
  warbringer:  [{ size: 390, forward: 75, directional: true }, { size: 510 }],
  crusader:    [{ size: 395 }, { size: 480 }],
  deadeye:     [{ size: 340, forward: 200 }, { size: 425, forward: 155 }],
  skylord:     [{ size: 420, forward: 105 }, { size: 465 }],
  arclord:     [{ size: 450 }, { size: 520, directional: true }],
  eternal:     [{ size: 425 }, { size: 495 }],
  shadowlord:  [{ size: 380 }, { size: 475 }],
  blademaster: [{ size: 395, forward: 70 }, { size: 460, directional: true }],
  seaking:     [{ size: 435, forward: 125, directional: true }, { size: 485 }],
  dreadnought: [{ size: 420, forward: 140 }, { size: 510 }],
};

type UltFxScene = Phaser.Scene & { fxLevel?: number };
type UltAnchor = { x: number; y: number };

/** The cue and impact outline use the same world-space shapes as the hit test. */
export function playUltPattern(
  scene: UltFxScene, cls: string, slot: 1 | 2, plan: FinalePlan, angle: number,
  follow: () => UltAnchor | null, cue = false, finale = false,
): (() => void) | undefined {
  const anchor = follow();
  if (!anchor) return;
  const lite = scene.fxLevel === 0;
  const tint = Number.parseInt(classDef(cls)?.color?.slice(1) ?? "fff2cc", 16);
  const mark = scene.add.graphics().setDepth(cue ? 8 : 26).setName("ultimate-pattern");
  mark.setPosition(anchor.x, anchor.y).setRotation(angle);
  mark.lineStyle(cue || lite ? 2 : finale ? 5 : 3, tint, cue ? .85 : .95);
  for (const zone of plan.zones) {
    if (zone.kind === "beam") {
      const dx = Math.cos(zone.angle), dy = Math.sin(zone.angle), w = zone.width / 2;
      const ax = zone.x - dy * w, ay = zone.y + dx * w;
      const bx = zone.x + dy * w, by = zone.y - dx * w;
      const ex = dx * zone.length, ey = dy * zone.length;
      mark.lineBetween(ax, ay, ax + ex, ay + ey).lineBetween(bx, by, bx + ex, by + ey);
      mark.lineBetween(ax, ay, bx, by).lineBetween(ax + ex, ay + ey, bx + ex, by + ey);
    } else if (zone.kind === "fan") {
      const from = zone.angle - zone.arc / 2, to = zone.angle + zone.arc / 2;
      mark.beginPath().arc(zone.x, zone.y, zone.radius, from, to).strokePath();
      for (const side of [from, to]) mark.lineBetween(zone.x, zone.y, zone.x + Math.cos(side) * zone.radius, zone.y + Math.sin(side) * zone.radius);
    } else {
      const width = zone.kind === "ring" ? zone.width : 0;
      const outer = zone.radius * 2 + width;
      mark.strokeEllipse(zone.x, zone.y, outer, outer);
      if (width) mark.strokeEllipse(zone.x, zone.y, zone.radius * 2 - width, zone.radius * 2 - width);
    }
  }
  mark.setAlpha(cue ? .25 : finale ? .85 : .52);
  const tween = scene.tweens.add({
    targets: mark, alpha: cue ? .86 : 0, duration: cue ? ULT_FINALE_CUE_MS[slot] : lite ? 115 : 195,
    onUpdate: cue ? () => {
      const point = follow();
      if (point) mark.setPosition(point.x, point.y);
      else mark.setVisible(false);
    } : undefined,
    onComplete: () => mark.destroy(),
  });
  return () => {
    if (!mark.active) return;
    tween.stop();
    mark.destroy();
  };
}

export function playUltFinaleCue(scene: UltFxScene, cls: string, slot: 1 | 2, angle: number, follow: () => UltAnchor | null) {
  const plan = ultimateFinalePlan(cls, slot);
  if (plan) return playUltPattern(scene, cls, slot, plan, angle, follow, true);
}

function sheetsOf(cls: string | null | undefined): string[] {
  const p = cls ? ULT_PIXELFX[cls] : undefined;
  return p ? [p.s5.cast, p.s5.finale, p.s5b.cast, p.s5b.finale] : [];
}

/** 이 직업에 궁극기 pixelfx 가 있는지 */
export function hasUltFx(cls: string | null | undefined): boolean {
  return !!(cls && ULT_PIXELFX[cls]);
}

/** 현재 직업의 궁극기 시트 4장을 미리 받고, 다른 직업의 궁극기 시트는 내린다(직업을 바꿔도 메모리가 쌓이지 않게). */
export function prefetchUltFx(scene: Phaser.Scene, cls: string | null | undefined): void {
  const keep = new Set([...STARTER_PIXELFX, ...BOSS_PIXELFX, ...sheetsOf(cls)]);
  for (const other of Object.keys(ULT_PIXELFX)) {
    for (const key of sheetsOf(other)) if (!keep.has(key)) unloadFxSheet(scene, key);
  }
  for (const key of sheetsOf(cls)) void ensureFxSheet(scene, key);
}

/** 시트가 늦게 도착했을 때 그래도 재생해 줄 최대 지연 — 이보다 늦으면 이미 지난 연출이라 생략한다. */
const LATE_MS = 1500;

/** 궁극기 이펙트 재생. 늦게 받은 시트에도 같은 배치를 적용한다. */
export function playUltFx(
  scene: UltFxScene, cls: string | null | undefined, slot: 1 | 2, phase: "cast" | "finale",
  x: number, y: number, flip = false, angle = flip ? Math.PI : 0,
): void {
  if (!cls) return;
  const p = ULT_PIXELFX[cls];
  if (!p) return;
  const key = (slot === 1 ? p.s5 : p.s5b)[phase];
  const layout = phase === "finale" ? FINALE_LAYOUT[cls]?.[slot - 1] : undefined;
  const forward = layout?.forward ?? 0;
  // The hit accent lands even when the atlas still needs to load.
  const plan = layout && ultimateFinalePlan(cls, slot);
  if (plan) {
    try { playUltPattern(scene, cls, slot, plan, angle, () => ({ x, y }), false, true); } catch { /* 시트는 계속 재생 */ }
  }
  const spawn = () => {
    try {
      const fx = playFx(scene, key, x + forward * Math.cos(angle), y + forward * Math.sin(angle), {
        scale: CAST_SCALE,
        flip: layout?.directional ? false : flip,
      });
      if (!fx) return false;
      const lite = scene.fxLevel === 0;
      if (layout) {
        fx.setScale(layout.size * (lite ? 0.65 : 1) / Math.max(fx.width, fx.height));
        if (layout.directional) fx.setRotation(angle);
      }
      fadeUltSprite(scene, fx, phase, lite);
      return true;
    } catch { return false; /* 연출 실패는 게임을 막지 않는다 */ }
  };

  if (spawn()) return;
  const t0 = Date.now();
  void ensureFxSheet(scene, key).then(ok => {
    if (ok && Date.now() - t0 <= LATE_MS && scene.sys?.isActive()) spawn();
  });
}

function fadeUltSprite(scene: Phaser.Scene, fx: Phaser.GameObjects.Sprite, phase: "cast" | "finale", lite: boolean): void {
  const anim = fx.anims.currentAnim;
  if (!anim) return;
  const loop = anim.repeat === -1;
  if (phase === "cast" && !loop) return;
  const duration = phase === "cast" ? 1900 : lite ? 850 : 1250;
  if (!loop) fx.anims.timeScale = Math.max(1, anim.duration / duration);
  const visibleMs = loop ? duration : Math.min(anim.duration, duration);
  const fadeMs = phase === "cast" ? 300 : Math.min(260, visibleMs * 0.3);
  scene.tweens.add({
    targets: fx, alpha: 0, delay: visibleMs - fadeMs, duration: fadeMs,
    ease: "Quad.in", onComplete: () => { if (loop) fx.destroy(); },
  });
}
