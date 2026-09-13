/**
 * v1.0.18 E2E-2 — 구세이브 마이그레이션 + 환생 수정 검증 (1280×720)
 *  · sertz_save_v2 구세이브(eagleeye 5차각성·Lv200) 시드 → 로비 카드 마이그레이션
 *  · 환생 실행 → 시작 캐릭터(eagleeye) 복귀 + 5차 각성 리셋 + 환생 로그 기록 확인
 */
const { chromium } = require("playwright");

const LEGACY = {
  stage: "forest1", lv: 200, exp: 0, maxHp: 1200, maxMp: 220, atk: 300, cleared: true,
  gold: 123000, potions: { hp: 5, mp: 4 }, weapon: "weapon_1", armor: "armor_1",
  owned: ["weapon_1", "armor_1"], upWea: 0, upArm: 0, accUp: {}, accessories: [],
  emerald: 40, questIdx: {}, cls: "eagleeye", playerName: "환생검증",
  stats: { str: 5, dex: 300, int: 5, luk: 100 }, ap: 10, buffItems: {}, buffs: [],
  pets: [], pet: null, cosmetics: [], cosmetic: null, outfit: null, hair: null,
  jobStory: null, jobStoryDone: [1, 2, 3, 4], pendingJobClass: null, fcode: "AAA111",
  friends: [], repeatOn: true, seen: [], visited: [], autoHunt: false, autoAlloc: true,
  quickPots: { hp: "potion_hp", mp: "potion_mp" }, potentials: {}, potHpApplied: 0,
  unlockedSets: [], questAccepted: {}, questTracked: null, monsterKills: {},
  fragmentsFound: {}, worldtreeBlessing: true, bossDiff: "normal", bossKills: 3,
  chaosKills: 0, invasionKills: 0, tutorialDone: true, tutStep: 6,
  fifth: true, fifthStoryDone: true,
  figures: [], shards: 0, gachaTickets: 1, badges: [], badgeSlots: [null, null, null],
  runes: {}, runeSlots: [null, null, null, null], constel: [], coupons: [],
  attend: { last: "", count: 0 },
  daily: { date: "", hunts: 0, gate: 0, closet: 0, claimed: [] },
  tickets: { date: "", gate: 3, closet: 2 },
  achClaimed: [], gateBest: 0, closetBest: 0, freeGachaAt: 0, lastSeen: Date.now(),
  gateStars: [false, false, false], tierUpWea: 0, tierUpArm: 0,
  missions: { day: "", week: "", d: {}, w: {}, cd: [], cw: [] },
  sub: { until: 0 }, starterPackBought: false,
  inf: { towerBest: 0, closetTier: 0, trialDone: "", rebirths: 5, mats: {}, petLv: 1, petExp: 0, abyss: 100, orbs: {}, rebirthEss: 0 },
  pass: { season: "s1", xp: 0, prem: false, claimedF: [], claimedP: [] },
  attend2: undefined,
};

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 240)));
  p.on("console", (m) => { if (m.type() === "error") errs.push("CONSOLE: " + m.text().slice(0, 240)); });
  p.on("dialog", (d) => d.accept()); // 환생 window.confirm 수락

  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.evaluate((save) => { localStorage.setItem("sertz_save_v2", JSON.stringify(save)); }, LEGACY);
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(6000);

  /* 로비 열기 → 마이그레이션 카드 확인 */
  await p.getByRole("button", { name: /게임 시작/ }).first().click();
  await p.waitForTimeout(900);
  const migrated = await p.getByText("환생검증").first().isVisible().catch(() => false);
  console.log("1. 구세이브 → 로비 카드 마이그레이션:", migrated);
  const slots = await p.evaluate(() => JSON.parse(localStorage.getItem("sertz_slots_v1") || "{}"));
  console.log("   슬롯 저장소:", Object.keys(slots.chars ?? {}).length, "개 캐릭터 · 슬롯", slots.slots);
  await p.screenshot({ path: "/tmp/e2e_1018_11_migrated.png" });

  /* 이어하기 → 클래스/5차 복원 확인 */
  await p.getByRole("button", { name: /이 캐릭터로 시작/ }).click();
  await p.waitForTimeout(7000);
  const w = () => window.__SERTZ__?.game?.scene.getScene("world");
  const before = await p.evaluate(() => {
    const pl = window.__SERTZ__?.game?.scene.getScene("world")?.player;
    return pl ? { cls: pl.cls, fifth: pl.fifth, startCls: pl.startCls, lv: pl.lv } : null;
  });
  console.log("2. 로드 후:", JSON.stringify(before), "(cls=eagleeye·fifth=true 예상)");

  /* 퀘스트 패널 닫기 → 콘텐츠 → 환생 */
  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);
  await p.getByRole("button", { name: /콘텐츠 열기/ }).click();
  await p.waitForTimeout(600);
  await p.getByRole("button", { name: "환생·펫", exact: true }).click();
  await p.waitForTimeout(400);
  await p.screenshot({ path: "/tmp/e2e_1018_12_rebirth.png" });
  await p.getByRole("button", { name: /환생하기/ }).click();
  await p.waitForTimeout(2500);
  const after = await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene.getScene("world");
    const pl = sc?.player;
    const save = JSON.parse(localStorage.getItem(localStorage.getItem("sertz_slots_v1") ? Object.keys(JSON.parse(localStorage.getItem("sertz_slots_v1")).chars).map((k) => `sertz_char_${k}`)[0] : "sertz_save_v2") || "{}");
    return pl ? {
      cls: pl.cls, fifth: pl.fifth, lv: pl.lv, startCls: pl.startCls,
      stage: sc.stageDef?.key,
      rebirths: sc.inf?.rebirths,
      logLen: (sc.inf?.rebirthLog ?? []).length,
      savedCls: save.cls ?? null,
    } : null;
  });
  console.log("3. 환생 후:", JSON.stringify(after));
  console.log("   기대: cls=eagleeye(시작 캐릭터 복귀) · fifth=false · lv=1 · rebirths=6 · logLen=1");
  await p.screenshot({ path: "/tmp/e2e_1018_13_after.png" });

  console.log("----");
  console.log(errs.length ? errs.slice(0, 10).join("\n") : "pageerror/console 에러 0");
  await b.close();
})().catch((e) => { console.error("E2E FAIL:", e.message); process.exit(1); });
