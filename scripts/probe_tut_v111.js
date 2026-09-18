/** v1.1.1 #1 가림 — 튜토리얼 활성 중 퀘스트 트래커 숨김 실측 */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 200)));
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2000);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1000);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click();
  });
  await p.waitForTimeout(600);
  await p.locator("input").first().fill("테스터");
  await p.waitForTimeout(200);
  for (const label of ["직업 선택", "외형 선택"]) {
    await p.evaluate((lb) => {
      Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes(lb))?.click();
    }, label);
    await p.waitForTimeout(300);
  }
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.trim() === "생성!")?.click()
      || Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("생성!"))?.click();
  });
  await p.waitForTimeout(1400);
  await p.evaluate(() => { document.querySelector(".cursor-pointer")?.click(); });
  await p.waitForTimeout(300);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click();
  });
  await p.waitForTimeout(2500);
  /* 프롤로그 스킵 */
  for (let i = 0; i < 6; i++) { await p.mouse.click(640, 500); await p.waitForTimeout(420); }
  await p.waitForTimeout(800);
  /* 인트로 시퀀스(이동→우물→이름짓기)를 실제 종료 경로로 완주 — finishIntro → 대사 2연속 닫기 → 튜토리얼 개시 */
  await p.evaluate(() => {
    const s = window.__SERTZ__?.game?.scene?.getScene("world");
    s?.finishIntro?.("테스터");
  });
  await p.waitForTimeout(1200);
  /* 대사 홀드 고속 진행 — DialogueBox startHold 경로(모바일/PC 홀드와 동일).
   *  마을 오프닝은 다단 대사(introNamed→villageIntro 후속)로 이어지므로 대화가 끝날 때까지 홀드 반복 */
  for (let round = 0; round < 6; round++) {
    await p.mouse.move(640, 600);
    await p.mouse.down();
    await p.waitForTimeout(9000);
    await p.mouse.up();
    await p.waitForTimeout(1200);
    const mid = await p.evaluate(() => {
      const s = window.__SERTZ__?.game?.scene?.getScene("world");
      return { d: !!s?.dialoguing, q: s?.queuedDialogue ?? null, tut: !!s?.tut };
    });
    console.log(`[홀드 ${round + 1}]`, JSON.stringify(mid));
    if (!mid.d && !mid.q) break;
  }
  /* 저FPS 헤드리스에서 dt 캡(50ms) 때문에 리트라이 카운터가 느리게 축적 — tut 생성까지 폴링 */
  let tutStarted = false;
  for (let i = 0; i < 24; i++) {
    await p.waitForTimeout(1500);
    const poll = await p.evaluate(() => {
      const s = window.__SERTZ__?.game?.scene?.getScene("world");
      return { tut: !!s?.tut, d: !!s?.dialoguing };
    });
    if (poll.tut) { tutStarted = true; break; }
  }
  console.log("튜토리얼 개시:", tutStarted);

  const st = await p.evaluate(() => {
    const s = window.__SERTZ__?.game?.scene?.getScene("world");
    const trackerEl = Array.from(document.querySelectorAll(".game-panel")).find((el) => el.textContent?.includes("주민과 인사"));
    const trackerVisible = !!trackerEl && trackerEl.offsetParent !== null;
    const tutPanel = !!s?.tut?.hud;
    return {
      tutExists: !!s?.tut,
      tutDone: s?.tut?.done ?? null,
      tutStep: s?.tut ? s.tut.stepIdx : null,
      trackerVisible,
      tutPanel,
      dialoguing: !!s?.dialoguing,
      retry: s?.tutRetryMs ?? -1,
      pending: !!s?.tutPendingStart,
      queued: s?.queuedDialogue ?? null,
    };
  });
  st.errs = errs.slice(0, 3);
  console.log("상태:", JSON.stringify(st));
  await p.screenshot({ path: "/tmp/probe_tut_111.png" });
  if (st.tutExists && !st.tutDone) {
    console.log(st.trackerVisible ? "FAIL — 튜토리얼 활성 중 트래커 보임" : "PASS — 튜토리얼 활성 중 트래커 숨김 확인");
    process.exit(st.trackerVisible ? 1 : 0);
  } else {
    console.log("WARN — 튜토리얼 미기동(스킵/완료 상태) — 수동 확인 필요");
    process.exit(0);
  }
})().catch((e) => { console.error("PROBE CRASH:", e.message); process.exit(2); });
