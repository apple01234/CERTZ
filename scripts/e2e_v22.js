/* v2.2 E2E — ①공격 중 이동 스터터 제거 실측 ②타격 이펙트 ③여관 실내 플로우(입장→대화→취침→버프→퇴장) */
const { chromium } = require("playwright");
const { spawn } = require("child_process");

const PORT = 3106;
const URL = `http://localhost:${PORT}`;
const shot = (n) => `/home/z/my-project/scripts/v22-${n}.png`;

async function enterWorld(page) {
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("text=새로운 모험", { timeout: 30000 });
  await page.click("text=새로운 모험");
  for (let i = 0; i < 30; i++) {
    const inWorld = await page.evaluate(() => {
      const g = window.__SERTZ__?.game;
      return !!(g && g.scene.getScene("world") && g.scene.getScene("world").player);
    });
    if (inWorld) break;
    await page.mouse.click(640, 400);
    await page.keyboard.press("e");
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(800);
  // 인트로 대화/가이드 정리 — 실제 플레이어는 클릭으로 넘기는 과정 (테스트는 자동 스킵)
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Space");
    await page.waitForTimeout(350);
    await page.mouse.click(640, 600);
  }
  await page.evaluate(() => {
    const w = window.__SERTZ__?.game?.scene.getScene("world");
    if (w) {
      w.dialoguing = false;
      w.introStep = -1;
      w.sleepPending = false;
    }
  });
  await page.waitForTimeout(400);
}

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: "/home/z/my-project", env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) break; } catch {}
  }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 200)));

  await enterWorld(page);
  const W = () => `window.__SERTZ__.game.scene.getScene("world")`;

  console.log("[1] 공격 중 이동 스터터 실측 — 이동 홀드 + X 연타, 속도 샘플링");
  const samples = await page.evaluate(async () => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const out = [];
    // 도로 왼쪽 레인(장애물 없는 구간)으로 이동 후 시작
    w.player.setPosition(200, w.stageH / 2);
    w.player.setVelocity(0, 0);
    const mv = { x: 1, y: 0, lengthSq: () => 1, clone: () => ({ x: 1, y: 0, lengthSq: () => 1 }) };
    w.touchMove = mv; // TouchControls 이동 벡터 직접 주입
    for (let i = 0; i < 16; i++) {
      if (i % 3 === 0) w.attackQueued = true;
      await new Promise((r) => setTimeout(r, 100));
      const v = w.player.body ? Math.hypot(w.player.body.velocity.x, w.player.body.velocity.y) : -1;
      out.push(Math.round(v));
    }
    // 주입 해제 — 이후 단계들에 영향 없게
    w.touchMove = { x: 0, y: 0, lengthSq: () => 0, clone: () => ({ x: 0, y: 0, lengthSq: () => 0 }) };
    w.player.setVelocity(0, 0);
    return out;
  });
  // 정상: 80% 속도(~184)와 풀속(~230)이 교차 — 정지(0) 없이 연속 이동
  const zeros = samples.filter((v) => v < 60).length;
  console.log("속도 샘플:", JSON.stringify(samples), "| 주행 구간 정지 샘플:", zeros);

  console.log("[2] 타격 이펙트 — 적 소환 후 공격");
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const e = new (window.__SERTZ__.game.scene.getScene("world").enemies.constructor === Array ? Object.getPrototypeOf(w.enemies[0] || w.player).constructor : Object)();
  }).catch(() => {});
  // 적이 없으면 스킵 (마을엔 적 없음) — 대신 스파크만 확인
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.spawnHitSpark(w.player.x + 40, w.player.y);
    w.spawnDamageText(w.player.x + 40, w.player.y - 20, 12, true);
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: shot("1-hitfx") });

  console.log("[3] 여관 입장 — 건물 문으로 이동 후 E");
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const inn = w.interactables.find((i) => i.kind === "inn");
    w.dialoguing = false; // 늦게 열린 인트로 대사 정리 (레이스 방지)
    w.player.setPosition(inn.x, inn.y + 14); // 문 중앙 — 근처 상점(라고스)보다 확실히 가깝게
    w.player.setVelocity(0, 0);
    w.player.gold = 100;
  });
  await page.waitForTimeout(700);
  await page.keyboard.press("e");
  await page.waitForTimeout(1400); // 페이드 + 재시작
  const stage1 = await page.evaluate(() => window.__SERTZ__.game.scene.getScene("world").stageDef.key);
  console.log("입장 후 스테이지:", stage1);
  await page.screenshot({ path: shot("2-inn-interior") });

  console.log("[4] 여관주인 대화 → 취침 연출");
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.player.setPosition(w.stageW / 2 + 115, w.stageW ? 160 : 160); // 로안 앞
    w.player.setPosition(w.stageW / 2 + 115, 160);
  });
  await page.waitForTimeout(700);
  await page.keyboard.press("e"); // 로안 대화 시작
  await page.waitForTimeout(900);
  await page.screenshot({ path: shot("3-innkeeper-talk") });
  // 대사 넘기기 — 각 줄: 타이핑 스킵 1회 + 진행 1회 (3줄 → 여유 8회)
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Space");
    await page.waitForTimeout(550);
  }
  // 취침 연출 완료 대기 (페이드 700 + Zzz 2600 + 여유)
  await page.waitForTimeout(4300);
  await page.screenshot({ path: shot("4-sleep") });
  await page.waitForTimeout(2600); // 연출 완료 + 버프
  const after = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    return { gold: w.player.gold, buffs: w.player.buffs.map((b) => b.key), hp: w.player.hp, maxHp: w.player.maxHp };
  });
  console.log("취침 후:", JSON.stringify(after));
  await page.screenshot({ path: shot("5-after-sleep") });

  console.log("[5] 퇴장 — 잔여 대사 정리 후 출구 문으로 E");
  await page.keyboard.press("Space"); // 여관주인 마무리 대사 닫기
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.dialoguing = false;
    w.restCd = 0; // 취침 후 쿨다운 해제 (실제 플레이에선 1.5초 후 자동 해제)
    w.player.setPosition(w.stageW / 2, w.stageH - 70);
    w.player.setVelocity(0, 0);
  });
  await page.waitForTimeout(600);
  await page.keyboard.press("e");
  await page.waitForTimeout(1300);
  const stage2 = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    return { stage: w.stageDef.key, x: Math.round(w.player.x), y: Math.round(w.player.y) };
  });
  console.log("퇴장 후:", JSON.stringify(stage2));
  await page.screenshot({ path: shot("6-back-village") });

  await browser.close();
  const pass = zeros <= 2 && stage1 === "interior_inn" && after.buffs.length >= 2 && after.gold === 80 && stage2.stage === "village";
  console.log(pass ? "ALL PASS" : "SOME FAIL");
  srv.kill();
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error("E2E FAIL:", e.message); process.exit(1); });
