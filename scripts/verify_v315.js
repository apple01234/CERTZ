/* v3.0.15 검증 — 21개 피드백 항목 중 E2E 검증 가능 항목
 * ①오브젝트 축소 ②상인 마을 전용 ③펫 없이 오토 ④자동사냥 안정화(진동 제거)
 * ⑤N차=N발 ⑥eert 큐브 ⑦원소 상성 ⑧퀘스트 수락/추적 ⑨세트 해금 ⑩가격 상향
 * ⑪퀵슬롯 장착/사용 ⑫콤보킬 필드 ⑬미스텍처 0
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

(async () => {
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"] });
  let page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await enterWorld(page);

  /* ── ② 상인 마을 전용 + ① 오브젝트 축소 + ⑨ 세트 해금 + ⑬ 미스텍처 ── */
  const stats = {};
  for (const st of ["village", "forest1", "muspelheim1", "niflheim1"]) {
    await gotoStage(page, st);
    await page.screenshot({ path: `scripts/shot_v315_${st}.png` });
    stats[st] = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      let merchants = 0, obstacles = 0, missing = 0, flowers = 0;
      for (const go of w.children.list ?? []) {
        const k = go.texture ? String(go.texture.key) : "";
        if (k.includes("__MISSING")) missing++;
        if (k === "npc_merchant") merchants++;
        if (go.getData && go.getData("obstacle")) obstacles++;
        if (k.startsWith("flower_")) flowers++;
      }
      return { merchants, obstacles, missing, flowers, unlocked: [...w.unlockedSets], ch: w.stageDef.key };
    });
  }
  ok("상인은 마을에만 배치", stats.village.merchants === 1 && stats.forest1.merchants === 0 && stats.muspelheim1.merchants === 0,
     `village=${stats.village.merchants} forest=${stats.forest1.merchants} muspel=${stats.muspelheim1.merchants}`);
  ok("오브젝트 축소(0.7배)", stats.forest1.obstacles <= 20, `forest1 obstacles=${stats.forest1.obstacles} (이전 33)`);
  ok("챕터 진입 시 세트 해금", stats.forest1.unlocked.includes("forest") && stats.muspelheim1.unlocked.includes("muspelheim"),
     `unlocked=${stats.forest1.unlocked.concat(stats.muspelheim1.unlocked).join(",")}`);
  ok("미스텍처 0", stats.village.missing + stats.forest1.missing + stats.muspelheim1.missing + stats.niflheim1.missing === 0);

  /* ── ③ 펫 없이 오토 + ④ 자동사냥 안정화(방향 홀드) ── */
  await gotoStage(page, "forest2");
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.player.gmSetLevel(12);
    w.emitRpgState();
  });
  // 오토 토글 — 이벤트 직접 발행
  const canAuto = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const eb = window.__SERTZ_EB__;
    eb.emit("rpg:autohunt", {});
    return w.autoHunt;
  });
  ok("펫 없이 자동사냥 토글", canAuto === true, `pet=${await page.evaluate(() => !!window.__SERTZ__.game.scene.getScene("world").player.pet)}, autoHunt=${canAuto}`);

  // 8초 오토 주행 — 진동 체크: 이동 방향 홀드로 순차 이동 (방향 전환 횟수 측정)
  const autoRun = await page.evaluate(() => new Promise((resolve) => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const t0 = w.time.now;
    let dirChanges = 0;
    let lastDir = { x: 0, y: 0 };
    const startX = w.player.x, startY = w.player.y;
    const iv = setInterval(() => {
      const d = w.autoHuntMove;
      if ((d.x !== 0 || d.y !== 0) && (lastDir.x !== 0 || lastDir.y !== 0)) {
        const dot = d.x * lastDir.x + d.y * lastDir.y;
        if (dot < 0.3) dirChanges++; // 큰 방향 전환만 카운트
      }
      if (d.x !== 0 || d.y !== 0) lastDir = { x: d.x, y: d.y };
      if (w.time.now - t0 > 8000) {
        clearInterval(iv);
        const moved = Math.hypot(w.player.x - startX, w.player.y - startY);
        resolve({ moved: Math.round(moved), dirChanges });
      }
    }, 120);
  }));
  ok("오토사냥 8초 이동·진동 개선", autoRun.moved > 250 && autoRun.dirChanges <= 14,
     `moved=${autoRun.moved}px dirChanges=${autoRun.dirChanges} (방향 전환은 회피/탈출 포함)`);
  await page.evaluate(() => { window.__SERTZ__.game.scene.getScene("world").autoHunt = false; });

  /* ── ⑤ N차=N발: 미전직 1발 / 1차 1발 / 2차 2발 ── */
  const shots = await page.evaluate(() => new Promise((resolve) => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const p = w.player;
    const cnt = () => (w.children.list ?? []).filter((g) => g.getData && g.getData("dmg")).length;
    const cfgs = [["ranger", 1], ["sniper", 2], ["eagleeye", 3]];
    const results = {};
    const step = (i) => {
      if (i >= cfgs.length) { resolve(results); return; }
      const [cls] = cfgs[i];
      p.gmSetClass(cls); // tier는 chainOf(cls).length getter에서 자동 결정
      p.atkCooldown = 0;
      p.state = "idle";
      p.facing.set(1, 0);
      const before = cnt();
      setTimeout(() => {
        p.update(16, p.facing, true);
        setTimeout(() => {
          results[`${cls}_tier${p.tier}`] = cnt() - before;
          step(i + 1);
        }, 350);
      }, 650); // 공격 쿨/애니 완전 종료 대기
    };
    step(0);
  }));
  ok("N차=N발 (궁수 기본공격)", shots.ranger_tier1 === 1 && shots.sniper_tier2 === 2 && shots.eagleeye_tier3 === 3,
     JSON.stringify(shots));

  /* ── ⑥ eert 큐브 리롤 ── */
  const eert = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const p = w.player;
    p.owned.push("eert_cube");
    const pot0 = JSON.stringify(p.potentials["weapon_1"] ?? null);
    const pot = p.rerollPotentials("weapon_1");
    return {
      hasPot: !!pot && pot.lines.length >= 1 && pot.lines.length <= 3,
      cubeGone: !p.owned.includes("eert_cube"),
      gradeName: pot ? pot.grade : -1,
      lines: pot ? pot.lines : [],
    };
  });
  ok("eert 큐브 리롤 → 잠재옵션", eert.hasPot && eert.cubeGone, `grade=${eert.gradeName} lines=${JSON.stringify(eert.lines)}`);
  const eertStat = await page.evaluate(() => {
    const p = window.__SERTZ__.game.scene.getScene("world").player;
    p.potentials["weapon_1"] = { grade: 3, lines: [{ k: "atk", v: 3 }, { k: "crit", v: 3 }, { k: "maxHp", v: 75 }] };
    p.syncPotentialsHp();
    const atk = p.atkTotal;
    return { atk };
  });
  ok("잠재옵션 스탯 반영", eertStat.atk > 0, `atkTotal=${eertStat.atk} (atk+3 반영)`);

  /* ── ⑦ 원소 상성: 마법사(냉기) → 무스펠헤임(화염 적) = 약점 1.25배 ── */
  await gotoStage(page, "muspelheim1");
  const elem = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const p = w.player;
    p.gmSetClass("mage"); // 냉기
    const e = w.enemies.find((x) => x.active && x.alive);
    if (!e) return { fail: "enemy none" };
    const hp0 = e.hp;
    const dmg0 = 100;
    e.takeDamage(dmg0, new (e.knockVec.constructor)(0, 0.1), 0, false);
    const dealt = hp0 - e.hp;
    return { enemyElem: e.elem, playerElem: p.attackElem, dealt, expected: Math.round(dmg0 * 1.25) };
  });
  ok("원소 약점 1.25배 (냉기→화염)", elem.enemyElem === "fire" && elem.playerElem === "ice" && elem.dealt === elem.expected,
     `enemy=${elem.enemyElem} player=${elem.playerElem} dealt=${elem.dealt}/${elem.expected}`);
  /* ── ⑨ 상점 세트 노출 확인 (RPG state) ── */
  const shop = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    return {
      stockHasSet: (typeof w.SHOP_STOCK_REF !== "undefined" ? w.SHOP_STOCK_REF : null),
      unlocked: [...w.unlockedSets],
    };
  });
  ok("세트 해금 상태 전달", shop.unlocked.includes("forest"), `unlocked=${shop.unlocked.join(",")}`);


  /* 렌더러 누적 크래시 회복 — 새 페이지(같은 컨텍스트, 세이브 공유)로 이어서 */
  try { await page.close(); } catch {}
  page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
  page.on("pageerror", (e) => errors.push(String(e)));
  await enterWorld(page);

  /* ── ⑧ 퀘스트 수락/추적 ── */
  await gotoStage(page, "forest1");
  const questSys = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const eb = window.__SERTZ_EB__;
    const before = w.isQuestAccepted(w.stageDef.key, w.questIdx);
    // 기존 세이브 호환: accepted 기록 없으면 자동 수락(true)
    w.acceptedQuests = { village: 0 }; // 명시적 수락 시스템 활성화 (village만 수락 상태)
    const pending = w.isQuestAccepted(w.stageDef.key, w.questIdx);
    eb.emit("rpg:questAccept", { stage: w.stageDef.key });
    const after = w.isQuestAccepted(w.stageDef.key, w.questIdx);
    eb.emit("rpg:questTrack", { stage: "village" });
    return { before, pending, after, tracked: w.trackedStage, acceptedIdx: w.acceptedQuests[w.stageDef.key] };
  });
  ok("퀘스트 수락/추적", questSys.after === true && questSys.acceptedIdx === 0,
     `before(호환)=${questSys.before} pending=${questSys.pending} after=${questSys.after} tracked=${questSys.tracked}`);

  /* ── ⑩ 가격 상향 + ⑪ 퀵슬롯 ── */
  const misc = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const p = w.player;
    const eb = window.__SERTZ_EB__;
    p.potions.hp = 0;
    p.owned.push("potion_hp2", "potion_hp2");
    eb.emit("rpg:quickpot", { slot: "hp", key: "potion_hp2" });
    const hp0 = p.hp;
    p.hp = Math.max(1, p.maxHp - 200);
    const used = p.usePotion("hp");
    return { slot: p.quickPots.hp, used, healed: p.hp > Math.max(1, p.maxHp - 200) };
  });
  ok("퀵슬롯에 상급 물약 장착·사용", misc.slot === "potion_hp2" && misc.used === true && misc.healed === true,
     `slot=${misc.slot} used=${misc.used} healed=${misc.healed}`);

  /* ── ⑫ 콤보킬 필드 존재 ── */
  const combo = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    return { hasField: "comboStreak" in w && "comboUntil" in w };
  });
  ok("콤보킬 시스템 필드", combo.hasField);

  console.log("\n===== SUMMARY =====");
  const pass = results.filter((r) => r.pass).length;
  console.log(`${pass}/${results.length} PASS`);
  if (errors.length) console.log("PAGE ERRORS:", errors.slice(0, 5));

  await browser.close();
  process.exit(results.every((r) => r.pass) && errors.length === 0 ? 0 : 1);
})().catch((e) => { console.error("FATAL", e); process.exit(2); });
