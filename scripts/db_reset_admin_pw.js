/**
 * CERTZ-DB 관리자 비밀번호 리셋
 *  - 대상: admin, apple01234 (role=admin)
 *  - 새 비밀번호: process.env.NEW_PW || "admin123"  (hashPw와 동일 — scryptSync(pw, salt, 64))
 *  - 포맷: SZBK1(iv12+tag16+data) AES-256-GCM, key=sha256("sertz-accounts-backup::v1") — ghdb.ts와 바이트 호환
 *  - 쓰기: fresh GET(sha) → mutate → PUT(sha 낙관 잠금)
 */
const { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } = require("node:crypto");
const { readFileSync } = require("node:fs");

let TOKEN = "";
try { TOKEN = readFileSync(".secrets/github_token", "utf8").trim(); } catch {}
if (!TOKEN) {
  const url = require("node:child_process").execSync("git remote get-url origin", { encoding: "utf8" }).trim();
  TOKEN = url.replace(/^https?:\/\//, "").replace(/@github\.com.*$/s, "").replace(/^[^:]+:/, "").trim();
}
const REPO = "apple01234/CERTZ-DB";
const PATH = "db-backup/accounts.enc";
const NEW_PW = process.env.NEW_PW || "admin123";
const TARGETS = ["admin", "apple01234"];

function backupKey() {
  return createHash("sha256").update(process.env.SERTZ_BACKUP_KEY || "sertz-accounts-backup::v1").digest();
}
function backupDecrypt(b64) {
  const raw = Buffer.from(String(b64), "base64");
  if (raw.length < 33 || raw.subarray(0, 5).toString() !== "SZBK1") return null;
  const iv = raw.subarray(5, 17), tag = raw.subarray(17, 33), data = raw.subarray(33);
  const d = createDecipheriv("aes-256-gcm", backupKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}
function backupEncrypt(json) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", backupKey(), iv);
  const enc = Buffer.concat([c.update(json, "utf8"), c.final()]);
  return Buffer.concat([Buffer.from("SZBK1"), iv, c.getAuthTag(), enc]).toString("base64");
}
function gh(path, opts = {}) {
  return fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "sertz-pw-reset",
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
    signal: AbortSignal.timeout(20000),
  });
}

(async () => {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const r = await gh(`/repos/${REPO}/contents/${PATH}?ref=main`);
    if (!r.ok) throw new Error(`GET 실패: ${r.status}`);
    const j = await r.json();
    const db = JSON.parse(backupDecrypt(Buffer.from(j.content, "base64").toString("utf8")));

    for (const id of TARGETS) {
      const u = db.users[id];
      if (!u) { console.error(`[!] ${id} 계정이 DB에 없음`); process.exit(1); }
      u.salt = randomBytes(16).toString("hex");
      u.hash = scryptSync(NEW_PW, u.salt, 64).toString("hex");
      if (u.role !== "admin") u.role = "admin";
    }

    const put = await gh(`/repos/${REPO}/contents/${PATH}`, {
      method: "PUT",
      body: JSON.stringify({
        message: `admin password reset (admin, apple01234) ${new Date().toISOString().slice(0, 16)}`,
        content: Buffer.from(backupEncrypt(JSON.stringify(db))).toString("base64"),
        sha: j.sha,
        branch: "main",
      }),
    });
    if (put.status === 200 || put.status === 201) {
      console.log(`[OK] 리셋 완료 (시도 ${attempt}) — ${TARGETS.join(", ")} → "${NEW_PW}"`);
      process.exit(0);
    }
    console.log(`[retry] PUT ${put.status} — 재시도 ${attempt}/4`);
    await new Promise((s) => setTimeout(s, 1500));
  }
  throw new Error("PUT 4회 실패");
})();
