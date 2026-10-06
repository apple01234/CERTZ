/**
 * v5.0 보스 전면 리메이크 E2E — 니드호그(알프헤임10) 실측
 *  ① 보스 스폰 + 신규 아트 텍스처(boss_nidhog_*) 로드
 *  ② 12FPS 풀애니 등록(idle/walk/atk/die/sp1~3) + 모드별 재생 전환
 *  ③ 지연 로더 동작(36프레임) + 콘솔 에러 0
 */
const { chromium } = require("playwright");

(async () => {
  const results = [];
  const ok = (name, pass, detail = "") => {
    results.push({ name, pass, detail });
    console.log(`${pass ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
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

  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2500);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.getByRole("button", { name: /게임 시작/ }).first().click();
  await p.waitForTimeout(900);
  await p.getByText("캐릭터 생성", { exact: false }).first().click();
  await p.waitForTimeout(400);
  await p.locator('input[placeholder*="캐릭터 이름"]').fill("보스리메이크테스터");
  await p.getByRole("button", { name: /다음 — 직업 선택/ }).click();
  await p.waitForTimeout(300);
  await p.getByText("전사", { exact: false }).first().click();
  await p.waitForTimeout(200);
  await p.getByRole("button", { name: /다음 — 외형 선택|다음/ }).last().click().catch(() => {});
  await p.waitForTimeout(500);
  /* 외형 기본값(남계) 그대로 — 전시로 생성! */
  await p.getByRole("button", { name: /생성!/ }).first().click();
  await p.waitForTimeout(900);
  /* 시작 버튼 — 오버레이 가림 대응: 네이티브 클릭 */
  const started = await p.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const t = btns.find((x) => /이 캐릭터로 시작/.test(x.textContent || "")) || btns.find((x) => /시작/.test(x.textContent || ""));
    if (t) { t.click(); return t.textContent?.trim(); }
    return null;
  });
  console.log("시작 버튼:", started);
  await p.waitForTimeout(4000);
  /* 월드 씬 부팅 대기 (훅 폴링) */
  let sceneReady = false;
  for (let i = 0; i < 20; i++) {
    sceneReady = await p.evaluate(() => !!window.__SERTZ_SCENE__ && !!window.__SERTZ_SCENE__.gotoStage).catch(() => false);
    if (sceneReady) break;
    await p.keyboard.press("Enter");
    await p.waitForTimeout(700);
  }
  console.log("월드 씬 훅:", sceneReady);
  /* 프롤로그 컷신 완전 스킵 — stageDef가 잡힐 때까지 Enter */
  let prologueDone = false;
  for (let i = 0; i < 40; i++) {
    prologueDone = await p.evaluate(() => {
      const s = window.__SERTZ_SCENE__;
      return !!s && !!s.stageDef?.key && s.dialoguing !== true;
    }).catch(() => false);
    if (prologueDone) break;
    await p.keyboard.press("Enter");
    await p.waitForTimeout(400);
  }
  console.log("프롤로그 스킵:", prologueDone, await p.evaluate(() => window.__SERTZ_SCENE__?.stageDef?.key));

  /* 알프헤임 10구역(보스) 직행 — 전환 게이트(transitioning/컷신) 폴링 재시도 */
  let landed = false;
  for (let i = 0; i < 24 && !landed; i++) {
    landed = await p.evaluate(() => {
      const s = window.__SERTZ_SCENE__;
      if (!s?.gotoStage) return false;
      if (s.stageDef?.key === "alfheim10") return true;
      s.gotoStage("alfheim10");
      return false;
    }).catch(() => false);
    await p.keyboard.press("Enter");
    await p.waitForTimeout(900);
  }
  ok("[1] alfheim10 진입", landed, await p.evaluate(() => window.__SERTZ_SCENE__?.stageDef?.key));
  await p.waitForTimeout(1500);
  await p.screenshot({ path: "/tmp/e2e_boss_arrive.png" });
  console.log("화면 버튼:", await p.evaluate(() => [...document.querySelectorAll("button")].map((x) => x.textContent?.trim()).filter(Boolean).slice(0, 20).join(" / ")));
  console.log("bossDiffPending:", await p.evaluate(() => window.__SERTZ_SCENE__?.bossDiffPending));
  /* 보스방(최원거리 셀)으로 플레이어 순간이동 — 스폰 트리거 */
  await p.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    if (s?.player && s?.portalHome) {
      s.player.setPosition(s.portalHome.x - 60, s.portalHome.y);
    }
  });
  await p.waitForTimeout(1500);
  /* 스테이지 전환 컷신/대사 스킵 */
  for (let i = 0; i < 12; i++) {
    const d = await p.evaluate(() => window.__SERTZ_SCENE__?.dialoguing === true).catch(() => false);
    if (!d) break;
    await p.keyboard.press("Enter");
    await p.waitForTimeout(300);
  }

  /* 스토리 보스는 난이도 선택창 없이 즉시 스폰(v3.1.0) — E2E에선 직접 호출 */
  const spawned = await p.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    if (!s?.spawnBoss || s.boss) return false;
    s.spawnBoss(true);
    return true;
  });
  ok("[2] spawnBoss 직접 호출", spawned);
  await p.waitForTimeout(2500);

  /* 보스 인트로 대사 스킵 */
  for (let i = 0; i < 16; i++) {
    const d = await p.evaluate(() => window.__SERTZ_SCENE__?.dialoguing === true).catch(() => false);
    if (!d) break;
    await p.keyboard.press("Enter");
    await p.waitForTimeout(300);
  }
  await p.waitForTimeout(2000);

  /* 보스 상태 실측 */
  const st1 = await p.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    const b = s?.boss;
    if (!b) return null;
    const a = s.anims;
    return {
      key: b.def?.key,
      tex: b.def?.tex,
      texFrame: b.texture?.key,
      alive: b.alive,
      anim: b.anims?.currentAnim?.key,
      mode: b.mode,
      reg: {
        idle: a.exists("boss_nidhog-idle"),
        walk: a.exists("boss_nidhog-walk"),
        atk: a.exists("boss_nidhog-atk"),
        die: a.exists("boss_nidhog-die"),
        sp1: a.exists("boss_nidhog-sp1"),
        sp2: a.exists("boss_nidhog-sp2"),
        sp3: a.exists("boss_nidhog-sp3"),
      },
      frames: {
        idle5: s.textures.exists("boss_nidhog_idle5"),
        walk5: s.textures.exists("boss_nidhog_walk5"),
        atk5: s.textures.exists("boss_nidhog_atk5"),
        die5: s.textures.exists("boss_nidhog_die5"),
        sp15: s.textures.exists("boss_nidhog_sp1_5"),
        sp25: s.textures.exists("boss_nidhog_sp2_5"),
        sp35: s.textures.exists("boss_nidhog_sp3_5"),
      },
      idleRate: a.get("boss_nidhog-idle")?.frameRate,
      idleN: a.get("boss_nidhog-idle")?.frames?.length,
    };
  });
  console.log("보스 상태:", JSON.stringify(st1, null, 1));
  ok("[3] 니드호그 스폰", !!st1 && st1.key === "nidhog");
  ok("[4] 신규 아트 텍스처 적용", st1?.texFrame?.startsWith("boss_nidhog_"), st1?.texFrame);
  ok("[5] 12FPS 풀애니 등록(idle/walk/atk/die/sp1~3)", !!st1?.reg && Object.values(st1.reg).every(Boolean), JSON.stringify(st1?.reg));
  ok("[6] 지연 로더 36프레임 도달", !!st1?.frames && Object.values(st1.frames).every(Boolean), JSON.stringify(st1?.frames));
  ok("[7] idle 12FPS·6프레임", st1?.idleRate === 12 && st1?.idleN === 6, `rate=${st1?.idleRate} n=${st1?.idleN}`);

  /* 애니 전환 관찰 — 14초간 플레이어를 움직이며 추격(walk)/공격(atk/sp) 포착 */
  const seen = new Set();
  for (let i = 0; i < 28; i++) {
    if (i % 4 === 0) {
      const dx = i % 8 === 0 ? 320 : -320;
      const dy = i % 16 === 0 ? -140 : 140;
      await p.evaluate(({ dx, dy }) => {
        const s = window.__SERTZ_SCENE__;
        if (s?.player && s?.boss) {
          s.player.setPosition(s.boss.x + dx, s.boss.y + dy);
        }
      }, { dx, dy });
    }
    const a = await p.evaluate(() => window.__SERTZ_SCENE__?.boss?.anims?.currentAnim?.key ?? null);
    if (a) seen.add(a);
    await p.waitForTimeout(500);
  }
  console.log("관찰된 애니:", [...seen].join(", "));
  ok("[8] 모드별 애니 재생 전환 관찰", seen.size >= 2, [...seen].join(","));

  await p.screenshot({ path: "/tmp/e2e_boss_nidhog.png" });

  /* 스크롤 이동 유도 — 플레이어가 접근하면 보스도 추격(walk) */
  const st2 = await p.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    const b = s?.boss;
    return b ? { mode: b.mode, anim: b.anims?.currentAnim?.key, hp: b.hp, maxHp: b.maxHp } : null;
  });
  console.log("12초 후:", JSON.stringify(st2));

  const hard = errs.filter((e) => e.startsWith("PAGEERROR"));
  ok("[9] pageerror 0", hard.length === 0, hard.join(" | ").slice(0, 300));
  const bossRel = errs.filter((e) => /boss_nidhog|애니|anim/i.test(e));
  ok("[10] 보스 에셋 관련 콘솔 에러 0", bossRel.length === 0, bossRel.join(" | ").slice(0, 300));

  await b.close();
  const pass = results.filter((r) => r.pass).length;
  console.log(`\n=== ${pass}/${results.length} PASS ===`);
  process.exit(pass === results.length ? 0 : 1);
})();
