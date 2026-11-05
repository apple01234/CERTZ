/**
 * v1.4.22 — POST /api/auth/login (serverless 이행 — 계승: accounts/index.js)
 *  계정 열거 방지 통일 메시지 · timingSafeEqual · scrypt(기존 계정 해시 호환) · 토큰 본문 동봉.
 */
import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { loadDb, mutateDb, ensureAdminAccount } from "@/lib/ghdb";
import { ADMIN_USERS, audit, hashPw, issueToken, json, options, publicUser, rateLimit } from "@/lib/sapi";
import type { Resp } from "@/lib/ghdb";

export function OPTIONS(req: NextRequest) { return options(req); }

const LOGIN_FAIL_MSG = "아이디 또는 비밀번호가 올바르지 않아요 — 가입한 적이 없다면 회원가입 탭을 이용해 주세요";

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(req, "login", 15, 5 * 60 * 1000)) {
      return json(req, 429, { error: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요." });
    }
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const id = String(b.id || "").trim().toLowerCase();

    /* 1차 — 캐시 읽기로 빠른 검증 (실패 조기 반환은 쓰기 없음)
     *  v1.4.22 — 캐시에 유저가 없으면 강제 재조회 1회: 가입→즉시 로그인 레이스 제거
     *  (인스턴스 간 8초 캐시 어긋남 — 로컬 재현은 dev 핫리로드 혼선, 실서버 방어로 흡수).
     *  비밀번호 불일치엔 재조회하지 않는다(무차별 대입 비용 보호). */
    let { db } = await loadDb(false);
    if (!db.users[id]) ({ db } = await loadDb(true));
    /* vc238 — 관리자 계정 자가 복구(serverless).
     *  커스텀 서버(accounts/index.js)는 부팅 시 오토시드 + syncAdminPassword 로 env 비밀번호를
     *  강제 동기화하지만, Vercel 은 이 라우트가 ghdb.ts 를 직접 쓰므로 그 경로가 실행되지 않는다.
     *  게다가 register 는 admin 아이디를 403 으로 막아 새 세대에서 관리자 계정을 만들 수도 없다.
     *
     *  vc239 수정 — 종전 조건이 `!db.users[id]` 라서 **계정이 이미 있으면 동기화를 건너뛰었다.**
     *  한 번 잘못된 해시로 생성되면(env 오타·값 교체 등) 영구히 로그인 불가가 되고,
     *  DB 를 직접 지우지 않는 한 복구할 방법이 없었다. 비밀번호 불일치 시에도 동기화를 시도한다. */
    if (ADMIN_USERS.includes(id) && process.env.SERTZ_ADMIN_PASSWORD) {
      const user0 = db.users[id];
      const needsSync = !user0 || (user0.provider === "local" && user0.hash !== hashPw(String(b.pw || ""), user0.salt));
      if (needsSync) {
        const synced = await mutateDb((fdb) => {
          const changed = ensureAdminAccount(fdb);
          return changed
            ? { resp: { status: 200, body: { synced: true } } }
            : { status: 409, body: { synced: false } };
        });
        /* synced=false 는 다른 인스턴스가 먼저 맞춘 경우 — 그래도 재조회해서 판정한다 */
        if (synced.status === 200) audit("admin_pw_sync_serverless", { uid: id });
        ({ db } = await loadDb(true));
      }
    }
    const user = db.users[id];
    if (user && user.provider === "local") {
      const hash = Buffer.from(hashPw(String(b.pw || ""), user.salt), "hex");
      const stored = Buffer.from(user.hash, "hex");
      if (hash.length === stored.length && timingSafeEqual(hash, stored)) {
        const r = await mutateDb((fdb) => {
          const fu = fdb.users[id];
          if (!fu || fu.provider !== "local") return { status: 401, body: { error: LOGIN_FAIL_MSG } };
          const { token, cookie } = issueToken(fdb, fu, req);
          audit("login", { ip: "serverless", uid: id, role: fu.role === "admin" ? "admin" : "user" });
          return { resp: { status: 200, body: { user: publicUser(fu), token }, headers: { "Set-Cookie": cookie } } };
        });
        return json(req, r.status, r.body, r.headers);
      }
    }
    audit("login_fail", { ip: "serverless", uid: id });
    return json(req, 401, { error: LOGIN_FAIL_MSG });
  } catch (e) {
    console.error("[SERTZ-api] login 실패", e);
    return json(req, 500, { error: "서버 오류" });
  }
}
