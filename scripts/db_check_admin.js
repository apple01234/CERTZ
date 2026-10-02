/**
 * CERTZ-DB 계정 조회 — admin 계정 존재 여부/롤 확인 (비밀번호 원문은 볼 수 없음 — scrypt 해시만 존재)
 */
const { createHash, createDecipheriv } = require("node:crypto");
const { readFileSync } = require("node:fs");

let TOKEN = "";
try { TOKEN = readFileSync(".secrets/github_token", "utf8").trim(); } catch {}
if (!TOKEN) {
  const url = require("node:child_process").execSync("git remote get-url origin", { encoding: "utf8" }).trim();
  TOKEN = url.replace(/^https?:\/\//, "").replace(/@github\.com.*$/s, "").replace(/^[^:]+:/, "").trim();
}
const DST_REPO = "apple01234/CERTZ-DB";

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

(async () => {
  const r = await fetch(`https://api.github.com/repos/${DST_REPO}/contents/db-backup/accounts.enc?ref=main`, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "sertz-db-check" },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) { console.error("GET 실패:", r.status); process.exit(1); }
  const j = await r.json();
  const json = backupDecrypt(Buffer.from(j.content, "base64").toString("utf8"));
  if (!json) { console.error("복호화 실패"); process.exit(1); }
  const db = JSON.parse(json);
  const users = db.users || {};
  console.log("총 유저 수:", Object.keys(users).length);
  for (const [id, u] of Object.entries(users)) {
    const isAdmin = u.role === "admin";
    if (isAdmin || ["admin", "apple01234", "sertzadmin"].includes(id)) {
      console.log(`[ADMIN] id=${id} name=${u.name} role=${u.role} provider=${u.provider} createdAt=${new Date(u.createdAt).toISOString()}`);
    }
  }
  console.log("--- 전체 목록(아이디:롤) ---");
  console.log(Object.entries(users).map(([id, u]) => `${id}:${u.role || "user"}`).join(", "));
})();
