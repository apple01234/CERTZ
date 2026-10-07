/**
 * e2e_vc136_classroom.js — 클래스룸 MQTT 2인 동기화 실측
 *  브라우저 A(교실 생성=host) + B(코드 참여) → 서로의 참가자 명단 동기화 확인
 */
const { chromium } = require("playwright");

(async () => {
  const base = "http://127.0.0.1:3000";
  let pass = 0, fail = 0;
  const ok = (name, cond) => { if (cond) { pass++; console.log("PASS", name); } else { fail++; console.log("FAIL", name); } };

  const browser = await chromium.launch({
    args: ["--no-sandbox"],
    executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome",
  });
  page_setup = async (name) => {
    const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    p.setDefaultTimeout(30000);
    p.on("pageerror", (e) => console.log(`[pageerror ${name}]`, String(e).slice(0, 200)));
    p.on("console", (m) => { const t = m.text(); if (t.includes("[SERTZ-cls]")) console.log(`[console ${name}]`, t.slice(0, 160)); });
    await p.goto(base, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(2500);
    await p.waitForSelector("text=게임 시작", { timeout: 30000 });
    await p.getByRole("button", { name: /게임 시작/ }).first().click();
    await p.waitForTimeout(900);
    const createBtn = p.getByText("캐릭터 생성", { exact: false }).first();
    if (await createBtn.count() > 0) await createBtn.click().catch(() => {});
    await p.waitForTimeout(400);
    const ni = p.locator('input[placeholder*="캐릭터 이름"]').first();
    if (await ni.count() > 0) {
      await ni.fill(name);
      await p.getByRole("button", { name: /다음 — 외형 선택/ }).first().click().catch(() => {});
      await p.waitForTimeout(300);
      await p.getByRole("button", { name: /모험가로 생성!/ }).first().click().catch(() => {});
      await p.waitForTimeout(800);
    }
    await p.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      const t = btns.find((x) => /이 캐릭터로 시작/.test(x.textContent || "")) || btns.find((x) => /시작/.test(x.textContent || ""));
      if (t) t.click();
    });
    await p.waitForTimeout(6000);
    const more = p.locator('button[aria-label*="더보기"]').first();
    await more.waitFor({ state: "visible", timeout: 30000 });
    await more.click();
    await p.waitForTimeout(300);
    await p.locator('button[aria-label*="클래스룸"]').first().click();
    await p.waitForTimeout(500);
    return p;
  };

  const pa = await page_setup("선생님A");
  await pa.getByRole("button", { name: /교실 생성/ }).first().click();
  await pa.waitForTimeout(2000);
  const bodyA = await pa.locator("body").innerText();
  console.log("--- bodyA ---\n" + bodyA.slice(0, 400));
  const m = bodyA.match(/\b([A-Z2-9]{6})\b/);
  const code = m ? m[1] : null;
  ok("host 코드 발급", !!code);
  console.log("room code:", code);
  if (!code) { await browser.close(); process.exit(1); }

  const pb = await page_setup("학생B");
  await pb.locator('input[placeholder*="참여 코드"]').fill(code);
  await pb.getByRole("button", { name: /참여/, exact: true }).first().click();
  /* MQTT 접속 + 하트비트 대기 */
  await pb.waitForTimeout(12000);
  const bodyB = await pb.locator("body").innerText();
  ok("B 참여 성공(코드 노출)", bodyB.includes("교실 코드"));
  ok("B 명단에 A 보임", bodyB.includes("선생님A") || bodyB.includes("참가자 2"));
  const bodyA2 = await pa.locator("body").innerText();
  ok("A 명단에 B 보임", bodyA2.includes("학생B") || bodyA2.includes("참가자 2"));

  /* 패널 안정성 관찰 — 아무 것도 하지 않고 10초 대기 후에도 열려 있는지 */
  await pb.waitForTimeout(10000);
  const bodyB1 = await pb.locator("body").innerText();
  ok("B 패널 10초 관찰 후에도 유지", bodyB1.includes("클래스룸"));

  /* host: 학급 토벌전 시작 → B에도 cfg 동기화 */
  const clickOk = await pa.getByRole("button", { name: /학급 토벌전/ }).first().click({ timeout: 5000 }).then(() => true).catch((e) => { console.log("click err:", e.message.slice(0, 120)); return false; });
  ok("host 활동 시작 클릭", clickOk);
  await pa.waitForTimeout(5000);
  const bodyA3 = await pa.locator("body").innerText();
  console.log("--- bodyA after click --- HAS_PANEL:", bodyA3.includes("학급 토벌전"), "HAS_PROGRESS:", bodyA3.includes("/"), "\n" + bodyA3.slice(-350));
  const bodyB2 = await pb.locator("body").innerText();
  console.log("--- bodyB2 --- 학급토벌전:", bodyB2.includes("학급 토벌전"), "클래스룸:", bodyB2.includes("클래스룸"), "교실코드:", bodyB2.includes("교실 코드"), "진행바:", bodyB2.includes("전원의 킬이 합산"), "\n--- B 전체 본문 ---\n" + bodyB2);
  ok("B에서 학급 토벌전 진행 바 동기화", bodyB2.includes("학급 토벌전") && bodyB2.includes("/"));

  await pb.screenshot({ path: "/home/z/my-project/scripts/vc136_classroom_b.png" });
  await pa.screenshot({ path: "/home/z/my-project/scripts/vc136_classroom_a.png" });
  await browser.close();
  console.log(`\nRESULT: ${pass} pass / ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
})();
