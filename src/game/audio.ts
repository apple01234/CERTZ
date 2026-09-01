import type Phaser from "phaser";

/**
 * 외부 오디오 에셋 재생 (public/assets/audio/)
 *  - BGM: Retro Game Music Pack — Juhani Junkala (CC0) + OpenGameArt CC0/CC-BY 5트랙 (v1.2)
 *    title/field/boss + village/alfheim/cave/snow/abyss — 스테이지별 전용 테마 8종 (v2.0 전면 활성화)
 *  - SFX: 80 CC0 RPG SFX / 80 CC0 creature SFX — Rubberduck (CC0)
 * 자체 합성(WebAudio 오실레이터)은 전면 제거 — Phaser SoundManager 사용.
 */

let game: Phaser.Game | null = null;
let bgmSound: Phaser.Sound.BaseSound | null = null;
let bgmKind: BGMKind | null = null;
let muted = false;

/* v3.0.6 (지시 #7 — 전체적인 사운드 밸런스 조정):
 *  ① 동일 SFX 최소 간격 스로틀 — 자동사냥 대량 처치 시 수십 개 사운드가 동시 겹쳐
 *     귀가 아프고 BGM이 묻히던 문제 해결 (같은 키 55ms 내 재생 억제)
 *  ② 동시 재생 캡 — 12개 초과 시 가장 오래된 순으로 무시 (WebAudio 노드 폭증 방지)
 *  ③ 볼륨 래더 재조정 — 전투 기초음 하향/큰 순간 유지/BGM 0.42→0.34 (SFX 가독성 우선) */
const SFX_THROTTLE_MS = 55;
const SFX_MAX_CONCURRENT = 12;
/** BGM 볼륨 — v3.0.6 밸런스 (E2E 검증용 export) */
export const BGM_VOLUME = 0.34;
const lastPlayed: Record<string, number> = {};
let activeSounds = 0;

export const SFX_THROTTLE_MS_V = SFX_THROTTLE_MS;
export { SFX_THROTTLE_MS, SFX_MAX_CONCURRENT };

function play(key: string, vol: number, rate = 1) {
  if (!game || muted) return;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (lastPlayed[key] && now - lastPlayed[key] < SFX_THROTTLE_MS) return;
  if (activeSounds >= SFX_MAX_CONCURRENT) return;
  lastPlayed[key] = now;
  activeSounds++;
  game.sound.play(key, { volume: vol, rate });
  // 1.6초 후 예비 감소 — complete 이벤트 유실 대비 단일 감소 경로 (정확한 캡은 아니어도 밸런스 목적 충분)
  setTimeout(() => {
    activeSounds = Math.max(0, activeSounds - 1);
  }, 1600);
}

export type BGMKind = "field" | "boss" | "title" | "village" | "alfheim" | "cave" | "snow" | "abyss";

/** 스테이지 → 전용 BGM 매핑 (v2.0 — 9챕터 × 10구역 키 지원) */
export function stageBgm(stage: string): BGMKind {
  /* v2.9 — 챕터 마을(Xv)은 해당 챕터 BGM을 따른다 */
  const ch = stage.endsWith("v") && stage !== "village" ? stage.slice(0, -1) : stage.replace(/([1-9]|10)$/, "");
  switch (ch) {
    case "village":
      return "village";
    case "kingdom":
      return "village";
    case "alfheim":
      return "alfheim";
    case "cave":
    case "nidavellir":
      return "cave";
    case "niflheim":
      return "snow";
    case "muspelheim":
    case "hel":
      return "abyss";
    case "abyss":
      return "abyss";
    case "forest":
      return "field";
    default:
      return "field";
  }
}

/** PhaserGame 생성 직후 1회 호출 */
export function attachAudio(g: Phaser.Game) {
  game = g;
  // 모듈 muted 플래그를 새 사운드 매니저에 동기화
  // (부팅 순서: React 음소거 복원 effect가 createGame보다 먼저 돌 수 있다)
  if (muted) setMuted(true);
  attachLifecycle(g);
}

/* ---------- 앱 백그라운드 오디오 정지 (v2.5 — 지시 #4) ----------
 * WebView가 백그라운드(홈 전환/화면 꺼짐)로 가도 WebAudio는 계속 재생된다.
 * visibilitychange로 숨김 시 전체 정지, 복귀 시 BGM 재개. */
let lifecycleAttached = false;

function attachLifecycle(g: Phaser.Game) {
  if (lifecycleAttached || typeof document === "undefined") return;
  lifecycleAttached = true;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      // 숨김 — 전체 정지 (BGM kind는 유지해 복귀 시 재개)
      try {
        g.sound.pauseAll();
      } catch {
        /* noop */
      }
      destroyBgm();
    } else {
      try {
        g.sound.resumeAll();
      } catch {
        /* noop */
      }
      // 복귀 — 음소거 아니고 BGM 지정이 있으면 재개
      if (!muted && bgmKind && !bgmSound) startBgm(bgmKind);
    }
  });
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

/** v3.0.6 — sfx 테이블 볼륨 스냅샷 (E2E 밸런스 검증용) */
export const SFX_VOLUMES: Record<string, number> = {
  sfx_swing: 0.34,
  sfx_hit: 0.4,
  sfx_spin: 0.44,
  sfx_dash: 0.36,
  sfx_hurt: 0.52,
  sfx_pickup: 0.5,
  sfx_quest: 0.55,
  sfx_levelup: 0.62,
  sfx_portal: 0.5,
  sfx_roar: 0.62,
  sfx_die: 0.42,
  sfx_bossdie: 0.72,
};

function destroyBgm() {
  if (bgmSound) {
    bgmSound.stop();
    bgmSound.destroy();
    bgmSound = null;
  }
}

function startBgm(kind: BGMKind) {
  if (!game) return;
  try {
    // v3.0.6 — BGM 0.42→0.34 (SFX 가독성 우선 밸런스)
    bgmSound = game.sound.add(`bgm_${kind}`, { loop: true, volume: 0.34 });
    bgmSound.play();
  } catch {
    // 브라우저 자동재생 정책(사용자 입력 전) — 첫 입력에서 initAudio 후 재개됨
    bgmSound = null;
  }
}

export function playBGM(kind: BGMKind) {
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

/* ---------- SFX (Rubberduck CC0 팩 매핑) ----------
 *  v3.0.6 밸런스 래더: 잦은 전투음 0.34~0.46 / 중간 0.46~0.55 / 큰 순간 0.55~0.72 */

export const sfx = {
  /** 검 휘두르기 — blade_01, 매번 미세 피치 변주 */
  swing() {
    play("sfx_swing", 0.34, 0.95 + Math.random() * 0.12);
  },
  /** 명중 — metal_02 (검 금속음) */
  hit() {
    play("sfx_hit", 0.4);
  },
  /** 회전베기 — blade_03 저피치 */
  spin() {
    play("sfx_spin", 0.44, 0.8);
  },
  /** 돌진 — blade_02 고피치 */
  dash() {
    play("sfx_dash", 0.36, 1.1);
  },
  /** 플레이어 피격 — hurt_01 */
  hurt() {
    play("sfx_hurt", 0.52);
  },
  /** 파편 줍기 — item_gem_01 */
  pickup() {
    play("sfx_pickup", 0.5);
  },
  /** 퀘스트 완료 — item_gem_04 */
  questDone() {
    play("sfx_quest", 0.55);
  },
  /** 레벨업 — spell_01 */
  levelup() {
    play("sfx_levelup", 0.62);
  },
  /** 차원문 — spell_02 */
  portal() {
    play("sfx_portal", 0.5);
  },
  /** 보스 등장 포효 — roar_01 */
  roar() {
    play("sfx_roar", 0.62);
  },
  /** 일반 몬스터 사망 — creature_die_01, 피치 변주 */
  enemyDie() {
    play("sfx_die", 0.42, 0.9 + Math.random() * 0.2);
  },
  /** 보스 사망 — monster_06 + 포효 */
  bossDie() {
    play("sfx_bossdie", 0.72);
    play("sfx_roar", 0.5, 0.75);
  },
  /** 골드 픽업 — item_gem_01 고피치 변주 (동일 CC0 파일 재사용) */
  coin() {
    play("sfx_pickup", 0.4, 1.3 + Math.random() * 0.2);
  },
  /** 물약 마심 — spell_01 저피치 단발 */
  potion() {
    play("sfx_levelup", 0.38, 1.25);
  },
  /** 장비 장착 — item_gem_04 저피치 (차임) */
  equip() {
    play("sfx_quest", 0.46, 0.85);
  },
  /** 크리티컬 명중 — metal_02 고피치 샤프 음 (타격감 강조) */
  crit() {
    play("sfx_hit", 0.46, 1.55 + Math.random() * 0.15);
  },
  /** 강화 성공 — 퀘스트 차임 저피치 (무게감 있는 성공음) */
  upgradeOk() {
    play("sfx_quest", 0.55, 0.7);
  },
  /** 강화 실패 — hurt 저피치 (둔탁한 낙방음) */
  upgradeFail() {
    play("sfx_hurt", 0.46, 0.65);
  },
};
