// db_accounts_list.js — CERTZ-DB accounts.enc 복호화 후 계정 목록 조회 (읽기 전용)
// 사용법: node scripts/db_accounts_list.js [list|reset <id> <newpw>]
const { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } = require("node:crypto");
const fs = require("node:fs");

const TOKEN = fs.readFileSync("/home/z/my-project/.secrets/github_token", "utf8").trim();
const REPO = "apple01234/CERTZ-DB";
const PATH = "db-backup/accounts.enc";
const KEY = createHash("sha256").update("sertz-accounts-backup::v1").digest();

function decrypt(b64) {
  const raw = Buffer.from(String(b64), "base64");
  if (raw.length < 33 || raw.subarray(0, 5).toString() !== "SZBK1") throw new Error("SZBK1 헤더 불일치");
  const iv = raw.subarray(5, 17), tag = raw.subarray(17, 33), data = raw.subarray(33);
  const d = createDecipheriv("aes-256-gcm", KEY, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}
function encrypt(json) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([c.update(json, "utf8"), c.final()]);
  return Buffer.concat([Buffer.from("SZBK1"), iv, c.getAuthTag(), enc]).toString("base64");
}
function hashPw(pw, salt) { return scryptSync(String(pw), salt, 64).toString("hex"); }

async function main() {
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${PATH}?ref=main`, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "sertz-local-admin" },
  });
  if (!r.ok) throw new Error(`GET 실패 ${r.status}`);
  const j = await r.json();
  const sha = j.sha;
  // 파일은 base64 텍스트로 저장돼 있음 → API content(base64) 1차 디코딩 = 파일 원문(텍스트) → 2차 디코딩 = SZBK1 바이너리
  const encText = Buffer.from(j.content, "base64").toString("utf8");
  const db = JSON.parse(decrypt(encText));
  const keys = Object.keys(db);
  console.log("상위 키:", keys.join(", "));
  const users = db.users || {};
  const ids = Object.keys(users);
  console.log(`계정 ${ids.length}개:`);
  for (const id of ids) {
    const u = users[id];
    console.log(` - ${id} | role=${u.role || "user"} | provider=${u.provider || "local"} | createdAt=${new Date(u.createdAt).toISOString().slice(0, 16)}`);
  }
  const mode = process.argv[2] || "list";
  if (mode === "reset") {
    const id = process.argv[3], newpw = process.argv[4];
    if (!id || !newpw) throw new Error("사용법: node scripts/db_accounts_list.js reset <id> <newpw>");
    if (!users[id]) throw new Error(`계정 없음: ${id}`);
    const salt = randomBytes(16).toString("hex");
    users[id].salt = salt;
    users[id].hash = hashPw(newpw, salt);
    const put = await fetch(`https://api.github.com/repos/${REPO}/contents/${PATH}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json", "Content-Type": "application/json", "User-Agent": "sertz-local-admin" },
      body: JSON.stringify({
        message: `admin: password reset ${id.slice(0, 2)}*** ${new Date().toISOString().slice(0, 16)}`,
        content: Buffer.from(encrypt(JSON.stringify(db)), "utf8").toString("base64"),
        sha, branch: "main",
      }),
    });
    console.log("PUT:", put.status, put.status === 200 ? "✓ 비번 리셋 완료" : "✗ 실패 " + (await put.text()).slice(0, 200));
  }
}
main().catch((e) => { console.error("오류:", e.message); process.exit(1); });
