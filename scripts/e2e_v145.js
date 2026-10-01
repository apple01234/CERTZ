/**
 * v1.4.5 E2E — 무한 재부팅 차단 체계 + 플레이스토어 대비 + 회귀 검증
 *  ① /api/version 1.4.5/97 + 타이틀 배지
 *  ② 지원/개인정보 페이지 + /api/support 접수
 *  ③ 이상한 비석(secret) + 보물 상자(keepchest) 상호작용 잔존
 *  ④ NPC 3명 대화 → Lv.3 (v1.4.4 onNpcTalked/grantNpcTrioLv3 회귀)
 *  ⑤ 등급업 큐브 이벤트 경로 회귀
 *  ⑥ 파티 콘텐츠 훅 (__SERTZ_DEBUG__.party)
 *  + 월드 진입 + pageerror 0
 */
const { chromium } = require("playwright");

(async () => {
  const results = [];
  const ok = (name, pass, detail = "") => {
    results.push({ name, pass });
    console.log(`${pass ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
  };
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const errs = [];
  const loadFails = [];
  p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 200)));
  p.on("console", (m) => {
    const t = m.text();
    if (m.type() === "error") errs.push("CONSOLE: " + t.slice(0, 160));
    if (t.includes("[SERTZ] 에셋 로드 실패") || t.includes("재시도 후에도") || t.includes("한도 초과") || t.includes("누락/손상")) loadFails.push(t.slice(0, 140));
  });

  const ver = await (await p.request.get("http://localhost:3000/api/version")).json();
  ok("[API] /api/version = 1.4.5 / code 97", ver.latest === "1.4.5" && ver.code === 97, `latest=${ver.latest} code=${ver.code}`);
  const sup = await p.request.post("http://localhost:3000/api/support", { data: JSON.stringify({ category: "E2E", name: "e2e", contact: "", message: "v1.4.5 E2E 접수 테스트" }), headers: { "Content-Type": "text/plain" } });
  ok("[API] /api/support 접수 200", sup.status() === 200, `status=${sup.status()}`);

  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2600);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  const badge = await p.getByText("v1.4.5", { exact: false }).first().isVisible().catch(() => false);
  ok("[부팅] 타이틀 도달 (v1.4.5 배지)", badge);

  for (let i = 0; i < 30 && !(await p.evaluate(() => !!window.__SERTZ_DEFER_DONE__)); i++) await p.waitForTimeout(300);
  ok("[로딩] 지연 로드 완료 + 실패 경고 0건", (await p.evaluate(() => !!window.__SERTZ_DEFER_DONE__)) && loadFails.length === 0, loadFails.length ? loadFails.slice(0, 2).join("|") : "");

  for (const [path, word] of [["/support", "모험자 지원센터"], ["/privacy", "개인정보처리방침"]]) {
    const pg = await ctx.newPage();
    const r = await pg.goto(`http://localhost:3000${path}`, { waitUntil: "domcontentloaded", timeout: 20000 });
    const body = await pg.textContent("body").catch(() => "");
    ok(`[페이지] ${path} 렌더 (${word})`, !!r && r.status() === 200 && body.includes(word));
    await pg.close();
  }

  /* 월드 진입 */
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1200);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click();
  });
  await p.waitForTimeout(700);
  await p.locator("input").first().fill("세라145");
  await p.waitForTimeout(300);
  for (const label of ["직업 선택", "외형 선택"]) {
    await p.evaluate((lb) => {
      Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes(lb))?.click();
    }, label);
    await p.waitForTimeout(400);
  }
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("생성!"))?.click();
  });
  await p.waitForTimeout(1400);
  await p.evaluate(() => { document.querySelector(".cursor-pointer")?.click(); });
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click();
  });
  await p.waitForTimeout(2600);
  for (let i = 0; i < 4; i++) { await p.mouse.click(640, 500); await p.waitForTimeout(400); }
  for (let i = 0; i < 30; i++) {
    const d = await p.evaluate(() => window.__SERTZ__?.game?.scene?.getScene("world")?.dialoguing);
    if (!d) break;
    await p.mouse.click(640, 500);
    await p.waitForTimeout(360);
  }
  const inWorld = await p.evaluate(() => !!(window.__SERTZ__?.game?.scene?.getScene("world")?.player));
  ok("[게임] 월드 진입", inWorld);

  /* ③ 이상한 비석 + 보물 상자 */
  const inter = await p.evaluate(() => {
    const s = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!s) return null;
    const secret = s.interactables.find((x) => x.kind === "secret");
    const chest = s.interactables.find((x) => x.kind === "keepchest");
    return { secret: !!secret, secretLabel: secret?.label ?? "", chest: !!chest, chestLabel: chest?.label ?? "" };
  });
  ok("[비석] 이상한 비석(ARG 힌트) 잔존", !!inter && inter.secret, inter?.secretLabel ?? "-");
  ok("[상자] 보물 상자(하루 1회) 잔존", !!inter && inter.chest && inter.chestLabel.includes("보물 상자"), inter?.chestLabel ?? "-");

  /* ④ NPC 3명 대화 → Lv.3 (v1.4.4 로직 회귀) */
  const lv0 = await p.evaluate(() => window.__SERTZ__?.game?.scene?.getScene("world")?.player?.lv ?? 0);
  await p.evaluate(() => {
    const s = window.__SERTZ__.game.scene.getScene("world");
    s.onNpcTalked("villager1");
    s.onNpcTalked("villager2");
    s.onNpcTalked("jobmaster");
  });
  await p.waitForTimeout(600);
  const lv1 = await p.evaluate(() => window.__SERTZ__?.game?.scene?.getScene("world")?.player?.lv ?? 0);
  ok("[진행] NPC 3명 대화 → Lv.3 자동 성장", lv0 < 3 && lv1 >= 3, `lv ${lv0} → ${lv1}`);

  /* ⑤ 등급업 큐브 이벤트 경로 */
  const tier = await p.evaluate(async () => {
    const EB = window.__SERTZ_EB__;
    const s = window.__SERTZ__.game.scene.getScene("world");
    const pl = s.player;
    pl.owned.push("tier_cube");
    const before = pl.tierUpTargets.weapon ?? 0;
    EB.emit("rpg:isekai", { action: "tierUp", slot: "weapon" });
    await new Promise((r) => setTimeout(r, 300));
    return { before, after: pl.tierUpTargets.weapon ?? 0, cubeLeft: pl.owned.filter((k) => k === "tier_cube").length };
  });
  ok("[큐브] 등급업 큐브 사용 → 무기 승급", tier.after === tier.before + 1 && tier.cubeLeft === 0, `tierUp ${tier.before}→${tier.after}`);

  /* ⑥ 파티 콘텐츠 훅 (v1.4.3 병합 유실분 복구 확인) */
  const party = await p.evaluate(() => {
    const pt = window.__SERTZ_DEBUG__?.party;
    return !!pt && typeof pt.partySynergies === "function" && typeof pt.partyBoard === "function";
  });
  ok("[멀티] 파티 콘텐츠 훅 노출", party);

  /* 안정성 */
  const realErrors = errs.filter((e) => !e.includes("favicon") && !e.includes("404"));
  ok("[안정성] pageerror 0", realErrors.length === 0, realErrors.slice(0, 2).join(" | "));

  const pass = results.filter((r) => r.pass).length;
  console.log(`\n=== v1.4.5 E2E: ${pass}/${results.length} PASS, pageerror=${realErrors.length} ===`);
  await b.close();
  process.exit(pass === results.length ? 0 : 1);
})();
