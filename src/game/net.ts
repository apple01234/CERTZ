/**
 * 멀티플레이 네트워크 레이어 (v1.7) — socket.io 싱글턴 래퍼
 *  - 같은 서버(미리보기/로컬 dev)에 접속한 모든 플레이어 실시간 동기화
 *  - 오프라인/APK 단독 실행 시 조용히 비활성 (게임플레이 무영향)
 *
 * v2.0 APK 대응:
 *  - 네이티브 WebView는 same-origin(https://localhost)에 게임 서버가 없다.
 *  - localStorage 'sertz.server.url' 에 서버 주소(https://… )를 지정하면 해당 서버로 접속해
 *    웹 플레이어와 같은 서버 멀티플레이가 가능하다.
 *  - 미지정이면 연결 시도 자체를 생략(완전 오프라인 — 재접속 루프/배터리 낭비 없음).
 */
import { Capacitor } from "@capacitor/core";
import { io, type Socket } from "socket.io-client";
/* v1.4.20 — 멀티서버 분리: 게임 서버 해석 로직을 server.ts로 일원화 */
import { GAME_SERVER, isGameServerHost, resolveEntryTarget, storedServerUrl } from "./server";

/** v3.0.8 — Electron(EXE 데스크톱) 감지: UA에 Electron 포함.
 *  EXE는 자체 로컬 서버(same-origin)를 내장하므로 웹과 동일하게 동작하되,
 *  서버 주소 저장 시 원격 멀티플레이 서버로 접속 가능해야 한다. */
export function isElectron(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return /Electron/i.test(navigator.userAgent || "");
}

export type NetPlayer = {
  id: string;
  name: string;
  lv: number;
  cls: string | null;
  x: number;
  y: number;
  flip: boolean;
  moving: boolean;
  /** v1.0.16 — GM 계정 표시: 이름표 금색 [GM] 접두사 + 캐릭터 황금 오라 (코스메틱 전용 플래그) */
  gm?: boolean;
};

export type NetChatMsg = {
  id: string;
  name: string;
  text: string;
  sys?: boolean;
  t: number;
};

let socket: Socket | null = null;
/* v4.0.0 — 마지막 파티 스냅샷 (게이트 팀워크 버프 판정용) */
let lastParty: NetParty | null = null;

/**
 * 접속 대상 서버 URL 결정:
 *  - 웹(게임 서버 오리진: localhost/*.space-z.ai) → undefined (same-origin: server.js socket.io)
 *  - 웹(정적 배포: Vercel 등) → 게임 서버(GAME_SERVER) 직접 접속 (v1.4.20 멀티서버 분리)
 *  - 웹 + localStorage 'sertz.server.url' → 그 주소 (수동 오버라이드)
 *  - APK + localStorage 'sertz.server.url' → 그 주소 (멀티플레이 서버)
 *  - APK + 미지정 → null (오프라인 모드 — 연결 시도 없음)
 *  - EXE(Electron) + 저장 주소 → 그 주소 (원격 멀티플레이 서버)
 *  - EXE(Electron) + 미지정 → undefined (same-origin: 내장 로컬 서버 — 싱글+로컬 멀티)
 */
/**
 * v1.4.6 — export: /support 지원센터(문의·계정삭제)가 APK 정적 export에서도
 *  원격 서버 API를 호출할 수 있도록 공개. 웹=same-origin(undefined→""), APK=저장된 https 서버.
 */
export function resolveServerUrl(): string | null | undefined {
  if (typeof window === "undefined") return undefined;
  const electron = isElectron();
  if (Capacitor.isNativePlatform() || electron) {
    /* v1.4.3 (#데이터보안) — 평문 http/wss 미허용: 저장 주소를 https/wss로 강제 승격
     *  (Play Console "수집 데이터 전체 암호화 전송: 예" 근거 — 모든 API/소켓이 TLS 경유)
     * v1.4.21 — 저장 주소가 미러(vercel.app)면 게임 서버 본체(GAME_SERVER)로 해석 */
    return resolveEntryTarget(storedServerUrl(), electron ? undefined : null);
  }
  /* v1.4.20 — 웹 분기 (멀티서버 분리):
   *  Vercel 등 정적 배포에서는 same-origin에 소켓 서버가 없다 → 게임 서버(sertz11)로
   *  직접 접속해 웹 버전에서도 멀티/채팅/파티가 동작한다. 재접속 스톰(화면끊김 원인)
   *  자체가 사라진다 — 서버가 살아있으니 첫 시도에서 연결됨. */
  const stored = storedServerUrl();
  if (stored) {
    /* v1.4.21 — 저장 오버라이드가 미러 주소면 본체로 우회 */
    const t = resolveEntryTarget(stored, GAME_SERVER);
    return typeof t === "string" ? t : GAME_SERVER;
  }
  if (isGameServerHost(window.location.hostname)) return undefined; // same-origin
  return GAME_SERVER; // 정적 배포 → 원격 게임 서버
}

export function netConnect(): Socket | null {
  if (typeof window === "undefined") return null;
  try {
    if (!socket) {
      const url = resolveServerUrl();
      if (url === null) return null; // APK 오프라인 모드
      /* v3.3.0 (지시 #7 — "멀티 안되는 버그" 근본 수정):
       *  기존 transports: ["websocket", "polling"] (웹소켓 우선)에서는 배포 환경의
       *  FC/게이트웨이가 "가짜 101 업그레이드"(어떤 경로든 101 응답 후 프레임 전달 없음)를
       *  반환해도 engine.io-client가 tryAllTransports 기본값(false)이라 폴링으로
       *  절대 폴백하지 않고 무한 재시도 → 접속이 영원히 안 걸렸다.
       *  → 폴링 우선으로 전환(폴링은 라이브 실측 2인 E2E 정상 — 플레이어 동기/채팅/파티/친구).
       *    연결 안정화 후 엔진이 websocket으로 업그레이드를 시도하되 실패하면 폴링을 유지한다. */
      socket = io(url, {
        path: "/socket.io",
        transports: ["polling", "websocket"],
        tryAllTransports: true,
        /* v1.4.19 (#화면깨짐) — 서버가 아예 없는 환경(정적 배포: Vercel export 등)에서
         *  socket.io 기본값은 무한 재연결(reconnectionAttempts: Infinity)이라
         *  polling 404 + websocket 308 시도가 몇 초마다 영원히 반복됐다.
         *  모바일 브라우저에서 이 재시도 스톰이 프레임을 잠식해 "움직일 때마다
         *  화면이 끊기는" 체감의 원인. 4회 실패 후 재귀를 완전히 멈춘다.
         *  서버가 살아있는 배포( space-z/로컬/APK 지정 서버)에서는 첫 시도에서
         *  연결되므로 영향 없음 — 일시적 단절 후 복구도 connect 성공 시 카운터 리셋. */
        reconnectionAttempts: 4,
        reconnectionDelay: 800,
        reconnectionDelayMax: 4000,
        timeout: 10000,
      });
      socket.on("reconnect_failed", () => {
        /* 서버 없는 배포 환경 — 조용히 오프라인 모드 확정 (추가 시도 없음).
         * netStatus().connected = false → 전송 계열 emit는 전부 가드에서 노옵 처리됨 */
        console.info("[SERTZ] 멀티 서버 미발견 — 오프라인 모드로 전환 (재시도 중단)");
      });
      // E2E/디버그 훅 — 소켓 상태 실측용
      (window as unknown as { __SERTZ_NET__?: unknown }).__SERTZ_NET__ = socket;
    }
    return socket;
  } catch {
    return null;
  }
}

export function netId(): string | null {
  return socket?.id ?? null;
}

export function netJoined(): boolean {
  return !!socket?.connected;
}

/** UI 표시용 연결 상태 (v2.1) — v3.0.8: native에 EXE(Electron) 포함 */
export function netStatus(): { connected: boolean; hasServer: boolean; native: boolean } {
  const native = (typeof window !== "undefined" && Capacitor.isNativePlatform()) || isElectron();
  let hasServer = true; // 웹/EXE = same-origin 서버 항상 존재
  if (Capacitor.isNativePlatform()) hasServer = resolveServerUrl() != null;
  return { connected: !!socket?.connected, hasServer, native };
}

export type JoinInfo = {
  name: string;
  lv: number;
  cls: string | null;
  x: number;
  y: number;
  stage?: string;
  code?: string;
  /** v1.0.16 — 서버 인증 롤이 admin인 계정만 true (GM 이름표/오라 동기화 — 순수 코스메틱) */
  gm?: boolean;
  /** v1.4.8 (#4 보안) — GM 플래그 서버 검증용 세션 토큰 (netJoin에서 자동 첨부) */
  token?: string;
};

/* v2.0 수정 (지시 #14 — 채팅 안됨 원인):
 *  netJoin이 소켓 connect 이전에 호출되면 조용히 실패하고,
 *  서버는 join하지 않은 소켓의 채팅을 폐기 → 채팅이 영원히 안 되는 버그.
 *  → join을 대기열에 넣고 connect 이벤트에 자동 발송한다.
 * v2.3 수정 (지시 #7 — 채팅 안됨 2차 원인):
 *  socket.io 자동 재접속 시 서버 players 맵에서는 이미 삭제된 상태인데
 *  클라가 join을 다시 보내지 않아 채팅/멀티가 조용히 죽는 문제.
 *  → 마지막 join 정보(lastJoin)를 보관하고 매 connect마다 재발송한다. */
let pendingJoin: JoinInfo | null = null;
let lastJoin: JoinInfo | null = null;
let joinHooked = false;

function hookConnectFlush() {
  const s = socket;
  if (!s || joinHooked) return;
  joinHooked = true;
  s.on("connect", () => {
    const info = pendingJoin ?? lastJoin;
    pendingJoin = null;
    if (info) s.emit("join", info); // 재접속 시에도 자동 재참여 — 채팅/멀티 자가 복구
  });
}

export function netJoin(info: JoinInfo) {
  const s = netConnect();
  if (!s) return;
  hookConnectFlush();
  /* v1.4.8 (#4 보안) — join에 세션 토큰을 자동 첨부해 서버가 gm 플래그를 검증하게 한다 */
  let token = "";
  try { token = window.localStorage.getItem("sertz.auth.token") || ""; } catch { /* 무시 */ }
  const payload = token ? { ...info, token } : info;
  lastJoin = payload; // v2.3 — 재접속 재참여용 최신 상태 보관
  pendingJoin = payload; // 최신 상태로 갱신 (리스폰/스테이지 이동 재합류 대응)
  if (s.connected) {
    s.emit("join", payload);
    pendingJoin = null;
  }
}

/** 채팅 가능 여부 — 미연결이면 UI에서 안내 메시지를 보여준다 (v2.3, 지시 #7) */
export function netChatReady(): boolean {
  return !!socket?.connected;
}

export type NetState = {
  x: number;
  y: number;
  flip: boolean;
  moving: boolean;
  lv: number;
  cls: string | null;
  stage?: string;
};

export function netState(st: NetState) {
  if (socket?.connected) socket.emit("state", st);
}

export function netSendChat(text: string) {
  if (socket?.connected) socket.emit("chat", text);
}

/* ================= v4.1.0 — 공격/스킬 동작 동기화 (파티원 공격 보임) =================
 *  가벼운 코스메틱 이벤트만 전송 (좌표/종류/방향) — 데미지 판정은 각자 로컬 */

export type NetAction = {
  id?: string; // 서버가 채움 (보낸 사람 sock id)
  kind: "atk" | "s1" | "s2" | "s3" | "s4" | "s5";
  x: number;
  y: number;
  flip: boolean;
  cls: string | null;
};

export function netAction(a: {
  kind: NetAction["kind"];
  x: number;
  y: number;
  flip: boolean;
  cls: string | null;
}) {
  if (socket?.connected) socket.emit("act", a);
}

export function netOnAction(cb: (a: NetAction) => void): () => void {
  const s = netConnect();
  if (!s) return () => {};
  const wrapped = (a: NetAction) => cb(a);
  s.on("act", wrapped);
  return () => s.off("act", wrapped);
}

/* ================= 파티 (v2.0 — 지시 #5 파티 & 보스 토벌) ================= */

export type NetParty = {
  id: string;
  leader: string;
  members: { id: string; name: string; lv: number; cls: string | null }[];
  max: number;
};

export function netPartyCreate() {
  if (socket?.connected) socket.emit("party:create");
}

export function netPartyJoin(partyId: string) {
  if (socket?.connected) socket.emit("party:join", partyId);
}

export function netPartyLeave() {
  if (socket?.connected) socket.emit("party:leave");
}

export function netPartyChat(text: string) {
  if (socket?.connected) socket.emit("party:chat", text);
}

export function netOnParty(cb: (p: NetParty | null) => void): () => void {
  const s = netConnect();
  if (!s) return () => {};
  const wrapped = (p: NetParty | null) => {
    lastParty = p; // v4.0.0 — 스냅샷 보관
    cb(p);
  };
  s.on("party", wrapped);
  return () => s.off("party", wrapped);
}

/** v4.0.0 — 마지막 파티 스냅샷 조회 (미파티 null) */
export function netLastParty(): NetParty | null {
  return lastParty;
}

/* ================= v4.0.0 — 랭킹 (무릉도장/게이트/옷장 던전 기록전) ================= */

export type RankEntry = { name: string; score: number; lv: number };
export type RankMode = "dojang" | "gate" | "closet" | "tower"; // v1.0.8 — 심연의 탑 랭킹 추가

/** 기록 제출 — 서버 미연결 시 조용히 무시 (로컬 최고기록은 별도 localStorage 유지) */
export function netRankSubmit(mode: RankMode, score: number, name: string, lv: number) {
  if (!socket?.connected || score <= 0) return;
  socket.emit("rank:submit", { mode, score, name: name.slice(0, 8), lv });
}

/** 랭킹 조회 요청 — 응답은 "rank:top" 이벤트로 */
export function netRankTop(mode: RankMode) {
  if (socket?.connected) socket.emit("rank:top", mode);
}

export function netOnRank(cb: (mode: RankMode, list: RankEntry[]) => void): () => void {
  const s = netConnect();
  if (!s) return () => {};
  const wrapped = (m: string, list: RankEntry[]) => cb(m as RankMode, list);
  s.on("rank:top", wrapped);
  return () => s.off("rank:top", wrapped);
}

export function netAnnounceJob(cls: string) {
  if (socket?.connected) socket.emit("job", cls);
}

/** 보스 토벌 상황 방송 (파티원 전체 — 지시 #5) */
export function netAnnounceBoss(name: string, stage: string) {
  if (socket?.connected) socket.emit("boss:announce", { name, stage });
}

/** 씬에서 등록 — 반환된 off 함수로 씬 종료 시 정리 */
export function netOnPlayers(cb: (list: NetPlayer[]) => void): () => void {
  const s = netConnect();
  if (!s) return () => {};
  s.on("players", cb);
  return () => s.off("players", cb);
}

export function netOnChat(cb: (m: NetChatMsg) => void): () => void {
  const s = netConnect();
  if (!s) return () => {};
  s.on("chat", cb);
  return () => s.off("chat", cb);
}

/* ================= 친구 (v2.1 — 친구코드·고유번호) ================= */

export type NetFriendOnline = { code: string; name: string; lv: number; cls: string | null; stage: string };

/** 서버 2초 하트비트로 전파되는 전체 접속자 요약 — 클라에서 내 친구 코드와 대조 */
export function netOnFriends(cb: (list: NetFriendOnline[]) => void): () => void {
  const s = netConnect();
  if (!s) return () => {};
  s.on("friends", cb);
  return () => s.off("friends", cb);
}
