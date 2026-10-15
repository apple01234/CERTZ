/**
 * probe_x_badge.js — 유저 제보 "기본공격 단축키 X 아이콘" 출처 실측
 *  캐릭터 생성 → 월드 진입 → Phaser 씬의 모든 Text/Container 덤프 + DOM 내 X 요소 탐색
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
  const createBtn = p.getByText("캐릭터 생성", { exact: false }).first();
  if ((await createBtn.count()) > 0) await createBtn.click().catch(() => {});
  await p.waitForTimeout(400);
  const ni = p.locator('input[placeholder*="캐릭터 이름"]').first();
  if ((await ni.count()) > 0) {
    await ni.fill("X프로브");
    await p.getByRole("button", { name: /다음 — 외형 선택/ }).first().click().catch(() => {});
    await p.waitForTimeout(300);
    await p.getByRole("button", { name: /모험가로 생성!/ }).first().click().catch(() => {});
    await p.waitForTimeout(800);
  }
  await p.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const t = btns.find((x) => /이 캐릭터로 시작/.test(x.textContent || "")) || btns.find((x) => /시작/.test(x.textContent || ""));
    if (t) t.click();
  });
  await p.waitForTimeout(9000);

  /* 인트로 스킵 시도 (스페이스 연타) */
  for (let i = 0; i < 12; i++) {
    await p.keyboard.press("Space");
    await p.waitForTimeout(350);
  }
  await p.waitForTimeout(2500);

  const dump = await p.evaluate(() => {
    const g = window.__SERTZ__;
    if (!g || !g.game) return { err: "no __SERTZ__" };
    const scene = g.game.scene.getScene("world");
    if (!scene) return { err: "no world scene" };
    const out = { texts: [], containers: 0, sprites: [] };
    const list = scene.children.list;
    for (const o of list) {
      if (o.type === "Text") {
        out.texts.push({ x: Math.round(o.x), y: Math.round(o.y), text: (o.text || "").slice(0, 40), depth: o.depth, alpha: +o.alpha.toFixed(2), visible: o.visible, scroll: o.scrollFactorX });
      } else if (o.type === "Container") {
        out.containers++;
        for (const c of o.list || []) {
          if (c.type === "Text") {
            out.texts.push({ x: Math.round(c.x), y: Math.round(c.y), text: (c.text || "").slice(0, 40), depth: c.depth, inContainer: o.type, visible: c.visible, scroll: c.scrollFactorX });
          }
        }
      }
    }
    return out;
  });
  console.log(JSON.stringify(dump, null, 1));

  /* DOM 내 X 정확 매칭 */
  const domX = await p.evaluate(() => {
    const res = [];
    const walk = (el) => {
      for (const c of el.children) walk(c);
      const t = (el.textContent || "").trim();
      if (t === "X" && el.children.length === 0) {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        res.push({ tag: el.tagName, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), cls: (el.className || "").toString().slice(0, 120), font: cs.fontSize, visible: cs.display !== "none" });
      }
    };
    walk(document.body);
    return res;
  });
  console.log("DOM X nodes:", JSON.stringify(domX, null, 1));

  await p.screenshot({ path: "/tmp/probe_x_full.png" });
  await browser.close();
})().catch((e) => { console.error("PROBE FAIL", e); process.exit(1); });
