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
  panMs?: number;
  holdMs?: number;
  zoom?: number;
  /** DIALOGUES 키 */
  dialogue?: string;
};

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

/** 챕터 키로 진입 연출 조회. 없으면 null (연출 생략 — 안전) */
export function chapterIntroOf(key: string | null | undefined): ChapterIntroSpec | null {
  if (!key) return null;
  return CHAPTER_INTROS[key] ?? null;
}
