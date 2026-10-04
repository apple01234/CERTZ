// db_find_player.js — CERTZ-DB accounts.enc 복호화 후 특정 playerName 검색 (읽기 전용)
// 사용법: node scripts/db_find_player.js <검색어>
const { createDecipheriv, createHash } = require("node:crypto");
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

async function main() {
  const q = process.argv[2] || "";
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${PATH}?ref=main`, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "sertz-local-admin" },
  });
  if (!r.ok) throw new Error(`GET 실패 ${r.status}`);
  const j = await r.json();
  const sha = j.sha;
  const encText = Buffer.from(j.content, "base64").toString("utf8");
  const db = JSON.parse(decrypt(encText));
  console.log("sha:", sha);
  console.log("users:", Object.keys(db.users || {}).length, "saves:", Object.keys(db.saves || {}).length);

  // 1) 유저 이름 검색
  for (const [id, u] of Object.entries(db.users || {})) {
    if (q && String(u.name || "").includes(q)) {
      console.log(`[USER 매치] id=${id} name=${u.name} provider=${u.provider} role=${u.role || "user"} createdAt=${new Date(u.createdAt).toISOString()}`);
    }
  }
  // 2) 세이브 playerName 검색
  for (const [uid, s] of Object.entries(db.saves || {})) {
    const d = s?.data || {};
    const pn = String(d.playerName || "");
    if (q && (pn.includes(q) || uid.includes(q))) {
      const inf = d.inf || {};
      console.log(`[SAVE 매치] uid=${uid} playerName=${pn} lv=${d.lv} cls=${d.cls} rebirths=${inf.rebirths ?? "-"} tower=${inf.towerBest ?? "-"} updatedAt=${new Date(s.updatedAt).toISOString()}`);
    }
  }
}
main().catch((e) => { console.error("오류:", e.message); process.exit(1); });
