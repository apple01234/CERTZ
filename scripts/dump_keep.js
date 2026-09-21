const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1000);
  await p.evaluate(() => { Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click(); });
  await p.waitForTimeout(600);
  await p.locator("input").first().fill("디버그");
  await p.waitForTimeout(300);
  for (const label of ["직업 선택", "외형 선택"]) await p.evaluate((lb) => { Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes(lb))?.click(); }, label);
  await p.waitForTimeout(350);
  await p.evaluate(() => { Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("생성!"))?.click(); });
  await p.waitForTimeout(1300);
  await p.evaluate(() => { document.querySelector(".cursor-pointer")?.click(); });
  await p.waitForTimeout(350);
  await p.evaluate(() => { Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click(); });
  await p.waitForTimeout(2800);
  for (let i = 0; i < 3; i++) { await p.mouse.click(640, 500); await p.waitForTimeout(350); }
  for (let i = 0; i < 30; i++) {
    const w = await p.evaluate(() => !!(window.__SERTZ__?.game?.scene?.getScene("world")?.player));
    if (w) break;
    await p.waitForTimeout(400);
  }
  const dump = await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!sc) return "no world";
    const rows = [];
    for (const ch of sc.children.list) {
      const tex = ch?.texture?.key;
      if (tex === "map_ground" || tex === "map_props") {
        rows.push({ tex, x: Math.round(ch.x), y: Math.round(ch.y), cx: ch._crop?.cx, cy: ch._crop?.cy, cw: ch._crop?.cw, chh: ch._crop?.ch, flipX: ch.flipX, u0: ch._crop?.u0?.toFixed(4), u1: ch._crop?.u1?.toFixed(4) });
      }
    }
    return rows.filter((r) => r.tex === "map_ground" && (r.cx !== 48 || r.cy !== 32)).slice(0, 10);
  });
  console.log(JSON.stringify(dump));
  await b.close();
})();
