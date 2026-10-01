/* gofile 페이지에서 contents API 응답 가로채기 → 직접 다운로드 링크 추출 */
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
    if (/gofile\.io\/contents\/|\/contents\//.test(url) && !captured) {
      try {
        const j = await res.json();
        if (j && j.status === "ok" && j.data) {
          captured = j;
          console.log("CAPTURED:", url);
        }
      } catch {}
    }
  });

  console.log("페이지 접속 중...");
  await page.goto("https://gofile.io/d/Tcsl6sY2", { waitUntil: "networkidle", timeout: 60000 }).catch(e => console.log("goto:", e.message));
  await page.waitForTimeout(5000);

  if (!captured) {
    console.log("contents 응답 미포착, 페이지 타이틀:", await page.title());
  } else {
    // 재귀적으로 children 탐색하여 링크 수집
    const walk = (node) => {
      if (!node) return;
      if (node.directLink) console.log("DIRECT:", node.directLink, "|", node.name, "|", node.size);
      if (node.children) for (const k of Object.keys(node.children)) walk(node.children[k]);
    };
    walk(captured.data);
    console.log("RAW:", JSON.stringify(captured).slice(0, 2000));
  }

  await browser.close();
})();
