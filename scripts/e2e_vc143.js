/**
 * e2e_vc143.js — 피드백 9종 검증:
 *  ① 퀘스트 곡선 실측 (forest1 초반 5~8 유지 / hel1 중반 100+ / 반복의뢰 100+)
 *  ② 눈맵 프리즈 근본 수정 — niflheim1 앰비언트 블룸 미부착 + applyFxMode 복원 경로 재부착 차단
 *     + 대조군 forest1은 복원 시 블룸 부착 (게이트가 눈맵만 막는지 확인)
 *  ③ 공유 보스 릴레이 스모크 (netBossMsg emit 무예외) + perf 훅
 *  ④ 선택형 대화 UI (dialogue:show choices → 버튼 렌더 → dialogue:choice 수신)
 *  ⑤ 화면 크기 대응 아이콘 (1920 → 공격 버튼 확대 / 390 → 기본 크기)
 *  ⑥ pageerror 0
 */
const { chromium } = require("playwright");

(async () => {
  const base = "http://127.0.0.1:3000";
  let pass = 0, fail = 0;
  const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("PASS", name, extra); } else { fail++; console.log("FAIL", name, extra); } };
  const errors = [];

  const browser = await chromium.launch({
    args: ["--no-sandbox"],
    executablePath: "/home/z/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome",
  });
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  p.setDefaultTimeout(40000);
  p.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));

  /* ── 1) 부팅 + 월드 진입 ── */
  await p.goto(base, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
  await p.waitForSelector("text=게임 시작", { timeout: 40000 });
  await p.getByRole("button", { name: /게임 시작/ }).first().click();
  await p.waitForTimeout(900);
  const createBtn = p.getByText("캐릭터 생성", { exact: false }).first();
  if ((await createBtn.count()) > 0) await createBtn.click().catch(() => {});
  await p.waitForTimeout(400);
  const ni = p.locator('input[placeholder*="캐릭터 이름"]').first();
  if ((await ni.count()) > 0) {
    await ni.fill("피드백테스터");
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
  await p.waitForTimeout(8000);

  const jump = async (stage) => {
    await p.evaluate((stage) => {
      const g = window.__SERTZ__.game;
      const ws = g.scene.getScene("world");
      const data = g.registry.get("initData") || {};
      ws.scene.restart({ stage, save: data.save, fresh: data.fresh });
    }, stage);
    await p.waitForTimeout(7000);
  };
  const worldInfo = () => p.evaluate(() => {
    const ws = window.__SERTZ__.game.scene.getScene("world");
    const auto = (ws.stageDef.quests || []).find((q) => q.id && q.id.endsWith("-auto-hunt"));
    return {
      key: ws.stageDef.key,
      ambientBloom: ws.ambientFilters ? ws.ambientFilters.length : -1,
      autoNeed: auto ? auto.need : null,
      autoTitle: auto ? auto.title : null,
      repeatNeed: ws.stageDef.repeat ? ws.stageDef.repeat.need : null,
    };
  });

  /* ── 2) 퀘스트 곡선 실측 ── */
  await jump("forest1");
  const f1 = await worldInfo();
  ok("forest1 초반 퀘스트 마릿수 유지(5~14)", f1.autoNeed >= 5 && f1.autoNeed <= 14, `${f1.key} auto=${f1.autoNeed}(${f1.autoTitle}) repeat=${f1.repeatNeed}`);
  await jump("hel1");
  const h1 = await worldInfo();
  ok("hel1 중반 퀘스트 마릿수 100+(#3)", h1.autoNeed >= 100, `${h1.key} auto=${h1.autoNeed}(${h1.autoTitle})`);
  ok("hel1 반복의뢰 100+(#3)", h1.repeatNeed >= 100, `repeat=${h1.repeatNeed}`);

  /* ── 3) 눈맵 블룸 게이트 (#1) ── */
  await jump("niflheim1");
  const n1 = await worldInfo();
  ok("niflheim1(눈맵) 부팅 시 앰비언트 블룸 미부착", n1.ambientBloom === 0, `ambient=${n1.ambientBloom}`);
  /* 크래시 경로 재현 — fx 절전→복원 사이클 */
  const snowAfterCycle = await p.evaluate(() => {
    const ws = window.__SERTZ__.game.scene.getScene("world");
    try { ws.applyFxMode(0); ws.applyFxMode(1); } catch (e) { return { err: String(e).slice(0, 80) }; }
    return { ambient: ws.ambientFilters.length };
  });
  ok("눈맵 fx 복원 사이클 후에도 블룸 재부착 차단", snowAfterCycle && !snowAfterCycle.err && snowAfterCycle.ambient === 0, JSON.stringify(snowAfterCycle));
  /* 대조군 — 울창한 숲은 복원 시 블룸 정상 부착 */
  await jump("forest1");
  const forestCycle = await p.evaluate(() => {
    const ws = window.__SERTZ__.game.scene.getScene("world");
    try { ws.applyFxMode(0); ws.applyFxMode(1); } catch (e) { return { err: String(e).slice(0, 80) }; }
    return { ambient: ws.ambientFilters.length };
  });
  ok("대조군 forest1은 fx 복원 시 블룸 정상 부착", forestCycle && !forestCycle.err && forestCycle.ambient > 0, JSON.stringify(forestCycle));

  /* ── 4) 공유 보스 릴레이 스모크 (#4) + perf 훅 ── */
  const bossSmoke = await p.evaluate(() => {
    try {
      const net = window.__SERTZ_NET__;
      net && net.emit && net.emit("boss", { n: 12345 });   // bdmg 경로
      net && net.emit && net.emit("boss", { hp: 500, max: 1000 }); // bhp 경로
    } catch (e) { return { err: String(e).slice(0, 80) }; }
    const perf = window.__SERTZ_PERF__;
    return { ok: true, fps: perf ? perf.fps : null };
  });
  ok("공유 보스 릴레이 emit 무예외 + perf 훅", bossSmoke && !bossSmoke.err && bossSmoke.fps > 0, JSON.stringify(bossSmoke));

  /* ── 5) 선택형 대화 UI (#10) ── */
  /* choices는 마지막 줄 타이핑 완료 시 렌더 — 단일 줄 대사로 즉시 마지막 줄 진입 */
  await p.evaluate(() => {
    const EB = window.__SERTZ_EB__;
    window.__e2eChoice = null;
    EB.once("dialogue:choice", (m) => { window.__e2eChoice = m && m.id; });
    EB.emit("dialogue:show", {
      speaker: "심연의 퇴장 관리인",
      lines: ["한 줄 테스트 대사"],
      choices: [{ label: "E2E 나가기", id: "e2e_leave" }, { label: "계속", id: "e2e_stay" }],
    });
  });
  await p.waitForTimeout(500);
  /* fps 16 환경에선 22ms 타이퍼가 수 초로 늘어진다 — 여유 20s 대기 */
  let btnCount = 0;
  try {
    await p.waitForSelector('button:has-text("E2E 나가기")', { timeout: 20000, state: "visible" });
    btnCount = 1;
  } catch { /* 미렌더 */ }
  if (btnCount > 0) await p.locator('button:has-text("E2E 나가기")').first().click().catch(() => {});
  await p.waitForTimeout(700);
  const choiceResult = await p.evaluate(() => ({ id: window.__e2eChoice }));
  ok("선택형 대화 — 버튼 렌더 + dialogue:choice 수신(#10)", btnCount > 0 && choiceResult.id === "e2e_leave", `btns=${btnCount} ${JSON.stringify(choiceResult)}`);
  /* 대사창 닫기 */
  await p.evaluate(() => window.__SERTZ_EB__.emit("dialogue:hide"));

  /* ── 6) 화면 크기 대응 아이콘 (#7) ── */
  const atkWidth = async () => {
    await p.waitForTimeout(900);
    return p.evaluate(() => {
      const b = document.querySelector('button[aria-label="공격"]');
      return b ? Math.round(b.getBoundingClientRect().width) : null;
    });
  };
  await p.setViewportSize({ width: 1920, height: 1080 });
  const wBig = await atkWidth();
  await p.setViewportSize({ width: 390, height: 844 });
  const wSmall = await atkWidth();
  ok("넓은 화면(1920) 공격 버튼 확대(≥150px)", wBig >= 150, `w=${wBig}`);
  ok("모바일(390) 공격 버튼 기본 크기 유지(90~130px)", wSmall >= 90 && wSmall <= 130, `w=${wSmall}`);

  ok("pageerror 0", errors.length === 0, errors.join(" | ").slice(0, 200));

  console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
