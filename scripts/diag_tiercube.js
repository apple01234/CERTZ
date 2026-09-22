/**
 * v1.4.3 진단 — 등급업 큐브 "사용안됨" 재현
 *  1) 월드 진입 → tier_cube 지급 → 인벤 등급업 버튼 노출 여부
 *  2) 버튼 클릭 → tierUpTargets/보유 수 변화 실측
 *  3) 이벤트 경로(rpg:isekai → handleIsekai tierUp) 직접 발화 비교
 */
const { chromium } = require("playwright");

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 300)));
  p.on("console", (m) => { if (m.type() === "error") errs.push("CONSOLE: " + m.text().slice(0, 200)); });

  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2600);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });

  /* 기존 세이브 사용(없으면 생성) */
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1200);
  const hasChar = await p.evaluate(() => {
    return Array.from(document.querySelectorAll("button")).some((x) => x.textContent?.includes("이 캐릭터로 시작"));
  });
  if (!hasChar) {
    await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click());
    await p.waitForTimeout(700);
    await p.locator("input").first().fill("세라DIAG");
    await p.waitForTimeout(300);
    for (const label of ["직업 선택", "외형 선택"]) {
      await p.evaluate((lb) => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes(lb))?.click(), label);
      await p.waitForTimeout(400);
    }
    await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("생성!"))?.click());
    await p.waitForTimeout(1400);
    await p.evaluate(() => { document.querySelector(".cursor-pointer")?.click(); });
    await p.waitForTimeout(400);
  }
  await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click());
  await p.waitForTimeout(2600);
  for (let i = 0; i < 4; i++) { await p.mouse.click(640, 500); await p.waitForTimeout(400); }
  for (let i = 0; i < 30; i++) {
    const d = await p.evaluate(() => window.__SERTZ__?.game?.scene?.getScene("world")?.dialoguing);
    if (!d) break;
    await p.mouse.click(640, 500);
    await p.waitForTimeout(360);
  }
  const inWorld = await p.evaluate(() => !!(window.__SERTZ__?.game?.scene?.getScene("world")?.player));
  console.log(inWorld ? "월드 진입 OK" : "월드 진입 FAIL");
  if (!inWorld) { console.log(errs.join("\n")); await b.close(); process.exit(1); }

  /* ① 사전 상태 덤프 */
  const pre = await p.evaluate(() => {
    const sc = window.__SERTZ__.game.scene.getScene("world");
    const pl = sc.player;
    return {
      weapon: pl.weapon, armor: pl.armor,
      weaponTier: pl.weapon && (window.__SERTZ_ITEMS__ ? null : null),
      ownedCubes: pl.owned.filter((k) => k === "tier_cube").length,
      tierUpWea: pl.tierUpTargets.weapon, tierUpArm: pl.tierUpTargets.armor,
    };
  });
  console.log("PRE:", JSON.stringify(pre));

  /* ② 큐브 3개 지급 */
  await p.evaluate(() => {
    const sc = window.__SERTZ__.game.scene.getScene("world");
    for (let i = 0; i < 3; i++) sc.player.owned.push("tier_cube");
    sc.emitRpgState();
  });
  await p.waitForTimeout(300);

  /* ③ 인벤 열고 등급업 버튼 존재 확인 */
  await p.keyboard.press("i").catch(() => {});
  await p.waitForTimeout(600);
  const ui = await p.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button")).map((x) => x.textContent?.trim() ?? "");
    const tierBtn = btns.find((t) => t.includes("등급업"));
    return { hasBtn: !!tierBtn, label: tierBtn ?? null, invOpen: btns.some((t) => t.includes("가방")) || !!tierBtn };
  });
  console.log("UI:", JSON.stringify(ui));

  /* ④ 시나리오 A — 버튼 직접 클릭 */
  if (ui.hasBtn) {
    await p.evaluate(() => {
      Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("등급업"))?.click();
    });
    await p.waitForTimeout(600);
    const post = await p.evaluate(() => {
      const sc = window.__SERTZ__.game.scene.getScene("world");
      const pl = sc.player;
      return {
        cubes: pl.owned.filter((k) => k === "tier_cube").length,
        tierUpWea: pl.tierUpTargets.weapon, tierUpArm: pl.tierUpTargets.armor,
        banner: document.body.innerText.match(/등급업[^\n]*/)?.[0] ?? null,
      };
    });
    console.log("POST(click):", JSON.stringify(post));
  }

  /* ⑤ 시나리오 B — 이벤트 직접 발화 */
  await p.evaluate(() => {
    const eb = window.__SERTZ_EB__;
    eb.emit("rpg:isekai", { action: "tierUp", slot: "weapon" });
  });
  await p.waitForTimeout(500);
  const postB = await p.evaluate(() => {
    const sc = window.__SERTZ__.game.scene.getScene("world");
    const pl = sc.player;
    return {
      cubes: pl.owned.filter((k) => k === "tier_cube").length,
      tierUpWea: pl.tierUpTargets.weapon,
      banner: document.body.innerText.match(/등급업[^\n]*/)?.[0] ?? null,
    };
  });
  console.log("POST(emit):", JSON.stringify(postB));

  /* ⑥ rpg 상태의 tierCube 노출 확인 */
  const state = await p.evaluate(() => {
    const sc = window.__SERTZ__.game.scene.getScene("world");
    const st = sc.buildRpgState ? sc.buildRpgState() : null;
    return { tierCubeInState: st ? st.tierCube : "no-buildRpgState" };
  });
  console.log("STATE:", JSON.stringify(state));

  console.log("ERRORS:", errs.length ? errs.slice(0, 5).join(" | ") : "0");
  await b.close();
})().catch((e) => { console.error("SCRIPT FAIL:", e.message); process.exit(1); });
