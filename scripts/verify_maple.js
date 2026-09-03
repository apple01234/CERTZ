/* v3.0.16 검증 — 메이플 컨텐츠 패치
 * ①세트 아이템 효과(스탯+UI) ②몬스터 컬렉션(등록·세이브·보너스 스탯·패널)
 * ③멀티킬 연출 ④필드 정예 몬스터(출현·처치 보상) ⑤퀘스트 보상 수령 팝업(와이어링+UI)
 * ⑥eert 등급 오라 ⑦M키 컬렉션 진입 ⑧버전 배지
 * 실행 중인 3000 서버에 접속 */
const { chromium } = require("playwright");

const URL = "http://127.0.0.1:3000";
const results = [];
const ok = (name, cond, detail = "") => {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
};

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
  /* v3.0.16 — 버전 배지는 타이틀 화면이 떠 있는 동안에만 존재 */
  const badge0 = await page.evaluate(() => document.body.innerText.includes("v3.0.18"));
  ok("버전 배지 v3.0.18", badge0); // v3.0.18 — 조이스틱-이속 수술 릴리스
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

async function gotoStage(page, st) {
  await page.evaluate((s) => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.scene.restart({ stage: s, fresh: true });
  }, st);
  await page.waitForTimeout(1700);
  await cleanDialogues(page);
  await page.waitForTimeout(400);
}

async function closePanels(page) {
  await page.evaluate(() => window.__SERTZ_EB__.emit("ui:panel", { panel: null }));
  await page.waitForTimeout(200);
}

(async () => {
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"] });
  let page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await enterWorld(page);

  /* ── ⑤-2 보상 팝업 UI 렌더 ── */
  await page.evaluate(() => {
    window.__SERTZ_EB__.emit("reward:show", {
      title: "퀘스트 완료 — 테스트",
      lines: [{ text: "골드 +99 G", color: "#ffd76a" }, { text: "경험치 +50 EXP", color: "#8fe84a" }],
    });
  });
  await page.waitForTimeout(300);
  const popupUI = await page.evaluate(() => document.body.innerText.includes("보상이 인벤토리에 지급되었습니다") && document.body.innerText.includes("골드 +99 G"));
  ok("보상 수령 팝업 UI", popupUI);
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const b = btns.find((x) => x.getAttribute("aria-label") === "보상 팝업 닫기");
    b?.click();
  });
  await page.waitForTimeout(200);

  /* ── ⑦ M키 → 컬렉션 패널 ── */
  await page.keyboard.press("m");
  await page.waitForTimeout(400);
  const colPanel = await page.evaluate(() => document.body.innerText.includes("몬스터 컬렉션") && document.body.innerText.includes("컬렉션 보너스"));
  ok("M키로 컬렉션 패널 열기", colPanel);
  const colCount = await page.evaluate(() => {
    const spans = [...document.querySelectorAll("span")].map((s) => s.innerText).filter((t) => t && /\d+\s*\/\s*\d+/.test(t));
    return { normal: document.body.innerText.includes("일반 몬스터 ("), boss: document.body.innerText.includes("보스 몬스터 ("), badge: spans.find((t) => /\/\s*43/.test(t)) ?? "none", all: spans.slice(0, 6) };
  });
  ok("컬렉션 도감 43종 구성", colCount.normal && colCount.boss && /\/\s*43/.test(colCount.badge), JSON.stringify(colCount));
  await closePanels(page);

  /* ── 스탯창 진입 버튼 ── */
  await page.evaluate(() => window.__SERTZ_EB__.emit("ui:panel", { panel: "stat" }));
  await page.waitForTimeout(300);
  const statBtn = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const b = btns.find((x) => x.innerText.includes("몬스터 컬렉션"));
    if (!b) return false;
    b.click();
    return true;
  });
  await page.waitForTimeout(300);
  const colOpen2 = await page.evaluate(() => document.body.innerText.includes("다음 목표:"));
  ok("스탯창 → 컬렉션 진입 버튼", statBtn && colOpen2);
  await closePanels(page);

  /* ── ② 컬렉션 등록 (처치 → 도감 + 세이브) ── */
  await gotoStage(page, "forest1");
  const colReg = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const before = Object.keys(w.monsterKills ?? {}).length;
    w.onEnemyKilled("wolf", 10, w.player.x + 180, w.player.y + 120);
    const after = Object.keys(w.monsterKills ?? {}).length;
    const saved = JSON.parse(window.localStorage.getItem("sertz_save_v2") ?? "{}");
    return { before, after, hasWolf: (w.monsterKills?.wolf ?? 0) >= 1, reg: w.player.collectionRegistered, savedWolf: (saved.monsterKills?.wolf ?? 0) >= 1 };
  });
  ok("몬스터 처치 → 컬렉션 등록", colReg.after === colReg.before + 1 && colReg.hasWolf && colReg.reg === colReg.after,
     `before=${colReg.before} after=${colReg.after} reg=${colReg.reg}`);
  ok("컬렉션 세이브 저장", colReg.savedWolf);

  /* ── ③ 멀티킬 연출 (1.5초 윈도 2연속 킬) ── */
  const multi = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const x = w.player.x + 220, y = w.player.y + 160;
    w.onEnemyKilled("wolf", 10, x, y);
    w.onEnemyKilled("spider", 10, x, y + 40);
    return { count: w.multiKillCount, until: w.multiKillUntil > w.time.now, meta: WorldScene_MULTI(w) };
    function WorldScene_MULTI(w2) { return Array.isArray(w2.constructor.MULTI_KILL_META) && w2.constructor.MULTI_KILL_META.length === 4; }
  });
  ok("멀티킬 카운트/윈도/등급 메타", multi.count >= 2 && multi.until && multi.meta,
     `count=${multi.count} window=${multi.until} meta4=${multi.meta}`);

  /* ── ④ 필드 정예 몬스터: 출현 → 처치 시 에메랄드 +1 ── */
  const elite = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    // 동시 몬스터 상한(20마리) 회피 — 기존 몹 비활성화
    for (const e of w.enemies) { e.alive = false; e.setActive(false); e.setVisible(false); }
    w.enemies = [];
    const orig = Math.random;
    Math.random = () => 0.001; // 4.5% 컷 통과 강제
    w.respawnEnemy("wolf", w.player.x + 240, w.player.y - 180, 0);
    Math.random = orig;
    const e = w.fieldEliteRef;
    if (!e) return { spawned: false };
    const disp = String(e.displayName ?? "");
    const hpMul = e.maxHp / 58; // 기본 wolf hp=58 대비 배율
    const em0 = w.player.emerald;
    const key = e.def.key;
    e.alive = false;
    w.onEnemyKilled(key, 10, e.x, e.y);
    return { spawned: true, disp, hpMul, emeraldGain: w.player.emerald - em0, cleared: w.fieldEliteRef === null };
  });
  ok("필드 정예 출현 (정예 이름·3.2배 HP)", elite.spawned === true && elite.disp.startsWith("정예") && elite.hpMul >= 3,
     `disp=${elite.disp ?? "-"} hpMul≈${elite.hpMul ? elite.hpMul.toFixed(1) : "-"}`);
  ok("정예 처치 → 에메랄드 +1", elite.emeraldGain === 1 && elite.cleared, `gain=${elite.emeraldGain}`);

  /* ── ① 세트 아이템 효과: 장착 → 활성 + 스탯 반영 + UI 카드 ── */
  const setFx = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const p = w.player;
    p.owned.push("sfw_forest", "sfa_forest", "sfr_forest");
    const atk0 = p.atkTotal, def0 = p.defTotal, hp0 = p.maxHp;
    p.equip("sfw_forest"); p.equip("sfa_forest"); p.equip("sfr_forest");
    const active = p.activeSet;
    const atk1 = p.atkTotal, def1 = p.defTotal, hp1 = p.maxHp;
    const lines = [];
    if (active) {
      if (active.bonus.atkPct) lines.push(`공격력 +${active.bonus.atkPct}%`);
      if (active.bonus.defAdd) lines.push(`방어력 +${active.bonus.defAdd}`);
      if (active.bonus.maxHp) lines.push(`최대 HP +${active.bonus.maxHp}`);
    }
    // 세이브에 bonusHpApplied 반영 확인용 반환
    return {
      ch: active?.ch ?? null, lines,
      atkUp: atk1 > atk0, defUp: def1 > def0, hpUp: hp1 > hp0,
      atk0, atk1, def0, def1, hp0, hp1,
    };
  });
  ok("세트 장착 → 활성 판정", setFx.ch === "forest", `ch=${setFx.ch}`);
  ok("세트 스탯 반영 (공격%/방어/HP)", setFx.atkUp && setFx.defUp && setFx.hpUp,
     `atk ${setFx.atk0}→${setFx.atk1}, def ${setFx.def0}→${setFx.def1}, hp ${setFx.hp0}→${setFx.hp1}`);

  /* ── ⑥ eert 등급 오라 + 세트 효과 UI (인벤토리 패널 DOM) ── */
  await page.evaluate(() => {
    const p = window.__SERTZ__.game.scene.getScene("world").player;
    p.potentials["sfw_forest"] = { grade: 3, lines: [{ k: "atk", v: 3 }, { k: "crit", v: 3 }, { k: "maxHp", v: 75 }] };
    p.syncPotentialsHp();
    window.__SERTZ_EB__.emit("ui:panel", { panel: "inv" });
  });
  await page.waitForTimeout(500);
  const invUI = await page.evaluate(() => {
    const txt = document.body.innerText;
    const glowing = [...document.querySelectorAll("div")].some((d) => d.getAttribute("style")?.includes("255, 138, 92") || d.getAttribute("style")?.includes("#ff8a5c"));
    return { setCard: txt.includes("세트 효과 활성 — 숲의 수호자 세트"), setLines: txt.includes("공격력 +3%"), aura: glowing };
  });
  ok("인벤 세트 효과 카드 (활성)", invUI.setCard && invUI.setLines);
  ok("eert 레전드 등급 오라 테두리", invUI.aura);
  await closePanels(page);

  /* ── ②-2 컬렉션 41종 → 보너스 스탯 (공격 +11% / HP +190 / 크리 +5%) ── */
  const colBonus = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const p = w.player;
    const ids = [...Object.keys(w.constructor && {} )]; // noop
    const mobs = ["wolf","minion","spider","golem","frostwolf","icegolem","wraith","swampbeast","emberwolf","firespirit","runegolem","helhound","x2_frog","x2_rat","x2_bat","x2_firebird","x2_frostfly","x2_snail","x2_stonegolem","x2_darkhound","x2_reeffish","x3_swampy","x3_imp","x3_icezombie","x3_tinyzombie","x3_ogre","x3_chort","x3_necromancer","x3_maskedorc","x3_orcwarrior","x3_orcshaman","x3_wogol","x3_goblin","x3_bigzombie"];
    const bosses = ["guardian","behemoth","abysslord","nidhog","surt","fenrir","skoll","gram","abudditos"];
    for (const m of mobs) w.monsterKills[m] = (w.monsterKills[m] ?? 0) + 1;
    for (const b of bosses) w.monsterKills[`boss_${b}`] = (w.monsterKills[`boss_${b}`] ?? 0) + 1;
    const atk0 = p.atkTotal;
    p.setCollection(Object.keys(w.monsterKills).length);
    return { reg: p.collectionRegistered, atk0, atk1: p.atkTotal, hp1: p.maxHp, crit1: p.critRate };
  });
  ok("컬렉션 43종 등록(41전체+기존) → 공격% 상승", colBonus.reg >= 41 && colBonus.atk1 > colBonus.atk0,
     `reg=${colBonus.reg} atk ${colBonus.atk0}→${colBonus.atk1}`);

  /* ── ⑤-1 advanceQuest 보상 팝업 와이어링 (forest1 f0: 골드 40) ── */
  await gotoStage(page, "forest1");
  const rewardWire = await page.evaluate(() => new Promise((resolve) => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const eb = window.__SERTZ_EB__;
    let captured = null;
    const on = (v) => { captured = v; };
    eb.on("reward:show", on);
    const q = w.stageDef.quests[w.questIdx];
    w.advanceQuest();
    setTimeout(() => {
      eb.off("reward:show", on);
      resolve({ qReward: q?.reward ?? null, title: captured?.title ?? null, lines: captured?.lines?.length ?? 0 });
    }, 300);
  }));
  ok("advanceQuest → 보상 팝업 이벤트", rewardWire.qReward > 0 && (rewardWire.title ?? "").includes("퀘스트 완료") && rewardWire.lines >= 1,
     `reward=${rewardWire.qReward} title="${rewardWire.title}" lines=${rewardWire.lines}`);

  /* ── rpg state에 collection/activeSet 포함 확인 ── */
  const rpgExt = await page.evaluate(() => new Promise((resolve) => {
    const eb = window.__SERTZ_EB__;
    let seen = null;
    const on = (v) => { if (!seen) seen = v; };
    eb.on("rpg:state", on);
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.lastRpgSig = null; // 시그니처 중복 emit 스킵 우회 — 강제 재발행
    w.emitRpgState();
    setTimeout(() => {
      eb.off("rpg:state", on);
      resolve({
        hasCol: !!seen?.collection && seen.collection.total === 43,
        hasSet: "activeSet" in (seen ?? {}),
      });
    }, 300);
  }));
  ok("rpg state 컬렉션/세트 필드", rpgExt.hasCol && rpgExt.hasSet, JSON.stringify(rpgExt));

  await page.screenshot({ path: "scripts/shot_v316_final.png" });

  console.log("\n===== SUMMARY =====");
  const pass = results.filter((r) => r.pass).length;
  console.log(`${pass}/${results.length} PASS`);
  if (errors.length) console.log("PAGE ERRORS:", errors.slice(0, 5));

  await browser.close();
  process.exit(results.every((r) => r.pass) && errors.length === 0 ? 0 : 1);
})().catch((e) => { console.error("FATAL", e); process.exit(2); });
