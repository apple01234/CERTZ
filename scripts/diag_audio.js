/* 오디오 상태 진단 — playing:false 원인 규명용 일회성 스크립트 */
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required", "--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto("http://127.0.0.1:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("canvas", { timeout: 20000 });
  await page.waitForTimeout(2500);
  await page.mouse.click(640, 360);
  await page.waitForTimeout(1200);
  const diag = await page.evaluate(() => {
    const g = (window).__SERTZ__?.game;
    if (!g) return { no: "game" };
    const sm = g.sound;
    const b = (window).__SERTZ_DEBUG__.bgm;
    const cacheExists = g.cache.audio.exists("bgm_village1");
    b.playBGM("village");
    const immediate = {
      count: (sm.sounds || []).length,
      keys: (sm.sounds || []).filter((s) => s.key?.startsWith("bgm_")).map((s) => s.key),
    };
    return new Promise((res) => setTimeout(() => {
      const sounds = (sm.sounds || []).filter((s) => s.key && s.key.startsWith("bgm_")).map((s) => ({
        key: s.key, isPlaying: s.isPlaying, isPaused: s.isPaused, totalDuration: s.totalDuration,
      }));
      res({
        hidden: document.hidden,
        visState: document.visibilityState,
        cacheExists,
        immediate,
        ctxState: sm.context ? sm.context.state : "none",
        locked: sm.locked,
        mute: sm.mute,
        pauseOnBlur: sm.pauseOnBlur,
        sounds,
        debug: b.bgmDebugState(),
      });
    }, 1500));
  });
  console.log(JSON.stringify(diag, null, 1));
  await browser.close();
})();
