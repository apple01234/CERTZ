/**
 * 맵 x축 중앙 정렬 실측 v2 — 인트로 대화 스킵 후 카메라 안정 상태에서 실측
 *  시나리오: ①대화 스킵+안정화 ②플레이어 텔레포트(좌/중앙/우)마다 지표+스크린샷
 */
const { chromium } = require("playwright");

const EXE = "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome";
const URL = "https://sertz.vercel.app";

async function bootToWorld(p, name) {
  await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await p.waitForTimeout(2600);
  await p.waitForSelector("text=게임 시작", { timeout: 40000 });
  for (let i = 0; i < 30 && !(await p.evaluate(() => !!window.__SERTZ_DEFER_DONE__)); i++) await p.waitForTimeout(300);
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1200);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click();
  });
  await p.waitForTimeout(700);
  await p.locator("input").first().fill(name);
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
  for (let i = 0; i < 60; i++) {
    await p.waitForTimeout(1000);
    const ok = await p.evaluate(() => {
      const sc = window.__SERTZ__?.game?.scene?.getScene("world");
      return !!(sc && sc.player && sc.stageDef);
    }).catch(() => false);
    if (ok) return true;
  }
  return false;
}

async function metrics(p) {
  return p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!sc || !sc.player || !sc.cameras?.main) return null;
    const cam = sc.cameras.main;
    const z = cam.zoom || 1;
    const screenPx = (sc.player.x - cam.scrollX) * z;
    return {
      stage: sc.stageDef?.key,
      player: { x: Math.round(sc.player.x), y: Math.round(sc.player.y) },
      cam: { scrollX: Math.round(cam.scrollX), scrollY: Math.round(cam.scrollY), zoom: z, w: cam.width, h: cam.height },
      offCenter: Math.round(screenPx - cam.width / 2),
      dialoguing: !!sc.dialoguing,
      boundsUse: cam.useBounds,
      bounds: cam.bounds ? { x: cam.bounds.x, right: cam.bounds.right, w: cam.bounds.width } : null,
    };
  });
}

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--no-sandbox"], executablePath: EXE });
  const ctx = await b.newContext({ viewport: { width: 1920, height: 943 } });
  const p = await ctx.newPage();
  console.log("boot:", await bootToWorld(p, "정렬점검2"));
  // 인트로 대화 전부 스킵 (Enter) — dialoguing false 될 때까지 최대 20회
  for (let i = 0; i < 20; i++) {
    const dlg = await p.evaluate(() => !!window.__SERTZ__?.game?.scene?.getScene("world")?.dialoguing).catch(() => false);
    if (!dlg) break;
    await p.keyboard.press("Enter");
    await p.waitForTimeout(700);
  }
  await p.waitForTimeout(2500); // 카메라 러프 안정화
  const m0 = await metrics(p);
  console.log("[안정화 후]", JSON.stringify(m0));
  await p.screenshot({ path: "/home/z/my-project/scripts/v2_settled.png" });

  // 텔레포트: 좌측 끝 / 맵 중앙 / 우측 끝 — 각각 러프 안정 대기 후 실측
  const spots = [
    { tag: "left-edge", x: 60 },
    { tag: "center", x: 750 },
    { tag: "right-edge", x: 1440 },
  ];
  for (const s of spots) {
    await p.evaluate((sx) => {
      const sc = window.__SERTZ__.game.scene.getScene("world");
      sc.player.x = sx;
      sc.cameras.main.centerOn(sx, sc.player.y); // 즉시 스냅 — 러프 대기 최소화
    }, s.x);
    await p.waitForTimeout(1500);
    const m = await metrics(p);
    console.log(`[${s.tag}]`, JSON.stringify(m));
    await p.screenshot({ path: `/home/z/my-project/scripts/v2_${s.tag}.png` });
  }
  await b.close();
})();
