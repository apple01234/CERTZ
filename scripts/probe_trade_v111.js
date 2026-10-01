const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2500);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1500);
  await p.evaluate(() => { window.__SERTZ_EB__?.emit("ui:panel", { panel: "trade" }); });
  await p.waitForTimeout(900);
  const r1 = await p.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button")).map((x) => x.textContent?.trim());
    return { count: btns.length, sample: btns.filter((t) => t && (t.includes("거래판") || t.includes("시세") || t.includes("로그인"))).slice(0, 10) };
  });
  console.log("NPC탭 버튼:", JSON.stringify(r1));
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("유저 거래판"))?.click();
  });
  await p.waitForTimeout(1200);
  const r2 = await p.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button")).map((x) => x.textContent?.trim());
    const bodyTxt = document.body.textContent || "";
    return {
      loginBtns: btns.filter((t) => t && t.includes("로그인")),
      hasGuestWall: bodyTxt.includes("계정 로그인이 필요한 서비스"),
      hasInline: btns.some((t) => t && t.includes("지금 계정")),
    };
  });
  console.log("유저탭 버튼:", JSON.stringify(r2));
  await b.close();
})().catch((e) => { console.error("CRASH:", e.message); process.exit(2); });
