/* v1.0.2-beta — PC그래픽(텍스트 없음) 재촬영 픽스
 *  원인: canvas.toDataURL()이 WebGL(preserveDrawingBuffer:false)에서 검정 반환
 *  수정: ①모든 Phaser 씬의 Text 오브젝트 숨김 ②DOM HUD 전체 숨김(캔버스 체인 제외)
 *        ③page.screenshot()으로 합성 화면 그대로 캡처 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const fs = require("fs");

const PORT = 3131;
const URL = `http://localhost:${PORT}`;
const ROOT = "/home/z/my-project/download/Capture";

async function waitForServer() {
  for (let i = 0; i < 90; i++) {
    try { const r = await fetch(`${URL}/api/version`); if (r.ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("서버 기동 실패");
}

async function enterTitle(page) {
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.getByText(/새로운 모험|게임 시작/).first().waitFor({ timeout: 70000 });
  await page.waitForTimeout(900);
}

async function enterLobby(page) {
  await page.getByText(/새로운 모험|게임 시작/).first().click({ timeout: 30000 });
  await page.getByText("캐릭터 생성").first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(800);
}

async function createCharacter(page) {
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
  await page.getByText(/로 생성!/).first().click({ timeout: 15000 });
  const startBtn = page.getByText("이 캐릭터로 시작").first();
  await startBtn.waitFor({ timeout: 15000 });
  await startBtn.click({ timeout: 15000 });
  for (let i = 0; i < 90; i++) {
    const ok = await page.evaluate(() => { try { return !!(window.__SERTZ__?.game?.scene?.getScene("world")?.player); } catch { return false; } });
    if (ok) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(1200);
}

async function skipIntro(page) {
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    try { if (w && typeof w.finishIntro === "function" && w.introStep !== -1) w.finishIntro("세르츠"); } catch {}
  });
  for (let i = 0; i < 24; i++) {
    await page.evaluate(() => { const w = window.__SERTZ__.game.scene.getScene("world"); if (w) { w.dialoguing = false; w.introStep = -1; } });
    await page.keyboard.press("e").catch(() => {});
    await page.waitForTimeout(260);
  }
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    if (w) { w.dialoguing = false; w.introStep = -1; w.sleepPending = false; w.physics.world.resume(); }
  });
  await page.waitForTimeout(400);
}

async function gmBoost(page) {
  await page.evaluate(() => {
    const eb = window.__SERTZ_EB__;
    eb.emit("rpg:gm", { type: "lv", value: 32 });
    eb.emit("rpg:gm", { type: "heal" });
  });
  await page.waitForTimeout(450);
}

async function restartWith(page, stage, patch = {}) {
  await page.evaluate(([st, p]) => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const carry = w.buildSave(st);
    Object.assign(carry, p);
    w.scene.restart({ stage: st, save: carry });
  }, [stage, patch]);
  await page.waitForTimeout(1900);
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    if (w?.dialoguing) w.resumeFromDialogue();
    if (w) { w.dialoguing = false; w.introStep = -1; w.sleepPending = false; w.physics.world.resume(); }
  });
  for (let i = 0; i < 50; i++) {
    const ok = await page.evaluate(() => { try { return !!(window.__SERTZ__?.game?.scene?.getScene("world")?.player?.lv); } catch { return false; } });
    if (ok) break;
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(400);
}

/* HUD 완전 은닉: ①모든 씬의 Phaser Text·Graphics ②minimap/ui 씬 전체 ③DOM 오버레이 */
async function hideAllUi(page) {
  await page.evaluate(() => {
    const g = window.__SERTZ__.game;
    for (const s of Object.values(g.scene.scenes)) {
      try { s.children.list.forEach((c) => { if (c.type === "Text" || c.type === "Graphics" || c.type === "Rectangle") c.setVisible(false); }); } catch {}
      try { if (["minimap", "ui", "hud"].includes(s.scene.key)) s.scene.setVisible(false); } catch {}
    }
    const canvas = document.querySelector("canvas");
    const path = new Set();
    let cur = canvas;
    while (cur) { path.add(cur); cur = cur.parentElement; }
    document.querySelectorAll("body *").forEach((el) => { if (!path.has(el) && el.tagName !== "STYLE" && el.tagName !== "SCRIPT") el.style.display = "none"; });
  });
}

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production", PORT: String(PORT) }, stdio: "ignore" });
  await waitForServer();
  console.log("서버 기동 완료");
  const browser = await chromium.launch({ executablePath: "/home/z/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell" });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await enterTitle(page);
    await enterLobby(page);
    await createCharacter(page);
    await skipIntro(page);
    await gmBoost(page);
    /* 숲 필드 — UI를 먼저 숨긴 뒤 전투 버스트 → 이펙트 프레임 즉시 캡처(휴식 페이드 방지) */
    await restartWith(page, "forest1");
    await page.evaluate(() => window.__SERTZ_EB__.emit("rpg:gm", { type: "heal" }));
    await hideAllUi(page);
    await page.waitForTimeout(350);
    for (let k = 0; k < 2; k++) {
      await page.evaluate(() => {
        const eb = window.__SERTZ_EB__;
        eb.emit("input:attack");
        setTimeout(() => eb.emit("input:skill1"), 80);
        setTimeout(() => eb.emit("input:skill2"), 170);
      });
      await page.waitForTimeout(260);
    }
    await page.waitForTimeout(120); // 이펙트 프레임 스냅
    fs.mkdirSync(`${ROOT}/08_PC그래픽_1920x1080`, { recursive: true });
    await page.screenshot({ path: `${ROOT}/08_PC그래픽_1920x1080/SERTZ_PC_graphic_1920x1080.png` });
    console.log("✓ 08_PC그래픽 재촬영 완료 (HUD 은닉 스크린샷 방식)");
    await page.close();
  } finally {
    await browser.close();
    srv.kill();
  }
  console.log("PC그래픽 픽스 완료");
})().catch((e) => { console.error("FAIL:", e); process.exit(1); });
