/* 실제 사용자 경로 그대로: 페이지 로드 → 타이틀 "게임 시작" 1회 클릭 → 인게임 캡처 */
const { chromium } = require("playwright");
const CHROME = "/root/.cache/ms-playwright/chromium-1234/chrome-linux/chrome";
const URL = process.env.URL || "http://127.0.0.1:3047";
const OUT = "/root/.hermes/cache/scratch";

(async () => {
  const b = await chromium.launch({ executablePath: CHROME,
    args: ["--no-sandbox","--disable-dev-shm-usage","--use-gl=swiftshader"] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0,140)));
  await p.goto(URL, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(10000);   // 타이틀 + 지연 로드 안정화

  // 클릭은 **1회만** — launched 플래그가 중복 진입을 막으므로 두 번 보내면 안 된다
  await p.evaluate(() => { window.__SERTZ__.EventBus.emit("game:new", {}); });
  await p.waitForTimeout(16000);   // 420ms + 로더 + fadeOut 400ms + fadeIn

  const st = await p.evaluate(() => {
    const g = window.__SERTZ__.game;
    const w = g.scene.getScene("world");
    const cam = w?.cameras?.main;
    const cv = document.querySelector("canvas");
    const t = document.createElement("canvas"); t.width=64; t.height=64;
    const c = t.getContext("2d"); c.drawImage(cv,0,0,64,64);
    const d = c.getImageData(0,0,64,64).data; let s=0;
    for (let i=0;i<d.length;i+=4) s += d[i]+d[i+1]+d[i+2];
    const title = g.scene.getScene("title");
    return {
      bright: Math.round(s/(3*(d.length/4))),
      scenes: g.scene.getScenes(true).map(x=>x.scene.key),
      titleStatus: title?.scene.settings.status, titleVis: title?.scene.settings.visible,
      zoom: cam?.zoom, fadeRunning: !!cam?.fadeEffect?.isRunning,
      player: !!w?.player, stageW: w?.stageW, stageH: w?.stageH,
      groundTs: w?.groundTs ? true : false,
    };
  });
  console.log("상태:", JSON.stringify(st));

  const cv = await p.$("canvas");
  await cv.screenshot({ path: `${OUT}/shot_ingame.png` });
  const vp = p.viewportSize();
  await p.screenshot({ path: `${OUT}/shot_skills2.png`,
    clip: { x: vp.width*0.50, y: vp.height*0.58, width: vp.width*0.50, height: vp.height*0.42 } });
  console.log("pageerror:", errs.length, errs.slice(0,2));
  await b.close();
})();
