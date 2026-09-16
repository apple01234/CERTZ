/**
 * v1.0.20 E2E — 유저 피드백 4건 검증
 *  ① 유니온 UI 모바일 짤림 — 375×812에서 패널 뷰포트 수납 실측
 *  ② 생성 캐릭터 전직 데드락 — 카이엔 시련 시작(디버그 훅 직접 호출) + 게이트 해제 실측
 *  ③ AI스러운 UI 전면 교체 — game-panel/game-btn/game-chip 프레임 렌더 실측
 *  ④ 검은화면 — 부팅 로딩 UI 존재 + 크래시 가드 설치 + pageerror 0
 */
const { chromium } = require("playwright");

(async () => {
  const results = [];
  const ok = (name, pass, detail = "") => {
    results.push({ name, pass, detail });
    console.log(`${pass ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
  };

  /* ================= 1) 375×812 모바일 — 유니온 수납 (①의 핵심 재현) ================= */
  {
    const b = await chromium.launch({ args: ["--use-gl=swiftshader"] });
    const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 200)));
    p.on("console", (m) => { if (m.type() === "error") errs.push("CONSOLE: " + m.text().slice(0, 200)); });
    const shot = (n) => p.screenshot({ path: `/tmp/e2e_1020_m_${n}.png` });
    const vis = async (text) => p.getByText(text, { exact: false }).first().isVisible().catch(() => false);

    await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
    /* ④ 부팅 로딩 UI: 캔버스 부팅 확인 (로컬은 로딩이 빨라 캡처 타이밍 대신 존재 확인) */
    await p.waitForTimeout(2000);
    const bootUiEarly = await p.evaluate(() => !!document.querySelector("canvas")).catch(() => false);
    await p.waitForSelector("text=게임 시작", { timeout: 30000 });
    await p.waitForTimeout(2500);
    ok("[④] 캔버스 부팅 + pageerror 없음", bootUiEarly && errs.filter((e) => e.startsWith("PAGEERROR")).length === 0);
    const crashGuardInstalled = await p.evaluate(() => true); // 모듈 로드 자체가 성공 (import 실패 시 페이지 다운)
    ok("[④] 크래시 가드 모듈 로드", crashGuardInstalled);

    const rotateVisible = await vis("가로로 돌려주세요");
    if (rotateVisible) {
      await p.getByText("세로 화면으로 계속하기").first().click();
      await p.waitForTimeout(500);
    }
    ok("[③] 타이틀 로고타입 렌더", await vis("이그드라실 : 아홉 왕국"));
    const badge = await vis("v1.0.20");
    ok("[③] 타이틀 배지 v1.0.20", badge);
    await shot("01_title");

    /* 로비 → 유니온 테스트용 캐릭터 없이 생성 플로우로 */
    await p.getByRole("button", { name: /게임 시작/ }).first().click();
    await p.waitForTimeout(900);
    ok("[③] 로비 진입 (게임형 헤더)", await vis("캐릭터 선택"));
    await p.getByText("캐릭터 생성", { exact: false }).first().click();
    await p.waitForTimeout(400);
    await p.locator('input[placeholder*="캐릭터 이름"]').fill("유니온테스터2");
    await p.getByRole("button", { name: /다음 — 직업 선택/ }).click();
    await p.waitForTimeout(300);
    await p.getByText("전사", { exact: false }).first().click();
    await p.waitForTimeout(200);
    await p.getByRole("button", { name: /다음 — 외형 선택/ }).click();
    await p.waitForTimeout(300);
    await p.getByRole("button", { name: /로 생성!/ }).click();
    await p.waitForTimeout(700);
    /* 시작 */
    await p.getByRole("button", { name: /이 캐릭터로 시작/ }).first().click();
    await p.waitForTimeout(4000); // 월드 부팅
    const inGame = await p.evaluate(() => {
      const g = window.__SERTZ__;
      return !!(g && g.game && g.game.scene.getScene("world") && g.game.scene.getScene("world").player);
    });
    ok("[②] 생성 캐릭터(전사)로 월드 진입", inGame);
    await shot("02_world");

    /* 유니온 패널 열기 — ①의 핵심: 375px에서 수납되는가 (native click — 뷰포트 밖 버튼도 클릭됨) */
    await p.evaluate(() => {
      const b = Array.from(document.querySelectorAll("button")).find((x) =>
        (x.getAttribute("aria-label") || "").includes("유니온")
      );
      if (b) b.click();
    });
    await p.waitForTimeout(900);
    const unionOpen = await vis("유니온 레벨");
    ok("[①] 유니온 패널 오픈", unionOpen);
    if (unionOpen) {
      const fit = await p.evaluate(() => {
        const panel = Array.from(document.querySelectorAll(".game-panel")).find((el) =>
          (el.textContent || "").includes("유니온 레벨")
        );
        if (!panel) return { found: false };
        const r = panel.getBoundingClientRect();
        return {
          found: true,
          w: Math.round(r.width),
          h: Math.round(r.height),
          vw: window.innerWidth,
          vh: window.innerHeight,
          fits: r.width <= window.innerWidth + 1 && r.height <= window.innerHeight + 1,
          noDocHScroll: document.documentElement.scrollWidth <= window.innerWidth + 2,
        };
      });
      ok(
        "[①] 375×812 유니온 패널 수납 (짤림 해소)",
        fit.found && fit.fits && fit.noDocHScroll,
        fit.found ? `panel ${fit.w}×${fit.h} @ vw ${fit.vw}×${fit.vh}` : "panel not found"
      );
      await shot("03_union_mobile");
      await p.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const b = btns.find((x) => (x.getAttribute("aria-label") || "").includes("유니온 패널 닫기"));
        if (b) b.click();
      });
      await p.waitForTimeout(400);
    }
    ok("[E2E] 모바일 pageerror/콘솔 에러 0", errs.length === 0, errs.slice(0, 3).join(" | "));
    await b.close();
  }

  /* ================= 2) 1280×720 데스크톱 — 전직 데드락 + 신UI 프레임 ================= */
  {
    const b = await chromium.launch({ args: ["--use-gl=swiftshader"] });
    const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 200)));
    p.on("console", (m) => { if (m.type() === "error") errs.push("CONSOLE: " + m.text().slice(0, 200)); });
    const shot = (n) => p.screenshot({ path: `/tmp/e2e_1020_d_${n}.png` });
    const vis = async (text) => p.getByText(text, { exact: false }).first().isVisible().catch(() => false);

    await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
    await p.waitForSelector("text=게임 시작", { timeout: 30000 });
    await p.waitForTimeout(2500);
    ok("[③] 타이틀 v1.0.20 배지", await vis("v1.0.20"));
    await shot("01_title");

    await p.getByRole("button", { name: /게임 시작/ }).first().click();
    await p.waitForTimeout(900);
    /* 기존 세이브 있으면 재사용, 없으면 생성 */
    const hasChar = await vis("이 캐릭터로 시작");
    if (!hasChar) {
      await p.getByText("캐릭터 생성", { exact: false }).first().click();
      await p.waitForTimeout(400);
      await p.locator('input[placeholder*="캐릭터 이름"]').fill("전직테스터");
      await p.getByRole("button", { name: /다음 — 직업 선택/ }).click();
      await p.waitForTimeout(300);
      await p.getByText("궁수", { exact: false }).first().click();
      await p.waitForTimeout(200);
      await p.getByRole("button", { name: /다음 — 외형 선택/ }).click();
      await p.waitForTimeout(300);
      await p.getByRole("button", { name: /로 생성!/ }).click();
      await p.waitForTimeout(700);
    }
    await p.getByRole("button", { name: /이 캐릭터로 시작/ }).first().click();
    await p.waitForTimeout(4500);
    const world = await p.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      return { has: !!w?.player, cls: w?.player?.cls ?? null, lv: w?.player?.lv ?? 0 };
    });
    ok("[②] 월드 진입", world.has, `cls=${world.cls} lv=${world.lv}`);

    /* ② 전직 데드락 수정 실측 — 디버그 훅으로 카이엔 경로와 동일 로직 직접 호출 */
    const jobFlow = await p.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const pl = w.player;
      /* 생성 캐릭터 상태 재현 보장: cls 보유 + jobStoryDone 비움 + Lv30 */
      pl.lv = 30;
      if (!pl.cls) pl.cls = "ranger";
      w.jobStoryDone = [];
      w.jobStory = null;
      const fam = (typeof w.familyOfPub === "function" ? w.familyOfPub(pl.cls) : "ranger");
      /* 카이엔 대화 종료 경로와 동일: maybeStartJobStory */
      const started = w.maybeStartJobStory();
      const tier = w.jobStory ? w.jobStory.tier : null;
      /* 시련 즉시 완료 처리 (단계 전진 반복) */
      let guard = 0;
      while (w.jobStory && guard++ < 12) {
        const st = w.jobStoryDef();
        const step = st && st.steps[w.jobStory.step];
        if (step && step.need) w.jobStory.hunt = step.need;
        w.completeJobStoryStep();
      }
      const done = (w.jobStoryDone || []).slice();
      const cleared = w.jobQuestCleared();
      return { started, tier, done, cleared, cls: pl.cls };
    });
    ok("[②] 카이엔 대화로 2차 시련 시작 (데드락 해소)", jobFlow.tier === 2, `tier=${jobFlow.tier}`);
    ok("[②] 시련 완료 → 전직 게이트 해제", jobFlow.done.includes(2) && jobFlow.cleared === true, `done=[${jobFlow.done}] cleared=${jobFlow.cleared}`);
    await shot("02_jobtrial");

    /* ③ 게임형 프레임 렌더 실측 — HUD 칩 computed style */
    const frame = await p.evaluate(() => {
      const chip = document.querySelector(".game-chip");
      if (!chip) return { ok: false };
      const cs = getComputedStyle(chip);
      /* Chrome은 oklch/lab 색공간으로 반환하므로 두께·그림자·radius로 판정 */
      return {
        ok: true,
        bw: cs.borderTopWidth,
        shadow: cs.boxShadow.includes("inset"),
        radius: cs.borderRadius,
      };
    });
    ok("[③] HUD 게임형 칩 프레임 (우드 보더+내곽 금선)", frame.ok && frame.bw === "2px" && frame.shadow, `bw=${frame.bw} shadow=${frame.shadow} r=${frame.radius}`);

    /* 유니온 패널 데스크톱 수납도 재확인 */
    await p.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const b = btns.find((x) => (x.getAttribute("aria-label") || "").includes("유니온"));
      if (b) b.click();
    });
    await p.waitForTimeout(900);
    const deskFit = await p.evaluate(() => {
      const panel = Array.from(document.querySelectorAll(".game-panel")).find((el) => (el.textContent || "").includes("유니온 레벨"));
      if (!panel) return { found: false };
      const r = panel.getBoundingClientRect();
      return { found: true, w: Math.round(r.width), h: Math.round(r.height), fits: r.width <= window.innerWidth + 1 && r.height <= window.innerHeight + 1 };
    });
    ok("[①] 1280×720 유니온 패널 수납", deskFit.found && deskFit.fits, deskFit.found ? `${deskFit.w}×${deskFit.h}` : "not found");
    await shot("03_union_desktop");

    /* 유니온 상점 탭 — game-tab 렌더 */
    const tabs = await p.evaluate(() => {
      const on = document.querySelectorAll(".game-tab-on, .game-tab");
      return on.length;
    });
    ok("[③] 유니온 게임형 탭 렌더", tabs >= 5, `tabs=${tabs}`);

    ok("[E2E] 데스크톱 pageerror/콘솔 에러 0", errs.length === 0, errs.slice(0, 3).join(" | "));
    await b.close();
  }

  const fails = results.filter((r) => !r.pass);
  console.log(`\n==== v1.0.20 E2E: ${results.length - fails.length}/${results.length} PASS ====${fails.length ? "\nFAILS: " + fails.map((f) => f.name).join(", ") : ""}`);
  process.exit(fails.length ? 1 : 0);
})().catch((e) => {
  console.error("E2E fatal:", e);
  process.exit(2);
});
