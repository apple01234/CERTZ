/**
 * 궁극기 pixelfx (2026-11-14, 유저 지시 "/pixelfx → 궁극기 전체에 입히기").
 *
 * 4차 10직업 × 1·2차 궁극기 = 20종에 픽셀 이펙트 2개씩을 붙인다.
 *   cast   — 시전 순간, 시전자 발밑
 *   finale — 마지막 wave(남은 예산 전액이 들어가는 종결 타격) 순간, 시전자 발밑
 * 피해·판정에는 관여하지 않는다(연출만). 같은 직업의 1·2차는 서로 다른 이펙트를 쓴다.
 *
 * 로딩: 부팅 목록(BootScene PIXELFX_SHEETS)에 넣지 않는다 — 넣으면 모든 직업이 40장을 받는다.
 *  현재 직업 4장만 prefetchUltFx 로 받는다(이미 받은 건 재사용). 아직 못 받았으면 그 회차는 생략.
 * 크기: 시트 한 장의 풀린 메모리를 약 13MB 이하로 골랐다(모바일). 운석·대폭발·핵 등 30~97MB 시트는 제외.
 */
import Phaser from "phaser";
import { ensureFxSheet, playFx } from "./pixelfxBridge";

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
  dreadnought: { s5: { cast: "muzzle-shotgun", finale: "plasma-explosion" }, s5b: { cast: "impact-frame", finale: "implosion" } },
};

/** 반복(loop) 시트는 스스로 끝나지 않는다 — 이 시간 뒤 서서히 지운다. */
const LOOP_MS = { cast: 1600, finale: 2200 } as const;
const SCALE = { cast: 1.2, finale: 1.6 } as const;

function sheetsOf(cls: string | null | undefined): string[] {
  const p = cls ? ULT_PIXELFX[cls] : undefined;
  return p ? [p.s5.cast, p.s5.finale, p.s5b.cast, p.s5b.finale] : [];
}

/** 현재 직업의 궁극기 시트 4장을 미리 받는다. 궁극기 직업이 아니면 아무것도 하지 않는다. */
export function prefetchUltFx(scene: Phaser.Scene, cls: string | null | undefined): void {
  for (const key of sheetsOf(cls)) void ensureFxSheet(scene, key);
}

/** 궁극기 이펙트 재생. 시트가 아직 없으면 받기만 걸어 두고 이번엔 생략한다. */
export function playUltFx(scene: Phaser.Scene, cls: string | null | undefined, slot: 1 | 2, phase: "cast" | "finale", x: number, y: number, flip = false): void {
  const p = cls ? ULT_PIXELFX[cls] : undefined;
  if (!p) return;
  const key = (slot === 1 ? p.s5 : p.s5b)[phase];
  let sp: Phaser.GameObjects.Sprite | null = null;
  try { sp = playFx(scene, key, x, y, { scale: SCALE[phase], flip }); } catch { /* 연출 실패는 게임을 막지 않는다 */ }
  if (!sp) { void ensureFxSheet(scene, key); return; }
  const fx = sp;
  if (fx.anims.currentAnim?.repeat === -1) {
    scene.time.delayedCall(LOOP_MS[phase], () => {
      if (!fx.active) return;
      scene.tweens.add({ targets: fx, alpha: 0, duration: 300, onComplete: () => fx.destroy() });
    });
  }
}
