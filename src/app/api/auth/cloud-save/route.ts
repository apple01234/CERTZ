/**
 * v1.4.22 — GET/POST /api/auth/cloud-save (serverless 이행 — 계승: accounts/index.js)
 *  POST: 로그인 유저당 10회/분 · 2MB 캡 · 깊이 8 제한 (스토리지 DoS·DB 비대화 차단 계승)
 *  GET:  저장된 세이브 반환(없으면 null)
 *
 * vc205 (감사 #1) — **서버가 권위 있는 재화를 소유한다.**
 *  종전엔 클라가 올린 gold/emerald 를 검사 없이 그대로 저장했다. 세이브를 고쳐
 *  `gold: 999999999` 로 올리면 그대로 저장돼 거래소·강화가 전부 무력화됐다.
 *  이제 gold/emerald 는 **서버 값을 정본으로** 유지한다:
 *    · 최초 업로드(서버에 기록 없음) → 클라 값으로 시드 (기존 유저 마이그레이션 1회)
 *    · 이후 업로드 → 서버 값으로 덮어쓴다 (클라가 올린 gold/emerald 무시)
 *    · 재화 지급은 서버 경로만: /api/market/collect · /api/market/buy
 *
 * vc205 (감사 #4) — 클로저 부수효과 제거. 응답을 반환값으로 돌려준다.
 */
import { NextRequest } from "next/server";
import { loadDb, mutateDb } from "@/lib/ghdb";
import { currentUser, deductEscrow, escrowedCounts, json, options, rateLimit } from "@/lib/sapi";

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

/** 서버가 소유하는 재화 필드 — 클라 업로드값을 신뢰하지 않는다 */
const SERVER_OWNED_FIELDS = ["gold", "emerald"] as const;

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
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

    const r = await mutateDb((fdb) => {
      if (!fdb.users[user.id]) return { status: 401, body: { error: "로그인이 필요해요" } };
      const updatedAt = Date.now();
      /* v1.0.16 보안 — chars 미포함 요청(거래소 등록 전 선동기화 등)이 기존 캐릭터 백업을
       *  통째로 지우던 데이터 손실을 막는다. 미포함이면 기존 chars를 그대로 보존한다. */
      const prev = fdb.saves[user.id];
      const incoming = d as Record<string, unknown>;

      /* vc205 (감사 #1) — 서버 소유 재화를 정본으로 확정한다.
       *  prev 가 없으면 최초 업로드이므로 클라 값을 1회 시드로 받아들인다(기존 유저 마이그레이션).
       *  prev 가 있으면 서버 값을 그대로 유지 — 클라가 올린 값은 버린다. */
      if (prev?.data) {
        for (const f of SERVER_OWNED_FIELDS) {
          const serverVal = asNumber(prev.data[f]);
          if (serverVal !== null) incoming[f] = serverVal;
          else delete incoming[f]; // 서버에 기록이 없으면 클라 값을 신뢰하지 않는다
        }
      }

      const next: typeof prev = chars
        ? { data: incoming, chars, updatedAt }
        : { data: incoming, ...(prev?.chars ? { chars: prev.chars } : {}), updatedAt };
      /* v1.4.41 (감사 #1) — 거래소에 걸어둔 수량은 업로드 세이브에서 다시 차감한다.
       *  이게 없으면 등록 후 예전 세이브를 되올려 에스크로를 무효화하고 물건을 복제할 수 있다. */
      const esc = escrowedCounts(fdb, user.id);
      const removedEscrow = Object.keys(esc).length > 0 ? deductEscrow(next.data, esc) : 0;
      fdb.saves[user.id] = next;
      return { resp: { status: 200, body: { ok: true, updatedAt, escrowDeducted: removedEscrow } } };
    });
    return json(req, r.status, r.body);
  } catch (e) {
    console.error("[SERTZ-api] cloud-save POST 실패", e);
    return json(req, 500, { error: "서버 오류" });
  }
}
