/* diag_world_entry.js — v1.4.14 월드 진입 프리즈 진단 (자동 리뷰 라운드)
 *  타이틀 → 게임시작 → 캐릭터생성(테스터2) → 월드진입 → 응답성/에러 감시 */
const { chromium } = require("playwright");

(async () => {
  const exe = "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome";
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: exe });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 200)));
  p.on("console", (m) => {
    if (m.type() === "error") errs.push("CONSOLE: " + m.text().slice(0, 160));
  });

  const step = (n, t) => console.log(`[${n}] ${t} @${new Date().toISOString().slice(11, 19)}`);

  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  step(1, "페이지 로드");
  await p.waitForSelector("text=게임 시작", { timeout: 40000 });
  step(2, "타이틀 도달");

  await p.getByText("게임 시작", { exact: false }).first().click();
  await p.waitForTimeout(2000);
  step(3, "게임 시작 클릭");

  // 기존 캐릭터가 있으면 재사용, 없으면 생성
  const hasStart = await p.getByText("이 캐릭터로 시작").first().isVisible().catch(() => false);
  if (!hasStart) {
    await p.getByText("캐릭터 생성").first().click();
    await p.waitForTimeout(1500);
    await p.getByPlaceholder("캐릭터 이름 (최대 8자)").fill("진단봇");
    await p.getByText("다음 — 직업 선택").click();
    await p.waitForTimeout(1200);
    await p.getByText("전사", { exact: false }).first().click();
    await p.getByText("다음 — 외형 선택").click();
    await p.waitForTimeout(1200);
    await p.getByText("남캐").first().click();
    await p.waitForTimeout(800);
    await p.getByText("전사로 생성!").click();
    await p.waitForTimeout(2000);
    step(4, "캐릭터 생성 완료");
  } else {
    step(4, "기존 캐릭터 재사용");
  }

  await p.getByText("이 캐릭터로 시작").first().click();
  step(5, "월드 진입 클릭 — 응답성 감시 시작");

  // 30초간 2초 간격 evaluate로 응답성 체크 (프리즈 감지)
  let frozenAt = -1;
  for (let i = 1; i <= 15; i++) {
    const alive = await Promise.race([
      p.evaluate(() => ({ t: Date.now(), url: location.href, canvases: document.querySelectorAll("canvas").length })),
      new Promise((res) => setTimeout(() => res(null), 4000)),
    ]);
    if (!alive) { frozenAt = i; step(6, `프리즈 감지! ${i * 2}초 시점 evaluate 무응답`); break; }
    if (i % 3 === 0) step(6, `${i * 2}초 경과 — 응답 정상 (canvas ${alive.canvases})`);
    await p.waitForTimeout(2000);
  }

  if (frozenAt < 0) {
    step(7, "30초간 프리즈 없음 — 월드 진입 정상");
    await p.screenshot({ path: "/tmp/diag_world_ok.png" });
  } else {
    await p.screenshot({ path: "/tmp/diag_world_frozen.png" }).catch(() => console.log("스크린샷도 실패(완전프리즈)"));
  }

  console.log("pageerror:", errs.length ? errs.slice(0, 5) : "0건");
  await b.close();
})().catch((e) => { console.error("진단 스크립트 실패:", e.message); process.exit(1); });
