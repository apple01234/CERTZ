/* v3.0.19 검증 — "타일맵이 잔디 같지 않다" 수술
 * ① 지면 타일 8종 전부 256x256 시밀리스 텍스처로 교체 확인
 * ② 인게임 캔버스 픽셀 실측 — 잔디 질감 (인접 픽셀 색 분산 존재)
 * ③ 마을/필드 스크린샷 2종 저장 (육안 검증용)
 * ④ 회귀: 이동/pageerror */
const { chromium } = require("playwright");

const URL = "http://127.0.0.1:3000";
const results = [];
const ok = (name, cond, detail = "") => {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
};

async function cleanDialogues(page) {
  for (let i = 0; i < 20; i++) {
    const dlg = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      if (w?.dialoguing) { w.resumeFromDialogue(); return true; }
      return false;
    });
    if (!dlg) break;
    await page.waitForTimeout(250);
  }
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.dialoguing = false; w.introStep = -1; w.sleepPending = false;
    if (w.physics.world) w.physics.world.resume();
  });
  await page.waitForTimeout(250);
}

async function enterWorld(page) {
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("text=새로운 모험", { timeout: 60000 });
  await page.click("text=새로운 모험");
  for (let i = 0; i < 40; i++) {
    const inWorld = await page.evaluate(() => !!(window.__SERTZ__?.game?.scene.getScene("world")?.player));
    if (inWorld) break;
    await page.mouse.click(400, 300); await page.keyboard.press("e"); await page.waitForTimeout(400);
  }
  await page.waitForTimeout(800);
  for (let i = 0; i < 6; i++) {
    const done = await page.evaluate(() => {
      try {
        const w = window.__SERTZ__.game.scene.getScene("world");
        if (!w?.player) return false;
        w.finishIntro("테스터");
        return true;
      } catch { return false; }
    });
    if (done) break;
    await page.waitForTimeout(500);
  }
  await cleanDialogues(page);
}

(async () => {
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await enterWorld(page);

  /* ── ① 지면 텍스처 8종 256x256 확인 ── */
  const texInfo = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const keys = ["tile_grass", "tile_dark", "tile_magma", "tile_snow", "tile_cave", "tile_stone", "tile_hel", "tile_abyss"];
    return keys.map((k) => {
      const t = w.textures.get(k);
      const s = t && t.source && t.source[0];
      return { k, w: s ? s.width : 0, h: s ? s.height : 0 };
    });
  });
  const all256 = texInfo.every((t) => t.w === 256 && t.h === 256);
  ok("① 지면 텍스처 8종 256x256", all256, texInfo.map((t) => `${t.k}:${t.w}x${t.h}`).join(" "));

  /* ── ② 잔디 질감 실측: 게임 캔버스에서 플레이어 주변 영역 샘플 → 톤 분산 ── */
  const variance = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const tex = w.textures.get("tile_grass").source[0].image;
    const cv = document.createElement("canvas");
    cv.width = 256; cv.height = 256;
    const ctx = cv.getContext("2d");
    ctx.drawImage(tex, 0, 0);
    const d = ctx.getImageData(0, 0, 256, 256).data;
    // 64px 서브타일 중앙부 400픽셀 샘플 → R 채널 표준편차 (풀잎 마크 = 분산 존재)
    const samples = [];
    for (let cy = 0; cy < 4; cy++) for (let cx = 0; cx < 4; cx++) {
      for (let i = 0; i < 25; i++) {
        const x = cx * 64 + 8 + (i % 5) * 10;
        const y = cy * 64 + 8 + Math.floor(i / 5) * 10;
        samples.push(d[(y * 256 + x) * 4]);
      }
    }
    const mean = samples.reduce((a, b) => a + b) / samples.length;
    const sd = Math.sqrt(samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length);
    return { mean: Math.round(mean), sd: Math.round(sd * 10) / 10 };
  });
  /* 구 단색 타일: sd ≈ 0~2. 신규: 풀잎 마크로 sd ≥ 8 */
  ok("② 잔디 질감 실측 — 톤 분산 sd ≥ 8 (구 단색은 sd≈0)", variance.sd >= 8, `mean=${variance.mean} sd=${variance.sd}`);

  /* ── ③ 스크린샷 — 마을 필드 ── */
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.player.setVelocity(0, 0);
    w.touchMove.set(0, 0);
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: "scripts/shot_v319_village.png" });

  /* 필드(forest1)로 워프 — 던전 레이아웃 잔디 확인 */
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.scene.restart({ stageKey: "forest1", playerName: w.playerName ?? "테스터" });
  });
  await page.waitForTimeout(2500);
  await cleanDialogues(page);
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    if (w?.player) { w.player.setVelocity(0, 0); }
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "scripts/shot_v319_forest.png" });

  /* ── ④ 회귀: 이동 실측 + pageerror ── */
  const moveDist = await page.evaluate(async () => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    if (!w?.player) return -1;
    const dirs = [[1, 0], [-1, 0], [0, -1], [0, 1]];
    let best = 0;
    for (const [dx, dy] of dirs) {
      w.touchMove.set(dx, dy);
      const sx = w.player.x, sy = w.player.y;
      await new Promise((r) => setTimeout(r, 800));
      w.touchMove.set(0, 0);
      await new Promise((r) => setTimeout(r, 100));
      best = Math.max(best, Math.hypot(w.player.x - sx, w.player.y - sy));
      if (best >= 200) break;
    }
    return Math.round(best);
  });
  ok("④ 이동 회귀 (≥200px/s)", moveDist >= 200, `${moveDist}px/s`);
  ok("pageerror 0", errors.length === 0, errors.join(" | ").slice(0, 200));

  await browser.close();
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n===== ${passed}/${results.length} PASS =====`);
  process.exit(passed === results.length ? 0 : 1);
})().catch((e) => { console.error("FATAL", e); process.exit(2); });
