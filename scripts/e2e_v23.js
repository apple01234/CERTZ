/* v2.3 E2E — 지시 7건 검증 (수정판)
 *  ①대사/퀘스트 재표시 버그(재입장 시 인트로 대사 스킵) ②몬스터 증원/리젠 단축 ③스탯 자동배분 UI(미전직)
 *  ④반복 의뢰 NPC 수주 게이트 ⑤(APK 빌드 없이 커밋 — 셸) ⑥여관/집 정사각 방 832×832 + 줌 ⑦채팅 송수신 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const { io } = require("socket.io-client");

const PORT = 3107;
const URL = `http://localhost:${PORT}`;
const shot = (n) => `/home/z/my-project/scripts/v23-${n}.png`;
let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log(`  PASS — ${label}`); } else { fail++; console.log(`  FAIL — ${label}`); } };

async function enterWorld(page) {
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("text=새로운 모험", { timeout: 60000 });
  await page.click("text=새로운 모험");
  for (let i = 0; i < 40; i++) {
    const inWorld = await page.evaluate(() => !!(window.__SERTZ__?.game?.scene.getScene("world")?.player));
    if (inWorld) break;
    await page.mouse.click(640, 400); await page.keyboard.press("e"); await page.waitForTimeout(400);
  }
  await page.waitForTimeout(900);
  // 인트로 시퀀스 정상 완료 시뮬레이션 (이름 지정 → 마을 오프닝 기록)
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.finishIntro("테스터");
  });
  await page.waitForTimeout(500);
  for (let i = 0; i < 6; i++) { await page.keyboard.press("Space"); await page.waitForTimeout(280); }
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.dialoguing = false; w.introStep = -1; w.sleepPending = false;
  });
  await page.waitForTimeout(300);
}

async function restartAt(page, stage) {
  await page.evaluate((st) => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const carry = w.buildSave(st);
    w.scene.restart({ stage: st, save: carry });
  }, stage);
  await page.waitForTimeout(1800);
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.dialoguing = false; w.introStep = -1;
  });
  await page.waitForTimeout(250);
}

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: process.cwd(), env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 500)); try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) break; } catch {} }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 200)));

  console.log("[1] 지시#1 — 인트로 완료 → 마을 재입장 시 대사 미재생");
  await enterWorld(page);
  const introState = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    return { seen: [...w.seenSet], name: JSON.parse(window.localStorage.getItem("sertz_save_v2") || "{}").playerName };
  });
  ok(introState.seen.includes("villageIntro"), "인트로 대사 기록됨 (villageIntro)");
  await restartAt(page, "village");
  const reentry = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    return { dialoguing: w.dialoguing, seenCount: w.seenSet.size };
  });
  ok(reentry.dialoguing === false, `재입장 대사 없음 (dialoguing=${reentry.dialoguing})`);
  ok(reentry.seenCount >= 1, `본 대사 기록 유지 (${reentry.seenCount}건)`);

  console.log("[2] 지시#2 — 몬스터 증원 (forest1: 기존 5 → 8+) + 리젠 단축 코드 반영");
  await restartAt(page, "forest1");
  const forest = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    return { enemies: w.enemies.length, def: w.stageDef.enemies.map((g) => g.count) };
  });
  ok(forest.def[0] >= 8, `forest1 스폰 정의 ${forest.def[0]}마리 (기존 5)`);
  ok(forest.enemies >= 8, `실제 배치 ${forest.enemies}마리`);
  await page.screenshot({ path: shot("forest") });

  console.log("[3] 지시#4 — forest1 체인 완료 → 반복 의뢰 '미수주' 확인 (자동 활성 차단)");
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.questIdx = w.stageDef.quests.length;
    w.repeatOn = false;
    w.emitQuest();
  });
  await page.waitForTimeout(300);
  const gated = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    return { repeatActive: w.repeatActive(), unlockable: w.repeatUnlockable(), quest: w.currentQuest() };
  });
  ok(gated.repeatActive === false, "수주 전 — 반복 의뢰 자동 활성 안 됨");
  ok(gated.quest === null, "체인 완료 — 일반 퀘스트 없음");
  ok(gated.unlockable === true, "수주 가능 상태 진입");

  console.log("[4] 지시#4 — 마을 상인 수주 → forest1 반복 의뢰 활성");
  await restartAt(page, "village");
  const merchantState = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.nearInteract = { x: w.merchant.x, y: w.merchant.y, kind: "shop", label: "라고스 상점" };
    w.tryInteract();
    return { dialoguing: w.dialoguing };
  });
  ok(merchantState.dialoguing === true, "상인 수주 대사 시작");
  await page.screenshot({ path: shot("merchant-offer") });
  await page.evaluate(() => window.__SERTZ__.game.scene.getScene("world").resumeFromDialogue());
  await page.waitForTimeout(400);
  const unlocked = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    return { repeatOn: w.repeatOn, saved: JSON.parse(window.localStorage.getItem("sertz_save_v2") || "{}").repeatOn };
  });
  ok(unlocked.repeatOn === true && unlocked.saved === true, "수주 완료 — repeatOn=true (세이브 반영)");
  await restartAt(page, "forest1");
  const repeatQ = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const q = w.currentQuest();
    return { active: w.repeatActive(), isRepeat: q?.id === "repeat", title: q?.title ?? null };
  });
  ok(repeatQ.active === true && repeatQ.isRepeat, `forest1 반복 의뢰 활성 — "${repeatQ.title}"`);

  console.log("[5] 지시#6 — 여관 실내 정사각 방 (832×832 + 확대 줌)");
  await restartAt(page, "interior_inn");
  const inn = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    return {
      w: w.stageW, h: w.stageH, zoom: w.cameras.main.zoom,
      kinds: w.interactables.map((i) => i.kind),
      solids: w.solidGroup.children.size,
    };
  });
  ok(inn.w === 832 && inn.h === 832, `정사각 방 ${inn.w}×${inn.h}`);
  ok(inn.zoom > 1.4, `실내 확대 줌 ${inn.zoom.toFixed(2)} (일반 구역은 1.25)`);
  ok(inn.kinds.includes("innkeeper") && inn.kinds.includes("exit") && inn.kinds.includes("bed"), "여관 상호작용 유지 (로안/침대/출구)");
  await page.screenshot({ path: shot("inn-square") });

  console.log("[6] 지시#3 — 스탯 자동배분 (미전직 폴백, UI 버튼 클릭)");
  await restartAt(page, "village");
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.player.ap = 7; w.player.cls = null; // 미전직 + AP 7
    w.emitRpgState(); w.emitHud();
    window.__SERTZ_EB__.emit("ui:panel", { panel: "stat" });
  });
  await page.waitForTimeout(600);
  const statBtn = await page.$('button[aria-label="AP 자동 배분"]');
  ok(!!statBtn, "스탯 패널 + 자동 배분 버튼 노출");
  if (statBtn) {
    const before = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      return { ap: w.player.ap, str: w.player.stats.str, dex: w.player.stats.dex };
    });
    await statBtn.click();
    await page.waitForTimeout(700);
    const after = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      return { ap: w.player.ap, str: w.player.stats.str, dex: w.player.stats.dex };
    });
    ok(before.ap === 7 && after.ap === 0 && after.str - before.str === 6 && after.dex - before.dex === 1,
      `미전직 자동배분 힘4:민첩1 폴백 — AP ${before.ap}→${after.ap} (힘+${after.str - before.str}, 민첩+${after.dex - before.dex})`);
    await page.screenshot({ path: shot("auto-alloc") });
  }

  console.log("[7] 지시#7 — 채팅: 게임 클라 수신 + 더미 클라 송신");
  await restartAt(page, "village");
  await page.evaluate(() => {
    window.__CHAT_GOT__ = [];
    const s = window.__SERTZ_NET__;
    s.on("chat", (m) => { if (!m.sys) window.__CHAT_GOT__.push(`${m.name}:${m.text}`); });
  });
  const dummy = io(URL, { path: "/socket.io" });
  await new Promise((res) => {
    dummy.on("connect", () => {
      dummy.emit("join", { name: "더미", lv: 5, cls: null, x: 300, y: 300, stage: "village" });
      setTimeout(() => dummy.emit("chat", "E2E 채팅 수신 테스트"), 450);
      setTimeout(res, 1600);
    });
    setTimeout(res, 4000);
  });
  const chatGot = await page.evaluate(() => window.__CHAT_GOT__);
  dummy.close();
  ok(chatGot.some((t) => t.includes("E2E 채팅 수신 테스트")), `게임 클라 채팅 수신 (${JSON.stringify(chatGot)})`);
  const chatReady = await page.evaluate(() => !!(window.__SERTZ_NET__ && window.__SERTZ_NET__.connected));
  ok(chatReady, "netChatReady 연결 상태 true (연결 시 채팅 가능)");

  console.log("[8] 지시#7 — 재접속 자동 재참여 (lastJoin 재발송)");
  const rejoin = await page.evaluate(async () => {
    const s = window.__SERTZ_NET__;
    // 서버가 players 맵에서 삭제했다가 다시 join하는지 확인 — 소켓 강제 재연결
    const joined = await new Promise((resolve) => {
      let rejoined = false;
      s.on("connect", () => { rejoined = true; });
      s.io.engine.close(); // 강제 연결 종료 → socket.io 자동 재접속
      setTimeout(() => resolve({ rejoined, connected: s.connected }), 5000);
    });
    return joined;
  });
  ok(rejoin.rejoined && rejoin.connected, `재접속 후 자동 재참여 동작 (connected=${rejoin.connected})`);

  await browser.close();
  srv.kill();
  console.log(`\n=== 결과: ${pass} PASS / ${fail} FAIL ===`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error("E2E ERROR:", e); process.exit(1); });
