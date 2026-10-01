/**
 * v1.4.3 유저 리포트 재현 — "캐릭터 선택후 게임 시작 안됨"
 *  A. 신규 생성 진입(정상 기준선) → B. 로비 복귀 → C. 기존 캐릭터 재입장
 *  각 단계 pageerror / console error / world.player 실측 + 스크린샷
 */
const { chromium } = require("playwright");

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 300) + (e.stack ? " @ " + e.stack.split("\n")[1]?.trim().slice(0, 160) : "")));
  p.on("console", (m) => {
    if (m.type() === "error") errs.push("CONSOLE: " + m.text().slice(0, 240));
  });

  const worldPlayer = () => p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    return !!(sc && sc.player && sc.scene?.isActive?.() !== false);
  });

  /* ── 부팅 → 타이틀 ── */
  await p.goto("http://localhost:4599/", { waitUntil: "domcontentloaded" });
  for (let i = 0; i < 40 && !(await p.evaluate(() => !!window.__SERTZ_DEFER_DONE__)); i++) await p.waitForTimeout(300);
  console.log("boot done, errors so far:", errs.length);

  /* ── A. 신규 생성 진입 ── */
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1000);
  await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click());
  await p.waitForTimeout(600);
  await p.locator("input").first().fill("재입장테스트");
  await p.waitForTimeout(200);
  for (const label of ["직업 선택", "외형 선택"]) {
    await p.evaluate((lb) => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes(lb))?.click(), label);
    await p.waitForTimeout(350);
  }
  await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("생성!"))?.click());
  await p.waitForTimeout(1200);
  await p.evaluate(() => document.querySelector(".cursor-pointer")?.click());
  await p.waitForTimeout(300);
  await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click());
  await p.waitForTimeout(2500);
  for (let i = 0; i < 30; i++) {
    const d = await p.evaluate(() => window.__SERTZ__?.game?.scene?.getScene("world")?.dialoguing);
    if (!d) break;
    await p.mouse.click(640, 500);
    await p.waitForTimeout(320);
  }
  console.log("A. 신규 생성 진입 → world.player:", await worldPlayer(), "| errs:", errs.length);

  /* ── B. 로비 복귀 (설정 → 캐릭터 선택) ── */
  await p.evaluate(() => window.__SERTZ_EB__?.emit?.("rpg:exitMenu", { lobby: true }));
  await p.waitForTimeout(2500);
  const backToLobby = await p.evaluate(() => !!document.body.innerText.includes("이 캐릭터로 시작") || !!document.body.innerText.includes("캐릭터 생성"));
  console.log("B. 로비 복귀:", backToLobby, "| errs:", errs.length);
  if (errs.length) console.log("   └ errs:", errs.slice(0, 4).join("\n   "));

  /* ── C. 기존 캐릭터 선택 → 시작 ── */
  // 슬롯 클릭(선택) 후 입장 버튼
  const slotClicked = await p.evaluate(() => {
    // 슬롯 카드: 레벨/이름 텍스트 포함 요소 클릭 시도
    const el = Array.from(document.querySelectorAll("[class*='cursor-pointer']")).find((x) => x.textContent?.includes("재입장테스트"));
    el?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return !!el;
  });
  await p.waitForTimeout(600);
  console.log("C-1. 슬롯 선택:", slotClicked);
  await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click());
  await p.waitForTimeout(3500);
  const reentered = await worldPlayer();
  console.log("C-2. 기존 캐릭터 재입장 → world.player:", reentered, "| errs:", errs.length);
  if (errs.length) console.log("   └ errs:", errs.slice(0, 6).join("\n   "));

  /* 슬롯 더블클릭 경로도 시도 (미입장 시) */
  if (!reentered) {
    await p.screenshot({ path: "/home/z/my-project/scripts/shot_v143_reentry_fail.png" });
    console.log("── 더블클릭 경로 재시도 ──");
    const dbl = await p.evaluate(() => {
      const el = Array.from(document.querySelectorAll("[class*='cursor-pointer']")).find((x) => x.textContent?.includes("재입장테스트"));
      if (!el) return false;
      el.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
      return true;
    });
    await p.waitForTimeout(3500);
    console.log("C-3. 더블클릭:", dbl, "→ world.player:", await worldPlayer(), "| errs:", errs.length);
    if (errs.length) console.log("   └ errs:", errs.slice(-6).join("\n   "));
    await p.screenshot({ path: "/home/z/my-project/scripts/shot_v143_reentry_fail2.png" });
  }

  await p.screenshot({ path: "/home/z/my-project/scripts/shot_v143_reentry.png" });
  console.log("\n=== 전체 에러 (" + errs.length + ") ===");
  errs.slice(0, 12).forEach((e) => console.log(e));
  await b.close();
})();
