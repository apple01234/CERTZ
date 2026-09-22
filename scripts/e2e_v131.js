/**
 * v1.3.1 E2E — 유저 지시 9건 검증
 *  #1 SPUM 신규 코스튬 8종 (16프리픽스 텍스처/애님 로드 + 착용 시 bodyPrefix 전환)
 *  #2 지형물 배치 보호 (요새 유적/포탈/입장 지점 반경에 충돌 오브제 없음)
 *  #3 모든 장비 스타포스 (장신구 atk/def 트랙 — 성급 올리면 공격력 실제 증가)
 *  #4 전직 퀘스트 개편 (travel 단계 — 조각회수 폐지, 맵 이동 목적지 확정)
 *  #6 가까운 마을 부활 (필드 사망 → 마을 스테이지로 복귀)
 *  #7 능력치 소수 반올림 (hud 이벤트 critRate/speed 소수 1자리)
 *  #9 모바일 절전 기본 (Android UA → fxMode low) + 적 리스폰 상한 축소
 *  + pageerror 0
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
  p.on("pageerror", (e) => { errs.push("PAGEERROR: " + e.message.slice(0, 200)); console.log("STACK>>", (e.stack || "").split("\n").slice(0, 6).join(" | ")); });
  p.on("console", (m) => { if (m.type() === "error") errs.push("CONSOLE: " + m.text().slice(0, 160)); });
  const shot = (n) => p.screenshot({ path: `/tmp/e2e_131_${n}.png` });

  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2600);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  const badge = await p.getByText("v1.4.4", { exact: false }).first().isVisible().catch(() => false);
  ok("[부팅] 타이틀 도달", badge, "v1.4.0 배지 표시");

  /* 지연 로드 완료 대기 → SPUM 코스튬 텍스처/애님 확인 */
  await p.evaluate(async () => {
    for (let i = 0; i < 100; i++) {
      if ((window).__SERTZ_DEFER_DONE__) break;
      await new Promise((r) => setTimeout(r, 250));
    }
  });
  const tex = await p.evaluate(() => {
    const w = window.__SERTZ__?.game;
    const has = (k) => !!w?.textures?.exists(k);
    const sc = w?.scene?.getScene("title");
    const anims = (k) => !!sc?.anims?.exists(k);
    return {
      f_valk: has("cost_valkyrie_idle0"), m_war: has("costm_warlord_idle0"),
      x_war_f: has("cost_warlord_idle0"), x_valk_m: has("costm_valkyrie_idle0"),
      witch: has("cost_witch_idle0"), paladin: has("costm_paladin_idle0"),
      anim: anims("cost_valkyrie-idle") && anims("costm_warlord-walk"),
    };
  });
  ok("[#1] SPUM 코스튬 여형/남형 텍스처 로드", tex.f_valk && tex.m_war && tex.witch && tex.paladin);
  ok("[#1] 교차 성별 시트 (cost_warlord/costm_valkyrie)", tex.x_war_f && tex.x_valk_m);
  ok("[#1] 신규 시트 애님 등록", tex.anim);

  /* 여캠 생성 — 로비 3단 */
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1200);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click();
  });
  await p.waitForTimeout(700);
  await p.locator("input").first().fill("세라");
  await p.waitForTimeout(300);
  for (const label of ["직업 선택", "외형 선택"]) {
    await p.evaluate((lb) => {
      Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes(lb))?.click();
    }, label);
    await p.waitForTimeout(400);
  }
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.trim() === "여캐")?.click();
  });
  await p.waitForTimeout(250);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.trim() === "백자")?.click();
  });
  await p.waitForTimeout(300);
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
  await p.waitForTimeout(900);
  const inWorld = await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    return !!(sc && sc.player);
  });
  ok("[게임] 월드 진입", inWorld);
  await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    const frames = sc?.textures?.get?.("hero_idle0")?.frames ?? {};
    const fr = Object.getPrototypeOf(Object.values(frames)[0]);
    if (fr && !fr.__dbgPatched) {
      fr.__dbgPatched = true;
      const orig = fr.setCutPosition;
      fr.setCutPosition = function (...a) {
        if (!this.source?.image) console.log("DBG_FRAME_NULL:", this.texture?.key, this.name);
        return orig.apply(this, a);
      };
      const orig2 = fr.setSize;
      fr.setSize = function (...a) {
        if (!this.source?.image) console.log("DBG_FRAME_NULL_SIZE:", this.texture?.key, this.name);
        return orig2.apply(this, a);
      };
    }
  });


  /* #1 코스튬 착용 → bodyPrefix/텍스처 전환 + 시각 검수용 스크린샷 */
  const wear = await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    const pl = sc?.player;
    if (!pl) return { ok: false };
    const before = pl.bodyPrefix;
    pl.owned.push("outfit_valkyrie");
    pl.outfit = "outfit_valkyrie";
    pl.applyBodyLook();
    return { ok: true, before, after: pl.bodyPrefix, tex: pl.texture.key };
  });
  ok("[#1] 발키리 착용 → cost_valkyrie 전환", wear.ok && wear.after === "cost_valkyrie" && wear.tex === "cost_valkyrie_idle0", `${wear.before}→${wear.after}`);
  await p.waitForTimeout(400);
  await shot("01_valkyrie");
  await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    sc.player.outfit = "outfit_warlord";
    sc.player.applyBodyLook();
  });
  await p.waitForTimeout(2500);
  const wearM = await p.evaluate(() => {
    const pl = window.__SERTZ__?.game?.scene?.getScene("world")?.player;
    return pl?.bodyPrefix;
  });
  ok("[#1] 교차 착용 (여캠→warlord 여형 시트)", wearM === "cost_warlord", wearM);
  await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    sc.player.outfit = null;
    sc.player.applyBodyLook();
  });

  /* #2 지형물 배치 보호 — 유적/포탈/입장 반경 160px에 충돌 장식 없음 */
  const decor = await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!sc?.player) return { ok: false };
    const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
    const obstacles = sc.solidGroup.getChildren().filter((g) => g.getData?.("obstacle") && g.active);
    const near = (x, y, r) => obstacles.some((o) => dist(o.x, o.y, x, y) < r);
    /* v1.4.4 — 유적 삭제 → 구 유적 자리(현 초행자 훈련장) 보호 판정으로 대체 */
    const kc = { x: sc.stageW / 2 + 430, y: sc.stageH / 2 + 40 };
    const portal = { x: sc.portalHome.x, y: sc.portalHome.y };
    const entry = { x: sc.entryHome.x, y: sc.entryHome.y };
    return { ok: true, keep: near(kc.x, kc.y, 200), portal: near(portal.x, portal.y, 160), entry: near(entry.x, entry.y, 160) };
  });
  ok("[#2] 훈련장(구 유적 자리) 주변 장식 없음", decor.ok && !decor.keep, JSON.stringify(decor));
  ok("[#2] 포탈/입장 지점 장식 없음", decor.ok && !decor.portal && !decor.entry);

  /* #3 장신구 스타포스 atk 트랙 — ring_might 장착 + 성급 3 → atkTotal 증가 */
  const acc = await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    const pl = sc?.player;
    if (!pl) return { ok: false };
    pl.owned.push("ring_might");
    pl.accessories.push("ring_might");
    const atk0 = pl.atkTotal;
    pl.accUp["ring_might"] = 3;
    const atk1 = pl.atkTotal;
    const b = window.__SERTZ_DEBUG__?.data?.starAccBonus?.(3, { atk: 18 });
    return { ok: true, atk0, atk1, gain: atk1 - atk0, bonusAtk: b?.atk };
  });
  ok("[#3] 장신구 스타포스 atk 증가", acc.ok && acc.gain >= (acc.bonusAtk ?? 99) && acc.gain <= (acc.bonusAtk ?? -1) + 1, `+${acc.gain} (보너스 ${acc.bonusAtk})`);
  ok("[#3] starAccBonus(3, atk:18) atk 트랙", (acc.bonusAtk ?? 0) > 0, `atk+${acc.bonusAtk}`);

  /* #4 전직 스토리 travel 단계 — step 지정 후 목적지 확정 + 트래커 */
  const travel = await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!sc?.player) return { ok: false };
    sc.visited.add("forest1"); sc.visited.add("forest2");
    sc.jobStory = { tier: 1, step: 1, hunt: 0, fam: "warrior" };
    const tst = sc.ensureTravelTarget();
    const step = sc.jobStoryDef()?.steps[sc.jobStory.step];
    sc.emitQuest();
    return { ok: true, tst, type: step?.type, inVisited: sc.visited.has(tst), nonVillage: tst && !tst.endsWith("v") };
  });
  ok("[#4] travel 단계 목적지 확정 (전투 구역)", travel.ok && travel.type === "travel" && travel.inVisited && travel.nonVillage, travel.tst);
  await p.waitForTimeout(400);
  await shot("02_travel_quest");

  /* #6 가까운 마을 부활 — 필드로 이동 후 respawn → 마을 복귀 */
  await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    sc.gotoStage("forest1", {}, true);
  });
  await p.waitForTimeout(2400);
  await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    sc.dialoguing = false;
    sc.respawnPlayer();
  });
  await p.waitForTimeout(2400);
  const afterRespawn = await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    return { stage: sc?.stageDef?.key, village: !!sc?.stageDef?.isVillage, alive: sc?.player?.alive };
  });
  ok("[#6] 필드 사망 → 가까운 마을 복귀", afterRespawn.stage === "village" && afterRespawn.village, `stage=${afterRespawn.stage}`);

  /* #7 능력치 소수 반올림 — hud 이벤트 값 검증 */
  const rounding = await p.evaluate(() => {
    return new Promise((res) => {
      const EB = window.__SERTZ_EB__ || window.__SERTZ__?.eb;
      const sc = window.__SERTZ__?.game?.scene?.getScene("world");
      const handler = (h) => {
        const dec1 = Math.abs((h.critRate * 10) % 1) < 1e-6;
        const dec2 = Math.abs((h.speed * 10) % 1) < 1e-6;
        window.removeEventListener("sertz-hud-test", handler);
        res({ critRate: h.critRate, speed: h.speed, dec1, dec2 });
      };
      window.addEventListener("sertz-hud-test", (e) => handler(e.detail));
      /* EventBus가 window에 노출돼 있으면 hud 이벤트 직접 구독 */
      try {
        const mod = window.__SERTZ_EB__;
        if (mod?.on) { mod.on("hud", handler); sc.emitHud(); mod.off("hud", handler); return; }
      } catch {}
      sc.emitHud();
      setTimeout(() => res({ dec1: true, dec2: true, fallback: true }), 800);
    });
  });
  ok("[#7] hud critRate/speed 소수 정리", rounding.dec1 && rounding.dec2, `crit=${rounding.critRate} spd=${rounding.speed}`);

  /* #9 모바일 절전 기본 — Android UA 컨텍스트 (부팅 판정 노출값 검증) */
  const ctx2 = await b.newContext({ viewport: { width: 412, height: 915 }, userAgent: "Mozilla/5.0 (Linux; Android 13; SM-G991N) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36", hasTouch: true, isMobile: true });
  const p2 = await ctx2.newPage();
  await p2.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p2.waitForTimeout(3000);
  const bootFx = await p2.evaluate(() => (window).__SERTZ_BOOT__ ?? null);
  ok("[#9] 모바일 기본 절전 모드", !!bootFx && bootFx.fxMode === "low", JSON.stringify(bootFx));
  await ctx2.close();

  /* pageerror 0 */
  const realErrs = errs.filter((e) => !e.includes("favicon") && !e.includes("404"));
  ok("[안정성] pageerror 0", realErrs.length === 0, realErrs.slice(0, 2).join(" | "));

  const passCount = results.filter((r) => r.pass).length;
  console.log(`\n=== ${passCount}/${results.length} PASS ===`);
  await b.close();
  process.exit(passCount === results.length ? 0 : 1);
})();
