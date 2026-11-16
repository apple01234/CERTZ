/**
 * 2026-11-16 — 외부 평가 우선순위 1 "실제 v2 세이브를 v3 로 이관하고 장비·재화·퀘스트 진행·
 *  거래소 아이템 보존 검증".
 *
 * 종전 테스트(save-v2-transition)는 필드 몇 개만 보는 표본이었다. 여기서는 **v2 시절로 만든
 * 세이브 전 필드**를 옛 식별자로 채워 두고, 로드 경로(loadSave → migrateSave)를 그대로 통과시켜
 * 하나도 사라지지 않는지 본다. 특히 옛 '9개의 바다' 키가 들어 있는 필드가 대상이다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadSave, writeSave, setActiveCharId, SAVE_VERSION, SAVE_KEY, saveMigrationBackupKey,
} from '../src/game/config.ts';
import { readCharSave, importCloudSave, collectLocalChars, clearActiveChar, SLOTS_KEY } from '../src/game/slots.ts';
import { STORY_REVISION } from '../src/game/storyRevision.ts';

/** v2 시절 세이브 — 옛 식별자(howlrstone·nidhog·fenrir·alfheim·hel…)를 실제로 들고 있다. */
function v2Save() {
  return {
    v: 2,
    storyRevision: STORY_REVISION,
    stage: 'howlrstone3x2',
    lv: 87, exp: 12345, maxHp: 8800, atk: 1420, cleared: false,
    youngPrincessCleared: true,
    playerName: '이관검증', title: '검의 증인', gold: 54321, emerald: 77,
    maxMp: 900, ap: 12, stats: { str: 120, dex: 40, int: 10, luk: 30 },
    cls: 'dreadnought', startCls: 'pirate',
    skillMastery: { solar: 100, life: 200 },

    /* ── 장비: 옛 보스 장비 키가 그대로 들어 있다 ── */
    weapon: 'bd_nidhog', armor: 'armor_5',
    owned: ['bd_nidhog', 'bd_fenrir', 'bd_gram', 'weapon_1', 'armor_5'],
    lockedItems: ['bd_surt'],
    accessories: ['bd_skoll', 'ring_elf'],
    accessory: 'bd_skoll',
    upWea: 5, upArm: 3,
    starMap: { bd_nidhog: 12, bd_fenrir: 7, weapon_1: 4 },
    accUp: { bd_skoll: 6 },
    starBless: 2, starPity: 4, starStreak: 1, potPity: 3, sfHp: 220, accHp: 40, bonusHp: 500,
    potentials: { bd_nidhog: { grade: 3, lines: [] }, weapon_1: { grade: 1, lines: [] } },
    tierUpWea: 1, tierUpArm: 0,

    /* ── 재화·소비 ── */
    potions: { hp: 15, mp: 9 },
    quickPots: { hp: 'potion_hp', mp: 'potion_mp' },
    buffItems: { atk: 2 },
    buffs: [{ key: 'dish_atk', remain: 1000, total: 2000 }],
    gatherBag: { 'herb_1': 4 },
    shards: 300, gachaTickets: 5, parkCoins: 90, parkBest: 12,

    /* ── 진행: 옛 스테이지 키 ── */
    questIdx: { howlrstone1x1: 3, howlrstone2x3: 1, dojang: 2 },
    questAccepted: { lilacworld1x1: 1 },
    questTracked: 'howlrstone1x1',
    huntProg: { 'howlrstone2x3:hw3': 4 },
    huntKills: { 'howlrstone2x3': 9 },
    huntBase: { 'howlrstone2x3': 12 },
    repeatOn: true, repeatNeed: 50, huntCount: 10, repeatStage: 'howlrstone4x1',
    repeatProg: [1, 2, 0], repeatCycle: 1,
    monsterKills: { nidhog: 2, helhound: 9, wolf: 30 },
    fragmentsFound: { surt: 3 },
    cutsceneSeen: ['howlrstone1', 'bossIntroSurt'],
    seen: ['howlBook', 'howlWalk1_2'],
    visited: ['howlrstone1x1', 'alfheim2x1'],
    unlockedSets: ['alfheim', 'hel', 'kingdom'],
    bossKills: 22, chaosKills: 3, invasionKills: 1, gateBest: 9, closetBest: 4,
    gateStars: [true, false, true],
    bossDiff: 'chaos',
    jobStory: { tier: 4, done: 3 },
    jobStoryDone: [1, 2, 3],
    pendingJobClass: null,

    /* ── 꾸미기: 옛 이름의 코스튬·피규어 ── */
    cosmetics: ['outfit_valkyrie', 'hat_crown'],
    cosmetic: 'hat_crown', outfit: 'outfit_valkyrie', hair: 'hair_pony', cape: 'acc_cape_red',
    figures: ['fig_fenrir', 'fig_valk', 'fig_nidhog'],
    badges: ['badge_hel'], badgeSlots: ['badge_hel', null, null],
    runes: { rune_1: 3 }, runeSlots: ['rune_1', null],
    constel: ['c1', 'c2'],
    pets: ['pet_dog'], pet: 'pet_dog',
    lookTint: 0xffcc00, gender: 'f', skinIdx: 3,
    tutSeen: ['tut_move', 'tut_attack'],
    homeDecor: [{ key: 'furn_bed', x: 1, y: 2 }],
    fieldDecor: [{ key: 'furn_lamp', x: 5, y: 6, stage: 'howlrstone1x1' }],

    /* ── 계정·편의 ── */
    fcode: 'ABCD1234',
    friends: [{ code: 'ZZZZ9999', name: '수르트팬' }],
    achClaimed: ['ach_1'],
    coupons: ['coupon_a'],
    worldtreeBlessing: false,
    autoHunt: true, autoAlloc: false,
    autoUse: { hpPct: 45, mpPct: 25, mpOn: false, buffs: ['atk'] },
    playStats: { playSec: 36000, kills: 1200, deaths: 8, bestHit: 91000 },
    storyChoices: { q1: 'a' },
    bossRushBest: { bestWave: 14, clears: 2, totalEmerald: 30 },
    chibiQuests: { npc_a: { done: 1, prog: 2, active: 'x' } },
    inf: { rebirths: 3, points: 10 },
    tutorialDone: true, tutorialVersion: 3, tutStep: 9,
    fifth: true, fifthStoryDone: true, fifth2Step: 2, fifth2Count: 1, fifth2Done: false,
    introSeen: true, dlcTalked: false,
    lastSeen: 1763000000000,
  };
}

function storage() {
  const data = new Map(), events = [];
  const store = {
    getItem: key => data.get(key) ?? null,
    setItem(key, value) { data.set(key, value); },
    removeItem: key => data.delete(key),
    key: index => [...data.keys()][index] ?? null,
    get length() { return data.size; },
  };
  globalThis.window = { localStorage: store, dispatchEvent: event => events.push(event) };
  globalThis.localStorage = store;
  clearActiveChar(); setActiveCharId(null);
  return { store, data, events };
}

test('v2 세이브 전 필드가 v3 로 넘어가며 하나도 사라지지 않는다', () => {
  const { store } = storage();
  const before = v2Save();
  store.setItem('sertz_char_full', JSON.stringify(before));
  setActiveCharId('full');

  const save = loadSave();
  assert.ok(save, '로드 자체가 실패했다');
  assert.ok(save.v >= SAVE_VERSION);

  /* 1) 필드 개수 — 옛 키 변환으로 늘거나 줄 수는 있어도 **빠지면 안 된다**.
   *    v2 에 있던 최상위 키가 v3 결과에 전부 있어야 한다. */
  const dropped = Object.keys(before).filter((k) => !(k in save));
  assert.deepEqual(dropped, [], `이관에서 사라진 필드: ${dropped.join(', ')}`);

  /* 2) 재화·핵심 수치 보존 */
  assert.equal(save.gold, 54321);
  assert.equal(save.emerald, 77);
  assert.equal(save.lv, 87);
  assert.equal(save.atk, 1420);
  assert.equal(save.maxHp, 8800);
  assert.equal(save.ap, 12);
  assert.deepEqual(save.stats, { str: 120, dex: 40, int: 10, luk: 30 });
  assert.equal(save.shards, 300);
  assert.equal(save.gachaTickets, 5);
  assert.equal(save.parkCoins, 90);
  assert.equal(save.playStats.playSec, 36000);
  assert.equal(save.inf.rebirths, 3);
  assert.deepEqual(save.bossRushBest, { bestWave: 14, clears: 2, totalEmerald: 30 });

  /* 3) 장비·강화 — 옛 보스 키가 새 키로 바뀌고 강화 수치는 유지된다 */
  assert.equal(save.weapon, 'bd_blackwyrm');
  assert.deepEqual(save.owned, ['bd_blackwyrm', 'bd_greedwolf', 'bd_warden', 'weapon_1', 'armor_5']);
  assert.deepEqual(save.lockedItems, ['bd_flamegiant']);
  assert.deepEqual(save.accessories, ['bd_twinwolf', 'ring_elf']);
  assert.equal(save.accessory, 'bd_twinwolf');
  assert.deepEqual(save.starMap, { bd_blackwyrm: 12, bd_greedwolf: 7, weapon_1: 4 });
  assert.deepEqual(save.accUp, { bd_twinwolf: 6 });
  assert.equal(save.upWea, 5);
  assert.equal(save.upArm, 3);
  assert.equal(save.starBless, 2);
  assert.equal(save.potPity, 3);
  assert.equal(save.bonusHp, 500);
  assert.deepEqual(Object.keys(save.potentials).sort(), ['bd_blackwyrm', 'weapon_1']);

  /* 4) 퀘스트 진행 — 옛 스테이지 키가 바뀌고 **진행도는 그대로** */
  assert.deepEqual(save.questIdx, { lilacworld1x1: 3, lilacworld2x3: 1, dojang: 2 });
  assert.equal(save.questTracked, 'lilacworld1x1');
  assert.deepEqual(save.huntProg, { 'lilacworld2x3:hw3': 4 });
  assert.deepEqual(save.huntKills, { 'lilacworld2x3': 9 });
  assert.equal(save.repeatStage, 'lilacworld4x1');
  assert.equal(save.stage, 'lilacworld3x2');

  /* 5) 기록·컬렉션 */
  assert.deepEqual(save.monsterKills, { blackwyrm: 2, duskhound: 9, wolf: 30 });
  assert.deepEqual(save.cutsceneSeen, ['lilacworld1', 'bossIntroFlamegiant']);
  assert.deepEqual(save.seen, ['lwBook', 'lwWalk1_2']);
  assert.deepEqual(save.visited, ['lilacworld1x1', 'fairyglade2x1']);
  assert.deepEqual(save.unlockedSets, ['fairyglade', 'duskrealm', 'kingdom']);
  assert.equal(save.bossKills, 22);
  assert.equal(save.chaosKills, 3);
  assert.deepEqual(save.jobStoryDone, [1, 2, 3]);

  /* 6) 꾸미기 */
  assert.deepEqual(save.cosmetics, ['outfit_wingmaiden', 'hat_crown']);
  assert.deepEqual(save.figures, ['fig_greedwolf', 'fig_wingmaiden', 'fig_blackwyrm']);
  assert.deepEqual(save.badges, ['badge_duskrealm']);
  assert.equal(save.pet, 'pet_dog');
  assert.equal(save.lookTint, 0xffcc00);
  assert.equal(save.fieldDecor[0].stage, 'lilacworld1x1');

  /* 7) 옛 식별자가 어디에도 남지 않는다 (거래소 매물은 서버가 따로 변환한다) */
  const json = JSON.stringify(save);
  for (const stale of ['howlrstone', 'nidhog', 'fenrir', 'alfheim', 'muspel', 'nifl', 'helhound', 'valkyrie']) {
    assert.equal(json.includes(stale), false, `옛 식별자 잔존: ${stale}`);
  }
});

test('v2 세이브 이관이 원본을 백업하고, 두 번 돌려도 결과가 같다(멱등)', () => {
  const { store } = storage();
  const raw = JSON.stringify(v2Save());
  store.setItem('sertz_char_idem', raw);
  setActiveCharId('idem');

  const once = loadSave();
  /* 원본은 그대로 두고 백업 키에 남긴다 — 사용자가 되돌릴 수 있어야 한다 */
  assert.equal(store.getItem('sertz_char_idem'), raw);
  assert.equal(store.getItem(saveMigrationBackupKey('sertz_char_idem')), raw);

  const twice = loadSave();
  assert.deepEqual(twice, once, '두 번째 로드에서 결과가 달라졌다(멱등 아님)');
});

test('클라우드 복원 경로도 같은 이관을 거친다 — v2 세이브를 그대로 복원해도 장비·진행이 살아 있다', () => {
  const { store } = storage();
  store.setItem(SLOTS_KEY, JSON.stringify({ v: 1, slots: 8, activeId: null, chars: {} }));
  const restored = importCloudSave(v2Save());
  assert.equal(restored.ok, true, restored.reason);

  const saved = readCharSave(restored.id);
  assert.ok(saved, '복원된 캐릭터를 읽을 수 없다');
  assert.equal(saved.gold, 54321);
  assert.deepEqual(saved.owned, ['bd_blackwyrm', 'bd_greedwolf', 'bd_warden', 'weapon_1', 'armor_5']);
  assert.deepEqual(saved.questIdx, { lilacworld1x1: 3, lilacworld2x3: 1, dojang: 2 });
  assert.equal(saved.stage, 'lilacworld3x2');
  assert.equal(saved.weapon, 'bd_blackwyrm');
});

test('여러 캐릭터 백업(collectLocalChars)도 전부 v3 로 올라간다', () => {
  const { store } = storage();
  const a = v2Save(), b = { ...v2Save(), playerName: '둘째', stage: 'howlrstone1x1', owned: ['bd_surt'] };
  store.setItem('sertz_char_a', JSON.stringify(a));
  store.setItem('sertz_char_b', JSON.stringify(b));
  store.setItem(SLOTS_KEY, JSON.stringify({ v: 1, slots: 8, activeId: null, chars: {
    a: { id: 'a', name: a.playerName, lv: a.lv }, b: { id: 'b', name: '둘째', lv: b.lv } } }));

  const all = collectLocalChars();
  assert.equal(all[a.playerName].stage, 'lilacworld3x2');
  assert.equal(all[a.playerName].v, SAVE_VERSION);
  assert.equal(all['둘째'].stage, 'lilacworld1x1');
  assert.deepEqual(all['둘째'].owned, ['bd_flamegiant']);
  assert.equal(all[a.playerName].weapon, 'bd_blackwyrm');
});

test('이관 후 다시 저장해도 데이터가 줄지 않는다 (로드 → 저장 왕복)', () => {
  const { store } = storage();
  store.setItem('sertz_char_rt', JSON.stringify(v2Save()));
  setActiveCharId('rt');

  const loaded = loadSave();
  const beforeKeys = Object.keys(loaded).length;
  writeSave(loaded);

  const reread = readCharSave('rt');
  assert.ok(reread);
  assert.equal(reread.gold, 54321);
  assert.deepEqual(reread.owned, ['bd_blackwyrm', 'bd_greedwolf', 'bd_warden', 'weapon_1', 'armor_5']);
  assert.ok(Object.keys(reread).length >= beforeKeys, '저장 왕복에서 필드가 줄었다');
  assert.equal(JSON.parse(store.getItem(SAVE_KEY)).weapon, 'bd_blackwyrm');
});
