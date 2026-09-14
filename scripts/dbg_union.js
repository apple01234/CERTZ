/** 디버그 — 유니온 버튼 클릭 가로막는 요소 찾기 */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  await p.addInitScript(() => {
    const now = Date.now();
    const chars = {
      c1: { id: "c1", name: "전사칠십오", cls: "warrior", lv: 75, stage: "village", cleared: false, lastSeen: now, createdAt: now, rebirths: 0 },
      c2: { id: "c2", name: "마법사예순", cls: "mage", lv: 60, stage: "village", cleared: false, lastSeen: now, createdAt: now, rebirths: 0 },
    };
    localStorage.setItem("sertz_slots_v1", JSON.stringify({ v: 1, slots: 8, activeId: null, chars }));
    localStorage.setItem("sertz_char_c1", JSON.stringify({ stage: "village", lv: 75, exp: 0, maxHp: 900, atk: 90, cleared: false, maxMp: 200, playerName: "전사칠십오", cls: "warrior", startCls: "warrior", gold: 100 }));
    localStorage.setItem("sertz_char_c2", JSON.stringify({ stage: "village", lv: 60, exp: 0, maxHp: 600, atk: 70, cleared: false, maxMp: 300, playerName: "마법사예순", cls: "mage", startCls: "mage", gold: 100 }));
    localStorage.setItem("sertz_union_v1", JSON.stringify({ v: 1, coins: 0, placements: [{ charId: "c1", rot: 0, r: 1, c: 1 }], artifacts: {}, buffs: [], lastDaily: "", raidDone: "", seenLv: 0 }));
  });
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForSelector("text=게임 시작", { timeout: 25000 });
  await p.getByRole("button", { name: /게임 시작/ }).first().click();
  await p.waitForTimeout(900);
  await p.locator("button", { hasText: "전사칠십오" }).first().dblclick();
  await p.waitForTimeout(8000);
  for (let i = 0; i < 3; i++) { await p.keyboard.press("Escape"); await p.waitForTimeout(400); }
  const btn = p.locator('[aria-label*="유니온"]').first();
  const box = await btn.boundingBox();
  console.log("union btn box:", JSON.stringify(box));
  const info = await p.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    const chain = [];
    let cur = el;
    while (cur && chain.length < 6) {
      chain.push(`${cur.tagName}.${(cur.className || "").toString().slice(0, 90)}`);
      cur = cur.parentElement;
    }
    return { at: chain, panelVisible: !!document.querySelector(".sertz-panel") };
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  console.log(JSON.stringify(info, null, 1));
  await p.screenshot({ path: "/tmp/dbg_union_block.png" });
  await b.close();
})();
/* 클릭 재시도 에러 포착 */
(async () => {})();
