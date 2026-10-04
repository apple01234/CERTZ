/* buildSave 실패 원인 프로브 — 플레이어 소멸 시점 추적 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");

const PORT = 3132;
const URL = `http://localhost:${PORT}`;

async function waitForServer() {
  for (let i = 0; i < 90; i++) {
    try { const r = await fetch(`${URL}/api/version`); if (r.ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("서버 기동 실패");
}

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production", PORT: String(PORT) }, stdio: "ignore" });
  await waitForServer();
  console.log("서버 기동");
  const browser = await chromium.launch({
    executablePath: "/home/z/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell",
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 150)));
  page.on("console", (m) => { if (m.type() === "error") console.log("[console.error]", m.text().slice(0, 150)); });

  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.getByText(/새로운 모험|게임 시작/).first().waitFor({ timeout: 70000 });
  await page.waitForTimeout(900);
  await page.getByText(/새로운 모험|게임 시작/).first().click({ timeout: 30000 });
  await page.getByText("캐릭터 생성").first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(800);
  await page.getByText("캐릭터 생성").first().click({ timeout: 30000 });
  await page.locator("input").first().fill("세르츠", { timeout: 20000 });
  await page.waitForTimeout(350);
  await page.getByText(/다음/).first().click({ timeout: 15000 });
  await page.waitForTimeout(700);
  try { await page.getByText(/전사/).first().click({ timeout: 6000 }); } catch {}
  await page.waitForTimeout(500);
  await page.getByText(/다음/).first().click({ timeout: 15000 });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    const opts = Array.from(document.querySelectorAll("button")).filter((b) => b.querySelector("img,canvas") || /피부|백자|외형|색조/.test(b.textContent || ""));
    opts[0]?.click();
  });
  await page.waitForTimeout(450);
  await page.getByText(/생성!|이 캐릭터로 시작/).first().click({ timeout: 15000 });

  /* 플레이어 상태 20초 추적 */
  const probe = () => page.evaluate(() => {
    try {
      const w = window.__SERTZ__?.game?.scene?.getScene("world");
      return { hasW: !!w, hasPlayer: !!w?.player, lv: w?.player?.lv, introStep: w?.introStep, dialoguing: !!w?.dialoguing, sceneKey: w?.scene?.settings?.status, stage: w?.stageDef?.key };
    } catch (e) { return { err: String(e).slice(0, 80) }; }
  });
  for (let i = 0; i < 40; i++) {
    const s = await probe();
    console.log(`t+${(i * 0.5).toFixed(1)}s`, JSON.stringify(s));
    if (s.hasPlayer && s.lv) break;
    await page.waitForTimeout(500);
  }
  /* buildSave 직접 호출 */
  const bs = await page.evaluate(() => {
    try {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const s = w.buildSave("forest1");
      return { ok: true, stage: s.stage, lv: s.lv };
    } catch (e) { return { ok: false, err: String(e).slice(0, 200) }; }
  });
  console.log("buildSave:", JSON.stringify(bs));
  await browser.close();
  srv.kill();
})().catch((e) => { console.error("FAIL:", String(e).slice(0, 300)); process.exit(1); });
