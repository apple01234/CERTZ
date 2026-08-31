/* v3.0.1 E2E — 직업별 자동전투 최적화 검증
 * [1] 전사 — 돌진 갭클로저(200px) + 회전베기 군집(2+)/단일 판단
 * [2] 마법사 — 볼트 쿨마다 + 이탈(점멸 대시/걷기 후퇴)
 * [3] 궁수 — 관통 화살 군집(340px 2+)/단일 판단 (단일 시 기본공격으로 MP 절약) */
const { chromium } = require("playwright");
const { spawn } = require("child_process");

const PORT = 3113;
const URL = `http://localhost:${PORT}`;
let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log(`  PASS — ${label}`); } else { fail++; console.log(`  FAIL — ${label}`); } };

async function enterWorld(page) {
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("text=새로운 모험", { timeout: 60000 });
  await page.click("text=새로운 모험");
  for (let i = 0; i < 40; i++) {
    const inWorld = await page.evaluate(() => !!(window.__SERTZ__?.game?.scene.getScene("world")?.player));
    if (inWorld) break;
    await page.mouse.click(640, 400); await page.keyboard.press("e"); await page.waitForTimeout(400);
  }
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.finishIntro("테스터");
  });
  await page.waitForTimeout(400);
  for (let i = 0; i < 5; i++) { await page.keyboard.press("Space"); await page.waitForTimeout(260); }
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.dialoguing = false; w.introStep = -1; w.sleepPending = false;
  });
  await page.waitForTimeout(250);
}

async function restartWith(page, stage, patch) {
  await page.evaluate(([st, p]) => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const carry = w.buildSave(st);
    Object.assign(carry, p);
    w.scene.restart({ stage: st, save: carry });
  }, [stage, patch]);
  await page.waitForTimeout(1800);
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.dialoguing = false; w.introStep = -1; w.sleepPending = false;
  });
  await page.waitForTimeout(300);
}

/** 직업별 세팅 — cls 지정/펫/자동사냥 ON/MP·쿨 리셋/MP물약 차단(측정 오염 방지) */
async function setupJob(page, cls) {
  await restartWith(page, "forest3", { cls, lv: 15 });
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const p = w.player;
    if (!p.pets.includes("pet_slime")) p.pets.push("pet_slime");
    p.setPet("pet_slime");
    p.potions.mp = 0; p.potions.hp = 8;
    p.hp = p.maxHp; p.mp = p.maxMp;
    p.skill1Cd = 0; p.skill2Cd = 0;
    w.autoHunt = false;
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__SERTZ_EB__.emit("rpg:autohunt", {}));
  await page.waitForTimeout(300);
}

/** 격리 — 대상 1기만 남기고 나머지를 1600px 밖으로 밀어냄 + 전체 무한 HP(측정 중 사망·리스폰 방지) */
async function isolate(page, idx) {
  return page.evaluate((i) => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const ts = w.getAllTargets().filter((e) => e.active);
    const tgt = ts[i % ts.length];
    const wb = w.physics.world.bounds;
    const p = w.player;
    const away = (e) => {
      // 플레이어 대칭점(맵 중심 기준 반대편) + 지터 — 경계 내로 클램프(월드 밖 → 구석 뭉침 방지)
      const jx = (Math.random() - 0.5) * 300, jy = (Math.random() - 0.5) * 300;
      const nx = Math.min(Math.max(2 * wb.width / 2 - p.x + jx, 80), wb.width - 80);
      const ny = Math.min(Math.max(2 * wb.height / 2 - p.y + jy, 80), wb.height - 80);
      if (e.body && e.body.reset) e.body.reset(nx, ny); else { e.x = nx; e.y = ny; }
      e.setVelocity(0, 0);
    };
    for (const e of ts) {
      e.maxHp = 999999; e.hp = 999999; // 전체 무한 HP — 사망→리스폰 오염 차단
      if (e === tgt) continue;
      away(e);
    }
    return ts.length;
  }, idx);
}

/** 관찰 샘플러 — dur ms간 60ms 간격: 최근접 적 거리 min/max, 대시/스킬1 사용, MP 범위 */
async function sample(page, dur) {
  return page.evaluate(async (d) => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const out = { minD: Infinity, maxD: 0, dash: false, s1: false, mpMin: Infinity, mpMax: 0, tgtHp0: 0, tgtHpMin: Infinity };
    const t0 = Date.now();
    const p = w.player;
    out.tgtHp0 = Math.min(...w.getAllTargets().filter((e) => e.active).map((e) => Math.hypot(p.x - e.x, p.y - e.y) < 400 ? e.hp : Infinity));
    while (Date.now() - t0 < d) {
      let nd = Infinity;
      for (const e of w.getAllTargets()) {
        if (!e.active) continue;
        nd = Math.min(nd, Math.hypot(p.x - e.x, p.y - e.y));
        if (Math.hypot(p.x - e.x, p.y - e.y) < 400) out.tgtHpMin = Math.min(out.tgtHpMin, e.hp);
      }
      if (nd < Infinity) { out.minD = Math.min(out.minD, nd); out.maxD = Math.max(out.maxD, nd); }
      if (p.state === "dash") out.dash = true;
      if (p.skill1Cd > 0) out.s1 = true;
      out.mpMin = Math.min(out.mpMin, p.mp); out.mpMax = Math.max(out.mpMax, p.mp);
      await new Promise((r) => setTimeout(r, 60));
    }
    out.minD = Math.round(out.minD); out.maxD = Math.round(out.maxD);
    out.mpMin = Math.round(out.mpMin); out.mpMax = Math.round(out.mpMax);
    return out;
  }, dur);
}

/** 플레이어를 대상 idx 적의 곁으로 텔레포트 (거리 d) */
async function teleportNear(page, idx, d) {
  return page.evaluate(([i, dist]) => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const p = w.player;
    const ts = w.getAllTargets().filter((e) => e.active);
    const t = ts[i % ts.length];
    const px = t.x + dist, py = t.y;
    if (p.body && p.body.reset) p.body.reset(px, py); else { p.x = px; p.y = py; }
    p.setVelocity(0, 0);
    p.hp = p.maxHp; p.mp = p.maxMp; p.skill1Cd = 0; p.skill2Cd = 0;
    p.state = "idle";
    return Math.round(Math.hypot(p.x - t.x, p.y - t.y));
  }, [idx, d]);
}

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: process.cwd(), env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 500)); try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) break; } catch {} }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 200)));

  try {
    console.log("[0] 진입 + 자동사냥 하니스");
    await enterWorld(page);
    ok(true, "월드 진입");

    console.log("[1] 전사 — 갭클로저 + 회전베기 판단");
    await setupJob(page, "warrior");
    await isolate(page, 0);
    await teleportNear(page, 0, 200); // 200px — 걷기보다 돌진이 빠른 거리
    const wGap = await sample(page, 2600);
    ok(wGap.dash || wGap.mpMin <= wGap.mpMax - 20, `전사 갭클로저 — 대시 사용=${wGap.dash} (MP ${wGap.mpMax}→${wGap.mpMin})`);
    // 군집: 2번째 적을 대상 기준 회전 반경 내에 배치 (플레이어는 대상 50px — 즉시 근접 분기)
    const clustered = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const p = w.player;
      const ts = w.getAllTargets().filter((e) => e.active);
      const t = ts[0];
      const others = ts.filter((e) => e !== t);
      if (others.length === 0) return false;
      const o = others[0];
      if (o.body && o.body.reset) o.body.reset(t.x + 60, t.y + 50); else { o.x = t.x + 60; o.y = t.y + 50; } // 대상 옆 — 플레이어 기준 둘 다 회전 반경(118) 내
      o.setVelocity(0, 0);
      if (p.body && p.body.reset) p.body.reset(t.x + 50, t.y); else { p.x = t.x + 50; p.y = t.y; }
      p.setVelocity(0, 0);
      p.mp = p.maxMp; p.skill1Cd = 0; p.skill2Cd = 6000; p.state = "idle";
      return true;
    });
    const wSpin = clustered ? await sample(page, 2600) : null;
    ok(!!wSpin && wSpin.s1, `전사 회전베기 — 군집(2+) 시 발동 (s1cd=${wSpin ? wSpin.s1 : "-"})`);
    // 단일: 격리 후 회전베기 미발동 (기본공격으로 MP 절약)
    await isolate(page, 1);
    await teleportNear(page, 1, 48);
    const wSolo = await sample(page, 2400);
    ok(!wSolo.s1, `전사 단일 대상 — 회전베기 절제 (s1cd=${wSolo.s1}, 접촉 ${wSolo.minD}px)`);
    ok(wSolo.tgtHpMin < wSolo.tgtHp0, `전사 기본공격 명중 — HP ${wSolo.tgtHp0}→${wSolo.tgtHpMin}`);

    console.log("[2] 마법사 — 볼트 쿨마다 + 이탈");
    await setupJob(page, "mage");
    await isolate(page, 2);
    await teleportNear(page, 2, 200);
    const mBolt = await sample(page, 2600);
    ok(mBolt.s1, `마법사 볼트 — 사거리 내 쿨마다 시전 (MP ${mBolt.mpMax}→${mBolt.mpMin})`);
    // 이탈 1 — 점멸 대시: 적이 붙으면 돌진기로 탈출
    await teleportNear(page, 2, 55);
    const mDash = await sample(page, 2000);
    ok(mDash.dash || mDash.minD > 120, `마법사 점멸 이탈 — 대시=${mDash.dash}, 최소거리 ${mDash.minD}px`);
    // 이탈 2 — 걷기 후퇴: 점멸 쿨다운 강제, 그래도 거리 벌어짐
    await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      w.player.skill2Cd = 6000;
      const ts = w.getAllTargets().filter((e) => e.active);
      const p = w.player;
      if (p.body && p.body.reset) p.body.reset(ts[0].x + 55, ts[0].y); else { p.x = ts[0].x + 55; p.y = ts[0].y; } p.setVelocity(0, 0);
      p.hp = p.maxHp; p.mp = p.maxMp; p.state = "idle";
    });
    const mKite = await sample(page, 2200);
    ok(mKite.maxD - Math.min(mKite.minD, 55) > 40, `마법사 걷기 카이팅 — 거리 ${mKite.minD}→${mKite.maxD}px`);

    console.log("[3] 궁수 — 관통 화살 판단");
    await setupJob(page, "ranger");
    await isolate(page, 3);
    // 군집: 다른 적을 300px 내 배치 → 관통 화살 발동
    // 군집: 2번째 적을 대상 기준 240px에 배치 — 둘 다 플레이어 기준 150~250px (카이팅 분기 회피)
    const rCluster = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const p = w.player;
      const ts = w.getAllTargets().filter((e) => e.active);
      const t = ts[0];
      const others = ts.filter((e) => e !== t);
      if (others.length === 0) return false;
      const o = others[0];
      if (o.body && o.body.reset) o.body.reset(t.x + 440, t.y); else { o.x = t.x + 440; o.y = t.y; } // 플레이어(200,-40) 기준 ~243px — 사거리 내·이탈 분기 밖
      o.setVelocity(0, 0);
      if (p.body && p.body.reset) p.body.reset(t.x + 200, t.y - 40); else { p.x = t.x + 200; p.y = t.y - 40; }
      p.setVelocity(0, 0);
      p.mp = p.maxMp; p.skill1Cd = 0; p.skill2Cd = 6000; p.state = "idle";
      return true;
    });
    const rArr = rCluster ? await sample(page, 2600) : null;
    ok(!!rArr && rArr.s1, `궁수 관통 화살 — 군집(2) 시 발동 (s1cd=${rArr ? rArr.s1 : "-"})`);
    // 단일: 관통 화살 절제 — 340px 내 적이 정확히 1기인 깨끗한 구간에서 스킬1 미발동 확인
    // (오염 시 즉시 재격리 — 리스폰/어그로 유입에도 자가 복구)
    await isolate(page, 4);
    await teleportNear(page, 4, 200);
    const rSolo = await page.evaluate(async () => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const p = w.player;
      let tgt = null, min = Infinity;
      for (const e of w.getAllTargets()) {
        const d = Math.hypot(p.x - e.x, p.y - e.y);
        if (d < min) { min = d; tgt = e; }
      }
      const t0 = Date.now();
      let cleanMs = 0, maxClean = 0, s1DuringClean = false, dbg = null;
      const dirtyTrace = [];
      while (Date.now() - t0 < 5000) {
        const cnt = w.countTargetsNear(340);
        if (cnt > 1 && tgt) {
          // 오염 복구 — 대상 외 적 재밀어냄(경계 내 대칭점) + 쿨다운 리셋(오염 구간 시전 흔적 제거)
          const wb2 = w.physics.world.bounds;
          for (const e of w.getAllTargets()) {
            if (e === tgt) continue;
            const nx = Math.min(Math.max(wb2.width - p.x + (Math.random() - 0.5) * 300, 80), wb2.width - 80);
            const ny = Math.min(Math.max(wb2.height - p.y + (Math.random() - 0.5) * 300, 80), wb2.height - 80);
            if (e.body && e.body.reset) e.body.reset(nx, ny); else { e.x = nx; e.y = ny; }
            e.setVelocity(0, 0);
          }
          p.skill1Cd = 0;
          cleanMs = 0;
          if (dirtyTrace.length < 6) {
            dirtyTrace.push(`t=${Date.now() - t0} cnt=${cnt} ds=[${w.getAllTargets().filter((e) => e.active).map((e) => Math.round(Math.hypot(p.x - e.x, p.y - e.y))).sort((a, b) => a - b).slice(0, 5).join(",")}]`);
          }
        } else if (cnt === 1) {
          // 깨끗한 구간 (단일 대상) — 상태 무관 누적, 이 구간 중 시전되면 실패
          cleanMs += 60; maxClean = Math.max(maxClean, cleanMs);
          if (p.skill1Cd > 0) {
            s1DuringClean = true;
            dbg = [...w.getAllTargets()].filter((e) => e.active).map((e) => Math.round(Math.hypot(p.x - e.x, p.y - e.y))).sort((a, b) => a - b).slice(0, 4);
            break;
          }
        } else cleanMs = 0;
        await new Promise((r) => setTimeout(r, 60));
      }
      return { maxClean, s1DuringClean, dbg, dirtyTrace };
    });
    ok(rSolo.maxClean >= 600 && !rSolo.s1DuringClean, `궁수 단일 대상 — 관통 화살 절제 (깨끗한 구간 ${rSolo.maxClean}ms, 스킬 미발동=${!rSolo.s1DuringClean}${rSolo.dirtyTrace.length ? ` · 오염: ${rSolo.dirtyTrace.join(" | ")}` : ""})`);

    await page.screenshot({ path: "scripts/v301-autohunt.png" });
  } finally {
    await browser.close().catch(() => {});
    srv.kill();
  }
  console.log(`\n=== v3.0.1 자동전투: ${pass} PASS / ${fail} FAIL ===`);
  process.exit(fail > 0 ? 1 : 0);
})();
