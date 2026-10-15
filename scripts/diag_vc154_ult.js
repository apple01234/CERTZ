/** diag_vc154_ult.js — 블레이드마스터 100연타 스톨 진단 (hitText 시계열 + 씬 상태 샘플) */
const { chromium } = require("playwright");
const { spawn } = require("child_process");

const PORT = 3124;
const URL = `http://localhost:${PORT}`;

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production", PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 500)); try { const r2 = await fetch(`${URL}/api/version`); if (r2.ok) break; } catch {} }
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"], executablePath: "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome" });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => console.log("PAGEERR:", String(e).slice(0, 100)));
  page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE:", m.text().slice(0, 100)); });

  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.waitForSelector("text=게임 시작", { timeout: 40000 });
  await page.getByRole("button", { name: /게임 시작/ }).first().click();
  await page.waitForTimeout(900);
  const cb = page.getByText("캐릭터 생성", { exact: false }).first();
  if ((await cb.count()) > 0) await cb.click().catch(() => {});
  await page.waitForTimeout(400);
  const ni = page.locator('input[placeholder*="캐릭터 이름"]').first();
  if ((await ni.count()) > 0) {
    await ni.fill("진단");
    await page.getByRole("button", { name: /다음 — 외형 선택/ }).first().click().catch(() => {});
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /모험가로 생성!/ }).first().click().catch(() => {});
    await page.waitForTimeout(900);
  }
  await page.getByText("진단").first().click({ timeout: 6000 }).catch(() => {});
  await page.getByRole("button", { name: /이 캐릭터로 시작/ }).first().click({ timeout: 15000 }).catch(() => {});
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000);
    const st = await page.evaluate(() => { const w = window.__SERTZ__?.game?.scene?.getScene("world"); return w ? w.children.list.length : -1; });
    if (st > 20) break;
  }
  await page.evaluate(() => { try { window.__SERTZ__.game.scene.getScene("world").finishIntro("진단"); } catch {} });
  for (let i = 0; i < 14; i++) {
    const dlg = await page.evaluate(() => { const w = window.__SERTZ__.game.scene.getScene("world"); if (w?.dialoguing) { w.resumeFromDialogue(); return true; } return false; });
    if (!dlg) break;
    await page.waitForTimeout(250);
  }

  /* 사냥터로 이동 (적 있는 곳) */
  await page.evaluate(() => {
    const w0 = window.__SERTZ__.game.scene.getScene("world");
    const stage = "forest1";
    const base = w0.buildSave(stage) || {};
    base.stage = stage;
    w0.scene.restart({ stage, save: base });
  });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.dialoguing = false; w.introStep = -1; w.sleepPending = false;
    if (w.physics?.world) w.physics.world.resume();
    try { w.player.gmSetClass("blademaster"); } catch (e) { console.log("gmSetClass err", e); }
    try { w.player.gmSetLevel(220); } catch {}
    w.player.healFull();
  });
  await page.waitForTimeout(1200);
  for (let i = 0; i < 8; i++) {
    const dlg = await page.evaluate(() => { const w = window.__SERTZ__.game.scene.getScene("world"); if (w?.dialoguing) { w.resumeFromDialogue(); return true; } return false; });
    if (!dlg) break;
    await page.waitForTimeout(250);
  }

  /* 궁극기 발동 — 시계열 샘플 */
  await page.evaluate(() => { window.__SERTZ__.game.scene.getScene("world").player.useSkill5(); });
  for (const ms of [800, 1600, 2600, 3600, 4600, 5600, 6600, 7600]) {
    await page.waitForTimeout(ms === 800 ? 800 : 1000);
    const s = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const hit = [...document.querySelectorAll("div")].find((d) => d.children.length === 0 && /^\d+ HIT$/.test((d.textContent || "").trim()));
      const kanji = [...document.querySelectorAll("div")].find((d) => d.children.length === 0 && d.textContent === "死");
      const hb = [...document.querySelectorAll("div")].find((d) => d.children.length === 0 && (d.style.cssText || "").includes("text-align:right") && (d.style.cssText || "").includes("Noto Serif"));
      return { hit: hit ? hit.textContent.trim() : null, hitBoxExists: !!hb, hitBoxText: hb ? JSON.stringify(hb.textContent) : null, hitBoxOpacity: hb ? hb.style.opacity : null, kanji: !!kanji, dialoguing: w.dialoguing, state: w.player?.state, lv: w.player?.lv, cls: w.player?.cls, fps: Math.round(w.game?.loop?.actualFps ?? 0) };
    });
    console.log(`t≈${ms}ms`, JSON.stringify(s));
  }
  await browser.close();
  try { srv.kill(); } catch {}
  process.exit(0);
})().catch((e) => { console.error("DIAG FAIL", e); process.exit(1); });
