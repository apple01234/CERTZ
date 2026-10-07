/**
 * B 페이지의 st 발행 중단 원인 프로브 (로컬 + MQTT 강제)
 *  · activeElement 태그/typing 상태/키 입력 반응/스니퍼 st 카운트
 */
const { chromium } = require("playwright");
const mqtt = require("mqtt");
const CHROME = "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome";

(async () => {
  const sn = mqtt.connect("wss://broker.emqx.io:8084/mqtt", { clientId: "sz_p3_" + Date.now().toString(36), protocolVersion: 4, connectTimeout: 8000 });
  let bSt = 0, bPr = 0, bHi = 0;
  let bPid = "";
  sn.on("connect", () => sn.subscribe("sertz/mp/v2/#"));
  sn.on("message", (t, p) => {
    try {
      const m = JSON.parse(p.toString());
      if (bPid && m.pid !== bPid) return;
      if (m.k === "st") bSt++;
      if (m.k === "pr") bPr++;
      if (m.k === "hi") bHi++;
    } catch {}
  });

  const b = await chromium.launch({ executablePath: CHROME, args: ["--use-gl=swiftshader", "--no-sandbox"] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { window.localStorage.setItem("sertz.mp.force", "mqtt"); } catch {} });
  const p = await ctx.newPage();
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2000);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.getByRole("button", { name: /게임 시작/ }).first().click();
  await p.waitForTimeout(900);
  await p.getByText("캐릭터 생성", { exact: false }).first().click();
  await p.waitForTimeout(400);
  await p.locator('input[placeholder*="캐릭터 이름"]').fill("프로브테스터");
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
  await p.waitForTimeout(3500);
  for (let i = 0; i < 25; i++) {
    const ok = await p.evaluate(() => !!window.__SERTZ_SCENE__?.player).catch(() => false);
    if (ok) break;
    await p.waitForTimeout(800);
  }

  const probe = async (label) => {
    const d = await p.evaluate(() => {
      const s = window.__SERTZ_SCENE__;
      const ae = document.activeElement;
      return {
        dialoguing: !!s?.dialoguing, chatFocused: !!s?.chatFocused,
        activeTag: ae ? ae.tagName : null,
        activeIsChat: !!(ae && ae.tagName === "INPUT"),
        introStep: s ? s.introStep : null,
        sleeping: !!s?.sleeping,
        tutStep: s ? s.tutStep : null,
        tutorialDone: s ? s.tutorialDone : null,
      };
    });
    console.log(`[${label}]`, JSON.stringify(d));
    return d;
  };

  await probe("부팅직후");
  await p.waitForTimeout(4000);
  await probe("4초후");
  bPid = (await p.evaluate(() => window.__SERTZ_MQTT__?.pid)) || "";
  console.log("pid:", bPid, "— 스니퍼 6초 관찰:");
  const s0 = bSt;
  await p.waitForTimeout(6000);
  console.log(`  6초간 st 증가: ${bSt - s0} (st총 ${bSt}, pr ${bPr}, hi ${bHi})`);

  /* Enter 한 번 → 채팅 포커스 확인 */
  await p.keyboard.press("Enter");
  await p.waitForTimeout(700);
  await probe("Enter직후");
  const s1 = bSt;
  await p.waitForTimeout(5000);
  console.log(`  Enter후 5초간 st 증가: ${bSt - s1}`);

  /* blur 후 */
  await p.evaluate(() => { const ae = document.activeElement; if (ae && ae.blur) ae.blur(); });
  await p.waitForTimeout(500);
  const s2 = bSt;
  await p.waitForTimeout(5000);
  console.log(`  blur후 5초간 st 증가: ${bSt - s2}`);

  await b.close();
  sn.end(true);
  process.exit(0);
})();
