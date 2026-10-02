/**
 * ②안 (계정·거래소 Vercel serverless) — DB 저장소 시드 스크립트
 *
 *  목적: 기존 백업 파일(apple01234/CERTZ :: db-backup/accounts.enc)을
 *        전용 DB 저장소(apple01234/CERTZ-DB, private)로 이식한다.
 *  이유: CERTZ 저장소에 DB를 두면 계정 쓰기마다 커밋 → Vercel 자동 재배포 폭주.
 *        별도 저장소면 코드 배포와 데이터 분리가 확실하다.
 *
 *  사용: node scripts/ghdb_seed.js
 *    (GITHUB_TOKEN 없으면 .secrets/github_token에서 읽음)
 */
const { createHash, createDecipheriv } = require("node:crypto");
const { readFileSync } = require("node:fs");

const TOKEN = (process.env.GITHUB_TOKEN || readFileSync(".secrets/github_token", "utf8").trim());
const SRC_REPO = "apple01234/CERTZ";
const DST_REPO = "apple01234/CERTZ-DB";
const DB_PATH = "db-backup/accounts.enc";
const UA = "sertz-ghdb-seed";

function gh(path, opts = {}) {
  return fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": UA,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
    signal: AbortSignal.timeout(15000),
  });
}

/* accounts/index.js와 동일한 암호 검증 (복호화 호환 실측용) */
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
  /* 1) 소스 백업 읽기 */
  const r = await gh(`/repos/${SRC_REPO}/contents/${DB_PATH}?ref=main`);
  if (!r.ok) throw new Error(`소스 GET 실패: ${r.status}`);
  const j = await r.json();
  const enc = Buffer.from(j.content, "base64").toString("utf8");
  const json = backupDecrypt(enc);
  if (!json) throw new Error("복호화 실패 — 키 불일치 (SERTZ_BACKUP_KEY 기본값 확인)");
  const db = JSON.parse(json);
  console.log(`[seed] 소스 검증 OK — users=${Object.keys(db.users || {}).length} saves=${Object.keys(db.saves || {}).length} listings=${Object.keys(db.market?.listings || {}).length} tokens=${Object.keys(db.tokens || {}).length}`);
  console.log(`[seed] users: ${Object.keys(db.users || {}).join(", ")}`);
  console.log(`[seed] 소스 크기: ${enc.length} bytes (base64), sha=${j.sha.slice(0, 10)}…`);

  /* 2) 대상 저장소 확인/생성 (private) */
  const gr = await gh(`/repos/${DST_REPO}`);
  if (gr.status === 404) {
    const cr = await gh("/user/repos", {
      method: "POST",
      body: JSON.stringify({ name: "CERTZ-DB", private: true, description: "SERTZ account DB (GitHub-as-DB) — managed by Vercel serverless", auto_init: false }),
    });
    if (!cr.ok) throw new Error(`저장소 생성 실패: ${cr.status} ${await cr.text()}`);
    console.log("[seed] CERTZ-DB 저장소 생성 완료 (private)");
  } else if (gr.ok) {
    console.log(`[seed] CERTZ-DB 이미 존재 (private=${gr.json ? "?" : "?"})`);
  }

  /* 3) 대상에 기록 (동일 암호문 — 재암호화 없음) */
  const fileB64 = Buffer.from(enc, "utf8").toString("base64");
  const pr = await gh(`/repos/${DST_REPO}/contents/${DB_PATH}`, {
    method: "PUT",
    body: JSON.stringify({
      message: `seed from ${SRC_REPO} ${new Date().toISOString().slice(0, 16)}`,
      content: fileB64,
      branch: "main",
    }),
  });
  if (!pr.ok) throw new Error(`대상 PUT 실패: ${pr.status} ${await pr.text()}`);
  const pj = await pr.json();
  console.log(`[seed] CERTZ-DB/db-backup/accounts.enc 기록 완료 — sha=${(pj.content?.sha || "?").slice(0, 10)}… commit=${pj.commit?.sha?.slice(0, 10) || "?"}…`);
  console.log("[seed] 완료 — 기존 계정·세이브·거래소·랭킹 데이터 이식됨");
})().catch((e) => { console.error("[seed] 실패:", e.message || e); process.exit(1); });
