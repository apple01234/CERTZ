import type Phaser from "phaser";

/**
 * 외부 오디오 에셋 재생 (public/assets/audio/)
 *  - BGM: Retro Game Music Pack — Juhani Junkala (CC0)
 *  - SFX: 효과음연구소 (soundeffect-lab.info — 상업 무료/크레딧 불필요) +
 *         小森平の使いやすい効果音 (taira-komori.net — 상업 무료/크레딧 불필요)
 *         두 사이트 모두 원본 파일 재배포만 금지 → 게임 내장은 허용 범위
 *         (구 Rubberduck CC0 SFX는 사용자 지정 소스로 전면 교체됨 — 2026-08 fx-2)
 */

let game: Phaser.Game | null = null;
let bgmSound: Phaser.Sound.BaseSound | null = null;
let bgmKind: "field" | "boss" | "title" | null = null;
let muted = false;

/** PhaserGame 생성 직후 1회 호출 */
export function attachAudio(g: Phaser.Game) {
  game = g;
  // 모듈 muted 플래그를 새 사운드 매니저에 동기화
  // (부팅 순서: React 음소거 복원 effect가 createGame보다 먼저 돌 수 있다)
  if (muted) setMuted(true);
}

/** 유저 제스처 시점 오디언락 해제 (모바일 WebView 대비) */
export function initAudio() {
  const sm = game?.sound as Phaser.Sound.WebAudioSoundManager | null;
  const ctx = sm?.context;
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

export function setMuted(m: boolean) {
  muted = m;
  if (game) {
    game.sound.mute = m;
    // 일부 Chromium/WebView에선 mute 세터가 쓰는 setValueAtTime(..., 0)(과거 시점 스케줄)이
    // 즉시 반영되지 않는다 — 전용 뮤트 노드 게인에 직접 기록 (볼륨 노드와 분리돼 있어 안전)
    const sm = game.sound as unknown as { masterMuteNode?: { gain: AudioParam } | null };
    if (sm.masterMuteNode) sm.masterMuteNode.gain.value = m ? 0 : 1;
  }
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

/* ---------- SFX (효과음연구소 + 小森平 효과음 매핑) ---------- */

export const sfx = {
  /** 검 휘두르기 — sword-slash2(효과음연구소), 매번 미세 피치 변주 */
  swing() {
    play("sfx_swing", 0.5, 0.95 + Math.random() * 0.12);
  },
  /** 명중 — blow2(효과음연구소, 타격 임팩트) */
  hit() {
    play("sfx_hit", 0.55);
  },
  /** 회전베기 — katana-continuity1(효과음연구소, 연속 베기) 저피치 */
  spin() {
    play("sfx_spin", 0.6, 0.9);
  },
  /** 돌진 — highspeed-movement1(효과음연구소, 고속 이동) */
  dash() {
    play("sfx_dash", 0.45, 1.05);
  },
  /** 플레이어 피격 — damage2(小森平, 데미지 익성) */
  hurt() {
    play("sfx_hurt", 0.6);
  },
  /** 파편/아이템 획득 — pickup02(小森平) */
  pickup() {
    play("sfx_pickup", 0.6);
  },
  /** 퀘스트 완료 — correct_answer3(小森平, 성공 지시음) */
  questDone() {
    play("sfx_quest", 0.6);
  },
  /** 레벨업 — levelup1(효과음연구소, 전용 레벨업음) */
  levelup() {
    play("sfx_levelup", 0.65);
  },
  /** 차원문 — magic-worp1(효과음연구소, 워프) */
  portal() {
    play("sfx_portal", 0.55);
  },
  /** 보스 등장 포효 — dragon_roar(小森平) */
  roar() {
    play("sfx_roar", 0.75);
  },
  /** 일반 몬스터 사망 — end_of_a_monster(小森平), 피치 변주 */
  enemyDie() {
    play("sfx_die", 0.55, 0.9 + Math.random() * 0.2);
  },
  /** 보스 사망 — wall-destruction1(효과음연구소, 대형 붕괴) + 포효 */
  bossDie() {
    play("sfx_bossdie", 0.85);
    play("sfx_roar", 0.55, 0.75);
  },
  /** 골드 픽업 — coin02(小森平, 전용 코인음) */
  coin() {
    play("sfx_coin", 0.5);
  },
  /** 물약 마심 — magic-cure2(효과음연구소, 회복 마법) */
  potion() {
    play("sfx_potion", 0.5);
  },
  /** 장비 장착 — armor-work-1(효과음연구소, 갑옷 움직임) */
  equip() {
    play("sfx_equip", 0.55);
  },
  /** 크리티컬 명중 — large-sword-slash1(효과음연구소, 대검 강베기 — 타격감 강조) */
  crit() {
    play("sfx_crit", 0.65, 1.0 + Math.random() * 0.08);
  },
  /** 강화 성공 — jajean1(효과음연구소, '자잔!' 성공음) */
  upgradeOk() {
    play("sfx_upgradeOk", 0.6);
  },
  /** 강화 실패 — buzzer1(小森平) 앞부분 트리밍 — 낙방음 */
  upgradeFail() {
    play("sfx_upgradeFail", 0.5);
  },
};
