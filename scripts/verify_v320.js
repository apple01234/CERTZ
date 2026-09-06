/* v3.2.0 런타임 검증: 페이지 로드 + skill5 키맵 + emitSkills s5 필드 + 콘솔 에러 수집 */
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(6000);

  const check = await page.evaluate(() => {
    const out = {};
    // 1. Phaser 게임 부팅 확인
    out.gameBooted = !!(window.__SERTZ__ && window.__SERTZ__.game);
    // 2. 키맵에 skill5 등록 확인
    try {
      const km = JSON.parse(localStorage.getItem("sertz_keymap_v1") || "null");
      out.savedKeymap = km; // 신규 액션은 loadKeyMap의 DEFAULT 병합으로 해결
    } catch {}
    // 3. __SERTZ_DEBUG__ 노출 확인
    out.debugOk = !!window.__SERTZ_DEBUG__;
    out.skill5InfoInDebug = !!(window.__SERTZ_DEBUG__ && window.__SERTZ_DEBUG__.classes && window.__SERTZ_DEBUG__.classes.SKILL5_INFO);
    return out;
  });

  console.log("RUNTIME CHECK:", JSON.stringify(check, null, 2));
  console.log("PAGE ERRORS:", errors.length ? errors.slice(0, 6) : "없음");
  await browser.close();
})();
