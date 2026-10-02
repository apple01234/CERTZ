/**
 * v1.4.26 — 서버리스 릴레이 클라이언트 (채팅·파티 — ②안 소켓 대체)
 *
 *  소켓 서버가 없는 환경(Vercel ②안·APK 기본)에서 채팅/파티를 HTTP 폴링으로 구동한다.
 *  - 채팅: GET /api/chat 5~6초 폴링 (전송 직후 즉시 1회) · POST로 발송
 *  - 파티: GET /api/party?code= 5초 폴링 + 90초 하트비트(beat) · create/join/leave POST
 *  - 신원: cid(localStorage 영속 UUID) + 플레이어 이름/레벨/직업 (WorldScene이 주입)
 *  - net.ts가 소켓 미연결 시 이 모듈로 위임한다 (UI·EventBus 흐름 불변)
 */
import { Capacitor } from "@capacitor/core";
import { resolveApiBase } from "./server";

export type RelayChatMsg = { id: string; name: string; text: string; sys?: boolean; t: number };
export type RelayPartySnapshot = { id: string; leader: string; max: number; members: { id: string; name: string; lv: number; cls: string | null; online: boolean }[] };

let cid = "";
function ensureCid(): string {
  if (cid) return cid;
  try {
    cid = window.localStorage.getItem("sertz.relay.cid") || "";
    if (!cid || !/^[A-Za-z0-9_-]{6,64}$/.test(cid)) {
      cid = `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem("sertz.relay.cid", cid);
    }
  } catch {
    cid = `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }
  return cid;
}

let me: { name: string; lv: number; cls: string | null } = { name: "이름없음", lv: 1, cls: null };
export function relaySetIdentity(v: { name: string; lv: number; cls: string | null }) {
  me = { name: String(v.name || "이름없음").slice(0, 8), lv: Math.max(1, Number(v.lv) || 1), cls: v.cls };
}

/** 릴레이 사용 가능 — 네이티브는 기본 API 본체(DEFAULT_API_BASE)가 상시 존재 (v1.4.27) */
export function relayChatReady(): boolean {
  return true; // 웹(동일 오리진 serverless)·EXE(내장 서버)·APK(resolveApiBase → 기본 Vercel API)
}

function base(): string {
  return resolveApiBase() || "";
}

/* ---------------- 채팅 폴링 ---------------- */
let chatHooked = false;
let chatTimer: ReturnType<typeof setTimeout> | null = null;
let chatBusy = false;
let lastTs = 0;
const seenIds = new Set<string>();
let onChat: ((m: RelayChatMsg) => void) | null = null;
let chatParty = ""; // 파티 채널 (net.ts가 파티 스냅샷 반영 시 갱신)

function chatPartyCode(): string {
  return chatParty;
}
export function relaySetPartyCode(code: string) {
  const next = (code || "").toUpperCase();
  if (next !== chatParty) {
    chatParty = next;
    lastTs = 0; // 채널 전환 — 히스토리 재수신
  }
}

function handleList(list: RelayChatMsg[], party: boolean) {
  for (const m of list) {
    if (seenIds.has(m.id)) continue;
    seenIds.add(m.id);
    if (seenIds.size > 400) {
      // 상한 관리 — Set 전체 재구축 (최근 200개 유지)
      const keep = list.slice(-200).map((x) => x.id);
      for (const k of Array.from(seenIds)) if (!keep.includes(k)) seenIds.delete(k);
    }
    if (m.t > lastTs) lastTs = m.t;
    onChat?.({ ...m, party: party || undefined } as RelayChatMsg & { party?: boolean });
  }
}

async function chatTick() {
  if (chatBusy || document.hidden) return;
  chatBusy = true;
  try {
    const bp = base();
    const g = await fetch(`${bp}/api/chat`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (g?.list) handleList(g.list as RelayChatMsg[], false);
    const pc = chatPartyCode();
    if (pc) {
      const p = await fetch(`${bp}/api/chat?p=${encodeURIComponent(pc)}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (p?.list) handleList(p.list as RelayChatMsg[], true);
    }
  } catch { /* 오프라인 — 다음 틱 재시도 */ }
  finally {
    chatBusy = false;
    if (chatHooked) chatTimer = setTimeout(chatTick, 6000);
  }
}

/** 채팅 폴링 시작 (netOnChat 등록 시 1회) */
export function relayEnsureChatPoll(cb: (m: RelayChatMsg) => void) {
  onChat = cb;
  if (chatHooked) return;
  chatHooked = true;
  chatTimer = setTimeout(chatTick, 400);
}

export function relayStopChatPoll() {
  chatHooked = false;
  if (chatTimer) { clearTimeout(chatTimer); chatTimer = null; }
}

/** 전송 — 성공 여부 반환 (net.netSendChat의 릴레이 폴백) */
export async function relaySendChat(text: string, party = false): Promise<boolean> {
  try {
    const r = await fetch(`${base()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: me.name, text, cid: ensureCid(), cls: me.cls || "", lv: me.lv, party: party ? chatPartyCode() : "" }),
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) {
      /* 전송 직후 자기 메시지 즉시 수신 (6초 대기 방지) */
      setTimeout(() => { if (chatHooked && !chatBusy) void chatTick(); }, 900);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/* ---------------- 파티 릴레이 ---------------- */
let partyCode = "";
let partyTimer: ReturnType<typeof setTimeout> | null = null;
let partyHooked = false;
let beatTimer: ReturnType<typeof setTimeout> | null = null;
let onParty: ((p: RelayPartySnapshot | null) => void) | null = null;

export function relayPartyJoined(): boolean {
  return !!partyCode;
}
export function relayPartyCode(): string {
  return partyCode;
}

async function partyTick() {
  if (!partyCode || document.hidden) return;
  try {
    const r = await fetch(`${base()}/api/party?code=${encodeURIComponent(partyCode)}`, { cache: "no-store" })
      .then((x) => (x.ok ? x.json() : null)).catch(() => null);
    if (r && "party" in r) {
      const p = r.party as RelayPartySnapshot | null;
      if (p) onParty?.(p);
      else {
        /* 파티 소멸(전원 이탈/청소) — 해제 통보 */
        partyCode = "";
        relaySetPartyCode("");
        onParty?.(null);
        return;
      }
    }
  } catch { /* 무시 */ }
  finally {
    if (partyHooked && partyCode) partyTimer = setTimeout(partyTick, 5000);
  }
}

async function beatTick() {
  if (!partyCode || document.hidden) return;
  try {
    await fetch(`${base()}/api/party`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "beat", cid: ensureCid(), name: me.name, lv: me.lv, cls: me.cls || "", code: partyCode }),
      signal: AbortSignal.timeout(8000),
    });
  } catch { /* 무시 */ }
  finally {
    if (partyHooked && partyCode) beatTimer = setTimeout(beatTick, 90 * 1000);
  }
}

function startPartyLoops() {
  if (partyHooked) return;
  partyHooked = true;
  partyTimer = setTimeout(partyTick, 600);
  beatTimer = setTimeout(beatTick, 30 * 1000);
}

function stopPartyLoops() {
  partyHooked = false;
  if (partyTimer) { clearTimeout(partyTimer); partyTimer = null; }
  if (beatTimer) { clearTimeout(beatTimer); beatTimer = null; }
}

export function relayEnsurePartyPoll(cb: (p: RelayPartySnapshot | null) => void) {
  onParty = cb;
}

export async function relayPartyCreate(): Promise<string | null> {
  try {
    const r = await fetch(`${base()}/api/party`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", cid: ensureCid(), name: me.name, lv: me.lv, cls: me.cls || "" }),
      signal: AbortSignal.timeout(10000),
    }).then((x) => (x.ok ? x.json() : null)).catch(() => null);
    const code = r?.code ? String(r.code) : null;
    if (code) { partyCode = code; relaySetPartyCode(code); startPartyLoops(); }
    return code;
  } catch {
    return null;
  }
}

export async function relayPartyJoin(code: string): Promise<boolean> {
  const c = (code || "").trim().toUpperCase();
  try {
    const r = await fetch(`${base()}/api/party`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join", cid: ensureCid(), name: me.name, lv: me.lv, cls: me.cls || "", code: c }),
      signal: AbortSignal.timeout(10000),
    }).then((x) => (x.ok ? x.json() : null)).catch(() => null);
    if (r?.ok) {
      partyCode = c;
      relaySetPartyCode(c);
      startPartyLoops();
      /* 즉시 스냅샷 1회 */
      void partyTick();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function relayPartyLeave(): Promise<void> {
  const c = partyCode;
  partyCode = "";
  relaySetPartyCode("");
  stopPartyLoops();
  onParty?.(null);
  if (!c) return;
  try {
    await fetch(`${base()}/api/party`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "leave", cid: ensureCid(), code: c }),
      signal: AbortSignal.timeout(8000),
    });
  } catch { /* 무시 */ }
}
