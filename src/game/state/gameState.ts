/**
 * vc226 — 게임 상태 정의 (WorldScene 83필드 → 한 곳).
 *
 * ## 왜 만드는가
 *
 * `docs/VC225_REFACTOR_1_6.md` 에서 리팩터링 4~6(세이브/시스템/물리 분리)을 **멈춘 이유**:
 * `restoreFromSave` 330줄이 씬 멤버 87개를 직접 읽고 썼다. 상태가 씬에 흩어져 있어
 * 어느 모듈로도 옮길 수 없었다("이동이 아니라 위장").
 *
 * 선행 조건은 **상태를 한 덩어리로 모으는 것**이다. 이 파일이 그 정의다.
 *
 * ## 안전 원칙 — 왜 필드를 옮기지 않고 "선언만" 하는가
 *
 * 83개 필드를 `this.state.questIdx` 로 일괄 치환하면 17,000줄에 걸친 수백 곳이 바뀌고,
 * 한 곳만 틀려도 진행도/세이브가 조용히 깨진다. 그건 리팩터링이 아니라 도박이다.
 *
 * 그래서 1단계는 **타입 정의 + 초기값 팩토리**만 만든다:
 *   - 지금은 아무도 안 쓰므로 동작 변화 **0**
 *   - 앞으로 새 상태를 추가할 때 "여기에 넣는다"는 규칙이 생긴다
 *   - 2단계에서 `restoreFromSave`/`buildSave` 를 이 타입 기준으로 옮긴다
 *   - 3단계에서야 `this.state.x` 치환을 파일 단위로 조금씩 한다
 *
 * ## 왜 `InfSave` 등을 import 하지 않는가
 *
 * 이 모듈이 다른 게임 모듈을 import 하면 순환 참조가 생긴다(WorldScene → gameState → …).
 * 타입은 구조적으로 필요한 만큼만 여기서 다시 선언하고, 실제 타입과의 일치는
 * `type _Check = GameState["inf"] extends InfSave ? true : never` 같은 컴파일 검사로 보장한다.
 */

/**
 * 무한 콘텐츠 상태 — `src/game/infinite.ts` 의 `InfSave` 와 **필드가 일치해야 한다**.
 *  여기서 다시 선언하는 이유: 이 모듈이 infinite.ts 를 import 하면
 *  `infinite → gameState → WorldScene` 순환이 생긴다.
 *  일치 검사는 `tests/gamestate.test.mjs` 가 실제 소스에서 필드명을 뽑아 대조한다.
 */
export type InfState = {
  towerBest: number;
  closetTier: number;
  trialDone: string;
  rebirths: number;
  mats: Record<string, number>;
  petLv: number;
  petExp: number;
  abyss: number;
  orbs: Record<string, number>;
  rebirthEss: number;
  rebirthLog?: { at: number; lv: number; cls: string | null; n: number }[];
};

/** 퀘스트 진행 스냅샷 — 스테이지별 `questIdx` (이어하기 무결성) */
export type QuestIdxSave = Record<string, number>;

/** 일일 리셋 카운터 묶음 (날짜가 바뀌면 0으로) */
export type DailyState = {
  date: string;
  hunts: number;
  gate: number;
  closet: number;
  farms: number;
  bosses: number;
  praid: number;
  claimed: string[];
  ads: number;
  adChest: number;
  adDrop: number;
};

/** 시즌 패스/구독 상태 */
export type PassState = {
  season: string;
  xp: number;
  prem: boolean;
  claimedFree: number[];
  claimedPrem: number[];
  subUntil: number;
};

/** 시즌 미션 상태 */
export type MissionState = {
  day: string;
  week: string;
  daily: Record<string, number>;
  weekly: Record<string, number>;
  claimedDaily: string[];
  claimedWeekly: string[];
};

/** 입장 티켓 상태 */
export type TicketState = {
  date: string;
  gate: number;
  closet: number;
  refills: number;
};

/** 누적 통계 (세션 간 유지) */
export type StatState = {
  deaths: number;
  bestHit: number;
  bestLv: number;
  savedSec: number;
  chaosKills: number;
  invasionKills: number;
};

/**
 * 세이브로 유지되는 게임 상태 전부.
 *
 * `WorldScene` 의 필드 이름과 **1:1 대응**한다(같은 이름을 쓴다).
 * 이름을 바꾸면 2단계 치환이 어려워지고 세이브 스키마와도 어긋난다.
 */
export type GameState = {
  /* 진행도 */
  questIdx: number;
  savedQuestIdx: QuestIdxSave;
  huntCount: number;
  monsterKills: Record<string, number>;
  fragmentsFound: Record<string, number>;
  cleared: boolean;
  dlcTalked: boolean;

  /* 반복 퀘스트 */
  repeatOn: boolean;
  repeatNeed: number;

  /* 튜토리얼 */
  migratedTutSeen: boolean;

  /* 전직 스토리 */
  jobStory: { tier: 1 | 2 | 3 | 4; step: number; hunt: number; fam: string; tst?: string } | null;
  jobStoryDone: number[];
  pendingJobClass: string | null;
  pendingPonyRefund: boolean;

  /* 수집/장비 */
  figures: string[];
  shards: number;
  gachaTickets: number;
  badges: string[];
  badgeSlots: (string | null)[];
  freeGachaAt: number;
  starterPackBought: boolean;

  /* 룬/별자리 */
  runes: Record<string, unknown>;
  runeSlots: (string | null)[];
  constel: string[];
  unlockedSets: Set<string>;

  /* 출석/일일 */
  attendLast: string;
  attendCount: number;
  daily: DailyState;

  /* 쿠폰 */
  couponsUsed: string[];

  /* 패스/구독 */
  pass: PassState;

  /* 미션 */
  missions: MissionState;

  /* 티켓 */
  tickets: TicketState;

  /* 업적 */
  achClaimed: string[];

  /* 전투 통계 */
  bossKillCount: number;
  stat: StatState;
  bossDiff: string;
  gateBest: number;
  closetBest: number;
  gateStars: boolean[];

  /* 파크 */
  parkCoins: number;
  parkBest: number;
  parkTickets: { date: string; n: number };

  /* 심연 */
  inf: InfState;

  /* 방문/발견 */
  seenSet: Set<string>;
  visited: Set<string>;

  /* 자동 설정 */
  autoHunt: boolean;
  autoAlloc: boolean;

  /* 퀘스트 수락/추적 */
  acceptedQuests: Record<string, number>;
  trackedStage: string | null;

  /* 칭호 */
  playerTitle: string | null;

  /* 치비 퀘스트 */
  chibiQuests: Record<string, unknown>;

  /* 마지막 세션 */
  lastSeenAt: number;
};

/**
 * 초기 상태를 만든다 — **필드 기본값과 정확히 같아야 한다**.
 *  다르면 2단계에서 새 게임 시작 시 진행도가 어긋난다.
 */
export function createGameState(): GameState {
  return {
    questIdx: 0,
    savedQuestIdx: {},
    huntCount: 0,
    monsterKills: {},
    fragmentsFound: {},
    cleared: false,
    dlcTalked: false,

    repeatOn: false,
    repeatNeed: 0,

    migratedTutSeen: false,

    jobStory: null,
    jobStoryDone: [],
    pendingJobClass: null,
    pendingPonyRefund: false,

    figures: [],
    shards: 0,
    gachaTickets: 1,
    badges: [],
    badgeSlots: [null, null, null],
    freeGachaAt: 0,
    starterPackBought: false,

    runes: {},
    runeSlots: [null, null, null, null],
    constel: [],
    unlockedSets: new Set(),

    attendLast: "",
    attendCount: 0,
    daily: {
      date: "",
      hunts: 0,
      gate: 0,
      closet: 0,
      farms: 0,
      bosses: 0,
      praid: 0,
      claimed: [],
      ads: 0,
      adChest: 0,
      adDrop: 0,
    },

    couponsUsed: [],

    pass: {
      season: "",
      xp: 0,
      prem: false,
      claimedFree: [],
      claimedPrem: [],
      subUntil: 0,
    },

    missions: {
      day: "",
      week: "",
      daily: {},
      weekly: {},
      claimedDaily: [],
      claimedWeekly: [],
    },

    tickets: { date: "", gate: 0, closet: 0, refills: 0 },

    achClaimed: [],

    bossKillCount: 0,
    stat: { deaths: 0, bestHit: 0, bestLv: 1, savedSec: 0, chaosKills: 0, invasionKills: 0 },
    bossDiff: "normal",
    gateBest: 0,
    closetBest: 0,
    gateStars: [false, false, false],

    parkCoins: 0,
    parkBest: 0,
    parkTickets: { date: "", n: 2 },

    inf: {
      towerBest: 0,
      closetTier: 0,
      trialDone: "",
      rebirths: 0,
      mats: {},
      petLv: 1,
      petExp: 0,
      abyss: 0,
      orbs: {},
      rebirthEss: 0,
      /* optional 이지만 키를 만들어 둔다 — 미러/비교 코드가 `in` 검사로
       *  "필드 없음"과 "값 없음"을 구분하려 할 때 오판하지 않게 한다.
       *  원본 INF_DEFAULT 는 생략하므로 값은 undefined 로 둔다. */
      rebirthLog: undefined,
    },

    seenSet: new Set(),
    visited: new Set(),

    autoHunt: false,
    autoAlloc: false,

    acceptedQuests: {},
    trackedStage: null,

    playerTitle: null,

    chibiQuests: {},

    lastSeenAt: 0,
  };
}
