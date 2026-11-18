import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateSave, prepareSave, loadSave, writeSave, SAVE_VERSION, saveMigrationBackupKey, setActiveCharId, SAVE_KEY } from '../src/game/config.ts';
import { createCharacter, readCharSave, setActiveChar, clearActiveChar, loadSlots } from '../src/game/slots.ts';
import { storyQuestReward, recoverStoryQuest, STORY_QUEST_REVISION } from '../src/game/storyQuestMigration.ts';
import { STAGES, QUEST_EXP_MUL } from '../src/game/stages.ts';

function storage() {
  const data = new Map();
  const localStorage = { getItem: key => data.get(key) ?? null,
    setItem(key, value) { data.set(key, String(value)); }, removeItem(key) { data.delete(key); },
    key: at => [...data.keys()][at] ?? null, get length() { return data.size; } };
  globalThis.window = { localStorage, dispatchEvent() {} };
  globalThis.localStorage = localStorage;
  clearActiveChar(); setActiveCharId(null);
  return localStorage;
}
const legacy = () => ({ v: SAVE_VERSION, storyRevision: 'haru-evernote-v1', stage: 'dlcstargate2',
  lastSeen: Date.UTC(2026, 10, 16, 3, 0),
  lv: 130, exp: 3456, maxHp: 2100, atk: 123, cleared: true, playerName: '이어가기',
  gold: 12345, emerald: 67, weapon: 'weapon_1', owned: ['weapon_1', 'armor_1'],
  questIdx: { dlcstargate2: 1, dlcstargate9: 3, lilacworld2x3: 1, park: 2 },
  questAccepted: { dlcstargate2: 1 }, questTracked: 'dlcstargate2',
  huntCount: 5, huntProg: { 'dlcstargate2:dlcstargate2-auto-hunt': 5 }, seen: [] });

test('old partial chain stays active instead of silently completing the replacement objective', () => {
  const save = legacy(), raw = JSON.stringify(save);
  assert.equal(STAGES.dlcstargate2.quests.length, 1, 'old index 1 previously meant no current quest');
  const next = migrateSave(save);
  assert.equal(next.questIdx.dlcstargate2, 0);
  assert.equal(next.questAccepted.dlcstargate2, 0);
  assert.equal(next.huntCount, 0);
  assert.equal(next.questIdx.dlcstargate9, 1, 'old completed chain stays complete');
  assert.equal(next.questIdx.lilacworld2x3, 1, 'defeated Dio stays defeated');
  assert.equal(next.questIdx.park, 2);
  for (const key of ['lv', 'exp', 'maxHp', 'atk', 'gold', 'emerald', 'weapon', 'owned', 'huntProg', 'questTracked']) assert.deepEqual(next[key], save[key], key);
  assert.equal(JSON.stringify(save), raw);
  assert.deepEqual(migrateSave(next), next, 'migration runs only once');
});

test('a 7ac2782 completed objective is distinguished by its authored dialogue, including after reload', () => {
  const save = legacy(); save.seen = ['gpBoundary'];
  const next = migrateSave(save);
  assert.equal(next.questIdx.dlcstargate2, 1);
  assert.equal(next.storyQuestMigration.credits.dlcstargate2, undefined);
  assert.deepEqual(migrateSave(next), next);
});

test('ambiguous one-step saves keep their completion; impossible new indices identify the legacy layout', () => {
  for (const lastSeen of [undefined, Date.UTC(2026, 10, 16, 3, 14, 49), Date.UTC(2026, 10, 17)]) {
    const save = { ...legacy(), lastSeen };
    const next = migrateSave(save);
    assert.deepEqual(next.questIdx, {...save.questIdx, dlcstargate9: 1});
    assert.deepEqual(next.storyQuestMigration.review, ['dlcstargate2']);
    assert.deepEqual(next.storyQuestMigration.credits, {});
  }
});

test('ambiguous recovery is explicit, pays no extra reward and survives revision-one saves', () => {
  const save = legacy(); save.lastSeen = Date.now();
  save.storyQuestMigration = {revision:1, credits:{park:{gold:7,exp:8}}};
  const next = migrateSave(save), before = structuredClone(next);
  assert.equal(next.questIdx.dlcstargate2, 1, 'loading alone cannot reset a completed quest');
  assert.ok(next.storyQuestMigration.review.includes('dlcstargate2'));
  assert.equal(recoverStoryQuest(next.storyQuestMigration, 'park', 100, 200), false);
  assert.equal(recoverStoryQuest(next.storyQuestMigration, 'dlcstargate2', 5180, 1000), true);
  assert.equal(recoverStoryQuest(next.storyQuestMigration, 'dlcstargate2', 5180, 1000), false);
  assert.deepEqual(storyQuestReward(next.storyQuestMigration, 'dlcstargate2', 5180, 1000), {gold:0,exp:0});
  for (const key of ['lv','exp','gold','owned','huntProg','emerald']) assert.deepEqual(next[key],before[key]);
  assert.deepEqual(next.storyQuestMigration.credits.park,{gold:7,exp:8});
  assert.deepEqual(migrateSave(next),next);
});

test('ambiguous save review has a dedicated original backup before revision is written', () => {
  const store=storage(),save=legacy(); save.lastSeen=Date.now();
  const raw=JSON.stringify(save),next=prepareSave(save,'sertz_char_review',raw);
  assert.equal(next.questIdx.dlcstargate2,1);
  assert.equal(store.getItem(saveMigrationBackupKey('quest-layout:sertz_char_review')),raw);
});

test('malformed optional review and reward fields cannot crash a restored character or create NaN money', () => {
  const save={...legacy(),storyQuestMigration:{revision:STORY_QUEST_REVISION,credits:{dlcstargate2:{gold:'invalid',exp:-20}},review:{broken:true}}};
  const next=migrateSave(save);
  assert.deepEqual(next.storyQuestMigration.review,[]);
  assert.equal(recoverStoryQuest(save.storyQuestMigration,'dlcstargate2',10,20),false);
  assert.deepEqual(storyQuestReward(next.storyQuestMigration,'dlcstargate2',10,20),{gold:10,exp:20});
  assert.equal(next.gold,save.gold);
});

test('all collapsed legacy chains preserve completion and remap each unfinished old index', () => {
  const counts = { dlcstargate1:2, dlcstargate2:2, dlcstargate4:2, dlcstargate6:2, dlcstargate8:2, dlcstargate9:3,
    dlcprisma1:2, dlcprisma2:2, dlcprisma4:2, dlcprisma6:2, dlcprisma8:2, dlcprisma9:3,
    dlcreverse1:2, dlcreverse2:2, dlcreverse4:2, dlcreverse6:2, dlcreverse9:3,
    dlcneocity1:2, dlcneocity2:2, dlcneocity6:2, dlcneocity8:2, dlcneocity9:3, lilacworld10x2:2 };
  for (const [stage, count] of Object.entries(counts)) {
    assert.equal(STAGES[stage].quests.length, 1, stage);
    for (let idx = 0; idx <= count; idx++) {
      const next = migrateSave({ ...legacy(), stage, questIdx: { [stage]: idx }, questAccepted: { [stage]: idx - 1 } });
      assert.equal(next.questIdx[stage], idx < count ? 0 : 1, `${stage}: ${idx}`);
      assert.equal(next.questAccepted[stage], idx < count ? -1 : 0, `${stage}: accepted ${idx}`);
    }
  }
});

test('partial rewards already earned are deducted once without reducing existing balances', () => {
  const next = migrateSave(legacy()), q = STAGES.dlcstargate2.quests[0];
  const gold = q.reward ?? 0, exp = Math.round((q.expReward ?? 0) * QUEST_EXP_MUL);
  assert.deepEqual(next.storyQuestMigration.credits.dlcstargate2, { gold: 1536, exp: 43200 });
  assert.deepEqual(storyQuestReward(next.storyQuestMigration, 'dlcstargate2', gold, exp), { gold: Math.max(0, gold - 1536), exp: Math.max(0, exp - 43200) });
  assert.equal(next.storyQuestMigration.credits.dlcstargate2, undefined);
  assert.deepEqual(storyQuestReward(next.storyQuestMigration, 'park', 3, 4), { gold: 3, exp: 4 });
  assert.equal(next.gold, 12345); assert.equal(next.exp, 3456);
});

test('actual persistence boundaries back up the exact old save and preserve credits across slot/write roundtrips', () => {
  const store = storage(), raw = JSON.stringify(legacy()), key = 'sertz_char_a';
  store.setItem(key, raw); setActiveCharId('a');
  store.setItem(saveMigrationBackupKey(key), 'older backup');
  const next = loadSave();
  assert.equal(next.questIdx.dlcstargate2, 0);
  assert.equal(store.getItem(key), raw);
  assert.equal(store.getItem(saveMigrationBackupKey(`quest-layout:${key}`)), raw);
  writeSave(next);
  assert.deepEqual(readCharSave('a').storyQuestMigration, next.storyQuestMigration);
  assert.equal(JSON.parse(store.getItem(SAVE_KEY)).questIdx.dlcstargate2, 0);
  assert.equal(store.getItem(saveMigrationBackupKey(`quest-layout:${key}`)), raw);
  assert.equal(store.getItem(saveMigrationBackupKey(key)), 'older backup');
});

test('a failed migration backup leaves the original untouched; unknown future stories are not remapped', () => {
  const store = storage(), raw = JSON.stringify(legacy());
  store.setItem('sertz_char_a', raw);
  const set = store.setItem;
  store.setItem = (key, value) => { if (key.includes('quest-layout:')) throw Error('quota'); set(key, value); };
  assert.throws(() => prepareSave(legacy(), 'sertz_char_a'), /백업/);
  assert.equal(store.getItem('sertz_char_a'), raw);
  const unknown = migrateSave({ ...legacy(), storyRevision: 'future-story' });
  assert.equal(unknown.questIdx.dlcstargate2, 1);
});

test('creating a second guest persists its stub immediately and cannot replace the first character', () => {
  const store = storage();
  const old = createCharacter('기존캐릭터', null); assert.equal(old.ok, true);
  setActiveChar(old.id); writeSave({ ...old.save, lv: 4 });
  const oldRaw = store.getItem(`sertz_char_${old.id}`);
  const guest = createCharacter('신규게스트', null); assert.equal(guest.ok, true);
  assert.equal(readCharSave(guest.id).playerName, '신규게스트');
  assert.equal(readCharSave(guest.id).lv, 1);
  assert.equal(store.getItem(`sertz_char_${old.id}`), oldRaw);
  clearActiveChar(); setActiveCharId(null);
  const slots = loadSlots(); assert.equal(Object.keys(slots.chars).length, 2);
  setActiveChar(guest.id); const save = loadSave();
  assert.equal(save.playerName, '신규게스트');
  assert.equal(save.storyQuestMigration.revision, STORY_QUEST_REVISION);
  assert.equal(store.getItem(`sertz_char_${old.id}`), oldRaw);
});

/* e713366 — 해롤드 5-4 → 7-3, 베로딘 7-3 → 7-4, 옛 7-4 이동석 수집 삭제, 에스테반 마을(lilacworld5v) 삭제. */
const before7 = (questIdx, extra = {}) => ({ ...legacy(), stage: 'lilacworld6x1', questIdx, questAccepted: {}, ...extra,
  storyQuestMigration: { revision: 2, credits: {}, review: [] } });

test('new chapter 5/7 layout: Harold is the 7-3 boss, Verodin the 7-4 boss, 5-4 a single talk', () => {
  assert.deepEqual(STAGES.lilacworld5x4.quests.map(q => q.type), ['talk']);
  assert.deepEqual(STAGES.lilacworld7x3.quests.map(q => q.type), ['boss', 'reach']);
  assert.deepEqual(STAGES.lilacworld7x4.quests.map(q => q.type), ['boss', 'reach']);
  assert.equal(STAGES.lilacworld5v, undefined);
});

test('deleted 5장 village save resumes at 5-1', () => {
  const next = migrateSave(before7({ lilacworld4x4: 1 }, { stage: 'lilacworld5v' }));
  assert.equal(next.stage, 'lilacworld5x1');
  assert.ok(STAGES[next.stage]);
});

test('Harold killed at old 5-4: fought again at 7-3 without paying the old 5-4 reward twice', () => {
  const next = migrateSave(before7({ lilacworld5x4: 2 }));
  assert.equal(next.questIdx.lilacworld5x4, 1, 'new 5-4 has one objective');
  assert.equal(next.questIdx.lilacworld7x3, undefined);
  assert.deepEqual(next.storyQuestMigration.credits.lilacworld7x3, { gold: 451, exp: 18504 });
  const q = STAGES.lilacworld7x3.quests[0], exp = Math.round(q.expReward * QUEST_EXP_MUL);
  assert.deepEqual(storyQuestReward(next.storyQuestMigration, 'lilacworld7x3', q.reward, exp), { gold: q.reward - 451, exp: exp - 18504 });
  assert.deepEqual(migrateSave(next), next, 'runs once');
});

test('old 7-3 Verodin kill is kept at his new 7-4 arena (no second Verodin)', () => {
  // 7-3에서 베로딘을 잡고 그 자리에 저장 → 해롤드는 같은 자리에서 순서대로, 베로딘은 완료
  const at73 = migrateSave(before7({ lilacworld5x4: 2, lilacworld7x3: 1 }, { stage: 'lilacworld7x3', huntCount: 3 }));
  assert.equal(at73.questIdx.lilacworld7x4, 1);
  assert.equal(at73.questIdx.lilacworld7x3, 0);
  assert.equal(at73.stage, 'lilacworld7x3');
  assert.equal(at73.huntCount, 0);
  assert.ok(at73.storyQuestMigration.credits.lilacworld7x3);
  // 옛 7-4 이동석 수집 중 → 해롤드가 밀린 7-3로 한 칸 돌아가 순서대로 싸운다
  const at74 = migrateSave(before7({ lilacworld5x4: 2, lilacworld7x3: 2, lilacworld7x4: 0 }, { stage: 'lilacworld7x4', questAccepted: { lilacworld7x4: 0 } }));
  assert.deepEqual([at74.questIdx.lilacworld7x3, at74.questIdx.lilacworld7x4, at74.stage], [0, 1, 'lilacworld7x3']);
  assert.equal(at74.questAccepted.lilacworld7x4, undefined, 'old acceptance does not carry to a different objective');
  // 옛 7-4까지 끝냄 → 두 보스 모두 완료, 추가 보상 없음
  const past = migrateSave(before7({ lilacworld5x4: 2, lilacworld7x3: 2, lilacworld7x4: 1, lilacworld7x5: 2 }, { stage: 'lilacworld8x1' }));
  assert.deepEqual([past.questIdx.lilacworld7x3, past.questIdx.lilacworld7x4, past.questIdx.lilacworld7x5], [2, 2, 2]);
  assert.equal(past.storyQuestMigration.credits.lilacworld7x3, undefined);
  assert.equal(past.stage, 'lilacworld8x1');
  // 옛 7-3 베로딘 진행 전 → 새 순서 그대로(해롤드 → 베로딘)
  const fresh = migrateSave(before7({ lilacworld5x4: 2, lilacworld7x3: 0 }, { stage: 'lilacworld7x3' }));
  assert.deepEqual([fresh.questIdx.lilacworld7x3, fresh.questIdx.lilacworld7x4], [0, 0]);
});

test('saves already on the new layout are left alone', () => {
  for (const save of [
    before7({ lilacworld5x4: 1, lilacworld7x3: 2, lilacworld7x4: 2 }, { lastSeen: Date.UTC(2026, 10, 18, 18) }),
    before7({ lilacworld5x4: 1, lilacworld7x3: 1 }, { seen: ['lwKartelArrives'] }),
    before7({ lilacworld5x4: 1 }, { lastSeen: Date.UTC(2026, 10, 18, 18) }),
  ]) {
    const next = migrateSave(save);
    assert.deepEqual(next.questIdx, save.questIdx);
    assert.deepEqual(next.storyQuestMigration.credits, {});
    assert.equal(next.storyQuestMigration.revision, STORY_QUEST_REVISION);
  }
});
