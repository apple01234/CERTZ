// db_accounts_dump.js — 특정 계정의 클라우드 세이브 상세 덤프 + 계정 백업 히스토리 열람 (읽기 전용)
// 사용법: node scripts/db_accounts_dump.js <userid> [history]
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

function gh(url) {
  return fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "sertz-local-admin" },
  });
}

async function main() {
  const uid = process.argv[2];
  if (!uid) throw new Error("사용법: node scripts/db_accounts_dump.js <userid> [history]");

  const r = await gh(`https://api.github.com/repos/${REPO}/contents/${PATH}?ref=main`);
  if (!r.ok) throw new Error(`GET 실패 ${r.status}`);
  const j = await r.json();
  const encText = Buffer.from(j.content, "base64").toString("utf8");
  const db = JSON.parse(decrypt(encText));

  const u = (db.users || {})[uid];
  const s = (db.saves || {})[uid];
  console.log(`=== 사용자 ${uid} ===`);
  if (u) {
    console.log(`user: role=${u.role} provider=${u.provider} createdAt=${new Date(u.createdAt).toISOString()}`);
  } else console.log("user: 없음");

  if (s && s.data) {
    const d = s.data;
    console.log(`save.updatedAt=${s.updatedAt ? new Date(s.updatedAt).toISOString() : "?"}`);
    const pick = (k) => (d[k] !== undefined ? d[k] : "-");
    console.log(`  cls=${pick("cls")} startCls=${pick("startCls")} lv=${pick("lv")} name=${pick("name")} stage=${pick("stage")} gold=${pick("gold")} emerald=${pick("emerald")}`);
    console.log(`  atk=${pick("atk")} def=${pick("def")} hp=${pick("hp")} fifth=${pick("fifth")} fifth2Done=${pick("fifth2Done")}`);
    console.log(`  owned keys=${Object.keys(d.owned || {}).length} questIdx=${pick("questIdx")}`);
    const raw = JSON.stringify(d);
    console.log(`  save 크기=${raw.length}B`);
  } else {
    console.log("save: 없음 (클라우드 백업에 세이브 데이터가 없다)");
  }

  if (process.argv[3] === "history") {
    console.log("\n=== accounts.enc 커밋 히스토리 (최근 30건) ===");
    const h = await gh(`https://api.github.com/repos/${REPO}/commits?path=${PATH}&per_page=30`);
    const commits = await h.json();
    for (const c of commits) console.log(`${c.sha.slice(0, 8)} ${c.commit.committer.date} ${c.commit.message.slice(0, 60)}`);
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
