/* 투사체 방향 버그 재현 — 전 직업 × 4방향 실측
 *  각 방향을 바라본 뒤 공격 → 풀링된 플레이어 투사체의 body.velocity 각도를 측정해
 *  플레이어 facing과 비교한다. (dev 서버 3000 재사용, 새 컨텍스트라 세이브 무간섭) */
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const PORT = 3123;
const URL = `http://localhost:${PORT}`;

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

const KEY = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };
const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production", PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 500)); try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) break; } catch {} }
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await enterWorld(page);

  const cases = [
    { cls: "ranger", label: "궁수1차(활)", presses: 1, sampleAt: 150 },
    { cls: "mage", label: "마법사1차(볼트)", presses: 1, sampleAt: 150 },
    { cls: "thief", label: "도적1차(표창,3타마다)", presses: 3, sampleAt: 150 },
    { cls: "warlord", label: "전사3차(검기파동,3타째)", presses: 3, sampleAt: 430 },
  ];

  let pass = 0, fail = 0;
  for (const c of cases) {
    await page.evaluate((cls) => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      w.player.gmSetClass(cls);
      w.player.gmSetLevel(50);
      w.player.mp = 999;
      w.player.healFull();
    }, c.cls);
    await page.waitForTimeout(200);
    for (const dname of ["up", "down", "left", "right"]) {
      // 1) 해당 방향으로 이동해 facing 세팅
      await page.keyboard.down(KEY[dname]);
      await page.waitForTimeout(320);
      await page.keyboard.up(KEY[dname]);
      await page.waitForTimeout(140);
      const facing = await page.evaluate(() => {
        const w = window.__SERTZ__.game.scene.getScene("world");
        return { x: Math.round(w.player.facing.x * 100) / 100, y: Math.round(w.player.facing.y * 100) / 100 };
      });
      // 2) 공격 (도적/전사 3차는 표창·파동이 나가는 타까지 반복)
      for (let i = 0; i < c.presses; i++) {
        await page.keyboard.press("Space");
        await page.waitForTimeout(c.presses > 1 ? 430 : 0);
      }
      await page.waitForTimeout(c.sampleAt);
      // 3) 활성 투사체 샘플
      const projs = await page.evaluate(() => {
        const w = window.__SERTZ__.game.scene.getScene("world");
        const pool = w.pProjPool || [];
        const out = [];
        for (const p of pool) {
          if (!p.active) continue;
          out.push({
            tex: p.texture.key,
            vx: Math.round(p.body.velocity.x),
            vy: Math.round(p.body.velocity.y),
            rotDeg: Math.round((p.rotation * 180) / Math.PI),
          });
        }
        return out;
      });
      // 4) 판정: 속도 벡터 주방향이 기대 방향과 일치하는가
      const [ex, ey] = DIRV[dname];
      const judg = projs.map((p) => {
        const len = Math.hypot(p.vx, p.vy);
        if (len < 40) return { ...p, verdict: "NO-MOVE" };
        const ux = p.vx / len, uy = p.vy / len;
        const dot = ux * ex + uy * ey;
        const deg = Math.round((Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI);
        return { ...p, devDeg: deg, verdict: deg <= 25 ? "OK" : "WRONG" };
      });
      const bad = judg.filter((j) => j.verdict !== "OK");
      if (bad.length === 0 && judg.length > 0) pass++; else fail++;
      console.log(
        `[${bad.length === 0 && judg.length > 0 ? "PASS" : "FAIL"}] ${c.label} → ${dname} | facing=${facing.x},${facing.y} | ` +
        (judg.length ? judg.map((j) => `${j.tex}(v=${j.vx},${j.vy} rot=${j.rotDeg}° ${j.verdict}${j.devDeg !== undefined ? "+" + j.devDeg + "°" : ""})`).join(" ") : "투사체 없음!")
      );
      await page.waitForTimeout(700); // 투사체 소멸 대기
    }
  }

  console.log(`\n=== 결과: PASS ${pass} / FAIL ${fail} ===`);
  if (errors.length) console.log("pageerror:", errors.slice(0, 5));
  await browser.close();
  srv.kill();
  process.exit(fail > 0 ? 1 : 0);
})();
