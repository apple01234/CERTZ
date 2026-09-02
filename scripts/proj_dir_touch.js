/* 터치(조이스틱) 경로 투사체 방향 실측 + 스크린샷
 *  - hasTouch 컨텍스트로 실제 pointer 이벤트 시뮬레이션
 *  - 좌측 조이스틱 드래그로 방향 전환 → 우하단 공격 버튼 탭 → 투사체 velocity 측정
 *  - 각 케이스마다 스크린샷 저장 (시각 검증용) */
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const PORT = 3124;
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
    await page.mouse.click(400, 300); await page.waitForTimeout(400);
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
  const srv = spawn("node", ["server.js"], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production", PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 500)); try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) break; } catch {} }
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"] });
  const context = await browser.newContext({ viewport: { width: 900, height: 720 }, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await enterWorld(page);

  const VW = 900, VH = 720;
  const JOY = { x: VW * 0.23, y: VH * 0.78 };   // 조이스틱 영역 좌측 하단
  const ATK = { x: VW - 45, y: VH - 45 };       // 공격 버튼 (bottom-3 right-2, 64px)

  // 전직: 마법사(원거리 확인 쉬움) + 궁수
  const cases = [
    { cls: "mage", label: "마법사" },
    { cls: "ranger", label: "궁수" },
  ];

  let pass = 0, fail = 0;
  for (const c of cases) {
    await page.evaluate((cls) => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      w.player.gmSetClass(cls);
      w.player.gmSetLevel(30);
      w.player.mp = 999;
      w.player.healFull();
    }, c.cls);
    await page.waitForTimeout(300);

    // [A] 조이스틱 위로 드래그 → 손 뗌 → 공격 탭
    for (const [dname, dxy, shot] of [
      ["up", [0, -110], [0, -1]],
      ["down", [0, 110], [0, 1]],
      ["left", [-110, 0], [-1, 0]],
      ["right", [110, 0], [1, 0]],
    ]) {
      await page.touchscreen.tap(JOY.x, JOY.y); // 자리 잡기용 탭 (이동 없음)
      await page.waitForTimeout(200);
      // 드래그: down → move(여러 스텝) → up
      await page.evaluate(({ x, y, dx, dy }) => {
        const t = (type, X, Y) => {
          const el = document.elementFromPoint(X, Y);
          for (const ev of ["pointerdown", "pointermove", "pointerup"]) { /* noop */ }
          el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, pointerType: "touch", isPrimary: true, clientX: X, clientY: Y }));
        };
        window.__drag = { x, y, dx, dy, step: 0 };
        t("pointerdown", x, y);
      }, { x: JOY.x, y: JOY.y, dx: dxy[0], dy: dxy[1] });
      for (let s = 1; s <= 5; s++) {
        await page.evaluate(({ x, y, dx, dy, s }) => {
          const el = document.elementFromPoint(x, y);
          el.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, cancelable: true, pointerId: 7, pointerType: "touch", isPrimary: true, clientX: x + (dx * s) / 5, clientY: y + (dy * s) / 5 }));
        }, { x: JOY.x, y: JOY.y, dx: dxy[0], dy: dxy[1], s });
        await page.waitForTimeout(40);
      }
      await page.evaluate(({ x, y, dx, dy }) => {
        const el = document.elementFromPoint(x, y);
        el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 7, pointerType: "touch", isPrimary: true, clientX: x + dx, clientY: y + dy }));
      }, { x: JOY.x, y: JOY.y, dx: dxy[0], dy: dxy[1] });
      await page.waitForTimeout(160);
      const facing = await page.evaluate(() => {
        const w = window.__SERTZ__.game.scene.getScene("world");
        return { x: Math.round(w.player.facing.x * 100) / 100, y: Math.round(w.player.facing.y * 100) / 100 };
      });
      // 공격 버튼 탭
      await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 8, pointerType: "touch", isPrimary: true, clientX: x, clientY: y }));
      }, ATK);
      await page.waitForTimeout(150);
      const projs = await page.evaluate(() => {
        const w = window.__SERTZ__.game.scene.getScene("world");
        const out = [];
        for (const p of w.pProjPool || []) {
          if (!p.active) continue;
          out.push({ tex: p.texture.key, vx: Math.round(p.body.velocity.x), vy: Math.round(p.body.velocity.y) });
        }
        return out;
      });
      const [ex, ey] = shot;
      const judg = projs.map((p) => {
        const len = Math.hypot(p.vx, p.vy);
        if (len < 40) return { ...p, verdict: "NO-MOVE" };
        const dot = (p.vx / len) * ex + (p.vy / len) * ey;
        const deg = Math.round((Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI);
        return { ...p, devDeg: deg, verdict: deg <= 25 ? "OK" : "WRONG" };
      });
      const bad = judg.filter((j) => j.verdict !== "OK");
      if (bad.length === 0 && judg.length > 0) pass++; else fail++;
      console.log(`[${bad.length === 0 && judg.length > 0 ? "PASS" : "FAIL"}] 터치 ${c.label} → ${dname} | facing=${facing.x},${facing.y} | ` +
        (judg.length ? judg.map((j) => `${j.tex}(v=${j.vx},${j.vy} ${j.verdict}${j.devDeg !== undefined ? "+" + j.devDeg + "°" : ""})`).join(" ") : "투사체 없음!"));
      await page.waitForTimeout(2000); // 잔류 투사체 완전 소멸 대기
    }
  }

  // [B] 신규 진입 후 이동 없이 바로 공격 탭 (스폰 직후 facing 기본값 확인)
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.player.facing.set(1, 0);
    w.player.state = "idle";
  });
  await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 9, pointerType: "touch", isPrimary: true, clientX: x, clientY: y }));
  }, ATK);
  await page.waitForTimeout(150);
  const noMove = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const out = [];
    for (const p of w.pProjPool || []) {
      if (!p.active) continue;
      out.push({ tex: p.texture.key, vx: Math.round(p.body.velocity.x), vy: Math.round(p.body.velocity.y), facing: { x: Math.round(w.player.facing.x * 100) / 100, y: Math.round(w.player.facing.y * 100) / 100 } });
    }
    return out;
  });
  console.log(`[정보] 이동 없이 공격 탭 → facing=${JSON.stringify(noMove[0]?.facing)} | projs=${JSON.stringify(noMove.map((p) => `${p.tex}(v=${p.vx},${p.vy})`))}`);

  console.log(`\n=== 터치 결과: PASS ${pass} / FAIL ${fail} ===`);
  if (errors.length) console.log("pageerror:", errors.slice(0, 5));
  await browser.close();
  srv.kill();
})();
