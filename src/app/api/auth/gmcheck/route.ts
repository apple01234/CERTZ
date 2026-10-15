/**
 * v1.0.13 피드백#11 — GET /api/auth/gmcheck (MQTT 경로 GM 검증 — accounts/index.js 동일 프로토콜)
 *  공개 MQTT 브로커로 중계되는 프레즌스의 gm 플래그는 자기선언이라 스푸핑 가능하다.
 *  각 클라이언트는 원격이 제시한 증명 proof = SHA-256(세션 토큰) 앞 16 hex를 이 엔드포인트로
 *  대조해 "실제로 살아있는 admin 세션 토큰의 해시 단편"인지 확인한다.
 *  · 토큰 원문은 어디에도 전송/저장되지 않고, 응답은 { gm: boolean } 뿐이다.
 *  · 200은 "판정 완료", 4xx/5xx는 "판정 불가" — 클라는 후자를 gm=false로 처리한다.
 */
import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { loadDb } from "@/lib/ghdb";
import { json, options, rateLimit } from "@/lib/sapi";

export function OPTIONS(req: NextRequest) { return options(req); }

export async function GET(req: NextRequest) {
  try {
    /* 경량 레이트리밋 — 프레즌스 남발로 DB 조회가 늘어나는 것만 방지 (정상 플레이엔 1회/원격) */
    if (!rateLimit(req, "gmcheck", 120, 60 * 1000)) {
      return json(req, 429, { gm: false, error: "요청이 너무 많아요" });
    }
    const uid = (req.nextUrl.searchParams.get("uid") || "").trim().toLowerCase().slice(0, 40);
    const proof = (req.nextUrl.searchParams.get("proof") || "").trim().toLowerCase();
    if (!uid || !/^[0-9a-f]{16}$/.test(proof)) {
      return json(req, 400, { gm: false, error: "잘못된 요청" });
    }
    const { db } = await loadDb(false);
    const u = db.users[uid];
    if (!u || u.role !== "admin") return json(req, 200, { gm: false });
    const now = Date.now();
    /* ghdb 토큰 테이블: 키=원문 토큰, 값={userId, expiresAt} — 만료 토큰은 증명 불인정 */
    for (const [tok, rec] of Object.entries(db.tokens)) {
      if (rec.userId !== uid || rec.expiresAt < now) continue;
      if (createHash("sha256").update(tok).digest("hex").slice(0, 16) === proof) {
        return json(req, 200, { gm: true });
      }
    }
    return json(req, 200, { gm: false });
  } catch (e) {
    console.error("[SERTZ-api] gmcheck 실패", e);
    return json(req, 500, { gm: false, error: "서버 오류" });
  }
}
