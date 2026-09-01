/* v3.0.7 E2E — 4대 기능 검증
 *  [1] 유저 거래소 — bd_* 구매(에메랄드)/판매(60% 환급) + 상점 buy() tradeLock 유지 + 패널 UI
 *  [2] 강화 주문서 — 구매/충전(starBless)/강화 시 1장 소모 + 성공률 가산(60% 결정론 실측)
 *  [3] 장신구 스타포스 — tryUpgradeAcc(골드 차감/성공) + ★5 crit 마일스톤 + HP 트랙 동기화 + 세이브
 *  [4] 세이지 힐러 — purify 자힐 상향+MP 회복 / timewarp 자신 회복 필드 / eternalloop 대량 자힐
 *  [5] 회귀 스모크 — 상점/거래소 패널 DOM + buildSave 신규 필드 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");

const PORT = 3123;
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
    await page.mouse.click(400, 300); await page.keyboard.press("e"); await page.waitForTimeout(400);
  }
  await page.waitForTimeout(900);
  for (let i = 0; i < 6; i++) {
    const done = await page.evaluate(() => {
      try {
        const w = window.__SERTZ__.game.scene.getScene("world");
        if (!w?.player) return false;
        w.finishIntro("테스터");
        return true;
      } catch { return false; }
    });
    if (done) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(400);
  for (let i = 0; i < 5; i++) { await page.keyboard.press("Space"); await page.waitForTimeout(260); }
  let cleanStreak = 0;
  for (let i = 0; i < 20 && cleanStreak < 3; i++) {
    const dlg = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      if (w.dialoguing) { w.resumeFromDialogue(); return true; }
      return false;
    });
    if (dlg) cleanStreak = 0; else cleanStreak++;
    await page.waitForTimeout(300);
  }
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.dialoguing = false; w.introStep = -1; w.sleepPending = false;
    w.physics.world.resume();
  });
  await page.waitForTimeout(250);
}

/** 스테이지 + 세이브 주입 재시작 (v306 하네스 패턴) */
async function gotoStage(page, stageKey, savePatch = {}) {
  await page.evaluate(async (args) => {
    const w0 = window.__SERTZ__.game.scene.getScene("world");
    const stage = String(args.stageKey);
    const base = w0.buildSave(stage) || {};
    for (const [k, v] of Object.entries(args.patch || {})) base[k] = v;
    base.stage = stage;
    w0.scene.restart({ stage, save: base });
  }, { stageKey, patch: savePatch });
  await page.waitForTimeout(2200);
  let cleanStreak = 0;
  for (let i = 0; i < 20 && cleanStreak < 3; i++) {
    const dlg = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      if (w?.dialoguing) { w.resumeFromDialogue(); return true; }
      return false;
    });
    if (dlg) cleanStreak = 0; else cleanStreak++;
    await page.waitForTimeout(300);
  }
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.dialoguing = false; w.introStep = -1; w.sleepPending = false;
    if (w.physics.world) w.physics.world.resume();
  });
  await page.waitForTimeout(300);
}

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production", PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 500)); try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) break; } catch {} }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 200)));

  try {
    await enterWorld(page);
    const W = () => "window.__SERTZ__.game.scene.getScene('world')";

    /* ============ [1] 유저 거래소 ============ */
    console.log("\n[1] 유저 거래소 — 보스 드롭 사고팔기");
    // 판매가 60% 곡선 (정적)
    const tv = await page.evaluate(() => {
      const c = window.__SERTZ_DEBUG__;
      const { tradeValue, TRADE_PRICES } = c.data;
      return { g: tradeValue("bd_guardian"), a: tradeValue("bd_abudditos"), stock: c.data.TRADE_STOCK.length };
    });
    ok(tv.g === 4 && tv.a === 18, `판매가 60% 수수료 (guardian 8→${tv.g}, abudditos 30→${tv.a})`);
    ok(tv.stock === 9, `거래소 진열 9종 (${tv.stock}/9)`);

    // GM 에메랄드 지급 → 거래소 구매 → 상점 구매는 여전히 차단 → 판매 환급
    const trade1 = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const p = w.player;
      const Event = window.__SERTZ__.EventBus ?? null;
      // GM 이벤트로 에메랄드 지급
      window.__SERTZ_EB__.emit("rpg:gm", { type: "em", value: 100 });
      const em0 = p.emerald;
      // 상점 구매는 tradeLock 차단 (v3.0.6 유지)
      const shopBlocked = p.buy("bd_guardian") === false;
      // 거래소 구매 (8 에메랄드)
      const bought = p.tradeBuy("bd_guardian");
      const em1 = p.emerald;
      const ownedHas = p.owned.includes("bd_guardian");
      const worn = p.accessories.includes("bd_guardian");
      // 중복 구매 차단
      const dupBlocked = p.tradeBuy("bd_guardian") === false;
      // 거래소 판매 (환급 4)
      const sold = p.tradeSell("bd_guardian");
      const em2 = p.emerald;
      const ownedGone = !p.owned.includes("bd_guardian");
      const unworn = !p.accessories.includes("bd_guardian");
      return { em0, shopBlocked, bought, em1, ownedHas, worn, dupBlocked, sold, em2, ownedGone, unworn };
    });
    ok(trade1.em0 === 100, `GM 에메랄드 지급 (${trade1.em0})`);
    ok(trade1.shopBlocked, "상점 buy() tradeLock 차단 유지 (거래소로만)");
    ok(trade1.bought && trade1.em1 === 92, `거래소 구매 — 에메랄드 100→${trade1.em1} (-8)`);
    ok(trade1.ownedHas && trade1.worn, "구매 즉시 보유+장착");
    ok(trade1.dupBlocked, "중복 보유 구매 차단");
    ok(trade1.sold && trade1.em2 === 96, `거래소 판매 — 에메랄드 ${trade1.em1}→${trade1.em2} (+4 = 60%)`);
    ok(trade1.ownedGone && trade1.unworn, "판매 후 보유/장착 해제");

    // 거래소 이벤트 경로 (rpg:tradeBuy)
    const tradeEvt = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const p = w.player;
      window.__SERTZ_EB__.emit("rpg:tradeBuy", { key: "bd_abudditos" });
      const has = p.owned.includes("bd_abudditos");
      const em = p.emerald; // 96 - 30 = 66
      const sold = window.__SERTZ_EB__.emit("rpg:tradeSell", { key: "bd_abudditos" });
      return { has, em };
    });
    ok(tradeEvt.has && tradeEvt.em === 66, `거래소 이벤트 구매 bd_abudditos (에메랄드 ${tradeEvt.em})`);

    /* ============ [2] 강화 주문서 ============ */
    console.log("\n[2] 강화 주문서 — 충전/소모/성공률 가산");
    const scroll = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const p = w.player;
      const out = {};
      // 상점 구매 → 소지품 push
      p.gold = 10000;
      const g0 = p.gold;
      window.__SERTZ_EB__.emit("rpg:buy", { key: "scroll_star" });
      out.bought = p.owned.includes("scroll_star");
      out.paid = g0 - p.gold === 150;
      // 충전 (이벤트 경로)
      window.__SERTZ_EB__.emit("rpg:starScroll");
      out.bless1 = p.starBless === 1;
      out.consumed = !p.owned.includes("scroll_star");
      // 결정론 강화 실측: ★9 → rate 15+45(3장)=60
      p.gold = 100000;
      p.upgrades.weapon = 9;
      p.starBless = 3;
      const rand = Math.random;
      Math.random = () => 0.5; // 50 < 60 → 성공
      const r1 = p.tryUpgrade("weapon");
      out.up10 = p.upgrades.weapon === 10 && r1 === "ok";
      out.blessAfter = p.starBless === 2;
      Math.random = () => 0.9; // 90 >= 57(★10 rate 12+45) → 실패 → ★9 하락
      const r2 = p.tryUpgrade("weapon");
      out.down9 = p.upgrades.weapon === 9 && r2 === "fail";
      out.blessAfter2 = p.starBless === 1;
      // ★8 (하락 구간 미만) 실패 — 성 유지 + 잔량 충전 소진
      p.upgrades.weapon = 8;
      Math.random = () => 0.9; // 90 >= 55(★8 rate 40+15) → 실패, ★9 미만이라 하락 없음
      p.tryUpgrade("weapon");
      out.noDownBelow9 = p.upgrades.weapon === 8;
      out.bless0 = p.starBless === 0;
      Math.random = rand;
      p.upgrades.weapon = 0;
      return out;
    });
    ok(scroll.bought && scroll.paid, `주문서 상점 구매 (150G) → 소지품`);
    ok(scroll.bless1 && scroll.consumed, `충전 — starBless 1, 주문서 소모`);
    ok(scroll.up10, `★9 강화 60% 결정론 성공 (rate 15+45) → ★10`);
    ok(scroll.blessAfter, `성공 시에도 충전 1장 소모 (3→2)`);
    ok(scroll.down9, `★10 실패 → ★9 하락 (rate 12+45 미달)`);
    ok(scroll.blessAfter2, `실패 시에도 충전 소모 (2→1)`);
    ok(scroll.noDownBelow9 && scroll.bless0, `★9 미만 실패 하락 없음 + 충전 잔량 소진`);

    /* ============ [3] 장신구 스타포스 ============ */
    console.log("\n[3] 장신구 스타포스 — 강화/마일스톤/세이브");
    const acc = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const p = w.player;
      const out = {};
      p.gold = 500000;
      p.owned.push("ring_power");
      p.equip("ring_power");
      const crit0 = p.critRate;
      const g0 = p.gold;
      const rand = Math.random;
      Math.random = () => 0.0; // 결정론 성공
      out.up1 = p.tryUpgradeAcc("ring_power") === "ok";
      Math.random = rand;
      out.cost = g0 - p.gold > 0;
      out.accUp1 = (p.accUp["ring_power"] ?? 0) === 1;
      // ★5 마일스톤 — crit 트랙 +2
      p.accUp["ring_power"] = 4;
      Math.random = () => 0.0;
      p.tryUpgradeAcc("ring_power");
      Math.random = rand;
      out.star5 = (p.accUp["ring_power"] ?? 0) === 5;
      out.critDelta = Math.round((p.critRate - crit0) * 10) / 10; // +2
      // HP 트랙 — bd_behemoth (maxHp 120, ★5 → +20)
      p.tradeBuy("bd_behemoth");
      const hp0 = p.maxHp;
      p.accUp["bd_behemoth"] = 5;
      p.syncAccStarHp();
      out.hpDelta = p.maxHp - hp0; // +20
      out.accHpApplied = p.accHpAppliedVal; // 20 (ring_power는 crit만 → hp 0)
      // 세이브 반영
      w.save();
      const s = JSON.parse(window.localStorage.getItem("sertz_save_v2") || "{}");
      const keys = Object.keys(s);
      out.saveHasAccUp = typeof s.accUp === "object" && s.accUp["ring_power"] === 5;
      out.saveHasBless = typeof s.starBless === "number";
      out.saveHasAccHp = s.accHp === 20;
      out.saveKeyCount = keys.length;
      return out;
    });
    ok(acc.up1, `장신구 강화 성공 (tryUpgradeAcc)`);
    ok(acc.cost, `골드 차감 (무기 체계와 동일 비용)`);
    ok(acc.accUp1, `accUp 기록 ★1`);
    ok(acc.star5, `★5 도달`);
    ok(acc.critDelta === 2, `★5 crit 마일스톤 반영 (critRate +${acc.critDelta})`);
    ok(acc.hpDelta === 20, `★5 HP 마일스톤 동기화 (+${acc.hpDelta})`);
    ok(acc.accHpApplied === 20, `HP 가산 이력 추적 (${acc.accHpApplied})`);
    ok(acc.saveHasAccUp && acc.saveHasBless && acc.saveHasAccHp, `세이브에 accUp/starBless/accHp 반영`);
    // 세이브 키 탐색 로그
    console.log(`    [debug] save keys: ${acc.saveKeyCount}`);

    /* ============ [4] 세이지 힐러 확장 ============ */
    console.log("\n[4] 세이지 힐러 — purify 자힐+MP / timewarp 회복 필드 / eternalloop 대량 자힐");
    // 몬스터가 있는 사냥 구역으로 이동 (마을에는 적이 없어 purify 자힐 미발동)
    await gotoStage(page, "forest1");
    const sage = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const p = w.player;
      const out = {};
      // 전직: mage → sage (2차)
      p.lv = 50;
      out.jobMage = p.applyClass("mage");
      out.jobSage = p.applyClass("sage");
      // purify 자힐: 근처 적 이동 → 피해 → cast (useSkill1 MP 게이트: 15 필요)
      const e = w.getAllTargets()[0];
      out.enemyCount = w.getAllTargets().length;
      if (e) {
        const bx = e.x + 60, by = e.y;
        (p.body).reset(bx, by);
        p.setPosition(bx, by);
      }
      p.hp = Math.floor(p.maxHp * 0.3);
      p.mp = Math.max(60, Math.floor(p.maxMp * 0.5));
      p.skill1Cd = 0; p.state = "idle";
      p.hitSet?.clear?.();
      const mpBefore = p.mp;
      p.useSkill1();
      out.cast = p.skill1Cd > 0;
      out.mpBefore = mpBefore;
      return out;
    });
    await page.waitForTimeout(450);
    const sage2 = await page.evaluate((mpBefore0) => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const p = w.player;
      const out = {};
      out.healed = p.hp > Math.floor(p.maxHp * 0.3); // hits≥1 → 최소 +12
      /* MP: 캐스팅 전 값 대비 — 스킬 비용 -15, 회복 +4+2t → 순증 -11+2t (t≥2면 순증 ≥ -7)
       * 회복 실측: mp가 비용 차감분보다 덜 떨어졌거나 늘었다면 회복 발생 */
      out.mpNet = p.mp - (mpBefore0 ?? 0);
      out.mpHealed = out.mpNet > -15; // 비용 15를 전부 잃지 않았다면 회복분 존재
      out.mpVal = p.mp;
      // 크로니컬(3차) → timewarp 자신 회복 필드
      p.applyClass("chronicle");
      p.mp = p.maxMp;
      const hpT0 = p.hp;
      p.useSkill3();
      out.timewarpField = (w.fields || []).some((f) => f.selfHealPerTick > 0);
      return { out, hpT0 };
    }, sage.mpBefore);
    await page.waitForTimeout(1200); // 2틱(0.5s×2) 이상
    const sage3 = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const p = w.player;
      const out = {};
      // 이터널(4차) → eternalloop: HP 25% + MP 50% 즉시 회복 (MP 스킬 비용 40 차감 유의)
      out.jobEternal = p.applyClass("eternal");
      p.hp = Math.floor(p.maxHp * 0.2);
      p.mp = Math.max(40, Math.floor(p.maxMp * 0.1));
      const hp0 = p.hp, mp0 = p.mp;
      p.useSkill4();
      const expHeal = Math.max(10, Math.round(p.maxHp * 0.25));
      const expMana = Math.max(5, Math.round(p.maxMp * 0.5)) - 40; // 스킬 비용 차감 후 순증
      out.healVal = p.hp - hp0;
      out.manaVal = p.mp - mp0;
      out.healOk = Math.abs(out.healVal - expHeal) <= 2;
      out.manaOk = Math.abs(out.manaVal - expMana) <= 2;
      return out;
    });
    ok(sage.jobSage, `세이지 2차 전직`);
    ok(sage.cast && sage.enemyCount > 0, `purify 캐스팅 (적 ${sage.enemyCount}마리, 게이트 통과)`);
    ok(sage2.out.healed, `purify 자힐 실측 (상향 공식 8+4t×hits)`);
    ok(sage2.out.mpHealed, `purify MP 회복 신규 (순증 ${sage2.out.mpNet} — 비용 -15 대비 +${sage2.out.mpNet + 15})`);
    ok(sage2.out.timewarpField, `timewarp 자신 회복 필드 (selfHealPerTick)`);
    ok(sage3.jobEternal, `이터널 4차 전직`);
    ok(sage3.healOk, `eternalloop HP +25% 실측 (+${sage3.healVal})`);
    ok(sage3.manaOk, `eternalloop MP +50% 실측 (+${sage3.manaVal})`);

    /* ============ [5] 회귀 스모크 — 패널 DOM + 세이브 무결성 ============ */
    console.log("\n[5] 회귀 스모크 — 거래소/상점 패널 UI");
    // 상점 오픈 → 거래소 버튼 → 거래소 패널
    await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      w.nearShop = true;
      window.__SERTZ_EB__.emit("ui:panel", { panel: "shop" });
    });
    await page.waitForTimeout(400);
    const shopUi = await page.evaluate(() => ({
      shop: !!document.body.textContent.includes("스타포스 강화"),
      tradeBtn: !!Array.from(document.querySelectorAll("button")).find((b) => b.textContent.trim() === "거래소"),
    }));
    ok(shopUi.shop, "상점 패널 렌더 (스타포스 섹션)");
    ok(shopUi.tradeBtn, "상점 헤더 거래소 진입 버튼");
    await page.click("button:has-text('거래소')");
    await page.waitForTimeout(400);
    const tradeUi = await page.evaluate(() => ({
      panel: !!document.body.textContent.includes("유저 거래소"),
      buyRow: !!document.body.textContent.includes("수호자의 문장"),
      guide: !!document.body.textContent.includes("60%"),
    }));
    ok(tradeUi.panel, "거래소 패널 오픈");
    ok(tradeUi.buyRow, "거래소 진열 렌더 (bd_guardian)");
    ok(tradeUi.guide, "판매가 60% 안내 표기");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);

  } catch (e) {
    console.log("FATAL:", String(e).slice(0, 300));
    fail++;
  } finally {
    await browser.close();
    srv.kill();
  }
  console.log(`\n=== v3.0.7: ${pass} PASS / ${fail} FAIL ===`);
  process.exit(fail > 0 ? 1 : 0);
})();
