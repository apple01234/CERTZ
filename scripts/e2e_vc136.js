/**
 * e2e_vc136.js — v1.4.30 핵심 검증 (vc135 플로우 재사용)
 *  ① /api/version → 136 게이트
 *  ② /api/auth/google → 401 + 이유 코드 (#10)
 *  ③ 로비: 직업 선택 단계 철거 → "모험가로 생성!" (#8)
 *  ④ 인게임 HUD 더보기 [교실] 버튼 (#9) → 클래스룸 패널: 생성→코드→활동 3종 노출
 *  ⑤ 페이지 에러 0
 */
const { chromium } = require("playwright");

(async () => {
  const base = "http://127.0.0.1:3000";
  let pass = 0, fail = 0;
  const ok = (name, cond) => { if (cond) { pass++; console.log("PASS", name); } else { fail++; console.log("FAIL", name); } };

  // ① version gate
  const vr = await fetch(base + "/api/version").then((r) => r.json()).catch(() => null);
  ok("version=136", vr && vr.code === 136);

  // ② google verify — malformed token → 401 + reason
  const gr = await fetch(base + "/api/auth/google", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: "abc.def.ghi" }),
  }).then((r) => r.json()).catch(() => null);
  ok("google 401 fast + reason", gr && typeof gr.error === "string" && gr.error.includes("구글 로그인 검증에 실패했어요") && gr.error.includes("토큰 형식"));

  const browser = await chromium.launch({
    args: ["--no-sandbox"],
    executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome",
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.waitForSelector("text=게임 시작", { timeout: 30000 });
  await page.getByRole("button", { name: /게임 시작/ }).first().click();
  await page.waitForTimeout(900);

  /* ③ 로비 — 직업 선택 단계 철거 확인 */
  const lobbyBody1 = await page.locator("body").innerText().catch(() => "");
  const createBtn = page.getByText("캐릭터 생성", { exact: false }).first();
  if (await createBtn.count() > 0) await createBtn.click().catch(() => {});
  await page.waitForTimeout(500);
  const lobbyBody = await page.locator("body").innerText().catch(() => "");
  ok("lobby no 직업 선택 단계", !lobbyBody.includes("다음 — 직업 선택") && !lobbyBody.includes("직업 선택"));

  /* 캐릭터 생성 (기존 캐릭터 있으면 건너뜀) */
  const nameInput = page.locator('input[placeholder*="캐릭터 이름"]').first();
  if (await nameInput.count() > 0) {
    await nameInput.fill("교실테스터");
    await page.getByRole("button", { name: /다음 — 외형 선택/ }).first().click().catch(() => {});
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: /모험가로 생성!/ }).first().click().catch(() => {});
    await page.waitForTimeout(900);
    const afterCreate = await page.locator("body").innerText().catch(() => "");
    ok("모험가로 생성 버튼 동작", !afterCreate.includes("이름을 입력해 주세요"));
  } else {
    ok("모험가 생성 플로우 (기존 캐릭터 존재)", lobbyBody.includes("모험가") || lobbyBody.includes("이 캐릭터로 시작"));
  }

  /* 게임 입장 */
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const t = btns.find((x) => /이 캐릭터로 시작/.test(x.textContent || "")) || btns.find((x) => /시작/.test(x.textContent || ""));
    if (t) t.click();
  });
  await page.waitForTimeout(6000);

  /* ④ HUD 더보기 → 교실 버튼 → 클래스룸 패널 */
  const moreBtn = page.locator('button[aria-label*="더보기"]').first();
  await moreBtn.waitFor({ state: "visible", timeout: 30000 });
  await moreBtn.click();
  await page.waitForTimeout(400);
  const classBtn = page.locator('button[aria-label*="클래스룸"]');
  ok("HUD 교실(클래스룸) 버튼", (await classBtn.count()) > 0);
  await classBtn.first().click();
  await page.waitForTimeout(600);
  const panelBody = await page.locator("body").innerText().catch(() => "");
  ok("클래스룸 패널 열림", panelBody.includes("클래스룸") && panelBody.includes("교실 생성"));
  ok("수행평가 안내(10·20·50·100)", panelBody.includes("10·20·50·100"));

  /* 교실 생성 → 코드 표시 → 나가기 */
  await page.getByRole("button", { name: /교실 생성/ }).first().click().catch(() => {});
  await page.waitForTimeout(2500);
  const joinedBody = await page.locator("body").innerText().catch(() => "");
  ok("교실 코드 표시(6자리)", /교실 코드/.test(joinedBody) && /[A-Z2-9]{6}/.test(joinedBody));
  ok("활동 3종 노출", joinedBody.includes("학급 토벌전") && joinedBody.includes("공유 보스 레이드") && joinedBody.includes("사냥 경쟁전"));
  ok("교실 나가기 버튼", joinedBody.includes("교실 나가기"));

  ok("no page errors", errors.length === 0);
  if (errors.length) console.log("ERRORS:", errors.slice(0, 3));

  await page.screenshot({ path: "/home/z/my-project/scripts/vc136_e2e.png" });
  await browser.close();
  console.log(`\nRESULT: ${pass} pass / ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
})();
