const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required", "--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("http://127.0.0.1:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.evaluate(() => { try { localStorage.removeItem("sertz.save"); } catch {} });
  await page.waitForSelector("canvas", { timeout: 20000 });
  // 버튼 폴링 (하이드레이션 대기)
  let clicked = false;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(1000);
    clicked = await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.includes("새로운 모험"));
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (clicked) break;
  }
  console.log("clickedNew:", clicked);
  let entered = false;
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(1500);
    const st = await page.evaluate(() => {
      const s = (window).__SERTZ_SCENE__;
      const namePanel = !!document.querySelector("input[maxlength='8']");
      if (namePanel && s?.player) {
        return { namePanel, hasPlayer: true };
      }
      return { namePanel, hasPlayer: !!s?.player };
    });
    if (st.namePanel && !st.named) {
      await page.fill("input[maxlength='8']", "테스터");
      await page.evaluate(() => {
        const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.includes("이 이름으로"));
        btn?.click();
      });
      st.named = true;
    }
    if (st.hasPlayer && i > 2) { entered = true; console.log("entered at", i); break; }
  }
  console.log("entered:", entered);
  if (entered) {
    const result = await page.evaluate(() => new Promise((res) => {
      const scene = (window).__SERTZ_SCENE__;
      scene.spawnReplayBoss("forest");
      setTimeout(() => {
        const b = scene.boss;
        res({
          boss: b ? { name: b.def?.name ?? b.name, hp: b.maxHp ?? b.hp, atk: b.def?.atk } : null,
          flag: scene.replayBossActive,
          hpText: (document.body.innerText.match(/재림한[^\n]*/) || [null])[0],
        });
      }, 3200);
    }));
    console.log(JSON.stringify(result, null, 1));
  }
  console.log("pageerrors:", errors.length, errors.slice(0, 3));
  await browser.close();
})();
