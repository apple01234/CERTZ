import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { loadDb, mutateDb, type DbShape } from '@/lib/ghdb';
import { currentUser, isAdminUser, json, options, rateLimit } from '@/lib/sapi';
import { contestAction, contestSnapshot, ContestError, type BossContestStore } from '@/lib/bossContestStore';

export function OPTIONS(req: NextRequest) { return options(req); }
function storeOf(db: DbShape): BossContestStore {
  return (db.rank.bossContestsV1 ?? { contests: {} }) as BossContestStore;
}
export async function GET(req: NextRequest) {
  try {
    const { db } = await loadDb(true);
    const me = currentUser(db, req);
    if (!me) return json(req, 401, { error: '보스 기록전은 로그인이 필요해요' });
    return json(req, 200, contestSnapshot(storeOf(db), { id: me.id, name: me.name, admin: isAdminUser(me) }, Date.now()));
  } catch (e) { console.error('[contest] read', e); return json(req, 503, { error: '대회 서버에 연결할 수 없어요' }); }
}
export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(req, 'contest', 40, 60000)) return json(req, 429, { error: '잠시 뒤 다시 시도해 주세요' });
    const raw = await req.text();
    if (raw.length > 4096) return json(req, 413, { error: '대회 입력이 너무 커요' });
    let b: Record<string, unknown>;
    try { b = JSON.parse(raw); } catch { return json(req, 400, { error: '대회 입력 형식이 잘못됐어요' }); }
    if (!b || typeof b !== 'object' || Array.isArray(b)) return json(req, 400, { error: '대회 입력을 확인해 주세요' });
    const newId = randomUUID();
    const r = await mutateDb(db => {
      const me = currentUser(db, req);
      if (!me) return { status: 401, body: { error: '보스 기록전은 로그인이 필요해요' } };
      const store = storeOf(db);
      try {
        const result = contestAction(store, { id: me.id, name: me.name, admin: isAdminUser(me) }, b, Date.now(), newId);
        db.rank.bossContestsV1 = store;
        return { resp: { status: 200, body: { ok: true, ...result } } };
      } catch (e) {
        if (e instanceof ContestError) return { status: e.status, body: { error: e.message } };
        throw e;
      }
    });
    return json(req, r.status, r.body);
  } catch (e) { console.error('[contest] write', e); return json(req, 503, { error: '대회 기록을 저장하지 못했어요. 다시 시도해 주세요' }); }
}
