/**
 * v1.0.13 피드백#8 — POST /api/auth/releasename (serverless 이행 — accounts/index.js 응답 형태 그대로)
 *  캐릭터 삭제/이름 변경 시 이전 이름 반납 — 내가 claim한 매핑만 삭제, 아니면 무변경 200 (node와 동일).
 */
import { NextRequest } from "next/server";
import { loadDb, mutateDb } from "@/lib/ghdb";
import { currentUser, json, options, rateLimit } from "@/lib/sapi";

export function OPTIONS(req: NextRequest) { return options(req); }

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(req, "releasename", 60, 5 * 60 * 1000)) {
      return json(req, 429, { error: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요." });
    }
    const { db } = await loadDb(false);
    const me = currentUser(db, req);
    if (!me) return json(req, 401, { error: "로그인이 필요해요" });
    const b = (await req.json().catch(() => ({}))) as { name?: unknown };
    const key = String(b.name || "").trim().toLowerCase();
    if (!key) return json(req, 200, { ok: true }); // 반납할 것 없음 — node와 동일하게 성공 처리
    const r = await mutateDb((fdb) => {
      const reg = fdb.charNames?.[key];
      if (reg && reg.by === me.id) {
        delete fdb.charNames![key];
        return { resp: { status: 200, body: { ok: true } } }; // 실제 삭제가 있을 때만 쓰기
      }
      /* 내 소유가 아니면 무변경 — 쓰기 없이 성공 (node: 조건 미충족 시 그냥 ok) */
      return { status: 200, body: { ok: true } };
    });
    return json(req, r.status, r.body);
  } catch (e) {
    console.error("[SERTZ-api] releasename 실패", e);
    return json(req, 500, { error: "서버 오류" });
  }
}
