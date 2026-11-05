/**
 * 진단용 — authored 프롭의 실제 좌표·스케일·부모 구조를 덤프한다.
 * 사용: node scripts/diag-prop.mjs http://127.0.0.1:3109 howlrstone1x2
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://127.0.0.1:3109";
const STAGE = process.argv[3] || "howlrstone1x2";

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.locator("button", { hasText: "게임 시작" }).first().click({ timeout: 120000 });
await page.getByRole("button", { name: "캐릭터 생성", exact: true }).first().click();
await page.locator("input").first().fill("진단" + String(Date.now()).slice(-4));
await page.getByRole("button", { name: /다음/ }).click();
await page.getByRole("button", { name: "모험가로 생성!" }).click({ timeout: 30000 });
await page.getByRole("button", { name: "이 캐릭터로 시작" }).click({ timeout: 30000 });
await page.waitForFunction(() => window.__SERTZ_SCENE__?.player, { timeout: 90000 });
await page.evaluate(() => { const s = window.__SERTZ_SCENE__; s.dialoguing = false; });
await page.evaluate((st) => window.__SERTZ_SCENE__.startTransition(st), STAGE);
await page.waitForFunction((st) => window.__SERTZ_SCENE__?.stageDef?.key === st, STAGE, { timeout: 90000 }).catch(() => {});
await page.waitForTimeout(3000);

const dump = await page.evaluate(() => {
  const s = window.__SERTZ_SCENE__;
  /* ★ 실제 레이아웃 셀 크기 — 하드코딩하면 안 된다.
   *  howlrstone1x2 실측: cols 15 × rows 9, cellW 150.667 × cellH 131.111 (비정수!) */
  if (s.layout) {
    window.__LAY = { cols: s.layout.cols, rows: s.layout.rows, cellW: s.layout.cellW, cellH: s.layout.cellH };
  }
  const out = { stage: s?.stageDef?.key, camera: null, maps: [], props: [] };
  out.camera = { zoom: s.cameras.main.zoom, scrollX: Math.round(s.cameras.main.scrollX), scrollY: Math.round(s.cameras.main.scrollY) };
  /* 씬에 등록된 authored 레이어 정보 탐색 */
  for (const k of Object.keys(s)) {
    if (/authored|layout/i.test(k)) {
      const v = s[k];
      if (v && typeof v === "object") {
        out.maps.push({ field: k, type: Array.isArray(v) ? `array(${v.length})` : typeof v });
      }
    }
  }
  for (const o of s.children.list) {
    if (!o.name || !o.name.startsWith("rea:")) continue;
    const tex = o.texture?.key;
    const src = tex ? s.textures.get(tex).getSourceImage() : null;
    const fr = o.frame || (tex ? s.textures.get(tex).get() : null);
    out.props.push({
      name: o.name,
      x: Math.round(o.x * 10) / 10,
      y: Math.round(o.y * 10) / 10,
      scale: [Math.round(o.scaleX * 1000) / 1000, Math.round(o.scaleY * 1000) / 1000],
      display: [Math.round(o.displayWidth * 10) / 10, Math.round(o.displayHeight * 10) / 10],
      src: src ? [src.width, src.height] : null,
      frame: fr ? [fr.width, fr.height] : null,
      parent: o.parentContainer ? o.parentContainer.name || "(container)" : null,
      depth: Math.round(o.depth * 100) / 100,
      visible: o.visible, alpha: o.alpha,
    });
  }
  return out;
});

const lay = await page.evaluate(() => window.__LAY || null);
console.log("LAYOUT:", JSON.stringify(lay));
console.log(JSON.stringify({ stage: dump.stage, camera: dump.camera }, null, 1));
console.log(`\n=== rea: 노드 ${dump.props.length}개 ===`);
for (const p of dump.props) {
  if (!/prop|edge|structural/i.test(p.name)) continue;
  console.log(
    `${p.name.padEnd(42)} pos(${String(p.x).padStart(8)},${String(p.y).padStart(8)}) ` +
    `scale[${p.scale}] disp[${p.display}] src[${p.src}] frame[${p.frame}] depth ${p.depth} vis ${p.visible}`
  );
}
await browser.close();
