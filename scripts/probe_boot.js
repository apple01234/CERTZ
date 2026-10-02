const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({
    executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome",
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 400, height: 720 } });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 300)));
  page.on("console", (m) => { const t = m.text(); if (t.startsWith("[") || /error/i.test(m.type())) console.log("CON:", t.slice(0, 160)); });
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(9000);
  const dump = async (tag) => {
    const d = await page.evaluate(() => ({
      btns: Array.from(document.querySelectorAll("button")).map((b) => (b.textContent ?? "").trim().slice(0, 24)).slice(0, 14),
      inp: !!document.querySelector("input"),
      boot: typeof window.__SERTZ_BOOT__ !== "undefined",
      scene: !!window.__SERTZ_SCENE__,
    }));
    console.log(`[${tag}]`, JSON.stringify(d));
    return d;
  };
  await dump("t+9s");
  const click = async (n) => page.evaluate((x) => {
    const el = Array.from(document.querySelectorAll("button")).find((b) => (b.textContent ?? "").includes(x));
    if (el) { el.click(); return true; } return false;
  }, n);
  console.log("click 게임 시작:", await click("게임 시작"));
  await page.waitForTimeout(2500);
  await dump("after-start");
  console.log("click 캐릭터 생성:", await click("캐릭터 생성"));
  await page.waitForTimeout(2000);
  await dump("after-create-card");
  // 이름 입력
  const hasInp = await page.evaluate(() => !!document.querySelector("input"));
  console.log("input?", hasInp);
  if (hasInp) {
    await page.evaluate(() => {
      const inp = document.querySelector("input");
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      s.call(inp, "플리커");
      inp.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  await dump("after-name");
  const nexts = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const nx = btns.find((b) => (b.textContent ?? "").includes("다음"));
    if (nx) { nx.click(); return nx.textContent.trim(); } return "NO-NEXT";
  });
  console.log("next click:", nexts);
  await page.waitForTimeout(1500);
  await dump("step2");
  const mk = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const mk = btns.find((b) => /로 생성!/.test(b.textContent ?? ""));
    if (mk) { mk.click(); return mk.textContent.trim(); } return "NO-CREATE";
  });
  console.log("create click:", mk);
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(1500);
    const ok = await page.evaluate(() => !!window.__SERTZ_SCENE__);
    if (ok) { console.log("WORLD OK at", i); break; }
  }
  const fin = await page.evaluate(() => !!window.__SERTZ_SCENE__);
  console.log("final in-world:", fin);
  await browser.close();
})().catch((e) => { console.error("FAIL:", e); process.exit(1); });
