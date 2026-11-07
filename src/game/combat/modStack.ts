/**
 * modStack.ts — 배율/가산 스택 (JENNY `FloatModStack` 이식)
 *
 * ═══ 어디서 왔나 ═══
 * JENNY(Godot 4.6.1, 런앤건)의 `system/mod_stack/float_mod_stack.gd`.
 * 그 게임은 이동속도·공격력·시간배율 같은 **모든 수치 배율**을 이 스택 하나로 관리한다.
 * 원본 설계의 핵심 3가지:
 *   ① 우선순위(priority) + uid 로 정렬한 뒤 순차 적용 → **적용 순서가 결정적**이다
 *   ② uid 별로 bit 을 add/remove 하므로 **중첩 해제가 정확**하다
 *      (버프 3개 중 1개만 만료돼도 나머지 2개의 곱이 그대로 남는다)
 *   ③ dirty 플래그로 캐시 → 매 프레임 재계산하지 않는다
 *
 * ═══ 왜 SERTZ 에 필요한가 ═══
 * SERTZ 는 지금 `dmg * 1.25 * (1 + bonus/100) * ...` 식으로 **곱셈을 인라인으로** 쌓는다.
 * 그래서 (a) 버프가 겹칠 때 어느 배율이 이미 적용됐는지 추적이 안 되고,
 * (b) 일부만 해제할 방법이 없어 버프가 만료되면 배율을 통째로 되돌린다.
 * 이 스택을 쓰면 "버프 A 해제"가 다른 배율에 영향을 주지 않는다.
 *
 * ═══ 주의 ═══
 * 원본 Godot 구현은 `result = 0` 에서 시작해 ADD/SUBTRACT 를 누적한다(순수 누산기).
 * SERTZ 수치(공격력·이동속도)는 **곱셈 기준 1.0** 이므로 base 를 1.0 으로 두고
 * MULTIPLY 를 기본 연산으로 쓴다. 이 차이를 아래 DEFAULT_OP 주석에 명시한다.
 */

/**
 * 적용 연산 — 원본 JENNY 의 `Math` enum 과 동일 순서.
 * [주의] TypeScript `enum` 대신 `as const` 객체를 쓴다. 이 저장소는 테스트를
 *  `node --experimental-strip-types`(strip-only)로 돌리는데 enum 은 그 모드에서
 *  지원되지 않는다(`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`). 프로젝트 기존 컨벤션
 *  (classes.ts 의 JOB_LEVELS 등)과도 일치한다.
 */
export const ModOp = {
  MULTIPLY: 0,
  ADD: 1,
  SUBTRACT: 2,
  DIVIDE: 3,
} as const;
export type ModOp = (typeof ModOp)[keyof typeof ModOp];

/** base(1.0) 를 나타내는 고정 uid — 어떤 removeBit 으로도 지워지지 않는다. */
export const BASE_UID = 123456789;

/** base 엔트리의 priority — 유한한 최솟값이어야 한다(-Infinity 는 sort 에서 NaN). */
const BASE_PRIORITY = -1e9;

type Mod = { uid: number; value: number; op: ModOp; priority: number };

/**
 * 수치 배율 스택.
 *
 * ```ts
 * const speed = new ModStack(1.0);          // 기본 배율 1.0
 * const bit = speed.addBit(0, 1.5, ModOp.MULTIPLY, 10);  // +50%
 * speed.value;   // 1.5
 * speed.removeBit(bit);
 * speed.value;   // 1.0
 * ```
 */
export class ModStack {
  private readonly mods = new Map<number, Mod>();
  private nextUid = 1;
  private dirty = true;
  private cached = 1.0;
  private cachedHighest = 1.0;
  private _base: number;

  constructor(base = 1.0) {
    this._base = base;
    /* ═══ 원본과 다른 점 — 반드시 이해할 것 ═══
     * JENNY 원본은 base 를 `op: ADD` 로 넣는다. 그 게임의 FloatModStack 은
     * result 를 0 에서 시작하는 **순수 누산기**이고 base 는 "시작값"일 뿐이라
     * ADD 가 맞다.
     *
     * SERTZ 는 다르다. 여기서 다루는 값은 공격력·이동속도 같은 **배율**이고
     * 기대값은 `base × (곱들)` 이다. base 를 ADD 로 두면 정렬(priority→uid)에서
     * base 가 뒤로 밀려 `0 × 2 = 0` 다음에 `+1.0` 이 되어 곱셈이 통째로 무력화된다
     * (테스트가 실제로 이 버그를 잡았다: 기대 2, 실제 1.0).
     *
     * → base 를 **MULTIPLY 1.0 + priority BASE_PRIORITY(-1e9)** 로 둔다.
     *   항상 맨 앞에서 곱해져 `base × …` 가 성립하고, 정렬이 결정적이다.
     *  [함정] -Infinity 를 쓰면 안 된다. `a.priority - b.priority` 가
     *   `-Infinity - (-Infinity) = NaN` 이 되어 sort 비교가 무효화되고
     *   base 가 엉뚱한 위치로 간다(테스트가 실제로 잡았다). 유한한 최솟값을 쓴다. */
    this.mods.set(BASE_UID, { uid: BASE_UID, value: base, op: ModOp.MULTIPLY, priority: BASE_PRIORITY });
  }

  /** 기준값. 바꾸면 캐시가 무효화된다. */
  get base(): number {
    return this._base;
  }

  set base(v: number) {
    this._base = v;
    const entry = this.mods.get(BASE_UID);
    if (entry) entry.value = v;
    this.dirty = true;
  }

  /** 스택 적용 결과. 첫 접근 시에만 재계산한다. */
  get value(): number {
    if (this.dirty) this.recalculate();
    return this.cached;
  }

  /** 스택에 포함된 원소 중 **가장 큰 원시값** — "가장 센 버프" 표시용. */
  get highest(): number {
    if (this.dirty) this.recalculate();
    return this.cachedHighest;
  }

  /** 기본값 외에 아무것도 없으면 false. */
  get hasValue(): boolean {
    return this.mods.size > 1;
  }

  /**
   * 배율 하나를 추가한다. 같은 uid 를 다시 넣으면 갱신된다.
   * @param uid 0 이면 자동 발급. 음수는 절댓값으로 정규화한다(원본과 동일).
   * @returns 실제 부여된 uid — 해제할 때 이 값을 쓴다.
   */
  addBit(uid: number, value: number, op: ModOp = ModOp.MULTIPLY, priority = 0): number {
    let id = Math.abs(uid);
    if (id === 0) {
      id = this.nextUid++;
    }
    const prev = this.mods.get(id);
    /* 값·연산·우선순위가 모두 같으면 아무 일도 하지 않는다 — 원본과 동일한 최적화.
     *  (매 프레임 같은 값을 다시 넣는 호출부에서 dirty 를 계속 올리지 않기 위함) */
    if (prev && prev.value === value && prev.op === op && prev.priority === priority) {
      return id;
    }
    this.mods.set(id, { uid: id, value, op, priority });
    this.dirty = true;
    return id;
  }

  /** 배율 하나를 제거한다. base 는 보호된다. */
  removeBit(uid: number): void {
    const id = Math.abs(uid);
    if (id === BASE_UID) return;
    if (this.mods.delete(id)) this.dirty = true;
  }

  /** base 만 남기고 전부 지운다. */
  clear(): void {
    const base = this.mods.get(BASE_UID);
    this.mods.clear();
    if (base) this.mods.set(BASE_UID, base);
    this.dirty = true;
  }

  /**
   * 정렬 후 순차 적용.
   * 정렬 기준은 원본과 동일하게 **priority 오름차순, 같으면 uid 오름차순**.
   * 이 순서가 결정적이어야 같은 버프 조합이 항상 같은 결과를 낸다.
   */
  private recalculate(): void {
    if (this.mods.size === 0) {
      this.cached = 0;
      this.cachedHighest = 0;
      this.dirty = false;
      return;
    }
    const list = [...this.mods.values()].sort((a, b) =>
      a.priority === b.priority ? a.uid - b.uid : a.priority - b.priority,
    );
    /* ═══ 원본과 다른 점 2 ═══
     * JENNY 원본은 `result = 0` 에서 시작한다(순수 누산기 — base 를 ADD 로 넣는다).
     * SERTZ 는 base 가 MULTIPLY 1.0 이므로 **base 에서 시작**해야 `base × …` 가 된다.
     * 0 에서 시작하면 0 × 1.0 = 0 이 되어 무엇을 곱해도 0 이 된다. */
    let result = this._base;
    let highest = -Infinity;
    for (const m of list) {
      /* base 엔트리는 시작값으로 이미 반영했으므로 건너뛴다(이중 적용 방지). */
      if (m.uid === BASE_UID) continue;
      if (m.value > highest) highest = m.value;
      switch (m.op) {
        case ModOp.MULTIPLY: result *= m.value; break;
        case ModOp.ADD: result += m.value; break;
        case ModOp.SUBTRACT: result -= m.value; break;
        case ModOp.DIVIDE: result = m.value === 0 ? 0 : result / m.value; break;
      }
    }
    this.cached = result;
    this.cachedHighest = highest === -Infinity ? this._base : highest;
    this.dirty = false;
  }
}
