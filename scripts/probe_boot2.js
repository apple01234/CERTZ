const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({
    executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome",
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 850, height: 400 } });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 300)));
  page.on("console", (m) => console.log(`[${m.type()}]`, m.text().slice(0, 200)));
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(8000);
  await page.evaluate(() => {
    const id = "c_flick01";
    const now = Date.now();
    const meta = { id, name: "플리커", cls: "warrior", lv: 1, stage: "village", cleared: false, lastSeen: now, createdAt: now, rebirths: 0, lookTint: null, gender: "m", skinIdx: 2 };
    const save = { stage: "village", lv: 1, exp: 0, maxHp: 100, atk: 10, cleared: false, maxMp: 60, playerName: "플리커", cls: "warrior", startCls: "warrior", gold: 30, lookTint: null, gender: "m", skinIdx: 2, introSeen: true };
    localStorage.setItem("sertz_slots_v1", JSON.stringify({ slots: 4, chars: { [id]: meta }, activeId: null }));
    localStorage.setItem("sertz_char_" + id, JSON.stringify(save));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  console.log("--- 클릭 전 버튼:", await page.evaluate(() => Array.from(document.querySelectorAll("button")).map(b => (b.textContent ?? "").trim().slice(0, 16)).slice(0, 8)));
  const r = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll("button")).find(x => (x.textContent ?? "").includes("게임 시작"));
    if (!b) return "NO-BTN";
    b.click();
    return "CLICKED";
  });
  console.log("--- 클릭:", r);
  await page.waitForTimeout(2500);
  console.log("--- 클릭 후 버튼:", await page.evaluate(() => Array.from(document.querySelectorAll("button")).map(b => (b.textContent ?? "").trim().slice(0, 16)).slice(0, 10)));
  console.log("--- lobby DOM:", await page.evaluate(() => ({
    sertzScroll: !!document.querySelector(".sertz-scroll"),
    any: Array.from(document.querySelectorAll("div")).filter(d => d.className && String(d.className).includes("z-40")).length,
  })));
  await browser.close();
})().catch((e) => { console.error("FAIL:", e); process.exit(1); });
