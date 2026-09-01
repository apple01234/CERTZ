/* 디버그 — 룬 퍼즐 순서 추적 */
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
    await page.goto(`${URL}/atlantis`, { waitUntil: "domcontentloaded" });
    const t0 = Date.now();
    while (Date.now() - t0 < 30000) { if ((await page.evaluate(() => window.__ATL_STEP)) === "done") break; await sleep(250); }
    await page.getByText("새로운 모험").click();
    await sleep(2000);
    await page.evaluate(() => window.__ATL__.warp("alfheim"));
    await sleep(2500);
    await page.evaluate(() => window.__ATL__.god(true));

    const runeAt = async (id) => {
      const r = await page.evaluate((k) => {
        const s = window.__ATL__.scene();
        const it = s.interactables.find((t) => t.kind === "rune" && String(t.data.id) === k);
        return it ? { x: it.obj.x, y: it.obj.y } : null;
      }, id);
      await page.evaluate(({ tx, ty }) => { const s = window.__ATL__.scene(); s.player.setPosition(tx, ty); s.player.body.reset(tx, ty); }, { tx: r.x, ty: r.y });
      await sleep(200);
      const near = await page.evaluate(() => {
        const s = window.__ATL__.scene();
        return { near: s.nearInteract?.data?.id ?? null, kind: s.nearInteract?.kind ?? null };
      });
      await page.evaluate(() => window.__ATL__.interact());
      await sleep(150);
      const st = await page.evaluate(() => { const s = window.__ATL__.scene(); return { step: s.runeStep, flags: window.__ATL__.G().flags }; });
      console.log(`${id}: near=${near.near}(${near.kind}) runeStep=${st.step}`);
      return st;
    };

    await runeAt("rune2"); // 오답
    const r1 = await runeAt("rune1");
    const r2 = await runeAt("rune2");
    const r3 = await runeAt("rune3");
    console.log("final flags:", JSON.stringify(r3.flags));
    const chests = await page.evaluate(() => window.__ATL__.scene().interactables.filter((t) => t.kind === "chest").map((t) => t.data.def.id));
    console.log("chests:", chests.join(","));
  } catch (e) { console.error("ERR", e); } finally { if (browser) await browser.close(); srv.kill("SIGKILL"); }
})();
