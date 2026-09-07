// 모듈 2 (011~015): 네트워크 및 동기화 시스템 — 전반부
// 스택: Node.js, uWebSockets.js, ArrayBuffer(TypedArray), Kysely(PostgreSQL)

export const items = [
  {
    id: "011",
    title: "클라이언트 위치 예측(Client Prediction) 엔진",
    role: [
      "입력 후 서버 응답(RTT 50~200ms)을 기다렸다가 캐릭터를 움직이면 조작감이 끊긴다. 클라이언트 예측은 입력을 즉시 로컬에 적용하고, 서버 승인이 도착하면 예측 결과와 비교해 오차만큼만 교정한다. 핵심 자료구조는 입력 버퍼((seq, dx, dy, dt) 튜플)와 서버 승인 상태(마지막 승인 seq, 승인 위치)다. 승인이 도착하면 예측 버퍼에서 해당 seq 이전 항목을 제거하고, 남은 입력을 승인 위치부터 다시 재생(replay)한다.",
      "오차가 임계값(예: 0.5 타일) 이하면 부드러운 스무딩으로 수렴시키고, 초과하면 텔레포트 보정을 한다. 예측은 '결정론적 이동 함수'를 클라이언트와 서버가 공유해야 성립하므로, 이동 규칙(속도, 가속, 충돌 반경)은 양쪽에서 임포트하는 shared 모듈로 작성한다. 서버도 같은 함수로 검증(016번)하므로 이중 구현이 아니라 단일 소스가 된다.",
    ],
    blocks: [
      {
        lang: "shared/movement.ts — 클라이언트/서버 공유 결정론적 이동",
        code: `// 양쪽에서 동일하게 임포트하는 이동 규칙(결정론 필수: 부동소수 연산 순서 고정)
export interface Input {
  seq: number; dx: number; dy: number; dt: number;  // 방향(-1~1), 경과 ms
}
export interface MoveState { x: number; y: number; speed: number; }

export const TILE = 32;
export const WALK_SPEED = 140;          // px/s

export function stepMove(s: MoveState, i: Input, blocked: (x: number, y: number) => boolean): MoveState {
  const len = Math.hypot(i.dx, i.dy);
  if (len === 0) return s;
  const dtSec = i.dt / 1000;
  const dist = s.speed * dtSec;
  // X/Y 분리 충돌: 벽 끼임(코너 걸림) 방지를 위해 축별로 이동
  const nx = s.x + (i.dx / len) * dist;
  if (!blocked(nx, s.y)) s = { ...s, x: nx };
  const ny = s.y + (i.dy / len) * dist;
  if (!blocked(s.x, ny)) s = { ...s, y: ny };
  return s;
}`,
      },
      {
        lang: "src/net/PredictionEngine.ts",
        code: `import { Input, MoveState, stepMove } from "../shared/movement";

export class PredictionEngine {
  private pending: Input[] = [];          // 미승인 입력 버퍼
  private seq = 0;
  /** 서버 마지막 승인 상태 */
  private authState: MoveState;
  /** 화면 표시용 상태(보정 스무딩 적용) */
  display: MoveState;

  constructor(spawn: MoveState, private blocked: (x: number, y: number) => boolean) {
    this.authState = { ...spawn };
    this.display = { ...spawn };
  }

  /** 플레이어 입력 발생(고정 스텝마다) — 즉시 예측 적용 + 서버 전송용 반환 */
  applyLocal(dx: number, dy: number, dt: number): Input {
    const input: Input = { seq: ++this.seq, dx, dy, dt };
    this.display = stepMove(this.display, input, this.blocked);
    this.pending.push(input);
    return input;                          // 호출자가 서버로 전송(C2S_MOVE)
  }

  /** 서버 S2C_MOVE_ACK 수신(seq, x, y) — 예측 재생(reconciliation) */
  onServerAck(seq: number, x: number, y: number) {
    // 1) 승인된 입력 이전 항목 폐기
    this.pending = this.pending.filter(i => i.seq > seq);
    this.authState = { ...this.authState, x, y };

    // 2) 승인 위치부터 미승인 입력 재생
    let sim: MoveState = { ...this.authState };
    for (const i of this.pending) sim = stepMove(sim, i, this.blocked);

    // 3) 오차 평가: 작으면 스무딩, 크면 스냅
    const err = Math.hypot(sim.x - this.display.x, sim.y - this.display.y);
    if (err > TILE * 1.5) {
      this.display = { ...sim };           // 텔레포트 보정
    } else if (err > 0.5) {
      // 지수 감쇠 스무딩: 복귀 프레임에서 급격히 튀지 않게
      const k = Math.min(1, err > 8 ? 0.35 : 0.15);
      this.display.x += (sim.x - this.display.x) * k;
      this.display.y += (sim.y - this.display.y) * k;
    }
  }

  /** 고정 업데이트: 미승인 입력이 계속 쌓이면 계속 예측 진행 */
  fixedUpdate(dt: number, currentInput: { dx: number; dy: number }) {
    if (this.pending.length > 0 || currentInput.dx || currentInput.dy) {
      const ghost: Input = { seq: this.seq, dx: currentInput.dx, dy: currentInput.dy, dt };
      this.display = stepMove(this.display, ghost, this.blocked);
    }
  }
  get pendingCount() { return this.pending.length; }
}`,
      },
    ],
    tips: [
      "예측 재생은 '서버 승인 위치 + 미승인 입력 전부'로 다시 시뮬레이션하는 것이 정석이며, 델타만 반영하면 드리프트가 누적된다.",
      "오차 스무딩 계수(k)를 오차 크기에 따라 가변으로 두면 자잘한 보정은 티가 나지 않고, 큰 보정은 빠르게 수렴한다.",
      "pending 입력이 20개(약 300ms)를 넘으면 네트워크 이상 신호로 간주해 예측을 멈추고 서버 상태를 신뢰하는 안전장치를 둔다.",
      "결정론이 깨지는 요인(부동소수 순서, Math.random)은 shared 모듈에서 금지 — 랜덤은 서버 전용 값으로만 주입한다.",
    ],
  },
  {
    id: "012",
    title: "데드 레코닝(Dead Reckoning) & 위치 보간(Interpolation) 연산 모듈",
    role: [
      "다른 플레이어·몬스터의 위치는 서버가 10~20Hz로만 알려주지만 화면은 60fps로 그려야 한다. 데드 레코닝은 마지막 알려진 위치와 속도 벡터로 현재 시각의 위치를 외삽(extrapolation)하고, 보간은 두 스냅샷 사이를 부드럽게 채운다. 실무에서 정석은 '보간 지연 버퍼' 방식이다. 렌더 시각을 현재보다 RTT/2 + 안전 마진(보통 100ms)만큼 의도적으로 과거로 두고, 그 시각을 기준으로 두 스냅샷 사이를 선형보간한다.",
      "이 방식은 패킷 지연 지터를 완전히 흡수해 NPC 움직임이 결코 떨리지 않는다. 스냅샷이 버퍼를 초과해 늦게 도착하면(예: 스파이크) 속도 외삽으로 한시적으로 메우고, 새 스냅샷이 연속 도착하면 렌더 시각을 앞으로 당겨 재수렴한다. 유닛별 상태(스폰/사망/스턴)도 함께 보간해 스프라이트 애니메이션 전환이 자연스럽게 이어진다.",
    ],
    blocks: [
      {
        lang: "src/net/DeadReckoning.ts",
        code: `export interface Snapshot {
  id: number; t: number;                // 유닛 id, 서버 타임스탬프(ms)
  x: number; y: number; vx: number; vy: number;  // 위치(px), 속도(px/s)
}

const INTERP_DELAY = 100;                // 보간 지연(ms) — RTT/2 + 마진

export class RemoteUnitInterp {
  private buf: Snapshot[] = [];          // 시간 오름차순 유지
  /** 렌더 시각을 과거로 당기는 기준: 로컬 수신 시각 기준 관리 */
  private origin = 0;

  push(s: Snapshot, nowLocal: number) {
    if (this.buf.length && s.t <= this.buf[this.buf.length - 1].t) return; // 지각분 폐기
    this.buf.push(s);
    if (this.buf.length > 30) this.buf.shift();       // 버퍼 상한
    if (!this.origin) this.origin = nowLocal - s.t;   // 서버-로컬 시계 정렬
  }

  /** 렌더 프레임마다 호출 — 표시 위치 반환 */
  sample(nowLocal: number): { x: number; y: number } {
    const renderT = nowLocal - this.origin - INTERP_DELAY;
    if (this.buf.length === 0) return { x: 0, y: 0 };

    const last = this.buf[this.buf.length - 1];
    if (renderT >= last.t) {
      // 버퍼 끝 초과(스파이크) → 속도 외삽으로 한시 메우기
      const over = (renderT - last.t) / 1000;
      return { x: last.x + last.vx * over, y: last.y + last.vy * over };
    }
    // renderT를 포함하는 구간 [a, b] 찾기 → 선형보간
    for (let i = this.buf.length - 2; i >= 0; i--) {
      const a = this.buf[i], b = this.buf[i + 1];
      if (renderT >= a.t) {
        const r = (renderT - a.t) / Math.max(1, b.t - a.t);
        // 스냅샷에 속도가 있으면 이차(헤르미테) 보간에 근사:
        // 선형보간 + 속도 항 절반 보정으로 커브 자연스러움 추가
        const lin = (1 - r) * a.x + r * b.x;
        const linY = (1 - r) * a.y + r * b.y;
        const curvX = (a.vx - b.vx) * 0.5 * (b.t - a.t) / 1000 * r * (1 - r);
        const curvY = (a.vy - b.vy) * 0.5 * (b.t - a.t) / 1000 * r * (1 - r);
        return { x: lin + curvX, y: linY + curvY };
      }
    }
    const first = this.buf[0];
    return { x: first.x, y: first.y };
  }

  /** 재접속/타깃 전환 등 버퍼 전체 리셋 */
  reset() { this.buf = []; this.origin = 0; }
}`,
      },
    ],
    tips: [
      "보간 지연 100ms는 대부분의 MMORPG에서 최적점이다 — 줄이면 지터가 티나고, 늘리면 반응이 둔해 보인다.",
      "지각 패킷(t <= 마지막 t)은 반드시 폐기한다 — 정렬 상태가 깨지면 보간이 역주행해 스프라이트가 왔다 갔다 한다.",
      "외삽은 한시적 안전망일 뿐이다 — 250ms 이상 지속되면 렌더 시각을 앞당겨(버퍼 소진 유도) 재수렴시키는 게 낫다.",
      "몬스터 AI는 서버가 10Hz면 충분하지만, 유저 캐릭터는 15~20Hz 스냅샷이 시각적 품질의 하한선이다.",
    ],
  },
  {
    id: "013",
    title: "uWebSockets.js 내장 Pub/Sub 기반 AOI 타일 격자 브로드캐스팅",
    role: [
      "1000명이 한 맵에 있을 때 모두에게 모든 상태를 브로드캐스트하면 O(N^2)로 서버가 즉사한다. AOI(Area of Interest)는 각 플레이어에게 '보이는 범위(예: 30x30 타일)'의 엔티티만 전송하는 필터다. uWebSockets.js는 C++ 코어에 pub/sub 토픽을 내장하고 있어, 구독/발행이 유저 공간 JS 루프 없이 네이티브로 처리된다. 이 모듈은 맵을 NxN 타일 격자로 나누고 각 타일을 토픽(zone:5:12 형식)으로 만들어, 플레이어는 자기 주변 9개(3x3) 타일만 구독한다.",
      "엔티티 상태 변경은 그 엔티티가 속한 타일 토픽에만 publish하므로, 패킷은 인접 플레이어에게만 전달된다. 타일 경계 이동 시에는 이전 3x3에서 unsubscribe, 새 3x3에서 subscribe 하되, uWS의 publish 옵션으로 자기 자신은 제외한다. 결과적으로 서버 CPU 부하는 유저 수가 아닌 밀도에 비례하게 되어, 밀집 구역(도시 광장 등)은 채널 분산(017번)으로 해소한다.",
    ],
    blocks: [
      {
        lang: "server/aoi/AoiGrid.ts — uWebSockets.js 토픽 기반 AOI",
        code: `import uWS from "uWebSockets.js";

const TOPIC_PREFIX = "t:";                       // 토픽명: "t:<mapId>:<gx>:<gy>"
const CELL = 8;                                   // AOI 격자 한 칸 = 8x8 타일

export function topicOf(mapId: string, x: number, y: number) {
  return TOPIC_PREFIX + mapId + ":" + Math.floor(x / CELL) + ":" + Math.floor(y / CELL);
}

/** 3x3 이웃 타일 토픽 목록 */
function neighbors(mapId: string, x: number, y: number): string[] {
  const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL);
  const out: string[] = [];
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++)
      out.push(TOPIC_PREFIX + mapId + ":" + (gx + dx) + ":" + (gy + dy));
  return out;
}

interface Peer {
  id: number; mapId: string; x: number; y: number;
  subs: Set<string>;
}

export class AoiGrid {
  private peers = new Map<uWS.WebSocket, Peer>();

  subscribeAround(ws: uWS.WebSocket, mapId: string, x: number, y: number) {
    const p = this.peers.get(ws)!;
    const topics = neighbors(mapId, x, y);
    for (const t of topics) if (!p.subs.has(t)) { ws.subscribe(t); p.subs.add(t); }
    p.mapId = mapId; p.x = x; p.y = y;
  }

  /** 타일 이동 시 구독 재계산 — 이탈 토픽 해지로 트래픽 최소화 */
  reposition(ws: uWS.WebSocket, x: number, y: number) {
    const p = this.peers.get(ws)!;
    const need = new Set(neighbors(p.mapId, x, y));
    for (const t of p.subs) if (!need.has(t)) { ws.unsubscribe(t); p.subs.delete(t); }
    for (const t of need) if (!p.subs.has(t)) { ws.subscribe(t); p.subs.add(t); }
    p.x = x; p.y = y;
  }

  /** 엔티티 상태 변경 → 해당 타일 3x3에만 발행(자기 자신 제외) */
  publishState(this: AoiGrid, ws: uWS.WebSocket, payload: ArrayBuffer) {
    const p = this.peers.get(ws)!;
    const t = topicOf(p.mapId, p.x, p.y);
    ws.publish(t, payload, false);                // false = 자기 자신 미포함
  }

  /** 맵 전환: 구독 전부 해지 후 새 맵 구독 */
  switchMap(ws: uWS.WebSocket, newMapId: string, x: number, y: number) {
    const p = this.peers.get(ws)!;
    for (const t of p.subs) ws.unsubscribe(t);
    p.subs.clear();
    this.subscribeAround(ws, newMapId, x, y);
  }
}

// ── uWS 서버 결합 예시 ──
export function attachAoi(app: uWS.TemplatedApp, grid: AoiGrid) {
  app.ws("/ws", {
    compression: uWS.SHARED_COMPRESSOR,           // permessage-deflate 공유 사전
    open(ws) {
      grid["peers"].set(ws, { id: 0, mapId: "world", x: 0, y: 0, subs: new Set() });
      grid.subscribeAround(ws, "world", 100, 100);
    },
    message(ws, msg, isBinary) {
      if (!isBinary) return;
      grid.publishState(ws, msg.slice(0) as ArrayBuffer);   // AOI 필터링 전송
    },
    close(ws) { grid["peers"].delete(ws); },
  });
}`,
      },
    ],
    tips: [
      "uWS publish는 C++ 코어에서 수신자별 복사가 일어나므로 JS 루프로 수신자 목록을 만드는 것보다 수 배 빠르다.",
      "격자 크기(CELL)는 시야 반경보다 한 칸 크게 — 8x8 타일(256px)은 표준 시야(약 300px)에 맞는 값이다.",
      "밀집 지역은 토픽 하나에 구독자가 수백 명이라 publish 비용이 다시 커진다 — 채널 인스턴스(017번)와 결합해 인원 상한을 둔다.",
      "spawn/despawn 이벤트는 인접 토픽들에 모두 보내야 한다 — 재구독 직후 1회 전체 스냅샷을 주는 방식과 병행한다.",
    ],
  },
  {
    id: "014",
    title: "Delta Compression 기반 상태 변경점 압축 바이너리 패킷 구조",
    role: [
      "AOI 스냅샷을 매 틱 통째로 보내면 밀집 구역에서 1유저당 수백 KB/s가 된다. 델타 압축은 이전 스냅샷과의 차이(변경된 필드만)를 비트 마스크로 전송한다. 각 엔티티를 16비트 필드 마스크 + 변경 필드만 직렬화하는 구조로 만들면, 정지 상태가 많은 필드 맵에서는 90% 이상 절약된다. 이 항목은 엔티티 상태를 고정 스키마(필드 번호)로 정의하고, 마스크 기반 인코더/디코더를 클라이언트·서버 공유 모듈로 구현한다.",
      "설계 원칙은 세 가지다. 첫째, 필드 번호는 절대 변경하지 않는다(프로토콜 버전으로만 확장). 둘째, 압축 대상 필드는 16비트 고정소수로 양자화한다. 셋째, uWS의 SHARED_COMPRESSOR(permessage-deflate)와 조합하면 반복되는 헤더 바이트까지 사전 압축된다. 신뢰성을 위해 델타는 '마지막 승인 스냅샷 기준'으로 생성하며, 유실 감지(시퀀스 건너뜀) 시 전체 스냅샷(full state)으로 복구한다.",
    ],
    blocks: [
      {
        lang: "shared/delta.ts — 필드 마스크 기반 델타 코덱",
        code: `// 엔티티 필드 비트 정의 (하위 16비트, 추가는 상위 버전에서)
export const F = {
  X: 1 << 0, Y: 1 << 1, VX: 1 << 2, VY: 1 << 3,
  HP: 1 << 4, MP: 1 << 5, LVL: 1 << 6, STATE: 1 << 7,   // 0=idle 1=move 2=atk 3=dead
  TARGET: 1 << 8, BUFF: 1 << 9, SKIN: 1 << 10,
};

export interface EntityState {
  id: number; mask: number;
  x: number; y: number; vx: number; vy: number;
  hp: number; mp: number; lvl: number; state: number;
  target: number; buff: number; skin: number;
}

const Q = 10;                                   // 위치 양자화 배율(x10)
export function diff(prev: EntityState | null, cur: EntityState): ArrayBuffer {
  const mask = prev ? buildMask(prev, cur) : 0xFFFF;   // 신규 엔티티는 full
  const size = 4 + 2 + payloadSize(cur, mask);         // id(4) + mask(2) + 필드들
  const buf = new ArrayBuffer(size), v = new DataView(buf);
  let o = 0;
  v.setUint32(o, cur.id); o += 4;
  v.setUint16(o, mask); o += 2;
  if (mask & F.X) { v.setInt16(o, Math.round(cur.x * Q)); o += 2; }
  if (mask & F.Y) { v.setInt16(o, Math.round(cur.y * Q)); o += 2; }
  if (mask & F.VX) { v.setInt8(o, Math.round(cur.vx / 4)); o += 1; }
  if (mask & F.VY) { v.setInt8(o, Math.round(cur.vy / 4)); o += 1; }
  if (mask & F.HP) { v.setUint16(o, cur.hp); o += 2; }
  if (mask & F.MP) { v.setUint16(o, cur.mp); o += 2; }
  if (mask & F.LVL) { v.setUint8(o, cur.lvl); o += 1; }
  if (mask & F.STATE) { v.setUint8(o, cur.state); o += 1; }
  if (mask & F.TARGET) { v.setUint32(o, cur.target); o += 4; }
  if (mask & F.BUFF) { v.setUint16(o, cur.buff); o += 2; }
  if (mask & F.SKIN) { v.setUint16(o, cur.skin); o += 2; }
  return buf;

  function buildMask(p: EntityState, c: EntityState): number {
    let m = 0;
    if (Math.round(p.x * Q) !== Math.round(c.x * Q)) m |= F.X;
    if (Math.round(p.y * Q) !== Math.round(c.y * Q)) m |= F.Y;
    if (p.vx !== c.vx) m |= F.VX;
    if (p.vy !== c.vy) m |= F.VY;
    if (p.hp !== c.hp) m |= F.HP;
    if (p.mp !== c.mp) m |= F.MP;
    if (p.lvl !== c.lvl) m |= F.LVL;
    if (p.state !== c.state) m |= F.STATE;
    if (p.target !== c.target) m |= F.TARGET;
    if (p.buff !== c.buff) m |= F.BUFF;
    if (p.skin !== c.skin) m |= F.SKIN;
    return m;
  }
  function payloadSize(e: EntityState, m: number): number {
    let n = 0;
    if (m & F.X) n += 2; if (m & F.Y) n += 2;
    if (m & F.VX) n += 1; if (m & F.VY) n += 1;
    if (m & F.HP) n += 2; if (m & F.MP) n += 2;
    if (m & F.LVL) n += 1; if (m & F.STATE) n += 1;
    if (m & F.TARGET) n += 4; if (m & F.BUFF) n += 2; if (m & F.SKIN) n += 2;
    return n;
  }
}

export function applyDelta(prev: EntityState, delta: DataView): EntityState {
  const e = { ...prev };
  let o = 6;                                     // id(4)+mask(2) 건너뜀
  e.id = delta.getUint32(0);
  const mask = delta.getUint16(4);
  if (mask & F.X) e.x = delta.getInt16(o) / Q; o += 2;
  if (mask & F.Y) e.y = delta.getInt16(o) / Q; o += 2;
  if (mask & F.VX) e.vx = delta.getInt8(o) * 4; o += 1;
  if (mask & F.VY) e.vy = delta.getInt8(o) * 4; o += 1;
  if (mask & F.HP) e.hp = delta.getUint16(o); o += 2;
  if (mask & F.MP) e.mp = delta.getUint16(o); o += 2;
  if (mask & F.LVL) e.lvl = delta.getUint8(o); o += 1;
  if (mask & F.STATE) e.state = delta.getUint8(o); o += 1;
  if (mask & F.TARGET) e.target = delta.getUint32(o); o += 4;
  if (mask & F.BUFF) e.buff = delta.getUint16(o); o += 2;
  if (mask & F.SKIN) e.skin = delta.getUint16(o);
  return e;
}`,
      },
    ],
    tips: [
      "델타 기준점은 '수신자가 마지막으로 승인한 스냅샷'이어야 한다 — 서버가 유저별 lastAckSeq를 유지해야 유실 후 정확한 재기준이 가능하다.",
      "연속 델타 유실이 3회 이상이면 즉시 full 스냅샷으로 복구하는 정책이 실무 표준이다.",
      "마스크에 버전 비트를 2~3개 남겨두면 스키마 확장(신규 필드)이 하위 호환을 유지한 채 가능하다.",
      "permessage-deflate(SHARED_COMPRESSOR)는 델타의 반복 헤더를 추가로 눌러준다 — 이미 양자화된 바이트열에는 대체로 20~30% 추가 절약이다.",
    ],
  },
  {
    id: "015",
    title: "레이턴시 보상(Lag Compensation) 판정 연산",
    role: [
      "유저가 150ms 라그 상태에서 몬스터를 향해 베기를 눌렀을 때, 화면의 몬스터와 서버의 몬스터 위치는 다르다. 서버가 현재 위치로만 판정하면 유저는 '명백히 맞았는데 빗나갔다'고 느낀다. 랙 컴펜세이션은 서버가 과거 시점(RTT만큼 이전)의 월드 상태를 버퍼에 보관해 두었다가, 유저의 공격을 '유저가 본 시점'의 상태로 판정하는 기법이다. FPS의 원격 shooter rewind와 동일한 원리가 근접/타겟팅 MMORPG에 적용된 형태다.",
      "구현의 핵심은 두 가지다. 첫째, 서버는 모든 동적 엔티티의 과거 상태를 일정 틱(보통 1초 = 60틱)만큼 링 버퍼로 보관한다. 둘째, 공격 패킷에는 클라이언트가 조준 당시 기준으로 삼은 서버 시각(clientTick)을 실어 보내고, 서버는 해당 틱 상태로 히트박스를 되감아 판정한다. 판정 결과는 현재 상태에 적용하되(과거로 되돌리지 않음), 보정량이 너무 크면(스폰 직후 등) 현재 상태 기준으로 절충한다.",
    ],
    blocks: [
      {
        lang: "server/combat/LagComp.ts",
        code: `import { distPointSector, distPointRect, distPointCircle } from "./hitbox";

export interface TickState {            // 틱별 저장 상태(엔티티 단위)
  id: number; x: number; y: number; dead: boolean;
}
export interface AttackPacket {
  attackerId: number;
  skillId: number;
  aimTick: number;                      // 클라가 본 서버 틱(클라가 마지막 받은 tick)
  origin: { x: number; y: number };     // 공격자 클라이언트 위치(참고용)
  shape: { kind: "circle" | "sector" | "rect";
           r?: number; angle?: number; dir?: number;
           w?: number; h?: number };
}

const HISTORY_TICKS = 60;               // 1초 버퍼(60Hz 가정)
const MAX_REWIND_TICKS = 30;            // 되감기 상한 0.5초 — 어뷰징 방지

export class LagCompensator {
  private history: Map<number, TickState[]> = new Map();  // tick → entities

  pushTick(tick: number, states: TickState[]) {
    this.history.set(tick, states);
    this.history.delete(tick - HISTORY_TICKS);          // 링 버퍼
  }

  judge(pkt: AttackPacket, currentTick: number, currentStates: TickState[],
        maxLatencyTicks = MAX_REWIND_TICKS): number[] {
    // 1) 되감기 틱 산정: 클라 요청 틱 사용, 단 상한 클램프 + 미래 금지
    let rewind = currentTick - pkt.aimTick;
    if (rewind < 0) rewind = 0;                          // 미래 틱 조작 차단
    if (rewind > maxLatencyTicks) rewind = maxLatencyTicks;
    const targetTick = currentTick - rewind;
    const rewound = this.history.get(targetTick) ?? currentStates;

    // 2) 되감은 상태에서 히트박스 판정
    const attacker = rewound.find(s => s.id === pkt.attackerId);
    if (!attacker) return [];
    const ox = pkt.origin && rewind > 0 ? attacker.x : attacker.x;
    const oy = pkt.origin && rewind > 0 ? attacker.y : attacker.y;

    const hits: number[] = [];
    for (const s of rewound) {
      if (s.id === pkt.attackerId || s.dead) continue;
      let hit = false;
      switch (pkt.shape.kind) {
        case "circle": hit = distPointCircle(s.x, s.y, ox, oy, pkt.shape.r!) <= 0; break;
        case "sector": hit = distPointSector(s.x, s.y, ox, oy,
                          pkt.shape.r!, pkt.shape.angle!, pkt.shape.dir!) <= 0; break;
        case "rect":   hit = distPointRect(s.x, s.y, ox, oy,
                          pkt.shape.w!, pkt.shape.h!, pkt.shape.dir!) <= 0; break;
      }
      if (hit) hits.push(s.id);
    }

    // 3) 되감기 페널티 절충: 되감은 대상이 현재 위치로 크게 이동했다면
    //    현재 상태 재검증(스폰 회피/텔레포트 어뷰징 방지)
    return hits.filter(id => {
      const now = currentStates.find(s => s.id === id);
      if (!now) return false;
      const past = rewound.find(s => s.id === id)!;
      return Math.hypot(now.x - past.x, now.y - past.y) < 200;   // 200px 이내만 유효
    });
  }
}`,
      },
    ],
    tips: [
      "rewind 상한(0.5초)이 없으면 핵 유저가 aimTick을 조작해 '5초 전 몬스터'를 때릴 수 있다 — 반드시 클램프한다.",
      "판정은 과거 상태로 하되 데미지 적용은 현재 틱에 한다 — 상태를 과거로 되돌리면 다른 유저 판정이 꼬인다.",
      "파티/보스전처럼 유저 밀도가 높은 전투는 되감기 페널티(이동량 상한)를 느슨하게, PVP는 엄격하게 조정한다.",
      "클라이언트는 서버 시각 동기화(RTT/2 추정, 019번과 연계)로 aimTick을 정확히 계산해야 보상 정확도가 나온다.",
    ],
  },
];
