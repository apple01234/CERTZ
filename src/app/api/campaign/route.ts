import { NextRequest } from "next/server";
import { CAMPAIGN_ID, CHAPTER_BY_ID } from "@/game/campaign/catalog";
import { currentUser, json, options, rateLimit } from "@/lib/sapi";
import { loadDb, mutateDb } from "@/lib/ghdb";
import {
  accountOf,
  applyCampaignAction,
  emptyCampaignStore,
  rankRecords,
  type CampaignRecord,
} from "@/lib/campaignStore";
import { signProof, verifyProof } from "@/game/campaign/receipts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const OPTIONS = options;
function secret() {
  return process.env.CAMPAIGN_SERVER_SECRET ?? "";
}
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("campaignId") !== CAMPAIGN_ID)
    return json(req, 400, { error: "캠페인이 일치하지 않습니다." });
  try {
    const { db } = await loadDb();
    const user = currentUser(db, req);
    const store = db.campaigns?.[CAMPAIGN_ID] ?? emptyCampaignStore();
    return json(req, 200, {
      account: user ? (store.accounts[user.id] ?? null) : null,
      listings: Object.values(store.listings).map((l) => ({
        ...l,
        mine: user?.id === l.seller,
        seller: undefined,
      })),
      records: rankRecords(store),
      onlineReady: secret().length >= 32,
      realtimeUrl: process.env.CAMPAIGN_REALTIME_URL ?? null,
      purchasesReady: !!process.env.GOOGLE_PLAY_SA_JSON,
    });
  } catch {
    return json(req, 503, {
      error:
        "클라우드에 연결할 수 없습니다. 기기 저장은 계속 사용할 수 있습니다.",
    });
  }
}
export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(req, "campaign", 90, 60000))
      return json(req, 429, {
        error: "요청이 너무 많습니다. 잠시 후 다시 시도하세요.",
      });
    const raw = await req.text();
    if (raw.length > 150000)
      return json(req, 413, { error: "저장 크기를 초과했습니다." });
    const body = JSON.parse(raw) as Record<string, unknown>;
    if (body.campaignId !== CAMPAIGN_ID)
      return json(req, 400, { error: "캠페인이 일치하지 않습니다." });
    if (JSON.stringify(body).length > 150000)
      return json(req, 413, { error: "저장 크기를 초과했습니다." });
    const result = await mutateDb((db) => {
      const user = currentUser(db, req);
      if (!user)
        return { status: 401, body: { error: "로그인이 필요합니다." } };
      db.campaigns ??= {};
      const store =
        db.campaigns[CAMPAIGN_ID] ??
        (db.campaigns[CAMPAIGN_ID] = emptyCampaignStore());
      const account = accountOf(store, user.id);
      if (body.action === "ticket") {
        if (secret().length < 32)
          return {
            status: 503,
            body: { error: "실시간 서버가 아직 설정되지 않았습니다." },
          };
        const p = account.characters[String(body.characterId)];
        if (!p)
          return {
            status: 400,
            body: { error: "캐릭터를 클라우드에 먼저 저장하세요." },
          };
        return {
          status: 200,
          body: {
            ticket: signProof(
              {
                uid: user.id,
                characterId: p.characterId,
                name: p.name,
                family: p.family,
                bosses: p.completed.filter((id) => CHAPTER_BY_ID[id]?.boss),
                exp: Date.now() + 30 * 60 * 1000,
              },
              secret(),
            ),
          },
        };
      }
      if (body.action === "claim") {
        const proof = verifyProof<{
          exp: number;
          id: string;
          chapterId: string;
          mode: "solo" | "coop";
          time: number;
          deaths: number;
          members: { uid: string; characterId: string; name: string }[];
        }>(body.receipt, secret());
        if (
          !proof ||
          !CHAPTER_BY_ID[proof.chapterId]?.boss ||
          !["solo", "coop"].includes(proof.mode)
        )
          return {
            status: 400,
            body: { error: "검증할 수 없는 전투 기록입니다." },
          };
        const member = proof.members.find(
            (m) => m.uid === user.id && m.characterId === body.characterId,
          ),
          p = member ? account.characters[member.characterId] : undefined;
        if (!p || !member)
          return {
            status: 403,
            body: { error: "참가자의 기록만 받을 수 있습니다." },
          };
        const claim = `${proof.id}:${p.characterId}`;
        if (account.claimed.includes(claim))
          return { status: 200, body: { account, duplicate: true } };
        p.coins += proof.mode === "coop" ? 45 : 30;
        p.inventory["memory-fragment"] =
          (p.inventory["memory-fragment"] ?? 0) + 1;
        account.claimed.push(claim);
        account.revision++;
        if (!store.settled[proof.id]) {
          store.settled[proof.id] = Date.now();
          store.records.push({
            id: proof.id,
            chapterId: proof.chapterId,
            mode: proof.mode,
            time: proof.time,
            deaths: proof.deaths,
            names: proof.members.map((m) => m.name),
            at: Date.now(),
          } satisfies CampaignRecord);
          store.records = store.records.slice(-2000);
        }
        // Receipts expire in one hour; only expired idempotency entries can be removed.
        for (const [id, at] of Object.entries(store.settled))
          if (Date.now() - at > 7200000) delete store.settled[id];
        account.claimed = account.claimed.filter(
          (c) => store.settled[c.split(":")[0]],
        );
        return { resp: { status: 200, body: { account } } };
      }
      const out = applyCampaignAction(
        store,
        user.id,
        body as unknown as Parameters<typeof applyCampaignAction>[2],
      );
      return out.status === 200
        ? { resp: { status: 200, body: { account: out.account } } }
        : { status: out.status, body: { error: out.error } };
    });
    return json(req, result.status, result.body);
  } catch {
    return json(req, 503, {
      error: "서버 저장에 실패했습니다. 기존 데이터는 유지됩니다.",
    });
  }
}
