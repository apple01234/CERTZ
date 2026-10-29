/**
 * 챕터 진입 스토리 컷씬 — v1.4.41
 *
 * 유저 지시: "스토리 진행마다 필요한 대화 및 연출 컷씬"
 *
 * 왜 데이터로 두나
 * ----------------
 * 컷씬을 챕터마다 코드로 흩뿌리면 9개(+DLC) 챕터 × 진입/비트로 관리가 불가능해진다.
 * 연출은 **데이터(샷 목록)**로, 실행은 StoryCutscene.ts 한 곳에서 한다.
 *
 * 샷이 비출 대상
 * --------------
 * 챕터 진입 시엔 아직 보스가 없을 수 있으므로 **월드 기준점**을 비춘다:
 *   · 입구(플레이어 스폰)에서 멀리 — 챕터의 상징 지점
 *   · 맵 크기 대비 비율로 잡아 맵 크기가 달라도 같은 구도가 나오게 한다
 *
 * 대사 키가 없으면 대사 없이 카메라 연출만 재생된다(안전).
 * 여기 적힌 dialogue 는 data.ts DIALOGUES 의 키이며, 존재하지 않으면
 * showDialogueOnce 가 false 를 돌려주고 연출은 계속된다.
 */

export type ChapterIntroShot = {
  /** 월드 좌표 비율 (0~1) — 맵 크기에 맞춰 환산한다 */
  rx: number;
  ry: number;
  panMs?: number;
  holdMs?: number;
  zoom?: number;
  dialogue?: string;
};

export type ChapterIntroSpec = {
  /** 이 연출을 처음 진입 때 한 번만 볼지 */
  once?: boolean;
  shots: ChapterIntroShot[];
};

/**
 * 챕터별 진입 연출.
 *  구도 원칙: ① 위에서 아래로(지평선 → 발치) ② 좌우로 훑어 공간을 인지시킨다
 *  ③ 마지막 샷은 플레이어 진행 방향(안쪽) — 복귀 팬이 자연스럽게 이어진다.
 */
export const CHAPTER_INTROS: Record<string, ChapterIntroSpec> = {
  forest: {
    once: true,
    shots: [
      { rx: 0.5, ry: 0.18, panMs: 900, holdMs: 900, zoom: 0.92 },   // 수관(위에서)
      { rx: 0.5, ry: 0.62, panMs: 800, holdMs: 700 },                // 신전 쪽
      { rx: 0.5, ry: 0.78, panMs: 600, holdMs: 500 },                // 발치 → 복귀 유도
    ],
  },
  kingdom: {
    once: true,
    shots: [
      { rx: 0.24, ry: 0.28, panMs: 850, holdMs: 800, zoom: 0.95 },   // 좌측 항구
      { rx: 0.76, ry: 0.30, panMs: 900, holdMs: 800 },               // 우측 성벽(훑기)
      { rx: 0.5, ry: 0.72, panMs: 700, holdMs: 500 },
    ],
  },
  alfheim: {
    once: true,
    shots: [
      { rx: 0.5, ry: 0.22, panMs: 1000, holdMs: 900, zoom: 0.9 },
      { rx: 0.35, ry: 0.5, panMs: 800, holdMs: 700 },
      { rx: 0.5, ry: 0.75, panMs: 650, holdMs: 500 },
    ],
  },
  muspelheim: {
    once: true,
    shots: [
      { rx: 0.5, ry: 0.20, panMs: 950, holdMs: 850, zoom: 0.88 },   // 화산 상단
      { rx: 0.62, ry: 0.48, panMs: 750, holdMs: 650 },
      { rx: 0.5, ry: 0.76, panMs: 650, holdMs: 500 },
    ],
  },
  niflheim: {
    once: true,
    shots: [
      { rx: 0.42, ry: 0.24, panMs: 900, holdMs: 800, zoom: 0.93 },  // 설원
      { rx: 0.30, ry: 0.52, panMs: 850, holdMs: 700 },
      { rx: 0.5, ry: 0.78, panMs: 650, holdMs: 500 },
    ],
  },
  cave: {
    once: true,
    shots: [
      { rx: 0.5, ry: 0.30, panMs: 800, holdMs: 700, zoom: 1.05 },   // 좁은 동굴 — 살짝 당겨 답답함
      { rx: 0.5, ry: 0.60, panMs: 700, holdMs: 600 },
      { rx: 0.5, ry: 0.80, panMs: 600, holdMs: 450 },
    ],
  },
  nidavellir: {
    once: true,
    shots: [
      { rx: 0.3, ry: 0.26, panMs: 900, holdMs: 800, zoom: 0.92 },   // 대장간
      { rx: 0.7, ry: 0.34, panMs: 900, holdMs: 750 },
      { rx: 0.5, ry: 0.74, panMs: 650, holdMs: 500 },
    ],
  },
  hel: {
    once: true,
    shots: [
      { rx: 0.5, ry: 0.18, panMs: 1000, holdMs: 950, zoom: 0.87 },  // 지하 세계의 낙하감
      { rx: 0.5, ry: 0.50, panMs: 900, holdMs: 800 },
      { rx: 0.5, ry: 0.78, panMs: 700, holdMs: 550 },
    ],
  },
  abyss: {
    once: true,
    shots: [
      { rx: 0.5, ry: 0.16, panMs: 1100, holdMs: 1000, zoom: 0.85 }, // 뿌리 끝 — 가장 웅장하게
      { rx: 0.28, ry: 0.44, panMs: 950, holdMs: 800 },
      { rx: 0.72, ry: 0.44, panMs: 950, holdMs: 800 },
      { rx: 0.5, ry: 0.76, panMs: 800, holdMs: 600 },
    ],
  },
  /* ── DLC 3챕터 — 세계구 구원 이후의 이야기. 회귀가 아닌 '새 출발' 연출 ── */
  dlcstargate: {
    once: true,
    shots: [
      { rx: 0.5, ry: 0.20, panMs: 1000, holdMs: 900, zoom: 0.9 },
      { rx: 0.5, ry: 0.55, panMs: 900, holdMs: 800 },
      { rx: 0.5, ry: 0.78, panMs: 700, holdMs: 500 },
    ],
  },
  dlcprisma: {
    once: true,
    shots: [
      { rx: 0.5, ry: 0.22, panMs: 950, holdMs: 850, zoom: 0.92 },
      { rx: 0.34, ry: 0.50, panMs: 850, holdMs: 700 },
      { rx: 0.5, ry: 0.76, panMs: 650, holdMs: 500 },
    ],
  },
  dlcocean: {
    once: true,
    shots: [
      { rx: 0.5, ry: 0.18, panMs: 1100, holdMs: 950, zoom: 0.88 },  // 수평선
      { rx: 0.2, ry: 0.42, panMs: 950, holdMs: 800 },
      { rx: 0.8, ry: 0.42, panMs: 950, holdMs: 800 },
      { rx: 0.5, ry: 0.78, panMs: 750, holdMs: 550 },
    ],
  },
  /* ── DLC 4~10 — 그랜드플래닛 원정. 도시마다 다른 시선 리듬으로 구분한다 ──
   *  같은 3샷이라도 팬 속도·줌을 달리해 "또 같은 연출"로 읽히지 않게 한다. */
  dlcreverse: {
    once: true,
    shots: [
      { rx: 0.5, ry: 0.24, panMs: 850, holdMs: 800, zoom: 1.02 },   // 지하선로 — 살짝 당겨 압박
      { rx: 0.3, ry: 0.48, panMs: 780, holdMs: 680 },
      { rx: 0.5, ry: 0.76, panMs: 620, holdMs: 480 },
    ],
  },
  dlcneocity: {
    once: true,
    shots: [
      { rx: 0.5, ry: 0.20, panMs: 920, holdMs: 860, zoom: 0.90 },   // 마천루 스카이라인
      { rx: 0.72, ry: 0.44, panMs: 860, holdMs: 720 },
      { rx: 0.5, ry: 0.77, panMs: 680, holdMs: 520 },
    ],
  },
  dlcmech: {
    once: true,
    shots: [
      { rx: 0.5, ry: 0.26, panMs: 800, holdMs: 740, zoom: 0.95 },   // 기계 무덤 — 낮게 훑는다
      { rx: 0.28, ry: 0.50, panMs: 820, holdMs: 700 },
      { rx: 0.5, ry: 0.79, panMs: 640, holdMs: 500 },
    ],
  },
  dlcswallow: {
    once: true,
    shots: [
      { rx: 0.5, ry: 0.18, panMs: 1000, holdMs: 900, zoom: 0.89 },  // 하늘을 나는 섬
      { rx: 0.24, ry: 0.46, panMs: 900, holdMs: 760 },
      { rx: 0.5, ry: 0.78, panMs: 700, holdMs: 540 },
    ],
  },
  dlcopinicia: {
    once: true,
    shots: [
      { rx: 0.5, ry: 0.22, panMs: 880, holdMs: 820, zoom: 0.93 },   // 성채
      { rx: 0.66, ry: 0.46, panMs: 840, holdMs: 700 },
      { rx: 0.5, ry: 0.75, panMs: 660, holdMs: 500 },
    ],
  },
  dlcnovel: {
    once: true,
    shots: [
      { rx: 0.5, ry: 0.25, panMs: 860, holdMs: 780, zoom: 1.0 },    // 기록의 도시 — 정적인 리듬
      { rx: 0.34, ry: 0.52, panMs: 800, holdMs: 700 },
      { rx: 0.5, ry: 0.77, panMs: 640, holdMs: 500 },
    ],
  },
  dlcsernium: {
    once: true,
    shots: [
      { rx: 0.5, ry: 0.14, panMs: 1200, holdMs: 1000, zoom: 0.82 }, // 최종 — 가장 웅장하게
      { rx: 0.24, ry: 0.42, panMs: 1000, holdMs: 860 },
      { rx: 0.76, ry: 0.42, panMs: 1000, holdMs: 860 },
      { rx: 0.5, ry: 0.74, panMs: 820, holdMs: 600 },
    ],
  },
};

/** 챕터 키로 진입 연출 조회. 없으면 null (연출 생략 — 안전) */
export function chapterIntroOf(key: string | null | undefined): ChapterIntroSpec | null {
  if (!key) return null;
  return CHAPTER_INTROS[key] ?? null;
}
