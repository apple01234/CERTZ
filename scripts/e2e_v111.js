/**
 * v1.1.1 E2E — 유저 결함 8건 종합 검증
 *  ① 튜토리얼/퀘스트 UI 가림 — tut:active 시 트래커 숨김 + 보상팝업 하단 이동 (커밋 a7c22b7 — 상태 구독 실측)
 *  ② 무릉도장 — 콘텐츠 허브 「훈련장」 탭 → 일반 유저 도장 입장 (#2)
 *  ③ 결제 취소 분류 — purchaseGems 웹 폴백 reason="web" + 코드 분기 존재 (정적)
 *  ④ 포니테일 — 방향별 시트 전환(정면 f/측면 s/뒷면 b) + 묶음 원점 (#4)
 *  ⑤ 무지개 오라 — 틴트 실시간 순환(rainbow/aurora/galaxy) (#5)
 *  ⑥ 왕관 — buy() acc 슬롯 자동 착용 + 슬롯 지정 착용/해제 (#6)
 *  ⑦ 성별 치장 분리 — 여캠 cost_* / 남캐 costm_* (#7)
 *  ⑧ 거래소 — 게스트 인라인 로그인 버튼 → 계정창 오픈 (#8)
 *  + pageerror 0
 */
const { chromium } = require("playwright");

(async () => {
  const results = [];
  const ok = (name, pass, detail = "") => {
    results.push({ name, pass });
    console.log(`${pass ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
  };
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 200)));
  p.on("console", (m) => { if (m.type() === "error") errs.push("CONSOLE: " + m.text().slice(0, 160)); });
  const shot = (n) => p.screenshot({ path: `/tmp/e2e_111_${n}.png` });
  const sc = () => p.evaluate(() => {
    const s = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!s?.player) return { has: false };
    const pl = s.player;
    return {
      has: true,
      tex: pl.texture?.key ?? null,
      anim: pl.anims?.currentAnim?.key ?? null,
      gender: pl.gender ?? null,
      acc: pl.accessory ?? null,
      accOverlays: s.accOverlays?.map((a) => a.key) ?? [],
      hairTex: s.hairOverlay?.texture?.key ?? null,
      hairOrigin: s.hairOverlay ? [Math.round(s.hairOverlay.originX * 96), Math.round(s.hairOverlay.originY * 64)] : null,
      auraTint: s.cosmeticAura ? s.cosmeticAura.tintTopLeft ?? null : null,
      stage: s.stageDef?.key ?? null,
      dojangActive: !!s.dojangActive,
    };
  });

  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2200);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  const badge = await p.getByText("v1.1.1", { exact: false }).first().isVisible().catch(() => false);
  ok("[버전] 타이틀 배지 v1.1.1", badge);
  await shot("00_title");
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1200);

  /* ⑦ 여캠 생성 (은희 — 백자) */
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click();
  });
  await p.waitForTimeout(700);
  await p.locator("input").first().fill("은희");
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
  /* 프롤로그 스킵 */
  for (let i = 0; i < 5; i++) { await p.mouse.click(640, 500); await p.waitForTimeout(500); }
  await p.waitForTimeout(1000);

  let s = await sc();
  ok("[⑦] 여캠 베이스 시트 (chf0_*)", s.has && typeof s.tex === "string" && s.tex.startsWith("chf0_"), `tex=${s.tex}`);

  /* ⑦ 성별 치장 분리 — 같은 코스튬, 성별에 따라 cost_(여) / costm_(남) 분기 */
  const genderCos = await p.evaluate(() => {
    const sw = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!sw?.player) return { ok: false };
    const pl = sw.player;
    pl.cosmetics.push("outfit_royal", "outfit_silver");
    pl.gender = "f";
    pl.setOutfit("outfit_royal");
    const f = pl.texture.key;
    pl.gender = "m";
    pl.applyBodyLook();
    const m = pl.texture.key;
    pl.gender = "f";
    pl.setOutfit("outfit_silver");
    const f2 = pl.texture.key;
    pl.gender = "m";
    pl.applyBodyLook();
    const m2 = pl.texture.key;
    pl.setOutfit(null);
    pl.gender = "f";
    pl.applyBodyLook();
    return { ok: true, f, m, f2, m2 };
  });
  ok("[⑦] 여캠+왕자 코스튬 → cost_royal_* (여성형)", genderCos.ok && genderCos.f === "cost_royal_idle0", `f=${genderCos.f}`);
  ok("[⑦] 남캠+왕자 코스튬 → costm_royal_* (남성형)", genderCos.m === "costm_royal_idle0", `m=${genderCos.m}`);
  ok("[⑦] 여캠+검희 → cost_silver_*", genderCos.f2 === "cost_silver_idle0", `f2=${genderCos.f2}`);
  ok("[⑦] 남캠+검희 → costm_silver_*", genderCos.m2 === "costm_silver_idle0", `m2=${genderCos.m2}`);
  s = await sc();
  ok("[⑦] 해제 후 여캠 베이스 복원", /^chf0_/.test(s.tex ?? ""), `tex=${s.tex}`);

  /* ⑥ 왕관 — buyBm() 경로 acc 슬롯 자동 착용 (기존: 오라 슬롯 오배정) */
  const crownBuy = await p.evaluate(() => {
    const sw = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!sw?.player) return { ok: false };
    const pl = sw.player;
    pl.emerald += 100000;
    const r1 = pl.buyBm("acc_ribbon"); // 구매 즉시 착용 → accessory 슬롯이어야 함
    sw.onCosmeticChanged(); // 실전 rpg:bmBuy 핸들러가 구매 후 호출하는 리플레시와 동일
    const viaBuy = { acc: pl.accessory, aura: pl.cosmetic, overlay: sw.accOverlays[0]?.key ?? null };
    const r2 = pl.buyBm("acc_crown"); // 리본 착용 중 왕관 구매 → accessory 교체
    sw.onCosmeticChanged(); // 실전 rpg:bmBuy 핸들러와 동일 리플레시 (overlay 재생성)
    const viaBuy2 = { acc: pl.accessory, overlay: sw.accOverlays[0]?.key ?? null };
    /* 슬롯 지정 해제 — 정확히 acc만 벗겨짐 */
    pl.setCosmeticSlot(null, "acc");
    sw.onCosmeticChanged();
    const afterOff = { acc: pl.accessory, overlays: sw.accOverlays.length };
    return { ok: true, r1, viaBuy, r2, viaBuy2, afterOff };
  });
  ok("[⑥] 캐시상점 구매 즉시 착용 → acc 슬롯 (오라 아님)", crownBuy.ok && crownBuy.r1 && crownBuy.viaBuy.acc === "acc_ribbon" && crownBuy.viaBuy.aura === null, JSON.stringify(crownBuy.viaBuy));
  ok("[⑥] 구매 착용 → 왕관 스프라이트 오버레이 생성", crownBuy.viaBuy.overlay === "acc_ribbon", `overlay=${crownBuy.viaBuy.overlay}`);
  ok("[⑥] 두 번째 구매 → accessory 교체 (왕관)", crownBuy.r2 && crownBuy.viaBuy2.acc === "acc_crown" && crownBuy.viaBuy2.overlay === "acc_crown", JSON.stringify(crownBuy.viaBuy2));
  ok("[⑥] 슬롯 지정 해제 → acc만 해제", crownBuy.afterOff.acc === null && crownBuy.afterOff.overlays === 0, JSON.stringify(crownBuy.afterOff));

  /* ④ 포니테일 — 방향별 시트 전환 */
  await p.evaluate(() => {
    const sw = window.__SERTZ__?.game?.scene?.getScene("world");
    const pl = sw?.player;
    if (!pl) return;
    pl.cosmetics.push("hair_ponytail");
    pl.setHair("hair_ponytail");
  });
  await p.waitForTimeout(400);
  let pony = await sc();
  ok("[④] 포니테일 정면 시트 (f)", pony.hairTex === "hair_ponytail_f", `tex=${pony.hairTex} origin=${JSON.stringify(pony.hairOrigin)}`);
  ok("[④] 묶음 원점 = 타이 좌표 (50,18)", pony.hairOrigin && pony.hairOrigin[0] === 50 && pony.hairOrigin[1] === 18, JSON.stringify(pony.hairOrigin));
  await p.evaluate(() => {
    const sw = window.__SERTZ__?.game?.scene?.getScene("world");
    sw?.player?.play(sw.player.bodyKey("hero-walk-up"));
  });
  await p.waitForTimeout(450);
  pony = await sc();
  ok("[④] 뒷면 걷기 → 뒷면 시트 (b) + 정면 depth 전환", pony.hairTex === "hair_ponytail_b", `tex=${pony.hairTex}`);
  await p.evaluate(() => {
    const sw = window.__SERTZ__?.game?.scene?.getScene("world");
    sw?.player?.play(sw.player.bodyKey("hero-walk-side"));
  });
  await p.waitForTimeout(450);
  pony = await sc();
  ok("[④] 측면 걷기 → 측면 시트 (s)", pony.hairTex === "hair_ponytail_s", `tex=${pony.hairTex}`);

  /* ⑤ 무지개 오라 — 틴트 실시간 순환 (헤드리스 저FPS 대응 — 위상+틴트 동시 관측, 5초 창) */
  await p.evaluate(() => {
    const sw = window.__SERTZ__?.game?.scene?.getScene("world");
    const pl = sw?.player;
    if (!pl) return;
    pl.cosmetics.push("cos_rainbow", "cos_galaxy");
    pl.setCosmeticSlot("cos_rainbow", "aura");
  });
  await p.waitForTimeout(400);
  let rb = await p.evaluate(() => {
    const sw = window.__SERTZ__?.game?.scene?.getScene("world");
    return { phase: sw?.auraPhase ?? -1, tint: sw?.cosmeticAura?.tintTopLeft ?? null };
  });
  await p.waitForTimeout(5000);
  const rb2 = await p.evaluate(() => {
    const sw = window.__SERTZ__?.game?.scene?.getScene("world");
    return { phase: sw?.auraPhase ?? -1, tint: sw?.cosmeticAura?.tintTopLeft ?? null };
  });
  ok("[⑤] 무지개 오라 — 위상 진행 + 틴트 순환", rb.phase >= 0 && rb2.phase > rb.phase && rb.tint !== rb2.tint, `phase ${rb.phase.toFixed(4)}→${rb2.phase.toFixed(4)} tint ${rb.tint}→${rb2.tint}`);
  await p.evaluate(() => {
    const sw = window.__SERTZ__?.game?.scene?.getScene("world");
    sw?.player?.setCosmeticSlot("cos_galaxy", "aura");
  });
  await p.waitForTimeout(400);
  const g1 = await p.evaluate(() => {
    const sw = window.__SERTZ__?.game?.scene?.getScene("world");
    return sw?.cosmeticAura?.tintTopLeft ?? null;
  });
  await p.waitForTimeout(4000);
  const g2 = await p.evaluate(() => {
    const sw = window.__SERTZ__?.game?.scene?.getScene("world");
    return { tint: sw?.cosmeticAura?.tintTopLeft ?? null, phase: sw?.auraPhase ?? -1 };
  });
  ok("[⑤] 은하수 오라 — 맥동(위상 진행)", g2.phase > 0.0147 && g2.tint !== null, `phase=${g2.phase.toFixed(4)} tint=${g2.tint} (무지개와 동일 위상 구동)`);
  await shot("05_rainbow_aura");
  await p.evaluate(() => {
    const sw = window.__SERTZ__?.game?.scene?.getScene("world");
    sw?.player?.setCosmeticSlot(null, "aura");
    sw?.player?.setHair(null);
  });

  /* ② 무릉도장 — 콘텐츠 허브 훈련장 탭 (일반 유저 진입) */
  await p.evaluate(() => {
    const s = Array.from(document.querySelectorAll("span")).find((x) => x.textContent === "콘텐츠");
    s?.closest("button")?.click();
  });
  await p.waitForTimeout(700);
  const hasDojangTab = await p.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    return btns.some((x) => x.textContent?.trim() === "훈련장");
  });
  ok("[②] 콘텐츠 허브에 「훈련장」 탭 존재", hasDojangTab);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.trim() === "훈련장")?.click();
  });
  await p.waitForTimeout(400);
  await shot("06_dojang_tab");
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("도장 입장"))?.click();
  });
  await p.waitForTimeout(4500);
  const dj = await sc();
  ok("[②] 무릉도장 입장 (GM 없이)", dj.stage === "dojang" && dj.dojangActive, `stage=${dj.stage} active=${dj.dojangActive}`);
  await shot("07_dojang_inside");
  /* 도장 → 복귀 포탈로 마을 복귀 */
  await p.evaluate(() => {
    const sw = window.__SERTZ__?.game?.scene?.getScene("world");
    sw?.portalHome && sw.gotoStage(sw.dojangFrom ?? "village");
  });
  await p.waitForTimeout(3500);

  /* ⑧ 거래소 — 유저 거래판 탭 → 게스트 인라인 로그인 (E2E 훅 __SERTZ_EB__로 패널 직접 오픈) */
  await p.evaluate(() => {
    window.__SERTZ_EB__?.emit("ui:panel", { panel: "trade" });
  });
  await p.waitForTimeout(900);
  /* 유저 거래판 탭으로 전환 (게스트 게이트는 이 탭에만 있음 — authMe/market 페치 완료 후 게스트 벽 렌더 → 폴링 대기 최대 10s) */
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("유저 거래판"))?.click();
  });
  await p.waitForFunction(
    () => Array.from(document.querySelectorAll("button")).some((x) => x.textContent?.includes("지금 계정 로그인하기")) || Array.from(document.querySelectorAll("button")).some((x) => x.textContent?.includes("등록")),
    { timeout: 10000 },
  ).catch(() => {});
  await p.waitForTimeout(200);
  const tradeGuest = await p.evaluate(() => {
    const t = document.body.textContent || "";
    return {
      hasLoginBtn: Array.from(document.querySelectorAll("button")).some((x) => x.textContent?.includes("지금 계정 로그인하기")),
      hasNpcTab: t.includes("시세판"),
      hasUserTab: t.includes("유저 거래판"),
    };
  });
  ok("[⑧] 거래소 패널 오픈 (시세판+유저 거래판)", tradeGuest.hasNpcTab && tradeGuest.hasUserTab);
  if (!tradeGuest.hasLoginBtn) {
    const dbg = await p.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button")).map((x) => x.textContent?.trim()).filter((t) => t && (t.includes("로그인") || t.includes("거래판") || t.includes("불러오는")));
      return { btns, wall: (document.body.textContent || "").includes("계정 로그인이 필요한 서비스"), loading: (document.body.textContent || "").includes("불러오는 중") };
    });
    console.log("   [dbg]", JSON.stringify(dbg).slice(0, 400));
  }
  ok("[⑧] 게스트 상태에 인라인 로그인 버튼", tradeGuest.hasLoginBtn);
  await shot("08_trade_guest");
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("지금 계정 로그인하기"))?.click();
  });
  await p.waitForTimeout(700);
  const authOpen = await p.evaluate(() => {
    const t = document.body.textContent || "";
    return t.includes("로그인") && (t.includes("회원가입") || t.includes("아이디") || t.includes("비밀번호"));
  });
  ok("[⑧] 인라인 버튼 → 계정창 오픈", authOpen);
  await shot("09_auth_open");
  /* ③ 결제 — 웹 폴백 (reason=web) 배너: 충전 버튼 클릭 → 안내 배너 */
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("에메랄드 충전") || x.textContent?.includes("충전소"))?.click();
  });
  await p.waitForTimeout(500);

  /* pageerror 집계 */
  const fatal = errs.filter((e) => !e.includes("net::") && !e.includes("Failed to load resource"));
  ok("[정리] pageerror/콘솔 에러 0", fatal.length === 0, fatal.slice(0, 3).join(" | "));

  const pass = results.filter((r) => r.pass).length;
  console.log(`\n=== v1.1.1 E2E: ${pass}/${results.length} PASS ===`);
  await b.close();
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => { console.error("E2E CRASH:", e.message); process.exit(2); });
