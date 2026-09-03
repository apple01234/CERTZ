const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required", "--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("http://127.0.0.1:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("canvas", { timeout: 20000 });
  await page.waitForTimeout(2500);
  // 페이지 상태 진단
  const diag = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")].map((b) => b.textContent.trim().slice(0, 24)).filter(Boolean);
    const s = (window).__SERTZ_SCENE__;
    return { btns: btns.slice(0, 12), hasScene: !!s, sceneKey: s?.scene?.settings?.key ?? null, hasPlayer: !!s?.player };
  });
  console.log(JSON.stringify(diag, null, 1));
  // 새로운 모험 클릭
  const clicked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.includes("새로운 모험"));
    if (btn) { btn.click(); return true; }
    return false;
  });
  console.log("clickedNew:", clicked);
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(1500);
    const st = await page.evaluate(() => {
      const s = (window).__SERTZ_SCENE__;
      const namePanel = !!document.querySelector("input[maxlength='8']");
      return { hasScene: !!s, hasPlayer: !!s?.player, namePanel };
    });
    if (st.hasPlayer) { console.log("world entered at iter", i); break; }
    if (st.namePanel && !st.hasPlayer) {
      await page.fill("input[maxlength='8']", "테스터");
      await page.evaluate(() => {
        const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.includes("이 이름으로"));
        btn?.click();
      });
    }
  }
  const fin = await page.evaluate(() => {
    const s = (window).__SERTZ_SCENE__;
    return { hasScene: !!s, hasPlayer: !!s?.player, stage: s?.stageDef?.key ?? null };
  });
  console.log("final:", JSON.stringify(fin));
  console.log("pageerrors:", errors.length, errors.slice(0, 3));
  await browser.close();
})();
