/* v3.0.14 검증 — ① 일자 도로 제거 확인 ② 오브젝트 배치(1.5배·중앙 포함) ③ 자동사냥 장애물 회피·끼임 탈출
 * 실행 중인 3000 서버에 접속 */
const { chromium } = require("playwright");

const URL = "http://localhost:3000";

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

async function gotoStage(page, st) {
  await page.evaluate((s) => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.scene.restart({ stage: s, fresh: true });
  }, st);
  await page.waitForTimeout(1600);
  await cleanDialogues(page);
  await page.waitForTimeout(500);
}

(async () => {
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await enterWorld(page);

  /* ① 도로 제거 + ② 오브젝트 배치 통계 */
  const stageStats = {};
  for (const st of ["forest1", "village", "niflheim1"]) {
    await gotoStage(page, st);
    await page.screenshot({ path: `scripts/shot_v314_${st}.png` });
    stageStats[st] = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      let pathTile = 0, obstacles = 0, obstaclesOnMid = 0, missing = 0;
      for (const go of w.children.list ?? []) {
        const k = go.texture ? String(go.texture.key) : "";
        if (k.includes("__MISSING")) missing++;
        // 도로 타일링은 tile_path* 텍스처 TileSprite — 실내(tile_path 바닥)와 구분: 필드 도로는 stageH/2에 위치했음
        if (go.type === "TileSprite" && k.startsWith("tile_path")) pathTile++;
        if (go.getData && go.getData("obstacle")) {
          obstacles++;
          if (Math.abs(go.y - w.stageH / 2) < 104) obstaclesOnMid++;
        }
      }
      const solids = w.solidGroup ? w.solidGroup.children.size : 0;
      return { pathTile, obstacles, obstaclesOnMid, missing, solids };
    });
  }
  console.log("=== ①② 도로/오브젝트 통계 (pathTile=0·missing=0 기대, obstacles>0) ===");
  console.log(JSON.stringify(stageStats, null, 1));

  /* ③ 자동사냥 장애물 회피 — obstacle 1개를 플레이어와 적 사이에 GM 배치 후 autoApproach 실측 */
  await gotoStage(page, "forest1");
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const p = w.player;
    if (!p.pets.includes("pet_slime")) p.pets.push("pet_slime");
    p.pet = "pet_slime";
    p.mp = 999; p.healFull();
    w.autoHunt = true;
  });
  await page.waitForTimeout(400);
  const avoid = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const p = w.player;
    /* 적을 플레이어 오른쪽 300px에 배치, 중간 정확히 장애물(나무)을 배치 */
    const enemy = w.enemies[0];
    if (!enemy) return { none: true };
    enemy.setPosition(p.x + 300, p.y);
    const fake = w.add.image(p.x + 150, p.y, "tree").setDepth(5);
    w.solidGroup.add(fake);
    fake.body.setSize(24, 20);
    fake.body.setOffset(20, 74);
    fake.setData("obstacle", true);
    /* autoApproach 직접 호출 → autoHuntMove 방향 관측 */
    w.autoApproach(enemy);
    const mv = w.autoHuntMove.clone();
    /* 장애물 방향(정면)과 회피 방향 비교: 정면=(1,0). 회피되었으면 |mv.y| > 0.1 */
    w.children.remove(fake);
    return { mvx: +mv.x.toFixed(3), mvy: +mv.y.toFixed(3), avoided: Math.abs(mv.y) > 0.15, blockedProbe: w.blockedByObstacle(p.x + 150, p.y) };
  });
  console.log("=== ③ 장애물 회피 실측 (적=오른쪽 300px, 중간 장애물) ===");
  console.log(JSON.stringify(avoid), avoid.avoided ? "✅ 우회함" : "❌ 정면 돌파");

  /* ③-b 끼임 탈출: 플레이어를 장애물 정면에 붙이고 autoHuntMove 유지 상태에서 tickAutoUnstuck 동작 확인 */
  const unstuck = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const p = w.player;
    /* 장애물을 오른쪽 30px에 배치 (플레이어가 끼인 상태 모사) */
    const fake = w.add.image(p.x + 30, p.y, "tree").setDepth(5);
    w.solidGroup.add(fake);
    fake.setData("obstacle", true);
    /* 이동 명령 유지 + 제자리 시나리오: 실제 위치 변화 없음을 시뮬레이션 */
    w.autoHuntMove.set(1, 0);
    w.autoStuckMs = 400; // 임계값 초과 상태로 설정
    w.autoLastPos.set(p.x, p.y);
    w.autoUnstuckUntil = 0;
    w.tickAutoUnstuck(16);
    const escaped = w.time.now < w.autoUnstuckUntil;
    const dir = w.autoUnstuckDir.clone();
    w.children.remove(fake);
    return { escaped, dirx: +dir.x.toFixed(3), diry: +dir.y.toFixed(3), sideEscape: Math.abs(dir.y) > 0.1 };
  });
  console.log("=== ③-b 끼임 탈출 실측 (장애물 정면 고정 상태) ===");
  console.log(JSON.stringify(unstuck), unstuck.escaped && unstuck.sideEscape ? "✅ 측면 탈출" : "❌");

  /* ④ 실전 자동사냥 관측 — autoHunt ON 후 8초간 위치 이동량 관측 (끼임 시 탈출하는지) */
  await gotoStage(page, "forest1");
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const p = w.player;
    if (!p.pets.includes("pet_slime")) p.pets.push("pet_slime");
    p.pet = "pet_slime";
    p.gmSetLevel(30);
    p.mp = 999; p.healFull();
    w.autoHunt = true;
  });
  await cleanDialogues(page);
  const pos0 = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    return { x: w.player.x, y: w.player.y };
  });
  await page.waitForTimeout(8000);
  const hunt = await page.evaluate(({ px, py }) => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const p = w.player;
    return {
      dist: Math.round(Math.hypot(px - p.x, py - p.y)),
      alive: p.active, hp: Math.round(p.hp), autoHunt: w.autoHunt,
    };
  }, { px: pos0.x, py: pos0.y });
  console.log("=== ④ 자동사냥 8초 관측 (이동=활동 중, hp>0) ===");
  console.log(JSON.stringify(hunt));
  await page.screenshot({ path: "scripts/shot_v314_autohunt.png" });

  console.log("pageerror:", errors.length ? errors.slice(0, 3) : "0건");
  await browser.close();
})();
