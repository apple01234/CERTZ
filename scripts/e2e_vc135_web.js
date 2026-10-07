/**
 * vc135 웹 기능 E2E — 유저 지시 3건 검증
 *  ① HUD 더보기에 파티 입구 복원 (파티 모달·공동 토벌전·미션 보드 노출)
 *  ② 채팅 [기록] 뷰 — 55개 주입 → 50개 보관 + 스크롤 활성
 *  ③ apk-guide.html — v1.0.5-beta(vc134) 링크·해시·문구 최신화
 */
const { chromium } = require("playwright");

(async () => {
  const results = [];
  const ok = (name, pass, detail = "") => {
    results.push({ name, pass });
    console.log(`${pass ? "PASS" : "FAIL"} — ${name}${pass ? "" : ` (${detail})`}`);
  };

  const b = await chromium.launch({
    executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome",
    args: ["--use-gl=swiftshader", "--no-sandbox"],
  });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 200)));
  p.on("console", (m) => { if (m.type() === "error") errs.push("CONSOLE: " + m.text().slice(0, 200)); });

  /* ===== ③ apk-guide.html ===== */
  await p.goto("http://localhost:3000/apk-guide.html", { waitUntil: "domcontentloaded" });
  const guideH1 = (await p.textContent("h1")) || "";
  const dlHref = await p.getAttribute("a.step a, a", "href");
  const guideBody = await p.content();
  ok("가이드 제목 v1.0.5-beta", /v1\.0\.5-beta/.test(guideH1), guideH1);
  ok("가이드 다운로드 링크=vc134 APK", dlHref === "https://github.com/apple01234/CERTZ/releases/download/v1.0.5-beta/SERTZ-v1.0.5-beta.apk", String(dlHref));
  ok("가이드 '웹 플레이 종료' 철거", !guideBody.includes("웹 플레이 종료"));
  ok("가이드 md5/sha1 갱신", guideBody.includes("ffae03691074eb1896c7c729d285e9c7") && guideBody.includes("dfc7b4193ac77595177239e76019b53848b19d06"));
  ok("가이드 versionCode 134", guideBody.includes("versionCode 134"));

  /* ===== 게임 부팅 (기존 검증 플로우 재사용) ===== */
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2500);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  /* 404 리소스 URL 기록 — 노이즈(분석 스크립트·favicon)와 실에셋 에러 분리 */
  const notFoundUrls = [];
  p.on("response", (r) => { if (r.status() === 404) notFoundUrls.push(r.url()); });
  await p.getByRole("button", { name: /게임 시작/ }).first().click();
  await p.waitForTimeout(900);
  await p.getByText("캐릭터 생성", { exact: false }).first().click();
  await p.waitForTimeout(400);
  await p.locator('input[placeholder*="캐릭터 이름"]').fill("멀티입구테스터");
  await p.getByRole("button", { name: /다음 — 직업 선택/ }).click();
  await p.waitForTimeout(300);
  await p.getByText("전사", { exact: false }).first().click();
  await p.waitForTimeout(200);
  await p.getByRole("button", { name: /다음 — 외형 선택|다음/ }).last().click().catch(() => {});
  await p.waitForTimeout(500);
  await p.getByRole("button", { name: /생성!/ }).first().click();
  await p.waitForTimeout(900);
  await p.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const t = btns.find((x) => /이 캐릭터로 시작/.test(x.textContent || "")) || btns.find((x) => /시작/.test(x.textContent || ""));
    if (t) t.click();
  });
  await p.waitForTimeout(5000);

  /* ===== ① HUD 파티 입구 ===== */
  const moreBtn = p.locator('button[aria-label*="더보기"]');
  await moreBtn.first().waitFor({ state: "visible", timeout: 30000 }); /* HUD 렌더 대기 (자동 대기) */
  ok("더보기 버튼 존재", (await moreBtn.count()) > 0);
  await moreBtn.first().click();
  await p.waitForTimeout(400);
  const partyBtn = p.locator('button[aria-label="파티 창 열기 (Y)"]');
  ok("HUD 더보기 파티 버튼 복원", (await partyBtn.count()) > 0);
  await partyBtn.first().click();
  await p.waitForTimeout(600);
  ok("파티 모달 열림", (await p.locator("text=파티 (최대 4인)").count()) > 0);
  ok("공동 토벌전 입장 노출", (await p.locator("text=공동 토벌전 입장").count()) > 0);
  ok("오늘의 파티 미션 노출", (await p.locator("text=오늘의 파티 미션").count()) > 0);
  await p.locator('button[aria-label="파티 창 닫기"]').click();
  await p.waitForTimeout(300);

  /* ===== ② 채팅 기록 뷰 — 55개 주입 → 50 보관 + 스크롤 ===== */
  await p.evaluate(() => {
    const eb = window.__SERTZ_EB__;
    for (let i = 1; i <= 55; i++) {
      eb.emit("chat:msg", { id: "t" + i, name: "유저" + i, text: "테스트 메시지 " + i + "번째 — 채팅 기록 보관 한도 검증용", t: Date.now() + i });
    }
  });
  await p.waitForTimeout(400);
  const logBtn = p.locator('button[aria-label="채팅 기록 열기 (최근 50개)"]');
  ok("채팅 [기록] 버튼 존재", (await logBtn.count()) > 0);
  await logBtn.first().click();
  await p.waitForTimeout(500);
  ok("채팅 기록 뷰 열림", (await p.locator("text=채팅 기록").count()) > 0);
  /* 50개 보관 — 1번(가장 오래된)은 잘리고 6번부터 존재 */
  const keptFirst = await p.locator("text=테스트 메시지 6번째").count();
  const droppedFirst = await p.locator("text=테스트 메시지 1번째").count();
  ok("50개 보관(55 중 5개 자동 잘림)", keptFirst > 0 && droppedFirst === 0, `6번존재=${keptFirst} 1번존재=${droppedFirst}`);
  const lastMsg = await p.locator("text=테스트 메시지 55번째").count();
  ok("최신 55번까지 표시", lastMsg > 0);
  /* 스크롤 실측 — overflow auto + scrollHeight > clientHeight */
  const scroll = await p.evaluate(() => {
    const el = document.querySelector(".sertz-scroll.min-h-0");
    if (!el) return null;
    const s = getComputedStyle(el);
    return { oy: s.overflowY, sh: el.scrollHeight, ch: el.clientHeight, top: el.scrollTop };
  });
  ok("기록 뷰 스크롤 활성", !!scroll && (scroll.oy === "auto" || scroll.oy === "scroll") && scroll.sh > scroll.ch, JSON.stringify(scroll));
  /* 위로 스크롤 → 오래된 메시지 보임 */
  const scrolledUp = await p.evaluate(() => {
    const el = document.querySelector(".sertz-scroll.min-h-0");
    if (!el) return false;
    el.scrollTop = 0;
    return el.scrollTop === 0;
  });
  ok("위로 스크롤 가능", scrolledUp);
  /* 하단 자동 추적 — 하단으로 복귀한 뒤 새 메시지가 오면 맨 아래 유지 (위를 읽는 중엔 시선 보존이 정답) */
  const autoFollow = await p.evaluate(() => {
    const el = document.querySelector(".sertz-scroll.min-h-0");
    if (!el) return Promise.resolve(false);
    el.scrollTop = el.scrollHeight; /* 하단 복귀 */
    const eb = window.__SERTZ_EB__;
    eb.emit("chat:msg", { id: "t56", name: "유저56", text: "자동 추적 검증 56번째", t: Date.now() + 999 });
    return new Promise((res) => setTimeout(() => {
      const atBottom = Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 60;
      res(atBottom);
    }, 300));
  });
  ok("새 메시지 하단 자동 추적", autoFollow);
  /* 시선 보존 — 위쪽을 읽는 중(위로 스크롤 상태)이면 자동 추적하지 않음 */
  const keepView = await p.evaluate(() => {
    const el = document.querySelector(".sertz-scroll.min-h-0");
    if (!el) return Promise.resolve(false);
    el.scrollTop = 0;
    const eb = window.__SERTZ_EB__;
    eb.emit("chat:msg", { id: "t57", name: "유저57", text: "시선 보존 검증 57번째", t: Date.now() + 1000 });
    return new Promise((res) => setTimeout(() => res(el.scrollTop === 0), 300));
  });
  ok("위 읽는 중 시선 보존(자동 끌기 없음)", keepView);
  await p.locator('button[aria-label="채팅 기록 닫기"]').click();
  await p.waitForTimeout(300);

  const real404 = notFoundUrls.filter((u) => !u.includes("favicon") && !u.includes("va.vercel-scripts"));
  /* "Failed to load resource 404" 콘솔분은 URL 미포함 — 실404(real404)가 비어있으면 전부 노이즈(favicon/분석스크립트) */
  const realErrs = errs.filter(
    (e) =>
      !e.includes("favicon") &&
      !e.includes("net::") &&
      !e.includes("ResizeObserver") &&
      !e.includes("emqx") &&
      !e.includes("websocket") &&
      !e.includes("Content Security Policy") && /* 로컬 전용: Vercel Analytics 스크립트 CSP */
      !e.includes("va.vercel-scripts") &&
      !(real404.length === 0 && /Failed to load resource.*404/.test(e)),
  );
  ok("실에셋 404 없음", real404.length === 0, real404.slice(0, 3).join(", "));
  ok("페이지 에러 0", realErrs.length === 0, realErrs.slice(0, 3).join(" || "));

  await p.screenshot({ path: "/home/z/my-project/scripts/e2e_vc135_web.png" });
  const np = results.filter((r) => r.pass).length;
  console.log(`\nRESULT: ${np}/${results.length} PASS`);
  await b.close();
  process.exit(np === results.length ? 0 : 1);
})();
