/**
 * v1.4.22 — POST /api/support (serverless 이행 — 계승: v1.4.3 #유저지원페이지)
 *  /support 페이지 문의·데이터삭제 요청 수신. 인증 불요(비로그인 문의 허용) — 레이트리밋만.
 *  저장처: CERTZ-DB :: db-backup/support-inbox.json (최근 300건 유지)
 */
import { NextRequest } from "next/server";
import { appendSupport } from "@/lib/ghdb";
import { audit, clientIp, json, options, rateLimit } from "@/lib/sapi";

export function OPTIONS(req: NextRequest) { return options(req); }

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(req, "support", 5, 10 * 60 * 1000)) {
      return json(req, 429, { error: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요." });
    }
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const rec = {
      ts: Date.now(),
      ip: clientIp(req),
      category: String(b.category || "일반 문의").slice(0, 24),
      name: String(b.name || "").trim().slice(0, 24),
      contact: String(b.contact || "").trim().slice(0, 80),
      uid: String(b.uid || "").trim().slice(0, 24),
      message: String(b.message || "").trim().slice(0, 2000),
    };
    if (!rec.message) return json(req, 400, { error: "내용을 입력해 주세요" });
    const ok = await appendSupport(rec);
    if (!ok) return json(req, 500, { error: "접수에 실패했어요 — 잠시 후 다시 시도" });
    audit("support", { ip: rec.ip, category: rec.category });
    return json(req, 200, { ok: true });
  } catch (e) {
    console.error("[SERTZ-api] support 실패", e);
    return json(req, 500, { error: "서버 오류" });
  }
}
