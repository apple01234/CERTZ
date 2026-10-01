/* v3.0.5 디버그 프로브 — 조이스틱/칩 최상단 요소 확인 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const PORT = 3122;
const URL = `http://localhost:${PORT}`;

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
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.dialoguing = false; w.introStep = -1; w.sleepPending = false;
  });
  await page.waitForTimeout(250);
}

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production", PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 500)); try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) break; } catch {} }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 760, height: 720 } });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 150)));

  await enterWorld(page);

  // 1) 조이스틱 영역 내 지점들의 최상단 요소
  const probe1 = await page.evaluate(() => {
    const points = [[180, 600], [180, 540], [100, 650], [180, 400], [380, 620], [180, 320]];
    return points.map(([x, y]) => {
      const el = document.elementFromPoint(x, y);
      const chain = [];
      let cur = el;
      for (let i = 0; i < 4 && cur; i++) {
        chain.push(`${cur.tagName}${cur.className && typeof cur.className === "string" ? "." + cur.className.split(" ").slice(0, 3).join(".") : ""}`);
        cur = cur.parentElement;
      }
      return { x, y, tag: el?.tagName, chain };
    });
  });
  console.log("=== 조이스틱 영역 지점 프로브 ===");
  for (const p of probe1) console.log(`(${p.x},${p.y}) → ${p.tag}\n   ${p.chain.join("\n   ")}`);

  // 2) GM 근처 이동 후 칩 최상단
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const gm = w.interactables.find((it) => it.kind === "gm");
    const p = w.player;
    if (p.body && p.body.reset) p.body.reset(gm.x + 55, gm.y);
  });
  await page.waitForTimeout(700);
  const probe2 = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const matches = btns.filter((b) => (b.textContent ?? "").includes("GM — 자유전직"));
    return matches.map((b) => {
      const r = b.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const top = document.elementFromPoint(cx, cy);
      return {
        rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
        style: { left: b.style.left, top: b.style.top },
        top: top ? `${top.tagName} ${String(top.className).slice(0, 50)} parent=${top.parentElement?.tagName}` : "null",
        topHtml: top && top.outerHTML ? top.outerHTML.slice(0, 120) : "null",
      };
    });
  });
  console.log("\n=== GM 칩 매칭 버튼들 ===");
  console.log(JSON.stringify(probe2, null, 1));

  await browser.close();
  srv.kill();
  process.exit(0);
})();
