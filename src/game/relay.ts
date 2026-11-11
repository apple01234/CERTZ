/**
 * v1.4.26 — 서버리스 릴레이 클라이언트 (채팅·파티 — ②안 소켓 대체)
 *
 *  소켓 서버가 없는 환경(Vercel ②안·APK 기본)에서 채팅/파티를 HTTP 폴링으로 구동한다.
 *  - 채팅: GET /api/chat 5~6초 폴링 (전송 직후 즉시 1회) · POST로 발송
 *  - 파티: GET /api/party?code= 5초 폴링 + 90초 하트비트(beat) · create/join/leave POST
 *  - 신원: cid(localStorage 영속 UUID) + 플레이어 이름/레벨/직업 (WorldScene이 주입)
 *  - net.ts가 소켓 미연결 시 이 모듈로 위임한다 (UI·EventBus 흐름 불변)
 */
import { resolveApiBase } from "./server";
import { relayClientId as ensureCid } from "./playerIdentity";

export type RelayChatMsg = { id: string; name: string; text: string; sys?: boolean; t: number };
/* v1.0.16 보안(S8) — leader는 '이름'이다(과거엔 cid를 담아 보냈으나 클라가 이름으로 비교해
 *  왕관이 뜨지 않았고, cid가 노출됐다). members[].id도 표시용 슬롯이며 실제 cid가 아니다. */
export type RelayPartySnapshot = { id: string; leader: string; max: number; members: { id: string; name: string; lv: number; cls: string | null; online: boolean; leader?: boolean }[] };

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
    /* vc185 (지시 #5 — Vercel 서버에 무리 주지 마) — no-store 제거.
     *  서버는 이미 Cache-Control: public, s-maxage=5, stale-while-revalidate=20 으로
     *  CDN 흡수를 설계했는데, 클라이언트가 no-store 로 캐시를 무력화해 모든 폴링이
     *  Vercel 함수를 직접 때리고 있었다. 유저 수 × 6초마다 = 함수 호출 폭주.
     *  기본 캐시 정책을 쓰면 5초 TTL 동안은 CDN 이 응답해 서버 부하가 유저 수와 무관해진다. */
    const g = await fetch(`${bp}/api/chat`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (g?.list) handleList(g.list as RelayChatMsg[], false);
    const pc = chatPartyCode();
    if (pc) {
      const p = await fetch(`${bp}/api/chat?p=${encodeURIComponent(pc)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (p?.list) handleList(p.list as RelayChatMsg[], true);
    }
  } catch { /* 오프라인 — 다음 틱 재시도 */ }
  finally {
    chatBusy = false;
    if (chatHooked) chatTimer = setTimeout(chatTick, 10000); // vc185 (#5) — 6초→10초: 호출 40% 감소, 체감 지연 없음
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
let partySeat = "";
let partyTimer: ReturnType<typeof setTimeout> | null = null;
let beatTimer: ReturnType<typeof setTimeout> | null = null;
let partyHooked = false;
let onParty: ((p: RelayPartySnapshot | null) => void) | null = null;
let onPartyError: ((message: string) => void) | null = null;
let lastParty: RelayPartySnapshot | null = null;
const PARTY_SESSION = "sertz.relay.party";

export function relayPartyJoined(): boolean { return !!partyCode; }
export function relayPartyCode(): string { return partyCode; }

function savePartySession() {
  try {
    if (partyCode && partySeat) window.sessionStorage.setItem(PARTY_SESSION, JSON.stringify({ code: partyCode, seat: partySeat }));
    else window.sessionStorage.removeItem(PARTY_SESSION);
  } catch { /* memory session */ }
}

function publishParty(p: RelayPartySnapshot | null) {
  lastParty = p;
  onParty?.(p);
}

function clearParty() {
  partyCode = "";
  partySeat = "";
  savePartySession();
  relaySetPartyCode("");
  stopPartyLoops();
  publishParty(null);
}

async function partyPost(action: string, code = partyCode) {
  const response = await fetch(`${base()}/api/party`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, code, cid: ensureCid(), seat: partySeat, ...me }),
    signal: AbortSignal.timeout(10000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || `파티 서버 요청에 실패했어요 (${response.status})`);
    Object.assign(error, { status: response.status });
    throw error;
  }
  return body;
}

function reportPartyError(error: unknown) {
  onPartyError?.(error instanceof Error ? error.message : "파티 서버에 연결할 수 없어요 — 잠시 후 다시 시도");
}

async function partyTick() {
  const code = partyCode;
  try {
    if (!code || document.hidden) return;
    const response = await fetch(`${base()}/api/party?code=${encodeURIComponent(code)}`, { signal: AbortSignal.timeout(8000) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || `파티 상태를 가져올 수 없어요 (${response.status})`);
    if (partyCode !== code) return; // A completed request must not restore a party we left.
    if (body.party) publishParty(body.party);
    else clearParty();
  } catch (error) { reportPartyError(error); }
  finally {
    if (partyHooked && partyCode) partyTimer = setTimeout(partyTick, 8000);
  }
}

async function beatTick() {
  const code = partyCode;
  try {
    if (!code || document.hidden) return;
    const body = await partyPost("beat", code);
    if (partyCode === code && body.party) publishParty(body.party);
  } catch (error) {
    if (partyCode !== code) return;
    const status = (error as { status?: number }).status;
    if (status === 403 || status === 404) clearParty();
    reportPartyError(error); // Never replace a rejected seat silently with a new one.
  } finally {
    if (partyHooked && partyCode) beatTimer = setTimeout(beatTick, 90 * 1000);
  }
}

function startPartyLoops() {
  stopPartyLoops();
  partyHooked = true;
  partyTimer = setTimeout(partyTick, 600);
  beatTimer = setTimeout(beatTick, 30 * 1000);
}

function stopPartyLoops() {
  partyHooked = false;
  if (partyTimer) { clearTimeout(partyTimer); partyTimer = null; }
  if (beatTimer) { clearTimeout(beatTimer); beatTimer = null; }
}

export function relayEnsurePartyPoll(cb: (p: RelayPartySnapshot | null) => void, onError?: (message: string) => void) {
  onParty = cb;
  onPartyError = onError || null;
  if (!partyCode) {
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(PARTY_SESSION) || "null");
      if (/^[A-Z0-9]{4,8}$/.test(saved?.code) && /^[A-Za-z0-9_-]{32}$/.test(saved?.seat)) {
        partyCode = saved.code;
        partySeat = saved.seat;
        relaySetPartyCode(partyCode);
        startPartyLoops();
        if (beatTimer) clearTimeout(beatTimer);
        void beatTick();
      }
    } catch { /* no saved seat */ }
  }
  cb(lastParty);
  return () => { if (onParty === cb) { onParty = null; onPartyError = null; } };
}

async function enterParty(action: "create" | "join", code = "") {
  const body = await partyPost(action, code);
  if (!body.code || !body.seat) throw new Error("파티 서버 응답이 올바르지 않아요 — 다시 시도해 주세요");
  partyCode = String(body.code);
  partySeat = String(body.seat);
  savePartySession();
  relaySetPartyCode(partyCode);
  if (body.party) publishParty(body.party);
  else await partyTick(); // Older compatible servers return only code/seat.
  startPartyLoops();
  return partyCode;
}

export async function relayPartyCreate(): Promise<string> {
  return enterParty("create");
}

export async function relayPartyJoin(code: string): Promise<boolean> {
  await enterParty("join", code.trim().toUpperCase());
  return true;
}

export async function relayPartyLeave(): Promise<void> {
  if (!partyCode) { clearParty(); return; }
  await partyPost("leave");
  clearParty(); // Keep the seat and UI if the server could not confirm departure.
}
