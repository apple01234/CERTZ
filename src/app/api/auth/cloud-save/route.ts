/**
 * v1.4.22 — GET/POST /api/auth/cloud-save (serverless 이행 — 계승: accounts/index.js)
 *  POST: 로그인 유저당 10회/분 · 2MB 캡 · 깊이 8 제한 (스토리지 DoS·DB 비대화 차단 계승)
 *  GET:  저장된 세이브 반환(없으면 null)
 */
import { NextRequest } from "next/server";
import { loadDb, mutateDb } from "@/lib/ghdb";
import { currentUser, json, options, rateLimit } from "@/lib/sapi";

export function OPTIONS(req: NextRequest) { return options(req); }

function saveDepth(v: unknown, n = 0): number {
  if (n > 8) return 99;
  if (v && typeof v === "object") {
    let m = n + 1;
    for (const x of Object.values(v as Record<string, unknown>)) {
      m = Math.max(m, saveDepth(x, n + 1));
      if (m > 8) return m;
    }
    return m;
  }
  return n;
}

export async function GET(req: NextRequest) {
  try {
    const { db } = await loadDb(false);
    const user = currentUser(db, req);
    if (!user) return json(req, 401, { error: "로그인이 필요해요" });
    const s = db.saves[user.id];
    return json(req, 200, { data: s?.data ?? null, updatedAt: s?.updatedAt ?? null });
  } catch (e) {
    console.error("[SERTZ-api] cloud-save GET 실패", e);
    return json(req, 500, { error: "서버 오류" });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { db } = await loadDb(false);
    const user = currentUser(db, req);
    if (!user) return json(req, 401, { error: "로그인이 필요해요" });
    if (!rateLimit(req, `csave:${user.id}`, 10, 60 * 1000)) {
      return json(req, 429, { error: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요." });
    }
    const b = (await req.json().catch(() => ({}))) as { data?: unknown };
    const d = b.data;
    if (d === null || typeof d !== "object" || Array.isArray(d)) {
      return json(req, 400, { error: "세이브 형식이 올바르지 않아요" });
    }
    if (JSON.stringify(d).length > 2 * 1024 * 1024) {
      return json(req, 413, { error: "세이브가 너무 커요 — 저장할 수 없어요" });
    }
    if (saveDepth(d) > 8) {
      return json(req, 400, { error: "세이브 구조가 올바르지 않아요" });
    }
    let updatedAt = 0;
    const r = await mutateDb((fdb) => {
      if (!fdb.users[user.id]) return { status: 401, body: { error: "로그인이 필요해요" } };
      updatedAt = Date.now();
      fdb.saves[user.id] = { data: d as Record<string, unknown>, updatedAt };
      return null; // 쓰기
    });
    if (r.status !== 200) return json(req, r.status, r.body);
    return json(req, 200, { ok: true, updatedAt });
  } catch (e) {
    console.error("[SERTZ-api] cloud-save POST 실패", e);
    return json(req, 500, { error: "서버 오류" });
  }
}
