/** Quest layouts collapsed by 7ac2782. Amounts are the rewards actually paid before that commit. */
const DLC_LAYOUT_REVISION = 2;
/** e713366 moved Harold from 5-4 to 7-3 and Verodin from 7-3 to 7-4 (old 7-4 was a warp-stone collect). */
const LILAC_BOSS_ORDER_REVISION = 3;
export const STORY_QUEST_REVISION = LILAC_BOSS_ORDER_REVISION;
const LILAC_BOSS_ORDER_AT = Date.UTC(2026, 10, 18, 15, 21, 35);
/** What the old 5-4 Harold quest paid: gold 451, exp 1542 × QUEST_EXP_MUL 12. */
const OLD_HAROLD_PAID = { gold: 451, exp: 18504 };
export type StoryQuestMigration = { revision: number; credits: Record<string, { gold: number; exp: number }>; review?: string[] };
const LEGACY: Record<string, { dialogue: string; paid: [number, number][] }> = {
  dlcstargate1: { dialogue: "gpDeparture", paid: [[278,1664484],[14300,16609320]] },
  dlcstargate2: { dialogue: "gpBoundary", paid: [[1536,43200],[10375,11912784]] },
  dlcstargate4: { dialogue: "gpRose", paid: [[298,1781976],[1664,46800]] },
  dlcstargate6: { dialogue: "gpDrain", paid: [[1856,50400],[29504,33102432]] },
  dlcstargate8: { dialogue: "gpVirus", paid: [[1984,55200],[21465,23943072]] },
  dlcstargate9: { dialogue: "gpRoseCore", paid: [[2112,57600],[39005,43410540],[420,340560]] },
  dlcprisma1: { dialogue: "gpPrisma", paid: [[307,4127688],[17042,38622636]] },
  dlcprisma2: { dialogue: "gpIris", paid: [[2688,72000],[12345,27658584]] },
  dlcprisma4: { dialogue: "gpTea", paid: [[326,4391160],[2880,75600]] },
  dlcprisma6: { dialogue: "gpJadePlan", paid: [[3136,82800],[35132,76910208]] },
  dlcprisma8: { dialogue: "gpLucyShield", paid: [[3392,90000],[25574,55660812]] },
  dlcprisma9: { dialogue: "gpWaterBlade", paid: [[3584,93600],[46421,100807188],[483,763680]] },
  dlcreverse1: { dialogue: "gpReverse", paid: [[359,26491644],[21910,225073368]] },
  dlcreverse2: { dialogue: "gpElbert", paid: [[7680,204000],[15895,161420688]] },
  dlcreverse4: { dialogue: "gpJennifer", paid: [[378,27934020],[8064,213600]] },
  dlcreverse6: { dialogue: "gpIrisReturn", paid: [[8576,226800],[45162,448139952]] },
  dlcreverse9: { dialogue: "gpRescue", paid: [[9600,254400],[59548,586137708],[583,4180800]] },
  dlcneocity1: { dialogue: "gpNeo", paid: [[390,147419412],[24409,1193683128]] },
  dlcneocity2: { dialogue: "gpFiveSeals", paid: [[10880,288000],[17712,856299516]] },
  dlcneocity6: { dialogue: "gpRavid", paid: [[12032,318000],[50274,2374846776]] },
  dlcneocity8: { dialogue: "gpFestival", paid: [[12672,336000],[36520,1715086860]] },
  dlcneocity9: { dialogue: "gpFalseIris", paid: [[13312,354000],[66260,3104828064],[627,21400800]] },
  lilacworld10x2: { dialogue: "lwSecretRoute", paid: [[758,280524],[0,0]] },
};

type QuestSave = {
  v?: number;
  lastSeen?: number;
  storyRevision?: string;
  storyQuestMigration?: StoryQuestMigration;
  questIdx?: Record<string, number>;
  questAccepted?: Record<string, number>;
  seen?: string[];
  stage: string;
  huntCount?: number;
};

export function migrateStoryQuests<T extends QuestSave>(save: T): T {
  return migrateLilacBossOrder(migrateDlcLayout(save));
}

function migrateDlcLayout<T extends QuestSave>(save: T): T {
  if ((save.storyQuestMigration?.revision ?? 0) >= DLC_LAYOUT_REVISION) {
    const review = save.storyQuestMigration?.review;
    return review === undefined || Array.isArray(review) ? save
      : { ...save, storyQuestMigration: { ...save.storyQuestMigration!, review: [] } };
  }
  if (save.storyRevision && save.storyRevision !== "haru-evernote-v1") return save;
  const next = { ...save, questIdx: { ...save.questIdx }, questAccepted: { ...save.questAccepted },
    storyQuestMigration: { revision: DLC_LAYOUT_REVISION, credits: { ...save.storyQuestMigration?.credits }, review: [] } as StoryQuestMigration };
  const alreadyMigrated = (save.storyQuestMigration?.revision ?? 0) >= 1;
  // Timestamps cannot identify a quest layout after an old character has been played again.
  const legacy = (save.v ?? 0) < 3 || (Number.isFinite(save.lastSeen) && save.lastSeen! > 0 && save.lastSeen! < Date.UTC(2026, 10, 16, 3, 14, 49));
  for (const [stage, old] of Object.entries(LEGACY)) {
    const idx = next.questIdx[stage];
    if (!Number.isInteger(idx) || idx <= 0) continue;
    // 7ac2782 saves have no layout marker either; their new objective dialogue identifies them.
    if (idx === 1 && save.seen?.includes(old.dialogue)) continue;
    if (idx === 1 && (alreadyMigrated || !legacy)) {
      next.storyQuestMigration.review!.push(stage);
      continue;
    }
    next.questIdx[stage] = idx >= old.paid.length ? 1 : 0;
    if (stage in next.questAccepted) next.questAccepted[stage] = next.questAccepted[stage] >= idx ? next.questIdx[stage] : next.questIdx[stage] - 1;
    if (next.questIdx[stage] === 0) {
      next.storyQuestMigration.credits[stage] = old.paid.slice(0, idx).reduce((sum, [gold, exp]) => ({ gold: sum.gold + gold, exp: sum.exp + exp }), { gold: 0, exp: 0 });
      if (save.stage === stage) next.huntCount = 0;
    }
  }
  return next;
}

/** Old order: 5-4 Harold → 7-3 Verodin → 7-4 collect. New order: 5-4 talk → 7-3 Harold → 7-4 Verodin.
 *  No boss is fought twice for pay, the reward Harold now carries is not lost, and the removed 5장 village falls back to 5-1. */
function migrateLilacBossOrder<T extends QuestSave>(save: T): T {
  const m = save.storyQuestMigration;
  if (!m || m.revision >= LILAC_BOSS_ORDER_REVISION) return save;
  const next = { ...save, storyQuestMigration: { ...m, revision: LILAC_BOSS_ORDER_REVISION, credits: { ...m.credits } } };
  if (next.stage === "lilacworld5v") next.stage = "lilacworld5x1";
  const q = save.questIdx ?? {}, seen = save.seen ?? [];
  // A 2 is impossible in the other layout (old 7-4 and new 5-4 have one objective each).
  const newLayout = q.lilacworld7x4 === 2 || seen.includes("lwKartelArrives");
  const oldLayout = q.lilacworld5x4 === 2 || seen.includes("lwWarpStone") || (save.v ?? 0) < 3
    || (Number.isFinite(save.lastSeen) && save.lastSeen! > 0 && save.lastSeen! < LILAC_BOSS_ORDER_AT);
  if (newLayout || !oldLayout) return next;
  const idx = { ...q }, accepted = { ...save.questAccepted };
  const haroldPaid = (q.lilacworld5x4 ?? 0) >= 1;
  if (haroldPaid) idx.lilacworld5x4 = 1;
  const old73 = q.lilacworld7x3, old74 = q.lilacworld7x4;
  if (old73 !== undefined || old74 !== undefined) {
    // Verodin keeps his state at his new arena. Harold counts as done only if the old 7-4 reward he now carries was paid.
    idx.lilacworld7x4 = old74 !== undefined ? (old74 >= 1 ? 2 : 1) : old73!;
    idx.lilacworld7x3 = (old74 ?? 0) >= 1 ? 2 : 0;
    delete accepted.lilacworld7x3; delete accepted.lilacworld7x4;
    // Standing past Harold's new arena with him still pending: go back one zone so he is fought in order.
    if (next.stage === "lilacworld7x4" && idx.lilacworld7x3 === 0) next.stage = "lilacworld7x3";
    if (next.stage === "lilacworld7x3" || next.stage === "lilacworld7x4") next.huntCount = 0;
  }
  if (haroldPaid && idx.lilacworld7x3 !== 2) {
    const c = next.storyQuestMigration.credits.lilacworld7x3 ?? { gold: 0, exp: 0 };
    next.storyQuestMigration.credits.lilacworld7x3 = { gold: c.gold + OLD_HAROLD_PAID.gold, exp: c.exp + OLD_HAROLD_PAID.exp };
  }
  return { ...next, questIdx: idx, questAccepted: accepted };
}

/** Optional recovery replays an ambiguous objective without paying it a second time. */
export function recoverStoryQuest(migration: StoryQuestMigration, stage: string, gold: number, exp: number): boolean {
  if (!Array.isArray(migration.review) || !migration.review.includes(stage)) return false;
  migration.review = migration.review.filter(key => key !== stage);
  migration.credits[stage] = { gold: Math.max(0, gold), exp: Math.max(0, exp) };
  return true;
}

/** A replacement objective pays only the part not already earned on its old chain. */
export function storyQuestReward(migration: StoryQuestMigration, stage: string, gold: number, exp: number) {
  const credit = migration.credits[stage];
  delete migration.credits[stage];
  return { gold: Math.max(0, gold - (Number.isFinite(credit?.gold) ? Math.max(0, credit!.gold) : 0)),
    exp: Math.max(0, exp - (Number.isFinite(credit?.exp) ? Math.max(0, credit!.exp) : 0)) };
}
