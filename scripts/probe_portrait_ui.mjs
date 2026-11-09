/**
 * probe_portrait_ui.mjs — 대화창에서 초상화 이미지가 **실제 화면에** 그려지는지 검증.
 * window.__SERTZ_EB__ 로 dialogue:show 를 발생시켜 DialogueBox 의 <img> 를 띄우고,
 * naturalWidth / 렌더 크기 / 스크린샷을 확인한다.
 */
import { chromium } from "playwright";

const BASE = process.env.PROBE_URL || "http://127.0.0.1:3500";
const SPEAKERS = ["연합 안내인", "라일락 연합의 기록자", "마을 주민", "해설"];
const OUT = process.env.OUT_DIR || "/root/.hermes/cache/scratch";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("canvas", { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(65000);

const results = [];
for (const sp of SPEAKERS) {
  const emitted = await page.evaluate((speaker) => {
    const eb = window.__SERTZ_EB__;
    if (!eb) return false;
    eb.emit("dialogue:show", { speaker, lines: ["초상화 검증용 대사입니다."] });
    return true;
  }, sp);
  if (!emitted) { results.push({ speaker: sp, error: "EventBus 훅 없음" }); break; }

  await page.waitForTimeout(1200);

  const info = await page.evaluate(() => {
    // 대화창의 초상화 img — npcportrait 경로를 가진 것
    const imgs = [...document.querySelectorAll("img")].filter((i) =>
      (i.getAttribute("src") || "").includes("/npcportrait/"));
    if (!imgs.length) return { found: false, allSrcs: [...document.querySelectorAll("img")].map(i => i.getAttribute("src")).slice(0, 6) };
    const el = imgs[0];
    const r = el.getBoundingClientRect();
    return {
      found: true, src: el.getAttribute("src"),
      natural: [el.naturalWidth, el.naturalHeight],
      rect: [Math.round(r.width), Math.round(r.height)],
      visible: r.width > 0 && r.height > 0 && getComputedStyle(el).display !== "none",
    };
  });
  results.push({ speaker: sp, ...info });
  await page.screenshot({ path: `${OUT}/portrait_ui_${SPEAKERS.indexOf(sp)}.png` }).catch(() => {});
}
await browser.close();

const ok = results.length === SPEAKERS.length
  && results.every((r) => r.found && r.natural?.[0] === 84 && r.visible);
console.log(JSON.stringify({ ok, results, errs: errs.slice(0, 3) }, null, 1));
process.exit(ok ? 0 : 1);
