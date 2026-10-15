/**
 * probe_x_badge2.js — 월드 진입 후 X 키캡 실측 2차 (프롤로그 스킵 → 마을/사냥터 덤프)
 */
const { chromium } = require("playwright");

(async () => {
  const base = "http://127.0.0.1:3000";
  const browser = await chromium.launch({
    args: ["--no-sandbox"],
    executablePath: "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome",
  });
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  p.setDefaultTimeout(40000);

  await p.goto(base, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
  await p.waitForSelector("text=게임 시작", { timeout: 40000 });
  await p.getByRole("button", { name: /게임 시작/ }).first().click();
  await p.waitForTimeout(900);
  const cb = p.getByText("캐릭터 생성", { exact: false }).first();
  if ((await cb.count()) > 0) await cb.click().catch(() => {});
  await p.waitForTimeout(400);
  const ni = p.locator('input[placeholder*="캐릭터 이름"]').first();
  if ((await ni.count()) > 0) {
    await ni.fill("X프로브2");
    await p.getByRole("button", { name: /다음 — 외형 선택/ }).first().click().catch(() => {});
    await p.waitForTimeout(300);
    await p.getByRole("button", { name: /모험가로 생성!/ }).first().click().catch(() => {});
    await p.waitForTimeout(900);
  }
  await p.getByText("X프로브", { exact: false }).first().click({ timeout: 6000 }).catch(() => {});
  await p.getByRole("button", { name: /이 캐릭터로 시작/ }).first().click({ timeout: 15000 }).catch(async () => {
    const btns = await p.evaluate(() => [...document.querySelectorAll("button")].map((x) => (x.textContent || "").slice(0, 30)));
    console.log("BTNS:", JSON.stringify(btns.slice(0, 24)));
  });
  /* world 씬이 차오를 때까지 대기 */
  for (let i = 0; i < 30; i++) {
    await p.waitForTimeout(1000);
    const st = await p.evaluate(() => {
      const g = window.__SERTZ__;
      const w = g?.game?.scene?.getScene("world");
      return w ? w.children.list.length : -1;
    });
    if (st > 20) break;
  }

  /* 프롤로그 스킵 */
  await p.evaluate(() => {
    const els = [...document.querySelectorAll("*")];
    const skip = els.find((x) => (x.textContent || "").trim() === "건너뛰기" && x.children.length === 0);
    if (skip) skip.click();
  });
  await p.waitForTimeout(4000);

  const dump = (label) => {
    return p.evaluate((lb) => {
      const g = window.__SERTZ__;
      if (!g || !g.game) return { err: "no game" };
      const scenes = g.game.scene.scenes.map((sc) => ({ key: sc.scene.key, n: sc.children ? sc.children.list.length : -1 }));
      const scene = g.game.scene.scenes.find((sc) => sc.children && sc.children.list.length > 0);
      if (!scene) return { err: "no active scene", scenes };
      const out = [];
      const walk = (o) => {
        if (!o) return;
        if (o.type === "Text") {
          out.push({ x: Math.round(o.x), y: Math.round(o.y), text: (o.text || "").slice(0, 36), depth: o.depth, vis: o.visible, scroll: o.scrollFactorX });
        } else if (o.list) o.list.forEach(walk);
      };
      scene.children.list.forEach(walk);
      return { label: lb, scene: scene.scene.key, scenes, n: scene.children.list.length, texts: out.slice(0, 80) };
    }, label);
  };

  let d = await dump("village");
  console.log(JSON.stringify(d, null, 1).slice(0, 4000));

  /* 사냥터로 이동: 포탈 위치로 보내기 (GM 없으면 그냥 덤프만) */
  await p.evaluate(() => {
    const g = window.__SERTZ__;
    const scene = g?.game?.scene?.getScene("world");
    if (scene && scene.player) {
      scene.player.setPosition((scene.portal?.x ?? scene.stageW - 120), (scene.portal?.y ?? scene.stageH / 2));
    }
  });
  await p.waitForTimeout(2500);
  /* 사냥터 선택창이 뜨면 첫 사냥터 클릭 */
  const picked = await p.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const b = btns.find((x) => /숲의 신원|신원|사냥/.test(x.textContent || ""));
    if (b) { b.click(); return true; }
    return false;
  });
  console.log("stage picked:", picked);
  await p.waitForTimeout(6000);
  d = await dump("field");
  console.log(JSON.stringify(d, null, 1).slice(0, 4500));

  await p.screenshot({ path: "/tmp/probe_x2.png" });
  await browser.close();
})().catch((e) => { console.error("PROBE FAIL", e); process.exit(1); });
