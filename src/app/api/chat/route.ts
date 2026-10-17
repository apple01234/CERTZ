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
  mutateRelay, loadRelay, emptyChat, RelayAccessError,
  CHAT_PATH, CHAT_KEEP, PARTY_CHAT_KEEP, PARTY_CHAT_TTL_MS,
  type RelayChatFile, type RelayChatMsg,
} from "@/lib/relaydb";
/* v1.4.27-w1 픽스 — audit/json/options/rateLimit은 sapi 소속 (relaydb 오 import로 Vercel 빌드 실패했던 원인) */
import { ADMIN_USERS, audit, json, options, rateLimit } from "@/lib/sapi";

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
    /* v1.0.16 — 저장소 접근 실패는 503으로 알린다. 종전엔 200 + 빈 목록이라
     *  GITHUB_TOKEN 무효 장애가 "아직 채팅이 없다"와 구분되지 않았다.
     *  클라이언트는 !ok면 json을 읽지 않고 건너뛰므로(relay.ts) 폴링 동작은 동일하고,
     *  외부 점검(업타임/curl)에서만 실패가 드러난다. */
    if (e instanceof RelayAccessError) {
      return json(req, 503, { list: [], error: "채팅 저장소에 접근할 수 없어요" });
    }
    return json(req, 200, { list: [] }); // 그 외 일시 오류는 빈 목록으로 폴링 유지
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(req, "chat", 8, 30 * 1000)) {
      return json(req, 429, { error: "채팅을 너무 빠르게 보내고 있어요" });
    }
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    /* v1.0.16 보안 — 관리자 사칭 차단. 종전엔 name이 완전한 클라이언트 입력이라
     *  누구나 관리자 닉네임으로 채팅할 수 있었다(register가 name 예약어를 막아도
     *  이 라우트는 그 검증을 거치지 않는다). 예약 이름은 거부한다. */
    const rawName = clean(b.name, 8);
    if (rawName && ADMIN_USERS.includes(rawName.toLowerCase())) {
      return json(req, 403, { error: "사용할 수 없는 이름이에요" });
    }
    const name = rawName;
    const text = clean(b.text, 80);
    const cid = clean(b.cid, 64);
    const cls = clean(b.cls, 16);
    const lv = Math.max(1, Math.min(9999, Number(b.lv) || 1));
    const party = clean(b.party, 8).toUpperCase();
    if (!name || !text || !/^[A-Za-z0-9_-]{6,64}$/.test(cid)) {
      return json(req, 400, { error: "잘못된 요청이에요" });
    }
    const msg: RelayChatMsg = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name, text, cls, lv, t: Date.now() };
    /* v1.4.27-w2 (#릴레이null) — mutator는 전달받은 객체를 '제자리 변경'해야 한다.
     *  기존 `const d = db && ... ? db : emptyChat()` 패턴은 파일 없을 때 새 객체에만
     *  메시지를 붙여 원본 null이 PUT됐다 (파일이 리터럴 null로 덮이는 버그). */
    const r = await mutateRelay<RelayChatFile>(CHAT_PATH, (raw) => {
      const d = (raw && typeof raw === "object" ? raw : {}) as RelayChatFile;
      if (!Array.isArray(d.global)) d.global = [];
      if (!d.party || typeof d.party !== "object" || Array.isArray(d.party)) d.party = {};
      if (party) {
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
