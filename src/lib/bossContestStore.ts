/** Existing account DB rank namespace; never treats a client report as a server verified kill. */
export const CONTEST_RULES = { boss: 'guardian', difficulty: 'normal', bossHp: 120000, limitMs: 180000, minMs: 1000 } as const;
export type ContestActor = { id: string; name: string; admin: boolean };
export type ContestEvidence = { bossHp: number; damage: number; hits: number; combatMs: number };
export type ContestAttempt = {
  id: string; contestId: string; uid: string; name: string; preparedAt: number; readyUntil: number;
  startedAt?: number; expiresAt?: number; finishedAt?: number; elapsedMs?: number;
  state: 'ready' | 'running' | 'pending' | 'approved' | 'rejected' | 'failed' | 'abandoned' | 'expired';
  evidence?: ContestEvidence; reviewedAt?: number; reviewedBy?: string; reviewNote?: string;
  awardedAt?: number; awardedBy?: string; awardNote?: string;
};
export type BossContest = {
  id: string; title: string; prize: string; places: number; startsAt: number; endsAt: number;
  createdBy: string; finalizedAt?: number; finalizedBy?: string;
  rules: typeof CONTEST_RULES; attempts: Record<string, ContestAttempt>;
};
export type BossContestStore = { contests: Record<string, BossContest> };
export type ContestView = Omit<BossContest, 'attempts'> & {
  official: (ContestAttempt & { rank: number })[]; attempts: ContestAttempt[];
};
export type ContestSnapshot = { admin: boolean; userId: string; serverNow: number; contests: ContestView[] };
export class ContestError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
function demand(value: unknown, message: string, status = 400): asserts value {
  if (!value) throw new ContestError(message, status);
}
function textField(value: unknown, max: number): string {
  demand(typeof value === 'string', '문자열 입력이 필요해요');
  const v = value.trim();
  demand(v.length > 0 && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v), `입력은 1~${max}자예요`);
  return v;
}
function attemptState(a: ContestAttempt, now: number): ContestAttempt['state'] {
  return (a.state === 'ready' && now > a.readyUntil) || (a.state === 'running' && now > (a.expiresAt ?? 0)) ? 'expired' : a.state;
}
function official(c: BossContest) {
  const sorted = Object.values(c.attempts).filter(a => a.state === 'approved').sort((a, b) => a.elapsedMs! - b.elapsedMs! || a.id.localeCompare(b.id));
  let rank = 0;
  return sorted.map((a, i) => { if (i === 0 || a.elapsedMs !== sorted[i - 1].elapsedMs) rank = i + 1; return { ...a, rank }; });
}
export function contestSnapshot(store: BossContestStore, actor: ContestActor, now: number): ContestSnapshot {
  return { admin: actor.admin, userId: actor.id, serverNow: now, contests: Object.values(store.contests).sort((a, b) => b.startsAt - a.startsAt).map(c => ({
    ...c, createdBy: actor.admin ? c.createdBy : "", finalizedBy: actor.admin ? c.finalizedBy : undefined,
    official: official(c).map(a => actor.admin || a.uid === actor.id ? a : {
      id: a.id, contestId: a.contestId, uid: "", name: [...a.name][0] + "***", preparedAt: 0, readyUntil: 0,
      startedAt: a.startedAt, finishedAt: a.finishedAt, elapsedMs: a.elapsedMs, state: a.state, rank: a.rank, awardedAt: a.awardedAt,
    }),
    attempts: Object.values(c.attempts).filter(a => actor.admin || a.uid === actor.id).map(a => ({ ...a, state: attemptState(a, now) })),
  })) };
}
/** Mutates only the CAS transaction copy. IDs and time come exclusively from the API server. */
export function contestAction(store: BossContestStore, actor: ContestActor, b: Record<string, unknown>, now: number, newId: string): { attempt?: ContestAttempt; contestId?: string } {
  const action = b.action;
  if (['create', 'review', 'finalize', 'award'].includes(String(action))) demand(actor.admin, '관리자 권한이 필요해요', 403);
  const fields: Record<string, string[]> = {
    create: ['title', 'prize', 'places', 'minutes'], prepare: ['contestId'], start: ['contestId', 'attemptId'],
    finish: ['contestId', 'attemptId', 'outcome', 'evidence'], review: ['contestId', 'attemptId', 'decision', 'note'],
    finalize: ['contestId'], award: ['contestId', 'attemptId', 'note'],
  };
  demand(typeof action === 'string' && fields[action], '잘못된 대회 동작이에요');
  demand(Object.keys(b).every(k => k === 'action' || fields[action].includes(k)), '허용되지 않은 대회 입력이에요');
  if (action === 'create') {
    const title = textField(b.title, 50), prize = textField(b.prize, 100);
    demand(Number.isInteger(b.places) && Number(b.places) >= 1 && Number(b.places) <= 10, '수상 순위는 1~10위예요');
    demand(Number.isInteger(b.minutes) && Number(b.minutes) >= 5 && Number(b.minutes) <= 1440, '개최 시간은 5~1440분이에요');
    demand(Object.values(store.contests).filter(c => !c.finalizedAt).length < 10, '진행 대회를 먼저 마감해 주세요');
    store.contests[newId] = { id: newId, title, prize, places: Number(b.places), startsAt: now, endsAt: now + Number(b.minutes) * 60000, createdBy: actor.id, rules: { ...CONTEST_RULES }, attempts: {} };
    return { contestId: newId };
  }
  const contestId = textField(b.contestId, 80);
  const c = store.contests[contestId]; demand(c, '대회를 찾을 수 없어요', 404);
  if (action === 'prepare') {
    demand(!actor.admin, '운영자는 참가할 수 없어요', 403);
    demand(!c.finalizedAt && now >= c.startsAt && now + c.rules.limitMs + 30000 <= c.endsAt, '접수가 마감됐어요', 409);
    demand(!Object.values(c.attempts).some(a => a.uid === actor.id), '한 계정은 대회마다 한 번만 출전해요', 409);
    demand(Object.keys(c.attempts).length < 200, '참가 정원이 찼어요', 409);
    const a: ContestAttempt = { id: newId, contestId, uid: actor.id, name: actor.name, state: 'ready', preparedAt: now, readyUntil: now + 30000 };
    c.attempts[newId] = a;
    return { attempt: a };
  }
  if (action === 'finalize') {
    demand(!c.finalizedAt, '이미 확정된 대회예요', 409);
    const states = Object.values(c.attempts).map(a => attemptState(a, now));
    demand(!states.some(s => s === 'ready' || s === 'running'), '진행 중인 출전이 끝난 뒤 확정해 주세요', 409);
    demand(!states.includes('pending'), '승인 대기 기록을 모두 검토해 주세요', 409);
    c.finalizedAt = now; c.finalizedBy = actor.id; return {};
  }
  const a = c.attempts[textField(b.attemptId, 80)]; demand(a, '출전 기록이 없어요', 404);
  if (action === 'start' || action === 'finish') demand(a.uid === actor.id, '본인의 출전 기록만 제출할 수 있어요', 403);
  demand(!c.finalizedAt || action === 'award', '순위가 확정된 대회예요', 409);
  if (action === 'start') {
    demand(a.state === 'ready' && now <= a.readyUntil && now + c.rules.limitMs <= c.endsAt, '준비 시간이 지났거나 이미 시작했어요', 409);
    a.state = 'running'; a.startedAt = now; a.expiresAt = now + c.rules.limitMs; return { attempt: a };
  }
  if (action === 'finish') {
    demand(a.state === 'running' || (a.state === 'ready' && b.outcome === 'abandoned'), '이미 제출했거나 시작하지 않은 출전이에요', 409);
    demand(['defeated', 'failed', 'abandoned'].includes(String(b.outcome)), '결과를 확인해 주세요');
    if (b.outcome === 'defeated') {
      const e = b.evidence as ContestEvidence | undefined;
      const elapsed = now - (a.startedAt ?? now);
      demand(elapsed >= c.rules.minMs && now <= (a.expiresAt ?? 0) && now <= c.endsAt, '제출 시간이 허용 범위를 벗어났어요');
      demand(e && typeof e === 'object' && Object.keys(e).every(k => ['bossHp', 'damage', 'hits', 'combatMs'].includes(k)), '처치 근거가 필요해요');
      demand(Number.isFinite(e.combatMs) && e.combatMs >= c.rules.minMs && e.combatMs <= elapsed && elapsed - e.combatMs <= 15000, '전투 시간이 서버 시간과 맞지 않아요');
      demand(e.bossHp === 0 && Number.isFinite(e.damage) && e.damage >= c.rules.bossHp && e.damage <= c.rules.bossHp * 1000 && Number.isInteger(e.hits) && e.hits >= 1 && e.hits <= 100000, '보스 처치 근거를 확인해 주세요');
      // ponytail: client evidence can be forged; server combat authority is required before automatic prize approval.
      a.evidence = { bossHp: 0, damage: e.damage, hits: e.hits, combatMs: e.combatMs };
      a.elapsedMs = elapsed; a.state = 'pending';
    } else { a.state = b.outcome === 'failed' ? 'failed' : 'abandoned'; }
    a.finishedAt = now; return { attempt: a };
  }
  if (action === 'review') {
    demand(a.state === 'pending', '승인 대기 기록만 검토할 수 있어요', 409);
    demand(b.decision === 'approved' || b.decision === 'rejected', '승인 또는 거절을 선택해 주세요');
    a.reviewNote = textField(b.note, 120); a.reviewedAt = now; a.reviewedBy = actor.id; a.state = b.decision; return {};
  }
  demand(action === 'award' && c.finalizedAt, '대회 순위를 먼저 확정해 주세요', 409);
  demand(a.state === 'approved' && official(c).some(r => r.id === a.id && r.rank <= c.places), '수상 대상 공식 기록만 지급 처리할 수 있어요', 409);
  demand(!a.awardedAt, '이미 지급 처리된 경품이에요', 409);
  a.awardNote = textField(b.note, 120); a.awardedAt = now; a.awardedBy = actor.id; return {};
}

/** vc283 후속 — 결과 제출 재전송(순수 함수 — 클라이언트 bossContest.ts 가 쓴다).
 *  응답 없는 실패(네트워크·타임아웃, status 없음)와 5xx 만 재전송하고 4xx 거절은 즉시 던진다.
 *  끊긴 요청이 실제로는 접수돼 재전송이 409 로 돌아오면 null(이미 접수됨)을 돌려준다. */
export async function submitWithRetry<T>(send: () => Promise<T>, waits: readonly number[],
  sleep: (ms: number) => Promise<unknown> = ms => new Promise(r => setTimeout(r, ms))): Promise<T | null> {
  let failure: unknown, unanswered = false;
  for (const wait of waits) {
    if (wait) await sleep(wait);
    try { return await send(); } catch (e) {
      failure = e;
      const status = (e as { status?: unknown }).status;
      if (typeof status !== 'number') { unanswered = true; continue; }
      if (status === 409 && unanswered) return null;
      if (status < 500) break;
    }
  }
  throw failure;
}
