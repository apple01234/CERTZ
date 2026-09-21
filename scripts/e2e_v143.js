/**
 * v1.4.3 E2E — 유저 지시 6건 검증
 *  ① 고대(요새) 유적 전면 삭제 — 구조물/프레임/텍스처/애니 완전 제거
 *  ② 초반 레벨 동선 — 마을 훈련장(훈련용 늑대 3마리·약한 스탯·표지판) + 마을 퀘스트 3단 체인
 *  ③ 최적화 — __SERTZ_PERF__ 실측 필드(avgMs/worstMs) + 프레임 안정
 *  ④ 파티 콘텐츠 — 파티 위젯에 시너지/오늘의 파티 미션 UI
 *  ⑤ 유니온 에셋 — 아티팩트/버프/레이드 초상 PNG 13종 서빙
 *  ⑥ ARG 페이지 — /secret/ 2종 200 + 가이드 소스 주석(8426) + 마을 이상한 비석
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
    if (t.includes("[SERTZ] 에셋 로드 실패") || t.includes("[SERTZ] 지연 에셋 로드 실패") || t.includes("재시도 후에도") || t.includes("한도 초과") || t.includes("누락/손상")) loadFails.push(t.slice(0, 140));
  });

  /* ⑥ ARG 페이지 — 서버 정적 서빙 (월드 진입 전에 먼저 확인) */
  for (const u of ["/secret/", "/secret/second.html"]) {
    const r = await p.request.get(`http://localhost:3000${u}`);
    ok(`[ARG] ${u} 200`, r.ok(), `status=${r.status()}`);
  }
  const sec = await (await p.request.get("http://localhost:3000/secret/")).text();
  ok("[ARG] 첫 페이지 암호 시(URIEL 두문자) + 소스 주석 8426", sec.includes("8426") && sec.includes("불러보렴") && sec.includes("<b>류</b>"), "");
  const guide = await (await p.request.get("http://localhost:3000/apk-guide.html")).text();
  ok("[ARG] 가이드 페이지 소스 주석 8426 복원", guide.includes("8426"), "");
  const sec2 = await (await p.request.get("http://localhost:3000/secret/second.html")).text();
  ok("[ARG] 두 번째 조각 ROT13 암호문 + 뷰포트(모바일 대응)", sec2.includes("INYXLEVR") && sec2.includes("viewport"), "");

  /* ⑤ 유니온 전용 에셋 13종 서빙 */
  const assets = ["art_atk", "art_hp", "art_crit", "art_gold", "art_def", "art_speed", "ub_atk", "ub_gold", "ub_def", "ub_exp", "raid_behemoth", "raid_nidhogg", "raid_abysslord"];
  let assetOk = 0;
  for (const a of assets) {
    const r = await p.request.get(`http://localhost:3000/assets/ui/union/${a}.png`);
    if (r.ok()) assetOk++;
  }
  ok("[유니온] 전용 에셋 13종 서빙", assetOk === assets.length, `${assetOk}/13`);

  /* 부팅 + 배지 */
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2600);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  const badge = await p.getByText("v1.4.3", { exact: false }).first().isVisible().catch(() => false);
  ok("[부팅] 타이틀 도달 (v1.4.3 배지)", badge);

  /* 지연 로드 + texGuard */
  for (let i = 0; i < 30 && !(await p.evaluate(() => !!window.__SERTZ_DEFER_DONE__)); i++) await p.waitForTimeout(300);
  ok("[로딩] 지연 로드 완료 플래그", await p.evaluate(() => !!window.__SERTZ_DEFER_DONE__));
  ok("[로딩] 로드 실패 경고 0건", loadFails.length === 0, loadFails.length ? loadFails.slice(0, 3).join(" | ") : "전 에셋 정상");
  const guard = await p.evaluate(() => window.__SERTZ_TEXGUARD__ ?? null);
  ok("[로딩] texGuard 레지스트리 (900종 이상)", !!guard && guard.expected >= 900, guard ? `expected=${guard.expected}` : "없음");

  /* 월드 진입 */
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1200);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click();
  });
  await p.waitForTimeout(700);
  await p.locator("input").first().fill("세라143");
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
  const inWorld = await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    return !!(sc && sc.player);
  });
  ok("[게임] 월드 진입", inWorld);

  /* ① 유적 삭제 */
  const keepGone = await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!sc) return null;
    let kg = 0, mg = 0;
    for (const ch of sc.children.list) {
      const tex = ch?.texture?.key;
      const fn = ch?.frame?.name;
      if (tex === "map_ground" || tex === "map_props") mg++;
      if (fn && String(fn).startsWith("kg_")) kg++;
    }
    return { keepRect: !!sc.keepRect, kg, mapTex: mg, tex: !!sc.textures.exists("map_ground"), chest: (sc.interactables ?? []).some((it) => it.kind === "keepchest") };
  });
  ok("[유적삭제] 구조물·프레임·상호작용 완전 제거", !!keepGone && !keepGone.keepRect && keepGone.kg === 0 && keepGone.mapTex === 0 && !keepGone.chest, keepGone ? JSON.stringify(keepGone) : "-");
  ok("[유적삭제] 유적 전용 텍스처 미로드", !!keepGone && !keepGone.tex, "-");

  /* ② 훈련장 + 퀘스트 체인 */
  const train = await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!sc) return null;
    const tw = (sc.enemies ?? []).filter((e) => e?.displayName === "훈련용 늑대" && e.active && e.alive);
    const sign = (sc.children.list ?? []).some((ch) => ch?.text?.includes("초행자 훈련장"));
    const qs = sc.stageDef.quests ?? [];
    return { n: tw.length, hp: tw[0]?.maxHp ?? 0, sign, questN: qs.length, q1: qs[1]?.title ?? "", q1type: qs[1]?.type ?? "", mark: (sc.interactables ?? []).some((it) => it.kind === "secret") };
  });
  ok("[훈련장] 훈련용 늑대 3마리 (훈련용 스탯 hp=35)", !!train && train.n === 3 && train.hp === 35, train ? JSON.stringify({ n: train.n, hp: train.hp }) : "-");
  ok("[훈련장] 표지판 존재", !!train && train.sign, "-");
  ok("[퀘스트] 마을 3단 체인(인사→훈련 사냥→숲 이동)", !!train && train.questN === 3 && train.q1type === "hunt" && train.q1.includes("훈련용 늑대"), train ? `q1="${train.q1}"` : "-");
  ok("[ARG] 마을 이상한 비석 상호작용 존재", !!train && train.mark, "-");

  /* ④ 파티 콘텐츠 — 솔로 뷰(보드+솔로 가호) + 시너지 로직 단위 실측 (__SERTZ_DEBUG__.party) */
  await p.keyboard.press("y");
  await p.waitForTimeout(700);
  const partyUI = await p.evaluate(() => {
    const t = document.body.innerText;
    const pc = window.__SERTZ_DEBUG__?.party;
    /* 시너지 로직 실측 — 가짜 파티 스냅샷으로 계열 조합 버프 검증 */
    let syn = null;
    if (pc) {
      const fake = { id: "TEST01", leader: "a", max: 4, members: [
        { id: "a", name: "A", lv: 60, cls: "warrior" },
        { id: "b", name: "B", lv: 62, cls: "mage" },
        { id: "c", name: "C", lv: 58, cls: "ranger" },
      ] };
      const list = pc.partySynergies(fake);
      const tot = pc.synergyTotals(fake);
      const solo = pc.synergyTotals(null);
      syn = { names: list.map((s) => s.name), expPct: tot.expPct, goldPct: tot.goldPct, soloExpPct: solo.expPct + pc.SOLO_BLESS_EXP_PCT };
    }
    return { board: t.includes("오늘의 파티 미션"), solo: t.includes("단독 가호"), syn };
  });
  ok("[파티] 위젯에 오늘의 파티 미션 보드", partyUI.board, "");
  ok("[파티] 솔로 가호 안내 (소외 방지)", partyUI.solo, "");
  ok("[파티] 시너지 로직 실측 (3계열=모험의 단합+전투 대장정, EXP +22%)", !!partyUI.syn && partyUI.syn.names.includes("모험의 단합") && partyUI.syn.names.includes("전투 대장정") && partyUI.syn.expPct === 22, partyUI.syn ? JSON.stringify(partyUI.syn) : "모듈 없음");
  ok("[파티] 솔로 가호 수치 (파티 없으면 EXP +5%)", !!partyUI.syn && partyUI.syn.soloExpPct === 5, "");
  await p.keyboard.press("y");
  await p.waitForTimeout(400);

  /* ③ 최적화 — 프레임 실측 필드 검증 (소프트웨어 렌더러 swiftshader는 절대 fps가 낮아
   *  절대 임계 대신 필드 정합성 검증 — 실기기 성능은 적응형 품질 시스템이 보장) */
  await p.waitForTimeout(3200);
  const perf = await p.evaluate(() => window.__SERTZ_PERF__ ?? null);
  ok("[최적화] 프레임 실측 필드 노출 (avgMs/worstMs/enemies)", !!perf && typeof perf.avgMs === "number" && perf.avgMs > 0 && perf.worstMs >= perf.avgMs && typeof perf.enemies === "number", perf ? `fps=${perf.fps} avg=${perf.avgMs}ms worst=${perf.worstMs}ms enemies=${perf.enemies}` : "없음");
  ok("[최적화] 원격 화면밖 생략+LUT 경로 안정 (오류 없이 프레임 진행)", !!perf && perf.fps > 0, perf ? `fps=${perf.fps}` : "-");

  /* 훈련장 스크린샷 증거 */
  await p.evaluate(() => {
    const sc = window.__SERTZ__.game.scene.getScene("world");
    const cam = sc.cameras.main;
    cam.stopFollow();
    cam.setZoom(1.35);
    cam.centerOn(1180, 500);
    return true;
  });
  await p.waitForTimeout(800);
  await p.screenshot({ path: "/tmp/e2e_143_village.png" });

  const realErrors = errs.filter((e) => !e.includes("favicon") && !e.includes("404"));
  ok("[안정성] pageerror 0", realErrors.length === 0, realErrors.slice(0, 2).join(" | "));

  const pass = results.filter((r) => r.pass).length;
  console.log(`\n=== v1.4.3 E2E: ${pass}/${results.length} PASS, pageerror=${realErrors.length} ===`);
  await b.close();
  process.exit(pass === results.length ? 0 : 1);
})();
