// 모듈 2 (016~020): 네트워크 및 동기화 시스템 — 후반부

export const items = [
  {
    id: "016",
    title: "Server-Authoritative 위치 및 이동 검증 로직",
    role: [
      "클라이언트 예측(011번)이 아무리 정교해도 서버가 클라 좌표를 그대로 믿으면 월핵은 그대로다. 서버 권위 모델에서 클라이언트의 C2S_MOVE는 '위치'가 아니라 '입력 의도'이며, 서버는 shared/movement.ts의 동일한 stepMove 함수로 직접 시뮬레이션해 자신의 결과만 진짜 위치로 유지한다. 클라가 보낸 dx, dy는 반드시 [-1,1] 정규화 클램프를 거치고, 이동 스텝의 dt도 서버 틱 간격으로 대체해 클라가 조작한 시간값을 신뢰하지 않는다.",
      "추가 방어로 세 가지를 둔다. 첫째, 입력 스로틀(틱당 최대 2개 입력)로 패킷 플러딩을 막는다. 둘째, 순간 이동 감지(이전 승인 위치에서 시뮬레이션 상한 속도보다 큰 변위)는 자동 롤백(020번) 대상이 된다. 셋째, 컨텍스트 속도 보정(가속 버프, 탈것, 스킬 대시)은 서버의 버프 상태에서만 유효 속도를 계산해, 클라가 '속도 버프가 있다'고 허위 보고하는 것을 차단한다.",
    ],
    blocks: [
      {
        lang: "server/move/ServerAuthority.ts — uWebSockets.js 핸들러 결합",
        code: `import { Input, MoveState, WALK_SPEED, stepMove } from "../shared/movement";
import type uWS from "uWebSockets.js";

const MAX_SPEED_MULT = 1.5;              // 네트워크 지터 허용 배율
const INPUTS_PER_TICK = 2;               // 틱당 입력 수용 상한

interface Peer {
  userId: number; state: MoveState;
  speedMult: number;                      // 버프 계산 결과(서버 소유)
  buffered: Input[]; lastSeq: number;
  tickInputCount: number;
}

export class MoveAuthority {
  private peers = new Map<uWS.WebSocket, Peer>();

  /** C2S_MOVE 수신 — 클라 좌표를 무시하고 입력만 채택 */
  onMove(ws: uWS.WebSocket, inSeq: number, dx: number, dy: number, _clientDt: number) {
    const p = this.peers.get(ws);
    if (!p || inSeq <= p.lastSeq) return;               // 재전송/조작 시퀀스 폐기
    if (p.tickInputCount >= INPUTS_PER_TICK) return;    // 스로틀(플러딩 방지)
    p.tickInputCount++;
    p.lastSeq = inSeq;

    const len = Math.hypot(dx, dy) || 1;
    p.buffered.push({
      seq: inSeq,
      dx: Math.max(-1, Math.min(1, dx / len)),          // 정규화 클램프
      dy: Math.max(-1, Math.min(1, dy / len)),
      dt: 16.67,                                        // 클라 dt 무시, 서버 틱 고정
    });
  }

  /** 서버 고정 틱(60Hz) — 권위 시뮬레이션 */
  tick(now: number, blocked: (x: number, y: number) => boolean) {
    for (const p of this.peers.values()) {
      p.tickInputCount = 0;
      // 유효 속도는 서버 버프에서만 결정
      const prev = { ...p.state };
      p.state.speed = WALK_SPEED * p.speedMult;
      while (p.buffered.length) {
        const inp = p.buffered.shift()!;
        p.state = stepMove(p.state, inp, blocked);
      }
      // 순간 이동 감지: 한 틱 허용 변위 상한 = 속도 * 틱 * 허용배율
      const maxDisp = WALK_SPEED * p.speedMult * 0.05 * MAX_SPEED_MULT * 2;
      const disp = Math.hypot(p.state.x - prev.x, p.state.y - prev.y);
      if (disp > maxDisp) {
        p.state = prev;                                 // 롤백(020번 연계)
        this.onViolation?.(p.userId, "teleport", disp);
      }
    }
  }

  onViolation: ((userId: number, kind: "teleport" | "speed", value: number) => void) | null = null;
}`,
      },
    ],
    tips: [
      "클라이언트가 보내는 모든 수치(좌표, dt, 속도)는 힌트일 뿐이며, 서버가 다시 계산한 값만 유일한 진실이다.",
      "입력 스로틀과 시퀀스 중복 폐기만으로도 월핵 자동화 스크립트의 대부분은 무력화된다.",
      "유효 속도 배율(speedMult)은 반드시 서버 버프/탈것 상태에서 계산하고 클라 보고를 참조하지 않는다.",
      "위반은 첫 회에 즉시 밴이 아니라 롤백 + 로그 기록(095번 텔레메트리)으로 남겨 패턴 분석에 쓴다.",
    ],
  },
  {
    id: "017",
    title: "인스턴스 채널 분산 처리 및 룸(Room) 관리 스키마",
    role: [
      "한 맵에 유저가 몰리면 AOI(013번)로도 밀집 구역 publish 비용이 커지고, 보스·던전은 파티 단위 격리가 필요하다. 룸 관리 스키마는 '월드 맵 = 채널 1..n, 던전/보스 = 전용 룸'의 이중 구조로 이를 해결한다. 필드 맵은 채널(인스턴스) 1~5를 두고, 유저가 맵 진입 시 가장 인원이 적은 채널에 자동 배정되며, 파티원이 있으면 같은 채널로 강제 동기화한다. 던전·레이드는 매칭 성사 시 전용 룸 인스턴스를 생성하고, 완료 시 회수한다.",
      "룸은 프로세스 내 Map과 멀티프로세스 Redis 레지스트리 두 계층으로 관리한다. 프로세스 내 Map은 룸의 라이브 상태(엔티티, 틱 루프)를 담당하고, Redis는 '어느 프로세스가 어떤 룸을 소유하는지'의 메타만 담당해 스케일아웃 시 라우팅 정보의 단일 진실이 되게 한다. 룸은 최대 수명/유휴 타임아웃/유저 하한을 갖는 생명주기 상태머신(CREATING/ACTIVE/DRAINING/CLOSED)으로 운영된다.",
    ],
    blocks: [
      {
        lang: "server/room/RoomRegistry.ts",
        code: `import Redis from "ioredis";

export type RoomKind = "field" | "dungeon" | "raid" | "housing";
export type RoomPhase = "CREATING" | "ACTIVE" | "DRAINING" | "CLOSED";

export interface RoomMeta {
  roomId: string;            // "field:world:ch2" / "dungeon:d01:run421"
  kind: RoomKind;
  mapId: string;
  ownerId: string;           // 프로세스 노드 id
  capacity: number;
  pop: number;
  phase: RoomPhase;
  ttlAt: number;             // 유휴 회수 예정 시각
}

const ROOM_KEY = "rooms:";   // Redis 해시 — 멀티노드 라우팅의 단일 진실

export class RoomRegistry {
  constructor(private redis: Redis, private nodeId: string) {}

  /** 맵 진입: 가장 여유 있는 채널 선택(파티 정책 우선) */
  async pickFieldChannel(mapId: string, partySize: number, partyRoom?: string): Promise<RoomMeta> {
    if (partyRoom) {
      const pr = await this.get(partyRoom);
      if (pr && pr.phase === "ACTIVE" && pr.pop + partySize <= pr.capacity) return pr;
    }
    const rooms = await this.listByKind("field", mapId);
    const open = rooms
      .filter(r => r.phase === "ACTIVE" && r.pop + partySize <= r.capacity)
      .sort((a, b) => a.pop - b.pop);
    if (open.length) return open[0];
    return this.create({ kind: "field", mapId, capacity: 80 });   // 채널 자동 증설
  }

  async create(spec: { kind: RoomKind; mapId: string; capacity: number }): Promise<RoomMeta> {
    const roomId = spec.kind + ":" + spec.mapId + ":" + this.nodeId + ":" + Date.now();
    const meta: RoomMeta = {
      roomId, kind: spec.kind, mapId: spec.mapId, ownerId: this.nodeId,
      capacity: spec.capacity, pop: 0, phase: "CREATING",
      ttlAt: Date.now() + 60_000,        // 60초 내 유저 없으면 자동 회수
    };
    await this.redis.hset(ROOM_KEY, roomId, JSON.stringify(meta));
    return meta;
  }

  async join(roomId: string): Promise<RoomMeta | null> {
    const r = await this.get(roomId);
    if (!r || r.phase === "CLOSED" || r.pop >= r.capacity) return null;
    r.pop++; r.ttlAt = 0;                                   // 활성화 — TTL 해제
    await this.redis.hset(ROOM_KEY, roomId, JSON.stringify(r));
    return r;
  }

  async leave(roomId: string) {
    const r = await this.get(roomId);
    if (!r) return;
    r.pop = Math.max(0, r.pop - 1);
    if (r.pop === 0 && r.kind !== "field") r.phase = "DRAINING";   // 던전은 즉시 회수 대기
    await this.redis.hset(ROOM_KEY, roomId, JSON.stringify(r));
  }

  private async get(roomId: string): Promise<RoomMeta | null> {
    const raw = await this.redis.hget(ROOM_KEY, roomId);
    return raw ? JSON.parse(raw) : null;
  }
  private async listByKind(kind: RoomKind, mapId: string): Promise<RoomMeta[]> {
    const all = await this.redis.hvals(ROOM_KEY);
    return all.map(JSON.parse)
      .filter((r: RoomMeta) => r.kind === kind && r.mapId === mapId);
  }

  /** 주기 청소: DRAINING 상태 30초 경과 룸 폐기 + 메모리 룸 detach */
  async sweep(onClose: (roomId: string) => void) {
    const all = await this.redis.hvals(ROOM_KEY);
    for (const raw of all) {
      const r: RoomMeta = JSON.parse(raw);
      const expired = (r.phase === "DRAINING" && r.ttlAt === 0 && r.pop === 0)
        || (r.phase === "CREATING" && r.ttlAt > 0 && Date.now() > r.ttlAt);
      if (expired) {
        onClose(r.roomId);
        await this.redis.hdel(ROOM_KEY, r.roomId);
      }
    }
  }
}`,
      },
    ],
    tips: [
      "채널 자동 증설 기준은 '최고 밀도 채널이 capacity의 80%를 넘을 때'가 안정적이며, 감축은 50% 이하가 10분 지속될 때 수행한다.",
      "파티원 강제 동기화(같은 채널)는 유저 경험의 핵심이다 — 파티 진입 시 partyRoom을 Redis에 기록해 재접속에도 유지한다.",
      "roomId에 노드 id를 포함하면 라우팅 계층이 '어느 프로세스로 접속을 보낼지'를 O(1)로 알 수 있다.",
      "DRAINING 상태 룸에는 신규 입장을 막되 기존 유저는 전투를 마치고 나갈 수 있게 해야 강제 추방 불만을 막는다.",
    ],
  },
  {
    id: "018",
    title: "Kysely ORM 기반 재화/아이템 안전 이동 분산 DB 트랜잭션",
    role: [
      "거래, 우편 첨부, 파티 분배, 경매 결제는 모두 '두 유저 간 재화·아이템 이동'이며, 단 한 번이라도 절반만 적용되면 서비스 신뢰가 무너진다. PostgreSQL 트랜잭션 + SELECT FOR UPDATE(행 잠금) + 낙관적 버전 검증으로 원자성을 보장하고, Kysely의 타입 세이프 쿼리 빌더로 이 구조를 컴파일 타임에 강제한다. 이 항목은 (1) 스키마 타입 정의, (2) 재화 이동 트랜잭션, (3) 아이템 소유권 이전 트랜잭션 세 부분으로 구성한다.",
      "분산 환경(멀티 노드)에서는 두 트랜잭션이 같은 행을 건드리지 않도록 잠금 순서(항상 user id 오름차순으로 잠금)를 표준화해 교착 상태(deadlock)를 예방한다. 재화는 절대 음수가 될 수 없다는 CHECK 제약을 DB 레벨에 두고, 애플리케이션 로직 버그가 있어도 DB가 최후의 방어선이 되게 한다. 모든 이동은 ledger 테이블에 흐름 기록을 남겨 감사·복구(100번 백업과 연계)가 가능하다.",
    ],
    blocks: [
      {
        lang: "db/schema.d.ts — Kysely 타입 정의",
        code: `export interface UserRow {
  id: number; name: string;
  gold: number; cash: number; created_at: Date;
}
export interface ItemRow {
  id: number; owner_id: number;
  item_code: string; qty: number;
  binding: "bound" | "tradeable";      // 귀속/비귀속(086번과 연계)
  version: number;                     // 낙관적 잠금용
}
export interface LedgerRow {
  id: number; at: Date; kind: "gold" | "item";
  from_user: number | null; to_user: number | null;
  ref: string;                         // 거래/우편/경매 참조 id
  payload: string;                     // { qty, itemCode, ... } JSON
}

export interface Database {
  users: UserRow;
  items: ItemRow;
  ledger: LedgerRow;
}`,
      },
      {
        lang: "db/transfer.ts — Kysely 재화/아이템 이동 트랜잭션",
        code: `import { Kysely, sql } from "kysely";
import type { Database } from "./schema";

export class TransferError extends Error {
  constructor(public code: "NOT_FOUND" | "NO_FUNDS" | "BOUND_ITEM" | "LOCK_TIMEOUT", msg: string) { super(msg); }
}

/** 재화 이동: 잠금 순서 표준화(id 오름차순)로 교착 예방 */
export async function transferGold(
  db: Kysely<Database>, fromId: number, toId: number, amount: number, ref: string,
) {
  if (amount <= 0) throw new TransferError("NO_FUNDS", "amount must be positive");
  const [lock1, lock2] = fromId < toId ? [fromId, toId] : [toId, fromId];

  return await db.transaction().execute(async (tx) => {
    // 순서대로 잠금 — SELECT FOR UPDATE
    for (const id of [lock1, lock2]) {
      await tx.selectFrom("users").where("id", "=", id)
        .forUpdate().select("id").execute();
    }
    const from = await tx.selectFrom("users").where("id", "=", fromId)
      .select(["gold"]).executeTakeFirstOrThrow();
    if (from.gold < amount) throw new TransferError("NO_FUNDS", "insufficient gold");

    await tx.updateTable("users").set(eb => ({ gold: eb("gold", "-", amount) }))
      .where("id", "=", fromId).execute();
    await tx.updateTable("users").set(eb => ({ gold: eb("gold", "+", amount) }))
      .where("id", "=", toId).execute();

    await tx.insertInto("ledger").values({
      at: new Date(), kind: "gold", from_user: fromId, to_user: toId,
      ref, payload: JSON.stringify({ amount }),
    }).execute();
  });
}

/** 아이템 소유권 이전: 낙관적 버전 검증 + 귀속 판정 */
export async function transferItem(
  db: Kysely<Database>, itemId: number, fromId: number, toId: number, ref: string,
) {
  return await db.transaction().execute(async (tx) => {
    const item = await tx.selectFrom("items").where("id", "=", itemId)
      .forUpdate().select(["owner_id", "binding", "version"]).executeTakeFirst();
    if (!item) throw new TransferError("NOT_FOUND", "item missing");
    if (item.owner_id !== fromId) throw new TransferError("NOT_FOUND", "not owner");
    if (item.binding === "bound") throw new TransferError("BOUND_ITEM", "bound item");

    // 낙관적 잠금: version 일치 시에만 갱신(동시 소유 이전 차단)
    const updated = await tx.updateTable("items")
      .set({ owner_id: toId, version: item.version + 1 })
      .where(eb => eb.and([
        eb("id", "=", itemId),
        eb("version", "=", item.version),
      ]))
      .executeTakeFirst();
    if (Number(updated.numUpdatedRows) !== 1n)
      throw new TransferError("LOCK_TIMEOUT", "concurrent transfer detected");

    await tx.insertInto("ledger").values({
      at: new Date(), kind: "item", from_user: fromId, to_user: toId,
      ref, payload: JSON.stringify({ itemId }),
    }).execute();
  });
}

// CHECK 제약(DB 레벨 최후 방어):
// ALTER TABLE users ADD CONSTRAINT gold_nonneg CHECK (gold >= 0);
// ALTER TABLE items ADD CONSTRAINT qty_nonneg CHECK (qty >= 0);`,
      },
    ],
    tips: [
      "잠금 순서 표준화(id 오름차순)는 PostgreSQL에서 교착 상태를 구조적으로 제거하는 가장 저비용 방법이다.",
      "CHECK 제약(gold >= 0)은 애플리케이션 버그의 최후 방어선이다 — 반드시 DB 레벨에 둔다.",
      "ledger 흐름 테이블은 파티셔닝(월 단위)으로 운영하면 감사 조회와 용량 관리가 모두 풀린다.",
      "Kysely의 .forUpdate()는 트랜잭션 내에서만 유효하다 — 커넥션 풀 트랜잭션 바깥에서 실수로 쓰지 않도록 레포지토리 계층으로 감싼다.",
    ],
  },
  {
    id: "019",
    title: "클라이언트 RTT(Ping) 측정 및 상태 모니터링",
    role: [
      "RTT는 예측 보정(011), 랙 컴펜세이션(015), 보간 지연(012)의 공통 입력값이다. 측정은 바이너리 PING/PONG 왕복(1~2초 간격)으로 수행하고, 지수 이동 평균(EMA)과 최댓값/분위수를 함께 유지해 '지금 느린가, 지속적으로 느린가'를 구분한다. 순수 RTT 외에 서버 처리 시간(pong 응답에 서버 수신 타임스탬프 포함)을 분리 측정하면 병목이 네트워크인지 서버인지 구분할 수 있다.",
      "모니터링은 클라/서버 양쪽에서 이루어진다. 클라는 RTT 급상승 시 예측 안전장치를 강화(pending 입력 상한 축소)하고 HUD에 네트워크 상태 아이콘을 표시한다. 서버는 유저별 RTT 분포를 수집해 지역/ISP 단위 품질 대시보드를 만들고, P95가 임계를 넘는 구역은 리전 증설(017번과 연계) 판단 근거로 쓴다. 텔레메트리(095번)로 주기 배출한다.",
    ],
    blocks: [
      {
        lang: "src/net/RttMonitor.ts",
        code: `export interface RttStats {
  last: number; ema: number; p95: number; lossRate: number;
  serverDelay: number;             // 서버 처리 소요(ms)
}

const WINDOW = 20;                 // 분위수 계산 윈도우
export class RttMonitor {
  private inflight = new Map<number, number>();    // seq → 송신 시각
  private samples: number[] = [];
  private emaVal = 0;
  private lost = 0; sent = 0;
  private serverDelayEma = 0;
  private seq = 0;
  private timer = 0;

  constructor(
    private sendPing: (payload: ArrayBuffer) => void,
    private onStats: (s: RttStats) => void,
    private intervalMs = 2000,
  ) {}

  start() {
    this.timer = window.setInterval(() => this.probe(), this.intervalMs);
  }
  stop() { clearInterval(this.timer); }

  private probe() {
    const seq = ++this.seq;
    const v = new DataView(new ArrayBuffer(5));
    v.setUint8(0, 3 /* PKT.C2S_PING */);
    v.setUint32(1, seq);
    this.inflight.set(seq, performance.now());
    this.sent++;
    if (this.inflight.size > 3) {      // 3개 이상 미응답 = 유실 추정
      this.lost += this.inflight.size - 3;
      const oldest = Math.min(...this.inflight.keys());
      this.inflight.delete(oldest);
    }
    this.sendPing(v.buffer);
  }

  /** S2C_PONG 수신: [type u8][seq u32][serverRecvMs f32][serverSendMs f32] */
  onPong(buf: ArrayBuffer) {
    const v = new DataView(buf);
    const seq = v.getUint32(1);
    const sentAt = this.inflight.get(seq);
    if (sentAt == null) return;
    this.inflight.delete(seq);

    const rtt = performance.now() - sentAt;
    const serverDelay = v.getFloat32(9) - v.getFloat32(5);
    this.samples.push(rtt);
    if (this.samples.length > WINDOW) this.samples.shift();
    this.emaVal = this.emaVal === 0 ? rtt : this.emaVal * 0.7 + rtt * 0.3;
    this.serverDelayEma = this.serverDelayEma === 0
      ? serverDelay : this.serverDelayEma * 0.8 + serverDelay * 0.2;

    const sorted = [...this.samples].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? rtt;
    this.onStats({
      last: rtt, ema: Math.round(this.emaVal), p95,
      lossRate: this.lost / Math.max(1, this.sent),
      serverDelay: Math.round(this.serverDelayEma),
    });
  }
}

// 사용: HUD 표시 임계 — ema < 80 초록 / < 150 노랑 / 이상 또는 lossRate>5% 빨강`,
      },
    ],
    tips: [
      "ping 주기 2초는 정확도와 트래픽의 균형점이며, 전투 중에는 1초로 단축해 랙 컴펜세이션 정확도를 높인다.",
      "RTT에서 서버 처리 시간을 빼야 진짜 네트워크 지연이다 — pong에 서버 수신/송신 타임스탬프를 둘 다 담는다.",
      "EMA(α=0.3)는 스파이크에 둔감해 UI 표시에 적합하고, p95는 예측 안전장치 튜닝에 적합하다 — 용도별로 분리해 사용한다.",
      "서버는 수집한 RTT를 유저 단위가 아닌 지역 단위로 집계해 개인정보 이슈 없이 리전 운영 판단에 쓴다.",
    ],
  },
  {
    id: "020",
    title: "좌표 오차 초과 시 위치 롤백(Rollback) 및 보정 연산",
    role: [
      "예측(011)과 서버 권위(016)가 병행되면 클라 표시 위치와 서버 승인 위치 사이에 오차가 존재하는 것이 정상이다. 문제는 오차가 임계를 넘는 순간이다. 작은 오차는 스무딩으로 흡수하지만, 텔레포트 수준의 오차(월핵, 재접속, 서버 보정)는 즉시 롤백해서 서버 위치로 되돌려야 조작 신뢰가 유지된다. 이 모듈은 오차 원인별로 다른 보정 정책(스무딩/스냅/롤백+재동기화)을 단일 상태머신으로 수행한다.",
      "롤백의 시각적 품질은 '보정 이펙트'가 좌우한다. 순간이동 보정 시에는 이동 궤적에 잔상/파티클을 뿌려 유저가 '기술 효과'로 느끼게 하고, 롤백 원인이 서버 정정이면 로그에 violation 마킹(016번)해 어뷰징 판정 근거로 남긴다. 서버도 클라의 재동기화 요청(resync)을 받으면 자신의 권위 상태와 마지막 승인 seq를 재전송해 양쪽이 같은 기준점을 갖게 한다.",
    ],
    blocks: [
      {
        lang: "src/net/CorrectionPolicy.ts",
        code: `import type { MoveState } from "../shared/movement";

export type Correction = "smooth" | "snap" | "rollback";

export interface CorrectionCtx {
  display: MoveState;          // 클라가 그리는 위치
  auth: MoveState;             // 서버 승인 위치
  lastViolationMs: number;     // 최근 서버 위반 알림 시각
}

const TILE = 32;
export function decideCorrection(ctx: CorrectionCtx): Correction {
  const err = Math.hypot(ctx.display.x - ctx.auth.x, ctx.display.y - ctx.auth.y);
  const sinceViolation = Date.now() - ctx.lastViolationMs;

  // 1) 서버 위반(롤백 판정) 후 500ms 내 — 서버 기준 즉시 스냅
  if (sinceViolation < 500) return "snap";
  // 2) 오차 < 0.5타일 — 스무딩으로 흡수(티 나지 않음)
  if (err < TILE * 0.5) return "smooth";
  // 3) 오차 < 2타일 — 큰 스무딩(0.5프레임당 20% 수렴)
  if (err < TILE * 2) return "smooth";
  // 4) 그 이상(텔레포트급) — 롤백 스냅 + 이펙트
  return "rollback";
}

export class PositionCorrector {
  private lastViolationMs = 0;
  private smoothingQueue: MoveState[] = [];   // 스무딩용 중간 목표점

  onServerViolationNotice() { this.lastViolationMs = Date.now(); }

  /** 프레임마다: display를 auth 쪽으로 정책에 따라 수렴 */
  step(display: MoveState, auth: MoveState, dtMs: number): { state: MoveState; fx: "none" | "trail" } {
    const kind = decideCorrection({
      display, auth, lastViolationMs: this.lastViolationMs,
    });
    switch (kind) {
      case "smooth": {
        // 초당 60% 수렴 — 프레임율 독립: k = 1 - 0.4^(dt/1000)
        const k = 1 - Math.pow(0.4, dtMs / 1000);
        return {
          state: {
            x: display.x + (auth.x - display.x) * k,
            y: display.y + (auth.y - display.y) * k,
            speed: display.speed,
          },
          fx: "none",
        };
      }
      case "rollback":
      case "snap": {
        // 궤적 이펙트(trail)로 시각적 완충 — 유저가 기술로 인지하게
        this.smoothingQueue = [];
        return { state: { ...auth }, fx: kind === "rollback" ? "trail" : "none" };
      }
    }
  }
}

// 서버 측 resync 응답: 권위 상태 + lastAckSeq 재전송
// { t: "resync", seq, x, y, speed } → 클라 PredictionEngine.onServerAck 재사용`,
      },
    ],
    tips: [
      "스무딩 계수는 프레임율 독립으로 계산한다(지수 감쇠 공식) — 60fps와 144fps에서 수렴 속도가 같아야 한다.",
      "롤백 직후 0.5초는 무조건 snap 정책을 유지해야 보정 루프(오차 → 스무딩 → 다시 오차)에 빠지지 않는다.",
      "순간이동 보정에는 반드시 시각 이펙트를 곱한다 — 보정이 잦아도 유저 체감은 '게임 특성'으로 수용된다.",
      "오차 원인 구분(네트워크 지연 vs 위반 vs 버그)은 로그에 correction kind + 당시 RTT(019번)를 함께 남겨야 분석이 가능하다.",
    ],
  },
];
