/**
 * v3.1.0 스모크 테스트 — 게임 부팅 + 핵심 UI 동작 확인
 *  1) 타이틀 로드 → 새로운 모험 → 마을 진입
 *  2) 설정창(O) 볼륨 슬라이더 존재 확인
 *  3) 콘솔 에러 수집
 */
const { chromium } = require("playwright");

(async () => {
  const BASE = process.env.BASE || "http://localhost:3000";
  const errors = [];
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 200));
  });
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + String(e).slice(0, 200)));

  await page.goto(BASE, { waitUntil: "networkidle", timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(6000);
  await page.screenshot({ path: "scripts/v310-1-title.png" });

  // 새로운 모험
  const newBtn = page.getByText("새로운 모험");
  if (await newBtn.count()) {
    await newBtn.first().click();
    await page.waitForTimeout(7000);
  }
  await page.screenshot({ path: "scripts/v310-2-village.png" });

  // 설정창 열기 — 시작 시 자동 오픈된 퀘스트 패널을 ESC로 닫고 O 클릭
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  await page.screenshot({ path: "scripts/v310-2b-hud.png" });
  const optBtn = page.locator('[aria-label="설정/키 매핑 열기 (O)"]');
  if (await optBtn.count()) {
    await optBtn.first().click({ force: true });
    await page.waitForTimeout(800);
  }
  const bgmSlider = await page.locator('[aria-label="BGM 볼륨"]').count();
  const sfxSlider = await page.locator('[aria-label="효과음 볼륨"]').count();
  await page.screenshot({ path: "scripts/v310-3-options.png" });

  const canvas = await page.locator("canvas").count();
  console.log(JSON.stringify({
    ok: canvas > 0 && bgmSlider > 0 && sfxSlider > 0 && errors.length === 0,
    canvas,
    bgmSlider,
    sfxSlider,
    consoleErrors: errors.slice(0, 5),
  }, null, 2));
  await browser.close();
})().catch((e) => { console.error("SMOKE FAIL:", e.message); process.exit(1); });
