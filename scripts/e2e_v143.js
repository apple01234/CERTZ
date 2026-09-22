/**
 * v1.4.3 E2E — 유저 리포트 6건 최종 검증
 *  ① 요세유적 보이지 않는 히트박스 — keepRect/keepStair null (충돌 원천 소멸)
 *  ② 마을 유적 철거 — kg_* 프레임 0 + 보물상자 interactable 잔존
 *  ③ 등급업 큐브 — 큐브 지급 → tierUp 이벤트 → 승급 성공 실측
 *  ④ 보스 유물 아이콘 — 지연 로드 후 i_bd_* 등 전 아이콘 텍스처 존재
 *  ⑤ 멀티 콘텐츠 — rpg:partyRaid → praid 진입 + 레이드 보스 스폰 + 복귀 포탈
 *  ⑥ 재림 시리즈 — bossReplay r5 → 재림 보스(베오르드) 스폰 실측
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
  p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 200)));
  p.on("console", (m) => {
    const t = m.text();
    if (m.type() === "error" && !t.includes("favicon") && !t.includes("404")) errs.push("CONSOLE: " + t.slice(0, 160));
  });

  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2600);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });

  /* 부팅 + 배지 */
  const badge = await p.getByText("v1.4.3", { exact: false }).first().isVisible().catch(() => false);
  ok("[부팅] 타이틀 도달 (v1.4.3 배지)", badge);

  /* ④ 아이콘 로드 — 지연 로드 완료 후 bd_* 등 텍스처 존재 */
  for (let i = 0; i < 30 && !(await p.evaluate(() => !!window.__SERTZ_DEFER_DONE__)); i++) await p.waitForTimeout(300);
  const icons = await p.evaluate(() => {
    const g = window.__SERTZ__?.game;
    const sc = g?.scene?.getScene("title") ?? g?.scene?.getScene("boot");
    if (!sc) return null;
    const keys = ["i_bd_guardian", "i_bd_abudditos", "i_bd_fenrir", "i_gm_sword", "i_tier_cube", "item_eert_cube", "i_exp_book_l", "i_potion_hp5", "item_coin"];
    const out = {};
    for (const k of keys) out[k] = sc.textures.exists(k);
    return out;
  });
  const iconsAll = !!icons && Object.values(icons).every(Boolean);
  ok("[아이콘] 전 아이템 아이콘 텍스처 등록 (보스 유물 9종 포함)", iconsAll, icons ? Object.entries(icons).filter(([, v]) => !v).map(([k]) => k).join(",") || "9/9 존재" : "씬 없음");

  /* 월드 진입 (로비 3단 흐름 준용) */
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

  /* ①② 유적 철거 — kg 프레임 0 + keepRect/keepStair null + 보물상자 1개 */
  const keep = await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!sc) return null;
    let kgTiles = 0, fence = 0, stair = 0, hiddenZones = 0;
    for (const ch of sc.children.list) {
      const tex = ch?.texture?.key;
      const fn = ch?.frame?.name;
      if (tex === "map_ground" && (fn === "kg_grass" || fn === "kg_dirt")) kgTiles++;
      else if (tex === "map_props" && fn === "kg_fence") fence++;
      else if (tex === "map_props" && fn === "kg_stairs") stair++;
    }
    const chest = (sc.interactables ?? []).filter((it) => it.kind === "keepchest").length;
    return { kgTiles, fence, stair, chest, keepRectNull: !sc.keepRect, keepStairNull: !sc.keepStair };
  });
  ok("[유적] 구조물 철거 — 발코니/목책/계단 프레임 0", !!keep && keep.kgTiles === 0 && keep.fence === 0 && keep.stair === 0, keep ? `kg=${keep.kgTiles} f=${keep.fence} s=${keep.stair}` : "씬 없음");
  ok("[유적] 보이지 않는 히트박스 원천 소멸 (keepRect/keepStair null)", !!keep && keep.keepRectNull && keep.keepStairNull, "-");
  ok("[유적] 보물상자만 잔존 (interactable 1개)", !!keep && keep.chest === 1, keep ? `chest=${keep.chest}` : "-");

  /* ③ 등급업 큐브 — 지급 → 승급 실측 */
  const tier = await p.evaluate(() => {
    const sc = window.__SERTZ__.game.scene.getScene("world");
    for (let i = 0; i < 3; i++) sc.player.owned.push("tier_cube");
    const before = sc.player.tierUpTargets.weapon;
    window.__SERTZ_EB__.emit("rpg:isekai", { action: "tierUp", slot: "weapon" });
    return {
      cubesAfter: sc.player.owned.filter((k) => k === "tier_cube").length,
      weaponUp: sc.player.tierUpTargets.weapon - before,
      tierMul: sc.player.tierUpMult("weapon"),
    };
  });
  ok("[큐브] 등급업 큐브 사용 — 소모 1 + 승급 반영", !!tier && tier.cubesAfter === 2 && tier.weaponUp === 1 && tier.tierMul > 1, tier ? `cubes=${tier.cubesAfter} up=${tier.weaponUp} mul=${tier.tierMul}` : "-");
  /* 실패 원인 분리 메시지 — 큐브 소진 후 재시도 (React 렌더 대기 후 판정) */
  const tierFail = await p.evaluate(() => {
    const sc = window.__SERTZ__.game.scene.getScene("world");
    const p2 = sc.player;
    p2.owned = p2.owned.filter((k) => k !== "tier_cube");
    window.__SERTZ_EB__.emit("rpg:isekai", { action: "tierUp", slot: "weapon" });
    return true;
  });
  await p.waitForTimeout(600);
  const tierFailMsg = await p.evaluate(() => document.body.innerText.includes("등급업 큐브가 없습니다"));
  ok("[큐브] 실패 원인별 안내 (큐브 없음 메시지)", !!tierFail && !!tierFailMsg, "-");

  /* ⑥ 재림 시리즈 — bossReplay r5 (컬렉션 주입 → 이동 → 재림 보스 스폰) */
  await p.waitForTimeout(600);
  await p.evaluate(() => {
    const sc = window.__SERTZ__.game.scene.getScene("world");
    sc.monsterKills["boss_vord"] = 1; // 최초 처치 등록 시뮬레이션
    window.__SERTZ_EB__.emit("rpg:bossReplay", { ch: "r5", lv: "easy" });
  });
  /* 헤드리스는 게임 루프가 ~3fps라 delayedCall(440ms 전환 + 350ms 보스 스폰)에 수 초 소요 — 폴링 대기 */
  let rbState = null;
  for (let i = 0; i < 40; i++) {
    await p.waitForTimeout(1000);
    rbState = await p.evaluate(() => {
      const sc = window.__SERTZ__?.game?.scene?.getScene("world");
      if (!sc) return null;
      return { stage: sc.stageDef?.key, bossName: sc.bossDef?.name ?? null, hasBoss: !!sc.boss, replayActive: sc.replayBossActive };
    });
    if (rbState && rbState.stage === "r5" && rbState.hasBoss) break;
    /* 대화(보스 인트로)가 떠 있으면 정리 */
    if (rbState && rbState.stage === "r5" && !rbState.hasBoss) {
      await p.mouse.click(640, 500);
    }
  }
  ok("[재림] r5 보스 재도전 진입", !!rbState && rbState.stage === "r5", rbState ? `stage=${rbState.stage}` : "씬 없음");
  ok("[재림] 재림 보스(베오르드) 스폰 + 재림판 경로", !!rbState && rbState.hasBoss && /재림한 .*베오르드/.test(rbState.bossName ?? "") && rbState.replayActive, rbState ? `name=${rbState.bossName}` : "-");

  /* 대화 정리 후 ⑤ 공동 토벌전 */
  for (let i = 0; i < 20; i++) {
    const d = await p.evaluate(() => window.__SERTZ__?.game?.scene?.getScene("world")?.dialoguing);
    if (!d) break;
    await p.mouse.click(640, 500);
    await p.waitForTimeout(360);
  }
  await p.evaluate(() => window.__SERTZ_EB__.emit("rpg:partyRaid", {}));
  let raid = null;
  for (let i = 0; i < 40; i++) {
    await p.waitForTimeout(1000);
    raid = await p.evaluate(() => {
      const sc = window.__SERTZ__?.game?.scene?.getScene("world");
      if (!sc) return null;
      return {
        stage: sc.stageDef?.key,
        bossName: sc.bossDef?.name ?? null,
        hasBoss: !!sc.boss,
        bossHp: sc.boss?.maxHp ?? 0,
        emerald: sc.replayBossEmerald,
        returnActive: sc.returnActive,
      };
    });
    if (raid && raid.stage === "praid" && raid.hasBoss) break;
    if (raid && raid.stage === "praid") {
      await p.mouse.click(640, 500);
    }
  }
  ok("[멀티] 공동 토벌전(praid) 진입", !!raid && raid.stage === "praid", raid ? `stage=${raid.stage}` : "씬 없음");
  ok("[멀티] 레이드 보스 심연의 감시자 스폰 + 파티 보상 경로", !!raid && raid.hasBoss && /심연의 감시자/.test(raid.bossName ?? "") && raid.emerald >= 4 && raid.returnActive, raid ? `name=${raid.bossName} em=${raid.emerald}` : "-");

  /* 복귀지 실측 — 이 흐름은 village → r5(재도전) → praid이므로 praidFrom = "r5"가 정상 */
  const back = await p.evaluate(() => {
    const sc = window.__SERTZ__.game.scene.getScene("world");
    return { praidFrom: sc.praidFrom, stageValid: !!window.__SERTZ__.game.scene.getScene("world").praidFrom };
  });
  ok("[멀티] 복귀지 기록 (praidFrom=입장 전 구역 r5)", !!back && back.praidFrom === "r5", back ? `from=${back.praidFrom}` : "-");

  /* 유적/토벌전 스크린샷 증거 */
  await p.evaluate(() => {
    const sc = window.__SERTZ__.game.scene.getScene("world");
    if (sc.boss) {
      const cam = sc.cameras.main;
      cam.stopFollow();
      cam.setZoom(1.15);
      cam.centerOn(sc.boss.x, sc.boss.y - 20);
    }
  });
  await p.waitForTimeout(700);
  await p.screenshot({ path: "/tmp/e2e_143_praid.png" });

  /* 안정성 */
  const realErrors = errs.filter((e) => !e.includes("favicon") && !e.includes("404"));
  ok("[안정성] pageerror 0", realErrors.length === 0, realErrors.slice(0, 2).join(" | "));

  const pass = results.filter((r) => r.pass).length;
  console.log(`\n=== v1.4.3 E2E: ${pass}/${results.length} PASS, pageerror=${realErrors.length} ===`);
  await b.close();
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => { console.error("SCRIPT FAIL:", e.message); process.exit(1); });
