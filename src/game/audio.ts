import type Phaser from "phaser";

/**
 * 외부 오디오 에셋 재생 (public/assets/audio/)
 *  - BGM: Retro Game Music Pack — Juhani Junkala (CC0)
 *  - SFX: 80 CC0 RPG SFX / 80 CC0 creature SFX — Rubberduck (CC0)
 * 자체 합성(WebAudio 오실레이터)은 전면 제거 — Phaser SoundManager 사용.
 */

let game: Phaser.Game | null = null;
let bgmSound: Phaser.Sound.BaseSound | null = null;
let bgmKind: "field" | "boss" | "title" | null = null;
let muted = false;

/** PhaserGame 생성 직후 1회 호출 */
export function attachAudio(g: Phaser.Game) {
  game = g;
}

/** 유저 제스처 시점 오디언락 해제 (모바일 WebView 대비) */
export function initAudio() {
  const sm = game?.sound as Phaser.Sound.WebAudioSoundManager | null;
  const ctx = sm?.context;
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

export function setMuted(m: boolean) {
  muted = m;
  if (game) game.sound.mute = m;
  if (m) destroyBgm();
  else if (bgmKind) startBgm(bgmKind);
}

export function isMuted() {
  return muted;
}

function destroyBgm() {
  if (bgmSound) {
    bgmSound.stop();
    bgmSound.destroy();
    bgmSound = null;
  }
}

function startBgm(kind: "field" | "boss" | "title") {
  if (!game) return;
  bgmSound = game.sound.add(`bgm_${kind}`, { loop: true, volume: 0.42 });
  bgmSound.play();
}

export function playBGM(kind: "field" | "boss" | "title") {
  if (bgmKind === kind && bgmSound?.isPlaying) return;
  destroyBgm();
  bgmKind = kind;
  if (muted || !game) return;
  startBgm(kind);
}

/** 씬 전환/사망 등 — 정지만 하고 kind는 유지(음소거 해제 시 재개용) */
export function stopBGM() {
  destroyBgm();
}

function play(key: string, vol: number, rate = 1) {
  if (!game || muted) return;
  game.sound.play(key, { volume: vol, rate });
}

/* ---------- SFX (Rubberduck CC0 팩 매핑) ---------- */

export const sfx = {
  /** 검 휘두르기 — blade_01, 매번 미세 피치 변주 */
  swing() {
    play("sfx_swing", 0.5, 0.95 + Math.random() * 0.12);
  },
  /** 명중 — metal_02 (검 금속음) */
  hit() {
    play("sfx_hit", 0.55);
  },
  /** 회전베기 — blade_03 저피치 */
  spin() {
    play("sfx_spin", 0.6, 0.8);
  },
  /** 돌진 — blade_02 고피치 */
  dash() {
    play("sfx_dash", 0.45, 1.1);
  },
  /** 플레이어 피격 — hurt_01 */
  hurt() {
    play("sfx_hurt", 0.6);
  },
  /** 파편 줍기 — item_gem_01 */
  pickup() {
    play("sfx_pickup", 0.6);
  },
  /** 퀘스트 완료 — item_gem_04 */
  questDone() {
    play("sfx_quest", 0.6);
  },
  /** 레벨업 — spell_01 */
  levelup() {
    play("sfx_levelup", 0.65);
  },
  /** 차원문 — spell_02 */
  portal() {
    play("sfx_portal", 0.55);
  },
  /** 보스 등장 포효 — roar_01 */
  roar() {
    play("sfx_roar", 0.75);
  },
  /** 일반 몬스터 사망 — creature_die_01, 피치 변주 */
  enemyDie() {
    play("sfx_die", 0.55, 0.9 + Math.random() * 0.2);
  },
  /** 보스 사망 — monster_06 + 포효 */
  bossDie() {
    play("sfx_bossdie", 0.85);
    play("sfx_roar", 0.55, 0.75);
  },
  /** 골드 픽업 — item_gem_01 고피치 변주 (동일 CC0 파일 재사용) */
  coin() {
    play("sfx_pickup", 0.45, 1.3 + Math.random() * 0.2);
  },
  /** 물약 마심 — spell_01 저피치 단발 */
  potion() {
    play("sfx_levelup", 0.4, 1.25);
  },
  /** 장비 장착 — item_gem_04 저피치 (차임) */
  equip() {
    play("sfx_quest", 0.5, 0.85);
  },
};
