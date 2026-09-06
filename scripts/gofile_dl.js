/* gofile 브라우저 세션 쿠키로 실제 파일 다운로드 */
const { chromium } = require("playwright");
const fs = require("fs");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  });
  const page = await ctx.newPage();
  let directLink = null;

  page.on("response", async (res) => {
    const url = res.url();
    if (/contents\//.test(url) && !directLink) {
      try {
        const j = await res.json();
        if (j && j.status === "ok" && j.data) {
          const walk = (n) => {
            if (!n) return;
            if (n.type === "file" && n.link) directLink = n.link;
            if (n.children) for (const k of Object.keys(n.children)) walk(n.children[k]);
          };
          walk(j.data);
        }
      } catch {}
    }
  });

  console.log("페이지 접속 중...");
  await page.goto("https://gofile.io/d/Tcsl6sY2", { waitUntil: "networkidle", timeout: 60000 }).catch(e => console.log("goto:", e.message));
  await page.waitForTimeout(4000);

  if (!directLink) { console.log("직링크 미획득"); await browser.close(); process.exit(1); }
  console.log("직링크:", directLink);

  console.log("컨텍스트 요청으로 다운로드 시작 (세션 쿠키 포함)...");
  const resp = await ctx.request.get(directLink, { timeout: 0 });
  console.log("상태:", resp.status(), "| content-type:", resp.headers()["content-type"]);
  if (resp.status() !== 200) { await browser.close(); process.exit(1); }
  const buf = await resp.body();
  fs.writeFileSync("/home/z/my-project/download/SERTZ-v3.1.0.apk", buf);
  console.log("저장 완료:", buf.length, "bytes");
  await browser.close();
})();
