/**
 * 챕터 진입 스토리 컷씬 — v1.4.41
 *
 * 유저 지시: "스토리 진행마다 필요한 대화 및 연출 컷씬"
 *
 * 왜 데이터로 두나
 * ----------------
 * 컷씬을 챕터마다 코드로 흩뿌리면 19개 챕터 × 진입/비트로 관리가 불가능해진다.
 * 연출은 **데이터(샷 목록)**로, 실행은 StoryCutscene.ts 한 곳에서 한다.
 *
 * 구도 규칙
 * ---------
 *  ① 첫 샷은 화면 위쪽(ry <= 0.30) — 지평선·수관·천장에서 시작해 공간을 먼저 보여준다
 *  ② 중간 샷은 좌우로 훑어 넓이를 인지시킨다
 *  ③ 마지막 샷은 아래쪽(ry >= 0.70) + 진행 방향 — 복귀 팬이 자연스럽게 이어진다
 *
 * 좌표는 **0~1 비율**이라 맵 크기가 달라도 같은 구도가 나온다.
 * 대사는 data.ts 의 DIALOGUES 키(`chapterIntro_<챕터>`)로 연결된다.
 * 키가 없으면 대사 없이 카메라 연출만 재생된다(안전).
 */

export type ChapterIntroShot = {
  /** 월드 좌표 비율 (0~1) — 맵 크기에 맞춰 환산한다 */
  rx: number;
  ry: number;
  /** Prefer real map landmarks over a ratio when the scene supplies them. */
  focus?: "entry" | "feature" | "player";
  panMs?: number;
  holdMs?: number;
  zoom?: number;
  /** DIALOGUES 키 */
  dialogue?: string;
};

type IntroLandmarks = {
  width: number;
  height: number;
  entry: { x: number; y: number };
  feature: { x: number; y: number };
  player: { x: number; y: number };
};

export function resolveChapterIntroShots(spec: ChapterIntroSpec, landmarks: IntroLandmarks) {
  return spec.shots.map(({ rx, ry, focus, ...shot }) => ({
    ...shot,
    x: focus ? landmarks[focus].x : rx * landmarks.width,
    y: focus ? landmarks[focus].y : ry * landmarks.height,
  }));
}

export type ChapterIntroSpec = {
  /** 이 연출을 처음 진입 때 한 번만 볼지 */
  once?: boolean;
  shots: ChapterIntroShot[];
};

/**
 * 챕터별 진입 연출. 챕터마다 팬 속도·줌을 달리해 "또 같은 연출"로 읽히지 않게 한다.
 */
export const CHAPTER_INTROS: Record<string, ChapterIntroSpec> = {
  forest: {
    once: true,
    shots: [
      { rx: 0.5, ry: 0.18, panMs: 900, holdMs: 900, zoom: 0.92 }, // 수관
      { rx: 0.5, ry: 0.62, panMs: 800, holdMs: 700 }, // 신전
      { rx: 0.5, ry: 0.78, panMs: 600, holdMs: 500, dialogue: "chapterIntro_forest" },
    ],
  },
  kingdom: {
    once: true,
    shots: [
      { rx: 0.24, ry: 0.28, panMs: 850, holdMs: 800, zoom: 0.95 }, // 좌측 항구
      { rx: 0.76, ry: 0.3, panMs: 900, holdMs: 800 }, // 우측 성벽
      { rx: 0.5, ry: 0.72, panMs: 700, holdMs: 500, dialogue: "chapterIntro_kingdom" },
    ],
  },
  alfheim: {
    once: true,
    shots: [
      { rx: 0.5, ry: 0.22, panMs: 1000, holdMs: 900, zoom: 0.9 },
      { rx: 0.35, ry: 0.5, panMs: 800, holdMs: 700 },
      { rx: 0.5, ry: 0.75, panMs: 650, holdMs: 500, dialogue: "chapterIntro_alfheim" },
    ],
  },
  muspelheim: {
    once: true,
    shots: [
      { rx: 0.5, ry: 0.2, panMs: 950, holdMs: 850, zoom: 0.88 }, // 화산 상단
      { rx: 0.62, ry: 0.48, panMs: 750, holdMs: 650 },
      { rx: 0.5, ry: 0.76, panMs: 650, holdMs: 500, dialogue: "chapterIntro_muspelheim" },
    ],
  },
  niflheim: {
    once: true,
    shots: [
      { rx: 0.42, ry: 0.24, panMs: 900, holdMs: 800, zoom: 0.93 }, // 설원
      { rx: 0.3, ry: 0.52, panMs: 850, holdMs: 700 },
      { rx: 0.5, ry: 0.78, panMs: 650, holdMs: 500, dialogue: "chapterIntro_niflheim" },
    ],
  },
  cave: {
    once: true,
    shots: [
      { rx: 0.5, ry: 0.3, panMs: 800, holdMs: 700, zoom: 1.05 }, // 좁은 동굴 — 당겨서 압박
      { rx: 0.5, ry: 0.6, panMs: 700, holdMs: 600 },
      { rx: 0.5, ry: 0.8, panMs: 600, holdMs: 450, dialogue: "chapterIntro_cave" },
    ],
  },
  nidavellir: {
    once: true,
    shots: [
      { rx: 0.3, ry: 0.26, panMs: 900, holdMs: 800, zoom: 0.92 }, // 대장간
      { rx: 0.7, ry: 0.34, panMs: 900, holdMs: 750 },
      { rx: 0.5, ry: 0.74, panMs: 650, holdMs: 500, dialogue: "chapterIntro_nidavellir" },
    ],
  },
  hel: {
    once: true,
    shots: [
      { rx: 0.5, ry: 0.18, panMs: 1000, holdMs: 950, zoom: 0.87 }, // 낙하감
      { rx: 0.5, ry: 0.5, panMs: 900, holdMs: 800 },
      { rx: 0.5, ry: 0.78, panMs: 700, holdMs: 550, dialogue: "chapterIntro_hel" },
    ],
  },
  abyss: {
    once: true,
    shots: [
      { rx: 0.5, ry: 0.16, panMs: 1100, holdMs: 1000, zoom: 0.85 }, // 가장 웅장하게
      { rx: 0.28, ry: 0.44, panMs: 950, holdMs: 800 },
      { rx: 0.72, ry: 0.44, panMs: 950, holdMs: 800 },
      { rx: 0.5, ry: 0.76, panMs: 800, holdMs: 600, dialogue: "chapterIntro_abyss" },
    ],
  },
  /* ── DLC 1~10 — 그랜드플래닛 원정. 도시마다 다른 시선 리듬 ── */
  dlcstargate: {
    once: true,
    shots: [
      { rx: 0.5, ry: 0.2, panMs: 1000, holdMs: 900, zoom: 0.9 },
      { rx: 0.5, ry: 0.55, panMs: 900, holdMs: 800 },
      { rx: 0.5, ry: 0.78, panMs: 700, holdMs: 500, dialogue: "chapterIntro_dlcstargate" },
    ],
  },
  dlcprisma: {
    once: true,
    shots: [
      { rx: 0.5, ry: 0.22, panMs: 950, holdMs: 850, zoom: 0.92 },
      { rx: 0.34, ry: 0.5, panMs: 850, holdMs: 700 },
      { rx: 0.5, ry: 0.76, panMs: 650, holdMs: 500, dialogue: "chapterIntro_dlcprisma" },
    ],
  },
  dlcocean: {
    once: true,
    shots: [
      { rx: 0.5, ry: 0.18, panMs: 1100, holdMs: 950, zoom: 0.88 }, // 수평선
      { rx: 0.2, ry: 0.42, panMs: 950, holdMs: 800 },
      { rx: 0.8, ry: 0.42, panMs: 950, holdMs: 800 },
      { rx: 0.5, ry: 0.78, panMs: 750, holdMs: 550, dialogue: "chapterIntro_dlcocean" },
    ],
  },
  dlcreverse: {
    once: true,
    shots: [
      { rx: 0.5, ry: 0.24, panMs: 850, holdMs: 800, zoom: 1.02 }, // 지하선로 — 당겨서 압박
      { rx: 0.3, ry: 0.48, panMs: 780, holdMs: 680 },
      { rx: 0.5, ry: 0.76, panMs: 620, holdMs: 480, dialogue: "chapterIntro_dlcreverse" },
    ],
  },
  dlcneocity: {
    once: true,
    shots: [
      { rx: 0.5, ry: 0.2, panMs: 920, holdMs: 860, zoom: 0.9 }, // 마천루 스카이라인
      { rx: 0.72, ry: 0.44, panMs: 860, holdMs: 720 },
      { rx: 0.5, ry: 0.77, panMs: 680, holdMs: 520, dialogue: "chapterIntro_dlcneocity" },
    ],
  },
  dlcmech: {
    once: true,
    shots: [
      { rx: 0.5, ry: 0.26, panMs: 800, holdMs: 740, zoom: 0.95 }, // 기계 무덤 — 낮게 훑는다
      { rx: 0.28, ry: 0.5, panMs: 820, holdMs: 700 },
      { rx: 0.5, ry: 0.79, panMs: 640, holdMs: 500, dialogue: "chapterIntro_dlcmech" },
    ],
  },
  dlcswallow: {
    once: true,
    shots: [
      { rx: 0.5, ry: 0.18, panMs: 1000, holdMs: 900, zoom: 0.89 }, // 하늘을 나는 섬
      { rx: 0.24, ry: 0.46, panMs: 900, holdMs: 760 },
      { rx: 0.5, ry: 0.78, panMs: 700, holdMs: 540, dialogue: "chapterIntro_dlcswallow" },
    ],
  },
  dlcopinicia: {
    once: true,
    shots: [
      { rx: 0.5, ry: 0.22, panMs: 880, holdMs: 820, zoom: 0.93 }, // 성채
      { rx: 0.66, ry: 0.46, panMs: 840, holdMs: 700 },
      { rx: 0.5, ry: 0.75, panMs: 660, holdMs: 500, dialogue: "chapterIntro_dlcopinicia" },
    ],
  },
  dlcnovel: {
    once: true,
    shots: [
      { rx: 0.5, ry: 0.25, panMs: 860, holdMs: 780, zoom: 1.0 }, // 기록의 도시 — 정적인 리듬
      { rx: 0.34, ry: 0.52, panMs: 800, holdMs: 700 },
      { rx: 0.5, ry: 0.77, panMs: 640, holdMs: 500, dialogue: "chapterIntro_dlcnovel" },
    ],
  },
  dlcsernium: {
    once: true,
    shots: [
      { rx: 0.5, ry: 0.14, panMs: 1200, holdMs: 1000, zoom: 0.82 }, // 최종 — 가장 웅장하게
      { rx: 0.24, ry: 0.42, panMs: 1000, holdMs: 860 },
      { rx: 0.76, ry: 0.42, panMs: 1000, holdMs: 860 },
      { rx: 0.5, ry: 0.74, panMs: 820, holdMs: 600, dialogue: "chapterIntro_dlcsernium" },
    ],
  },
};

/** Route direction and long/close shots vary across the 15 real chapters. */
export const HOWLRSTONE_INTROS: Record<string, ChapterIntroSpec> = Object.fromEntries(
  Array.from({ length: 15 }, (_, index) => [`howlrstone${index + 1}`, {
    once: true,
    shots: [
      { rx: 0.25, ry: 0.5, focus: "entry", zoom: 0.9, panMs: 420, holdMs: 180 },
      { rx: 0.7, ry: 0.5, focus: "feature", zoom: index % 3 === 0 ? 0.78 : 0.85, panMs: 900 + index % 3 * 140, holdMs: 300 },
      { rx: 0.7, ry: 0.5, focus: "feature", zoom: 1.25, panMs: 520, holdMs: 500 },
      { rx: 0.25, ry: 0.5, focus: "player", zoom: 1, panMs: 480, holdMs: 80 },
    ],
  }]),
);

/** 챕터 키로 진입 연출 조회. 없으면 null (연출 생략 — 안전) */
export function chapterIntroOf(key: string | null | undefined): ChapterIntroSpec | null {
  if (!key) return null;
  return HOWLRSTONE_INTROS[key] ?? CHAPTER_INTROS[key] ?? null;
}

/* ══════════════════════════════════════════════════════════════════════════
 * vc237 — 구역(sub-stage) 단위 컷씬
 *
 * 왜
 *   지금 컷씬은 챕터 인트로(sub 1)와 보스 인트로에만 있다. 서브 2~9 는 대사만 있고
 *   카메라 연출이 없어서 "걷다가 갑자기 글자"가 된다. 구역마다 짧은 연출을 하나씩
 *   두면 진행감이 생긴다.
 *
 * 무엇을 넣지 않았나 (YAGNI)
 *   · 152개 구역 전부에 손으로 연출을 쓰지 않는다. 구역 성격별 **4가지 템플릿**만
 *     정의하고, 구역 인덱스로 결정론적으로 배정한다. 손으로 쓴 것은 정예/보스 직전
 *     같은 서사적으로 중요한 지점뿐이다.
 *   · 새 컷씬 엔진/플레이어를 만들지 않는다 — CHAPTER_INTROS 와 **같은 ChapterIntroSpec**
 *     을 쓴다. WorldScene 이 이미 resolveChapterIntroShots + playStoryCutscene 로
 *     재생하는 경로가 있으므로, 호출부만 늘리면 된다.
 *
 * once 규칙
 *   기본 once:true — cutsceneSeen 에 키를 넣어 1회만 재생한다(기존 규칙과 동일).
 *   키는 `stage:<챕터>:<구역>` 형식이라 챕터 인트로 키(`forest` 등)와 절대 겹치지 않는다.
 *   ponytail: 구역 연출은 전부 1회 시청으로 둔다. 반복 재생이 필요해지면 once:false 로
 *   바꾸고 cutsceneSeen 키에서 구역을 빼면 된다(스키마 변경 불필요).
 * ══════════════════════════════════════════════════════════════════════════ */

/** 구역 성격 — 어떤 템플릿을 쓸지 정한다. */
export type StageBeat = "sweep" | "descend" | "narrow" | "rise";

/**
 * 구역 성격 판정 (결정론). 챕터 구역 수와 구역 번호만 본다.
 *  · sub 5  = 정예 직전 → narrow (좁게 조여 긴장)
 *  · sub 9  = 보스 직전 → descend (아래로 내려가며 각오)
 *  · 그 외  = sweep / rise 를 구역 인덱스로 교대
 */
export function stageBeatOf(ch: string, sub: number): StageBeat {
  if (sub === 5) return "narrow";
  if (sub === 9) return "descend";
  if (sub === 1) return "rise";
  return (sub + ch.length) % 2 === 0 ? "sweep" : "rise";
}

/** 성격별 샷 템플릿. 좌표는 0~1 비율(맵 크기 무관 — 기존 규칙과 동일). */
const BEAT_SHOTS: Record<StageBeat, ChapterIntroShot[]> = {
  /* sweep — 좌우로 훑어 구역의 넓이를 보여준다 */
  sweep: [
    { rx: 0.28, ry: 0.34, panMs: 620, holdMs: 240 },
    { rx: 0.72, ry: 0.4, panMs: 680, holdMs: 240 },
  ],
  /* descend — 위에서 아래로. 보스 직전의 무게 */
  descend: [
    { rx: 0.5, ry: 0.2, panMs: 720, holdMs: 260, zoom: 0.9 },
    { rx: 0.5, ry: 0.66, panMs: 640, holdMs: 300, zoom: 0.96 },
  ],
  /* narrow — 정예 직전. 당겨서 압박 */
  narrow: [
    { rx: 0.5, ry: 0.36, panMs: 560, holdMs: 260, zoom: 1.06 },
    { rx: 0.5, ry: 0.56, panMs: 480, holdMs: 300, zoom: 1.12 },
  ],
  /* rise — 지면에서 위로 훑어 방향을 잡는다 */
  rise: [
    { rx: 0.5, ry: 0.62, panMs: 580, holdMs: 240 },
    { rx: 0.5, ry: 0.26, panMs: 660, holdMs: 260, zoom: 0.94 },
  ],
};

/**
 * 특정 (챕터, 구역)에 **손으로 쓴** 연출. 템플릿보다 먼저 조회된다.
 * 서사적으로 중요한 지점만 넣는다 — 나머지는 템플릿이 담당.
 * shots 의 dialogue 는 DIALOGUES 키. stageIntro 키를 넣으면 그 구역 대사가 연출과 함께 나온다.
 */
export const STAGE_INTROS: Record<string, ChapterIntroSpec> = {
  /* 하루가 라일락의 펜던트를 처음 되돌려주는 구역 — 챕터4(정원)의 정예 직전.
   *  정원을 훑은 뒤 좁혀 들어가며 경고를 띄운다(2샷 이상 — 단샷 연출은 리듬이 없다). */
  "alfheim:5": {
    once: true,
    shots: [
      { rx: 0.32, ry: 0.34, panMs: 640, holdMs: 260, zoom: 0.92 },
      { rx: 0.5, ry: 0.2, panMs: 900, holdMs: 420, zoom: 0.86, dialogue: "eliteWarn4" },
    ],
  },
  /* 영프 편 — 해롤드(크라켄) 직전. 바다가 통째로 검게 물드는 장면 */
  "howlrstone3:5": {
    once: true,
    shots: [
      { rx: 0.24, ry: 0.5, focus: "entry", panMs: 520, holdMs: 260, zoom: 0.86 },
      { rx: 0.72, ry: 0.48, focus: "feature", panMs: 980, holdMs: 380, zoom: 0.8, dialogue: "howlEliteWarn3" },
    ],
  },
  /* 최종장 직전 — 가장 웅장하게 */
  "dlcsernium:9": {
    once: true,
    shots: [
      { rx: 0.5, ry: 0.14, panMs: 1100, holdMs: 420, zoom: 0.84 },
      { rx: 0.5, ry: 0.72, panMs: 820, holdMs: 360, zoom: 0.92, dialogue: "bossApproach20" },
    ],
  },
};

/**
 * (챕터, 구역) 진입 연출 조회. 없으면 null.
 *
 * 반환되는 spec 은 CHAPTER_INTROS 와 **같은 타입**이라 기존
 * `resolveChapterIntroShots(spec, landmarks)` + `playStoryCutscene` 경로에 그대로 꽂힌다.
 * 구역 1(챕터 인트로)과 10(보스)은 null — 그쪽은 chapterIntroOf/bossIntroCinematic 이 담당한다.
 */
export function stageIntroOf(ch: string | null | undefined, sub: number): ChapterIntroSpec | null {
  if (!ch || sub < 2 || sub > 9) return null;
  const hand = STAGE_INTROS[`${ch}:${sub}`];
  if (hand) return hand;
  return { once: true, shots: BEAT_SHOTS[stageBeatOf(ch, sub)] };
}

/**
 * cutsceneSeen 에 넣을 1회 시청 키. WorldScene 이 이 헬퍼를 써야 챕터 키와 안 겹친다.
 * (챕터 인트로는 챕터 키 그대로 `forest` 를 쓰므로 여기선 반드시 접두어가 필요하다.)
 */
export function stageIntroSeenKey(ch: string, sub: number): string {
  return `stage:${ch}:${sub}`;
}
