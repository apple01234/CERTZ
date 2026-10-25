/**
 * vc183 (지시 — 액터 기반 결정적 시뮬레이션 문서) — 시드 기반 결정론적 난수.
 *
 * 왜 필요한가:
 *  이 게임은 Math.random() 을 126곳에서 쓴다. 그래서 "아까 그 버그가 다시 안 난다"를
 *  보장할 수 없다 — 크리티컬·드롭·몬스터 AI 선택이 매번 달라 같은 상황을 재현할 수 없다.
 *  문서(GDC 2016 David Salz, Actor-based Determinism)의 핵심도 여기다:
 *  시드만 같으면 모든 결과가 비트 단위로 같아진다 → 리플레이·버그 재현·동기화 검증이 가능.
 *
 * 설계:
 *  · Xorshift32 — 문서가 지정한 알고리즘. 정수 연산만 써서 플랫폼/CPU 간 결과가 동일하다.
 *  · 액터별 스트림 분리 — 몬스터마다 (월드시드 ^ 액터ID) 로 자기 시드를 갖는다.
 *    전역 난수를 공유하면 적 하나가 더 스폰되는 것만으로 모든 적의 난수가 밀려
 *    "같은 상황 재현"이 깨진다. 액터 단위로 끊어야 문서의 Actor-based 가 성립한다.
 *  · 전역 스트림 — 드롭/크리티컬처럼 액터와 무관한 것들용.
 *
 * 주의:
 *  Math.random 을 전부 교체하지는 않았다. 연출용(파티클 각도 등)은 결과에 영향이 없어
 *  그대로 두는 게 맞다 — 교체 범위를 늘리면 리스크만 커지고 재현성 이득은 없다.
 *  게임 결과에 영향을 주는 곳(드롭·크리티컬·AI 패턴 선택)부터 단계적으로 바꾼다.
 */

/** Xorshift32 상태 — 0이면 영원히 0이 나오므로 생성 시 0을 금지한다. */
export class DeterministicRandom {
  private s: number;

  constructor(seed: number) {
    /* 0 시드 방어 — xorshift 는 0 상태에서 탈출하지 못한다. */
    this.s = (seed >>> 0) || 0x9e3779b9;
  }

  /** [0, 1) 실수 — Math.random() 대체용 */
  next(): number {
    let x = this.s;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.s = x >>> 0;
    /* 상위 24비트만 사용 — 하위 비트는 주기가 짧아 품질이 떨어진다 */
    return (this.s >>> 8) / 0x1000000;
  }

  /** [min, max] 정수 (양끝 포함) */
  int(min: number, max: number): number {
    if (max < min) [min, max] = [max, min];
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** [min, max) 실수 */
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** 배열에서 하나 — AI 공격 패턴 선택 등 */
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** 확률 판정 (0~1) — 드롭/크리티컬 */
  chance(p: number): boolean {
    return this.next() < p;
  }
}

/* ────────────────────────── 월드 단위 시드 관리 ────────────────────────── */

/** 현재 세션의 월드 시드. startRun() 으로 교체된다. */
let worldSeed = 0x5e27_2bad;

/** 전역 스트림 — 액터와 무관한 판정(드롭 확률 등) */
let globalStream = new DeterministicRandom(worldSeed);

/** 액터 스트림 캐시 — 같은 액터ID면 항상 같은 스트림을 돌려준다. */
const actorStreams = new Map<number, DeterministicRandom>();

/**
 * 새 판(세션)을 시작한다.
 * @param seed 지정하지 않으면 현재 시각 기반. 리플레이/버그재현 시에는 같은 값을 넣는다.
 */
export function startRun(seed?: number): number {
  worldSeed = (seed ?? (Date.now() ^ 0x9e3779b9)) >>> 0;
  globalStream = new DeterministicRandom(worldSeed);
  actorStreams.clear();
  try {
    /* 새로고침 후에도 같은 시드로 이어서 재현할 수 있게 세션에 남긴다. */
    sessionStorage.setItem("sertz.seed", String(worldSeed));
  } catch { /* 스토리지 불가 환경 무시 */ }
  return worldSeed;
}

/** 현재 월드 시드 (디버그/검증용) */
export function currentSeed(): number {
  return worldSeed;
}

/**
 * 액터 전용 스트림. 같은 id 는 항상 같은 시퀀스를 낸다.
 * id 는 스폰 시점에 부여되는 고유 번호(스폰 순서 등)를 쓴다 — 좌표를 쓰면
 * 적이 조금 움직이는 것만으로 스트림이 바뀌어 재현성이 깨진다.
 */
export function actorStream(id: number): DeterministicRandom {
  let st = actorStreams.get(id);
  if (!st) {
    st = new DeterministicRandom((worldSeed ^ (id * 0x9e3779b9)) >>> 0);
    actorStreams.set(id, st);
  }
  return st;
}

/** 액터 스트림 정리 — 개체가 사라질 때 호출해 메모리를 유지한다. */
export function releaseActor(id: number): void {
  actorStreams.delete(id);
}

/** 전역 스트림 접근 */
export function rng(): DeterministicRandom {
  return globalStream;
}

/* ────────────────────────── 편의 함수 (Math.random 대체) ────────────────────────── */

/** [0,1) — Math.random() 과 동일한 시그니처라 교체가 쉽다. */
export const drand = (): number => globalStream.next();

/** [min,max) 실수 */
export const drange = (min: number, max: number): number => globalStream.float(min, max);

/** [min,max] 정수 */
export const dint = (min: number, max: number): number => globalStream.int(min, max);

/** 확률 판정 */
export const dchance = (p: number): boolean => globalStream.chance(p);
