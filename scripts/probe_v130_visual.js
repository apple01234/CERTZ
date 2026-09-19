/**
 * v1.3.0 visual probe — 오라 패키지 + 층식 구조(단) 시각 검증
 */
const { chromium } = require("playwright");

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 300)));

  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2500);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1400);
  // 기존 캐릭터가 있으면 선택, 없으면 생성
  const hasChar = await p.evaluate(() =>
    !!Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작")));
  console.log("hasChar:", hasChar);
  if (hasChar) {
    await p.evaluate(() => {
      Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click();
    });
  } else {
    await p.evaluate(() => {
      Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click();
    });
    await p.waitForTimeout(700);
    await p.locator("input").first().fill("비쥬");
    await p.waitForTimeout(300);
    for (const label of ["직업 선택", "외형 선택"]) {
      await p.evaluate((lb) => {
        Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes(lb))?.click();
      }, label);
      await p.waitForTimeout(300);
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
  }
  await p.waitForTimeout(2800);
  for (let i = 0; i < 6; i++) { await p.mouse.click(640, 500); await p.waitForTimeout(400); }
  await p.waitForTimeout(600);

  // 1) 오라 착용 — 코스모스 이동 후 중앙 고정 촬영
  const equipped = await p.evaluate(() => {
    const ws = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!ws?.player) return { err: "no world" };
    ws.dialoguing = false;
    if (!ws.player.cosmetics.includes("cos_aurora")) ws.player.cosmetics.push("cos_aurora");
    ws.player.cosmetic = null;
    window.__SERTZ_EB__.emit("rpg:cosmetic", { key: "cos_aurora" });
    return { ok: true, cosmetic: ws.player.cosmetic, circle: !!ws.auraCircle, ring: !!ws.auraRing, wisps: ws.auraWisps.length };
  });
  console.log("aura equip:", JSON.stringify(equipped));
  await p.waitForTimeout(700);
  await p.screenshot({ path: "/tmp/v130_aura.png" });

  // 2) 필드 구역으로 전환 — 단(plateau) 확인
  const tp = await p.evaluate(() => {
    const ws = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!ws?.player) return { err: "no world" };
    const st = ws.scene.key === "world" ? ws.stageDef?.key : null;
    ws.startTransition("forest1", { delay: 10 });
    return { from: st };
  });
  console.log("transition:", JSON.stringify(tp));
  await p.waitForTimeout(3800);
  for (let i = 0; i < 4; i++) { await p.mouse.click(640, 500); await p.waitForTimeout(350); }
  await p.waitForTimeout(800);
  const stage = await p.evaluate(() => {
    const ws = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!ws?.player) return { err: "no world" };
    return { stage: ws.stageDef?.key, layout: !!ws.layout, level: ws.layout?.level ? Array.from(ws.layout.level).filter((l) => l === 1).length : 0 };
  });
  console.log("stage:", JSON.stringify(stage));
  // 플레이어 주변을 볼 수 있게 스크린샷
  await p.screenshot({ path: "/tmp/v130_plateau.png" });

  console.log("PAGEERRORS:", errs.length ? errs.slice(0, 5) : "none");
  await b.close();
})();
