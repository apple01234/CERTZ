/**
 * 카메라 수동 추적 검증 — 1080p/720p 양쪽에서 플레이어 화면 정중앙 + 가시 확인
 */
const { chromium } = require("playwright");

async function boot(p, name) {
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 45000 });
  await p.waitForTimeout(2500);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.getByRole("button", { name: /게임 시작/ }).first().click();
  await p.waitForTimeout(900);
  await p.getByText("캐릭터 생성", { exact: false }).first().click();
  await p.waitForTimeout(400);
  await p.locator('input[placeholder*="캐릭터 이름"]').fill(name);
  await p.getByRole("button", { name: /다음 — 직업 선택/ }).click();
  await p.waitForTimeout(300);
  await p.getByText("전사", { exact: false }).first().click();
  await p.waitForTimeout(200);
  await p.getByRole("button", { name: /다음 — 외형 선택|다음/ }).last().click().catch(() => {});
  await p.waitForTimeout(500);
  await p.getByRole("button", { name: /생성!/ }).first().click();
  await p.waitForTimeout(900);
  await p.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const t = btns.find((x) => /이 캐릭터로 시작/.test(x.textContent || "")) || btns.find((x) => /시작/.test(x.textContent || ""));
    if (t) t.click();
  });
  await p.waitForTimeout(4500);
  for (let i = 0; i < 12; i++) {
    if (await p.evaluate(() => !!window.__SERTZ_SCENE__).catch(() => false)) break;
    await p.waitForTimeout(700);
  }
  for (let i = 0; i < 6; i++) { await p.mouse.click(400, 260); await p.waitForTimeout(300); }
  for (let i = 0; i < 14; i++) {
    await p.keyboard.press("Space");
    await p.waitForTimeout(500);
    const dlg = await p.evaluate(() => window.__SERTZ__?.game?.scene?.getScene("world")?.dialoguing).catch(() => null);
    if (dlg === false) break;
  }
  await p.keyboard.press("Escape");
  await p.waitForTimeout(900);
}

async function probe(p) {
  return await p.evaluate(() => {
    const s = window.__SERTZ__?.game?.scene?.getScene("world");
    const cam = s?.cameras?.main;
    const pl = s?.player;
    if (!s || !cam || !pl) return { err: "no" };
    return {
      // P4 실렌더 공식: screen = origin + zoom×(world - scroll - origin)
      sx: Math.round(cam.width / 2 + cam.zoom * (pl.x - cam.scrollX - cam.width / 2)),
      sy: Math.round(cam.height / 2 + cam.zoom * (pl.y - cam.scrollY - cam.height / 2)),
      scrollX: Math.round(cam.scrollX), scrollY: Math.round(cam.scrollY),
      zoom: cam.zoom, px: Math.round(pl.x), py: Math.round(pl.y),
      visible: pl.visible, camFilter: pl.cameraFilter, camId: cam.id,
      follow: !!cam.follow, followOffset: { x: Math.round(cam.followOffset.x), y: Math.round(cam.followOffset.y) },
    };
  });
}

(async () => {
  const b = await chromium.launch({
    executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome",
    args: ["--use-gl=swiftshader", "--no-sandbox"],
  });
  for (const vp of [{ w: 1920, h: 1080, tag: "1080p" }, { w: 1280, h: 720, tag: "720p" }]) {
    const ctx = await b.newContext({ viewport: { width: vp.w, height: vp.h } });
    const p = await ctx.newPage();
    await boot(p, `카메라검증${vp.tag}`);
    const d = await probe(p);
    const cx = vp.w / 2, cy = vp.h / 2;
    const centered = Math.abs(d.sx - cx) <= 24 && Math.abs(d.sy - cy) <= 24;
    console.log(`[${vp.tag}] 화면좌표 (${d.sx},${d.sy}) 기대 (${cx},${cy}) → ${centered ? "중앙 OK" : "이탈!"} | scroll (${d.scrollX},${d.scrollY}) zoom ${d.zoom} | follow=${d.follow} filter=${d.camFilter}/${d.camId}`);
    await p.screenshot({ path: `/tmp/pcdiag/70_${vp.tag}.png` });
    // 이동 실측 — 맵 중앙으로 텔레포트 (키보드 대신 확정 입력)
    await p.evaluate(() => {
      const s2 = window.__SERTZ__?.game?.scene?.getScene("world");
      s2.player.setPosition(750, 475);
    });
    await p.waitForTimeout(1200);
    const d2 = await probe(p);
    const centered2 = Math.abs(d2.sx - cx) <= 32 && Math.abs(d2.sy - cy) <= 32;
    console.log(`[${vp.tag}] 이동후 (${d2.sx},${d2.sy}) px=${d2.px} → ${centered2 ? "추적 OK" : "추적 실패!"}`);
    await p.screenshot({ path: `/tmp/pcdiag/71_${vp.tag}_moved.png` });
    await ctx.close();
  }
  await b.close();
})();
