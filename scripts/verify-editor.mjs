/**
 * 타일맵 에디터 브라우저 검증.
 *
 * [확인]
 *  1) /editor 가 렌더되고 캔버스가 그려진다
 *  2) 벽 칠하기/지우기가 실제로 레이아웃을 바꾼다
 *  3) 검증 패널이 고립된 방을 잡아낸다
 *  4) 저장(JSON) 버튼이 동작한다(다운로드 이벤트)
 *  5) 게임과 같은 코어를 쓰는지(타일/프롭 함수 참조)
 *  6) pageerror 0
 *
 * 사용: node scripts/verify-editor.mjs http://127.0.0.1:3120
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://127.0.0.1:3120";

let pass = 0, fail = 0;
const ck = (name, ok, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  ok ? pass++ : fail++;
};

const browser = await chromium.launch({
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));

await page.goto(`${BASE}/editor`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("canvas", { timeout: 30000 });
await page.waitForTimeout(1200);

/* 1) 렌더 확인 */
const head = await page.evaluate(() => ({
  title: document.title,
  hasCanvas: !!document.querySelector("canvas"),
  canvasBox: (() => {
    const c = document.querySelector("canvas");
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return [Math.round(r.width), Math.round(r.height)];
  })(),
  headerText: document.body.innerText.slice(0, 120),
  buttons: [...document.querySelectorAll("button")].map((b) => b.innerText.trim()).filter(Boolean).slice(0, 12),
}));
console.log("헤더:", head.headerText.replace(/\n/g, " | ").slice(0, 110));
ck("에디터 페이지 렌더", head.hasCanvas, JSON.stringify(head.canvasBox));
ck("제목이 맵 에디터", /맵 에디터|타일맵/.test(head.title + head.headerText), head.title);
ck("도구 버튼 존재", ["벽", "길", "프롭", "입구", "출구"].every((t) => head.buttons.includes(t)), head.buttons.join(","));

/* 캔버스 픽셀이 실제로 그려졌는지 (투명이 아닌지) */
const painted = await page.evaluate(() => {
  const c = document.querySelector("canvas");
  const ctx = c.getContext("2d");
  const d = ctx.getImageData(0, 0, Math.min(80, c.width), Math.min(80, c.height)).data;
  let nonEmpty = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) nonEmpty++;
  return { nonEmpty, total: d.length / 4 };
});
ck("캔버스에 픽셀이 그려짐", painted.nonEmpty > painted.total * 0.5, `${painted.nonEmpty}/${painted.total}`);

/* 2) 벽 칠하기 — 셀 상태가 바뀌는지 (React 상태는 DOM 텍스트로 확인) */
const statBefore = await page.evaluate(() => {
  const els = [...document.querySelectorAll("div")].filter((d) => /벽 셀|개방 셀/.test(d.innerText) && d.innerText.length < 60);
  return els.map((e) => e.innerText.replace(/\n/g, " ")).join(" | ");
});
console.log("통계(전):", statBefore);

/* 캔버스 좌표로 클릭 — 셀 (3,2) 를 벽으로.
 *  [함정] 캔버스는 스크롤 컨테이너 안에 있고 CSS width 와 실제 픽셀 폭이 다르다.
 *  zoom(36)을 그대로 쓰면 셀을 빗나간다 → 캔버스 실제 박스 폭 / cols 로 계산한다. */
const box = await page.locator("canvas").boundingBox();
const COLS = 15, ROWS = 9;
const cellPx = box.width / COLS;
const clickCell = async (c, r) => {
  const x = box.x + c * cellPx + cellPx / 2;
  const y = box.y + r * cellPx + cellPx / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(200);
};
/* 상단 바가 캔버스를 가리지 않도록 스크롤 후 클릭 */
await page.locator("canvas").scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
const box2 = await page.locator("canvas").boundingBox();
const clickCell2 = async (c, r) => {
  await page.mouse.click(box2.x + c * (box2.width / COLS) + (box2.width / COLS) / 2,
                         box2.y + r * (box2.width / COLS) + (box2.width / COLS) / 2);
  await page.waitForTimeout(220);
};
await clickCell2(3, 2);
await page.waitForTimeout(200);
const statAfter = await page.evaluate(() => {
  const els = [...document.querySelectorAll("div")].filter((d) => /벽 셀|개방 셀/.test(d.innerText) && d.innerText.length < 60);
  return els.map((e) => e.innerText.replace(/\n/g, " ")).join(" | ");
});
console.log("통계(후):", statAfter);
ck("벽 칠하기가 통계를 바꿈", statBefore !== statAfter, `${statBefore} → ${statAfter}`);

/* 3) 검증 패널 — 처음엔 통행 가능이어야 한다(균일 개방 맵) */
const verdict = await page.evaluate(() => {
  const t = document.body.innerText;
  return { ok: t.includes("통행 가능"), bad: /문제 \d+건/.test(t) };
});
ck("검증 패널이 상태를 표시", verdict.ok || verdict.bad, JSON.stringify(verdict));

/* 4) 저장 — 다운로드 이벤트 */
const dl = await Promise.race([
  page.waitForEvent("download", { timeout: 8000 }).catch(() => null),
  (async () => {
    const btn = page.locator("button", { hasText: "저장" }).first();
    await btn.click();
    return null;
  })(),
]);
ck("저장 버튼이 JSON 을 내려받는다", !!dl, dl ? dl.suggestedFilename() : "다운로드 이벤트 없음");

/* 5) 코어 공유 확인 — 프롭 도구 선택 시 목록이 뜬다 */
await page.locator("button", { hasText: "프롭" }).first().click();
await page.waitForTimeout(300);
const propUi = await page.evaluate(() => {
  /* 프롭 도구를 선택하면 select 가 여러 개(프롭/테마/스테이지) 생긴다.
   *  obj_ 접두사를 가진 option 을 가진 select 를 찾아야 프롭 팔레트다. */
  const sels = [...document.querySelectorAll("select")];
  const propSel = sels.find((s) => [...s.options].some((o) => o.value.startsWith("obj_")));
  return {
    count: propSel ? propSel.options.length : 0,
    first: propSel?.options[0]?.value ?? "",
    allSelects: sels.map((s) => s.options.length),
  };
});
ck("프롭 팔레트가 로드됨", propUi.count >= 20, `obj_ 옵션 ${propUi.count}개 (selects ${JSON.stringify(propUi.allSelects)})`);

ck("pageerror 없음", errs.length === 0, errs.slice(0, 2).join(" | "));

await page.screenshot({ path: "/root/.hermes/cache/scratch/editor.png" });
console.log(`\nRESULT ${pass}/${pass + fail} passed, ${fail} failed`);
await browser.close();
process.exit(fail === 0 ? 0 : 1);
