/**
 * 영준프린세스 1기 — 자동 진행 컷씬 시나리오 (메이플식)
 *
 * playAutoCutscene(scene, spec) 로 재생한다.
 * 레터박스 + 카메라 팬 + 배우 등장/이동/퇴장 + 자동 대사 + 플래시/셰이크/암전.
 *
 * 카메라 원칙 (agd-camera-systems)
 *   - 팬과 팔로우를 동시에 돌리지 않는다 (실행기의 camCinema 게이트가 담당)
 *   - 팬 목표는 맵 경계로 클램프 (검은 여백 노출 금지)
 *   - 셰이크는 팔로우 목표가 아니라 **추가 오프셋** (Phaser cam.shake 사용)
 *   - 복귀는 보간 (스냅 금지)
 *
 * 배우 좌표는 맵 비율(0~1). 텍스처가 없으면 실행기가 회색 사각형으로 대체한다.
 */
import type { CutStep } from "./fx/AutoCutscene";

export type LilacScenario = {
  id: string;
  chapter: number;
  title: string;
  steps: CutStep[];
};

/* 배우 텍스처 — 1기 몬스터 시트 + 기존 NPC */
const T = {
  aria:    "npc_fairy_aria",
  scarlet: "lil_boss_scarlet1_idle0",
  harold:  "lil_boss_harold_idle0",
  kraken:  "lil_boss_kraken_idle0",
  dokkaebi:"lil_boss_dokkaebi_idle0",
  feron:   "lil_boss_feron_idle0",
  aion:    "lil_boss_aion_idle0",
  aldab:   "lil_boss_aldabaoth_idle0",
  scarlet3:"lil_boss_scarlet3_idle0",
  veronica:"lil_boss_veronica_idle0",
  din:     "lil_boss_din_idle0",
  angelic: "lil_boss_angelic_idle0",
  dragon:  "lil_boss_blackdragon_idle0",
  water:   "lil_boss_water_idle0",
  wind:    "lil_boss_wind_idle0",
  thunder: "lil_boss_thunder_idle0",
  fire:    "lil_boss_fire_idle0",
} as const;

export const LILAC_SCENARIOS: Record<string, LilacScenario> = {
  /* ══ 0화 — 프롤로그 ══════════════════════════════════ */
  lilac00: {
    id: "lilac00", chapter: 1, title: "0화 — 프롤로그",
    steps: [
      { t: "cam", rx: 0.5, ry: 0.15, panMs: 1200, zoom: 0.86 },
      { t: "say", speaker: "이야기꾼", lines: [
        "아주 오래전, 이 세상에는 세 개의 왕국이 있었다.",
        "북쪽은 얼음, 중부는 사계절, 남쪽은 바다와 산.",
      ] },
      { t: "cam", rx: 0.22, ry: 0.33, panMs: 950 },
      { t: "say", speaker: "이야기꾼", lines: ["북쪽의 왕은 얼음을 녹여 배를 띄웠다."] },
      { t: "cam", rx: 0.5, ry: 0.42, panMs: 900 },
      { t: "say", speaker: "이야기꾼", lines: ["중부의 왕은 강을 막아 물을 모았다."] },
      { t: "cam", rx: 0.78, ry: 0.46, panMs: 950 },
      { t: "say", speaker: "이야기꾼", lines: ["남쪽의 왕은 산을 넘었다."] },
      { t: "cam", rx: 0.5, ry: 0.55, panMs: 1100, zoom: 0.8 },
      { t: "flash", color: 0xaa2222, ms: 320 },
      { t: "shake", ms: 420, intensity: 0.008 },
      { t: "say", speaker: "이야기꾼", lines: [
        "전쟁은 보석을 가진 자가 아니라,",
        "가질 수 있다고 믿는 자들 사이에서 일어났다.",
      ] },
      { t: "cam", rx: 0.5, ry: 0.6, panMs: 900 },
      { t: "say", speaker: "이야기꾼", lines: [
        "그리고 전쟁이 길어지자, 세계가 대답했다.",
        "땅은 무너지고, 하늘은 다시 내려오지 않았다.",
      ] },
      { t: "cam", rx: 0.5, ry: 0.76, panMs: 850 },
      { t: "say", speaker: "이야기꾼", lines: [
        "수호자들이 보석을 빛과 어둠으로 갈랐다.",
        "그리고 자신들의 힘을 후대에 전수했다.",
        "그렇게 웨폰마스터가 생겼다.",
      ] },
      { t: "say", speaker: "이야기꾼", lines: [
        "열쇠가 열쇠 구멍에 꽂혔다.",
        "아무도 그것이 열쇠인 줄 몰랐다.",
      ] },
    ],
  },

  /* ══ 1화 — 전설의 시작 ═══════════════════════════════ */
  lilac01: {
    id: "lilac01", chapter: 2, title: "1화 — 전설의 시작",
    steps: [
      { t: "cam", rx: 0.5, ry: 0.13, panMs: 1100, zoom: 0.9 },
      { t: "say", speaker: "이야기꾼", lines: ["왕립도서관. 한적한 오후."] },
      { t: "cam", rx: 0.3, ry: 0.36, panMs: 900 },
      { t: "enter", id: "aria", actor: { tex: T.aria, x: 0.3, y: 0.44, fadeIn: true, scale: 1.8 } },
      { t: "say", speaker: "스칼렛", lines: [
        "…또 없네.",
        "왜 세 왕국이 전쟁을 했는지,",
        "왜 우리 왕국이 하늘에 떠 있는지.",
      ] },
      { t: "say", speaker: "사서", lines: ["세 번째 서가에는 그런 게 없습니다."] },
      { t: "flash", color: 0xffeeaa, ms: 180 },
      { t: "say", speaker: "스칼렛", lines: ["…떨어진 책?"] },
      { t: "say", speaker: "스칼렛", lines: [
        "『웨폰마스터를 위한 정리서』",
        "순력, 혼력, 자력 — 되는 것은 강함의 역순이네.",
      ] },
      { t: "cam", rx: 0.62, ry: 0.44, panMs: 850 },
      { t: "say", speaker: "스칼렛", lines: [
        "여백에 다른 필체가 있어.",
        "— 세계는 균형을 지키는 자가 필요하다.",
        "그러나 균형을 지키는 자가 균형을 알지는 못한다.",
      ] },
      { t: "fade", out: true, ms: 420 },
      { t: "say", speaker: "스칼렛", lines: ["…그럼 누가 알죠?"] },
      { t: "fade", out: false, ms: 380 },
      { t: "cam", rx: 0.72, ry: 0.5, panMs: 800 },
      { t: "say", speaker: "이야기꾼", lines: [
        "서고의 맨 끝, 아무도 들어가지 않는 방의 문이 열려 있었다.",
        "책이 있을 자리에는 먼지의 흔적만 남아 있었다.",
      ] },
      { t: "exit", id: "aria" },
    ],
  },

  /* ══ 2화 — 어둠이 커지기 시작했을 때 ═════════════════ */
  lilac02: {
    id: "lilac02", chapter: 3, title: "2화 — 어둠이 커지기 시작했을 때",
    steps: [
      { t: "cam", rx: 0.5, ry: 0.16, panMs: 1100, zoom: 0.88 },
      { t: "say", speaker: "이야기꾼", lines: ["에스테반 왕국. 평화와 부의 상징."] },
      { t: "say", speaker: "이야기꾼", lines: ["흐름은 결국 한 곳으로 모인다. 지금 그 흐름이 이곳으로 오고 있었다."] },
      { t: "cam", rx: 0.25, ry: 0.44, panMs: 900 },
      { t: "say", speaker: "아덴", lines: ["폐하, 에델리오나 왕국이 전쟁을 선포했습니다."] },
      { t: "enter", id: "scarlet", actor: { tex: T.scarlet, x: 0.78, y: 0.46, fadeIn: true } },
      { t: "cam", rx: 0.78, ry: 0.42, panMs: 850 },
      { t: "say", speaker: "카르텔", lines: ["그럴 것이다. 다음 타깃은 조선시대 왕국이야."] },
      { t: "say", speaker: "아덴", lines: ["그리고 그다음은 — 우리입니다."] },
      { t: "cam", rx: 0.5, ry: 0.54, panMs: 800 },
      { t: "say", speaker: "이야기꾼", lines: ["그때 예상치 못한 조짐이 불어왔다. 영프 인근 해변에서 전투함 세 척이 파괴되었다."] },
      { t: "say", speaker: "아덴", lines: [
        "에벤트 왕국에서 서신이 왔습니다.",
        "— 어젯밤 꿈을 꿨는데, 마치 석양이 바다를 집어 삼키는 듯한 모습이었습니다.",
      ] },
      { t: "cam", rx: 0.5, ry: 0.7, panMs: 900, zoom: 1.05 },
      { t: "flash", color: 0xcc3322, ms: 240 },
      { t: "say", speaker: "카르텔", lines: ["그녀가 오기만을 기다렸다. 오늘은 유난히 화창한 날이군."] },
      { t: "exit", id: "scarlet" },
    ],
  },

  /* ══ 3화 — 시작된 전쟁 ═══════════════════════════════ */
  lilac03: {
    id: "lilac03", chapter: 4, title: "3화 — 시작된 전쟁",
    steps: [
      { t: "cam", rx: 0.5, ry: 0.2, panMs: 900, zoom: 0.92 },
      { t: "say", speaker: "이야기꾼", lines: ["결전의 날, 늦은 아침. 유난히 화창한 날이었다."] },
      { t: "fade", out: true, ms: 300 },
      { t: "enter", id: "scarlet", actor: { tex: T.scarlet, x: 0.5, y: 0.4, fadeIn: true, scale: 1.2 } },
      { t: "flash", color: 0xff3322, ms: 420 },
      { t: "shake", ms: 500, intensity: 0.012 },
      { t: "fade", out: false, ms: 340 },
      { t: "say", speaker: "스칼렛", lines: ["순순히 땅을 내놓으면 학살은 면하겠다."] },
      { t: "say", speaker: "카르텔", lines: ["우린 각오가 다 되어 있다. 함께 맞서 싸우자!"] },
      { t: "cam", rx: 0.3, ry: 0.46, panMs: 800 },
      { t: "say", speaker: "아덴", lines: ["저건… 성이 아닙니다. 성이 전함으로 변하고 있어요."] },
      { t: "enter", id: "harold", actor: { tex: T.harold, x: 0.76, y: 0.5, fadeIn: true } },
      { t: "cam", rx: 0.74, ry: 0.46, panMs: 850 },
      { t: "say", speaker: "해롤드", lines: ["카르텔! 네 왕국이 최강의 병기라고? 물 위에서!"] },
      { t: "say", speaker: "이야기꾼", lines: ["전쟁 경험이 더 많은 에스테반의 군사들이 순식간에 적을 제압했다."] },
      { t: "say", speaker: "해롤드", lines: ["…내 주인?"] },
      { t: "exit", id: "harold" },
      { t: "enter", id: "kraken", actor: { tex: T.kraken, x: 0.76, y: 0.44, fadeIn: true, scale: 1.4 } },
      { t: "shake", ms: 700, intensity: 0.02 },
      { t: "flash", color: 0x220033, ms: 400 },
      { t: "say", speaker: "이야기꾼", lines: [
        "그녀의 몸이 일그러지기 시작했다. 저주받은 바다의 힘. 크라켄.",
        "카르텔은 알아챘다. 저건 웨폰마스터의 힘이 아니었다.",
      ] },
      { t: "say", speaker: "카르텔", lines: ["웨폰어빌리티 — 상어의 바다."] },
      { t: "say", speaker: "아덴", lines: ["폐하, 여기서 에벤트 왕국으로 갈 수 있는 이동석입니다!"] },
      { t: "exit", id: "scarlet" },
      { t: "exit", id: "kraken" },
      { t: "fade", out: true, ms: 500 },
    ],
  },

  /* ══ 4화 — 석양으로 물든 바다 ════════════════════════ */
  lilac04: {
    id: "lilac04", chapter: 5, title: "4화 — 석양으로 물든 바다",
    steps: [
      { t: "fade", out: false, ms: 400 },
      { t: "cam", rx: 0.5, ry: 0.18, panMs: 1000, zoom: 0.9 },
      { t: "say", speaker: "이야기꾼", lines: ["에벤트 왕국. 석양이 바다를 붉게 물들이고 있었다."] },
      { t: "cam", rx: 0.3, ry: 0.44, panMs: 850 },
      { t: "enter", id: "aria", actor: { tex: T.aria, x: 0.32, y: 0.5, fadeIn: true, scale: 1.7 } },
      { t: "say", speaker: "아리", lines: [
        "지금 움직이시면 위험합니다.",
        "저는 근위대장, 아리스텔라 데스티니입니다.",
        "아리라고 불러주세요.",
      ] },
      { t: "cam", rx: 0.5, ry: 0.46, panMs: 800 },
      { t: "say", speaker: "리안", lines: [
        "카르텔 국왕. 이야기는 들었습니다.",
        "다음 타깃이 조선시대 왕국이라면, 우리가 먼저 움직여야 합니다.",
      ] },
      { t: "say", speaker: "이야기꾼", lines: ["최강이라 불리던 에스텔라 왕국이 멸망했고, 그보다 백 배는 강한 자와 싸워야 한다."] },
      { t: "say", speaker: "아리", lines: ["도사를 찾고 계십니까? 그분은 지금 마을에서 의뢰를 받으며 지내고 계십니다."] },
      { t: "move", id: "aria", rx: 0.68, ry: 0.5, ms: 900 },
      { t: "cam", rx: 0.7, ry: 0.48, panMs: 700 },
      { t: "say", speaker: "아리", lines: ["그런데… 그분이 협상을 받아들일지는 저도 모르겠습니다."] },
      { t: "exit", id: "aria" },
    ],
  },

  /* ══ 5화 — 협상 그리고 연합 ══════════════════════════ */
  lilac05: {
    id: "lilac05", chapter: 6, title: "5화 — 협상 그리고 연합",
    steps: [
      { t: "cam", rx: 0.5, ry: 0.15, panMs: 1000, zoom: 0.88 },
      { t: "say", speaker: "이야기꾼", lines: ["조선시대 왕국으로 향하는 산길. 안개가 낮게 깔려 있었다."] },
      { t: "cam", rx: 0.34, ry: 0.42, panMs: 850 },
      { t: "enter", id: "ran", actor: { tex: T.veronica, x: 0.34, y: 0.48, fadeIn: true } },
      { t: "say", speaker: "란", lines: [
        "그림이 아니라, 그리는 마음이 사람을 살립니다.",
        "물감이 마음을 옮기니까요.",
      ] },
      { t: "say", speaker: "아리", lines: ["…그런 건 처음 듣습니다."] },
      { t: "say", speaker: "란", lines: ["그럼 오늘부터 들으시면 됩니다."] },
      { t: "enter", id: "dokkaebi", actor: { tex: T.dokkaebi, x: 0.74, y: 0.46, fadeIn: true, scale: 1.2 } },
      { t: "shake", ms: 320, intensity: 0.01 },
      { t: "say", speaker: "도깨비", lines: ["지나가는 값을 치러라!"] },
      { t: "exit", id: "dokkaebi" },
      { t: "flash", color: 0xffffff, ms: 200 },
      { t: "say", speaker: "이야기꾼", lines: ["그 순간, 어디선가 부채 소리가 들렸다. 분신과 함께 도깨비가 물리쳐졌다."] },
      { t: "say", speaker: "도사", lines: [
        "협상을 가시는 길인가.",
        "그럼 가십시오. 이 길에 도깨비는 이제 없습니다.",
      ] },
      { t: "cam", rx: 0.5, ry: 0.5, panMs: 800 },
      { t: "say", speaker: "리안", lines: [
        "다섯 왕국의 이름을 적고, 최후를 막은 뒤에는",
        "모두 연합의 일원이라고 서명합시다.",
      ] },
      { t: "say", speaker: "이야기꾼", lines: ["그렇게 라일락 연합이 만들어졌다."] },
      { t: "exit", id: "ran" },
      { t: "fade", out: true, ms: 380 },
      { t: "say", speaker: "루시", lines: [
        "오랜만이야.",
        "그런데 하나 물어봐도 될까.",
        "네가 지금 가진 그 표정은, 누구의 표정이야?",
      ] },
    ],
  },

  /* ══ 6화 — 초월자 ════════════════════════════════════ */
  lilac06: {
    id: "lilac06", chapter: 7, title: "6화 — 초월자",
    steps: [
      { t: "fade", out: false, ms: 340 },
      { t: "cam", rx: 0.5, ry: 0.17, panMs: 950, zoom: 0.92 },
      { t: "say", speaker: "루시", lines: [
        "다들 '왜 여기 있는 거지', '왜 이제 온 거지' 하고 궁금해 하겠지.",
        "내가 설명해주지.",
      ] },
      { t: "cam", rx: 0.34, ry: 0.45, panMs: 820 },
      { t: "say", speaker: "루시", lines: [
        "스칼렛이, 빛의 초월자가 어둠의 힘을 얻은 거야.",
        "빛은 어둠이 조금만이라도 있으면 타락하거든.",
        "이유는 한 가지뿐이야. 유인당한 거야.",
      ] },
      { t: "fade", out: true, ms: 300 },
      { t: "fade", out: false, ms: 300 },
      { t: "say", speaker: "루시", lines: [
        "다크니스와 라이트를 다시 융합시켜.",
        "그다음 숙주를 버리고, 또 다른 강자를 이용해서 세계를 숙주로 삼으려 하지.",
        "스칼렛은 지금 숙주야. 그리고 곧 사용된 숙주가 될 거고.",
      ] },
      { t: "cam", rx: 0.66, ry: 0.5, panMs: 800 },
      { t: "say", speaker: "루시", lines: [
        "네가 잃어버렸다던 솔라플레임이그니션소드도 찾았어.",
        "그런데 소드를 가진 자가 소드를 잃을 때, 소드는 주인을 기억하지 못해.",
        "다시 만나야 해. 그 전까지는 아무것도 아니야.",
      ] },
      { t: "flash", color: 0x442266, ms: 300 },
      { t: "say", speaker: "루시", lines: [
        "— 어둠의 왕좌가 도래하기까지 시간이 얼마 남지 않았다.",
        "— 지금 우리 쪽으로 오는 자는 살려 주겠다.",
        "— 대신에 나머지는 전부 죽음이다. 스칼렛.",
      ] },
      { t: "say", speaker: "아리", lines: ["우리는 이미 각오를 다했어요. 이 라일락 월드에 있는 모든 사람은요."] },
      { t: "cam", rx: 0.5, ry: 0.76, panMs: 800 },
      { t: "say", speaker: "이야기꾼", lines: ["최후의 전쟁의 승리자가 누가 될지, 아직 아무도 몰랐다."] },
    ],
  },

  /* ══ 7화 — 군단장들과의 전투 ═════════════════════════ */
  lilac07: {
    id: "lilac07", chapter: 8, title: "7화 — 군단장들과의 전투",
    steps: [
      { t: "cam", rx: 0.5, ry: 0.18, panMs: 900, zoom: 0.9 },
      { t: "say", speaker: "이야기꾼", lines: ["각 왕국에 배치된 군단장들을 먼저 쓰러트려야 한다."] },
      { t: "say", speaker: "카르텔", lines: ["수월하게 해치우기 위해서 조를 짜서 싸우기로 했다."] },
      { t: "cam", rx: 0.22, ry: 0.44, panMs: 800 },
      { t: "say", speaker: "카르텔", lines: ["나와 아덴, 그리고 제르는 해롤드가 있는 에스테반으로 간다."] },
      { t: "cam", rx: 0.5, ry: 0.48, panMs: 800 },
      { t: "say", speaker: "아리", lines: ["나는?"] },
      { t: "say", speaker: "리안", lines: ["너는 남는다. 에벤트를 지켜야지."] },
      { t: "say", speaker: "아리", lines: ["…네?"] },
      { t: "cam", rx: 0.78, ry: 0.46, panMs: 800 },
      { t: "enter", id: "din", actor: { tex: T.din, x: 0.78, y: 0.5, fadeIn: true } },
      { t: "say", speaker: "리안", lines: ["딘을 잘 처리할 수 있지?"] },
      { t: "say", speaker: "이현", lines: ["3분 뒤에 보시죠."] },
      { t: "shake", ms: 380, intensity: 0.012 },
      { t: "flash", color: 0xffddaa, ms: 220 },
      { t: "say", speaker: "이현", lines: ["도깨비신의 공격."] },
      { t: "say", speaker: "이야기꾼", lines: ["화려하게 제압해냈다. 그리고 연결했다."] },
      { t: "exit", id: "din" },
      { t: "fade", out: true, ms: 360 },
      { t: "say", speaker: "이야기꾼", lines: ["그리고 에벤트 왕국에서는 위험이 도래하는데."] },
    ],
  },

  /* ══ 8화 — 두 전사의 격전 ════════════════════════════ */
  lilac08: {
    id: "lilac08", chapter: 9, title: "8화 — 두 전사의 격전",
    steps: [
      { t: "fade", out: false, ms: 320 },
      { t: "cam", rx: 0.5, ry: 0.16, panMs: 1000, zoom: 0.88 },
      { t: "say", speaker: "이야기꾼", lines: [
        "그 시각, 에벤트 왕국에서는 두 전사의 격돌이 이어지고 있었다.",
        "페르온은 원래 에벤트 왕국의 기사단장이었다. 그리고 아리는 근위대장이었다.",
      ] },
      { t: "fade", out: true, ms: 400 },
      { t: "say", speaker: "이야기꾼", lines: [
        "페르온과 사귀고 있던 그녀가, 자신의 눈앞에서 죽었다.",
        "자신이 조금만 더 강했더라면, 떨어진 낙석을 부술 수 있었기 때문이다.",
      ] },
      { t: "fade", out: false, ms: 400 },
      { t: "cam", rx: 0.32, ry: 0.46, panMs: 820 },
      { t: "say", speaker: "이야기꾼", lines: [
        "그는 에벤트를 몰래 떠나 동굴로 향했다.",
        "보석이 있었다. 그의 앞을 막아선 것은 검은 드래곤이었다.",
      ] },
      { t: "enter", id: "dragon", actor: { tex: T.dragon, x: 0.34, y: 0.44, fadeIn: true, scale: 1.3 } },
      { t: "shake", ms: 500, intensity: 0.014 },
      { t: "say", speaker: "이야기꾼", lines: [
        "죽은 그녀가 환상처럼 보였다. 그의 몸이 보석 쪽으로 이끌렸다.",
        "그리고 무의식적으로 드래곤을 죽였다.",
      ] },
      { t: "exit", id: "dragon" },
      { t: "say", speaker: "이야기꾼", lines: ["바위에 있던 엑스칼리버를 뽑자, 다크니스의 힘으로 다크엑스칼리버가 되었다."] },
      { t: "cam", rx: 0.5, ry: 0.52, panMs: 800 },
      { t: "say", speaker: "스칼렛", lines: ["강한 힘을 주겠다."] },
      { t: "cam", rx: 0.5, ry: 0.36, panMs: 900, zoom: 0.72 },
      { t: "flash", color: 0xffffff, ms: 420 },
      { t: "say", speaker: "수호신", lines: [
        "밀리고 있구나.",
        "아리야, 명심하거라. 너는 검의 힘이 아니라 빛의 힘이다.",
        "참고로 빛의 힘은… 힘… 이… 다.",
      ] },
      { t: "say", speaker: "아리", lines: [
        "흰 턱수염에 간달프 같이 생겼지만… 옛날에 배웠던 역사 시간에 있던,",
        "솔라 데스티니 1세. 제 먼 조상이었어요.",
      ] },
    ],
  },

  /* ══ 9화 — 과거의 향기 ═══════════════════════════════ */
  lilac09: {
    id: "lilac09", chapter: 10, title: "9화 — 과거의 향기",
    steps: [
      { t: "cam", rx: 0.5, ry: 0.2, panMs: 1100, zoom: 0.86 },
      { t: "say", speaker: "이야기꾼", lines: ["그 순간, 갑자기 몸이 움직이더니 낙석에서 피해졌다. 하지만 피가 흐르고 있었다."] },
      { t: "say", speaker: "이야기꾼", lines: [
        "뒤를 돌아보니, 페르온의 그녀가 자신의 목숨을 던져서 그녀를 구해냈다.",
        "왜냐하면 — 그녀는 아리의 여동생이기 때문이었다.",
      ] },
      { t: "flash", color: 0xffccdd, ms: 320 },
      { t: "cam", rx: 0.32, ry: 0.44, panMs: 850 },
      { t: "say", speaker: "페르온", lines: [
        "아직 이름이 없었지. 라일락이라고 하자.",
        "꽃말이 추억이라서. 너의 이름을 부르는 사람마다 추억이 되라고.",
      ] },
      { t: "say", speaker: "라일락", lines: [
        "제가 있었던 시간 동안 모두에게 추억이 되었다면, 전 그걸로 충분해요.",
        "아리 언니. 페르온 씨.",
        "죄송해요. 그리고… 사랑해요.",
      ] },
      { t: "fade", out: true, ms: 520 },
      { t: "say", speaker: "이야기꾼", lines: [
        "과거의 향기는 라일락 꽃밭보다 진하다는 게 맞았군…",
        "그릇이 되지 않은 자에게 많은 것을 주면, 넘쳐 흘러내려버린다…",
      ] },
      { t: "fade", out: false, ms: 460 },
      { t: "cam", rx: 0.66, ry: 0.48, panMs: 820 },
      { t: "say", speaker: "페르온", lines: [
        "추억에 계속 잠겨 있으면 앞으로 나아가지 못해.",
        "어둠의 왕좌로 가는 길은 내가 잘 알아. 나도 돕지.",
      ] },
      { t: "say", speaker: "리안", lines: [
        "각자의 모습은 다르지만, 우리 모두 같은 이유로 여기에 모였습니다.",
        "모두 스칼렛과 그녀의 군단으로부터 세계를 구합시다!",
      ] },
    ],
  },

  /* ══ 10화 — 어둠의 성채 ══════════════════════════════ */
  lilac10: {
    id: "lilac10", chapter: 11, title: "10화 — 어둠의 성채",
    steps: [
      { t: "fade", out: false, ms: 400 },
      { t: "cam", rx: 0.5, ry: 0.14, panMs: 1050, zoom: 0.84 },
      { t: "say", speaker: "이야기꾼", lines: [
        "연합은 어둠의 성채에 도착했다.",
        "스칼렛이 셀 수 없을 정도로 많은 자신의 군대를 만들어냈다.",
      ] },
      { t: "shake", ms: 600, intensity: 0.014 },
      { t: "cam", rx: 0.26, ry: 0.4, panMs: 800 },
      { t: "say", speaker: "이야기꾼", lines: ["웨폰마스터와 능력을 가진 자들을 제외하고, 모두 어둠의 괴물과 싸우기 시작했다."] },
      { t: "cam", rx: 0.74, ry: 0.44, panMs: 820 },
      { t: "say", speaker: "이야기꾼", lines: ["처음에는 수적으로 밀렸지만, 미리 준비해둔 마법진과 대포로 격차를 줄여나갔다."] },
      { t: "cam", rx: 0.5, ry: 0.48, panMs: 900, zoom: 0.8 },
      { t: "say", speaker: "이야기꾼", lines: [
        "주요 인물들은 큰 벽에 막혔다.",
        "스칼렛이 군단장들의 힘으로 만든 4개의 환영 — 일종의 시간끌기였다.",
      ] },
      { t: "say", speaker: "이야기꾼", lines: ["4개의 문을 클리어해야만 스칼렛이 있는 어둠의 왕좌로 갈 수 있다."] },
      { t: "enter", id: "water", actor: { tex: T.water, x: 0.22, y: 0.46, fadeIn: true } },
      { t: "enter", id: "wind", actor: { tex: T.wind, x: 0.42, y: 0.5, fadeIn: true } },
      { t: "enter", id: "thunder", actor: { tex: T.thunder, x: 0.6, y: 0.46, fadeIn: true } },
      { t: "enter", id: "fire", actor: { tex: T.fire, x: 0.78, y: 0.5, fadeIn: true } },
      { t: "say", speaker: "이야기꾼", lines: ["물, 바람, 번개, 불. 넷으로 흩어져서 갔다."] },
      { t: "say", speaker: "이야기꾼", lines: ["불의 문은 상성이 맞지 않아 힘겹게 이겼다."] },
      { t: "exit", id: "water" },
      { t: "exit", id: "wind" },
      { t: "exit", id: "thunder" },
      { t: "exit", id: "fire" },
      { t: "say", speaker: "이야기꾼", lines: [
        "함정이었다. 스칼렛이 있는 곳은 함정이었고,",
        "루시가 가져간 라이트 보석의 파편을 회수한 스칼렛은 피를 모으기 시작했다.",
      ] },
      { t: "say", speaker: "루시", lines: ["길이 끊겼어. 걷는 것밖에 없다고 생각했지만…"] },
      { t: "say", speaker: "란", lines: ["물감이 마음을 옮기니까요. 그림 열기구를 만들죠."] },
    ],
  },

  /* ══ 11화 — 어둠의 왕좌 ══════════════════════════════ */
  lilac11: {
    id: "lilac11", chapter: 12, title: "11화 — 어둠의 왕좌",
    steps: [
      { t: "cam", rx: 0.5, ry: 0.12, panMs: 1150, zoom: 0.8 },
      { t: "say", speaker: "이야기꾼", lines: ["어둠의 왕좌. 12명의 영웅들이 도달했다."] },
      { t: "flash", color: 0xffffff, ms: 380 },
      { t: "enter", id: "aion", actor: { tex: T.aion, x: 0.36, y: 0.42, fadeIn: true, scale: 1.2 } },
      { t: "say", speaker: "루시", lines: [
        "이건… 보석이 아니야. 보석이 스스로 만든 것이야.",
        "라이트와 다크니스가 형체를 가진 것 — 아이온과 알다바오트.",
      ] },
      { t: "flash", color: 0x000000, ms: 380 },
      { t: "enter", id: "aldab", actor: { tex: T.aldab, x: 0.64, y: 0.44, fadeIn: true, scale: 1.3 } },
      { t: "shake", ms: 520, intensity: 0.016 },
      { t: "say", speaker: "베로니카", lines: ["이건… 내 힘이 나가고 있어."] },
      { t: "say", speaker: "이야기꾼", lines: ["싸우던 도중, 베로니카와 시엘과 딘이 저주의 표식을 맞아 힘을 잃어갔다."] },
      { t: "say", speaker: "이야기꾼", lines: [
        "바깥은 최악이었다. 스칼렛이 창조물들을 흡수하고, 급기야 연합의 군사들도 흡수되기 시작했다.",
        "연합은 그레이트프로텍트쉴드를 작동시켜 흡수를 늦췄다.",
      ] },
      { t: "exit", id: "aion" },
      { t: "exit", id: "aldab" },
      { t: "cam", rx: 0.5, ry: 0.6, panMs: 900, zoom: 0.86 },
      { t: "enter", id: "scarlet", actor: { tex: T.scarlet, x: 0.5, y: 0.44, fadeIn: true, scale: 1.5 } },
      { t: "say", speaker: "스칼렛", lines: [
        "왔구나.",
        "인피니트보석의 힘뿐만이 아니야. 피의 힘과 진정한 어둠의 힘.",
        "군단장들의 힘, 분신들의 힘, 그리고 초월자의 힘까지.",
      ] },
      { t: "say", speaker: "이야기꾼", lines: ["초월자 2명과 뛰어난 영웅 3명이 덤벼들어도 지지 않을 정도였다."] },
      { t: "shake", ms: 700, intensity: 0.02 },
      { t: "say", speaker: "이야기꾼", lines: ["하지만 다굴 앞에 장사가 없기에, 스칼렛도 이내 쓰러졌다."] },
      { t: "say", speaker: "이야기꾼", lines: ["끝난 줄 알았다. 하지만 그녀는 창조물과 저주 표식이 있는 자들의 힘까지 손에 넣었다."] },
      { t: "flash", color: 0x330011, ms: 500 },
      { t: "exit", id: "scarlet" },
    ],
  },

  /* ══ 12화 — 운명 ════════════════════════════════════ */
  lilac12: {
    id: "lilac12", chapter: 13, title: "12화 — 운명",
    steps: [
      { t: "cam", rx: 0.5, ry: 0.16, panMs: 950, zoom: 0.9 },
      { t: "say", speaker: "이야기꾼", lines: [
        "시간이 흐를수록 외부 상황은 좋아졌다.",
        "하지만 내부 상황은 최악으로 변해갔다.",
      ] },
      { t: "say", speaker: "리안", lines: ["이제… 여섯이야."] },
      { t: "say", speaker: "이야기꾼", lines: ["남은 인원은 도사, 루시, 리안, 아리, 란, 제르까지 여섯 명이었다."] },
      { t: "flash", color: 0xffffff, ms: 260 },
      { t: "say", speaker: "제르", lines: ["가세요! 이건 우리가 할 수 있는 일이에요!"] },
      { t: "fade", out: true, ms: 420 },
      { t: "say", speaker: "이야기꾼", lines: ["계르와 란이 마법으로 장벽을 만들어, 도사·루시·리안·아리와 분리시켰다."] },
      { t: "fade", out: false, ms: 380 },
      { t: "cam", rx: 0.46, ry: 0.48, panMs: 820 },
      { t: "say", speaker: "도사", lines: ["지금이야!"] },
      { t: "say", speaker: "이야기꾼", lines: ["장벽이 깨지면서 도사가 스칼렛을 움직이지 못하게 만들었다."] },
      { t: "say", speaker: "이야기꾼", lines: ["하지만 한 번 당한 것은 두 번 다신 당하지 않기에, 스칼렛은 바인드를 끊고 피했다."] },
      { t: "cam", rx: 0.52, ry: 0.44, panMs: 820 },
      { t: "enter", id: "scarlet", actor: { tex: T.scarlet, x: 0.52, y: 0.42, fadeIn: true, scale: 1.4 } },
      { t: "say", speaker: "스칼렛", lines: ["사실 너의 여동생은… 원래 내가 키우고 있었지."] },
      { t: "say", speaker: "스칼렛", lines: [
        "그러던 어느 날, 다시 고향으로 돌아가야 한다더군.",
        "난 그 아이를 돌려보내줬어. 이곳이 아닌 자신의 고향으로 가는 게 맞다고 생각했거든.",
      ] },
      { t: "say", speaker: "스칼렛", lines: [
        "10개월이 지나고, 난 무한의 탑에 갔어.",
        "그곳에서 다크니스를 찾았어. 그리고 이 힘을 손에 넣었지…",
      ] },
      { t: "say", speaker: "아리", lines: ["정신차려, 스칼렛! 그 보석은 널 잠식한 뒤에 네 몸을 가지고 세상을 지배할 거라고!"] },
      { t: "exit", id: "scarlet" },
    ],
  },

  /* ══ 13화 — 최후의 일격 ══════════════════════════════ */
  lilac13: {
    id: "lilac13", chapter: 14, title: "13화 — 최후의 일격",
    steps: [
      { t: "cam", rx: 0.5, ry: 0.18, panMs: 950, zoom: 0.88 },
      { t: "say", speaker: "스칼렛", lines: [
        "점점 목이 조여져 오듯이 힘들더군.",
        "그러곤 무한의 탑에서 난 깨달았지. 남은 라이트 보석은 보석이 아닌 나라고.",
      ] },
      { t: "say", speaker: "아리", lines: ["그런 일은 일어날 수 없어."] },
      { t: "say", speaker: "스칼렛", lines: [
        "보석의 힘을 흡수할수록 빛이 점점 힘을 잃어가더니, 내 몸 안에서 사라졌지.",
        "그러곤 그 빛이 라이트 보석으로 형상화된 거야.",
      ] },
      { t: "fade", out: true, ms: 400 },
      { t: "say", speaker: "수호신", lines: [
        "데스티니에서 '운명'은 행운이었지. 너도 그 피를 조금이나마 받았을 것이다.",
        "운명은 운명이 아니야. 운명은 모든 계획 중 일부일 뿐이다.",
      ] },
      { t: "fade", out: false, ms: 400 },
      { t: "cam", rx: 0.5, ry: 0.35, panMs: 900, zoom: 0.74 },
      { t: "flash", color: 0xffaa33, ms: 520 },
      { t: "say", speaker: "아리", lines: [
        "스칼렛이 초월자라면… 나도일 수 있어.",
        "라일락 월드에 있는 모든 자의 염원이 이 검에 새겨 들었다.",
        "웨폰어빌리티 — 태양의 불꽃, 검의 수호자.",
      ] },
      { t: "shake", ms: 800, intensity: 0.024 },
      { t: "flash", color: 0xffffff, ms: 600 },
      { t: "say", speaker: "이야기꾼", lines: ["자욱한 연기가 사라지자, 스칼렛은 쓰러졌다."] },
      { t: "cam", rx: 0.5, ry: 0.78, panMs: 800 },
      { t: "say", speaker: "이야기꾼", lines: ["드디어 승리하고 이 모든 것이 끝난 줄로만 알았던 그때."] },
    ],
  },

  /* ══ 14화 — THE END TIME ═════════════════════════════ */
  lilac14: {
    id: "lilac14", chapter: 15, title: "14화 — THE END TIME",
    steps: [
      { t: "cam", rx: 0.5, ry: 0.1, panMs: 1200, zoom: 0.78 },
      { t: "enter", id: "scarlet3", actor: { tex: T.scarlet3, x: 0.5, y: 0.4, fadeIn: true, scale: 1.6 } },
      { t: "flash", color: 0x110011, ms: 500 },
      { t: "shake", ms: 700, intensity: 0.022 },
      { t: "say", speaker: "스칼렛", lines: ["내가 이것만으로 끝날 것이라고 생각하는 거야?"] },
      { t: "say", speaker: "이야기꾼", lines: ["말이 끝나기 무섭게, 라일락 월드의 반을 삼키고는 서서히 다 빨려 들어갔다."] },
      { t: "cam", rx: 0.3, ry: 0.36, panMs: 850 },
      { t: "say", speaker: "이야기꾼", lines: ["아리마저 세뇌당하여 루시와 싸웠다. 하지만 그마저도 흡수당했다."] },
      { t: "say", speaker: "이야기꾼", lines: ["이제 남은 자는 스칼렛과 도사."] },
      { t: "cam", rx: 0.7, ry: 0.42, panMs: 850 },
      { t: "say", speaker: "스칼렛", lines: [
        "너 같은 도사가 신급에 초월자를 막을 수 있을 거라고 생각하나?",
        "시간의 초월자는 어디에서 놀기만 하고 있나 보군…",
      ] },
      { t: "say", speaker: "도사", lines: ["되도록이면 능력을 안 쓰려고 했는데…"] },
      { t: "flash", color: 0x66ccff, ms: 420 },
      { t: "say", speaker: "이야기꾼", lines: ["도사가 부채를 던지더니, 부채가 긴 총이 되었다. 그리고 시간의 초월자로 변했다."] },
      { t: "say", speaker: "스칼렛", lines: ["잠깐, 너 이쪽 세계 사람 아니지? 그것도 완전히 다른 세계."] },
      { t: "say", speaker: "도사", lines: ["예리하긴 하네. 그럼 슬슬 끝내볼까?"] },
      { t: "cam", rx: 0.5, ry: 0.62, panMs: 900, zoom: 0.82 },
      { t: "flash", color: 0xffffff, ms: 300 },
      { t: "say", speaker: "이야기꾼", lines: ["시간을 멈춘 다음 예지를 한 것 같았다. 총알 세례와 칼로 심장을 꿰뚫었다."] },
      { t: "say", speaker: "이야기꾼", lines: ["그래도 라일락 월드를 집어 삼킨 스칼렛에게는 공격이 들어가지 않았다."] },
      { t: "say", speaker: "이야기꾼", lines: ["마지막 총알에 모두의 힘을 담은 염원의 빛을 담아, 정확하게 헤드샷을 하였다."] },
      { t: "shake", ms: 900, intensity: 0.028 },
      { t: "flash", color: 0xffffff, ms: 700 },
      { t: "say", speaker: "스칼렛", lines: ["왜 이런 힘이 있는데도 나타나지 않은 거지?"] },
      { t: "say", speaker: "도사", lines: [
        "다른 세계로 가면 적응하는 기간이 있어야지, 힘을 사용할 수 있거든.",
        "지금도 한 4단계 극초반도 안 되는 힘이 있는 거야.",
      ] },
      { t: "say", speaker: "스칼렛", lines: ["내가 무한의 탑에 들어간 진짜 이유는…"] },
      { t: "say", speaker: "도사", lines: [
        "그럴 필요 없어. 예전에 영웅들도 이 결말을 예측했기에,",
        "모든 것은 운명이 인도하는 대로였을 뿐이야.",
        "그리고 시간과 생명과 빛이 있는 한, 다시 돌리면 돼.",
      ] },
      { t: "say", speaker: "이야기꾼", lines: ["스칼렛은 모든 것을 돌려놓았다."] },
      { t: "exit", id: "scarlet3" },
      { t: "fade", out: true, ms: 900 },
    ],
  },

  /* ══ 15화 — New Beginning ═══════════════════════════ */
  lilac15: {
    id: "lilac15", chapter: 16, title: "15화 — New Beginning Not the End",
    steps: [
      { t: "fade", out: false, ms: 700 },
      { t: "cam", rx: 0.5, ry: 0.18, panMs: 1100, zoom: 0.9 },
      { t: "say", speaker: "이야기꾼", lines: [
        "라일락 월드에 스칼렛이 파괴한 모든 것들이 돌아왔다.",
        "하지만 완전히 리셋되지 않은 것들도 있었다.",
        "보석의 힘과 각자의 힘, 그리고 무수히 많은 시간과 추억들.",
      ] },
      { t: "cam", rx: 0.28, ry: 0.42, panMs: 900 },
      { t: "say", speaker: "이야기꾼", lines: ["가장 중요한 것은 라일락 연합의 탄생이었다."] },
      { t: "cam", rx: 0.72, ry: 0.44, panMs: 900 },
      { t: "say", speaker: "이야기꾼", lines: [
        "영프 왕국은 스칼렛의 왕국과 거의 통합되었고,",
        "조선시대 왕국과 에벤트 왕국은 서로 사과하고 보상을 하려 했다.",
      ] },
      { t: "cam", rx: 0.5, ry: 0.56, panMs: 850 },
      { t: "say", speaker: "아덴", lines: ["이런 날이 올 줄 알았나?"] },
      { t: "say", speaker: "카르텔", lines: ["몰랐지. 그래서 더 좋은 거야."] },
      { t: "say", speaker: "이야기꾼", lines: ["에스텔라와 에델리오나의 상어와 비행선들이 인기를 얻어, 재건에 큰 도움이 되고 있었다."] },
      { t: "say", speaker: "제르", lines: ["그랜드 플래닛의 세르니움에서 연락이 왔습니다. 파견 선발대를 준비하라고요."] },
      { t: "say", speaker: "리안", lines: ["내가 간다."] },
      { t: "say", speaker: "아리", lines: ["저도 가겠습니다."] },
      { t: "say", speaker: "루시", lines: ["그럼 나도 가야지."] },
      { t: "cam", rx: 0.5, ry: 0.72, panMs: 950, zoom: 0.84 },
      { t: "fade", out: true, ms: 500 },
      { t: "say", speaker: "정리서의 주인", lines: [
        "세계는 균형을 지키는 자가 필요하다.",
        "그러나 균형을 지키는 자가 균형을 알지는 못한다.",
        "이제 알겠나? 균형을 알지 못하는 자가 균형을 지키는 이유를.",
      ] },
      { t: "say", speaker: "스칼렛", lines: ["모르겠습니다."] },
      { t: "say", speaker: "정리서의 주인", lines: ["그럼 계속 가라. 그것이 2기의 문이다."] },
      { t: "fade", out: false, ms: 600 },
      { t: "cam", rx: 0.5, ry: 0.3, panMs: 1200, zoom: 0.7 },
      { t: "say", speaker: "이야기꾼", lines: ["문 너머로 별이 보였다. 그리고 별들 사이로, 행성들이."] },
      { t: "say", speaker: "이야기꾼", lines: ["New Beginning, Not the End."] },
    ],
  },
};

/**
 * 챕터·구역 → 시나리오 매핑.
 *
 * 1기는 16편이지만 게임의 그랜드플래닛 前 챕터는 9개다(forest~abyss).
 * 그래서 편수를 **구역(sub)** 으로 나눠 배치한다 — 챕터당 1~2편.
 * 시나리오가 없는 구역은 이 연출을 건너뛰고 기존 흐름을 유지한다.
 */
export type LilacPlacement = { sub: number; id: string };

export const LILAC_CHAPTER_MAP: Record<string, LilacPlacement[]> = {
  /* ══════════════════════════════════════════════════════════════════════
   * vc234 (#2 "아뜰란티스 → 영준프린세스 → 그랜드 플레닛 순서인데 왜 스토리 섞음")
   *
   * [잘못된 배치 — 제거] 종전 이 표는 영프 16편을 **본편 챕터**(forest·kingdom·
   *  alfheim·muspelheim·niflheim·cave·nidavellir·hel·abyss)의 sub 1/5 에 끼워
   *  넣었다. 그 결과 본편(아뜰란티스 기반 1~10챕터)을 진행하다가 갑자기 라일락
   *  월드 컷씬이 튀어나와 **세계관·시간순이 뒤섞였다.** 영준 프린세스는 본편을
   *  끝낸 뒤 `youngprincessv` 마을에서 시작하는 **독립 편**이며, 본편과 같은
   *  챕터 키를 공유하지 않는다.
   *
   * [올바른 배치] 영프 편은 howlrstone1~5 로만 진행한다.
   *  각 장(章)의 sub 1 = 도입, sub 5 = 전환부에 시나리오를 둔다.
   *  (본편 키는 이제 하나도 매핑하지 않는다 — 본편엔 영프 연출이 없다)
   * ══════════════════════════════════════════════════════════════════════ */
  howlrstone1: [{ sub: 1, id: "lilac00" }, { sub: 5, id: "lilac01" }, { sub: 9, id: "lilac02" }],
  howlrstone2: [{ sub: 1, id: "lilac03" }, { sub: 5, id: "lilac04" }, { sub: 9, id: "lilac05" }],
  howlrstone3: [{ sub: 1, id: "lilac06" }, { sub: 5, id: "lilac07" }, { sub: 9, id: "lilac08" }],
  howlrstone4: [{ sub: 1, id: "lilac09" }, { sub: 5, id: "lilac10" }, { sub: 9, id: "lilac11" }],
  howlrstone5: [{ sub: 1, id: "lilac12" }, { sub: 5, id: "lilac13" }, { sub: 9, id: "lilac14" }, { sub: 10, id: "lilac15" }],
};

/** 챕터·구역에 해당하는 시나리오 id (없으면 null) */
export function lilacScenarioIdAt(ch: string | null | undefined, sub: number): string | null {
  if (!ch) return null;
  const list = LILAC_CHAPTER_MAP[ch];
  if (!list) return null;
  return list.find((p) => p.sub === sub)?.id ?? null;
}
