/**
 * v1.4.2 진단 #2 — 유적 오브제 전수 덤프 + 카메라 실측 + 스크린샷.
 * 스크린샷 후 Python이 예상 화면좌표를 오버레이해 어떤 오브제가 어디에 그려지는지 대조.
 */
const { chromium } = require("playwright");

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log("PAGEERROR:", e.message.slice(0, 200)));

  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2600);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });

  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1200);
  await p.evaluate(() => { Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click(); });
  await p.waitForTimeout(700);
  await p.locator("input").first().fill("유적진단");
  await p.waitForTimeout(300);
  for (const label of ["직업 선택", "외형 선택"]) {
    await p.evaluate((lb) => { Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes(lb))?.click(); }, label);
    await p.waitForTimeout(400);
  }
  await p.evaluate(() => { Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("생성!"))?.click(); });
  await p.waitForTimeout(1400);
  await p.evaluate(() => { document.querySelector(".cursor-pointer")?.click(); });
  await p.waitForTimeout(400);
  await p.evaluate(() => { Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click(); });
  await p.waitForTimeout(2600);
  for (let i = 0; i < 4; i++) { await p.mouse.click(640, 500); await p.waitForTimeout(400); }
  for (let i = 0; i < 30; i++) {
    const w = await p.evaluate(() => !!(window.__SERTZ__?.game?.scene?.getScene("world")?.player));
    if (w) break;
    await p.waitForTimeout(400);
  }
  // 인트로 대화 스킵
  for (let i = 0; i < 30; i++) {
    const d = await p.evaluate(() => window.__SERTZ__?.game?.scene?.getScene("world")?.dialoguing);
    if (!d) break;
    await p.mouse.click(640, 500);
    await p.waitForTimeout(360);
  }
  await p.waitForTimeout(600);

  // 카메라 고정: 줌 1.0, 유적 중심. 1프레임 경과 후 실제 scrollX/Y 회수.
  const camInfo = await p.evaluate(async () => {
    const sc = window.__SERTZ__.game.scene.getScene("world");
    const cam = sc.cameras.main;
    cam.stopFollow();
    cam.setZoom(1);
    const kr = sc.keepRect;
    cam.centerOn(kr.x + kr.w / 2, kr.y + kr.h / 2 + 60);
    await new Promise((r) => sc.time.delayedCall(120, r));
    // 유적 오브제 전수 덤프 (keepRect 주변 반경 400px)
    const kr2 = sc.keepRect;
    const cx = kr2.x + kr2.w / 2, cy = kr2.y + kr2.h / 2;
    const rows = [];
    for (const ch of sc.children.list) {
      const tex = ch?.texture?.key;
      if (!tex || !tex.startsWith("map_")) continue;
      const dx = ch.x - cx, dy = ch.y - cy;
      if (Math.abs(dx) > 500 || Math.abs(dy) > 500) continue;
      rows.push({
        tex: tex.replace("map_", ""),
        x: Math.round(ch.x * 10) / 10, y: Math.round(ch.y * 10) / 10,
        ox: ch.originX, oy: ch.originY,
        sx: ch.scaleX, sy: ch.scaleY,
        w: Math.round(ch.width), h: Math.round(ch.height),
        dispW: Math.round(ch.width * ch.scaleX), dispH: Math.round(ch.height * ch.scaleY),
        cx: ch._crop ? Math.round(ch._crop.cx) : null, cy2: ch._crop ? Math.round(ch._crop.cy) : null,
        cw: ch._crop ? Math.round(ch._crop.cw) : null, chh: ch._crop ? Math.round(ch._crop.ch) : null,
        depth: Math.round(ch.depth * 100) / 100, vis: ch.visible, alpha: ch.alpha,
        frame: ch.frame ? ch.frame.name : null,
        anim: ch.anims?.currentAnim?.key ?? null,
      });
    }
    return { scroll: { x: cam.scrollX, y: cam.scrollY }, zoom: cam.zoom, keepRect: kr2, keepStair: sc.keepStair, keepDepthGround: sc.keepDepthGround, keepDepthBalcony: sc.keepDepthBalcony, objs: rows, objCount: sc.children.list.length };
  });
  console.log("CAM:", JSON.stringify({ scroll: camInfo.scroll, zoom: camInfo.zoom, keepDepthGround: camInfo.keepDepthGround, keepDepthBalcony: camInfo.keepDepthBalcony }));
  console.log("OBJS:");
  for (const o of camInfo.objs) console.log(JSON.stringify(o));

  await p.waitForTimeout(400);
  await p.screenshot({ path: "scripts/diag/keep_live_dump.png" });

  // 원본 아틀라스상 프레임 실측도 함께 기록 (프레임 좌표계)
  const texInfo = await p.evaluate(() => {
    const sc = window.__SERTZ__.game.scene.getScene("world");
    const out = {};
    for (const k of ["map_ground", "map_props"]) {
      const t = sc.textures.get(k);
      out[k] = { w: t.sourceImage.width, h: t.sourceImage.height, frames: Object.keys(t.frames).length };
    }
    return out;
  });
  console.log("TEX:", JSON.stringify(texInfo));
  await b.close();
})();
