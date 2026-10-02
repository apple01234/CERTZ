/**
 * v1.4.22 — POST /api/auth/delete (serverless 이행 — 계승: v1.4.3 #플레이콘솔 데이터보안)
 *  Google Play 계정 삭제 요구: 본인 계정·클라우드 세이브·토큰·랭킹·거래소 등록분·정산 레코드 삭제.
 *  confirm: "DELETE" 문구 필요.
 */
import { NextRequest } from "next/server";
import { loadDb, mutateDb } from "@/lib/ghdb";
import { audit, currentUser, json, options } from "@/lib/sapi";

export function OPTIONS(req: NextRequest) { return options(req); }

export async function POST(req: NextRequest) {
  try {
    const { db } = await loadDb(false);
    const me = currentUser(db, req);
    if (!me) return json(req, 401, { error: "로그인 상태에서만 삭제할 수 있어요" });
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (String(b.confirm || "").toUpperCase() !== "DELETE") {
      return json(req, 400, { error: "확인 문구가 올바르지 않아요 — confirm: DELETE 필요" });
    }
    const uid = me.id;
    const r = await mutateDb((fdb) => {
      delete fdb.users[uid];
      delete fdb.saves[uid];
      delete fdb.rank[uid];
      for (const k of Object.keys(fdb.tokens)) if (fdb.tokens[k].userId === uid) delete fdb.tokens[k];
      /* 거래소: 내 등록 물건 철회 (seller 필드 기준 — 구 데이터 sellerId 오타 계승 제거) */
      for (const k of Object.keys(fdb.market.listings || {})) {
        if (fdb.market.listings[k]?.seller === uid) delete fdb.market.listings[k];
      }
      delete fdb.payouts[uid];
      return null; // 쓰기
    });
    if (r.status !== 200) return json(req, r.status, r.body);
    audit("account_delete", { ip: "serverless", uid });
    return json(req, 200, { ok: true });
  } catch (e) {
    console.error("[SERTZ-api] delete 실패", e);
    return json(req, 500, { error: "서버 오류" });
  }
}
