/**
 * stat_snapshot.js — 포탈 이동 반복 시 스탯 불변 검증 (지시서 #13)
 *
 * 지시서 완료 기준:
 *   "포탈 이동 + 대사를 20회 반복해도 모든 스탯이 첫 값과 동일."
 *
 * 포탈 이동은 실제로 `this.scene.restart({ stage, save, entry })` 를 호출한다
 * (WorldScene.ts:3353). 세이브 reload 와는 경로가 다르므로 여기서도 같은 restart
 * 경로를 반복 호출한다.
 *
 * 실행: cd /root/workspace/CERTZ && ROUNDS=20 node scripts/re/stat_snapshot.js
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const CHROME = "/root/.cache/ms-playwright/chromium-1234/chrome-linux/chrome";
const URL = process.env.URL || "http://localhost:3000";
const ROUNDS = Number(process.env.ROUNDS || 20);
const OUT = process.env.OUT || "/root/.hermes/cache/scratch/deploy/stat_snapshot.json";

/** 스탯 스냅샷 — __SERTZ__ 는 { game } (PhaserGame.ts:301) */
const COLLECT = `(() => {
  const g = (window.__SERTZ__ && window.__SERTZ__.game) || null;
  const sc = g && g.scene && g.scene.getScene ? g.scene.getScene("world") : null;
  const p = sc && sc.player ? sc.player : null;
  if (!p) return { ok: false, reason: "no-player" };
  return {
    ok: true,
    stage: sc.stageKey || null,
    lv: p.lv, exp: p.exp, atk: p.atk, maxHp: p.maxHp, maxMp: p.maxMp,
    hp: p.hp, mp: p.mp, gold: p.gold,
    /* 누적 가산 추적값 — 이게 늘면 "포탈 탈 때마다 스탯 증가" 버그 */
    sfHpApplied: p.starHpApplied ?? null,
    bonusHpApplied: p.bonusHpAppliedVal ?? null,
    potHpApplied: p.potHpAppliedVal ?? null,
    accHpApplied: p.accHpAppliedVal ?? null,
    atkTotal: (() => { try { return p.atkTotal; } catch { return null; } })(),
    defTotal: (() => { try { return p.defTotal; } catch { return null; } })(),
  };
})()`;

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));

  // 1) 게임 로드 → 타이틀에서 월드 진입 (실제 진입 경로)
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  await page.evaluate(() => {
    const t = window.__SERTZ__?.game?.scene.getScene("title");
    if (t && typeof t.beginWorld === "function") t.beginWorld();
  });
  await page.waitForTimeout(6000);

  const snap = async (label) => {
    const s = await page.evaluate(COLLECT).catch(() => ({ ok: false, reason: "eval-fail" }));
    return { label, ...s };
  };

  /* 2) 기준값 — 보너스를 실제로 부여한 뒤 측정한다.
   *  보너스가 0이면 "증가 버그" 자체가 재현되지 않으므로, 강화·장신구를 걸어
   *  syncBonusHp / syncStarHp / syncAccStarHp 가 실제 델타를 계산하게 만든다. */
  await page.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene.getScene("world");
    const p = sc && sc.player;
    if (!p) return;
    try {
      p.weapon = "weapon_2"; p.armor = "armor_2";
      p.owned = ["weapon_1", "armor_1", "weapon_2", "armor_2"];
    } catch {}
    try { p.starMap = { weapon_2: 5, armor_2: 5 }; p.syncStarHp(); } catch {}
    try { p.accessories = ["acc_ring1"]; p.accUp = { acc_ring1: 3 }; p.syncAccStarHp(); } catch {}
    try { p.syncBonusHp(); } catch {}
    try { sc.save(); } catch {}
  });
  await page.waitForTimeout(1500);

  const rows = [await snap("initial")];

  // 3) 포탈 이동 경로 반복 — scene.restart({ stage, save })
  for (let i = 1; i <= ROUNDS; i++) {
    await page.evaluate(async () => {
      const sc = window.__SERTZ__?.game?.scene.getScene("world");
      if (!sc) return;
      await new Promise((resolve) => {
        try {
          sc.scene.restart({ stage: sc.stageKey, save: sc.buildSave ? sc.buildSave() : undefined });
        } catch {}
        setTimeout(resolve, 4000);
      });
    });
    await page.waitForTimeout(4600);
    rows.push(await snap(`portal#${i}`));
  }

  // 4) 비교
  const base = rows[0];
  const keys = Object.keys(base).filter((k) => !["label", "ok", "reason", "stage"].includes(k));
  const diffs = [];
  for (const r of rows.slice(1)) {
    const d = {};
    for (const k of keys) if (base[k] !== r[k]) d[k] = { from: base[k], to: r[k] };
    if (Object.keys(d).length) diffs.push({ label: r.label, diff: d });
  }

  const report = { rounds: ROUNDS, captured: rows.length, base, rows, diffs, errors: errors.slice(0, 8) };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

  console.log(`=== 포탈 이동 ${ROUNDS}회 스탯 스냅샷 ===`);
  console.log("기준:", JSON.stringify(base));
  if (!base.ok) {
    console.log("\n⚠️ 플레이어를 찾지 못해 판정 불가 — 게임 진입 실패");
  } else if (diffs.length === 0) {
    console.log(`\n✅ PASS — ${ROUNDS}회 반복 후 모든 스탯 불변`);
  } else {
    console.log(`\n❌ FAIL — ${diffs.length}/${rows.length - 1}회에서 값이 달라짐`);
    for (const d of diffs.slice(0, 8)) console.log(` ${d.label}:`, JSON.stringify(d.diff));
  }
  if (errors.length) console.log(`\n페이지 오류 ${errors.length}건:`, errors.slice(0, 3));
  console.log(`저장: ${OUT}`);

  await browser.close();
})();
