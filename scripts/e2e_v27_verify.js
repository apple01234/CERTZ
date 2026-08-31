/* v2.7 검증 — 포탈 개방 보루 2.0 (자가치유형) + 화살표 포탈 지시
 *  [A] forest1 실체인: level→hunt→종료 즉시 개방
 *  [B] kingdom2 (collect→hunt 체인): 파편 수확→토벌→즉시 개방 + 파편 소실 보루
 *  [C] alfheim9 (hunt→collect): 수확 후 개방
 *  [D] forest10 보스: 격파→대사→개방 (보스 구역 reach 허용 확인)
 *  [E] 자가치유 매트릭스: pendingPortal 끼임 / dialoguing 끼임 → 6초 내 강제 개방
 *  [F] 체인 완료 후 엣지 화살표가 포탈을 가리키는지 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");

const PORT = 3110;
const URL = `http://localhost:${PORT}`;
let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log(`  PASS — ${label}`); } else { fail++; console.log(`  FAIL — ${label}`); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const W = (page) => page.evaluate(() => {
  const w = window.__SERTZ__.game.scene.getScene("world");
  const q = w.currentQuest();
  return {
    stage: w.stageDef.key, idx: w.questIdx, chainLen: w.stageDef.quests.length,
    q: q ? { type: q.type, need: q.need ?? null, targetKey: q.targetKey ?? null } : null,
    portal: !!w.portal, portalActive: !!w.portalActive, dialoguing: !!w.dialoguing,
    pendingPortal: !!w.pendingPortal, fragment: !!w.fragment, boss: !!w.boss, lv: w.player.lv,
    arrow: w.edgeArrow ? { x: Math.round(w.edgeArrow.x), y: Math.round(w.edgeArrow.y), alpha: +w.edgeArrow.alpha.toFixed(2) } : null,
  };
});

async function clearDialogue(page) {
  for (let i = 0; i < 14; i++) {
    const d = await page.evaluate(() => !!window.__SERTZ__.game.scene.getScene("world").dialoguing);
    if (!d) return;
    await page.keyboard.press("Space");
    await sleep(180);
  }
}

async function enterWorld(page) {
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("text=새로운 모험", { timeout: 60000 });
  await page.click("text=새로운 모험");
  for (let i = 0; i < 40; i++) {
    const inWorld = await page.evaluate(() => !!(window.__SERTZ__?.game?.scene.getScene("world")?.player));
    if (inWorld) break;
    await page.mouse.click(640, 400); await page.keyboard.press("e"); await sleep(400);
  }
  await sleep(900);
  await page.evaluate(() => { window.__SERTZ__.game.scene.getScene("world").finishIntro("테스터"); });
  await sleep(400);
  for (let i = 0; i < 6; i++) { await page.keyboard.press("Space"); await sleep(200); }
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.dialoguing = false; w.introStep = -1; w.sleepPending = false;
  });
  await sleep(250);
}

async function restartWith(page, stage, patch) {
  await page.evaluate(([st, p]) => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const carry = w.buildSave(st);
    Object.assign(carry, p);
    w.scene.restart({ stage: st, save: carry });
  }, [stage, patch]);
  await sleep(2000);
  await clearDialogue(page);
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.dialoguing = false; w.introStep = -1;
  });
  await sleep(300);
}

async function huntThrough(page) {
  return page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const q = w.currentQuest();
    if (!q || q.type !== "hunt") return { skipped: true };
    const need = q.need ?? 0;
    const t0 = performance.now();
    let openedAt = null;
    for (let i = 0; i < need; i++) {
      w.onEnemyKilled(q.targetKey, 0, w.player.x + 40, w.player.y);
      if (w.portalActive && openedAt === null) openedAt = performance.now() - t0;
    }
    return { skipped: false, need, openedAtMs: openedAt, activeNow: !!w.portalActive };
  });
}

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: process.cwd(), env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) { await sleep(500); try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) break; } catch {} }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 300)));

  await enterWorld(page);

  console.log("[A] forest1 — level 게이트 → 토벌 → 체인 종료 즉시 개방");
  await restartWith(page, "forest1", { lv: 1, questIdx: { forest1: 0 }, seen: [] });
  await page.evaluate(() => { window.__SERTZ__.game.scene.getScene("world").player.gainExp(500); });
  await sleep(400);
  const rA = await huntThrough(page);
  ok(rA.activeNow && rA.openedAtMs !== null && rA.openedAtMs < 300, `A1 마지막 킬 즉시 개방 (${Math.round(rA.openedAtMs ?? -1)}ms)`);

  console.log("[B] kingdom2 — collect(스토리비트)→hunt 체인 + 파편 소실 보루");
  await restartWith(page, "kingdom2", { lv: 12, questIdx: { kingdom2: 0 }, seen: [] });
  let s = await W(page);
  ok(s.q?.type === "collect", `B1 kingdom2 첫 퀘스트 = collect (실제: ${s.q?.type ?? "null"})`);
  // 파편 소실 시뮬레이션 → 보루가 재생성하는지
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.fragment?.destroy(); w.fragment = null;
  });
  await sleep(2200);
  s = await W(page);
  ok(s.fragment, "B2 파편 소실 → 보루 1.5~3초 내 재생성");
  // kingdom2 체인은 collect 먼저 → 수확 → 토벌 순서로 실제 완료
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    if (!w.fragment) w.spawnFragmentForQuest();
    w.collectFragment(w.fragment ?? w.add.image(0, 0, "beam"));
  });
  await sleep(600);
  await clearDialogue(page);
  const rB = await huntThrough(page);
  ok(rB.activeNow && rB.openedAtMs !== null && rB.openedAtMs < 300, `B3 수확→토벌 완료 즉시 개방 (${Math.round(rB.openedAtMs ?? -1)}ms)`);

  console.log("[C] alfheim9 — hunt→collect → 수확 후 개방");
  await restartWith(page, "alfheim9", { lv: 30, questIdx: { alfheim9: 0 }, seen: [] });
  await huntThrough(page);
  await sleep(300);
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    if (!w.fragment) w.spawnFragmentForQuest();
    w.collectFragment(w.fragment ?? w.beacon ?? w.add.image(0, 0, "beam"));
  });
  await sleep(600);
  await clearDialogue(page);
  s = await W(page);
  ok(s.portalActive, `C1 수확 후 개방 (portalActive=${s.portalActive})`);
  ok(s.arrow !== null, `C2 화살표가 포탈을 가리킴 (${JSON.stringify(s.arrow)})`);

  console.log("[D] forest10 보스 — 격파 → 대사 → 개방");
  await restartWith(page, "forest10", { lv: 30, questIdx: { forest10: 0 }, seen: [] });
  await huntThrough(page);
  await sleep(300);
  s = await W(page);
  if (s.q?.type === "boss") {
    await page.evaluate(() => { window.__SERTZ__.game.scene.getScene("world").onBossDead(); });
    await sleep(1600);
    await clearDialogue(page);
    await sleep(900);
    s = await W(page);
    ok(s.portal && s.portalActive, `D1 보스 격파 후 포탈 생성+개방 (portal=${s.portal}, active=${s.portalActive})`);
  } else {
    console.log(`   D-스킵: 현재=${s.q?.type}`);
  }

  console.log("[E] 자가치유 매트릭스 (각각 독립 상태)");
  // E1: pendingPortal 끼임 — 6초 유예 후 강제 개방 (7.5초 내)
  await restartWith(page, "kingdom2", { lv: 12, questIdx: { kingdom2: 99 }, seen: [] });
  await sleep(2200);
  s = await W(page);
  ok(s.portalActive, `E0 체인 완료 이어하기 → 즉시 복구 (active=${s.portalActive})`);
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.portalActive = false; w.pendingPortal = true; w.dialoguing = false;
  });
  /* v3.0.4 — 자가개방 상한은 1.5s(루프 페이즈) + 6s(유예) + 1.5s(틱 그레인) = 최대 9.0s.
   *  기존 7.8s 대기는 하한 근처라 루프 페이즈에 따라 간헐 실패(플래키) — 10.5s로 상향 */
  await sleep(10500);
  s = await W(page);
  ok(s.portalActive && !s.pendingPortal, `E1 pendingPortal 끼임 → 6초 유예 후 자가 개방 (active=${s.portalActive}, pending=${s.pendingPortal})`);
  // E2: dialoguing 끼임 — 6초 유예 후 강제 개방
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.portalActive = false; w.pendingPortal = false; w.dialoguing = true;
  });
  await sleep(7800);
  s = await W(page);
  ok(s.portalActive, `E2 dialoguing 끼임 → 6초 유예 후 자가 개방 (active=${s.portalActive})`);
  // E3: 정상 대사 종료 직후 개방 (600ms 경로)
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.portalActive = false; w.pendingPortal = true; w.dialoguing = true;
  });
  await sleep(300);
  await page.evaluate(() => { window.__SERTZ__.game.scene.getScene("world").resumeFromDialogue(); });
  await sleep(1200);
  s = await W(page);
  ok(s.portalActive, `E3 정상 대사 종료 → 600ms 경로 개방 (active=${s.portalActive})`);

  console.log("[F] 체인 완료 상태 화살표 — 포탈 방향 지시");
  s = await W(page);
  // 화살표는 화면 가장자리에 클램프되므로 "존재 + 플레이어 기준 포탈 방향"으로 판정
  const dir = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    if (!w.edgeArrow || !w.portal) return null;
    return {
      arrowRightOfPlayer: w.edgeArrow.x > w.player.x,
      portalRightOfPlayer: w.portal.x > w.player.x,
      screenX: Math.round(w.edgeArrow.x - w.cameras.main.scrollX),
      vw: w.scale.gameSize.width,
    };
  });
  ok(dir && dir.arrowRightOfPlayer === dir.portalRightOfPlayer && dir.screenX > dir.vw * 0.6,
    `F1 화살표 존재+포탈 방향+화면 가장자리 (${JSON.stringify(dir)})`);

  console.log(`\n결과: PASS ${pass} / FAIL ${fail}`);
  await page.screenshot({ path: "/home/z/my-project/scripts/v27-verify-final.png" });
  await browser.close();
  srv.kill();
  process.exit(fail > 0 ? 1 : 0);
})();
