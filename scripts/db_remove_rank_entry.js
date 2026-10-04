// db_remove_rank_entry.js — CERTZ-DB에서 특정 uid 세이브 제거 (랭킹 이탈)
// 사용법: node scripts/db_remove_rank_entry.js <uid>
const { createDecipheriv, createCipheriv, createHash, randomBytes } = require("node:crypto");
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

async function main() {
  const uid = process.argv[2];
  if (!uid) throw new Error("사용법: node scripts/db_remove_rank_entry.js <uid>");

  // 1) GET
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${PATH}?ref=main`, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "sertz-local-admin" },
  });
  if (!r.ok) throw new Error(`GET 실패 ${r.status}`);
  const j = await r.json();
  const sha = j.sha;
  const db = JSON.parse(decrypt(Buffer.from(j.content, "base64").toString("utf8")));

  // 2) 제거 전 상태 기록
  const saves = db.saves || {};
  if (!saves[uid]) { console.log(`이미 세이브 없음: ${uid}`); return; }
  const pn = saves[uid]?.data?.playerName;
  console.log(`제거 대상: uid=${uid} playerName=${pn} lv=${saves[uid]?.data?.lv}`);
  delete saves[uid];
  console.log(`세이브 삭제 완료 → 잔여 세이브: ${Object.keys(saves).join(", ") || "(없음)"}`);

  // 3) 레거시 rank 스토어에도 해당 uid가 있으면 정리
  if (db.rank && typeof db.rank === "object") {
    const before = Object.keys(db.rank).length;
    for (const k of Object.keys(db.rank)) {
      const v = db.rank[k];
      const s = JSON.stringify(v);
      if (k === uid || (pn && s && s.includes(pn))) delete db.rank[k];
    }
    console.log(`rank 스토어: ${before} → ${Object.keys(db.rank).length}`);
  } else {
    console.log(`rank 스토어: 없음/스킵 (${typeof db.rank})`);
  }

  // 4) PUT (sha 낙관 잠금)
  const put = await fetch(`https://api.github.com/repos/${REPO}/contents/${PATH}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json", "Content-Type": "application/json", "User-Agent": "sertz-local-admin" },
    body: JSON.stringify({
      message: `admin: remove rank entry uid=${uid.slice(0, 4)}*** (playerName=${pn ? pn.slice(0, 3) + "***" : "?"}) ${new Date().toISOString().slice(0, 16)}`,
      content: Buffer.from(encrypt(JSON.stringify(db)), "utf8").toString("base64"),
      sha, branch: "main",
    }),
  });
  console.log("PUT:", put.status, put.status === 200 ? "✓" : "✗ " + (await put.text()).slice(0, 300));
}
main().catch((e) => { console.error("오류:", e.message); process.exit(1); });
