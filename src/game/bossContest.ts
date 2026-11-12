'use client';
import { getAuthToken } from './account';
import { resolveApiBase } from './server';
import { EventBus } from '@/components/game/EventBus';
import { notice } from './fx/Notice';
import { CONTEST_RULES, submitWithRetry, type ContestAttempt, type ContestEvidence, type ContestSnapshot } from '../lib/bossContestStore';
export { CONTEST_RULES };
export type { ContestAttempt, ContestEvidence, ContestSnapshot, ContestView } from '../lib/bossContestStore';
export type ContestStart = { attemptId: string; contestId: string } & typeof CONTEST_RULES;
let active: ContestAttempt | null = null;
let submitting = false;
export function activeBossContest() { return active; }
export async function contestRequest(body?: Record<string, unknown>, timeoutMs = 25000): Promise<Record<string, unknown>> {
  const token = getAuthToken();
  const r = await fetch(`${resolveApiBase()}/api/contest`, {
    method: body ? 'POST' : 'GET', cache: 'no-store', credentials: 'include',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'text/plain;charset=UTF-8' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || '대회 서버 응답을 확인해 주세요'), { status: r.status });
  return data;
}
export async function fetchBossContests(): Promise<ContestSnapshot> {
  return await contestRequest() as unknown as ContestSnapshot;
}
export async function prepareBossContest(contestId: string): Promise<ContestAttempt> {
  if (active || submitting) throw new Error('이미 준비하거나 진행 중인 출전이 있어요');
  submitting = true;
  try {
    const r = await contestRequest({ action: 'prepare', contestId });
    active = r.attempt as ContestAttempt;
    EventBus.emit('contest:start', { attemptId: active.id, contestId, ...CONTEST_RULES } satisfies ContestStart);
    return active;
  } finally { submitting = false; }
}
export async function startBossContest(attemptId: string): Promise<{ startedAt: number; expiresAt: number }> {
  if (!active || active.id !== attemptId) throw new Error('준비한 출전을 찾을 수 없어요');
  const r = await contestRequest({ action: 'start', contestId: active.contestId, attemptId });
  active = r.attempt as ContestAttempt;
  EventBus.emit('contest:update');
  return { startedAt: active.startedAt!, expiresAt: active.expiresAt! };
}
/** vc283 후속 — 결과 제출. 네트워크 실패는 결과를 쥔 채 재전송한다(submitWithRetry).
 *  ponytail: 서버가 제출 시각으로 기록을 재므로(처치 제출은 전투 종료 후 15초 이내만 인정)
 *  재전송 창은 그 안쪽 ~12초뿐이다. 더 긴 단절까지 살리려면 서버 권위 전투가 필요하다. */
const FINISH_RETRY_MS = [0, 1500, 3000, 4000, 4000];
export async function finishBossContest(outcome: 'defeated' | 'failed' | 'abandoned', evidence?: ContestEvidence): Promise<void> {
  if (!active) return;
  const a = active;
  const body = { action: 'finish', contestId: a.contestId, attemptId: a.id, outcome, ...(evidence ? { evidence } : {}) };
  try {
    const r = await submitWithRetry(() => contestRequest(body, 5000), FINISH_RETRY_MS);
    if (r) EventBus.emit('contest:finished', r.attempt);
  } catch (e) {
    /* 서버가 받지 않았다 — 실패를 숨기지 않는다. */
    notice(outcome === 'defeated'
      ? `기록 제출 실패 — ${e instanceof Error ? e.message : '서버 연결을 확인해 주세요'}`
      : '기록전 결과를 서버에 전하지 못했어요 (서버가 시간 만료로 처리해요)', 6000);
    throw e;
  } finally {
    /* 서버 응답(또는 재전송 소진)을 확인한 뒤에만 출전 상태를 푼다 — 다음 대회 준비를 막지 않게. */
    if (active === a) active = null;
    EventBus.emit('contest:update');
  }
}
