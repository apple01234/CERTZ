#!/usr/bin/env python3
# 계정 서버 보안 강화 (v1.0.2, 유저 지시 Phase 12/29)
#  · 관리자 롤(서버 검증) — SERTZ_ADMIN_USERS env 매칭 시 role=admin, /api/auth/me에 role 노출
#  · Rate Limit — IP+버킷 토큰 버킷(인메모리): 가입/로그인 10회/5분, 거래 POST 30회/분, 세이브 30회/분
#  · Audit Log — db/audit.log JSONL (가입/로그인/실패/거래/관리자 조회)
#  · 관리자 API — GET /api/admin/summary (role=admin만, 403 차단)
import re

p = "accounts/index.js"
s = open(p, encoding="utf8").read()

# 1) 상수/유틸 블록 삽입
old1 = 'const COOKIE = "sertz_auth";'
new1 = '''const COOKIE = "sertz_auth";
/* ---------------- v1.0.2 보안 계층 (유저 지시 Phase 12/29) ----------------
 *  · 관리자 롤: SERTZ_ADMIN_USERS(env, 쉼표 구분)에 있는 아이디만 role="admin" — 클라 flag로 판단하지 않음
 *  · Rate Limit: IP+버킷 인메모리 카운터 (정상 플레이에는 영향 없는 수준)
 *  · Audit Log: db/audit.log JSONL — 가입/로그인/거래/관리자 조회 추적 */
const ADMIN_USERS = (process.env.SERTZ_ADMIN_USERS || "")
  .split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
const rateBuckets = new Map(); // key -> { n, resetAt }
function clientIp(req) {
  return (
    String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress || "?"
  );
}
function rateLimit(req, res, bucket, max, windowMs) {
  const key = `${clientIp(req)}:${bucket}`;
  const now = Date.now();
  let b = rateBuckets.get(key);
  if (!b || b.resetAt < now) { b = { n: 0, resetAt: now + windowMs }; rateBuckets.set(key, b); }
  b.n++;
  if (rateBuckets.size > 5000) {
    for (const [k, v] of rateBuckets) if (v.resetAt < now) rateBuckets.delete(k);
  }
  if (b.n > max) {
    sendJson(res, 429, { error: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요." }, { "Retry-After": String(Math.ceil((b.resetAt - now) / 1000)) });
    return false;
  }
  return true;
}
const AUDIT_FILE = path.join(DB_DIR, "audit.log");
function audit(event, detail = {}) {
  try {
    mkdirSync(DB_DIR, { recursive: true });
    const line = JSON.stringify({ ts: Date.now(), event, ...detail });
    require("node:fs").appendFileSync(AUDIT_FILE, line + "\\n");
  } catch { /* 감사 로그 실패가 서비스를 막지 않게 */ }
}
function isAdminUser(u) {
  return !!u && (u.role === "admin" || ADMIN_USERS.includes(String(u.name || "").toLowerCase()));
}'''
assert old1 in s
s = s.replace(old1, new1, 1)

# 2) loadDb — 관리자 env 스윕
old2 = '''    db.market ||= { nextId: 1, listings: {} }; // v1.0.1 — 유저 거래판 (구 DB 호환)
    db.market.listings ||= {};
    db.payouts ||= {}; // v1.0.1 — 판매 정산금 ledger'''
new2 = '''    db.market ||= { nextId: 1, listings: {} }; // v1.0.1 — 유저 거래판 (구 DB 호환)
    db.market.listings ||= {};
    db.payouts ||= {}; // v1.0.1 — 판매 정산금 ledger
    // v1.0.2 — env 관리자 목록 동기화 (이미 가입된 계정도 롤 자동 승격/회수)
    for (const u of Object.values(db.users)) {
      const shouldAdmin = ADMIN_USERS.includes(String(u.name || "").toLowerCase());
      if (shouldAdmin && u.role !== "admin") u.role = "admin";
      else if (!shouldAdmin && u.role === "admin" && u.roleSource !== "manual") u.role = "user";
    }'''
assert old2 in s
s = s.replace(old2, new2, 1)

# 3) publicUser — role 노출
old3 = '''function publicUser(u) {
  return u ? { id: u.id, name: u.name, provider: u.provider, createdAt: u.createdAt } : null;
}'''
new3 = '''function publicUser(u) {
  // v1.0.2 — role 노출 (클라는 이 값으로 GM 진입 여부만 판단, 권한 자체는 서버가 보유)
  return u ? { id: u.id, name: u.name, provider: u.provider, createdAt: u.createdAt, role: u.role === "admin" ? "admin" : "user" } : null;
}'''
assert old3 in s
s = s.replace(old3, new3, 1)

open(p, "w", encoding="utf8").write(s)
print("1단계(유틸) 적용 완료")
