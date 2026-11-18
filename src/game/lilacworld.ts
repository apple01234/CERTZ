import { CHAPTER_STORY_PLAN } from "./chapterStoryPlan";
/**
 * 영준 프린세스 편(영프) — 라일락 월드 15장 스테이지 데이터
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
 *    `STORY_SEQUENCE.lilacworld.status` 변화만으로 자동 잠기며
 *  - 기존 빌드/세이브 유저에게 회귀가 생기지 않는다.
 *
 * 이 파일은 **런타임 의존이 없는 순수 데이터**다(stages.ts 를 값으로 import 하지 않는다).
 * stages.ts 가 이 데이터를 읽어 스테이지를 만들므로 모듈 순환(E SM cycle)이 생기지 않는다.
 *
 * 장 순서·장소·보스는 chapterStoryPlan.ts 가 정한다(정본 1.txt → 2.txt 순서).
 * 이 파일의 title/subtitle/boss 는 파일 끝에서 그 계획으로 덮어쓴다.
 *
 * 원문에 없는 대사는 창작하지 않는다. 원문 문장을 그대로 쓰거나 시스템 안내
 * (퀘스트 설명·목표 라벨)만 새로 쓴다.
 */

/** 영프 편 챕터 키 — `lilacworld1` ~ `lilacworld15`.
 *  vc235 — 원문 1기 15화를 **1화 = 1챕터**로 맞췄다(종전엔 3화씩 묶어 5챕터).
 *  유저 지적: "영프 스토리 10챕터인데 10스테이지로 만든 것 같다" →
 *  화 단위가 곧 챕터 단위여야 한다.
 *
 *  [스테이지 키] 챕터당 스테이지가 여러 개이므로 `lilacworld{장}x{구역}` 을 쓴다.
 *   `lilacworld11` 처럼 붙여 쓰면 챕터가 두 자리가 된 순간 "1장 1구역"인지
 *   "11장"인지 구분할 수 없다. 구분자 x 를 넣어 파싱을 명확히 한다.
 *   예) lilacworld1x1 … lilacworld1x6, lilacworld15x5 */
export type LilacworldChapterKey =
  | "lilacworld1" | "lilacworld2" | "lilacworld3" | "lilacworld4" | "lilacworld5"
  | "lilacworld6" | "lilacworld7" | "lilacworld8" | "lilacworld9" | "lilacworld10"
  | "lilacworld11" | "lilacworld12" | "lilacworld13" | "lilacworld14" | "lilacworld15";

/** 영프 편 보스 키 — 원문 등장 순서. */
export type LilacworldBossKey = "harold" | "verodin" | "feron" | "shadow" | "scarlet" | "dio" | "rasion" | "desknis" | "scarlet_blood" | "scarlet_dark" | "scarlet_seal";

/**
 * 영프 편 보스 정의.
 * 신규 아트를 만들지 않고 기존 보스 아틀라스를 재사용한다(텍스처 키만 지정).
 */
export type LilacworldBossSpec = {
  key: LilacworldBossKey;
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

export const LILACWORLD_BOSSES: Record<LilacworldBossKey, LilacworldBossSpec> = {
  /* 유저 지시 — "초반 보스 디오 난이도가 지나치게 높다. 학습과 회피가 가능한 수준으로".
   *
   *  [실측 진단] 변경 전 실효 HP = 24000 × scaleMul.hp 1.65 = **39,600**.
   *  Lv20(초반 예상 레벨, 강철 검 atk6) 기준 기본공격 1타 ≈ 94 → **422타 / 약 211초**.
   *  초반 보스가 3분半 넘게 걸리는 것은 "학습 구간"이 아니라 체력 노가다이며,
   *  패턴을 배우기 전에 지치는 구조다. (다른 초반 보스 해롤드 46,000 은
   *   이미 Lv40+ 구간이라 같은 기준으로 비교되지 않는다.)
   *
   *  [조정] hp 24000 → 12000. 실효 HP 19,800 → Lv20 기준 약 210타 / **105초**.
   *  - 체력만 낮추고 ATK·speed·패턴은 그대로 둔다: 보스의 정체성(사념체 소환 +
   *    돌진 + 장판)과 위협감은 유지하고, "몇 번 시도하면 패턴이 읽히는" 길이만 만든다.
   *  - 회피 수단은 이미 있다(독립 대시 1초 쿨 + 벽 충돌 스윕). 체력을 줄여
   *    대시로 흘리며 딜하는 학습 루프가 성립하게 한다.
   *  - 보상(exp/gold)은 유지 — 난이도만 손보고 파밍 효율은 건드리지 않는다. */
  dio: { key: "dio", name: "디오 · 다크니스 크리스탈의 힘", episode: "1.txt 마을 습격", hp: 12000, atk: 48, speed: 92, exp: 1800, gold: 900, tex: "cast_dio", orbTint: 0x8e62b4, introDialogue: "bossIntroDio", sig: "summon", patterns: { p1: ["charge", "summon"], p2: ["summon", "zones", "charge"], p3: ["summon", "zones", "charge", "ring"] }, summonKey: "wraith" },
  rasion: { key: "rasion", name: "고대의 재앙 라시온", episode: "2.txt:121-125", hp: 65000, atk: 74, speed: 132, exp: 3700, gold: 1900, tex: "cast_rasion", orbTint: 0x9a93be, introDialogue: "bossIntroRasion", sig: "counter", chargeChain: 2, patterns: { p1: ["charge", "counter"], p2: ["charge", "counter", "blinkslash"], p3: ["charge", "counter", "blinkslash", "slam"] } },
  desknis: { key: "desknis", name: "고대의 공포 데스크니스", episode: "2.txt:247-301", hp: 145000, atk: 106, speed: 102, exp: 8500, gold: 4100, tex: "story_desknis", orbTint: 0x685188, introDialogue: "bossIntroDesknis", sig: "zones", patterns: { p1: ["zones", "blinkslash"], p2: ["zones", "blinkslash", "beam"], p3: ["zones", "blinkslash", "beam", "portalteleport"] } },
  scarlet_blood: { key: "scarlet_blood", name: "스칼렛 · 원혈과 피의 영역", episode: "2.txt:162-166", hp: 105000, atk: 88, speed: 112, exp: 5700, gold: 3000, tex: "cast_scarlet", orbTint: 0xd34c66, introDialogue: "bossIntroScarletBlood", sig: "ring", patterns: { p1: ["blinkslash", "ring"], p2: ["blinkslash", "ring", "volley"], p3: ["blinkslash", "ring", "volley", "zones"] } },
  scarlet_dark: { key: "scarlet_dark", name: "스칼렛 · 어둠의 잠식", episode: "2.txt:165-205", hp: 117000, atk: 94, speed: 114, exp: 6300, gold: 3300, tex: "cast_scarlet", orbTint: 0x78529d, introDialogue: "bossIntroScarletDark", sig: "zones", patterns: { p1: ["zones", "blinkslash"], p2: ["zones", "blinkslash", "beam"], p3: ["zones", "blinkslash", "beam", "ring"] } },
  scarlet_seal: { key: "scarlet_seal", name: "스칼렛 · 봉쇄된 영역", episode: "2.txt:208-241", hp: 120000, atk: 98, speed: 110, exp: 6800, gold: 3500, tex: "cast_scarlet", orbTint: 0xb15593, introDialogue: "bossIntroScarletSeal", sig: "counter", patterns: { p1: ["counter", "blinkslash"], p2: ["counter", "blinkslash", "zones"], p3: ["counter", "blinkslash", "zones", "ring"] } },
  /* 에스테반 전선의 해롤드(크라켄). 원거리 탄막 위주. */
  harold: {
    key: "harold",
    name: "바다의 군단장 해롤드",
    episode: "2.txt:109-110 에스테반 전선",
    hp: 46000, atk: 64, speed: 92, exp: 2800, gold: 1600,
    tex: "cast_harold",
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
  /* 칼리야 이동석 진지의 딘과 베로니카. 소환과 저주 장판. */
  verodin: {
    key: "verodin",
    name: "주술사 베로니카와 흑마법사 딘",
    episode: "2.txt:113-117 칼리야 이동석 진지",
    hp: 58000, atk: 69, speed: 96, exp: 3300, gold: 1800,
    tex: "cast_veronica",
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
  /* 에벤트의 페르온. 근접 압박과 돌진. */
  feron: {
    key: "feron",
    name: "페르슈타인 카르리온 — 다크엑스칼리버",
    episode: "2.txt:127-148 에벤트의 격전",
    hp: 74000, atk: 78, speed: 112, exp: 4100, gold: 2200,
    tex: "cast_feron",
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
    tex: "cast_feron",
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
    tex: "cast_scarlet",
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
    summonKey: "duskhound",
  },
};

/** 고정 스토리 비트 — 구역 번호에 원문 대사·퀘스트를 고정 배치한다. */
export type LilacworldBeat = {
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

export type LilacworldChapterSpec = {
  key: LilacworldChapterKey;
  /** 카드/목록 표기 — "영프 N장 — 제목" */
  title: string;
  subtitle: string;
  /** 대응 원문 화 범위 (1화 = 1챕터이므로 보통 "N화") */
  episodes: string;
  /** 이 챕터의 스테이지 수 — 챕터마다 다르다(원문 분량에 맞춤).
   *  vc235: 종전엔 전 챕터 10개 고정이었는데, 1화짜리 챕터에 10구역은 과했다.
   *  마지막 스테이지가 보스전이다. */
  stages: number;
  intro: string;
  /** 이 챕터의 보스. null 이면 보스전이 없다(일반 토벌로 끝난다).
   *  vc235: 15챕터로 늘리면서 보스가 없는 화(1·2·4·5·6·9·11·12·13·15장)가 생겼다. */
  boss: LilacworldBossKey | null;
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
  beats: LilacworldBeat[];
  repeat: { need: number; gold: number; exp: number; title: string; desc: string };
  /** 5장 기준 레벨 게이트 — 본편 클리어(126레벨+) 이후를 전제한다. */
  lvGate: { enter: number; mid: number };
  /** 전용 밸런스 곡선 — `stageScale` 이 이 값을 우선 사용한다(기존 곡선 무영향). */
  scaleMul: { hp: number; atk: number; exp: number; gold: number };
};

/** 보상 계수 — 본편 `G` 와 동일 규칙. */
const G = 0.64; // 2026-11-14 — 퀘스트 골드 −20% (유저 지시 "골드가 너무 많음", 종전 0.8)

/**
 * 영프 편 챕터 5개 = 1기 15화.
 * 화를 3화씩 묶었다(원문 막 구조와 일치): 1~3 / 4~6 / 7~9 / 10~12 / 13~15화.
 */
export const LILACWORLD_CHAPTERS: LilacworldChapterSpec[] = [
  /* ══════════════════════════════════════════════════════════════════════
   * vc235 — 원문 1기 15화를 **1화 = 1챕터**로 맞췄다.
   *
   * [종전] 15화를 3화씩 묶어 5챕터 × 10구역 = 50필드였다.
   *   유저 지적: "영프 스토리 10챕터인데 10스테이지로 너가 만든 것 같은디??"
   *   → 화 단위와 챕터 단위가 어긋나 있었고, 1화짜리 분량에 10구역은 과했다.
   *
   * [지금] 챕터 15개(1화~15화), 챕터당 스테이지 4~5개, 총 65필드.
   *   보스가 있는 장(3·7·8·10·14)은 5스테이지, 나머지는 4스테이지.
   *   각 챕터의 **마지막 스테이지가 보스전**이다(보스 없는 장은 일반 토벌로 끝난다).
   *
   * [키] `lilacworld{장}x{구역}` — 챕터가 두 자리가 되면서 붙여쓰기
   *   (`lilacworld112`)는 "1장12구역"인지 "11장2구역"인지 모호해졌다.
   *   구분자 x 로 파싱을 확정한다.
   *
   * [퀘스트] 종전 27개를 화 순서로 전부 재배분했다(버리지 않음).
   *   원문에 없는 대사는 여전히 창작하지 않는다.
   * ══════════════════════════════════════════════════════════════════════ */
  {
    key: "lilacworld1",
    title: "절벽의 약속",
    subtitle: "",
    episodes: "1화",
    stages: 4,
    intro: "chapterIntroLilacworld1",
    boss: null,
    bossDone: "lilacworld1Done",
    width: 2000, height: 1120, groundTint: 0x8ad0ff,
    groundTex: "tile_grass", pathTex: "tile_path", bg: "#0a1a26",
    flowers: 8, trees: 8, rocks: 6,
    enemies: [{ key: "x2_frog", count: 4 }, { key: "x2_reeffish", count: 4 },
      { key: "swampbeast", count: 3 }, { key: "x3_goblin", count: 3 },
      { key: "x2_rat", count: 3 }, { key: "minion", count: 3 }],
    main: "x2_reeffish",
    /* ── 1장 비트 — 정본 1.txt (하루). 종전엔 5.txt의 스칼렛+책 장면이 들어와
     *  장소("절벽의 약속")·인트로와 어긋났다. 정본 우선순위(1.txt > 5.txt)에 맞춘다. ── */
    beats: [
      { sub: 2, dialogue: "lwBook", quest: { id: "hw1", type: "reach", title: "기사단을 향해", desc: "라일락과의 약속을 지키기 위해 레지스터에게 검술을 배웠다. 수련터를 지나 기사단 입단 시험을 보러 가자.", targetLabel: "수련터 출구", reward: Math.round(2600 * G), expReward: 93 } },
      { sub: 3, dialogue: "lwLetter", quest: { id: "hw2", type: "reach", title: "빛나는 펜던트", desc: "입단 시험을 마친 하루는 디오를 피해 성 안으로 들어왔다. 펜던트가 빛나는 방향을 따라 지하 감옥으로 내려가자.", targetLabel: "지하 감옥 입구", reward: Math.round(2900 * G), expReward: 93 } }
    ],
    repeat: {need: 28, gold: Math.round(210 * G), exp: 210, title: "[반복] 수련터 정리", desc: "수련터 주변에 몰려든 무리를 쫓아낸다."},
    lvGate: {enter: 1, mid: 5},
    scaleMul: {hp: 0.6, atk: 0.65, exp: 0.1239, gold: 1},
  },
  {
    key: "lilacworld2",
    title: "떠나야 할 이유",
    subtitle: "",
    episodes: "2화",
    stages: 4,
    intro: "chapterIntroLilacworld2",
    boss: "dio",
    bossDone: "lilacworld2Done",
    width: 2000, height: 1120, groundTint: 0x8ad0ff,
    groundTex: "tile_grass", pathTex: "tile_path", bg: "#0a1a26",
    flowers: 8, trees: 8, rocks: 6,
    enemies: [{ key: "x2_frog", count: 4 }, { key: "x2_reeffish", count: 4 },
      { key: "swampbeast", count: 3 }, { key: "x3_goblin", count: 3 },
      { key: "x2_rat", count: 3 }, { key: "minion", count: 3 }],
    main: "x2_reeffish",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "hw3", type: "reach", title: "연기가 솟는 마을로", desc: "서쪽으로 떠나던 하루는 자신이 살던 마을에서 연기가 솟는 것을 보고 발길을 돌렸다. 골목을 지나 마을 안쪽으로 돌아가자.", targetLabel: "마을 안쪽", reward: Math.round(3100 * G), expReward: 416 } }
    ],
    repeat: {need: 28, gold: Math.round(210 * G), exp: 210, title: "[반복] 피난로 지키기", desc: "마을 사람들이 빠져나갈 길을 지킨다."},
    lvGate: {enter: 8, mid: 12},
    scaleMul: {hp: 1.65, atk: 0.77, exp: 0.4655, gold: 1.3},
  },
  {
    key: "lilacworld3",
    title: "칼리야의 수련",
    subtitle: "",
    episodes: "3화",
    stages: 5,
    intro: "chapterIntroLilacworld3",
    boss: null,
    bossDone: "lilacworld3Done",
    width: 2000, height: 1120, groundTint: 0x8ad0ff,
    groundTex: "tile_grass", pathTex: "tile_path", bg: "#0a1a26",
    flowers: 8, trees: 8, rocks: 6,
    enemies: [{ key: "x2_frog", count: 4 }, { key: "x2_reeffish", count: 4 },
      { key: "swampbeast", count: 3 }, { key: "x3_goblin", count: 3 },
      { key: "x2_rat", count: 3 }, { key: "minion", count: 3 }],
    main: "x2_reeffish",
    /* ── 3장 비트 — 정본 2.txt:35-45 (칼리야 도착 · 도깨비 · 도사 리엘의 수련) ──
     *  vc286 — 종전엔 5.txt 3화의 "이동석·크라켄 먹물·해롤드 호위대"가 들어와 있었다.
     *  그 사건들은 정본 배치상 5장(남부의 해전, 2.txt:59-71) 소재이므로 그쪽으로 옮겼다. */
    beats: [
      { sub: 2, dialogue: "", quest: { id: "hw4", type: "hunt", title: "도깨비의 약탈", desc: "칼리야까지 걸어간 하루는 탈진해 언덕에 쓰러졌다. 도깨비들이 가진 것을 빼앗으려 덤벼들었다. 리엘이 올 때까지 버텨라.", need: 10, targetKey: "x3_chort", targetLabel: "도깨비 무리", reward: Math.round(3300 * G), expReward: 354 } },
      { sub: 3, dialogue: "lwRiel", quest: { id: "hw5", type: "hunt", title: "검을 쥔 손", desc: "리엘은 하루가 가진 검이 보통 검이 아니라고 말했다. 검과 웨폰마스터의 관계를 확인하는 동안, 주막을 노리는 자들을 물리쳐라.", need: 8, targetKey: "x2_rat", targetLabel: "주막을 노리는 자", reward: Math.round(3600 * G), expReward: 354 } },
      { sub: 4, dialogue: "", quest: { id: "hw5b", type: "hunt", title: "카피와 순환", desc: "리엘의 지도로 수련을 거듭해 카피와 순환을 쓸 수 있게 되었다. 순환을 익히는 동안 몰려든 자들을 상대하라.", need: 12, targetKey: "x3_chort", targetLabel: "수련 상대", reward: Math.round(3900 * G), expReward: 354 } },
    ],
    repeat: {need: 28, gold: Math.round(210 * G), exp: 210, title: "[반복] 칼리야 길목 정리", desc: "도깨비들이 다시 길목을 노린다."},
    lvGate: {enter: 15, mid: 18},
    scaleMul: {hp: 2.94, atk: 0.89, exp: 0.571, gold: 1.6},
  },
  {
    key: "lilacworld4",
    title: "벨리카와 에벤트",
    subtitle: "",
    episodes: "4화",
    stages: 4,
    intro: "chapterIntroLilacworld4",
    boss: null,
    bossDone: "lilacworld4Done",
    width: 2100, height: 1160, groundTint: 0xd8b98a,
    groundTex: "tile_grass2", pathTex: "tile_path", bg: "#1a1208",
    flowers: 10, trees: 9, rocks: 7,
    enemies: [{ key: "x3_chort", count: 4 }, { key: "x3_imp", count: 4 },
      { key: "wraith", count: 3 }, { key: "x3_necromancer", count: 3 },
      { key: "x2_bat", count: 3 }, { key: "x3_maskedorc", count: 3 }],
    main: "x3_imp",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "hw6", type: "hunt", title: "천문대 앞길", desc: "길을 잃은 하루를 벨리카가 에벤트까지 데려다주기로 했다. 천문대 앞을 막은 무리를 치우자.", need: 10, targetKey: "x3_imp", targetLabel: "길을 막은 무리", reward: Math.round(3000 * G), expReward: 2559 } }
    ],
    repeat: {need: 30, gold: Math.round(230 * G), exp: 230, title: "[반복] 에벤트 산길 순찰", desc: "에벤트로 오가는 산길을 지킨다."},
    lvGate: {enter: 21, mid: 24},
    scaleMul: {hp: 2.95, atk: 1.01, exp: 1.558, gold: 1.9},
  },
  {
    key: "lilacworld5",
    title: "남부의 결전",
    subtitle: "",
    episodes: "5화",
    stages: 4,
    intro: "chapterIntroLilacworld5",
    boss: null,
    bossDone: "lilacworld5Done",
    width: 2100, height: 1160, groundTint: 0xd8b98a,
    groundTex: "tile_grass2", pathTex: "tile_path", bg: "#1a1208",
    flowers: 10, trees: 9, rocks: 7,
    enemies: [{ key: "x3_chort", count: 4 }, { key: "x3_imp", count: 4 },
      { key: "wraith", count: 3 }, { key: "x3_necromancer", count: 3 },
      { key: "x2_bat", count: 3 }, { key: "x3_maskedorc", count: 3 }],
    main: "x3_imp",
    /* ── 5장 비트 — 정본 2.txt:59-71 (3일 뒤 남부 침공 · 벨리카의 번개 · 일섬 각성) ──
     *  vc286 — 종전엔 3장(칼리야) 소재인 도깨비·연합 결성 퀘스트가 들어와 있었다.
     *  도깨비는 3장으로 옮겼고, 이 장은 남부 해전 사건으로 채운다. */
    beats: [
      { sub: 2, dialogue: "lwSouthWar", quest: { id: "hw7", type: "hunt", title: "남부 방어선", desc: "스칼렛이 각 왕국에 사흘 뒤 남부를 침공하겠다 선포했다. 결전의 아침, 나팔이 울렸다. 방어선을 무너뜨리려는 선봉을 막아라.", need: 10, targetKey: "swampbeast", targetLabel: "남부 선봉", reward: Math.round(3300 * G), expReward: 12582 } },
      { sub: 3, dialogue: "lwBolt", quest: { id: "hw8", type: "hunt", title: "벨리카의 번개를 복사하다", desc: "하루가 벨리카의 번개 원소를 복사하고 일섬에 성공하며 각성했다. 각성의 틈을 노리는 자들을 쓸어라.", need: 12, targetKey: "x3_imp", targetLabel: "각성의 틈을 노리는 자", reward: Math.round(3500 * G), expReward: 12582 } },
    ],
    repeat: {need: 30, gold: Math.round(230 * G), exp: 230, title: "[반복] 천문대 방어", desc: "천문대로 밀려오는 어둠의 피조물을 막는다."},
    lvGate: {enter: 27, mid: 31},
    scaleMul: {hp: 3.6, atk: 1.13, exp: 9.181, gold: 2.2},
  },
  {
    key: "lilacworld6",
    title: "루시의 상처",
    subtitle: "",
    episodes: "6화",
    stages: 4,
    intro: "chapterIntroLilacworld6",
    boss: null,
    bossDone: "lilacworld6Done",
    width: 2100, height: 1160, groundTint: 0xd8b98a,
    groundTex: "tile_garden", pathTex: "tile_path", bg: "#1a1208",
    flowers: 10, trees: 9, rocks: 7,
    enemies: [{ key: "x3_chort", count: 4 }, { key: "x3_imp", count: 4 },
      { key: "wraith", count: 3 }, { key: "x3_necromancer", count: 3 },
      { key: "x2_bat", count: 3 }, { key: "x3_maskedorc", count: 3 }],
    main: "x3_imp",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "hw9", type: "collect", title: "루시의 상처", desc: "상처에 남은 보석의 흔적을 살핀다.", targetLabel: "보석의 흔적", reward: Math.round(3800 * G), expReward: 27748 } },
      { sub: 3, dialogue: "", quest: { id: "hw10", type: "hunt", title: "다크니스의 상흔", desc: "상처에서 스며 나온 어둠을 걷어낸다.", need: 8, targetKey: "x3_necromancer", targetLabel: "스며 나온 어둠", reward: Math.round(4200 * G), expReward: 27748 } }
    ],
    repeat: {need: 30, gold: Math.round(230 * G), exp: 230, title: "[반복] 연합 순찰", desc: "연합의 회의장 주변을 지킨다."},
    lvGate: {enter: 34, mid: 38},
    scaleMul: {hp: 4.25, atk: 1.25, exp: 20.25, gold: 2.5},
  },
  {
    key: "lilacworld7",
    title: "이동석과 고대의 재앙",
    subtitle: "",
    episodes: "7화",
    stages: 5,
    intro: "chapterIntroLilacworld7",
    boss: "rasion",
    bossDone: "lilacworld7Done",
    width: 2200, height: 1200, groundTint: 0xb08ad8,
    groundTex: "tile_moss", pathTex: "tile_dirt", bg: "#140a1e",
    flowers: 12, trees: 6, rocks: 9,
    enemies: [{ key: "x3_ogre", count: 4 }, { key: "x3_orcwarrior", count: 4 },
      { key: "x2_darkhound", count: 3 }, { key: "x3_bigzombie", count: 3 },
      { key: "x3_wogol", count: 3 }, { key: "x3_orcshaman", count: 3 }],
    main: "x3_orcwarrior",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "hw11", type: "hunt", title: "에스테반 전선", desc: "카르텔과 아덴이 해롤드의 군단 사이에 틈을 벌린다. 제르가 불의 마법을 쓸 수 있게 앞을 정리하자.", need: 10, targetKey: "x3_ogre", targetLabel: "해롤드의 군단", reward: Math.round(3400 * G), expReward: 12355 } },
      { sub: 3, dialogue: "", quest: { id: "hw12", type: "hunt", title: "해롤드의 크라켄", desc: "제르의 불 마법이 닿을 때까지 크라켄을 붙잡는다.", need: 8, targetKey: "x3_wogol", targetLabel: "크라켄의 촉수", reward: Math.round(3800 * G), expReward: 12355 } },
      { sub: 4, dialogue: "", quest: { id: "hw13", type: "hunt", title: "칼리야의 이동석", desc: "\"3분 후에 보시죠.\" 리안과 도사가 딘과 베로니카를 맡는다.", need: 8, targetKey: "x2_darkhound", targetLabel: "군단장의 부하", reward: Math.round(4200 * G), expReward: 12355 } }
    ],
    repeat: {need: 32, gold: Math.round(260 * G), exp: 260, title: "[반복] 군단장 전선", desc: "각 왕국에 남은 군단장의 부대를 계속 상대한다."},
    lvGate: {enter: 41, mid: 45},
    scaleMul: {hp: 4.9, atk: 1.37, exp: 6.888, gold: 2.8},
  },
  {
    key: "lilacworld8",
    title: "잃어버린 라일락의 기억",
    subtitle: "",
    episodes: "8화",
    stages: 5,
    intro: "chapterIntroLilacworld8",
    boss: "feron",
    bossDone: "lilacworld8Done",
    width: 2200, height: 1200, groundTint: 0xb08ad8,
    groundTex: "tile_moss", pathTex: "tile_dirt", bg: "#140a1e",
    flowers: 12, trees: 6, rocks: 9,
    enemies: [{ key: "x3_ogre", count: 4 }, { key: "x3_orcwarrior", count: 4 },
      { key: "x2_darkhound", count: 3 }, { key: "x3_bigzombie", count: 3 },
      { key: "x3_wogol", count: 3 }, { key: "x3_orcshaman", count: 3 }],
    main: "x3_orcwarrior",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "hw14", type: "collect", title: "두 전사의 전장", desc: "검이 부딪히는 소리를 따라 아리에게 간다. 길에 남은 격전의 흔적을 살피자.", targetLabel: "격전의 흔적", reward: Math.round(4600 * G), expReward: 33146 } },
      { sub: 4, dialogue: "", quest: { id: "hw15", type: "hunt", title: "아리와 페르온", desc: "페르온의 그림자 검술에 밀리는 아리 곁으로 간다.", need: 8, targetKey: "x3_bigzombie", targetLabel: "그림자 검", reward: Math.round(5000 * G), expReward: 33146 } }
    ],
    repeat: {need: 32, gold: Math.round(260 * G), exp: 260, title: "[반복] 에벤트 성문 경계", desc: "격전이 끝난 성문 주변을 지킨다."},
    lvGate: {enter: 49, mid: 53},
    scaleMul: {hp: 5.55, atk: 1.49, exp: 16.17, gold: 3.1},
  },
  {
    key: "lilacworld9",
    title: "연합의 재집결",
    subtitle: "",
    episodes: "9화",
    stages: 4,
    intro: "chapterIntroLilacworld9",
    boss: null,
    bossDone: "lilacworld9Done",
    width: 2200, height: 1200, groundTint: 0xb08ad8,
    groundTex: "tile_garden", pathTex: "tile_path", bg: "#140a1e",
    flowers: 12, trees: 6, rocks: 9,
    enemies: [{ key: "x3_ogre", count: 4 }, { key: "x3_orcwarrior", count: 4 },
      { key: "x2_darkhound", count: 3 }, { key: "x3_bigzombie", count: 3 },
      { key: "x3_wogol", count: 3 }, { key: "x3_orcshaman", count: 3 }],
    main: "x3_orcwarrior",
    /* ── 9장 비트 — 정본 2.txt:144-156 (연합 재집결 · 아리와 페르온 · 결계 파괴 작전) ──
     *  vc286 — 종전엔 비트가 비어 있어 이 장에서 서사 사건이 하나도 진행되지 않았다. */
    beats: [
      { sub: 2, dialogue: "lwUnited", quest: { id: "hw15b", type: "hunt", title: "부상자 치료 천막", desc: "연합은 당장 에델리오나로 가고 싶었지만 부상자가 많아 움직이지 못했다. 치료 천막을 노리는 자들을 막아라.", need: 10, targetKey: "x3_bigzombie", targetLabel: "천막을 노리는 자", reward: Math.round(4400 * G), expReward: 19020 } },
      { sub: 3, dialogue: "", quest: { id: "hw15c", type: "hunt", title: "결계를 여는 길", desc: "도사가 반란군에 결계 파괴를 부탁했고, 반란군이 성 내부 진입에 성공했다. 결계가 걷히는 동안 성채 외곽을 정리하라.", need: 12, targetKey: "x3_wogol", targetLabel: "성채 외곽의 수비병", reward: Math.round(4600 * G), expReward: 19020 } },
    ],
    repeat: {need: 32, gold: Math.round(260 * G), exp: 260, title: "[반복] 치료 천막 경계", desc: "부상자가 회복할 때까지 천막 주변을 지킨다."},
    lvGate: {enter: 57, mid: 62},
    scaleMul: {hp: 6.2, atk: 1.6099999999999999, exp: 19.02, gold: 3.4},
  },
  {
    key: "lilacworld10",
    title: "시스터즈의 비밀 통로",
    subtitle: "",
    episodes: "10화",
    stages: 5,
    intro: "chapterIntroLilacworld10",
    boss: null,
    bossDone: "lilacworld10Done",
    width: 2300, height: 1250, groundTint: 0x6a4a9a,
    groundTex: "tile_morgue", pathTex: "tile_basalt", bg: "#0d0616",
    flowers: 0, trees: 0, rocks: 12,
    enemies: [{ key: "wraith", count: 4 }, { key: "minion", count: 4 },
      { key: "duskhound", count: 3 }, { key: "x3_necromancer", count: 3 },
      { key: "x3_bigzombie", count: 3 }, { key: "x2_reeffish", count: 3 },
      /* vc263c — Layer Lab 팩 4종 투입 (드라이브 제공 에셋).
       *  "어둠의 성채"는 언데드·강령술사 톤이라 이 팩(어두운 다크판타지, 촘촘한 도트)이
       *  기존 x3_* 카툰 톤보다 오히려 잘 맞는다. 밝은 본편에는 넣지 않는다. */
      { key: "ll_skeleton", count: 3 }, { key: "ll_goblin", count: 3 },
      { key: "ll_mushroom", count: 2 }, { key: "ll_flyingeye", count: 2 }],
    main: "wraith",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "hw16", type: "hunt", title: "정면 입구", desc: "정면을 지키는 군단장들의 사념체를 피해 길을 찾는다.", need: 10, targetKey: "wraith", targetLabel: "사념체", reward: Math.round(3600 * G), expReward: 78248 } },
      { sub: 3, dialogue: "", quest: { id: "hw17", type: "hunt", title: "지하의 미로", desc: "시스터즈가 확보한 통로를 따라 내려간다. 통로에 남은 사념체를 쓰러뜨리자.", need: 8, targetKey: "x2_reeffish", targetLabel: "통로의 사념체", reward: Math.round(4000 * G), expReward: 78248 } },
      { sub: 4, dialogue: "", quest: { id: "hw18", type: "collect", title: "스칼렛의 함정", desc: "닫힌 통로에서 빠져나갈 길을 찾는다.", targetLabel: "닫힌 문", reward: Math.round(4400 * G), expReward: 78248 } }
    ],
    repeat: {need: 34, gold: Math.round(300 * G), exp: 300, title: "[반복] 성채 정찰", desc: "성채 주변에 다시 생겨난 사념체를 정리한다."},
    lvGate: {enter: 66, mid: 71},
    /* 2026-11-14 (유저 지시 "난이도 — 튀는 구간만 고르게") — 공격 배율 상향. 약한 유령 위주라 표준 육성이 73~89대 맞아야 죽었다(9장 30대·13장 40대). */
    scaleMul: {hp: 16.9, atk: 2.6, exp: 55.66, gold: 3.6999999999999997},
  },
  {
    key: "lilacworld11",
    title: "피의 영역",
    subtitle: "",
    episodes: "11화",
    stages: 4,
    intro: "chapterIntroLilacworld11",
    boss: "scarlet_blood",
    bossDone: "lilacworld11Done",
    width: 2300, height: 1250, groundTint: 0x6a4a9a,
    groundTex: "tile_morgue", pathTex: "tile_basalt", bg: "#0d0616",
    flowers: 0, trees: 0, rocks: 12,
    enemies: [{ key: "wraith", count: 4 }, { key: "minion", count: 4 },
      { key: "duskhound", count: 3 }, { key: "x3_necromancer", count: 3 },
      { key: "x3_bigzombie", count: 3 }, { key: "x2_reeffish", count: 3 }],
    main: "wraith",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "hw19", type: "hunt", title: "원혈의 의식", desc: "원소를 흡수하는 스칼렛에게 체술로 파고든다.", need: 8, targetKey: "duskhound", targetLabel: "스칼렛의 피조물", reward: Math.round(5000 * G), expReward: 131115 } }
    ],
    repeat: {need: 34, gold: Math.round(300 * G), exp: 300, title: "[반복] 성채 정찰", desc: "성채 주변에 다시 생겨난 사념체를 정리한다."},
    lvGate: {enter: 75, mid: 80},
    /* 2026-11-14 (유저 지시 "난이도 — 튀는 구간만 고르게") — 공격 배율 상향. 약한 유령 위주라 표준 육성이 73~89대 맞아야 죽었다(9장 30대·13장 40대). */
    scaleMul: {hp: 17.1, atk: 2.5, exp: 72.86, gold: 4},
  },
  {
    key: "lilacworld12",
    title: "원소가 반응하는 순간",
    subtitle: "",
    episodes: "12화",
    stages: 4,
    intro: "chapterIntroLilacworld12",
    boss: "scarlet_dark",
    bossDone: "lilacworld12Done",
    width: 2300, height: 1250, groundTint: 0x6a4a9a,
    groundTex: "tile_blood", pathTex: "tile_basalt", bg: "#0d0616",
    flowers: 0, trees: 0, rocks: 12,
    enemies: [{ key: "wraith", count: 4 }, { key: "minion", count: 4 },
      { key: "duskhound", count: 3 }, { key: "x3_necromancer", count: 3 },
      { key: "x3_bigzombie", count: 3 }, { key: "x2_reeffish", count: 3 }],
    main: "wraith",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "hw20", type: "collect", title: "원소의 반응", desc: "흩어진 원소의 흔적을 모은다.", targetLabel: "원소의 흔적", reward: Math.round(5400 * G), expReward: 258700 } },
      { sub: 3, dialogue: "", quest: { id: "hw21", type: "hunt", title: "잠식을 막는 생명의 원소", desc: "하루의 각성으로 원소가 돌아왔다. 루시가 생명의 원소로 잠식을 막는 동안 몰려드는 군세를 막자.", need: 8, targetKey: "x3_bigzombie", targetLabel: "잠식된 군세", reward: Math.round(6000 * G), expReward: 258700 } }
    ],
    repeat: {need: 34, gold: Math.round(300 * G), exp: 300, title: "[반복] 성채 정찰", desc: "성채 주변에 다시 생겨난 사념체를 정리한다."},
    lvGate: {enter: 85, mid: 90},
    /* 2026-11-14 (유저 지시 "난이도 — 튀는 구간만 고르게") — 공격 배율 상향. 약한 유령 위주라 표준 육성이 73~89대 맞아야 죽었다(9장 30대·13장 40대). */
    scaleMul: {hp: 20.1, atk: 2.5, exp: 172.5, gold: 4.3},
  },
  {
    key: "lilacworld13",
    title: "붙잡아야 할 일 분",
    subtitle: "",
    episodes: "13화",
    stages: 4,
    intro: "chapterIntroLilacworld13",
    boss: "scarlet_seal",
    bossDone: "lilacworld13Done",
    width: 2400, height: 1300, groundTint: 0x9a3030,
    groundTex: "tile_blood", pathTex: "tile_basalt", bg: "#1c0606",
    flowers: 0, trees: 0, rocks: 14,
    enemies: [{ key: "duskhound", count: 4 }, { key: "x2_darkhound", count: 4 },
      { key: "x3_bigzombie", count: 3 }, { key: "x3_necromancer", count: 3 },
      { key: "x3_wogol", count: 3 }, { key: "minion", count: 3 }],
    main: "duskhound",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "hw22", type: "collect", title: "그림자의 분신", desc: "페르온이 그림자 분신을 불러 스칼렛을 붙잡는다. 그사이 흩어진 원소를 모으자.", targetLabel: "흩어진 원소", reward: Math.round(4200 * G), expReward: 419529 } },
      { sub: 3, dialogue: "", quest: { id: "hw23", type: "hunt", title: "페르온의 영역 봉쇄", desc: "페르온의 영역이 버티는 일 분 동안 스칼렛에게 다가가는 길을 연다.", need: 10, targetKey: "duskhound", targetLabel: "어둠의 군세", reward: Math.round(4800 * G), expReward: 419529 } }
    ],
    repeat: {need: 36, gold: Math.round(340 * G), exp: 340, title: "[반복] 남은 어둠 정리", desc: "왕좌 주변에 남은 어둠을 걷어낸다."},
    lvGate: {enter: 95, mid: 101},
    scaleMul: {hp: 14.8, atk: 2.09, exp: 259, gold: 4.6},
  },
  {
    key: "lilacworld14",
    title: "무의 원소와 시간의 힘",
    subtitle: "",
    episodes: "14화",
    stages: 5,
    intro: "chapterIntroLilacworld14",
    boss: "desknis",
    bossDone: "lilacworld14Done",
    width: 2400, height: 1300, groundTint: 0x9a3030,
    groundTex: "tile_blood", pathTex: "tile_basalt", bg: "#1c0606",
    flowers: 0, trees: 0, rocks: 14,
    enemies: [{ key: "duskhound", count: 4 }, { key: "x2_darkhound", count: 4 },
      { key: "x3_bigzombie", count: 3 }, { key: "x3_necromancer", count: 3 },
      { key: "x3_wogol", count: 3 }, { key: "minion", count: 3 }],
    main: "duskhound",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "hw24", type: "hunt", title: "라시온의 계약", desc: "하루를 대신해 라시온이 데스크니스를 막는다.", need: 10, targetKey: "x2_darkhound", targetLabel: "잠식된 그림자", reward: Math.round(5400 * G), expReward: 1452419 } },
      { sub: 4, dialogue: "", quest: { id: "hw25", type: "collect", title: "하루의 에테르", desc: "무의 원소를 붙잡는다.", targetLabel: "무의 원소", reward: Math.round(6000 * G), expReward: 1452419 } }
    ],
    repeat: {need: 36, gold: Math.round(340 * G), exp: 340, title: "[반복] 남은 어둠 정리", desc: "왕좌 주변에 남은 어둠을 걷어낸다."},
    lvGate: {enter: 106, mid: 113},
    scaleMul: {hp: 15.9, atk: 2.21, exp: 836.9, gold: 4.9},
  },
  {
    key: "lilacworld15",
    title: "끝이 아닌 재건",
    subtitle: "",
    episodes: "15화",
    stages: 4,
    intro: "chapterIntroLilacworld15",
    boss: null,
    bossDone: "lilacworld15Done",
    width: 2400, height: 1300, groundTint: 0x9a3030,
    groundTex: "tile_garden", pathTex: "tile_path", bg: "#1c0606",
    flowers: 0, trees: 0, rocks: 14,
    enemies: [{ key: "duskhound", count: 4 }, { key: "x2_darkhound", count: 4 },
      { key: "x3_bigzombie", count: 3 }, { key: "x3_necromancer", count: 3 },
      { key: "x3_wogol", count: 3 }, { key: "minion", count: 3 }],
    main: "duskhound",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "hw26", type: "collect", title: "라일락의 무덤", desc: "페르온과 아리를 따라 라일락의 무덤에 간다.", targetLabel: "라일락의 무덤", reward: Math.round(6600 * G), expReward: 16687047 } },
      { sub: 3, dialogue: "", quest: { id: "hw27", type: "hunt", title: "다녀왔습니다", desc: "하루가 살던 집으로 돌아간다.", need: 8, targetKey: "x3_wogol", targetLabel: "남은 어둠", reward: Math.round(7400 * G), expReward: 16687047 } }
    ],
    repeat: {need: 36, gold: Math.round(340 * G), exp: 340, title: "[반복] 남은 어둠 정리", desc: "왕좌 주변에 남은 어둠을 걷어낸다."},
    lvGate: {enter: 120, mid: 128},
    scaleMul: {hp: 10.1, atk: 2.33, exp: 10300, gold: 5.2},
  },
];

/** 영프 편 첫 구역 — `youngprincessv` 마을에서 이리로 들어간다. */
export const LILACWORLD_ENTRY = "lilacworld1x1" as const;
/** 영프 편 마지막 구역 — 이 보스를 잡으면 `youngPrincessCleared` 가 선다.
 *  15장의 마지막 스테이지(4개 중 4번째). */
export const LILACWORLD_FINAL = "lilacworld15x4" as const;

/** 영프 편 챕터 키 목록 (다른 모듈의 순회용). */
// Preserve IDs, stage counts and reward curves; the approved early manuscripts define encounters.
for (const chapter of LILACWORLD_CHAPTERS) {
  const plan = CHAPTER_STORY_PLAN[chapter.key];
  chapter.title = plan.title; chapter.subtitle = plan.places.map(p => p.title).join(" · ");
  chapter.boss = [...plan.places].reverse().find(p => p.boss)?.boss as LilacworldBossKey ?? null;
}
export const LILACWORLD_KEYS = LILACWORLD_CHAPTERS.map((c) => c.key);
