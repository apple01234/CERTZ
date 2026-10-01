/* 2인 동시접속 E2E — 상호 시야 + 파티 창설/참여 실측 (localhost:3000 실서버) */
const { chromium } = require("playwright");

const URL = "http://localhost:3000";
const shot = (n) => `/home/z/my-project/scripts/mp-${n}.png`;

async function enterWorld(page, name) {
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("text=새로운 모험", { timeout: 30000 });
  await page.click("text=새로운 모험");
  // 인트로 대화 스킵 (E 홀드/클릭) — 월드 씬 진입까지 클릭 반복
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
  const ok = await page.evaluate(() => {
    const w = window.__SERTZ__?.game?.scene.getScene("world");
    return !!w?.player;
  });
  if (!ok) throw new Error(`${name}: 월드 진입 실패`);
}

async function sceneInfo(page) {
  return page.evaluate(() => {
    const w = window.__SERTZ__?.game?.scene.getScene("world");
    if (!w) return null;
    return {
      stage: w.stageDef?.key,
      remotes: w.remotes ? w.remotes.size : -1,
      connected: !!(w.net?.connected),
    };
  });
}

(async () => {
  const browser = await chromium.launch();
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const ctxB = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const A = await ctxA.newPage();
  const B = await ctxB.newPage();

  console.log("[1] 두 클라이언트 월드 진입...");
  await enterWorld(A, "A");
  await enterWorld(B, "B");
  await A.waitForTimeout(2500); // join 브로드캐스트 대기
  await B.waitForTimeout(1000);

  const infoA1 = await sceneInfo(A);
  const infoB1 = await sceneInfo(B);
  console.log("A sees:", JSON.stringify(infoA1));
  console.log("B sees:", JSON.stringify(infoB1));
  await A.screenshot({ path: shot("1-a-sees-b") });
  await B.screenshot({ path: shot("2-b-sees-a") });

  console.log("[2] 파티 창설 (A) → 코드 추출");
  await A.click('[aria-label="파티 열기 (Y)"]');
  await A.click("text=파티 창설");
  await A.waitForTimeout(1200);
  const partyText = await A.evaluate(() => document.body.innerText);
  const m = partyText.match(/파티 코드\s*([A-Z0-9]+)/);
  const code = m ? m[1] : null;
  console.log("party code:", code);
  await A.screenshot({ path: shot("3-a-party-created") });

  console.log("[3] 파티 참여 (B)");
  await B.click('[aria-label="파티 열기 (Y)"]');
  await B.fill('[aria-label="파티 코드"]', code || "P1");
  await B.click("text=참여");
  await B.waitForTimeout(1500);
  await A.waitForTimeout(500);

  const partyA = await A.evaluate(() => document.body.innerText.includes("파티 코드"));
  const textA = await A.evaluate(() => document.body.innerText);
  const textB = await B.evaluate(() => document.body.innerText);
  const memberLines = (t) => (t.match(/Lv\.\d+/g) || []).length;
  console.log("A widget open:", partyA, "| A members:", memberLines(textA), "| B members:", memberLines(textB));
  await A.screenshot({ path: shot("4-party-both") });
  await B.screenshot({ path: shot("5-party-b") });

  console.log("[4] A 이동 → B 화면에서 A 이동 동기화 확인");
  await A.keyboard.down("ArrowRight");
  await A.waitForTimeout(1500);
  await A.keyboard.up("ArrowRight");
  await B.waitForTimeout(700);
  await B.screenshot({ path: shot("6-b-sees-a-moved") });

  await browser.close();
  console.log("DONE");
})().catch((e) => {
  console.error("E2E FAIL:", e.message);
  process.exit(1);
});
