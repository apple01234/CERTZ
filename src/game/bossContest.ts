'use client';
import { getAuthToken } from './account';
import { resolveApiBase } from './server';
import { EventBus } from '@/components/game/EventBus';
import { CONTEST_RULES, type ContestAttempt, type ContestEvidence, type ContestSnapshot } from '../lib/bossContestStore';
export { CONTEST_RULES };
export type { ContestAttempt, ContestEvidence, ContestSnapshot, ContestView } from '../lib/bossContestStore';
export type ContestStart = { attemptId: string; contestId: string } & typeof CONTEST_RULES;
let active: ContestAttempt | null = null;
let submitting = false;
export function activeBossContest() { return active; }
export async function contestRequest(body?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const token = getAuthToken();
  const r = await fetch(`${resolveApiBase()}/api/contest`, {
    method: body ? 'POST' : 'GET', cache: 'no-store', credentials: 'include',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'text/plain;charset=UTF-8' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(25000),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || '대회 서버 응답을 확인해 주세요');
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
export async function finishBossContest(outcome: 'defeated' | 'failed' | 'abandoned', evidence?: ContestEvidence): Promise<void> {
  if (!active) return;
  const a = active;
  const r = await contestRequest({ action: 'finish', contestId: a.contestId, attemptId: a.id, outcome, ...(evidence ? { evidence } : {}) });
  active = null;
  EventBus.emit('contest:finished', r.attempt);
  EventBus.emit('contest:update');
}
