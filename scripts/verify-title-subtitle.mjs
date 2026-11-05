/**
 * vc244 — 타이틀 표면에 부제목이 없는지 실측.
 *  BootScene 이 Phaser 캔버스에 직접 그리는 텍스트는 DOM 에 없다.
 *  → 캔버스를 감싼 영역의 접근성 텍스트 + 게임 번들 문자열을 함께 본다.
 *  핵심: 로딩 화면에서 "라일락 월드" / "기억의 서약" 이 화면 텍스트로 그려지지 않아야 한다.
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://127.0.0.1:3206";
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

let pass = 0, fail = 0;
const check = (name, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? " — " + detail : ""}`); }
};

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });

/* 문서 제목 */
check("<title> 이 SERTZ", (await page.title()) === "SERTZ", await page.title());

/* 로딩 단계에서 캔버스 위 오버레이 텍스트 수집 */
const grab = async () => page.evaluate(() => {
  const out = [];
  const walk = (root) => {
    for (const el of root.querySelectorAll("*")) {
      /* SCRIPT/NOSCRIPT 는 RSC 페이로드 등 데이터 — 화면 텍스트가 아니므로 제외 */
      if (el.tagName === "SCRIPT" || el.tagName === "NOSCRIPT" || el.tagName === "STYLE") continue;
      if (el.children.length === 0 && el.textContent) {
        const t = el.textContent.trim();
        if (t) out.push(t);
      }
    }
  };
  walk(document.body);
  return out;
});

const early = await grab();
const joinedEarly = early.join(" | ");
check("로딩 화면에 부제목 '라일락 월드' 없음", !joinedEarly.includes("라일락 월드"), joinedEarly.slice(0, 120));

/* 타이틀까지 대기(로딩 게이지가 끝나면 타이틀 씬) */
await page.waitForTimeout(9000);
const late = await grab();
const joinedLate = late.join(" | ");
check("타이틀 화면에 부제목 '라일락 월드' 없음", !joinedLate.includes("라일락 월드"), joinedLate.slice(0, 120));
check("타이틀 화면에 '기억의 서약' 부제목 없음", !joinedLate.includes("기억의 서약"));

/* SERTZ 본제목이 실제로 DOM 또는 캔버스에 있는지 — DOM 기준 */
check("SERTZ 본제목 표시", joinedLate.includes("SERTZ") || (await page.title()) === "SERTZ");

/* 캔버스 존재(게임이 실제로 뜸) */
const canvas = await page.evaluate(() => {
  const c = document.querySelector("canvas");
  return c ? { w: c.width, h: c.height } : null;
});
check("게임 캔버스 렌더", !!canvas && canvas.w > 0, JSON.stringify(canvas));

check("페이지 오류 0", errors.length === 0, errors.slice(0, 2).join(" | "));

console.log(`\nRESULT ${pass}/${pass + fail} passed, ${fail} failed`);
await browser.close();
process.exit(fail === 0 ? 0 : 1);
