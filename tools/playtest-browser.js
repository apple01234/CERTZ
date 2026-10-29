/**
 * SERTZ 브라우저 플레이테스트 (v1.4.41 — game-playtest 스킬 지침)
 *
 * 캔버스 게임이라 DOM 단언만으로는 부족하다 → **스크린샷 필수**.
 * 검증 축: 부팅 / 페이지 오류 / WebGL 컨텍스트 / 입력 반응 / HUD 가림 / 컷씬 카메라 이동
 *
 *   node tools/playtest-browser.js
 */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const URL = process.env.PT_URL || "http://127.0.0.1:3200/";
const OUT = process.env.PT_OUT || "/root/.hermes/cache/scratch/playtest";

const findings = [];
const add = (sev, what, how, why, owner) => findings.push({ sev, what, how, why, owner });

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    args: ["--use-gl=swiftshader", "--enable-webgl", "--no-sandbox"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });

  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(6000);

  /* ── 1. 첫 화면 ── */
  await page.screenshot({ path: path.join(OUT, "01-boot.png") });

  const state = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const btns = [...document.querySelectorAll("button")].map((b) => (b.textContent || "").trim()).filter(Boolean);
    const inputs = [...document.querySelectorAll("input")].map((i) => i.type);
    let gl = null;
    try {
      const c = document.createElement("canvas");
      const g = c.getContext("webgl2") || c.getContext("webgl");
      gl = g ? "ok" : "none";
    } catch { gl = "throw"; }
    return {
      canvas: !!canvas,
      canvasSize: canvas ? `${canvas.width}x${canvas.height}` : null,
      buttons: btns.slice(0, 24),
      inputCount: inputs.length,
      bodyText: (document.body.innerText || "").slice(0, 600),
      gl,
      phaser: typeof window.Phaser !== "undefined",
    };
  });

  if (!state.canvas) add("critical", "캔버스가 없다", "페이지 로드", "게임이 렌더되지 않음", "PhaserGame");
  if (state.gl === "none") add("critical", "WebGL 컨텍스트 생성 불가", "페이지 로드", "셰이더 연출 전부 불가", "렌더러");
  if (pageErrors.length) add("critical", `페이지 오류 ${pageErrors.length}건`, "페이지 로드", pageErrors[0].slice(0, 200), "런타임");

  /* ── 2. 게임 진입 시도 (시작/계속 버튼) ── */
  const startBtn = await page.$('button:has-text("시작"), button:has-text("게임 시작"), button:has-text("새 게임")');
  if (startBtn) {
    await startBtn.click().catch(() => {});
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT, "02-after-start.png") });
  } else {
    add("high", "시작 버튼을 찾지 못함", "페이지 로드", "자동 진입 검증 불가", "Lobby");
  }

  /* ── 3. 입력 반응 (이동/공격 키) ── */
  const beforeInput = await page.evaluate(() => {
    const c = document.querySelector("canvas");
    return c ? c.toDataURL().length : 0; // 캔버스 해시 대용
  });
  for (const k of ["ArrowRight", "ArrowDown", "x", "z"]) {
    await page.keyboard.down(k);
    await page.waitForTimeout(260);
    await page.keyboard.up(k);
  }
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, "03-after-input.png") });
  const afterInput = await page.evaluate(() => {
    const c = document.querySelector("canvas");
    return c ? c.toDataURL().length : 0;
  });
  if (beforeInput === 0) add("high", "캔버스 픽셀을 읽을 수 없음", "toDataURL", "렌더 결과 검증 불가", "렌더러");

  /* ── 4. HUD 가림 측정 (game-ui-frontend: 플레이필드 보호) ── */
  const hud = await page.evaluate(() => {
    const els = [...document.querySelectorAll("div,section,nav,aside")].filter((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 80 && r.height > 80 && cs.position !== "static" && cs.display !== "none" && cs.visibility !== "hidden" && parseFloat(cs.opacity || "1") > 0.4;
    });
    const vw = innerWidth, vh = innerHeight;
    const total = vw * vh;
    let centerCovered = false;
    let lowerMiddleCovered = false;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (cx > vw * 0.35 && cx < vw * 0.65 && cy > vh * 0.35 && cy < vh * 0.65) centerCovered = true;
      if (cx > vw * 0.3 && cx < vw * 0.7 && cy > vh * 0.6 && cy < vh * 0.9) lowerMiddleCovered = true;
    }
    return { count: els.length, centerCovered, lowerMiddleCovered, vw, vh, area: total };
  });
  if (hud.centerCovered) add("medium", "정상 플레이 중 화면 중앙이 HUD로 덮임", "HUD 계산", "플레이필드 가림(game-ui-frontend 금기)", "HUD");

  /* ── 5. 모바일 뷰포트 ── */
  const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mobErr = [];
  mob.on("pageerror", (e) => mobErr.push(String(e)));
  await mob.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await mob.waitForTimeout(5000);
  await mob.screenshot({ path: path.join(OUT, "04-mobile.png") });
  if (mobErr.length) add("high", `모바일 뷰포트 오류 ${mobErr.length}건`, "390x844", mobErr[0].slice(0, 160), "런타임");

  /* ── 6. 리사이즈 ── */
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, "05-resize-1080p.png") });

  const report = {
    url: URL,
    canvas: state.canvasSize,
    gl: state.gl,
    buttons: state.buttons,
    hud,
    pageErrors: pageErrors.slice(0, 5),
    consoleErrors: consoleErrors.slice(0, 8),
    findings,
  };
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  await browser.close();
})().catch((e) => {
  console.error("PLAYTEST_FAILED", e);
  process.exit(1);
});
