/** v1.3.0 plateau 시각+콜리전 검증 — 단 셀로 이동해 촬영, 절벽 충돌 실측 */
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
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click();
  });
  await p.waitForTimeout(700);
  await p.locator("input").first().fill("단테스트");
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
  await p.waitForTimeout(2800);
  for (let i = 0; i < 5; i++) { await p.mouse.click(640, 500); await p.waitForTimeout(400); }

  // 마을 → 필드 구역 전환 (레이아웃/단 생성)
  await p.evaluate(() => {
    const ws = window.__SERTZ__?.game?.scene?.getScene("world");
    if (ws?.player) ws.startTransition("forest1", { delay: 10 });
  });
  await p.waitForTimeout(3800);
  for (let i = 0; i < 4; i++) { await p.mouse.click(640, 500); await p.waitForTimeout(350); }
  await p.waitForTimeout(800);

  const info = await p.evaluate(() => {
    const ws = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!ws?.player || !ws.layout) return { err: "no layout" };
    const lay = ws.layout;
    const cells = [];
    for (let i = 0; i < lay.open.length; i++) {
      if ((lay.level?.[i] ?? 0) === 1) {
        const c = i % lay.cols, r = Math.floor(i / lay.cols);
        cells.push({ c, r, x: (c + 0.5) * lay.cellW, y: (r + 0.5) * lay.cellH });
      }
    }
    return { stage: ws.stageDef?.key, cells, stairs: [...(lay.stairs ?? [])], cellW: lay.cellW, cellH: lay.cellH };
  });
  console.log("plateau info:", JSON.stringify(info));
  if (info.err || !info.cells?.length) { console.log("no plateaus"); await b.close(); return; }

  // 플레이어를 단 위로 텔레포트 + 카메라 고정
  await p.evaluate((info) => {
    const ws = window.__SERTZ__?.game?.scene?.getScene("world");
    const t = info.cells[0];
    ws.player.setPosition(t.x, t.y);
    ws.cameras.main.stopFollow();
    ws.cameras.main.centerOn(t.x, t.y);
    ws.dialoguing = false;
  }, info);
  await p.waitForTimeout(600);
  await p.screenshot({ path: "/tmp/v130_plateau_top.png" });

  // 절벽 남쪽 아래에서 올려다보는 구도 — 면 레이어 확인
  await p.evaluate((info) => {
    const ws = window.__SERTZ__?.game?.scene?.getScene("world");
    const t = info.cells[0];
    ws.player.setPosition(t.x, t.y + info.cellH * 0.9);
    ws.cameras.main.centerOn(t.x, t.y + info.cellH * 0.4);
  }, info);
  await p.waitForTimeout(500);
  await p.screenshot({ path: "/tmp/v130_plateau_below.png" });
  console.log("PAGEERRORS:", errs.length ? errs.slice(0, 5) : "none");
  await b.close();
})();
