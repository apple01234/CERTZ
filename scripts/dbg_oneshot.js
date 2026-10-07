/* 원샷 진단: force 값·소켓 타입·버스 상태 직접 덤프 */
const { chromium } = require("playwright");
const CHROME = "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome";
(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args: ["--use-gl=swiftshader", "--no-sandbox"] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { window.localStorage.setItem("sertz.mp.force", "mqtt"); } catch {} });
  const p = await ctx.newPage();
  const logs = [];
  p.on("console", (m) => { if (/SERTZ|mqtt|멀티/.test(m.text())) logs.push(m.text().slice(0, 120)); });
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2500);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.getByRole("button", { name: /게임 시작/ }).first().click();
  await p.waitForTimeout(900);
  await p.getByText("캐릭터 생성", { exact: false }).first().click();
  await p.waitForTimeout(400);
  await p.locator('input[placeholder*="캐릭터 이름"]').fill("원샷진단");
  await p.getByRole("button", { name: /다음 — 직업 선택/ }).click();
  await p.waitForTimeout(300);
  await p.getByText("전사", { exact: false }).first().click();
  await p.waitForTimeout(200);
  await p.getByRole("button", { name: /다음 — 외형 선택|다음/ }).last().click().catch(() => {});
  await p.waitForTimeout(400);
  await p.getByRole("button", { name: /생성!/ }).first().click();
  await p.waitForTimeout(800);
  await p.evaluate(() => {
    const t = [...document.querySelectorAll("button")].find((x) => /이 캐릭터로 시작|시작/.test(x.textContent || ""));
    if (t) t.click();
  });
  await p.waitForTimeout(6000);
  for (let i = 0; i < 15; i++) {
    const ok = await p.evaluate(() => !!window.__SERTZ_SCENE__?.player).catch(() => false);
    if (ok) break;
    await p.waitForTimeout(800);
  }
  await p.waitForTimeout(4000);
  const d = await p.evaluate(() => ({
    force: localStorage.getItem("sertz.mp.force"),
    netType: typeof window.__SERTZ_NET__,
    netMqtt: window.__SERTZ_NET__ ? !!window.__SERTZ_NET__.__mqtt : null,
    netConnected: window.__SERTZ_NET__ ? !!window.__SERTZ_NET__.connected : null,
    mqttHook: typeof window.__SERTZ_MQTT__,
    stage: window.__SERTZ_SCENE__?.stageDef?.key ?? null,
    isInterior: window.__SERTZ_SCENE__ ? !!window.__SERTZ_SCENE__.isInterior : null,
  }));
  console.log("진단:", JSON.stringify(d, null, 1));
  console.log("콘솔:", logs.slice(0, 6).join(" || "));
  await b.close();
})();
