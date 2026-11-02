/**
 * 영준 프린세스 편(하울르스톤) — 1기 15화 원문 기반 스테이지 데이터
 *
 * 왜 별도 모듈인가
 * ----------------
 * `stages.ts` 의 `CHAPTERS`(본편 9챕터 + 그랜드 플래닛 DLC 10챕터)는
 * `tests/story-portraits-audio.test.mjs` 가 "기존 챕터/인덱스/대사/밸런스 보존"으로
 * **불변식**을 걸어 둔 계약이다. 영프 편은 그 배열에 끼워 넣지 않고
 * **별도 배열 + 전용 밸런스 곡선(scaleMul)** 으로 덧붙인다.
 *
 * 이렇게 하면
 *  - 기존 저장키·진행 인덱스·챕터 순번이 한 글자도 바뀌지 않고
 *  - DLC 게이트(`storyProgression.MIDDLE_CHAPTER_IMPLEMENTED`)가
 *    `STORY_SEQUENCE.howlrstone.status` 변화만으로 자동 잠기며
 *  - 기존 빌드/세이브 유저에게 회귀가 생기지 않는다.
 *
 * 이 파일은 **런타임 의존이 없는 순수 데이터**다(stages.ts 를 값으로 import 하지 않는다).
 * stages.ts 가 이 데이터를 읽어 스테이지를 만들므로 모듈 순환(E SM cycle)이 생기지 않는다.
 *
 * 원문 근거 (기획서 1기 정리본)
 * ---------------------------
 *  1화  전설의 시작 — 왕립도서관, 「웨폰마스터를 위한 정리서」, 스칼렛의 왕조 탈환
 *  2화  어둠이 커지기 시작했을 때 — 에스테반 왕국, 아덴하르 총리, 에벤트왕국의 서신
 *  3화  시작된 전쟁 — 상어전함, 바다의 군단장 해롤드, 크라켄
 *  4화  석양으로 물든 바다 — 에벤트 왕국, 아리스텔라(아리)·에벤트이안(리안)
 *  5화  협상 그리고 연합 — 조선시대 왕국의 카시엘로아(시엘), 라일락 연합 결성
 *  6화  초월자 — 생명의 초월자 루시페르(루시), 인피니트보석의 자아
 *  7화  군단장들과의 전투 — 해롤드 / 베로니카·딘 / 엔젤릭 영프·거대 골렘
 *  8화  두 전사의 격전 — 페르온(다크엑스칼리버) vs 아리(솔라플레임이그니션소드)
 *  9화  과거의 향기는 라일락 꽃밭보다 진하다 — 라일락의 희생, 페르온의 합류
 * 10화  어둠의 성채 — 4개의 문(물·바람·번개·불), 스칼렛 환영 4체
 * 11화  어둠의 왕좌 — 빛의 아이온 / 어둠의 알다바오트
 * 12화  운명 — 저주 표식, 제르와 란의 장벽
 * 13화  최후의 일격 — 태양의 표식 각성, 스칼렛 격파
 * 14화  THE END TIME — 어둠의 완전체, 시간의 초월자
 * 15화  New Beginning Not the End — 세계 복구, 라일락 연합, 선발대 결성
 *
 * 원문에 없는 대사는 창작하지 않는다. 원문 문장을 그대로 쓰거나 시스템 안내
 * (퀘스트 설명·목표 라벨)만 새로 쓴다.
 */

/** 영프 편 챕터 키 — `howlrstone1` ~ `howlrstone5`. */
export type HowlrstoneChapterKey =
  | "howlrstone1" | "howlrstone2" | "howlrstone3" | "howlrstone4" | "howlrstone5";

/** 영프 편 보스 키 — 원문 등장 순서. */
export type HowlrstoneBossKey = "harold" | "verodin" | "feron" | "shadow" | "scarlet";

/**
 * 영프 편 보스 정의.
 * 신규 아트를 만들지 않고 기존 보스 아틀라스를 재사용한다(텍스처 키만 지정).
 */
export type HowlrstoneBossSpec = {
  key: HowlrstoneBossKey;
  name: string;
  /** 원문에서 이 보스가 등장하는 화 */
  episode: string;
  hp: number;
  atk: number;
  speed: number;
  exp: number;
  gold: number;
  /** 재사용할 기존 보스 아틀라스 키 */
  tex: string;
  orbTint: number;
  introDialogue: string;
  patterns: { p1: string[]; p2: string[]; p3: string[] };
  summonKey?: string;
  chargeChain?: number;
  sig?: string;
  aggr?: number;
};

export const HOWLRSTONE_BOSSES: Record<HowlrstoneBossKey, HowlrstoneBossSpec> = {
  /* 3화 "거대한 해적선이 나타났다 … 바다의 군단장 해롤드" → 크라켄.
   *  원문의 "수상전 최강 병기" 설정에 맞춰 원거리 탄막 위주. */
  harold: {
    key: "harold",
    name: "바다의 군단장 해롤드",
    episode: "3화 시작된 전쟁",
    hp: 46000, atk: 64, speed: 92, exp: 2800, gold: 1600,
    tex: "boss_jorm",
    orbTint: 0x5ad0ff,
    introDialogue: "bossIntroHarold",
    sig: "beam",
    aggr: 0.95,
    patterns: {
      p1: ["volley", "charge", "beam"],
      p2: ["volley", "charge", "ring", "zones", "beam", "spiral"],
      p3: ["slam", "charge", "volley", "ring", "zones", "summon", "beam", "spiral"],
    },
    summonKey: "x2_reeffish",
  },
  /* 7화 "조선시대 왕국에는 군단장 베로니카, 딘을 막기 위해 리안, 도사, 시엘이 갔다"
   *  주술 + 흑마법 — 소환과 저주 장판이 정체성. */
  verodin: {
    key: "verodin",
    name: "주술사 베로니카와 흑마법사 딘",
    episode: "7화 군단장들과의 전투",
    hp: 58000, atk: 69, speed: 96, exp: 3300, gold: 1800,
    tex: "boss_vord",
    orbTint: 0xc06aff,
    introDialogue: "bossIntroVerodin",
    sig: "summon",
    aggr: 0.9,
    patterns: {
      p1: ["volley", "zones", "summon"],
      p2: ["volley", "ring", "zones", "summon", "beam"],
      p3: ["slam", "volley", "ring", "zones", "summon", "beam", "spiral", "poisonfield"],
    },
    summonKey: "x3_necromancer",
  },
  /* 8화 "두 전사는 두 검을 맞대면서" — 다크엑스칼리버 + 검은드래곤의 영혼.
   *  근접 압박 + 돌진. */
  feron: {
    key: "feron",
    name: "페르슈타인 카르리온 — 다크엑스칼리버",
    episode: "8화 두 전사의 격전",
    hp: 74000, atk: 78, speed: 112, exp: 4100, gold: 2200,
    tex: "boss_gram",
    orbTint: 0x8a5aff,
    introDialogue: "bossIntroFeron",
    sig: "charge",
    aggr: 1.0,
    chargeChain: 2,
    patterns: {
      p1: ["slam", "charge", "volley"],
      p2: ["slam", "charge", "volley", "ring", "zones", "blinkslash"],
      p3: ["slam", "charge", "volley", "ring", "zones", "counter", "blink", "quake", "blinkslash"],
    },
    summonKey: "x2_darkhound",
  },
  /* 10화 "스칼렛이 자신의 군단장들에 힘으로 만든 4개의 자신의 환영들"
   *  물·바람·번개·불 4원소 — 원소 로테이션이 정체성. */
  shadow: {
    key: "shadow",
    name: "어둠의 성채 — 스칼렛의 환영",
    episode: "10화 어둠의 성채",
    hp: 92000, atk: 87, speed: 104, exp: 5100, gold: 2700,
    tex: "boss_skoll",
    orbTint: 0x66e0ff,
    introDialogue: "bossIntroShadow",
    sig: "ring",
    aggr: 0.95,
    patterns: {
      p1: ["volley", "charge", "ring", "frostnova"],
      p2: ["volley", "charge", "ring", "zones", "beam", "frostnova", "firepillars"],
      p3: ["slam", "charge", "volley", "ring", "zones", "summon", "beam", "spiral", "blink", "frostnova", "firepillars"],
    },
    summonKey: "wraith",
  },
  /* 11~14화 최종. 원문: "인피니트보석의 힘을 흡수한것 뿐만 아니라 피의힘과
   *  진정한 어둠에 힘을 손에넣고 … 초월자 2명과 뛰어난 영웅 3명이 덤벼들어도 지지 않을정도"
   *  → 전 패턴 종합 + 성역(holymantle). */
  scarlet: {
    key: "scarlet",
    name: "어둠의 군주 스칼렛",
    episode: "11~14화 어둠의 왕좌",
    hp: 130000, atk: 102, speed: 108, exp: 7200, gold: 3800,
    tex: "boss_abudditos",
    orbTint: 0xff3a6a,
    introDialogue: "bossIntroScarlet",
    sig: "holymantle",
    aggr: 0.85,
    chargeChain: 2,
    patterns: {
      p1: ["volley", "charge", "ring", "beam"],
      p2: ["volley", "charge", "ring", "zones", "summon", "beam", "spiral", "blink", "holymantle"],
      p3: ["slam", "charge", "volley", "ring", "zones", "summon", "beam", "spiral", "blink", "quake", "counter", "holymantle", "firepillars"],
    },
    summonKey: "helhound",
  },
};

/** 고정 스토리 비트 — 구역 번호에 원문 대사·퀘스트를 고정 배치한다. */
export type HowlrstoneBeat = {
  sub: number;
  /** 대사 키 (data.ts DIALOGUES) */
  dialogue: string;
  quest: {
    id: string;
    type: "collect" | "hunt" | "reach" | "boss" | "talk" | "level";
    title: string;
    desc: string;
    need?: number;
    /** 몬스터 키 — stages.ts 가 ENEMIES 로 라벨을 해석한다 */
    targetKey?: string;
    targetLabel: string;
    reward?: number;
    expReward?: number;
  };
};

export type HowlrstoneChapterSpec = {
  key: HowlrstoneChapterKey;
  /** 카드/목록 표기 — "영프 N장 — 제목" */
  title: string;
  subtitle: string;
  /** 대응 원문 화 범위 */
  episodes: string;
  intro: string;
  boss: HowlrstoneBossKey;
  bossDone: string;
  width: number;
  height: number;
  groundTint: number;
  groundTex: string;
  pathTex: string;
  bg: string;
  flowers: number;
  trees: number;
  rocks: number;
  enemies: { key: string; count: number }[];
  /** 반복 의뢰 대표 종 */
  main: string;
  beats: HowlrstoneBeat[];
  repeat: { need: number; gold: number; exp: number; title: string; desc: string };
  /** 5장 기준 레벨 게이트 — 본편 클리어(126레벨+) 이후를 전제한다. */
  lvGate: { enter: number; mid: number };
  /** 전용 밸런스 곡선 — `stageScale` 이 이 값을 우선 사용한다(기존 곡선 무영향). */
  scaleMul: { hp: number; atk: number; exp: number; gold: number };
};

/** 보상 계수 — 본편 `G` 와 동일 규칙. */
const G = 0.8;

/**
 * 영프 편 챕터 5개 = 1기 15화.
 * 화를 3화씩 묶었다(원문 막 구조와 일치): 1~3 / 4~6 / 7~9 / 10~12 / 13~15화.
 */
export const HOWLRSTONE_CHAPTERS: HowlrstoneChapterSpec[] = [
  {
    key: "howlrstone1",
    title: "영프 1장 — 전설의 시작",
    subtitle: "라일락 월드 · 왕립도서관에서 시작된 전쟁",
    episodes: "1화~3화",
    intro: "chapterIntroHowlrstone1",
    boss: "harold",
    bossDone: "howlrstone1Done",
    width: 2000, height: 1120, groundTint: 0x8ad0ff,
    groundTex: "tile_grass", pathTex: "tile_path", bg: "#0a1a26",
    flowers: 8, trees: 8, rocks: 6,
    enemies: [
      { key: "x2_frog", count: 4 }, { key: "x2_reeffish", count: 4 },
      { key: "swampbeast", count: 3 }, { key: "x3_goblin", count: 3 },
      { key: "x2_rat", count: 3 }, { key: "minion", count: 3 },
    ],
    main: "x2_reeffish",
    beats: [
      { sub: 2, dialogue: "howlBook", quest: { id: "hw1", type: "collect", title: "웨폰마스터를 위한 정리서", desc: "왕립도서관에서 머리 위로 툭 떨어진 책 — 웨폰마스터가 되는 세 가지 경우가 적혀 있다. 페이지를 모아라.", targetLabel: "정리서의 페이지", reward: Math.round(2600 * G), expReward: 4200 } },
      { sub: 4, dialogue: "howlLetter", quest: { id: "hw2", type: "hunt", title: "석양이 바다를 집어 삼키는 꿈", desc: "아덴하르 총리는 기계 오작동이라 했지만 카르텔 국왕은 아니라고 했다. 해변을 어지럽힌 잔당을 소탕해라.", need: 10, targetKey: "x2_reeffish", targetLabel: "해변의 잔당", reward: Math.round(2900 * G), expReward: 4600 } },
      { sub: 6, dialogue: "howlWar", quest: { id: "hw3", type: "hunt", title: "거대한 해적선", desc: "성이 전함으로 변하고 상어전함들이 맞섰다. 그때 거대한 해적선이 나타났다 — 바다의 군단장 해롤드다.", need: 8, targetKey: "swampbeast", targetLabel: "해롤드의 부하", reward: Math.round(3100 * G), expReward: 5000 } },
      { sub: 9, dialogue: "", quest: { id: "hw4", type: "collect", title: "[사연] 제2의 성으로 가는 이동석", desc: "카르텔의 명령 — 폭풍지역을 넘어 제2의 성으로. 에벤트왕국으로 갈 수 있는 이동석을 찾아라.", targetLabel: "이동석의 좌표", reward: Math.round(3300 * G), expReward: 5400 } },
      /* vc234 (#5 "영준 프린세스 1-10 보스 안나옴") — 보스 퀘스트가 체인에 없어서
     *  WorldScene 의 보스 스폰 조건(`q.type === "boss"`)이 영원히 성립하지 않았다.
     *  10구역에 도달해도 보스가 나오지 않고, 따라서 포탈도 열리지 않았다.
     *  → 마지막 구역에 [보스] + [다음 해역] 두 단계를 반드시 넣는다(본편과 동일 규칙). */
    { sub: 10, dialogue: "", quest: { id: "hw5", type: "collect", title: "[기믹] 크라켄의 먹물", desc: "저주받은 바다의 힘, 크라켄이 모든 것을 부수고 다녔다. 바다에 흩어진 크라켄의 먹물을 거둬 고대의 힘을 끊어라.", targetLabel: "크라켄의 먹물", reward: Math.round(3800 * G), expReward: 6100 } },
    { sub: 10, dialogue: "", quest: { id: "hw5b", type: "boss", title: "바다의 군단장 해롤드", desc: "먹물의 근원을 끊었다. 이제 크라켄으로 변한 해롤드를 베어라.", targetLabel: "해롤드", reward: Math.round(4200 * G), expReward: 7200 } },
    { sub: 10, dialogue: "howlrstone1Done", quest: { id: "hw5c", type: "reach", title: "다음 해역으로", desc: "열린 차원문에 닿아 다음 해역으로 이동해라.", targetLabel: "차원문" } },
    ],
    repeat: { need: 28, gold: Math.round(210 * G), exp: 210, title: "[반복] 해변 순찰", desc: "석양으로 물든 바다 — 해안선을 계속 지켜야 한다." },
    lvGate: { enter: 130, mid: 140 },
    scaleMul: { hp: 9.0, atk: 3.1, exp: 26000.0, gold: 5.6 },
  },
  {
    key: "howlrstone2",
    title: "영프 2장 — 석양으로 물든 바다",
    subtitle: "라일락 월드 · 에벤트왕국, 라일락 연합의 결성",
    episodes: "4화~6화",
    intro: "chapterIntroHowlrstone2",
    boss: "verodin",
    bossDone: "howlrstone2Done",
    width: 2100, height: 1160, groundTint: 0xd8b98a,
    groundTex: "tile_grass2", pathTex: "tile_garden", bg: "#1a1208",
    flowers: 10, trees: 9, rocks: 7,
    enemies: [
      { key: "x3_chort", count: 4 }, { key: "x3_imp", count: 4 },
      { key: "wraith", count: 3 }, { key: "x3_necromancer", count: 3 },
      { key: "x2_bat", count: 3 }, { key: "x3_maskedorc", count: 3 },
    ],
    main: "x3_imp",
    beats: [
      { sub: 2, dialogue: "howlAri", quest: { id: "hw6", type: "hunt", title: "근위대장 아리스텔라", desc: "\"아직 움직이지 마십시오 카르텔국왕\" — 근위대장 아리가 부상자를 지키는 동안 앞길을 막은 자들을 처리해라.", need: 10, targetKey: "x3_imp", targetLabel: "에벤트왕국 습격자", reward: Math.round(3000 * G), expReward: 4700 } },
      { sub: 4, dialogue: "howlDokkaebi", quest: { id: "hw7", type: "hunt", title: "도깨비의 협박", desc: "가는 도중 도깨비가 나와 가진 것을 탈하려고 협박했다. 부채 소리와 함께 분신이 도깨비를 물리쳤다.", need: 10, targetKey: "x3_chort", targetLabel: "도깨비 무리", reward: Math.round(3300 * G), expReward: 5100 } },
      { sub: 6, dialogue: "howlAlliance", quest: { id: "hw8", type: "collect", title: "라일락 연합", desc: "화해와 연합이 필요하다고 생각한 두 왕국이 라일락 연합을 만들었다. 모든 나라의 이름을 적어라.", targetLabel: "연합 서명", reward: Math.round(3500 * G), expReward: 5500 } },
      { sub: 9, dialogue: "howlLuci", quest: { id: "hw9", type: "collect", title: "[사연] 라이트 보석의 파편", desc: "라이트 보석이 약간 부서져서 파편이 있고, 그걸 마시니 움직일 수 있었다. 남은 파편을 찾아라.", targetLabel: "라이트 보석의 파편", reward: Math.round(3800 * G), expReward: 6000 } },
      { sub: 10, dialogue: "", quest: { id: "hw10", type: "hunt", title: "[기믹] 어둠의 왕좌가 도래하기까지", desc: "\"지금 우리쪽으로 오는 자는 살려 주겠다. 대신에 나머지는 전부 죽음이다\" — 스칼렛의 첩자를 베어라.", need: 8, targetKey: "x3_necromancer", targetLabel: "스칼렛의 첩자", reward: Math.round(4200 * G), expReward: 6700 } },
    ],
    repeat: { need: 30, gold: Math.round(230 * G), exp: 230, title: "[반복] 연합 순찰", desc: "라일락 연합의 임무 — 각 왕국을 계속 오가야 한다." },
    lvGate: { enter: 146, mid: 156 },
    scaleMul: { hp: 12.4, atk: 3.7, exp: 48000.0, gold: 6.4 },
  },
  {
    key: "howlrstone3",
    title: "영프 3장 — 두 전사의 격전",
    subtitle: "라일락 월드 · 군단장 전선과 라일락의 추억",
    episodes: "7화~9화",
    intro: "chapterIntroHowlrstone3",
    boss: "feron",
    bossDone: "howlrstone3Done",
    width: 2200, height: 1200, groundTint: 0xb08ad8,
    groundTex: "tile_moss", pathTex: "tile_stone", bg: "#140a1e",
    flowers: 12, trees: 6, rocks: 9,
    enemies: [
      { key: "x3_ogre", count: 4 }, { key: "x3_orcwarrior", count: 4 },
      { key: "x2_darkhound", count: 3 }, { key: "x3_bigzombie", count: 3 },
      { key: "x3_wogol", count: 3 }, { key: "x3_orcshaman", count: 3 },
    ],
    main: "x3_orcwarrior",
    beats: [
      { sub: 2, dialogue: "howlGolem", quest: { id: "hw11", type: "hunt", title: "엔젤릭 영프와 거대한 골렘", desc: "근위대장이 더 이상 막기 어려운 것 같았다 — 엔젤릭 영프와 거대한 골렘이 있었기 때문이다. 골렘을 무너뜨려라.", need: 10, targetKey: "x3_ogre", targetLabel: "거대한 골렘", reward: Math.round(3400 * G), expReward: 5200 } },
      { sub: 4, dialogue: "howlRiande", quest: { id: "hw12", type: "hunt", title: "\"3분뒤에 보시죠\"", desc: "리안이 차크람을 던지고 이현이 도술을 사용했다. 2대2 교전에서 베로니카의 부하들을 쓸어라.", need: 8, targetKey: "x3_wogol", targetLabel: "베로니카의 부하", reward: Math.round(3800 * G), expReward: 5800 } },
      { sub: 6, dialogue: "howlSwords", quest: { id: "hw13", type: "hunt", title: "두 전사의 격전", desc: "서로의 검이 맞댈수록 천둥과 땅이 갈라졌다. 검은 드래곤의 잔재를 베어라.", need: 8, targetKey: "x2_darkhound", targetLabel: "검은 드래곤의 잔재", reward: Math.round(4200 * G), expReward: 6400 } },
      { sub: 9, dialogue: "howlLilac", quest: { id: "hw14", type: "collect", title: "[사연] 과거의 향기는 라일락 꽃밭보다 진하다", desc: "\"꽃말이 추억이라… 너의 이름을 부르는 사람마다 추억이 되라고 이름을 지었어\" — 꽃밭에 남은 추억을 모아라.", targetLabel: "라일락의 추억", reward: Math.round(4600 * G), expReward: 7000 } },
      { sub: 10, dialogue: "", quest: { id: "hw15", type: "hunt", title: "[기믹] 어둠의 왕좌로 가는 길", desc: "페르온이 말했다 \"어둠에 왕좌로 가는 길은 내가 잘 알아 나도 돕지\" — 길을 막는 자들을 베어라.", need: 8, targetKey: "x3_bigzombie", targetLabel: "왕좌의 수문장", reward: Math.round(5000 * G), expReward: 7800 } },
    ],
    repeat: { need: 32, gold: Math.round(260 * G), exp: 260, title: "[반복] 군단장 전선", desc: "각 왕국에 배치된 군단장들 — 계속 부대를 소모시켜라." },
    lvGate: { enter: 164, mid: 174 },
    scaleMul: { hp: 16.8, atk: 4.4, exp: 90000.0, gold: 7.4 },
  },
  {
    key: "howlrstone4",
    title: "영프 4장 — 어둠의 성채",
    subtitle: "라일락 월드 · 4개의 문, 그리고 운명",
    episodes: "10화~12화",
    intro: "chapterIntroHowlrstone4",
    boss: "shadow",
    bossDone: "howlrstone4Done",
    width: 2300, height: 1250, groundTint: 0x6a4a9a,
    groundTex: "tile_morgue", pathTex: "tile_deep", bg: "#0d0616",
    flowers: 0, trees: 0, rocks: 12,
    enemies: [
      { key: "wraith", count: 4 }, { key: "minion", count: 4 },
      { key: "helhound", count: 3 }, { key: "x3_necromancer", count: 3 },
      { key: "x3_bigzombie", count: 3 }, { key: "x2_reeffish", count: 3 },
    ],
    main: "wraith",
    beats: [
      { sub: 2, dialogue: "howlFourDoors", quest: { id: "hw16", type: "hunt", title: "첫 번째 문 — 물의 스칼렛", desc: "4개의 문을 클리어해야만 스칼렛이 있는 어둠의 왕좌로 갈 수 있다. 첫 번째 문의 수호자들을 처치하라.", need: 10, targetKey: "wraith", targetLabel: "물의 문 수호자", reward: Math.round(3600 * G), expReward: 5600 } },
      { sub: 4, dialogue: "howlWindDoor", quest: { id: "hw17", type: "hunt", title: "두 번째 문 — 바람의 스칼렛", desc: "루시가 만든 풀의 장막과 란이 만든 그림 몬스터로 공격을 막고 리안이 공격했다. 두 번째 문을 열어라.", need: 8, targetKey: "x2_reeffish", targetLabel: "바람의 문 수호자", reward: Math.round(4000 * G), expReward: 6200 } },
      { sub: 6, dialogue: "howlBalloon", quest: { id: "hw18", type: "collect", title: "그림 열기구", desc: "스칼렛이 가는 길을 끊었다. 란과 루시의 힘을 합쳐 그림 열기구를 만들 재료를 모아라.", targetLabel: "그림의 재료", reward: Math.round(4400 * G), expReward: 6800 } },
      { sub: 8, dialogue: "howlIon", quest: { id: "hw19", type: "hunt", title: "빛의 아이온 · 어둠의 알다바오트", desc: "라이트와 다크니스보석이 형체화된 존재가 그들을 위협했다. 형체를 흩어라.", need: 8, targetKey: "helhound", targetLabel: "형체화된 보석의 파편", reward: Math.round(5000 * G), expReward: 7600 } },
      { sub: 9, dialogue: "howlCurse", quest: { id: "hw20", type: "collect", title: "[사연] 저주의 표식", desc: "베로니카, 시엘, 딘이 저주의 표식을 맞아 힘을 잃어갔다. 표식의 근원을 찾아라.", targetLabel: "저주의 표식", reward: Math.round(5400 * G), expReward: 8200 } },
      { sub: 10, dialogue: "", quest: { id: "hw21", type: "hunt", title: "[기믹] 남은 6명", desc: "남은 인원은 도사, 루시, 리안, 아리, 란, 제르까지 6명뿐. 스칼렛이 흡수한 군세를 끊어라.", need: 8, targetKey: "x3_bigzombie", targetLabel: "흡수된 군세", reward: Math.round(6000 * G), expReward: 9000 } },
    ],
    repeat: { need: 34, gold: Math.round(300 * G), exp: 300, title: "[반복] 성채 정찰", desc: "어둠의 성채가 계속 군대를 만들어낸다 — 계속 베어내야 한다." },
    lvGate: { enter: 184, mid: 194 },
    scaleMul: { hp: 22.5, atk: 5.2, exp: 170000.0, gold: 8.6 },
  },
  {
    key: "howlrstone5",
    title: "영프 5장 — 최후의 일격",
    subtitle: "라일락 월드 · 어둠의 왕좌, 그리고 New Beginning",
    episodes: "13화~15화",
    intro: "chapterIntroHowlrstone5",
    boss: "scarlet",
    bossDone: "howlrstone5Done",
    width: 2400, height: 1300, groundTint: 0x9a3030,
    groundTex: "tile_blood", pathTex: "tile_basalt", bg: "#1c0606",
    flowers: 0, trees: 0, rocks: 14,
    enemies: [
      { key: "helhound", count: 4 }, { key: "x2_darkhound", count: 4 },
      { key: "x3_bigzombie", count: 3 }, { key: "x3_necromancer", count: 3 },
      { key: "x3_wogol", count: 3 }, { key: "minion", count: 3 },
    ],
    main: "helhound",
    beats: [
      { sub: 2, dialogue: "howlSunMark", quest: { id: "hw22", type: "collect", title: "태양의 표식", desc: "보석이 깨지면서 태양의 표식이 검에 새겨졌다. 라일락 월드에 있는 모든 자의 염원을 모아라.", targetLabel: "라일락의 염원", reward: Math.round(4200 * G), expReward: 6600 } },
      { sub: 4, dialogue: "howlEndTime", quest: { id: "hw23", type: "hunt", title: "THE END TIME", desc: "\"내가 이것만으로 끝날것이라고 생각하는거야?\" — 라일락월드의 반을 삼킨 어둠을 밀어내라.", need: 10, targetKey: "helhound", targetLabel: "삼켜진 자들", reward: Math.round(4800 * G), expReward: 7400 } },
      { sub: 6, dialogue: "howlTimeRuler", quest: { id: "hw24", type: "hunt", title: "시간의 초월자", desc: "도사가 부채를 던지더니 긴 총이 되었다. 검을 머리 위에서 아래로 쓸어 내리더니 시간의 초월자로 변했다.", need: 10, targetKey: "x2_darkhound", targetLabel: "멈춘 시간의 잔영", reward: Math.round(5400 * G), expReward: 8200 } },
      { sub: 8, dialogue: "howlNewBeginning", quest: { id: "hw25", type: "collect", title: "라일락 연합의 탄생", desc: "완전히 5왕국이 서로 싸우지 않고 연합의 임무로 파견될 수 있도록. 연합의 증표를 세워라.", targetLabel: "연합의 증표", reward: Math.round(6000 * G), expReward: 9000 } },
      { sub: 9, dialogue: "howlSerniumCall", quest: { id: "hw26", type: "collect", title: "[사연] 세르니움에서 온 연락", desc: "그랜드 플래닛에 있는 세르니움에서 에벤트왕국에 연락이 왔다. 파견 선발대를 준비하라.", targetLabel: "선발대 편성표", reward: Math.round(6600 * G), expReward: 9800 } },
      { sub: 10, dialogue: "", quest: { id: "hw27", type: "hunt", title: "[기믹] 남은 어둠", desc: "보석의 힘과 각자의 힘, 무수히 많은 시간과 추억들은 완전히 리셋되지 않았다. 남은 어둠을 걷어라.", need: 8, targetKey: "x3_wogol", targetLabel: "남은 어둠", reward: Math.round(7400 * G), expReward: 10800 } },
    ],
    repeat: { need: 36, gold: Math.round(340 * G), exp: 340, title: "[반복] 왕좌 수복", desc: "어둠의 왕좌가 무너졌다 — 남은 잔재를 계속 정화하자." },
    lvGate: { enter: 204, mid: 214 },
    scaleMul: { hp: 30.0, atk: 6.2, exp: 320000.0, gold: 10.0 },
  },
];

/** 영프 편 첫 구역 — `youngprincessv` 마을에서 이리로 들어간다. */
export const HOWLRSTONE_ENTRY = "howlrstone11" as const;
/** 영프 편 마지막 구역 — 이 보스를 잡으면 `youngPrincessCleared` 가 선다. */
export const HOWLRSTONE_FINAL = "howlrstone510" as const;

/** 영프 편 챕터 키 목록 (다른 모듈의 순회용). */
export const HOWLRSTONE_KEYS = HOWLRSTONE_CHAPTERS.map((c) => c.key);
