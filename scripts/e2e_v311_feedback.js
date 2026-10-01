/* v3.0.11 E2E — 사용자 피드백 5항목 검증
 *  [1] 스카이로드 토네이도 — cyclone/skystorm 시전 시 fx_tornado 스프라이트 다수 활성
 *  [2] 돌진 직업 특색 — 돌진 중 주행 애니 재생 + 계열별 이펙트 헬퍼 존재
 *  [3] 2차 스킬 체감 — 버서커 파괴의 회전베기: 전방 러지(이동 실측) + "파괴의 광기!" 텍스트 / 3차+ Z 오라
 *  [4] 3·4차 스킬 아이콘 — 24종 PNG HTTP 200 + 스카이로드 s3/s4 버튼 img 렌더
 *  [5] 복귀 포탈 — kingdom1(3-1) 복귀 차원문 라벨이 "쿠소디아 마을" (사냥터 아님)
 *  + 회귀: pageerror 0 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");

const PORT = 3123;
const URL = `http://localhost:${PORT}`;
let pass = 0, fail = 0;
const ok = (cond, label, extra = "") => { if (cond) { pass++; console.log(`  PASS — ${label} ${extra}`); } else { fail++; console.log(`  FAIL — ${label} ${extra}`); } };

async function cleanDialogues(page) {
  for (let i = 0; i < 20; i++) {
    const dlg = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      if (w?.dialoguing) { w.resumeFromDialogue(); return true; }
      return false;
    });
    if (!dlg) break;
    await page.waitForTimeout(250);
  }
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.dialoguing = false; w.introStep = -1; w.sleepPending = false;
    if (w.physics.world) w.physics.world.resume();
  });
  await page.waitForTimeout(250);
}

async function enterWorld(page) {
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("text=새로운 모험", { timeout: 60000 });
  await page.click("text=새로운 모험");
  for (let i = 0; i < 40; i++) {
    const inWorld = await page.evaluate(() => !!(window.__SERTZ__?.game?.scene.getScene("world")?.player));
    if (inWorld) break;
    await page.mouse.click(400, 300); await page.keyboard.press("e"); await page.waitForTimeout(400);
  }
  await page.waitForTimeout(800);
  for (let i = 0; i < 6; i++) {
    const done = await page.evaluate(() => {
      try {
        const w = window.__SERTZ__.game.scene.getScene("world");
        if (!w?.player) return false;
        w.finishIntro("테스터");
        return true;
      } catch { return false; }
    });
    if (done) break;
    await page.waitForTimeout(500);
  }
  await cleanDialogues(page);
}

async function gotoStage(page, stageKey, savePatch = {}) {
  await page.evaluate(async (args) => {
    const w0 = window.__SERTZ__.game.scene.getScene("world");
    const stage = String(args.stageKey);
    const base = w0.buildSave(stage) || {};
    for (const [k, v] of Object.entries(args.patch || {})) base[k] = v;
    base.stage = stage;
    w0.scene.restart({ stage, save: base });
  }, { stageKey, patch: savePatch });
  await page.waitForTimeout(1500);
  await cleanDialogues(page);
}

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production", PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 500)); try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) break; } catch {} }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  console.log("== [4] 3·4차 스킬 아이콘 — 24종 HTTP 200 ==");
  await enterWorld(page);
  const iconNames = [
    "warlord_s3", "paladin_s3", "eagleeye_s3", "tempest_s3", "stormbringer_s3", "chronicle_s3",
    "nightblade_s3", "duelist_s3",
    "warbringer_s3", "crusader_s3", "deadeye_s3", "skylord_s3", "arclord_s3", "eternal_s3",
    "shadowlord_s3", "blademaster_s3",
    "warbringer_s4", "crusader_s4", "deadeye_s4", "skylord_s4", "arclord_s4", "eternal_s4",
    "shadowlord_s4", "blademaster_s4",
  ];
  const iconResults = await page.evaluate(async (names) => {
    const out = [];
    for (const n of names) {
      const r = await fetch(`/assets/skillicon/${n}.png`);
      out.push([n, r.status]);
    }
    return out;
  }, iconNames);
  const badIcons = iconResults.filter(([, s]) => s !== 200);
  ok(badIcons.length === 0, "스킬 아이콘 24종 전부 200", badIcons.length ? `실패=${badIcons.map(([n, s]) => `${n}:${s}`).join(",")}` : "");

  console.log("== [1] 스카이로드 토네이도 (GM 전직) ==");
  await gotoStage(page, "forest2", { cls: null });
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.player.gmSetClass("skylord");
    w.player.gmSetLevel(100);
    w.player.healFull();
    w.emitSkills();
  });
  await page.waitForTimeout(400);
  // V스킬(하늘의 희망, cyclone) 시전 → 토네이도 스프라이트 활성 수
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.player.useSkill3();
  });
  await page.waitForTimeout(500);
  const cycCount = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    return w.children.list.filter((o) => o.texture?.key === "fx_tornado" && o.active).length;
  });
  ok(cycCount >= 5, "하늘의 희망 시전 → 토네이도 스프라이트 5기 이상 활성", `count=${cycCount}`);
  // B스킬(천공의 폭풍, skystorm) — 쿨다운 초기화 후 시전
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.player.skill3Cd = 0;
    w.player.state = "idle";
    w.player.mp = 999;
    w.player.useSkill4();
  });
  await page.waitForTimeout(800);
  const stormCount = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    return w.children.list.filter((o) => o.texture?.key === "fx_tornado" && o.active).length;
  });
  ok(stormCount >= 8, "천공의 폭풍 시전 → 나선 토네이도 8기 이상 활성", `count=${stormCount}`);

  console.log("== [4b] 스카이로드 s3/s4 아이콘 DOM 렌더 ==");
  await page.waitForTimeout(600);
  const domIcons = await page.evaluate(() => ({
    s3: !!document.querySelector('img[src*="skylord_s3"]'),
    s4: !!document.querySelector('img[src*="skylord_s4"]'),
    s3Label: [...document.querySelectorAll("button[aria-label]")].map((b) => b.getAttribute("aria-label")).find((l) => l?.includes("하늘의 희망")) ?? null,
  }));
  ok(domIcons.s3, "V버튼 img skylord_s3 렌더");
  ok(domIcons.s4, "B버튼 img skylord_s4 렌더");
  ok(!!domIcons.s3Label, "V버튼 라벨 = 하늘의 희망", domIcons.s3Label ?? "");

  console.log("== [2] 돌진 주행 애니 + 계열별 이펙트 헬퍼 ==");
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.player.skill2Cd = 0; w.player.skill3Cd = 0; w.player.skill4Cd = 0;
    w.player.state = "idle"; w.player.mp = 999;
    w.player.useSkill2();
  });
  await page.waitForTimeout(90);
  const dashState = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const p = w.player;
    return {
      dashing: p.state === "dash",
      animPlaying: p.anims.isPlaying,
      animKey: p.anims.currentAnim?.key ?? null,
      hasStreak: typeof w.spawnWindStreak === "function",
      hasAfterimage: typeof w.spawnShadowAfterimage === "function",
      hasDust: typeof w.spawnDashDust === "function",
      hasRune: typeof w.spawnRuneRing === "function",
      hasCyclone: typeof w.fireCyclone === "function",
    };
  });
  ok(dashState.dashing && dashState.animPlaying && (dashState.animKey || "").includes("walk"),
    "돌진 중 주행 애니 재생", `anim=${dashState.animKey}`);
  ok(dashState.hasStreak && dashState.hasAfterimage && dashState.hasDust && dashState.hasRune && dashState.hasCyclone,
    "계열별 돌진 이펙트 헬퍼 4종 + fireCyclone 존재");

  console.log("== [3] 버서커 파괴의 회전베기 — 전사 원판과 차별화 ==");
  await gotoStage(page, "forest2", {});
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.player.gmSetClass("berserker");
    w.player.gmSetLevel(40);
    w.player.healFull();
  });
  await page.waitForTimeout(300);
  const rage = await page.evaluate(async () => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const p = w.player;
    p.skill1Cd = 0; p.state = "idle"; p.mp = 999;
    const x0 = p.x, y0 = p.y;
    p.useSkill1();
    await new Promise((r) => setTimeout(r, 180));
    const moved = Math.hypot(p.x - x0, p.y - y0);
    const texts = w.children.list.filter((o) => o.text?.includes("파괴의 광기")).length;
    const rings = w.children.list.filter((o) => o.type === "Arc" && o.strokeColor === 0xff5c3c).length;
    return { moved, rageText: texts > 0, rings: rings > 0 };
  });
  ok(rage.moved > 24, "버서커 Z 전방 러지 실측 (전사는 제자리)", `moved=${rage.moved.toFixed(1)}px`);
  ok(rage.rageText, '"파괴의 광기!" 텍스트 출력');
  // 전사 원판 비교 — 제자리
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const p = w.player;
    p.gmSetClass("warrior"); p.skill1Cd = 0; p.state = "idle"; p.mp = 999;
  });
  await page.waitForTimeout(250);
  const spin = await page.evaluate(async () => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const p = w.player;
    const x0 = p.x, y0 = p.y;
    p.useSkill1();
    await new Promise((r) => setTimeout(r, 180));
    return Math.hypot(p.x - x0, p.y - y0);
  });
  ok(spin < 14, "전사 회전베기는 제자리 유지 (대비)", `moved=${spin.toFixed(1)}px`);

  console.log("== [3b] 3차+ Z 진화 오라 ==");
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const p = w.player;
    p.gmSetClass("warlord"); p.skill1Cd = 0; p.state = "idle"; p.mp = 999;
  });
  await page.waitForTimeout(250);
  const aura = await page.evaluate(async () => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const p = w.player;
    p.useSkill1();
    await new Promise((r) => setTimeout(r, 120));
    return w.children.list.filter((o) => o.type === "Arc" && o.strokeColor === 0xff5c3c).length > 0;
  });
  ok(aura, "워로드(3차) Z 시전 시 클래스색 오라 링 생성");

  console.log("== [5] 복귀 포탈 — 3-1 → 쿠소디아 마을 ==");
  await gotoStage(page, "kingdom1", {});
  const portalLabel = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const t = w.children.list.find((o) => typeof o.text === "string" && o.text.startsWith("←"));
    return t?.text ?? null;
  });
  ok(!!portalLabel && portalLabel.includes("마을"), "3-1 복귀 차원문 라벨 = 마을", `label=${portalLabel ?? "없음"}`);
  ok(!!portalLabel && !/^\u2190 \d+-\d+$/.test(portalLabel.trim()), "라벨이 사냥터 구역번호가 아님", portalLabel ?? "");

  // 2-1(forest1)은 본마을로 복귀 (챕터1은 챕터마을 미경유 — 기존 경로 유지)
  await gotoStage(page, "forest1", {});
  const portalLabel2 = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const t = w.children.list.find((o) => typeof o.text === "string" && o.text.startsWith("←"));
    return t?.text ?? null;
  });
  ok(!!portalLabel2 && portalLabel2.includes("마을"), "2-1(forest1) 복귀 라벨 = 마을", `label=${portalLabel2 ?? "없음"}`);

  console.log("== 회귀 — pageerror ==");
  ok(pageErrors.length === 0, "pageerror 0건", pageErrors.length ? pageErrors.slice(0, 2).join(" | ") : "");

  await browser.close();
  srv.kill();
  console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
  process.exit(fail > 0 ? 1 : 0);
})();
