/**
 * v1.4.3 가로 모바일 (844x390) 캐릭터 생성 → 시작 버튼 → 월드 진입
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
  /* 타이틀 도달까지 대기 (부팅 느림) */
  let titleOk = false;
  for (let i = 0; i < 40; i++) {
    if (await p.evaluate(() => !!Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("게임 시작")))) { titleOk = true; break; }
    await p.waitForTimeout(500);
  }
  console.log("타이틀 도달:", titleOk);

  /* 로비 */
  await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("게임 시작"))?.click());
  await p.waitForTimeout(1800);

  /* 생성 */
  await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click());
  await p.waitForTimeout(1000);
  const createOpen = await p.evaluate(() => ({ inputs: document.querySelectorAll("input").length, body: document.body.innerText.slice(0, 160).replace(/\n+/g, " / ") }));
  console.log("생성 화면 오픈:", JSON.stringify(createOpen));
  await p.screenshot({ path: "/home/z/my-project/scripts/shot_land_create.png" });

  if (createOpen.inputs > 0) {
    await p.locator("input").first().fill("가로테스트");
    for (const label of ["직업 선택", "외형 선택"]) {
      await p.evaluate((lb) => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes(lb))?.click(), label);
      await p.waitForTimeout(400);
    }
    await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("생성!"))?.click());
    await p.waitForTimeout(1500);
    const after = await p.evaluate(() => {
      const sb = Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"));
      if (!sb) return { startBtn: false, body: document.body.innerText.slice(0, 160).replace(/\n+/g, " / ") };
      const r = sb.getBoundingClientRect();
      const cy = r.y + r.height / 2, cx = r.x + r.width / 2;
      const top = document.elementFromPoint(cx, cy);
      return { startBtn: true, cx: Math.round(cx), cy: Math.round(cy), inView: cy >= 0 && cy <= innerHeight && cx >= 0 && cx <= innerWidth, covered: top ? (!sb.contains(top) && top !== sb) : true };
    });
    console.log("생성 후 시작 버튼:", JSON.stringify(after));
    await p.screenshot({ path: "/home/z/my-project/scripts/shot_land_after_create.png" });
    if (after.startBtn && after.inView && !after.covered) {
      await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click());
      await p.waitForTimeout(3200);
      for (let i = 0; i < 25; i++) {
        const d = await p.evaluate(() => window.__SERTZ__?.game?.scene?.getScene("world")?.dialoguing);
        if (!d) break;
        await p.touchscreen.tap(422, 220).catch(() => {});
        await p.waitForTimeout(300);
      }
      const world = await p.evaluate(() => !!window.__SERTZ__?.game?.scene?.getScene("world")?.player);
      console.log("월드 진입:", world);
      await p.screenshot({ path: "/home/z/my-project/scripts/shot_land_world.png" });
    }
  }
  console.log("errs:", errs.length ? "\n" + errs.slice(0, 6).join("\n") : 0);
  await b.close();
})();
