/** 가로 모바일 — 로비 스크롤 동작 실측: 컨테이너 scrollTop 조작으로 버튼 도달 가능성 검사 */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, userAgent: "Mozilla/5.0 (Linux; Android 13) Chrome/120 Mobile" });
  const p = await ctx.newPage();
  await p.goto("http://localhost:4599/index.html", { waitUntil: "domcontentloaded" });
  for (let i = 0; i < 40 && !(await p.evaluate(() => !!Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("게임 시작")))); i++) await p.waitForTimeout(500);
  await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("게임 시작"))?.click());
  await p.waitForTimeout(1500);
  /* 캐릭터 생성 (스토리지는 이전 프로브에서 이미 있음 — 없으면 생성) */
  const hasStart = await p.evaluate(() => !!Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작")));
  if (!hasStart) {
    await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click());
    await p.waitForTimeout(900);
    await p.locator("input").first().fill("가로테스트");
    for (const label of ["직업 선택", "외형 선택"]) { await p.evaluate((lb) => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes(lb))?.click(), label); await p.waitForTimeout(350); }
    await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("생성!"))?.click());
    await p.waitForTimeout(1400);
  }
  const r1 = await p.evaluate(() => {
    const sc = document.querySelector(".sertz-scroll");
    const sb = Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"));
    const r = sb.getBoundingClientRect();
    return { scrollTop: sc.scrollTop, scrollHeight: sc.scrollHeight, clientHeight: sc.clientHeight, btnY: Math.round(r.y + r.height / 2), touchAction: getComputedStyle(sc).touchAction, overflowY: getComputedStyle(sc).overflowY };
  });
  console.log("스크롤 전:", JSON.stringify(r1));
  /* 스와이프 시뮬레이션: 터치 드래그 */
  await p.touchscreen.tap(422, 200).catch(() => {}); // 카드 선택
  await p.waitForTimeout(400);
  // touchscreen으로 드래그 (playwright는 swipe API 부재 → dispatchEvent로 대체)
  const r2 = await p.evaluate(() => {
    const sc = document.querySelector(".sertz-scroll");
    sc.scrollTop = 99999;
    const sb = Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"));
    const r = sb.getBoundingClientRect();
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { scrollTopAfter: sc.scrollTop, btnY: Math.round(r.y + r.height / 2), nowVisible: r.y + r.height / 2 >= 0 && r.y + r.height / 2 <= innerHeight, covered: top ? (!sb.contains(top) && top !== sb) : true, topText: (top?.textContent || "").slice(0, 20) };
  });
  console.log("강제 스크롤 후:", JSON.stringify(r2));
  await p.screenshot({ path: "/home/z/my-project/scripts/shot_land_scrolled.png" });
  await b.close();
})();
