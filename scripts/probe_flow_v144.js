const { chromium } = require("playwright");
(async () => {
  const t0 = Date.now();
  const log = (m) => console.log(`[+${((Date.now()-t0)/1000).toFixed(1)}s] ${m}`);
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message.slice(0, 200)));
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2600);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 }); log("title reached");
  await p.getByText("게임 시작").first().click(); log("clicked 게임 시작");
  await p.waitForTimeout(1200);
  await p.evaluate(() => Array.from(document.querySelectorAll("button")).find(x => x.textContent?.includes("캐릭터 생성"))?.click());
  await p.waitForTimeout(700); log("clicked 캐릭터 생성");
  await p.locator("input").first().fill("세라144"); log("name filled");
  for (const label of ["직업 선택", "외형 선택"]) {
    await p.evaluate((lb) => Array.from(document.querySelectorAll("button")).find(x => x.textContent?.includes(lb))?.click(), label);
    await p.waitForTimeout(400);
    log(`clicked ${label}`);
  }
  await p.evaluate(() => Array.from(document.querySelectorAll("button")).find(x => x.textContent?.includes("생성!"))?.click());
  await p.waitForTimeout(1400); log("clicked 생성!");
  await p.evaluate(() => { document.querySelector(".cursor-pointer")?.click(); });
  await p.waitForTimeout(400); log("clicked card");
  await p.evaluate(() => Array.from(document.querySelectorAll("button")).find(x => x.textContent?.includes("이 캐릭터로 시작"))?.click());
  await p.waitForTimeout(2600); log("clicked 이 캐릭터로 시작");
  for (let i = 0; i < 4; i++) { await p.mouse.click(640, 500); await p.waitForTimeout(400); }
  log("intro clicks done");
  for (let i = 0; i < 30; i++) {
    const d = await p.evaluate(() => window.__SERTZ__?.game?.scene?.getScene("world")?.dialoguing);
    if (!d) break;
    await p.mouse.click(640, 500); await p.waitForTimeout(360);
  }
  log("dialogue loop done");
  const inWorld = await p.evaluate(() => !!(window.__SERTZ__?.game?.scene?.getScene("world")?.player));
  log("inWorld=" + inWorld);
  const st = await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!sc) return null;
    return { stage: sc.stageDef?.key, wolves: sc.enemies?.filter(e => e.active && e.displayName === "훈련용 늑대").length, spawns: (sc.trainSpawns ?? []).length, chest: (sc.interactables ?? []).filter(it => it.kind === "keepchest").length, tex: sc.textures.exists("map_chest_f"), q: sc.currentQuest?.()?.title };
  });
  console.log("STATE:", JSON.stringify(st));
  console.log("PAGEERR:", errs.join(" || ") || "0");
  await p.screenshot({ path: "/tmp/probe_world_144.png" });
  await b.close();
})().catch(e => { console.error("FAIL", e.message); process.exit(1); });
