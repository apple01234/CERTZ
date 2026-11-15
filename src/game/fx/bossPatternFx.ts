/**
 * 보스 패턴 pixelfx (2026-11-15, 유저 지시 "/pixelfx → 보스 패턴").
 *
 * 패턴마다 예고(tele) 이펙트 1개 + 발동(hit) 이펙트 1개. 판정·피해·타이밍에는 관여하지 않는다(연출만).
 *  · 예고 — 패턴을 고른 순간(기존 바닥 경고와 같은 때)
 *  · 발동 — 예고 시간(bossPhases.telegraphMs)이 끝나는 순간, 공격이 터지는 자리
 *  · 자리 — "boss" 는 보스 발밑, "target" 은 예고 순간의 플레이어 자리(조준 공격)
 *
 * 로딩: 보스가 생기면 그 보스의 패턴(p1~p3)에 쓰는 시트만 받고, 보스가 정리되면 내린다
 *  (플레이어 궁극기가 같은 시트를 쓰면 남긴다). 못 받았으면 그 회차는 생략한다 — 다음 패턴부터 나온다.
 * 크기: 시트 한 장 풀린 메모리 13MB 이하만 골랐다(모바일). 대폭발 97MB·땅 폭발 27MB·냉기 폭발 24MB 등은 제외.
 */
import Phaser from "phaser";
import { ensureFxSheet, playFx, unloadFxSheet } from "./pixelfxBridge";
import { telegraphMs } from "../entities/bossPhases";
import { ultSheetsOf } from "./ultPixelFx";

type Anchor = "boss" | "target";
type Fx = { key: string; at: Anchor; scale?: number };
type PatternFx = { tele?: Fx; hit?: Fx };

export const BOSS_PATTERN_FX: Record<string, PatternFx> = {
  /* 공용 */
  slam: { tele: { key: "rage", at: "boss" }, hit: { key: "hammer-smash", at: "target" } },
  charge: { tele: { key: "rage", at: "boss" } },
  volley: { tele: { key: "spell-charge", at: "boss" } },
  ring: { tele: { key: "rune-circle", at: "boss" }, hit: { key: "shockwave-big", at: "boss", scale: 0.8 } },
  zones: { tele: { key: "hex-sigil", at: "target", scale: 0.9 }, hit: { key: "energy-crack", at: "target" } },
  summon: { tele: { key: "portal", at: "boss" }, hit: { key: "summon-rise", at: "boss" } },
  spiral: { tele: { key: "orbit-rings", at: "boss", scale: 0.8 } },
  beam: { tele: { key: "spell-charge", at: "boss" } },
  blink: { tele: { key: "blink-in", at: "boss" } },
  quake: { tele: { key: "rage", at: "boss" }, hit: { key: "quake", at: "boss" } },
  counter: { tele: { key: "shield-block", at: "boss" } },
  /* 어둠 동굴 계열 */
  greenslash: { hit: { key: "double-slash", at: "target" } },
  vanish: { tele: { key: "poof", at: "boss" } },
  shieldcast: { tele: { key: "divine-shield", at: "boss" } },
  /* 보스 시그니처 */
  firepillars: { hit: { key: "fire-tornado", at: "target" } },
  frostnova: { hit: { key: "ice-spikes", at: "boss" } },
  thunderfall: { hit: { key: "thunderclap", at: "target" } },
  poisonfield: { hit: { key: "curse", at: "target" } },
  holymantle: { tele: { key: "pentagram", at: "boss", scale: 0.9 }, hit: { key: "implosion", at: "boss" } },
  crystalburst: { hit: { key: "crystal-shard", at: "boss", scale: 1.4 } },
  blinkslash: { hit: { key: "claw-swipe", at: "target", scale: 1.3 } },
  magicburst: { tele: { key: "pentagram", at: "boss", scale: 0.9 }, hit: { key: "mana-burst", at: "boss" } },
  portalteleport: { tele: { key: "portal", at: "boss" } },
  /* 스토리 보스 전용 (storyBossPatterns.ts) */
  tentacleslam: { hit: { key: "wave-crash", at: "target" } },
  inkflood: { hit: { key: "splash", at: "boss", scale: 1.4 } },
  shadowcopies: { tele: { key: "shadow-flames", at: "boss", scale: 1.3 } },
  cursefield: { tele: { key: "hex-sigil", at: "target", scale: 0.9 } },
  bloodseal: { hit: { key: "bleeding", at: "target", scale: 1.4 } },
  corruption: { tele: { key: "dissolve-burn", at: "boss" } },
  rosecore: { tele: { key: "leaf-storm", at: "boss", scale: 1.3 } },
  jadeclones: { tele: { key: "summon-rise", at: "boss" } },
  ringpush: { hit: { key: "shockwave-big", at: "boss", scale: 0.8 } },
};

type Patterns = { p1: readonly string[]; p2: readonly string[]; p3: readonly string[] };

/** 이 보스가 쓸 수 있는 패턴의 시트 목록(중복 없음) */
export function bossFxSheets(patterns: Patterns): string[] {
  const out = new Set<string>();
  for (const kind of [...patterns.p1, ...patterns.p2, ...patterns.p3]) {
    const p = BOSS_PATTERN_FX[kind];
    if (p?.tele) out.add(p.tele.key);
    if (p?.hit) out.add(p.hit.key);
  }
  return [...out];
}

/** 보스가 생길 때 — 그 보스의 패턴 시트를 미리 받는다(기다리지 않는다). */
export function prefetchBossFx(scene: Phaser.Scene, patterns: Patterns): void {
  for (const key of bossFxSheets(patterns)) void ensureFxSheet(scene, key);
}

/** 보스가 정리될 때 — 받은 시트를 내린다. 플레이어 궁극기가 같은 시트를 쓰면 남긴다. */
export function releaseBossFx(scene: Phaser.Scene, patterns: Patterns, playerCls: string | null | undefined): void {
  const keep = new Set(ultSheetsOf(playerCls));
  for (const key of bossFxSheets(patterns)) if (!keep.has(key)) unloadFxSheet(scene, key);
}

/**
 * 지역에 들어올 때 — 지난 지역 보스의 패턴 시트를 내린다(지금 보스·플레이어 궁극기가 쓰는 시트는 남김).
 * 보스 정리(destroyPool)는 씬이 닫히는 중이라 화면에 남은 이펙트 때문에 못 내리는 경우가 있다 — 여기서 마저 치운다.
 */
export function sweepBossFx(scene: Phaser.Scene, playerCls: string | null | undefined, currentBoss?: Patterns | null): void {
  const keep = new Set([...ultSheetsOf(playerCls), ...(currentBoss ? bossFxSheets(currentBoss) : [])]);
  const all = new Set(Object.values(BOSS_PATTERN_FX).flatMap((p) => [p.tele?.key, p.hit?.key]).filter((k): k is string => !!k));
  for (const key of all) if (!keep.has(key)) unloadFxSheet(scene, key);
}

const LOOP_MS = 1400;

function play(scene: Phaser.Scene, fx: Fx, x: number, y: number, size: number) {
  let sp: Phaser.GameObjects.Sprite | null = null;
  try { sp = playFx(scene, fx.key, x, y, { scale: (fx.scale ?? 1) * size }); } catch { /* 연출 실패는 전투를 막지 않는다 */ }
  if (!sp) { void ensureFxSheet(scene, fx.key); return; }
  const s = sp;
  if (s.anims.currentAnim?.repeat === -1) {
    scene.time.delayedCall(LOOP_MS, () => {
      if (!s.active) return;
      scene.tweens.add({ targets: s, alpha: 0, duration: 260, onComplete: () => s.destroy() });
    });
  }
}

type Pos = { x: number; y: number };

/**
 * 패턴을 고른 순간 부른다. 예고는 바로, 발동은 예고 시간 뒤에 재생한다.
 * size — 보스 크기 배율(큰 보스는 이펙트도 크게). 보스가 그 사이 죽으면 발동 이펙트는 생략.
 */
export function playBossPatternFx(scene: Phaser.Scene, kind: string, boss: Pos & { active: boolean }, target: Pos, size = 1): void {
  const p = BOSS_PATTERN_FX[kind];
  if (!p) return;
  const tx = target.x, ty = target.y; // 조준 공격은 예고 순간의 자리에 떨어진다
  const at = (fx: Fx): Pos => (fx.at === "boss" ? { x: boss.x, y: boss.y } : { x: tx, y: ty });
  if (p.tele) { const q = at(p.tele); play(scene, p.tele, q.x, q.y, size); }
  if (p.hit) {
    const hit = p.hit;
    scene.time.delayedCall(telegraphMs(kind), () => {
      if (!boss.active || !scene.sys?.isActive()) return;
      const q = at(hit);
      play(scene, hit, q.x, q.y, size);
    });
  }
}
