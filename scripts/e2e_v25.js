/* v2.5 E2E — 7건 신규 기능 검증
 *  [1] 아이템 확장 — 신규 아이템 정의/상점 등록/구매
 *  [2] 마을 귀환서 — 사용 시 village로 워프 + 소모
 *  [3] 지역 이동 부적 — 방문 기록/패널 오픈/워프 실행/소모
 *  [4] 전직 3슬롯 — 계열별 기본공격+스킬 라벨 교체 확인
 *  [5] 자동사냥 — 펫 없음 차단/펫 보유 토글/자동 접근
 *  [6] 인벤토리 스크롤 — max-h/overflow-y-auto 적용
 *  [7] 소지품 사용 — 상급 물약 즉시 효과 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");

const PORT = 3111;
const URL = `http://localhost:${PORT}`;
let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log(`  PASS — ${label}`); } else { fail++; console.log(`  FAIL — ${label}`); } };

async function enterWorld(page) {
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("text=새로운 모험", { timeout: 60000 });
  await page.click("text=새로운 모험");
  for (let i = 0; i < 40; i++) {
    const inWorld = await page.evaluate(() => !!(window.__SERTZ__?.game?.scene.getScene("world")?.player));
    if (inWorld) break;
    await page.mouse.click(640, 400); await page.keyboard.press("e"); await page.waitForTimeout(400);
  }
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.finishIntro("테스터");
  });
  await page.waitForTimeout(400);
  for (let i = 0; i < 5; i++) { await page.keyboard.press("Space"); await page.waitForTimeout(260); }
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.dialoguing = false; w.introStep = -1; w.sleepPending = false;
  });
  await page.waitForTimeout(250);
}

async function restartWith(page, stage, patch) {
  await page.evaluate(([st, p]) => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const carry = w.buildSave(st);
    Object.assign(carry, p);
    w.scene.restart({ stage: st, save: carry });
  }, [stage, patch]);
  await page.waitForTimeout(1800);
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.dialoguing = false; w.introStep = -1; w.sleepPending = false;
  });
  await page.waitForTimeout(300);
}

const W = (page) => page.evaluate(() => {
  const w = window.__SERTZ__.game.scene.getScene("world");
  return {
    stage: w.stageDef.key,
    lv: w.player.lv,
    hp: w.player.hp, maxHp: w.player.maxHp,
    gold: w.player.gold,
    weapon: w.player.weapon,
    owned: [...w.player.owned],
    cls: w.player.cls,
    atkName: w.player.attackName,
    s1Name: w.player.skill1Name,
    s2Name: w.player.skill2Name,
    tier: w.player.tier,
    visited: [...w.visited],
    autoHunt: w.autoHunt,
    pet: w.player.pet,
    x: Math.round(w.player.x), y: Math.round(w.player.y),
    kills: w.totalKills,
  };
});

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: process.cwd(), env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 500)); try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) break; } catch {} }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 200)));

  console.log("[1] 아이템 확장 — 신규 아이템 정의/상점/구매");
  await enterWorld(page);
  const items = await page.evaluate(() => {
    const d = window.__SERTZ__.game.scene.getScene("world").game ? null : null;
    return null;
  });
  const shopOk = await page.evaluate(() => {
    let stock = null;
    const eb = window.__SERTZ_EB__;
    const onRpg = (v) => { stock = v.shopStock; };
    eb.on("rpg:state", onRpg);
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.lastRpgSig = ""; // sig 캐시 클리어 — 강제 emit
    w.emitRpgState();
    eb.off("rpg:state", onRpg);
    const need = ["potion_hp2", "potion_mp2", "weapon_5", "weapon_6", "armor_5", "armor_6", "ring_crit", "ring_guard", "scroll_return", "scroll_warp"];
    return stock ? need.filter((k) => stock.includes(k)).length === need.length : false;
  });
  ok(shopOk, "상점 재고에 신규 아이템 10종 등록");
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.player.gold += 1000;
    w.player.buy("scroll_return");
    w.player.buy("scroll_warp");
    w.player.buy("potion_hp2");
    w.player.buy("weapon_5");
    w.player.buy("ring_crit");
  });
  const inv = await W(page);
  ok(inv.owned.includes("scroll_return") && inv.owned.includes("scroll_warp") && inv.owned.includes("potion_hp2"), `구매 → 소지품 반영 (${inv.owned.join(",")})`);
  ok(inv.weapon === "weapon_5", "무기 구매 즉시 장착 (용인의 마검)");

  console.log("[2] 마을 귀환서 — village 워프 + 소모");
  await restartWith(page, "forest3", { lv: 5 });
  const before2 = await W(page);
  ok(before2.stage === "forest3", `forest3 진입 (visited: ${before2.visited.join(",")})`);
  ok(before2.visited.includes("village") && before2.visited.includes("forest3"), "방문 기록 자동 저장 (village+forest3)");
  await page.evaluate(() => window.__SERTZ_EB__.emit("rpg:useItem", { key: "scroll_return" }));
  await page.waitForTimeout(1600);
  const after2 = await W(page);
  ok(after2.stage === "village", `귀환서 사용 → village 도착 (실제: ${after2.stage})`);
  ok(!after2.owned.includes("scroll_return"), "귀환서 소모 확인");

  console.log("[3] 지역 이동 부적 — 패널/워프/소모");
  await restartWith(page, "forest1", { lv: 5 });
  await page.evaluate(() => window.__SERTZ_EB__.emit("rpg:useItem", { key: "scroll_warp" }));
  await page.waitForTimeout(500);
  const warpPanel = await page.evaluate(() => !!document.querySelector('[aria-label="지역 이동 닫기"]'));
  ok(warpPanel, "부적 사용 → 지역 이동 패널 오픈");
  await page.evaluate(() => {
    window.__SERTZ_EB__.emit("rpg:warp", { stage: "village" });
  });
  await page.waitForTimeout(1600);
  const after3 = await W(page);
  ok(after3.stage === "village", `부적 워프 → village (실제: ${after3.stage})`);
  ok(!after3.owned.includes("scroll_warp"), "부적 1장 소모");

  console.log("[4] 전직 3슬롯 — 계열별 기본공격/스킬 교체");
  await restartWith(page, "village", { lv: 60 });
  const base = await W(page);
  ok(base.atkName === "참격" && base.s1Name === "회전베기" && base.tier === 0, `미전직: ${base.atkName}/${base.s1Name}/${base.s2Name} (tier ${base.tier})`);
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.player.applyClass("warrior");
  });
  const warrior = await W(page);
  ok(warrior.atkName === "강화 참격" && warrior.cls === "warrior", `전사 전직: 기본공격 → "${warrior.atkName}" (3슬롯 중 1)`);
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.player.applyClass("berserker"); w.player.applyClass("warlord");
  });
  const t3 = await W(page);
  ok(t3.tier === 3, `3차 승격 tier=${t3.tier}`);
  // 자유 계열 전환 확인 — 마법사로 switchClass 불가(다른 계열), 같은 계열만
  const label = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.player.cls = null; w.player.applySavedClass("mage");
    return { a: w.player.attackName, s1: w.player.skill1Name, s2: w.player.skill2Name };
  });
  ok(label.a === "마법탄" && label.s1 === "매직 볼트" && label.s2 === "점멸", `마법사 3슬롯: ${label.a}/${label.s1}/${label.s2}`);
  const rlabel = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.player.cls = null; w.player.applySavedClass("ranger");
    return { a: w.player.attackName, s1: w.player.skill1Name, s2: w.player.skill2Name };
  });
  ok(rlabel.a === "활쏘기" && rlabel.s1 === "관통 화살" && rlabel.s2 === "질풍 차지", `궁수 3슬롯: ${rlabel.a}/${rlabel.s1}/${rlabel.s2}`);

  console.log("[5] 자동사냥 — 펫 조건/토글/자동 접근");
  await restartWith(page, "forest2", { lv: 8 });
  // 구역 진입 대사 스킵 — 자동사냥 개입 차단 제거
  for (let i = 0; i < 4; i++) { await page.keyboard.press("Space"); await page.waitForTimeout(300); }
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.queuedDialogue = null; w.dialoguing = false; w.sleepPending = false;
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__SERTZ_EB__.emit("rpg:autohunt", {}));
  await page.waitForTimeout(300);
  const noPet = await W(page);
  ok(!noPet.autoHunt, "펫 없이 토글 → 차단 (배너 안내)");
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    if (!w.player.pets.includes("pet_slime")) w.player.pets.push("pet_slime");
    w.player.setPet("pet_slime");
  });
  await page.waitForTimeout(400);
  const withPet = await W(page);
  ok(withPet.pet === "pet_slime", "펫 소환 (슬라임 젤리)");
  await page.evaluate(() => window.__SERTZ_EB__.emit("rpg:autohunt", {}));
  await page.waitForTimeout(300);
  const hunting = await W(page);
  ok(hunting.autoHunt, "펫 보유 후 토글 → 자동사냥 ON");
  const pos0 = hunting;
  await page.waitForTimeout(4000); // 4초 자동사냥 — 적 접근/공격
  const pos1 = await W(page);
  const dist = Math.round(Math.hypot(pos1.x - pos0.x, pos1.y - pos0.y));
  ok(dist > 40 || pos1.kills > pos0.kills || pos1.hp < pos1.maxHp, `자동사냥 동작 — 이동 ${dist}px, 킬 ${pos0.kills}→${pos1.kills} (hp ${pos1.hp}/${pos1.maxHp})`);
  await page.screenshot({ path: "scripts/v25-autohunt.png" });
  await page.evaluate(() => window.__SERTZ_EB__.emit("rpg:autohunt", {}));
  await page.waitForTimeout(300);
  const off = await W(page);
  ok(!off.autoHunt, "재토글 → OFF");

  console.log("[6] 인벤토리 스크롤 — max-h/overflow 적용");
  await page.evaluate(() => window.__SERTZ_EB__.emit("ui:panel", { panel: "inv" }));
  await page.waitForTimeout(400);
  const invScroll = await page.evaluate(() => {
    const el = [...document.querySelectorAll("div")].find((d) => d.className.includes("sky-200/50") && d.className.includes("overflow-y-auto"));
    return el ? { maxh: el.className.includes("max-h-[86vh]"), overflow: el.className.includes("overflow-y-auto") } : null;
  });
  ok(!!invScroll && invScroll.maxh && invScroll.overflow, "가방 패널 max-h + overflow-y-auto 적용 (스크롤 가능)");

  console.log("[7] 상급 물약 — 소지품 사용/효과");
  await page.evaluate(() => window.__SERTZ_EB__.emit("ui:panel", { panel: null }));
  await restartWith(page, "village", { lv: 5 });
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.player.hp = 30; // 피해 입은 상태 — [1]에서 구매한 상급 물약이 세이브로 유지 중
    window.__SERTZ_EB__.emit("rpg:useItem", { key: "potion_hp2" });
  });
  await page.waitForTimeout(300);
  const pot = await W(page);
  ok(pot.hp > 30, `상급 HP 물약 회복 (${pot.hp}/${pot.maxHp})`);
  const potGone = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    return !w.player.owned.includes("potion_hp2");
  });
  ok(potGone, "상급 물약 소모 확인");

  console.log(`\n=== v2.5 E2E 결과: ${pass} PASS / ${fail} FAIL ===`);
  await browser.close();
  srv.kill();
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
