/* v2.3 디버그 프로브 — [2] 재입장 대사 로그 + [7] T키 스탯 패널 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const PORT = 3108;
const URL = `http://localhost:${PORT}`;
const W = () => `window.__SERTZ__.game.scene.getScene("world")`;

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: "/home/z/my-project", env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 500)); try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) break; } catch {} }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("text=새로운 모험", { timeout: 60000 });
  await page.click("text=새로운 모험");
  for (let i = 0; i < 40; i++) {
    const inWorld = await page.evaluate(() => !!(window.__SERTZ__?.game?.scene.getScene("world")?.player));
    if (inWorld) break;
    await page.mouse.click(640, 400); await page.keyboard.press("e"); await page.waitForTimeout(400);
  }
  await page.waitForTimeout(900);
  // 대사 로거 설치
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    window.__DLG__ = [];
    const orig = w.showDialogue.bind(w);
    w.showDialogue = (id, npc) => { window.__DLG__.push({ id, t: Date.now() }); return orig(id, npc); };
    const origOnce = w.showDialogueOnce.bind(w);
    w.showDialogueOnce = (id, npc) => { window.__DLG__.push({ id, once: true }); return origOnce(id, npc); };
  });
  // 인트로 정상 완료 시뮬레이션 — finishIntro 직접 호출(이름 세팅 포함)
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.finishIntro("테스터");
  });
  await page.waitForTimeout(800);
  for (let i = 0; i < 5; i++) { await page.keyboard.press("Space"); await page.waitForTimeout(300); }
  console.log("A) 인트로 완료 후 DLG:", JSON.stringify(await page.evaluate(() => window.__DLG__)));
  console.log("A) seen:", JSON.stringify(await page.evaluate(() => [...window.__SERTZ__.game.scene.getScene("world").seenSet])));
  console.log("A) playerName 세이브:", JSON.stringify(await page.evaluate(() => JSON.parse(window.localStorage.getItem("sertz_save_v2") || "{}").playerName)));

  // 재입장 1 — 대사 나오면 안 됨 (villageIntro 기록됨)
  await page.evaluate(() => {
    window.__DLG__.length = 0;
    const w = window.__SERTZ__.game.scene.getScene("world");
    const carry = w.buildSave("village");
    w.scene.restart({ stage: "village", save: carry });
  });
  await page.waitForTimeout(2400);
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    window.__DLG__.push({ dialoguing_now: w.dialoguing });
  });
  console.log("B) 재입장1 DLG:", JSON.stringify(await page.evaluate(() => window.__DLG__)));
  console.log("B) dialoguing:", await page.evaluate(() => window.__SERTZ__.game.scene.getScene("world").dialoguing));

  // T키 스탯 패널 — 캔버스 클릭 후 포커스
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.dialoguing = false; w.introStep = -1; w.player.ap = 7; w.emitRpgState(); w.emitHud();
  });
  await page.mouse.click(640, 400);
  await page.waitForTimeout(200);
  await page.keyboard.press("t");
  await page.waitForTimeout(700);
  const btn = await page.$('button[aria-label="AP 자동 배분"]');
  console.log("C) T키 후 버튼 노출:", !!btn);
  const panelHtml = await page.evaluate(() => {
    const panels = document.querySelectorAll(".rounded-xl");
    return panels.length;
  });
  console.log("C) 패널 개수:", panelHtml);
  await page.screenshot({ path: "/home/z/my-project/scripts/v23-probe-stat.png" });

  await browser.close();
  srv.kill();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
