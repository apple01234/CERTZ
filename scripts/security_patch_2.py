#!/usr/bin/env python3
# 계정 서버 보안 강화 2단계 — register/login/me에 rate limit·audit 적용 + 관리자 API 신설 + market audit
p = "accounts/index.js"
s = open(p, encoding="utf8").read()

# 1) register — rate limit + audit + role 부여
old1 = '''    if (url === "/api/auth/register" && method === "POST") {
      const b = await readBody(req);'''
new1 = '''    if (url === "/api/auth/register" && method === "POST") {
      if (!rateLimit(req, res, "register", 10, 5 * 60 * 1000)) return true; // v1.0.2 — 무차별 가입 차단
      const b = await readBody(req);'''
assert old1 in s; s = s.replace(old1, new1, 1)

old2 = '''      const salt = randomBytes(16).toString("hex");
      const user = { id, name, provider: "local", salt, hash: hashPw(pw, salt), createdAt: Date.now() };
      db.users[id] = user;
      persistDb();
      sendJson(res, 200, { user: publicUser(user) }, issueToken(res, user));
      return true;
    }'''
new2 = '''      const salt = randomBytes(16).toString("hex");
      /* v1.0.2 — 관리자 목록(env)에 있으면 role=admin (서버가 유일한 권한 발급처) */
      const role = ADMIN_USERS.includes(id) ? "admin" : "user";
      const user = { id, name, provider: "local", salt, hash: hashPw(pw, salt), createdAt: Date.now(), role };
      db.users[id] = user;
      persistDb();
      audit("register", { ip: clientIp(req), uid: id, role });
      sendJson(res, 200, { user: publicUser(user) }, issueToken(res, user));
      return true;
    }'''
assert old2 in s; s = s.replace(old2, new2, 1)

# 2) login — rate limit + audit(성공/실패)
old3 = '''    if (url === "/api/auth/login" && method === "POST") {
      const b = await readBody(req);
      const id = String(b.id || "").trim().toLowerCase();
      const user = db.users[id];
      if (!user || user.provider !== "local") return sendJson(res, 401, { error: "아이디 또는 비밀번호가 틀렸어요" });
      const hash = Buffer.from(hashPw(String(b.pw || ""), user.salt), "hex");
      const stored = Buffer.from(user.hash, "hex");
      if (hash.length !== stored.length || !timingSafeEqual(hash, stored))
        return sendJson(res, 401, { error: "아이디 또는 비밀번호가 틀렸어요" });
      sendJson(res, 200, { user: publicUser(user) }, issueToken(res, user));
      return true;
    }'''
new3 = '''    if (url === "/api/auth/login" && method === "POST") {
      if (!rateLimit(req, res, "login", 15, 5 * 60 * 1000)) return true; // v1.0.2 — 무차별 대입 차단
      const b = await readBody(req);
      const id = String(b.id || "").trim().toLowerCase();
      const user = db.users[id];
      if (!user || user.provider !== "local") {
        audit("login_fail", { ip: clientIp(req), uid: id }); // v1.0.2
        return sendJson(res, 401, { error: "아이디 또는 비밀번호가 틀렸어요" });
      }
      const hash = Buffer.from(hashPw(String(b.pw || ""), user.salt), "hex");
      const stored = Buffer.from(user.hash, "hex");
      if (hash.length !== stored.length || !timingSafeEqual(hash, stored)) {
        audit("login_fail", { ip: clientIp(req), uid: id }); // v1.0.2
        return sendJson(res, 401, { error: "아이디 또는 비밀번호가 틀렸어요" });
      }
      audit("login", { ip: clientIp(req), uid: id, role: user.role === "admin" ? "admin" : "user" }); // v1.0.2
      sendJson(res, 200, { user: publicUser(user) }, issueToken(res, user));
      return true;
    }'''
assert old3 in s; s = s.replace(old3, new3, 1)

# 3) 관리자 API — /api/auth/me 뒤에 배치
old4 = '''    /* 로그아웃 */
    if (url === "/api/auth/logout" && method === "POST") {'''
new4 = '''    /* v1.0.2 — 관리자 요약 API (서버 롤 검증 — 일반 유저/미인증 403) */
    if (url === "/api/admin/summary" && method === "GET") {
      const me = currentUser(req);
      if (!isAdminUser(me)) {
        audit("admin_denied", { ip: clientIp(req), uid: me?.id ?? null });
        return sendJson(res, 403, { error: "관리자 권한이 필요해요" });
      }
      audit("admin_summary", { ip: clientIp(req), uid: me.id });
      let recentAudit = [];
      try {
        recentAudit = readFileSync(AUDIT_FILE, "utf8").trim().split("\\n").slice(-50)
          .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
      } catch { recentAudit = []; }
      return sendJson(res, 200, {
        users: Object.keys(db.users).length,
        listings: Object.keys(db.market.listings).length,
        payoutGold: Object.values(db.payouts).reduce((a, b) => a + (b.gold || 0), 0),
        recentAudit,
      });
    }

    /* 로그아웃 */
    if (url === "/api/auth/logout" && method === "POST") {'''
assert old4 in s; s = s.replace(old4, new4, 1)

open(p, "w", encoding="utf8").write(s)
print("2단계(auth/admin) 적용 완료")
