/**
 * 에디터 2종 실제 동작 검증 — 운영 사이트 기준.
 * "타일맵&스킬에디터는 어디감?" 지적에 대한 실측 답변용.
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || "https://sertz.vercel.app";
let pass = 0, fail = 0;
const ck = (n, ok, d = "") => { console.log(`${ok ? "✓" : "✗"} ${n}${d ? ` — ${d}` : ""}`); ok ? pass++ : fail++; };

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });

for (const [route, label, mustSee] of [
  ["/editor", "맵 에디터", ["타일", "저장"]],
  ["/skill-editor", "스킬 메이커", ["스킬", "저장"]],
]) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
  const res = await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);

  const info = await page.evaluate(() => ({
    title: document.title,
    text: (document.body.innerText || "").slice(0, 400),
    canvas: document.querySelectorAll("canvas").length,
    buttons: [...document.querySelectorAll("button")].map((b) => (b.innerText || "").trim()).filter(Boolean).slice(0, 14),
    imgs: document.querySelectorAll("img").length,
  }));

  ck(`${label} (${route}) HTTP 200`, res?.status() === 200, String(res?.status()));
  ck(`${label} 제목`, info.title.includes("SERTZ"), info.title);
  ck(`${label} canvas 렌더`, info.canvas > 0, `canvas ${info.canvas}개`);
  ck(`${label} 버튼 존재`, info.buttons.length >= 3, `${info.buttons.length}개: ${info.buttons.slice(0, 6).join("/")}`);
  ck(`${label} pageerror 없음`, errs.length === 0, errs.slice(0, 2).join(" | "));
  for (const w of mustSee) ck(`${label} '${w}' 노출`, info.text.includes(w));

  await page.screenshot({ path: `/root/.hermes/cache/scratch/ed_${route.replace("/", "")}.png` });
  await page.close();
}

/* 게임 안에서 에디터로 가는 링크가 있는가 — 사용자가 못 찾은 이유 검증 */
const gp = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await gp.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
await gp.waitForTimeout(3000);
const links = await gp.evaluate(() =>
  [...document.querySelectorAll("a,button")].map((e) => (e.innerText || e.getAttribute("href") || "").trim()).filter((t) => t)
);
const hasEntry = links.some((t) => /에디터|메이커|editor/i.test(t));
ck("게임 화면에 에디터 진입점이 있다", hasEntry, hasEntry ? "" : "없음 — URL 직접 입력만 가능");

await browser.close();
console.log(`\nRESULT ${pass}/${pass + fail} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
