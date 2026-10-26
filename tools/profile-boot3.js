/**
 * tools/profile-boot3.js — performance resource entries 기준 확정 측정 (P1-3)
 *
 * 앞선 두 프로파일이 서로 다른 수치를 냈다(총 6,489 vs '/' 3,165 vs 1).
 * Playwright response 이벤트는 캐시/재사용 응답까지 잡아 부풀 수 있으므로,
 * 브라우저가 실제로 기록한 Resource Timing 으로 확정한다.
 *
 * 사용: node tools/profile-boot3.js
 */
const { launch } = require("../tests/smoke/lib");

(async () => {
  const { browser, page, errors } = await launch();
  try {
    /* 중요: Resource Timing 버퍼 기본값은 250개다. 키우지 않으면 250에서 잘려
     *  "총 250건" 같은 거짓 확정치가 나온다(실측으로 겪음). navigation 전에 늘려야 한다. */
    await page.addInitScript(() => {
      try {
        performance.setResourceTimingBufferSize(20000);
      } catch { /* 미지원 무시 */ }
    });
    await page.goto(`${process.env.SERTZ_BASE || "http://127.0.0.1:3000"}/?renderer=canvas`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await page.waitForTimeout(25000);

    const data = await page.evaluate(() => {
      const es = performance.getEntriesByType("resource");
      const byInit = {};
      const byGroup = {};
      let total = 0;
      let bytes = 0;
      for (const e of es) {
        total++;
        bytes += e.transferSize || 0;
        byInit[e.initiatorType || "?"] = (byInit[e.initiatorType || "?"] || 0) + 1;
        const n = e.name;
        let g = "other";
        if (/\/assets\d?\//.test(n)) {
          const base = (n.split("/").pop() || "").replace(/\.\w+$/, "");
          const t = base.split("_");
          g = "assets:" + (t.length > 1 && /^(cost|costm|jobf|jobm|chm|chf|hero|gm)$/.test(t[0]) ? t[0] : t[0]);
        } else if (n.startsWith("data:") || n.startsWith("blob:")) g = "inline";
        else if (/_next\//.test(n)) g = "next";
        byGroup[g] = (byGroup[g] || 0) + 1;
      }
      /* 중복 이름 */
      const names = {};
      for (const e of es) names[e.name] = (names[e.name] || 0) + 1;
      const dup = Object.entries(names).filter(([, n]) => n > 1).length;
      return { total, bytes, byInit, byGroup, dup };
    });

    console.log("── Resource Timing 확정치 ──");
    console.log(`총 리소스 ${data.total}건 / ${(data.bytes / 1048576).toFixed(1)}MB / 중복이름 ${data.dup}종`);
    console.log(`pageerror ${errors.length}`);
    console.log("\n[initiatorType]");
    for (const [k, v] of Object.entries(data.byInit).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(v).padStart(5)}  ${k}`);
    }
    console.log("\n[그룹]");
    for (const [k, v] of Object.entries(data.byGroup).sort((a, b) => b[1] - a[1]).slice(0, 18)) {
      console.log(`  ${String(v).padStart(5)}  ${k}`);
    }
  } finally {
    await browser.close();
  }
})();
