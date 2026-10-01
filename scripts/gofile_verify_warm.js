/* 웜 상태 재측정: 같은 파일 즉시 2회차 다운로드 */
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  });
  const page = await ctx.newPage();
  let captured = null;

  page.on("response", async (res) => {
    const url = res.url();
    if (/\/contents\//.test(url) && !captured) {
      try {
        const j = await res.json();
        if (j && j.status === "ok" && j.data) captured = j;
      } catch {}
    }
  });

  await page.goto("https://gofile.io/d/qUiPRRXl", { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3000);
  if (!captured) { console.log("FAIL"); await browser.close(); return; }

  let direct = null;
  const walk = (node) => {
    if (!node) return;
    if (node.type === "file" && node.link) direct = node.link;
    if (node.children) for (const k of Object.keys(node.children)) walk(node.children[k]);
  };
  walk(captured.data);

  const t0 = Date.now();
  const resp = await ctx.request.get(direct, { headers: { Referer: "https://gofile.io/" }, timeout: 180000 });
  console.log("2회차 HTTP:", resp.status(), "| first_byte_ms:", Date.now() - t0);
  if (resp.status() === 200) {
    const buf = await resp.body();
    console.log("SIZE:", buf.length, "| MAGIC:", buf.slice(0, 2).toString());
  }
  await browser.close();
})();
