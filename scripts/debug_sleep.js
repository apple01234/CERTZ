/* 취침 플로우 단계별 추적 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const PORT = 3109;
const URL = `http://localhost:${PORT}`;
(async () => {
  const srv = spawn("node", ["server.js"], { cwd: "/home/z/my-project", env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 500)); try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) break; } catch {} }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 160)));
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=새로운 모험", { timeout: 30000 });
  await page.click("text=새로운 모험");
  for (let i = 0; i < 30; i++) {
    const inWorld = await page.evaluate(() => { const g = window.__SERTZ__?.game; return !!(g && g.scene.getScene("world") && g.scene.getScene("world").player); });
    if (inWorld) break;
    await page.mouse.click(640, 400); await page.keyboard.press("e"); await page.waitForTimeout(400);
  }
  await page.waitForTimeout(600);
  for (let i = 0; i < 6; i++) { await page.keyboard.press("Space"); await page.waitForTimeout(300); }
  await page.evaluate(() => { const w = window.__SERTZ__.game.scene.getScene("world"); w.dialoguing = false; w.introStep = -1; });
  // 여관 입장
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const inn = w.interactables.find((i) => i.kind === "inn");
    w.player.setPosition(inn.x, inn.y + 14);
    w.player.setVelocity(0, 0);
    w.player.gold = 100;
  });
  await page.waitForTimeout(700);
  await page.keyboard.press("e");
  await page.waitForTimeout(1400);
  // 로안 앞
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.player.setPosition(w.stageW / 2 + 115, 170);
    w.player.setVelocity(0, 0);
  });
  await page.waitForTimeout(700);
  const before = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    return { near: w.nearInteract?.kind, dlgOpen: !!document.querySelector(".animate-\\[dialogueIn\\], [class*='dialogue']"), bodyHas로안: document.body.innerText.includes("로안 — 잠자기") };
  });
  console.log("대화 전:", JSON.stringify(before));
  await page.keyboard.press("e");
  await page.waitForTimeout(800);
  for (let i = 1; i <= 5; i++) {
    await page.keyboard.press("Space");
    await page.waitForTimeout(600);
    const st = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      return { pending: w.sleepPending, sleeping: w.sleeping, gold: w.player.gold, dlgText: (document.body.innerText.match(/어서 오세요|숙박은|개운해지는|부족하네요|좋은 잠자리/) || [null])[0] };
    });
    console.log(`Space#${i}:`, JSON.stringify(st));
  }
  await page.waitForTimeout(4500);
  const fin = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    return { sleeping: w.sleeping, gold: w.player.gold, buffs: w.player.buffs.map((b) => b.key) };
  });
  console.log("최종:", JSON.stringify(fin));
  await browser.close();
  srv.kill();
  process.exit(0);
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
