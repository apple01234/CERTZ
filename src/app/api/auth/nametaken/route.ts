/**
 * v1.0.13 피드백#8 — GET /api/auth/nametaken (serverless 이행 — accounts/index.js 응답 형태 그대로)
 *  계정 이름 + 캐릭터 이름 레지스트리(db.charNames) 통합 검색 (대소문자 무시).
 *  기존엔 서버리스에 이 라우트가 없어 클라 nameTaken()이 404→null→"검증 우회"로 빠졌다.
 *  node 서버와 동일 JSON({ taken, name })을 반환 — 클라이언트 수정 0.
 *  로그인 상태면 본인 소유 등록분은 "내 것"으로 취급해 사용 가능으로 판정 (node nickTaken 동일).
 */
import { NextRequest } from "next/server";
import { loadDb } from "@/lib/ghdb";
import { currentUser, json, options, rateLimit } from "@/lib/sapi";

export function OPTIONS(req: NextRequest) { return options(req); }

export async function GET(req: NextRequest) {
  try {
    if (!rateLimit(req, "nametaken", 60, 60 * 1000)) {
      return json(req, 429, { error: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요." });
    }
    const name = (req.nextUrl.searchParams.get("name") || "").trim();
    const key = name.toLowerCase();
    const { db } = await loadDb(false);
    const me = currentUser(db, req);
    const exclude = me?.id ?? null;
    let taken = false;
    if (key) {
      for (const u of Object.values(db.users)) {
        if (String(u.name || "").trim().toLowerCase() === key && u.id !== exclude) {
          taken = true;
          break;
        }
      }
      const reg = db.charNames?.[key];
      if (reg && reg.by !== exclude) taken = true;
    }
    return json(req, 200, { taken, name: name.slice(0, 8) });
  } catch (e) {
    console.error("[SERTZ-api] nametaken 실패", e);
    return json(req, 500, { error: "서버 오류" });
  }
}
