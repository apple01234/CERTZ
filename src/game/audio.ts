import type Phaser from "phaser";

/**
 * 외부 오디오 에셋 재생 (public/assets/audio/)
 *  - BGM: v3.0.21 전면 교체 — 실제 음원 40트랙 다운로드 (Kevin MacLeod, incompetech.com, CC-BY 4.0)
 *    테마당 5곡 × 8테마(title/village/field/alfheim/cave/snow/abyss/boss),
 *    한 곡이 끝나면 같은 테마의 다음 곡으로 자연 로테이션(셔플 백 — 한 바퀴 전엔 반복 없음)
 *    ※ v3.0.20의 절차 합성 변주 트랙은 유저 피드백으로 전량 폐기 — 다운로드 음원만 사용
 *  - SFX: 80 CC0 RPG SFX / 80 CC0 creature SFX — Rubberduck (CC0)
 * 출처/라이선스: public/assets/CREDITS.md
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
/** BGM 볼륨 — v3.0.22 밸런스: BGM 존재감 +0.04 (원곡이 묻히지 않게) */
export const BGM_VOLUME = 0.38;
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

/* v3.0.21 (#36) — 테마별 플레이리스트 40트랙 (다운로드 음원, scripts/bgm_work/manifest.json 참조)
 *  title 웅장한 모험 / village 평화로운 마을 / field 모험 필드 / alfheim 신비 요정림
 *  cave 어두운 던전 / snow 차가운 설원 / abyss 사악한 심연 / boss 긴장감 있는 전투 */
export const BGM_PLAYLISTS: Record<BGMKind, string[]> = {
  title: ["bgm_title1", "bgm_title2", "bgm_title3", "bgm_title4", "bgm_title5"],
  village: ["bgm_village1", "bgm_village2", "bgm_village3", "bgm_village4", "bgm_village5"],
  field: ["bgm_field1", "bgm_field2", "bgm_field3", "bgm_field4", "bgm_field5"],
  alfheim: ["bgm_alfheim1", "bgm_alfheim2", "bgm_alfheim3", "bgm_alfheim4", "bgm_alfheim5"],
  cave: ["bgm_cave1", "bgm_cave2", "bgm_cave3", "bgm_cave4", "bgm_cave5"],
  snow: ["bgm_snow1", "bgm_snow2", "bgm_snow3", "bgm_snow4", "bgm_snow5"],
  abyss: ["bgm_abyss1", "bgm_abyss2", "bgm_abyss3", "bgm_abyss4", "bgm_abyss5"],
  boss: ["bgm_boss1", "bgm_boss2", "bgm_boss3", "bgm_boss4", "bgm_boss5"],
};
/** BootScene 로드 리스트 — 플레이리스트 전체 자동 수집 */
export const BGM_ALL_TRACKS: string[] = Object.values(BGM_PLAYLISTS).flat();

/* 셔플 백 — 테마별 재생 대기열 (한 바퀴 돌기 전엔 같은 곡 반복 없음) */
const bgmBags: Partial<Record<BGMKind, number[]>> = {};
const bgmLastIdx: Partial<Record<BGMKind, number>> = {};
let bgmFadeTimer: ReturnType<typeof setInterval> | null = null;

function nextTrackOf(kind: BGMKind): string {
  const pl = BGM_PLAYLISTS[kind];
  let bag = bgmBags[kind];
  if (!bag || bag.length === 0) {
    bag = pl.map((_, i) => i);
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    // 리필 직후 첫 곡이 직전 곡과 같으면 큐 맨 뒤로 — 연속 반복 방지
    if (bag[0] === bgmLastIdx[kind] && bag.length > 1) bag.push(bag.shift()!);
    bgmBags[kind] = bag;
  }
  const idx = bag.shift()!;
  bgmLastIdx[kind] = idx;
  return pl[idx];
}

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

/** v3.0.22 — sfx 테이블 볼륨 스냅샷 (E2E 밸런스 검증용 — 본체는 파일 말미) */

function destroyBgm() {
  clearFadeTimer();
  if (bgmSound) {
    bgmSound.stop();
    bgmSound.destroy();
    bgmSound = null;
  }
}

/** BaseSound 볼륨 조작 (Phaser 타입이 구현체별로 분리돼 있어 최소 인터페이스 캐스팅) */
type VolumeSound = { volume: number; setVolume(v: number): void };
function asVol(s: Phaser.Sound.BaseSound): VolumeSound | null {
  return s ? (s as unknown as VolumeSound) : null;
}

function clearFadeTimer() {
  if (bgmFadeTimer) {
    clearInterval(bgmFadeTimer);
    bgmFadeTimer = null;
  }
}

/** BGM 볼륨 페이드 (변주 전환 크로스페이드용) */
function fadeBgm(target: number, ms: number, done?: () => void) {
  if (!bgmSound) return;
  clearFadeTimer();
  const snd = asVol(bgmSound);
  if (!snd) return;
  const from = snd.volume ?? BGM_VOLUME;
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  bgmFadeTimer = setInterval(() => {
    const cur = bgmSound ? asVol(bgmSound) : null;
    if (!cur) {
      clearFadeTimer();
      return;
    }
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const k = Math.min(1, (now - t0) / ms);
    cur.setVolume(from + (target - from) * k);
    if (k >= 1) {
      clearFadeTimer();
      done?.();
    }
  }, 60);
}

function startBgm(kind: BGMKind) {
  if (!game) return;
  try {
    // v3.0.21 — 셔플 백에서 다음 곡 선택, 루프 없이 재생 → 종료 시 같은 테마 다음 곡으로 자연 로테이션
    const key = nextTrackOf(kind);
    bgmSound = game.sound.add(key, { loop: false, volume: 0 });
    asVol(bgmSound)?.setVolume(0);
    const snd = bgmSound;
    bgmSound.once("complete", () => {
      if (!muted && bgmKind === kind && bgmSound === snd) {
        destroyBgm();
        startBgm(kind);
      }
    });
    bgmSound.play();
    fadeBgm(BGM_VOLUME, 1200);
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

/* ---------- E2E 검증 훅 ---------- */
/** 현재 BGM 상태 스냅샷 (kind·재생 중 트랙 키) */
export function bgmDebugState() {
  return {
    kind: bgmKind,
    track: (bgmSound as unknown as { key?: string } | null)?.key ?? null,
    playing: !!bgmSound?.isPlaying,
    playlistCount: bgmKind ? BGM_PLAYLISTS[bgmKind].length : 0,
  };
}
/** 로테이션 강제 진행 (곡 종료 동작 재현 — E2E 전용) */
export function bgmAdvanceForTest() {
  if (!muted && bgmKind && game) {
    destroyBgm();
    startBgm(bgmKind);
  }
}

/* ---------- SFX (Rubberduck CC0 팩 매핑) ----------
 *  v3.0.22 밸런스 래더 — 잦은 반복음(공격/코인/픽업)을 낮추고 큰 순간은 유지:
 *  스윙·명중·코인·픽업 −0.04~0.08 / 레벨업·퀘스트·포효 −0.05~0.06 / BGM +0.04 */
export const SFX_VOLUMES: Record<string, number> = {
  sfx_swing: 0.3,
  sfx_hit: 0.36,
  sfx_spin: 0.4,
  sfx_dash: 0.32,
  sfx_hurt: 0.48,
  sfx_pickup: 0.42,
  sfx_quest: 0.5,
  sfx_levelup: 0.56,
  sfx_portal: 0.46,
  sfx_roar: 0.56,
  sfx_die: 0.38,
  sfx_bossdie: 0.66,
};

export const sfx = {
  /** 검 휘두르기 — blade_01, 매번 미세 피치 변주 */
  swing() {
    play("sfx_swing", SFX_VOLUMES.sfx_swing, 0.95 + Math.random() * 0.12);
  },
  /** 명중 — metal_02 (검 금속음) */
  hit() {
    play("sfx_hit", SFX_VOLUMES.sfx_hit);
  },
  /** 회전베기 — blade_03 저피치 */
  spin() {
    play("sfx_spin", SFX_VOLUMES.sfx_spin, 0.8);
  },
  /** 돌진 — blade_02 고피치 */
  dash() {
    play("sfx_dash", SFX_VOLUMES.sfx_dash, 1.1);
  },
  /** 플레이어 피격 — hurt_01 */
  hurt() {
    play("sfx_hurt", SFX_VOLUMES.sfx_hurt);
  },
  /** 파편 줍기 — item_gem_01 (v3.0.22 피치 변주 — 매번 같은 소리 방지) */
  pickup() {
    play("sfx_pickup", SFX_VOLUMES.sfx_pickup, 0.92 + Math.random() * 0.18);
  },
  /** 퀘스트 완료 — item_gem_04 */
  questDone() {
    play("sfx_quest", SFX_VOLUMES.sfx_quest);
  },
  /** 레벨업 — spell_01 */
  levelup() {
    play("sfx_levelup", SFX_VOLUMES.sfx_levelup);
  },
  /** 차원문 — spell_02 */
  portal() {
    play("sfx_portal", SFX_VOLUMES.sfx_portal);
  },
  /** 보스 등장 포효 — roar_01 */
  roar() {
    play("sfx_roar", SFX_VOLUMES.sfx_roar);
  },
  /** 일반 몬스터 사망 — creature_die_01, 피치 변주 */
  enemyDie() {
    play("sfx_die", SFX_VOLUMES.sfx_die, 0.9 + Math.random() * 0.2);
  },
  /** 보스 사망 — monster_06 + 포효 */
  bossDie() {
    play("sfx_bossdie", SFX_VOLUMES.sfx_bossdie);
    play("sfx_roar", 0.44, 0.75);
  },
  /** 골드 픽업 — item_gem_01 고피치 변주 (동일 CC0 파일 재사용 · v3.0.22 볼륨 하향) */
  coin() {
    play("sfx_pickup", 0.32, 1.25 + Math.random() * 0.25);
  },
  /** 물약 마심 — spell_01 저피치 단발 */
  potion() {
    play("sfx_levelup", 0.32, 1.25);
  },
  /** 장비 장착 — item_gem_04 저피치 (차임) */
  equip() {
    play("sfx_quest", 0.42, 0.85);
  },
  /** 크리티컬 명중 — metal_02 고피치 샤프 음 (타격감 강조) */
  crit() {
    play("sfx_hit", 0.42, 1.55 + Math.random() * 0.15);
  },
  /** 강화 성공 — 퀘스트 차임 저피치 (무게감 있는 성공음) */
  upgradeOk() {
    play("sfx_quest", 0.5, 0.7);
  },
  /** 강화 실패 — hurt 저피치 (둔탁한 낙방음) */
  upgradeFail() {
    play("sfx_hurt", 0.42, 0.65);
  },
};
