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
 *   · v1.0.13 피드백#11 — GM 플래그는 "검증된 GM"만 중계한다(기존 "미중계" 정책 교체):
 *      - 발신: 로그인 세션 토큰(localStorage sertz.auth.token)을 가진 관리자(캐시 role=admin)만
 *        join/st 프레즌스에 gm:true + gmu(아이디) + gmv(SHA-256(token) 앞 16자)를 붙인다.
 *        토큰 원문은 공개 브로커에 절대 노출하지 않는다.
 *      - 수신: 원격이 보낸 gm/gmv/gmu는 그대로 믿지 않고, /api/auth/gmcheck?uid&proof 로
 *        (uid,proof) 1회 검증 — 서버가 "실제 admin 세션 토큰의 해시 단편"인지 확인.
 *        검증 실패/미도달은 gm=false 유지 → 스푸핑 무의미. 검증 전엔 일반 유저로 렌더링되고
 *        통과 시 그때 [GM]으로 승격된다(WorldScene 동적 승격).
 *   · 페이로드는 multiplayer/index.js와 동일하게 세탁(길이 절단·수치 클램프).
 *   · 7초 무신호 원격은 목록에서 자동 제거, 16초 무신호 친구는 오프라인 처리.
 *   · 브로커 불안정/차단 시 connected=false → 게임은 지금까지와 동일하게 무영향.
 */
import mqtt from "mqtt";
/* v1.0.13 피드백#11 — 로컬 관리자 판정(캐시 유저)·토큰 읽기: account.ts 공용 헬퍼 재사용.
 *  gmcheck 베이스 URL은 server.ts resolveApiBase(계정 API와 동일 출처 해석)를 쓴다. */
import { getCachedUser, getAuthToken } from "./account";
import { resolveApiBase } from "./server";
import { presenceSessionId } from "./playerIdentity";
import { rekeyLegacy, legacyStageKeys } from "./legacyKeys";

/* Both existing brokers stay connected so fallback clients remain visible. */
const BROKERS = [
  "wss://broker.emqx.io:8084/mqtt",
  "wss://broker.hivemq.com:8884/mqtt",
];
/** Back off a failing broker after four reconnects; the other link stays active. */
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
  /* v1.0.13 피드백#11 — 원격 GM 증명(수신 원문) + 검증 완료 플래그.
   *  gmRaw/gmv/gmu는 수신 그대로(미검증), gm은 gmcheck 통과 시에만 true. */
  gmRaw?: boolean;
  gmv?: string;
  gmu?: string;
  gm?: boolean;
};

type Listener = Set<(...args: never[]) => void>;

/* ---------------- 페이로드 세탁 (서버 로직과 동일 방침) ---------------- */
const clean = (s: unknown, max: number): string =>
  String(s ?? "")
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029]/g, "")
    .trim()
    .slice(0, max);
const num = (v: unknown, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));
/* 2026-11-16 — 구역 키 정규화. 옛 '9개의 바다' 이름을 보내는 구버전 사용자와 같은 방(토픽)에
 *  모이게 한다. 서버 경로(multiplayer/index.js)와 같은 이관표를 쓰므로 양쪽이 같은 값으로 수렴한다. */
const stageKey = (s: unknown): string => rekeyLegacy(clean(s, 24).toLowerCase().replace(/[^a-z0-9_-]/g, "")) || "village";

/* ---------------- v1.0.13 피드백#11 — 로컬 GM 증명 (검증된 관리자만 전파) ----------------
 *  · 증명 = sha16(token): SHA-256(세션 토큰) 앞 16 hex — Web Crypto로 1회 계산 후 캐시.
 *  · 자기선언 gm:true만으로는 스푸핑이 가능하므로, 수신 측은 반드시 /api/auth/gmcheck로
 *    "서버에 살아있는 admin 세션 토큰의 해시 단편"임을 확인한다 (아래 verifyGmPeer).
 *  · 모든 await는 fire-and-forget — 멀티플레이 어느 경로도 gmcheck를 기다리지 않는다. */
type GmSelf = { gm: boolean; gmu: string; gmv: string };
let gmSelf: GmSelf = { gm: false, gmu: "", gmv: "" };
let gmShaCache: { tok: string; sha: string } | null = null;

/** SHA-256(token) 앞 16자 (Web Crypto — 비동기, 1회 계산 후 캐시) */
async function sha16OfToken(tok: string): Promise<string> {
  if (gmShaCache?.tok === tok) return gmShaCache.sha;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(tok));
  const sha = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
  gmShaCache = { tok, sha };
  return sha;
}

/** 로컬 관리자 증명 갱신 — 캐시 유저(role=admin) + 세션 토큰이 있을 때만 gm:true.
 *  접속/조인 시점에 호출하고, 해시는 도착하는 대로 채워진다(다음 st 프레즌스부터 전파). */
function refreshGmSelf(): void {
  try {
    const u = getCachedUser();
    const tok = getAuthToken();
    if (!u || u.role !== "admin" || !tok) {
      gmSelf = { gm: false, gmu: "", gmv: "" };
      return;
    }
    const gmu = clean(u.id, 40);
    gmSelf = { gm: true, gmu, gmv: "" };
    void sha16OfToken(tok)
      .then((sha) => {
        if (gmSelf.gmu === gmu && sha) gmSelf.gmv = sha; // 로그아웃/계정 전환 시 폐기
      })
      .catch(() => {
        gmSelf = { gm: false, gmu: "", gmv: "" };
      });
  } catch {
    gmSelf = { gm: false, gmu: "", gmv: "" };
  }
}

/** 내 gm 증명이 준비됐을 때만 공개 페이로드에 첨부 (증명 없는 gm:true는 전파하지 않는다) */
function gmPayloadFields(): Record<string, unknown> {
  return gmSelf.gm && gmSelf.gmv && gmSelf.gmu ? { gm: true, gmu: gmSelf.gmu, gmv: gmSelf.gmv } : {};
}

let bus: MqttBus | null = null;

export function mpActive(): boolean {
  return !!bus;
}

/** MQTT 트랜스포트 생성 — 실패 시 null(기존 오프라인 동작 유지) */
export function mpConnect(): MqttBus | null {
  if (bus) return bus;
  if (typeof window === "undefined") return null;
  try {
    /* v1.0.13 피드백#11 — 접속 시점에 로컬 GM 증명 선계산 (조인 전 해시 준비) */
    refreshGmSelf();
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
  readonly id = presenceSessionId();

  private links = new Map<number, mqtt.MqttClient>();
  private liveLinks = new Set<mqtt.MqttClient>();
  private linkTopics = new WeakMap<mqtt.MqttClient, string[]>();
  private peerLinks = new Map<string, Map<number, number>>();
  private seenCommands = new Map<string, true>();
  private packetSeq = 0;
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
  private subscribedTopics: string[] = [];
  private started = false;
  private timers: ReturnType<typeof setInterval>[] = [];
  private brokerIdx = 0;

  constructor() {
    this.open(0);
    this.open(1);
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
        for (const [id, links] of this.peerLinks) {
          for (const [link, at] of links) if (now - at > FRIEND_TTL_MS) links.delete(link);
          if (!links.size) this.peerLinks.delete(id);
        }
      }, 2000),
    );
    try {
      window.addEventListener("beforeunload", () => this.publish({ k: "bye", pid: this.id }, ROOT + "presence"));
    } catch { /* 무시 */ }
  }

  /* ---------- 브로커 접속 ---------- */
  private open(idx: number) {
    if (idx >= BROKERS.length || this.links.has(idx)) return;
    try {
      const c = mqtt.connect(BROKERS[idx], {
        clientId: this.id.slice(0, 32), keepalive: 30, connectTimeout: 8000,
        reconnectPeriod: 4000, protocolVersion: 4,
        // A lost broker connection is not a departure from the other broker.
        will: { topic: ROOT + "presence", payload: Buffer.from(JSON.stringify({ k: "bye", pid: this.id, linkBye: true })), qos: 0, retain: false },
      });
      this.links.set(idx, c);
      let connectedOnce = false, closeFails = 0;
      const offline = () => {
        this.liveLinks.delete(c);
        this.connected = this.liveLinks.size > 0;
      };
      const retry = () => {
        if (this.links.get(idx) !== c) return;
        this.links.delete(idx);
        offline();
        try { c.end(true); } catch { /* 무시 */ }
        setTimeout(() => this.open(idx), 30000);
      };
      c.on("connect", () => {
        if (this.links.get(idx) !== c) return;
        const wasConnected = this.connected;
        connectedOnce = true;
        closeFails = 0;
        this.liveLinks.add(c);
        this.connected = true;
        this.brokerIdx = idx;
        this.linkTopics.delete(c);
        this.syncStageSub();
        this.publishPresence();
        if (this.lastState) this.sendState(true);
        if (!wasConnected) this.fire("connect");
      });
      c.on("close", () => {
        offline();
        if (++closeFails >= RECONNECT_ROTATE_AT) retry();
      });
      c.on("offline", offline);
      c.on("error", () => { /* mqtt reconnects, then retry backs off for 30 seconds */ });
      c.on("message", (topic, payload) => this.onMessage(topic, payload, idx));
      setTimeout(() => { if (!connectedOnce) retry(); }, 8000);
    } catch {
      setTimeout(() => this.open(idx), 30000);
    }
  }

  /* ---------- 구독/발행 ---------- */
  private syncStageSub() {
    if (!this.connected) return;
    const want = ROOT + "stage/" + this.stage;
    this.subscribedStage = want;
    this.subscribedTopics = legacyStageKeys(this.stage).map(key => ROOT + "stage/" + key);
    for (const c of this.liveLinks) {
      const previous = this.linkTopics.get(c);
      if (previous?.[0] === want) continue;
      try {
        if (previous?.length) c.unsubscribe(previous);
        // Receiving a trade must work before this client sends its first trade.
        c.subscribe([...this.subscribedTopics, ROOT + "presence", ROOT + "trade/" + this.id], { qos: 0 });
        this.linkTopics.set(c, this.subscribedTopics);
      } catch { /* retry on the next state/join */ }
    }
    this.presenceSubbed = true;
  }

  private presenceSubbed = false;

  private publish(obj: Record<string, unknown>, topic: string) {
    if (!this.connected) return;
    const mid = this.id + ":" + (++this.packetSeq);
    const stages = topic === ROOT + "stage/" + this.stage ? legacyStageKeys(this.stage) : null;
    const messages = stages
      ? stages.map(stage => ({ topic: ROOT + "stage/" + stage, payload: JSON.stringify({ ...obj, mid, aoi: this.stage, ...(obj.stage ? { stage } : {}) }) }))
      : [{ topic, payload: JSON.stringify({ ...obj, mid }) }];
    for (const c of this.liveLinks) for (const m of messages) {
      try { c.publish(m.topic, m.payload, { qos: 0, retain: false }); } catch { /* other broker stays usable */ }
    }
  }

  /* ---------- 수신 ---------- */
  private onMessage(topic: string, payload: Uint8Array, link = 0) {
    let m: Record<string, unknown>;
    try { m = JSON.parse(Buffer.from(payload).toString("utf8")) as Record<string, unknown>; } catch { return; }
    const pid = clean(m.pid, 40);
    if (!pid || pid === this.id) return; // 자기 메시지 무시
    const k = String(m.k ?? "");
    const global = topic === ROOT + "presence" || topic === ROOT + "trade/" + this.id;
    if (!global && (!this.subscribedTopics.includes(topic) || (m.aoi === this.stage && topic !== ROOT + "stage/" + this.stage))) return;
    if (k === "pr" || k === "hi" || k === "st") {
      let links = this.peerLinks.get(pid);
      if (!links) this.peerLinks.set(pid, links = new Map());
      links.set(link, Date.now());
    }
    if (k === "bye") {
      const links = this.peerLinks.get(pid);
      if (m.linkBye) {
        links?.delete(link);
        if (links && [...links.values()].some(at => Date.now() - at < PEER_TTL_MS)) return;
      }
      this.peerLinks.delete(pid);
    }
    // State/presence are idempotent; only commands need bounded cross-broker deduplication.
    if (!["pr", "hi", "st"].includes(k) && m.mid) {
      const key = pid + ":" + clean(m.mid, 80);
      if (this.seenCommands.has(key)) return;
      this.seenCommands.set(key, true);
      if (this.seenCommands.size > 4096) this.seenCommands.delete(this.seenCommands.keys().next().value!);
    }


    /* vc142 (#3) — 1:1 거래 개인 토픽 */
    if (topic === ROOT + "trade/" + this.id) {
      this.onTradeMessage(m, pid);
      return;
    }

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

    /* Ignore in-flight messages from the previous map subscription. */
    if (!this.subscribedTopics.includes(topic)) return;
    // New clients receive the canonical copy once; legacy clients only see their own topic.
    if (m.aoi === this.stage && topic !== ROOT + "stage/" + this.stage) return;
    /* stage/<key> 토픽 */
    if (k === "hi" || k === "st") {
      const prev = this.peers.get(pid);
      /* v1.0.13 피드백#11 — 원격 GM 증명 수신(미검증 원문 보관).
       *  형식 세탁: gmv는 16자 hex, gmu는 40자 식별자만 통과 — 이상치는 gm 미첨부와 동일 취급. */
      const gmvRaw = clean(m.gmv, 32).toLowerCase();
      const gmuRaw = clean(m.gmu, 40);
      const gmValid = !!m.gm && /^[0-9a-f]{16}$/.test(gmvRaw) && gmuRaw.length >= 3;
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
        gmRaw: gmValid ? true : false,
        gmv: gmValid ? gmvRaw : undefined,
        gmu: gmValid ? gmuRaw : undefined,
        gm: gmValid ? prev?.gm ?? false : false, // 검증 전엔 일반 유저로 렌더 (증명이 바뀌면 재검증)
      };
      this.peers.set(pid, rec);
      if (k === "st") this.recvSt++;
      if (gmValid) this.verifyGmPeer(pid); // fire-and-forget — 결과는 다음 players emit에 반영
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
      if (!["atk", "s1", "s2", "s3", "s4", "s5", "s5b", "s5f", "s5bf"].includes(kind)) return;
      this.fire("act", {
        id: pid,
        kind,
        x: num(m.x, -9999, 99999),
        y: num(m.y, -9999, 99999),
        flip: !!m.flip,
        cls: typeof m.cls === "string" && m.cls ? m.cls.slice(0, 16) : null,
        angle: typeof m.angle === "number" && Math.abs(m.angle) <= 2 * Math.PI ? m.angle : undefined,
      });
      return;
    }
    /* vc143 (#4 공유 보스 체력) — bdmg(딜 릴레이)/bhp(호스트 권위 HP 브로드캐스트) */
    if (k === "bdmg" || k === "bhp") {
      this.fire("boss", {
        id: pid,
        n: k === "bdmg" ? num(m.n, 0, 999999999) : undefined,
        hp: k === "bhp" ? num(m.hp, 0, 999999999) : undefined,
        max: k === "bhp" ? num(m.max, 1, 999999999) : undefined,
        dead: k === "bhp" ? !!m.dead : undefined,
      });
      return;
    }
  }

  /* ---------- 발신 (net.ts emit 진입점) ---------- */
  emit(ev: string, ...args: unknown[]): void {
    switch (ev) {
      case "join": {
        const info = (args[0] ?? {}) as Record<string, unknown>;
        /* v1.0.13 피드백#11 — 조인 시 로컬 GM 증명 갱신 (관리자 로그인/로그아웃 반영).
         *  gm은 자기선언을 그대로 믿지 않는다 — 증명(gmu/gmv)이 붙을 때만 전파되고,
         *  수신 측이 gmcheck로 최종 검증한다. */
        refreshGmSelf();
        this.me = {
          name: clean(info.name, 8) || "이름없음",
          lv: num(info.lv, 1, 9999),
          cls: typeof info.cls === "string" && info.cls ? info.cls.slice(0, 16) : null,
          code: clean(info.code, 12).toUpperCase(),
          gm: gmSelf.gm,
        };
        const nextStage = stageKey(info.stage);
        if (nextStage !== this.stage) { this.peers.clear(); this.emitPlayers(); }
        this.stage = nextStage;
        this.lastState = { x: num(info.x, -9999, 99999), y: num(info.y, -9999, 99999), flip: false, moving: false };
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
          this.peers.clear();
          this.emitPlayers();
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
        if (!["atk", "s1", "s2", "s3", "s4", "s5", "s5b", "s5f", "s5bf"].includes(kind)) return;
        /* 도폭 방지 250ms 스로틀 */
        const now = Date.now();
        if (now - this.lastSentAt < 250 && this.lastActKind === kind) return;
        this.lastActKind = kind;
        this.lastSentAt = now;
        const angle = typeof a.angle === "number" && Math.abs(a.angle) <= 2 * Math.PI ? a.angle : undefined;
        const cls = angle !== undefined && typeof a.cls === "string" ? a.cls.slice(0, 16) : this.me.cls;
        this.publish({ k: "act", pid: this.id, kind, x: num(a.x, -9999, 99999), y: num(a.y, -9999, 99999), flip: !!a.flip, cls, angle, t: now }, ROOT + "stage/" + this.stage);
        break;
      }
      /* vc143 (#4 공유 보스 체력) — n 있으면 딜 릴레이(bdmg), 없으면 호스트 HP 브로드캐스트(bhp).
       *  act와 별개 스로틀 — 딜 릴레이는 WorldScene에서 200ms 합산 전송, bhp는 250ms 주기 */
      case "boss": {
        const m = (args[0] ?? {}) as Record<string, unknown>;
        const now = Date.now();
        if (m.n != null) {
          this.publish({ k: "bdmg", pid: this.id, n: num(m.n, 0, 999999999), t: now }, ROOT + "stage/" + this.stage);
        } else {
          this.publish({ k: "bhp", pid: this.id, hp: num(m.hp, 0, 999999999), max: num(m.max, 1, 999999999), dead: m.dead ? 1 : 0, t: now }, ROOT + "stage/" + this.stage);
        }
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
    /* v1.0.13 피드백#11 — 검증 증명이 준비된 관리자만 gm/gmu/gmv 첨부 (없으면 기존과 동일) */
    return { name: this.me.name, lv: this.me.lv, cls: this.me.cls, code: this.me.code, stage: this.stage, ...gmPayloadFields() };
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

  /* ================= vc142 (#3) — 1:1 플레이어 거래 (MQTT) =================
   *  · 토픽: trade/<상대pid>  — 거래 상대에게만 보내는 1:1 채널
   *  · 메시지: treq(요청)·tacc(수락)·tdeny(거절)·toff(오버 갱신)·tlock(확정)·tcancel(취소)
   *  · 검증은 각 클라이언트가 로컬 세이브 기준으로 수행 (브로커는 중계만) */

  private ensureTradeSub() {
    this.syncStageSub();
  }

  /** 거래 메시지 전송 — 상대 개인 토픽으로 */
  tradeSend(to: string, msg: Record<string, unknown>) {
    const t = clean(to, 40);
    if (!t) return;
    this.ensureTradeSub();
    this.publish({ ...msg, pid: this.id, to: t, t: Date.now() }, ROOT + "trade/" + t);
  }

  private onTradeMessage(m: Record<string, unknown>, pid: string) {
    const k = String(m.k ?? "");
    if (!["treq", "tacc", "tdeny", "toff", "tlock", "tcancel"].includes(k)) return;
    /* 오버 갱신: items(≤12 · key 24자)·gold·emerald 세탁 */
    const offer = (() => {
      const raw = Array.isArray(m.items) ? (m.items as unknown[]).slice(0, 12) : [];
      return {
        items: raw.map((s) => clean(s, 24)).filter((s) => /^[a-z0-9_]{2,24}$/.test(s)),
        gold: num(m.gold, 0, 999999999),
        emerald: num(m.emerald, 0, 999999),
      };
    })();
    this.fire("trade", { k, from: pid, name: clean(m.name, 8), offer });
  }

  /* ================= v1.0.13 피드백#11 — 원격 GM 검증 (gmcheck, 1회 캐시) =================
   *  · (uid,proof)당 1회만 서버에 묻고 결과를 캐시 — 프레즌스마다 재요청하지 않는다.
   *  · fetch 실패/타임아웃/서버 오류는 전부 "검증 실패" = gm 유지(false). 절대 블로킹 없음. */
  private gmChecks = new Map<string, boolean>();
  private gmInflight = new Set<string>();

  private verifyGmPeer(pid: string): void {
    const p = this.peers.get(pid);
    if (!p || !p.gmu || !p.gmv || !p.gmRaw) return;
    const key = `${p.gmu}:${p.gmv}`;
    const cached = this.gmChecks.get(key);
    if (cached !== undefined) {
      p.gm = cached; // 캐시 결과 즉시 반영 (다음 emitPlayers에서 전파)
      return;
    }
    if (this.gmInflight.has(key)) return; // 진행 중 — 완료 시 일괄 반영
    this.gmInflight.add(key);
    void (async () => {
      let ok = false;
      try {
        const base = resolveApiBase();
        const url = `${base}/api/auth/gmcheck?uid=${encodeURIComponent(p.gmu || "")}&proof=${encodeURIComponent(p.gmv || "")}`;
        const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(6000) });
        if (r.ok) {
          const d = (await r.json().catch(() => ({}))) as { gm?: unknown };
          ok = d.gm === true;
        }
      } catch { /* 미도달/타임아웃 — 검증 실패 처리 */ }
      this.gmChecks.set(key, ok);
      this.gmInflight.delete(key);
      /* 검증 완료 — 증명이 일치하는 모든 원격에 반영 (프레즌스가 갱신돼도 동일 증명 재사용) */
      for (const q of this.peers.values()) {
        if (q.gmu === p.gmu && q.gmv === p.gmv) q.gm = ok && !!q.gmRaw;
      }
    })();
  }

  private emitPlayers() {
    if (!this.connected) return;
    const list: Record<string, unknown>[] = [];
    /* 내 상태 포함(서버 players 맵과 동일 — 씬에서 자기 id 필터).
     *  v1.0.13 피드백#11 — 내 gm은 로컬 관리자 세션 기준(셀프 렌더는 씬에서 필터되므로 표시 영향 없음) */
    if (this.lastState) {
      list.push({ id: this.id, ...this.mePublic(), ...this.lastState, gm: gmSelf.gm });
    }
    for (const p of this.peers.values()) {
      if (p.stage !== this.stage) continue;
      /* v1.0.13 피드백#11 — gm은 gmcheck 검증을 통과한 원격에게만 true (검증 전 false → 통과 시 승격) */
      list.push({ id: p.id, name: p.name, lv: p.lv, cls: p.cls, x: p.x, y: p.y, flip: p.flip, moving: p.moving, gm: !!p.gm });
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
