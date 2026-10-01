/**
 * v1.1.0 시각 검증 프로브
 *  ① 여캠+백자 피부 생성 → 로비 카드 → 인게임 스프라이트 실측
 *  ② 프롤로그 시네마틱 렌더
 *  ③ 퀘스트창 on/off 버튼
 *  ④ 코스튬(EERT 등 GM으로 지급 후 착용) → 스프라이트 완전 교체 확인
 *  ⑤ 로딩바/차원문/피규어 확인
 */
const { chromium } = require("playwright");

(async () => {
  const out = [];
  const log = (m) => { out.push(m); console.log(m); };
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 250)));
  p.on("console", (m) => { if (m.type() === "error") errs.push("CONSOLE: " + m.text().slice(0, 180)); });

  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2200);

  /* ⑤ 부팅 로딩바 존재 (캡처는 타이밍상 어려우므로 로드된 시트 수로 검증) */
  const sheetCount = await p.evaluate(async () => {
    const probes = ["chf0_idle0", "chf2_walk0", "cost_silver_idle0", "cost_crimson_atk0", "acc_crown", "acc_wings_devil", "hair_ponytail"];
    const loaded = [];
    for (const k of probes) {
      const img = new Image();
      const ok = await new Promise((res) => { img.onload = () => res(img.width > 0); img.onerror = () => res(false); img.src = `/assets/${k}.webp`; });
      if (ok) loaded.push(k);
    }
    return loaded;
  });
  log(`⑤ 변형 시트 서빙: ${sheetCount.length}/7 — ${sheetCount.join(",")}`);

  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1200);

  /* ① 여캠 + 백자 피부 생성 */
  await p.evaluate(() => {
    const b2 = Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"));
    b2?.click();
  });
  await p.waitForTimeout(700);
  await p.locator("input").first().fill("세라");
  await p.waitForTimeout(300);
  const clickBtn = (t) => p.evaluate((lb) => {
    const b2 = Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes(lb));
    b2?.click(); return !!b2;
  }, t);
  log("직업 단계: " + await clickBtn("직업 선택"));
  await p.waitForTimeout(400);
  log("외형 단계: " + await clickBtn("외형 선택"));
  await p.waitForTimeout(500);
  await p.screenshot({ path: "/tmp/v110_step3.png" });
  // 여캠 + 백자 선택
  log("여캠 토글: " + await p.evaluate(() => {
    const b2 = Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.trim() === "여캐");
    b2?.click(); return !!b2;
  }));
  await p.waitForTimeout(300);
  log("백자 피부: " + await p.evaluate(() => {
    const b2 = Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.trim() === "백자");
    b2?.click(); return !!b2;
  }));
  await p.waitForTimeout(400);
  await p.screenshot({ path: "/tmp/v110_step3_female.png" });
  log("생성: " + await clickBtn("생성!"));
  await p.waitForTimeout(1400);
  await p.screenshot({ path: "/tmp/v110_lobby_card.png" });
  // 입장
  await p.evaluate(() => {
    const card = document.querySelector(".cursor-pointer");
    card?.click();
  });
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    const b2 = Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"));
    b2?.click();
  });
  await p.waitForTimeout(2600);

  /* ② 프롤로그 */
  await p.screenshot({ path: "/tmp/v110_prologue.png" });
  const prologueVisible = await p.getByText("프롤로그", { exact: true }).first().isVisible().catch(() => false);
  log(`② 프롤로그 표시: ${prologueVisible}`);
  // 4비트 넘기기
  for (let i = 0; i < 4; i++) {
    await p.mouse.click(640, 360);
    await p.waitForTimeout(900);
  }
  await p.waitForTimeout(800);
  await p.screenshot({ path: "/tmp/v110_intro.png" });

  console.log("ERRORS:", JSON.stringify(errs.slice(0, 8)));
  await b.close();
})();
