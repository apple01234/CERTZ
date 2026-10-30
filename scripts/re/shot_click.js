/* 실제 사용자 경로(마우스 클릭 → EventBus game:new)로 인게임 진입해 캡처 */
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
  await p.waitForTimeout(9000);

  // "게임 시작" 버튼은 Phaser 캔버스 안의 InteractiveObject — 중앙 CTA 영역을 실제 클릭
  const vp = p.viewportSize();
  await p.mouse.click(vp.width / 2, vp.height / 2);
  await p.waitForTimeout(1500);
  let sc = await p.evaluate(() => window.__SERTZ__?.game?.scene.getScenes(true).map(s=>s.scene.key) ?? []);
  console.log("클릭1 후 씬:", JSON.stringify(sc));

  // 캔버스 클릭이 안 먹으면 EventBus 로 사용자 액션과 동일 경로 실행
  if (!sc.includes("world")) {
    await p.evaluate(() => { window.__SERTZ__.EventBus.emit("game:new", {}); });
    await p.waitForTimeout(1000);
    sc = await p.evaluate(() => window.__SERTZ__?.game?.scene.getScenes(true).map(s=>s.scene.key) ?? []);
    console.log("game:new 후 씬:", JSON.stringify(sc));
  }
  await p.waitForTimeout(13000);   // 로더 완료 + fadeOut/fadeIn 종료 대기

  const st = await p.evaluate(() => {
    const g = window.__SERTZ__.game;
    const w = g.scene.getScene("world");
    const cam = w?.cameras?.main;
    const cv = document.querySelector("canvas");
    const tmp = document.createElement("canvas"); tmp.width=64; tmp.height=64;
    const ctx = tmp.getContext("2d"); ctx.drawImage(cv, 0, 0, 64, 64);
    const d = ctx.getImageData(0,0,64,64).data;
    let s=0; for (let i=0;i<d.length;i+=4) s += d[i]+d[i+1]+d[i+2];
    return {
      scenes: g.scene.getScenes(true).map(x=>x.scene.key),
      brightness: Math.round(s/(3*(d.length/4))),
      zoom: cam?.zoom, camAlpha: cam?.alpha,
      fadeRunning: !!cam?.fadeEffect?.isRunning,
      stageW: w?.stageW, stageH: w?.stageH,
      player: !!w?.player,
      titleObjs: g.scene.getScene("title")?.children?.list?.length ?? 0,
    };
  });
  console.log("상태:", JSON.stringify(st));

  const cv = await p.$("canvas");
  await cv.screenshot({ path: `${OUT}/shot_ingame.png` });
  await p.screenshot({ path: `${OUT}/shot_skills2.png`,
    clip: { x: vp.width*0.52, y: vp.height*0.60, width: vp.width*0.48, height: vp.height*0.40 } });
  console.log("pageerror:", errs.length, errs.slice(0,2));
  await b.close();
})();
