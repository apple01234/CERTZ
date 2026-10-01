const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required", "--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.goto("http://127.0.0.1:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("canvas", { timeout: 20000 });
  await page.waitForTimeout(6000);
  const info = await page.evaluate(async () => {
    const g = (window).__SERTZ__?.game;
    const sm = g?.sound;
    const ctx = sm?.context;
    const out = {
      smType: sm?.constructor?.name,
      ctxState: ctx?.state,
      ctxRate: ctx?.sampleRate,
      keys: g?.cache?.audio?.getKeys()?.length,
      bgmKeys: g?.cache?.audio?.getKeys()?.filter(k => k.startsWith("bgm_")),
    };
    if (ctx) {
      try {
        const r = await fetch("assets/audio/bgm_snow3.ogg");
        out.fetchStatus = r.status;
        const buf = await r.arrayBuffer();
        out.bufSize = buf.byteLength;
        const audio = await ctx.decodeAudioData(buf);
        out.decoded = { dur: audio.duration, rate: audio.sampleRate, ch: audio.numberOfChannels };
      } catch (e) {
        out.decodeErr = String(e);
      }
    }
    return out;
  });
  console.log(JSON.stringify(info, null, 1));
  console.log("errors:", errors.slice(0, 5));
  await browser.close();
})();
