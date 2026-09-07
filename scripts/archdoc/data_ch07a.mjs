// 모듈 7 (061~065): 주요 콘텐츠 시스템 — 전반부
// 스택: TypeScript, Kysely, uWebSockets.js

export const items = [
  {
    id: "061",
    title: "퀘스트 트래킹(메인, 서브, 일일) 및 대화/조건 달성 체커",
    role: [
      "퀘스트 시스템은 세 유형을 하나의 체커로 처리한다. 메인(진행형 스토리 체인), 서브(독립 조건), 일일(주기 리셋 반복)이다. 퀘스트 정의는 트리(선행 의존) + 목표(type: talk/hunt/reach/collect) + 보상 구조이며, 진행 상태는 (잠금 → 진행중 → 완료대기 → 보상수령)의 상태머신이다. 대화 조건(talk)은 NPC 접촉, 사냥(hunt)은 처치 이벤트, 이동(reach)은 포탈/구역 진입 이벤트가 트리거다.",
      "조건 체커는 이벤트 버스 구독자로 — onEnemyKilled, onNpcTalk, enterPortal 등의 게임 이벤트를 받아 진행 중 퀘스트의 목표와 매칭한다. 핵심 방어는 '진행도는 서버 이벤트에서만 증가'라는 원칙이며, 클라 UI는 표시 전용이다. 일일 퀘스트는 리셋 크론(서버 시각 기준 00:00)에서 상태 초기화를 배치 수행한다.",
    ],
    blocks: [
      {
        lang: "src/game/QuestEngine.ts — 트리 + 조건 체커",
        code: `export type QuestType = "main" | "sub" | "daily";
export type ObjectiveKind = "talk" | "hunt" | "reach" | "collect";

export interface QuestObjective {
  kind: ObjectiveKind;
  targetCode: string;         // NPC 코드 / 몬스터 코드 / 지역 코드 / 아이템 코드
  count: number;              // 필요 횟수(1 = 1회성)
}
export interface QuestDef {
  id: string;
  type: QuestType;
  name: string;
  summary: string;
  requires: string[];         // 선행 퀘스트 id (빈 배열 = 즉시 수락 가능)
  minLevel: number;
  objectives: QuestObjective[];
  rewards: { gold?: number; exp?: number; items?: { code: string; qty: number }[] };
  nextId?: string;            // 체인 다음 퀘스트
}

export type QuestState = "locked" | "accepted" | "in_progress"
  | "ready_to_complete" | "completed";

export interface QuestProgress {
  defId: string; state: QuestState;
  counts: number[];           // objective별 진행도
  resetAt?: number;           // 일일 퀘스트 리셋 기준
}

export class QuestEngine {
  private progress = new Map<string, QuestProgress>();

  constructor(private defs: Map<string, QuestDef>,
              private db: { saveProgress(p: QuestProgress[]): Promise<void> }) {}

  /** 수락 가능 판정: 선행 완료 + 레벨 */
  canAccept(defId: string, level: number): boolean {
    const d = this.defs.get(defId);
    if (!d || level < d.minLevel) return false;
    return d.requires.every(r => this.progress.get(r)?.state === "completed");
  }
  accept(defId: string) {
    const d = this.defs.get(defId)!;
    this.progress.set(defId, {
      defId, state: "in_progress", counts: d.objectives.map(() => 0),
    });
  }

  /** 게임 이벤트 → 조건 매칭(서버 이벤트에서만 호출) */
  onEvent(kind: ObjectiveKind, targetCode: string, amount = 1) {
    for (const p of this.progress.values()) {
      if (p.state !== "in_progress") continue;
      const d = this.defs.get(p.defId)!;
      let changed = false;
      d.objectives.forEach((o, i) => {
        if (o.kind !== kind || o.targetCode !== targetCode) return;
        if (p.counts[i] >= o.count) return;
        p.counts[i] = Math.min(o.count, p.counts[i] + amount);
        changed = true;
      });
      if (changed && d.objectives.every((o, i) => p.counts[i] >= o.count)) {
        p.state = "ready_to_complete";
      }
    }
  }

  /** 보상 수령(서버 트랜잭션 — 재화/아이템 시스템 위임) */
  async complete(defId: string, grant: (def: QuestDef) => Promise<void>) {
    const p = this.progress.get(defId);
    if (!p || p.state !== "ready_to_complete") return false;
    const d = this.defs.get(defId)!;
    p.state = "completed";
    await grant(d);
    // 체인 연결: nextId는 즉시 수락 가능 상태가 됨(canAccept가 처리)
    return true;
  }

  /** 일일 리셋(크론): state/completed를 진행 가능으로 되돌림 */
  resetDaily(todayStart: number) {
    for (const p of this.progress.values()) {
      const d = this.defs.get(p.defId);
      if (d?.type !== "daily") continue;
      if ((p.resetAt ?? 0) < todayStart) {
        p.state = "in_progress";
        p.counts = d.objectives.map(() => 0);
        p.resetAt = todayStart;
      }
    }
  }
}`,
      },
      {
        lang: "이벤트 훅 연결 예시(WorldScene 발췌)",
        code: `// 클라/서버 게임 이벤트 → 퀘스트 체커 위임(서버에서만 진행도 증가)
// onEnemyKilled(monsterCode) → quest.onEvent("hunt", monsterCode)
// onNpcTalk(npcCode)         → quest.onEvent("talk", npcCode)
// enterPortal(mapId)         → quest.onEvent("reach", mapId)
// onItemGained(itemCode)     → quest.onEvent("collect", itemCode)

// 세이브 구조: questIdx(메인 체인 커서) + subState(서브/일일 진행도)
// 재접속 복구 시: 퀘스트 정의의 requires 체인으로 "다음 메인 퀘스트"를 자동 재배치
//  — v3.0.28 reach 버그 교훈: enterPortal에서 reach 목표 advance를 반드시 수행`,
      },
    ],
    tips: [
      "메인 체인은 nextId 링크 + requires 이중 결합으로 — 세이브 커서가 유실돼도 체인 순회로 복구 가능하다.",
      "reach 목표는 포탈/구역 진입 이벤트에서 반드시 처리한다 — 씬 전환만으로 완료 처리를 빼먹는 것이 이동 퀘스트 불완료의 최다 원인이다.",
      "일일 리셋은 유저별 리셋 시각(접속 시 보정)이 아니라 서버 단일 시각으로 — 다계정 리셋 어뷰징을 막는다.",
      "대화(talk) 조건은 NPC 접촉 반경 + 대화 UI 오픈 이벤트에서만 인정해 '지나가기만 해도 완료' 버그를 막는다.",
    ],
  },
  {
    id: "062",
    title: "일일/주간 미션 및 활동도 게이지 보상 시스템",
    role: [
      "미션 시스템은 '개별 미션 목록 + 활동도(전체 진행도 게이지)'의 이중 보상 구조다. 미션은 일일(매일 리셋)과 주간(월요일 리셋)으로 나뉘고, 각 미션은 고정 목표(로그인, 몬스터 50마리, 던전 1회 등)를 가진다. 활동도는 미션 완료 시 점수를 누적해 게이지 구간(30/60/100/140)에 도달하면 구간 보상을 지급한다 — 개별 미션과 별개로 '전체 활동성'을 보상하는 장치다.",
      "구현 핵심은 미션 정의의 통합 이벤트 스키마(061번 QuestObjective 재사용)다. 퀘스트 체커와 같은 이벤트 버스를 구독하되, 리셋 주기만 다르게 관리한다. 활동도 게이지 구간 보상은 ledger ref 멱등 지급(060번 패턴)으로 이중 지급을 방지하고, 리셋 크론은 퀘스트 리셋과 같은 배치에서 수행한다.",
    ],
    blocks: [
      {
        lang: "server/mission/DailyMission.ts",
        code: `import { Kysely } from "kysely";
type DB = import("./schema").Database;

export interface MissionDef {
  id: string; period: "daily" | "weekly";
  name: string; event: string; target: string | null; count: number;
  activityScore: number;            // 완료 시 활동도 점수
  rewards: { gold?: number; items?: { code: string; qty: number }[] };
}
export interface GaugeTier { score: number; rewards: { gold?: number; items?: any[] }; }

export class MissionService {
  constructor(private db: Kysely<DB>, private defs: MissionDef[],
              private tiers: GaugeTier[]) {}

  /** 이벤트 진행도 증가(퀘스트 체커와 동일 이벤트 버스 사용) */
  async onEvent(charId: number, event: string, target: string, amount = 1) {
    const applicable = this.defs.filter(d => d.event === event
      && (!d.target || d.target === target));
    if (!applicable.length) return;
    const today = new Date().toISOString().slice(0, 10);
    await this.db.transaction().execute(async tx => {
      for (const d of applicable) {
        const ref = "mission:" + d.id + ":" + (d.period === "daily" ? today : weekKey());
        const done = await tx.selectFrom("ledger")
          .where("ref", "=", ref).where("to_user", "=", charId).select("id").executeTakeFirst();
        if (done) continue;
        const row = await tx.selectFrom("mission_progress")
          .where("character_id", "=", charId).where("mission_id", "=", d.id)
          .select(["count", "at"]).executeTakeFirst();
        // 주간/일일 경계 판정: 마지막 갱신이 현재 주기 밖이면 리셋
        const periodKey = d.period === "daily" ? today : weekKey();
        const count = row && row.at.toISOString().slice(0, 10) === periodKey
          ? row.count + amount : amount;
        if (count >= d.count) {
          await tx.updateTable("mission_progress")
            .set({ count, completed: true, at: new Date() })
            .where("character_id", "=", charId).where("mission_id", "=", d.id).execute();
          await tx.insertInto("ledger").values({
            at: new Date(), kind: "gold", from_user: null, to_user: charId,
            ref, payload: JSON.stringify({ mission: d.id, score: d.activityScore }),
          }).execute();
          // 활동도 점수 누적
          await tx.updateTable("mission_activity")
            .set(eb => ({ score: eb("score", "+", d.activityScore) }))
            .where("character_id", "=", charId).execute();
        } else {
          await tx.updateTable("mission_progress")
            .set({ count, at: new Date() })
            .where("character_id", "=", charId).where("mission_id", "=", d.id).execute();
        }
      }
    });
  }

  /** 활동도 게이지 구간 보상 지급(멱등) */
  async settleGauge(charId: number) {
    const act = await this.db.selectFrom("mission_activity")
      .where("character_id", "=", charId).select("score").executeTakeFirst();
    if (!act) return;
    for (const t of this.tiers) {
      if (act.score < t.score) continue;
      await this.grantOnce("gauge:" + weekKey() + ":" + t.score, charId, t.rewards);
    }
  }
  private async grantOnce(ref: string, charId: number, rewards: any) {
    const paid = await this.db.selectFrom("ledger").where("ref", "=", ref)
      .where("to_user", "=", charId).select("id").executeTakeFirst();
    if (paid) return;
    await this.db.insertInto("ledger").values({
      at: new Date(), kind: "gold", from_user: null, to_user: charId,
      ref, payload: JSON.stringify(rewards),
    }).execute();
  }
}

function weekKey(): string {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;              // 월요일 = 0
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  return monday.toISOString().slice(0, 10);
}`,
      },
    ],
    tips: [
      "미션과 퀘스트는 같은 이벤트 버스(061번)를 구독하되 리셋 주기만 다르게 — 이벤트 정의가 이중으로 흩어지면 불일치 버그가 난다.",
      "활동도 점수는 '미션 완료 시점'에만 누적한다 — 진행도에 비례해 점수를 주면 계산이 복잡해지고 조작 여지가 생긴다.",
      "구간 보상 ref에 주기 키(weekKey)를 포함해야 주간 리셋 후 재지급이 자연스럽게 동작한다.",
      "일일 미션은 '로그인+사냥+던전'의 3축 골격을 유지해 유저 루틴을 만들고, 변주는 보상에서 준다.",
    ],
  },
  {
    id: "063",
    title: "인스턴스 던전 솔로/파티 매칭 및 전용 룸 세션 관리",
    role: [
      "던전 시스템은 '매칭 큐 → 전용 룸 생성 → 세션 진행(진도/전멸/보상) → 정산·해체'의 사이클이다. 솔로는 즉시 룸 생성, 파티는 파티 단위 진입, 매칭 던전은 레벨 밴드별 큐에서 4명이 모이면 룸을 생성한다. 룸 세션은 017번 RoomRegistry로 관리되며, 세션 데이터(진도, 몬스터 상태, 시간 제한)는 룸 소유 프로세스가 단일 권위로 운영한다.",
      "세션 관리의 핵심은 비정상 종료 대응이다. 유저 접속 끊김 시 60초 재접속 유예(세션 유지), 유예 경과 시 자동 탈주 처리, 전원 이탈 시 룸 DRAINING 전환을 상태머신으로 처리한다. 탈주 페널티(재매칭 대기 5분)는 매칭 품질의 핵심이며, 던전 완료 보상은 기여도(딜량+지속 시간) 기반으로 개별 지급한다.",
    ],
    blocks: [
      {
        lang: "server/dungeon/DungeonSession.ts",
        code: `import uWS from "uWebSockets.js";

export type DungeonPhase = "matching" | "prep" | "running" | "cleared" | "failed" | "draining";

export interface DungeonRoom {
  roomId: string; dungeonCode: string;
  phase: DungeonPhase;
  members: Map<number, {
    online: boolean; disconnectedAt: number | null;
    dmg: number; deaths: number; joinedAt: number;
  }>;
  progress: number;               // 진도(0~100)
  startedAt: number; timeLimitMs: number;
  readySet: Set<number>;          // prep 단계 준비 완료
}

export class DungeonSession {
  constructor(private room: DungeonRoom, private ws: uWS.WebSocket,
              private broadcast: (msg: unknown) => void) {}

  /** prep: 전원 준비 → running */
  toggleReady(charId: number): boolean {
    if (this.room.phase !== "prep") return false;
    if (this.room.readySet.has(charId)) this.room.readySet.delete(charId);
    else this.room.readySet.add(charId);
    if (this.room.readySet.size >= this.room.members.size) {
      this.room.phase = "running";
      this.room.startedAt = Date.now();
      this.broadcast({ t: "dungeon_start", timeLimit: this.room.timeLimitMs });
    }
    return true;
  }

  /** 틱: 시간 제한/전멸/이탈 감시 */
  tick(now: number) {
    if (this.room.phase !== "running") return this.sweepDisconnect(now);
    if (now - this.room.startedAt > this.room.timeLimitMs) {
      this.room.phase = "failed";                     // 시간 초과
      this.broadcast({ t: "dungeon_fail", reason: "timeout" });
      return;
    }
    this.sweepDisconnect(now);
  }

  /** 접속 끊김 유예(60초) → 탈주 처리 */
  private sweepDisconnect(now: number) {
    for (const [id, m] of this.room.members) {
      if (m.online || m.disconnectedAt == null) continue;
      if (now - m.disconnectedAt > 60_000) {
        m.online = false;
        m.disconnectedAt = null;
        this.broadcast({ t: "dungeon_member_left", charId: id });
        // 파티 던전에서 나머지가 계속 진행 가능(솔로 유저 룸만 실패 처리)
        const alive = [...this.room.members.values()].filter(x => x.online).length;
        if (alive === 0) {
          this.room.phase = "draining";
        }
      }
    }
  }
  onReconnect(charId: number) {
    const m = this.room.members.get(charId);
    if (m) { m.online = true; m.disconnectedAt = null; }
  }

  /** 클리어: 기여도 기반 개별 정산 */
  clear(now: number) {
    this.room.phase = "cleared";
    const results = [...this.room.members.entries()]
      .filter(([, m]) => m.online)
      .map(([charId, m]) => ({
        charId,
        share: m.dmg / Math.max(1, [...this.room.members.values()]
          .reduce((s, x) => s + x.dmg, 0)),
        deaths: m.deaths,
      }));
    this.broadcast({ t: "dungeon_cleared", results });
    return results;
  }
}`,
      },
    ],
    tips: [
      "매칭 밴드는 레벨 ±10%가 표준이며, 큐 대기 60초 초과 시 밴드를 단계적으로 확장(±15% → ±20%)하는 '대기 확장'이 품질과 속도의 균형이다.",
      "prep 단계 전원 준비는 필수 UX다 — 준비 없이 시작하면 텔레포트 스폰 즉시 전투에 휘말리는 불만이 쏟아진다.",
      "탈주 유예 60초는 네트워크 재접속(005번)과 같은 값으로 맞춰야 '끊김 = 탈주' 오해가 사라진다.",
      "던전 진도는 체크포인트(구역 진입) 단위로 저장해 전멸 재시작이 구역 단위로 되게 하면 난이도 체감이 급격히 완화된다.",
    ],
  },
  {
    id: "064",
    title: "필드 보스 스폰 타이머, 알림 및 기여도(딜량)별 아이템 분배 로직",
    role: [
      "필드 보스는 '스폰 스케줄(죽은 시각 + 리젠 주기) → 사전 알림 → 등장 → 전투 → 기여도 정산'의 라이프사이클을 갖는다. 스폰 타이머는 서버 단일 권위로 관리하되, 예상 리젠 시각을 클라 UI에 노출(몇 분 후)해 유저가 계획하게 한다. 알림은 3단계(등장 5분 전, 직전 30초, 등장 즉시)로 채널 방송(051번 시스템 채널 + 049번 이벤트 배너)한다.",
      "정산은 '기여도 테이블(딜량 누적) → 등급 분배' 방식이 표준이다. 전체 딜량에 대한 각자 비율로 등급(상위 10% = 3개, 30% = 2개, 그 외 = 1개, 최소 참여 미달 = 0개)을 나눠 지급하고, 라스트 히트 보너스는 별도 소액으로 준다. 어그로를 끌지 않고 딜만 넣는 유저도 기여도로 인정되며, 첫 10초 미참여(딜 0) 유저는 배제해 관전 참여를 막는다.",
    ],
    blocks: [
      {
        lang: "server/boss/FieldBoss.ts",
        code: `import uWS from "uWebSockets.js";

export interface BossSchedule {
  bossCode: string; mapId: string;
  spawnIntervalMs: number;          // 리젠 주기
  announceBeforeMs: number;         // 등장 전 알림(5분)
  dropTier: { ratio: number; items: { code: string; qty: number }[] }[];
  minParticipationMs: number;       // 최소 참여 시간
}

export interface BossInstance {
  bossCode: string; spawnedAt: number;
  aggroTable: Map<number, { dmg: number; firstHitAt: number; lastHitAt: number }>;
  dead: boolean;
}
export class FieldBossManager {
  private nextSpawnAt = new Map<string, number>();
  private current: BossInstance | null = null;

  constructor(private defs: BossSchedule[], private notify: (msg: unknown) => void) {}

  /** 서버 틱: 스폰/알림 감시 */
  tick(now: number) {
    for (const def of this.defs) {
      const next = this.nextSpawnAt.get(def.bossCode) ?? 0;
      if (this.current || next === 0) {
        if (!next) this.nextSpawnAt.set(def.bossCode, now + def.spawnIntervalMs);
        continue;
      }
      const remain = next - now;
      if (remain <= 0) {
        this.current = { bossCode: def.bossCode, spawnedAt: now,
          aggroTable: new Map(), dead: false };
        this.notify({ t: "boss_spawn", boss: def.bossCode, map: def.mapId });
      } else if (remain <= def.announceBeforeMs && !this.warned.get(def.bossCode)) {
        this.warned.set(def.bossCode, true);
        this.notify({ t: "boss_preannounce", boss: def.bossCode,
                      inMs: remain });
      }
    }
  }
  private warned = new Map<string, boolean>();

  /** 데미지 기록(서버 전투 판정에서 호출) */
  onDamage(charId: number, dmg: number, now: number) {
    if (!this.current || this.current.dead) return;
    const e = this.current.aggroTable.get(charId)
      ?? { dmg: 0, firstHitAt: now, lastHitAt: now };
    e.dmg += dmg; e.lastHitAt = now;
    this.current.aggroTable.set(charId, e);
  }

  /** 사망 정산: 기여도 등급별 지급 */
  async onDeath(now: number, def: BossSchedule, grant: (charId: number, items: any[]) => Promise<void>) {
    const inst = this.current!;
    inst.dead = true;
    this.current = null;
    this.warned.delete(def.bossCode);
    this.nextSpawnAt.set(def.bossCode, now + def.spawnIntervalMs);

    // 최소 참여(시간) 필터
    const entries = [...inst.aggroTable.entries()]
      .filter(([, e]) => e.lastHitAt - e.firstHitAt >= def.minParticipationMs
                      || e.dmg > 0);
    const totalDmg = entries.reduce((s, [, e]) => s + e.dmg, 0);
    if (!totalDmg) return;

    // 비율 누적 → 등급 배정
    const sorted = entries.sort((a, b) => b[1].dmg - a[1].dmg);
    let cumulative = 0;
    for (let i = 0; i < sorted.length; i++) {
      const [charId, e] = sorted[i];
      cumulative += e.dmg / totalDmg;
      const tier = i === 0 && cumulative <= 0.1 ? def.dropTier[0]
        : cumulative <= 0.3 ? def.dropTier[1]
        : def.dropTier[def.dropTier.length - 1];
      await grant(charId, tier.items);
    }
    // 라스트 히트 소액 보너스
    const last = sorted[0];
    if (last) await grant(last[0], [{ code: "bonus_last_hit", qty: 1 }]);
    this.notify({ t: "boss_defeated", boss: def.bossCode, participants: sorted.length });
  }
}`,
      },
    ],
    tips: [
      "리젠 시각 노출(몇 분 후)은 서버가 권위로 알려줘야 합니다 — 클라 추측 시각은 어긋나면 불신을 산다.",
      "기여도 등급 분배는 '비율 누적(cumulative)' 방식으로 상위 점유율을 안정적으로 반영한다 — 절대 딜량 컷은 파티 구성에 따라 공정성이 깨진다.",
      "최소 참여 시간(10초) 게이팅은 관전자 무료 승차를 막는 최소한의 장치다.",
      "라스트 히트 보너스는 소액으로 — 커지면 '아군 기술 뺏기' 전쟁이 벌어진다.",
    ],
  },
  {
    id: "065",
    title: "PvP 전장 및 PK 카오스(성향치) 시스템 메커니즘",
    role: [
      "PvP 시스템은 두 축으로 나뉜다. 전장(인스턴스 — 진영전, 8v8 등, 규칙성 보상)과 야외 PK(필드 자유 공격 + 성향치 패널티)다. 야외 PK는 성향치(karma)로 통제한다. 타인을 죽이면 성향이 음수로 떨어지고, 음수 구간(카오스)에서는 사망 페널티(장비 드롭 확률), 상점 이용 제한, 가드 NPC 공격 대상이 된다. 성향은 시간 경과 또는 정화 아이템으로 회복된다.",
      "구현 포인트는 PK 판정의 무죄 조건이다. 동의 전투(결투 신청 수락), 전장 내부, 자기방어(먼저 공격한 상대 처치)는 성향 패널티가 없다. 서버는 전투 관계 테이블(누가 누구를 먼저 때렸는지, 결투 동의 여부)을 유지해 사망 시점에 판정한다. 카오스 유저는 시각 표시(빨간 이름)로 피해자가 위험을 인지하게 한다.",
    ],
    blocks: [
      {
        lang: "server/pvp/Karma.ts",
        code: `import { Kysely } from "kysely";
type DB = import("./schema").Database;

export interface PvpContext {
  inBattlefield: boolean;        // 전장/결투장 내부
  duelAccepted: boolean;         // 상호 결투 동의
  victimAttackedFirst: boolean;  // 피해자가 먼저 공격(자기방어)
}

const KARMA_KILL = -30;
const KARMA_RECOVER_PER_HOUR = 5;
export const KARMA_CHAOS = -100;   // 이 이하 = 카오스
export const KARMA_NEUTRAL = 0;

export class KarmaService {
  constructor(private db: Kysely<DB>) {}

  /** 킬 판정: 무죄 조건 확인 후 성향 감소 */
  async onPlayerKill(killerId: number, ctx: PvpContext) {
    const innocent = ctx.inBattlefield || ctx.duelAccepted || ctx.victimAttackedFirst;
    if (innocent) return { penalty: 0 };
    const delta = KARMA_KILL;
    await this.db.updateTable("characters")
      .set(eb => ({ karma: eb("karma", "+", delta) }))
      .where("id", "=", killerId).execute();
    return { penalty: delta };
  }

  /** 시간 회복(로그인 시 1회 + 주기 배치) */
  async recoverOnLogin(charId: number, offlineHours: number) {
    const ch = await this.db.selectFrom("characters").where("id", "=", charId)
      .select("karma").executeTakeFirstOrThrow();
    if (ch.karma >= KARMA_NEUTRAL) return ch.karma;
    const recovered = Math.min(KARMA_NEUTRAL,
      ch.karma + KARMA_RECOVER_PER_HOUR * Math.floor(offlineHours));
    await this.db.updateTable("characters").set({ karma: recovered })
      .where("id", "=", charId).execute();
    return recovered;
  }

  /** 카오스 상태 판정(클라 이름색/상점/가드 로직 입력) */
  static isChaos(karma: number) { return karma <= KARMA_CHAOS; }
  static nameColor(karma: number): number {
    if (KarmaService.isChaos(karma)) return 0xff4444;      // 빨강
    if (karma < 0) return 0xffaa44;                        // 주황
    return 0x9ad8ff;                                       // 기본
  }

  /** 카오스 사망 페널티: 장비 드롭 확률 */
  static deathDropChance(karma: number): number {
    if (!KarmaService.isChaos(karma)) return 0;
    const depth = Math.min(3, Math.floor((KARMA_CHAOS - karma) / 100)); // 단계
    return 0.15 + depth * 0.15;                            // 15/30/45%
  }
}

/** 전장(인스턴스) 스코어: 킬/오브젝트 → 팀 점수, 종료 보상 */
export class Battlefield {
  scores = { red: 0, blue: 0 };
  constructor(private limit: number, private onEnd: (winner: "red" | "blue") => void) {}
  addScore(team: "red" | "blue", v = 1) {
    this.scores[team] += v;
    if (this.scores[team] >= this.limit) this.onEnd(team);
  }
}`,
      },
    ],
    tips: [
      "성향 판정은 사망 시점의 관계 테이블(먼저 공격한 자, 결투 동의)로 — '먼저 때린 쪽이 피해자 사망 시 무죄' 규칙이 자기방어의 핵심이다.",
      "카오스 드롭 확률은 단계별(15/30/45%)로 두되 절대 100%가 아니게 — 지옥이 아니라 경제적 부담으로 설계해야 복귀가 가능하다.",
      "전장은 인스턴스 룸(017번)으로 완전 격리해 필드 유저에게 영향을 주지 않게 한다.",
      "가드 NPC(카오스 유저 공격)는 필드 도시 안전성의 핵심이며, 가드 공격도 성향 판정 테이블에 포함해야 한다.",
    ],
  },
];
