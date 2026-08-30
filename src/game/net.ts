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
 */
function resolveServerUrl(): string | null | undefined {
  if (typeof window === "undefined") return undefined;
  if (Capacitor.isNativePlatform()) {
    try {
      const raw = window.localStorage.getItem("sertz.server.url");
      const u = raw?.trim();
      if (u && /^(https?|wss?):\/\//i.test(u)) return u.replace(/\/$/, "");
    } catch {
      /* localStorage 접근 불가 — 오프라인 처리 */
    }
    return null;
  }
  return undefined;
}

export function netConnect(): Socket | null {
  if (typeof window === "undefined") return null;
  try {
    if (!socket) {
      const url = resolveServerUrl();
      if (url === null) return null; // APK 오프라인 모드
      socket = io(url, { path: "/socket.io", transports: ["websocket", "polling"] });
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

export type JoinInfo = { name: string; lv: number; cls: string | null; x: number; y: number; stage?: string };

/* v2.0 수정 (지시 #14 — 채팅 안됨 원인):
 *  netJoin이 소켓 connect 이전에 호출되면 조용히 실패하고,
 *  서버는 join하지 않은 소켓의 채팅을 폐기 → 채팅이 영원히 안 되는 버그.
 *  → join을 대기열에 넣고 connect 이벤트에 자동 발송한다. */
let pendingJoin: JoinInfo | null = null;
let joinHooked = false;

function hookConnectFlush() {
  const s = socket;
  if (!s || joinHooked) return;
  joinHooked = true;
  s.on("connect", () => {
    if (pendingJoin) {
      s.emit("join", pendingJoin);
    }
  });
}

export function netJoin(info: JoinInfo) {
  const s = netConnect();
  if (!s) return;
  hookConnectFlush();
  pendingJoin = info; // 최신 상태로 갱신 (리스폰/스테이지 이동 재합류 대응)
  if (s.connected) {
    s.emit("join", info);
  }
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
