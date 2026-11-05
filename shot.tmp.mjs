import { chromium } from "playwright";
const b = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader"] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await p.goto("http://127.0.0.1:3100", { waitUntil: "domcontentloaded", timeout: 90000 });
await p.locator("button", { hasText: "게임 시작" }).first().click({ timeout: 120000 });
await p.getByRole("button", { name: "캐릭터 생성", exact: true }).first().click();
await p.locator("input").first().fill("샷" + String(Date.now()).slice(-4));
await p.getByRole("button", { name: /다음/ }).click();
await p.getByRole("button", { name: "모험가로 생성!" }).click({ timeout: 30000 });
await p.getByRole("button", { name: "이 캐릭터로 시작" }).click({ timeout: 30000 });
await p.waitForFunction(() => window.__SERTZ_SCENE__?.player, { timeout: 90000 });
await p.evaluate(() => { const s=window.__SERTZ_SCENE__; for(const o of [...s.children.list]) if(o.text==="건너뛰기") o.emit("pointerdown"); s.tutorialDone=true; s.tutStep=-1; });
await p.evaluate(() => window.__SERTZ_SCENE__.startTransition("howlrstone1x2"));
await p.waitForFunction(() => { const s=window.__SERTZ_SCENE__; return s?.stageDef?.key==="howlrstone1x2" && !s.transitioning; }, { timeout: 60000 });
await p.waitForTimeout(3000);
await p.screenshot({ path: "/root/.hermes/cache/scratch/tile-before.png" });
// 적 1마리만 실제로 죽인다 (과도한 데미지 금지 — 실제 전투와 같은 값)
await p.evaluate(async () => {
  const s = window.__SERTZ_SCENE__;
  const e = s.getAllTargets()[0];
  if (e) { for (let i=0;i<40 && e.alive;i++) e.takeDamage?.(30, s.player, {}); }
  await new Promise(r => setTimeout(r, 1500));
});
await p.screenshot({ path: "/root/.hermes/cache/scratch/tile-after.png" });
await b.close();
console.log("saved");
