/**
 * v1.4.3 모바일 진입 실패 — 단계별 DOM 진단
 */
const { chromium } = require("playwright");

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, userAgent: "Mozilla/5.0 (Linux; Android 13) Chrome/120 Mobile" });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 240) + " @ " + (e.stack?.split("\n")[1] || "").trim().slice(0, 160)));
  p.on("console", (m) => { if (m.type() === "error" && !m.text().includes("404")) errs.push("CONSOLE: " + m.text().slice(0, 180)); });

  await p.goto("http://localhost:4599/index.html", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(3500);

  const dump = (tag) => p.evaluate((t) => {
    const btns = Array.from(document.querySelectorAll("button")).map((x) => {
      const r = x.getBoundingClientRect();
      return { t: (x.textContent || "").trim().slice(0, 18), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), vis: r.width > 0 && r.height > 0 };
    });
    return { tag: t, inputs: document.querySelectorAll("input").length, btns: btns.filter((b) => b.vis), bodySnippet: document.body.innerText.slice(0, 200).replace(/\n+/g, " / ") };
  }, tag).then((d) => console.log(JSON.stringify(d, null, 1).slice(0, 900)));

  /* 타이틀 */
  await dump("① 타이틀");
  /* 게임 시작 클릭 */
  await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("게임 시작"))?.click());
  await p.waitForTimeout(1800);
  await dump("② 로비");
  /* 캐릭터 생성 클릭 */
  await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click());
  await p.waitForTimeout(1200);
  await dump("③ 생성 클릭 후");
  await p.screenshot({ path: "/home/z/my-project/scripts/shot_diag_mobile_land.png" });
  console.log("errs:", errs.length ? errs.join("\n") : 0);
  await b.close();
})();
