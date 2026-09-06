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
};

export type NetChatMsg = {
  id: string;
  name: string;
  text: string;
  sys?: boolean;
  t: number;
};

let socket: Socket | null = null;

/**
 * 접속 대상 서버 URL 결정:
 *  - 웹 → undefined (same-origin: server.js socket.io)
 *  - APK + localStorage 'sertz.server.url' → 그 주소 (멀티플레이 서버)
 *  - APK + 미지정 → null (오프라인 모드 — 연결 시도 없음)
 *  - EXE(Electron) + 저장 주소 → 그 주소 (원격 멀티플레이 서버)
 *  - EXE(Electron) + 미지정 → undefined (same-origin: 내장 로컬 서버 — 싱글+로컬 멀티)
 */
function resolveServerUrl(): string | null | undefined {
  if (typeof window === "undefined") return undefined;
  const electron = isElectron();
  if (Capacitor.isNativePlatform() || electron) {
    try {
      const raw = window.localStorage.getItem("sertz.server.url");
      const u = raw?.trim();
      if (u && /^(https?|wss?):\/\//i.test(u)) return u.replace(/\/$/, "");
    } catch {
      /* localStorage 접근 불가 — 폴백 처리 */
    }
    return electron ? undefined : null;
  }
  return undefined;
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

export type JoinInfo = { name: string; lv: number; cls: string | null; x: number; y: number; stage?: string; code?: string };

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
  lastJoin = info; // v2.3 — 재접속 재참여용 최신 상태 보관
  pendingJoin = info; // 최신 상태로 갱신 (리스폰/스테이지 이동 재합류 대응)
  if (s.connected) {
    s.emit("join", info);
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
  s.on("party", cb);
  return () => s.off("party", cb);
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
