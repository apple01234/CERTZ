/**
 * verify_dbkey_rotation.mjs — 계정 백업 키 회전(dual-key) 검증
 *
 * 왜 있나: SZBK1 암복호화에 이전 키(_PREV) 폴백을 넣으면서, 그 폴백이 잘못 동작하면
 *  · 폴백이 없으면 키 교체 순간 기존 백업을 못 읽어 로그인·거래소·랭킹이 전부 500이 되고,
 *  · 폴백이 과하면(아무 키나 통과) 암호화가 무의미해진다.
 *  두 방향을 다 확인해야 하므로 실행 가능한 체크를 남긴다.
 *
 * 한계(정직 고지): ghdb.ts / accounts/index.js의 함수는 내부 스코프라 직접 import할 수 없다.
 *  여기서는 두 파일과 **동일한 알고리즘**으로 컨테이너 규약을 검증하고, 아울러 두 파일에
 *  dual-key 배선(_PREV 지원)이 실제로 존재하는지 확인한다. 즉 "설계·배선" 검증이며
 *  컴파일된 코드의 실행 검증은 아니다(이 체크아웃에는 node_modules가 없다).
 *
 * 실행: node scripts/verify_dbkey_rotation.mjs
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_KEY_SECRET = "sertz-accounts-backup::v1";

const deriveKey = (secret) => createHash("sha256").update(secret).digest();

/** 생산 코드와 동일한 컨테이너 포맷: "SZBK1" + iv(12) + tag(16) + data */
function enc(json, secret) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", deriveKey(secret), iv);
  const body = Buffer.concat([c.update(json, "utf8"), c.final()]);
  return Buffer.concat([Buffer.from("SZBK1"), iv, c.getAuthTag(), body]).toString("base64");
}

/** 생산 코드와 동일한 복호화 순서: 현재 키 → 이전 키(읽기 전용) */
function dec(b64, secrets) {
  const raw = Buffer.from(String(b64), "base64");
  if (raw.length < 33 || raw.subarray(0, 5).toString() !== "SZBK1") return null;
  const iv = raw.subarray(5, 17), tag = raw.subarray(17, 33), data = raw.subarray(33);
  for (const s of secrets) {
    try {
      const d = createDecipheriv("aes-256-gcm", deriveKey(s), iv);
      d.setAuthTag(tag);
      return Buffer.concat([d.update(data), d.final()]).toString("utf8");
    } catch { /* 다음 후보 */ }
  }
  return null;
}

let fail = 0;
const ok = (name, cond) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) fail++;
};

const NEW = "new-key-2026-rotation", OLD = DEFAULT_KEY_SECRET;
const payload = JSON.stringify({ users: { admin: { role: "admin" } } });

/* ── 1. 컨테이너 규약 ───────────────────────────────────────────── */
ok("현재 키로 암호화 → 현재 키로 복호화", dec(enc(payload, NEW), [NEW]) === payload);
ok("기존(기본키) 암호문 → 현재+이전 키 순서로 복호화 성공", dec(enc(payload, OLD), [NEW, OLD]) === payload);
ok("현재 키만으로는 기존 암호문 복호화 실패(폴백이 실제로 필요함)", dec(enc(payload, OLD), [NEW]) === null);
ok("엉뚱한 키만으로는 복호화 실패(아무 키나 통과하지 않음)", dec(enc(payload, NEW), ["wrong-key"]) === null);
ok("이전 키로 성공해도 평문이 정확함", dec(enc(payload, OLD), [NEW, OLD]) === payload);

/* ── 2. 회전 시나리오: 새 키로 재암호화하면 _PREV 없이도 읽힌다 ── */
const reEncrypted = enc(payload, NEW); // 첫 쓰기가 새 키로 다시 암호화한 상태
ok("재암호화 후에는 _PREV 없이 읽힘(회전 완료 상태)", dec(reEncrypted, [NEW]) === payload);
ok("회전 완료 후 옛 기본키로는 못 읽음(노출 차단 확인)", dec(reEncrypted, [OLD]) === null);

/* ── 3. 두 생산 파일에 dual-key 배선이 실제로 있는지 ─────────────── */
for (const rel of ["src/lib/ghdb.ts", "accounts/index.js"]) {
  const src = readFileSync(join(ROOT, rel), "utf8");
  const hasPrev = src.includes("SERTZ_BACKUP_KEY_PREV");
  const hasCur = src.includes("SERTZ_BACKUP_KEY");
  // 복호화가 후보 목록을 순회하는 형태인지 (단일 키 고정 회귀 방지)
  const loops = /for\s*\(\s*(let\s+)?i\s*=\s*0;\s*i\s*<\s*secrets\.length/.test(src);
  const curFirst = /\[\s*current\s*,\s*prev\s*\]/.test(src);
  ok(`${rel}: SERTZ_BACKUP_KEY 읽음`, hasCur);
  ok(`${rel}: SERTZ_BACKUP_KEY_PREV 지원`, hasPrev);
  ok(`${rel}: 복호화가 키 후보를 순회`, loops);
  ok(`${rel}: 현재 키를 먼저 시도`, curFirst);
}

console.log(fail === 0 ? "\n전부 통과" : `\n실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
