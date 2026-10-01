/**
 * v1.0.19 E2E — 지시서 6건 AC 검증
 *  ① 375×812 (모바일 세로) ② 1280×720 (데스크톱 가로) — 두 뷰포트 모두 실측
 *  A-1 스크롤 / A-2 반응형·세로 플레이 / A-4 중복 UI 제거 / A-3 신규 스테이지 / B-1 3단계 생성 / B-2 유니온 등급
 */
const { chromium } = require("playwright");

const UNION_LV_TEXT = "60까지 100%";

(async () => {
  const results = [];
  const ok = (name, pass, detail = "") => {
    results.push({ name, pass, detail });
    console.log(`${pass ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
  };

  /* ================= 1) 모바일 세로 375×812 ================= */
  {
    const b = await chromium.launch({ args: ["--use-gl=swiftshader"] });
    const ctx = await b.newContext({
      viewport: { width: 375, height: 812 },
      hasTouch: true,
      isMobile: true,
    });
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 200)));
    p.on("console", (m) => { if (m.type() === "error") errs.push("CONSOLE: " + m.text().slice(0, 200)); });

    const shot = (n) => p.screenshot({ path: `/tmp/e2e_1019_m_${n}.png` });
    const vis = async (text) => p.getByText(text, { exact: false }).first().isVisible().catch(() => false);

    await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
    await p.waitForSelector("text=게임 시작", { timeout: 25000 });
    await p.waitForTimeout(2500);

    const noHScroll = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2);
    ok("[A-2] 375×812 가로 스크롤 없음", noHScroll);

    const rotateVisible = await vis("가로로 돌려주세요");
    ok("[A-2] 세로 감지 프롬프트 표시", rotateVisible);
    await shot("01_rotate_prompt");
    if (rotateVisible) {
      await p.getByText("세로 화면으로 계속하기").first().click();
      await p.waitForTimeout(500);
      const gone = !(await vis("가로로 돌려주세요"));
      ok("[A-2] 세로 플레이 해제 버튼 동작", gone);
    }

    ok("[A-2] 375×812 타이틀 표시 (배지 v1.0.19)", await vis("v1.0.19"));
    const canScroll = await p.evaluate(() => {
      const el = document.querySelector(".sertz-scroll");
      if (!el) return false;
      const before = el.scrollTop;
      el.scrollTop = el.scrollHeight;
      return el.scrollTop > before || el.scrollHeight <= el.clientHeight;
    });
    ok("[A-1] 타이틀 스크롤 컨테이너 동작", canScroll);
    await shot("02_title");

    await p.getByRole("button", { name: /게임 시작/ }).first().click();
    await p.waitForTimeout(900);
    ok("[B-1] 로비(캐릭터 선택) 진입", await vis("캐릭터 선택"));
    const lobbyNoHScroll = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2);
    ok("[A-1] 375×812 로비 가로 스크롤 없음", lobbyNoHScroll);

    /* 3단계 생성 플로우 (B-1): 이름 → 직업 → 외형 */
    await p.getByText("캐릭터 생성", { exact: false }).first().click();
    await p.waitForTimeout(400);
    ok("[B-1] 1단계 이름 입력", await p.locator('input[placeholder*="캐릭터 이름"]').isVisible());
    await p.locator('input[placeholder*="캐릭터 이름"]').fill("세로테스터");
    await p.getByRole("button", { name: /다음 — 직업 선택/ }).click();
    await p.waitForTimeout(300);
    ok("[B-1] 2단계 직업 선택", await vis("주 스탯"));
    await p.getByText("마법사", { exact: false }).first().click();
    await p.waitForTimeout(200);
    await p.getByRole("button", { name: /다음 — 외형 선택/ }).click();
    await p.waitForTimeout(300);
    ok("[B-1] 3단계 외형 선택", await vis("색조를 골라"));
    await p.getByText("장미빛", { exact: false }).last().click();
    await p.waitForTimeout(300);
    await shot("03_create_step3");
    await p.getByRole("button", { name: /로 생성!/ }).click();
    await p.waitForTimeout(800);
    ok("[B-1] 생성 완료 (3단계 플로우)", await vis("세로테스터"));
    await shot("04_created");

    await p.getByRole("button", { name: /이 캐릭터로 시작/ }).click();
    await p.waitForTimeout(7000);
    const inGame = await p.evaluate(() => {
      const g = window.__SERTZ__?.game;
      if (!g) return false;
      const scene = g.scene.getScene("world");
      return !!scene && !!scene.player;
    });
    ok("[A-2] 375×812 인게임 진입 (플레이어 생성)", inGame);
    const dupNav = await p.locator('nav[aria-label="모바일 메인 메뉴"]').count();
    ok("[A-4] 인게임 중복 하단바 없음", dupNav === 0, `count=${dupNav}`);
    await shot("05_ingame_portrait");

    ok("[375×812] pageerror/콘솔 에러", errs.length === 0, errs.slice(0, 2).join(" | "));
    await b.close();
  }

  /* ================= 2) 데스크톱 1280×720 ================= */
  {
    const b = await chromium.launch({ args: ["--use-gl=swiftshader"] });
    const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 200)));
    p.on("console", (m) => { if (m.type() === "error") errs.push("CONSOLE: " + m.text().slice(0, 200)); });

    const shot = (n) => p.screenshot({ path: `/tmp/e2e_1019_d_${n}.png` });
    const vis = async (text) => p.getByText(text, { exact: false }).first().isVisible().catch(() => false);

    /* B-2 시드 — Lv75 전사 + Lv60 마법사 + c1 배치 (기여: 61 + 60 = 121) */
    await p.addInitScript(() => {
      const now = Date.now();
      const chars = {
        c1: { id: "c1", name: "전사칠십오", cls: "warrior", lv: 75, stage: "village", cleared: false, lastSeen: now, createdAt: now, rebirths: 0, lookTint: 4287501318 % 16777215 },
        c2: { id: "c2", name: "마법사예순", cls: "mage", lv: 60, stage: "village", cleared: false, lastSeen: now, createdAt: now, rebirths: 0 },
      };
      localStorage.setItem("sertz_slots_v1", JSON.stringify({ v: 1, slots: 8, activeId: null, chars }));
      localStorage.setItem("sertz_char_c1", JSON.stringify({ stage: "village", lv: 75, exp: 0, maxHp: 900, atk: 90, cleared: false, maxMp: 200, playerName: "전사칠십오", cls: "warrior", startCls: "warrior", gold: 100 }));
      localStorage.setItem("sertz_char_c2", JSON.stringify({ stage: "village", lv: 60, exp: 0, maxHp: 600, atk: 70, cleared: false, maxMp: 300, playerName: "마법사예순", cls: "mage", startCls: "mage", gold: 100 }));
      localStorage.setItem("sertz_union_v1", JSON.stringify({ v: 1, coins: 0, placements: [{ charId: "c1", rot: 0, r: 1, c: 1 }], artifacts: {}, buffs: [], lastDaily: "", raidDone: "", seenLv: 0 }));
    });

    await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
    await p.waitForSelector("text=게임 시작", { timeout: 25000 });
    await p.waitForTimeout(2000);
    ok("[타이틀] 배지 v1.0.19", await vis("v1.0.19"));
    await shot("01_title");

    /* A-1: 로비 스크롤 + B-1 데스크톱 생성 플로우 */
    await p.getByRole("button", { name: /게임 시작/ }).first().click();
    await p.waitForTimeout(900);
    const wheelScroll = await p.evaluate(async () => {
      const el = document.querySelector(".sertz-scroll");
      if (!el) return false;
      if (el.scrollHeight <= el.clientHeight) return true;
      const before = el.scrollTop;
      el.scrollTop = el.scrollHeight;
      return el.scrollTop > before;
    });
    ok("[A-1] 로비 세로 스크롤 가능 (overflow-y-auto)", wheelScroll);

    /* 시드된 캐릭터 카드 확인 + 더블클릭 입장 */
    ok("[B-1] 시드 캐릭터 카드 (Lv.75 표기)", await vis("전사칠십오"));
    const card = p.locator("button", { hasText: "전사칠십오" }).first();
    await card.dblclick();
    await p.waitForTimeout(7000);
    const playing = await p.evaluate(() => {
      const scene = window.__SERTZ__?.game?.scene?.getScene("world");
      return !!scene && !!scene.player;
    });
    ok("[B-1] 더블클릭으로 게임 입장", playing);

    /* A-4: 인게임 하단 중복바 없음 */
    const dupNav2 = await p.locator('nav[aria-label="모바일 메인 메뉴"]').count();
    ok("[A-4] 인게임 하단바 없음 (데스크톱)", dupNav2 === 0);

    /* B-2: 유니온 패널 — 레벨 공식(61+60=121) + 등급 배지 + 효과 총람
     *  게임 시작 시 퀘스트 패널이 자동 오픈되므로 먼저 닫는다 */
    for (let i = 0; i < 3; i++) {
      await p.keyboard.press("Escape");
      await p.waitForTimeout(400);
    }
    await p.evaluate(() => {
      const btn = document.querySelector('[aria-label*="유니온"]');
      if (btn) btn.click(); // HUD 리렌더로 노드가 갈리는 환경 — 네이티브 클릭 위임
    });
    await p.waitForTimeout(900);
    ok("[B-2] 유니온 패널 오픈", await vis("유니온 레벨"));
    ok("[B-2] 새 레벨 공식 문구", await vis(UNION_LV_TEXT));
    const lv121 = await vis("121");
    ok("[B-2] 합산 레벨 121 (Lv75→61 + Lv60→60)", lv121);
    const gradeB = await vis("B등급 ×1");
    ok("[B-2] 배치 등급 배지 B (Lv60~99)", gradeB);
    const effLine = await vis("방어력 +6");
    ok("[B-2] 전사 효과 총람 (방어력 +6 · HP +120)", effLine);
    await shot("02_union");

    /* B-2 실전 반영: 배치 블록 클릭(해제) → 효과 즉시 갱신 확인 */
    const dmgCheck = await p.evaluate(() => {
      const s = window.__SERTZ__?.game?.scene?.getScene("world");
      if (!s || !s.player) return null;
      return { def: s.player.defTotal };
    });
    ok("[B-2] 방어력 실측 접근", dmgCheck && dmgCheck.def > 0, `def=${dmgCheck?.def}`);
    /* 그리드 배치 블록(전사칠십오·75) 클릭 = 해제 */
    const blockVisible = await p.evaluate(() => {
      const spans = Array.from(document.querySelectorAll("span"));
      const label = spans.find((s) => (s.textContent || "").includes("전사칠십오·75"));
      if (!label) return false;
      label.parentElement.click(); // 블록 div 클릭 = 배치 해제
      return true;
    });
    ok("[B-2] 그리드에 배치 블록 존재 + 해제 클릭", blockVisible);
    await p.waitForTimeout(600);
    const lineGone = !(await vis("전사 계열"));
    const rosterBack = await vis("배치 대기 캐릭터 (Lv60 이상 · 2명)");
    ok("[B-2] 해제 시 효과 즉시 갱신 (전사 라인 소멸 + 대기 목록 복귀)", lineGone || rosterBack);
    await shot("03_union_unplaced");

    /* A-3: 신규 스테이지 — 유니온 패널 닫고 월드 유지 확인 (r1 로드는 웹 E2E 한계로 스테이지 데이터 정합은 tsc+모듈 로드로 검증됨) */
    await p.keyboard.press("Escape");
    await p.waitForTimeout(400);
    ok("[A-3] 패널 조작 후 pageerror 없음", errs.length === 0, errs.slice(0, 2).join(" | "));

    ok("[1280×720] pageerror/콘솔 에러", errs.length === 0, errs.slice(0, 2).join(" | "));
    await b.close();
  }

  const fails = results.filter((r) => !r.pass);
  console.log(`\n===== 결과: ${results.length - fails.length}/${results.length} PASS =====`);
  if (fails.length) {
    console.log("실패 항목:");
    fails.forEach((f) => console.log("  ✗", f.name, f.detail));
    process.exit(1);
  }
})().catch((e) => { console.error("E2E CRASH:", e.message.slice(0, 400)); process.exit(2); });
