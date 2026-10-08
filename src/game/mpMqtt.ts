/**
 * v1.0.5-beta (vc134) — MQTT 멀티플레이 트랜스포트 ("웹에서 서로 안보임" 수정)
 *
 *  [문제] Vercel serverless 배포(웹)와 APK 기본 구성엔 socket.io 서버가 없다.
 *   net.resolveServerUrl()이 null → 완전 오프라인 → 같은 웹을 켠 다른 플레이어가
 *   서로 보이지 않는다(채팅·파티는 relay.ts HTTP 폴링이 이미 커버).
 *
 *  [해결] 소켓 서버가 없으면(또는 강제 지정 시) 공개 MQTT 브로커(wss)로
 *   플레이어 프레즌스를 실시간 동기화한다. 서버리스로는 불가능한 낮은 지연(수백 ms)을
 *   제3자 브로커가 중계한다 — 가입/설정 불필요, 실패 시 기존 오프라인 모드로 조용히 강등.
 *
 *  [채널 설계] (root: sertz/mp/v2/)
 *   · stage/<key>  — 스테이지 AOI. state(이동)/act(공격 연출)/hi(입장) 중계
 *   · presence     — 5초 하트비트(이름·레벨·직업·구역·친구코드) → 친구 온라인 목록
 *   · LWT          — 접속 끊김 즉시 퇴장 통지(bye)
 *
 *  [정책]
 *   · gm 플래그는 중계하지 않는다(공개 브로커라 스푸핑 가능 — GM 표시는 소켓 서버 전용).
 *   · 페이로드는 multiplayer/index.js와 동일하게 세탁(길이 절단·수치 클램프).
 *   · 7초 무신호 원격은 목록에서 자동 제거, 16초 무신호 친구는 오프라인 처리.
 *   · 브로커 불안정/차단 시 connected=false → 게임은 지금까지와 동일하게 무영향.
 */
import mqtt from "mqtt";

/* 공개 브로커 후보 — 순차 폴백(첫 번째가 8초 내 연결 실패 시 다음)
 * vc140 실측(2026-10-08): eclipseprojects.io는 connack 타임아웃으로 완전 사망 —
 *  여기에 폴백하면 그 클라이언트만 영원히 오프라인 → "서로 캐릭터/스킬 안보임" 재발의 원인.
 *  HiveMQ 공개 브로커(WSS 8884) 실측 연결 866ms + st 라운드트립 OK로 교체했다.
 *  emqx↔hivemq 두 브로커 모두 살아있는 한 세션 중단 시 로테이션으로 자가복귀한다(아래 open 참조). */
const BROKERS = [
  "wss://broker.emqx.io:8084/mqtt",
  "wss://broker.hivemq.com:8884/mqtt",
];
/** vc140 — 세션 중 브로커가 죽었을 때 재접속 실패 누적 회수(이 횟수 초과 시 다음 브로커로 로테이션).
 *  reconnectPeriod 4s이므로 4회 ≈ 16초 — 죽은 브로커에 영원히 매달리지 않는다. */
const RECONNECT_ROTATE_AT = 4;
const ROOT = "sertz/mp/v2/";
/** 원격 유실 판정(ms) — 이동 상태가 이보다 오래 안 오면 화면에서 제거 */
const PEER_TTL_MS = 7000;
/** 친구 프레즌스 유실 판정(ms) */
const FRIEND_TTL_MS = 16000;
/** 내 상태 유지보수 송신(멈춰 있어도 주기적으로 "살아있음" 증명) */
const STATE_KEEPALIVE_MS = 2500;
/** 프레즌스 하트비트 주기 */
const PRESENCE_MS = 5000;
/** players 콜백 발생 주기 (씬 syncRemotes는 목표좌표 보간) */
const PLAYERS_EMIT_MS = 320;

export type MqttBus = {
  connected: boolean;
  id: string;
  on(ev: string, cb: (...args: never[]) => void): void;
  off(ev: string, cb?: (...args: never[]) => void): void;
  emit(ev: string, ...args: unknown[]): void;
};

type PeerState = {
  id: string;
  name: string;
  lv: number;
  cls: string | null;
  x: number;
  y: number;
  flip: boolean;
  moving: boolean;
  stage: string;
  code: string;
  t: number;
};

type Listener = Set<(...args: never[]) => void>;

/* ---------------- 세션 ID (relay.ts cid 재사용 — 기기당 안정) ---------------- */
function sessionPid(): string {
  try {
    let cid = window.localStorage.getItem("sertz.relay.cid") || "";
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(cid)) {
      cid = `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem("sertz.relay.cid", cid);
    }
    return `sz${cid}`.slice(0, 40);
  } catch {
    return `sz${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }
}

/* ---------------- 페이로드 세탁 (서버 로직과 동일 방침) ---------------- */
const clean = (s: unknown, max: number): string =>
  String(s ?? "")
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029]/g, "")
    .trim()
    .slice(0, max);
const num = (v: unknown, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));
const stageKey = (s: unknown): string => clean(s, 24).toLowerCase().replace(/[^a-z0-9_-]/g, "") || "village";

let bus: MqttBus | null = null;

export function mpActive(): boolean {
  return !!bus;
}

/** MQTT 트랜스포트 생성 — 실패 시 null(기존 오프라인 동작 유지) */
export function mpConnect(): MqttBus | null {
  if (bus) return bus;
  if (typeof window === "undefined") return null;
  try {
    bus = new MqttBusImpl();
    return bus;
  } catch {
    bus = null;
    return null;
  }
}

/** 강제 모드(localStorage sertz.mp.force) — 진단/E2E용: "mqtt" | "off" | "" */
export function mpForce(): string {
  try {
    return (window.localStorage.getItem("sertz.mp.force") || "").trim();
  } catch {
    return "";
  }
}

class MqttBusImpl implements MqttBus {
  connected = false;
  readonly id = sessionPid();

  private client: mqtt.MqttClient | null = null;
  private listeners = new Map<string, Listener>();
  private peers = new Map<string, PeerState>();
  private friends = new Map<string, PeerState>();

  private me: { name: string; lv: number; cls: string | null; code: string; gm: boolean } = {
    name: "이름없음", lv: 1, cls: null, code: "", gm: false,
  };
  private lastState: { x: number; y: number; flip: boolean; moving: boolean } | null = null;
  private lastSentAt = 0;
  private stage = "village";
  private subscribedStage = "";
  private started = false;
  private timers: ReturnType<typeof setInterval>[] = [];
  private brokerIdx = 0;

  constructor() {
    this.open(0);
    /* vc134 진단 훅 — E2E/운영 진단용 버스 내부 상태 (기능 영향 없음) */
    try {
      (window as unknown as { __SERTZ_MQTT__?: unknown }).__SERTZ_MQTT__ = {
        get connected() { return bus?.connected ?? false; },
        get broker() { return BROKERS[(bus as MqttBusImpl | null)?.brokerIdx ?? 0]; },
        get pid() { return (bus as MqttBusImpl | null)?.id ?? null; },
        get stage() { return (bus as MqttBusImpl | null)?.stage ?? ""; },
        get subStage() { return (bus as MqttBusImpl | null)?.subscribedStage ?? ""; },
        get presenceSub() { return (bus as MqttBusImpl | null)?.presenceSubbed ?? false; },
        get peers() { return Object.fromEntries([...((bus as MqttBusImpl | null)?.peers ?? new Map())].map(([k, v]) => [k, { name: v.name, stage: v.stage }])); },
        get friends() { return Object.fromEntries([...((bus as MqttBusImpl | null)?.friends ?? new Map())].map(([k, v]) => [k, { name: v.name, stage: v.stage }])); },
        get sentSt() { return (bus as MqttBusImpl | null)?.sentSt ?? 0; },
        get recvSt() { return (bus as MqttBusImpl | null)?.recvSt ?? 0; },
        get sentHi() { return (bus as MqttBusImpl | null)?.sentHi ?? 0; },
      };
    } catch { /* 무시 */ }
    /* 목표좌표 방식 원격 렌더 — 일정 주기로 스냅샷 전달 (서버 2초 하트비트 대체 + 실시간 state) */
    this.timers.push(setInterval(() => this.emitPlayers(), PLAYERS_EMIT_MS));
    /* 프레즌스 하트비트 */
    this.timers.push(setInterval(() => this.publishPresence(), PRESENCE_MS));
    /* 유실 정리 */
    this.timers.push(
      setInterval(() => {
        const now = Date.now();
        for (const [id, p] of this.peers) if (now - p.t > PEER_TTL_MS) this.peers.delete(id);
        for (const [id, p] of this.friends) if (now - p.t > FRIEND_TTL_MS) this.friends.delete(id);
      }, 2000),
    );
    try {
      window.addEventListener("beforeunload", () => this.publish({ k: "bye", pid: this.id }, ROOT + "presence"));
    } catch { /* 무시 */ }
  }

  /* ---------- 브로커 접속 (순차 폴백) ---------- */
  private open(idx: number) {
    if (idx >= BROKERS.length) {
      console.info("[SERTZ] 공개 멀티 릴레이(브로커) 접속 실패 — 오프라인 모드 유지");
      return;
    }
    try {
      const c = mqtt.connect(BROKERS[idx], {
        clientId: this.id.slice(0, 32),
        keepalive: 30,
        connectTimeout: 8000,
        reconnectPeriod: 4000,
        protocolVersion: 4,
        /* 끊기면 즉시 퇴장 통지 — 원격 화면에서 바로 사라지게 */
        will: { topic: ROOT + "presence", payload: Buffer.from(JSON.stringify({ k: "bye", pid: this.id })), qos: 0, retain: false },
      });
      this.client = c;
      let connectedOnce = false;
      /* vc140 — 재접속 실패 누적 카운터(브로커 로테이션 트리거) */
      let closeFails = 0;
      c.on("connect", () => {
        connectedOnce = true;
        closeFails = 0;
        this.connected = true;
        this.subscribedStage = "";
        this.syncStageSub();
        this.publishPresence();
        if (this.lastState) this.sendState(true);
        this.fire("connect");
      });
      c.on("close", () => {
        this.connected = false;
        /* vc140 — 세션 중단 후 재접속이 RECONNECT_ROTATE_AT회 연속 실패하면 다음 브로커로.
         *  기존엔 같은 브로커에 영원히 재시도 — 브로커가 죽으면 그 클라이언트만 영구 오프라인이었고,
         *  새로 접속한 상대는 다른(살아있는) 브로커에 붙어 서로 안 보이는 분열이 생겼다. */
        if (connectedOnce && this.client === c) {
          closeFails++;
          if (closeFails >= RECONNECT_ROTATE_AT) {
            try { c.end(true); } catch { /* 무시 */ }
            if (this.client === c) {
              this.client = null;
              this.open((idx + 1) % BROKERS.length); // 순환 — 두 브로커 중 살아있는 쪽을 계속 찾는다
            }
          }
        }
      });
      c.on("offline", () => { this.connected = false; });
      c.on("error", () => { /* reconnectPeriod로 자동 재시도 */ });
      c.on("message", (topic, payload) => this.onMessage(topic, payload));
      /* 8초 내 미연결 + 1회도 성공 없음 → 다음 브로커 */
      setTimeout(() => {
        if (!connectedOnce && this.client === c) {
          try { c.end(true); } catch { /* 무시 */ }
          this.client = null;
          this.open(idx + 1);
        }
      }, 8000);
    } catch {
      this.open(idx + 1);
    }
  }

  /* ---------- 구독/발행 ---------- */
  private syncStageSub() {
    if (!this.client || !this.connected) return;
    const want = ROOT + "stage/" + this.stage;
    if (this.subscribedStage !== want) {
      if (this.subscribedStage) {
        try { this.client.unsubscribe(this.subscribedStage); } catch { /* 무시 */ }
      }
      this.subscribedStage = want;
      try { this.client.subscribe(want, { qos: 0 }); } catch { /* 무시 */ }
    }
    /* vc134 — presence 토픽도 구독(친구 온라인 목록·LWT 즉시 퇴장 수신).
     *  기존엔 stage 토픽만 구독해 friends 이벤트가 영원히 안 왔다. */
    if (!this.presenceSubbed) {
      try {
        this.client.subscribe(ROOT + "presence", { qos: 0 });
        this.presenceSubbed = true;
      } catch { /* 무시 */ }
    }
  }

  private presenceSubbed = false;

  private publish(obj: Record<string, unknown>, topic: string) {
    if (!this.client || !this.connected) return;
    try { this.client.publish(topic, JSON.stringify(obj), { qos: 0, retain: false }); } catch { /* 무시 */ }
  }

  /* ---------- 수신 ---------- */
  private onMessage(topic: string, payload: Uint8Array) {
    let m: Record<string, unknown>;
    try { m = JSON.parse(Buffer.from(payload).toString("utf8")) as Record<string, unknown>; } catch { return; }
    const pid = clean(m.pid, 40);
    if (!pid || pid === this.id) return; // 자기 메시지 무시
    const k = String(m.k ?? "");

    if (topic === ROOT + "presence") {
      if (k === "bye") {
        this.friends.delete(pid);
        this.peers.delete(pid);
        this.emitPlayers();
        return;
      }
      const rec: PeerState = {
        id: pid,
        name: clean(m.name, 8) || "이름없음",
        lv: num(m.lv, 1, 9999),
        cls: typeof m.cls === "string" && m.cls ? m.cls.slice(0, 16) : null,
        x: 0, y: 0, flip: false, moving: false,
        stage: stageKey(m.stage),
        code: clean(m.code, 12).toUpperCase(),
        t: Date.now(),
      };
      this.friends.set(pid, rec);
      this.fire("friends", this.friendsList());
      return;
    }

    /* stage/<key> 토픽 */
    if (k === "hi" || k === "st") {
      const prev = this.peers.get(pid);
      const rec: PeerState = {
        id: pid,
        name: clean(m.name, 8) || prev?.name || "이름없음",
        lv: num(m.lv, 1, 9999),
        cls: typeof m.cls === "string" && m.cls ? m.cls.slice(0, 16) : prev?.cls ?? null,
        x: num(m.x, -9999, 99999),
        y: num(m.y, -9999, 99999),
        flip: !!m.flip,
        moving: !!m.moving,
        stage: stageKey(m.stage),
        code: clean(m.code, 12).toUpperCase() || prev?.code || "",
        t: Date.now(),
      };
      this.peers.set(pid, rec);
      if (k === "st") this.recvSt++;
      /* hi는 프레즌스에도 반영 — 상태 하트비트 전에 이름표가 뜨도록 */
      const f = this.friends.get(pid);
      if (f) { f.name = rec.name; f.lv = rec.lv; f.cls = rec.cls; f.stage = rec.stage; f.t = Date.now(); }
      else if (k === "hi") {
        this.friends.set(pid, { ...rec, t: Date.now() });
        this.fire("friends", this.friendsList());
      }
      if (k === "st") this.emitPlayers();
      return;
    }
    if (k === "act") {
      const kind = String(m.kind ?? "");
      if (!["atk", "s1", "s2", "s3", "s4", "s5"].includes(kind)) return;
      this.fire("act", {
        id: pid,
        kind,
        x: num(m.x, -9999, 99999),
        y: num(m.y, -9999, 99999),
        flip: !!m.flip,
        cls: typeof m.cls === "string" && m.cls ? m.cls.slice(0, 16) : null,
      });
      return;
    }
  }

  /* ---------- 발신 (net.ts emit 진입점) ---------- */
  emit(ev: string, ...args: unknown[]): void {
    switch (ev) {
      case "join": {
        const info = (args[0] ?? {}) as Record<string, unknown>;
        this.me = {
          name: clean(info.name, 8) || "이름없음",
          lv: num(info.lv, 1, 9999),
          cls: typeof info.cls === "string" && info.cls ? info.cls.slice(0, 16) : null,
          code: clean(info.code, 12).toUpperCase(),
          /* gm은 공개 브로커 특성상 중계하지 않음(스푸핑 방지) — GM 표시는 소켓 서버 전용 */
          gm: false,
        };
        this.stage = stageKey(info.stage);
        this.syncStageSub();
        this.publishPresence();
        /* 입장 즉시 자리 알림 — 다음 state(≤120ms) 전에 이름표 좌표 확보 */
        this.sentHi++;
        this.publish(
          {
            k: "hi", pid: this.id, ...this.mePublic(),
            x: this.lastState?.x ?? 0, y: this.lastState?.y ?? 0,
            flip: this.lastState?.flip ?? false, moving: false, t: Date.now(),
          },
          ROOT + "stage/" + this.stage,
        );
        break;
      }
      case "state": {
        const st = (args[0] ?? {}) as Record<string, unknown>;
        const nextStage = stageKey(st.stage);
        if (nextStage !== this.stage) {
          this.stage = nextStage;
          this.syncStageSub();
          this.publishPresence();
        }
        this.lastState = { x: num(st.x, -9999, 99999), y: num(st.y, -9999, 99999), flip: !!st.flip, moving: !!st.moving };
        this.me.lv = num(st.lv, 1, 9999);
        this.me.cls = typeof st.cls === "string" && st.cls ? st.cls.slice(0, 16) : this.me.cls;
        this.sendState(false);
        break;
      }
      case "act": {
        const a = (args[0] ?? {}) as Record<string, unknown>;
        const kind = String(a.kind ?? "");
        if (!["atk", "s1", "s2", "s3", "s4", "s5"].includes(kind)) return;
        /* 도폭 방지 250ms 스로틀 */
        const now = Date.now();
        if (now - this.lastSentAt < 250 && this.lastActKind === kind) return;
        this.lastActKind = kind;
        this.lastSentAt = now;
        this.publish({ k: "act", pid: this.id, kind, x: num(a.x, -9999, 99999), y: num(a.y, -9999, 99999), flip: !!a.flip, cls: this.me.cls, t: now }, ROOT + "stage/" + this.stage);
        break;
      }
      default:
        /* party:*, rank:*, job, boss:announce 등은 소켓 서버 전용 — MQTT에선 무시(릴레이/기존 경로 사용) */
        break;
    }
  }

  private lastActKind = "";
  /* vc134 진단 카운터 */
  sentSt = 0;
  recvSt = 0;
  sentHi = 0;

  private mePublic(): Record<string, unknown> {
    return { name: this.me.name, lv: this.me.lv, cls: this.me.cls, code: this.me.code, stage: this.stage };
  }

  private sendState(force: boolean) {
    const now = Date.now();
    if (!force && now - this.lastSentAt < 100) return; // 최대 10Hz
    if (!this.lastState) return;
    this.lastSentAt = now;
    this.sentSt++;
    this.publish(
      { k: "st", pid: this.id, ...this.mePublic(), ...this.lastState, t: now },
      ROOT + "stage/" + this.stage,
    );
  }

  private publishPresence() {
    if (!this.connected) return;
    this.publish({ k: "pr", pid: this.id, ...this.mePublic(), t: Date.now() }, ROOT + "presence");
  }

  /* ---------- 수신 조립 ---------- */
  private friendsList(): PeerState[] {
    const out: PeerState[] = [];
    for (const p of this.friends.values()) {
      out.push(p);
      if (out.length >= 300) break;
    }
    return out;
  }

  private emitPlayers() {
    if (!this.connected) return;
    const list: Record<string, unknown>[] = [];
    /* 내 상태 포함(서버 players 맵과 동일 — 씬에서 자기 id 필터) */
    if (this.lastState) {
      list.push({ id: this.id, ...this.mePublic(), ...this.lastState, gm: false });
    }
    for (const p of this.peers.values()) {
      if (p.stage !== this.stage) continue;
      list.push({ id: p.id, name: p.name, lv: p.lv, cls: p.cls, x: p.x, y: p.y, flip: p.flip, moving: p.moving, gm: false });
      if (list.length >= 60) break;
    }
    this.fire("players", list);
  }

  /* ---------- 이벤트 (socket.io 부분 호환) ---------- */
  on(ev: string, cb: (...args: never[]) => void): void {
    let s = this.listeners.get(ev);
    if (!s) { s = new Set(); this.listeners.set(ev, s); }
    s.add(cb);
  }

  off(ev: string, cb?: (...args: never[]) => void): void {
    if (!cb) { this.listeners.delete(ev); return; }
    this.listeners.get(ev)?.delete(cb);
  }

  private fire(ev: string, ...args: unknown[]) {
    const s = this.listeners.get(ev);
    if (!s) return;
    for (const cb of Array.from(s)) {
      try { (cb as (...a: unknown[]) => void)(...args); } catch { /* 리스너 오류 격리 */ }
    }
  }
}
