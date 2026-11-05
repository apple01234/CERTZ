/**
 * 대화창 진단 — dialogue:show 가 실제로 발행되고 DOM 에 패널이 붙는지 확인.
 * 사용: node scripts/diag-dialogue.mjs http://127.0.0.1:3110
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://127.0.0.1:3110";

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text().slice(0, 160)}`));
page.on("pageerror", (e) => logs.push(`[err] ${String(e).slice(0, 200)}`));

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.locator("button", { hasText: "게임 시작" }).first().click({ timeout: 120000 });
await page.getByRole("button", { name: "캐릭터 생성", exact: true }).first().click();
await page.locator("input").first().fill("진단" + String(Date.now()).slice(-4));
await page.getByRole("button", { name: /다음/ }).click();
await page.getByRole("button", { name: "모험가로 생성!" }).click({ timeout: 30000 });
await page.getByRole("button", { name: "이 캐릭터로 시작" }).click({ timeout: 30000 });
await page.waitForFunction(() => window.__SERTZ_SCENE__?.player, { timeout: 90000 });
await page.waitForTimeout(2000);

/* dialogue:show 를 가로채 기록 */
await page.evaluate(() => {
  window.__DLG = [];
  const bus = window.__SERTZ_BUS__;
  if (bus?.on) bus.on("dialogue:show", (d) => window.__DLG.push(d));
});

const before = await page.evaluate(() => ({
  dialoguing: window.__SERTZ_SCENE__?.dialoguing,
  panelTexts: [...document.querySelectorAll("div")].filter((d) => d.className.includes?.("game-panel")).map((d) => d.textContent.slice(0, 80)),
}));
console.log("초기 상태:", JSON.stringify(before));

/* 강제로 대화 표시 */
const forced = await page.evaluate(() => {
  const s = window.__SERTZ_SCENE__;
  try {
    s.showDialogueRaw?.({ speaker: "라일락", lines: ["지하 감옥에서 검을 뽑자 섬광이 번졌다. 다시 눈을 떴을 때도 내 손에는 그 검이 있었다."] });
    return { ok: true };
  } catch (e) { return { ok: false, err: String(e).slice(0, 200) }; }
});
console.log("강제 표시:", JSON.stringify(forced));
await page.waitForTimeout(1800);

const after = await page.evaluate(() => ({
  dialoguing: window.__SERTZ_SCENE__?.dialoguing,
  captured: window.__DLG || [],
  panels: [...document.querySelectorAll("div")].filter((d) => d.className.includes?.("game-panel")).map((d) => ({
    cls: d.className.slice(0, 60),
    text: d.textContent.slice(0, 100),
    rect: (() => { const r = d.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; })(),
  })),
}));
console.log("사후 상태:", JSON.stringify(after, null, 1).slice(0, 2500));
console.log("\n콘솔 로그(마지막 8):");
logs.slice(-8).forEach((l) => console.log(" ", l));

await browser.close();
