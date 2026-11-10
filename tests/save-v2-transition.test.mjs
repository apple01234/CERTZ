import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateSave, prepareSave, loadSave, writeSave, setActiveCharId, saveMigrationBackupKey, SAVE_KEY, SAVE_VERSION } from '../src/game/config.ts';
import { readCharSave, importCloudSave, collectLocalChars, clearActiveChar, SLOTS_KEY } from '../src/game/slots.ts';
import { STORY_REVISION } from '../src/game/storyRevision.ts';
import { skillMasteryProgress, migrateLegacySkillMastery } from '../src/game/skillMastery.ts';

const base = () => ({ stage: 'youngprincessv', lv: 60, exp: 9, maxHp: 400, atk: 70, cleared: false,
  playerName: '수련검증', cls: 'berserker', gold: 987, emerald: 23, owned: ['weapon_1'],
  questIdx: { howlrstone1x1: 2, dojang: 1 }, youngPrincessCleared: true, skillMastery: { solar: 100, life: 200 } });

function storage() {
  const data = new Map(), events = [];
  const store = { denyBackup: false, getItem: key => data.get(key) ?? null,
    setItem(key, value) { if (this.denyBackup && key.startsWith('sertz:migration-backup:')) throw Error('quota'); data.set(key, value); },
    removeItem: key => data.delete(key), key: index => [...data.keys()][index] ?? null, get length() { return data.size; } };
  globalThis.window = { localStorage: store, dispatchEvent: event => events.push(event) };
  globalThis.localStorage = store;
  clearActiveChar(); setActiveCharId(null);
  return { store, data, events };
}

test('nonlinear boundaries and legacy conversion keep earned levels and fractions', () => {
  const thresholds = [0, 5, 13, 25, 41, 61, 96, 151, 231, 341, 491];
  thresholds.forEach((n, level) => assert.equal(skillMasteryProgress(n).level, level));
  for (let level = 0; level < 10; level++) {
    assert.equal(skillMasteryProgress(thresholds[level + 1] - 1).level, level);
    assert.equal(skillMasteryProgress(thresholds[level + 1] - 1).usesToNext, 1);
  }
  assert.deepEqual(migrateLegacySkillMastery({ solar: 19, life: 20, lightning: 39, art: 100, shadow: 200 }),
    { solar: 4, life: 5, lightning: 12, art: 61, shadow: 491 });
  assert.equal(skillMasteryProgress(Infinity).uses, 0);
  assert.equal(skillMasteryProgress(999999).powerBonusPct, 20);
});

test('unknown/unmarked story preserves progress; only explicit compatible legacy resets story before hub routing', () => {
  const original = base(), raw = JSON.stringify(original);
  for (const revision of [undefined, STORY_REVISION, 'unknown-story']) {
    const next = migrateSave({ ...original, storyRevision: revision });
    assert.equal(next.stage, 'dlcstargatev'); assert.equal(next.youngPrincessCleared, true);
    assert.deepEqual(next.questIdx, original.questIdx); assert.equal(next.gold, 987);
    assert.deepEqual(next.skillMastery, { solar: 61, life: 491 }); assert.equal(next.v, 2);
    assert.deepEqual(migrateSave(next), next);
  }
  const old = migrateSave({ ...original, storyRevision: 'memory-oath-v1', storyChoices: { old: 'choice' } });
  assert.equal(old.stage, 'village'); assert.equal(old.youngPrincessCleared, false);
  assert.deepEqual(old.questIdx, { dojang: 1 }); assert.deepEqual(old.storyChoices, {});
  assert.equal(old.gold, original.gold); assert.equal(old.cls, original.cls);
  assert.equal(JSON.stringify(original), raw);
  assert.equal(migrateSave({ ...original, youngPrincessCleared: false }).stage, 'village');
});

test('actual load/write/slot roundtrip backs original once and never converts v2 a second time', () => {
  const { store } = storage(), original = base(), raw = JSON.stringify(original), key = 'sertz_char_test';
  store.setItem(key, raw); setActiveCharId('test');
  const save = loadSave(); assert.equal(save.v, SAVE_VERSION); assert.equal(save.skillMastery.solar, 61);
  assert.equal(store.getItem(key), raw); assert.equal(store.getItem(saveMigrationBackupKey(key)), raw);
  writeSave(save);
  assert.equal(readCharSave('test').skillMastery.solar, 61);
  assert.equal(loadSave().skillMastery.life, 491);
  assert.equal(JSON.parse(store.getItem(SAVE_KEY)).v, 2);
  assert.equal(store.getItem(saveMigrationBackupKey(key)), raw);
});

test('all character snapshots and explicit cloud restore use the same migration', () => {
  const { store } = storage(), old = base(), raw = JSON.stringify(old);
  store.setItem('sertz_char_a', raw); store.setItem('sertz_char_b', JSON.stringify({ ...old, playerName: '다른검증', skillMastery: { solar: 20 } }));
  store.setItem(SLOTS_KEY, JSON.stringify({ v: 1, slots: 8, activeId: null, chars: {
    a: { id: 'a', name: old.playerName, lv: 60 }, b: { id: 'b', name: '다른검증', lv: 60 } } }));
  const all = collectLocalChars(); assert.equal(all[old.playerName].skillMastery.solar, 61); assert.equal(all['다른검증'].skillMastery.solar, 5);
  const restored = importCloudSave({ ...old, storyRevision: 'memory-oath-v1' });
  assert.equal(restored.ok, true); assert.equal(readCharSave(restored.id).stage, 'village');
  assert.equal(store.getItem(saveMigrationBackupKey('restore:sertz_char_a')), raw);
});

test('backup quota and future saves cannot overwrite originals or enter through slot restore', () => {
  const { store, events } = storage(), raw = JSON.stringify(base()), key = 'sertz_char_a';
  store.setItem(key, raw); setActiveCharId('a'); store.denyBackup = true;
  assert.equal(loadSave(), null); assert.equal(store.getItem(key), raw);
  assert.throws(() => prepareSave(base(), key), /백업/);
  const restored = importCloudSave(base()); assert.equal(restored.ok, false); assert.equal(store.getItem(key), raw);
  assert.ok(events.some(e => e.detail?.reason.includes('백업')));
  store.denyBackup = false;
  const future = JSON.stringify({ ...base(), v: 3 }); store.setItem(key, future);
  assert.equal(readCharSave('a'), null); writeSave({ ...base(), v: 2 });
  assert.equal(store.getItem(key), future);
});

test('an unreadable character aborts whole snapshot; a failed legacy mirror does not misreport a successful restore', () => {
  const { store, events } = storage(), raw = JSON.stringify(base());
  store.setItem('sertz_char_a', raw); store.setItem('sertz_char_b', JSON.stringify({ ...base(), playerName: '미래검증', v: 3 }));
  store.setItem(SLOTS_KEY, JSON.stringify({ v: 1, slots: 8, activeId: null, chars: {
    a: { id: 'a', name: '수련검증', lv: 60 }, b: { id: 'b', name: '미래검증', lv: 60 } } }));
  assert.throws(() => collectLocalChars(), /전체 클라우드 백업/);
  const originalSet = store.setItem.bind(store);
  store.setItem = (key, value) => { if (key === SAVE_KEY) throw Error('mirror quota'); originalSet(key, value); };
  const result = importCloudSave({ ...base(), lv: 65 });
  assert.equal(result.ok, true); assert.equal(readCharSave(result.id).lv, 65);
  assert.equal(store.getItem(saveMigrationBackupKey('restore:sertz_char_a')), raw);
  assert.ok(events.some(event => event.detail?.reason.includes('복원은 완료')));
});
