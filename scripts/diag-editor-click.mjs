/**
 * 에디터 클릭 진단 — 좌표·이벤트가 캔버스에 도달하는지 직접 확인.
 * 사용: node scripts/diag-editor-click.mjs http://127.0.0.1:3130
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://127.0.0.1:3130";
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on("console", (m) => { if (m.type() === "error") console.log("[err]", m.text().slice(0, 120)); });

await page.goto(`${BASE}/editor`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("canvas", { timeout: 30000 });
await page.waitForTimeout(1500);

/* 1) 캔버스 지오메트리 */
const geo = await page.evaluate(() => {
  const c = document.querySelector("canvas");
  const r = c.getBoundingClientRect();
  const cs = getComputedStyle(c);
  return {
    rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
    attr: [c.width, c.height],
    style: [c.style.width, c.style.height],
    pointerEvents: cs.pointerEvents,
    parentPE: getComputedStyle(c.parentElement).pointerEvents,
    elementAtCenter: (() => {
      const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return el ? `${el.tagName}.${String(el.className).slice(0, 30)}` : "none";
    })(),
  };
});
console.log("지오메트리:", JSON.stringify(geo));

/* 2) 통계 읽기 헬퍼 */
const stats = () => page.evaluate(() => {
  const t = document.body.innerText;
  const open = t.match(/개방 셀\s*(\d+)/)?.[1];
  const wall = t.match(/벽 셀\s*(\d+)/)?.[1];
  const props = t.match(/프롭\s*(\d+)/)?.[1];
  return { open, wall, props };
});
console.log("전:", JSON.stringify(await stats()));

/* 3) 정확한 셀 클릭 */
const box = await page.locator("canvas").boundingBox();
const COLS = 15, ROWS = 9;
const cw = box.width / COLS, ch = box.height / ROWS;
console.log(`셀 ${cw.toFixed(1)}×${ch.toFixed(1)}, box ${JSON.stringify(box)}`);

const target = { c: 3, r: 2 };
const x = box.x + target.c * cw + cw / 2;
const y = box.y + target.r * ch + ch / 2;
console.log(`클릭 좌표 (${x.toFixed(0)}, ${y.toFixed(0)})`);

/* 실제로 그 지점에 있는 요소 */
const at = await page.evaluate(([px, py]) => {
  const el = document.elementFromPoint(px, py);
  return el ? `${el.tagName}.${String(el.className).slice(0, 40)}` : "none";
}, [x, y]);
console.log("그 지점의 요소:", at);

/* pointerdown 직접 발생 (React onPointerDown 이 잡는지) */
await page.mouse.move(x, y);
await page.mouse.down();
await page.waitForTimeout(120);
const midDown = await stats();
await page.mouse.up();
await page.waitForTimeout(350);
const after = await stats();
console.log("down 직후:", JSON.stringify(midDown), "→ up 후:", JSON.stringify(after));

/* 4) 여러 셀 연속 클릭 */
for (const [c, r] of [[4, 2], [5, 2], [6, 2]]) {
  await page.mouse.click(box.x + c * cw + cw / 2, box.y + r * ch + ch / 2);
  await page.waitForTimeout(200);
}
console.log("연속 클릭 후:", JSON.stringify(await stats()));

/* 5) 이벤트 카운트 — 캔버스에 리스너가 붙었는지 */
const listeners = await page.evaluate(() => {
  const c = document.querySelector("canvas");
  /* React 는 루트에 위임하므로 캔버스 own listener 는 0 일 수 있다 — 참고값 */
  return { hasReactProps: !!Object.keys(c).find((k) => k.startsWith("__react")) };
});
console.log("listeners:", JSON.stringify(listeners));

/* 6) 화면 캡처 */
await page.screenshot({ path: "/root/.hermes/cache/scratch/editor_diag.png", clip: { x: 0, y: 0, width: 1400, height: 900 } });
await browser.close();
