/**
 * v1.4.3 유저 리포트 재현 4차 — 모바일 뷰포트 + 캐릭터 존재 상태
 *  ① 모바일에서 캐릭터 생성 가능한지  ② 생성 후 로비에서 시작 버튼 가시성  ③ 실제 탭 → 월드 진입
 */
const { chromium } = require("playwright");

(async () => {
  for (const vp of [{ name: "세로 390x844", w: 390, h: 844 }, { name: "가로 844x390", w: 844, h: 390 }]) {
    const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
    const ctx = await b.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: true, isMobile: true, userAgent: "Mozilla/5.0 (Linux; Android 13; SM-G991N) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36" });
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 220) + " @ " + (e.stack?.split("\n")[1] || "").trim().slice(0, 140)));

    console.log(`\n===== ${vp.name} =====`);
    await p.goto("http://localhost:4599/index.html", { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(3500);

    /* 타이틀 → 게임 시작 → 로비 */
    await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("게임 시작"))?.click());
    await p.waitForTimeout(1600);

    /* 캐릭터 생성 플로우 (모바일에서 가능?) */
    await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click());
    await p.waitForTimeout(700);
    const createVisible = await p.evaluate(() => {
      const inp = document.querySelector("input");
      const genBtn = Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("생성!"));
      if (!inp) return { input: false };
      const r = inp.getBoundingClientRect();
      return { input: true, inputInView: r.y >= 0 && r.y <= innerHeight, genBtn: !!genBtn };
    });
    console.log("생성 화면:", JSON.stringify(createVisible));
    await p.locator("input").first().fill("모바일테스트");
    for (const label of ["직업 선택", "외형 선택"]) {
      await p.evaluate((lb) => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes(lb))?.click(), label);
      await p.waitForTimeout(400);
    }
    await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("생성!"))?.click());
    await p.waitForTimeout(1400);
    const afterCreate = await p.evaluate(() => {
      const startBtn = Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"));
      const r = startBtn?.getBoundingClientRect();
      return { startBtn: !!startBtn, y: r ? Math.round(r.y + r.height / 2) : null, inView: r ? r.y + r.height / 2 >= 0 && r.y + r.height / 2 <= innerHeight : false, bodyText: document.body.innerText.slice(0, 120).replace(/\n/g, " | ") };
    });
    console.log("생성 후:", JSON.stringify(afterCreate));
    await p.screenshot({ path: `/home/z/my-project/scripts/shot_m2_${vp.w}x${vp.h}_after_create.png` });

    if (afterCreate.startBtn && afterCreate.inView) {
      await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click());
      await p.waitForTimeout(3000);
      for (let i = 0; i < 25; i++) {
        const d = await p.evaluate(() => window.__SERTZ__?.game?.scene?.getScene("world")?.dialoguing);
        if (!d) break;
        await p.touchscreen.tap(195, vp.h * 0.55).catch(() => {});
        await p.waitForTimeout(300);
      }
      const world = await p.evaluate(() => !!window.__SERTZ__?.game?.scene?.getScene("world")?.player);
      console.log("월드 진입:", world);
      await p.screenshot({ path: `/home/z/my-project/scripts/shot_m2_${vp.w}x${vp.h}_world.png` });
    } else {
      /* 버튼이 화면 밖이면 스크롤 시도 후 재측정 */
      console.log("── 시작 버튼 화면 밖/부재 → 스크롤 시도 ──");
      await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await p.waitForTimeout(600);
      const retry = await p.evaluate(() => {
        const sb = Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"));
        const r = sb?.getBoundingClientRect();
        return { startBtn: !!sb, y: r ? Math.round(r.y + r.height / 2) : null, inView: r ? r.y + r.height / 2 >= 0 && r.y + r.height / 2 <= innerHeight : false };
      });
      console.log("스크롤 후:", JSON.stringify(retry));
      await p.screenshot({ path: `/home/z/my-project/scripts/shot_m2_${vp.w}x${vp.h}_scrolled.png` });
    }
    if (errs.length) console.log("errs:", errs.slice(0, 5).join("\n  "));
    await b.close();
  }
})();
