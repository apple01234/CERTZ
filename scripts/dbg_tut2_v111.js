/** 디버그: 마을 진입 후 튜토리얼 시작 안 되는 원인 수집 */
const { chromium } = require("playwright");

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log("PAGEERROR:", e.message.slice(0, 150)));
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2200);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1200);

  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click();
  });
  await p.waitForTimeout(700);
  await p.locator("input").first().fill("튜토실측2");
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
  await p.waitForTimeout(3000);

  /* 상태 폴링 */
  for (let i = 0; i < 6; i++) {
    const st = await p.evaluate(() => {
      const s = window.__SERTZ__?.game?.scene?.getScene("world");
      const pl = s?.player;
      return {
        hasScene: !!s, hasPlayer: !!pl,
        tut: !!s?.tut, stage: s?.stageDef?.key ?? null,
        dialoguing: !!s?.dialoguing, prologue: !!s?.prologueActive,
        lv: pl?.lv ?? null, name: pl?.name ?? null,
        introSeen: s?.introSeen ?? null,
        /* z-70 컨테이너 존재 여부 */
        z70: Array.from(document.querySelectorAll("div")).filter((d) =>
          typeof d.className === "string" && d.className.includes("z-[70]")).length,
        z70top: (() => {
          const el = Array.from(document.querySelectorAll("div")).find((d) =>
            typeof d.className === "string" && d.className.includes("z-[70]") && d.className.includes("inset-x-0"));
          return el ? getComputedStyle(el).top : null;
        })(),
      };
    });
    console.log(`[${i * 2000}ms]`, JSON.stringify(st));
    if (st.tut) break;
    await p.mouse.click(640, 500); /* 대사/프롤로그 스킵 시도 */
    await p.waitForTimeout(2000);
  }
  await p.screenshot({ path: "/tmp/dbg_tut.png" });
  await b.close();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
