/* 디버그 — interactables 덤프 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const PORT = 3124;
const URL = `http://localhost:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const srv = spawn("node", ["server.js"], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production", PORT: String(PORT) }, stdio: "ignore" });
  let browser;
  try {
    await new Promise((res) => { const p = () => fetch(URL).then((r) => (r.ok ? res() : setTimeout(p, 600))).catch(() => setTimeout(p, 600)); p(); });
    browser = await chromium.launch({ args: ["--no-sandbox"] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));
    page.on("console", (m) => { if (m.text().includes("[ATL]")) console.log("[console]", m.text()); });
    await page.goto(`${URL}/atlantis`, { waitUntil: "domcontentloaded" });
    const t0 = Date.now();
    while (Date.now() - t0 < 30000) { if ((await page.evaluate(() => window.__ATL_STEP)) === "done") break; await sleep(250); }
    await page.getByText("새로운 모험").click();
    await sleep(2500);
    const dump = await page.evaluate(() => {
      const s = window.__ATL__.scene();
      return {
        step: window.__ATL_STEP,
        world: s?.worldDef?.id,
        inter: (s?.interactables || []).map((t) => ({ kind: t.kind, id: t.data?.id ?? t.data?.def?.id, hint: t.hint, ax: t.obj?.active })),
      };
    });
    console.log(JSON.stringify(dump, null, 1).slice(0, 2500));
  } catch (e) { console.error("ERR", e); } finally { if (browser) await browser.close(); srv.kill("SIGKILL"); }
})();
