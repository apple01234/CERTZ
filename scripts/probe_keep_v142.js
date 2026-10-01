/**
 * v1.4.2 진단 — 요새 유적 실제 렌더 스크린샷 프로브.
 * 월드 진입 → 카메라를 유적에 고정 → 줌별 스크린샷 3장 저장.
 * 추가로 유적 오브제 위치/크기/depth 덤프 + 플레이어를 유적 앞에 세워 상하단 검증.
 */
const { chromium } = require("playwright");
const fs = require("fs");

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 200)));

  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2600);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });

  // 월드 진입 (로비 3단)
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1200);
  await p.evaluate(() => { Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click(); });
  await p.waitForTimeout(700);
  await p.locator("input").first().fill("유적진단");
  await p.waitForTimeout(300);
  for (const label of ["직업 선택", "외형 선택"]) {
    await p.evaluate((lb) => { Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes(lb))?.click(); }, label);
    await p.waitForTimeout(400);
  }
  await p.evaluate(() => { Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("생성!"))?.click(); });
  await p.waitForTimeout(1400);
  await p.evaluate(() => { document.querySelector(".cursor-pointer")?.click(); });
  await p.waitForTimeout(400);
  await p.evaluate(() => { Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click(); });
  await p.waitForTimeout(2600);
  for (let i = 0; i < 4; i++) { await p.mouse.click(640, 500); await p.waitForTimeout(400); }
  for (let i = 0; i < 30; i++) {
    const w = await p.evaluate(() => !!(window.__SERTZ__?.game?.scene?.getScene("world")?.player));
    if (w) break;
    await p.waitForTimeout(400);
  }
  // 인트로 대화 전부 넘기기 — world 씬의 dialoguing 플래그가 false가 될 때까지 클릭
  for (let i = 0; i < 30; i++) {
    const d = await p.evaluate(() => window.__SERTZ__?.game?.scene?.getScene("world")?.dialoguing);
    if (!d) break;
    await p.mouse.click(640, 500);
    await p.waitForTimeout(360);
  }
  await p.waitForTimeout(800);
  console.log("DLG_GONE:", await p.evaluate(() => !window.__SERTZ__?.game?.scene?.getScene("world")?.dialoguing));

  // 유적 정보 덤프
  const info = await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!sc) return null;
    const kr = sc.keepRect, ks = sc.keepStair;
    return { keepRect: kr, keepStair: ks, cam: { x: sc.cameras.main.scrollX, y: sc.cameras.main.scrollY, zoom: sc.cameras.main.zoom } };
  });
  console.log("KEEP INFO:", JSON.stringify(info));

  if (info?.keepRect) {
    const kx = info.keepRect.x + info.keepRect.w / 2;
    const ky = info.keepRect.y + info.keepRect.h / 2;

    // 카메라를 유적으로 이동 + 줌 1.6 (타일 상태 상세)
    await p.evaluate(({ kx, ky }) => {
      const sc = window.__SERTZ__.game.scene.getScene("world");
      const cam = sc.cameras.main;
      cam.stopFollow();
      cam.setZoom(1.6);
      cam.centerOn(kx, ky + 40);
    }, { kx, ky });
    await p.waitForTimeout(900);
    fs.mkdirSync("scripts/diag", { recursive: true });
    await p.screenshot({ path: "scripts/diag/keep_live_zoom16.png" });

    // 플레이어를 유적 정면(1층)에 이동시켜 가림/depth 확인
    await p.evaluate(({ kx, ky }) => {
      const sc = window.__SERTZ__.game.scene.getScene("world");
      sc.player?.setX(kx - 60)?.setY(ky + 90);
    }, { kx, ky });
    await p.waitForTimeout(900);
    await p.screenshot({ path: "scripts/diag/keep_live_player_front.png" });

    // 줌 1.0 전체뷰
    await p.evaluate(({ kx, ky }) => {
      const sc = window.__SERTZ__.game.scene.getScene("world");
      const cam = sc.cameras.main;
      cam.setZoom(1);
      cam.centerOn(kx, ky + 30);
    }, { kx, ky });
    await p.waitForTimeout(900);
    await p.screenshot({ path: "scripts/diag/keep_live_full.png" });
  }

  console.log("PAGEERRORS:", errs.length ? errs.join(" | ") : "0");
  await b.close();
})();
