/**
 * v1.4.3 진단 2 — 인벤 UI 정확 재현 (ui:panel emit → 등급업 버튼 존재)
 */
const { chromium } = require("playwright");

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log("PAGEERROR:", e.message.slice(0, 300)));

  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2600);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1500);
  /* 캐릭터 카드가 있으면 클릭 → 시작 버튼 (등장 대기 루프) */
  for (let i = 0; i < 10; i++) {
    const ready = await p.evaluate(() => {
      Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click();
      return Array.from(document.querySelectorAll("button")).some((x) => x.textContent?.includes("이 캐릭터로 시작"));
    });
    if (ready) { await p.waitForTimeout(1200); break; }
    await p.waitForTimeout(600);
  }
  await p.waitForTimeout(2600);
  for (let i = 0; i < 4; i++) { await p.mouse.click(640, 500); await p.waitForTimeout(400); }
  for (let i = 0; i < 30; i++) {
    const d = await p.evaluate(() => window.__SERTZ__?.game?.scene?.getScene("world")?.dialoguing);
    if (!d) break;
    await p.mouse.click(640, 500);
    await p.waitForTimeout(360);
  }

  /* 큐브 지급 */
  for (let i = 0; i < 15; i++) {
    const okW = await p.evaluate(() => {
      const sc = window.__SERTZ__?.game?.scene?.getScene("world");
      if (!sc?.player) return false;
      for (let j = 0; j < 3; j++) sc.player.owned.push("tier_cube");
      sc.emitRpgState();
      return true;
    });
    if (okW) break;
    await p.waitForTimeout(800);
  }

  /* 인벤 패널 열기 (ui:panel emit) */
  await p.evaluate(() => window.__SERTZ_EB__.emit("ui:panel", { panel: "inv" }));
  await p.waitForTimeout(800);

  /* 전체 버튼 텍스트 덤프 */
  const dump = await p.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button")).map((x) => x.textContent?.trim()).filter((t) => t && (t.includes("등급업") || t.includes("티어") || t.includes("장착")));
    const bodyHasCube = document.body.innerText.includes("등급업 큐브");
    return { btns: btns.slice(0, 12), bodyHasCube };
  });
  console.log("DUMP:", JSON.stringify(dump, null, 1));

  /* tier_cube 인벤 행 클릭 → 어떤 버튼이 나오는지 (사용 버튼 부재 확인) */
  await p.evaluate(() => {
    const tiles = Array.from(document.querySelectorAll("[aria-label]")).filter((x) => x.getAttribute("aria-label") === "tier_cube");
    if (tiles[0]) tiles[0].dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  });
  await p.waitForTimeout(500);
  const row = await p.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button")).map((x) => x.textContent?.trim());
    return { rowBtns: btns.filter((t) => t && (t.includes("사용") || t.includes("등급업") || t.includes("티어") || t.includes("판매"))).slice(0, 8) };
  });
  console.log("CUBE ROW:", JSON.stringify(row));

  /* 무기 행 클릭 → 등급업 버튼 노출 확인 */
  await p.evaluate(() => {
    const tiles = Array.from(document.querySelectorAll("[aria-label]")).filter((x) => (x.getAttribute("aria-label") ?? "").startsWith("weapon_"));
    if (tiles[0]) tiles[0].dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  });
  await p.waitForTimeout(500);
  const wrow = await p.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button")).map((x) => x.textContent?.trim());
    return { weaponRowBtns: btns.filter((t) => t && (t.includes("등급업") || t.includes("장착") || t.includes("강화"))).slice(0, 8) };
  });
  console.log("WEAPON ROW:", JSON.stringify(wrow));

  await b.close();
})().catch((e) => { console.error("SCRIPT FAIL:", e.message); process.exit(1); });
