/* 로비 생성 플로우 DOM 진단 — 버튼/카드 텍스트 덤프 */
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({
    executablePath: "/home/z/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell",
  });
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  await page.goto("http://localhost:3131", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(4500);
  const dump = async (tag) => {
    const els = await page.evaluate(() =>
      Array.from(document.querySelectorAll("button, [class*=game-btn], [class*=cursor-pointer]"))
        .map((b) => ({ tag: b.tagName, cls: String(b.className).slice(0, 40), txt: (b.textContent || "").trim().slice(0, 24) }))
        .filter((x) => x.txt)
    );
    console.log(`[${tag}]`, JSON.stringify(els.slice(0, 22)));
  };
  await dump("타이틀");
  await page.getByText(/새로운 모험|게임 시작/).first().click();
  await page.waitForTimeout(2200);
  await dump("로비");
  await page.getByText("캐릭터 생성").first().click();
  await page.waitForTimeout(1000);
  await dump("생성클릭후");
  console.log("input 개수:", await page.locator("input").count());
  await browser.close();
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
