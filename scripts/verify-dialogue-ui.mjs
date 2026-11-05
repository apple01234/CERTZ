/**
 * vc250 (지시 #5) — 대화창 UI 실측.
 *
 * 확인:
 *  1) 대화창에 조작 설명문이 없다("건너뛰기"/"꾹 누르면" 등)
 *  2) 진행 표시가 문장이 아니라 기호(▸/✕)다
 *  3) 타이핑 커서가 ▌(텍스트 커서 문자)가 아니다
 *  4) 키보드로 대화가 실제로 진행된다(문구만 바꾸고 조작이 깨지지 않았는지)
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://127.0.0.1:3108";
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

let pass = 0, fail = 0;
const check = (n, c, d = "") => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${d ? " — " + d : ""}`); } };

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.locator("button", { hasText: "게임 시작" }).first().click({ timeout: 120000 });
await page.getByRole("button", { name: "캐릭터 생성", exact: true }).first().click();
await page.locator("input").first().fill("대사" + String(Date.now()).slice(-4));
await page.getByRole("button", { name: /다음/ }).click();
await page.getByRole("button", { name: "모험가로 생성!" }).click({ timeout: 30000 });
await page.getByRole("button", { name: "이 캐릭터로 시작" }).click({ timeout: 30000 });
await page.waitForFunction(() => window.__SERTZ_SCENE__?.player, { timeout: 90000 });

/* 대화를 강제로 띄운다 — 마을 오프닝 대사 */
const opened = await page.evaluate(() => {
  const s = window.__SERTZ_SCENE__;
  try { s.showDialogueOnce?.("villageIntro"); return true; } catch { return false; }
});
await page.waitForTimeout(1600);

const snap = async () => page.evaluate(() => {
  /* 대화창 특정: 화자 이름표(.game-btn) + 본문 문단을 가진 game-panel.
   *  [함정] .game-panel 을 텍스트로만 찾으면 퀘스트 트래커/패널도 걸린다
   *  ("Space" 가 목표 설명에 들어 있어 오탐). 구조로 판별한다. */
  const panels = [...document.querySelectorAll(".game-panel")];
  const box = panels.find((p) => p.querySelector(".game-btn") && p.querySelector("p"));
  const txt = box ? (box.textContent || "") : "";
  /* 화자 이름표만 따로 */
  const speaker = box?.querySelector(".game-btn")?.textContent?.trim() || "";
  return {
    found: !!box,
    speaker,
    text: txt.replace(/\s+/g, " ").trim().slice(0, 220),
    /* 조작 설명문은 "본문 영역"에서만 검사한다(다른 패널 텍스트 배제) */
    hasSkipWords: /건너뛰기|꾹 누르면|스페이스·탭으로 닫기/.test(txt),
    hasArrow: /[▸✕]/.test(txt),
    hasEditorCursor: txt.includes("▌"),
  };
});

/* 타이핑이 끝난 뒤에 기호를 검사한다 — 타이핑 중에는 커서만 보이는 게 정상 */
await page.waitForTimeout(3000);
let s = await snap();
check("대화창이 열렸다", opened && s.found, JSON.stringify({ opened, found: s.found }));
check("화자가 표시된다", s.speaker.length > 0, s.speaker);
check("조작 설명문 없음", !s.hasSkipWords, s.text.slice(0, 120));
check("진행 표시가 기호(▸/✕)", s.hasArrow, s.text.slice(0, 140));
check("텍스트 편집기 커서(▌) 없음", !s.hasEditorCursor);

/* 타이핑 완료까지 기다린 뒤 Space 로 진행 */
await page.waitForTimeout(2600);
const before = await snap();
await page.keyboard.press("Space");
await page.waitForTimeout(900);
const after = await snap();
check("Space 로 대화가 진행된다", before.text !== after.text, `before≠after: ${before.text.slice(0, 40)} → ${after.text.slice(0, 40)}`);

/* 초상화가 텍스트 높이에 맞춰 늘어났는지 — self-stretch */
const stretch = await page.evaluate(() => {
  const img = document.querySelector(".game-panel img");
  const box = img?.closest("div");
  if (!box) return null;
  const cs = getComputedStyle(box);
  return { alignSelf: cs.alignSelf, h: box.getBoundingClientRect().height };
});
check("초상화 프레임이 stretch 정렬", !!stretch && stretch.alignSelf === "stretch", JSON.stringify(stretch));

check("페이지 오류 0", errors.length === 0, errors.slice(0, 2).join(" | "));
console.log(`\nRESULT ${pass}/${pass + fail} passed, ${fail} failed`);
await browser.close();
process.exit(fail === 0 ? 0 : 1);
