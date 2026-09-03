import type Phaser from "phaser";

/**
 * 외부 오디오 에셋 재생 (public/assets/audio/)
 *  - BGM: v3.0.23 — 40트랙을 구역(맵)별로 고정 배치 (Kevin MacLeod, incompetech.com, CC-BY 4.0)
 *    · 로테이션(곡 교체) 기능 완전 제거 — 한 구역은 항상 같은 곡 한 곡을 무한 루프
 *    · 40곡 전부를 챕터 성격에 맞는 풀로 배치 (맵마다 적절히 — CHAPTER_TRACKS 참조)
 *    · 보스 구역(10)은 전투곡, 챕터 마을(Xv)·실내는 마을곡, 타이틀은 title1
 *  - SFX: 80 CC0 RPG SFX / 80 CC0 creature SFX — Rubberduck (CC0)
 * 출처/라이선스: public/assets/CREDITS.md
 */

let game: Phaser.Game | null = null;
let bgmSound: Phaser.Sound.BaseSound | null = null;
/** 현재(또는 재개 예정) BGM 트랙 키 — 음소거/백그라운드 복원 기준 */
let bgmKey: string | null = null;
/** 마지막으로 요청된 스테이지 키 (E2E/디버그용) */
let bgmStage: string | null = null;
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
let bgmFadeTimer: ReturnType<typeof setInterval> | null = null;

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

/* v3.0.23 — 테마 대표곡 (타이틀 화면 등 kind 기반 재생용. 필드는 stageTrack 사용) */
const THEME_TRACKS: Record<BGMKind, string> = {
  title: "bgm_title1",
  village: "bgm_village1",
  field: "bgm_field1",
  alfheim: "bgm_alfheim1",
  cave: "bgm_cave1",
  snow: "bgm_snow1",
  abyss: "bgm_abyss1",
  boss: "bgm_boss1",
};

/* v3.0.21 플레이리스트 테이블 유지 — 40트랙 자산 목록 (BootScene 프리로드 + E2E 훅 참조) */
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
/** BootScene 로드 리스트 — 40트랙 전체 (모든 곡이 구역 배치에 사용됨) */
export const BGM_ALL_TRACKS: string[] = Object.values(BGM_PLAYLISTS).flat();

/* ================= v3.0.23 — 구역별 고정 BGM 배치표 (40곡 전부 사용) =================
 *  원칙: ① 한 구역 = 고정 1곡 (이동해도 그 구역이면 항상 같은 곡 — 곡 교체 없음)
 *        ② 챕터 성격에 맞는 풀 배치, 인접 구역은 다른 곡
 *        ③ 보스 구역(10)은 전투곡, 챕터 마을(Xv)·실내는 마을곡, 타이틀은 title1
 *  배치: 숲=필드 5 / 쿠소디아=웅장(title) 4 / 알프헤임=신비 5 / 무스펠헤임=화염·불길
 *        니플헤임=설원 5 / 스바르트=동굴 5 / 니다벨리르=광산(동굴+잔여 보스곡)
 *        헬·심연=어둠(abyss) + 잔여 보스곡 / 마을 10곳=village 5곡 순환 */
const CHAPTER_ORDER = ["forest", "kingdom", "alfheim", "muspelheim", "niflheim", "cave", "nidavellir", "hel", "abyss"] as const;

const CHAPTER_TRACKS: Record<string, string[]> = {
  forest: ["bgm_field1", "bgm_field2", "bgm_field3", "bgm_field4", "bgm_field5"],
  kingdom: ["bgm_title2", "bgm_title3", "bgm_title4", "bgm_title5"],
  alfheim: ["bgm_alfheim1", "bgm_alfheim2", "bgm_alfheim3", "bgm_alfheim4", "bgm_alfheim5"],
  muspelheim: ["bgm_abyss3", "bgm_abyss4", "bgm_abyss5", "bgm_boss2", "bgm_boss3"],
  niflheim: ["bgm_snow1", "bgm_snow2", "bgm_snow3", "bgm_snow4", "bgm_snow5"],
  cave: ["bgm_cave1", "bgm_cave2", "bgm_cave3", "bgm_cave4", "bgm_cave5"],
  nidavellir: ["bgm_cave1", "bgm_cave3", "bgm_cave5", "bgm_boss4", "bgm_boss5"],
  hel: ["bgm_abyss1", "bgm_abyss2", "bgm_boss1", "bgm_boss2", "bgm_boss3"],
  abyss: ["bgm_abyss1", "bgm_abyss2", "bgm_abyss4", "bgm_boss1", "bgm_boss5"],
};
const VILLAGE_TRACKS = ["bgm_village1", "bgm_village2", "bgm_village3", "bgm_village4", "bgm_village5"];
const BOSS_TRACKS = ["bgm_boss1", "bgm_boss2", "bgm_boss3", "bgm_boss4", "bgm_boss5"];
/** 챕터 일반 구역 폴백 (미지의 챕터 키) */
const FALLBACK_TRACKS = CHAPTER_TRACKS.forest;

/** 스테이지 키 파싱 — "forest3"→{ch:"forest",zone:3} / "forestv"·"village"→마을 */
function splitStage(stage: string): { ch: string; zone: number; isVillageStage: boolean } {
  if (stage === "village") return { ch: "village", zone: 0, isVillageStage: true };
  if (stage.endsWith("v")) return { ch: stage.slice(0, -1), zone: 0, isVillageStage: true };
  const m = stage.match(/^([a-z]+)(\d+)$/);
  if (m) return { ch: m[1], zone: parseInt(m[2], 10), isVillageStage: false };
  return { ch: stage, zone: 0, isVillageStage: false };
}

function chIndexOf(ch: string): number {
  const i = (CHAPTER_ORDER as readonly string[]).indexOf(ch);
  return i < 0 ? 0 : i;
}

/** 실내/실외 관계없이 스테이지 → 고정 트랙 (v3.0.23 — stageBgm 대체) */
export function stageTrack(stage: string): string {
  if (stage === "interior_inn") return "bgm_village3";
  if (stage === "interior_home") return "bgm_village4";
  const { ch, zone } = splitStage(stage);
  if (zone === 10) return BOSS_TRACKS[chIndexOf(ch) % BOSS_TRACKS.length]; // 보스 구역 — 전투곡 고정
  if (zone <= 0) return VILLAGE_TRACKS[chIndexOf(ch) % VILLAGE_TRACKS.length]; // 마을/기본
  const pool = CHAPTER_TRACKS[ch] ?? FALLBACK_TRACKS;
  return pool[(zone - 1) % pool.length];
}

/** 보스 조우 중 오버라이드 트랙 (구역 일반곡과 별개 — 전투곡) */
function bossTrackOf(stage: string): string {
  return BOSS_TRACKS[chIndexOf(splitStage(stage).ch) % BOSS_TRACKS.length];
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
      // 숨김 — 전체 정지 (트랙 키는 유지해 복귀 시 재개)
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
      // 복귀 — 음소거 아니고 트랙 지정이 있으면 재개
      if (!muted && bgmKey && !bgmSound) startTrack(bgmKey);
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
  else if (bgmKey) startTrack(bgmKey);
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

/** BGM 볼륨 페이드 (트랙 전환 페이드인용) */
function fadeBgm(target: number, ms: number) {
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
    if (k >= 1) clearFadeTimer();
  }, 60);
}

/** v3.0.23 — 고정 트랙 1곡 무한 루프 재생 (곡 교체/로테이션 없음).
 *  오디오 캐시 미완료(부트 프리로드 진행 중 진입)면 0.5초 간격 재시도 —
 *  "게임 시작 직후 음악이 안 나오는" 타이밍 버그 방지 (최대 30회/15초). */
function startTrack(key: string, retried = 0) {
  if (!game) return;
  try {
    const snd = game.sound.add(key, { loop: true, volume: 0 });
    if (!snd) {
      if (retried < 30) {
        window.setTimeout(() => {
          if (bgmKey === key && !bgmSound && !muted) startTrack(key, retried + 1);
        }, 500);
      }
      return;
    }
    bgmSound = snd;
    asVol(bgmSound)?.setVolume(0);
    bgmSound.play();
    fadeBgm(BGM_VOLUME, 1200);
  } catch {
    // 브라우저 자동재생 정책(사용자 입력 전) — 첫 입력에서 initAudio 후 재개됨
    bgmSound = null;
  }
}

/** 스테이지(구역) 진입 — 그 구역의 고정 BGM 1곡을 루프. 같은 곡이면 무시(끊김 없음).
 *  @param bossActive 보스 조우 중 → 해당 챕터 전투곡으로 오버라이드 */
export function playStageBGM(stage: string, bossActive = false) {
  const key = bossActive ? bossTrackOf(stage) : stageTrack(stage);
  bgmStage = stage;
  if (bgmKey === key && bgmSound?.isPlaying) return;
  destroyBgm();
  bgmKey = key;
  if (muted || !game) return;
  startTrack(key);
}

/** kind 기반 재생 (타이틀 화면 전용 + E2E 훅) — 테마 대표곡 고정 루프 */
export function playBGM(kind: BGMKind) {
  const key = THEME_TRACKS[kind];
  if (bgmKey === key && bgmSound?.isPlaying) return;
  destroyBgm();
  bgmKey = key;
  if (muted || !game) return;
  startTrack(key);
}
/** 씬 전환/사망 등 — 정지만 하고 트랙 키는 유지(음소거 해제 시 재개용) */
export function stopBGM() {
  destroyBgm();
}

/* ---------- E2E 검증 훅 ---------- */
/** 현재 BGM 상태 스냅샷 (트랙 키·재생 여부·루프 고정 확인) */
export function bgmDebugState() {
  const kind = bgmKey ? ((bgmKey.replace(/^bgm_/, "").replace(/\d+$/, "") as BGMKind)) : null;
  return {
    kind,
    track: bgmKey,
    playing: !!bgmSound?.isPlaying,
    loop: true,
    stage: bgmStage,
    playlistCount: kind ? BGM_PLAYLISTS[kind].length : 0,
  };
}
/** 강제 재시작 (E2E 전용) — v3.0.23: 재시작 후에도 같은 트랙이 유지되는지 검증용 (교체 없음) */
export function bgmAdvanceForTest() {
  if (!muted && bgmKey && game) {
    destroyBgm();
    startTrack(bgmKey);
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
