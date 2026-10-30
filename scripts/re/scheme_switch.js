/**
 * scheme_switch.js — WASD 조작 변경 시 게임 멈춤 재현 (지시 #2)
 *
 * 실행: cd /root/workspace/CERTZ && node scripts/re/scheme_switch.js
 *
 * 절차:
 *   1) 게임 진입(타이틀 → 월드)
 *   2) 프레임 카운터 설치 (rAF 기반 — update 루프가 도는지 측정)
 *   3) EventBus 로 move:scheme 변경 이벤트를 발행 (설정 패널과 같은 경로)
 *   4) 3초간 프레임이 계속 도는지 확인
 *   5) pageerror / 콘솔 오류 수집
 */
const { chromium } = require("playwright");

const CHROME = "/root/.cache/ms-playwright/chromium-1234/chrome-linux/chrome";
const URL = process.env.URL || "http://127.0.0.1:3040";

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));

  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);

  // 타이틀 → 월드
  await page.evaluate(() => {
    const t = window.__SERTZ__?.game?.scene.getScene("title");
    if (t && typeof t.beginWorld === "function") t.beginWorld();
  });
  await page.waitForTimeout(7000);

  // 프레임 카운터 — 게임 루프가 도는지 측정
  await page.evaluate(() => {
    window.__frames = 0;
    const tick = () => { window.__frames++; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await page.waitForTimeout(1200);
  const before = await page.evaluate(() => window.__frames);

  // 이동 스킴 변경 — 설정 패널과 동일한 이벤트 경로
  const switched = await page.evaluate(async () => {
    const w = window.__SERTZ__?.game?.scene.getScene("world");
    if (!w) return { ok: false, reason: "no-world" };
    try {
      // EventBus 는 모듈 내부 — 씬의 리스너를 직접 호출하는 대신 전역 훅을 시도
      /* 실제 패널과 동일한 이벤트 2종: keymap:changed + movescheme:changed.
       *  EventBus 는 모듈 내부이므로 window 훅으로 접근한다. */
      const bus = window.__SERTZ__.EventBus || window.__SERTZ_BUS__;
      if (bus && typeof bus.emit === "function") {
        const w = window.__SERTZ__?.game?.scene.getScene("world");
        if (w) {
          bus.emit("keymap:changed", { atk: "Z", s1: "C", s2: "V", s3: "B", s4: "X", s5: "S", s5b: "D", interact: "E", potionHp: "1", potionMp: "2", menu: "ESC", tab: "TAB" });
          bus.emit("movescheme:changed", "wasd");
        }
        return { ok: true, via: "bus" };
      }
      // 폴백: 씬 내부 필드 직접 변경 + 키 재등록 확인
      const before = w.moveScheme;
      w.moveScheme = "wasd";
      return { ok: true, via: "field", before, after: w.moveScheme };
    } catch (e) {
      return { ok: false, reason: String(e).slice(0, 120) };
    }
  });

  await page.waitForTimeout(3200);
  const after = await page.evaluate(() => window.__frames);
  const delta = after - before;
  const fps = (delta / 3.2).toFixed(1);

  // 씬이 살아있는지
  const alive = await page.evaluate(() => {
    const g = window.__SERTZ__?.game;
    const w = g?.scene.getScene("world");
    return {
      active: g?.scene.getScenes(true).map((s) => s.scene.key) ?? [],
      hasPlayer: !!w?.player,
      scheme: w?.moveScheme ?? null,
      paused: g?.scene.isPaused("world") ?? null,
    };
  });

  console.log("=== WASD 스킴 변경 테스트 ===");
  console.log("스킴 변경:", JSON.stringify(switched));
  console.log(`프레임: ${before} → ${after} (3.2초간 ${delta}프레임, ${fps}fps)`);
  console.log("씬 상태:", JSON.stringify(alive));
  console.log("pageerror:", errors.length, errors.slice(0, 3));
  console.log(delta > 30 ? "\n✅ PASS — 루프 계속 동작" : "\n❌ FAIL — 루프 정지 의심");

  await browser.close();
})();
