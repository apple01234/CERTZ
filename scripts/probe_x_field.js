/**
 * probe_x_field.js — 사냥터 진입 + 자동사냥 상태에서 X 키캡 재현 시도 (전체 텍스트 덤프+스샷)
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
    await ni.fill("X필드");
    await p.getByRole("button", { name: /다음 — 외형 선택/ }).first().click().catch(() => {});
    await p.waitForTimeout(300);
    await p.getByRole("button", { name: /모험가로 생성!/ }).first().click().catch(() => {});
    await p.waitForTimeout(900);
  }
  await p.getByText("X필드").first().click({ timeout: 6000 }).catch(() => {});
  await p.getByRole("button", { name: /이 캐릭터로 시작/ }).first().click({ timeout: 15000 }).catch(() => {});
  for (let i = 0; i < 30; i++) {
    await p.waitForTimeout(1000);
    const st = await p.evaluate(() => {
      const g = window.__SERTZ__;
      const w = g?.game?.scene?.getScene("world");
      return w ? w.children.list.length : -1;
    });
    if (st > 20) break;
  }

  /* 강제로 사냥터 진입 (Lv30 전사) */
  await p.evaluate(() => {
    const w0 = window.__SERTZ__.game.scene.getScene("world");
    const stage = "forest1";
    const base = w0.buildSave(stage) || {};
    base.stage = stage;
    base.lv = 30;
    w0.scene.restart({ stage, save: base });
  });
  await p.waitForTimeout(2500);
  await p.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.dialoguing = false; w.introStep = -1; w.sleepPending = false;
    if (w.player) { w.player.gmSetLevel?.(30); }
    if (w.physics?.world) w.physics.world.resume();
  });
  await p.waitForTimeout(3500);

  const dumpAll = async (label) => {
    return p.evaluate((lb) => {
      const g = window.__SERTZ__;
      const w = g?.game?.scene?.getScene("world");
      if (!w) return { err: "no world" };
      const out = [];
      const walk = (o) => {
        if (!o) return;
        if (o.type === "Text" && o.visible && (o.text || "").trim()) {
          out.push({ x: Math.round(o.x), y: Math.round(o.y), t: (o.text || "").slice(0, 30), d: o.depth, sx: o.scrollFactorX });
        } else if (o.list) o.list.forEach(walk);
      };
      w.children.list.forEach(walk);
      return { label: lb, stage: w.stageDef?.key, px: Math.round(w.player?.x ?? -1), py: Math.round(w.player?.y ?? -1), texts: out };
    }, label);
  };

  let d = await dumpAll("field-idle");
  console.log(JSON.stringify(d, null, 1));

  /* 자동사냥 켜기 */
  await p.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    if (w.pet) { w.autoHunt = true; EventBus?.emit; }
    window.dispatchEvent(new Event("resize"));
  });
  await p.evaluate(() => { const w = window.__SERTZ__.game.scene.getScene("world"); w.toggleAutoHunt?.(); });
  await p.waitForTimeout(4000);
  d = await dumpAll("field-auto");
  console.log(JSON.stringify(d, null, 1).slice(0, 3000));

  await p.screenshot({ path: "/tmp/probe_x_field.png" });
  await browser.close();
})().catch((e) => { console.error("PROBE FAIL", e); process.exit(1); });
