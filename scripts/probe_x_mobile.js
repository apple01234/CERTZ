/**
 * probe_x_mobile.js — 모바일 뷰포트(터치)에서 X 키캡 실측 — Phaser 텍스트 + DOM 동시 스캔
 */
const { chromium } = require("playwright");

(async () => {
  const base = "http://127.0.0.1:3000";
  const browser = await chromium.launch({
    args: ["--no-sandbox"],
    executablePath: "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome",
  });
  const ctx = await browser.newContext({
    viewport: { width: 915, height: 412 },
    hasTouch: true,
    isMobile: true,
    userAgent: "Mozilla/5.0 (Linux; Android 13; SM-G991N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(40000);

  await p.goto(base, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(3000);
  await p.waitForSelector("text=게임 시작", { timeout: 40000 });
  await p.getByRole("button", { name: /게임 시작/ }).first().click();
  await p.waitForTimeout(900);
  const cb = p.getByText("캐릭터 생성", { exact: false }).first();
  if ((await cb.count()) > 0) await cb.click().catch(() => {});
  await p.waitForTimeout(400);
  const ni = p.locator('input[placeholder*="캐릭터 이름"]').first();
  if ((await ni.count()) > 0) {
    await ni.fill("XM프로브");
    await p.getByRole("button", { name: /다음 — 외형 선택/ }).first().click().catch(() => {});
    await p.waitForTimeout(300);
    await p.getByRole("button", { name: /모험가로 생성!/ }).first().click().catch(() => {});
    await p.waitForTimeout(900);
  }
  await p.getByText("XM프로브").first().click({ timeout: 6000 }).catch(() => {});
  await p.getByRole("button", { name: /이 캐릭터로 시작/ }).first().click({ timeout: 15000 }).catch(() => {});
  for (let i = 0; i < 25; i++) {
    await p.waitForTimeout(1000);
    const st = await p.evaluate(() => {
      const g = window.__SERTZ__;
      const w = g?.game?.scene?.getScene("world");
      return w ? w.children.list.length : -1;
    });
    if (st > 40) break;
  }

  /* 프롤로그/대화 스킵 — 건너뛰기 클릭 + 스페이스 탭 */
  await p.evaluate(() => {
    const els = [...document.querySelectorAll("*")];
    const skip = els.reverse().find((x) => (x.textContent || "").trim() === "건너뛰기");
    if (skip) skip.click();
  });
  for (let i = 0; i < 10; i++) { await p.tap("body").catch(() => {}); await p.waitForTimeout(250); }
  await p.waitForTimeout(3000);

  const res = await p.evaluate(() => {
    const g = window.__SERTZ__;
    const out = { phaser: [], dom: [] };
    const scenes = g?.game?.scene?.scenes ?? [];
    for (const sc of scenes) {
      if (!sc.children) continue;
      const walk = (o) => {
        if (!o) return;
        if (o.type === "Text" && o.visible) {
          const t = (o.text || "").trim();
          if (/^X$/.test(t) || t.includes("X")) out.phaser.push({ scene: sc.scene.key, x: Math.round(o.x), y: Math.round(o.y), text: t.slice(0, 30), depth: o.depth });
        } else if (o.list) o.list.forEach(walk);
      };
      sc.children.list.forEach(walk);
    }
    const walk2 = (el) => {
      for (const c of el.children) walk2(c);
      const t = (el.textContent || "").trim();
      if (t === "X") {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) out.dom.push({ tag: el.tagName, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), cls: (el.className || "").toString().slice(0, 140) });
      }
    };
    walk2(document.body);
    return out;
  });
  console.log(JSON.stringify(res, null, 1));
  await p.screenshot({ path: "/tmp/probe_x_mobile.png", fullPage: false });
  await browser.close();
})().catch((e) => { console.error("PROBE FAIL", e); process.exit(1); });
