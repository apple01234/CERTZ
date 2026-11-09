import type { BossAttackKind } from "../data";

/**
 * 보스전 페이즈 / 예고(telegraph) / 반격 창 계약
 *
 * 왜 뽑았나
 *   `Boss.ts` 는 Phaser 엔티티라 테스트에서 인스턴스를 만들 수 없다. 그래서 보스전의
 *   **수치 계약**(언제 페이즈가 넘어가는가 / 예고가 몇 ms 인가 / 반격 창이 몇 초인가)이
 *   전부 코드 안에 하드코딩된 채로 남아 있었다. 그 결과 vc264 처럼 "등록은 됐는데
 *   실행은 안 되는" 패턴을 사람이 눈으로 찾아야 했다.
 *   여기서 수치만 순수 데이터로 떼어내면, 테스트가 23개 패턴 전부를 기계적으로 훑을 수 있다.
 *
 * 무엇
 *   · BOSS_PHASE_THRESHOLDS — HP 60% / 30% 에서 2·3페이즈
 *   · TELEGRAPH_MS         — 위험 공격이 터지기 전 바닥 경고 시간 (0.6~1.2초)
 *   · RECOVERY_MS          — 강력 패턴 후 무방비 구간 (1~2초, 반격 기회)
 *   · COUNTER_WINDOW_MS    — 반격 카운터 창 (때리면 기절)
 *
 * 이 파일이 지켜야 하는 계약
 *   · Phaser / DOM / Math.random 의존 없음. 순수 조회만.
 *   · 표에 없는 패턴은 `_default` 로 폴백한다 — 새 패턴을 추가해도 조용히 0 이 되지 않는다.
 *   · Boss.ts 는 이 표를 **참조**한다. 표를 고치면 전투가 같이 움직인다.
 */

/**
 * HP 비율 → 페이즈 임계값.
 *
 * 60% / 30% 를 고른 근거: 종전 66% / 33% 는 숫자가 어중간해서 유저가 "지금 바뀌었나"를
 * 체감하기 어려웠고, HP 바를 눈으로 따라가기도 애매했다. 60/30 은 10%p 눈금에 딱 맞아
 * "체력 3분의 1이 남았을 때 한 번 더 변한다"가 읽힌다.
 * 3페이즈를 30% 로 올린 이유는 후반 보스가 길어졌기 때문 — 종전 33% 는 보스 HP 가
 * 10만을 넘는 후반에서 마지막 페이즈가 너무 짧게 스쳐 지나갔다.
 */
export const BOSS_PHASE_THRESHOLDS = { phase2: 0.6, phase3: 0.3 } as const;

/** telegraph 허용 범위(ms). 유저 요구 "0.6~1.2초 전에 예고" 그대로. */
export const TELEGRAPH_RANGE_MS: readonly [number, number] = [600, 1200] as const;

/** 반격(무방비) 창 허용 범위(ms). 유저 요구 "1~2초 무방비 구간" 그대로. */
export const RECOVERY_RANGE_MS: readonly [number, number] = [1000, 2000] as const;

/** 반격 카운터 창 (때리면 기절 + 피해 ×1.6). 카오스 난이도에서는 짧아진다. */
export const COUNTER_WINDOW_MS = 1400;
export const COUNTER_WINDOW_CHAOS_MS = 1050;

/**
 * 위험 공격 사전 예고 시간 (ms).
 *
 * 원칙: 예고가 길수록 공정하지만, 길면 템포가 죽는다.
 *  · 즉발 광역(slam/ring/zones) = 800~950ms — 보고 피할 시간을 준다.
 *  · 추적형(volley/spiral) = 700ms — 투사체는 날아오는 시간이 있어 짧아도 된다.
 *  · 이미 지연 판정이 있는 것(quake 는 340ms 간격 연사)은 첫 타만 예고.
 *  · 모든 값이 TELEGRAPH_RANGE_MS 안에 있어야 한다 — 테스트가 강제한다.
 */
export const TELEGRAPH_MS: Record<string, number> = {
  _default: 780,
  tentacleslam: 1000, inkflood: 1100, shadowcopies: 950, cursefield: 1000, bloodseal: 950, corruption: 1100, rosecore: 1000, jadeclones: 1000, ringpush: 900,

  /* 기본 6종 */
  slam: 900,
  charge: 850,
  volley: 700,
  ring: 850,
  zones: 900,
  summon: 800,

  /* 개성 5종 */
  spiral: 700,
  beam: 900,
  blink: 800,
  quake: 700,
  counter: COUNTER_WINDOW_MS,

  /* VX 9종 (공용 예고 780 → 여기서 개별화) */
  firepillars: 820,
  frostnova: 950,
  thunderfall: 780,
  poisonfield: 800,
  holymantle: 1100,
  crystalburst: 850,
  blinkslash: 720,
  magicburst: 1000,
  portalteleport: 820,

  /* 스바르트알프헤임 3종 */
  greenslash: 800,
  vanish: 800,
  shieldcast: 900,
};

/**
 * 강력 패턴 후 무방비(반격) 창 (ms).
 *
 * "패턴 사이에 때릴 수 있는 시간"이다. 이 값이 0 에 가까우면 보스는 계속 공격만 하므로
 * "체력 많은 몬스터"와 다를 바 없어진다. 전 패턴에 창을 두되, 약한 패턴은 짧게 준다.
 * 모든 값이 RECOVERY_RANGE_MS(1~2초) 안에 있어야 한다 — 테스트가 강제한다.
 */
export const RECOVERY_MS: Record<string, number> = {
  tentacleslam: 1600, inkflood: 1700, shadowcopies: 1500, cursefield: 1600, bloodseal: 1500, corruption: 1800, rosecore: 1800, jadeclones: 1700, ringpush: 1800,
  _default: 1200,

  slam: 1600,
  charge: 1500,
  volley: 1100,
  ring: 1200,
  zones: 1300,
  summon: 1400,

  spiral: 1200,
  beam: 1400,
  blink: 1000,
  quake: 1300,
  counter: 1400,

  firepillars: 1500,
  frostnova: 1600,
  thunderfall: 1400,
  poisonfield: 1400,
  holymantle: 1900,
  crystalburst: 1400,
  blinkslash: 1100,
  magicburst: 1800,
  portalteleport: 1200,

  greenslash: 1000,
  vanish: 1100,
  shieldcast: 1500,
};

/** 이 패턴들은 예고 단계가 따로 있다(VX 계열) — 나머지는 각 start* 가 자체 예고를 갖는다. */
export const VX_KINDS: readonly string[] = [
  "firepillars", "frostnova", "thunderfall", "poisonfield", "holymantle",
  "crystalburst", "blinkslash", "magicburst", "portalteleport",
];

/** HP 비율(0~1) → 페이즈(1~3). 경계값은 그 페이즈로 넘어간다. */
export function phaseAt(hp01: number): number {
  const r = Number.isFinite(hp01) ? hp01 : 0;
  if (r > BOSS_PHASE_THRESHOLDS.phase2) return 1;
  if (r > BOSS_PHASE_THRESHOLDS.phase3) return 2;
  return 3;
}

/** 패턴별 예고 시간. 표에 없으면 `_default`. */
export function telegraphMs(kind: BossAttackKind | string): number {
  return TELEGRAPH_MS[kind] ?? TELEGRAPH_MS._default;
}

/** 패턴별 반격 창. 표에 없으면 `_default`. */
export function recoveryMs(kind: BossAttackKind | string): number {
  return RECOVERY_MS[kind] ?? RECOVERY_MS._default;
}

/** 반격 카운터 창 길이 (카오스는 짧다). */
export function counterWindowMs(chaos = false): number {
  return chaos ? COUNTER_WINDOW_CHAOS_MS : COUNTER_WINDOW_MS;
}

/**
 * 페이즈별 다음 공격까지의 쿨타임(ms). 격노(3페이즈)가 가장 빠르다.
 * 예전엔 `endAttack` 안에 `enraged ? 0.5 : phase===2 ? 0.7 : 0.85` 가 인라인으로 있었다.
 */
export function attacksAfter(phase: number): number {
  return phase >= 3 ? 500 : phase === 2 ? 700 : 850;
}

/**
 * 해당 페이즈에서 실제로 뽑히는 후보 패턴 목록.
 *
 * 왜 합집합인가: 페이즈 전환은 "패턴 **교체**"가 아니라 "**확장**"이어야 한다.
 * 실제로 abysslord 는 p1 의 자기 시그니처(`greenslash`)와 `slam` 이 p3 에 없어서
 * 최종 페이즈에서 정체성 패턴을 못 썼고, skoll 도 `slam` 이 사라졌다.
 * Boss.pickAttack 이 이 함수를 그대로 쓰므로, 데이터에 구멍이 있어도 전투에서는
 * 패턴이 **줄지 않는다** — 테스트가 이 계약을 강제한다.
 */
export function attackPool(
  patterns: { p1: readonly string[]; p2: readonly string[]; p3: readonly string[] },
  phase: number,
): string[] {
  const own = phase >= 3 ? patterns.p3 : phase === 2 ? patterns.p2 : patterns.p1;
  if (phase <= 1) return [...own];
  const carried = phase >= 3 ? [...patterns.p1, ...patterns.p2] : [...patterns.p1];
  return [...own, ...carried.filter((k) => !own.includes(k))];
}

/* ══════════════════════════════════════════════════════════════════════════
 * 순수 상태 전이 — Boss.ts 의 mode 상태머신에서 **전이 규칙만** 떼어낸 것
 *
 * Boss 는 Phaser.Physics.Arcade.Sprite 라 Node 테스트에서 인스턴스화할 수 없다
 * (window/document 필요). 그래서 "페이즈가 실제로 넘어가는가 / 반격 창이 실제로
 * 열리고 닫히는가"를 눈으로만 확인해야 했고, 그게 vc264 의 침묵 버그를 놓친 이유다.
 * 여기서 전이만 순수 함수로 두면 테스트가 시간을 흘려 실제 전이를 검증할 수 있다.
 * ══════════════════════════════════════════════════════════════════════════ */

export type BossTickState = {
  /** HP 비율 0~1 */
  hp01: number;
  phase: number;
  mode: string;
  /** 현재 모드의 남은 시간(ms) */
  modeTimer: number;
  /** 다음 공격까지 남은 시간(ms) */
  nextAttackCd: number;
  /** 직전에 실행한 패턴 */
  lastAttack: string | null;
  alive: boolean;
};

/** 새 보스의 초기 상태. */
export function initialBossState(hp01 = 1): BossTickState {
  return { hp01, phase: 1, mode: "idle", modeTimer: 1200, nextAttackCd: 1600, lastAttack: null, alive: true };
}

/**
 * 한 틱 전진 (순수). Boss.update 의 modeTimer 감소 + 페이즈 판정 + recover 만료를
 * **같은 순서**로 흉내낸다. 부수효과(연출/판정)는 없다.
 *
 * 반환: 새 상태 + 이번 틱에 일어난 사건 목록.
 */
export function tickBoss(
  s: BossTickState,
  dtMs: number,
): { state: BossTickState; events: string[] } {
  const events: string[] = [];
  if (!s.alive) return { state: s, events };

  const next: BossTickState = { ...s };
  /* Boss.update 와 동일 순서: 타이머 감소 → 페이즈 판정 → 모드 만료 */
  next.modeTimer -= dtMs;
  next.nextAttackCd -= dtMs;

  const p = phaseAt(next.hp01);
  if (p > next.phase) {
    next.phase = p;
    events.push(`phase:${p}`);
    /* onPhaseChange 는 mode="idle" 로 되돌리고 nextAttackCd=900 으로 재장전한다. */
    next.mode = "idle";
    next.nextAttackCd = 900;
  }

  if (next.mode === "recover" && next.modeTimer <= 0) {
    next.mode = "idle";
    events.push("recover:end");
  }
  return { state: next, events };
}

/**
 * 공격 종료 시 반격 창을 연다 (Boss.endAttack 의 순수 부분).
 * 반환된 상태의 mode 가 "recover" 면 창이 열린 것이다.
 */
export function openRecovery(s: BossTickState, kind: string): BossTickState {
  const win = recoveryMs(kind);
  return { ...s, lastAttack: kind, mode: "recover", modeTimer: win };
}
