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
  targetLabel: string;
  reward?: number;
  expReward?: number;
  dialogue?: string;
};

export type BossKey =
  | "guardian" | "behemoth" | "abysslord"
  | "nidhog" | "surt" | "fenrir" | "skoll" | "gram" | "abudditos";

export type BossAttackKind = "slam" | "charge" | "volley" | "ring" | "zones" | "summon";

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
    enemies: [{ key: "wolf", count: 4 }, { key: "spider", count: 4 }, { key: "swampbeast", count: 3 }, { key: "x2_frog", count: 3 }, { key: "x3_swampy", count: 3 }, { key: "x3_goblin", count: 3 }],
    main: "wolf",
    beats: [
      { sub: 2, dialogue: "fragment", quest: { id: "f0", type: "collect", title: "결정의 흔적 찾기", desc: "숲 어딘가 빛을 내는 결정의 흔적을 찾아 주워 보자. 이그니가 기다린다.", targetLabel: "결정의 흔적", reward: Math.round(40 * G), expReward: 35 } },
      { sub: 3, dialogue: "", quest: { id: "f1", type: "hunt", title: "숲의 거미 소탕", desc: "신전으로 가는 길을 막는 숲의 거미 5마리를 처치하자.", need: 5, targetKey: "spider", targetLabel: "숲의 거미", reward: Math.round(60 * G), expReward: 40 } },
      { sub: 6, dialogue: "wolfRoutDone", quest: { id: "f2", type: "hunt", title: "능대 무리 소멸", desc: "어둠에 미친 늑대 무리 10마리를 더 처치하자!", need: 10, targetKey: "wolf", targetLabel: "늑대", reward: Math.round(110 * G), expReward: 90 } },
      { sub: 8, dialogue: "", quest: { id: "f3", type: "collect", title: "능대들이 지키던 결정", desc: "능대들이 지키던 곳에서 또 하나의 빛이 느껴진다.", targetLabel: "결정의 흔적", reward: Math.round(60 * G), expReward: 45 } },
    ],
    repeat: { need: 8, gold: Math.round(70 * G), exp: 70, title: "[반복] 늑대 토벌 의뢰", desc: "마을 토벌 의뢰 — 늑대를 계속 사냥해 골드와 경험치를 얻자." },
    lvGate: { enter: 3, mid: 5 },
  },
  {
    key: "kingdom", num: 3, title: "쿠소디아", subtitle: "선박의 왕국 · 늪지대",
    intro: "kingdomIntro", boss: "behemoth", bossDone: "kingdomDone",
    width: 2200, height: 1250, groundTint: 0x86c95e, groundTex: "tile_grass", pathTex: "tile_path", bg: "#0d1808",
    flowers: 8, trees: 9, rocks: 6,
    enemies: [{ key: "swampbeast", count: 5 }, { key: "wolf", count: 4 }, { key: "golem", count: 3 }, { key: "x2_rat", count: 2 }, { key: "x3_imp", count: 3 }, { key: "x3_goblin", count: 2 }],
    main: "swampbeast",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "k1", type: "collect", title: "능지 속 결정의 조각", desc: "식인초들이 품고 있던 결정의 조각을 되찾자.", targetLabel: "결정의 흔적", reward: Math.round(80 * G), expReward: 70 } },
      { sub: 3, dialogue: "", quest: { id: "k0", type: "hunt", title: "능지의 식인초 소탕", desc: "결정의 기운을 먹고 자란 늪의 식인초 6그루를 처치하자.", need: 6, targetKey: "swampbeast", targetLabel: "식인초", reward: Math.round(90 * G), expReward: 80 } },
      { sub: 5, dialogue: "", quest: { id: "k2", type: "hunt", title: "왕국 신뢰 얻기", desc: "기사단을 도와 식인초 무리 8그루를 더 베어 내자!", need: 8, targetKey: "swampbeast", targetLabel: "식인초", reward: Math.round(140 * G), expReward: 130 } },
      { sub: 7, dialogue: "swampDone", quest: { id: "k3", type: "hunt", title: "왕국의 위협 제거", desc: "능지의 어둠이 짙어진다 — 식인초 10그루를 처치하자!", need: 10, targetKey: "swampbeast", targetLabel: "식인초", reward: Math.round(170 * G), expReward: 160 } },
    ],
    repeat: { need: 10, gold: Math.round(100 * G), exp: 100, title: "[반복] 늪지 정화 의뢰", desc: "쿠소디아 기사단 의뢰 — 식인초를 계속 사냥하자." },
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
      { sub: 2, dialogue: "", quest: { id: "a0", type: "hunt", title: "하수인 소탕", desc: "니드호그가 부린 심연의 하수인 5마리를 처치해 성전의 길을 열자.", need: 5, targetKey: "minion", targetLabel: "심연 하수인", reward: Math.round(80 * G), expReward: 65 } },
      { sub: 3, dialogue: "", quest: { id: "a1", type: "collect", title: "여왕의 가호", desc: "하수인들이 숨겨둔 결정의 조각을 회수해 여왕에게 바치자.", targetLabel: "결정의 흔적", reward: Math.round(80 * G), expReward: 55 } },
      { sub: 6, dialogue: "minionPurgeDone", quest: { id: "a2", type: "hunt", title: "성전 지키기", desc: "니드호그를 부르는 의식을 막자 — 하수인 12마리 처치!", need: 12, targetKey: "minion", targetLabel: "심연 하수인", reward: Math.round(150 * G), expReward: 140 } },
    ],
    repeat: { need: 10, gold: Math.round(95 * G), exp: 95, title: "[반복] 성전 순찰 의뢰", desc: "요정 여왕의 의뢰 — 하수인을 계속 처치해 훈련하자." },
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
      { sub: 2, dialogue: "", quest: { id: "m0", type: "hunt", title: "불꽃 늑대 사냥", desc: "네바다를 내달리는 불꽃 늑대 6마리를 처치하자.", need: 6, targetKey: "emberwolf", targetLabel: "불꽃 늑대", reward: Math.round(150 * G), expReward: 140 } },
      { sub: 4, dialogue: "", quest: { id: "m1", type: "hunt", title: "화염 정령 진압", desc: "열이 가장 강한 날 — 화염 정령 5마리를 처치하자.", need: 5, targetKey: "firespirit", targetLabel: "화염 정령", reward: Math.round(170 * G), expReward: 150 } },
      { sub: 5, dialogue: "", quest: { id: "m2", type: "collect", title: "화염 속의 빛", desc: "용암 사이에서 결정의 조각이 반짝인다. 회수하자.", targetLabel: "결정의 흔적", reward: Math.round(100 * G), expReward: 95 } },
      { sub: 7, dialogue: "spiritPurgeDone", quest: { id: "m3", type: "hunt", title: "호족촌 구원", desc: "엘렌을 도와 — 지하도시를 노리는 화염 정령 10마리를 처치하자!", need: 10, targetKey: "firespirit", targetLabel: "화염 정령", reward: Math.round(220 * G), expReward: 200 } },
    ],
    repeat: { need: 10, gold: Math.round(130 * G), exp: 130, title: "[반복] 화산 지대 순찰 의뢰", desc: "호족촌 의뢰 — 불꽃 늑대를 계속 사냥하자." },
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
      { sub: 2, dialogue: "", quest: { id: "n0", type: "hunt", title: "서리 늑대 사냥", desc: "설원을 유랑하는 서리 늑대 6마리를 처치하자.", need: 6, targetKey: "frostwolf", targetLabel: "서리 늑대", reward: Math.round(130 * G), expReward: 120 } },
      { sub: 4, dialogue: "", quest: { id: "n1", type: "hunt", title: "얼음 골렘 격파", desc: "성전 길을 얼리고 있는 얼음 골렘 4기를 격파하자.", need: 4, targetKey: "icegolem", targetLabel: "얼음 골렘", reward: Math.round(170 * G), expReward: 150 } },
      { sub: 6, dialogue: "", quest: { id: "n2", type: "collect", title: "얼음 속의 결정", desc: "얼음 결정 사이에서 세계의 빛이 반짝인다.", targetLabel: "결정의 흔적", reward: Math.round(100 * G), expReward: 90 } },
      { sub: 7, dialogue: "frostRoutDone", quest: { id: "n3", type: "hunt", title: "설원 정화", desc: "펜리르의 권속인 서리 늑대 12마리를 처치하자!", need: 12, targetKey: "frostwolf", targetLabel: "서리 늑대", reward: Math.round(210 * G), expReward: 190 } },
    ],
    repeat: { need: 12, gold: Math.round(145 * G), exp: 145, title: "[반복] 설원 순찰 의뢰", desc: "니플헤임 정찰 의뢰 — 서리 늑대를 계속 사냥하자." },
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
      { sub: 3, dialogue: "", quest: { id: "c1", type: "hunt", title: "동굴 거미 소탕", desc: "어둠에 물든 동굴 거미 6마리를 처치하자.", need: 6, targetKey: "spider", targetLabel: "동굴 거미", reward: Math.round(90 * G), expReward: 80 } },
      { sub: 5, dialogue: "", quest: { id: "c2", type: "hunt", title: "수정 골렘 파괴", desc: "거미들을 조종하는 수정 골렘 4기를 부숴 버리자.", need: 4, targetKey: "golem", targetLabel: "수정 골렘", reward: Math.round(130 * G), expReward: 110 } },
      { sub: 7, dialogue: "spiderDone", quest: { id: "c3", type: "hunt", title: "지하 정화", desc: "거미 둥지를 완전히 태우자 — 거미 10마리 처치!", need: 10, targetKey: "spider", targetLabel: "동굴 거미", reward: Math.round(160 * G), expReward: 150 } },
      { sub: 8, dialogue: "", quest: { id: "c4", type: "collect", title: "여왕의 두 번째 부탁", desc: "어둠 요정 여왕의 마지막 부탁 — 뿌리 사이의 잔광을 회수하자.", targetLabel: "결정의 흔적", reward: Math.round(70 * G), expReward: 70 } },
    ],
    repeat: { need: 10, gold: Math.round(115 * G), exp: 115, title: "[반복] 지하 정화 의뢰", desc: "어둠 요정 여왕의 의뢰 — 거미를 계속 사냥하자." },
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
      { sub: 2, dialogue: "", quest: { id: "d0", type: "hunt", title: "룬 골렘 정지", desc: "폭주한 룬 골렘 5기를 정지시키자.", need: 5, targetKey: "runegolem", targetLabel: "룬 골렘", reward: Math.round(200 * G), expReward: 180 } },
      { sub: 4, dialogue: "", quest: { id: "d1", type: "collect", title: "룬 각인 판", desc: "광산 깊은 곳의 결정 조각 — 룬 각인판을 회수하자.", targetLabel: "결정의 흔적", reward: Math.round(120 * G), expReward: 110 } },
      { sub: 6, dialogue: "runePurgeDone", quest: { id: "d2", type: "hunt", title: "광산 탈환", desc: "난쟁이 마을을 되돌리자 — 룬 골렘 10기 처치!", need: 10, targetKey: "runegolem", targetLabel: "룬 골렘", reward: Math.round(260 * G), expReward: 230 } },
      { sub: 8, dialogue: "", quest: { id: "d3", type: "hunt", title: "수정 골렘 정리", desc: "광산을 어지럽히는 수정 골렘 4기를 부수자.", need: 4, targetKey: "golem", targetLabel: "수정 골렘", reward: Math.round(220 * G), expReward: 200 } },
    ],
    repeat: { need: 10, gold: Math.round(150 * G), exp: 150, title: "[반복] 광산 경비 의뢰", desc: "난쟁이 광산 조합 의뢰 — 룬 골렘을 계속 처치하자." },
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
      { sub: 2, dialogue: "", quest: { id: "h0", type: "hunt", title: "헬 하운드 사냥", desc: "절벽을 지키는 헬 하운드 6마리를 처치하자.", need: 6, targetKey: "helhound", targetLabel: "헬 하운드", reward: Math.round(260 * G), expReward: 240 } },
      { sub: 3, dialogue: "", quest: { id: "h1", type: "collect", title: "대지의 결정", desc: "절벽 아래 대지의 결정 — 결정의 흔적을 회수하자.", targetLabel: "결정의 흔적", reward: Math.round(150 * G), expReward: 140 } },
      { sub: 5, dialogue: "houndPurgeDone", quest: { id: "h2", type: "hunt", title: "절벽 열기", desc: "헬 하운드 12마리를 처치해 저택의 문을 열자!", need: 12, targetKey: "helhound", targetLabel: "헬 하운드", reward: Math.round(320 * G), expReward: 290 } },
      { sub: 7, dialogue: "", quest: { id: "h3", type: "hunt", title: "심연 유령 소탕", desc: "힐다 할머니의 조사 일지를 지키는 심연 유령 6마리를 처치하자.", need: 6, targetKey: "wraith", targetLabel: "심연 유령", reward: Math.round(280 * G), expReward: 260 } },
    ],
    repeat: { need: 10, gold: Math.round(175 * G), exp: 175, title: "[반복] 절벽 정찰 의뢰", desc: "헬의 기운이 강해지고 있다 — 하운드를 계속 처치하자." },
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
      { sub: 2, dialogue: "", quest: { id: "y0", type: "hunt", title: "뿌리의 유령 소탕", desc: "왕좌를 지키는 심연 유령 4마리를 처치하자.", need: 4, targetKey: "wraith", targetLabel: "심연 유령", reward: Math.round(150 * G), expReward: 140 } },
      { sub: 4, dialogue: "", quest: { id: "y1", type: "collect", title: "빼앗긴 빛의 흔적", desc: "니드그림이 삼키지 못한 결정의 흔적을 회수하자.", targetLabel: "결정의 흔적", reward: Math.round(120 * G), expReward: 110 } },
      { sub: 6, dialogue: "wraithDone", quest: { id: "y2", type: "hunt", title: "왕좌 앞길 열기", desc: "심연 유령 10마리를 처치해 왕좌의 문을 열자!", need: 10, targetKey: "wraith", targetLabel: "심연 유령", reward: Math.round(240 * G), expReward: 220 } },
    ],
    repeat: { need: 12, gold: Math.round(165 * G), exp: 165, title: "[반복] 뿌리 정찰 의뢰", desc: "뿌리의 기운이 강해지고 있다 — 유령을 계속 처치하자." },
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
  swampbeast: { key: "swampbeast", name: "늪의 식인초", hp: 95, atk: 20, speed: 96, aggro: 300, exp: 55, gold: [10, 15], dropHp: 0.3, dropMp: 0.22 },
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
    patterns: {
      p1: ["slam", "charge", "volley"],
      p2: ["slam", "charge", "volley", "ring"],
      p3: ["slam", "charge", "volley", "ring", "zones"],
    },
  },
  behemoth: {
    key: "behemoth", name: "눈보라의 거수",
    hp: 5200, atk: 31, speed: 84, exp: 500, gold: 300,
    tex: "boss2", orbTint: 0x8ad4ff, introDialogue: "bossIntroBehemoth",
    patterns: {
      p1: ["slam", "volley", "zones"],
      p2: ["slam", "charge", "volley", "zones", "ring"],
      p3: ["slam", "charge", "volley", "zones", "ring"],
    },
  },
  abysslord: {
    key: "abysslord", name: "심연의 군주",
    hp: 8500, atk: 38, speed: 98, exp: 800, gold: 420,
    tex: "boss3", orbTint: 0xff5a7a, introDialogue: "bossIntroLord",
    patterns: {
      p1: ["volley", "charge", "slam"],
      p2: ["volley", "charge", "ring", "zones"],
      p3: ["volley", "charge", "ring", "zones", "summon"],
    },
    summonKey: "wraith",
  },
  nidhog: {
    key: "nidhog", name: "탐식의 드래곤 니드호그",
    hp: 3600, atk: 26, speed: 90, exp: 380, gold: 260,
    tex: "boss_nidhog", orbTint: 0x7dff9a, introDialogue: "bossIntroNidhog",
    patterns: {
      p1: ["slam", "charge", "volley"],
      p2: ["slam", "charge", "volley", "ring"],
      p3: ["slam", "charge", "volley", "ring", "zones"],
    },
    summonKey: "swampbeast",
  },
  surt: {
    key: "surt", name: "분노의 정령 수르트",
    hp: 5400, atk: 33, speed: 88, exp: 560, gold: 340,
    tex: "boss_surt", orbTint: 0xffa05a, introDialogue: "bossIntroSurt",
    patterns: {
      p1: ["slam", "volley", "zones"],
      p2: ["slam", "charge", "volley", "zones", "ring"],
      p3: ["slam", "charge", "volley", "zones", "ring"],
    },
  },
  fenrir: {
    key: "fenrir", name: "탐욕의 늑대 펜리르",
    hp: 7400, atk: 36, speed: 96, exp: 640, gold: 380,
    tex: "boss_fenrir", orbTint: 0xc08aff, introDialogue: "bossIntroFenrir",
    patterns: {
      p1: ["charge", "volley", "ring"],
      p2: ["slam", "charge", "volley", "zones"],
      p3: ["slam", "charge", "volley", "zones", "ring"],
    },
  },
  skoll: {
    key: "skoll", name: "교만의 쌍두 스콜&하티",
    hp: 8600, atk: 39, speed: 100, exp: 720, gold: 420,
    tex: "boss_skoll", orbTint: 0xffd97a, introDialogue: "bossIntroSkoll",
    patterns: {
      p1: ["volley", "charge", "slam"],
      p2: ["volley", "charge", "ring", "zones"],
      p3: ["volley", "charge", "ring", "zones", "summon"],
    },
    summonKey: "runegolem",
  },
  gram: {
    key: "gram", name: "대지의 괴물 그람",
    hp: 10600, atk: 42, speed: 86, exp: 860, gold: 480,
    tex: "boss_gram", orbTint: 0x8affc0, introDialogue: "bossIntroGram",
    patterns: {
      p1: ["slam", "charge", "volley", "zones"],
      p2: ["slam", "charge", "volley", "ring", "zones"],
      p3: ["slam", "charge", "volley", "ring", "zones", "summon"],
    },
    summonKey: "helhound",
  },
  abudditos: {
    key: "abudditos", name: "종언의 마룡 니드그림",
    hp: 14500, atk: 46, speed: 100, exp: 1200, gold: 650,
    tex: "boss_abudditos", orbTint: 0xff3a6a, introDialogue: "bossIntroAbudditos",
    patterns: {
      p1: ["volley", "charge", "ring"],
      p2: ["volley", "charge", "ring", "zones", "summon"],
      p3: ["slam", "charge", "volley", "ring", "zones", "summon"],
    },
    summonKey: "helhound",
  },
};

/* ================= 스테이지 생성기 ================= */

/** 챕터별 난이도 배율 (인덱스 = 장번호-2 → forest(2장)부터) */
const CH_HP = [1, 1.2, 1.55, 1.95, 2.45, 3.0, 3.7, 4.5, 5.4];
const CH_ATK = [1, 1.12, 1.28, 1.48, 1.7, 1.95, 2.25, 2.6, 3.0];
const CH_EXP = [1, 1.35, 1.8, 2.35, 3.0, 3.8, 4.8, 6.0, 7.5];

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

/** 구역별 성장 배율 — 적 HP/ATK/EXP/골드 (사용자 지시 #6/#9 밸런스) */
export function stageScale(key: StageKey): { hp: number; atk: number; exp: number; gold: number } {
  const spec = chapterSpec(key);
  if (!spec) return { hp: 1, atk: 1, exp: 1, gold: 1 };
  const { sub } = parseStage(key);
  const i = spec.num - 2;
  const subMul = 1 + (sub - 1) * 0.055;
  return {
    hp: CH_HP[i] * subMul,
    atk: CH_ATK[i] * (1 + (sub - 1) * 0.045),
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
      desc: `${spec.title}에 들어온 이상 약해서는 안 된다. ${gateLv}레벨을 찍어 몬스터를 쓰러뜨릴 준비를 하자!`,
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
    swampbeast: "식인초", emberwolf: "불꽃 늑대", firespirit: "화염 정령",
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
    // 자동 토벌 퀘스트 — v2.3 밸런스 (지시 #4): 목표 수 상한 12 (기존 3+sub*2는 후반 21마리로 지루함)
    // 경험치는 살짝 더 많게 — 스토리 진행이 자연스럽게 이어지도록
    const n = Math.min(12, 4 + Math.floor(sub * 0.8));
    quests.push({
      id: `${prefix}-auto-hunt`,
      type: "hunt",
      title: `${main} ${verbs[sub % verbs.length]}`,
      desc: `${spec.title} ${spec.subtitle} — ${main} ${n}마리(그루)를 처치하자.`,
      need: n,
      targetKey: zoneMon, // v3.0.2 — 이 구역에서 실제 스폰되는 몬스터
      targetLabel: main,
      reward: Math.round((55 + sub * 14) * CH_EXP[spec.num - 2] * 0.55 * G),
      expReward: Math.round((60 + sub * 14) * CH_EXP[spec.num - 2] * 0.9),
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
      desc: `${spec.title}의 주인 — ${BOSS_DEFS[spec.boss].name}를 처치하자!`,
      targetLabel: BOSS_DEFS[spec.boss].name,
      reward: Math.round(320 * CH_EXP[spec.num - 2] * 0.7 * G),
      expReward: Math.round(260 * CH_EXP[spec.num - 2]),
    });
    // 챕터 최종 — 다음 챕터로 나가는 차원문
    quests.push({
      id: `${prefix}-next`,
      type: "reach",
      title: "다음 해역으로",
      desc: "열린 차원문에 닿아 다음 해역으로 이동하자.",
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
    const donor = enemies[0];
    donor.count = Math.max(1, donor.count - 3);
    const sum = enemies.reduce((t, g) => t + g.count, 0);
    enemies.push({ key: beatHere.quest.targetKey, count: Math.max(1, Math.min(3, 20 - sum)) });
  }
  /* v3.0.6 (지시 #1 — "반복 의뢰 안됨") — [반복] 토벌 의뢰 대상(spec.main)이 이 구역 스폰 조합에 없으면 편입.
   *  구역별 단일종 로테이션(1~6구역은 풀 1종만 스폰) 때문에 반복 의뢰 대상 몬스터가 맵에 아예 없어
   *  사냥해도 카운트가 전혀 오르지 않던 근본 원인 제거 (스토리 beat 편입과 동일 패턴) */
  if (!enemies.some((g) => g.key === spec.main)) {
    const donor = enemies[0];
    donor.count = Math.max(1, donor.count - 3);
    const sum = enemies.reduce((t, g) => t + g.count, 0);
    enemies.push({ key: spec.main, count: Math.max(1, Math.min(3, 20 - sum)) });
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
      need: spec.repeat.need + sub,
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
      id: "v1",
      type: "reach",
      title: "서쪽 숲의 신전으로",
      desc: "펜던트가 이끄는 대로 마을 동쪽 차원문을 지나 숲의 폐허 신전에 도착하자.",
      targetLabel: "차원문",
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

/** 오프닝 대사 매핑 — 구역 1은 챕터 인트로, 나머지는 구역 안내 */
export function stageIntro(key: StageKey): string {
  const spec = chapterSpec(key);
  if (!spec) return "villageIntro";
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
