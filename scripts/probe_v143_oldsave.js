/**
 * v1.4.3 유저 리포트 재현 2차 — 구세이브 시나리오
 *  D. 마을 구세이브(questIdx=2, cleared, lv10) 진입
 *  E. forest1(1-1) 진행중 세이브 진입
 *  F. 슬롯 메타 최소 필드(구버전 slots 스토어) 진입
 *  각 단계 pageerror 실측 + 스크린샷
 */
const { chromium } = require("playwright");

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 260) + (e.stack ? " @ " + (e.stack.split("\n")[1] || "").trim().slice(0, 180) : "")));
  p.on("console", (m) => { if (m.type() === "error" && !m.text().includes("404")) errs.push("CONSOLE: " + m.text().slice(0, 200)); });

  const worldPlayer = () => p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    return !!(sc && sc.player);
  });
  const clickStart = async () => {
    await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click());
    await p.waitForTimeout(2800);
    for (let i = 0; i < 25; i++) {
      const d = await p.evaluate(() => window.__SERTZ__?.game?.scene?.getScene("world")?.dialoguing);
      if (!d) break;
      await p.mouse.click(640, 500);
      await p.waitForTimeout(300);
    }
    await p.waitForTimeout(800);
  };
  const toLobby = async () => {
    await p.evaluate(() => window.__SERTZ_EB__?.emit?.("rpg:exitMenu", { lobby: true }));
    await p.waitForTimeout(2500);
  };

  await p.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
  for (let i = 0; i < 40 && !(await p.evaluate(() => !!window.__SERTZ_DEFER_DONE__)); i++) await p.waitForTimeout(300);

  /* 캐릭터 1개 생성 → 로비 복귀 (슬롯 준비) */
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(900);
  await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click());
  await p.waitForTimeout(500);
  await p.locator("input").first().fill("구세이브테스트");
  await p.waitForTimeout(200);
  for (const label of ["직업 선택", "외형 선택"]) {
    await p.evaluate((lb) => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes(lb))?.click(), label);
    await p.waitForTimeout(300);
  }
  await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("생성!"))?.click());
  await p.waitForTimeout(1100);
  await p.evaluate(() => document.querySelector(".cursor-pointer")?.click());
  await p.waitForTimeout(250);
  await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click());
  await p.waitForTimeout(2400);
  await clickStart(); // 대사 스킵 겸용
  console.log("기준 진입:", await worldPlayer());
  await toLobby();

  const charId = await p.evaluate(() => JSON.parse(localStorage.getItem("sertz_slots_v1") || "{}").activeId || Object.keys(JSON.parse(localStorage.getItem("sertz_slots_v1") || "{}").chars || {})[0]);
  console.log("charId:", charId);

  /* ── D. 마을 구세이브 시뮬레이션: questIdx=2 · cleared · lv10 ── */
  await p.evaluate((id) => {
    const raw = JSON.parse(localStorage.getItem(`sertz_char_${id}`));
    raw.questIdx = { village: 2 };
    raw.cleared = true;
    raw.lv = 10;
    raw.exp = 1200;
    raw.maxHp = 550;
    raw.atk = 65;
    raw.gold = 4321;
    localStorage.setItem(`sertz_char_${id}`, JSON.stringify(raw));
  }, charId);
  await clickStart();
  console.log("D. 마을 구세이브 진입:", await worldPlayer(), "| errs:", errs.length);
  if (errs.length) console.log("   └", errs.slice(0, 4).join("\n   "));
  await p.screenshot({ path: "/home/z/my-project/scripts/shot_v143_oldsave_village.png" });
  await toLobby();

  /* ── E. forest1 진행중 세이브: stage=forest1 ── */
  await p.evaluate((id) => {
    const raw = JSON.parse(localStorage.getItem(`sertz_char_${id}`));
    raw.stage = "forest1";
    localStorage.setItem(`sertz_char_${id}`, JSON.stringify(raw));
  }, charId);
  await clickStart();
  console.log("E. forest1 진입:", await worldPlayer(), "| errs:", errs.length);
  if (errs.length) console.log("   └", errs.slice(0, 4).join("\n   "));
  await p.screenshot({ path: "/home/z/my-project/scripts/shot_v143_forest1.png" });
  await toLobby();

  /* ── F. 슬롯 메타 최소 필드(구버전 slots 스토어) ── */
  await p.evaluate((id) => {
    const store = JSON.parse(localStorage.getItem("sertz_slots_v1"));
    const c = store.chars[id];
    // 구버전 흉내: 최신 필드 제거
    delete c.lookTint; delete c.gender; delete c.skinIdx; delete c.gmSkin;
    c.lastSeen = c.lastSeen || Date.now();
    localStorage.setItem("sertz_slots_v1", JSON.stringify(store));
  }, charId);
  await clickStart();
  console.log("F. 구버전 슬롯 메타 진입:", await worldPlayer(), "| errs:", errs.length);
  if (errs.length) console.log("   └", errs.slice(0, 4).join("\n   "));

  console.log("\n=== 전체 에러 (" + errs.length + ") ===");
  errs.slice(0, 10).forEach((e) => console.log(e));
  await b.close();
})();
