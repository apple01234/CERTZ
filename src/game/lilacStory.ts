/**
 * 영준프린세스 1기 — 라일락 월드: 컷씬 연출 + NPC 대사
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

/* ─────────────────────────── 챕터 인트로 ─────────────────────────── */
export const LILAC_INTROS: Record<string, LilacIntroSpec> = {
  /* 0화 — 프롤로그: 세 왕국의 지도 위에서 시작 */
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

  /* 1화 — 전설의 시작: 왕립도서관 */
  lilac01: {
    once: true,
    shots: [
      { rx: 0.5,  ry: 0.14, panMs: 1000, holdMs: 900, zoom: 0.9 },       // 높은 서가 천장
      { rx: 0.28, ry: 0.38, panMs: 800, holdMs: 700 },
      { rx: 0.68, ry: 0.44, panMs: 850, holdMs: 700 },
      { rx: 0.5,  ry: 0.74, panMs: 700, holdMs: 600, dialogue: "lilac01_open" },
    ],
  },

  /* 2화 — 어둠이 커지기 시작했을 때: 물 위의 왕국 */
  lilac02: {
    once: true,
    shots: [
      { rx: 0.5,  ry: 0.18, panMs: 1000, holdMs: 950, zoom: 0.88, dialogue: "lilac02_open" },
      { rx: 0.24, ry: 0.46, panMs: 850, holdMs: 700 },                    // 항구
      { rx: 0.74, ry: 0.5,  panMs: 900, holdMs: 700 },                    // 성벽
      { rx: 0.5,  ry: 0.76, panMs: 700, holdMs: 650, tint: "#3a0a0a", dialogue: "lilac02_close" },
    ],
  },

  /* 3화 — 시작된 전쟁: 성이 전함으로 변하는 순간 */
  lilac03: {
    once: true,
    shots: [
      { rx: 0.5,  ry: 0.2,  panMs: 900, holdMs: 800, zoom: 0.92, dialogue: "lilac03_open" },
      { rx: 0.3,  ry: 0.44, panMs: 750, holdMs: 600 },
      { rx: 0.7,  ry: 0.5,  panMs: 800, holdMs: 700, tint: "#4a1010" },   // 전투 긴장
      { rx: 0.5,  ry: 0.72, panMs: 800, holdMs: 700, dialogue: "lilac03_close" },
    ],
  },

  /* 4화 — 석양으로 물든 바다: 에벤트 */
  lilac04: {
    once: true,
    shots: [
      { rx: 0.5,  ry: 0.16, panMs: 1000, holdMs: 950, zoom: 0.9, tint: "#3a1d05", dialogue: "lilac04_open" },
      { rx: 0.26, ry: 0.42, panMs: 800, holdMs: 700 },
      { rx: 0.72, ry: 0.48, panMs: 850, holdMs: 700 },
      { rx: 0.5,  ry: 0.75, panMs: 700, holdMs: 600, dialogue: "lilac04_close" },
    ],
  },

  /* 5화 — 협상 그리고 연합: 조선시대 산길 */
  lilac05: {
    once: true,
    shots: [
      { rx: 0.5,  ry: 0.15, panMs: 1000, holdMs: 900, zoom: 0.88 },       // 봉우리와 안개
      { rx: 0.3,  ry: 0.4,  panMs: 850, holdMs: 700 },
      { rx: 0.7,  ry: 0.46, panMs: 850, holdMs: 700 },
      { rx: 0.5,  ry: 0.73, panMs: 750, holdMs: 650, dialogue: "lilac05_open" },
    ],
  },

  /* 6화 — 초월자: 루시의 고백 */
  lilac06: {
    once: true,
    shots: [
      { rx: 0.5,  ry: 0.17, panMs: 950, holdMs: 900, zoom: 0.92, dialogue: "lilac06_open" },
      { rx: 0.34, ry: 0.45, panMs: 800, holdMs: 700, tint: "#12081c" },   // 어두워지는 빛
      { rx: 0.66, ry: 0.5,  panMs: 800, holdMs: 700 },
      { rx: 0.5,  ry: 0.76, panMs: 700, holdMs: 650, dialogue: "lilac06_close" },
    ],
  },

  /* 7화 — 군단장들과의 전투: 세 방면 분할 */
  lilac07: {
    once: true,
    shots: [
      { rx: 0.5,  ry: 0.18, panMs: 900, holdMs: 800, zoom: 0.9, dialogue: "lilac07_open" },
      { rx: 0.22, ry: 0.44, panMs: 800, holdMs: 650 },                    // 에스테반
      { rx: 0.5,  ry: 0.48, panMs: 800, holdMs: 650 },                    // 영프
      { rx: 0.78, ry: 0.46, panMs: 800, holdMs: 700 },                    // 조선
      { rx: 0.5,  ry: 0.74, panMs: 750, holdMs: 650, dialogue: "lilac07_close" },
    ],
  },

  /* 8화 — 두 전사의 격전: 검의 내부로 */
  lilac08: {
    once: true,
    shots: [
      { rx: 0.5,  ry: 0.16, panMs: 1000, holdMs: 900, zoom: 0.88, dialogue: "lilac08_open" },
      { rx: 0.3,  ry: 0.4,  panMs: 800, holdMs: 700, tint: "#1a0a1a" },
      { rx: 0.7,  ry: 0.46, panMs: 800, holdMs: 700 },
      { rx: 0.5,  ry: 0.72, panMs: 800, holdMs: 700, dialogue: "lilac08_close" },
    ],
  },

  /* 9화 — 과거의 향기: 라일락 꽃밭 (따뜻한 회상) */
  lilac09: {
    once: true,
    shots: [
      { rx: 0.5,  ry: 0.2,  panMs: 1100, holdMs: 1000, zoom: 0.86, tint: "#2a1524", dialogue: "lilac09_open" },
      { rx: 0.32, ry: 0.46, panMs: 900, holdMs: 800 },
      { rx: 0.68, ry: 0.5,  panMs: 900, holdMs: 800 },
      { rx: 0.5,  ry: 0.74, panMs: 800, holdMs: 700, dialogue: "lilac09_close" },
    ],
  },

  /* 10화 — 어둠의 성채: 네 개의 문 */
  lilac10: {
    once: true,
    shots: [
      { rx: 0.5,  ry: 0.14, panMs: 1000, holdMs: 950, zoom: 0.84, tint: "#0d0716", dialogue: "lilac10_open" },
      { rx: 0.25, ry: 0.4,  panMs: 800, holdMs: 700 },
      { rx: 0.42, ry: 0.46, panMs: 750, holdMs: 600 },
      { rx: 0.6,  ry: 0.48, panMs: 750, holdMs: 600 },
      { rx: 0.78, ry: 0.44, panMs: 800, holdMs: 700 },
      { rx: 0.5,  ry: 0.76, panMs: 800, holdMs: 700, dialogue: "lilac10_close" },
    ],
  },

  /* 11화 — 어둠의 왕좌: 아이온과 알다바오트 */
  lilac11: {
    once: true,
    shots: [
      { rx: 0.5,  ry: 0.12, panMs: 1100, holdMs: 1000, zoom: 0.8, tint: "#0a0612", dialogue: "lilac11_open" },
      { rx: 0.34, ry: 0.42, panMs: 850, holdMs: 750 },
      { rx: 0.66, ry: 0.46, panMs: 850, holdMs: 750 },
      { rx: 0.5,  ry: 0.78, panMs: 800, holdMs: 700, dialogue: "lilac11_close" },
    ],
  },

  /* 12화 — 운명: 여섯이 남다 */
  lilac12: {
    once: true,
    shots: [
      { rx: 0.5,  ry: 0.16, panMs: 950, holdMs: 850, zoom: 0.9, tint: "#100718", dialogue: "lilac12_open" },
      { rx: 0.38, ry: 0.44, panMs: 800, holdMs: 700 },
      { rx: 0.62, ry: 0.48, panMs: 800, holdMs: 700 },
      { rx: 0.5,  ry: 0.75, panMs: 700, holdMs: 650, dialogue: "lilac12_close" },
    ],
  },

  /* 13화 — 최후의 일격: 각성 */
  lilac13: {
    once: true,
    shots: [
      { rx: 0.5,  ry: 0.18, panMs: 950, holdMs: 850, zoom: 0.88, dialogue: "lilac13_open" },
      { rx: 0.5,  ry: 0.35, panMs: 900, holdMs: 900, zoom: 0.72, tint: "#4a2a05" },  // 태양의 표식
      { rx: 0.44, ry: 0.5,  panMs: 800, holdMs: 700 },
      { rx: 0.5,  ry: 0.78, panMs: 800, holdMs: 750, dialogue: "lilac13_close" },
    ],
  },

  /* 14화 — THE END TIME: 완전체 */
  lilac14: {
    once: true,
    shots: [
      { rx: 0.5,  ry: 0.1,  panMs: 1200, holdMs: 1100, zoom: 0.78, tint: "#08040c", dialogue: "lilac14_open" },
      { rx: 0.3,  ry: 0.36, panMs: 850, holdMs: 700 },
      { rx: 0.7,  ry: 0.42, panMs: 850, holdMs: 700 },
      { rx: 0.5,  ry: 0.62, panMs: 900, holdMs: 800, tint: "#1a0000" },   // 세계가 반쯤 삼켜짐
      { rx: 0.5,  ry: 0.8,  panMs: 800, holdMs: 750, dialogue: "lilac14_close" },
    ],
  },

  /* 15화 — 마지막: 복원된 세계 */
  lilac15: {
    once: true,
    shots: [
      { rx: 0.5,  ry: 0.18, panMs: 1100, holdMs: 1000, zoom: 0.9, dialogue: "lilac15_open" },
      { rx: 0.28, ry: 0.42, panMs: 900, holdMs: 800 },                    // 재건된 왕국
      { rx: 0.72, ry: 0.44, panMs: 900, holdMs: 800 },
      { rx: 0.5,  ry: 0.56, panMs: 850, holdMs: 750, dialogue: "lilac15_mid" },
      { rx: 0.5,  ry: 0.8,  panMs: 1000, holdMs: 900, zoom: 0.82, dialogue: "lilac15_close" },
    ],
  },
};

/* ─────────────────────────── 대사 ───────────────────────────
 * 화자: player 는 "{name}" 치환(플레이어 이름)
 */
export const LILAC_DIALOGUES: Record<string, { speaker: string; lines: string[] }> = {
  /* ===== 0화 ===== */
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
      "「인피니트보석」 — 가진 자에게 무한한 모든 것을 준다는 보석.",
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

  /* ===== 1화 ===== */
  lilac01_open: {
    speaker: "스칼렛",
    lines: [
      "…또 없네.",
      "왜 세 왕국이 전쟁을 했는지, 왜 우리 왕국이 하늘에 떠 있는지.",
      "그런 건 아무도 안 알려줘요.",
    ],
  },
  lilac01_book: {
    speaker: "스칼렛",
    lines: [
      "『웨폰마스터를 위한 정리서』?",
      "순력, 혼력, 자력… 되는 것은 강함의 역순이네.",
    ],
  },
  lilac01_margin: {
    speaker: "스칼렛",
    lines: [
      "여백에 다른 필체가 있어.",
      "— 세계는 균형을 지키는 자가 필요하다. 그러나 균형을 지키는 자가 균형을 알지는 못한다.",
      "…그럼 누가 알죠?",
    ],
  },

  /* ===== 2화 ===== */
  lilac02_open: {
    speaker: "아덴",
    lines: [
      "폐하, 에스테반은 평화와 부의 상징입니다.",
      "흐름은 결국 한 곳으로 모입니다. 지금 그 흐름이 우리에게 오고 있습니다.",
    ],
  },
  lilac02_sunset: {
    speaker: "아덴",
    lines: [
      "에벤트 왕국에서 서신이 왔습니다.",
      "— 어젯밤 꿈을 꿨는데, 마치 석양이 바다를 집어 삼키는 듯한 모습이었습니다.",
      "…무슨 뜻이죠?",
    ],
  },
  lilac02_close: {
    speaker: "카르텔",
    lines: [
      "그녀가 오기만을 기다렸다.",
      "오늘은 유난히 화창한 날이군.",
    ],
  },

  /* ===== 3화 ===== */
  lilac03_open: {
    speaker: "스칼렛",
    lines: [
      "순순히 땅을 내놓으면 학살은 면하겠다.",
    ],
  },
  lilac03_reply: {
    speaker: "카르텔",
    lines: [
      "우린 각오가 다 되어 있다.",
      "함께 맞서 싸우자!",
    ],
  },
  lilac03_kraken: {
    speaker: "해롤드",
    lines: [
      "네 주인은 어디 갔나? 도망간 거겠지.",
      "…내 주인?",
    ],
  },
  lilac03_close: {
    speaker: "아덴",
    lines: [
      "폐하, 저건 웨폰마스터의 힘이 아닙니다.",
      "여기서 에벤트 왕국으로 갈 수 있는 이동석입니다!",
    ],
  },

  /* ===== 4화 ===== */
  lilac04_open: {
    speaker: "아리",
    lines: [
      "지금 움직이시면 위험합니다.",
      "아, 소개를 깜빡했군요. 저는 근위대장, 아리스텔라 데스티니입니다.",
      "아리라고 불러주세요.",
    ],
  },
  lilac04_rian: {
    speaker: "리안",
    lines: [
      "카르텔 국왕. 이야기는 들었습니다.",
      "다음 타깃이 조선시대 왕국이라면, 우리가 먼저 움직여야 합니다.",
    ],
  },
  lilac04_close: {
    speaker: "아리",
    lines: [
      "도사를 찾고 계십니까?",
      "그분은 지금 마을에서 의뢰를 받으며 지내고 계십니다.",
    ],
  },

  /* ===== 5화 ===== */
  lilac05_open: {
    speaker: "란",
    lines: [
      "그림이 아니라, 그리는 마음이 사람을 살립니다.",
      "물감이 마음을 옮기니까요.",
    ],
  },
  lilac05_ari: {
    speaker: "아리",
    lines: [
      "…그런 건 처음 듣습니다.",
    ],
  },
  lilac05_ran: {
    speaker: "란",
    lines: [
      "그럼 오늘부터 들으시면 됩니다.",
    ],
  },
  lilac05_dokkaebi: {
    speaker: "도깨비",
    lines: [
      "지나가는 값을 치러라!",
    ],
  },
  lilac05_sound: {
    speaker: "도사",
    lines: [
      "협상을 가시는 길인가.",
      "그럼 가십시오. 이 길에 도깨비는 이제 없습니다.",
    ],
  },
  lilac05_union: {
    speaker: "리안",
    lines: [
      "오랜만이군요.",
      "— 그래.",
      "다섯 왕국의 이름을 적고, 최후를 막은 뒤에는 모두 연합의 일원이라고 서명합시다.",
    ],
  },
  lilac05_close: {
    speaker: "루시",
    lines: [
      "오랜만이야.",
      "그런데 하나 물어봐도 될까.",
      "네가 지금 가진 그 표정은, 누구의 표정이야?",
    ],
  },

  /* ===== 6화 ===== */
  lilac06_open: {
    speaker: "루시",
    lines: [
      "다들 '왜 여기 있는 거지', '왜 이제 온 거지' 하고 궁금해 하겠지.",
      "내가 설명해주지.",
    ],
  },
  lilac06_fall: {
    speaker: "루시",
    lines: [
      "스칼렛이, 빛의 초월자가 어둠의 힘을 얻은 거야.",
      "빛은 어둠이 조금만이라도 있으면 타락하거든.",
      "이유는 한 가지뿐이야. 유인당한 거야.",
    ],
  },
  lilac06_plan: {
    speaker: "루시",
    lines: [
      "다크니스와 라이트를 다시 융합시켜.",
      "그다음 숙주를 버리고, 인피니트보석으로 또 다른 강자를 이용해서 세계를 숙주로 삼으려 하지.",
      "스칼렛은 지금 숙주야. 그리고 곧 사용된 숙주가 될 거고.",
    ],
  },
  lilac06_sword: {
    speaker: "루시",
    lines: [
      "네가 잃어버렸다던 솔라플레임이그니션소드도 찾았어.",
      "그런데 소드를 가진 자가 소드를 잃을 때, 소드는 주인을 기억하지 못해.",
      "다시 만나야 해. 그 전까지는 아무것도 아니야.",
    ],
  },
  lilac06_letter: {
    speaker: "루시",
    lines: [
      "— 어둠의 왕좌가 도래하기까지 시간이 얼마 남지 않았다.",
      "— 지금 우리 쪽으로 오는 자는 살려 주겠다. 대신에 나머지는 전부 죽음이다.",
      "— 스칼렛.",
    ],
  },
  lilac06_close: {
    speaker: "아리",
    lines: [
      "우리는 이미 각오를 다했어요.",
      "여기 있는 모두. 아니, 이 라일락 월드에 있는 모든 사람은요.",
    ],
  },

  /* ===== 7화 ===== */
  lilac07_open: {
    speaker: "카르텔",
    lines: [
      "각 왕국에 배치된 군단장들을 먼저 쓰러트려야 한다.",
      "수월하게 해치우기 위해서 조를 짜서 싸우기로 했다.",
    ],
  },
  lilac07_ari: {
    speaker: "아리",
    lines: [
      "나는?",
      "— 너는 남는다.",
      "— …네?",
      "— 에벤트를 지켜야지. 우리가 다 나가면 왕국이 비잖아.",
    ],
  },
  lilac07_joseon: {
    speaker: "리안",
    lines: [
      "딘을 잘 처리할 수 있지?",
    ],
  },
  lilac07_ihyeon: {
    speaker: "이현",
    lines: [
      "3분 뒤에 보시죠.",
    ],
  },
  lilac07_close: {
    speaker: "이현",
    lines: [
      "도깨비신의 공격.",
      "화려하게 제압해냈다. 그리고 연결했다.",
      "— 그리고 에벤트 왕국에서는 위험이 도래하는데.",
    ],
  },

  /* ===== 8화 ===== */
  lilac08_open: {
    speaker: "해설",
    lines: [
      "그 시각, 한편 에벤트 왕국에서는 두 전사의 격돌이 이어지고 있었다.",
      "페르온은 원래 에벤트 왕국의 기사단장이었다. 그리고 아리는 근위대장이었다.",
    ],
  },
  lilac08_past: {
    speaker: "해설",
    lines: [
      "페르온과 사귀고 있던 그녀가, 자신의 눈앞에서 죽었다.",
      "자신이 조금만 더 강했더라면, 떨어진 낙석을 부술 수 있었기 때문이다.",
    ],
  },
  lilac08_cave: {
    speaker: "해설",
    lines: [
      "동굴 안에 보석이 있었다. 그의 앞을 막아선 것은 검은 드래곤이었다.",
      "죽은 그녀가 환상처럼 보였다. 그의 몸이 보석 쪽으로 이끌렸다.",
    ],
  },
  lilac08_guardian: {
    speaker: "수호신",
    lines: [
      "밀리고 있구나.",
      "— 네, 저는 검의 힘을 사용하지 못하나 봐요.",
      "아리야, 명심하거라. 너는 검의 힘이 아니라 빛의 힘이다.",
      "참고로 빛의 힘은… 힘… 이… 다.",
    ],
  },
  lilac08_close: {
    speaker: "아리",
    lines: [
      "흰 턱수염에 간달프 같이 생겼지만… 옛날에 배웠던 역사 시간에 있던,",
      "솔라 데스티니 1세.",
      "제 먼 조상이었어요.",
    ],
  },

  /* ===== 9화 ===== */
  lilac09_open: {
    speaker: "라일락",
    lines: [
      "제가 있었던 시간 동안 모두에게 추억이 되었다면, 전 그걸로 충분해요.",
      "아리 언니.",
      "페르온 씨.",
      "죄송해요. 그리고… 사랑해요.",
    ],
  },
  lilac09_name: {
    speaker: "페르온",
    lines: [
      "아직 이름이 없었지.",
      "라일락이라고 하자.",
      "꽃말이 추억이라서. 너의 이름을 부르는 사람마다 추억이 되라고.",
    ],
  },
  lilac09_sunset: {
    speaker: "해설",
    lines: [
      "과거의 향기는 라일락 꽃밭보다 진하다는 게 맞았군…",
      "이 힘도 곧 흡수 당하겠지. 그릇이 되지 않은 자에게 많은 것을 주면, 넘쳐 흘러내려버린다…",
    ],
  },
  lilac09_close: {
    speaker: "페르온",
    lines: [
      "추억에 계속 잠겨 있으면 앞으로 나아가지 못해.",
      "어둠의 왕좌로 가는 길은 내가 잘 알아. 나도 돕지.",
    ],
  },

  /* ===== 10화 ===== */
  lilac10_open: {
    speaker: "해설",
    lines: [
      "연합은 어둠의 성채에 도착했다.",
      "스칼렛이 셀 수 없을 정도로 많은 자신의 군대를 만들어냈다.",
    ],
  },
  lilac10_wall: {
    speaker: "해설",
    lines: [
      "주요 인물들은 큰 벽에 막혔다.",
      "4개의 문을 클리어해야만 스칼렛이 있는 어둠의 왕좌로 갈 수 있다.",
    ],
  },
  lilac10_close: {
    speaker: "루시",
    lines: [
      "길이 끊겼어.",
      "— 걷는 것밖에 없다고 생각했지만…",
      "— 란. 그림 열기구를 만들 수 있지?",
      "— 물감이 마음을 옮기니까요.",
    ],
  },

  /* ===== 11화 ===== */
  lilac11_open: {
    speaker: "루시",
    lines: [
      "이건… 보석이 아니야.",
      "보석이 스스로 만든 것이야.",
      "라이트와 다크니스가 형체를 가진 것 — 아이온과 알다바오트.",
    ],
  },
  lilac11_curse: {
    speaker: "베로니카",
    lines: [
      "이건… 내 힘이 나가고 있어.",
      "— 버텨!",
    ],
  },
  lilac11_scarlet: {
    speaker: "스칼렛",
    lines: [
      "왔구나.",
      "인피니트보석의 힘뿐만이 아니야. 피의 힘과 진정한 어둠의 힘.",
      "군단장들의 힘, 분신들의 힘, 그리고 초월자의 힘까지.",
    ],
  },
  lilac11_close: {
    speaker: "해설",
    lines: [
      "스칼렛은 쓰러졌다.",
      "끝난 줄 알았다.",
      "하지만 스칼렛은 자신의 창조물과 저주 표식이 있는 자들의 힘까지 손에 넣었다.",
    ],
  },

  /* ===== 12화 ===== */
  lilac12_open: {
    speaker: "해설",
    lines: [
      "시간이 흐를수록 외부 상황은 좋아졌다.",
      "하지만 내부 상황은 최악으로 변해갔다.",
    ],
  },
  lilac12_six: {
    speaker: "리안",
    lines: [
      "이제… 여섯이야.",
      "— 아니. 여섯이면 충분해.",
    ],
  },
  lilac12_barrier: {
    speaker: "제르",
    lines: [
      "가세요!",
      "이건 우리가 할 수 있는 일이에요!",
    ],
  },
  lilac12_scarlet: {
    speaker: "스칼렛",
    lines: [
      "사실 너의 여동생은… 원래 내가 키우고 있었지.",
      "그러던 어느 날, 다시 고향으로 돌아가야 한다더군.",
      "난 그 아이를 돌려보내줬어. 그 아이는 이곳이 아닌 자신의 고향으로 가는 게 맞다고 생각했거든.",
    ],
  },
  lilac12_close: {
    speaker: "스칼렛",
    lines: [
      "10개월이 지나고, 난 무한의 탑에 갔어.",
      "그곳에서 다크니스를 찾았어. 그리고 이 힘을 손에 넣었지…",
      "— 정신차려, 스칼렛! 그 보석은 널 잠식한 뒤에 네 몸을 가지고 세상을 지배할 거라고!",
    ],
  },

  /* ===== 13화 ===== */
  lilac13_open: {
    speaker: "스칼렛",
    lines: [
      "점점 목이 조여져 오듯이 힘들더군.",
      "그러곤 무한의 탑에서 난 깨달았지. 남은 라이트 보석은 보석이 아닌 나라고.",
      "— 그런 일은 일어날 수 없어.",
    ],
  },
  lilac13_light: {
    speaker: "스칼렛",
    lines: [
      "보석의 힘을 흡수할수록 빛이 점점 힘을 잃어가더니, 내 몸 안에서 사라졌지.",
      "그러곤 그 빛이 라이트 보석으로 형상화된 거야.",
    ],
  },
  lilac13_guardian: {
    speaker: "수호신",
    lines: [
      "데스티니에서 '운명'은 행운이었지. 너도 그 피를 조금이나마 받았을 것이다.",
      "운명은 운명이 아니야. 운명은 모든 계획 중 일부일 뿐이다.",
    ],
  },
  lilac13_awaken: {
    speaker: "아리",
    lines: [
      "스칼렛이 초월자라면… 나도일 수 있어.",
      "라일락 월드에 있는 모든 자의 염원이 이 검에 새겨 들었다.",
      "웨폰어빌리티 — 태양의 불꽃, 검의 수호자.",
    ],
  },
  lilac13_close: {
    speaker: "해설",
    lines: [
      "자욱한 연기가 사라지자, 스칼렛은 쓰러졌다.",
      "드디어 승리하고 이 모든 것이 끝난 줄로만 알았던 그때.",
    ],
  },

  /* ===== 14화 ===== */
  lilac14_open: {
    speaker: "스칼렛",
    lines: [
      "내가 이것만으로 끝날 것이라고 생각하는 거야?",
    ],
  },
  lilac14_time: {
    speaker: "스칼렛",
    lines: [
      "너 같은 도사가 신급에 초월자를 막을 수 있을 거라고 생각하나?",
      "시간의 초월자는 어디에서 놀기만 하고 있나 보군… 세계가 멸망하는 것을 그 눈앞에 보여주면 어떨까.",
    ],
  },
  lilac14_ihyeon: {
    speaker: "도사",
    lines: [
      "되도록이면 능력을 안 쓰려고 했는데…",
      "— 잠깐, 너 이쪽 세계 사람 아니지? 그것도 완전히 다른 세계.",
      "예리하긴 하네. 그럼 슬슬 끝내볼까?",
    ],
  },
  lilac14_reason: {
    speaker: "스칼렛",
    lines: [
      "왜 이런 힘이 있는데도 나타나지 않은 거지?",
      "— 다른 세계로 가면 적응하는 기간이 있어야지, 힘을 사용할 수 있거든.",
      "— 지금도 한 4단계 극초반도 안 되는 힘이 있는 거야.",
    ],
  },
  lilac14_close: {
    speaker: "도사",
    lines: [
      "그럴 필요 없어.",
      "예전에 영웅들도 이 결말을 예측했기에, 모든 것은 운명이 인도하는 대로였을 뿐이야.",
      "그리고 시간과 생명과 빛이 있는 한, 다시 돌리면 돼.",
    ],
  },

  /* ===== 15화 ===== */
  lilac15_open: {
    speaker: "해설",
    lines: [
      "라일락 월드에 스칼렛이 파괴한 모든 것들이 돌아왔다.",
      "하지만 완전히 리셋되지 않은 것들도 있었다.",
      "보석의 힘과 각자의 힘, 그리고 무수히 많은 시간과 추억들.",
    ],
  },
  lilac15_mid: {
    speaker: "리안",
    lines: [
      "가장 중요한 것은 라일락 연합의 탄생이었습니다.",
      "완전히 5왕국이 서로 싸우지 않고, 연합의 임무로 파견될 수 있도록.",
    ],
  },
  lilac15_close: {
    speaker: "정리서의 주인",
    lines: [
      "세계는 균형을 지키는 자가 필요하다. 그러나 균형을 지키는 자가 균형을 알지는 못한다.",
      "이제 알겠나? 균형을 알지 못하는 자가 균형을 지키는 이유를.",
      "— 모르겠습니다.",
      "그럼 계속 가라. 그것이 2기의 문이다.",
    ],
  },

  /* ===== NPC (필드 안내) — 챕터별 힌트 ===== */
  lilacNpc_lilac00: {
    speaker: "연대기 기록관",
    lines: [
      "프롤로그는 이야기의 뼈대만 보여준다. 지도가 세 번 갈라지는 지점을 봐.",
      "북쪽은 얼음이 녹아 바다가 되고, 중부는 하늘로 올라갔지.",
      "그게 이 세계가 전쟁에 대답한 방식이야.",
    ],
  },
  lilacNpc_lilac01: {
    speaker: "사서",
    lines: [
      "세 번째 서가에는 그런 게 없습니다.",
      "찾는 게 있다면, 아무도 들어가지 않는 방을 보세요. 저는 열쇠를 잃어버렸지만요.",
    ],
  },
  lilacNpc_lilac02: {
    speaker: "항구 노인",
    lines: [
      "이 왕국의 성은 성이 아니야. 물이 오르면 뜨는 배지.",
      "그러니 물 위에서 우리를 이기려는 자는 없어. …물속에서 오는 놈 말고는.",
    ],
  },
  lilacNpc_lilac03: {
    speaker: "부상병",
    lines: [
      "크라켄이 되면 웨폰마스터의 힘이 아니야. 저건 저주받은 바다의 힘이지.",
      "삼지창을 던지지 마. 맞으면 더 날뛴다.",
    ],
  },
  lilacNpc_lilac04: {
    speaker: "에벤트 시녀",
    lines: [
      "근위대장님이 부상자들을 전부 직접 살피고 계세요.",
      "그런데 이상하죠. 자기 상처는 안 보시더라고요.",
    ],
  },
  lilacNpc_lilac05: {
    speaker: "마을 노파",
    lines: [
      "이 길에 도깨비가 나오면, 값을 치러야 한다고들 해요.",
      "허나 부채 소리가 들리면 도망칠 필요 없어요. 그분이 오신 거니까.",
    ],
  },
  lilacNpc_lilac06: {
    speaker: "생명의 초월자",
    lines: [
      "빛은 어둠이 조금만 섞여도 타락한다. 그래서 빛의 초월자는 늘 감시받았지.",
      "문제는 감시자도 유인될 수 있다는 거야.",
    ],
  },
  lilacNpc_lilac07: {
    speaker: "연합 지휘관",
    lines: [
      "세 방면을 동시에 치면 승산이 있다. 하지만 셋 중 하나가 무너지면 전부 무너진다.",
      "그래서 조를 짤 때는 약한 곳에 강한 자를 붙이는 거다.",
    ],
  },
  lilacNpc_lilac08: {
    speaker: "상처 입은 기사",
    lines: [
      "그 검은 드래곤의 영혼이 검 안에 있다고들 하지.",
      "그러니 그 검을 부러뜨리려 하지 마라. 영혼을 풀어주는 꼴이 된다.",
    ],
  },
  lilacNpc_lilac09: {
    speaker: "꽃밭지기",
    lines: [
      "라일락이라는 이름은 꽃말이 '추억'이야.",
      "그러니 그 이름을 부를 때마다, 누군가는 추억으로 돌아가는 거지.",
    ],
  },
  lilacNpc_lilac10: {
    speaker: "성채 앞 생존자",
    lines: [
      "문이 넷이야. 물, 바람, 번개, 불.",
      "상성이 없는 문부터 가면 안 된다. 불의 문은 특히.",
    ],
  },
  lilacNpc_lilac11: {
    speaker: "연합 사제",
    lines: [
      "아이온과 알다바오트는 보석이 아니야. 보석이 스스로 만든 형체지.",
      "베면 재가 되고, 재가 되면 다시 모인다. 한 번에 끝내야 한다.",
    ],
  },
  lilacNpc_lilac12: {
    speaker: "부상당한 병사",
    lines: [
      "여섯 명이면 충분하다고 하더군요.",
      "…그 말이 믿음인지 허세인지, 저는 아직 모르겠습니다.",
    ],
  },
  lilacNpc_lilac13: {
    speaker: "왕좌 앞의 환영",
    lines: [
      "빛은 자신이 어둠을 이긴다고 믿는다.",
      "그러나 빛이 어둠을 태우면, 남는 것은 재뿐이다.",
      "네가 무엇을 붙잡고 있는지 잊지 마라.",
    ],
  },
  lilacNpc_lilac14: {
    speaker: "시간의 파편",
    lines: [
      "시간을 멈추면 총알은 빨라진다. 하지만 심장은 멈추지 않는다.",
      "그래서 마지막 한 발에는 모두의 염원을 담아야 해.",
    ],
  },
  lilacNpc_lilac15: {
    speaker: "연합 접수관",
    lines: [
      "그랜드 플래닛의 세르니움에서 연락이 왔습니다.",
      "파견 선발대를 준비하라고요. …이번에도 일이 커질 것 같습니다.",
    ],
  },
};
