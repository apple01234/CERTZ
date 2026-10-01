/* v3.0.5 E2E — 2요구 검증
 *  [요구1] 장비 강화 (스타포스) — ★15 상한·성공률 곡선·성공/실패·마일스톤(★5/10/15) 보너스
 *          + 돌파 배너 + 결과 이벤트 + 오라 티어/궤도성 + 세이브 sfHp 복원 + 상점 UI
 *  [요구2] 터치 조이스틱 인식 범위 축소 — 좌하단(46%×55%) 영역 + NPC 상호작용 칩 탭 가능
 *          (v3.0.4까지는 조이스틱 레이어가 칩을 덮어 NPC 상호작용 불가) */
const { chromium } = require("playwright");
const { spawn } = require("child_process");

const PORT = 3121;
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
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.finishIntro("테스터");
  });
  await page.waitForTimeout(400);
  for (let i = 0; i < 5; i++) { await page.keyboard.press("Space"); await page.waitForTimeout(260); }
  /* v3.0.5 — 대사 완전 소진: dialoguing이 연속 3회 false일 때까지 drain
     (intro 마을 대사가 뒤늦게 열리면 updateInteractPrompt가 early-return → 칩 미렌더) */
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

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production", PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 500)); try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) break; } catch {} }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 200)));

  try {
    await enterWorld(page);

    /* ============ [요구1] 스타포스 — 로직 ============ */
    console.log("[1] 스타포스 상한/성공률 곡선 — ★15 + 후반부 급락");
    const curve = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const p = w.player;
      const rates = [];
      const saveUp = p.upgrades.weapon;
      for (let i = 0; i <= 14; i++) { p.upgrades.weapon = i; rates.push(p.upgradeRate("weapon")); }
      p.upgrades.weapon = saveUp;
      return { max: p.upMax, rates };
    });
    ok(curve.max === 15, `강화 상한 ★15 (실측 ${curve.max})`);
    ok(curve.rates[0] === 100 && curve.rates[12] === 8 && curve.rates[14] === 5,
      `성공률 곡선 [100…8,6,5] (실측 ${curve.rates.join(",")})`);

    console.log("[2] 강화 성공 — 골드 소모 + 결과 이벤트 + ★ 표기");
    const okUp = await page.evaluate(() => {
      return new Promise((res) => {
        const EB = window.__SERTZ_EB__;
        const w = window.__SERTZ__.game.scene.getScene("world");
        const p = w.player;
        p.upgrades.weapon = 0;
        p.addGold(100000);
        let ev = null;
        const h = (v) => { ev = v; };
        EB.on("rpg:upgradeResult", h);
        const origRandom = Math.random;
        Math.random = () => 0.01; // 항상 성공
        const goldBefore = p.gold;
        EB.emit("rpg:upgrade", { slot: "weapon" }); // 유저 버튼 경로 (WorldScene onUpgrade → tryUpgrade)
        Math.random = origRandom;
        EB.off("rpg:upgradeResult", h);
        res({ r: p.upgrades.weapon === 1 ? "ok" : "?", up: p.upgrades.weapon, ev, goldSpent: goldBefore - p.gold });
      });
    });
    ok(okUp.r === "ok" && okUp.up === 1, `강화 성공 → ★1 (결과 ${okUp.r}, 성 ${okUp.up})`);
    ok(okUp.goldSpent === 45, `비용 차감 (45G, 실측 ${okUp.goldSpent})`);
    ok(okUp.ev && okUp.ev.result === "ok" && okUp.ev.slot === "weapon", `rpg:upgradeResult 수신 (${JSON.stringify(okUp.ev)})`);

    console.log("[3] ★5 마일스톤 돌파 — 공격+4·치명+2% + 돌파 배너");
    const ms5 = await page.evaluate(() => {
      return new Promise((res) => {
        const EB = window.__SERTZ_EB__;
        const w = window.__SERTZ__.game.scene.getScene("world");
        const p = w.player;
        p.upgrades.weapon = 4;
        p.addGold(100000);
        let banner = null;
        const bh = (v) => { banner = v?.text ?? null; };
        EB.on("banner:show", bh);
        const atkBefore = p.atkTotal;
        const critBefore = p.critRate;
        const origRandom = Math.random;
        Math.random = () => 0.01;
        const r = p.tryUpgrade("weapon");
        Math.random = origRandom;
        EB.off("banner:show", bh);
        res({ r, up: p.upgrades.weapon, atkDelta: p.atkTotal - atkBefore, critDelta: Math.round((p.critRate - critBefore) * 10) / 10, banner });
      });
    });
    ok(ms5.up === 5, `★5 도달 (성 ${ms5.up})`);
    ok(ms5.atkDelta === 6, `공격 +6 (성당+2·마일스톤+4, 실측 +${ms5.atkDelta})`);
    ok(ms5.critDelta === 2, `치명 +2% (실측 +${ms5.critDelta})`);
    ok(!!ms5.banner && ms5.banner.includes("★5"), `돌파 배너 (${ms5.banner})`);

    console.log("[4] ★9 실패 → 1성 하락 (스타포스 리스크)");
    const failUp = await page.evaluate(() => {
      return new Promise((res) => {
        const EB = window.__SERTZ_EB__;
        const w = window.__SERTZ__.game.scene.getScene("world");
        const p = w.player;
        p.upgrades.weapon = 9;
        p.addGold(1000000);
        let ev = null;
        const h = (v) => { ev = v; };
        EB.on("rpg:upgradeResult", h);
        const origRandom = Math.random;
        Math.random = () => 0.99; // 항상 실패
        EB.emit("rpg:upgrade", { slot: "weapon" });
        Math.random = origRandom;
        EB.off("rpg:upgradeResult", h);
        res({ r: ev ? ev.result : "?", up: p.upgrades.weapon, ev });
      });
    });
    ok(failUp.r === "fail" && failUp.up === 8, `★9 실패 → ★8 하락 (성 ${failUp.up})`);
    ok(failUp.ev && failUp.ev.result === "fail", `실패 이벤트 수신`);

    console.log("[5] 방어구 ★5 — 최대 HP +25 + 세이브 sfHp");
    const arm5 = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const p = w.player;
      p.upgrades.armor = 4;
      p.addGold(100000);
      const hpBefore = p.maxHp;
      const origRandom = Math.random;
      Math.random = () => 0.01;
      const r = p.tryUpgrade("armor");
      Math.random = origRandom;
      w.save();
      const save = w.buildSave(w.stageDef.key);
      return { r, up: p.upgrades.armor, hpDelta: p.maxHp - hpBefore, sfHp: save.sfHp, applied: p.starHpApplied };
    });
    ok(arm5.r === "ok" && arm5.up === 5, `방어구 ★5 (성 ${arm5.up})`);
    ok(arm5.hpDelta === 25, `최대 HP +25 (실측 +${arm5.hpDelta})`);
    ok(arm5.sfHp === 25 && arm5.applied === 25, `세이브 sfHp=25 (실측 ${arm5.sfHp}/${arm5.applied})`);

    console.log("[6] 오라 티어 + ★15 궤도성");
    const aura = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const p = w.player;
      p.upgrades.weapon = 2;
      w.syncUpgradeGlow();
      const none = !w.upgradeGlow;
      p.upgrades.weapon = 6;
      w.syncUpgradeGlow();
      const t1 = !!w.upgradeGlow && w.glowTier === 1;
      p.upgrades.weapon = 12;
      w.syncUpgradeGlow();
      const t2 = !!w.upgradeGlow && w.glowTier === 2;
      p.upgrades.weapon = 15;
      w.syncUpgradeGlow();
      const t3 = !!w.upgradeGlow && w.glowTier === 3 && w.sfOrbits.length === 2;
      p.upgrades.weapon = 1;
      w.syncUpgradeGlow();
      const cleared = !w.upgradeGlow && w.sfOrbits.length === 0;
      return { none, t1, t2, t3, cleared };
    });
    ok(aura.none, "★2 — 오라 없음");
    ok(aura.t1, "★6 — 청록 오라 (티어1)");
    ok(aura.t2, "★12 — 보라 오라 (티어2)");
    ok(aura.t3, "★15 — 금색 오라 + 궤도성 2기");
    ok(aura.cleared, "★1 복귀 — 오라/궤도성 소멸");

    console.log("[7] 상점 UI — 스타포스 패널 (성 15칸 + 마일스톤 안내)");
    await page.evaluate(() => window.__SERTZ_EB__.emit("ui:panel", { panel: "shop" }));
    await page.waitForTimeout(400);
    const uiTitle = await page.locator("text=스타포스 강화").first().isVisible().catch(() => false);
    const uiLegend = await page.locator("text=★5 무기 공격+4·치명+2% / 방어구 HP+25").first().isVisible().catch(() => false);
    const uiStars = await page.evaluate(() => {
      const bars = [...document.querySelectorAll("div.flex.items-center.gap-\\[2px\\]")];
      let stars = 0;
      for (const b of bars) stars += [...b.querySelectorAll("span")].filter((s) => s.textContent === "★").length;
      return { bars: bars.length, stars };
    });
    ok(uiTitle, "「스타포스 강화」 섹션 표시");
    ok(uiLegend, "마일스톤 효과 안내 표시");
    ok(uiStars.stars === 30, `성 바 15칸 × 2슬롯 = 30 (실측 ${uiStars.stars})`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);

    console.log("[8] 세이브 복원 — sfHp 중복 가산 방지");
    const hpBeforeRestart = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      return w.player.maxHp;
    });
    await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const carry = w.buildSave(w.stageDef.key);
      w.scene.restart({ stage: w.stageDef.key, save: carry });
    });
    await page.waitForTimeout(1800);
    await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      if (w.dialoguing) w.resumeFromDialogue();
      w.dialoguing = false; w.introStep = -1; w.sleepPending = false;
      w.physics.world.resume();
    });
    await page.waitForTimeout(300);
    const hpAfterRestart = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      return { maxHp: w.player.maxHp, applied: w.player.starHpApplied };
    });
    ok(hpAfterRestart.maxHp === hpBeforeRestart, `재시작 후 maxHp 불변 (before ${hpBeforeRestart} / after ${hpAfterRestart.maxHp})`);
    ok(hpAfterRestart.applied === 25, `sfHp 복원 (실측 ${hpAfterRestart.applied})`);

    /* ============ [요구2] 조이스틱 — 모바일 뷰포트 ============ */
    console.log("[9] 조이스틱 인식 범위 — 좌하단 46%×55% (모바일 뷰포트)");
    const page2 = await browser.newPage({ viewport: { width: 760, height: 720 } });
    page2.on("pageerror", (e) => console.log("PAGEERROR2:", String(e).slice(0, 200)));
    await enterWorld(page2);
    const joyRect = await page2.evaluate(() => {
      const el = document.querySelector('div[class*="h-\\[55\\%\\]"]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, height: r.height, width: r.width, vh: window.innerHeight, vw: window.innerWidth };
    });
    ok(!!joyRect, "조이스틱 영역 div 존재");
    if (joyRect) {
      ok(Math.abs(joyRect.height / joyRect.vh - 0.55) < 0.02,
        `높이 55% (실측 ${(100 * joyRect.height / joyRect.vh).toFixed(1)}%)`);
      ok(Math.abs(joyRect.top / joyRect.vh - 0.45) < 0.02,
        `상단 경계 45% 지점 (실측 ${(100 * joyRect.top / joyRect.vh).toFixed(1)}%)`);
      ok(Math.abs(joyRect.width / joyRect.vw - 0.46) < 0.02,
        `폭 46% (실측 ${(100 * joyRect.width / joyRect.vw).toFixed(1)}%)`);
    }

    console.log("[10] NPC 상호작용 칩 — 조이스틱 위 렌더 + 탭으로 GM 패널 오픈");
    // GM NPC 근처로 텔레포트
    await page2.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const gm = w.interactables.find((it) => it.kind === "gm");
      if (gm) {
        const p = w.player;
        if (p.body && p.body.reset) p.body.reset(gm.x + 55, gm.y);
        else { p.x = gm.x + 55; p.y = gm.y; }
      }
    });
    await page2.waitForTimeout(800);
    // 칩 식별: rounded-full + pointer-events-auto 상호작용 버튼 (GM 텍스트)
    const chip = await page2.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      const chipBtn = btns.find(
        (b) =>
          b.className.includes("rounded-full") &&
          b.className.includes("pointer-events-auto") &&
          b.className.includes("absolute") &&
          (b.textContent ?? "").includes("GM")
      );
      if (!chipBtn) return { found: false };
      const r = chipBtn.getBoundingClientRect();
      // RAF 기준점(style.left/top) = 칩 하단 중심 (translate(-50%,-100%))
      const ax = parseFloat(chipBtn.style.left || "0");
      const ay = parseFloat(chipBtn.style.top || "0");
      const cx = Number.isFinite(ax) && ax > 0 ? ax : r.left + r.width / 2;
      const cy = Number.isFinite(ay) && ay > 0 ? ay - 8 : r.top + r.height / 2;
      const top = document.elementFromPoint(cx, cy);
      return {
        found: true,
        click: { x: cx, y: cy },
        rect: { x: r.left, y: r.top, w: r.width, h: r.height },
        tapTargetIsChip: !!top && (top === chipBtn || chipBtn.contains(top)),
      };
    });
    ok(chip.found, "상호작용 칩 렌더 (GM)");
    if (chip.found) {
      ok(chip.tapTargetIsChip, `칩 중심 탭 최상단 = 칩 버튼 (조이스틱에 가려지지 않음)`);
      // 실제 탭 → GM 패널 오픈
      await page2.mouse.click(chip.click.x, chip.click.y);
      await page2.waitForTimeout(500);
      const gmPanel = await page2.evaluate(() => !!document.querySelector('button[aria-label="GM 패널 닫기"]'));
      ok(gmPanel, "칩 탭 → GM 패널 오픈 (NPC 상호작용 성공)");
      await page2.keyboard.press("Escape");
      await page2.waitForTimeout(250);
    }

    console.log("[11] 조이스틱 이동 동작 유지 — 좌하단 드래그로 이동");
    // 이동 진단: input:move 이벤트 흐름 카운터
    await page2.evaluate(() => {
      const EB = window.__SERTZ_EB__;
      window.__moveCnt = 0;
      window.__moveLast = null;
      EB.on("input:move", (v) => { window.__moveCnt++; window.__moveLast = { x: v.x, y: v.y }; });
    });
    const posBefore = await page2.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      return { x: w.player.x, y: w.player.y, state: w.player.state };
    });
    // 좌하단 영역 내 (180, 600) → 위로 드래그 (180, 540)
    await page2.mouse.move(180, 600);
    await page2.mouse.down();
    await page2.mouse.move(180, 540, { steps: 5 });
    await page2.waitForTimeout(650);
    await page2.mouse.up();
    await page2.waitForTimeout(200);
    const posAfter = await page2.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      return { x: w.player.x, y: w.player.y, state: w.player.state, cnt: window.__moveCnt, last: window.__moveLast };
    });
    console.log(`    이벤트 ${posAfter.cnt}회 last=${JSON.stringify(posAfter.last)} state=${posAfter.state} dy=${(posBefore.y - posAfter.y).toFixed(1)}`);
    ok(posAfter.cnt > 3, `input:move 이벤트 발생 (${posAfter.cnt}회)`);
    ok(posBefore.y - posAfter.y > 15, `위로 이동 (dy=${(posBefore.y - posAfter.y).toFixed(1)})`);

    await page2.close();
  } catch (e) {
    console.error("TEST ERROR:", e);
    fail++;
  } finally {
    await browser.close();
    srv.kill();
  }
  console.log(`\n===== v3.0.5 E2E 결과: ${pass} PASS / ${fail} FAIL =====`);
  process.exit(fail > 0 ? 1 : 0);
})();
