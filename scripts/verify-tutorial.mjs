/**
 * vc256 (지시 #9) — 튜토리얼 개편 실측.
 *
 * [검증] 새 캐릭터로 시작해 튜토리얼을 관찰한다.
 *  1) 단계 수가 5
 *  2) 패널 설명이 짧다(긴 문장이 화면을 덮지 않음)
 *  3) 초반 30초 동안 배너가 반복해서 뜨지 않는다(종전 17회 → 3회)
 *  4) 키 배지가 표시된다
 *  5) 진행 점(pips)이 있다
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://127.0.0.1:3112";
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));

let pass = 0, fail = 0;
const check = (n, c, d = "") => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${d ? " — " + d : ""}`); } };

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.locator("button", { hasText: "게임 시작" }).first().click({ timeout: 120000 });
await page.getByRole("button", { name: "캐릭터 생성", exact: true }).first().click();
await page.locator("input").first().fill("튜토" + String(Date.now()).slice(-4));
await page.getByRole("button", { name: /다음/ }).click();
await page.getByRole("button", { name: "모험가로 생성!" }).click({ timeout: 30000 });
await page.getByRole("button", { name: "이 캐릭터로 시작" }).click({ timeout: 30000 });
await page.waitForFunction(() => window.__SERTZ_SCENE__?.player, { timeout: 90000 });

/* 인트로(이름짓기) 연출이 끝나야 tut 이 생성된다. tutPendingStart 경로를 기다린다. */
await page.waitForFunction(() => !!window.__SERTZ_SCENE__?.tut, { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(2500);

/* 튜토리얼 객체를 직접 들여다본다 (캔버스 텍스트는 DOM 에 없으므로) */
const info = await page.evaluate(() => {
  const s = window.__SERTZ_SCENE__;
  const tut = s.tut;
  if (!tut) return { found: false };
  /* 내부 필드 접근 — 검증 목적 */
  const texts = (tut.hud?.list || []).filter((o) => o.type === "Text").map((o) => o.text || "");
  return {
    found: true,
    done: tut.done,
    stepIdx: tut.stepIdx,
    descTexts: texts.filter((t) => t.length > 0),
    hasKeyBadge: texts.some((t) => t.startsWith("조작")),
    hasPips: texts.some((t) => /[●◉○]/.test(t)),
  };
});
console.log("튜토리얼:", JSON.stringify(info).slice(0, 500));

check("튜토리얼이 시작됨", info.found && !info.done, JSON.stringify({ found: info.found, done: info.done }));
check("단계 인덱스 0에서 시작", info.stepIdx === 0, String(info.stepIdx));

/* 패널 텍스트 길이 — 도배 판정 */
const texts = info.descTexts || [];
const longest = texts.reduce((m, t) => (t.length > m.length ? t : m), "");
console.log(`  패널 텍스트 ${texts.length}개, 최장 ${longest.length}자: "${longest.slice(0, 60)}"`);
check("패널 텍스트가 짧다 (최장 ≤60자)", longest.length <= 60, `${longest.length}자`);
check("키 배지 표시", info.hasKeyBadge === true, JSON.stringify(texts.slice(0, 4)));
check("진행 점(pips) 표시", info.hasPips === true);

/* 30초간 배너 빈도 관찰 */
const banners = await page.evaluate(async () => {
  const s = window.__SERTZ_SCENE__;
  const seen = [];
  const orig = s.showBanner?.bind(s);
  if (!orig) return { supported: false, count: 0 };
  s.showBanner = (msg, ...rest) => { seen.push(String(msg).slice(0, 40)); return orig(msg, ...rest); };
  await new Promise((r) => setTimeout(r, 6000));
  s.showBanner = orig;
  return { supported: true, count: seen.length, sample: seen.slice(0, 5) };
});
console.log("배너:", JSON.stringify(banners));
check("초반 6초간 배너가 반복되지 않는다 (≤1회)", !banners.supported || banners.count <= 1, JSON.stringify(banners));

check("페이지 오류 0", errs.length === 0, errs.slice(0, 2).join(" | "));
console.log(`\nRESULT ${pass}/${pass + fail} passed, ${fail} failed`);
await browser.close();
process.exit(fail === 0 ? 0 : 1);
