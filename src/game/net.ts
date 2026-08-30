/**
 * 멀티플레이 네트워크 레이어 (v1.7) — socket.io 싱글턴 래퍼
 *  - 같은 서버(미리보기/로컬 dev)에 접속한 모든 플레이어 실시간 동기화
 *  - 오프라인/APK 단독 실행 시 조용히 비활성 (게임플레이 무영향)
 */
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

export function netConnect(): Socket | null {
  if (typeof window === "undefined") return null;
  try {
    if (!socket) {
      socket = io({ path: "/socket.io", transports: ["websocket", "polling"] });
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

export type JoinInfo = { name: string; lv: number; cls: string | null; x: number; y: number };

export function netJoin(info: JoinInfo) {
  const s = netConnect();
  if (!s || !s.connected) return;
  s.emit("join", info);
}

export type NetState = {
  x: number;
  y: number;
  flip: boolean;
  moving: boolean;
  lv: number;
  cls: string | null;
};

export function netState(st: NetState) {
  if (socket?.connected) socket.emit("state", st);
}

export function netSendChat(text: string) {
  if (socket?.connected) socket.emit("chat", text);
}

export function netAnnounceJob(cls: string) {
  if (socket?.connected) socket.emit("job", cls);
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
