/**
 * "몬스터 사망 시 타일맵이 나타난다" 재현/판정 프로브.
 *
 * [접근] 화면 픽셀을 비교하는 대신 **렌더 리스트를 직접 센다.**
 *  적 사망 전/후로 타일맵 레이어(rea:ground / rea:paths / rea:structures)의
 *  visible·alpha·depth·tintAlpha 가 바뀌는지, 그리고 씬의 렌더 오브젝트 수가
 *  바뀌는지 본다. 타일맵이 "나타났다"면 반드시 이 중 하나가 변한다.
 */
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://127.0.0.1:3100";
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader"] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));

const snap = () => page.evaluate(() => {
  const s = window.__SERTZ_SCENE__;
  const layers = (s.children.list || [])
    .filter((o) => typeof o.name === "string" && o.name.startsWith("rea:"))
    .map((o) => ({
      name: o.name,
      depth: o.depth,
      visible: o.visible,
      alpha: Number((o.alpha ?? 1).toFixed(3)),
      type: o.type,
      // 타일맵 레이어는 layer.data 로 타일 배열을 갖는다
      tiles: o.layer?.data?.length ?? null,
      tintAlpha: o.tintAlpha ?? null,
    }));
  /* 사망 후 새로 생긴 오브젝트를 이름/타입으로 남긴다 — "타일맵이 나타났다"의 정체 */
  const all = (s.children.list || []).map((o) => ({
    n: typeof o.name === "string" && o.name ? o.name : (o.type + (o.text ? ":" + String(o.text).slice(0, 18) : "")),
    t: o.type,
    d: Number((o.depth ?? 0).toFixed(2)),
    v: o.visible,
  }));
  return {
    layers,
    childCount: all.length,
    names: all.map((x) => x.n),
    enemies: s.getAllTargets().length,
  };
});

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.locator("button", { hasText: "게임 시작" }).first().click({ timeout: 120000 });
await page.getByRole("button", { name: "캐릭터 생성", exact: true }).first().click();
await page.locator("input").first().fill("타일" + String(Date.now()).slice(-4));
await page.getByRole("button", { name: /다음/ }).click();
await page.getByRole("button", { name: "모험가로 생성!" }).click({ timeout: 30000 });
await page.getByRole("button", { name: "이 캐릭터로 시작" }).click({ timeout: 30000 });
await page.waitForFunction(() => window.__SERTZ_SCENE__?.player, { timeout: 90000 });
await page.evaluate(() => {
  const s = window.__SERTZ_SCENE__;
  for (const o of [...s.children.list]) if (o.text === "건너뛰기") o.emit("pointerdown");
  s.tutorialDone = true; s.tutStep = -1;
});
await page.evaluate(() => window.__SERTZ_SCENE__.startTransition("howlrstone1x2"));
await page.waitForFunction(() => {
  const s = window.__SERTZ_SCENE__;
  return s?.stageDef?.key === "howlrstone1x2" && !s.transitioning;
}, { timeout: 60000 });
await page.waitForTimeout(2500);

const before = await snap();
console.log("BEFORE", JSON.stringify(before, null, 1));

/* 적 3마리를 실제로 죽인다 */
const killInfo = await page.evaluate(async () => {
  const s = window.__SERTZ_SCENE__;
  const list = s.getAllTargets().slice(0, 3);
  const killed = [];
  for (const e of list) {
    try {
      e.takeDamage?.(999999, s.player, {});
      killed.push(e.def?.key ?? e.constructor?.name ?? "?");
    } catch (err) {
      killed.push("ERR:" + String(err).slice(0, 40));
    }
  }
  await new Promise((r) => setTimeout(r, 1200));
  return { killed, remaining: s.getAllTargets().length };
});
console.log("KILLED", JSON.stringify(killInfo));

const after = await snap();
console.log("AFTER", JSON.stringify(after, null, 1));

/* 비교 */
const diffs = [];
for (const b of before.layers) {
  const a = after.layers.find((x) => x.name === b.name);
  if (!a) { diffs.push(`${b.name} 레이어가 사라짐`); continue; }
  if (a.visible !== b.visible) diffs.push(`${b.name} visible ${b.visible}→${a.visible}`);
  if (a.alpha !== b.alpha) diffs.push(`${b.name} alpha ${b.alpha}→${a.alpha}`);
  if (a.depth !== b.depth) diffs.push(`${b.name} depth ${b.depth}→${a.depth}`);
  if (a.tiles !== b.tiles) diffs.push(`${b.name} tiles ${b.tiles}→${a.tiles}`);
}
const added = after.layers.filter((a) => !before.layers.some((b) => b.name === a.name));
if (added.length) diffs.push(`새 rea: 레이어 ${added.map((x) => x.name).join(",")}`);
if (after.childCount !== before.childCount) diffs.push(`childCount ${before.childCount}→${after.childCount}`);
/* 새로 등장한 오브젝트 이름 */
const newNames = after.names.filter((n) => !before.names.includes(n));
if (newNames.length) diffs.push(`새 오브젝트: ${newNames.join(", ")}`);

console.log("\n=== DIFF ===");
console.log(diffs.length ? diffs.join("\n") : "(타일맵 레이어 변화 없음)");
console.log("pageErrors:", errs.length, errs.slice(0, 2).join(" | "));

await browser.close();
