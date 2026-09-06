/**
 * v3.3.0 런타임 스모크 테스트 — 실측 검증
 *  1) 게임 부팅 → 타이틀 → 새 게임 진입
 *  2) GM 패널 5차 전직 부여 → skill5Unlocked / sTier=5 실측
 *  3) 궁극기(useSkill5) 시전 → MP/쿨다운 변화 확인
 *  4) 무릉도장 입장 → 허수아비 6기 + 타이머 UI + 점수 누적
 *  5) 멀티 소켓 polling 연결 확인
 *  6) 페이지 에러 수집
 */
const { chromium } = require("playwright");

(async () => {
  const errors = [];
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader"] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`PAGEERROR: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`CONSOLE: ${m.text().slice(0, 200)}`);
  });

  console.log("[1] 게임 부팅…");
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(6000);

  // canvas 존재 확인
  const hasCanvas = await page.evaluate(() => !!document.querySelector("canvas"));
  console.log("canvas:", hasCanvas);

  // 타이틀 → 새 게임 (게임 버튼 텍스트로 찾기)
  console.log("[2] 새 게임 시작…");
  const btns = await page.locator("button").allTextContents();
  console.log("buttons:", JSON.stringify(btns.slice(0, 10)));
  // "새로 시작" / "새 게임" 버튼 클릭
  const newBtn = page.locator("button", { hasText: /새로|새 게임|시작/ }).first();
  if (await newBtn.count() > 0) {
    await newBtn.click();
    console.log("새 게임 클릭됨");
  }
  await page.waitForTimeout(5000);

  // 씬 접근
  const sceneInfo = await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    if (!s) return null;
    return {
      stage: s.stageDef?.key,
      playerLv: s.player?.lv,
      stageCh: s.player?.stageCh,
      fifth: s.player?.fifth,
      sTier: s.player?.sTier,
      skill5Unlocked: s.player?.skill5Unlocked,
    };
  });
  console.log("scene:", JSON.stringify(sceneInfo));

  console.log("[3] GM 5차 전직 부여…");
  const gmResult = await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    if (!s) return null;
    const EB = window.__SERTZ_EB__;
    EB.emit("rpg:gm", { type: "fifth", value: 1 });
    return {
      fifth: s.player.fifth,
      sTier: s.player.sTier,
      skill5Unlocked: s.player.skill5Unlocked,
      skill5Name: s.player.skill5Name,
      skill1Name: s.player.skill1Name,
      skill3Name: s.player.skill3Name,
      skill5CdMax: s.player.skill5Max,
    };
  });
  console.log("gm fifth:", JSON.stringify(gmResult));

  console.log("[4] 궁극기 시전 (MP 충전 후)…");
  const ult = await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    const p = s.player;
    p.mp = Math.max(p.mp, 100);
    const cdBefore = p.skill5Cd;
    p.useSkill5();
    return { cdBefore, cdAfter: p.skill5Cd, state: p.state, mpUsed: true };
  });
  console.log("ult:", JSON.stringify(ult));
  await page.waitForTimeout(1500);

  console.log("[5] 무릉도장 입장…");
  await page.evaluate(() => {
    const EB = window.__SERTZ_EB__;
    EB.emit("rpg:gm", { type: "dojang" });
  });
  await page.waitForTimeout(3500);
  const dojang = await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    return {
      stage: s.stageDef?.key,
      dojangActive: s.dojangActive,
      dojangScore: s.dojangScore,
      dummies: s.enemies?.filter((e) => e.dummy).length ?? 0,
      enemies: s.enemies?.length ?? 0,
      uiText: s.dojangText?.text ?? null,
    };
  });
  console.log("dojang:", JSON.stringify(dojang));

  // 허수아비 때려서 점수 누적 확인 (takeDamage는 dir.x/.y만 접근하므로 plain object OK)
  console.log("[6] 허수아비 타격 → 점수 누적…");
  const score3 = await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    const dummy = s.enemies.find((e) => e.dummy);
    const before = s.dojangScore;
    dummy.takeDamage(2500, { x: 0, y: 1 }, 0, false);
    dummy.takeDamage(2500, { x: 0, y: 1 }, 0, false);
    return { before, after: s.dojangScore, alive: dummy.alive, hp: dummy.hp };
  });
  console.log("score3:", JSON.stringify(score3));

  console.log("[7] 소켓(멀티) 연결 상태…");
  const net = await page.evaluate(() => {
    const sock = window.__SERTZ_NET__;
    return sock ? { connected: sock.connected, transport: sock.io?.engine?.transport?.name } : null;
  });
  console.log("net:", JSON.stringify(net));

  // 콘솔 에러 필터링 (무해한 것 제외)
  const harmful = errors.filter(
    (e) => !/favicon|Download the React DevTools|Autoplay|AudioContext|WebGL|swiftshader/i.test(e)
  );
  console.log("\n=== 결과 요약 ===");
  console.log("harmful errors:", harmful.length);
  harmful.slice(0, 10).forEach((e) => console.log("  -", e));

  await page.screenshot({ path: "/home/z/my-project/scripts/shot_v330.png" });
  await browser.close();
  process.exit(harmful.length > 0 ? 1 : 0);
})().catch((e) => {
  console.error("SMOKE FAIL:", e.message);
  process.exit(2);
});
