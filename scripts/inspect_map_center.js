/**
 * 맵 x축 중앙 정렬 실측 — 유저 리포트 "맵이 지금 위치에서 x축이 화면 정 가운데에 있어야지"
 *  라이브 사이트 부팅 → 캐릭터 생성 → 월드 진입 → 카메라/플레이어 정렬 지표 수집 + 스크린샷
 *  시나리오: ①마을 스폰 직후 ②좌측 끝까지 이동(경기 클램프) ③우측 끝 — PC 3종 뷰포트
 */
const { chromium } = require("playwright");

const EXE = "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome";
const URL = "https://sertz.vercel.app";
const VIEWPORTS = [
  { w: 1920, h: 943, tag: "pc-1080p-chrome" },
  { w: 1366, h: 768, tag: "laptop-1366" },
  { w: 3840, h: 2160, tag: "4k-fullscreen" },
];

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
    if (ok) break;
  }
}

async function metrics(p) {
  return p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!sc || !sc.player || !sc.cameras?.main) return null;
    const cam = sc.cameras.main;
    const z = cam.zoom || 1;
    // 화면상 플레이어 x = (player.x - scrollX) * zoom
    const screenPx = (sc.player.x - cam.scrollX) * z;
    // 클램프 상태: 스크롤 여유
    const scrollMin = cam.bounds ? Math.min(0, cam.bounds.x) : 0;
    const scrollMaxX = cam.bounds ? Math.max(0, cam.bounds.right - cam.width / z) : 0;
    return {
      stage: sc.stageDef?.key,
      stageW: sc.stageW, stageH: sc.stageH,
      player: { x: Math.round(sc.player.x), y: Math.round(sc.player.y) },
      cam: { scrollX: Math.round(cam.scrollX), scrollY: Math.round(cam.scrollY), zoom: z, w: cam.width, h: cam.height },
      screenPlayerX: Math.round(screenPx),
      screenCenterX: Math.round(cam.width / 2),
      offCenter: Math.round(screenPx - cam.width / 2),
      visibleWorldW: Math.round(cam.width / z),
      clampableX: cam.width / z >= sc.stageW,
      scrollMaxX: Math.round(scrollMaxX),
    };
  });
}

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--no-sandbox"], executablePath: EXE });
  for (const vp of VIEWPORTS) {
    const ctx = await b.newContext({ viewport: { width: vp.w, height: vp.h } });
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 150)));
    try {
      console.log(`\n===== ${vp.tag} (${vp.w}x${vp.h}) =====`);
      await bootToWorld(p, "정렬점검");
      await p.waitForTimeout(2500); // 카메라 러프 안정화
      const m1 = await metrics(p);
      console.log("[스폰 직후]", JSON.stringify(m1));
      await p.screenshot({ path: `/home/z/my-project/scripts/shot_${vp.tag}_spawn.png` });

      // 좌측 끝 이동: A 키 홀드 4초
      await p.keyboard.down("a");
      await p.waitForTimeout(4000);
      await p.keyboard.up("a");
      await p.waitForTimeout(1200);
      const m2 = await metrics(p);
      console.log("[좌측 이동후]", JSON.stringify(m2));
      await p.screenshot({ path: `/home/z/my-project/scripts/shot_${vp.tag}_left.png` });

      // 우측 끝 이동: D 키 홀드 8초
      await p.keyboard.down("d");
      await p.waitForTimeout(8000);
      await p.keyboard.up("d");
      await p.waitForTimeout(1200);
      const m3 = await metrics(p);
      console.log("[우측 이동후]", JSON.stringify(m3));
      await p.screenshot({ path: `/home/z/my-project/scripts/shot_${vp.tag}_right.png` });

      if (errs.length) console.log("ERRORS:", errs.slice(0, 3).join(" | "));
    } catch (e) {
      console.log(`[${vp.tag}] FAIL: ${String(e).slice(0, 200)}`);
    }
    await ctx.close();
  }
  await b.close();
})();
