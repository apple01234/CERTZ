const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForSelector("text=게임 시작", { timeout: 40000 });
  await p.getByText("게임 시작", { exact: false }).first().click();
  await p.waitForTimeout(2000);
  const hasStart = await p.getByText("이 캐릭터로 시작").first().isVisible().catch(() => false);
  if (!hasStart) {
    await p.getByText("캐릭터 생성").first().click(); await p.waitForTimeout(1200);
    await p.getByPlaceholder("캐릭터 이름 (최대 8자)").fill("연출샷");
    await p.getByText("다음 — 직업 선택").click(); await p.waitForTimeout(1000);
    await p.getByText("전사", { exact: false }).first().click();
    await p.getByText("다음 — 외형 선택").click(); await p.waitForTimeout(1000);
    await p.getByText("남캐").first().click(); await p.waitForTimeout(600);
    await p.getByText("전사로 생성!").click(); await p.waitForTimeout(1500);
  }
  await p.getByText("이 캐릭터로 시작").first().click();
  await p.waitForTimeout(4000);
  await p.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const stub = { stage: "forest1", lv: 8, exp: 0, maxHp: 260, atk: 22, cleared: false, maxMp: 90, playerName: "연출샷", cls: "warrior", startCls: "warrior", gold: 200, introSeen: true };
    w.scene.restart({ stage: "forest1", save: stub, fresh: true });
  });
  await p.waitForTimeout(7000);
  await p.keyboard.press("Enter");
  await p.waitForTimeout(3500); // 챕터 카드 연출 종료 대기
  // 반응 연출 유도: 플레이어를 적 근처로 이동시키고 강타
  await p.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const e = (w.enemies || []).find((x) => x.active && x.alive);
    if (!e) return;
    e.hp = 100000; e.maxHp = Math.max(e.maxHp, 100000);
    e.x = w.player.x + 120; e.y = w.player.y; // 근접 배치
    const near = (w.enemies || []).filter((x) => x.active && x.alive && x !== e).slice(0, 3);
    near.forEach((n, i) => { n.x = e.x + 60 + i * 50; n.y = e.y + 30 * (i % 2 ? 1 : -1); n.hp = 100000; });
    w.player.faceLeft === undefined; // no-op
    e.takeDamage(180, { x: 1, y: 0 }, 0); // 화염(전사) vs 자연 → 폭발 반응!
  });
  await p.waitForTimeout(220); // 반응 연출 진행 중 캡처
  await p.screenshot({ path: "/tmp/reaction_vfx.png" });
  await p.waitForTimeout(400);
  await p.screenshot({ path: "/tmp/reaction_vfx2.png" });
  await b.close();
  console.log("스크린샷 2장 저장 완료");
})().catch((e) => { console.error("실패:", e.message); process.exit(1); });
