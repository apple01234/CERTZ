/**
 * 라일락 월드 프롤로그(세 왕국 이야기, 2.txt 비트 1) 컷씬과 대사.
 * 장별 장면은 lilacScenarios.ts, 장 인트로 대사는 data.ts 가 맡는다.
 *
 * 구도 규칙(기존 CHAPTER_INTROS 와 동일)
 *   ① 첫 샷은 위쪽(ry <= 0.30) — 하늘·지붕·수관에서 시작해 공간을 먼저 보여준다
 *   ② 중간 샷은 좌우로 훑어 넓이를 인지시킨다
 *   ③ 마지막 샷은 아래쪽(ry >= 0.70) + 진행 방향 — 복귀 팬이 자연스럽게 이어진다
 *
 * 좌표는 0~1 비율이라 맵 크기와 무관하다.
 * 대사는 LILAC_DIALOGUES 키로 연결된다.
 */

export type LilacShot = {
  rx: number;
  ry: number;
  panMs?: number;
  holdMs?: number;
  zoom?: number;
  /** LILAC_DIALOGUES 키 */
  dialogue?: string;
  /** 화면 전체를 덮는 색조 (hex) — 장면 전환 강조 */
  tint?: string;
};

export type LilacIntroSpec = { once?: boolean; shots: LilacShot[] };

export const LILAC_INTROS: Record<string, LilacIntroSpec> = {
  lilac00: {
    once: true,
    shots: [
      { rx: 0.5, ry: 0.16, panMs: 1100, holdMs: 1100, zoom: 0.86, dialogue: "lilac00_open" },
      { rx: 0.22, ry: 0.34, panMs: 900, holdMs: 800, zoom: 0.94 },       // 북쪽
      { rx: 0.5,  ry: 0.42, panMs: 850, holdMs: 700 },                    // 중부
      { rx: 0.78, ry: 0.46, panMs: 900, holdMs: 700 },                    // 남쪽
      { rx: 0.5,  ry: 0.58, panMs: 1000, holdMs: 900, tint: "#2a0d0d", dialogue: "lilac00_war" },
      { rx: 0.5,  ry: 0.78, panMs: 700, holdMs: 600, dialogue: "lilac00_close" },
    ],
  },
};

export const LILAC_DIALOGUES: Record<string, { speaker: string; lines: string[] }> = {
  lilac00_open: {
    speaker: "이야기꾼",
    lines: [
      "아주 오래전, 이 세상에는 세 개의 왕국이 있었다.",
      "북쪽은 얼음, 중부는 사계절, 남쪽은 바다와 산.",
      "세 왕국은 오래 평화로웠다. 적어도, 그 소문이 돌기 전까지는.",
    ],
  },
  lilac00_war: {
    speaker: "이야기꾼",
    lines: [
      "인피니트보석. 가진 자에게 무한한 모든 것을 준다는 보석.",
      "전쟁은 보석을 가진 자가 아니라, 가질 수 있다고 믿는 자들 사이에서 일어났다.",
      "그리고 전쟁이 길어지자, 세계가 대답했다.",
    ],
  },
  lilac00_close: {
    speaker: "이야기꾼",
    lines: [
      "수호자들이 보석을 빛과 어둠으로 갈랐다.",
      "그리고 다음에도 같은 일이 일어나지 않도록, 자신들의 힘을 후대에 전수했다.",
      "그렇게 웨폰마스터가 생겼다.",
      "열쇠가 열쇠 구멍에 꽂혔다. 아무도 그것이 열쇠인 줄 몰랐다.",
    ],
  },
};
