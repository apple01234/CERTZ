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
    /* vc149 (#2) — chars: 전 캐릭터 백업분 동시 반환 */
    return json(req, 200, { data: s?.data ?? null, chars: s?.chars ?? null, updatedAt: s?.updatedAt ?? null });
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
    const b = (await req.json().catch(() => ({}))) as { data?: unknown; chars?: unknown };
    const d = b.data;
    if (d === null || typeof d !== "object" || Array.isArray(d)) {
      return json(req, 400, { error: "세이브 형식이 올바르지 않아요" });
    }
    /* vc149 (#2) — 전 캐릭터 백업분 검증 (이름 → 세이브, 최대 24캐릭·총 4MB) */
    let chars: Record<string, Record<string, unknown>> | undefined;
    if (b.chars !== undefined && b.chars !== null) {
      if (typeof b.chars !== "object" || Array.isArray(b.chars)) {
        return json(req, 400, { error: "캐릭터 백업 형식이 올바르지 않아요" });
      }
      chars = {};
      const entries = Object.entries(b.chars as Record<string, unknown>).slice(0, 24);
      for (const [k, v] of entries) {
        if (v === null || typeof v !== "object" || Array.isArray(v)) continue;
        chars[String(k).slice(0, 8)] = v as Record<string, unknown>;
      }
    }
    const totalLen = JSON.stringify({ d, chars }).length;
    if (totalLen > 4 * 1024 * 1024) {
      return json(req, 413, { error: "세이브가 너무 커요 — 저장할 수 없어요" });
    }
    if (saveDepth(d) > 8) {
      return json(req, 400, { error: "세이브 구조가 올바르지 않아요" });
    }
    let updatedAt = 0;
    const r = await mutateDb((fdb) => {
      if (!fdb.users[user.id]) return { status: 401, body: { error: "로그인이 필요해요" } };
      updatedAt = Date.now();
      /* v1.0.16 보안 — chars 미포함 요청(거래소 등록 전 선동기화 등)이 기존 캐릭터 백업을
       *  통째로 지우던 데이터 손실을 막는다. 미포함이면 기존 chars를 그대로 보존한다. */
      const prev = fdb.saves[user.id];
      fdb.saves[user.id] = chars
        ? { data: d as Record<string, unknown>, chars, updatedAt }
        : { data: d as Record<string, unknown>, ...(prev?.chars ? { chars: prev.chars } : {}), updatedAt };
      return null; // 쓰기
    });
    if (r.status !== 200) return json(req, r.status, r.body);
    return json(req, 200, { ok: true, updatedAt });
  } catch (e) {
    console.error("[SERTZ-api] cloud-save POST 실패", e);
    return json(req, 500, { error: "서버 오류" });
  }
}
