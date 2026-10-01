/** v3.3.0 추가 검증 — 세부직업별 고유 궁극기 + 맵 왕복(검은화면) 테스트 */
const { chromium } = require("playwright");

(async () => {
  const errors = [];
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader"] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  page.on("pageerror", (e) => errors.push(`PAGEERROR: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`CONSOLE: ${m.text().slice(0, 160)}`); });

  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(5000);
  await page.locator("button", { hasText: /새로운 모험/ }).first().click();
  await page.waitForTimeout(4500);

  // 4차 세부직업 8종 × 고유 궁극기 이름 검증
  const classes = ["warbringer", "crusader", "deadeye", "skylord", "arclord", "eternal", "shadowlord", "blademaster"];
  const results = {};
  for (const cls of classes) {
    const r = await page.evaluate((k) => {
      const s = window.__SERTZ_SCENE__;
      const EB = window.__SERTZ_EB__;
      EB.emit("rpg:gm", { type: "job", value: k });
      EB.emit("rpg:gm", { type: "fifth", value: 1 });
      const p = s.player;
      p.mp = 100;
      p.skill5Cd = 0;
      p.useSkill5();
      return { name: p.skill5Name, cd: p.skill5Cd, tier: p.tier };
    }, cls);
    results[cls] = r;
    await page.waitForTimeout(250);
  }
  console.log("=== 8종 고유 궁극기 실측 ===");
  for (const [k, v] of Object.entries(results)) console.log(`  ${k}: ${v.name} (tier=${v.tier}, cd=${v.cd})`);

  // 맵 왕복 스트레스 — 마을 ↔ 포레스트1 왕복 4회 (검은화면/physics 누출 체크)
  console.log("=== 맵 왕복 4회 (검은화면 체크) ===");
  for (let i = 0; i < 4; i++) {
    const st = await page.evaluate((round) => {
      const s = window.__SERTZ_SCENE__;
      const to = round % 2 === 0 ? "forest1" : "village";
      s.transitioning = false; // 강제로 게이트 열어 이동 (포탈 안 거치고 직접)
      s.gotoStage(to);
      return { from: s.stageDef.key, to };
    }, i);
    await page.waitForTimeout(2600);
    const after = await page.evaluate(() => {
      const s = window.__SERTZ_SCENE__;
      const cam = s.cameras.main;
      return {
        stage: s.stageDef?.key,
        camAlpha: cam.alpha,
        physicsPaused: s.physics.world.isPaused,
        playerAlive: s.player?.state !== "dead",
        enemies: s.enemies?.length ?? 0,
      };
    });
    console.log(`  #${i + 1} ${JSON.stringify(st)} → ${JSON.stringify(after)}`);
  }

  const harmful = errors.filter(
    (e) => !/favicon|Download the React DevTools|Autoplay|AudioContext|WebGL|swiftshader/i.test(e)
  );
  console.log("\nharmful errors:", harmful.length);
  harmful.slice(0, 8).forEach((e) => console.log("  -", e));
  await page.screenshot({ path: "/home/z/my-project/scripts/shot_v330_b.png" });
  await browser.close();
  process.exit(harmful.length > 0 ? 1 : 0);
})().catch((e) => { console.error("FAIL:", e.message); process.exit(2); });
