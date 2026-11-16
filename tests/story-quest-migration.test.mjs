import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateSave, prepareSave, loadSave, writeSave, SAVE_VERSION, saveMigrationBackupKey, setActiveCharId, SAVE_KEY } from '../src/game/config.ts';
import { createCharacter, readCharSave, setActiveChar, clearActiveChar, loadSlots } from '../src/game/slots.ts';
import { storyQuestReward, STORY_QUEST_REVISION } from '../src/game/storyQuestMigration.ts';
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

test('unmarked saves written since 7ac2782 or without a timestamp keep their progress even if old dialogue aged out', () => {
  for (const lastSeen of [undefined, Date.UTC(2026, 10, 16, 3, 14, 49), Date.UTC(2026, 10, 17)]) {
    const save = { ...legacy(), lastSeen };
    const next = migrateSave(save);
    assert.deepEqual(next.questIdx, save.questIdx);
    assert.deepEqual(next.storyQuestMigration.credits, {});
  }
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
