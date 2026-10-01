/**
 * #10/#11 탐색 프브 — 탑 콘텐츠 진입 후 화면을 캡처해 "NPC UI" 정체와 차원문 상태를 눈으로 확인
 */
const { chromium } = require("playwright");

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 300)));
  p.on("console", (m) => { if (m.type() === "error") errs.push("CONSOLE: " + m.text().slice(0, 200)); });

  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2500);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1500);

  // 로비 → 캐릭터 생성 (이름→직업→외형)
  await p.screenshot({ path: "/tmp/probe_lobby.png" });
  const createBtn = p.getByText("캐릭터 생성", { exact: false }).first();
  if (await createBtn.isVisible().catch(() => false)) {
    await createBtn.click();
    await p.waitForTimeout(600);
    await p.locator("input").first().fill("프로브");
    await p.waitForTimeout(300);
    const next1 = p.getByText("다음 — 직업 선택", { exact: false }).first();
    if (await next1.isVisible().catch(() => false)) { await next1.click(); await p.waitForTimeout(400); }
    const next2 = p.getByText("다음 — 외형 선택", { exact: false }).first();
    if (await next2.isVisible().catch(() => false)) { await next2.click(); await p.waitForTimeout(400); }
    const done = p.getByText("생성!", { exact: false }).first();
    if (await done.isVisible().catch(() => false)) { await done.click(); await p.waitForTimeout(1200); }
    await p.screenshot({ path: "/tmp/probe_created.png" });
  }
  // 카드 선택 후 "이 캐릭터로 시작"
  const card = await p.$(".cursor-pointer");
  if (card) { await card.click(); await p.waitForTimeout(400); }
  const startBtn = p.getByText("이 캐릭터로 시작", { exact: false }).first();
  if (await startBtn.isVisible().catch(() => false)) await startBtn.click();
  await p.waitForTimeout(4500);
  await p.screenshot({ path: "/tmp/probe_village.png" });

  // 콘텐츠 패널 열기 (탑) — 네이티브 클릭 위임 (worklog 교훈: Playwright 액션러너 회피)
  {
    const clicked = await p.evaluate(() => {
      const spans = Array.from(document.querySelectorAll("span"));
      const s = spans.find((x) => x.textContent === "콘텐츠");
      const btn = s?.closest("button");
      if (btn) { btn.click(); return true; }
      return false;
    });
    console.log("content clicked:", clicked);
    await p.waitForTimeout(900);
    await p.screenshot({ path: "/tmp/probe_content_panel.png" });
    // 탑 탭 클릭
    const tabOk = await p.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const t = btns.find((x) => x.textContent?.trim() === "탑");
      if (t) { t.click(); return true; }
      return false;
    });
    console.log("tower tab:", tabOk);
    await p.waitForTimeout(600);
    {
      await p.screenshot({ path: "/tmp/probe_tower_tab.png" });
      await p.screenshot({ path: "/tmp/probe_tower_tab.png" });
      const enterOk = await p.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const e = btns.find((x) => x.textContent?.includes("탑 입장"));
        if (e) { e.click(); return true; }
        return false;
      });
      console.log("enter:", enterOk);
      {
        await p.waitForTimeout(3500);
        await p.screenshot({ path: "/tmp/probe_tower_inside.png" });
        console.log("TOWER ENTERED");
        // 8초 더 대기 후 재캡처 (자가치육 포탈 개방 타이밍)
        await p.waitForTimeout(8000);
        await p.screenshot({ path: "/tmp/probe_tower_inside2.png" });
      }
    }
  }
  console.log("ERRORS:", JSON.stringify(errs.slice(0, 6), null, 0));
  await b.close();
})();
