const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2200);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1000);
  // 빠른 생성
  await p.evaluate(() => { Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click(); });
  await p.waitForTimeout(600);
  await p.locator("input").first().fill("알파");
  await p.waitForTimeout(250);
  for (const lb of ["직업 선택", "외형 선택", "생성!"]) {
    await p.evaluate((l) => { Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes(l))?.click(); }, lb);
    await p.waitForTimeout(450);
  }
  await p.evaluate(() => { document.querySelector(".cursor-pointer")?.click(); });
  await p.waitForTimeout(350);
  await p.evaluate(() => { Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click(); });
  await p.waitForTimeout(2500);
  // 6초간 1초마다 페이드/텍스트 알파 샘플링
  const samples = [];
  for (let i = 0; i < 6; i++) {
    const smp = await p.evaluate(() => {
      const s = window.__SERTZ__?.game?.scene?.getScene("world");
      if (!s) return {};
      const fe = s.cameras.main.fadeEffect ?? {};
      const beat = s.children.list.find((o) => o.type === "Text" && (o.text || "").includes("아홉"));
      const loop = s.game.loop;
      return { fade: Math.round((fe.alpha ?? -1) * 100) / 100, running: fe.isRunning, beatAlpha: Math.round((beat?.alpha ?? -1) * 100) / 100, fps: Math.round(loop.actualFps), t: Math.round(s.time.now) };
    });
    samples.push(smp);
    await p.waitForTimeout(1000);
  }
  console.log("SAMPLES:", JSON.stringify(samples));
  const info = await p.evaluate(() => {
    const s = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!s) return { err: "no scene" };
    const kids = s.children.list.filter((o) => o.type === "Text").map((t) => ({ txt: (t.text || "").slice(0, 12), alpha: t.alpha, depth: t.depth }));
    const rects = s.children.list.filter((o) => o.type === "Rectangle").map((r) => ({ alpha: r.alpha, depth: r.depth, w: r.width }));
    const fe = s.cameras.main.fadeEffect ?? {};
    return {
      kids: kids.slice(0, 6),
      camFade: fe.alpha ?? null,
      isRunning: fe.isRunning ?? null,
      progress: fe.progress ?? null,
      direction: fe.direction ?? null,
      dialoguing: s.dialoguing,
      sceneTime: Math.round(s.time.now),
      introStep: s.introStep,
    };
  });
  console.log(JSON.stringify(info, null, 1));
  await b.close();
})();
