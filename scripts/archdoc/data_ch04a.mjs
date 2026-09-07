// 모듈 4 (031~035): 전투 및 액션 메커니즘 — 전반부
// 스택: TypeScript, Phaser 3/PixiJS 물리, uWebSockets.js

export const items = [
  {
    id: "031",
    title: "2D Hitbox / Hurtbox 충돌 판정 (원, 부채꼴, 직사각형)",
    role: [
      "탑다운 MMORPG의 스킬 판정은 세 형태로 충분하다. 원(AOE 폭발), 부채꼴(전방 베기), 회전 직사각형(직선 찌르기/휩쓸기)이다. 판정은 모두 '포인트(대상 중심) vs 셰이프' 또는 '원 vs 셰이프'의 거리 계산으로 해결하며, 서버(015번 LagComp)와 클라(프리뷰 이펙트)가 동일 함수를 공유한다. 범위 판정은 스킬 정의에 shape+r/angle/width를 데이터로 두어 기획 조정이 코드 수정 없이 가능해야 한다.",
      "성능을 위해 판정 전 반드시 넓은 단계(broad phase)를 거친다. 먼저 원 반경(스킬 최대 사거리)으로 대상을 거르고, 남은 소수 대상에만 정밀 기하(부채꼴 각도, OBB)를 적용한다. 대상 200~300개 기준으로 이 2단계 구조는 전체 정밀 판정 대비 수십 배 빠르다.",
    ],
    blocks: [
      {
        lang: "src/combat/hitbox.ts — 3형태 판정 기하",
        code: `export interface Vec { x: number; y: number; }

/** 원: 포인트가 반경 내 (음수 = 충돌) */
export function distPointCircle(px: number, py: number, cx: number, cy: number, r: number): number {
  return Math.hypot(px - cx, py - cy) - r;
}

/** 부채꼴: 반경 + 중심각 내 (dir = 라디안, angle = 전체 각도) */
export function distPointSector(
  px: number, py: number, cx: number, cy: number, r: number, angle: number, dir: number,
): number {
  const dx = px - cx, dy = py - cy;
  const dist = Math.hypot(dx, dy);
  if (dist > r) return dist - r;
  // 각도 차이를 [-PI, PI]로 정규화
  let diff = Math.atan2(dy, dx) - dir;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) > angle / 2) return 0.001;   // 각도 밖 = 미충돌(양수)
  return -0.001;
}

/** 회전 직사각형(OBB): 로컬 좌표 변환 후 AABB 판정 */
export function distPointRect(
  px: number, py: number, cx: number, cy: number, w: number, h: number, dir: number,
): number {
  const cos = Math.cos(-dir), sin = Math.sin(-dir);
  const dx = px - cx, dy = py - cy;
  const lx = dx * cos - dy * sin;   // 로컬 X (길이 방향)
  const ly = dx * sin + dy * cos;   // 로컬 Y (폭 방향)
  const hw = w / 2, hh = h / 2;
  const ox = Math.max(Math.abs(lx) - hw, 0);
  const oy = Math.max(Math.abs(ly) - hh, 0);
  return Math.hypot(ox, oy) === 0 ? -0.001 : Math.hypot(ox, oy);
}

/** 원 vs 부채꼴(대상 hurtbox 반경 감안) */
export function circleInSector(
  px: number, py: number, pr: number,
  cx: number, cy: number, r: number, angle: number, dir: number,
): boolean {
  const dx = px - cx, dy = py - cy;
  const dist = Math.hypot(dx, dy);
  if (dist - pr > r) return false;                       // 반경(대상 반경 감안)
  let diff = Math.atan2(dy, dx) - dir;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  // 대상이 클수록 각도 여유도 곱해주는 보정
  const allow = angle / 2 + Math.atan2(pr, Math.max(1, dist));
  return Math.abs(diff) <= allow;
}

/** broad phase: 사거리 원으로 1차 거르기 */
export function inBroadRange(
  self: Vec, target: Vec, maxReach: number, targetRadius = 16,
): boolean {
  return Math.hypot(target.x - self.x, target.y - self.y) <= maxReach + targetRadius;
}`,
      },
      {
        lang: "src/combat/HitResolver.ts — 스킬 셰이프 기반 다중 판정",
        code: `import { Vec, distPointCircle, circleInSector, distPointRect, inBroadRange } from "./hitbox";

export type SkillShape =
  | { kind: "circle"; r: number }
  | { kind: "sector"; r: number; angle: number }
  | { kind: "rect"; w: number; h: number };

export interface Combatant { id: number; x: number; y: number; radius: number; dead: boolean; team: number; }

export function resolveHits(
  self: Vec & { id: number; team: number },
  dir: number,
  shape: SkillShape,
  reach: number,
  all: Combatant[],
): number[] {
  const maxReach = shape.kind === "circle" ? shape.r
    : shape.kind === "sector" ? shape.r
    : Math.max(shape.w, shape.h);
  const hits: number[] = [];

  for (const t of all) {
    if (t.dead || t.team === self.team) continue;
    if (!inBroadRange(self, t, maxReach, t.radius)) continue;   // 1차 거름
    let hit = false;
    switch (shape.kind) {
      case "circle":
        hit = distPointCircle(t.x, t.y, self.x, self.y, shape.r + t.radius) <= 0;
        break;
      case "sector":
        hit = circleInSector(t.x, t.y, t.radius, self.x, self.y, shape.r, shape.angle, dir);
        break;
      case "rect":
        hit = distPointRect(t.x, t.y, self.x, self.y, shape.w, shape.h, dir) < t.radius;
        break;
    }
    if (hit) hits.push(t.id);
  }
  return hits;
}`,
      },
    ],
    tips: [
      "부채꼴 각도 차이는 반드시 atan2 정규화([-PI, PI]) 후 비교한다 — 359도와 1도의 차이를 358도로 계산하는 버그가 가장 흔하다.",
      "판정 대상 반경(hurtbox radius)을 판정에 곱하면 '살짝 겹친 베기'가 자연스럽게 히트된다 — 픽셀 단위 엄격 판정은 조작감을 나쁘게 만든다.",
      "서버는 클라 프리뷰와 같은 함수를 공유하되, 최종 판정은 서버(015번)만 유효하다 — 클라 판정은 이펙트 표시 용도다.",
      "rect 판정의 dir은 스킬 발동 순간의 조준 방향으로 고정한다 — 판정 중 방향을 추적하면 유저가 피할 수 없다.",
    ],
  },
  {
    id: "032",
    title: "스킬 쿨타임 및 자원(MP, 기력) 소모/회복 관리자",
    role: [
      "쿨타임·자원 관리는 '스킬 사용 가능 여부의 단일 진실'이며, 클라 UI(버튼 활성화)와 서버(사용 승인)가 같은 규칙을 공유한다. 구조는 스킬별 상태(마지막 사용 틱, 쿨타임 ms, 소모 MP)를 Map으로 관리하고, CDR(쿨타임 감소 버프)은 '고정 감소(ms)'와 '비율 감소(%)'로 분리 계산한다. 자원은 MP(스킬)와 기력(격투 계열)처럼 복수 자원을 지원하며, 재생량은 초당 기본 재생 + 버프/스킬 효과로 합산된다.",
      "핵심 방어는 서버 승인이다. 클라가 스킬 사용을 요청하면 서버는 (1) 쿨타임 잔여 확인, (2) MP 잔여 확인, (3) 상태(CC 여부) 확인 후 소모를 적용한다. 클라 UI는 예측으로 버튼을 즉시 돌리되, 서버 거절(reject) 수신 시 버튼 상태를 롤백하고 자원 바를 서버값으로 재동기화한다. 이 구조는 핵의 '무한 MP'와 '쿨타임 무시'를 구조적으로 막는다.",
    ],
    blocks: [
      {
        lang: "src/combat/ResourceMgr.ts — 클라·서버 공용",
        code: `export interface SkillCost { mp?: number; stamina?: number; }
export interface SkillCdState { lastUsed: number; cdMs: number; }

export class ResourceMgr {
  private cds = new Map<string, SkillCdState>();
  private mp: number; private mpMax: number;
  private stamina: number; private staminaMax: number;
  private mpRegenPerSec = 12;          // 기본 재생
  private stRegenPerSec = 8;
  private cdReductionMs = 0;           // 고정 CDR
  private cdReductionPct = 0;          // 비율 CDR(0.2 = -20%)

  constructor(mpMax: number, stMax: number, now: number) {
    this.mp = mpMax; this.stamina = stMax;
    this.mpMax = mpMax; this.staminaMax = stMax;
  }

  applyBuff(buff: { cdFlat?: number; cdPct?: number; mpRegen?: number }) {
    if (buff.cdFlat) this.cdReductionMs += buff.cdFlat;
    if (buff.cdPct) this.cdReductionPct = Math.min(0.6, this.cdReductionPct + buff.cdPct);
    if (buff.mpRegen) this.mpRegenPerSec += buff.mpRegen;
  }

  /** 실제 쿨타임: 비율 감소 후 고정 감소, 하한 100ms */
  effectiveCd(skillId: string, baseMs: number): number {
    let cd = baseMs * (1 - this.cdReductionPct);
    cd -= this.cdReductionMs;
    return Math.max(100, cd);
  }

  /** 사용 가능 여부(클라 UI 프리뷰 & 서버 승인 동일 로직) */
  canUse(skillId: string, cost: SkillCost, baseCdMs: number, now: number,
         ccState: "free" | "stunned" | "silenced"): { ok: boolean; reason?: string } {
    if (ccState === "stunned" || ccState === "silenced") return { ok: false, reason: "cc" };
    const st = this.cds.get(skillId);
    if (st && now - st.lastUsed < this.effectiveCd(skillId, baseCdMs))
      return { ok: false, reason: "cooldown" };
    if ((cost.mp ?? 0) > this.mp) return { ok: false, reason: "mp" };
    if ((cost.stamina ?? 0) > this.stamina) return { ok: false, reason: "stamina" };
    return { ok: true };
  }

  /** 소모 적용(서버 승인 또는 클라 예측) */
  consume(skillId: string, cost: SkillCost, baseCdMs: number, now: number) {
    this.cds.set(skillId, { lastUsed: now, cdMs: this.effectiveCd(skillId, baseCdMs) });
    this.mp -= cost.mp ?? 0;
    this.stamina -= cost.stamina ?? 0;
  }

  /** 고정 업데이트: 자원 재생 */
  fixedUpdate(dtMs: number, moving: boolean) {
    const dt = dtMs / 1000;
    this.mp = Math.min(this.mpMax, this.mp + this.mpRegenPerSec * dt * (moving ? 0.6 : 1));
    this.stamina = Math.min(this.staminaMax, this.stamina + this.stRegenPerSec * dt);
  }

  /** 쿨타임 잔여(버튼 게이지 표시용) */
  cdRemain(skillId: string, now: number): number {
    const st = this.cds.get(skillId);
    if (!st) return 0;
    return Math.max(0, st.cdMs - (now - st.lastUsed));
  }
  get Mp() { return this.mp; } get MpMax() { return this.mpMax; }
  get Stamina() { return this.stamina; }
}`,
      },
      {
        lang: "서버 승인 핸들러 발췌",
        code: `// server/combat/handleSkill.ts (발췌)
import type uWS from "uWebSockets.js";

export function handleSkillUse(ws: uWS.WebSocket, skillId: string) {
  const p = players.get(ws)!;
  const def = skillDefs.get(skillId)!;

  // CC 상태 확인(035번) → 쿨타임/자원 검증(위 ResourceMgr 재사용)
  const gate = p.resource.canUse(skillId, def.cost, def.cdMs, p.now, p.ccState);
  if (!gate.ok) {
    // 클라에 거절 사유 통보 → 클라는 버튼 롤백
    send(ws, { t: "skill_reject", skillId, reason: gate.reason });
    return;
  }
  p.resource.consume(skillId, def.cost, def.cdMs, p.now);

  // 데미지 판정(031/015번) → 결과 브로드캐스트(AOI 토픽, 013번)
  const hits = lagComp.judge(buildAttackPacket(p, def), currentTick, tickStates);
  applyDamage(hits, def.dmg, p);
  publishSkillEffect(p, skillId, hits);   // 이펙트는 저우선순위(002번)로 전송
}`,
      },
    ],
    tips: [
      "canUse는 클라 프리뷰와 서버 승인이 완전히 같은 함수여야 한다 — 조건이 갈라지면 UI와 실제가 어긋난다.",
      "CDR 하한(쿨타임 100ms 이상)은 반드시 둔다 — 무한 CDR 스택은 서버 틱을 포화시키는 DoS가 된다.",
      "이동 중 MP 재생 감소(60%) 같은 컨텍스트 요소는 전투 밸런스의 숨은 축이다 — 상수로 두고 튜닝한다.",
      "거절 사유를 클라에 명시적으로 보내야 UI가 정확히 반응한다(쿨타임 빨간 깜빡임 vs MP 부족 흔들림).",
    ],
  },
  {
    id: "033",
    title: "모바일용 오토 배틀(Auto-Battle) 타겟팅 & 이동 AI",
    role: [
      "오토 배틀은 '타겟 선택 → 접근 이동 → 스킬 사이클 → 위험 회피'의 상태머신이다. 타겟 선택은 (1) 시야 내 유효 대상 수집, (2) 위협도 점수(거리 가깝고 HP 낮을수록 고득점), (3) 죽이기 쉬운 대상 우선(잡몹 사냥)의 가중치 합으로 결정한다. 이동은 경로(BFS/A*, 043번)와 직선 이동을 하이브리드로 — 시야 직선이면 즉시 이동, 벽이 있으면 경로 계산한다.",
      "생존성 장치가 핵심이다. HP가 회복 물 소모선 이하이면 물 마시고, 주변 적이 임계 수 이상이면 열린 방향으로 후퇴하며, 쿨타임 대기 중에는 사거리 유지(카이팅)를 한다. 모바일 특성상 '전투와 무관한 패킷 최소화'도 목표로, 오토 모드 중에는 불필요한 카메라 이동·이펙트 재생을 줄여 배터리를 아낀다.",
    ],
    blocks: [
      {
        lang: "src/combat/AutoBattle.ts — 상태머신",
        code: `import type { Vec } from "./hitbox";

export interface AutoTarget {
  id: number; x: number; y: number; hp: number; maxHp: number;
  isBoss: boolean; radius: number;
}
export interface AutoSkill { id: string; range: number; cd: number; mp: number; ready: boolean; }
export type AutoState = "idle" | "approach" | "attack" | "kite" | "retreat" | "potion";

export class AutoBattle {
  state: AutoState = "idle";
  private targetId: number | null = null;
  private targetLostAt = 0;

  constructor(
    private cfg: {
      aggroRange: number;         // 시야(타겟 탐색 반경)
      retargetMs: number;         // 타겟 재평가 주기
      hpPotionPct: number;        // 물 마시는 HP 임계
      surroundedCount: number;    // 이 수 이상 포위 시 후퇴
      skillPriority: string[];    // 우선 스킬 순서
    },
    private io: {
      enemies(): AutoTarget[]; skills(): AutoSkill[];
      move(dir: Vec): void; stop(): void;
      cast(skillId: string, targetId: number): boolean;
      hp(): number; maxHp(): number; mp(): number;
      usePotion(): boolean; threat(): AutoTarget[];   // 자기 주변 적 목록
      openDir(): Vec | null;                          // 열린 후퇴 방향
    },
  ) {}

  /** 고정 업데이트(011번 예측 엔진에 이동 의도 주입) */
  tick(now: number, dtMs: number) {
    const hpPct = this.io.hp() / this.io.maxHp();

    // 1) 최우선: 생존
    if (hpPct < this.cfg.hpPotionPct && this.io.usePotion()) { this.state = "potion"; return; }
    if (this.io.threat().length >= this.cfg.surroundedCount) {
      const dir = this.io.openDir();
      if (dir) { this.io.move(dir); this.state = "retreat"; return; }
    }

    // 2) 타겟 유지/재평가
    this.refreshTarget(now);
    const t = this.currentTarget();
    if (!t) { this.io.stop(); this.state = "idle"; return; }

    // 3) 스킬 사이클(우선순위 순서로 사용 가능 첫 스킬)
    for (const id of this.cfg.skillPriority) {
      const s = this.io.skills().find(x => x.id === id);
      if (!s || !s.ready || this.io.mp() < s.mp) continue;
      const dist = Math.hypot(t.x - this.pos().x, t.y - this.pos().y);
      if (dist <= s.range && this.io.cast(s.id, t.id)) { this.state = "attack"; return; }
    }

    // 4) 접근/카이팅: 사거리 80% 유지
    const bestSkill = this.io.skills()
      .filter(s => s.ready && s.range > 0)
      .sort((a, b) => b.range - a.range)[0];
    const want = (bestSkill?.range ?? 32) * 0.8;
    const dist = Math.hypot(t.x - this.pos().x, t.y - this.pos().y);
    const dir = { x: (t.x - this.pos().x) / (dist || 1), y: (t.y - this.pos().y) / (dist || 1) };
    if (dist > want) { this.io.move(dir); this.state = "approach"; }
    else if (dist < want * 0.6) { this.io.move({ x: -dir.x, y: -dir.y }); this.state = "kite"; }
    else { this.io.stop(); this.state = "attack"; }
  }

  private refreshTarget(now: number) {
    if (this.targetId && now - this.targetLostAt < this.cfg.retargetMs) return;
    const es = this.io.enemies().filter(e =>
      Math.hypot(e.x - this.pos().x, e.y - this.pos().y) <= this.cfg.aggroRange);
    // 위협도 점수: 가까울수록, 약할수록, 보스면 가산
    let best: AutoTarget | null = null, bestScore = -Infinity;
    for (const e of es) {
      const d = Math.hypot(e.x - this.pos().x, e.y - this.pos().y);
      const score = (e.isBoss ? 500 : 0) + (e.hp / e.maxHp) * -100 - d * 0.5;
      if (score > bestScore) { bestScore = score; best = e; }
    }
    this.targetId = best?.id ?? null;
    this.targetLostAt = now;
  }
  private currentTarget(): AutoTarget | null {
    return this.targetId == null ? null : this.io.enemies().find(e => e.id === this.targetId) ?? null;
  }
  private pos(): Vec { return (this as any).pos ?? { x: 0, y: 0 }; }
}`,
      },
    ],
    tips: [
      "생존 판단(물/후퇴)은 항상 공격 사이클보다 먼저 평가한다 — 순서가 뒤바뀌면 오토는 무작정 사망한다.",
      "타겟 재평가 주기(retarget 800ms~1s)를 둬야 몹이 떠도 계속 타겟을 바꾸는 떨림(flicker)이 사라진다.",
      "사거리 80% 유지 카이팅은 근접 몹의 공격 전동작(윈드업)을 벗어나게 해 체력 소모를 크게 줄인다.",
      "포위 감지는 단순 개수(주변 적 3+)로 충분하며, 후퇴 방향은 벽 아닌 방향(그리드 스캔)에서 고른다.",
    ],
  },
  {
    id: "034",
    title: "다중 타겟팅(Tab 키, 거리순, 클릭) 선택 관리자",
    role: [
      "타겟 선택 관리자는 화면 중앙 표시(선택 링), 스킬 자동 조준, 타겟 정보 UI의 입력을 제공한다. 선택 소스는 세 가지다. Tab 키(사거리 내 대상 순환), 클릭/터치(직접 지정), 오토 배틀(033번 위임). 관리자는 이 세 소스의 우선순위를 조정하고, 타겟이 사망/시야 이탈하면 자동 폴백(가장 가까운 대상 또는 해제)한다.",
      "핵심 UX 규칙은 'Tab 순환은 시야 내 사거리 대상만, 시선 방향 근처 우선'이다. 순환 순서는 화면 중심 각도 기준 정렬해 Tab 연타가 시계 방향으로 일관되게 돌게 하며, 마지막 선택 타겟은 재선택 시 우선(스티키 타겟)으로 유지한다. 서버와의 관계에서 타겟은 클라 개념이며, 실제 스킬 판정은 히트박스(031)와 서버 판정(015)이 담당한다.",
    ],
    blocks: [
      {
        lang: "src/combat/Targeting.ts",
        code: `import type { Vec } from "./hitbox";

export interface Targetable {
  id: number; x: number; y: number; dead: boolean;
  name?: string; hpPct?: number; isBoss?: boolean;
}
export type TargetSource = "tab" | "click" | "auto" | "fallback";

export class TargetingManager {
  private currentId: number | null = null;
  private lastSource: TargetSource = "fallback";
  onSelect: ((t: Targetable | null, src: TargetSource) => void) | null = null;

  /** Tab 순환: 사거리 내 대상을 '카메라 중심 기준 각도' 순서로 다음 대상 */
  cycleTab(candidates: Targetable[], self: Vec, cameraCenter: Vec, reach: number) {
    const inReach = candidates
      .filter(c => !c.dead && Math.hypot(c.x - self.x, c.y - self.y) <= reach);
    if (!inReach.length) return this.clear();

    // 각도 정렬(시계 방향 일관 순환) — 화면 중심 기준
    const sorted = inReach.sort((a, b) => angleOf(a, cameraCenter) - angleOf(b, cameraCenter));
    const cur = this.currentId == null
      ? null : sorted.find(c => c.id === this.currentId);
    let next: Targetable;
    if (cur) {
      next = sorted[(sorted.indexOf(cur) + 1) % sorted.length];
    } else {
      // 신규 선택: 가장 가까운 대상
      next = inReach.sort((a, b) =>
        Math.hypot(a.x - self.x, a.y - self.y) - Math.hypot(b.x - self.x, b.y - self.y))[0];
    }
    this.set(next.id, "tab");
  }

  /** 클릭/터치: 히트 테스트(스크린 → 월드 좌표) */
  click(worldPos: Vec, candidates: Targetable[], tolerance = 24) {
    const hit = candidates
      .filter(c => !c.dead)
      .sort((a, b) => Math.hypot(a.x - worldPos.x, a.y - worldPos.y)
                     - Math.hypot(b.x - worldPos.x, b.y - worldPos.y))[0];
    if (hit && Math.hypot(hit.x - worldPos.x, hit.y - worldPos.y) <= tolerance + 16) {
      this.set(hit.id, "click");
    } else {
      this.clear();        // 빈 곳 클릭 = 선택 해제
    }
  }

  /** 오토 배틀(033)이 결정한 타겟 위임 */
  fromAuto(id: number | null) {
    if (id == null) return;
    this.set(id, "auto");
  }

  /** 매 프레임 유효성 검사 — 사망/이탈 시 폴백 */
  validate(candidates: Targetable[], self: Vec, reach: number) {
    const cur = candidates.find(c => c.id === this.currentId);
    if (!cur || cur.dead) {
      const near = candidates
        .filter(c => !c.dead && Math.hypot(c.x - self.x, c.y - self.y) <= reach)
        .sort((a, b) => Math.hypot(a.x - self.x, a.y - self.y)
                       - Math.hypot(b.x - self.x, b.y - self.y))[0];
      if (near) this.set(near.id, "fallback"); else this.clear();
    }
  }

  get targetId() { return this.currentId; }
  private set(id: number, src: TargetSource) {
    if (this.currentId === id) return;
    this.currentId = id; this.lastSource = src;
    this.onSelect?.(this.find?.(id) ?? null, src);
  }
  private clear() {
    if (this.currentId == null) return;
    this.currentId = null;
    this.onSelect?.(null, "fallback");
  }
  find?: (id: number) => Targetable | null;
}

function angleOf(t: Targetable, center: Vec): number {
  return Math.atan2(t.y - center.y, t.x - center.x);
}`,
      },
    ],
    tips: [
      "Tab 순환에 각도 정렬을 쓰면 연타 시 타겟이 왔다 갔다 튀는 현상이 사라진다.",
      "스티키 타겟(마지막 선택 유지)은 보스전 필수 UX다 — 다른 몹을 때려도 실수로 타겟이 바뀌면 안 된다.",
      "validate는 매 프레임이 아닌 100ms 주기로 돌려도 충분하며, 사망 이벤트 훅이 있으면 이벤트 기반으로 처리한다.",
      "선택 링 UI는 타겟 종류(잡몹/엘리트/보스)별 색상·크기를 다르게 해 위험도를 즉시 전달한다.",
    ],
  },
  {
    id: "035",
    title: "CC(기절, 둔화, 속박, 밀쳐내기) 상태 이상 타이머 및 연산",
    role: [
      "CC(군중 제어)는 상태별로 이동/행동에 미치는 효과가 다르다. 기절(stun)은 모든 행동 차단, 둔화(slow)는 이동속도 배율 감소, 속박(root)은 이동만 차단, 밀쳐내기(knockback)는 즉시 변위 + 잠깐 행동 차단이다. 상태는 '종류 + 남은 시간 + 강도' 튜플로 관리하며, 같은 종류는 갱신(강도는 max), 다른 종류는 공존한다. CC 면역(i-frame)은 상태 추가 시점에 검사해 무한 CC 사슬을 막는다.",
      "서버가 유일한 권위이며(016번 철학), 클라는 CC 상태를 받아 애니메이션(기절 별, 속박 쇠사슬)과 이동 입력 차단만 처리한다. 밀쳐내기는 서버가 목표 지점을 계산해(벽 충돌 클램프) 클라에 전송하고, 클라는 예측 이동 대신 서버 지정 궤적을 따라간다. CC 적용 로그는 PVP 항의 대응 데이터가 된다.",
    ],
    blocks: [
      {
        lang: "src/combat/CrowdControl.ts — 서버 권위 상태 관리",
        code: `import type { Vec } from "./hitbox";

export type CcKind = "stun" | "slow" | "root" | "knockback";
export interface CcInstance {
  kind: CcKind;
  until: number;            // 종료 시각(서버 기준 ms)
  strength?: number;        // slow: 속도 배율 감소(0.4 = 40% 감소)
  from?: Vec; dir?: number; // knockback 궤적
  dist?: number;
}

export interface CcBlocked { move: boolean; act: boolean; }
export interface MovementMod { speedMult: number; }

export class CcManager {
  private list: CcInstance[] = [];
  private immuneUntil = 0;

  constructor(private now: () => number, private blocked: (x: number, y: number) => boolean) {}

  /** CC 적용 시도 — 면역/중복 규칙 처리 */
  apply(cc: CcInstance): boolean {
    const now = this.now();
    if (now < this.immuneUntil) return false;
    if (cc.kind === "knockback" && this.has("knockback")) return false; // 중복 넉백 금지

    const existing = this.list.find(c => c.kind === cc.kind);
    if (existing) {
      existing.until = Math.max(existing.until, cc.until);        // 갱신 = max
      existing.strength = Math.max(existing.strength ?? 0, cc.strength ?? 0);
    } else {
      this.list.push(cc);
    }
    // CC 사슬 방지: CC 종료 후 짧은 면역(무한 스턴락 차단)
    this.immuneUntil = cc.until + 300;
    return true;
  }

  /** 현재 상태 요약(019 ResourceMgr canUse의 ccState 입력) */
  summary(): { blocked: CcBlocked; move: MovementMod; ccState: "free" | "stunned" | "silenced" } {
    const now = this.now();
    this.list = this.list.filter(c => c.until > now);
    const has = (k: CcKind) => this.list.some(c => c.kind === k);
    const slows = this.list.filter(c => c.kind === "slow");
    const speedMult = slows.length
      ? Math.min(...slows.map(c => 1 - (c.strength ?? 0))) : 1;
    return {
      blocked: { move: has("root") || has("stun"), act: has("stun") },
      move: { speedMult },
      ccState: has("stun") ? "stunned" : "free",
    };
  }

  /** knockback 궤적 계산: 서버가 목표 지점 결정(벽 클램프) */
  computeKnockback(self: Vec, dir: number, dist: number, steps = 8): Vec {
    let x = self.x, y = self.y;
    const dx = Math.cos(dir) * (dist / steps);
    const dy = Math.sin(dir) * (dist / steps);
    for (let i = 0; i < steps; i++) {
      const nx = x + dx, ny = y + dy;
      if (this.blocked(nx, ny)) break;      // 벽에 닿으면 거기서 정지
      x = nx; y = ny;
    }
    return { x, y };
  }

  private has(k: CcKind) { return this.list.some(c => c.kind === k); }
}`,
      },
    ],
    tips: [
      "같은 종류 CC는 시간 max + 강도 max로 갱신한다 — 합산하면 CC 지속이 폭증해 스턴락이 발생한다.",
      "CC 종료 후 300ms 면역(soft i-frame)은 유저가 반응할 시간을 주는 표준 장치다.",
      "밀쳐내기는 서버가 궤적 종점을 벽 충돌로 클램프해 전송한다 — 클라 자유 계산은 맵 밖 추락 버그를 낳는다.",
      "PVP에서 CC는 딜 사이클의 핵심이므로, CC 효과 감소 속성(CC 저항)을 스탯 시스템(021번)에 조기에 녹여야 한다.",
    ],
  },
];
