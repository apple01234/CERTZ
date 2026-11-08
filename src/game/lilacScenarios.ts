/** Existing-map direction, using Boot-preloaded body frames only. Story precedence:
 * evernote-approved/1 (Lilac + pendant), 2 (Haru's journey), 3/4 (abilities),
 * 5 (reconstruction), 6/7/8 (world links). No standalone campaign plot is imported. */
import type { CutStep } from "./fx/AutoCutscene";

export type LilacScenario = { id: string; chapter: number; title: string; steps: CutStep[] };

const BODY = {
  haru: "chm0", lilac: "chf2", dio: "chm3", riel: "chm4", vellica: "chf1",
  cartel: "chm1", lucy: "chf3", ari: "chf0", feron: "chm5", scarlet: "chf4", register: "chf5",
} as const;
const actor = (body: string, x = -34, y = 0) => ({
  tex: `${body}_idle0`, anim: `${body}-idle`, anchor: "feature" as const, x, y, fadeIn: true,
});
const cam = (focus: string, zoom: number, panMs = 780): CutStep => ({ t: "cam", focus, rx: 0.5, ry: 0.5, zoom, panMs });
const say = (speaker: string, ...lines: string[]): CutStep => ({ t: "say", speaker, lines });
const exit = (id: string): CutStep => ({ t: "exit", id, ms: 160 });

/** Each beat looks along the real entry→objective route before framing its actors. */
function directed(id: string, chapter: number, title: string, body: string, speaker: string, lines: string[], detail?: CutStep[]): LilacScenario {
  return { id, chapter, title, steps: [
    cam("entry", 0.88, 420),
    cam("feature", 0.8, 1100),
    { t: "enter", id: "lead", actor: actor(body, -46) },
    { t: "move", id: "lead", anchor: "feature", rx: -12, ry: 0, ms: 600 },
    cam("lead", 1.38, 520),
    say(speaker, ...lines),
    ...(detail ?? []),
    exit("lead"),
    cam("player", 1, 440),
  ] };
}

export const LILAC_SCENARIOS: Record<string, LilacScenario> = {
  lilac00: {
    id: "lilac00", chapter: 1, title: "세 가지 사람 · 절벽의 약속",
    steps: [
      cam("entry", 0.82, 520),
      say("하루 · 회상", "그날 절벽에서 나를 구해 준 사람의 이름은 라일락이었다."),
      { t: "enter", id: "haru", actor: actor(BODY.haru, -42, 22) },
      cam("feature", 0.9, 1050),
      { t: "enter", id: "lilac", actor: actor(BODY.lilac, 54, 0) },
      { t: "move", id: "lilac", anchor: "feature", rx: 5, ry: 8, ms: 850 },
      cam("lilac", 1.45, 520),
      say("라일락", "세상에는 세 가지 사람이 있어.", "누군가를 죽이는 사람과 두려움에 도망치는 사람, 그리고 그 죽음에서 누군가를 살리는 사람."),
      cam("haru", 1.4, 460),
      say("하루", "두려움에 도망치는 사람이 되고 싶어요. 제일 쉽고 편하잖아요."),
      cam("lilac", 1.35, 430),
      /* ═══ vc279 (P7c) — 중심 질문을 게임플레이로 연결 ═══
       * [지시서 요구] "중심 질문을 실제 게임플레이에 연결:
       *   '누군가를 죽이는 사람, 두려움에 도망치는 사람, 누군가를 살리는 사람.
       *    너는 어떤 사람이 되고 싶은가?'"
       * [구현] 라일락의 질문에 **플레이어가 직접 답한다**. 답은 storyChoices 에
       *  key="haruWho" 로 저장되고, 이후 시나리오·대사가 이 값을 읽어 분기한다.
       * [정본 근거] 1.txt: 하루는 "두려움에 도망치는 사람"이라 답했고, 라일락은
       *  "살리는 사람이 되었으면 좋겠어"라고 말한다. 선택지 3개는 그 대화의 세 갈래다.
       * [주의] 정본에 없는 **네 번째 갈래를 만들지 않는다**. 셋뿐이다. */
      {
        t: "choice",
        prompt: "너는 어떤 사람이 되고 싶니?",
        key: "haruWho",
        options: [
          { id: "kill", label: "누군가를 죽이는 사람" },
          { id: "flee", label: "두려움에 도망치는 사람" },
          { id: "save", label: "누군가를 살리는 사람" },
        ],
      },
      say("라일락", "나는 네가 누군가를 살리는 사람이 되었으면 좋겠어.", "이 펜던트가 너를 지켜 줄 거야. 기사단에 정식으로 들어와서 돌려줘."),
      { t: "move", id: "lilac", anchor: "feature", rx: 65, ry: -20, ms: 760 },
      exit("lilac"), exit("haru"), cam("player", 1, 500),
    ],
  },
  lilac01: directed("lilac01", 1, "펜던트가 가리킨 검", BODY.haru, "하루", [
    "성 안으로 들어갈수록 라일락의 펜던트가 밝게 빛났다.",
    "지하 감옥에서 검을 뽑자 섬광이 번졌다. 다시 눈을 떴을 때도 내 손에는 그 검이 있었다.",
  ], [{ t: "flash", color: 0xffedbf, ms: 180 }]),
  lilac02: directed("lilac02", 2, "돌아보아야 할 사람들", BODY.register, "레지스터", [
    "네가 이곳에 남아 있으면 마을도 위험해져. 우린 시스터즈의 아지트에서 버틸 수 있어.",
    "다른 왕국으로 가서 네가 무엇을 해야 할지 생각해 봐.",
  ]),
  lilac03: directed("lilac03", 3, "칼리야의 수련", BODY.riel, "리엘", [
    "그 검을 가진 네가 웨폰마스터라는 뜻이지. 먼저 원소를 몸에 순환시켜 봐.",
    "카피할 수 있는 원소를 늘리려면 다른 웨폰마스터를 만나야 해. 에벤트로 가 보거라.",
  ]),
  lilac04: directed("lilac04", 4, "천문대로 향하는 길", BODY.vellica, "벨리카", [
    "에벤트로 가는 길을 찾고 있어? 나도 대공립천문대에서 돌아가던 참이야.",
    "같이 가자. 리안 왕자와 아리가 네 수련을 도와줄 수 있을 거야.",
  ]),
  lilac05: directed("lilac05", 5, "석양으로 물든 바다", BODY.cartel, "카르텔", [
    "해롤드가 바다 괴물로 변했다. 백성들을 제2성으로 대피시켜라.",
    "이동석으로 에벤트에 가야 한다. 이제는 왕국들이 힘을 합쳐야 해.",
  ]),
  lilac06: directed("lilac06", 6, "루시의 상처", BODY.lucy, "하루", [
    "루시의 상처에 보석의 힘이 남아 있어요. 제가 흡수해 보겠습니다.",
    "모두를 도울 수 있다면 해 볼 거예요. 이번에는 도망치지 않겠어요.",
  ]),
  lilac07: directed("lilac07", 7, "이동석과 라시온", BODY.haru, "하루", [
    "라시온은 제가 막겠습니다. 먼저 이동석을 설치하세요.",
    "여기서 지면 소중한 사람들이 또 사라져요. 번개의 영역, 뇌전일섬!",
  ]),
  lilac08: directed("lilac08", 8, "아리와 페르온", BODY.ari, "아리", [
    "이 펜던트, 기억하지? 라일락이 남긴 것이야.",
    "네가 잃어버린 추억을 떠올려. 지금 널 붙잡고 있는 세뇌에서 돌아와.",
  ], [
    { t: "enter", id: "feron", actor: actor(BODY.feron, 38) },
    cam("feron", 1.4, 520), say("페르온", "라일락……."), exit("feron"),
  ]),
  lilac09: directed("lilac09", 9, "다시 모인 연합", BODY.riel, "리엘", [
    "반란군이 성 내부로 진입했어. 결계를 부술 때까지 우리가 시간을 벌어야 해.",
    "부상자들은 먼저 쉬어. 성급하게 움직이면 다시 같은 일을 겪게 될 거야.",
  ]),
  lilac10: directed("lilac10", 10, "성채의 비밀 통로", BODY.register, "시스터즈", [
    "최상층으로 갈 비밀 통로를 확보했어. 군단장의 사념체를 모두 상대할 필요는 없어.",
    "우리가 길을 열 테니 앞으로 가. 끝까지 너를 믿고 있어.",
  ]),
  lilac11: directed("lilac11", 11, "피의 영역", BODY.scarlet, "연합", [
    "스칼렛이 원소 공격을 흡수하고 있어. 피를 흡수하는 동안은 그녀도 원소를 쓰지 못해.",
    "하지만 지금은 달라. 닿은 곳이 어둠으로 물든다. 흡수가 아니라 잠식이야!",
  ]),
  lilac12: directed("lilac12", 12, "원소가 반응하는 순간", BODY.haru, "하루", [
    "카피한 원소를 한 사람이 반응시키면 새로운 원소를 만들 수 있다…….",
    "혼자 싸우는 게 아니었어. 모두가 다시 일어설 수 있도록, 제가 원소를 되돌리겠어요.",
  ]),
  lilac13: directed("lilac13", 13, "붙잡아야 할 일 분", BODY.feron, "페르온", [
    "일 분은 확실하게 잡아둘 수 있다. 내 영역은 상처를 주는 대신 저자를 가둘 거다.",
    "그 사이에 준비해. 우리가 지키려는 것은 아직 끝나지 않았어.",
  ]),
  lilac14: directed("lilac14", 14, "시간의 힘", BODY.riel, "리엘", [
    "되도록이면 이 힘을 쓰지 않으려고 했는데…….",
    "시간과 생명과 빛이 있는 한, 다시 돌릴 수 있어.",
  ], [{ t: "fade", out: true, ms: 280 }, { t: "fade", out: false, ms: 380 }]),
  lilac15: directed("lilac15", 15, "끝이 아닌 새로운 시작", BODY.haru, "이야기꾼", [
    "파괴된 것들이 돌아와도 함께한 시간과 추억까지 지워지지는 않았다.",
    "라일락 연합은 재건을 시작했다. 세르니움에서 온 연락은 그랜드 플레닛으로 이어질 다음 여정의 시작이었다.",
  ], [
    /* ═══ vc279 (P7c) — 첫 선택을 마지막에 **회수**한다 ═══
     * [왜] 선택지를 1막에 넣기만 하고 끝내면 게임플레이와 무관한 장식이 된다.
     *  지시서 요구는 "스토리를 텍스트 대화만으로 처리하지 말고 게임플레이와 연결".
     *  → 15장에서 하루가 자신의 시작을 되돌아보며, 플레이어가 고른 답을 그대로 말한다.
     *
     * [구현] `recall` 은 storyChoices[key] 값을 읽어 대사에 치환한다.
     *  저장된 선택이 없으면(구 세이브·스킵) 정본 기본값(flee)으로 떨어진다 —
     *  1.txt 에서 하루가 실제로 한 답이므로 임의 창작이 아니다. */
    {
      t: "say",
      speaker: "하루",
      /* recall 로 저장된 선택의 **라벨**을 넣는다. id("flee")가 아니라 표시 문구가 나가야 한다.
       * fallback 은 1.txt 에서 하루가 실제로 한 답("두려움에 도망치는 사람")이다. */
      recall: "haruWho",
      recallFallback: "두려움에 도망치는 사람",
      lines: [
        "절벽에서 라일락이 물었지. 세 가지 사람 중 어떤 사람이 되고 싶냐고.",
        "그때 나는 '{haruWho}' 라고 답했어.",
        "이제는 알아. 답은 한 번 정해지고 마는 게 아니라는 걸.",
      ],
    },
  ]),
};

export type LilacPlacement = { sub: number; id: string };
/** 15 chapters have 4–5 real fields. Never schedule scenes at nonexistent sub9/10. */
export const LILAC_CHAPTER_MAP: Record<string, LilacPlacement[]> = {
  howlrstone1: [{ sub: 1, id: "lilac00" }, { sub: 4, id: "lilac01" }],
  ...Object.fromEntries(Array.from({ length: 14 }, (_, index) => {
    const chapter = index + 2;
    return [`howlrstone${chapter}`, [{ sub: 1, id: `lilac${String(chapter).padStart(2, "0")}` }]];
  })),
};

export function lilacScenarioIdAt(ch: string | null | undefined, sub: number): string | null {
  if (!ch) return null;
  return LILAC_CHAPTER_MAP[ch]?.find((placement) => placement.sub === sub)?.id ?? null;
}
