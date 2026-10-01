/* 새 gofile 링크 검증: 파일 존재 + 다운로드 시작 지연 측정 (콜드 vs 핫 비교) */
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

  await page.goto("https://gofile.io/d/qUiPRRXl", { waitUntil: "networkidle", timeout: 60000 }).catch(e => console.log("goto:", e.message));
  await page.waitForTimeout(4000);

  if (!captured) { console.log("FAIL: contents 미포착"); await browser.close(); return; }

  let direct = null, meta = null;
  const walk = (node) => {
    if (!node) return;
    if (node.type === "file" && node.link) { direct = node.link; meta = node; }
    if (node.children) for (const k of Object.keys(node.children)) walk(node.children[k]);
  };
  walk(captured.data);
  console.log("FILE:", meta?.name, "| SIZE:", meta?.size, "| MD5:", meta?.md5);
  console.log("SERVER:", meta?.serverSelected || meta?.servers);
  console.log("DIRECT:", direct);

  if (direct) {
    const t0 = Date.now();
    const resp = await ctx.request.get(direct, { headers: { Referer: "https://gofile.io/" }, timeout: 180000 });
    const ttfb = Date.now() - t0;
    console.log("HTTP:", resp.status(), "| first_byte_ms:", ttfb);
    if (resp.status() === 200) {
      const buf = await resp.body();
      console.log("SIZE:", buf.length, "| MAGIC:", buf.slice(0, 2).toString());
    }
  }
  await browser.close();
})();
