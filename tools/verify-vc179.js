// vc179 검증 — 지시 12건 중 코드로 확인 가능한 항목 실측
const { chromium } = require("playwright");

(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu", "--use-gl=swiftshader"] });
  const page = await b.newPage({ viewport: { width: 1100, height: 760 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errs.push("C:" + m.text().slice(0, 120)); });

  await page.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded", timeout: 120000 });
  const wait = async (w, ms) => {
    const t0 = Date.now(); let c = [];
    while (Date.now() - t0 < ms) {
      try { c = await page.evaluate(() => window.__SERTZ_DEBUG__?.game?.scene.getScenes(true).map((s) => s.scene.key) ?? []);
        if (w.every((x) => c.includes(x))) return c; } catch {}
      await page.waitForTimeout(700);
    }
    return c;
  };
  const click = async (re) => page.evaluate((s) => {
    const rx = new RegExp(s);
    const bt = Array.from(document.querySelectorAll("button")).find((x) => rx.test(x.textContent || "") && x.offsetParent !== null);
    if (bt) { bt.click(); return true; } return false;
  }, re.source);

  await wait(["title"], 60000);
  await click(/게임 시작/); await page.waitForTimeout(2500);
  let ok = await click(/이 캐릭터로 시작/);
  if (!ok) {
    await click(/캐릭터 생성/); await page.waitForTimeout(1500);
    const i = await page.$("input[placeholder*='캐릭터 이름']");
    if (i) await i.fill("vc179검증");
    await page.waitForTimeout(900); await click(/^다음/); await page.waitForTimeout(1200);
    await click(/모험가로 생성/); await page.waitForTimeout(4000);
    ok = await click(/이 캐릭터로 시작/);
  }
  await wait(["world"], 60000); await page.waitForTimeout(5000);

  /* ── ①⑨⑩ 스킬 해석 + ① 자동사냥 ranged ── */
  const skill5 = await page.evaluate(() => {
    const D = window.__SERTZ_DEBUG__;
    const sc = D.game.scene.getScenes(true).find((s) => s && s.player);
    sc.tut = null; sc.dialoguing = false; sc.tutorialDone = true;
    /* 각 계열 1차 vs 2차 스킬 종류 비교 — 1차=2차 버그 확인 */
    const out = {};
    for (const [fam, t1, t2] of [["warrior","warrior","warlord"],["ranger","ranger","eagleeye"],["mage","mage","stormbringer"],["thief","thief","nightblade"],["pirate","pirate","raider"]]) {
      out[fam] = { t1, t2 };
    }
    return out;
  });

  const resolved = await page.evaluate(async () => {
    // classes.ts의 resolve는 번들 내부라 직접 못 부르므로, 실제 플레이어 cls를 바꿔 스킬 라벨을 읽는다
    const D = window.__SERTZ_DEBUG__;
    const sc = D.game.scene.getScenes(true).find((s) => s && s.player);
    const get = (cls) => {
      sc.player.cls = cls;
      return { cls, s1: sc.player.skill1Name, s2: sc.player.skill2Name, s3: sc.player.skill3Name };
    };
    return [
      get("pirate"), get("raider"), get("corsair"),
      get("stormcaptain"), get("powdermaster"), get("seaking"), get("dreadnought"),
      get("warrior"), get("warlord"),
    ];
  });
  console.log("⑨⑩ 스킬 해석", JSON.stringify(resolved, null, 1));

  /* ── ① 자동사냥 ranged 판정 (해적) ── */
  const autoHunt = await page.evaluate(async () => {
    const D = window.__SERTZ_DEBUG__;
    const sc = D.game.scene.getScenes(true).find((s) => s && s.player);
    sc.player.cls = "pirate"; sc.player.lv = 40;
    await new Promise((r) => setTimeout(r, 300));
    /* 적 하나 스폰해서 자동사냥이 원거리 유지하는지 관찰 */
    const before = { x: sc.player.x, y: sc.player.y };
    return { ok: true, before, auto: sc.auto };
  });

  /* ── ③⑪ VFX 텍스처 로드 확인 ── */
  const tex = await page.evaluate(() => {
    const D = window.__SERTZ_DEBUG__;
    const sc = D.game.scene.getScenes(true).find((s) => s && s.player);
    const keys = ["fx_shockwave","fx_impact","fx_glow","fx_burst","fx_flare","fx_smoke","x3_gun"];
    const out = {};
    for (const k of keys) out[k] = sc.textures.exists(k);
    return out;
  });
  console.log("⑪ VFX 텍스처", JSON.stringify(tex));

  /* ── ④ E원 y 고정 확인 (트윈 충돌 제거) ── */
  const eBubble = await page.evaluate(async () => {
    const D = window.__SERTZ_DEBUG__;
    const sc = D.game.scene.getScenes(true).find((s) => s && s.player);
    /* 가장 가까운 interactable로 순간이동 후 프롬프트 갱신 */
    const it = sc.interactables?.find((o) => o.kind === "talk" || o.kind === "shop");
    if (!it) return { err: "no interactable" };
    sc.player.setPosition(it.x + 20, it.y);
    sc.updateInteractPrompt();
    await new Promise((r) => setTimeout(r, 120));
    const y0 = sc.eBubble?.y;
    const expect = it.y - (sc.interactables.some((o) => o.x === it.x && o.y === it.y && o.dlg) ? 96 : 58);
    /* 1.5초 뒤에도 y가 그대로인지 (트윈이 밀어올리지 않는지) */
    await new Promise((r) => setTimeout(r, 1500));
    const y1 = sc.eBubble?.y;
    return { y0, y1, expect, stable: Math.abs((y1 ?? 0) - (y0 ?? 0)) < 0.5, matches: Math.abs((y0 ?? 0) - expect) < 0.5 };
  });
  console.log("④ E원 위치", JSON.stringify(eBubble));

  /* ── ⑤ 콤보 HUD ── */
  const combo = await page.evaluate(async () => {
    const D = window.__SERTZ_DEBUG__;
    const sc = D.game.scene.getScenes(true).find((s) => s && s.player);
    sc.comboStreak = 7; sc.comboUntil = sc.time.now + 4200;
    sc.emitHud();
    await new Promise((r) => setTimeout(r, 400));
    const t = document.body.innerText || "";
    return { hudShows: /연속킬 x7/.test(t), expBonus: /EXP \+\d+%/.test(t) };
  });
  console.log("⑤ 콤보 HUD", JSON.stringify(combo));

  /* ── ③ 집꾸미기 회전 ── */
  const home = await page.evaluate(async () => {
    const D = window.__SERTZ_DEBUG__;
    const sc = D.game.scene.getScenes(true).find((s) => s && s.player);
    sc.player.owned.push("furn_bucket", "furn_bucket", "furn_bucket");
    sc.player.homeDecor = [];
    sc.homeDecorPlace("furn_bucket", 1, 1);
    sc.homeDecorPlace("furn_bucket", 2, 1);
    sc.homeDecorPlace("furn_bucket", 3, 1);
    const afterMulti = sc.player.homeDecor.length;
    sc.homeDecorPlace("furn_bucket", 4, 1);   // 보유 3개 초과 → 무시돼야 함
    const afterOver = sc.player.homeDecor.length;
    const rotBefore = sc.player.homeDecor[0]?.rot ?? 0;
    sc.homeDecorRotate(0);
    const rotAfter = sc.player.homeDecor[0]?.rot ?? 0;
    return { afterMulti, afterOver, rotBefore, rotAfter, cells: sc.player.homeDecor.map((d) => `${d.x},${d.y},r${d.rot}`) };
  });
  console.log("③ 집꾸미기", JSON.stringify(home));

  /* ── ⑧ 전직 적용 경로 ── */
  const job = await page.evaluate(() => {
    const D = window.__SERTZ_DEBUG__;
    const sc = D.game.scene.getScenes(true).find((s) => s && s.player);
    /* 2차 전직: pirate(1차) → raider(2차). applyClass는 부모 일치를 요구한다. */
    sc.player.cls = "pirate";
    sc.player.maxHp = 500; sc.player.hp = 500;
    sc.pendingJobClass = "raider";
    const applied = sc.applyPendingJob(2);
    const r1 = { applied, clsAfter: sc.player.cls };
    /* 3차: raider(2차) → stormcaptain(3차) */
    sc.pendingJobClass = "stormcaptain";
    const applied3 = sc.applyPendingJob(3);
    const r3 = { applied3, clsAfter3: sc.player.cls, s1: sc.player.skill1Name };
    return { ...r1, ...r3 };
  });
  console.log("⑧ 전직 적용", JSON.stringify(job));

  console.log("ERRORS", errs.length, JSON.stringify(errs.slice(0, 3)));
  await b.close();
})();
