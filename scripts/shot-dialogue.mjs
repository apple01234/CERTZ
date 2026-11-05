/**
 * 연출 대사창 스크린샷 — 지시 #5 (AI 티 나지 않는 UI) 검토용.
 * 사용: node scripts/shot-dialogue.mjs http://127.0.0.1:3110
 */
import { chromium } from "playwright";
import path from "node:path";

const BASE = process.argv[2] || "http://127.0.0.1:3110";
const OUT = "/root/.hermes/cache/scratch";

const browser = await chromium.launch({
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.locator("button", { hasText: "게임 시작" }).first().click({ timeout: 120000 });
await page.getByRole("button", { name: "캐릭터 생성", exact: true }).first().click();
await page.locator("input").first().fill("대사" + String(Date.now()).slice(-4));
await page.getByRole("button", { name: /다음/ }).click();
await page.getByRole("button", { name: "모험가로 생성!" }).click({ timeout: 30000 });
await page.getByRole("button", { name: "이 캐릭터로 시작" }).click({ timeout: 30000 });
await page.waitForFunction(() => window.__SERTZ_SCENE__?.player, { timeout: 90000 });
await page.waitForTimeout(2500);

/* 대화창을 확실히 띄운다 — showDialogueRaw 가 실제 경로(WorldScene) */
await page.evaluate(() => {
  window.__SERTZ_SCENE__.showDialogueRaw({
    speaker: "라일락",
    lines: ["지하 감옥에서 검을 뽑자 섬광이 번졌다. 다시 눈을 떴을 때도 내 손에는 그 검이 있었다."],
  });
});
await page.waitForTimeout(2200);
const box = await page.evaluate(() => {
  const el = [...document.querySelectorAll("div")].find((d) => d.className.includes?.("game-panel") && d.textContent.includes("라일락"));
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
});
console.log("대화창 rect:", JSON.stringify(box));
if (box) {
  await page.screenshot({ path: path.join(OUT, "dlg_1_720.png"),
    clip: { x: Math.max(0, box.x - 30), y: Math.max(0, box.y - 24), width: Math.min(1280, box.w + 60), height: box.h + 48 } });
}

/* 모바일 폭 (S20+ 기준 412 CSS px) */
await page.setViewportSize({ width: 412, height: 915 });
await page.waitForTimeout(1500);
const mbox = await page.evaluate(() => {
  const el = [...document.querySelectorAll("div")].find((d) => d.className.includes?.("game-panel") && d.textContent.includes("라일락"));
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
});
console.log("모바일 rect:", JSON.stringify(mbox));
if (mbox) {
  await page.screenshot({ path: path.join(OUT, "dlg_3_mobile.png"),
    clip: { x: 0, y: Math.max(0, mbox.y - 16), width: 412, height: Math.min(915 - mbox.y + 16, mbox.h + 32) } });
}

console.log("저장:", OUT);
await browser.close();
