/**
 * v1.4.26 — 릴레이 DB 계층 (채팅·파티 전용 — GitHub-as-DB 별도 파일)
 *
 *  배경: ②안에서 소켓 멀티서버가 제거되어 채팅/파티가 죽었다. Vercel serverless에서
 *  WebSocket 불가 → HTTP 폴링 릴레이로 부활시킨다. 채팅/파티는 계정 DB(accounts.enc)와
 *  잠금 경쟁을 피해야 하므로(appendSupport 선례) 별도 파일로 저장한다:
 *   - db-backup/relay-chat.json   { global: Msg[], party: {code: Msg[]} }
 *   - db-backup/relay-parties.json { parties: {code: Party} }
 *  - 평문 JSON (민감정보 없음 — 닉네임·메시지·파티 명단)
 *  - 정합성: fresh GET(sha) → mutate → PUT(sha 낙관 잠금) → 409/422 재시도 (ghdb 동일)
 *  - 읽기 캐시: 파일별 인스턴스 메모리 TTL (폴링 GET 폭주 완화 — 엣지 캐시와 이중 방어)
 */

const DB_REPO = (process.env.SERTZ_GH_REPO || "apple01234/CERTZ-DB").replace(/^\/+|\/+$/g, "");
const BRANCH = "main";

function ghToken(): string {
  return (process.env.GITHUB_TOKEN || "").trim();
}

function ghHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${ghToken()}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "sertz-vercel-relay",
    ...extra,
  };
}

type PutResult = { ok: true; sha: string } | { ok: false; conflict: boolean; status: number };

/* v1.0.16 — 저장소 접근 실패를 "데이터 없음"과 구분한다.
 *  종전엔 loadRelay가 어떤 실패든 data:null을 돌려주고 라우트가 그걸 빈 목록으로 반환해서,
 *  GITHUB_TOKEN이 죽어도 화면상 "채팅이 아직 없다"와 구분되지 않았다.
 *  실제로 2026-10-17 토큰 무효 장애가 하루 동안 이 위장에 가려졌다(ghdb만 500으로 드러남).
 *  파일이 아직 없는 404(부트스트랩)는 정상 상태이므로 계속 null로 진행한다. */
export class RelayAccessError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "RelayAccessError";
    this.status = status;
  }
}

async function relayGet(path: string): Promise<{ sha: string | null; json: unknown } | null> {
  const r = await fetch(`https://api.github.com/repos/${DB_REPO}/contents/${path}?ref=${BRANCH}`, {
    headers: ghHeaders(),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (r.status === 404) return { sha: null, json: null };
  if (!r.ok) throw new RelayAccessError(`relay GET ${path} ${r.status}`, r.status);
  const j = (await r.json()) as { sha?: string; content?: string };
  let json: unknown = null;
  if (j.content) {
    try { json = JSON.parse(Buffer.from(j.content, "base64").toString("utf8")); } catch { json = null; }
  }
  return { sha: j.sha ?? null, json };
}

async function relayPut(path: string, data: unknown, sha: string | null): Promise<PutResult> {
  const r = await fetch(`https://api.github.com/repos/${DB_REPO}/contents/${path}`, {
    method: "PUT",
    headers: ghHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      message: `relay ${path.split("/").pop()} ${new Date().toISOString().slice(0, 16)}`,
      content: Buffer.from(JSON.stringify(data), "utf8").toString("base64"),
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
  const conflict = r.status === 409 || r.status === 422;
  if (!conflict) console.error(`[SERTZ-relay] PUT 실패 ${path}: ${r.status}`);
  return { ok: false, conflict, status: r.status };
}

/* ---------------- 파일별 읽기 캐시 (폴링 GET 절감) ---------------- */
type CacheEnt = { json: unknown; sha: string | null; at: number };
const caches = new Map<string, CacheEnt>();

export async function loadRelay<T>(path: string, ttlMs = 6000): Promise<{ data: T | null; sha: string | null }> {
  const c = caches.get(path);
  if (c && Date.now() - c.at < ttlMs) return { data: c.json as T, sha: c.sha };
  if (!ghToken()) throw new Error("GITHUB_TOKEN 미설정");
  const raw = await relayGet(path);
  const ent: CacheEnt = { json: raw?.json ?? null, sha: raw?.sha ?? null, at: Date.now() };
  caches.set(path, ent);
  return { data: ent.json as T, sha: ent.sha };
}

export type RelayResp = { status: number; body: unknown; headers?: Record<string, string> };

/**
 * 원자적 변경 — fresh 로드 → mutator(조기응답은 Resp 반환 / 변경 완료는 null) → PUT.
 * 409/422 충돌 시 재조회→재적용 최대 4회 (ghdb.mutateDb 동일 전략).
 */
export async function mutateRelay<T>(path: string, fn: (data: T) => RelayResp | null): Promise<RelayResp> {
  const busy: RelayResp = { status: 503, body: { error: "서버가 바빠요 — 잠시 후 다시 시도해 주세요" } };
  for (let i = 0; i < 4; i++) {
    const { data, sha } = await loadRelay<T>(path, 0); // 쓰기 전엔 항상 fresh
    /* v1.4.27-w2 픽스 (#릴레이null) — 파일이 없으면 data가 null로 들어왔고, 라우트 mutator가
     * '새 객체 생성'으로 빠져 그 객체에 추가한 뒤 원본(null)이 PUT돼 파일이 리터럴 null로
     * 덮여써졌다 (POST ok:true인데 GET이 빈 목록이던 근원). → null/비객체를 빈 객체로 치환해
     * 전달하고, PUT도 전달한 그 참조를 쓴다. mutator는 전달받은 객체를 제자리 변경해야 한다. */
    const cur = ((data && typeof data === "object" ? data : {}) as T);
    const early = fn(cur);
    if (early) return early;
    const put = await relayPut(path, cur, sha);
    if (put.ok) {
      caches.set(path, { json: cur, sha: put.sha, at: Date.now() });
      return { status: 200, body: { ok: true } };
    }
    if (!put.conflict) return { status: 503, body: { error: "서버 저장에 실패했어요 — 잠시 후 다시 시도" } };
  }
  return busy;
}

/* ---------------- 데이터 형태 ---------------- */
export type RelayChatMsg = {
  id: string;
  name: string;
  text: string;
  cls?: string;
  lv?: number;
  t: number;
};
export type RelayChatFile = {
  global: RelayChatMsg[];
  party: Record<string, RelayChatMsg[]>;
};
export type RelayPartyMember = {
  name: string;
  lv: number;
  cls: string;
  seenAt: number;
  joinedAt: number;
  /* v1.0.16 보안(S8) — 서버 발급 비밀. 본인 작업(leave·beat) 증명에 쓴다.
   *  응답으로는 절대 내보내지 않는다(snapshot 참조). 없으면 본인 확인 불가로 간주. */
  seat?: string;
};
export type RelayParty = {
  code: string;
  leader: string; // cid
  members: Record<string, RelayPartyMember>; // key = cid
  createdAt: number;
};
export type RelayPartyFile = {
  parties: Record<string, RelayParty>;
};

export function emptyChat(): RelayChatFile {
  return { global: [], party: {} };
}
export function emptyParties(): RelayPartyFile {
  return { parties: {} };
}

export const CHAT_PATH = "db-backup/relay-chat.json";
export const PARTY_PATH = "db-backup/relay-parties.json";

/* 상수 — 라우트와 공유 */
export const CHAT_KEEP = 50; // 채널별 보관 상한
export const PARTY_CHAT_KEEP = 40;
export const PARTY_CHAT_TTL_MS = 6 * 3600 * 1000; // 파티 채널 메시지 6시간 경과 시 파기
export const PARTY_STALE_MS = 24 * 3600 * 1000; // 전 멤버 24시간 무활동 파티 청소
export const PARTY_ONLINE_MS = 5 * 60 * 1000; // seenAt 기준 온라인 판정
export const PARTY_MAX = 4;
