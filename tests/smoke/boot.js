/**
 * tests/smoke/boot.js — 부팅 스모크
 *
 * 판정(수치):
 *   ① 404/5xx 응답 0건  ← P0-1 수리 효과를 여기서 회귀 감시한다
 *   ② 타이틀 도달
 *   ③ 에셋 요청 수 / 전송량 기록(추세 감시, 임계는 P1-3 완료 후 조인다)
 *   ④ pageerror 0건 (치명 예외)
 *
 * 사용: node tests/smoke/boot.js
 */
const { launch, report } = require("./lib");

(async () => {
  const { browser, page, errors, responses } = await launch();
  let fail = 1;
  try {
    await page.goto(`${process.env.SERTZ_BASE || "http://127.0.0.1:3000"}/?renderer=canvas`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await page.waitForTimeout(25000);

    const bad = responses.filter((r) => r.status >= 400);
    const assets = responses.filter((r) => /\/assets\d?\//.test(r.url));
    const bytes = await page.evaluate(() =>
      performance.getEntriesByType("resource").reduce((a, r) => a + (r.transferSize || 0), 0)
    );
    const titleReached = await page.evaluate(() =>
      Array.from(document.querySelectorAll("button")).some((b) => /게임 시작/.test(b.textContent || ""))
    );

    fail = report("BOOT 스모크", [
      { name: "타이틀 도달", pass: titleReached },
      { name: "4xx/5xx 0건", pass: bad.length === 0, detail: bad.length ? bad.slice(0, 5).map((b) => `${b.status} ${b.url}`).join(" | ") : "0건" },
      { name: "에셋 요청 기록", pass: assets.length > 0, detail: `${assets.length}건` },
      { name: "전송량 기록", pass: bytes > 0, detail: `${(bytes / 1048576).toFixed(1)}MB` },
      { name: "pageerror 0건", pass: errors.length === 0, detail: errors.length ? errors.slice(0, 3).join(" | ") : "0건" },
    ]);
  } finally {
    await browser.close();
  }
  process.exit(fail === 0 ? 0 : 1);
})();
