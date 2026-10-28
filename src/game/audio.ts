import type Phaser from "phaser";

/**
 * 외부 오디오 에셋 재생 (public/assets/audio/)
 *  - BGM: v3.0.23 — 40트랙을 구역(맵)별로 고정 배치
 *    · v1.0.3-beta — 초반 3곡(bgm_village1·bgm_field1·bgm_title2) 원본(Kevin MacLeod)으로 복구
 *      (v1.0.2-beta 합성 음원 교체를 유저 평가 "별로"로 롤백 — 같은 파일명 복원이라 코드 무수정)
 *    · 나머지 37트랙: Kevin MacLeod, incompetech.com, CC-BY 4.0
 *    · 로테이션(곡 교체) 기능 완전 제거 — 한 구역은 항상 같은 곡 한 곡을 무한 루프
 *    · 40곡 전부를 챕터 성격에 맞는 풀로 배치 (맵마다 적절히 — CHAPTER_TRACKS 참조)
 *    · 보스 구역(10)은 전투곡, 챕터 마을(Xv)·실내는 마을곡, 타이틀은 title1
 *  - SFX: 80 CC0 RPG SFX / 80 CC0 creature SFX — Rubberduck (CC0)
 *    v4.1.7 — Unity Asset Store 유료 에셋(Fantasy UI SFX)으로 주요 UI/아이템음 교체·신규 추가:
 *    · 교체(동일 키 drop-in): swing/hit/spin/dash/hurt/pickup/quest/levelup/portal
 *    · 신규 전용음: coin/potion/equip/upgrade/click/open/close/ach
 *    · 유지(Rubberduck): roar/die/bossdie — 팩에 몬스터 포효/사망음이 없음
 * 출처/라이선스: public/assets/CREDITS.md
 */

let game: Phaser.Game | null = null;
let bgmSound: Phaser.Sound.BaseSound | null = null;
/** 현재(또는 재개 예정) BGM 트랙 키 — 음소거/백그라운드 복원 기준 */
let bgmKey: string | null = null;
/** 마지막으로 요청된 스테이지 키 (E2E/디버그용) */
let bgmStage: string | null = null;
let muted = false;

/* v3.0.24 — BGM 지연 로딩 (유저 지시: "용량 많은건 상관없음, 렉만 안걸리면 됨 + 퀄리티가 우선")
 *  풀버전(q4·48kHz, ~5분) 40트랙을 부트에서 디코드하면 WebAudio PCM이 수 GB — 크래시/렉 원인.
 *  → 부트 프리로드는 타이틀 1곡만, 구역 진입 시 그 구역 1곡만 fetch+decode 후 재생.
 *  LRU 캡: 디코드된 트랙 최대 3개 유지(현 구역 + 최근 2곳), 초과분은 캐시에서 해제. */
const BGM_DIR = "assets/audio";
const MAX_DECODED_BGM = 3;
const decodedLru: string[] = [];
const bgmInflight = new Map<string, Promise<boolean>>();

/* v3.0.6 (지시 #7 — 전체적인 사운드 밸런스 조정):
 *  ① 동일 SFX 최소 간격 스로틀 — 자동사냥 대량 처치 시 수십 개 사운드가 동시 겹쳐
 *     귀가 아프고 BGM이 묻히던 문제 해결 (같은 키 55ms 내 재생 억제)
 *  ② 동시 재생 캡 — 12개 초과 시 가장 오래된 순으로 무시 (WebAudio 노드 폭증 방지)
 *  ③ 볼륨 래더 재조정 — 전투 기초음 하향/큰 순간 유지/BGM 0.42→0.34 (SFX 가독성 우선) */
const SFX_THROTTLE_MS = 55;
const SFX_MAX_CONCURRENT = 12;
/** BGM 볼륨 — v3.0.22 밸런스: BGM 존재감 +0.04 (원곡이 묻히지 않게)
 *  v3.1.0 — 유저 지시 "BGM과 SFX를 각각 조절할수 있는 UI": 런타임 조절 변수로 전환
 *  (BGM_VOLUME 상수는 E2E 호환용 기본값 스냅샷으로 유지)
 *  v1.4.12 (#7 유저 지시) — 기본 시작 설정 BGM 60% */
export const BGM_VOLUME = 0.6;
const BGM_VOLUME_DEFAULT = 0.6;
/** v3.1.0 — 효과음 마스터 게인 (유저 지시 "BGM보다 효과음이 너무 큼": 1.0→0.62 스케일)
 *  v1.4.12 (#7 유저 지시) — 기본 시작 설정 SE 50% */
const SFX_VOLUME_DEFAULT = 0.5;
let bgmVol = BGM_VOLUME_DEFAULT;
let sfxVol = SFX_VOLUME_DEFAULT;
const lastPlayed: Record<string, number> = {};
let activeSounds = 0;
let bgmFadeTimer: ReturnType<typeof setInterval> | null = null;

export const SFX_THROTTLE_MS_V = SFX_THROTTLE_MS;
export { SFX_THROTTLE_MS, SFX_MAX_CONCURRENT };

/** 현재 볼륨 프리셋 조회 (설정 UI 초기값/E2E용) */
export function getBgmVolume(): number {
  return bgmVol;
}
export function getSfxVolume(): number {
  return sfxVol;
}

/** 현재 재생 중인 트랙의 실제 출력 볼륨 (사용자 설정값 × 곡별 정규화 게인).
 *  v1.0.17 — 게인을 곱하지 않은 bgmVol을 그대로 setVolume하면 곡별 음량 보정이 덮어써진다. */
function trackVolume(): number {
  return Math.min(1, bgmVol * bgmGain(bgmKey ?? ""));
}

/** BGM 볼륨 설정 (0~1) — 재생 중인 트랙에 즉시 반영 + localStorage 저장 */
export function setBgmVolume(v: number) {
  bgmVol = Math.min(1, Math.max(0, v));
  try {
    window.localStorage.setItem("sertz_bgm_vol", String(Math.round(bgmVol * 100)));
  } catch {
    /* 무시 */
  }
  if (bgmSound) asVol(bgmSound)?.setVolume(trackVolume());
}

/** 효과음 볼륨 설정 (0~1) — 이후 재생되는 모든 SFX에 배율 적용 + localStorage 저장 */
export function setSfxVolume(v: number) {
  sfxVol = Math.min(1, Math.max(0, v));
  try {
    window.localStorage.setItem("sertz_sfx_vol", String(Math.round(sfxVol * 100)));
  } catch {
    /* 무시 */
  }
}

/** 저장된 볼륨 복원 (createGame 직후 1회 — GameRoot 음소거 복원과 함께) */
export function loadVolumes() {
  try {
    const b = parseInt(window.localStorage.getItem("sertz_bgm_vol") ?? "", 10);
    if (!Number.isNaN(b)) bgmVol = Math.min(1, Math.max(0, b / 100));
    const s = parseInt(window.localStorage.getItem("sertz_sfx_vol") ?? "", 10);
    if (!Number.isNaN(s)) sfxVol = Math.min(1, Math.max(0, s / 100));
  } catch {
    /* 무시 */
  }
}

/* v1.2.2 — 볼륨 미지정 방어.
 *  종전엔 play(key, vol)에서 vol이 undefined면 vol*sfxVol이 NaN이 되고,
 *  Phaser는 NaN을 무시하고 기본값 1(최대)로 재생했다. SFX_VOLUMES에 없는 10개
 *  사운드가 그렇게 "가장 크게" 터지고 있었다 — SFX 편차의 큰 원인. */
const SFX_VOL_DEFAULT = 0.42;

function play(key: string, vol: number, rate = 1) {
  if (!game || muted) return;
  if (!Number.isFinite(vol)) vol = SFX_VOL_DEFAULT;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (lastPlayed[key] && now - lastPlayed[key] < SFX_THROTTLE_MS) return;
  if (activeSounds >= SFX_MAX_CONCURRENT) return;
  lastPlayed[key] = now;
  activeSounds++;
  /* v3.1.0 — SFX 마스터 게인(sfxVol) 배율 적용 (설정 슬라이더 반영) */
  game.sound.play(key, { volume: vol * sfxVol, rate });
  // 1.6초 후 예비 감소 — complete 이벤트 유실 대비 단일 감소 경로 (정확한 캡은 아니어도 밸런스 목적 충분)
  setTimeout(() => {
    activeSounds = Math.max(0, activeSounds - 1);
  }, 1600);
}

export type BGMKind = "field" | "boss" | "title" | "village" | "alfheim" | "cave" | "snow" | "abyss";

/* v1.1.1 — kind 기반 대표곡 (타이틀·훅용). 실제 구역 재생은 stageTrack 담당 */
const THEME_TRACKS: Record<BGMKind, string> = {
  title: "bgm_title",
  village: "bgm_village_village",
  field: "bgm_forest_1",
  alfheim: "bgm_alfheim_1",
  cave: "bgm_cave_1",
  snow: "bgm_niflheim_1",
  abyss: "bgm_abyss_1",
  boss: "bgm_forest_boss",
};

/* v1.1.1 — 자산 목록(E2E 훅·프리로드 참조). 구역별 실제 곡은 STAGE_BGM/VILLAGE_OF/BOSS_OF. */
export const BGM_PLAYLISTS: Record<BGMKind, string[]> = {
  title: ["bgm_title", "bgm_title2"],
  village: ["bgm_village_village", "bgm_village_forest", "bgm_village_kingdom", "bgm_village_alfheim",
            "bgm_village_muspelheim", "bgm_village_niflheim", "bgm_village_cave",
            "bgm_village_nidavellir", "bgm_village_hel", "bgm_village_abyss"],
  field: ["bgm_forest_1", "bgm_forest_2", "bgm_forest_3", "bgm_kingdom_1", "bgm_kingdom_2", "bgm_kingdom_3",
          "bgm_alfheim_1", "bgm_alfheim_2", "bgm_alfheim_3", "bgm_muspelheim_1", "bgm_muspelheim_2", "bgm_muspelheim_3",
          "bgm_niflheim_1", "bgm_niflheim_2", "bgm_niflheim_3", "bgm_cave_1", "bgm_cave_2", "bgm_cave_3",
          "bgm_nidavellir_1", "bgm_nidavellir_2", "bgm_nidavellir_3", "bgm_hel_1", "bgm_hel_2", "bgm_hel_3",
          "bgm_abyss_1", "bgm_abyss_2", "bgm_abyss_3"],
  alfheim: ["bgm_alfheim_1", "bgm_alfheim_2", "bgm_alfheim_3"],
  cave: ["bgm_cave_1", "bgm_cave_2", "bgm_cave_3", "bgm_cave_water"],
  snow: ["bgm_niflheim_1", "bgm_niflheim_2", "bgm_niflheim_3"],
  abyss: ["bgm_hel_1", "bgm_hel_2", "bgm_hel_3", "bgm_abyss_1", "bgm_abyss_2", "bgm_abyss_3"],
  boss: ["bgm_forest_boss", "bgm_kingdom_boss", "bgm_alfheim_boss", "bgm_muspelheim_boss",
         "bgm_niflheim_boss", "bgm_cave_boss", "bgm_nidavellir_boss", "bgm_hel_boss", "bgm_abyss_boss"],
};


/* ================= v1.1.2 — 곡별 RMS 실측 보정 =================
 *  BGM 55슬롯 실측: -21.3 ~ -14.0dB(편차 7.3dB). AI 곡은 테마마다 마스터 레벨이 달라
 *  그대로 쓰면 구역 전환(3스테이지마다 교체)에서 음량이 튄다.
 *  값 = 10^((목표 -16.5dB - 실측RMS)/20), -4 ~ +7dB 클램프. */
const BGM_GAIN_DB: Record<string, number> = {
  bgm_abyss_1: 0.819,   // -1.7dB ← RMS -14.8dB
  bgm_abyss_2: 1.012,   // +0.1dB ← RMS -16.6dB
  bgm_abyss_3: 0.735,   // -2.7dB ← RMS -13.8dB
  bgm_abyss_boss: 0.679,   // -3.4dB ← RMS -13.1dB
  bgm_alfheim_1: 0.769,   // -2.3dB ← RMS -14.2dB
  bgm_alfheim_2: 0.757,   // -2.4dB ← RMS -14.1dB
  bgm_alfheim_3: 1.12,   // +1.0dB ← RMS -17.5dB
  bgm_alfheim_boss: 0.803,   // -1.9dB ← RMS -14.6dB
  bgm_battle: 0.912,   // -0.8dB ← RMS -15.7dB
  bgm_cave_1: 1.061,   // +0.5dB ← RMS -17.0dB
  bgm_cave_2: 0.631,   // -4.0dB ← RMS -12.1dB
  bgm_cave_3: 0.983,   // -0.1dB ← RMS -16.3dB
  bgm_cave_boss: 0.631,   // -4.0dB ← RMS -12.4dB
  bgm_cave_water: 1.118,   // +1.0dB ← RMS -17.5dB
  bgm_forest_1: 1.078,   // +0.7dB ← RMS -17.2dB
  bgm_forest_2: 0.815,   // -1.8dB ← RMS -14.7dB
  bgm_forest_3: 0.744,   // -2.6dB ← RMS -13.9dB
  bgm_forest_boss: 0.803,   // -1.9dB ← RMS -14.6dB
  bgm_hel_1: 0.685,   // -3.3dB ← RMS -13.2dB
  bgm_hel_2: 0.781,   // -2.1dB ← RMS -14.4dB
  bgm_hel_3: 0.654,   // -3.7dB ← RMS -12.8dB
  bgm_hel_boss: 0.875,   // -1.2dB ← RMS -15.3dB
  bgm_interior_home: 0.815,   // -1.8dB ← RMS -14.7dB
  bgm_interior_inn: 0.871,   // -1.2dB ← RMS -15.3dB
  bgm_kingdom_1: 0.82,   // -1.7dB ← RMS -14.8dB
  bgm_kingdom_2: 0.736,   // -2.7dB ← RMS -13.8dB
  bgm_kingdom_3: 0.783,   // -2.1dB ← RMS -14.4dB
  bgm_kingdom_boss: 0.67,   // -3.5dB ← RMS -13.0dB
  bgm_kitchen: 0.813,   // -1.8dB ← RMS -14.7dB
  bgm_lobby: 0.977,   // -0.2dB ← RMS -16.3dB
  bgm_muspelheim_1: 0.781,   // -2.1dB ← RMS -14.4dB
  bgm_muspelheim_2: 0.631,   // -4.0dB ← RMS -12.4dB
  bgm_muspelheim_3: 1.012,   // +0.1dB ← RMS -16.6dB
  bgm_muspelheim_boss: 0.679,   // -3.4dB ← RMS -13.1dB
  bgm_nidavellir_1: 0.631,   // -4.0dB ← RMS -11.3dB
  bgm_nidavellir_2: 0.66,   // -3.6dB ← RMS -12.9dB
  bgm_nidavellir_3: 1.012,   // +0.1dB ← RMS -16.6dB
  bgm_nidavellir_boss: 0.803,   // -1.9dB ← RMS -14.6dB
  bgm_niflheim_1: 0.818,   // -1.7dB ← RMS -14.8dB
  bgm_niflheim_2: 0.631,   // -4.0dB ← RMS -11.8dB
  bgm_niflheim_3: 0.81,   // -1.8dB ← RMS -14.7dB
  bgm_niflheim_boss: 0.803,   // -1.9dB ← RMS -14.6dB
  bgm_shop: 1.0,   // +0.0dB ← RMS -16.5dB
  bgm_title: 0.758,   // -2.4dB ← RMS -14.1dB
  bgm_title2: 0.901,   // -0.9dB ← RMS -15.6dB
  bgm_village_abyss: 0.848,   // -1.4dB ← RMS -15.1dB
  bgm_village_alfheim: 0.77,   // -2.3dB ← RMS -14.2dB
  bgm_village_cave: 0.912,   // -0.8dB ← RMS -15.7dB
  bgm_village_forest: 0.957,   // -0.4dB ← RMS -16.1dB
  bgm_village_hel: 0.961,   // -0.3dB ← RMS -16.2dB
  bgm_village_kingdom: 0.785,   // -2.1dB ← RMS -14.4dB
  bgm_village_muspelheim: 0.631,   // -4.0dB ← RMS -11.5dB
  bgm_village_nidavellir: 0.631,   // -4.0dB ← RMS -11.6dB
  bgm_village_niflheim: 0.785,   // -2.1dB ← RMS -14.4dB
  bgm_village_village: 0.727,   // -2.8dB ← RMS -13.7dB
};
/** 곡별 정규화 게인 (표에 없으면 1.0 — 신규 곡은 보정 없이 원음) */
function bgmGain(key: string): number {
  return BGM_GAIN_DB[key] ?? 1;
}

/** 40트랙 전체 자산 목록 (모든 곡이 구역 배치에 사용됨 — v3.0.24부터 지연 로딩) */
export const BGM_ALL_TRACKS: string[] = Object.values(BGM_PLAYLISTS).flat();
/** v3.0.24 — BootScene 프리로드 BGM: 타이틀 1곡만 (나머지 39곡은 구역 진입 시 지연 로딩) */
export const BGM_PRELOAD_TRACKS: string[] = ["bgm_title"];

/* ================= v3.0.23 — 구역별 고정 BGM 배치표 =================
 * v4.1.3 (#브금빈도) — 유저 지시 "브금 너무 자주 바꾸지 마 (챕터의 테마마다 바꿔)":
 *  기존엔 구역(1~9)마다 챕터 풀의 다른 곡이 순환돼 챕터 안에서 최대 5곡이 갈아엎어졌다.
 *  이제 한 챕터 = 대표 테마곡 1곡 고정. 구역을 이동해도 같은 챕터면 같은 곡이 흐른다.
 *  마을(Xv)·보스 구역(10)·보스 조우 오버라이드는 장소 정체성 곡으로 유지 —
 *  챕터당 전환은 "필드→마을→보스" 2회 수준으로 감소.
 *  풀 배열은 자산 목록(E2E 훅) 참조용으로 유지. */
const CHAPTER_ORDER = ["forest", "kingdom", "alfheim", "muspelheim", "niflheim", "cave", "nidavellir", "hel", "abyss"] as const;

/* ================= v1.1.1 (#스테이지BGM) — 3스테이지마다 교체 =================
 *  유저 지적 2건을 구조로 고친다:
 *   "어두운 마을들에 왜 밝은 분위기의 BGM을 씀?" → 챕터 '정서'를 먼저 정하고 그 정서의
 *     곡만 쓴다. 어두운 챕터(니플헤임·스바르트·니다벨리르·헬·뿌리)에는 느리고 어두운 풀
 *     (underwater/cyber/lofi/investigation/alchemist/forge)만 배정하고 밝은 풀
 *     (lobby/electro/casino/circus/aero/morning/kitchen)은 절대 쓰지 않는다.
 *   "10스테이지 중 3스테이지마다 브금이 바뀌어야지" → 구역 1~3 / 4~6 / 7~9 를 서로 다른
 *     곡으로 나누고, 구역 10(보스)은 전용 전투곡. 즉 한 챕터에서 최대 4곡이 흐른다.
 *  poolOf()는 (챕터, 구간) → 곡 키를 돌려주고, 실패 시 챕터 대표곡으로 폴백한다. */
const STAGE_BGM: Record<string, [string, string, string]> = {
  /* 챕터: [구역1~3, 구역4~6, 구역7~9] */
  forest: ["bgm_forest_1", "bgm_forest_2", "bgm_forest_3"],
  kingdom: ["bgm_kingdom_1", "bgm_kingdom_2", "bgm_kingdom_3"],
  alfheim: ["bgm_alfheim_1", "bgm_alfheim_2", "bgm_alfheim_3"],
  muspelheim: ["bgm_muspelheim_1", "bgm_muspelheim_2", "bgm_muspelheim_3"],
  niflheim: ["bgm_niflheim_1", "bgm_niflheim_2", "bgm_niflheim_3"],
  cave: ["bgm_cave_1", "bgm_cave_2", "bgm_cave_3"],
  nidavellir: ["bgm_nidavellir_1", "bgm_nidavellir_2", "bgm_nidavellir_3"],
  hel: ["bgm_hel_1", "bgm_hel_2", "bgm_hel_3"],
  abyss: ["bgm_abyss_1", "bgm_abyss_2", "bgm_abyss_3"],
};
/** 챕터 대표곡(폴백·목록용) — 구간 배정의 첫 곡 */
const CHAPTER_THEME: Record<string, string> = {
  forest: "bgm_forest_1",
  kingdom: "bgm_kingdom_1",
  alfheim: "bgm_alfheim_1",
  muspelheim: "bgm_muspelheim_1",
  niflheim: "bgm_niflheim_1",
  cave: "bgm_cave_1",
  nidavellir: "bgm_nidavellir_1",
  hel: "bgm_hel_1",
  abyss: "bgm_abyss_1",
};
const VILLAGE_TRACKS = ["bgm_village_forest", "bgm_village_kingdom", "bgm_village_alfheim",
  "bgm_village_muspelheim", "bgm_village_niflheim"];
const VILLAGE_OF: Record<string, string> = {
  /* v1.1.1 — 마을도 챕터 정서를 따른다(지적 2번). 화산 촌락은 대장간 톤, 설원 마을은
   *  차가운 톤, 어둠 요정 마을은 연금술 톤, 저승 마을은 lo-fi 톤 — 밝은 마을곡 금지. */
  village: "bgm_village_village",
  forest: "bgm_village_forest",
  kingdom: "bgm_village_kingdom",
  alfheim: "bgm_village_alfheim",
  muspelheim: "bgm_village_muspelheim",
  niflheim: "bgm_village_niflheim",
  cave: "bgm_village_cave",
  nidavellir: "bgm_village_nidavellir",
  hel: "bgm_village_hel",
  abyss: "bgm_village_abyss",
};
const BOSS_TRACKS = ["bgm_forest_boss", "bgm_kingdom_boss", "bgm_alfheim_boss",
  "bgm_muspelheim_boss", "bgm_niflheim_boss"];
/* v1.1.1 — 챕터별 보스곡. 각 곡은 그 챕터의 정서 풀에서 뽑았다(설원=얼어붙은 결전,
 *  룬 광산=기계적 결전, 저승=죽음의 정적 …). 같은 곡 재사용 없이 9챕터 전부 다르다. */
const BOSS_OF: Record<string, string> = {
  forest: "bgm_forest_boss",
  kingdom: "bgm_kingdom_boss",
  alfheim: "bgm_alfheim_boss",
  muspelheim: "bgm_muspelheim_boss",
  niflheim: "bgm_niflheim_boss",
  cave: "bgm_cave_boss",
  nidavellir: "bgm_nidavellir_boss",
  hel: "bgm_hel_boss",
  abyss: "bgm_abyss_boss",
};
/** 재림 보스 — splitStage("r5")는 ch="r", zone=5/10/15로 파싱된다 */
const REBIRTH_BOSS_OF: Record<number, string> = { 5: "bgm_kingdom_boss", 10: "bgm_hel_boss", 15: "bgm_abyss_boss" };
/** 챕터/재림 공용 보스 트랙 선택 (미지의 챕터 → 첫 보스곡 폴백) */
function bossTrackOfCh(ch: string, zone: number): string {
  if (ch === "r") return REBIRTH_BOSS_OF[zone] ?? BOSS_TRACKS[0];
  return BOSS_OF[ch] ?? BOSS_TRACKS[0];
}
/** 챕터 일반 구역 폴백 (미지의 챕터 키) */
const FALLBACK_TRACKS = [CHAPTER_THEME.forest];

/** 스테이지 키 파싱 — "forest3"→{ch:"forest",zone:3} / "forestv"·"village"→마을 */
function splitStage(stage: string): { ch: string; zone: number; isVillageStage: boolean } {
  if (stage === "village") return { ch: "village", zone: 0, isVillageStage: true };
  if (stage.endsWith("v")) return { ch: stage.slice(0, -1), zone: 0, isVillageStage: true };
  const m = stage.match(/^([a-z]+)(\d+)$/);
  if (m) return { ch: m[1], zone: parseInt(m[2], 10), isVillageStage: false };
  return { ch: stage, zone: 0, isVillageStage: false };
}

/** 구역(1~9) → 구간 인덱스(0/1/2). 3스테이지마다 곡이 바뀐다. */
function zoneSlot(zone: number): 0 | 1 | 2 {
  if (zone <= 3) return 0;
  if (zone <= 6) return 1;
  return 2;
}

function chIndexOf(ch: string): number {
  const i = (CHAPTER_ORDER as readonly string[]).indexOf(ch);
  return i < 0 ? 0 : i;
}

/** 실내/실외 관계없이 스테이지 → 고정 트랙
 *  v1.1.1 — 구역 1~3/4~6/7~9에서 곡이 바뀐다(3스테이지마다 교체). 구역 10은 보스곡. */
export function stageTrack(stage: string): string {
  if (stage === "interior_inn") return "bgm_interior_inn";
  if (stage === "interior_home") return "bgm_interior_home";
  const { ch, zone } = splitStage(stage);
  if (zone === 10) return bossTrackOfCh(ch, zone); // 보스 구역 — 챕터 전용 전투곡
  if (zone <= 0) return VILLAGE_OF[ch] ?? VILLAGE_TRACKS[Math.max(0, chIndexOf(ch)) % VILLAGE_TRACKS.length];
  const slots = STAGE_BGM[ch];
  if (slots) return slots[zoneSlot(zone)];
  return CHAPTER_THEME[ch] ?? FALLBACK_TRACKS[0];
}

/** 보스 조우 중 오버라이드 트랙 (구역 일반곡과 별개 — 전투곡)
 *  v1.4.10 — 챕터별 전용 보스 트랙(BOSS_OF) + 재림 보스(r5/r10/r15) 전용 트랙 */
function bossTrackOf(stage: string): string {
  const { ch, zone } = splitStage(stage);
  return bossTrackOfCh(ch, zone);
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

/* v1.4.8 (#5 BGM) — 크로스페이드 전환: 기존은 하드컷→새 곡 페이드인이어서 구간 전환마다
 *  음악이 뚝 끊겼다. 이제 이전 트랙은 700ms 페이드아웃 후 파괴, 새 트랙은 동시에 페이드인 —
 *  챕터/마을/보스 전환이 자연스럽게 이어진다. (뮤트·백그라운드 정지는 destroyBgm 즉시 경로 유지) */
function retireBgm(ms = 700) {
  clearFadeTimer();
  const old = bgmSound;
  bgmSound = null;
  if (!old) return;
  const snd = asVol(old);
  if (!snd) {
    try { old.stop(); old.destroy(); } catch { /* noop */ }
    return;
  }
  const from = snd.volume ?? bgmVol;
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const timer = setInterval(() => {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const k = Math.min(1, (now - t0) / ms);
    try {
      snd.setVolume(Math.max(0, from * (1 - k)));
      if (k >= 1) {
        clearInterval(timer);
        old.stop();
        old.destroy();
      }
    } catch {
      clearInterval(timer);
    }
  }, 60);
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
  const from = snd.volume ?? bgmVol;
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

/** v3.0.24 — BGM 트랙 지연 로딩: 캐시에 없으면 fetch + decodeAudioData로 등록.
 *  LRU 초과분은 캐시에서 해제해 디코드 PCM(트랙당 ~80-120MB)이 누적되지 않게 한다. */
function touchDecoded(key: string) {
  const i = decodedLru.indexOf(key);
  if (i >= 0) decodedLru.splice(i, 1);
  decodedLru.push(key);
}

function ensureBgmDecoded(key: string): Promise<boolean> {
  if (!game) return Promise.resolve(false);
  if (game.cache.audio.exists(key)) {
    touchDecoded(key);
    return Promise.resolve(true);
  }
  const prev = bgmInflight.get(key);
  if (prev) return prev;
  const p = (async () => {
    try {
      const sm = game!.sound as Phaser.Sound.WebAudioSoundManager;
      const ctx = sm?.context as AudioContext | null;
      if (!ctx) return false;
      const res = await fetch(`${BGM_DIR}/${key}.ogg`);
      if (!res.ok) return false;
      const buf = await res.arrayBuffer();
      const audio = await ctx.decodeAudioData(buf);
      if (!game) return false;
      // LRU 캡 — 현재 트랙은 유지, 오래된 것부터 해제 (순환 방지)
      let guard = 0;
      while (decodedLru.length >= MAX_DECODED_BGM && guard++ < MAX_DECODED_BGM * 2) {
        const old = decodedLru[0];
        if (old === key || old === bgmKey) {
          touchDecoded(old);
          break;
        }
        decodedLru.shift();
        try {
          if (game.cache.audio.exists(old)) game.cache.audio.remove(old);
        } catch {
          /* noop */
        }
      }
      if (!game.cache.audio.exists(key)) game.cache.audio.add(key, audio);
      touchDecoded(key);
      return true;
    } catch {
      return false;
    } finally {
      bgmInflight.delete(key);
    }
  })();
  bgmInflight.set(key, p);
  return p;
}

/** v3.0.24 — 고정 트랙 1곡 무한 루프 재생 (지연 로딩 대응 비동기).
 *  디코드 실패/미완료면 0.5초 간격 재시도 — "게임 시작 직후 음악이 안 나오는" 타이밍 버그 방지 (최대 30회/15초).
 *  await 후 트랙이 바뀌었거나 음소거되면 stale로 무시해 이중 재생을 막는다. */
async function startTrack(key: string, retried = 0) {
  if (!game || muted) return;
  const ok = await ensureBgmDecoded(key);
  if (!ok) {
    if (retried < 30 && bgmKey === key && !bgmSound && !muted && game) {
      window.setTimeout(() => {
        if (bgmKey === key && !bgmSound && !muted) startTrack(key, retried + 1);
      }, 500);
    }
    return;
  }
  if (!game || muted || bgmKey !== key || bgmSound) return; // stale 가드
  try {
    const snd = game.sound.add(key, { loop: true, volume: 0 });
    if (!snd) {
      if (retried < 30 && bgmKey === key && !bgmSound && !muted) {
        window.setTimeout(() => {
          if (bgmKey === key && !bgmSound && !muted) startTrack(key, retried + 1);
        }, 500);
      }
      return;
    }
    bgmSound = snd;
    asVol(bgmSound)?.setVolume(0);
    bgmSound.play();
    /* v1.0.17 — 곡별 정규화 게인 반영 (bgmVol 단독 사용 시 5.3dB 편차가 그대로 노출됨) */
    fadeBgm(trackVolume(), 1200);
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
  retireBgm(); /* v1.4.8 — 크로스페이드 */
  bgmKey = key;
  if (muted || !game) return;
  startTrack(key);
}

/** kind 기반 재생 (타이틀 화면 전용 + E2E 훅) — 테마 대표곡 고정 루프 */
export function playBGM(kind: BGMKind) {
  const key = THEME_TRACKS[kind];
  if (bgmKey === key && bgmSound?.isPlaying) return;
  retireBgm(); /* v1.4.8 — 크로스페이드 */
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
    /* v3.0.24 — 지연 로딩 상태 (디코드 캐시 개수 / LRU 캡) */
    decoded: decodedLru.length,
    decodedMax: MAX_DECODED_BGM,
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
  /* v4.1.7 — 유료 팩 신규 전용음 볼륨 래더 (게임플레이 4종 + UI 4종) */
  sfx_coin: 0.4,
  sfx_potion: 0.42,
  sfx_equip: 0.46,
  sfx_upgrade: 0.52,
  sfx_click: 0.3,
  sfx_open: 0.34,
  sfx_close: 0.3,
  sfx_ach: 0.56,
  /* v1.3.0 (#에셋통합) — 유저 Drive 팩(Vefects) VFX 사운드 래더 */
  sfx_hit_basic: 0.4,
  sfx_arrow_cast: 0.4,
  sfx_arrow_hit: 0.42,
  sfx_bomb_cast: 0.44,
  sfx_bomb_exp: 0.58,
  sfx_fire_cast: 0.46,
  sfx_fire_hit: 0.46,
  sfx_bolt_cast: 0.52,
  sfx_bolt_hit: 0.5,
  sfx_heal_cast: 0.46,
  sfx_buff_cast: 0.44,
  sfx_debuff_cast: 0.46,
  sfx_dash2: 0.34,
  sfx_pickup2: 0.4,
  sfx_explosion: 0.58,
  sfx_explosion_ice: 0.54,
  sfx_aoe_cast: 0.48,
  sfx_aoe_burst: 0.54,
  sfx_smoke: 0.46,
  /* v1.2.2 — 누락 보충: SFX_VOLUMES에 없는데 play()로 호출되던 10개.
   *  종전엔 vol=undefined → NaN → Phaser 기본값 1(최대)로 재생돼 가장 크게 터졌다.
   *  같은 계열(_burst=폭발 / _cast=시전)의 기존 값에 맞춘다. */
  sfx_aoe_crystal_burst: 0.54,
  sfx_aoe_fire_burst: 0.54,
  sfx_aoe_heal_burst: 0.5,
  sfx_aoe_heal_cast: 0.48,
  sfx_aoe_light_burst: 0.54,
  sfx_aoe_light_cast: 0.48,
  sfx_aoe_magma_burst: 0.56,
  sfx_aoe_nature_cast: 0.48,
  sfx_smoke_dark: 0.34,
  sfx_smoke_gold: 0.34,
};

/* ================= v3.0.24 — 직업별 스킬 전용 효과음 =================
 *  유저 지시: "직업별로 스킬마다 효과음 매우 적절히 배치해!!"
 *  출처: 효과음연구소 soundeffect-lab.info (상업 이용 무료 · scripts/sfx-fetch/download_skills.sh)
 *  기존 sfxSpin/sfxSwing 공용이던 스킬 48종(기본공격 4계열 포함)에 각각 정체성 있는 소리 배치.
 *  key → 파일 매핑 (skl_*.ogg 27종) + 볼륨 래더 + pitch 변주로 동일 스킬 반복 시 단조로움 완화 */
const SKILL_SFX_FILES: Record<string, string> = {
  sword: "skl_sword1", // v4.1.9 — 전사 계열 기본공격 참격 (구형 swing 공용 → 전용 검기음)
  sword2: "skl_sword2", // v4.1.9 — 전사 연타 2·3타 (sword1과 교대로 단조로움 완화)
  spin: "sfx_spin", // v4.3.0 — 기본공격음 (회전베기와 스왑: 유저 지시 "회전베기 소리를 기본공격 소리랑 바꿔")
  arrow: "skl_arrow1", // 궁수 활 발사 (기본공격·volley)
  cast: "skl_cast1", // 마법사 지팡이 시전 (기본공격 볼트)
  knife: "skl_knife1", // 도적 단검 (기본공격·bladestorm)
  flame: "sfx_fire_cast", // v1.3.0 — 마법사 대관통 볼트 (Drive 팩 화염 원음)
  electron: "sfx_bolt_cast", // v1.3.0 — 아크메이지 아크 볼트 (Drive 팩 낙뢰 원음)
  arrowpierce: "skl_arrowpierce1", // 스나이퍼 관통 저격
  wind: "skl_wind1", // 윈드러너 회오리 화살 / 템페스트 폭풍의 눈
  wind2: "skl_wind2", // 질풍 계열 (windstep·windslash·cyclone)
  cure: "skl_cure2", // 세이지 정화의 파동
  iainuki: "skl_iainuki1", // 어세신 그림자 참수 (발도)
  swift: "skl_sword3", // 스워시버클러 연타 난무
  quake: "skl_quake1", // 가디언 성벽 강타
  dark: "skl_dark1", // 암흑 계열 (그림자 숨기·칼날·지뢰·군주)
  heavydash: "skl_heavydash1", // 버서커/가디언 중장 돌진
  ambush: "skl_ambush1", // 어세신 암습 돌진
  holy: "sfx_aoe_light_cast", // v1.3.0 — 신성 계열 (Drive 팩 빛 AoE 원음)
  thunder: "sfx_bolt_cast", // v1.3.0 — 스톰브링어 낙뢰 (Drive 팩 낙뢰 원음)
  slowmo: "skl_slowmo1", // 크로니클 시간 왜곡
  rage: "skl_rage1", // 워브링어 피의 격노
  chain: "skl_chain4", // 아크로드 연쇄 번개
  gravity: "skl_gravity1", // 이터널 중력 붕괴
  bigsword: "skl_bigsword1", // 블레이드마스터 파동 검기
  warcry: "skl_warcry1", // 워로드 전장의 함성
  superhit: "skl_superhit1", // 워브링어 종언의 일격
  timestop: "skl_timestop1", // 이터널 영원의 고리 (시간 정지)
  manaburst: "skl_manaburst1", // 아크로드 마나 붕괴
  skyflight: "skl_skyflight1", // 스카이로드 천공의 폭풍
  snipe: "skl_arrowpierce1", // v1.4.8 — 스나이퍼 정밀사격 (키 누락 무음 버그 수정 — 궁수 저격음 공유)
  /* 기존 파일 재사용 별칭 (피치/볼륨 변주로 클래스 차별화) */
  dash2: "sfx_dash", // 전사/스워시버클러 돌진 (highspeed-movement1)
  worp: "sfx_portal", // 마법사 점멸 계열 (magic-worp1)
};
/** BootScene 프리로드용 스킬 SFX 전체 목록 */
export const SKILL_SFX_TRACKS: string[] = Object.values(SKILL_SFX_FILES);
const SKILL_SFX_VOLUMES: Record<string, number> = {
  sword: 0.42, sword2: 0.4, // v4.1.9 — 전사 기본공격 (타격감 우선)
  spin: 0.4, // v4.3.0 — 기본공격음 (회전베기 스왑)
  arrow: 0.4, cast: 0.34, knife: 0.36, flame: 0.46, electron: 0.46,
  arrowpierce: 0.5, wind: 0.44, wind2: 0.42, cure: 0.44, iainuki: 0.48,
  snipe: 0.5, // v1.4.8 — snipe 키 볼륨 누락 보완
  swift: 0.44, quake: 0.54, dark: 0.46, heavydash: 0.48, ambush: 0.44,
  holy: 0.52, thunder: 0.56, slowmo: 0.5, rage: 0.52, chain: 0.52,
  gravity: 0.54, bigsword: 0.52, warcry: 0.56, superhit: 0.6, timestop: 0.56,
  manaburst: 0.52, skyflight: 0.5, dash2: 0.34, worp: 0.46,
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
  /** 골드 픽업 — v4.1.7 유료 팩 전용 코인음 (피치 변주 — 매번 같은 소리 방지) */
  coin() {
    play("sfx_coin", SFX_VOLUMES.sfx_coin, 0.94 + Math.random() * 0.12);
  },
  /** 물약 마심 — v4.1.7 유료 팩 전용 물약음 */
  potion() {
    play("sfx_potion", SFX_VOLUMES.sfx_potion);
  },
  /** 장비 장착 — v4.1.7 유료 팩 전용 갑옷 장착음 (퀘스트 차임 대용 해제) */
  equip() {
    play("sfx_equip", SFX_VOLUMES.sfx_equip);
  },
  /** 크리티컬 명중 — metal_02 고피치 샤프 음 (타격감 강조) */
  crit() {
    play("sfx_hit", 0.42, 1.55 + Math.random() * 0.15);
  },
  /** 강화 성공 — v4.1.7 유료 팩 대장장이 모루음 (무게감 있는 성공음) */
  upgradeOk() {
    play("sfx_upgrade", SFX_VOLUMES.sfx_upgrade);
  },
  /** 강화 실패 — hurt 저피치 (둔탁한 낙방음) */
  upgradeFail() {
    play("sfx_hurt", 0.42, 0.65);
  },
  /** v4.1.7 — 업적 수령 팡파레 (Special Interface) */
  ach() {
    play("sfx_ach", SFX_VOLUMES.sfx_ach);
  },
  /* v4.1.7 — React HUD 패널 개폐 UI음 (유료 팩 Interface/Bag Handle) */
  uiClick() {
    play("sfx_click", SFX_VOLUMES.sfx_click, 1 + Math.random() * 0.06);
  },
  uiOpen() {
    play("sfx_open", SFX_VOLUMES.sfx_open);
  },
  uiClose() {
    play("sfx_close", SFX_VOLUMES.sfx_close);
  },
  /** v3.0.24 — 직업별 스킬 전용 효과음 (SKILL_SFX_FILES 매핑)
   *  @param key 스킬 음향 키 (arrow/cast/knife/flame/wind/dark/holy/thunder 등)
   *  @param rate 피치 배율 — 상위직 강화판은 0.75~1.2 변주로 원판과 구분 */
  skill(key: string, rate = 1) {
    const file = SKILL_SFX_FILES[key];
    if (!file) return;
    play(file, SKILL_SFX_VOLUMES[key] ?? 0.45, rate);
  },
  /* ================= v1.3.0 — 유저 Drive 팩(Vefects) 전용 효과음 =================
   *  유니티 에셋스토어 VFX 팩에 포함된 실제 이펙트 원음 — 전투 타격감/스킬/축하 연출에 배치.
   *  aoeSound는 원소 키 → cast/burst 자동 매핑 (aoeCast/aoeBurst에서 사용) */
  /** 근접 기본공격 명중 — Unity BasicAttack 원음 (피치 변주로 단조로움 완화) */
  basicHit() {
    play("sfx_hit_basic", SFX_VOLUMES.sfx_hit_basic, 0.92 + Math.random() * 0.16);
  },
  /** 화살 발사/명중 */
  arrowCast() {
    play("sfx_arrow_cast", SFX_VOLUMES.sfx_arrow_cast);
  },
  arrowHit() {
    play("sfx_arrow_hit", SFX_VOLUMES.sfx_arrow_hit, 0.94 + Math.random() * 0.12);
  },
  /** 폭발/폭탄 */
  bombExp() {
    play("sfx_bomb_exp", SFX_VOLUMES.sfx_bomb_exp);
  },
  explosion() {
    play("sfx_explosion", SFX_VOLUMES.sfx_explosion);
  },
  /** 화염/번개 스킬 */
  fireCast() {
    play("sfx_fire_cast", SFX_VOLUMES.sfx_fire_cast);
  },
  fireHit() {
    play("sfx_fire_hit", SFX_VOLUMES.sfx_fire_hit, 0.92 + Math.random() * 0.16);
  },
  boltCast() {
    play("sfx_bolt_cast", SFX_VOLUMES.sfx_bolt_cast);
  },
  boltHit() {
    play("sfx_bolt_hit", SFX_VOLUMES.sfx_bolt_hit, 0.92 + Math.random() * 0.16);
  },
  /** 회복/버프/디버프 */
  healCast() {
    play("sfx_heal_cast", SFX_VOLUMES.sfx_heal_cast);
  },
  buffCast() {
    play("sfx_buff_cast", SFX_VOLUMES.sfx_buff_cast);
  },
  debuffCast() {
    play("sfx_debuff_cast", SFX_VOLUMES.sfx_debuff_cast);
  },
  /** 원소 AoE — elem: fire/ice/light/dark/elec/earth/water/poison/void/heal/nature/air/crystal/magma/blood */
  aoeCast(elem: string) {
    const file = AOE_ELEM_FILES[elem];
    if (file) play(`${file}_cast`, SFX_VOLUMES.sfx_aoe_cast);
    else play("sfx_buff_cast", SFX_VOLUMES.sfx_aoe_cast);
  },
  aoeBurst(elem: string) {
    const file = AOE_ELEM_FILES[elem];
    if (file) play(`${file}_burst`, SFX_VOLUMES.sfx_aoe_burst, 0.94 + Math.random() * 0.12);
    else play("sfx_explosion", SFX_VOLUMES.sfx_aoe_burst);
  },
  /** 연막/스팀 연출 */
  smoke(kind: string) {
    const map: Record<string, string> = {
      fire: "sfx_smoke_fire", snow: "sfx_smoke_snow", thunder: "sfx_smoke_thunder",
      toxic: "sfx_smoke_toxic", gold: "sfx_smoke_gold", dark: "sfx_smoke_dark",
    };
    const file = map[kind] ?? "sfx_smoke_fire";
    play(file, SFX_VOLUMES.sfx_smoke);
  },

  /* ================= v1.4.8 (#6 기능별 사운드 분리) =================
   *  유저 지시: "유저가 헷갈리지 않게 기능마다 겹치는 사운드 및 UI&그래픽 없도록 해"
   *  기존엔 sfx_quest(차임) 하나를 상자·상점·보상·출석 등 38개 기능이 공유하고
   *  sfx_coin이 골드 픽업~정산 15곳에 쓰여 "무슨 소리가 무슨 일인지" 구분이 안 됐다.
   *  전부 이미 로드된 Drive 팩 파일을 재할당(다운로드 추가 0)해 기능군별 고유음을 부여한다.
   *  분리 원칙: 획득(코인) / 구매(상점) / 판매(정산) / 충전 / 완료(퀘스트 차임) /
   *  보상(선물 차임) / 상자 / 수락 / 차단(deny) / 제작 / 성장(레벨업) 은 서로 다른 소리 */
  /** 상점·거래소 구매 — 상품 수령 느낌의 밝은 픽업음 (골드 픽업음과 분리) */
  shop() {
    play("sfx_pickup2", 0.44);
  },
  /** 판매·정산 — 아이템이 골드로 바뀌는 금빛 연막 후속 (구매음과도 분리) */
  sell() {
    play("sfx_smoke_gold", 0.5);
  },
  /** 충전·티켓·스토어·구독 — 빛이 모이는 시전음 (재화음과 분리) */
  charge() {
    play("sfx_aoe_light_cast", 0.5);
  },
  /** 상자 개봉 — 수정이 깨지는 개방음 (퀘스트 차임에서 완전 분리) */
  chest() {
    play("sfx_aoe_crystal_burst", 0.5, 0.94 + Math.random() * 0.12);
  },
  /** 보상 수령(광고/출석/쿠폰/패스/미션/도감) — 밝은 힐링 차임 (퀘스트 완료음과 분리) */
  reward() {
    play("sfx_aoe_heal_burst", 0.5, 0.96 + Math.random() * 0.1);
  },
  /** 퀘스트/시련 수락 — 자연 기운 약속음 (완료 차임과 분리) */
  questAccept() {
    play("sfx_aoe_nature_cast", 0.46);
  },
  /** 차단·부족·실패 공용 부정 피드백 (게이트 차단/한도 초과/재료 부족 — open·bossdie 재활용 해제) */
  deny() {
    play("sfx_debuff_cast", 0.5, 0.9);
  },
  /** 제작 성공 — 용광로 폭발음 (코인음과 분리) */
  craft() {
    play("sfx_aoe_fire_burst", 0.5);
  },
  /** 횃불 점화 — 용암 위화감 점화음 (포탈음 재활용 해제) */
  torch() {
    play("sfx_aoe_magma_burst", 0.4, 1.1);
  },
  /** 보스 드롭 스폰 — 빛 폭발 (포효음 재활용 해제 — 보스 등장과 구분) */
  bossDrop() {
    play("sfx_aoe_light_burst", 0.5);
  },
  /** 전투 상태음(수비전 카드 회복 등) — 회복 시전 (코인음 재활용 해제) */
  cardHeal() {
    play("sfx_aoe_heal_cast", 0.46);
  },
  /** 플레이어 사망 — 어두운 연막 붕괴음 (사망 무음 해소) */
  playerDie() {
    play("sfx_smoke_dark", 0.55, 0.85);
  },
  /* ═══ vc180 (지시: 제공 에셋 활용) — Sonniss GDC 2026 선별 10종 ═══
   *  기존 효과음은 대부분 합성/피치변주였는데, 이 팩은 실제 녹음이라
   *  괴수·금속·환경음의 질감이 다르다. 남용하면 시끄러우므로 호출부에서 확률을 건다. */
  /** 괴수 등장/포효 — 보스·정예 스폰 */
  beastGrowl() { play("mob_beast_growl", 0.5, 0.9 + Math.random() * 0.15); },
  /** 괴수 피격 — 일반 몹 피격음 대체(낮은 확률) */
  beastPain() { play("mob_beast_pain", 0.34, 0.95 + Math.random() * 0.1); },
  /** 수중/점액 몹 — 늪지·수중 구역 전용 */
  beastGurgle() { play("mob_beast_gurgle", 0.32, 0.9 + Math.random() * 0.15); },
  /** 곤충형 몹 공격 */
  insectAttack() { play("mob_insect_attack", 0.34, 1.0); },
  /** 금속 타격 — 방어구 피격·강화 실패 */
  metalHit() { play("metal_hit_low", 0.42, 1.0 + Math.random() * 0.08); },
  /** 금속 신음 — 장비 강화 성공/파괴 연출 */
  metalScreech() { play("metal_screech", 0.4, 1.0); },
  /** 금속 긁힘 — 스크래치/연마 */
  metalScrape() { play("metal_scrape", 0.36, 1.05); },
  /** 플레이어 기합 — 스킬 발동(낮은 확률로 얹어 생동감) */
  playerEffort() { play("pc_effort", 0.26, 0.95 + Math.random() * 0.1); },
};

/** v1.3.0 — 원소 → Drive 팩 AoE 사운드 파일 접두 매핑 */
const AOE_ELEM_FILES: Record<string, string> = {
  fire: "sfx_aoe_fire", ice: "sfx_aoe_ice", light: "sfx_aoe_light", dark: "sfx_aoe_dark",
  elec: "sfx_aoe_elec", earth: "sfx_aoe_earth", water: "sfx_aoe_water", poison: "sfx_aoe_poison",
  void: "sfx_aoe_void", heal: "sfx_aoe_heal", nature: "sfx_aoe_nature", crystal: "sfx_aoe_crystal",
  magma: "sfx_aoe_magma", blood: "sfx_aoe_blood", air: "sfx_aoe_air",
};
/** 원소 표기 정규화 (electron→elec, holy→light, storm→elec, flame→fire, frost→ice 등) */
export function normalizeElem(e: string): string {
  const s = (e ?? "").toLowerCase();
  if (s === "electron" || s === "storm" || s === "thunder") return "elec";
  if (s === "holy" || s === "light") return "light";
  if (s === "flame" || s === "fire") return "fire";
  if (s === "frost" || s === "ice") return "ice";
  return AOE_ELEM_FILES[s] ? s : "";
}
