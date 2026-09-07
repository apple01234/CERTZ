// 모듈 4 (036~040): 전투 및 액션 메커니즘 — 후반부

export const items = [
  {
    id: "036",
    title: "투사체(직선, 유도, 곡선) 이동 궤적 연산 모듈",
    role: [
      "투사체는 궤적 유형별로 계산 방식이 다르다. 직선(linear)은 초기 속도 벡터로 등속 이동, 유도(homing)는 목표 방향으로 각속도 제한 회전, 곡선(arc)은 포물선 높이 렌더 + 평면 직선 이동, 관통/바운스는 히트 후 상태 전이를 추가로 가진다. 서버는 발사 시점의 궤적 매개변수(발사 위치, 방향, 속도, 목표 id)를 결정하고, 클라는 동일 매개변수로 시각적으로 재생한다 — 히트 판정은 서버가 유일 권위(015번)다.",
      "유도탄의 핵심은 각속도 제한(턴 레이트)이다. 매 스텝 목표 방향으로 즉시 회전하면 빙글빙글 도는 우스꽝스러운 궤적이 되므로, 최대 각속도(예: 초당 120도) 이내로만 목표를 추적한다. 수명(lifetime)과 사거리 초과 시 자동 소멸, 목표 사망 시 궤적 유지 정책(직진 유지 or 소멸)도 데이터로 정의한다.",
    ],
    blocks: [
      {
        lang: "src/combat/Projectile.ts",
        code: `import type { Vec } from "./hitbox";

export type ProjKind = "linear" | "homing" | "arc";
export interface ProjDef {
  kind: ProjKind;
  speed: number;             // px/s
  turnRate?: number;         // homing: rad/s
  arcHeight?: number;        // arc: 포물선 최고 높이(px)
  maxDist: number;           // 사거리 초과 소멸
  pierce?: number;           // 관통 횟수
  radius: number;            // 히트 반경
}
export interface ProjState {
  id: number; ownerId: number; targetId: number | null;
  x: number; y: number; dir: number;    // dir = 라디안
  traveled: number; born: number; life: number;
  dead: boolean;
}

export class ProjectileSim {
  constructor(private def: ProjDef) {}

  /** 한 스텝 진행(서버 고정 틱에서 호출 — 클라는 동일 코드로 시각 재생) */
  step(p: ProjState, dtMs: number, targetPos: Vec | null): { x: number; y: number; z: number } {
    const dt = dtMs / 1000;
    if (p.traveled >= this.def.maxDist || p.dead || p.born + p.life < p.born) p.dead = true;

    switch (this.def.kind) {
      case "linear":
        break;                                    // 방향 고정
      case "homing": {
        if (targetPos) {
          // 목표 방향으로 turnRate 이내 회전
          const want = Math.atan2(targetPos.y - p.y, targetPos.x - p.x);
          p.dir = rotateToward(p.dir, want, (this.def.turnRate ?? 2) * dt);
        }
        break;                                    // 목표 없으면 직선 유지
      }
      case "arc":
        break;                                    // 평면은 직선, 높이만 렌더 계산
    }
    const move = this.def.speed * dt;
    p.x += Math.cos(p.dir) * move;
    p.y += Math.sin(p.dir) * move;
    p.traveled += move;

    // 곡선(포물선) 렌더 높이: 사거리 대비 진행률로 정현파 절반
    const t = Math.min(1, p.traveled / this.def.maxDist);
    const z = this.def.kind === "arc"
      ? Math.sin(t * Math.PI) * (this.def.arcHeight ?? 0) : 0;
    return { x: p.x, y: p.y, z };
  }

  /** 히트 판정(서버) — 대상 원 반경 포함 */
  hits(p: ProjState, targets: { id: number; x: number; y: number; radius: number; dead: boolean }[]) {
    const out: number[] = [];
    for (const t of targets) {
      if (t.dead || t.id === p.ownerId) continue;
      if (Math.hypot(t.x - p.x, t.y - p.y) <= this.def.radius + t.radius) out.push(t.id);
    }
    return out;
  }
}

/** 각도 회전(각속도 제한) — homing 핵심 수식 */
export function rotateToward(cur: number, want: number, maxDelta: number): number {
  let diff = want - cur;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const clamped = Math.max(-maxDelta, Math.min(maxDelta, diff));
  return cur + clamped;
}`,
      },
    ],
    tips: [
      "투사체 동기화는 '발사 이벤트 1회' + 양쪽 동일 시뮬레이션이 정석이다 — 위치를 매 프레임 전송하면 트래픽만 늘고 결정론만 깨진다.",
      "유도탄 turnRate는 90~180도/초 밴드가 자연스럽다 — 초과하면 강력해 보이지만 회피가 불가능해져 조작감이 파괴된다.",
      "arc 투사체는 평면 판정(원 반경)과 렌더 높이(z)를 분리해야 충돌 판정 코드가 단순해진다.",
      "관통(pierce)은 히트한 대상 id Set을 유지해 같은 대상 중복 히트를 막는다.",
    ],
  },
  {
    id: "037",
    title: "몬스터 어그로(Aggro) 수치 계산 및 타겟 전환 AI",
    role: [
      "어그로는 '몬스터가 누구를 공격할지'의 수치 테이블이다. 각 플레이어는 몬스터별 어그로 수치를 가지며, 데미지(1.0), 힐(0.5), 버프(0.3), 어그로 스킬(가중치 높음)로 적립되고, 시간에 따라 감쇠한다. 몬스터는 최대 어그로 대상을 공격하되, 자연 감쇠(초당 -x%)로 장기 전투에서 탱커가 어그로를 유지하기 어려워지는 것을 방지하기 위해 탱커 보정(탱커 어그로는 감쇠 50%)을 둔다.",
      "타겟 전환 트리거는 세 가지다. 어그로 역전(상위 대상 교체), 힐탱 우선 규칙(일부 몹은 힐러 우선), 배신(hate reset, 도망/은신 시 어그로 초기화). 서버에서만 연산하며, 클라는 몬스터의 currentTargetId만 받아 '누구를 때리는지' 시각적으로 표시(타겟 라인)한다. 파티 시스템과 결합해 '파티원이 맞는 중이면 대형 몹 어그로를 파티 탱커가 우선' 같은 규칙도 데이터로 둔다.",
    ],
    blocks: [
      {
        lang: "server/combat/Aggro.ts",
        code: `export interface AggroEntry { userId: number; value: number; lastHitAt: number; }

const DECAY_PER_SEC = 0.98;          // 초당 2% 자연 감쇠
const TANK_DECAY = 0.995;            // 탱커 보정 감쇠
const HATE_RESET_MS = 8000;          // 8초간 무공격 시 절반 감소 가속

export class AggroTable {
  private entries = new Map<number, AggroEntry>();   // userId → entry
  private tankIds = new Set<number>();

  markTank(userId: number) { this.tankIds.add(userId); }

  add(userId: number, amount: number, now: number) {
    const e = this.entries.get(userId) ?? { userId, value: 0, lastHitAt: now };
    e.value += amount;
    e.lastHitAt = now;
    this.entries.set(userId, e);
  }

  /** 데미지/힐/버프별 어그로 가중치 */
  static fromDamage(dmg: number) { return dmg * 1.0; }
  static fromHeal(hp: number)    { return hp * 0.5; }
  static fromBuff()              { return 30; }
  static fromTaunt()             { return 1500; }

  /** 몬스터 틱: 감쇠 + 현재 타겟 반환 */
  tickAndPick(now: number): number | null {
    for (const e of this.entries.values()) {
      const idleMs = now - e.lastHitAt;
      const isTank = this.tankIds.has(e.userId);
      let decay = Math.pow(isTank ? TANK_DECAY : DECAY_PER_SEC, 1);
      if (idleMs > HATE_RESET_MS) decay *= Math.pow(0.9, idleMs / 1000); // 무공격 가속 감쇠
      e.value *= decay;
    }
    for (const [k, e] of this.entries) if (e.value <= 1) this.entries.delete(k);

    let best: AggroEntry | null = null;
    for (const e of this.entries.values())
      if (!best || e.value > best.value) best = e;
    return best?.userId ?? null;
  }

  /** 은신/도망: 어그로 완전 제거(hate drop) */
  drop(userId: number) { this.entries.delete(userId); }
  /** 도망각 체크: 최근 피격 없이 이동 중이면 감쇠 가속 */
  onFlee(userId: number) {
    const e = this.entries.get(userId);
    if (e) e.value *= 0.6;
  }
  top(n: number): AggroEntry[] {
    return [...this.entries.values()].sort((a, b) => b.value - a.value).slice(0, n);
  }
}

/** 몬스터 AI 통합 예시 */
export class MonsterBrain {
  private aggro = new AggroTable();
  targetUserId: number | null = null;

  onPlayerAction(userId: number, kind: "dmg" | "heal" | "buff" | "taunt", value = 0, now = Date.now()) {
    const amount = kind === "dmg" ? AggroTable.fromDamage(value)
      : kind === "heal" ? AggroTable.fromHeal(value)
      : kind === "taunt" ? AggroTable.fromTaunt() : AggroTable.fromBuff();
    this.aggro.add(userId, amount, now);
  }
  tick(now: number) {
    this.targetUserId = this.aggro.tickAndPick(now);
    // 타겟 사망/퇴장 시 다음 순위 자동 승계(tickAndPick이 처리)
  }
}`,
      },
    ],
    tips: [
      "감쇠(decay)는 지수 형태로 구현해야 감쇠가 프레임율 독립이다 — 고정 틱에서 pow(0.98, dt/1000) 형태로 쓴다.",
      "탱커 어그로 보정(감쇠 50%) 없이는 장기 보스전에서 탱커가 어그로를 잃는 '어그로 스위칭 지옥'이 벌어진다.",
      "힐 어그로는 딜의 절반 — 힐러가 과도하게 어그로를 끌면 '힐 지르기 밴' 문화가 생긴다.",
      "타겟 전환은 최소 지연(200~400ms 반응 시간)을 두어 유저가 회피 행동을 취할 기회를 준다.",
    ],
  },
  {
    id: "038",
    title: "범위 내 파티 버프 및 시너지 연산",
    role: [
      "파티 버프는 '버퍼가 특정 범위(반경) 내 파티원에게 상태 효과를 부여'하는 연산이며, 효과는 StatMath(021번)의 buff 소스로 주입된다. 범위 판정은 원(오라), 직사각형(지정 지역), 링크(특정 대상 추종) 세 형태다. 시너지는 파티 조합 보너스(예: 전사 2명 + 힐러 1명 = 방어력 +5%)로, 파티 구성 스냅샷에서 정의 테이블 매칭으로 계산한다.",
      "버프 스택 규칙이 핵심이다. 같은 id 버프는 갱신(max)하고, 다른 id의 동일 효과는 스택 허용(최대 N개)한다. 시너지 계산은 파티원 이동/입장/퇴장 시 1회 재평가하며, 범위 버프는 유저가 범위를 벗어날 때 효과 제거 이벤트를 보내야 '범위 밖에서 버프 유지' 버그가 사라진다. 모든 버프는 만료 시각을 가지며, 만료 일괄 처리(sweep)는 1초 주기로 수행한다.",
    ],
    blocks: [
      {
        lang: "server/combat/PartyBuff.ts",
        code: `import type { StatMod } from "../../src/game/StatMath";

export interface BuffDef {
  id: string;                 // "warrior_shout_v2" — 버전 포함해 규칙 격리
  kind: "aura" | "area" | "link";
  range?: number;             // aura: 버퍼 중심 반경
  durationMs: number;
  mods: StatMod[];
  stackLimit: number;         // 동일 id 최대 스택(1 = 갱신만)
}
export interface ActiveBuff {
  defId: string; sourceId: number; targetId: number;
  until: number; stack: number;
}

export class BuffSystem {
  private active = new Map<string, ActiveBuff>();  // key = targetId:defId:sourceId

  /** aura 버프 틱: 범위 내 파티원에게 부여, 벗어나면 제거 */
  tickAura(def: BuffDef, buffer: { id: number; x: number; y: number },
           party: { id: number; x: number; y: number }[], now: number) {
    for (const m of party) {
      const inRange = m.id !== buffer.id
        && Math.hypot(m.x - buffer.x, m.y - buffer.y) <= (def.range ?? 200);
      const key = m.id + ":" + def.id + ":" + buffer.id;
      if (inRange) {
        const cur = this.active.get(key);
        if (!cur) {
          this.active.set(key, { defId: def.id, sourceId: buffer.id,
            targetId: m.id, until: now + def.durationMs, stack: 1 });
        } else {
          cur.until = now + def.durationMs;       // 지속 갱신(스택은 유지)
        }
      } else {
        this.active.delete(key);                  // 범위 이탈 즉시 제거
      }
    }
  }

  /** 스택 제한 준수 적용 */
  tryStack(def: BuffDef, targetId: number, sourceId: number, now: number): boolean {
    const sameId = [...this.active.values()].filter(b =>
      b.defId === def.id && b.targetId === targetId && b.sourceId === sourceId);
    const total = sameId.reduce((s, b) => s + b.stack, 0);
    if (total >= def.stackLimit) return false;
    const key = targetId + ":" + def.id + ":" + sourceId;
    const cur = this.active.get(key);
    if (cur) { cur.stack++; cur.until = now + def.durationMs; }
    else this.active.set(key, { defId: def.id, sourceId, targetId,
                                until: now + def.durationMs, stack: 1 });
    return true;
  }

  /** 만료 일괄 정리(1초 주기) */
  sweep(now: number): ActiveBuff[] {
    const expired: ActiveBuff[] = [];
    for (const [k, b] of this.active)
      if (b.until <= now) { expired.push(b); this.active.delete(k); }
    return expired;
  }

  /** 대상의 현재 버프 → StatMath buff 소스 */
  modsFor(targetId: number, defs: Map<string, BuffDef>): StatMod[] {
    const out: StatMod[] = [];
    for (const b of this.active.values()) {
      if (b.targetId !== targetId) continue;
      const d = defs.get(b.defId);
      if (!d) continue;
      for (const m of d.mods) out.push({ ...m });
    }
    return out;
  }
}

/** 시너지: 파티 구성 스냅샷 → 보너스 매칭 */
export interface SynergyDef { id: string; need: Record<string, number>; mods: StatMod[]; }
export function evalSynergies(
  members: { classCode: string }[], synergyDefs: SynergyDef[],
): SynergyDef[] {
  const counts: Record<string, number> = {};
  for (const m of members) counts[m.classCode] = (counts[m.classCode] ?? 0) + 1;
  return synergyDefs.filter(s =>
    Object.entries(s.need).every(([cls, n]) => (counts[cls] ?? 0) >= n));
}`,
      },
    ],
    tips: [
      "버프 키(targetId:defId:sourceId)는 중복 부여 방지의 핵심이다 — sourceId까지 포함해야 서로 다른 버퍼의 같은 버프가 정확히 구분된다.",
      "aura 이탈 즉시 제거는 UX상 1~2초 유예(grace)를 주는 것이 부드럽다 — 톡 끊기는 버프보다 2초 잔여가 자연스럽다.",
      "시너지는 파티 입/퇴장 이벤트에서만 재평가한다 — 이동마다 재계산하면 불필요한 CPU와 재계산 지연이 생긴다.",
      "버프 버전 관리(id에 v2 포함)로 밸런스 패치 시 구버전 버프가 남는 문제를 구조적으로 차단한다.",
    ],
  },
  {
    id: "039",
    title: "속성(불, 물, 바람, 땅 등) 상성 피해 비율 공식",
    role: [
      "속성 상성은 5원소(불/물/바람/땅/빛+어둠 확장) 상성표의 승산 배율로 구현한다. 표준 밴드는 이득 1.5배, 상쇄 0.5배, 무관 1.0배이며, 대구조는 '2단계 우위 = 1.25, 3단계 = 1.5, 역우위 = 0.75/0.5'처럼 단계 차이로 확장한다. 상성표는 양방향 대칭 행렬(DB 시드)로 두고, 계산은 attack 속성 × defender 저항/약점의 합산으로 수행한다.",
      "피해 공식에 상성을 끼워 넣는 순서가 중요하다. 표준 순서는 (기본 데미지 → 방어력 감산/비율 → 속성 배율 → 치명타 → 버프/디버프 → 랜덤 변동 ±5%)이며, 속성 배율을 방어력 앞에 두면 방어력이 상성의 의미를 흡수해버린다. 저항(resist)은 상성과 별개 스탯으로 합산되어 최대 75%로 클램프된다.",
    ],
    blocks: [
      {
        lang: "PostgreSQL DDL + Seed",
        code: `CREATE TABLE element_chart (
  atk_el   VARCHAR(8) NOT NULL,   -- fire | water | wind | earth | light | dark
  def_el   VARCHAR(8) NOT NULL,
  mult     NUMERIC(4,2) NOT NULL, -- 1.50 이득, 0.50 상쇄, 1.00 무관
  PRIMARY KEY (atk_el, def_el)
);
INSERT INTO element_chart (atk_el, def_el, mult) VALUES
  ('fire',  'water', 0.50), ('fire',  'wind',  1.50),
  ('fire',  'earth', 1.00), ('fire',  'fire',  0.50),
  ('water', 'fire',  1.50), ('water', 'earth', 1.50),
  ('water', 'wind',  1.00), ('water', 'water', 0.50),
  ('wind',  'earth', 1.50), ('wind',  'fire',  1.00),
  ('wind',  'water', 0.50), ('wind',  'wind',  0.50),
  ('earth', 'fire',  1.00), ('earth', 'water', 0.50),
  ('earth', 'wind',  1.00), ('earth', 'earth', 0.50);

ALTER TABLE characters
  ADD COLUMN element VARCHAR(8) DEFAULT 'fire',
  ADD COLUMN resist_fire SMALLINT DEFAULT 0,
  ADD COLUMN resist_water SMALLINT DEFAULT 0,
  ADD COLUMN resist_wind SMALLINT DEFAULT 0,
  ADD COLUMN resist_earth SMALLINT DEFAULT 0;   -- 단위 %, 상한 75`,
      },
      {
        lang: "src/combat/Elemental.ts — 피해 합성 파이프라인",
        code: `import type { StatMod } from "../game/StatMath";

export type Element = "fire" | "water" | "wind" | "earth" | "light" | "dark";

/** 상성표 → O(1) 조회용 Map (부팅 시 시드 로드) */
export function buildChart(rows: { atk_el: Element; def_el: Element; mult: number }[]) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.atk_el + ">" + r.def_el, Number(r.mult));
  return (atk: Element, def: Element) => m.get(atk + ">" + def) ?? 1.0;
}

export interface DamageCtx {
  baseAtk: number;                 // 공격자 2차 스탯 atk/matk
  defVal: number;                  // 방어자 def
  defLevel: number;
  element: Element;                // 공격 속성
  defenderElement: Element;
  resistPct: number;               // 방어자 해당 속성 저항(%)
  critChance: number; critMult: number;
  buffs: StatMod[];                // 공격자 증폭 버프(mul 합산)
  rng?: () => number;              // 서버 결정론 RNG 주입
}

/** 표준 파이프라인: 기본 → 방어 → 속성 → 치명 → 버프 → 랜덤 */
export function computeDamage(c: DamageCtx, chart: (a: Element, d: Element) => number) {
  const rng = c.rng ?? Math.random;

  // 1) 방어력 감산(레벨 보정): dmg = atk * (1 - def/(def + 100 + 20*lvl))
  const mitig = 1 - c.defVal / (c.defVal + 100 + 20 * c.defLevel);
  let dmg = c.baseAtk * Math.max(0.15, mitig);     // 최소 관통 15%

  // 2) 속성 배율(방어 이후 적용이 표준)
  const elMult = chart(c.element, c.defenderElement);
  dmg *= elMult;

  // 3) 저항(별개 스탯, 상한 75%)
  dmg *= 1 - Math.min(75, c.resistPct) / 100;

  // 4) 치명타
  const isCrit = rng() * 100 < c.critChance;
  if (isCrit) dmg *= c.critMult;                   // 보통 1.5~2.0

  // 5) 버프 합산(mul 합 → 곱)
  let mul = 0;
  for (const b of c.buffs) if (b.mul) mul += b.mul;
  dmg *= 1 + mul;

  // 6) 랜덤 변동 ±5% (전투 반복 단조로움 제거)
  dmg *= 0.95 + rng() * 0.10;

  return { dmg: Math.max(1, Math.round(dmg)), crit: isCrit, elMult };
}

// 클라 UI용 예측(전투 시뮬레이터):
// avg = computeDamage({...ctx, rng: () => 0.5, critChance: 0}, chart).dmg
// DPS 추정치를 스킬 패널에 표시할 때 사용`,
      },
    ],
    tips: [
      "상성 배율은 방어력 이후에 적용해야 '강한 속성 = 방어 무시' 같은 해석 혼란이 없다.",
      "저항 상한 75%는 필수다 — 100% 저항은 '해당 속성 콘텐츠 무력화'로 이어져 기획을 무너뜨린다.",
      "랜덤 변동 ±5%는 결정론 RNG(서버 시드)로 수행해 리플레이/감사에서 동일 결과를 재현 가능하게 한다.",
      "상성표는 시드 데이터로만 관리하고 코드에 하드코딩하지 않는다 — 신규 원소 추가가 INSERT 한 줄로 끝나야 한다.",
    ],
  },
  {
    id: "040",
    title: "전투 피드백 연출 (화면 흔들림, 데미지 텍스트 팝업, 피격 이펙트)",
    role: [
      "전투의 손맛은 판정이 아니라 피드백에서 나온다. 이 모듈은 세 계층으로 구성된다. 화면 흔들림(카메라 셰이크, 강도/지속/감쇠), 데미지 텍스트(등장-부상-소멸 3단계 트윈, 치명타/회피/속성별 색상), 피격 이펙트(히트 스파클, 피격 플래시, 넉백 모션)다. 모든 연출은 이벤트 구동으로 — 서버 히트 이벤트를 수신하면 연출 큐에 넣고, 프레임당 연출 수 상한을 두어 대규모 전투에서 프레임이 버티게 한다.",
      "성능 장치는 필수다. 데미지 텍스트는 비트맵 폰트(001번)로 렌더하고 오브젝트 풀로 재사용하며, 화면 밖 히트는 텍스트를 생략한다. 셰이크는 카메라 오프셋만 조작해 물리 오브젝트에 영향을 주지 않고, 임계 이상의 동시 연출은 '중요도'로 걸러 보스 기술은 무조건 남긴다. 피격 플래시는 스프라이트 틴트(하얀색 0.1초)로 저비용 구현한다.",
    ],
    blocks: [
      {
        lang: "src/combat/CombatFeedback.ts — Phaser 연출 관리자",
        code: `import Phaser from "phaser";

export interface HitEvent {
  targetX: number; targetY: number;
  dmg: number; crit: boolean; miss: boolean;
  element?: "fire" | "water" | "wind" | "earth";
  importance?: 0 | 1 | 2;             // 2 = 보스기 (항상 연출)
}

const ELEMENT_COLOR: Record<string, number> = {
  fire: 0xff7a45, water: 0x4aa3ff, wind: 0x7ee8a2, earth: 0xd4a030,
};

export class CombatFeedback {
  private textPool: Phaser.GameObjects.BitmapText[] = [];
  private queue: HitEvent[] = [];
  private shakeTime = 0; private shakeIntensity = 0;
  private static MAX_TEXTS_PER_FRAME = 12;

  constructor(private scene: Phaser.Scene) {}

  /** 서버 히트 이벤트 수신 → 큐잉(중요도 낮은 과다 연출은 스킵) */
  push(e: HitEvent) {
    if ((e.importance ?? 0) < 2 && this.queue.length > 20) return;
    this.queue.push(e);
  }

  /** 렌더 단계에서 소화 */
  drain() {
    let budget = CombatFeedback.MAX_TEXTS_PER_FRAME;
    while (this.queue.length && budget-- > 0) {
      const e = this.queue.shift()!;
      this.spawnDamageText(e);
      this.spawnHitFx(e);
    }
  }

  private spawnDamageText(e: HitEvent) {
    const color = e.miss ? "#9aa0a6"
      : e.crit ? "#ffd75e"
      : e.element ? "#" + ELEMENT_COLOR[e.element].toString(16).padStart(6, "0")
      : "#ffffff";
    const label = e.miss ? "MISS" : (e.crit ? e.dmg + "!" : String(e.dmg));

    let txt = this.textPool.pop();
    if (!txt) {
      txt = this.scene.add.bitmapText(0, 0, "dmgfont", label, 22)
        .setDepth(5000).setOrigin(0.5);
    }
    txt.setText(label).setColor(color)
      .setPosition(e.targetX + (Math.random() * 24 - 12), e.targetY - 24)
      .setAlpha(1).setScale(e.crit ? 1.5 : 1).setVisible(true);

    // 3단계 트윈: 등장 팝 → 부상 → 페이드
    this.scene.tweens.add({
      targets: txt, y: e.targetY - 52, alpha: 0, duration: 700, ease: "Cubic.out",
      onComplete: () => { txt!.setVisible(false); this.textPool.push(txt!); },
    });
    if (e.crit) {
      this.scene.tweens.add({
        targets: txt, scale: { from: 1.6, to: 1.1 }, duration: 180, yoyo: false,
      });
    }
  }

  private spawnHitFx(e: HitEvent) {
    if (e.miss) return;
    // 히트 스파클: 단일 프레임 이펙트 프리팹 재사용(009번 메모리 규율)
    const spark = this.scene.add.sprite(e.targetX, e.targetY, "fx_hit").setDepth(4900);
    spark.play("fx_hit_anim");
    spark.once("animationcomplete", () => spark.destroy());

    // 피격 플래시는 대상 스프라이트 틴트로 처리(호출부에서 setTintFill → clearTint)
    if ((e.importance ?? 0) >= 1) this.shake(120, 0.004);
  }

  /** 화면 흔들림: 카메라 오프셋만 조작 */
  shake(durationMs: number, intensity: number) {
    this.shakeTime = Math.max(this.shakeTime, durationMs);
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  /** 고정 업데이트: 셰이크 감쇠 */
  fixedUpdate(dtMs: number) {
    const cam = this.scene.cameras.main;
    if (this.shakeTime > 0) {
      this.shakeTime -= dtMs;
      const decay = Math.max(0, this.shakeTime / 120);
      cam.setFollowOffset(
        (Math.random() - 0.5) * this.shakeIntensity * decay * 100,
        (Math.random() - 0.5) * this.shakeIntensity * decay * 100,
      );
      if (this.shakeTime <= 0) { cam.setFollowOffset(0, 0); this.shakeIntensity = 0; }
    }
  }
}`,
      },
    ],
    tips: [
      "데미지 텍스트는 비트맵 폰트 + 오브젝트 풀이 표준이다 — 일반 텍스트는 100개만 넘어도 프레임이 무너진다.",
      "프레임당 연출 예산(12개)은 대규모 전투(파티 8명 x 몹 50)에서 필수며, 보스기(importance 2)는 예산 무시로 우선시한다.",
      "셰이크는 카메라 followOffset만 흔든다 — 월드 좌표를 흔들면 판정 좌표와 화면이 어긋난다.",
      "피격 플래시(setTintFill 흰색 0.1초)는 가장 저렴하면서 효과가 확실한 타격감 장치다.",
    ],
  },
];
