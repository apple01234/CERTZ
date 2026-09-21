/**
 * v1.4.3 유저 리포트 재현 3차 — 모바일 뷰포트 (APK 번들 대상)
 *  세로 390x844 / 가로 844x390에서: 타이틀 → 로비 → 버튼 가시성·클릭 가능성 → 월드 진입
 */
const { chromium } = require("playwright");

(async () => {
  for (const vp of [{ name: "세로 390x844", w: 390, h: 844 }, { name: "가로 844x390", w: 844, h: 390 }, { name: "세로 360x800", w: 360, h: 800 }]) {
    const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
    const ctx = await b.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: true, isMobile: true, userAgent: "Mozilla/5.0 (Linux; Android 13; SM-G991N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36" });
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 200)));

    console.log(`\n===== ${vp.name} =====`);
    await p.goto("http://localhost:4599/index.html", { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(3000);

    /* 타이틀 도달 */
    let titleOk = false;
    for (let i = 0; i < 20; i++) {
      if (await p.evaluate(() => !!Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("게임 시작")))) { titleOk = true; break; }
      await p.evaluate(() => window.__SERTZ_EB__?.emit?.("rpg:exitMenu", { lobby: false }));
      await p.waitForTimeout(1200);
    }
    console.log("타이틀 도달:", titleOk, "| errs:", errs.length);
    if (!titleOk) { await p.screenshot({ path: `/home/z/my-project/scripts/shot_m_${vp.w}x${vp.h}_title.png` }); await b.close(); continue; }

    /* 게임 시작 → 로비 */
    await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("게임 시작"))?.click());
    await p.waitForTimeout(1800);
    const lobbyOk = await p.evaluate(() => !!document.body.innerText.match(/캐릭터 생성|이 캐릭터로 시작/));
    console.log("로비 도달:", lobbyOk);

    /* 시작 버튼 가시성 실측 */
    const btn = await p.evaluate(() => {
      const el = Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"));
      if (!el) return { found: false };
      const r = el.getBoundingClientRect();
      const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
      const top = document.elementFromPoint(cx, cy);
      const covered = top ? !el.contains(top) && top !== el : true;
      return { found: true, x: Math.round(cx), y: Math.round(cy), w: Math.round(r.width), h: Math.round(r.height), inView: cy >= 0 && cy <= innerHeight && cx >= 0 && cx <= innerWidth, covered, topTag: top?.tagName, topText: (top?.textContent || "").slice(0, 30) };
    });
    console.log("시작 버튼:", JSON.stringify(btn));
    if (btn.found) {
      await p.screenshot({ path: `/home/z/my-project/scripts/shot_m_${vp.w}x${vp.h}_lobby.png` });
      /* 실제 탭 시도 (좌표 탭) */
      if (btn.inView && !btn.covered) {
        await p.touchscreen.tap(btn.x, btn.y).catch(() => {});
        await p.waitForTimeout(1200);
        const started = await p.evaluate(() => !!window.__SERTZ__?.game?.scene?.getScene("world"));
        console.log("탭 후 world 씬:", started);
      } else {
        console.log("❌ 버튼이 화면 밖이거나 가려짐 — 유저가 시작 불가능한 상태");
      }
    } else {
      console.log("❌ 시작 버튼을 아예 찾을 수 없음 (스크롤 필요?)");
      await p.screenshot({ path: `/home/z/my-project/scripts/shot_m_${vp.w}x${vp.h}_nobtn.png` });
    }
    if (errs.length) console.log("errs:", errs.slice(0, 4).join(" | "));
    await b.close();
  }
})();
