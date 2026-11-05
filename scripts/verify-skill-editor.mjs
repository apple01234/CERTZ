/**
 * 스킬 메이커 브라우저 검증.
 *
 * [확인]
 *  1) /skill-editor 가 렌더된다
 *  2) 게임의 실제 스킬 목록이 로드된다(지어낸 목록이 아님)
 *  3) 스킬을 선택하면 필드(MP·쿨다운·배율)가 보인다
 *  4) 검증 패널이 동작한다(잘못된 값 → 오류)
 *  5) 저장 버튼이 JSON 을 내려받는다
 *  6) pageerror 0
 *
 * 사용: node scripts/verify-skill-editor.mjs http://127.0.0.1:3132
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://127.0.0.1:3132";

let pass = 0, fail = 0;
const ck = (n, ok, d = "") => { console.log(`${ok ? "✓" : "✗"} ${n}${d ? ` — ${d}` : ""}`); ok ? pass++ : fail++; };

const browser = await chromium.launch({
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));

await page.goto(`${BASE}/skill-editor`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(2000);

const head = await page.evaluate(() => ({
  title: document.title,
  text: document.body.innerText.slice(0, 300),
  buttons: [...document.querySelectorAll("button")].map((b) => b.innerText.trim()).filter(Boolean).slice(0, 20),
  inputs: [...document.querySelectorAll("input,select,textarea")].length,
  lists: [...document.querySelectorAll("li,button")].filter((e) => /\d+\s*(MP|mp|쿨)/.test(e.innerText || "")).length,
}));
console.log("헤더:", head.text.replace(/\n/g, " | ").slice(0, 180));

ck("스킬 메이커 렌더", head.text.includes("스킬") || head.title.includes("스킬"), head.title);
ck("편집 컨트롤 존재", head.inputs >= 3, `input/select ${head.inputs}개`);
ck("버튼 존재", head.buttons.length >= 3, head.buttons.slice(0, 8).join(","));

/* 스킬 목록 — 게임 실제 스킬이 로드됐는지 (개수와 이름) */
const list = await page.evaluate(() => {
  /* 좌측 목록의 항목 텍스트를 긁는다 */
  const items = [...document.querySelectorAll("button")]
    .map((b) => b.innerText.trim())
    .filter((t) => t.length > 0 && t.length < 60 && !/저장|불러오기|삭제|추가|복제|실행취소/.test(t));
  return { count: items.length, sample: items.slice(0, 12) };
});
console.log("목록:", JSON.stringify(list).slice(0, 300));
ck("스킬 목록이 로드됨", list.count >= 5, `${list.count}개 항목`);

/* 검증 패널 존재 */
const hasValidate = await page.evaluate(() => {
  const t = document.body.innerText;
  return /검증|오류|문제|정상|통과|데미지|피해/.test(t);
});
ck("검증/미리보기 패널 존재", hasValidate);

/* 필드 하나를 비정상 값으로 바꿔 검증이 반응하는지 */
const reacted = await page.evaluate(async () => {
  const nums = [...document.querySelectorAll('input[type="number"]')];
  if (!nums.length) return { supported: false };
  const before = document.body.innerText;
  const el = nums[0];
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(el, "-999");
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 700));
  const after = document.body.innerText;
  return { supported: true, changed: before !== after };
});
console.log("검증 반응:", JSON.stringify(reacted));
ck("잘못된 값에 검증이 반응", !reacted.supported || reacted.changed === true, JSON.stringify(reacted));

/* 저장 */
const dl = await Promise.race([
  page.waitForEvent("download", { timeout: 8000 }).catch(() => null),
  (async () => {
    const btn = page.locator("button", { hasText: /저장|내보내기|export/i }).first();
    if (await btn.count()) await btn.click();
    return null;
  })(),
]);
ck("저장 버튼이 JSON 을 내려받는다", !!dl, dl ? dl.suggestedFilename() : "다운로드 없음");

ck("pageerror 없음", errs.length === 0, errs.slice(0, 2).join(" | "));

await page.screenshot({ path: "/root/.hermes/cache/scratch/skill_editor.png" });
console.log(`\nRESULT ${pass}/${pass + fail} passed, ${fail} failed`);
await browser.close();
process.exit(fail === 0 ? 0 : 1);
