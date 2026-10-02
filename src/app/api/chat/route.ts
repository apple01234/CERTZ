/**
 * v1.4.26 — GET/POST /api/chat (serverless 릴레이 채팅 — ②안 소켓 대체)
 *
 *  GET  : 전체 채팅 최근 목록(?p=CODE → 파티 채널). 공개 읽기 — 엣지 캐시(s-maxage)로
 *         폴링 폭주를 CDN에서 흡수한다(유저 수와 무관하게 GitHub 조회는 TTL당 1회).
 *  POST : { name, text, cid, cls?, lv?, party? } — 메시지 1건 추가 (rate limit 8/30s).
 *         소켓 서버가 없는 ②안에서 채팅의 본체. 파일: relay-chat.json (relaydb 참조).
 */
import { NextRequest } from "next/server";
import {
  mutateRelay, loadRelay, emptyChat,
  CHAT_PATH, CHAT_KEEP, PARTY_CHAT_KEEP, PARTY_CHAT_TTL_MS,
  type RelayChatFile, type RelayChatMsg,
} from "@/lib/relaydb";
/* v1.4.27-w1 픽스 — audit/json/options/rateLimit은 sapi 소속 (relaydb 오 import로 Vercel 빌드 실패했던 원인) */
import { audit, json, options, rateLimit } from "@/lib/sapi";

export function OPTIONS(req: NextRequest) { return options(req); }

/** 컨트롤 문자/제로폭 제거 + 길이 절단 (register 라우트와 동일 방침) */
function clean(s: unknown, max: number): string {
  return String(s ?? "")
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029]/g, "")
    .trim()
    .slice(0, max);
}

export async function GET(req: NextRequest) {
  try {
    const p = (req.nextUrl.searchParams.get("p") || "").trim().toUpperCase().slice(0, 8);
    const { data } = await loadRelay<RelayChatFile>(CHAT_PATH);
    const db = data || emptyChat();
    const list = p
      ? (db.party?.[p] || []).slice(-CHAT_KEEP)
      : (db.global || []).slice(-CHAT_KEEP);
    /* 공개 읽기 — 엣지 캐시 5초 (폴링이 GitHub에 도달하는 빈도의 상한 = 720회/시간) */
    return json(req, 200, { list }, { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=20" });
  } catch (e) {
    console.error("[SERTZ-api] chat GET 실패", e);
    return json(req, 200, { list: [] }); // 채팅은 실패해도 빈 목록으로 폴링 유지
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(req, "chat", 8, 30 * 1000)) {
      return json(req, 429, { error: "채팅을 너무 빠르게 보내고 있어요" });
    }
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const name = clean(b.name, 8);
    const text = clean(b.text, 80);
    const cid = clean(b.cid, 64);
    const cls = clean(b.cls, 16);
    const lv = Math.max(1, Math.min(9999, Number(b.lv) || 1));
    const party = clean(b.party, 8).toUpperCase();
    if (!name || !text || !/^[A-Za-z0-9_-]{6,64}$/.test(cid)) {
      return json(req, 400, { error: "잘못된 요청이에요" });
    }
    const msg: RelayChatMsg = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name, text, cls, lv, t: Date.now() };
    const r = await mutateRelay<RelayChatFile>(CHAT_PATH, (db) => {
      const d = db && Array.isArray(db.global) ? db : emptyChat();
      d.global ||= [];
      if (party) {
        d.party ||= {};
        const arr = d.party[party] || [];
        arr.push(msg);
        const cut = Date.now() - PARTY_CHAT_TTL_MS;
        d.party[party] = arr.filter((m) => m.t >= cut).slice(-PARTY_CHAT_KEEP);
      } else {
        d.global = [...d.global, msg].slice(-CHAT_KEEP);
      }
      return null; // 쓰기 진행
    });
    if (r.status === 200) audit("chat", { uid: cid.slice(0, 8), party: party || undefined });
    return json(req, r.status, r.status === 200 ? { ok: true, msg } : r.body);
  } catch (e) {
    console.error("[SERTZ-api] chat POST 실패", e);
    return json(req, 500, { error: "서버 오류 — 잠시 후 다시 시도해 주세요" });
  }
}
