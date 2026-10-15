/**
 * probe_x_cluster.js — 좁은 랜드스케이프(모바일 게임 레이아웃)에서 버튼 클러스터 X 키탭 재현
 */
const { chromium } = require("playwright");

(async () => {
  const base = "http://127.0.0.1:3000";
  const browser = await chromium.launch({
    args: ["--no-sandbox"],
    executablePath: "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome",
  });
  const ctx = await browser.newContext({
    viewport: { width: 740, height: 360 },
    hasTouch: true,
    isMobile: true,
    userAgent: "Mozilla/5.0 (Linux; Android 13; SM-G991N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(40000);

  await p.goto(base, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(3000);
  try { await p.waitForSelector("text=게임 시작", { timeout: 15000 }); }
  catch { await p.screenshot({ path: "/tmp/title_state.png" }); const bt = await p.evaluate(() => [...document.querySelectorAll("button")].map(b=>(b.textContent||"").slice(0,24)).slice(0,15)); console.log("TITLE BTNS:", JSON.stringify(bt)); }
  await p.getByRole("button", { name: /게임 시작/ }).first().click();
  await p.waitForTimeout(900);
  const cb = p.getByText("캐릭터 생성", { exact: false }).first();
  if ((await cb.count()) > 0) await cb.click().catch(() => {});
  await p.waitForTimeout(400);
  const ni = p.locator('input[placeholder*="캐릭터 이름"]').first();
  if ((await ni.count()) > 0) {
    await ni.fill("X클러스터");
    await p.getByRole("button", { name: /다음 — 외형 선택/ }).first().click().catch(() => {});
    await p.waitForTimeout(300);
    await p.getByRole("button", { name: /모험가로 생성!/ }).first().click().catch(() => {});
    await p.waitForTimeout(900);
  }
  await p.getByText("X클러스터").first().click({ timeout: 6000 }).catch(() => {});
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
  await p.waitForTimeout(4000);
  await p.screenshot({ path: "/tmp/probe_cluster.png" });
  /* 버튼 클러스터 DOM 정보 */
  const info = await p.evaluate(() => {
    const out = [];
    const walk = (el) => {
      for (const c of el.children) walk(c);
      const t = (el.textContent || "").trim();
      if ((t === "X" || t === "Z" || t === "C") && el.children.length === 0) {
        const r = el.getBoundingClientRect();
        out.push({ t, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) });
      }
    };
    walk(document.body);
    return out;
  });
  console.log("keycap chips:", JSON.stringify(info));
  await browser.close();
})().catch((e) => { console.error("PROBE FAIL", e); process.exit(1); });
