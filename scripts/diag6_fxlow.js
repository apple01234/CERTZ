const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  // 부팅 전 fx=low 프리셋 주입 (셰이더/블룸/툰 필터 OFF)
  await p.addInitScript(() => { try { localStorage.setItem("sertz_fx_mode", "low"); } catch {} });
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForSelector("text=게임 시작", { timeout: 40000 });
  await p.getByText("게임 시작", { exact: false }).first().click();
  await p.waitForTimeout(2000);
  const hasStart = await p.getByText("이 캐릭터로 시작").first().isVisible().catch(() => false);
  if (!hasStart) {
    await p.getByText("캐릭터 생성").first().click(); await p.waitForTimeout(1200);
    await p.getByPlaceholder("캐릭터 이름 (최대 8자)").fill("FX로우");
    await p.getByText("다음 — 직업 선택").click(); await p.waitForTimeout(1000);
    await p.getByText("전사", { exact: false }).first().click();
    await p.getByText("다음 — 외형 선택").click(); await p.waitForTimeout(1000);
    await p.getByText("남캐").first().click(); await p.waitForTimeout(600);
    await p.getByText("전사로 생성!").click(); await p.waitForTimeout(1500);
  }
  await p.getByText("이 캐릭터로 시작").first().click();
  console.log("월드 진입 (fx=low) — 30초 응답성 감시");
  let ok = true;
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const alive = await Promise.race([
      p.evaluate(() => "alive").catch(() => null),
      new Promise((res) => setTimeout(() => res(null), 2000)),
    ]);
    console.log(`${(i + 1) * 3}초: ${alive ? "응답" : "무응답"}`);
    if (!alive) { ok = false; break; }
  }
  console.log(ok ? ">>> fx=low에서 프리즈 없음 — 셰이더 컴파일 폭주 확정" : ">>> fx=low에서도 프리즈 — 원인 재검토");
  await p.screenshot({ path: "/tmp/diag6_fxlow_world.png" }).catch(() => {});
  await b.close();
})().catch((e) => { console.error("실패:", e.message); process.exit(1); });
