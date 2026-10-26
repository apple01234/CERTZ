/**
 * vc147 (#19) — 제2궁극기 획득 스토리 퀘스트 "각성의 대가 (Price of Awakening)"
 *
 * 유저 지시: "220레벨에 5차 2번째 스킬을 아주 긴 스토리 퀘스트를 통해 획득 가능하게 해"
 *  + "#23 퀘스트 기믹/스토리 대량 추가" + "#24 4차 전직자에게 맞는 5차 스킬"
 *
 * 구조:
 *  · Lv.220 도달 + 카이엔 교관 대화로 수주 (5차 1차 궁극기는 기존대로 Lv.200)
 *  · 12단계 체인 — 대화/토벌/수집/보스/답사 기믹이 섞인 장편 스토리 (사연: 세계수의 기억)
 *  · 진행도는 세이브 저장(fifth2Step/fifth2Count/fifth2Done) — 언제든 이어서 진행
 *  · 완료 시 제2궁극기(Q키·보라 버튼) 해금 + 팬파레
 *
 * 순수 로직 모듈 — WorldScene이 이벤트(hunt/boss/collect/reach/talk)를 전달하면
 * 상태를 다음 단계로 진행시키고 안내 문구를 반환한다. Phaser 의존 0.
 */

/** 제2궁극기 스토리 퀘스트 수주 가능 레벨 (유저 지시 #19 — 220) */
export const FIFTH2_LEVEL = 220;

export type Fifth2EvKind = "hunt" | "boss" | "collect" | "reach" | "talk";
export type Fifth2StepType = Fifth2EvKind;

export type Fifth2Step = {
  type: Fifth2StepType;
  /** 퀘스트 로그 한 줄 제목 */
  title: string;
  /** 스토리 서사 (수주 시 대사 + 진행 안내) */
  story: string[];
  /** hunt: 적 키 / boss: BOSS_DEFS 키 / collect: 아이템·드롭 키 / reach: 스테이지 키 / talk: "jobmaster" 고정 */
  target: string;
  need: number;
  /** 완료 시 카이엔(또는 내레이션) 한 줄 */
  after: string;
};

/** 각성의 대가 — 12단계 체인 (장편 스토리) */
export const FIFTH2_CHAIN: Fifth2Step[] = [
  {
    type: "talk", target: "jobmaster", need: 1,
    title: "① 각성의 대가",
    story: [
      "카이엔: ...그 힘, 조심스럽게 눈을 뜨는군.",
      "카이엔: 각성이 인정한 자여 — 알려주지. 제2의 궁극은 '얻는' 것이 아니라 '치르는' 것이라는 걸.",
      "카이엔: 세계수가 기억한 시대의 흔적 12개. 그 기억을 모두 되짚어야 문이 열린다.",
      "카이엔: 첫 기억은 숲에 있다. 회색 늑대들이 세계수의 뿌리를 갉아먹은 시대 — 그 발톱에서 기억의 조각을 되찾아라.",
    ],
    after: "카이엔: 좋아, 시작이다. 기억은 반드시 네 발로 되짚어라.",
  },
  {
    type: "hunt", target: "wolf", need: 40,
    title: "② 뿌리를 갉는 발톱",
    story: ["첫 번째 기억 — 회색 늑대의 발톱에서 세계수의 상처를 지워라. (회색 늑대 40마리)"],
    after: "세계수의 잎이 한 뼘 다시 푸르러졌다.",
  },
  {
    type: "collect", target: "potion_hp", need: 8,
    title: "③ 상처를 데우는 물약",
    story: ["세계수의 상처를 씻을 붉은 물약 8개를 모아라. (HP 물약 8개 수집)"],
    after: "카이엔: 허드렛일 같지만 — 기억은 이런 것으로 쌓이는 법이지.",
  },
  {
    type: "reach", target: "muspelheim1", need: 1,
    title: "④ 화염의 대장간",
    story: ["두 번째 기억은 불겁니다. 라바이즈의 대장간에서 각성의 문양을 담을 그릇을 벼려라. (라바이즈 1-1 도달)"],
    after: "타오르는 도드람이 문양의 윤곽을 그렸다.",
  },
  {
    type: "boss", target: "surt", need: 1,
    title: "⑤ 화염의 군주의 심장불꽃",
    story: ["문양에 불을 지펴라. 수르트의 심장불꽃 없이는 그릇이 비어 있다. (수르트 격파)"],
    after: "수르트의 불꽃이 문양 안에서 살아 숨쉬기 시작했다.",
  },
  {
    type: "talk", target: "jobmaster", need: 1,
    title: "⑥ 중간 보고",
    story: [
      "카이엔: 불꽃이 살아있군. 하지만 불만으로는 부족해.",
      "카이엔: 기억에는 '바람'이 필요하다. 세계수가 지우지 못한 폭풍의 시대를 마주해라.",
    ],
    after: "카이엔: 폭풍이 몰아치는 곳으로 가라.",
  },
  {
    type: "hunt", target: "x2_firebird", need: 50,
    title: "⑦ 폭풍을 나는 날개",
    story: ["세 번째 기억 — 폭풍을 거스르는 날개의 기억. 화염조 50마리의 깃털 바람을 읽어라. (화염조 50마리)"],
    after: "깃털 바람이 문양의 불꽃을 눕히지 않고 감았다.",
  },
  {
    type: "collect", target: "potion_mp", need: 10,
    title: "⑧ 기억을 잇는 청록",
    story: ["끊어진 기억을 이을 청록 잉크. MP 물약 10개를 모아 문양에 새겨라. (MP 물약 10개 수집)"],
    after: "문양의 표면에 고대 문자가 떠올랐다.",
  },
  {
    type: "reach", target: "niflheim1", need: 1,
    title: "⑨ 얼어붙은 기억의 호수",
    story: ["네 번째 기억은 얼음 아래 잠들어 있다. 클로체스의 설원에서 정화 의식을 치러라. (클로체스 1-1 도달)"],
    after: "얼음 아래의 기억이 눈보라 속에서 눈을 떴다.",
  },
  {
    type: "boss", target: "fenrir", need: 1,
    title: "⑩ 서리늑대의 인장",
    story: ["기억을 삼키려는 굶주림 그 자체 — 펜리르를 쓰러뜨려 기억에 인장을 새겨라. (펜리르 격파)"],
    after: "펜리르의 포효가 인장이 되어 문양에 새겨졌다.",
  },
  {
    type: "hunt", target: "x3_goblin", need: 60,
    title: "⑪ 첫 기억으로의 회귀",
    story: ["마지막 기억은 '시작'이다. 고블린 60마리 — 네가 처음 칼을 든 그날의 기억을 되짚어라. (고블린 60마리)"],
    after: "모든 기억이 문양 안에서 하나의 문이 되었다.",
  },
  {
    type: "talk", target: "jobmaster", need: 1,
    title: "⑫ 각성의 대가",
    story: [
      "카이엔: ...다 치렀군. 12개의 기억, 하나의 문.",
      "카이엔: 이제 알겠지. 제2의 궁극은 힘이 아니라 '무게'다. 네가 걸어온 길의 무게.",
      "카이엔: 문을 열어라 — Q. 그것이 네 각성의 대가다.",
    ],
    after: "카이엔: 각성의 대가를 다 치른 자여 — 제2의 궁극이 네 것입니다.",
  },
];

export type Fifth2State = { step: number; count: number; done: boolean };

/** 수주 가능: 220레벨 + 미수주 + 미완료 */
export function fifth2Offerable(s: Fifth2State, lv: number): boolean {
  return !s.done && s.step === 0 && lv >= FIFTH2_LEVEL;
}
/** 진행 중 여부 */
export function fifth2Active(s: Fifth2State): boolean {
  return !s.done && s.step > 0 && s.step <= FIFTH2_CHAIN.length;
}
/** 현재 단계 (진행 중일 때만) */
export function fifth2Current(s: Fifth2State): Fifth2Step | null {
  return fifth2Active(s) ? FIFTH2_CHAIN[s.step - 1] : null;
}
/** 진행 상태 안내 문구 (HUD/대화용) */
export function fifth2ProgressText(s: Fifth2State): string {
  const cur = fifth2Current(s);
  if (!cur) return "";
  if (cur.type === "talk") return `${cur.title} — 카이엔 교관과 대화`;
  const label = cur.type === "hunt" ? "처치" : cur.type === "collect" ? "수집" : cur.type === "boss" ? "격파" : "도달";
  return `${cur.title} — ${label} ${Math.min(s.count, cur.need)}/${cur.need}`;
}

export type Fifth2Result = {
  /** 진행 변화 없음 (다른 단계의 이벤트) */
  matched: boolean;
  /** 단계 완료 → 다음 단계로 */
  advanced: boolean;
  /** 체인 전체 완료 → 제2궁극기 해금 */
  completed: boolean;
  /** 안내 문구 (배너/픽업텍스트) */
  message: string;
};

/** 이벤트 처리 — 상태를 직접 mutation (WorldScene이 save()를 이후 호출) */
export function fifth2Event(s: Fifth2State, ev: { kind: Fifth2EvKind; key: string }): Fifth2Result {
  const none: Fifth2Result = { matched: false, advanced: false, completed: false, message: "" };
  const cur = fifth2Current(s);
  if (!cur || cur.type !== ev.kind || cur.target !== ev.key) return none;
  s.count += 1;
  if (s.count < cur.need) {
    return { matched: true, advanced: false, completed: false, message: `${cur.title} ${s.count}/${cur.need}` };
  }
  /* 단계 완료 */
  s.count = 0;
  s.step += 1;
  if (s.step > FIFTH2_CHAIN.length) {
    s.done = true;
    return { matched: true, advanced: true, completed: true, message: "각성의 대가 완료 — 제2궁극기 해금!" };
  }
  return { matched: true, advanced: true, completed: false, message: `${cur.after} → ${FIFTH2_CHAIN[s.step - 1].title}` };
}
