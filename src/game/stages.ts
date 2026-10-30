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
  | "cave" | "nidavellir" | "hel" | "abyss"
  /* vc186b DLC — 세계 구원(아부디토스 격파) 이후 열리는 추가 스토리.
   *  기존 9챕터는 손대지 않고 **뒤에 덧붙이기만** 한다(회귀 방지).
   *  기획서 6행: "1기가 끝이나면 2기 그랜드플래닛으로 세계가 변경된다" */
  | "dlcstargate" | "dlcprisma" | "dlcocean"
  /* vc192 — 기획서 18행 행성 순서의 나머지 7개.
   *  "스타게이트,프라이즈프리즈마,리버스사이버,네오시티,기계무덤 메카닉블러드시티,
   *   대공전함 다크스왈로해브니스,별빛속 바다 오션코멘, 순력과 혼력의 대립점 오피니시아,
   *   비밀의 화원 노벨 플로스, 신의도시 세르니움" */
  | "dlcreverse" | "dlcneocity" | "dlcmech" | "dlcswallow" | "dlcopinicia" | "dlcnovel" | "dlcsernium";

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
  /** vc183 (지시 — 적에게도 방어력) — 피해 감소 계수.
   *  enemyDef 는 정액 감산(초반 체감 — "딱딱한 놈은 덜 박힌다"),
   *  enemyDefPct 는 비율 감소(후반 스케일 — 공격력이 커져도 유효).
   *  둘 다 적용: final = max(1, (dmg - enemyDef) * (1 - enemyDefPct)).
   *  미지정이면 0 — 기존 몬스터 밸런스는 그대로 유지된다(회귀 없음). */
  def?: number;
  defPct?: number;
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

/* v1.0.15 (피드백 #5) — 퀘스트 경험치 리밸런싱 승수.
 *  기존 expReward는 사냥 경험치(전역 ×1.35·콤보 포함)의 ~30% 수준이라
 *  "퀘스트보다 사냥이 더 이득"인 역전 버그였다. 원작 메이플처럼 퀘스트가
 *  성장의 주 수단이 되도록 지급 시 ×12를 곱한다 (세이브·데이터는 원본 유지,
 *  지급 시점 advanceQuest/completeRepeat에서 일괄 적용). */
export const QUEST_EXP_MUL = 12;

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

/* vc153 (#신규9) — 재림 보스 에메랄드 차등 지급.
 *  기존: 난이도 고정(이지2/노말5/하드9/카오스30)이라 수르트도 나그라파르도 카오스 30개로 동일 —
 *  유저 지적 "카오스 보스도 보스마다 난이도가 다를텐데 왜 전부 30개??".
 *  개편: 난이도 기본치 × 보스 가중치(0.45~2.2) — 보스 기본 exp(320~2600)로 강함 계층화.
 *  예) 카오스: 심연의 수호자 14 · 수르트 19 · 펜리르 22 · 가름 26 · 아부디토스 34 · 나그라파르 66 */
export function bossEmeraldOf(bossKey: BossKey, diff: BossDiffKey): number {
  const b = BOSS_DEFS[bossKey];
  const d = BOSS_DIFFS[diff];
  if (!d) return 5;
  if (!b) return d.emerald;
  const minExp = 320, maxExp = 2600; // guardian(최약) ~ nagr(최강) 스펙트럼
  const t = Math.min(1, Math.max(0, (b.exp - minExp) / (maxExp - minExp)));
  const w = 0.45 + t * 1.75; // 0.45~2.2
  return Math.max(1, Math.round(d.emerald * w));
}

/* v4.1.4 (#보스개성) — 6종 공용 패턴에서 탈피: 보스별 시그니처 패턴 5종 추가.
 *  spiral: 나선 탄막(눈보라/심연) · beam: 회전 스윕 빔(용 브레스/화염) · blink: 그림자 급습(늑대계)
 *  quake: 연속 낙뢰(거인계) · counter: 반격 카운터(로스트아크식 — 창이 노란 링, 공격 1회 이상 시 기절,
 *  방관하면 대폭발) */
export type BossAttackKind =
  | "slam" | "charge" | "volley" | "ring" | "zones" | "summon"
  | "spiral" | "beam" | "blink" | "quake" | "counter"
  /* vc142 (#6) — 보스 고유 VX 패턴 (유저 에셋 FX — 보스마다 전부 다른 공격) */
  | "firepillars" // 수르트 — 추적 화염기둥 3연속
  | "frostnova" // 베헤모스·스콜 — 빙결 신성 2겹
  | "thunderfall" // 나그라파르 — 추적 낙뢰 4연속
  | "poisonfield" // 니드호그·요르문간드 — 맹독 장판
  | "holymantle" // 아부디토스 — 마룡 성역 대폭발
  | "crystalburst" // 심연군주·베오르드 — 결정 8방향 산개
  | "blinkslash" // 가름 — 점멸 3연 참격
  /* vc153 — 스바르트알프헤임 보스 개편 (유저 제공 애니 사양표: Idle/Move Loop · GreenSlash/Vanish/ShieldCast/MagicBurst/PortalTeleport Once) */
  | "greenslash" // 녹색 참격 — 근접 2연 베기
  | "vanish" // 소멸 — 투명화 후 재배치
  | "shieldcast" // 방어막 시전 — 무적 상태유지 → 마력 폭발 반격
  | "magicburst" // 마력 폭발 — 추적 기둥 3연 + 종결 대발발
  | "portalteleport"; // 포탈 텔레포트 — 포탈 2기 소환 후 다른 포탈로 전이

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
  /** v1.4.12 (#18 보스 반대 방향 버그) — 원본 아트가 왼쪽을 바라보면 true (기본 false = 오른쪽 기준).
   *  플레이어 정면 판정이 이 플래그를 존중해 뒷돌기 버그를 없앤다. */
  faceLeft?: boolean;
  /** v1.4.12 (#20 보스마다 패턴 차별화) — 시그니처 패턴: 뽑기 확률 2.6배 (보스 정체성 강화) */
  sig?: BossAttackKind;
  /** v1.4.12 (#20) — 공격 성향 (재공격 쿨 배수 — 1보다 작으면 더 공격적) */
  aggr?: number;
  /** vc183 — 보스 방어력 (정액 + 비율). 미지정 시 기본값을 spawnBoss에서 채운다. */
  def?: number;
  defPct?: number;
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
  repeat?: {
    targetKey: EnemyKey; need: number; gold: number; exp: number; title: string; desc: string;
    /* vc150 (#신규6) — 다수 의뢰 개편: 구역 종족 2~4종 개별 고마릿수 의뢰 (targetKey/need는 호환용 단일분) */
    bounties?: { targetKey: EnemyKey; label: string; need: number }[];
  };
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
  /** vc186b — DLC 챕터 여부. true 면 세계 구원 후에만 입장 가능하고
   *  마지막 DLC 보스를 잡아도 '엔딩'을 재발화하지 않는다. */
  dlc?: boolean;
};

/* 보상 밸런스 (사용자 지시 #6 — 골드 과다 지급 수정: 기존 기준 ×0.8) */
const G = 0.8;

export const CHAPTERS: ChapterSpec[] = [
  {
    key: "forest", num: 2, title: "숲의 신전", subtitle: "미드가르드 서쪽 숲",
    intro: "intro", boss: "guardian", bossDone: "wolvesDone",
    width: 1900, height: 1070, groundTint: 0x9adf6a, groundTex: "tile_forest", pathTex: "tile_path", bg: "#0a1408",
    flowers: 10, trees: 14, rocks: 8,
    /* v2.9 (지시 #1) — 챕터 몬스터 풀 3종: 2구역마다 1종 로테이션(1~6) → 2종(7~8) → 3종(9) → 보스+3종(10) */
    enemies: [{ key: "wolf", count: 4 }, { key: "spider", count: 4 }, { key: "swampbeast", count: 4 }, { key: "x2_frog", count: 3 }, { key: "x3_swampy", count: 3 }, { key: "x3_goblin", count: 3 }],
    main: "wolf",
    beats: [
      { sub: 2, dialogue: "fragment", quest: { id: "f0", type: "collect", title: "결정의 흔적 찾기", desc: "숲 어딘가 빛을 내는 결정의 흔적을 찾아 주워라. 이그니가 기다린다.", targetLabel: "결정의 흔적", reward: Math.round(40 * G), expReward: 70 } },
      { sub: 3, dialogue: "", quest: { id: "f1", type: "hunt", title: "숲의 거미 소탕", desc: "신전으로 가는 길을 막는 숲의 거미 13마리를 처치해라.", need: 13, targetKey: "spider", targetLabel: "숲의 거미", reward: Math.round(60 * G), expReward: 80 } },
      { sub: 6, dialogue: "wolfRoutDone", quest: { id: "f2", type: "hunt", title: "능대 무리 소멸", desc: "어둠에 미친 능대 무리 25마리를 더 처치해라!", need: 25, targetKey: "swampbeast", targetLabel: "능대", reward: Math.round(110 * G), expReward: 180 } },
      { sub: 8, dialogue: "", quest: { id: "f3", type: "collect", title: "능대들이 지키던 결정", desc: "능대들이 지키던 곳에서 또 하나의 빛이 느껴진다.", targetLabel: "결정의 흔적", reward: Math.round(60 * G), expReward: 90 } },
      /* vc147 (#23) — 사연+기믹 확장 비트 (기존 인덱스 보존 — 체인 말미에만 추가) */
      { sub: 9, dialogue: "", quest: { id: "f4", type: "collect", title: "[사연] 약초 할멈의 기승전결", desc: "약초 할멈이 말한 '빛나는 약초'는 사실 결정의 조각이었다. 하나 찾아오자 숲의 진실이 보인다.", targetLabel: "결정의 흔적", reward: Math.round(70 * G), expReward: 110 } },
      { sub: 10, dialogue: "", quest: { id: "f5", type: "hunt", title: "[기믹] 이끼 골렘 소굴 청소", desc: "신전 뒤편 이끼 골렘 10마리가 결정을 집어 삼켰다. 토해내게 하자.", need: 10, targetKey: "golem", targetLabel: "이끼 골렘", reward: Math.round(120 * G), expReward: 190 } },
    ],
    repeat: { need: 16, gold: Math.round(70 * G), exp: 70, title: "[반복] 늑대 토벌 의뢰", desc: "마을 토벌 의뢰 — 늑대를 계속 사냥해 골드와 경험치를 얻자." },
    /* v1.4.3 (작업2) — enter 3→1: 신규 유저가 마을에서 1-1로 바로 나갈 수 있게 완화.
     *  기존 Lv3 게이트가 시작 지점을 막아버리는 교착(레벨 올릴 곳 부재)의 핵심 원인.
     *  대신 마을 훈련장+초보 퀘스트로 자연스러운 1→3 루트를 제공하고, mid 게이트(구역4·Lv5)는 유지.
     *  vc146 (#8) — 첫 진입 교착 방지분(enter 1·mid 5)만 유지 — 나머지 챕터는 전부 상향 */
    lvGate: { enter: 1, mid: 5 },
  },
  {
    key: "kingdom", num: 3, title: "쿠소디아", subtitle: "선박의 왕국 · 늪지대",
    intro: "kingdomIntro", boss: "behemoth", bossDone: "kingdomDone",
    width: 1750, height: 990, groundTint: 0x86c95e, groundTex: "tile_grass", pathTex: "tile_path", bg: "#0d1808",
    flowers: 8, trees: 9, rocks: 6,
    enemies: [{ key: "swampbeast", count: 5 }, { key: "wolf", count: 4 }, { key: "golem", count: 3 }, { key: "x2_rat", count: 2 }, { key: "x3_imp", count: 3 }, { key: "x3_goblin", count: 2 }],
    main: "swampbeast",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "k1", type: "collect", title: "능지 속 결정의 조각", desc: "능대들이 품고 있던 결정의 조각을 되찾아라.", targetLabel: "결정의 흔적", reward: Math.round(80 * G), expReward: 140 } },
      { sub: 3, dialogue: "", quest: { id: "k0", type: "hunt", title: "능지의 능대 소탕", desc: "결정의 기운을 먹고 미쳐 버린 늪의 능대 15마리를 처치해라.", need: 15, targetKey: "swampbeast", targetLabel: "능대", reward: Math.round(90 * G), expReward: 160 } },
      { sub: 5, dialogue: "", quest: { id: "k2", type: "hunt", title: "왕국 신뢰 얻기", desc: "기사단을 도와 능대 무리 20마리를 더 베어 내라!", need: 20, targetKey: "swampbeast", targetLabel: "능대", reward: Math.round(140 * G), expReward: 260 } },
      { sub: 7, dialogue: "swampDone", quest: { id: "k3", type: "hunt", title: "왕국의 위협 제거", desc: "능지의 어둠이 짙어진다 — 능대 25마리를 처치해라!", need: 25, targetKey: "swampbeast", targetLabel: "능대", reward: Math.round(170 * G), expReward: 320 } },
      /* vc147 (#23) — 사연+기믹 확장 비트 */
      { sub: 9, dialogue: "", quest: { id: "k5", type: "collect", title: "[사연] 근위대의 마지막 문장", desc: "해골 문지기의 문장(紋章)에 반응하는 결정 — 왕국 최후의 기록이 새겨져 있다.", targetLabel: "결정의 흔적", reward: Math.round(150 * G), expReward: 240 } },
      { sub: 10, dialogue: "", quest: { id: "k6", type: "hunt", title: "[기믹] 고아 소녀의 복수극", desc: "소녀의 가족을 삼킨 늪의 축제광(임프) 18마리. 복수는 그녀의 몫이 아니라 우리의 몫이다.", need: 18, targetKey: "x3_imp", targetLabel: "늪의 축제광", reward: Math.round(200 * G), expReward: 300 } },
    ],
    repeat: { need: 20, gold: Math.round(100 * G), exp: 100, title: "[반복] 늪지 정화 의뢰", desc: "쿠소디아 기사단 의뢰 — 능대를 계속 사냥해라." },
    /* vc146 (#8) — 챕터 레벨 제한 상향 (유저 지시 "챕터마다 레벨 제한이 너무 작음"): 8→12/15 */
    lvGate: { enter: 12, mid: 15 },
  },
  {
    key: "alfheim", num: 4, title: "알프헤임", subtitle: "요정의 성전 · 빛의 결정",
    intro: "alfheimIntro", boss: "nidhog", bossDone: "guardianDone",
    width: 1500, height: 860, groundTint: 0x8f7fd8, groundTex: "tile_grass2", pathTex: "tile_garden", bg: "#0d0a1e",
    flowers: 6, trees: 10, rocks: 10,
    enemies: [{ key: "minion", count: 4 }, { key: "spider", count: 4 }, { key: "wraith", count: 3 }, { key: "x2_bat", count: 3 }, { key: "x3_icezombie", count: 3 }, { key: "x3_orcshaman", count: 3 }],
    main: "minion",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "a0", type: "hunt", title: "하수인 소탕", desc: "니드호그가 부린 심연의 하수인 13마리를 처치해 성전의 길을 열자.", need: 13, targetKey: "minion", targetLabel: "심연 하수인", reward: Math.round(80 * G), expReward: 130 } },
      { sub: 3, dialogue: "", quest: { id: "a1", type: "collect", title: "여왕의 가호", desc: "하수인들이 숨겨둔 결정의 조각을 회수해 여왕에게 바쳐라.", targetLabel: "결정의 흔적", reward: Math.round(80 * G), expReward: 110 } },
      { sub: 6, dialogue: "minionPurgeDone", quest: { id: "a2", type: "hunt", title: "성전 지키기", desc: "니드호그를 부르는 의식을 막자 — 하수인 80마리 처치!", need: 80, targetKey: "minion", targetLabel: "심연 하수인", reward: Math.round(400 * G), expReward: 740 } },
      /* vc147 (#23) — 사연+기믹 확장 비트 */
      { sub: 9, dialogue: "", quest: { id: "a4", type: "collect", title: "[사연] 노래하는 결정", desc: "숲의 노래가 잡힌 결정 — 정찰병은 이 소리를 듣고 자리를 지켰다. 그 노래를 끝까지 들어주자.", targetLabel: "결정의 흔적", reward: Math.round(220 * G), expReward: 340 } },
      { sub: 10, dialogue: "", quest: { id: "a5", type: "hunt", title: "[기믹] 덩굴에 움켜쥔 빛", desc: "빛의 결정을 둘러싼 미니언 20마리를 정화하면 숲의 노래가 돌아온다.", need: 20, targetKey: "minion", targetLabel: "어둠의 하수인", reward: Math.round(280 * G), expReward: 420 } },
    ],
    repeat: { need: 20, gold: Math.round(95 * G), exp: 95, title: "[반복] 성전 순찰 의뢰", desc: "요정 여왕의 의뢰 — 하수인을 계속 처치해 훈련해라." },
    /* vc146 (#8) — 챕터 레벨 제한 상향: 14→22/26 */
    lvGate: { enter: 22, mid: 26 },
  },
  {
    key: "muspelheim", num: 5, title: "무스펠헤임", subtitle: "극열의 해역 · 화산 지대",
    intro: "muspelIntro", boss: "surt", bossDone: "surtDone",
    /* vc204 (지시서 #16 "저 꽃게 타일은 도대체 뭐임?") — 무스펠헤임 지면 교체.
     *  종전 groundTex="tile_lava" 는 128×128·7색짜리 오염 webp 로, 실제로는 붉은 게 그림이
     *  반복됐다. pathTex="tile_blood" 도 128px·6색 오염본이었다.
     *  → 정상 256×256 지형으로 교체: 지면 = tile_magma.png(107색, 균열 용암),
     *    길 = tile_basalt.webp(209색, 어두운 현무암). tint 는 유지해 극열 톤을 보존한다.
     *  블룸 가드는 채널(muspelheim) 기준이라 타일명이 바뀌어도 그대로 유지된다. */
    width: 2200, height: 1250, groundTint: 0xd88a4a, groundTex: "tile_magma", pathTex: "tile_basalt", bg: "#1c0d06",
    flowers: 0, trees: 4, rocks: 12,
    enemies: [{ key: "emberwolf", count: 4 }, { key: "firespirit", count: 3 }, { key: "golem", count: 3 }, { key: "x2_firebird", count: 3 }, { key: "x3_tinyzombie", count: 3 }, { key: "x3_wogol", count: 3 }],
    main: "emberwolf",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "m0", type: "hunt", title: "불꽃 늑대 사냥", desc: "네바다를 내달리는 불꽃 늑대 100마리를 처치해라.", need: 100, targetKey: "emberwolf", targetLabel: "불꽃 늑대", reward: Math.round(1000 * G), expReward: 1860 } },
      { sub: 4, dialogue: "", quest: { id: "m1", type: "hunt", title: "화염 정령 진압", desc: "열이 가장 강한 날 — 화염 정령 110마리를 처치해라.", need: 110, targetKey: "firespirit", targetLabel: "화염 정령", reward: Math.round(1440 * G), expReward: 2540 } },
      { sub: 5, dialogue: "", quest: { id: "m2", type: "collect", title: "화염 속의 빛", desc: "용암 사이에서 결정의 조각이 반짝인다. 회수해라.", targetLabel: "결정의 흔적", reward: Math.round(100 * G), expReward: 190 } },
      { sub: 7, dialogue: "spiritPurgeDone", quest: { id: "m3", type: "hunt", title: "호족촌 구원", desc: "엘렌을 도와 — 지하도시를 노리는 화염 정령 120마리를 처치해라!", need: 120, targetKey: "firespirit", targetLabel: "화염 정령", reward: Math.round(1060 * G), expReward: 1920 } },
      /* vc147 (#23) — 사연+기믹 확장 비트 */
      { sub: 9, dialogue: "", quest: { id: "m4", type: "collect", title: "[사연] 대장장이 장인의 미완성 검", desc: "장인이 평생 두드린 검의 최종 재료는 '타지 않는 결정'. 이제 그 이유를 안다.", targetLabel: "결정의 흔적", reward: Math.round(320 * G), expReward: 480 } },
      { sub: 10, dialogue: "", quest: { id: "m5", type: "hunt", title: "[기믹] 용광로 재점화", desc: "용암 조류 22마리의 열기로 식어버린 용광로를 다시 달군다.", need: 22, targetKey: "x2_firebird", targetLabel: "용암 조류", reward: Math.round(400 * G), expReward: 600 } },
    ],
    repeat: { need: 20, gold: Math.round(130 * G), exp: 130, title: "[반복] 화산 지대 순찰 의뢰", desc: "호족촌 의뢰 — 불꽃 늑대를 계속 사냥해라." },
    /* vc146 (#8) — 챕터 레벨 제한 상향: 20→34/39 */
    lvGate: { enter: 34, mid: 39 },
  },
  {
    key: "niflheim", num: 6, title: "니플헤임", subtitle: "극한의 해역 · 얼음의 성전",
    intro: "niflIntro", boss: "fenrir", bossDone: "fenrirDone",
    width: 1670, height: 950, groundTint: 0xdfeaf8, groundTex: "tile_snow", pathTex: "tile_ice", bg: "#0c1826",
    flowers: 0, trees: 10, rocks: 10,
    enemies: [{ key: "frostwolf", count: 4 }, { key: "icegolem", count: 3 }, { key: "wraith", count: 3 }, { key: "x2_frostfly", count: 3 }, { key: "x3_icezombie", count: 3 }, { key: "x3_orcwarrior", count: 3 }],
    main: "frostwolf",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "n0", type: "hunt", title: "서리 늑대 사냥", desc: "설원을 유랑하는 서리 늑대 110마리를 처치해라.", need: 110, targetKey: "frostwolf", targetLabel: "서리 늑대", reward: Math.round(950 * G), expReward: 1760 } },
      { sub: 4, dialogue: "", quest: { id: "n1", type: "hunt", title: "얼음 골렘 격파", desc: "성전 길을 얼리고 있는 얼음 골렘 100기를 격파해라.", need: 100, targetKey: "icegolem", targetLabel: "얼음 골렘", reward: Math.round(1700 * G), expReward: 3000 } },
      { sub: 6, dialogue: "", quest: { id: "n2", type: "collect", title: "얼음 속의 결정", desc: "얼음 결정 사이에서 세계의 빛이 반짝인다.", targetLabel: "결정의 흔적", reward: Math.round(100 * G), expReward: 180 } },
      { sub: 7, dialogue: "frostRoutDone", quest: { id: "n3", type: "hunt", title: "설원 정화", desc: "펜리르의 권속인 서리 늑대 130마리를 처치해라!", need: 130, targetKey: "frostwolf", targetLabel: "서리 늑대", reward: Math.round(910 * G), expReward: 1640 } },
      /* vc147 (#23) — 사연+기믹 확장 비트 */
      { sub: 9, dialogue: "", quest: { id: "n4", type: "collect", title: "[사연] 얼음 속 아들의 기억", desc: "수렵꾼의 아들은 얼음 결정 속에서 기다리고 있었다. 결정을 가져오면 마지막 겨울이 말해준다.", targetLabel: "결정의 흔적", reward: Math.round(460 * G), expReward: 680 } },
      { sub: 10, dialogue: "", quest: { id: "n5", type: "hunt", title: "[기믹] 눈보라의 길잡이", desc: "눈보라를 헤매는 언데드 24마리를 보내드려 길을 만들자 — 배웅자의 부탁이다.", need: 24, targetKey: "x3_icezombie", targetLabel: "얼음 좀비", reward: Math.round(560 * G), expReward: 840 } },
    ],
    repeat: { need: 24, gold: Math.round(145 * G), exp: 145, title: "[반복] 설원 순찰 의뢰", desc: "니플헤임 정찰 의뢰 — 서리 늑대를 계속 사냥해라." },
    /* vc146 (#8) — 챕터 레벨 제한 상향: 27→48/54 */
    lvGate: { enter: 48, mid: 54 },
  },
  {
    key: "cave", num: 7, title: "스바르트알프헤임", subtitle: "어둠 요정들의 해역 · 수정 광맥",
    intro: "caveIntro", boss: "abysslord", bossDone: "caveDone",
    width: 1670, height: 950, groundTint: 0x8a6a4a, groundTex: "tile_cave", pathTex: "tile_stone", bg: "#100a08",
    flowers: 0, trees: 0, rocks: 14,
    enemies: [{ key: "spider", count: 4 }, { key: "minion", count: 4 }, { key: "golem", count: 3 }, { key: "x2_snail", count: 3 }, { key: "x3_imp", count: 3 }, { key: "x3_maskedorc", count: 2 }],
    main: "spider",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "c0", type: "collect", title: "지하 깊은 곳의 빛", desc: "어둠 요정들의 지하 어딘가에서 결정의 조각이 빛나고 있다.", targetLabel: "결정의 흔적", reward: Math.round(60 * G), expReward: 130 } },
      { sub: 3, dialogue: "", quest: { id: "c1", type: "hunt", title: "동굴 거미 소탕", desc: "어둠에 물든 동굴 거미 120마리를 처치해라.", need: 120, targetKey: "spider", targetLabel: "동굴 거미", reward: Math.round(720 * G), expReward: 1280 } },
      { sub: 5, dialogue: "", quest: { id: "c2", type: "hunt", title: "수정 골렘 파괴", desc: "거미들을 조종하는 수정 골렘 110기를 부숴 버려라.", need: 110, targetKey: "golem", targetLabel: "수정 골렘", reward: Math.round(1430 * G), expReward: 2420 } },
      { sub: 7, dialogue: "spiderDone", quest: { id: "c3", type: "hunt", title: "지하 정화", desc: "거미 둥지를 완전히 태우자 — 거미 140마리 처치!", need: 140, targetKey: "spider", targetLabel: "동굴 거미", reward: Math.round(900 * G), expReward: 1680 } },
      { sub: 8, dialogue: "", quest: { id: "c4", type: "collect", title: "여왕의 두 번째 부탁", desc: "어둠 요정 여왕의 마지막 부탁 — 뿌리 사이의 잔광을 회수해라.", targetLabel: "결정의 흔적", reward: Math.round(70 * G), expReward: 140 } },
      /* vc147 (#23) — 사연+기믹 확장 비트 */
      { sub: 9, dialogue: "", quest: { id: "c4", type: "collect", title: "[사연] 갱도의 마지막 등불", desc: "램프 아주머니의 남편이 마지막으로 들고 들어간 결정 등불 — 아직 어딘가에서 빛나고 있다.", targetLabel: "결정의 흔적", reward: Math.round(640 * G), expReward: 940 } },
      { sub: 10, dialogue: "", quest: { id: "c5", type: "hunt", title: "[기믹] 지지대를 갉는 자들", desc: "갱도 지지대를 갉아먹는 거미 26마리 — 두 번째 붕괴는 없다.", need: 26, targetKey: "spider", targetLabel: "갱도 거미", reward: Math.round(760 * G), expReward: 1120 } },
    ],
    repeat: { need: 20, gold: Math.round(115 * G), exp: 115, title: "[반복] 지하 정화 의뢰", desc: "어둠 요정 여왕의 의뢰 — 거미를 계속 사냥해라." },
    /* vc146 (#8) — 챕터 레벨 제한 상향: 34→64/70 */
    lvGate: { enter: 64, mid: 70 },
  },
  {
    key: "nidavellir", num: 8, title: "니다벨리르", subtitle: "난쟁이들의 해역 · 룬 광산",
    intro: "nidavellirIntro", boss: "skoll", bossDone: "skollDone",
    width: 1670, height: 950, groundTint: 0x9a8a6a, groundTex: "tile_ruin", pathTex: "tile_ash", bg: "#121008",
    flowers: 0, trees: 0, rocks: 16,
    enemies: [{ key: "runegolem", count: 4 }, { key: "golem", count: 3 }, { key: "spider", count: 3 }, { key: "x2_stonegolem", count: 3 }, { key: "x3_ogre", count: 3 }, { key: "x3_orcwarrior", count: 3 }],
    main: "runegolem",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "d0", type: "hunt", title: "룬 골렘 정지", desc: "폭주한 룬 골렘 130기를 정지시켜라.", need: 130, targetKey: "runegolem", targetLabel: "룬 골렘", reward: Math.round(2000 * G), expReward: 3600 } },
      { sub: 4, dialogue: "", quest: { id: "d1", type: "collect", title: "룬 각인 판", desc: "광산 깊은 곳의 결정 조각 — 룬 각인판을 회수해라.", targetLabel: "결정의 흔적", reward: Math.round(120 * G), expReward: 220 } },
      { sub: 6, dialogue: "runePurgeDone", quest: { id: "d2", type: "hunt", title: "광산 탈환", desc: "난쟁이 마을을 되돌리자 — 룬 골렘 150기 처치!", need: 150, targetKey: "runegolem", targetLabel: "룬 골렘", reward: Math.round(1560 * G), expReward: 2760 } },
      { sub: 8, dialogue: "", quest: { id: "d3", type: "hunt", title: "수정 골렘 정리", desc: "광산을 어지럽히는 수정 골렘 120기를 부수자.", need: 120, targetKey: "golem", targetLabel: "수정 골렘", reward: Math.round(2640 * G), expReward: 4800 } },
      /* vc147 (#23) — 사연+기믹 확장 비트 */
      { sub: 9, dialogue: "", quest: { id: "d4", type: "collect", title: "[사연] 사부님의 마지막 룬", desc: "견습이 열한 번째에 떨린 이유 — 사부의 유언이 담긴 룬 결정이 채굴장에 남아 있다.", targetLabel: "결정의 흔적", reward: Math.round(880 * G), expReward: 1320 } },
      { sub: 10, dialogue: "", quest: { id: "d5", type: "hunt", title: "[기믹] 룬 도굴꾼 소탕", desc: "룬 각인 도굴꾼 오우거 28마리 — 드워프의 망치가 복수를 대신한다.", need: 28, targetKey: "x3_ogre", targetLabel: "룬 도굴꾼", reward: Math.round(1000 * G), expReward: 1520 } },
    ],
    repeat: { need: 20, gold: Math.round(150 * G), exp: 150, title: "[반복] 광산 경비 의뢰", desc: "난쟁이 광산 조합 의뢰 — 룬 골렘을 계속 처치해라." },
    /* vc146 (#8) — 챕터 레벨 제한 상향: 42→84/92 */
    lvGate: { enter: 84, mid: 92 },
  },
  {
    key: "hel", num: 9, title: "헬", subtitle: "절벽 너머의 해역 · 대전쟁의 땅",
    intro: "helIntro", boss: "gram", bossDone: "gramDone",
    width: 1670, height: 950, groundTint: 0x4a3a5a, groundTex: "tile_hel", pathTex: "tile_abyss", bg: "#0d0616",
    flowers: 0, trees: 6, rocks: 12,
    enemies: [{ key: "helhound", count: 4 }, { key: "wraith", count: 3 }, { key: "golem", count: 3 }, { key: "x2_darkhound", count: 3 }, { key: "x3_chort", count: 3 }, { key: "x3_maskedorc", count: 3 }],
    main: "helhound",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "h0", type: "hunt", title: "헬 하운드 사냥", desc: "절벽을 지키는 헬 하운드 150마리를 처치해라.", need: 150, targetKey: "helhound", targetLabel: "헬 하운드", reward: Math.round(2600 * G), expReward: 4800 } },
      { sub: 3, dialogue: "", quest: { id: "h1", type: "collect", title: "대지의 결정", desc: "절벽 아래 대지의 결정 — 결정의 흔적을 회수해라.", targetLabel: "결정의 흔적", reward: Math.round(150 * G), expReward: 280 } },
      { sub: 5, dialogue: "houndPurgeDone", quest: { id: "h2", type: "hunt", title: "절벽 열기", desc: "헬 하운드 180마리를 처치해 저택의 문을 열어라!", need: 180, targetKey: "helhound", targetLabel: "헬 하운드", reward: Math.round(1920 * G), expReward: 3480 } },
      { sub: 7, dialogue: "", quest: { id: "h3", type: "hunt", title: "심연 유령 소탕", desc: "힐다 할머니의 조사 일지를 지키는 심연 유령 160마리를 처치해라.", need: 160, targetKey: "wraith", targetLabel: "심연 유령", reward: Math.round(2990 * G), expReward: 5540 } },
      /* vc147 (#23) — 사연+기믹 확장 비트 */
      { sub: 9, dialogue: "", quest: { id: "h4", type: "collect", title: "[사연] 촛불 편지의 주인", desc: "관리인이 30년간 옮겨 심은 촛불 편지 — 마지막 한 통의 결정이 이승의 이름을 부른다.", targetLabel: "결정의 흔적", reward: Math.round(1200 * G), expReward: 1800 } },
      { sub: 10, dialogue: "", quest: { id: "h5", type: "hunt", title: "[기믹] 무덤을 파는 자들", desc: "무덤을 훼손하는 원한의 망령 30마리 — 재의 무희가 춤을 멈추지 않게.", need: 30, targetKey: "wraith", targetLabel: "원한의 망령", reward: Math.round(1400 * G), expReward: 2100 } },
    ],
    repeat: { need: 20, gold: Math.round(175 * G), exp: 175, title: "[반복] 절벽 정찰 의뢰", desc: "헬의 기운이 강해지고 있다 — 하운드를 계속 처치해라." },
    /* vc146 (#8) — 챕터 레벨 제한 상향: 50→104/114 */
    lvGate: { enter: 104, mid: 114 },
  },
  {
    key: "abyss", num: 10, title: "세계수의 뿌리", subtitle: "심연의 근원 · 종언의 왕좌",
    intro: "abyssIntro", boss: "abudditos", bossDone: "victory",
    width: 1430, height: 830, groundTint: 0x3a2c52, groundTex: "tile_morgue", pathTex: "tile_deep", bg: "#0d0616",
    flowers: 0, trees: 0, rocks: 12,
    enemies: [{ key: "wraith", count: 4 }, { key: "minion", count: 4 }, { key: "helhound", count: 3 }, { key: "x2_reeffish", count: 3 }, { key: "x3_necromancer", count: 3 }, { key: "x3_bigzombie", count: 3 }],
    main: "wraith",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "y0", type: "hunt", title: "뿌리의 유령 소탕", desc: "왕좌를 지키는 심연 유령 160마리를 처치해라.", need: 160, targetKey: "wraith", targetLabel: "심연 유령", reward: Math.round(2400 * G), expReward: 4480 } },
      { sub: 4, dialogue: "", quest: { id: "y1", type: "collect", title: "빼앗긴 빛의 흔적", desc: "아부디토스가 삼키지 못한 결정의 흔적을 회수해라.", targetLabel: "결정의 흔적", reward: Math.round(120 * G), expReward: 220 } },
      { sub: 6, dialogue: "wraithDone", quest: { id: "y2", type: "hunt", title: "왕좌 앞길 열기", desc: "심연 유령 200마리를 처치해 왕좌의 문을 열어라!", need: 200, targetKey: "wraith", targetLabel: "심연 유령", reward: Math.round(1920 * G), expReward: 3520 } },
      /* vc147 (#23) — 사연+기믹 확장 비트 */
      { sub: 9, dialogue: "", quest: { id: "b4", type: "collect", title: "[사연] 등불 드리프터의 바다", desc: "등불이 꺼진 방향이 바다였다는 말의 진짜 뜻 — 결정 안에 심연의 별이 묻혀 있다.", targetLabel: "결정의 흔적", reward: Math.round(1800 * G), expReward: 2700 } },
      { sub: 10, dialogue: "", quest: { id: "b5", type: "hunt", title: "[기믹] 뿌리를 갉는 종언", desc: "세계수 뿌리를 갉는 대좀비 32마리 — 뿌리가 아프다고 울고 있다.", need: 32, targetKey: "x3_bigzombie", targetLabel: "대좀비", reward: Math.round(2100 * G), expReward: 3200 } },
    ],
    repeat: { need: 24, gold: Math.round(165 * G), exp: 165, title: "[반복] 뿌리 정찰 의뢰", desc: "뿌리의 기운이 강해지고 있다 — 유령을 계속 처치해라." },
    /* vc146 (#8) — 챕터 레벨 제한 상향: 58→126/136 */
    lvGate: { enter: 126, mid: 136 },
  },

  /* ══════════════════════════════════════════════════════════════════════════
   * vc186b — DLC 「세계 구원 이후」
   *
   * 사용자 지시: "그냥 9개의 바다는 놔두고 DLC(추가 스토리) 느낌으로
   *              세계 구원후 기획서의 스토리 관련 게임이 이어지도록 만들어"
   *
   * 기획서 6행: "1기가 끝이나면 2기 그랜드플래닛으로 세계가 변경된다
   *              이곳에서의 메인 테마는 윤지왕자와 유진으로 원래 고향 '신의도시 세르니움'이다"
   * 기획서 12행 행성 순서: 스타게이트 → 프라이즈프리즈마 → … → 오션코멘 → … → 세르니움
   *
   * 위 9챕터(라일락 월드)는 **한 글자도 수정하지 않는다**. 아부디토스를 잡고
   * 세계를 구원한 뒤에만 열리는 추가 스토리로 붙인다.
   * ══════════════════════════════════════════════════════════════════════════ */
  {
    key: "dlcstargate", num: 11, dlc: true,
    title: "DLC 1 — 제1행성 스타게이트",
    subtitle: "그랜드플래닛 · 세계를 구원한 자에게 열린 첫 번째 별",
    intro: "intro", boss: "nidhog", bossDone: "guardianDone",
    width: 2000, height: 1120, groundTint: 0x5f6fd8, groundTex: "tile_nebula", pathTex: "tile_stone", bg: "#070a1c",
    flowers: 4, trees: 3, rocks: 10,
    /* 기획서 1079~: 별모양 행성, 문지기 리틀스타, 장미가 행성의 동력원, 뒤틀린 지면 */
    enemies: [{ key: "wraith", count: 4 }, { key: "minion", count: 4 }, { key: "x2_frostfly", count: 3 }, { key: "x2_darkhound", count: 3 }, { key: "x3_necromancer", count: 2 }, { key: "golem", count: 3 }],
    main: "wraith",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "ds1", type: "hunt", title: "뒤틀린 지면의 유령", desc: "행성이 발밑에서 꿈틀거린다 — 유령 18마리를 처치해 길을 열어라.", need: 18, targetKey: "wraith", targetLabel: "행성의 유령", reward: Math.round(2400 * G), expReward: 3600 } },
      { sub: 4, dialogue: "", quest: { id: "ds2", type: "collect", title: "장미의 파편", desc: "리틀스타의 장미가 이 행성의 동력원이다. 파편을 모아 약점을 찾아라.", targetLabel: "보석의 흔적", reward: Math.round(2600 * G), expReward: 3900 } },
      { sub: 6, dialogue: "", quest: { id: "ds3", type: "hunt", title: "감염된 사냥개", desc: "우주를 떠도는 바이러스에 감염된 사냥개 22마리를 베어라.", need: 22, targetKey: "x2_darkhound", targetLabel: "감염된 사냥개", reward: Math.round(2900 * G), expReward: 4200 } },
      { sub: 8, dialogue: "", quest: { id: "ds4", type: "hunt", title: "별의 골렘", desc: "행성의 핵을 지키는 골렘 14기를 부숴라.", need: 14, targetKey: "golem", targetLabel: "별의 골렘", reward: Math.round(3100 * G), expReward: 4600 } },
      { sub: 9, dialogue: "", quest: { id: "ds5", type: "collect", title: "[사연] 문지기의 마지막 장미", desc: "리틀스타가 지키던 마지막 장미 한 송이를 되찾아라.", targetLabel: "보석의 흔적", reward: Math.round(3300 * G), expReward: 4800 } },
      { sub: 10, dialogue: "", quest: { id: "ds6", type: "hunt", title: "[기믹] 별의 묘지", desc: "죽은 별을 되살리려는 네크로맨서 12명을 처치해라.", need: 12, targetKey: "x3_necromancer", targetLabel: "별의 네크로맨서", reward: Math.round(3800 * G), expReward: 5400 } },
    ],
    repeat: { need: 26, gold: Math.round(190 * G), exp: 190, title: "[반복] 스타게이트 정찰", desc: "뒤틀린 지면이 계속 늘어난다 — 유령을 처치해 진로를 확보하자." },
    lvGate: { enter: 130, mid: 140 },
  },
  {
    key: "dlcprisma", num: 12, dlc: true,
    title: "DLC 2 — 제2행성 프라이즈 프리즈마",
    subtitle: "그랜드플래닛 · 마법공학의 도시, 위험한 실험",
    intro: "intro", boss: "surt", bossDone: "kingdomDone",
    width: 2200, height: 1200, groundTint: 0x8f6fd8, groundTex: "tile_desert", pathTex: "tile_sand", bg: "#120a22",
    flowers: 6, trees: 5, rocks: 12,
    /* 기획서 1126~: 마법공학의 도시. 시장 제이드가 위험한 실험을 한다는 소문 */
    enemies: [{ key: "runegolem", count: 4 }, { key: "x3_ogre", count: 3 }, { key: "x3_chort", count: 3 }, { key: "x2_stonegolem", count: 3 }, { key: "x3_orcshaman", count: 2 }, { key: "minion", count: 3 }],
    main: "runegolem",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "dp1", type: "hunt", title: "공방의 폭주 기계", desc: "실험실에서 새어 나온 룬 골렘 16기를 멈춰라.", need: 16, targetKey: "runegolem", targetLabel: "룬 골렘", reward: Math.round(4200 * G), expReward: 6000 } },
      { sub: 4, dialogue: "", quest: { id: "dp2", type: "collect", title: "설계도의 파편", desc: "제이드의 실험 설계도 조각을 모아 계획을 밝혀라.", targetLabel: "보석의 흔적", reward: Math.round(4500 * G), expReward: 6300 } },
      { sub: 6, dialogue: "", quest: { id: "dp3", type: "hunt", title: "거인의 작업장", desc: "마법 기계에 동력을 넣는 오거 20마리를 쓰러뜨려라.", need: 20, targetKey: "x3_ogre", targetLabel: "작업장 오거", reward: Math.round(4900 * G), expReward: 6900 } },
      { sub: 8, dialogue: "", quest: { id: "dp4", type: "hunt", title: "석화된 수호자", desc: "도시를 지키던 돌 골렘 18기가 통제를 벗어났다.", need: 18, targetKey: "x2_stonegolem", targetLabel: "석화 수호자", reward: Math.round(5300 * G), expReward: 7500 } },
      { sub: 9, dialogue: "", quest: { id: "dp5", type: "collect", title: "[사연] 시장의 서재", desc: "제이드의 서재에서 도공의 가문 기록을 찾아라.", targetLabel: "보석의 흔적", reward: Math.round(5600 * G), expReward: 7800 } },
      { sub: 10, dialogue: "", quest: { id: "dp6", type: "hunt", title: "[기믹] 주술 회로 폭주", desc: "오르크 주술사 15명이 회로를 역류시킨다 — 즉시 차단하라.", need: 15, targetKey: "x3_orcshaman", targetLabel: "회로 주술사", reward: Math.round(6300 * G), expReward: 8700 } },
    ],
    repeat: { need: 28, gold: Math.round(230 * G), exp: 230, title: "[반복] 프리즈마 순찰", desc: "마법공학의 도시는 밤에도 멈추지 않는다 — 룬 골렘을 정리하자." },
    lvGate: { enter: 145, mid: 155 },
  },
  {
    key: "dlcocean", num: 13, dlc: true,
    title: "DLC 3 — 별빛속 바다 오션코멘",
    subtitle: "그랜드플래닛 · 꿈이 가라앉은 바다, 신의도시로 가는 마지막 길",
    intro: "intro", boss: "vord", bossDone: "victory",
    width: 2100, height: 1150, groundTint: 0x3f7fd8, groundTex: "tile_ice", pathTex: "tile_snow", bg: "#06121e",
    flowers: 3, trees: 2, rocks: 8,
    /* 기획서 12행 행성7 '별빛속 바다 오션코멘' + 유메(꿈의 지배자) 모티프 */
    enemies: [{ key: "x2_reeffish", count: 4 }, { key: "minion", count: 4 }, { key: "wraith", count: 3 }, { key: "x2_frostfly", count: 3 }, { key: "x3_necromancer", count: 3 }, { key: "helhound", count: 3 }],
    main: "x2_reeffish",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "do1", type: "hunt", title: "별빛 산호의 물고기", desc: "꿈이 스며든 바다 — 산호 물고기 20마리를 쫓아내라.", need: 20, targetKey: "x2_reeffish", targetLabel: "산호 물고기", reward: Math.round(6800 * G), expReward: 9200 } },
      { sub: 4, dialogue: "", quest: { id: "do2", type: "collect", title: "가라앉은 별의 조각", desc: "바다 밑에 잠든 별의 조각을 건져 올려라.", targetLabel: "보석의 흔적", reward: Math.round(7200 * G), expReward: 9800 } },
      { sub: 6, dialogue: "", quest: { id: "do3", type: "hunt", title: "꿈을 삼킨 유령", desc: "잠든 자의 꿈을 삼키는 유령 22체를 정화하라.", need: 22, targetKey: "wraith", targetLabel: "꿈의 유령", reward: Math.round(7800 * G), expReward: 10600 } },
      { sub: 8, dialogue: "", quest: { id: "do4", type: "hunt", title: "심해의 사냥개", desc: "바다 밑에서 올라온 사냥개 18마리를 베어라.", need: 18, targetKey: "helhound", targetLabel: "심해 사냥개", reward: Math.round(8400 * G), expReward: 11400 } },
      { sub: 9, dialogue: "", quest: { id: "do5", type: "collect", title: "[사연] 오션코멘의 노래", desc: "바다가 부르는 노래의 마지막 소절을 기록해라.", targetLabel: "보석의 흔적", reward: Math.round(8900 * G), expReward: 12000 } },
      { sub: 10, dialogue: "", quest: { id: "do6", type: "hunt", title: "[기믹] 꿈의 주술사", desc: "꿈과 현실의 경계를 무너뜨리는 주술사 14명을 처치하라.", need: 14, targetKey: "x3_necromancer", targetLabel: "꿈의 주술사", reward: Math.round(9800 * G), expReward: 13400 } },
    ],
    repeat: { need: 30, gold: Math.round(270 * G), exp: 270, title: "[반복] 오션코멘 정찰", desc: "바다가 다시 노래하기 시작했다 — 물고기를 계속 쫓아내자." },
    lvGate: { enter: 160, mid: 170 },
  },

  /* ══════════════════════════════════════════════════════════════════════════
   * vc192 — 기획서 2기 나머지 7행성 (세계 구원 후 DLC 후속)
   *
   * 근거: 기획서 18행 행성 순서
   *  "스타게이트, 프라이즈프리즈마, 리버스사이버, 네오시티, 기계무덤 메카닉블러드시티,
   *   대공전함 다크스왈로해브니스, 별빛속 바다 오션코멘, 순력과 혼력의 대립점 오피니시아,
   *   비밀의 화원 노벨 플로스, 신의도시 세르니움"
   *
   * 각 행성의 적 구성·분위기·퀘스트는 기획서 본문(1200~1400행, 1024~1070행 요약)을 따랐다.
   * ══════════════════════════════════════════════════════════════════════════ */
  {
    key: "dlcreverse", num: 14, dlc: true,
    title: "DLC 4 — 리버스 사이버",
    subtitle: "그랜드플래닛 · 지하선로의 도시, 안개와 무법자들",
    intro: "intro", boss: "jorm", bossDone: "kingdomDone",
    width: 2100, height: 1150, groundTint: 0x6a7d9c, groundTex: "tile_ash", pathTex: "tile_blood", bg: "#0a0e16",
    flowers: 0, trees: 0, rocks: 12,
    /* 기획서 1200~: 지하선로 필수 이동, 안전구역 밖은 브로커·갱, 세비지 플레이스, 드론·전투로봇 */
    enemies: [{ key: "minion", count: 4 }, { key: "x3_chort", count: 4 }, { key: "x2_rat", count: 3 }, { key: "x3_ogre", count: 3 }, { key: "runegolem", count: 3 }, { key: "x3_necromancer", count: 2 }],
    main: "minion",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "dr1", type: "hunt", title: "안개 속의 드론", desc: "지하선로를 순찰하는 기계 드론 20기를 격추해라.", need: 20, targetKey: "minion", targetLabel: "기계 드론", reward: Math.round(12000 * G), expReward: 17000 } },
      { sub: 4, dialogue: "", quest: { id: "dr2", type: "collect", title: "출입칩 확보", desc: "메인 컨트롤타워에 들어가려면 직원 출입칩이 필요하다.", targetLabel: "보석의 흔적", reward: Math.round(12600 * G), expReward: 17800 } },
      { sub: 6, dialogue: "", quest: { id: "dr3", type: "hunt", title: "세비지 플레이스의 갱", desc: "무법자 구역에서 습격해 오는 갱 22명을 몰아내라.", need: 22, targetKey: "x3_chort", targetLabel: "갱 조직원", reward: Math.round(13400 * G), expReward: 18900 } },
      { sub: 8, dialogue: "", quest: { id: "dr4", type: "hunt", title: "전투로봇 제압", desc: "지하열차에서 쏟아진 전투로봇 18기를 부숴라.", need: 18, targetKey: "runegolem", targetLabel: "전투로봇", reward: Math.round(14200 * G), expReward: 20000 } },
      { sub: 9, dialogue: "", quest: { id: "dr5", type: "collect", title: "[사연] 지하전력소의 일기장", desc: "전력소 연구실에서 떨어진 일기장을 회수하라 — 리버스사이버의 진실이 적혀 있다.", targetLabel: "보석의 흔적", reward: Math.round(15000 * G), expReward: 21200 } },
      { sub: 10, dialogue: "", quest: { id: "dr6", type: "hunt", title: "[기믹] 독가스 연구실", desc: "초록 독가스로 가득한 제조기계를 지키는 오거 16마리를 처치하라.", need: 16, targetKey: "x3_ogre", targetLabel: "제조기계 수호자", reward: Math.round(16800 * G), expReward: 23600 } },
    ],
    repeat: { need: 32, gold: Math.round(330 * G), exp: 330, title: "[반복] 안개 순찰", desc: "안개가 걷히지 않는다 — 드론을 계속 격추하자." },
    lvGate: { enter: 172, mid: 182 },
  },
  {
    key: "dlcneocity", num: 15, dlc: true,
    title: "DLC 5 — 네오시티",
    subtitle: "그랜드플래닛 · 컴퍼니가 만든 세계, 다섯 개의 부호",
    intro: "intro", boss: "nagr", bossDone: "kingdomDone",
    width: 2200, height: 1200, groundTint: 0x4f6fd8, groundTex: "tile_stone", pathTex: "tile_vault", bg: "#060a1a",
    flowers: 0, trees: 0, rocks: 10,
    /* 기획서 1326~: 다크 플래닛 컴퍼니가 만들고 통제하는 행성. 완전히 다른 세계.
     * 5부호: 힘·용기·지혜·운명·선택 (힘·생명·마법·시간·빛의 초월자를 모방) */
    enemies: [{ key: "wraith", count: 4 }, { key: "x3_necromancer", count: 4 }, { key: "helhound", count: 3 }, { key: "x2_darkhound", count: 3 }, { key: "minion", count: 3 }, { key: "x3_bigzombie", count: 3 }],
    main: "wraith",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "dn1", type: "hunt", title: "5부호의 시련 — 힘", desc: "힘의 부호를 지키는 유령 22체를 쓰러뜨려라.", need: 22, targetKey: "wraith", targetLabel: "힘의 수호자", reward: Math.round(17000 * G), expReward: 24000 } },
      { sub: 4, dialogue: "", quest: { id: "dn2", type: "hunt", title: "5부호의 시련 — 용기", desc: "용기의 부호를 지키는 사냥개 20마리를 베어라.", need: 20, targetKey: "x2_darkhound", targetLabel: "용기의 수호자", reward: Math.round(17800 * G), expReward: 25200 } },
      { sub: 6, dialogue: "", quest: { id: "dn3", type: "hunt", title: "5부호의 시련 — 지혜", desc: "지혜의 부호를 지키는 주술사 18명을 침묵시켜라.", need: 18, targetKey: "x3_necromancer", targetLabel: "지혜의 수호자", reward: Math.round(18800 * G), expReward: 26500 } },
      { sub: 8, dialogue: "", quest: { id: "dn4", type: "hunt", title: "5부호의 시련 — 운명", desc: "운명의 부호를 지키는 심해 사냥개 20마리를 정화하라.", need: 20, targetKey: "helhound", targetLabel: "운명의 수호자", reward: Math.round(19800 * G), expReward: 28000 } },
      { sub: 9, dialogue: "", quest: { id: "dn5", type: "collect", title: "[사연] 컴퍼니의 홀로그램 지도", desc: "지도에 없던 행성 — 컴퍼니가 만든 세계의 증거를 확보하라.", targetLabel: "보석의 흔적", reward: Math.round(20800 * G), expReward: 29500 } },
      { sub: 10, dialogue: "", quest: { id: "dn6", type: "hunt", title: "[기믹] 5부호의 시련 — 선택", desc: "선택의 부호를 지키는 대좀비 16마리 — 마지막 시련이다.", need: 16, targetKey: "x3_bigzombie", targetLabel: "선택의 수호자", reward: Math.round(23400 * G), expReward: 33000 } },
    ],
    repeat: { need: 34, gold: Math.round(390 * G), exp: 390, title: "[반복] 네오시티 침투", desc: "컴퍼니의 감시가 끊이지 않는다 — 수호자를 계속 처치하자." },
    lvGate: { enter: 188, mid: 198 },
  },
  {
    key: "dlcmech", num: 16, dlc: true,
    title: "DLC 6 — 기계무덤 메카닉 블러드시티",
    subtitle: "그랜드플래닛 · 기계가 죽어 묻힌 도시",
    intro: "intro", boss: "abysslord", bossDone: "kingdomDone",
    width: 2150, height: 1180, groundTint: 0x8a7a6a, groundTex: "tile_blood", pathTex: "tile_morgue", bg: "#14100a",
    flowers: 0, trees: 0, rocks: 16,
    enemies: [{ key: "golem", count: 4 }, { key: "runegolem", count: 4 }, { key: "x2_stonegolem", count: 3 }, { key: "x3_ogre", count: 3 }, { key: "minion", count: 3 }, { key: "x3_wogol", count: 2 }],
    main: "golem",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "dm1", type: "hunt", title: "무덤의 골렘", desc: "기계무덤을 배회하는 골렘 20기를 부숴라.", need: 20, targetKey: "golem", targetLabel: "무덤 골렘", reward: Math.round(24000 * G), expReward: 34000 } },
      { sub: 4, dialogue: "", quest: { id: "dm2", type: "collect", title: "기계의 심장", desc: "죽은 기계에서 아직 뛰는 심장을 회수하라.", targetLabel: "보석의 흔적", reward: Math.round(25000 * G), expReward: 35500 } },
      { sub: 6, dialogue: "", quest: { id: "dm3", type: "hunt", title: "룬 골렘의 행렬", desc: "룬이 새겨진 골렘 22기를 멈춰라.", need: 22, targetKey: "runegolem", targetLabel: "룬 골렘", reward: Math.round(26400 * G), expReward: 37300 } },
      { sub: 8, dialogue: "", quest: { id: "dm4", type: "hunt", title: "돌로 굳은 수호자", desc: "석화된 수호자 18기를 정면으로 부숴라.", need: 18, targetKey: "x2_stonegolem", targetLabel: "석화 수호자", reward: Math.round(27800 * G), expReward: 39200 } },
      { sub: 9, dialogue: "", quest: { id: "dm5", type: "collect", title: "[사연] 블러드시티의 마지막 기록", desc: "도시가 스스로를 묻은 이유를 기록에서 찾아라.", targetLabel: "보석의 흔적", reward: Math.round(29200 * G), expReward: 41200 } },
      { sub: 10, dialogue: "", quest: { id: "dm6", type: "hunt", title: "[기믹] 무덤을 지키는 거인", desc: "워골 16마리가 무덤의 문을 지킨다 — 길을 열어라.", need: 16, targetKey: "x3_wogol", targetLabel: "무덤 거인", reward: Math.round(32800 * G), expReward: 46000 } },
    ],
    repeat: { need: 36, gold: Math.round(450 * G), exp: 450, title: "[반복] 기계무덤 청소", desc: "죽은 기계가 다시 일어난다 — 계속 부수자." },
    lvGate: { enter: 205, mid: 215 },
  },
  {
    key: "dlcswallow", num: 17, dlc: true,
    title: "DLC 7 — 대공전함 다크스왈로해브니스",
    subtitle: "그랜드플래닛 · 하늘을 삼키는 전함",
    intro: "intro", boss: "fenrir", bossDone: "kingdomDone",
    width: 2200, height: 1150, groundTint: 0x5a4a6a, groundTex: "tile_deep", pathTex: "tile_hel", bg: "#0e0814",
    flowers: 0, trees: 0, rocks: 8,
    enemies: [{ key: "x2_bat", count: 4 }, { key: "minion", count: 4 }, { key: "x2_firebird", count: 3 }, { key: "x3_imp", count: 3 }, { key: "wraith", count: 3 }, { key: "x3_orcwarrior", count: 3 }],
    main: "x2_bat",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "dw1", type: "hunt", title: "전함의 갑판", desc: "하늘을 나는 박쥐 떼 22마리를 쓸어내라.", need: 22, targetKey: "x2_bat", targetLabel: "전함 박쥐", reward: Math.round(34000 * G), expReward: 48000 } },
      { sub: 4, dialogue: "", quest: { id: "dw2", type: "collect", title: "전함의 항법석", desc: "다크스왈로해브니스의 항법석을 확보하라.", targetLabel: "보석의 흔적", reward: Math.round(35500 * G), expReward: 50000 } },
      { sub: 6, dialogue: "", quest: { id: "dw3", type: "hunt", title: "포격 중인 임프", desc: "대포를 다루는 임프 20마리를 제압하라.", need: 20, targetKey: "x3_imp", targetLabel: "포격 임프", reward: Math.round(37200 * G), expReward: 52400 } },
      { sub: 8, dialogue: "", quest: { id: "dw4", type: "hunt", title: "전함의 수호병", desc: "오르크 전사 20명이 갑판을 지킨다.", need: 20, targetKey: "x3_orcwarrior", targetLabel: "전함 수호병", reward: Math.round(39000 * G), expReward: 55000 } },
      { sub: 9, dialogue: "", quest: { id: "dw5", type: "collect", title: "[사연] 함교의 일지", desc: "함교에서 전함이 삼킨 것들의 기록을 찾아라.", targetLabel: "보석의 흔적", reward: Math.round(40800 * G), expReward: 57600 } },
      { sub: 10, dialogue: "", quest: { id: "dw6", type: "hunt", title: "[기믹] 하늘을 삼키는 자", desc: "전함의 핵을 지키는 불새 16마리를 처치하라.", need: 16, targetKey: "x2_firebird", targetLabel: "전함의 불새", reward: Math.round(46000 * G), expReward: 64000 } },
    ],
    repeat: { need: 38, gold: Math.round(520 * G), exp: 520, title: "[반복] 갑판 정찰", desc: "전함은 멈추지 않는다 — 갑판을 계속 지켜라." },
    lvGate: { enter: 222, mid: 232 },
  },
  {
    key: "dlcopinicia", num: 18, dlc: true,
    title: "DLC 8 — 오피니시아",
    subtitle: "그랜드플래닛 · 순력과 혼력의 대립점, 5대 가문의 도시",
    intro: "intro", boss: "skoll", bossDone: "kingdomDone",
    width: 2200, height: 1200, groundTint: 0xc0a060, groundTex: "tile_amber", pathTex: "tile_desert", bg: "#141008",
    flowers: 6, trees: 5, rocks: 10,
    /* 기획서 1033~ 요약: 5대 가문(카르리온·아리아노·엘리자베스·오르페우스·셀리나).
     *  몰락한 카르리온과 자칭 오르페우스(페우스)의 계략. 왕 시니프의 실험(혼혈 웨폰마스터).
     *  마스터학원에 잠입해 웨폰마스터 능력을 복제하는 자를 추적한다. */
    enemies: [{ key: "x3_necromancer", count: 4 }, { key: "x3_orcshaman", count: 4 }, { key: "runegolem", count: 3 }, { key: "x3_maskedorc", count: 3 }, { key: "wraith", count: 3 }, { key: "x3_bigzombie", count: 3 }],
    main: "x3_necromancer",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "di1", type: "hunt", title: "몰락 가문의 사주", desc: "일행을 노리는 자객 주술사 20명을 처치하라.", need: 20, targetKey: "x3_necromancer", targetLabel: "자객 주술사", reward: Math.round(48000 * G), expReward: 67000 } },
      { sub: 4, dialogue: "", quest: { id: "di2", type: "collect", title: "궁전 연구실의 기록", desc: "시니프의 실험 기록을 회수하라 — 혼혈 웨폰마스터의 흔적.", targetLabel: "보석의 흔적", reward: Math.round(50000 * G), expReward: 70000 } },
      { sub: 6, dialogue: "", quest: { id: "di3", type: "hunt", title: "마스터학원의 경비", desc: "학원에 잠입한 뒤 경비 주술사 18명을 조용히 처리하라.", need: 18, targetKey: "x3_orcshaman", targetLabel: "학원 경비", reward: Math.round(52500 * G), expReward: 73400 } },
      { sub: 8, dialogue: "", quest: { id: "di4", type: "hunt", title: "페우스의 부하들", desc: "자칭 오르페우스(페우스)가 보낸 가면 오크 22명을 베어라.", need: 22, targetKey: "x3_maskedorc", targetLabel: "페우스의 부하", reward: Math.round(55000 * G), expReward: 77000 } },
      { sub: 9, dialogue: "", quest: { id: "di5", type: "collect", title: "[사연] 엘리자베스의 편지", desc: "5대 가문 엘리자베스가 남긴 편지를 찾아라.", targetLabel: "보석의 흔적", reward: Math.round(57500 * G), expReward: 80600 } },
      { sub: 10, dialogue: "", quest: { id: "di6", type: "hunt", title: "[기믹] 순혈과 혼혈의 대립", desc: "혼혈 실험체 대좀비 16마리를 정화하라.", need: 16, targetKey: "x3_bigzombie", targetLabel: "혼혈 실험체", reward: Math.round(65000 * G), expReward: 89500 } },
    ],
    repeat: { need: 40, gold: Math.round(600 * G), exp: 600, title: "[반복] 가문 소요 진압", desc: "가문들의 암투가 계속된다 — 자객을 계속 막아라." },
    lvGate: { enter: 240, mid: 250 },
  },
  {
    key: "dlcnovel", num: 19, dlc: true,
    title: "DLC 9 — 비밀의 화원 노벨 플로스",
    subtitle: "그랜드플래닛 · 아무도 모르는 정원",
    intro: "intro", boss: "gram", bossDone: "kingdomDone",
    width: 2100, height: 1150, groundTint: 0xa8e0a0, groundTex: "tile_moss", pathTex: "tile_garden", bg: "#0a1408",
    flowers: 14, trees: 12, rocks: 6,
    enemies: [{ key: "x3_swampy", count: 4 }, { key: "x2_frog", count: 4 }, { key: "x3_goblin", count: 3 }, { key: "spider", count: 3 }, { key: "x2_snail", count: 3 }, { key: "x3_chort", count: 3 }],
    main: "x3_swampy",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "dno1", type: "hunt", title: "화원의 수호 식물", desc: "정원을 지키는 늪괴물 22마리를 베어내라.", need: 22, targetKey: "x3_swampy", targetLabel: "수호 식물", reward: Math.round(68000 * G), expReward: 94000 } },
      { sub: 4, dialogue: "", quest: { id: "dno2", type: "collect", title: "비밀의 씨앗", desc: "이 화원에만 피는 꽃의 씨앗을 찾아라.", targetLabel: "보석의 흔적", reward: Math.round(71000 * G), expReward: 98000 } },
      { sub: 6, dialogue: "", quest: { id: "dno3", type: "hunt", title: "개구리 떼", desc: "연못을 점령한 개구리 20마리를 쫓아내라.", need: 20, targetKey: "x2_frog", targetLabel: "연못 개구리", reward: Math.round(74500 * G), expReward: 102800 } },
      { sub: 8, dialogue: "", quest: { id: "dno4", type: "hunt", title: "고블린 원예사", desc: "화원을 망치는 고블린 20마리를 처치하라.", need: 20, targetKey: "x3_goblin", targetLabel: "고블린 원예사", reward: Math.round(78000 * G), expReward: 107800 } },
      { sub: 9, dialogue: "", quest: { id: "dno5", type: "collect", title: "[사연] 정원사의 마지막 편지", desc: "아무도 모르는 정원을 가꾼 자의 편지를 찾아라.", targetLabel: "보석의 흔적", reward: Math.round(81500 * G), expReward: 112800 } },
      { sub: 10, dialogue: "", quest: { id: "dno6", type: "hunt", title: "[기믹] 화원의 주인", desc: "화원의 심장을 지키는 거대 달팽이 16마리를 물리쳐라.", need: 16, targetKey: "x2_snail", targetLabel: "화원의 주인", reward: Math.round(92000 * G), expReward: 125000 } },
    ],
    repeat: { need: 42, gold: Math.round(680 * G), exp: 680, title: "[반복] 화원 가꾸기", desc: "정원이 다시 자란다 — 수호 식물을 계속 베자." },
    lvGate: { enter: 258, mid: 268 },
  },
  {
    key: "dlcsernium", num: 20, dlc: true,
    title: "DLC 10 — 신의도시 세르니움",
    subtitle: "그랜드플래닛 · 마지막 행성, 고향이자 종착점",
    intro: "intro", boss: "abudditos", bossDone: "kingdomDone",
    width: 2300, height: 1250, groundTint: 0xd8c890, groundTex: "tile_vault", pathTex: "tile_amber", bg: "#1a1408",
    flowers: 8, trees: 6, rocks: 8,
    /* 기획서 1048~ 요약: 도착 — 리안 왕자 편 장로들은 환영, 황실은 냉담.
     *  아버지 왕이 병사하고 섭정이 왕좌를 찬탈. 제3의 세력(생명의 초월자)이 침공 예고.
     *  검의 성전 — 태양과 달의 두 검이 하나로 모일 때(솔루나 이클립스 페이티니소드) 진정한 힘.
     *  제르(생명의 초월자)가 왕을 흡수, 스칼렛이 각성해 막고, 도사가 6단계 힘을 소진. */
    enemies: [{ key: "wraith", count: 4 }, { key: "helhound", count: 4 }, { key: "x3_bigzombie", count: 3 }, { key: "x3_necromancer", count: 3 }, { key: "x2_darkhound", count: 3 }, { key: "minion", count: 3 }],
    main: "wraith",
    beats: [
      { sub: 2, dialogue: "", quest: { id: "dse1", type: "hunt", title: "냉담한 황실", desc: "찬탈자에게 붙은 근위병 24명을 제압하라.", need: 24, targetKey: "wraith", targetLabel: "찬탈자 근위병", reward: Math.round(96000 * G), expReward: 132000 } },
      { sub: 4, dialogue: "", quest: { id: "dse2", type: "collect", title: "검의 성전 — 두 개의 검", desc: "태양과 달의 검이 꽂힌 검의 성전을 찾아라.", targetLabel: "보석의 흔적", reward: Math.round(100000 * G), expReward: 138000 } },
      { sub: 6, dialogue: "", quest: { id: "dse3", type: "hunt", title: "제3의 세력", desc: "생명의 초월자가 보낸 침공군 22명을 막아라.", need: 22, targetKey: "x3_bigzombie", targetLabel: "침공군", reward: Math.round(105000 * G), expReward: 145000 } },
      { sub: 8, dialogue: "", quest: { id: "dse4", type: "hunt", title: "폭주한 왕", desc: "주술의 힘에 삼켜진 자의 그림자 20체를 베어라.", need: 20, targetKey: "x3_necromancer", targetLabel: "폭주한 그림자", reward: Math.round(110000 * G), expReward: 152000 } },
      { sub: 9, dialogue: "", quest: { id: "dse5", type: "collect", title: "[사연] 코스믹스타의 힘", desc: "진정한 왕가의 힘 — 코스믹스타의 파편을 회수하라.", targetLabel: "보석의 흔적", reward: Math.round(115000 * G), expReward: 159000 } },
      { sub: 10, dialogue: "", quest: { id: "dse6", type: "hunt", title: "[기믹] 생명의 초월자", desc: "제르가 남긴 생명의 잔재 18체를 정화하라 — 라일락 월드로 돌아가는 길.", need: 18, targetKey: "x2_darkhound", targetLabel: "생명의 잔재", reward: Math.round(130000 * G), expReward: 178000 } },
    ],
    repeat: { need: 45, gold: Math.round(760 * G), exp: 760, title: "[반복] 세르니움 수복", desc: "도시가 다시 숨을 쉰다 — 남은 그림자를 계속 정화하자." },
    lvGate: { enter: 276, mid: 286 },
  },
];

/* ================= 몬스터 정의 (v1.5 데이터 이관) ================= */

/* v1.2.2 — 적 EXP 재배분 (밸런스)
 *  문제: HP/EXP 비율이 1.55~3.33(2.15배)으로 벌어져 있었다. 같은 시간 사냥해도
 *        어떤 적은 효율이 2배 좋고 어떤 적은 나빴다 → 유저가 한 사냥터에만 붙는다.
 *  조치: 비율을 중앙값 1.85로 수렴시키되, **EXP 총합(2832)을 그대로 보존**했다.
 *        총합을 늘리면 전체 레벨업 곡선이 빨라져 다른 밸런스가 무너진다.
 *  결과: 비율 편차 2.15배 → 1.04배.
 *  생성: tools/rebalance-exp.py (재현 가능) */
export const ENEMIES: Record<EnemyKey, EnemyDef> = {
  wolf: { key: "wolf", name: "인피니트보석 늑대", hp: 58, atk: 13, speed: 132, aggro: 300, exp: 30, gold: [5, 8], def: 2, defPct: 0.02, dropHp: 0.3, dropMp: 0.2, profile: { charge: { cd: 3600, speed: 430, time: 420 } } },
  minion: { key: "minion", name: "심연 하수인", hp: 78, atk: 18, speed: 108, aggro: 320, exp: 41, gold: [9, 13], def: 3, defPct: 0.03, dropHp: 0.32, dropMp: 0.24, profile: { apply: { kind: "bleed", chance: 0.4, dps: 4, dur: 3500 } } },
  spider: { key: "spider", name: "동굴 거미", hp: 88, atk: 19, speed: 122, aggro: 320, exp: 46, gold: [10, 14], def: 3, defPct: 0.03, dropHp: 0.3, dropMp: 0.22, profile: { apply: { kind: "poison", chance: 0.45, dps: 5, dur: 4500 }, fieldOnDeath: { kind: "poison", dps: 5, dur: 3500, radius: 80 } } },
  golem: { key: "golem", name: "수정 골렘", hp: 148, atk: 24, speed: 78, aggro: 260, exp: 77, gold: [14, 21], def: 18, defPct: 0.1, dropHp: 0.34, dropMp: 0.26, profile: { charge: { cd: 5200, speed: 330, time: 620 } } },
  frostwolf: { key: "frostwolf", name: "서리 늑대", hp: 112, atk: 25, speed: 146, aggro: 340, exp: 59, gold: [12, 18], def: 3, defPct: 0.03, dropHp: 0.3, dropMp: 0.22, profile: { charge: { cd: 3400, speed: 450, time: 400 }, apply: { kind: "slow", chance: 0.4, dps: 0, dur: 2200 } } },
  icegolem: { key: "icegolem", name: "얼음 골렘", hp: 170, atk: 29, speed: 74, aggro: 260, exp: 89, gold: [17, 23], def: 22, defPct: 0.11, dropHp: 0.34, dropMp: 0.26, profile: { ranged: { projAnim: "fx-icelance", projSpeed: 300, range: 250, cd: 2500 } } },
  wraith: { key: "wraith", name: "심연 유령", hp: 130, atk: 28, speed: 100, aggro: 340, exp: 68, gold: [15, 22], def: 4, defPct: 0.05, dropHp: 0.32, dropMp: 0.26, profile: { ranged: { projAnim: "fx-darkbolt", projSpeed: 290, range: 270, cd: 2300 } } },
  swampbeast: { key: "swampbeast", name: "능대", hp: 95, atk: 20, speed: 96, aggro: 300, exp: 49, gold: [10, 15], def: 4, defPct: 0.04, dropHp: 0.3, dropMp: 0.22, profile: { apply: { kind: "poison", chance: 0.5, dps: 5, dur: 5000 } } },
  emberwolf: { key: "emberwolf", name: "불꽃 늑대", hp: 150, atk: 31, speed: 150, aggro: 340, exp: 78, gold: [14, 21], def: 4, defPct: 0.03, dropHp: 0.3, dropMp: 0.22, profile: { charge: { cd: 3300, speed: 470, time: 400 }, fieldOnDeath: { kind: "fire", dps: 7, dur: 3500, radius: 85 } } },
  firespirit: { key: "firespirit", name: "화염 정령", hp: 175, atk: 34, speed: 92, aggro: 300, exp: 92, gold: [17, 24], def: 6, defPct: 0.05, dropHp: 0.34, dropMp: 0.26, profile: { ranged: { projAnim: "fx-fireball", projSpeed: 330, range: 280, cd: 2100 } } },
  runegolem: { key: "runegolem", name: "룬 골렘", hp: 210, atk: 37, speed: 72, aggro: 260, exp: 110, gold: [19, 28], def: 26, defPct: 0.12, dropHp: 0.34, dropMp: 0.26, profile: { ranged: { projAnim: "fx-magicorb", projSpeed: 280, range: 260, cd: 2600 }, apply: { kind: "slow", chance: 0.35, dps: 0, dur: 2000 } } },
  helhound: { key: "helhound", name: "헬 하운드", hp: 190, atk: 36, speed: 148, aggro: 360, exp: 100, gold: [18, 25], def: 5, defPct: 0.04, dropHp: 0.32, dropMp: 0.26, profile: { charge: { cd: 3000, speed: 480, time: 380 }, apply: { kind: "bleed", chance: 0.45, dps: 6, dur: 4000 } } },
  /* v3.0.2 — 신규 종 9종 (챕터 배율은 stageScale이 곱함) */
  x2_frog: { key: "x2_frog", name: "독개구리", hp: 52, atk: 12, speed: 116, aggro: 300, exp: 27, gold: [5, 9], def: 1, defPct: 0.01, dropHp: 0.3, dropMp: 0.22, profile: { apply: { kind: "poison", chance: 0.4, dps: 4, dur: 4000 }, fieldOnDeath: { kind: "poison", dps: 4, dur: 3000, radius: 70 } } },
  x2_rat: { key: "x2_rat", name: "궁전 뒷쥐", hp: 84, atk: 17, speed: 156, aggro: 320, exp: 43, gold: [9, 14], def: 2, defPct: 0.02, dropHp: 0.3, dropMp: 0.22, profile: { apply: { kind: "bleed", chance: 0.35, dps: 3, dur: 3000 } } },
  x2_bat: { key: "x2_bat", name: "황혼 박쥐", hp: 126, atk: 27, speed: 164, aggro: 360, exp: 66, gold: [14, 21], def: 2, defPct: 0.02, dropHp: 0.3, dropMp: 0.24, profile: { charge: { cd: 3200, speed: 500, time: 360 } } },
  x2_firebird: { key: "x2_firebird", name: "잿불 새", hp: 158, atk: 33, speed: 142, aggro: 340, exp: 82, gold: [15, 23], def: 5, defPct: 0.04, dropHp: 0.32, dropMp: 0.26, profile: { ranged: { projAnim: "fx-fireball", projSpeed: 340, range: 270, cd: 2200 }, fieldOnDeath: { kind: "fire", dps: 6, dur: 3000, radius: 80 } } },
  x2_frostfly: { key: "x2_frostfly", name: "서리 날도요", hp: 118, atk: 26, speed: 158, aggro: 340, exp: 62, gold: [12, 19], def: 2, defPct: 0.02, dropHp: 0.3, dropMp: 0.24, profile: { ranged: { projAnim: "fx-icelance", projSpeed: 320, range: 240, cd: 2400 }, apply: { kind: "slow", chance: 0.3, dps: 0, dur: 1800 } } },
  x2_snail: { key: "x2_snail", name: "동굴 달팽이", hp: 200, atk: 22, speed: 58, aggro: 240, exp: 104, gold: [11, 17], def: 14, defPct: 0.09, dropHp: 0.36, dropMp: 0.28, profile: { apply: { kind: "slow", chance: 0.55, dps: 0, dur: 2600 } } },
  x2_stonegolem: { key: "x2_stonegolem", name: "장벽 돌골렘", hp: 235, atk: 39, speed: 66, aggro: 260, exp: 123, gold: [20, 30], def: 30, defPct: 0.13, dropHp: 0.34, dropMp: 0.26, profile: { charge: { cd: 5400, speed: 320, time: 640 } } },
  x2_darkhound: { key: "x2_darkhound", name: "그늘 이리", hp: 205, atk: 38, speed: 154, aggro: 360, exp: 107, gold: [18, 27], def: 5, defPct: 0.04, dropHp: 0.32, dropMp: 0.24, profile: { apply: { kind: "bleed", chance: 0.35, dps: 4, dur: 4000 } } },
  x2_reeffish: { key: "x2_reeffish", name: "심연 암초물고기", hp: 182, atk: 40, speed: 128, aggro: 340, exp: 95, gold: [17, 26], def: 8, defPct: 0.05, dropHp: 0.32, dropMp: 0.26, profile: { ranged: { projAnim: "fx-icelance", projSpeed: 340, range: 240, cd: 2200 } } },
  /* v3.0.3 — 0x72 DungeonTileset II (itch.io, CC0) 신규 종 7종: 고유 개성 내장 */
  x3_swampy: { key: "x3_swampy", name: "늪지 독괴물", hp: 96, atk: 15, speed: 86, aggro: 280, exp: 50, gold: [8, 12], def: 3, defPct: 0.03, dropHp: 0.32, dropMp: 0.24, profile: { apply: { kind: "poison", chance: 0.5, dps: 5, dur: 5000 }, fieldOnDeath: { kind: "poison", dps: 6, dur: 4000, radius: 90 } } },
  x3_imp: { key: "x3_imp", name: "잉걸불 임프", hp: 118, atk: 20, speed: 98, aggro: 340, exp: 62, gold: [11, 16], def: 6, defPct: 0.05, dropHp: 0.3, dropMp: 0.24, profile: { ranged: { projAnim: "fx-fireball", projSpeed: 320, range: 260, cd: 2000 } } },
  x3_icezombie: { key: "x3_icezombie", name: "얼어붙은 좀비", hp: 152, atk: 25, speed: 92, aggro: 300, exp: 79, gold: [13, 19], def: 8, defPct: 0.06, dropHp: 0.3, dropMp: 0.24, profile: { apply: { kind: "slow", chance: 0.45, dps: 0, dur: 2500 } } },
  x3_tinyzombie: { key: "x3_tinyzombie", name: "굶주린 좀비", hp: 160, atk: 29, speed: 168, aggro: 380, exp: 84, gold: [14, 22], def: 8, defPct: 0.06, dropHp: 0.3, dropMp: 0.22, profile: { apply: { kind: "bleed", chance: 0.5, dps: 6, dur: 4000 } } },
  x3_ogre: { key: "x3_ogre", name: "광포한 오거", hp: 265, atk: 43, speed: 74, aggro: 280, exp: 138, gold: [20, 30], def: 24, defPct: 0.11, dropHp: 0.38, dropMp: 0.28, scale: 1.15, profile: { charge: { cd: 5000, speed: 360, time: 600 } } },
  x3_chort: { key: "x3_chort", name: "악마다라 촐트", hp: 228, atk: 40, speed: 118, aggro: 380, exp: 119, gold: [19, 28], def: 10, defPct: 0.07, dropHp: 0.32, dropMp: 0.26, profile: { charge: { cd: 4200, speed: 420, time: 520 } } },
  x3_necromancer: { key: "x3_necromancer", name: "강령술사", hp: 212, atk: 42, speed: 80, aggro: 380, exp: 111, gold: [20, 29], def: 7, defPct: 0.06, dropHp: 0.32, dropMp: 0.28, profile: { ranged: { projAnim: "fx-darkbolt", projSpeed: 300, range: 290, cd: 2400 } } },
  /* v3.0.4 — itch.io 0x72 팩 추가 6종: 각자 고유 개성 (출혈/돌진/원거리/군집/중장) */
  x3_maskedorc: { key: "x3_maskedorc", name: "가면 전사", hp: 205, atk: 38, speed: 124, aggro: 340, exp: 107, gold: [17, 26], def: 10, defPct: 0.07, dropHp: 0.32, dropMp: 0.24, profile: { apply: { kind: "bleed", chance: 0.5, dps: 7, dur: 4000 } } },
  x3_orcwarrior: { key: "x3_orcwarrior", name: "오르크 전사", hp: 245, atk: 44, speed: 104, aggro: 360, exp: 129, gold: [20, 30], def: 12, defPct: 0.08, dropHp: 0.34, dropMp: 0.26, profile: { charge: { cd: 4600, speed: 400, time: 480 } } },
  x3_orcshaman: { key: "x3_orcshaman", name: "오르크 주술사", hp: 188, atk: 36, speed: 86, aggro: 380, exp: 99, gold: [19, 27], dropHp: 0.32, dropMp: 0.28, profile: { ranged: { projAnim: "fx-magicorb", projSpeed: 310, range: 280, cd: 2300 } } },
  x3_wogol: { key: "x3_wogol", name: "지옥견 워골", hp: 198, atk: 41, speed: 152, aggro: 400, exp: 103, gold: [19, 28], dropHp: 0.3, dropMp: 0.24, profile: { charge: { cd: 3800, speed: 460, time: 460 }, apply: { kind: "bleed", chance: 0.4, dps: 6, dur: 3500 } } },
  x3_goblin: { key: "x3_goblin", name: "고블린 약탈자", hp: 66, atk: 14, speed: 172, aggro: 360, exp: 35, gold: [6, 10], dropHp: 0.28, dropMp: 0.2, profile: { apply: { kind: "bleed", chance: 0.3, dps: 3, dur: 2500 } } },
  x3_bigzombie: { key: "x3_bigzombie", name: "거대 시체", hp: 320, atk: 47, speed: 62, aggro: 280, exp: 168, gold: [22, 33], dropHp: 0.4, dropMp: 0.3, scale: 1.2, profile: { apply: { kind: "poison", chance: 0.45, dps: 7, dur: 5000 }, fieldOnDeath: { kind: "poison", dps: 8, dur: 4000, radius: 100 } } },
};

/* ================= 보스 정의 (v1.5 데이터 이관 + 챕터 보강) ================= */

export const BOSS_DEFS: Record<BossKey, BossDef> = {
  guardian: {
    key: "guardian", name: "심연의 수호자",
    hp: 3200, atk: 24, speed: 92, exp: 320, gold: 220,
    tex: "boss", orbTint: 0x9d7aff, introDialogue: "bossIntroGuardian",
    /* v1.4.12 (#20 보스 정체성) — 시그니처 slam · 성향 1.05 */
    sig: "slam",
    aggr: 1.05,
    /* 수호자 = 지진 — 마지막 페이즈에서 연속 낙뢰(심연 지진) 개방 + vc144 심연 결정 산개 */
    patterns: {
      p1: ["slam", "charge", "volley"],
      p2: ["slam", "charge", "volley", "ring", "zones", "crystalburst"],
      p3: ["slam", "charge", "volley", "ring", "zones", "quake", "crystalburst"],
    },
  },
  behemoth: {
    key: "behemoth", name: "침몰의 선장",
    /* vc204 — 챕터3 '쿠소디아 — 선박의 왕국 · 늪지대'.
     *  스프라이트(tex: boss2 = atl_boss2)는 원본 아트 주석부터 "미드가르드 해적선"이라
     *  배 그림이 맞다. 종전 이름 '눈보라의 거수'가 테마(선박의 왕국)와 어긋나
     *  "챕터 테마에 맞는 보스가 아님"으로 보였다. 이름만 테마에 맞춘다(능력/수치는 불변). */
    hp: 5200, atk: 31, speed: 84, exp: 500, gold: 300,
    tex: "boss2", orbTint: 0x8ad4ff, introDialogue: "bossIntroBehemoth",
    /* v1.4.12 (#20 보스 정체성) — 시그니처 spiral · 성향 0.95 */
    sig: "spiral",
    aggr: 0.95,
    /* 눈보라의 화신 — vc142: 빙결 신성(frostnova) 추가 — 눈보라 정체성 강화 */
    patterns: {
      p1: ["slam", "volley", "zones"],
      p2: ["slam", "charge", "volley", "zones", "spiral", "frostnova"],
      p3: ["slam", "charge", "volley", "zones", "ring", "spiral", "quake", "frostnova"],
    },
  },
  abysslord: {
    key: "abysslord", name: "심연의 군주",
    hp: 8500, atk: 38, speed: 98, exp: 800, gold: 420,
    tex: "boss3", orbTint: 0xff5a7a, introDialogue: "bossIntroLord",
    /* vc153 — 스바르트알프헤임 보스 개편: 시그니처 greenslash · 성향 1.05 */
    sig: "greenslash",
    aggr: 1.05,
    /* vc153 애니 사양표 매핑 — ①Idle(Loop) ②Move(Loop) ③GreenSlash(Once) ④Vanish(Once)
     *  ⑤ShieldCast(Once→상태유지) ⑥MagicBurst(Once) ⑦PortalTeleport(Once).
     *  6행 시트(atl_boss3: idle/walk/atk/sp1/sp2/die)에서 atk=GreenSlash · sp1=Vanish · sp2=ShieldCast 행을 재생 */
    patterns: {
      p1: ["volley", "greenslash", "charge", "slam"],
      p2: ["volley", "charge", "ring", "greenslash", "vanish", "shieldcast", "crystalburst"],
      p3: ["volley", "charge", "ring", "zones", "summon", "magicburst", "vanish", "shieldcast", "portalteleport", "crystalburst"],
    },
    summonKey: "wraith",
  },
  nidhog: {
    key: "nidhog", name: "탐식의 드래곤 니드호그",
    hp: 3600, atk: 26, speed: 90, exp: 380, gold: 260,
    tex: "boss_nidhog", orbTint: 0x7dff9a, introDialogue: "bossIntroNidhog",
    /* v1.4.12 (#20 보스 정체성) — vc142: 시그니처 beam → 맹독 장판으로 교체 (탐식 독 드래곤) */
    sig: "poisonfield",
    aggr: 0.95,
    patterns: {
      p1: ["slam", "charge", "volley"],
      p2: ["slam", "charge", "volley", "ring", "beam", "poisonfield"],
      p3: ["slam", "charge", "volley", "ring", "zones", "beam", "summon", "poisonfield"],
    },
    summonKey: "swampbeast",
  },
  surt: {
    key: "surt", name: "화염의 거인 수르트",
    hp: 5400, atk: 33, speed: 88, exp: 560, gold: 340,
    tex: "boss_surt", orbTint: 0xffa05a, introDialogue: "bossIntroSurt",
    /* v1.4.12 (#20 보스 정체성) — vc142: 시그니처 zones → 추적 화염기둥으로 교체 (화염의 거인) */
    sig: "firepillars",
    aggr: 0.9,
    patterns: {
      p1: ["slam", "volley", "zones", "firepillars"],
      p2: ["slam", "charge", "volley", "zones", "beam", "firepillars"],
      p3: ["slam", "charge", "volley", "zones", "ring", "beam", "quake", "firepillars"],
    },
  },
  fenrir: {
    key: "fenrir", name: "탐욕의 늑대 펜리르",
    hp: 7400, atk: 36, speed: 96, exp: 640, gold: 380,
    tex: "boss_fenrir", orbTint: 0xc08aff, introDialogue: "bossIntroFenrir",
    /* v1.4.12 (#20 보스 정체성) — 시그니처 charge · 성향 0.85 */
    sig: "charge",
    aggr: 0.85,
    /* 사슬이 묶인 늑대 — 2연속 돌진 + 그림자 급습(순간이동 강타) */
    chargeChain: 2,
    patterns: {
      p1: ["charge", "volley", "ring"],
      p2: ["slam", "charge", "volley", "zones", "blink"],
      p3: ["slam", "charge", "volley", "zones", "ring", "blink", "frostnova"],
    },
  },
  skoll: {
    key: "skoll", name: "교만의 쌍랑 스콜&하티", /* vc142 보스 디자인 교체 — 유저 제공 쌍랑 아틀라스(얼음 늑대 스콜+화염 늑대 하티) 반영 (구 표기: 교만의 얼음 봉황) */
    /* vc143 (#2 후반 보스 대폭 상향) — 8장 스콜 HP 8600→12000 · ATK 39→42 */
    hp: 12000, atk: 42, speed: 100, exp: 720, gold: 420,
    tex: "boss_skoll", orbTint: 0xffd97a, introDialogue: "bossIntroSkoll",
    /* v1.4.12 (#20 보스 정체성) — 시그니처 blink · 성향 0.9 */
    sig: "blink",
    aggr: 0.9,
    /* 태양과 달을 쫓던 쌍랑 — 3연속 교차 돌진(최종 페이즈 3회) + 스윕 빔 + vc144 빙결 신성 */
    chargeChain: 2,
    patterns: {
      p1: ["volley", "charge", "slam"],
      p2: ["volley", "charge", "ring", "zones", "beam", "blink", "frostnova"],
      p3: ["volley", "charge", "ring", "zones", "summon", "beam", "blink", "frostnova"],
    },
    summonKey: "runegolem",
  },
  gram: {
    key: "gram", name: "혈안의 문지기 가름", /* v4.1.3 (#신화고증) — 구 표기 "대지의 괴물 그람": 그람(Gram)은 시구르드의 검이다. 헬의 대문을 지키는 존재는 사냥개 가름(Garmr) */
    /* vc143 (#2 후반 보스 대폭 상향) — 9장 가름 HP 10600→20000 · ATK 42→48 */
    hp: 20000, atk: 48, speed: 86, exp: 860, gold: 480,
    tex: "boss_gram", orbTint: 0x8affc0, introDialogue: "bossIntroGram",
    /* v1.4.12 (#20 보스 정체성) — 시그니처 counter · 성향 1.0 */
    sig: "counter",
    aggr: 1.0,
    /* 헬의 문지기 — 반격 카운터(창을 놓치면 문이 닫힌다) + 그림자 급습 + vc142 점멸 3연 참격 */
    patterns: {
      p1: ["slam", "charge", "volley", "zones"],
      p2: ["slam", "charge", "volley", "ring", "zones", "counter", "blink", "blinkslash"],
      p3: ["slam", "charge", "volley", "ring", "zones", "summon", "counter", "blink", "quake", "blinkslash"],
    },
    summonKey: "helhound",
  },
  abudditos: {
    key: "abudditos", name: "종언의 마룡 아부디토스", /* v4.1.3 (#신화고증) — 구 표기 "니드그림"을 세계관 근원인 아부디토스로 통일 */
    /* vc143 (#2 후반 보스 대폭 상향) — 10장 아부디토스 HP 14500→34000 · ATK 46→54 */
    hp: 34000, atk: 54, speed: 100, exp: 1200, gold: 650,
    tex: "boss_abudditos", orbTint: 0xff3a6a, introDialogue: "bossIntroAbudditos",
    /* v1.4.12 (#20 보스 정체성) — 시그니처 ring · 성향 0.8 */
    sig: "ring",
    aggr: 0.8,
    /* 종언의 마룡 — 모든 시그니처 패턴의 종합 세트 + vc142 마룡 성역(holymantle) */
    chargeChain: 2,
    patterns: {
      p1: ["volley", "charge", "ring", "beam"],
      p2: ["volley", "charge", "ring", "zones", "summon", "beam", "spiral", "blink", "holymantle"],
      p3: ["slam", "charge", "volley", "ring", "zones", "summon", "beam", "spiral", "blink", "quake", "counter", "holymantle", "firepillars"],
    },
    summonKey: "helhound",
  },
  /* v1.0.19 (A-3 신규 스테이지 15종) — 재림 지역 보스 3종.
   *  기존 보스 정의는 전부 유지 — 신규 3종은 기존 텍스처(휴먼 리소스 제로)를 재활용하되
   *  이름·색조·패턴 구성을 다르게 해 별개의 적으로 기능한다. */
  vord: {
    key: "vord", name: "재림의 파수꾼 베오르드",
    /* vc143 (#2 후반 보스 대폭 상향) — 재림 r5 베오르드 HP 16800→42000 · ATK 50→58 */
    hp: 42000, atk: 58, speed: 92, exp: 1500, gold: 800,
    /* vc148 (#보스그리드) — tex boss2(유령선) 공유 → 전용 흑룡 아틀라스 (bsw_vord 8열×7행 재슬라이싱) */
    tex: "boss_vord", orbTint: 0xffb05a, introDialogue: "bossIntroAbudditos",
    /* v1.4.12 (#20 보스 정체성) — 시그니처 quake · 성향 1.0 */
    sig: "quake",
    aggr: 1.0,
    /* 대지를 지키는 파수꾼 — 연속 낙뢰(지진) + 반격 카운터 + vc142 결정 산개 */
    patterns: {
      p1: ["slam", "charge", "volley", "zones"],
      p2: ["slam", "charge", "ring", "zones", "quake", "counter", "crystalburst"],
      p3: ["slam", "charge", "volley", "ring", "zones", "summon", "quake", "counter", "crystalburst"],
    },
    summonKey: "x3_orcwarrior",
  },
  jorm: {
    key: "jorm", name: "세계수를 먹는 뱀 요르문간드",
    /* vc143 (#2 후반 보스 대폭 상향) — 재림 r10 요르문간드 HP 21500→60000 · ATK 55→64 */
    hp: 60000, atk: 64, speed: 104, exp: 1900, gold: 980,
    /* v5.0.1 — 유저 제공 시트(박쥐날개 황금뿔 드래곤)로 boss_jorm 독립 (nidhog 공유 해제) */
    tex: "boss_jorm", orbTint: 0x9affd0, introDialogue: "bossIntroAbudditos",
    /* v1.4.12 (#20 보스 정체성) — 시그니처 beam · 성향 0.9 */
    sig: "beam",
    aggr: 0.9,
    /* 세계수를 감는 뱀 — 스윕 빔 + 나선 탄막 + 2연속 돌진 + vc142 맹독 장판 */
    chargeChain: 2,
    patterns: {
      p1: ["volley", "charge", "beam"],
      p2: ["volley", "charge", "ring", "zones", "beam", "spiral", "poisonfield"],
      p3: ["slam", "charge", "volley", "ring", "zones", "summon", "beam", "spiral", "blink", "poisonfield"],
    },
    summonKey: "x2_reeffish",
  },
  nagr: {
    key: "nagr", name: "재림의 종언 나그라파르",
    /* vc143 (#2 후반 보스 대폭 상향) — 재림 r15 나그라파르 HP 30000→95000 · ATK 62→72 */
    hp: 95000, atk: 72, speed: 108, exp: 2600, gold: 1400,
    /* v1.4.31 (#4 보스 개편) — 발할라 천사기사 전용 아트 아틀라스 적용 (기존 아부디토스 재사용 해제) */
    tex: "boss_nagr", orbTint: 0xffd76a, introDialogue: "bossIntroAbudditos",
    /* v1.4.12 (#20 보스 정체성) — 시그니처 spiral · 성향 0.8 */
    sig: "spiral",
    aggr: 0.8,
    /* 종언을 먹는 존재 — 재림 지역 최종 보스, 전 패턴 종합 + 카오스급 구성 + vc142 뇌우/성역 */
    chargeChain: 2,
    patterns: {
      p1: ["volley", "charge", "ring", "spiral"],
      p2: ["slam", "charge", "volley", "ring", "zones", "summon", "beam", "spiral", "counter", "thunderfall"],
      p3: ["slam", "charge", "volley", "ring", "zones", "summon", "beam", "spiral", "blink", "quake", "counter", "thunderfall", "holymantle"],
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
/* v1.2.2 — 챕터 HP 계수 재조정 (밸런스 실측)
 *  문제: 종전 [1,1.35,2,3.2,5.2,8.5,14,24,42] + 후반 4챕터 ×10 조합에서
 *        플레이어가 적을 죽이는 데 필요한 타격 수가 **1.1타 ~ 63.6타**로 벌어졌다.
 *        2~3챕터는 스킬 1방에 즉사(1.4/1.1타), 7~10챕터는 50~64타를 때려야 죽었다.
 *  조치: 계수를 완만한 곡선으로 바꾸고 후반 배율을 10 → 4로 낮췄다.
 *  결과: 1.9 ~ 19.7타 (편차 57.8배 → 10.2배), 즉사 구간 0.
 *  계산 근거: atkTotal = 12 + 3×(lv−1), 스킬 배율 1.25~2.36 (rollDamage 참조). */
const CH_HP = [1.45, 1.9, 3.6, 4.7, 6.5, 9.5, 14.0, 20.0, 28.0, 42.0, 66.0, 105.0, 165.0, 260.0, 410.0, 650.0, 1020.0, 1600.0, 2500.0]; // vc186b — DLC 3챕터 + vc192 나머지 7행성 // 1챕터 1.45 — Lv20까지 1챕터에 머무는데 적 HP가 낮아 1.1타(즉사)였다
const CH_ATK = [1, 1.18, 1.45, 1.78, 2.2, 2.7, 3.35, 4.1, 5.0, 6.2, 7.8, 9.8, 12.5, 15.8, 20.0, 25.0, 31.0, 39.0, 49.0]; // vc186b — DLC 3챕터 + vc192 나머지 7행성 // 유저 피드백: 공격력은 현행 유지
/* v1.2.2 — 챕터 EXP 계수 재조정 (레벨 곡선 정합)
 *  문제: expTable.ts는 메이플 공식(지수 성장)인데 적 EXP 계수는 1→9.2로 거의 평평했다.
 *        레벨업에 필요한 처치 수가 **25마리 ~ 2,105,941마리**(편차 84,780배)로 벌어져
 *        130레벨 이후는 사실상 레벨업이 불가능했다(실측: Lv130 필요 12,162,719 EXP vs
 *        적 1마리 335 EXP → 36,307마리).
 *  조치: 레벨별 필요 EXP를 기준으로 역산해 계수를 지수적으로 올렸다.
 *        처치 수 목표는 35 → 807로 완만히 증가(후반일수록 몸값이 커지는 게 자연스럽다).
 *  결과: 처치 수 편차 84,780배 → 22.8배. 전 구간 레벨업 가능. */
const CH_EXP = [0.7, 2.3, 7.2, 23.1, 74.0, 237.0, 758.3, 2426.4, 24000.0, 75000.0, 240000.0, 760000.0, 2400000.0, 7600000.0, 24000000.0, 75000000.0, 240000000.0, 750000000.0, 2400000000.0]; // vc186b — DLC 3챕터 + vc192 나머지 7행성

/** 스테이지 키 → {챕터, 구역} 파싱 */
export function parseStage(key: StageKey): { ch: ChapterKey | "village"; sub: number } {
  if (key === "village" || !key) return { ch: "village", sub: 0 };
  /* v2.9 — 챕터 마을(Xv)도 챕터 소속으로 파싱 */
  const v = /^([a-z]+)v$/.exec(key);
  if (v) return { ch: v[1] as ChapterKey, sub: 0 };
  const m = /^(forest|kingdom|alfheim|muspelheim|niflheim|cave|nidavellir|hel|abyss|dlcstargate|dlcprisma|dlcocean|dlcreverse|dlcneocity|dlcmech|dlcswallow|dlcopinicia|dlcnovel|dlcsernium)([1-9]|10)$/.exec(key);
  if (!m) return { ch: "village", sub: 0 };
  return { ch: m[1] as ChapterKey, sub: parseInt(m[2], 10) };
}

export function chapterSpec(key: StageKey): ChapterSpec | null {
  const { ch } = parseStage(key);
  return CHAPTERS.find((c) => c.key === ch) ?? null;
}

/** v1.4.0 (Task 1-6 — 유저 지시 #14) — 레벨 구간별 퀘스트 요구 마릿수 곡선
 *  vc143 (#3 유저 지시 “요구 마릿수가 너무 적어 중반부터 100~200단위”) — 곡선 전면 재조정:
 *  1~20: 5~8 (초반 체감 유지) · 21~40: 60~110 · 41~60: 110~170 · 61~80: 170~210 · 81+: 200~260
 *  보상은 각 소비처(자동 토벌·반복 의뢰)에서 요구량 증가분만큼 곱연산 상향된다 */
export function questNeedByLv(lv: number): number {
  const l = Math.min(100, Math.max(1, Math.round(lv))); // 순수 Math — stages.ts는 Phaser 미임포트(모듈 초기화 순서 보호)
  if (l <= 20) return Math.round(5 + ((l - 1) / 19) * 3);
  if (l <= 40) return Math.round(60 + ((l - 21) / 19) * 50);
  if (l <= 60) return Math.round(110 + ((l - 41) / 19) * 60);
  if (l <= 80) return Math.round(170 + ((l - 61) / 19) * 40);
  return Math.round(200 + ((l - 81) / 19) * 60);
}

/** vc142 (#5) — 후반 몬스터 HP ×10: 유저 지시 "후반만 4스테이지 쯤 부터 몬스터 체력좀 10배 씩 정도 늘려".
 *  후반 4개 챕터(7 스바르트알프헤임 · 8 니다벨리르 · 9 헬 · 10 세계수의 뿌리)의 4구역부터 적용
 *  (구역 1~3은 진입 완충 유지). 공격력/경험치/골드 곡선은 현행 유지 — 체력만 상향. */
const LATE_HP_CHAPTERS: ChapterKey[] = ["cave", "nidavellir", "hel", "abyss", "dlcstargate", "dlcprisma", "dlcocean", "dlcreverse", "dlcneocity", "dlcmech", "dlcswallow", "dlcopinicia", "dlcnovel", "dlcsernium"];
const LATE_HP_FROM_SUB = 4;
const LATE_HP_MUL = 4; // v1.2.2 — 10은 과했다(7~10챕터 50~64타). 4로 낮춰 17~20타대.

/** 구역별 성장 배율 — 적 HP/ATK/EXP/골드 (사용자 지시 #6/#9 밸런스)
 *  v1.0.19 (A-3) — 신규 스테이지(scaleMul 보유)는 전용 배율 우선, 기존 챕터는 기존 곡선 유지 */
export function stageScale(key: StageKey, playerLv?: number): { hp: number; atk: number; exp: number; gold: number } {
  const own = STAGES[key]?.scaleMul;
  if (own) return { ...own };
  const spec = chapterSpec(key);
  if (!spec) return { hp: 1, atk: 1, exp: 1, gold: 1 };
  const { sub } = parseStage(key);
  const i = spec.num - 2;
  /* v3.0.22 (#50) — 구역 진행 배율 상향: 구역당 HP +7.5%·ATK +6% (기존 5.5/4.5%) */
  const subMul = 1 + (sub - 1) * 0.075;
  /* vc142 (#5) — 후반 4챕터 구역 4+ HP ×10 */
  const lateMul = LATE_HP_CHAPTERS.includes(spec.key) && sub >= LATE_HP_FROM_SUB ? LATE_HP_MUL : 1;
  /* ══════════════════════════════════════════════════════════════════════════
   * vc193 (버그 #4 "노탬인데 10챕터 몬스터들이 1방컷 남 (200렙기준)")
   *
   *  원인: lvGate 는 **입장 하한만** 검사하고(WorldScene 3186) 초과 레벨에 대한
   *  보정이 전혀 없었다. 심연(10챕터)의 lvGate.enter 는 126 이므로 200렙 유저는
   *  74레벨 초과 상태로 들어간다. 심연 sub1 몬스터는 3,640 HP 인데
   *  200렙 캐릭터의 1타가 그보다 커서 "노탬 1방컷"이 됐다(유저 실측).
   *
   *  해법: 스테이지 권장 상한(mid) 대비 초과 레벨만큼 몬스터 HP·ATK 를 올린다.
   *   - 초과분 1레벨당 HP +9%, ATK +4% (상한 3.2배 / 1.9배)
   *   - 권장 구간 이하(lv <= mid)면 배율 1 — 기존 밸런스는 그대로(회귀 없음)
   *   - PLAYER_LV 는 호출부가 넘겨준다(순수 함수 유지 — stageScale(key, lv?))
   *
   *  왜 HP 를 주로 올리나: 유저 요구는 "1방컷이 안 나게"다. ATK 를 크게 올리면
   *  노탬 유저가 즉사해 체감이 나빠진다. HP 를 올려 "여러 대 때려야 죽는" 상태를
   *  만들고 ATK 는 소폭만 올려 위협감만 남긴다.
   * ══════════════════════════════════════════════════════════════════════════ */
  const over = Math.max(0, (playerLv ?? 0) - spec.lvGate.mid);
  const overMulHp = Math.min(1 + over * 0.09, 3.2);
  const overMulAtk = Math.min(1 + over * 0.04, 1.9);
  return {
    hp: CH_HP[i] * subMul * lateMul * overMulHp,
    atk: CH_ATK[i] * (1 + (sub - 1) * 0.06) * overMulAtk,
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

/* v1.0.13 피드백#2 — 퀘스트 완료 경험치 상향 (사냥 위주 성장 → 퀘스트 병행 성장 유도) */
function buildQuests(spec: ChapterSpec, sub: number, prefix: string): QuestDef[] {
  const quests: QuestDef[] = [];
  /* v2.4 레벨 게이트 (사용자 지시 — "5레벨을 찍자!!" 식의 명확한 동기부여):
   *  각 챕터 진입(sub1)·중간(sub4)에 목표 레벨 퀘스트를 체인 맨 앞에 배치해
   *  다음 사냥터로 넘어가는 진행 게이트이자 성장 목표를 제공한다.
   *  보상 exp는 게이트 달성 직후 다음 목표로 자연스럽게 이어지도록 챕터 배율 반영 */
  const gateLv = sub === 1 ? spec.lvGate.enter : sub === 4 ? spec.lvGate.mid : null;
  if (gateLv != null) {
    const gateExp = Math.round((70 + gateLv * 6) * CH_EXP[spec.num - 2] * 1.15);
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
    //   vc143 (#3) — 곡선 재조정(중반부터 100~200단위) + 구역 스타일 로테이션 다양화:
    //   sub%3==2 구역은 “단일종 집중 사냥”(최다 종만 카운트, 요구량 ×0.6) — 전종 합산과 번갈아 나온다
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
    /* vc143 (#3 퀘스트 다양화) — 구역 스타일 로테이션: 3번째 구역마다 단일종 집중 사냥
     *  (최다 종만 카운트 — 사냥 대상을 골라 잡는 다른 플레이 스타일 제공) */
    const focusMode = sub % 3 === 2 && mixKeys.length > 1;
    const nf = focusMode ? Math.max(6, Math.round(n * 0.6)) : n;
    quests.push({
      id: `${prefix}-auto-hunt`,
      type: "hunt",
      title: focusMode ? `${main} 집중 사냥` : `${main} ${verbs[sub % verbs.length]}`,
      /* v4.1.3 (#퀘스트카운트) — "요구 몬스터 ≠ 카운트 몬스터" 혼란 해소 (지시 #4):
       *  이 퀘스트는 구역 스폰 몬스터 전체(targetKeys)를 합산 카운트한다. 그 사실을
       *  설명에 명시해 "고블린 소탕인데 개구리를 잡았더니 카운트된다?"를 사전에 제거. */
      desc: focusMode
        ? `${spec.title} 구역의 ${main} ${nf}마리를 사냥해라. — ${main}만 카운트된다`
        : `${spec.title} 구역의 몬스터 ${nf}마리를 처치해라. — 무엇을 잡아도 카운트된다 (${mixKeys.map((k) => labels[k]).join(" · ")})`,
      need: nf,
      targetKey: zoneMon, // v3.0.2 — 하위 호환(어시스트·히스테리시스 참조): 구역 최다 종
      targetKeys: focusMode ? [zoneMon] : mixKeys, // v3.0.28 — 카운트·판정은 구역 스폰 몬스터 전체 합산
      targetLabel: focusMode ? main : `${main} 등 구역 몬스터`,
      reward: Math.round((55 + sub * 14) * CH_EXP[spec.num - 2] * 0.55 * G * Math.max(1, nf / 8)), // 마릿수 증가분만큼 골드 보상 동반 상향
      expReward: Math.round((60 + sub * 14) * CH_EXP[spec.num - 2] * 1.5 * Math.max(1, nf / 8)),
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
      expReward: Math.round(200 * CH_EXP[spec.num - 2]),
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
      expReward: Math.round(420 * CH_EXP[spec.num - 2]),
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
  /* vc143 (#3) — 반복 의뢰: 중반(5장·lv20+)부터 요구량을 곡선값 그대로(60~210)로 인상하고
   *  보상도 요구량 증가분만큼 상향(×0.6 댐핑 — 시간당 보상 급등 방지). 초반 1~4장은 기존 공식 유지 */
  const repNeed =
    spec.lvGate.enter >= 20
      ? questNeedByLv(spec.lvGate.enter)
      : Math.min(Math.round(spec.repeat.need * 1.5), Math.round((spec.repeat.need + sub) * Math.max(1, questNeedByLv(spec.lvGate.enter) / 8)));
  const repMul = Math.max(1, (repNeed / Math.max(1, spec.repeat.need)) * 0.6);
  /* vc150 (#신규6) — 반복 의뢰 다수 개편 (유저 지시 "많은 마릿수의 의뢰 2~4개"):
   *  구역 종족 중 2~4종을 뽑아 개별 고마릿수(기존 ×2.5, 5마리 단위) 의뢰를 생성한다.
   *  종족별 중복 없이 배정 — 한 번의 처치가 여러 의뢰에 동시 카운트되지 않는다. */
  const species: EnemyKey[] = [spec.main];
  for (const en of spec.enemies) if (!species.includes(en.key)) species.push(en.key);
  const bountyN = Math.min(4, Math.max(2, species.length));
  const bounties = species.slice(0, bountyN).map((k) => ({
    targetKey: k,
    label: ENEMIES[k].name,
    need: Math.max(25, Math.round((repNeed * 2.5) / 5) * 5),
  }));
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
      /* v1.4.0 (Task 1-6) — 반복 의뢰 요구량도 레벨 곡선 연동 → vc143 중반 100~200단위 인상 */
      need: repNeed,
      gold: Math.round(spec.repeat.gold * stageScale(key).gold * 0.9 * repMul),
      exp: Math.round(spec.repeat.exp * stageScale(key).exp * 1.3 * repMul),
      title: spec.repeat.title,
      desc: spec.repeat.desc,
      bounties,
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
      /* v1.4.4 (유저 지시) — 전직 NPC 1명(카이엔) + 일반 NPC 2명 = 총 3명 대화 완료 시
       *  레벨 3 달성. 마을에서 레벨을 올릴 곳이 없다는 리포트의 정면 해결. */
      title: "마을 NPC 3명과 인사",
      desc: "주민 2명과 카이엔 교관 — NPC 3명에게 가까이 가서 E키(모바일은 버튼)로 대화하자. 3명을 모두 만나면 레벨 3이 달성된다!",
      need: 3,
      targetLabel: "마을 NPC",
      expReward: 25,
    },
    {
      /* v1.4.12 (#3 유저 지시 "시작 사냥터 없애 (단, npc 3명에게 말걸면 3레벨이 찍히도록 해)") —
       *  구 v1 "훈련용 늑대 길들이기"(초행자 훈련장 사냥 퀘스트) 제거 — 훈련장 철거와 세트.
       *  마을 퀘스트 체인은 v0 NPC 3명 인사(→ 레벨 3 즉시 달성) → v2 숲의 신전 이동 2단으로 단순화. */
      id: "v2",
      type: "reach",
      /* v3.0.26 (#75) — "서쪽 숲의 신전으로" 제목이 실존하지 않는 '서쪽 숲'을 가리켜
       *  유저가 마을 서쪽을 헤매는 혼동 수정. 실제 목적지는 동쪽 차원문 너머 '숲의 신전'(2-1). */
      title: "숲의 신전으로",
      desc: "마을 NPC 3명과 인사해 레벨 3을 달성했다 — 마을 동쪽 차원문을 지나 첫 사냥터 '숲의 신전'(2-1)에 도착해라.",
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
 *  콘텐츠 패널에서 입장 — 층을 오를수록 강해지는 적, 10층마다 보스, 층 클리어 보상.
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
