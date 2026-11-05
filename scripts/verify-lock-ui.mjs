/**
 * vc247 (지시 #11) — 레벨 잠금 UI 검증.
 *
 * [검증 방법] 레벨 1 캐릭터로 게임에 들어가 HUD 버튼들의 상태를 직접 읽는다.
 *  캔버스가 아니라 DOM 이므로 aria-label 과 svg/자물쇠 존재를 정확히 확인할 수 있다.
 *
 * 확인 항목:
 *  1) 잠긴 기능은 aria-label 에 "Lv.N에 열립니다" 가 들어간다
 *  2) 잠긴 버튼에 자물쇠(svg)가 실제로 렌더된다
 *  3) 열린 기능(가방, Lv1)에는 자물쇠가 없다
 *  4) 잠긴 버튼을 눌러도 안내창이 뜬다(막다른 느낌 없음)
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://127.0.0.1:3107";
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

let pass = 0, fail = 0;
const check = (n, c, d = "") => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${d ? " — " + d : ""}`); } };

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.locator("button", { hasText: "게임 시작" }).first().click({ timeout: 120000 });
await page.getByRole("button", { name: "캐릭터 생성", exact: true }).first().click();
await page.locator("input").first().fill("잠금" + String(Date.now()).slice(-4));
await page.getByRole("button", { name: /다음/ }).click();
await page.getByRole("button", { name: "모험가로 생성!" }).click({ timeout: 30000 });
await page.getByRole("button", { name: "이 캐릭터로 시작" }).click({ timeout: 30000 });
await page.waitForFunction(() => window.__SERTZ_SCENE__?.player, { timeout: 90000 });
/* 튜토리얼 건너뛰기 */
await page.evaluate(() => {
  const s = window.__SERTZ_SCENE__;
  for (const o of [...s.children.list]) if (o.text === "건너뛰기") o.emit("pointerdown");
  s.tutorialDone = true; s.tutStep = -1;
});
await page.waitForTimeout(1500);

/* HUD 버튼 상태 수집 — aria-label 기반 */
const hud = await page.evaluate(() => {
  const out = [];
  for (const b of document.querySelectorAll("button[aria-label]")) {
    const label = b.getAttribute("aria-label") || "";
    if (!/열립니다|열기|콘텐츠|보스|유니온|거래소|랭킹|퀘스트|가방|상점|스탯|이동|패스|원정대/.test(label)) continue;
    out.push({
      label,
      locked: label.includes("열립니다"),
      locks: b.querySelectorAll("svg").length, // 자물쇠는 svg
      dimIcon: !!b.querySelector("img.opacity-35, img.grayscale"),
    });
  }
  return out;
});
console.log("HUD 버튼:", JSON.stringify(hud.filter(h => h.locked || h.label.includes("열기")).slice(0, 10), null, 1));

const lockedBtns = hud.filter((h) => h.locked);
check("레벨1 에서 잠긴 HUD 버튼이 존재", lockedBtns.length > 0, `잠금 ${lockedBtns.length}개`);
check("잠긴 버튼이 Lv.N 사유를 표기", lockedBtns.every((h) => /Lv\d+에 열립니다/.test(h.label)), lockedBtns.map(h => h.label).join(" | ").slice(0, 160));
check("잠긴 버튼에 자물쇠 아이콘 렌더", lockedBtns.every((h) => h.locks > 0), lockedBtns.map(h => `${h.label}=svgs:${h.locks}`).join(", ").slice(0, 160));
check("잠긴 버튼의 아이콘이 딤 처리", lockedBtns.every((h) => h.dimIcon), "dim 아이콘 없음");

/* 가방(Lv1)은 열려 있어야 한다 */
const bag = hud.find((h) => /가방/.test(h.label));
check("Lv1 가방은 잠기지 않음", bag ? !bag.locked : true, bag ? bag.label : "버튼 없음");

/* 잠긴 버튼 클릭 → 안내창 */
const target = lockedBtns[0];
if (target) {
  await page.evaluate((lbl) => {
    for (const b of document.querySelectorAll("button[aria-label]")) {
      if (b.getAttribute("aria-label") === lbl) { b.click(); return; }
    }
  }, target.label);
  await page.waitForTimeout(1200);
  const notice = await page.evaluate(() => {
    const t = document.body.innerText || "";
    const m = /Lv\.?\d+에 열립니다/.exec(t);
    return { hasLockWord: t.includes("열립니다"), snippet: m ? m[0] : "", hasSvg: document.querySelectorAll("svg").length > 0 };
  });
  check("잠긴 버튼 클릭 시 안내 문구 표시", notice.hasLockWord, notice.snippet || "(문구 없음)");
  /* 닫기 */
  const ok = page.getByRole("button", { name: "확인" });
  if (await ok.count()) await ok.first().click();
  await page.waitForTimeout(400);
}

check("페이지 오류 0", errors.length === 0, errors.slice(0, 2).join(" | "));
console.log(`\nRESULT ${pass}/${pass + fail} passed, ${fail} failed`);
await browser.close();
process.exit(fail === 0 ? 0 : 1);
