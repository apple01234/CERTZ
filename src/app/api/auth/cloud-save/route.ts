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
import { loadDb, mutateDb, type SaveRec } from "@/lib/ghdb";
import { currentUser, deductEscrow, escrowedCounts, json, options, rateLimit } from "@/lib/sapi";
import { saveFingerprint } from "@/lib/saveCodec";
import { packSaveRec, unpackSaveRec } from "@/lib/saveAccess";

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
    /* vc229 — 저장된 세이브가 압축돼 있으면 여기서 푼다.
     *  클라이언트는 압축을 몰라도 된다(응답 형태는 종전과 동일).
     *  셋 다 문자열이면 풀고, 하나라도 아니면 종전 평문으로 취급한다. */
    const unpacked = unpackSaveRec(s);
    /* vc149 (#2) — chars: 전 캐릭터 백업분 동시 반환 */
    return json(req, 200, { data: unpacked?.data ?? null, chars: unpacked?.chars ?? null, updatedAt: unpacked?.updatedAt ?? null });
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
      /* vc229 — prev.data 가 압축본일 수 있다. 재화 판정은 **평문**으로 해야 하므로
       *  여기서 한 번 풀어서 읽는다. 종전엔 `prev.data[f]` 를 바로 읽었는데,
       *  압축 저장으로 바뀌면 그 값이 문자열이라 `asNumber` 가 null 을 주고
       *  **서버 재화가 통째로 삭제**된다(골드 증발). */
      const prevPlain = unpackSaveRec(prev)?.data;
      if (prevPlain) {
        for (const f of SERVER_OWNED_FIELDS) {
          const serverVal = asNumber(prevPlain[f]);
          if (serverVal !== null) incoming[f] = serverVal;
          else delete incoming[f]; // 서버에 기록이 없으면 클라 값을 신뢰하지 않는다
        }
      }

      const nextData = incoming;
      const nextChars = chars ?? prev?.chars;
      /* v1.4.41 (감사 #1) — 거래소에 걸어둔 수량은 업로드 세이브에서 다시 차감한다.
       *  이게 없으면 등록 후 예전 세이브를 되올려 에스크로를 무효화하고 물건을 복제할 수 있다. */
      const esc = escrowedCounts(fdb, user.id);
      const removedEscrow = Object.keys(esc).length > 0 ? deductEscrow(nextData, esc) : 0;

      /* vc229 — **내용이 그대로면 쓰기를 건너뛴다.**
       *  클라이언트가 90초마다 올린다. 그 사이 아무것도 안 바뀐 경우가 대부분인데
       *  지금은 그때도 DB 전체(유저 수에 비례)를 다시 암호화해 PUT 한다.
       *  에스크로 차감이 일어났으면 내용이 달라졌으므로 그때는 반드시 저장한다. */
      const fp = saveFingerprint({ d: nextData, c: nextChars ?? null });
      if (prev && prev.fp === fp && removedEscrow === 0) {
        return { resp: { status: 200, body: { ok: true, updatedAt: prev.updatedAt, unchanged: true } } };
      }

      /* vc229 — 저장은 압축해서 넣는다(실측 13~20%). 읽을 때 `packed` 를 보고 푼다.
       *  `packSaveRec` 이 data·chars 를 함께 압축하고 fp 를 붙인다 —
       *  평문으로 쓰던 시절의 형태와 섞이지 않게 한 곳에서 만든다. */
      fdb.saves[user.id] = packSaveRec(nextData, { chars: nextChars ?? null, updatedAt, fp }) as SaveRec;
      return { resp: { status: 200, body: { ok: true, updatedAt, escrowDeducted: removedEscrow } } };
    });
    return json(req, r.status, r.body);
  } catch (e) {
    console.error("[SERTZ-api] cloud-save POST 실패", e);
    return json(req, 500, { error: "서버 오류" });
  }
}
