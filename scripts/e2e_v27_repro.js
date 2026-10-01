/* v2.7 재현 테스트 — "퀘스트 깼는데 포탈이 바로 안 열림" (유저 재신고)
 *  v2.6 보루가 깔린 상태에서도 남는 구멍을 실측으로 찾는다.
 *  [A] forest1 실체인: level 게이트 → 토벌 → 체인 종료 → 포탈 개방 지연 측정
 *  [B] kingdom2 (hunt 단일 체인): 마지막 킬 직후 개방 지연
 *  [C] alfheim9 (hunt+collect): 수확 완료 직후 개방 지연
 *  [D] forest10 보스: 보스 격파 → bossDone 대사 → 스킵 → 개방 지연 (보스 구역은 보루 제외!)
 *  [E] 보루 거부 행렬: dialoguing / pendingPortal / repeatOn 상태에서 보루가 열어주는지
 *  [F] 이어하기: 체인 완료 세이브 재입장 시 개방 복구 */
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
    q: q ? { type: q.type, title: q.title, need: q.need ?? null, targetKey: q.targetKey ?? null } : null,
    portal: !!w.portal, portalActive: !!w.portalActive, dialoguing: !!w.dialoguing,
    pendingPortal: !!w.pendingPortal, repeatOn: !!w.repeatOn, lv: w.player.lv,
  };
});

/** 대사가 떠 있으면 스페이스 연타로 닫기 */
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
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.finishIntro("테스터");
  });
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

/** 실전 킬 경로 — onEnemyKilled(key, exp, x, y)을 need만큼 반복 */
async function huntThrough(page) {
  return page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const q = w.currentQuest();
    if (!q || q.type !== "hunt") return { skipped: true, q: null };
    const need = q.need ?? 0;
    const key = q.targetKey;
    const t0 = performance.now();
    let openedAt = null;
    for (let i = 0; i < need; i++) {
      w.onEnemyKilled(key, 0, w.player.x + 40, w.player.y);
      if (w.portalActive && openedAt === null) openedAt = performance.now() - t0;
    }
    return { skipped: false, need, key, openedAtMs: openedAt, activeNow: !!w.portalActive };
  });
}

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: process.cwd(), env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) { await sleep(500); try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) break; } catch {} }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 300)));

  await enterWorld(page);

  console.log("[A] forest1 — level 게이트 → 토벌 → 체인 종료 → 개방 지연");
  await restartWith(page, "forest1", { lv: 1, questIdx: { forest1: 0 }, seen: [] });
  await page.evaluate(() => { const w = window.__SERTZ__.game.scene.getScene("world"); w.player.gainExp(500); });
  await sleep(400);
  let s = await W(page);
  ok(s.q?.type === "hunt", `A1 게이트 통과 후 토벌 활성 (실제: ${s.q?.type ?? "null"})`);
  const rA = await huntThrough(page);
  ok(rA.activeNow && rA.openedAtMs !== null && rA.openedAtMs < 300, `A2 마지막 킬 즉시 개방 (${Math.round(rA.openedAtMs ?? -1)}ms)`);
  s = await W(page);
  ok(!s.q, `A3 체인 종료 상태 (q=${s.q ? s.q.type : "null"})`);
  await clearDialogue(page);

  console.log("[B] kingdom2 — hunt 단일 체인 즉시 개방");
  await restartWith(page, "kingdom2", { lv: 12, questIdx: { kingdom2: 0 }, seen: [] });
  s = await W(page);
  console.log(`   kingdom2 체인: ${s.chainLen}개, 현재=${s.q?.type}`);
  const rB = await huntThrough(page);
  ok(rB.activeNow && rB.openedAtMs !== null && rB.openedAtMs < 300, `B1 마지막 킬 즉시 개방 (${Math.round(rB.openedAtMs ?? -1)}ms)`);
  await clearDialogue(page);

  console.log("[C] alfheim9 — hunt+collect → 수확 후 개방");
  await restartWith(page, "alfheim9", { lv: 30, questIdx: { alfheim9: 0 }, seen: [] });
  s = await W(page);
  console.log(`   alfheim9 체인: ${s.chainLen}개, 현재=${s.q?.type}`);
  const rC1 = await huntThrough(page);
  await sleep(300);
  s = await W(page);
  ok(s.q?.type === "collect" || !s.q, `C1 토벌 후 수확 활성 (실제: ${s.q?.type ?? "null"})`);
  if (s.q?.type === "collect") {
    const t0 = Date.now();
    await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      if (!w.fragment) w.spawnFragmentForQuest();
      w.collectFragment(w.fragment ?? w.beacon ?? w.add.image(0, 0, "beam"));
    });
    await sleep(600);
    await clearDialogue(page);
    s = await W(page);
    const ms = Date.now() - t0;
    ok(!s.portalActive === false, `C2 수확 후 개방 (portalActive=${s.portalActive}, 경과 ${ms}ms)`);
    ok(s.portalActive, `C3 포탈 활성 확인 (수확 ~${ms}ms 내)`);
  } else {
    ok(s.portalActive, `C2-b 수확 없이 이미 개방됨 (portalActive=${s.portalActive})`);
  }

  console.log("[D] forest10 보스 — 격파 → 대사 → 개방 (보루 제외 구역 실측)");
  await restartWith(page, "forest10", { lv: 30, questIdx: { forest10: 0 }, seen: [] });
  s = await W(page);
  console.log(`   forest10 체인: ${s.chainLen}개, 현재=${s.q?.type} (chain: hunt→boss→reach 예상)`);
  // 토벌 → 보스 소환까지 진행
  const rD1 = await huntThrough(page);
  await sleep(300);
  s = await W(page);
  if (s.q?.type === "boss") {
    ok(!!s.portal === false, `D1 보스 구역은 전진 포탈 미생성이 정상 (portal=${s.portal})`);
    const t0 = Date.now();
    await page.evaluate(() => { window.__SERTZ__.game.scene.getScene("world").onBossDead(); });
    await sleep(1600);
    await clearDialogue(page);
    await sleep(900);
    s = await W(page);
    const ms = Date.now() - t0;
    ok(s.portal && s.portalActive, `D2 보스 격파 후 포탈 생성+개방 (portal=${s.portal}, active=${s.portalActive}, ${ms}ms)`);
    console.log(`   D2 상세: q=${s.q ? s.q.type : "null"} pendingPortal=${s.pendingPortal}`);
  } else {
    console.log(`   D1-스킵: 현재 퀘스트=${s.q?.type} (보스까지 수동 진행 필요)`);
  }

  console.log("[E] 보루 거부 행렬 — 체인 완료 상태에서 장애물별 복구");
  // E1: dialoguing 강제 true → 보루 거부 예상 → 해제 후 개방 확인
  await restartWith(page, "kingdom2", { lv: 12, questIdx: { kingdom2: 99 }, seen: [] });
  await sleep(2200); // 보루 틱 몇 번 지나가기
  s = await W(page);
  ok(s.portalActive, `E0 체인 완료 이어하기 → 개방 복구 (active=${s.portalActive})`);
  // E1: pendingPortal 끼임 시뮬레이션 — 보루가 pendingPortal=true를 무시하는지
  await page.evaluate(() => { const w = window.__SERTZ__.game.scene.getScene("world"); w.portalActive = false; w.pendingPortal = true; });
  await sleep(3200);
  s = await W(page);
  if (!s.portalActive) {
    ok(true, `E1 pendingPortal=true → 보루 거부 확인 (영구 끼임 가능성!) — portalActive=${s.portalActive}`);
  } else {
    ok(false, `E1 pendingPortal=true여도 보루가 열어줌`);
  }
  // E2: dialoguing=true 끼임 — 보루 거부
  await page.evaluate(() => { const w = window.__SERTZ__.game.scene.getScene("world"); w.dialoguing = true; });
  await sleep(3200);
  s = await W(page);
  ok(!s.portalActive, `E2 dialoguing=true → 보루 거부 확인 (active=${s.portalActive})`);
  await page.evaluate(() => { const w = window.__SERTZ__.game.scene.getScene("world"); w.dialoguing = false; });
  await sleep(2000);
  s = await W(page);
  ok(s.portalActive, `E3 dialoguing 해제 → 보루 개방 (active=${s.portalActive})`);

  console.log(`\n결과: PASS ${pass} / FAIL ${fail}`);
  await page.screenshot({ path: "/home/z/my-project/scripts/v27-repro-final.png" });
  await browser.close();
  srv.kill();
  process.exit(fail > 0 ? 1 : 0);
})();
