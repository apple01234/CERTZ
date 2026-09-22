/**
 * SERTZ 스테이지 시스템 (v2.0 — 사용자 지시 #6/#19 반영)
 *  - 챕터(해역) 9개 × 구역(sub-stage) 10개 = 90 필드 + 시작 마을
 *  - 챕터가 1씩 증가할수록 어렵고 스토리가 길어짐 (난이도/보상 곡선 내장)
 *  - 구역 5 = 정예 토벌(미드 보스급), 구역 10 = 챕터 보스 결전
 *  - 이전 작업분(v1.5) 스토리 데이터(대사/보스/몬스터/퀘스트) 전부 이관 + 복귀 차원문 체인
 */

/* ================= 타입 ================= */

export type ChapterKey =
  | "forest" | "kingdom" | "alfheim" | "muspelheim" | "niflheim"
  | "cave" | "nidavellir" | "hel" | "abyss";

/** 스테이지 키 — "village" | "forest1".."abyss10" (구 세이브 키도 런타임 폴백 처리) */
export type StageKey = string;

export type EnemyKey =
  | "wolf" | "minion" | "spider" | "golem" | "frostwolf" | "icegolem" | "wraith"
  | "swampbeast" | "emberwolf" | "firespirit" | "runegolem" | "helhound"
  /* v3.0.2 — 50 Monsters Pack (isaiah658, CC0) 신규 종 9종: 챕터별 다양화 */
  | "x2_frog" | "x2_rat" | "x2_bat" | "x2_firebird" | "x2_frostfly"
  | "x2_snail" | "x2_stonegolem" | "x2_darkhound" | "x2_reeffish"
  /* v3.0.3 — 16x16 DungeonTileset II (0x72, CC0, itch.io) 신규 종 7종:
   *  몬스터마다 고유 개성 (원거리 캐스터/돌진/출혈/독/장판/감속) */
  | "x3_swampy" | "x3_imp" | "x3_icezombie" | "x3_tinyzombie"
  | "x3_ogre" | "x3_chort" | "x3_necromancer"
  /* v3.0.4 — itch.io 0x72 팩 추가 6종 (지시 #8): 오르크 부족/고블린/거대 좀비 */
  | "x3_maskedorc" | "x3_orcwarrior" | "x3_orcshaman" | "x3_wogol" | "x3_goblin" | "x3_bigzombie";

export type EnemyDef = {
  key: EnemyKey;
  name: string;
  hp: number;
  atk: number;
  speed: number;
  aggro: number;
  exp: number;
  scale?: number;
  /** 골드 드롭 범위 (2D MMORPG 기본 요소) */
  gold: [number, number];
  /** 물약 드롭 확률 */
  dropHp?: number;
  dropMp?: number;
  /** v3.0.3 — 고유 개성 프로필 (원거리/돌진/상태이상/장판) */
  profile?: EnemyProfile;
};

/** v3.0.3 (사용자 지시 #3 — "몬스터마다 고유 개성: 스킬·투사체·장판·출혈·독"):
 *  같은 잡몹 뼈대라도 종별로 완전히 다른 전투 방식을 부여한다. */
export type EnemyProfile = {
  /** 원거리 캐스터 — 사거리 유지 + 투사체 발사 (anim은 fx-* 애니키) */
  ranged?: { projAnim: string; projSpeed: number; range: number; cd: number };
  /** 돌진형 — 조준(예고) 후 직선 돌진 */
  charge?: { cd: number; speed: number; time: number };
  /** 접촉 공격 시 상태 이상 부여 */
  apply?: { kind: "bleed" | "poison" | "slow"; chance: number; dps: number; dur: number };
  /** 사망 시 지면에 장판 남김 */
  fieldOnDeath?: { kind: "poison" | "fire"; dps: number; dur: number; radius: number };
};

export type QuestDef = {
  id: string;
  /** v2.4: "level" — 레벨 목표 퀘스트 (need = 목표 레벨, 명확한 동기부여 + 다음 사냥터 진행 게이트) */
  type: "collect" | "hunt" | "reach" | "boss" | "talk" | "level";
  title: string;
  desc: string;
  need?: number;
  targetKey?: EnemyKey;
  /** v3.0.28 (#퀘스트이름) — 다종 토벌 대상: 구역에 실제 스폰되는 몬스터 전체를 토벌 대상으로.
   *  지정 시 카운트·판정이 targetKeys 합산 기준이 된다 (화면 몬스터와 퀘스트 이름 어긋남 해소). */
  targetKeys?: EnemyKey[];
  targetLabel: string;
  reward?: number;
  expReward?: number;
  dialogue?: string;
};

export type BossKey =
  | "guardian" | "behemoth" | "abysslord"
  | "nidhog" | "surt" | "fenrir" | "skoll" | "gram" | "abudditos"
  | "vord" | "jorm" | "nagr";

/* ================= v3.0.28 (#보스난이도) — 메이플식 보스 난이도 =================
 *  이지 / 노말 / 하드 / 카오스 4단계. 스토리 보스·재림 보스 공통 적용.
 *  hp/atk: 기준 수치 배율, reward: EXP/GOLD 배율, emerald: 재림판 격파 에메랄드
 *  v3.1.0 (#보스약함) — 유저 지시 "보스 ㅈㄴ 약함 (노말로 바로잡음)": 노말 기준치 대폭 상향
 *  (노말 hp 1.0→1.5 · atk 1.0→1.25 — 스토리 보스도 이 노말 기준으로 고정 스폰된다) */
export type BossDiffKey = "easy" | "normal" | "hard" | "chaos";

export const BOSS_DIFFS: Record<
  BossDiffKey,
  { key: BossDiffKey; label: string; color: string; hp: number; atk: number; reward: number; emerald: number; desc: string; spd: number }
> = {
  easy: { key: "easy", label: "이지", color: "#7de87d", hp: 2.25, atk: 0.85, reward: 0.6, emerald: 2, spd: 1, desc: "가볍게 클리어 — 보상 60%" },
  /* v1.4.0 (Task 1-4 — 유저 지시 #10) — 스토리 보스 대폭 강화: 전 난이도 HP ×3
   *  (노말 1.5→4.5). 최소 전투 시간 확보(초반 60초/후반 120초+) — ATK은 유저 피드백대로 유지 */
  normal: { key: "normal", label: "노말", color: "#7dc4ff", hp: 4.5, atk: 1.25, reward: 1.0, emerald: 5, spd: 1, desc: "기본 난이도 — 보상 100%" },
  hard: { key: "hard", label: "하드", color: "#ffb05a", hp: 7.2, atk: 1.55, reward: 1.9, emerald: 9, spd: 1.06, desc: "도전자용 — 보상 190%" },
  /* v4.1.4 (#카오스강화) — 유저 지시 "카오스 훨씬 더 어렵게": 수치 대폭 상향 + 전용 메커니즘(패턴 풀 조기 개방·
   *  쿨타임 25% 단축·탄속 +22%·돌진 연쇄 +1·카운터 창 단축·페이즈3 권속 지원군)은 Boss.ts의 chaos 플래그가 담당.
   *  노말 대비 HP 4.1배·ATK 2.0배 체감 — 보상도 460%로 재조정해 도전 가치 유지. */
  chaos: { key: "chaos", label: "카오스", color: "#ff6a7d", hp: 18.6, atk: 2.55, reward: 4.6, emerald: 30, spd: 1.14, desc: "극한 난이도 — 전용 패턴·보상 460%" },
};

export const BOSS_DIFF_ORDER: BossDiffKey[] = ["easy", "normal", "hard", "chaos"];

/* v4.1.4 (#보스개성) — 6종 공용 패턴에서 탈피: 보스별 시그니처 패턴 5종 추가.
 *  spiral: 나선 탄막(눈보라/심연) · beam: 회전 스윕 빔(용 브레스/화염) · blink: 그림자 급습(늑대계)
 *  quake: 연속 낙뢰(거인계) · counter: 반격 카운터(로스트아크식 — 창이 노란 링, 공격 1회 이상 시 기절,
 *  방관하면 대폭발) */
export type BossAttackKind =
  | "slam" | "charge" | "volley" | "ring" | "zones" | "summon"
  | "spiral" | "beam" | "blink" | "quake" | "counter";

export type BossDef = {
  key: BossKey;
  name: string;
  hp: number;
  atk: number;
  speed: number;
  exp: number;
  gold: number;
  tex: string;
  orbTint: number;
  introDialogue: string;
  patterns: { p1: BossAttackKind[]; p2: BossAttackKind[]; p3: BossAttackKind[] };
  summonKey?: EnemyKey;
  /** v4.1.4 — 돌진 연속 횟수(기본 1). 펜리르 2 / 스콜&하티 3 — 쌍랑·늑대의 정체성 */
  chargeChain?: number;
};

export type StageDef = {
  key: StageKey;
  name: string;
  subtitle: string;
  width: number;
  height: number;
  groundTint: number;
  flowerCount: number;
  treeCount: number;
  rockCount: number;
  quests: QuestDef[];
  enemies: { key: EnemyKey; count: number }[];
  boss: boolean;
  bossKey?: BossKey;
  /** v2.9 (사용자 지시 #5) — 마을형 안전 구역 (여관/전직관/우물 등 마을 시설 재사용) */
  isVillage?: boolean;
  /** 구역 5 정예 몬스터 (미드 보스급 단일 스폰) */
  elite?: { key: EnemyKey; hpMult: number; atkMult: number; name: string };
  repeat?: { targetKey: EnemyKey; need: number; gold: number; exp: number; title: string; desc: string };
  /** v1.0.19 (A-3 신규 스테이지) — 스테이지별 고유 배율 (stageScale 오버라이드.
   *  기존 챕터 스테이지는 이 필드가 없어 기존 곡선 그대로 유지 — 회귀 없음) */
  scaleMul?: { hp: number; atk: number; exp: number; gold: number };
};

/* ================= 챕터 스펙 ================= */

type StoryBeat = { sub: number; dialogue: string };

type ChapterSpec = {
  key: ChapterKey;
  /** 장 번호 (제2장~제10장 — village가 제1장) */
  num: number;
  title: string;
  subtitle: string;
  intro: string;
  /** 구역 10 챕터 보스 */
  boss?: BossKey;
  /** 보스 격파 후 도달 구역의 대사 (차원문 개방 전 스토리) */
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
  enemies: { key: EnemyKey; count: number }[];
  /** 챕터 대표 몬스터 (반복 의뢰/정예 대상) */
  main: EnemyKey;
  /** 스토리 배치 — 고정 퀘스트가 놓일 구역 (비는 구역은 자동 토벌 퀘스트로 채움) */
  beats: (StoryBeat & { quest: QuestDef })[];
  repeat: { need: number; gold: number; exp: number; title: string; desc: string };
  /** v2.4 레벨 게이트 — 챕터 진입(sub1)·중간(sub4) 목표 레벨 ("N레벨 달성!" 동기부여 퀘스트) */
  lvGate: { enter: number; mid: number };
};

/* 보상 밸런스 (사용자 지시 #6 — 골드 과다 지급 수정: 기존 기준 ×0.8) */
const G = 0.8;

export const CHAPTERS: ChapterSpec[] = [
  {
    key: "forest", num: 2, title: "숲의 신전", subtitle: "미드가르드 서쪽 숲",
    intro: "intro", boss: "guardian", bossDone: "wolvesDone",
    width: 2400, height: 1350, groundTint: 0x9adf6a, groundTex: "tile_grass", pathTex: "tile_path", bg: "#0a1408",
    flowers: 10, trees: 14, rocks: 8,
    /* v2.9 (지시 #1) — 챕터 몬스터 풀 3종: 2구역마다 1종 로테이션(1~6) → 2종(7~8) → 3종(9) → 보스+3종(10) */
    enemies: [{ key: "wolf", count: 4 }, { key: "spider", count: 4 }, { key: "swampbeast", count: 4 }, { key: "x2_frog", count: 3 }, { key: "x3_swampy", count: 3 }, { key: "x3_goblin", count: 3 }],
    main: "wolf",
    beats: [
      { sub: 2, dialogue: "fragment", quest: { id: "f0", type: "collect", title: "결정의 흔적 찾기", desc: "숲 어딘가 빛을 내는 결정의 흔적을 찾아 주워라. 이그니가 기다린다.", targetLabel: "결정의 흔적", reward: Math.round(40 * G), expReward: 35 } },
      { sub: 3, dialogue: "", quest: { id: "f1", type: "hunt", title: "숲의 거미 소탕", desc: "신전으로 가는 길을 막는 숲의 거미 13마리를 처치해라.", need: 13, targetKey: "spider", targetLabel: "숲의 거미", reward: Math.round(60 * G), expReward: 40 } },
      { sub: 6, dialogue: "wolfRoutDone", quest: { id: "f2", type: "hunt", title: "능대 무리 소멸", desc: "어둠에 미친 능대 무리 25마리를 더 처치해라!", need: 25, targetKey: "swampbeast", targetLabel: "능대", reward: Math.round(110 * G), expReward: 90 } },
      { sub: 8, dialogue: "", quest: { id: "f3", type: "collect", title: "능대들이 지키던 결정", desc: "능대들이 지키던 곳에서 또 하나의 빛이 느껴진다.", targetLabel: "결정의 흔적", reward: Math.round(60 * G), expReward: 45 } },
    ],
    repeat: { need: 16, gold: Math.round(70 * G), exp: 70, title: "[반복] 늑대 토벌 의뢰", desc: "마을 토벌 의뢰 — 늑대를 계속 사냥해 골드와 경험치를 얻자." },
    /* v1.4.3 (작업2) — enter 3→1: 신규 유저가 마을에서 1-1로 바로 나갈 수 있게 완화.
     *  기존 Lv3 게이트가 시작 지점을 막아버리는 교착(레벨 올릴 곳 부재)의 핵심 원인.
     *  대신 마을 훈련장+초보 퀘스트로 자연스러운 1→3 루트를 제공하고, mid 게이트(구역4·Lv5)는 유지. */
    lvGate: { enter: 1, mid: 5 },
  },
  {
    key: "kingdom", num: 3, title: "쿠소디아", subtitle: "선박의 왕국 · 늪지대",
    intro: "kingdomIntro", boss: "behemoth", bossDone: "kingdomDone",
    width: 2200, height: 1250, groundTint: 0x86c95e, groundTex: "tile_grass", pathTex: "tile_path", bg: "#0d1808",
    flowers: 8, trees: 9, rocks: 6,
    enemies: [{ key: "swampbeast", count: 5 }, { key: "wolf", count: 4 }, { key: "golem", count: 3 }, { key: "x2_rat", count: 2 }, { key: "x3_imp", count: 3 }, { key: "x3_goblin", count: 2 }],
    main: "swampbeast",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "k1", type: "collect", title: "능지 속 결정의 조각", desc: "능대들이 품고 있던 결정의 조각을 되찾아라.", targetLabel: "결정의 흔적", reward: Math.round(80 * G), expReward: 70 } },
      { sub: 3, dialogue: "", quest: { id: "k0", type: "hunt", title: "능지의 능대 소탕", desc: "결정의 기운을 먹고 미쳐 버린 늪의 능대 15마리를 처치해라.", need: 15, targetKey: "swampbeast", targetLabel: "능대", reward: Math.round(90 * G), expReward: 80 } },
      { sub: 5, dialogue: "", quest: { id: "k2", type: "hunt", title: "왕국 신뢰 얻기", desc: "기사단을 도와 능대 무리 20마리를 더 베어 내라!", need: 20, targetKey: "swampbeast", targetLabel: "능대", reward: Math.round(140 * G), expReward: 130 } },
      { sub: 7, dialogue: "swampDone", quest: { id: "k3", type: "hunt", title: "왕국의 위협 제거", desc: "능지의 어둠이 짙어진다 — 능대 25마리를 처치해라!", need: 25, targetKey: "swampbeast", targetLabel: "능대", reward: Math.round(170 * G), expReward: 160 } },
    ],
    repeat: { need: 20, gold: Math.round(100 * G), exp: 100, title: "[반복] 늪지 정화 의뢰", desc: "쿠소디아 기사단 의뢰 — 능대를 계속 사냥해라." },
    lvGate: { enter: 8, mid: 10 },
  },
  {
    key: "alfheim", num: 4, title: "알프헤임", subtitle: "요정의 성전 · 빛의 결정",
    intro: "alfheimIntro", boss: "nidhog", bossDone: "guardianDone",
    width: 1900, height: 1080, groundTint: 0x8f7fd8, groundTex: "tile_dark", pathTex: "tile_path", bg: "#0d0a1e",
    flowers: 6, trees: 10, rocks: 10,
    enemies: [{ key: "minion", count: 4 }, { key: "spider", count: 4 }, { key: "wraith", count: 3 }, { key: "x2_bat", count: 3 }, { key: "x3_icezombie", count: 3 }, { key: "x3_orcshaman", count: 3 }],
    main: "minion",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "a0", type: "hunt", title: "하수인 소탕", desc: "니드호그가 부린 심연의 하수인 13마리를 처치해 성전의 길을 열자.", need: 13, targetKey: "minion", targetLabel: "심연 하수인", reward: Math.round(80 * G), expReward: 65 } },
      { sub: 3, dialogue: "", quest: { id: "a1", type: "collect", title: "여왕의 가호", desc: "하수인들이 숨겨둔 결정의 조각을 회수해 여왕에게 바쳐라.", targetLabel: "결정의 흔적", reward: Math.round(80 * G), expReward: 55 } },
      { sub: 6, dialogue: "minionPurgeDone", quest: { id: "a2", type: "hunt", title: "성전 지키기", desc: "니드호그를 부르는 의식을 막자 — 하수인 30마리 처치!", need: 30, targetKey: "minion", targetLabel: "심연 하수인", reward: Math.round(150 * G), expReward: 140 } },
    ],
    repeat: { need: 20, gold: Math.round(95 * G), exp: 95, title: "[반복] 성전 순찰 의뢰", desc: "요정 여왕의 의뢰 — 하수인을 계속 처치해 훈련해라." },
    lvGate: { enter: 14, mid: 16 },
  },
  {
    key: "muspelheim", num: 5, title: "무스펠헤임", subtitle: "극열의 해역 · 화산 지대",
    intro: "muspelIntro", boss: "surt", bossDone: "surtDone",
    width: 2200, height: 1250, groundTint: 0xd88a4a, groundTex: "tile_magma", pathTex: "tile_magma_path", bg: "#1c0d06",
    flowers: 0, trees: 4, rocks: 12,
    enemies: [{ key: "emberwolf", count: 4 }, { key: "firespirit", count: 3 }, { key: "golem", count: 3 }, { key: "x2_firebird", count: 3 }, { key: "x3_tinyzombie", count: 3 }, { key: "x3_wogol", count: 3 }],
    main: "emberwolf",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "m0", type: "hunt", title: "불꽃 늑대 사냥", desc: "네바다를 내달리는 불꽃 늑대 15마리를 처치해라.", need: 15, targetKey: "emberwolf", targetLabel: "불꽃 늑대", reward: Math.round(150 * G), expReward: 140 } },
      { sub: 4, dialogue: "", quest: { id: "m1", type: "hunt", title: "화염 정령 진압", desc: "열이 가장 강한 날 — 화염 정령 13마리를 처치해라.", need: 13, targetKey: "firespirit", targetLabel: "화염 정령", reward: Math.round(170 * G), expReward: 150 } },
      { sub: 5, dialogue: "", quest: { id: "m2", type: "collect", title: "화염 속의 빛", desc: "용암 사이에서 결정의 조각이 반짝인다. 회수해라.", targetLabel: "결정의 흔적", reward: Math.round(100 * G), expReward: 95 } },
      { sub: 7, dialogue: "spiritPurgeDone", quest: { id: "m3", type: "hunt", title: "호족촌 구원", desc: "엘렌을 도와 — 지하도시를 노리는 화염 정령 25마리를 처치해라!", need: 25, targetKey: "firespirit", targetLabel: "화염 정령", reward: Math.round(220 * G), expReward: 200 } },
    ],
    repeat: { need: 20, gold: Math.round(130 * G), exp: 130, title: "[반복] 화산 지대 순찰 의뢰", desc: "호족촌 의뢰 — 불꽃 늑대를 계속 사냥해라." },
    lvGate: { enter: 20, mid: 23 },
  },
  {
    key: "niflheim", num: 6, title: "니플헤임", subtitle: "극한의 해역 · 얼음의 성전",
    intro: "niflIntro", boss: "fenrir", bossDone: "fenrirDone",
    width: 2100, height: 1200, groundTint: 0xdfeaf8, groundTex: "tile_snow", pathTex: "tile_ice", bg: "#0c1826",
    flowers: 0, trees: 10, rocks: 10,
    enemies: [{ key: "frostwolf", count: 4 }, { key: "icegolem", count: 3 }, { key: "wraith", count: 3 }, { key: "x2_frostfly", count: 3 }, { key: "x3_icezombie", count: 3 }, { key: "x3_orcwarrior", count: 3 }],
    main: "frostwolf",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "n0", type: "hunt", title: "서리 늑대 사냥", desc: "설원을 유랑하는 서리 늑대 15마리를 처치해라.", need: 15, targetKey: "frostwolf", targetLabel: "서리 늑대", reward: Math.round(130 * G), expReward: 120 } },
      { sub: 4, dialogue: "", quest: { id: "n1", type: "hunt", title: "얼음 골렘 격파", desc: "성전 길을 얼리고 있는 얼음 골렘 10기를 격파해라.", need: 10, targetKey: "icegolem", targetLabel: "얼음 골렘", reward: Math.round(170 * G), expReward: 150 } },
      { sub: 6, dialogue: "", quest: { id: "n2", type: "collect", title: "얼음 속의 결정", desc: "얼음 결정 사이에서 세계의 빛이 반짝인다.", targetLabel: "결정의 흔적", reward: Math.round(100 * G), expReward: 90 } },
      { sub: 7, dialogue: "frostRoutDone", quest: { id: "n3", type: "hunt", title: "설원 정화", desc: "펜리르의 권속인 서리 늑대 30마리를 처치해라!", need: 30, targetKey: "frostwolf", targetLabel: "서리 늑대", reward: Math.round(210 * G), expReward: 190 } },
    ],
    repeat: { need: 24, gold: Math.round(145 * G), exp: 145, title: "[반복] 설원 순찰 의뢰", desc: "니플헤임 정찰 의뢰 — 서리 늑대를 계속 사냥해라." },
    lvGate: { enter: 27, mid: 30 },
  },
  {
    key: "cave", num: 7, title: "스바르트알프헤임", subtitle: "어둠 요정들의 해역 · 수정 광맥",
    intro: "caveIntro", boss: "abysslord", bossDone: "caveDone",
    width: 2100, height: 1200, groundTint: 0x8a6a4a, groundTex: "tile_cave", pathTex: "tile_path_dark", bg: "#100a08",
    flowers: 0, trees: 0, rocks: 14,
    enemies: [{ key: "spider", count: 4 }, { key: "minion", count: 4 }, { key: "golem", count: 3 }, { key: "x2_snail", count: 3 }, { key: "x3_imp", count: 3 }, { key: "x3_maskedorc", count: 2 }],
    main: "spider",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "c0", type: "collect", title: "지하 깊은 곳의 빛", desc: "어둠 요정들의 지하 어딘가에서 결정의 조각이 빛나고 있다.", targetLabel: "결정의 흔적", reward: Math.round(60 * G), expReward: 65 } },
      { sub: 3, dialogue: "", quest: { id: "c1", type: "hunt", title: "동굴 거미 소탕", desc: "어둠에 물든 동굴 거미 15마리를 처치해라.", need: 15, targetKey: "spider", targetLabel: "동굴 거미", reward: Math.round(90 * G), expReward: 80 } },
      { sub: 5, dialogue: "", quest: { id: "c2", type: "hunt", title: "수정 골렘 파괴", desc: "거미들을 조종하는 수정 골렘 10기를 부숴 버려라.", need: 10, targetKey: "golem", targetLabel: "수정 골렘", reward: Math.round(130 * G), expReward: 110 } },
      { sub: 7, dialogue: "spiderDone", quest: { id: "c3", type: "hunt", title: "지하 정화", desc: "거미 둥지를 완전히 태우자 — 거미 25마리 처치!", need: 25, targetKey: "spider", targetLabel: "동굴 거미", reward: Math.round(160 * G), expReward: 150 } },
      { sub: 8, dialogue: "", quest: { id: "c4", type: "collect", title: "여왕의 두 번째 부탁", desc: "어둠 요정 여왕의 마지막 부탁 — 뿌리 사이의 잔광을 회수해라.", targetLabel: "결정의 흔적", reward: Math.round(70 * G), expReward: 70 } },
    ],
    repeat: { need: 20, gold: Math.round(115 * G), exp: 115, title: "[반복] 지하 정화 의뢰", desc: "어둠 요정 여왕의 의뢰 — 거미를 계속 사냥해라." },
    lvGate: { enter: 34, mid: 38 },
  },
  {
    key: "nidavellir", num: 8, title: "니다벨리르", subtitle: "난쟁이들의 해역 · 룬 광산",
    intro: "nidavellirIntro", boss: "skoll", bossDone: "skollDone",
    width: 2100, height: 1200, groundTint: 0x9a8a6a, groundTex: "tile_stone", pathTex: "tile_path_dark", bg: "#121008",
    flowers: 0, trees: 0, rocks: 16,
    enemies: [{ key: "runegolem", count: 4 }, { key: "golem", count: 3 }, { key: "spider", count: 3 }, { key: "x2_stonegolem", count: 3 }, { key: "x3_ogre", count: 3 }, { key: "x3_orcwarrior", count: 3 }],
    main: "runegolem",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "d0", type: "hunt", title: "룬 골렘 정지", desc: "폭주한 룬 골렘 13기를 정지시켜라.", need: 13, targetKey: "runegolem", targetLabel: "룬 골렘", reward: Math.round(200 * G), expReward: 180 } },
      { sub: 4, dialogue: "", quest: { id: "d1", type: "collect", title: "룬 각인 판", desc: "광산 깊은 곳의 결정 조각 — 룬 각인판을 회수해라.", targetLabel: "결정의 흔적", reward: Math.round(120 * G), expReward: 110 } },
      { sub: 6, dialogue: "runePurgeDone", quest: { id: "d2", type: "hunt", title: "광산 탈환", desc: "난쟁이 마을을 되돌리자 — 룬 골렘 25기 처치!", need: 25, targetKey: "runegolem", targetLabel: "룬 골렘", reward: Math.round(260 * G), expReward: 230 } },
      { sub: 8, dialogue: "", quest: { id: "d3", type: "hunt", title: "수정 골렘 정리", desc: "광산을 어지럽히는 수정 골렘 10기를 부수자.", need: 10, targetKey: "golem", targetLabel: "수정 골렘", reward: Math.round(220 * G), expReward: 200 } },
    ],
    repeat: { need: 20, gold: Math.round(150 * G), exp: 150, title: "[반복] 광산 경비 의뢰", desc: "난쟁이 광산 조합 의뢰 — 룬 골렘을 계속 처치해라." },
    lvGate: { enter: 42, mid: 46 },
  },
  {
    key: "hel", num: 9, title: "헬", subtitle: "절벽 너머의 해역 · 대전쟁의 땅",
    intro: "helIntro", boss: "gram", bossDone: "gramDone",
    width: 2100, height: 1200, groundTint: 0x4a3a5a, groundTex: "tile_hel", pathTex: "tile_path_dark", bg: "#0d0616",
    flowers: 0, trees: 6, rocks: 12,
    enemies: [{ key: "helhound", count: 4 }, { key: "wraith", count: 3 }, { key: "golem", count: 3 }, { key: "x2_darkhound", count: 3 }, { key: "x3_chort", count: 3 }, { key: "x3_maskedorc", count: 3 }],
    main: "helhound",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "h0", type: "hunt", title: "헬 하운드 사냥", desc: "절벽을 지키는 헬 하운드 15마리를 처치해라.", need: 15, targetKey: "helhound", targetLabel: "헬 하운드", reward: Math.round(260 * G), expReward: 240 } },
      { sub: 3, dialogue: "", quest: { id: "h1", type: "collect", title: "대지의 결정", desc: "절벽 아래 대지의 결정 — 결정의 흔적을 회수해라.", targetLabel: "결정의 흔적", reward: Math.round(150 * G), expReward: 140 } },
      { sub: 5, dialogue: "houndPurgeDone", quest: { id: "h2", type: "hunt", title: "절벽 열기", desc: "헬 하운드 30마리를 처치해 저택의 문을 열어라!", need: 30, targetKey: "helhound", targetLabel: "헬 하운드", reward: Math.round(320 * G), expReward: 290 } },
      { sub: 7, dialogue: "", quest: { id: "h3", type: "hunt", title: "심연 유령 소탕", desc: "힐다 할머니의 조사 일지를 지키는 심연 유령 15마리를 처치해라.", need: 15, targetKey: "wraith", targetLabel: "심연 유령", reward: Math.round(280 * G), expReward: 260 } },
    ],
    repeat: { need: 20, gold: Math.round(175 * G), exp: 175, title: "[반복] 절벽 정찰 의뢰", desc: "헬의 기운이 강해지고 있다 — 하운드를 계속 처치해라." },
    lvGate: { enter: 50, mid: 54 },
  },
  {
    key: "abyss", num: 10, title: "세계수의 뿌리", subtitle: "심연의 근원 · 종언의 왕좌",
    intro: "abyssIntro", boss: "abudditos", bossDone: "victory",
    width: 1800, height: 1050, groundTint: 0x3a2c52, groundTex: "tile_abyss", pathTex: "tile_path_dark", bg: "#0d0616",
    flowers: 0, trees: 0, rocks: 12,
    enemies: [{ key: "wraith", count: 4 }, { key: "minion", count: 4 }, { key: "helhound", count: 3 }, { key: "x2_reeffish", count: 3 }, { key: "x3_necromancer", count: 3 }, { key: "x3_bigzombie", count: 3 }],
    main: "wraith",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "y0", type: "hunt", title: "뿌리의 유령 소탕", desc: "왕좌를 지키는 심연 유령 10마리를 처치해라.", need: 10, targetKey: "wraith", targetLabel: "심연 유령", reward: Math.round(150 * G), expReward: 140 } },
      { sub: 4, dialogue: "", quest: { id: "y1", type: "collect", title: "빼앗긴 빛의 흔적", desc: "아부디토스가 삼키지 못한 결정의 흔적을 회수해라.", targetLabel: "결정의 흔적", reward: Math.round(120 * G), expReward: 110 } },
      { sub: 6, dialogue: "wraithDone", quest: { id: "y2", type: "hunt", title: "왕좌 앞길 열기", desc: "심연 유령 25마리를 처치해 왕좌의 문을 열어라!", need: 25, targetKey: "wraith", targetLabel: "심연 유령", reward: Math.round(240 * G), expReward: 220 } },
    ],
    repeat: { need: 24, gold: Math.round(165 * G), exp: 165, title: "[반복] 뿌리 정찰 의뢰", desc: "뿌리의 기운이 강해지고 있다 — 유령을 계속 처치해라." },
    lvGate: { enter: 58, mid: 62 },
  },
];

/* ================= 몬스터 정의 (v1.5 데이터 이관) ================= */

export const ENEMIES: Record<EnemyKey, EnemyDef> = {
  wolf: { key: "wolf", name: "이그드라실 늑대", hp: 58, atk: 13, speed: 132, aggro: 300, exp: 24, gold: [5, 8], dropHp: 0.3, dropMp: 0.2 },
  minion: { key: "minion", name: "심연 하수인", hp: 78, atk: 18, speed: 108, aggro: 320, exp: 36, gold: [9, 13], dropHp: 0.32, dropMp: 0.24 },
  spider: { key: "spider", name: "동굴 거미", hp: 88, atk: 19, speed: 122, aggro: 320, exp: 48, gold: [10, 14], dropHp: 0.3, dropMp: 0.22 },
  golem: { key: "golem", name: "수정 골렘", hp: 148, atk: 24, speed: 78, aggro: 260, exp: 70, gold: [14, 21], dropHp: 0.34, dropMp: 0.26 },
  frostwolf: { key: "frostwolf", name: "서리 늑대", hp: 112, atk: 25, speed: 146, aggro: 340, exp: 62, gold: [12, 18], dropHp: 0.3, dropMp: 0.22 },
  icegolem: { key: "icegolem", name: "얼음 골렘", hp: 170, atk: 29, speed: 74, aggro: 260, exp: 80, gold: [17, 23], dropHp: 0.34, dropMp: 0.26 },
  wraith: { key: "wraith", name: "심연 유령", hp: 130, atk: 28, speed: 100, aggro: 340, exp: 76, gold: [15, 22], dropHp: 0.32, dropMp: 0.26 },
  swampbeast: { key: "swampbeast", name: "능대", hp: 95, atk: 20, speed: 96, aggro: 300, exp: 55, gold: [10, 15], dropHp: 0.3, dropMp: 0.22 },
  emberwolf: { key: "emberwolf", name: "불꽃 늑대", hp: 150, atk: 31, speed: 150, aggro: 340, exp: 85, gold: [14, 21], dropHp: 0.3, dropMp: 0.22 },
  firespirit: { key: "firespirit", name: "화염 정령", hp: 175, atk: 34, speed: 92, aggro: 300, exp: 100, gold: [17, 24], dropHp: 0.34, dropMp: 0.26 },
  runegolem: { key: "runegolem", name: "룬 골렘", hp: 210, atk: 37, speed: 72, aggro: 260, exp: 115, gold: [19, 28], dropHp: 0.34, dropMp: 0.26 },
  helhound: { key: "helhound", name: "헬 하운드", hp: 190, atk: 36, speed: 148, aggro: 360, exp: 105, gold: [18, 25], dropHp: 0.32, dropMp: 0.26 },
  /* v3.0.2 — 신규 종 9종 (챕터 배율은 stageScale이 곱함) */
  x2_frog: { key: "x2_frog", name: "독개구리", hp: 52, atk: 12, speed: 116, aggro: 300, exp: 22, gold: [5, 9], dropHp: 0.3, dropMp: 0.22 },
  x2_rat: { key: "x2_rat", name: "궁전 뒷쥐", hp: 84, atk: 17, speed: 156, aggro: 320, exp: 40, gold: [9, 14], dropHp: 0.3, dropMp: 0.22 },
  x2_bat: { key: "x2_bat", name: "황혼 박쥐", hp: 126, atk: 27, speed: 164, aggro: 360, exp: 74, gold: [14, 21], dropHp: 0.3, dropMp: 0.24 },
  x2_firebird: { key: "x2_firebird", name: "잿불 새", hp: 158, atk: 33, speed: 142, aggro: 340, exp: 92, gold: [15, 23], dropHp: 0.32, dropMp: 0.26 },
  x2_frostfly: { key: "x2_frostfly", name: "서리 날도요", hp: 118, atk: 26, speed: 158, aggro: 340, exp: 66, gold: [12, 19], dropHp: 0.3, dropMp: 0.24 },
  x2_snail: { key: "x2_snail", name: "동굴 달팽이", hp: 200, atk: 22, speed: 58, aggro: 240, exp: 60, gold: [11, 17], dropHp: 0.36, dropMp: 0.28 },
  x2_stonegolem: { key: "x2_stonegolem", name: "장벽 돌골렘", hp: 235, atk: 39, speed: 66, aggro: 260, exp: 122, gold: [20, 30], dropHp: 0.34, dropMp: 0.26 },
  x2_darkhound: { key: "x2_darkhound", name: "그늘 이리", hp: 205, atk: 38, speed: 154, aggro: 360, exp: 112, gold: [18, 27], dropHp: 0.32, dropMp: 0.24, profile: { apply: { kind: "bleed", chance: 0.35, dps: 4, dur: 4000 } } },
  x2_reeffish: { key: "x2_reeffish", name: "심연 암초물고기", hp: 182, atk: 40, speed: 128, aggro: 340, exp: 108, gold: [17, 26], dropHp: 0.32, dropMp: 0.26, profile: { ranged: { projAnim: "fx-icelance", projSpeed: 340, range: 240, cd: 2200 } } },
  /* v3.0.3 — 0x72 DungeonTileset II (itch.io, CC0) 신규 종 7종: 고유 개성 내장 */
  x3_swampy: { key: "x3_swampy", name: "늪지 독괴물", hp: 96, atk: 15, speed: 86, aggro: 280, exp: 30, gold: [8, 12], dropHp: 0.32, dropMp: 0.24, profile: { apply: { kind: "poison", chance: 0.5, dps: 5, dur: 5000 }, fieldOnDeath: { kind: "poison", dps: 6, dur: 4000, radius: 90 } } },
  x3_imp: { key: "x3_imp", name: "잉걸불 임프", hp: 118, atk: 20, speed: 98, aggro: 340, exp: 52, gold: [11, 16], dropHp: 0.3, dropMp: 0.24, profile: { ranged: { projAnim: "fx-fireball", projSpeed: 320, range: 260, cd: 2000 } } },
  x3_icezombie: { key: "x3_icezombie", name: "얼어붙은 좀비", hp: 152, atk: 25, speed: 92, aggro: 300, exp: 70, gold: [13, 19], dropHp: 0.3, dropMp: 0.24, profile: { apply: { kind: "slow", chance: 0.45, dps: 0, dur: 2500 } } },
  x3_tinyzombie: { key: "x3_tinyzombie", name: "굶주린 좀비", hp: 160, atk: 29, speed: 168, aggro: 380, exp: 90, gold: [14, 22], dropHp: 0.3, dropMp: 0.22, profile: { apply: { kind: "bleed", chance: 0.5, dps: 6, dur: 4000 } } },
  x3_ogre: { key: "x3_ogre", name: "광포한 오거", hp: 265, atk: 43, speed: 74, aggro: 280, exp: 132, gold: [20, 30], dropHp: 0.38, dropMp: 0.28, scale: 1.15 },
  x3_chort: { key: "x3_chort", name: "악마다라 촐트", hp: 228, atk: 40, speed: 118, aggro: 380, exp: 118, gold: [19, 28], dropHp: 0.32, dropMp: 0.26, profile: { charge: { cd: 4200, speed: 420, time: 520 } } },
  x3_necromancer: { key: "x3_necromancer", name: "강령술사", hp: 212, atk: 42, speed: 80, aggro: 380, exp: 126, gold: [20, 29], dropHp: 0.32, dropMp: 0.28, profile: { ranged: { projAnim: "fx-darkbolt", projSpeed: 300, range: 290, cd: 2400 } } },
  /* v3.0.4 — itch.io 0x72 팩 추가 6종: 각자 고유 개성 (출혈/돌진/원거리/군집/중장) */
  x3_maskedorc: { key: "x3_maskedorc", name: "가면 전사", hp: 205, atk: 38, speed: 124, aggro: 340, exp: 110, gold: [17, 26], dropHp: 0.32, dropMp: 0.24, profile: { apply: { kind: "bleed", chance: 0.5, dps: 7, dur: 4000 } } },
  x3_orcwarrior: { key: "x3_orcwarrior", name: "오르크 전사", hp: 245, atk: 44, speed: 104, aggro: 360, exp: 130, gold: [20, 30], dropHp: 0.34, dropMp: 0.26, profile: { charge: { cd: 4600, speed: 400, time: 480 } } },
  x3_orcshaman: { key: "x3_orcshaman", name: "오르크 주술사", hp: 188, atk: 36, speed: 86, aggro: 380, exp: 120, gold: [19, 27], dropHp: 0.32, dropMp: 0.28, profile: { ranged: { projAnim: "fx-magicorb", projSpeed: 310, range: 280, cd: 2300 } } },
  x3_wogol: { key: "x3_wogol", name: "지옥견 워골", hp: 198, atk: 41, speed: 152, aggro: 400, exp: 128, gold: [19, 28], dropHp: 0.3, dropMp: 0.24, profile: { charge: { cd: 3800, speed: 460, time: 460 }, apply: { kind: "bleed", chance: 0.4, dps: 6, dur: 3500 } } },
  x3_goblin: { key: "x3_goblin", name: "고블린 약탈자", hp: 66, atk: 14, speed: 172, aggro: 360, exp: 26, gold: [6, 10], dropHp: 0.28, dropMp: 0.2 },
  x3_bigzombie: { key: "x3_bigzombie", name: "거대 시체", hp: 320, atk: 47, speed: 62, aggro: 280, exp: 148, gold: [22, 33], dropHp: 0.4, dropMp: 0.3, scale: 1.2, profile: { apply: { kind: "poison", chance: 0.45, dps: 7, dur: 5000 }, fieldOnDeath: { kind: "poison", dps: 8, dur: 4000, radius: 100 } } },
};

/* ================= 보스 정의 (v1.5 데이터 이관 + 챕터 보강) ================= */

export const BOSS_DEFS: Record<BossKey, BossDef> = {
  guardian: {
    key: "guardian", name: "심연의 수호자",
    hp: 3200, atk: 24, speed: 92, exp: 320, gold: 220,
    tex: "boss", orbTint: 0x9d7aff, introDialogue: "bossIntroGuardian",
    /* 수호자 = 지진 — 마지막 페이즈에서 연속 낙뢰(심연 지진) 개방 */
    patterns: {
      p1: ["slam", "charge", "volley"],
      p2: ["slam", "charge", "volley", "ring", "zones"],
      p3: ["slam", "charge", "volley", "ring", "zones", "quake"],
    },
  },
  behemoth: {
    key: "behemoth", name: "눈보라의 거수",
    hp: 5200, atk: 31, speed: 84, exp: 500, gold: 300,
    tex: "boss2", orbTint: 0x8ad4ff, introDialogue: "bossIntroBehemoth",
    /* 눈보라의 화신 — 나선 탄막(블리자드 스톰) 시그니처 */
    patterns: {
      p1: ["slam", "volley", "zones"],
      p2: ["slam", "charge", "volley", "zones", "spiral"],
      p3: ["slam", "charge", "volley", "zones", "ring", "spiral", "quake"],
    },
  },
  abysslord: {
    key: "abysslord", name: "심연의 군주",
    hp: 8500, atk: 38, speed: 98, exp: 800, gold: 420,
    tex: "boss3", orbTint: 0xff5a7a, introDialogue: "bossIntroLord",
    /* 심연의 전술가 — 나선 탄막 + 최초의 반격 카운터 개방(2페이즈) */
    patterns: {
      p1: ["volley", "charge", "slam"],
      p2: ["volley", "charge", "ring", "zones", "spiral", "counter"],
      p3: ["volley", "charge", "ring", "zones", "summon", "spiral", "counter"],
    },
    summonKey: "wraith",
  },
  nidhog: {
    key: "nidhog", name: "탐식의 드래곤 니드호그",
    hp: 3600, atk: 26, speed: 90, exp: 380, gold: 260,
    tex: "boss_nidhog", orbTint: 0x7dff9a, introDialogue: "bossIntroNidhog",
    /* 드래곤 — 독 브레스 스윕 빔 시그니처(2페이즈부터) */
    patterns: {
      p1: ["slam", "charge", "volley"],
      p2: ["slam", "charge", "volley", "ring", "beam"],
      p3: ["slam", "charge", "volley", "ring", "zones", "beam", "summon"],
    },
    summonKey: "swampbeast",
  },
  surt: {
    key: "surt", name: "화염의 거인 수르트",
    hp: 5400, atk: 33, speed: 88, exp: 560, gold: 340,
    tex: "boss_surt", orbTint: 0xffa05a, introDialogue: "bossIntroSurt",
    /* 라그나로스 — 화염 스윕 빔 + 최후 연속 낙뢰(용암 분출) */
    patterns: {
      p1: ["slam", "volley", "zones"],
      p2: ["slam", "charge", "volley", "zones", "beam"],
      p3: ["slam", "charge", "volley", "zones", "ring", "beam", "quake"],
    },
  },
  fenrir: {
    key: "fenrir", name: "탐욕의 늑대 펜리르",
    hp: 7400, atk: 36, speed: 96, exp: 640, gold: 380,
    tex: "boss_fenrir", orbTint: 0xc08aff, introDialogue: "bossIntroFenrir",
    /* 사슬이 묶인 늑대 — 2연속 돌진 + 그림자 급습(순간이동 강타) */
    chargeChain: 2,
    patterns: {
      p1: ["charge", "volley", "ring"],
      p2: ["slam", "charge", "volley", "zones", "blink"],
      p3: ["slam", "charge", "volley", "zones", "ring", "blink"],
    },
  },
  skoll: {
    key: "skoll", name: "교만의 쌍랑 스콜&하티",
    hp: 8600, atk: 39, speed: 100, exp: 720, gold: 420,
    tex: "boss_skoll", orbTint: 0xffd97a, introDialogue: "bossIntroSkoll",
    /* 태양을 쫓는 쌍랑 — 3연속 교차 돌진(최종 페이즈 3회) + 스윕 빔 */
    chargeChain: 2,
    patterns: {
      p1: ["volley", "charge", "slam"],
      p2: ["volley", "charge", "ring", "zones", "beam", "blink"],
      p3: ["volley", "charge", "ring", "zones", "summon", "beam", "blink"],
    },
    summonKey: "runegolem",
  },
  gram: {
    key: "gram", name: "혈안의 문지기 가름", /* v4.1.3 (#신화고증) — 구 표기 "대지의 괴물 그람": 그람(Gram)은 시구르드의 검이다. 헬의 대문을 지키는 존재는 사냥개 가름(Garmr) */
    hp: 10600, atk: 42, speed: 86, exp: 860, gold: 480,
    tex: "boss_gram", orbTint: 0x8affc0, introDialogue: "bossIntroGram",
    /* 헬의 문지기 — 반격 카운터(창을 놓치면 문이 닫힌다) + 그림자 급습 */
    patterns: {
      p1: ["slam", "charge", "volley", "zones"],
      p2: ["slam", "charge", "volley", "ring", "zones", "counter", "blink"],
      p3: ["slam", "charge", "volley", "ring", "zones", "summon", "counter", "blink", "quake"],
    },
    summonKey: "helhound",
  },
  abudditos: {
    key: "abudditos", name: "종언의 마룡 아부디토스", /* v4.1.3 (#신화고증) — 구 표기 "니드그림"을 세계관 근원인 아부디토스로 통일 */
    hp: 14500, atk: 46, speed: 100, exp: 1200, gold: 650,
    tex: "boss_abudditos", orbTint: 0xff3a6a, introDialogue: "bossIntroAbudditos",
    /* 종언의 마룡 — 모든 시그니처 패턴의 종합 세트(마룡의 전례 없는 재앙) */
    chargeChain: 2,
    patterns: {
      p1: ["volley", "charge", "ring", "beam"],
      p2: ["volley", "charge", "ring", "zones", "summon", "beam", "spiral", "blink"],
      p3: ["slam", "charge", "volley", "ring", "zones", "summon", "beam", "spiral", "blink", "quake", "counter"],
    },
    summonKey: "helhound",
  },
  /* v1.0.19 (A-3 신규 스테이지 15종) — 재림 지역 보스 3종.
   *  기존 보스 정의는 전부 유지 — 신규 3종은 기존 텍스처(휴먼 리소스 제로)를 재활용하되
   *  이름·색조·패턴 구성을 다르게 해 별개의 적으로 기능한다. */
  vord: {
    key: "vord", name: "재림의 파수꾼 베오르드",
    hp: 16800, atk: 50, speed: 92, exp: 1500, gold: 800,
    tex: "boss2", orbTint: 0xffb05a, introDialogue: "bossIntroAbudditos",
    /* 대지를 지키는 파수꾼 — 연속 낙뢰(지진) + 반격 카운터 */
    patterns: {
      p1: ["slam", "charge", "volley", "zones"],
      p2: ["slam", "charge", "ring", "zones", "quake", "counter"],
      p3: ["slam", "charge", "volley", "ring", "zones", "summon", "quake", "counter"],
    },
    summonKey: "x3_orcwarrior",
  },
  jorm: {
    key: "jorm", name: "세계수를 먹는 뱀 요르문간드",
    hp: 21500, atk: 55, speed: 104, exp: 1900, gold: 980,
    tex: "boss_nidhog", orbTint: 0x9affd0, introDialogue: "bossIntroAbudditos",
    /* 세계수를 감는 뱀 — 스윕 빔 + 나선 탄막 + 2연속 돌진 */
    chargeChain: 2,
    patterns: {
      p1: ["volley", "charge", "beam"],
      p2: ["volley", "charge", "ring", "zones", "beam", "spiral"],
      p3: ["slam", "charge", "volley", "ring", "zones", "summon", "beam", "spiral", "blink"],
    },
    summonKey: "x2_reeffish",
  },
  nagr: {
    key: "nagr", name: "재림의 종언 나그라파르",
    hp: 30000, atk: 62, speed: 108, exp: 2600, gold: 1400,
    tex: "boss_abudditos", orbTint: 0xffd76a, introDialogue: "bossIntroAbudditos",
    /* 종언을 먹는 존재 — 재림 지역 최종 보스, 전 패턴 종합 + 카오스급 구성 */
    chargeChain: 2,
    patterns: {
      p1: ["volley", "charge", "ring", "spiral"],
      p2: ["slam", "charge", "volley", "ring", "zones", "summon", "beam", "spiral", "counter"],
      p3: ["slam", "charge", "volley", "ring", "zones", "summon", "beam", "spiral", "blink", "quake", "counter"],
    },
    summonKey: "x3_necromancer",
  },
};

/* ================= 스테이지 생성기 ================= */

/** 챕터별 난이도 배율 (인덱스 = 장번호-2 → forest(2장)부터) */
/* v3.0.22 (#50) — "챕터를 지날수록 쎄져야 하는데 약함" — 챕터 스케일링 전면 강화.
 *  기존 곡선(HP 1→5.4·ATK 1→3.0)은 유저 장비 성장(스타포스/세트/잠재/엘릭서)을 전혀 못 따라갔다.
 *  신규 곡선: HP 챕터당 ~×1.35 복합(최종 15.5배)·ATK ~×1.22 복합(최종 5.0배)·EXP 완화 병행.
 *  1~2장은 기존 체감 유지(±0.1), 3장부터 격차가 벌어지기 시작한다. */
/* v1.4.0 (Task 1-3 — 유저 지시 #9) — 후반 몬스터 HP 스케일링 대폭 상향:
 *  유저 지시 “공격력은 괜찮은데 후반 갈수록 보스·몬스터가 너무 약하다” — ATK 곡선은 유지하고
 *  HP만 후반 급등(챕터 9 = 기존 ×15.5 → ×42, 유저 DPS 2차 곡선 추격). 전투 체감: 동일 레벨
 *  일반 몬스터 4~6타 → 후반 6~8타, 스킬 2~3타 유지 목표.
 *  v1.4.0 세이브 호환 — 배율만 변경, 기존 테이블 구조/키 유지 */
const CH_HP = [1, 1.35, 2.0, 3.2, 5.2, 8.5, 14.0, 24.0, 42.0];
const CH_ATK = [1, 1.18, 1.45, 1.78, 2.2, 2.7, 3.35, 4.1, 5.0]; // 유저 피드백: 공격력은 현행 유지
const CH_EXP = [1, 1.4, 1.9, 2.55, 3.35, 4.35, 5.6, 7.2, 9.2];

/** 스테이지 키 → {챕터, 구역} 파싱 */
export function parseStage(key: StageKey): { ch: ChapterKey | "village"; sub: number } {
  if (key === "village" || !key) return { ch: "village", sub: 0 };
  /* v2.9 — 챕터 마을(Xv)도 챕터 소속으로 파싱 */
  const v = /^([a-z]+)v$/.exec(key);
  if (v) return { ch: v[1] as ChapterKey, sub: 0 };
  const m = /^(forest|kingdom|alfheim|muspelheim|niflheim|cave|nidavellir|hel|abyss)([1-9]|10)$/.exec(key);
  if (!m) return { ch: "village", sub: 0 };
  return { ch: m[1] as ChapterKey, sub: parseInt(m[2], 10) };
}

export function chapterSpec(key: StageKey): ChapterSpec | null {
  const { ch } = parseStage(key);
  return CHAPTERS.find((c) => c.key === ch) ?? null;
}

/** v1.4.0 (Task 1-6 — 유저 지시 #14) — 레벨 구간별 퀘스트 요구 마릿수 곡선
 *  1~20: 5~8 · 21~40: 10~15 · 41~60: 18~25 · 61~80: 30~40 · 81~100: 45~60 */
export function questNeedByLv(lv: number): number {
  const l = Math.min(100, Math.max(1, Math.round(lv))); // 순수 Math — stages.ts는 Phaser 미임포트(모듈 초기화 순서 보호)
  if (l <= 20) return Math.round(5 + ((l - 1) / 19) * 3);
  if (l <= 40) return Math.round(10 + ((l - 21) / 19) * 5);
  if (l <= 60) return Math.round(18 + ((l - 41) / 19) * 7);
  if (l <= 80) return Math.round(30 + ((l - 61) / 19) * 10);
  return Math.round(45 + ((l - 81) / 19) * 15);
}

/** 구역별 성장 배율 — 적 HP/ATK/EXP/골드 (사용자 지시 #6/#9 밸런스)
 *  v1.0.19 (A-3) — 신규 스테이지(scaleMul 보유)는 전용 배율 우선, 기존 챕터는 기존 곡선 유지 */
export function stageScale(key: StageKey): { hp: number; atk: number; exp: number; gold: number } {
  const own = STAGES[key]?.scaleMul;
  if (own) return { ...own };
  const spec = chapterSpec(key);
  if (!spec) return { hp: 1, atk: 1, exp: 1, gold: 1 };
  const { sub } = parseStage(key);
  const i = spec.num - 2;
  /* v3.0.22 (#50) — 구역 진행 배율 상향: 구역당 HP +7.5%·ATK +6% (기존 5.5/4.5%) */
  const subMul = 1 + (sub - 1) * 0.075;
  return {
    hp: CH_HP[i] * subMul,
    atk: CH_ATK[i] * (1 + (sub - 1) * 0.06),
    exp: CH_EXP[i] * subMul,
    gold: (1 + i * 0.42) * subMul,
  };
}

/** 구역 5 정예 이름 */
const ELITE_TITLE = ["정예", "광포한", "심연에 물든", "각성한", "포화의", "얼어붙은", "먹이는", "폭주하는", "절규하는", "종언의"];

/** v2.9 (지시 #1) — 구역 → 몬스터 조합. 2구역마다 주력몬 교체로 단조로움 해소
 *  v3.0 (사용자 지시 #6) — 구역당 동시 몬스터 상한 20마리 (최적화):
 *  기존 grp()가 그룹별 20 캡이라 9~10구역 합계 26마리까지 늘었음 → 총량제로 재편 */
function subEnemyMix(spec: ChapterSpec, sub: number): { key: EnemyKey; count: number }[] {
  const pool = spec.enemies.map((g) => g.key);
  const a = pool[0];
  const b = pool[1] ?? pool[0];
  const c = pool[2] ?? b;
  const d = pool[3] ?? a; // v3.0.2 — 챕터 4번째 종 (신규 몬스터)
  const e = pool[4] ?? d; // v3.0.3 — 챕터 5번째 종 (0x72 고유개성 몬스터)
  const f = pool[5] ?? e; // v3.0.4 — 챕터 6번째 종(itch.io 신규): 전 구역 소량 혼합으로 다양화
  const TOTAL = 20; // 구역당 동시 스폰 상한 (정예/보스 포함 총량)
  if (sub <= 2) return [{ key: a, count: 15 }, { key: f, count: 5 }];
  if (sub <= 4) return [{ key: b, count: 15 }, { key: f, count: 5 }];
  // 5구역은 정예 1기가 별도 스폰 → 잡몹 19 + 정예 1 = 20
  if (sub <= 6)
    return [
      { key: c, count: sub === 5 ? 14 : 15 },
      { key: f, count: sub === 5 ? 5 : 5 },
    ];
  if (sub <= 8)
    return [
      // v3.0.3 — 7~8구역: 신규 종(d)과 0x72 고유개성 종(e) 교대 주력 + f 소량
      ...(sub === 7
        ? [{ key: d, count: 10 }, { key: e, count: 6 }]
        : [{ key: e, count: 10 }, { key: d, count: 6 }]),
      { key: f, count: 4 },
    ];
  if (sub === 10)
    return [
      // 10구역은 보스 1기 별도 스폰 → 잡몹 19 + 보스 1 = 20
      { key: b, count: 7 },
      { key: c, count: 5 },
      { key: e, count: 4 },
      { key: f, count: 3 },
    ];
  return [
    { key: b, count: 7 },
    { key: c, count: 5 },
    { key: e, count: 4 },
    { key: f, count: 4 },
  ]; // 9구역 4종 20마리
}

function buildQuests(spec: ChapterSpec, sub: number, prefix: string): QuestDef[] {
  const quests: QuestDef[] = [];
  /* v2.4 레벨 게이트 (사용자 지시 — "5레벨을 찍자!!" 식의 명확한 동기부여):
   *  각 챕터 진입(sub1)·중간(sub4)에 목표 레벨 퀘스트를 체인 맨 앞에 배치해
   *  다음 사냥터로 넘어가는 진행 게이트이자 성장 목표를 제공한다.
   *  보상 exp는 게이트 달성 직후 다음 목표로 자연스럽게 이어지도록 챕터 배율 반영 */
  const gateLv = sub === 1 ? spec.lvGate.enter : sub === 4 ? spec.lvGate.mid : null;
  if (gateLv != null) {
    const gateExp = Math.round((70 + gateLv * 6) * CH_EXP[spec.num - 2] * 0.55);
    quests.push({
      id: `${prefix}-lv-gate`,
      type: "level",
      title: `Lv ${gateLv} 달성!!`,
      desc: `${spec.title}에 들어온 이상 약해서는 안 된다. ${gateLv}레벨을 찍어 몬스터를 쓰러뜨릴 준비를 마쳐라!`,
      need: gateLv,
      targetLabel: `Lv ${gateLv}`,
      reward: Math.round((45 + gateLv * 3) * G),
      expReward: gateExp,
    });
  }
  const beat = spec.beats.find((b) => b.sub === sub);
  if (beat) {
    quests.push({ ...beat.quest, id: `${prefix}-${beat.quest.id}` });
  }
  const labels: Record<EnemyKey, string> = {
    wolf: "늑대", minion: "심연 하수인", spider: "동굴 거미", golem: "수정 골렘",
    frostwolf: "서리 늑대", icegolem: "얼음 골렘", wraith: "심연 유령",
    swampbeast: "능대", emberwolf: "불꽃 늑대", firespirit: "화염 정령",
    runegolem: "룬 골렘", helhound: "헬 하운드",
    x2_frog: "독개구리", x2_rat: "궁전 뒷쥐", x2_bat: "황혼 박쥐", x2_firebird: "잿불 새",
    x2_frostfly: "서리 날도요", x2_snail: "동굴 달팽이", x2_stonegolem: "장벽 돌골렘",
    x2_darkhound: "그늘 이리", x2_reeffish: "심연 암초물고기",
    x3_swampy: "늪지 독괴물", x3_imp: "잉걸불 임프", x3_icezombie: "얼어붙은 좀비",
    x3_tinyzombie: "굶주린 좀비", x3_ogre: "광포한 오거", x3_chort: "악마다라 촐트",
    x3_necromancer: "강령술사",
    x3_maskedorc: "가면 전사", x3_orcwarrior: "오르크 전사", x3_orcshaman: "오르크 주술사",
    x3_wogol: "지옥견 워골", x3_goblin: "고블린 약탈자", x3_bigzombie: "거대 시체",
  };
  const verbs = ["토벌", "소탕", "박멸", "정찰 지원", "제거"];
  /* v3.0.2 (버그 수정 — "퀘스트는 늑대 소탕인데 맵에는 유령만"):
   *  자동 토벌 대상을 spec.main(챕터 대표)이 아니라 이 구역에서 실제 스폰되는 몬스터로 지정.
   *  v2.9 구역별 몬스터 로테이션(1~6구역 단일종)과 퀘스트 대상이 어긋난 것이 원인 */
  const zoneMix = subEnemyMix(spec, sub);
  const zoneMon = zoneMix.reduce((m, g) => (g.count > m.count ? g : m), zoneMix[0]).key;
  const main = labels[zoneMon];
  if (quests.length < 2) {
    // 자동 토벌 퀘스트 — v1.4.0 (Task 1-6 — 유저 지시 #14): 스킬이 강해질수록 요구 마릿수도 성장
    //   1~20렙 5~8 · 21~40 10~15 · 41~60 18~25 · 61~80 30~40 · 81+ 45~60 (챕터 입장 게이트 레벨 기준)
    //   보상도 동일 곡선 배율로 상향 — 시간당 보상 급락 방지
    const lvRef = spec.lvGate.enter + (sub - 1) * 2;
    const n = questNeedByLv(lvRef);
    /* v3.0.28 (#퀘스트이름) — 토벌 대상을 "이 구역에 실제 스폰되는 몬스터 전체"로 확장(targetKeys).
     *  기존엔 구역 최다 종 1종만 대상이라 얼음좀비 구역에서 거미 사냥 퀘스트가 뜨는 등
     *  화면 몬스터와 퀘스트 이름이 어긋나 체감됐다 → 무엇을 잡아도 카운트되며 혼란 제거.
     *  buildStage의 편입 로직(스토리 beat 대상 + 반복 의뢰 대상 spec.main)을 미러링해
     *  편입분 종까지 카운트 대상에 포함한다 (count 0 — 최다 판정에는 영향 없음). */
    const mixKeys = [...new Set(zoneMix.map((g) => g.key))];
    const beatHereQ = spec.beats.find((b) => b.sub === sub);
    if (beatHereQ?.quest.type === "hunt" && beatHereQ.quest.targetKey && !mixKeys.includes(beatHereQ.quest.targetKey)) {
      mixKeys.push(beatHereQ.quest.targetKey);
    }
    if (!mixKeys.includes(spec.main)) mixKeys.push(spec.main);
    quests.push({
      id: `${prefix}-auto-hunt`,
      type: "hunt",
      title: `${main} ${verbs[sub % verbs.length]}`,
      /* v4.1.3 (#퀘스트카운트) — "요구 몬스터 ≠ 카운트 몬스터" 혼란 해소 (지시 #4):
       *  이 퀘스트는 구역 스폰 몬스터 전체(targetKeys)를 합산 카운트한다. 그 사실을
       *  설명에 명시해 "고블린 소탕인데 개구리를 잡았더니 카운트된다?"를 사전에 제거. */
      desc: `${spec.title} 구역의 몬스터 ${n}마리를 처치해라. — 무엇을 잡아도 카운트된다 (${mixKeys.map((k) => labels[k]).join(" · ")})`,
      need: n,
      targetKey: zoneMon, // v3.0.2 — 하위 호환(어시스트·히스테리시스 참조): 구역 최다 종
      targetKeys: mixKeys, // v3.0.28 — 카운트·판정은 구역 스폰 몬스터 전체 합산
      targetLabel: `${main} 등 구역 몬스터`,
      reward: Math.round((55 + sub * 14) * CH_EXP[spec.num - 2] * 0.55 * G * Math.max(1, n / 8)), // 마릿수 증가분만큼 골드 보상 동반 상향
      expReward: Math.round((60 + sub * 14) * CH_EXP[spec.num - 2] * 0.9 * Math.max(1, n / 8)),
    });
  }
  if (sub === 9) {
    // 챕터 결전 직전 수확 퀘스트
    quests.push({
      id: `${prefix}-pre-boss-collect`,
      type: "collect",
      title: "마지막 결정의 흔적",
      desc: `${spec.title}의 심장부 — 결정의 흔적이 강하게 빛나고 있다.`,
      targetLabel: "결정의 흔적",
      reward: Math.round(140 * CH_EXP[spec.num - 2] * 0.7 * G),
      expReward: Math.round(120 * CH_EXP[spec.num - 2]),
    });
  }
  if (sub === 10 && spec.boss) {
    quests.push({
      id: `${prefix}-boss`,
      type: "boss",
      title: BOSS_DEFS[spec.boss].name,
      desc: `${spec.title}의 주인 — ${BOSS_DEFS[spec.boss].name}를 처치해라!`,
      targetLabel: BOSS_DEFS[spec.boss].name,
      reward: Math.round(320 * CH_EXP[spec.num - 2] * 0.7 * G),
      expReward: Math.round(260 * CH_EXP[spec.num - 2]),
    });
    // 챕터 최종 — 다음 챕터로 나가는 차원문
    quests.push({
      id: `${prefix}-next`,
      type: "reach",
      title: "다음 해역으로",
      desc: "열린 차원문에 닿아 다음 해역으로 이동해라.",
      targetLabel: "차원문",
      dialogue: spec.bossDone,
    });
  }
  return quests;
}

function buildStage(spec: ChapterSpec, sub: number): StageDef {
  const key = `${spec.key}${sub}`;
  const prefix = `${spec.key}${sub}`;
  const boss = sub === 10 && !!spec.boss;
  /* v2.9 (사용자 지시 #1) — 구역별 몬스터 조합 개편:
   *  1~2구역 풀[0] 1종 / 3~4 풀[1] 1종 / 5~6 풀[2] 1종 (2구역마다 몬스터 교체)
   *  7~8구역 2종 / 9구역 3종 / 10구역 보스 + 3종(잡몹 소규모) */
  const enemies = subEnemyMix(spec, sub);
  /* v3.0.2 — 스토리(beat) 토벌 대상이 이 구역 스폰 조합에 없으면 대상 몬스터를 스폰에 편입.
   *  v2.9 구역별 단일종 로테이션 때문에 "퀘스트는 늑대 소탕인데 맵엔 유령만" 오류가 생김.
   *  최다 그룹에서 3마리를 덜어 편입 — 총량 20 유지 (정예/보스 포함) */
  const beatHere = spec.beats.find((b) => b.sub === sub);
  if (beatHere && beatHere.quest.type === "hunt" && beatHere.quest.targetKey && !enemies.some((g) => g.key === beatHere.quest.targetKey)) {
    /* v1.0.8 — 편입 차감 대상을 퀘스트 대상 종이 아닌 최대 그룹에서: 토벌 대상을 깎아 편입하던
     *  기존 방식은 2-6 능대처럼 대상 밀도를 스스로 깎는 모순 (donor=enemies[0] == 대상종) */
    const drainPool = enemies.filter((g) => g.key !== beatHere.quest.targetKey);
    const donor = (drainPool.length ? drainPool : enemies).reduce((m, g) => (g.count > m.count ? g : m), (drainPool.length ? drainPool : enemies)[0]);
    donor.count = Math.max(1, donor.count - 3);
    const sum = enemies.reduce((t, g) => t + g.count, 0);
    enemies.push({ key: beatHere.quest.targetKey, count: Math.max(1, Math.min(3, 20 - sum)) });
  }
  /* v3.0.6 (지시 #1 — "반복 의뢰 안됨") — [반복] 토벌 의뢰 대상(spec.main)이 이 구역 스폰 조합에 없으면 편입.
   *  구역별 단일종 로테이션(1~6구역은 풀 1종만 스폰) 때문에 반복 의뢰 대상 몬스터가 맵에 아예 없어
   *  사냥해도 카운트가 전혀 오르지 않던 근본 원인 제거 (스토리 beat 편입과 동일 패턴) */
  if (!enemies.some((g) => g.key === spec.main)) {
    /* v1.0.8 — 반복 의뢰 편입도 퀘스트 토벌 대상 종은 보호: 비대상 최대 그룹에서 차감 */
    const beatTarget = beatHere && beatHere.quest.type === "hunt" ? beatHere.quest.targetKey : undefined;
    const drainPool2 = enemies.filter((g) => g.key !== beatTarget);
    const donor2 = (drainPool2.length ? drainPool2 : enemies).reduce((m, g) => (g.count > m.count ? g : m), (drainPool2.length ? drainPool2 : enemies)[0]);
    donor2.count = Math.max(1, donor2.count - 3);
    const sum = enemies.reduce((t, g) => t + g.count, 0);
    enemies.push({ key: spec.main, count: Math.max(1, Math.min(3, 20 - sum)) });
  }
  /* v1.0.8 — 토벌 퀘스트 구역 밀도 보장 (유저 지시 "2-6 능대 25마리가 너무 오래 걸림"):
   *  스토리 토벌 대상 종이 이 구역에 최소 15마리 스폰되도록 부스트 — 다른 종에서 차감 (각 종 최소 2 유지).
   *  2-6: 능대 12 → 15마리 (반복의뢰 늑대 편입이 능대를 깎던 모순 제거 + 밀도 부스트) */
  {
    const beatHunt = spec.beats.find((b) => b.sub === sub && b.quest.type === "hunt" && b.quest.targetKey);
    if (beatHunt) {
      const target = enemies.find((g) => g.key === beatHunt.quest.targetKey);
      if (target && target.count < 15) {
        const donors = enemies.filter((g) => g !== target);
        let need = 15 - target.count;
        let guard = 24;
        while (need > 0 && guard-- > 0) {
          const d = donors.reduce((m, g) => (g.count > m.count ? g : m), donors[0]);
          if (!d || d.count <= 2) break;
          d.count -= 1; target.count += 1; need -= 1;
        }
      }
    }
  }
  const def: StageDef = {
    key,
    name: `제${spec.num}장 ${spec.title}`,
    subtitle: `${sub}구역 — ${spec.subtitle}`,
    width: spec.width + sub * 130,
    height: spec.height + sub * 30,
    groundTint: spec.groundTint,
    flowerCount: spec.flowers,
    treeCount: spec.trees,
    rockCount: spec.rocks,
    quests: buildQuests(spec, sub, prefix),
    enemies,
    boss,
    bossKey: boss ? spec.boss : undefined,
    repeat: {
      targetKey: spec.main,
      /* v1.4.0 (Task 1-6) — 반복 의뢰 요구량도 레벨 곡선 연동(기존 need+sub 대비 최대 ×1.5 상한) */
      need: Math.min(Math.round(spec.repeat.need * 1.5), Math.round((spec.repeat.need + sub) * Math.max(1, questNeedByLv(spec.lvGate.enter) / 8))),
      gold: Math.round(spec.repeat.gold * stageScale(key).gold * 0.9),
      exp: Math.round(spec.repeat.exp * stageScale(key).exp * 0.9),
      title: spec.repeat.title,
      desc: spec.repeat.desc,
    },
  };
  if (sub === 5) {
    def.elite = {
      key: spec.main,
      hpMult: 7.5,
      atkMult: 1.5,
      name: `${ELITE_TITLE[spec.num - 2]} ${ENEMIES[spec.main].name}`,
    };
  }
  return def;
}

/* 마을 (제1장 — 미드가르드 항구 마을) */
const VILLAGE: StageDef = {
  key: "village",
  name: "제1장 미드가르드",
  subtitle: "항구 마을 — 모험의 시작",
  width: 1500,
  height: 950,
  groundTint: 0x9adf6a,
  flowerCount: 8,
  treeCount: 7,
  rockCount: 2,
  isVillage: true,
  quests: [
    {
      id: "v0",
      type: "talk",
      title: "마을 주민과 인사",
      desc: "주민에게 가까이 가서 E키(모바일은 버튼)로 대화해 보자.",
      need: 2,
      targetLabel: "마을 주민",
      expReward: 25,
    },
    {
      /* v1.4.3 (작업2) — 초보 사냥 퀘스트 신설: 사냥터 입장 전 마을 훈련장에서 기본기를 익히는
       *  튜토리얼 전투. v0 인사(25 exp) → 훈련용 늑대 4마리(~29 exp×4 + 45) → Lv 2~3 달성 후 숲 이동.
       *  구세이브는 마을 questIdx가 한 칸 밀린다 — 진행 재개는 자동(미완료 퀘스트만 다시 수행). */
      id: "v1",
      type: "hunt",
      title: "훈련용 늑대 길들이기",
      desc: "마을 동쪽 초행자 훈련장의 훈련용 늑대 4마리를 처치해 기본기를 익혀라.",
      need: 4,
      targetKey: "wolf",
      targetLabel: "훈련용 늑대",
      reward: Math.round(30 * G),
      expReward: 45,
    },
    {
      id: "v2",
      type: "reach",
      /* v3.0.26 (#75) — "서쪽 숲의 신전으로" 제목이 실존하지 않는 '서쪽 숲'을 가리켜
       *  유저가 마을 서쪽을 헤매는 혼동 수정. 실제 목적지는 동쪽 차원문 너머 '숲의 신전'(2-1). */
      title: "숲의 신전으로",
      desc: "훈련을 마쳤다 — 마을 동쪽 차원문을 지나 첫 사냥터 '숲의 신전'(2-1)에 도착해라.",
      targetLabel: "동쪽 차원문",
    },
  ],
  enemies: [],
  boss: false,
};

/* ---------- 90 구역 생성 ---------- */

export const STAGES: Record<StageKey, StageDef> = { village: VILLAGE };
export const NEXT_STAGE: Record<StageKey, StageKey | null> = { village: "forest1" };
export const PREV_STAGE: Record<StageKey, StageKey | null> = { village: null };
/** 구역 라벨 — "2-3" 형식 (복귀 차원문/HUD 표기) */
export const STAGE_SHORT: Record<StageKey, string> = { village: "미드가르드 마을" };

for (let ci = 0; ci < CHAPTERS.length; ci++) {
  const spec = CHAPTERS[ci];
  for (let sub = 1; sub <= 10; sub++) {
    const key = `${spec.key}${sub}`;
    STAGES[key] = buildStage(spec, sub);
    STAGE_SHORT[key] = `${spec.num}-${sub}`;
    /* v2.9 (지시 #5) — 10구역 통과 후 다음 챕터의 마을에 들린 뒤 1구역으로 */
    const next = ci < CHAPTERS.length - 1 ? `${CHAPTERS[ci + 1].key}v` : null;
    NEXT_STAGE[key] = sub < 10 ? `${spec.key}${sub + 1}` : next;
    /* v2.9 (지시 #5) — 10구역 통과 후 다음 챕터의 마을에 들린 뒤 1구역으로
     *  v3.0.11 (피드백 #5) — 복귀 체인이 전진 체인의 정확한 역순이 되도록 수정:
     *    전진: 1-10 → 2v마을 → 2-1  /  복귀: 2-1 → 2v마을 → 1-10
     *    (기존엔 2-1 복귀가 1-10 사냥터로 바로 가 마을을 건너뛰던 버그) */
    PREV_STAGE[key] = sub > 1 ? `${spec.key}${sub - 1}` : ci > 0 ? `${spec.key}v` : "village";
  }
  /* 챕터 마을 체인 — 이전 챕터 10구역 ↔ 마을 ↔ 이 챕터 1구역 */
  const vk = `${spec.key}v`;
  STAGES[vk] = buildChapterVillageDef(spec);
  STAGE_SHORT[vk] = `${spec.title} 마을`;
  NEXT_STAGE[vk] = `${spec.key}1`;
  PREV_STAGE[vk] = ci > 0 ? `${CHAPTERS[ci - 1].key}10` : "village";
}

/* v2.9 (사용자 지시 #5) — 챕터별 마을: 모든 챕터에 안전 마을(여관/전직관/우물)을 둔다.
 *  진행 경로: 이전 챕터 10구역 → 다음 챕터 마을(Xv) → 다음 챕터 1구역 */
function buildChapterVillageDef(spec: ChapterSpec): StageDef {
  return {
    key: `${spec.key}v`,
    name: `${spec.title} 마을`,
    subtitle: `${spec.subtitle} — 여행자들의 안식처`,
    width: 1500,
    height: 860,
    groundTint: spec.groundTint,
    flowerCount: 6,
    treeCount: 6,
    rockCount: 2,
    quests: [],
    enemies: [],
    boss: false,
    isVillage: true,
  };
}

/* ================= 인테리어 (v2.2 — 여관/내 집 실내 맵, 사용자 지시) =================
 *  - 건물에 E로 들어가면 실내 맵으로 이동: 여관주인과 대화 → 돈 내고 취침 연출 → 버프
 *  - 실내는 세이브 스테이지에 기록하지 않는다(들어가기 전 구역 유지 — 종료 시 마을 앞으로 복귀)
 */
export type InteriorKey = "interior_inn" | "interior_home";

  /* v2.2 실내/취침 — v2.3: 정사각형 방 느낌 (사용자 지시 — 여관/집은 굳이 크게 만들지 않는다)
   * 832×832 정사각형 + 실내 전용 카메라 줌(×1.45)으로 아늑한 한 방 연출 */
function buildInteriorDef(key: InteriorKey): StageDef {
  return {
    key,
    name: key === "interior_inn" ? "여관 로안의 실내" : "내 집",
    subtitle: key === "interior_inn" ? "따뜻한 모닥불 냄새" : "나만의 아늑한 공간",
    width: 832,
    height: 832,
    groundTint: 0xffffff,
    flowerCount: 0,
    treeCount: 0,
    rockCount: 0,
    quests: [],
    enemies: [],
    boss: false,
  };
}
STAGES.interior_inn = buildInteriorDef("interior_inn");
STAGES.interior_home = buildInteriorDef("interior_home");
NEXT_STAGE.interior_inn = null;
NEXT_STAGE.interior_home = null;
PREV_STAGE.interior_inn = "village";
PREV_STAGE.interior_home = "village";
STAGE_SHORT.interior_inn = "여관";
STAGE_SHORT.interior_home = "내 집";

/* ================= v3.3.0 (지시 #6) — 무릉도장 (메이플 무릉도장 오마주 훈련 스테이지) =================
 *  GM NPC를 통해 입장하는 특별 구역 — 90초 동안 훈련용 허수아비에게 누적 피해를 기록.
 *  체인(NEXT/PREV)에서 완전히 분리 — 전진 포탈 없음, 복귀 포탈은 입장 전 구역으로. */
STAGES.dojang = {
  key: "dojang",
  name: "무릉도장",
  subtitle: "단련의 장 — 허수아비를 갈라라",
  width: 1400,
  height: 900,
  groundTint: 0xffffff,
  flowerCount: 0,
  treeCount: 0,
  rockCount: 0,
  quests: [],
  enemies: [],
  boss: false,
};
NEXT_STAGE.dojang = null;
PREV_STAGE.dojang = "village"; // 폴백 — 실제 복귀지는 입장 시 기록한 dojangFrom
STAGE_SHORT.dojang = "무릉도장";

/* ================= v4.0.0 — 바르가 수비전 (웨이브 디펜스 특별 구역) =================
 *  세계수 뿌리의 균열(바르가)을 몰려오는 몬스터 웨이브에서 지킨다.
 *  체인 분리 — 전진 포탈 없음, 복귀 포탈은 입장 전 구역. */
STAGES.gate = {
  key: "gate",
  name: "바르가 수비전",
  subtitle: "세계수 뿌리의 균열이 열렸다 — 웨이브를 막아라!",
  width: 1500,
  height: 920,
  groundTint: 0xffffff,
  flowerCount: 0,
  treeCount: 0,
  rockCount: 0,
  quests: [],
  enemies: [],
  boss: false,
};
NEXT_STAGE.gate = null;
PREV_STAGE.gate = "village"; // 폴백 — 실제 복귀지는 입장 시 기록한 gateFrom
STAGE_SHORT.gate = "바르가 수비전";

/* ================= v4.0.0 — 균열 던전 (골드/경험치책 파밍 던전) =================
 *  균열 속 60초 동안 몬스터가 계속 쏟아지는 파밍 전용 구역. */
STAGES.closet = {
  key: "closet",
  name: "균열 던전",
  subtitle: "골드와 경험치 책이 쏟아지는 파밍 천국",
  width: 1200,
  height: 800,
  groundTint: 0xffffff,
  flowerCount: 0,
  treeCount: 0,
  rockCount: 0,
  quests: [],
  enemies: [],
  boss: false,
};
NEXT_STAGE.closet = null;
PREV_STAGE.closet = "village";
STAGE_SHORT.closet = "균열 던전";

/* ================= v1.4.3 (유저 리포트 ⑤ 멀티 콘텐츠) — 파티 공동 토벌전 =================
 *  파티원과 함께 심연의 감시자를 사냥하는 협동 레이드 구역.
 *  파티원 수에 비례해 보스가 강해지고 보상(에메랄드/경험치/골드)도 커진다 — 함께 잡을 이유.
 *  같은 파티가 같은 구역(praid)에 입장하면 서버 릴레이로 서로 보인다(기존 멀티 동기화 재사용).
 *  체인 분리 — 전진 포탈 없음, 복귀 포탈은 입장 전 구역(praidFrom). */
STAGES.praid = {
  key: "praid",
  name: "공동 토벌전",
  subtitle: "파티원과 힘을 모아 심연의 감시자를 사냥해라",
  width: 1300,
  height: 860,
  groundTint: 0xffffff,
  flowerCount: 0,
  treeCount: 0,
  rockCount: 0,
  quests: [],
  enemies: [],
  boss: false,
};
NEXT_STAGE.praid = null;
PREV_STAGE.praid = "village"; // 폴백 — 실제 복귀지는 입장 시 기록한 praidFrom
STAGE_SHORT.praid = "공동 토벌전";

/* ================= v1.0.8 — 심연의 탑 (무한 층수 탑등반 — 무한 콘텐츠 ①) =================
 *  콘텐츠 패널에서 입장 — 층을 오를수록 강해지는 적, 5층마다 보스, 층 클리어 보상.
 *  체인 분리 — 전진 포탈 없음, 복귀 포탈은 입장 전 구역. */
STAGES.tower = {
  key: "tower",
  name: "심연의 탑",
  subtitle: "무한히 이어지는 탑 — 최고층에 도전해라",
  width: 1300,
  height: 860,
  groundTint: 0xffffff,
  flowerCount: 0,
  treeCount: 0,
  rockCount: 0,
  quests: [],
  enemies: [],
  boss: false,
};
NEXT_STAGE.tower = null;
PREV_STAGE.tower = "village"; // 폴백 — 실제 복귀지는 입장 시 기록한 towerFrom
STAGE_SHORT.tower = "심연의 탑";

/* ================= v1.0.18 — 몬스터 파크 (일일 입장권 · 난이도별 웨이브 사냥) =================
 *  콘텐츠 패널에서 입장 — 하루 2장의 입장권, 난이도(일반/어려움/지옥)별 몬스터 웨이브.
 *  처치마다 파크 코인 획득 → 파크 상점에서 교환. 체인 분리 — 복귀 포탈은 입장 전 구역. */
STAGES.park = {
  key: "park",
  name: "몬스터 파크",
  subtitle: "몬스터들이 웅크린 사육장 — 웨이브를 전부 사냥해라",
  width: 1300,
  height: 860,
  groundTint: 0xffffff,
  flowerCount: 0,
  treeCount: 0,
  rockCount: 0,
  quests: [],
  enemies: [],
  boss: false,
};
NEXT_STAGE.park = null;
PREV_STAGE.park = "village";
STAGE_SHORT.park = "몬스터 파크";

/* ═══════════ v1.0.19 (A-3) — 신규 스테이지 15종: "재림의 땅" 지역 ═══════════
 *
 *  해석 정정: 이전 요청의 "15종"은 **기존 스테이지 전부 유지 + 신규 15종 추가**였다.
 *  기존 90구역(마을 + 9챕터×10구역)은 전혀 손대지 않았고, 그 뒤(abyss10 이후)에
 *  재림 지역 15구역을 순차 체인으로 추가한다.
 *
 *  · 각 스테이지: 고유 테마(색감/지형/컨셉) + 고유 몬스터 구성 + 고유 클리어 보상
 *  · 난이도 곡선: abyss10(hp 15.5·atk 5.0) 이후부터 순차 상승 (scaleMul 전용 배율)
 *  · 보스 스테이지 3종: 재림5 베오르드 / 재림10 요르문간드 / 재림15 나그라파르
 *  · 목록은 이 블록의 REBIRTH_STAGES 상수 한 곳에서 관리 — 기존(CHAPTERS)과 분리
 */
type RebirthSpec = {
  key: string;
  name: string;
  subtitle: string;
  /** 지형/색감 테마 */
  groundTex: string;
  pathTex: string;
  bg: string;
  groundTint: number;
  flowers: number;
  trees: number;
  rocks: number;
  /** 고유 몬스터 구성 (기존 34종 풀에서 조합) */
  enemies: { key: EnemyKey; count: number }[];
  main: EnemyKey;
  bossKey?: BossKey;
  elite?: { key: EnemyKey; name: string };
  /** 스테이지별 전용 배율 — abyss 이후 곡선 */
  mul: { hp: number; atk: number; exp: number; gold: number };
  /** 고유 클리어 보상 (토벌 퀘스트 골드/경험치) */
  reward: { gold: number; exp: number };
};

const REBIRTH_STAGES: RebirthSpec[] = [
  {
    key: "r1", name: "재림 1 — 잿빛 늑대 숲", subtitle: "회색 안개가 걸린 오래된 사냥터",
    groundTex: "tile_grass", pathTex: "tile_path", bg: "#101408", groundTint: 0xa8b89a, flowers: 4, trees: 12, rocks: 6,
    enemies: [{ key: "wolf", count: 10 }, { key: "x2_darkhound", count: 6 }, { key: "x3_wogol", count: 4 }], main: "wolf",
    mul: { hp: 18, atk: 5.5, exp: 10, gold: 5.6 }, reward: { gold: 320, exp: 1300 },
  },
  {
    key: "r2", name: "재림 2 — 유리 폭풍 평원", subtitle: "유리 조각을 몰고 오는 바람의 땅",
    groundTex: "tile_snow", pathTex: "tile_ice", bg: "#0e1a26", groundTint: 0xcfe4f0, flowers: 0, trees: 4, rocks: 10,
    enemies: [{ key: "x2_frostfly", count: 9 }, { key: "x2_bat", count: 6 }, { key: "frostwolf", count: 5 }], main: "x2_frostfly",
    mul: { hp: 20, atk: 5.9, exp: 11.2, gold: 6.1 }, reward: { gold: 380, exp: 1550 },
  },
  {
    key: "r3", name: "재림 3 — 가시 결정 지대", subtitle: "가시 돋친 수정이 자라는 땅",
    groundTex: "tile_cave", pathTex: "tile_path_dark", bg: "#120a18", groundTint: 0x9a7ab8, flowers: 0, trees: 0, rocks: 16,
    enemies: [{ key: "x2_stonegolem", count: 8 }, { key: "spider", count: 7 }, { key: "golem", count: 5 }], main: "x2_stonegolem",
    elite: { key: "x2_stonegolem", name: "가시의 군주 바늘골렘" },
    mul: { hp: 22, atk: 6.3, exp: 12.4, gold: 6.6 }, reward: { gold: 440, exp: 1800 },
  },
  {
    key: "r4", name: "재림 4 — 붉은 안개 늪", subtitle: "숨을 걸고 지나가는 독의 홍수",
    groundTex: "tile_grass", pathTex: "tile_path", bg: "#160c08", groundTint: 0xb88a6a, flowers: 0, trees: 8, rocks: 6,
    enemies: [{ key: "x3_swampy", count: 9 }, { key: "x3_imp", count: 6 }, { key: "swampbeast", count: 5 }], main: "x3_swampy",
    mul: { hp: 24, atk: 6.7, exp: 13.6, gold: 7.1 }, reward: { gold: 500, exp: 2050 },
  },
  {
    key: "r5", name: "재림 5 — 파수꾼의 대문", subtitle: "재림을 감시하는 첫 보스가 서 있다",
    groundTex: "tile_stone", pathTex: "tile_path_dark", bg: "#1a1208", groundTint: 0xb89868, flowers: 0, trees: 2, rocks: 12,
    enemies: [{ key: "x3_orcwarrior", count: 8 }, { key: "x3_maskedorc", count: 6 }, { key: "x3_orcshaman", count: 4 }], main: "x3_orcwarrior",
    bossKey: "vord",
    mul: { hp: 26, atk: 7.1, exp: 14.8, gold: 7.6 }, reward: { gold: 700, exp: 2600 },
  },
  {
    key: "r6", name: "재림 6 — 소용돌이 해안", subtitle: "심연에서 밀려오는 검은 물결",
    groundTex: "tile_dark", pathTex: "tile_path", bg: "#081420", groundTint: 0x6a9ab8, flowers: 2, trees: 5, rocks: 10,
    enemies: [{ key: "x2_reeffish", count: 9 }, { key: "x2_snail", count: 6 }, { key: "minion", count: 5 }], main: "x2_reeffish",
    mul: { hp: 28, atk: 7.4, exp: 16, gold: 8.1 }, reward: { gold: 560, exp: 2300 },
  },
  {
    key: "r7", name: "재림 7 — 잿불 화산 갱도", subtitle: "아직 식지 않은 재와 불씨",
    groundTex: "tile_magma", pathTex: "tile_magma_path", bg: "#200a06", groundTint: 0xd88a5a, flowers: 0, trees: 0, rocks: 14,
    enemies: [{ key: "emberwolf", count: 9 }, { key: "firespirit", count: 6 }, { key: "x2_firebird", count: 5 }], main: "emberwolf",
    mul: { hp: 30, atk: 7.8, exp: 17.2, gold: 8.6 }, reward: { gold: 620, exp: 2550 },
  },
  {
    key: "r8", name: "재림 8 — 얼어붙은 왕좌", subtitle: "얼음 아래 박힌 옛 왕들의 자리",
    groundTex: "tile_snow", pathTex: "tile_ice", bg: "#0a1622", groundTint: 0xdce8f4, flowers: 0, trees: 6, rocks: 12,
    enemies: [{ key: "x3_icezombie", count: 9 }, { key: "icegolem", count: 6 }, { key: "frostwolf", count: 5 }], main: "x3_icezombie",
    mul: { hp: 33, atk: 8.1, exp: 18.4, gold: 9.1 }, reward: { gold: 680, exp: 2800 },
  },
  {
    key: "r9", name: "재림 9 — 그림자 미궁", subtitle: "길을 삼키는 어둠의 정원",
    groundTex: "tile_hel", pathTex: "tile_path_dark", bg: "#0c0614", groundTint: 0x6a5a8a, flowers: 0, trees: 8, rocks: 8,
    enemies: [{ key: "wraith", count: 9 }, { key: "x3_necromancer", count: 6 }, { key: "x2_bat", count: 5 }], main: "wraith",
    elite: { key: "x3_necromancer", name: "미궁의 지배자 그림 강령사" },
    mul: { hp: 36, atk: 8.4, exp: 19.6, gold: 9.6 }, reward: { gold: 740, exp: 3050 },
  },
  {
    key: "r10", name: "재림 10 — 뱀의 소용돌이", subtitle: "세계수를 감은 뱀이 기다린다",
    groundTex: "tile_abyss", pathTex: "tile_path_dark", bg: "#0e0618", groundTint: 0x5a4a7a, flowers: 0, trees: 0, rocks: 14,
    enemies: [{ key: "x2_darkhound", count: 8 }, { key: "helhound", count: 6 }, { key: "x3_chort", count: 4 }], main: "helhound",
    bossKey: "jorm",
    mul: { hp: 39, atk: 8.7, exp: 20.8, gold: 10.1 }, reward: { gold: 1000, exp: 3600 },
  },
  {
    key: "r11", name: "재림 11 — 무너진 하늘 정원", subtitle: "하늘에서 떨어진 잿불의 꽃밭",
    groundTex: "tile_grass", pathTex: "tile_path", bg: "#160e1e", groundTint: 0xc8a8d8, flowers: 8, trees: 6, rocks: 8,
    enemies: [{ key: "x2_firebird", count: 9 }, { key: "x3_orcshaman", count: 6 }, { key: "x3_goblin", count: 5 }], main: "x2_firebird",
    mul: { hp: 42, atk: 9.0, exp: 22, gold: 10.6 }, reward: { gold: 800, exp: 3300 },
  },
  {
    key: "r12", name: "재림 12 — 심연 먹이 사슬", subtitle: "먹는 자와 먹히는 자의 경계",
    groundTex: "tile_abyss", pathTex: "tile_path_dark", bg: "#0a0612", groundTint: 0x4a3a6a, flowers: 0, trees: 4, rocks: 12,
    enemies: [{ key: "x3_ogre", count: 8 }, { key: "x2_darkhound", count: 7 }, { key: "x3_tinyzombie", count: 5 }], main: "x3_ogre",
    mul: { hp: 45, atk: 9.2, exp: 23.2, gold: 11.1 }, reward: { gold: 860, exp: 3550 },
  },
  {
    key: "r13", name: "재림 13 — 룬 폐허", subtitle: "폭주한 룬이 울리는 돌의 무덤",
    groundTex: "tile_stone", pathTex: "tile_path_dark", bg: "#141008", groundTint: 0xa89a7a, flowers: 0, trees: 0, rocks: 18,
    enemies: [{ key: "runegolem", count: 9 }, { key: "x3_chort", count: 6 }, { key: "golem", count: 5 }], main: "runegolem",
    elite: { key: "runegolem", name: "폭주 룬의 심장 골레마르" },
    mul: { hp: 48, atk: 9.4, exp: 24.4, gold: 11.6 }, reward: { gold: 920, exp: 3800 },
  },
  {
    key: "r14", name: "재림 14 — 종언의 문", subtitle: "마지막 문 너머가 숨을 쉰다",
    groundTex: "tile_hel", pathTex: "tile_path_dark", bg: "#100514", groundTint: 0x8a5a7a, flowers: 0, trees: 4, rocks: 14,
    enemies: [{ key: "x3_bigzombie", count: 8 }, { key: "x3_maskedorc", count: 7 }, { key: "x3_wogol", count: 5 }], main: "x3_bigzombie",
    mul: { hp: 52, atk: 9.6, exp: 25.6, gold: 12.1 }, reward: { gold: 980, exp: 4050 },
  },
  {
    key: "r15", name: "재림 15 — 종언의 왕좌 앞", subtitle: "재림의 종언과 마주하는 자리",
    groundTex: "tile_abyss", pathTex: "tile_path_dark", bg: "#120616", groundTint: 0x6a4a5a, flowers: 0, trees: 0, rocks: 16,
    enemies: [{ key: "x3_necromancer", count: 8 }, { key: "helhound", count: 6 }, { key: "x3_bigzombie", count: 5 }], main: "x3_bigzombie",
    bossKey: "nagr",
    mul: { hp: 56, atk: 9.9, exp: 27, gold: 12.7 }, reward: { gold: 1500, exp: 5200 },
  },
];

function buildRebirthStage(spec: RebirthSpec): StageDef {
  const mul = spec.mul;
  const quests: QuestDef[] = [
    {
      id: `${spec.key}-hunt`,
      type: "hunt",
      title: `${spec.name.split("— ")[1]} 정화`,
      desc: `${spec.subtitle} — 이 땅의 몬스터 12마리를 처치해라. (무엇을 잡아도 카운트된다)`,
      need: 12,
      targetKey: spec.main,
      targetKeys: [...new Set(spec.enemies.map((g) => g.key))],
      targetLabel: `${ENEMIES[spec.main].name} 등 재림 몬스터`,
      reward: spec.reward.gold,
      expReward: spec.reward.exp,
    },
  ];
  /* 보스 구역 — 보스 토벌 + 다음 구역 안내 퀘스트 */
  if (spec.bossKey) {
    quests.push({
      id: `${spec.key}-boss`,
      type: "boss",
      title: BOSS_DEFS[spec.bossKey].name,
      desc: `재림의 수호자 — ${BOSS_DEFS[spec.bossKey].name}를 처치해라!`,
      targetLabel: BOSS_DEFS[spec.bossKey].name,
      reward: Math.round(spec.reward.gold * 1.6),
      expReward: Math.round(spec.reward.exp * 1.6),
    });
  } else {
    quests.push({
      id: `${spec.key}-collect`,
      type: "collect",
      title: "재림의 결정",
      desc: "재림의 땅에 흩어진 결정의 흔적을 회수해라.",
      targetLabel: "결정의 흔적",
      reward: Math.round(spec.reward.gold * 0.6),
      expReward: Math.round(spec.reward.exp * 0.6),
    });
  }
  const def: StageDef = {
    key: spec.key,
    name: spec.name,
    subtitle: spec.subtitle,
    width: 2100 + Math.min(600, (mul.hp - 18) * 30),
    height: 1200,
    groundTint: spec.groundTint,
    flowerCount: spec.flowers,
    treeCount: spec.trees,
    rockCount: spec.rocks,
    quests,
    enemies: spec.enemies,
    boss: !!spec.bossKey,
    bossKey: spec.bossKey,
    repeat: {
      targetKey: spec.main,
      need: 22,
      gold: Math.round(spec.reward.gold * 0.55),
      exp: Math.round(spec.reward.exp * 0.55),
      title: `[반복] ${spec.name.split("— ")[1]} 순찰`,
      desc: "재림 땅의 어둠은 다시 자라난다 — 계속 사냥해라.",
    },
    scaleMul: { ...mul },
  };
  if (spec.elite) {
    def.elite = { key: spec.elite.key, hpMult: 9, atkMult: 1.6, name: spec.elite.name };
  }
  return def;
}

/* 신규 15구역 등록 + 체인 연결 (기존 체인은 유지 — abyss10의 다음 포탈만 r1로 연장)
 *  지형 테마(STAGE_THEME)는 파일 말미 선언부 이후 별도 등록 (TDZ 회피) */
for (let i = 0; i < REBIRTH_STAGES.length; i++) {
  const spec = REBIRTH_STAGES[i];
  const def = buildRebirthStage(spec);
  STAGES[def.key] = def;
  STAGE_SHORT[def.key] = `재림${i + 1}`;
  NEXT_STAGE[def.key] = i < REBIRTH_STAGES.length - 1 ? REBIRTH_STAGES[i + 1].key : null;
  PREV_STAGE[def.key] = i > 0 ? REBIRTH_STAGES[i - 1].key : "abyss10";
}
/* 기존 마지막 구역(10-10) → 재림 1 연장 — 기존 난이도/보상/동작은 그대로, 전진 포탈만 열린다 */
NEXT_STAGE.abyss10 = REBIRTH_STAGES[0].key;

/** 구 세이브 키 폴백 — v1.x 6스테이지 → 신규 체인 시작점 */
export const LEGACY_STAGE_FALLBACK: Record<string, StageKey> = {
  forest: "forest1",
  kingdom: "kingdom1",
  alfheim: "alfheim1",
  muspelheim: "muspelheim1",
  niflheim: "niflheim1",
  cave: "cave1",
  nidavellir: "nidavellir1",
  hel: "hel1",
  abyss: "abyss1",
};

/** 유효 스테이지 키 검증 (+구 세이브 폴백) */
export function resolveStage(key: string): StageKey {
  if (STAGES[key]) return key;
  if (LEGACY_STAGE_FALLBACK[key]) return LEGACY_STAGE_FALLBACK[key];
  return "village";
}

/** 오프닝 대사 매핑 — 구역 1은 챕터 인트로, 나머지는 구역 안내
 *  v1.0.19 (A-3) — 재림 지역(r1~r15)은 전용 인트로 대사 키 사용 (보스 구역은 rebirthBoss) */
export function stageIntro(key: StageKey): string {
  const spec = chapterSpec(key);
  if (!spec) {
    const rb = /^r(\d+)$/.exec(key);
    if (rb) {
      const n = parseInt(rb[1], 10);
      if (n === 5 || n === 10 || n === 15) return "rebirthBoss";
      return `rebirthWalk${((n - 1) % 3) + 1}`;
    }
    return "villageIntro";
  }
  const { sub } = parseStage(key);
  if (sub === 1) return spec.intro;
  if (sub === 5) return `eliteWarn${spec.num}`;
  if (sub === 10) return `bossApproach${spec.num}`;
  return `ch${spec.num}Walk${((sub - 2) % 3) + 1}`;
}

/** 스테이지 지형 테마 (WorldScene 배치용) */
export const STAGE_THEME: Record<StageKey, { ground: string; path: string; bg: string }> = {
  village: { ground: "tile_grass", path: "tile_path", bg: "#15270f" },
};
for (const spec of CHAPTERS) {
  /* v2.9 — 챕터 마을도 챕터 지형 테마를 따른다 */
  STAGE_THEME[`${spec.key}v`] = { ground: spec.groundTex, path: spec.pathTex, bg: spec.bg };
  for (let sub = 1; sub <= 10; sub++) {
    STAGE_THEME[`${spec.key}${sub}`] = { ground: spec.groundTex, path: spec.pathTex, bg: spec.bg };
  }
}
/* v1.0.19 (A-3) — 재림 지역 15구역 지형 테마 등록 */
for (const spec of REBIRTH_STAGES) {
  STAGE_THEME[spec.key] = { ground: spec.groundTex, path: spec.pathTex, bg: spec.bg };
}
