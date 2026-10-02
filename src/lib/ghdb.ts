/**
 * v1.4.22 — GitHub-as-DB 계층 (②안: 계정·거래소 Vercel serverless 마이그레이션)
 *
 *  배경: space-z.ai 게임 서버 본체(sertz5/sertz11)를 폐기하고 계정·거래소·랭킹·클라우드
 *  세이브를 Vercel serverless API 라우트로 옮긴다. 소켓 멀티플레이는 제외(오프라인 모드).
 *
 *  저장소 구조:
 *   - DB 파일 = apple01234/CERTZ-DB (private) :: db-backup/accounts.enc
 *   - 기존 accounts/index.js의 GitHub 백업과 "동일 파일·동일 포맷"(SZBK1 AES-256-GCM,
 *     기본 키 "sertz-accounts-backup::v1") → 기존 계정·세이브·거래소 데이터 무손실 계승
 *   - CERTZ(게임 코드 저장소)에 두면 계정 쓰기마다 커밋 → Vercel 재배포 폭주라
 *     반드시 전용 저장소에 둔다. ghSeed 스크립트(scripts/ghdb_seed.js)로 이식 완료.
 *
 *  정합성 전략:
 *   - 쓰기 = 항상 fresh GET(sha 확보) → mutate → PUT(sha 낙관 잠금)
 *   - PUT 409/422(누군가 먼저 씀) → 재조회 후 재적용, 최대 4회
 *   - 읽기 = 인스턴스 메모리 캐시(8초 TTL) — 랭킹/거래소 목록 등 공개 읽기 절감
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/* ---------------- 데이터 형태 (accounts/index.js 파일 DB와 동일) ---------------- */
export type UserRec = { id: string; name: string; provider: string; salt: string; hash: string; createdAt: number; role?: string };
export type TokenRec = { userId: string; expiresAt: number };
export type SaveRec = { data: Record<string, unknown>; updatedAt: number };
export type ListingRec = { id: string; seller: string; sellerName: string; itemKey: string; up: number; price: number; ts: number };
export type PayoutRec = { gold: number; count: number };
export type DbShape = {
  users: Record<string, UserRec>;
  tokens: Record<string, TokenRec>;
  saves: Record<string, SaveRec>;
  market: { nextId: number; listings: Record<string, ListingRec> };
  payouts: Record<string, PayoutRec>;
  rank: Record<string, unknown>;
};

function emptyDb(): DbShape {
  return { users: {}, tokens: {}, saves: {}, market: { nextId: 1, listings: {} }, payouts: {}, rank: {} };
}

/* ---------------- 환경 ---------------- */
const DB_REPO = (process.env.SERTZ_GH_REPO || "apple01234/CERTZ-DB").replace(/^\/+|\/+$/g, "");
const FALLBACK_REPO = "apple01234/CERTZ"; // 이식 전 구 백업 위치 (읽기 폴백만)
const DB_PATH = "db-backup/accounts.enc";
const BRANCH = "main";
const SUPPORT_PATH = "db-backup/support-inbox.json";

function ghToken(): string {
  return (process.env.GITHUB_TOKEN || "").trim();
}

function ghHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${ghToken()}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "sertz-vercel-db",
    ...extra,
  };
}

/* ---------------- SZBK1 암복호화 (accounts/index.js와 바이트 호환) ---------------- */
function backupKey(): Buffer {
  return createHash("sha256").update(process.env.SERTZ_BACKUP_KEY || "sertz-accounts-backup::v1").digest();
}
function backupEncrypt(json: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", backupKey(), iv);
  const enc = Buffer.concat([c.update(json, "utf8"), c.final()]);
  return Buffer.concat([Buffer.from("SZBK1"), iv, c.getAuthTag(), enc]).toString("base64");
}
function backupDecrypt(b64: string): string | null {
  try {
    const raw = Buffer.from(String(b64), "base64");
    if (raw.length < 33 || raw.subarray(0, 5).toString() !== "SZBK1") return null;
    const iv = raw.subarray(5, 17), tag = raw.subarray(17, 33), data = raw.subarray(33);
    const d = createDecipheriv("aes-256-gcm", backupKey(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(data), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/* ---------------- GitHub Contents API ---------------- */
type RawFile = { sha: string | null; enc: string };

async function ghGetFrom(repo: string): Promise<RawFile | null> {
  const r = await fetch(`https://api.github.com/repos/${repo}/contents/${DB_PATH}?ref=${BRANCH}`, {
    headers: ghHeaders(),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`gh GET ${r.status}`);
  const j = (await r.json()) as { sha?: string; content?: string };
  return { sha: j.sha ?? null, enc: j.content ? Buffer.from(j.content, "base64").toString("utf8") : "" };
}

/** 쓰기 결과 — ok(새 sha) 또는 conflict(재시도) */
type PutResult = { ok: true; sha: string } | { ok: false; conflict: boolean; status: number };

async function ghPutRaw(enc: string, sha: string | null): Promise<PutResult> {
  const fileB64 = Buffer.from(enc, "utf8").toString("base64"); // 파일 내용(base64 텍스트)의 재인코딩
  const r = await fetch(`https://api.github.com/repos/${DB_REPO}/contents/${DB_PATH}`, {
    method: "PUT",
    headers: ghHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      message: `accounts db ${new Date().toISOString().slice(0, 16)}`,
      content: fileB64,
      ...(sha ? { sha } : {}),
      branch: BRANCH,
    }),
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
  });
  if (r.ok) {
    const j = (await r.json()) as { content?: { sha?: string }; commit?: { sha?: string } };
    return { ok: true, sha: j.content?.sha ?? j.commit?.sha ?? "" };
  }
  /* 409/422 = sha 충돌(누군가 먼저 씀) — 재시도 대상. 그 외는 진짜 오류 */
  const conflict = r.status === 409 || r.status === 422;
  if (!conflict) console.error(`[SERTZ-db] PUT 실패: ${r.status}`);
  return { ok: false, conflict, status: r.status };
}

/* ---------------- DB 로드/정규화/캐시 ---------------- */
const ADMIN_USERS = (process.env.SERTZ_ADMIN_USERS || "admin,apple01234")
  .split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);

function normalizeDb(db: DbShape): DbShape {
  db.users ||= {};
  db.tokens ||= {};
  db.saves ||= {};
  db.market ||= { nextId: 1, listings: {} };
  db.market.listings ||= {};
  db.payouts ||= {};
  db.rank ||= {};
  /* v1.0.2 계승 — env 관리자 목록 동기화(롤 자동 승격/회수) */
  for (const u of Object.values(db.users)) {
    const shouldAdmin = ADMIN_USERS.includes(String(u.id || "").toLowerCase()) || ADMIN_USERS.includes(String(u.name || "").toLowerCase());
    if (shouldAdmin && u.role !== "admin") u.role = "admin";
    else if (!shouldAdmin && u.role === "admin") u.role = "user";
  }
  return db;
}

function parseDbRaw(raw: RawFile | null): { db: DbShape; sha: string | null } {
  if (!raw || !raw.enc) return { db: emptyDb(), sha: raw?.sha ?? null };
  const json = backupDecrypt(raw.enc);
  if (!json) throw new Error("DB 복호화 실패 — 키 불일치?");
  const parsed = JSON.parse(json) as DbShape;
  return { db: normalizeDb(parsed), sha: raw.sha };
}

type Cache = { db: DbShape; sha: string | null; at: number } | null;
let cache: Cache = null;
const CACHE_TTL_MS = 8000;

/** DB 로드 — force=false면 8초 캐시(공개 읽기 절감), true면 항상 fresh(쓰기 직전 필수) */
export async function loadDb(force = false): Promise<{ db: DbShape; sha: string | null }> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return { db: cache.db, sha: cache.sha };
  if (!ghToken()) throw new Error("GITHUB_TOKEN 미설정 — 서버 설정 오류");
  let raw: RawFile | null = null;
  try {
    raw = await ghGetFrom(DB_REPO);
  } catch (e) {
    /* 전용 저장소 조회 실패 시 구 백업 폴백(읽기만) — 이식 전 전환 안전망 */
    console.error(`[SERTZ-db] ${DB_REPO} 조회 실패 → ${FALLBACK_REPO} 폴백`, e);
    raw = await ghGetFrom(FALLBACK_REPO).catch(() => null);
  }
  /* 전용 저장소가 비어 있고 구 백업이 있으면 이식 (최초 1회 자동 마이그레이션) */
  if (!raw) {
    const legacy = await ghGetFrom(FALLBACK_REPO).catch(() => null);
    if (legacy && legacy.enc) {
      const put = await ghPutRaw(legacy.enc, null);
      if (put.ok) raw = { sha: put.sha, enc: legacy.enc };
      else raw = legacy; // 쓰기 실패해도 읽기는 진행
    }
  }
  const out = parseDbRaw(raw);
  cache = { db: out.db, sha: out.sha, at: Date.now() };
  return out;
}

export type Resp = { status: number; body: unknown; headers?: Record<string, string> };

/**
 * 원자적 변경 — fresh 로드 → mutator(db) 변형/조기응답 → PUT(sha 잠금).
 * mutator가 Resp를 반환하면 쓰기 없이 그대로 응답(검증 실패 등),
 * null을 반환하면 변형 완료로 간주하고 PUT 시도. 충돌 시 재조회→재적용 최대 4회.
 */
export async function mutateDb(fn: (db: DbShape) => Resp | null): Promise<Resp> {
  const busy: Resp = { status: 503, body: { error: "서버가 바빠요 — 잠시 후 다시 시도해 주세요" } };
  for (let i = 0; i < 4; i++) {
    const { db, sha } = await loadDb(true);
    const early = fn(db);
    if (early) return early;
    const put = await ghPutRaw(backupEncrypt(JSON.stringify(db)), sha);
    if (put.ok) {
      cache = { db, sha: put.sha, at: Date.now() };
      /* 성공 응답은 mutator가 클로저로 준비 — 여기선 무해 기본값 */
      return { status: 200, body: { ok: true } };
    }
    if (!put.conflict) return { status: 503, body: { error: "서버 저장에 실패했어요 — 잠시 후 다시 시도" } };
    /* 충돌 — 루프 재조회 */
  }
  return busy;
}

/* ---------------- 지원센터 수집함 (별도 파일 — 계정 DB와 분리해 잠금 경쟁 회피) ---------------- */
export async function appendSupport(rec: unknown): Promise<boolean> {
  if (!ghToken()) return false;
  for (let i = 0; i < 3; i++) {
    const cur = await fetch(`https://api.github.com/repos/${DB_REPO}/contents/${SUPPORT_PATH}?ref=${BRANCH}`, {
      headers: ghHeaders(), signal: AbortSignal.timeout(8000), cache: "no-store",
    }).then((r) => (r.ok ? (r.json() as Promise<{ sha?: string; content?: string }>) : null)).catch(() => null);
    let list: unknown[] = [];
    let sha: string | null = null;
    if (cur && cur.content) {
      sha = cur.sha ?? null;
      try { list = JSON.parse(Buffer.from(cur.content, "base64").toString("utf8")); } catch { list = []; }
      if (!Array.isArray(list)) list = [];
    }
    list.push(rec);
    list = list.slice(-300); // 상한 — 파일 비대화 방지
    const r = await fetch(`https://api.github.com/repos/${DB_REPO}/contents/${SUPPORT_PATH}`, {
      method: "PUT",
      headers: ghHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        message: `support inbox ${new Date().toISOString().slice(0, 16)}`,
        content: Buffer.from(JSON.stringify(list), "utf8").toString("base64"),
        ...(sha ? { sha } : {}),
        branch: BRANCH,
      }),
      signal: AbortSignal.timeout(12000), cache: "no-store",
    });
    if (r.ok) return true;
    if (r.status !== 409 && r.status !== 422) return false;
  }
  return false;
}
