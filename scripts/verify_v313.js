/* v3.0.13 검증 — ① gvar 사각형 제거·타일 결함 수정 확인 ② 마법사 볼트 4방향 정방향 확인
 * 실행 중인 3000 서버에 접속 */
const { chromium } = require("playwright");

const URL = "http://localhost:3000";
const KEY = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };

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

  /* ① 타일 검증 — forest1(잔디+흙길) / muspelheim1(마그마길) / niflheim1(얼음) */
  const tileStats = {};
  for (const st of ["forest1", "muspelheim1", "niflheim1"]) {
    await gotoStage(page, st);
    await page.screenshot({ path: `scripts/shot_v313_${st}.png` });
    tileStats[st] = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      let gvar = 0, missing = 0;
      for (const go of w.children.list ?? []) {
        const k = go.texture ? String(go.texture.key) : "";
        if (k.includes("gvar")) gvar++;
        if (k === "__MISSING") missing++;
      }
      return { gvar, missing };
    });
  }
  console.log("=== 타일 통계 (gvar=0·missing=0 이어야 함) ===");
  console.log(JSON.stringify(tileStats));

  /* ② 마법사 볼트 4방향 — fx2-bolt 스프라이트 회전 vs 진행방향 실측 */
  await gotoStage(page, "forest1");
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.player.gmSetClass("mage");
    w.player.gmSetLevel(30);
    w.player.mp = 999;
    w.player.healFull();
  });
  await page.waitForTimeout(300);
  const results = {};
  for (const dname of ["right", "left", "up", "down"]) {
    await cleanDialogues(page);
    await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      w.dialoguing = false; w.introStep = -1;
      if (w.physics.world) w.physics.world.resume();
    });
    await page.waitForTimeout(150);
    await page.keyboard.down(KEY[dname]);
    await page.waitForTimeout(300);
    await page.keyboard.up(KEY[dname]);
    await page.waitForTimeout(120);
    await page.keyboard.press("Space");
    await page.waitForTimeout(130); // 발사 직후 투사체 비행 중
    results[dname] = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const list = (w.children.list ?? []).filter((g) => {
        const animKey = g.anims && g.anims.currentAnim ? String(g.anims.currentAnim.key) : "";
        const texKey = g.texture ? String(g.texture.key) : "";
        return animKey.includes("bolt") || texKey.includes("bolt");
      });
      const flying = list.filter((g) => Math.abs(g.body?.velocity.x ?? 0) + Math.abs(g.body?.velocity.y ?? 0) > 10);
      if (!flying.length) return { none: true, total: list.length };
      const p = flying[0];
      return {
        anim: p.anims?.currentAnim?.key ?? p.texture.key,
        rotation: +p.rotation.toFixed(3),
        vx: Math.round(p.body?.velocity.x ?? 0),
        vy: Math.round(p.body?.velocity.y ?? 0),
      };
    });
    await page.screenshot({ path: `scripts/shot_v313_bolt_${dname}.png` });
    await page.waitForTimeout(1900);
  }
  console.log("=== 볼트 방향 실측 (기대: 회전 == 진행각, 이동=오른쪽 0) ===");
  for (const [d, r] of Object.entries(results)) {
    if (!r) { console.log(`${d}: 투사체 미검출`); continue; }
    const velAngle = Math.atan2(r.vy, r.vx);
    const rotMod = ((r.rotation + Math.PI) % (2 * Math.PI)) - Math.PI;
    const diff = Math.abs(((velAngle - rotMod + Math.PI * 3) % (2 * Math.PI)) - Math.PI);
    console.log(`${d}: 회전=${r.rotation} 속도각=${velAngle.toFixed(3)} 차이=${diff.toFixed(3)} rad ${diff < 0.2 ? "✅ 정방향" : "❌"}`);
  }
  console.log("pageerror:", errors.length ? errors.slice(0, 3) : "0건");
  await browser.close();
})();
