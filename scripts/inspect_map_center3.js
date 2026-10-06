/**
 * 맵 x축 중앙 정렬 실측 v3 — 카메라 보정 수정본 검증 (로컬 dev)
 *  기대값(1920×943, z=1.75, 뷰 1097, 마을 1500):
 *   - follow desired = player.x - 548.6, clamp [0, 403]
 *   - 플레이어 x∈[549,951] → offCenter ≈ 0 (정중앙)
 *   - 맵 가장자리 밀착: 좌 클램프 시 맵 왼쪽 끝 화면 x=0, 우 클램프 시 오른쪽 끝 화면 x=1920 (공백 0)
 */
const { chromium } = require("playwright");

const EXE = "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome";
const URL = "http://localhost:3000";

async function bootToWorld(p, name) {
  await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(3500);
  await p.waitForSelector("text=게임 시작", { timeout: 90000 });
  for (let i = 0; i < 30 && !(await p.evaluate(() => !!window.__SERTZ_DEFER_DONE__)); i++) await p.waitForTimeout(300);
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1500);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click();
  });
  await p.waitForTimeout(800);
  await p.locator("input").first().fill(name);
  await p.waitForTimeout(300);
  for (const label of ["직업 선택", "외형 선택"]) {
    await p.evaluate((lb) => {
      Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes(lb))?.click();
    }, label);
    await p.waitForTimeout(500);
  }
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("생성!"))?.click();
  });
  await p.waitForTimeout(1600);
  await p.evaluate(() => { document.querySelector(".cursor-pointer")?.click(); });
  await p.waitForTimeout(500);
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
    const leftEdgeScreenX = (0 - cam.scrollX) * z; // 맵 왼쪽 끝의 화면 x (0=밀착, >0=공백)
    const rightEdgeScreenX = (sc.stageW - cam.scrollX) * z; // 맵 오른쪽 끝의 화면 x (≤width=도달 가능)
    return {
      px: Math.round(sc.player.x),
      scrollX: Math.round(cam.scrollX * 10) / 10,
      zoom: z,
      offCenter: Math.round(screenPx - cam.width / 2),
      leftEdgeScreenX: Math.round(leftEdgeScreenX),
      rightEdgeScreenX: Math.round(rightEdgeScreenX),
      voidLeft: leftEdgeScreenX > 1,
      rightUnreachable: rightEdgeScreenX > cam.width + 1,
      followOffsetX: Math.round(cam.followOffset.x * 10) / 10,
    };
  });
}

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--no-sandbox"], executablePath: EXE });
  const ctx = await b.newContext({ viewport: { width: 1920, height: 943 } });
  const p = await ctx.newPage();
  console.log("boot:", await bootToWorld(p, "보정실측"));
  await p.waitForTimeout(4000);

  const spots = [
    { tag: "spawn-180", x: 180 },
    { tag: "midleft-400", x: 400 },
    { tag: "center-750", x: 750 },
    { tag: "right-1200", x: 1200 },
    { tag: "edge-1440", x: 1440 },
  ];
  for (const s of spots) {
    await p.evaluate((sx) => {
      const sc = window.__SERTZ__.game.scene.getScene("world");
      sc.player.x = sx;
    }, s.x);
    await p.waitForTimeout(9000); // 저fps 헤드리스 러프 수렴 대기
    const m = await metrics(p);
    console.log(`[${s.tag}]`, JSON.stringify(m));
    if (s.tag === "center-750" || s.tag === "edge-1440") {
      await p.screenshot({ path: `/home/z/my-project/scripts/v3_${s.tag}.png` });
    }
  }
  await b.close();
})();
