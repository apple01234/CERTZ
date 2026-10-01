/** v1.2.1 시각 검수 — 날개/왕관 장착 스크린샷 */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2500);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1200);
  const hasCont = await p.evaluate(() => !!Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작")));
  if (hasCont) {
    await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click());
  } else {
    await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click());
    await p.waitForTimeout(700);
    await p.locator("input").first().fill("시아");
    await p.waitForTimeout(200);
    for (const label of ["직업 선택", "외형 선택"]) {
      await p.evaluate((lb) => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes(lb))?.click(), label);
      await p.waitForTimeout(300);
    }
    await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.trim() === "여캐")?.click());
    await p.waitForTimeout(200);
    await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.trim() === "백자")?.click());
    await p.waitForTimeout(200);
    await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("생성!"))?.click());
    await p.waitForTimeout(1200);
    await p.evaluate(() => document.querySelector(".cursor-pointer")?.click());
    await p.waitForTimeout(300);
    await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click());
  }
  await p.waitForTimeout(2600);
  for (let i = 0; i < 4; i++) { await p.mouse.click(640, 500); await p.waitForTimeout(350); }
  /* 프롤로그 건너뛰기 버튼이 있으면 클릭 */
  await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("건너뛰기"))?.click()).catch(() => {});
  await p.waitForTimeout(500);
  await p.evaluate(() => {
    const s = window.__SERTZ__?.game?.scene?.getScene("world");
    const pl = s.player;
    if (!pl.pets.includes("pet_atlas")) pl.pets.push("pet_atlas");
    pl.setPet("pet_atlas");
    for (const k of ["acc_wings_devil", "acc_crown"]) if (!pl.cosmetics.includes(k)) pl.cosmetics.push(k);
    pl.setAccessory("acc_wings_devil");
    s.syncCosmeticAura();
  });
  await p.waitForTimeout(2200);
  await p.screenshot({ path: "scripts/final_wings_crown.png" });
  /* 카메라 줌 인 → 캐릭터 확대 */
  await p.evaluate(() => {
    const s = window.__SERTZ__?.game?.scene?.getScene("world");
    s.cameras.main.setZoom(3.2);
    s.cameras.main.centerOn(s.player.x, s.player.y - 8);
  });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: "scripts/final_wings_zoom.png" });
  console.log("shots saved");
  await b.close();
})();
