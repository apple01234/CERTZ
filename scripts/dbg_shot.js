/** 스크린샷 픽셀 비교 — fadeOut 완료(어두움) vs resetFX 후(밝음) */
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--disable-web-security"] });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  await page.goto(process.env.SERTZ_URL || "http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(6000);
  await page.evaluate(() => localStorage.removeItem("sertz_save_v2"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  for (let i = 0; i < 3; i++) {
    const c = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.includes("새로운 모험"));
      if (b) { b.click(); return true; } return false;
    });
    if (c) break; await page.waitForTimeout(2500);
  }
  await page.waitForTimeout(4000);

  const analyze = async (tag) => {
    const buf = await page.screenshot();
    const { createCanvas, loadImage } = (() => { try { return require("canvas"); } catch { return {}; } })();
    if (!loadImage) {
      const sharp = (() => { try { return require("sharp"); } catch { return null; } })();
      if (sharp) {
        const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
        let s = 0, n = 0;
        for (let i = 0; i < data.length; i += info.channels * 37) { s += (data[i] + data[i + 1] + data[i + 2]) / 3; n++; }
        console.log(`${tag} 평균휘도: ${Math.round(s / n)}`);
        return Math.round(s / n);
      }
      console.log(`${tag}: 이미지 파서 없음`); return -1;
    }
    const img = await loadImage(buf);
    const cv = createCanvas(64, 36); const cx = cv.getContext("2d");
    cx.drawImage(img, 0, 0, 64, 36);
    const d = cx.getImageData(0, 0, 64, 36).data;
    let s = 0;
    for (let i = 0; i < d.length; i += 4 * 7) s += (d[i] + d[i + 1] + d[i + 2]) / 3;
    const v = Math.round(s / (d.length / (4 * 7)));
    console.log(`${tag} 평균휘도: ${v}`);
    return v;
  };

  await analyze("1-정상");
  await page.evaluate(() => window.__SERTZ_SCENE__.cameras.main.fadeOut(300, 0, 0, 0));
  await page.waitForTimeout(3500);
  const darkV = await analyze("2-페이드완료(어두움)");
  await page.evaluate(() => window.__SERTZ_SCENE__.cameras.main.resetFX());
  await page.waitForTimeout(900);
  const healV = await analyze("3-resetFX후(복구)");
  console.log(darkV >= 0 && healV >= 0 ? (healV > darkV * 2 ? "결론: resetFX로 화면 복구 확인 — 자가치유 유효" : "결론: 복구 미확인") : "결론: 픽셀 분석 불가");
  await browser.close();
})();
