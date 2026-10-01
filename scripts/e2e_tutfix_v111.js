/**
 * v1.1.1 ①튜토리얼 UI 가림 실측 — tut:active 시 퀘스트 트래커/보상팝업이 충돌 UI를 비켜세우는지
 * 튜토리얼 시작(마을+신규 캐릭터) → 오버레이 top 변화 + Phaser 튜토리얼 HUD 표시 실측
 */
const { chromium } = require("playwright");

(async () => {
  const results = [];
  const ok = (name, pass, detail = "") => {
    results.push({ name, pass });
    console.log(`${pass ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
  };
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 200)));
  p.on("console", (m) => { if (m.type() === "error") errs.push("CONSOLE: " + m.text().slice(0, 160)); });

  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2200);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1200);

  /* 신규 캐릭터 생성 → 마을 → 튜토리얼 자동 시작 (e2e_v111 절차 동일) */
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click();
  });
  await p.waitForTimeout(700);
  await p.locator("input").first().fill("튜토실측");
  await p.waitForTimeout(300);
  for (const label of ["직업 선택", "외형 선택"]) {
    await p.evaluate((lb) => {
      Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes(lb))?.click();
    }, label);
    await p.waitForTimeout(400);
  }
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("생성!"))?.click();
  });
  await p.waitForTimeout(1400);
  await p.evaluate(() => { document.querySelector(".cursor-pointer")?.click(); });
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click();
  });
  await p.waitForTimeout(2600);
  /* 프롤로그 스킵 */
  for (let i = 0; i < 5; i++) { await p.mouse.click(640, 500); await p.waitForTimeout(500); }
  await p.waitForTimeout(1500);

  /* [① 실측 전략] 튜토리얼 기동 → tut:active emit → React 오버레이 회피 실측
   *  (startTutorial은 Tutorial 생성자에서 tut:active {active:true} emit) */
  const injected = await p.evaluate(() => {
    const s = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!s?.startTutorial) return "no-scene";
    s.tutorialDone = false;
    s.startTutorial(0);
    return "started";
  });
  await p.waitForTimeout(1200);
  const tutActive = await p.evaluate(() => !!window.__SERTZ__?.game?.scene?.getScene("world")?.tut);
  const stage = await p.evaluate(() => window.__SERTZ__?.game?.scene?.getScene("world")?.stageDef?.key ?? null);
  ok("[①] startTutorial 기동 → tut:active emit", injected === "started" && tutActive, `stage=${stage} inj=${injected}`);

  /* [① 완전 실측] tut:active 상태에서 보상 팝업 emit → 팝업이 중하단(46%=331px)으로 물러남 */
  await p.evaluate(() => {
    window.__SERTZ_EB__.emit("reward:show", { title: "테스트 보상", lines: [{ text: "튜토리얼 중 팝업 위치 실측" }] });
  });
  await p.waitForTimeout(400);
  const topDuringTut = await p.evaluate(() => {
    const el = Array.from(document.querySelectorAll("div")).find((d) =>
      typeof d.className === "string" && d.className.includes("z-[70]") && d.className.includes("inset-x-0")
    );
    return el ? parseFloat(getComputedStyle(el).top) : null;
  });
  ok("[①] 튜토리얼 중 보상팝업 → 중하단(46%) 이동", topDuringTut !== null && topDuringTut > 250, `top=${topDuringTut}px (기존 112px — 튜토리얼 패널 덮던 상태)`);
  await p.screenshot({ path: "/tmp/e2e_tutfix_111.png" });

  /* 튜토리얼 종료 → 팝업이 상단(112px)으로 복귀 확인 */
  await p.evaluate(() => {
    const s = window.__SERTZ__?.game?.scene?.getScene("world");
    s?.tut?.finish?.();
    /* finish가 없으면 tut 오브젝트 null 처리 후 이벤트 수동 발화 */
    window.__SERTZ_EB__.emit("tut:active", { active: false });
    window.__SERTZ_EB__.emit("reward:show", { title: "테스트 보상 2", lines: [{ text: "튜토리얼 종료 후 복귀 실측" }] });
  });
  await p.waitForTimeout(400);
  const topAfterTut = await p.evaluate(() => {
    const el = Array.from(document.querySelectorAll("div")).find((d) =>
      typeof d.className === "string" && d.className.includes("z-[70]") && d.className.includes("inset-x-0")
    );
    return el ? parseFloat(getComputedStyle(el).top) : null;
  });
  ok("[①] 튜토리얼 종료 → 보상팝업 상단(top-28) 복귀", topAfterTut !== null && topAfterTut < 200, `top=${topAfterTut}px`);

  ok("[정리] pageerror/콘솔 에러 0", errs.length === 0, errs.slice(0, 2).join(" | "));
  const pass = results.filter((r) => r.pass).length;
  console.log(`\n=== ①튜토리얼 가림 실측: ${pass}/${results.length} PASS ===`);
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
