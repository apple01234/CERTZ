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

type UltFx = { cast: string; finale: string };
type Pair = { s5: UltFx; s5b: UltFx };

export const ULT_PIXELFX: Record<string, Pair> = {
  warbringer:  { s5: { cast: "heavy-cleave", finale: "hammer-smash" },   s5b: { cast: "heavy-landing", finale: "quake" } },
  crusader:    { s5: { cast: "halo", finale: "sunburst" },               s5b: { cast: "divine-shield", finale: "heal-aoe" } },
  deadeye:     { s5: { cast: "spell-charge", finale: "crit-hit" },       s5b: { cast: "hex-sigil", finale: "plasma-explosion" } },
  skylord:     { s5: { cast: "tornado", finale: "thunderclap" },         s5b: { cast: "spark-arc", finale: "ball-lightning" } },
  arclord:     { s5: { cast: "rune-circle", finale: "mana-burst" },      s5b: { cast: "storm-cloud", finale: "chain-lightning" } },
  eternal:     { s5: { cast: "time-stop", finale: "implosion" },         s5b: { cast: "blessing", finale: "star-fall" } },
  shadowlord:  { s5: { cast: "necro-skulls", finale: "curse" },          s5b: { cast: "eclipse", finale: "black-hole" } },
  blademaster: { s5: { cast: "double-slash", finale: "spin-slash" },     s5b: { cast: "whip-crack", finale: "scythe-reap" } },
  seaking:     { s5: { cast: "whirlpool", finale: "wave-crash" },        s5b: { cast: "water-jet", finale: "splash" } },
  dreadnought: { s5: { cast: "muzzle-shotgun", finale: "plasma-explosion" }, s5b: { cast: "hit-flash", finale: "implosion" } },
};

const CAST_SCALE = 1.2;
export const ULT_FINALE_CUE_MS = { 1: 190, 2: 260 } as const;

type FinaleMark = "sweep" | "ray" | "cross" | "ring";
type FinaleLayout = { size: number; mark: FinaleMark; forward?: number; directional?: boolean };

/** 긴 변의 월드 크기와 전방 배치. 픽셀 시트마다 프레임 크기가 다르다. */
const FINALE_LAYOUT: Record<string, readonly [FinaleLayout, FinaleLayout]> = {
  warbringer:  [{ size: 390, mark: "sweep", forward: 75, directional: true }, { size: 510, mark: "cross" }],
  crusader:    [{ size: 395, mark: "cross" }, { size: 480, mark: "ring" }],
  deadeye:     [{ size: 340, mark: "ray", forward: 200 }, { size: 425, mark: "cross", forward: 155 }],
  skylord:     [{ size: 420, mark: "sweep", forward: 105 }, { size: 465, mark: "ring" }],
  arclord:     [{ size: 450, mark: "ring" }, { size: 520, mark: "cross", directional: true }],
  eternal:     [{ size: 425, mark: "cross" }, { size: 495, mark: "ring" }],
  shadowlord:  [{ size: 380, mark: "sweep" }, { size: 475, mark: "ring" }],
  blademaster: [{ size: 395, mark: "ray", forward: 70 }, { size: 460, mark: "cross", directional: true }],
  seaking:     [{ size: 435, mark: "sweep", forward: 125, directional: true }, { size: 485, mark: "ring" }],
  dreadnought: [{ size: 420, mark: "cross", forward: 140 }, { size: 510, mark: "ring" }],
};

type UltFxScene = Phaser.Scene & { fxLevel?: number };
type UltAnchor = { x: number; y: number };

/** 한 가지 도형을 수축시켜 예고하고, 타격에서 같은 도형을 펼친다. */
function playFinaleMark(
  scene: UltFxScene, cls: string, slot: 1 | 2, layout: FinaleLayout, angle: number,
  follow: () => UltAnchor | null, cue: boolean,
): (() => void) | undefined {
  const anchor = follow();
  if (!anchor) return;
  const lite = scene.fxLevel === 0;
  const r = layout.size * (lite ? 0.13 : 0.22);
  const tint = Number.parseInt(classDef(cls)?.color?.slice(1) ?? "fff2cc", 16);
  const mark = scene.add.graphics().setDepth(cue ? 23 : 26);
  const forward = layout.forward ?? 0;
  const dx = forward * Math.cos(angle);
  const dy = forward * Math.sin(angle);
  mark.setPosition(anchor.x + dx, anchor.y + dy);
  mark.lineStyle(cue ? 2 : 5, tint, 0.95);
  switch (layout.mark) {
    case "sweep":
      mark.setRotation(angle).beginPath();
      mark.arc(-r * 0.5, 0, r, -1.1, 1.1);
      mark.strokePath();
      break;
    case "ray":
      mark.setRotation(angle).lineBetween(-r, 0, r, 0);
      break;
    case "cross":
      mark.setRotation(angle).lineBetween(-r, 0, r, 0);
      mark.lineBetween(0, -r * 0.65, 0, r * 0.65);
      break;
    case "ring":
      mark.strokeEllipse(0, 0, r * 2, r * 1.25);
      break;
  }
  if (!cue) mark.fillStyle(0xfff7e7, 0.9).fillCircle(0, 0, lite ? 4 : 7);
  mark.setAlpha(cue ? 0.2 : 0.95).setScale(cue ? 1.3 : 0.8);
  const tween = scene.tweens.add({
    targets: mark,
    alpha: cue ? 0.8 : 0,
    scale: cue ? 0.72 : 1.45,
    duration: cue ? ULT_FINALE_CUE_MS[slot] : lite ? 125 : 190,
    ease: cue ? "Quad.in" : "Cubic.out",
    onUpdate: cue ? () => {
      const point = follow();
      if (point) mark.setPosition(point.x + dx, point.y + dy);
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
  const layout = FINALE_LAYOUT[cls]?.[slot - 1];
  if (layout) return playFinaleMark(scene, cls, slot, layout, angle, follow, true);
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
  const keep = new Set([...STARTER_PIXELFX, ...sheetsOf(cls)]);
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
  if (layout) {
    try { playFinaleMark(scene, cls, slot, layout, angle, () => ({ x, y }), false); } catch { /* 시트는 계속 재생 */ }
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
