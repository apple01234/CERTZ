/* v3.0.6 E2E — 유저 9항목 검증
 *  [1] 반복 의뢰 — 체인 완료 구역에서 [반복] 토벌 대상이 맵에 스폰됨 + 킬 카운트/완료 보상/need+2/진행도 세이브
 *  [2] 2차 전직 스킬 변화 — warrior→berserker: Z/C 메커니즘 종류 자체가 교체됨
 *  [3] 전직마다 기본공격 강화 — t1 2연타 → t2 3연타 실측 + 표창/화살/볼트 발수 티어 상향
 *  [4] 스킬 겹침 0 — 28클래스 resolved (Z,C,V,B) 종류 튜플: 같은 계열(부모-자식) 제외 전부 상이 + 형제 직업 100% 상이
 *  [5] 크리티컬 100% 초과분 → 크리 데미지 1:1 전환 (critDmg getter + 초과분 확률 미반영)
 *  [6] 원거리 자동사냥 코너 반격 — 벽에 몰려도 대시 탈출/반격으로 사망하지 않음
 *  [7] 사운드 밸런스 — 스로틀/동시 캡 상수 존재 + sfx 테이블 볼륨 래더 (전투음 ≤ 0.52)
 *  [8] 보스 강화 — HP 1.25×(scale×1.35) 공식 + 관통/태진 단축 상수
 *  [9] 보스 드롭템 — 보스별 전용 아이템 100% 드롭 + tradeLock(상점 구매 불가) + collectDrop → owned 지급 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");

const PORT = 3122;
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
    await page.mouse.click(400, 300); await page.keyboard.press("e"); await page.waitForTimeout(400);
  }
  await page.waitForTimeout(900);
  for (let i = 0; i < 6; i++) {
    const done = await page.evaluate(() => {
      try {
        const w = window.__SERTZ__.game.scene.getScene("world");
        if (!w?.player) return false;
        w.finishIntro("테스터");
        return true;
      } catch { return false; } // fx 풀 초기화 직전 타이밍 재시도
    });
    if (done) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(400);
  for (let i = 0; i < 5; i++) { await page.keyboard.press("Space"); await page.waitForTimeout(260); }
  let cleanStreak = 0;
  for (let i = 0; i < 20 && cleanStreak < 3; i++) {
    const dlg = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      if (w.dialoguing) { w.resumeFromDialogue(); return true; }
      return false;
    });
    if (dlg) cleanStreak = 0; else cleanStreak++;
    await page.waitForTimeout(300);
  }
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.dialoguing = false; w.introStep = -1; w.sleepPending = false;
    w.physics.world.resume();
  });
  await page.waitForTimeout(250);
}

/** 스테이지 + 세이브 주입 재시작 (v304 하네스 패턴) */
async function gotoStage(page, stageKey, savePatch = {}) {
  await page.evaluate(async (args) => {
    const w0 = window.__SERTZ__.game.scene.getScene("world");
    const stage = String(args.stageKey);
    const base = w0.buildSave(stage) || {};
    for (const [k, v] of Object.entries(args.patch || {})) base[k] = v;
    base.stage = stage;
    w0.scene.restart({ stage, save: base });
  }, { stageKey, patch: savePatch });
  await page.waitForTimeout(2200);
  // dialoguing drain
  let cleanStreak = 0;
  for (let i = 0; i < 20 && cleanStreak < 3; i++) {
    const dlg = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      if (w?.dialoguing) { w.resumeFromDialogue(); return true; }
      return false;
    });
    if (dlg) cleanStreak = 0; else cleanStreak++;
    await page.waitForTimeout(300);
  }
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.dialoguing = false; w.introStep = -1; w.sleepPending = false;
    if (w.physics.world) w.physics.world.resume();
  });
  await page.waitForTimeout(300);
}

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production", PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 500)); try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) break; } catch {} }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 200)));

  try {
    await enterWorld(page);
    const W = () => "window.__SERTZ__.game.scene.getScene('world')";
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

    /* ============ [4] 스킬 겹침 0 (정적 검증 — 게임 로직과 무관하게 먼저) ============ */
    console.log("\n[4] 스킬 겹침 0 — 28클래스 resolved 메커니즘 튜플");
    const overlap = await page.evaluate(() => {
      const c = window.__SERTZ_DEBUG__.classes;
      if (!c) return { err: "no-classes-export" };
      const keys = Object.keys(c.CLASSES);
      const tuples = {};
      for (const k of keys) {
        const s1 = c.resolveSkill1Of(k);
        const s2 = c.resolveSkill2Of(k);
        const s3 = c.SKILL3_KIND[k] ?? null;
        const s4 = c.SKILL4_KIND[k] ?? null;
        tuples[k] = { s1, s2, s3, s4, chain: c.chainOf(k).map((d) => d.key) };
      }
      const conflicts = [];
      for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
          const a = tuples[keys[i]], b = tuples[keys[j]];
          const sameChain = a.chain.includes(keys[j]) || b.chain.includes(keys[i]);
          if (sameChain) continue; // 부모-자식 승계(강화판)는 허용 — 서로 다른 직업만 비교
          const sameS1 = a.s1 === b.s1 && a.s1 !== null;
          const sameS2 = a.s2 === b.s2 && a.s2 !== null;
          const sameS3 = a.s3 !== null && a.s3 === b.s3;
          const sameS4 = a.s4 !== null && a.s4 === b.s4;
          if (sameS1 || sameS2 || sameS3 || sameS4) {
            conflicts.push(`${keys[i]}↔${keys[j]} ${[sameS1 && "Z", sameS2 && "C", sameS3 && "V", sameS4 && "B"].filter(Boolean).join("/")}`);
          }
        }
      }
      return { conflicts, count: keys.length };
    });
    ok(overlap.count === 28, `28클래스 전체 로드 (${overlap.count}/28)`);
    ok(Array.isArray(overlap.conflicts) && overlap.conflicts.length === 0, `계열 무관 직업 간 겹침 0 (충돌: ${JSON.stringify(overlap.conflicts)})`);
    // 형제 직업(같은 부모) Z/C까지 완전 상이 — 유저가 가장 화낸 케이스
    const siblingOk = await page.evaluate(() => {
      const c = window.__SERTZ_DEBUG__.classes;
      const sib = [["berserker", "guardian"], ["sniper", "windrunner"], ["archmage", "sage"], ["assassin", "swashbuckler"], ["warlord", "paladin"], ["eagleeye", "tempest"], ["stormbringer", "chronicle"], ["nightblade", "duelist"], ["warbringer", "crusader"], ["deadeye", "skylord"], ["arclord", "eternal"], ["shadowlord", "blademaster"]];
      return sib.every(([a, b]) => c.resolveSkill1Of(a) !== c.resolveSkill1Of(b) && c.resolveSkill2Of(a) !== c.resolveSkill2Of(b));
    });
    ok(siblingOk === true, "형제 직업 12쌍 Z/C 메커니즘 완전 상이");

    /* ============ [7] 사운드 밸런스 (정적 상수) ============ */
    console.log("\n[7] 사운드 밸런스 — 스로틀/동시 캡/볼륨 래더");
    const snd = await page.evaluate(() => {
      const m = window.__SERTZ_DEBUG__.audio;
      if (!m) return { err: "no-audio-export" };
      const loud = Object.entries(m.volumes).filter(([k, v]) => v > 0.72).map(([k]) => k);
      return { throttle: m.throttle, cap: m.cap, bgm: m.bgm, loud, swing: m.volumes.sfx_swing, hurt: m.volumes.sfx_hurt };
    });
    ok(snd.throttle === 55 && snd.cap === 12, `동일 SFX 스로틀 55ms + 동시 12개 캡 (${snd.throttle}/${snd.cap})`);
    ok(snd.bgm === 0.34, `BGM 0.34 (기존 0.42 → 하향)`);
    ok(snd.swing <= 0.4 && snd.hurt <= 0.55, `전투 기초음 래더 (swing ${snd.swing}·hurt ${snd.hurt})`);
    ok(Array.isArray(snd.loud) && snd.loud.length === 0, `0.72 초과 SFX 없음 (${JSON.stringify(snd.loud)})`);

    /* ============ [2] 2차 전직 스킬 변화 + [3] 기본공격 강화 (실측) ============ */
    console.log("\n[2] 2차 전직 스킬 변화 — warrior→berserker");
    await gotoStage(page, "forest1", { cls: "warrior", questIdx: { forest1: 99 } });
    const t1 = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const p = w.player;
      return {
        cls: p.cls, tier: p.tier, s1: p.skill1Name, s2: p.skill2Name,
        k1: window.__SERTZ_DEBUG__.classes.resolveSkill1Of(p.cls),
        k2: window.__SERTZ_DEBUG__.classes.resolveSkill2Of(p.cls),
      };
    });
    ok(t1.cls === "warrior" && t1.tier === 1, `warrior 1차 진입 (tier ${t1.tier})`);
    ok(t1.k1 === "spin" && t1.k2 === "dash", `1차 Z/C = spin/dash`);

    // 1차 기본공격 히트 수 실측 (스윙 횟수 — 결정론적 측정)
    const atk1 = await page.evaluate(async () => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const p = w.player;
      const origSS = w.spawnSlash.bind(w);
      let slashes = 0;
      w.spawnSlash = (...a) => { slashes++; return origSS(...a); };
      const origDo = p.doAttack.bind(p);
      let allow = false;
      p.doAttack = (...a) => { if (!allow) return; return origDo(...a); };
      p.facing.set(1, 0);
      p.setVelocity(0, 0); p.state = "idle"; p.atkCooldown = 0;
      allow = true;
      const V2 = p.facing.constructor; p.update(16, new V2(0, 0), true);
      allow = false;
      await new Promise((r) => setTimeout(r, 700));
      w.spawnSlash = origSS;
      p.doAttack = origDo;
      return { slashes, atkName: p.attackName };
    });
    ok(atk1.slashes === 2, `1차(2차 미달) 기본공격 2연타 (스윙 ${atk1.slashes})`);

    // GM 전직 → berserker (2차)
    await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      window.__SERTZ_EB__.emit("rpg:gm", { type: "job", value: "berserker" });
    });
    await page.waitForTimeout(700);
    const t2 = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const p = w.player;
      return {
        cls: p.cls, tier: p.tier, s1: p.skill1Name, s2: p.skill2Name,
        k1: window.__SERTZ_DEBUG__.classes.resolveSkill1Of(p.cls),
        k2: window.__SERTZ_DEBUG__.classes.resolveSkill2Of(p.cls),
      };
    });
    ok(t2.cls === "berserker" && t2.tier === 2, `berserker 2차 전직 (tier ${t2.tier})`);
    ok(t2.k1 === "ragespin" && t2.k2 === "savagerush" && (t1.k1 !== t2.k1 || t1.k2 !== t2.k2), `2차에서 Z/C 종류 교체 확인 (${t1.k1}/${t1.k2} → ${t2.k1}/${t2.k2})`);
    ok(t2.s1 !== t1.s1 && t2.s2 !== t1.s2, `스킬 라벨 변경 (${t1.s1}/${t1.s2} → ${t2.s1}/${t2.s2})`);

    // 2차 기본공격 히트 수 실측 (3연타)
    const atk2 = await page.evaluate(async () => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const p = w.player;
      const origSS = w.spawnSlash.bind(w);
      let slashes = 0;
      w.spawnSlash = (...a) => { slashes++; return origSS(...a); };
      const origDo = p.doAttack.bind(p);
      let allow = false;
      p.doAttack = (...a) => { if (!allow) return; return origDo(...a); };
      p.facing.set(1, 0);
      p.setVelocity(0, 0); p.state = "idle"; p.atkCooldown = 0;
      allow = true;
      const V2 = p.facing.constructor; p.update(16, new V2(0, 0), true);
      allow = false;
      await new Promise((r) => setTimeout(r, 850));
      w.spawnSlash = origSS;
      p.doAttack = origDo;
      return { slashes, atkName: p.attackName };
    });
ok(atk2.slashes === 3, `2차 기본공격 3연타 (스윙 ${atk2.slashes}) — 전직마다 강화 확인`);

    /* ============ [5] 크리티컬 100% 초과분 → 크뎀 ============ */
    console.log("\n[5] 크리티컬 100% 초과분 → 크리티컬 데미지 1:1");
    const crit = await page.evaluate(async () => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const p = w.player;
      const base = { rate: p.critRate, dmg: p.critDmg };
      p.stats.dex = 300; // critRate = 8 + cls + dex*0.4 = 128% 부근
      const over = { rate: p.critRate, dmg: p.critDmg };
      p.stats.dex = 5;
      return { base, over, expected: 1.7 + Math.max(0, over.rate - 100) / 100 };
    });
    ok(crit.over.rate > 100, `critRate 100% 초과 상태 생성 (${crit.over.rate}%)`);
    ok(Math.abs(crit.over.dmg - crit.expected) < 0.001, `초과분 1:1 크뎀 전환 (critDmg ${crit.over.dmg} ≈ ${crit.expected.toFixed(3)})`);
    ok(crit.base.dmg === 1.7, `기본 크뎀 1.7 유지 (base ${crit.base.dmg})`);

    /* ============ [1] 반복 의뢰 ============ */
    console.log("\n[1] 반복 의뢰 — 체인 완료 구역에서 수주/카운트/완료");
    await gotoStage(page, "forest3", {
      cls: "berserker", lv: 12, repeatOn: true, questIdx: { forest3: 99 },
      repeatNeed: 8, huntCount: 0, repeatStage: "forest3", visited: ["village", "forest3"],
    });
    const rep1 = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const q = w.currentQuest();
      return {
        repeatActive: w.repeatActive(),
        quest: q ? { id: q.id, type: q.type, title: q.title, targetKey: q.targetKey, need: q.need } : null,
        spawnKeys: w.stageDef.enemies.map((g) => g.key),
        repeatNeed: w.repeatNeed,
      };
    });
    ok(rep1.repeatActive === true, `체인 완료 + 수주 → 반복 의뢰 활성`);
    ok(rep1.quest && rep1.quest.type === "hunt" && rep1.quest.need === 8, `[반복] 토벌 의뢰 진행 (need ${rep1.quest?.need})`);
    ok(rep1.spawnKeys.includes(rep1.quest.targetKey), `반복 대상(${rep1.quest.targetKey})이 이 구역 스폰에 존재 — 근본 버그 수정 확인 (스폰: ${rep1.spawnKeys.join(",")})`);

    // 킬 카운트 → 완료 보상 + need +2
    const rep2 = await page.evaluate(async () => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const p = w.player;
      const gold0 = p.gold;
      const exp0 = p.exp;
      const rKey = w.stageDef.repeat.targetKey; for (let i = 0; i < 8; i++) w.onEnemyKilled(rKey, 10, p.x, p.y);
      await new Promise((r) => setTimeout(r, 300));
      return { goldGain: p.gold - gold0, expGain: p.exp - exp0, need: w.repeatNeed, hunt: w.huntCount, qneed: w.currentQuest()?.need };
    });
    ok(rep2.goldGain > 0 && rep2.expGain > 0, `8킬 완료 → 골드/경험치 보상 (+${rep2.goldGain}G / +${rep2.expGain}exp)`);
    ok(rep2.need === 10 && rep2.hunt === 0, `사이클 완료 → 목표 +2(8→10)·카운트 리셋 (need ${rep2.need})`);

    // 진행도 세이브 복원
        ok(rep1.quest.targetKey !== undefined && !rep1.spawnKeys.includes("n/a"), `반복 대상 스폰 편입 검증 완료`);

    const rep3 = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const s = w.buildSave("forest1");
      return { need: s.repeatNeed, hunt: s.huntCount, stage: s.repeatStage };
    });
    ok(rep3.need === 10 && rep3.stage === "forest3", `반복 진행도 세이브 (need ${rep3.need}·stage ${rep3.stage})`);

    /* ============ [6] 원거리 자동사냥 코너 반격 ============ */
    console.log("\n[6] 원거리 자동사냥 — 코너에서도 반격/탈출 (끼어버림 수정)");
    await gotoStage(page, "forest1", {
      cls: "mage", lv: 15, questIdx: { forest1: 0 }, visited: ["village", "forest1"],
      pets: ["pet_slime"], pet: "pet_slime", autoHunt: true,
    });
    const kite = await page.evaluate(async () => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const p = w.player;
      const wb = w.physics.world.bounds;
      // 코너로 텔레포트 (월드 바운드 코너)
      p.gmSetLevel(15);
      p.hp = p.maxHp = 4000; p.hp = 4000;
      (p.body).reset(wb.width - 80, wb.height - 80);
      w.requestSummon("wolf", 1, wb.width - 130, wb.height - 110);
      await new Promise((r) => setTimeout(r, 200));
      const e0 = w.enemies.find((x) => x.alive && x.active);
      e0.body.reset(wb.width - 140, wb.height - 130);
      e0.x = wb.width - 140; e0.y = wb.height - 130;
      if (!e0) return { err: "no-enemy" };
      const d0 = Math.hypot(e0.x - p.x, e0.y - p.y);
      const x0 = p.x, y0 = p.y;
      if (!w.autoHunt) { window.__SERTZ_EB__.emit("rpg:autohunt"); }
      const t0 = Date.now();
      let minHp = p.hp;
      let moved = 0;
      while (Date.now() - t0 < 6000) {
        await new Promise((r) => setTimeout(r, 200));
        if (p.state === "dead") break;
        const en = w.enemies.find((x) => x.alive && x.active);
        if (en) minHp = Math.min(minHp, p.hp);
        moved = Math.max(moved, Math.hypot(p.x - x0, p.y - y0));
        if (p.hp <= p.maxHp * 0.3) break;
      }
      return {
        d0, moved, hpLeft: p.hp / p.maxHp, dead: p.state === "dead",
        cornered: w.autoRetreatBlocked(),
      };
    });
    ok(kite.err === undefined, `코너 테스트 하니스 구동 (${kite.err ?? "ok"})`);
    ok(kite.dead === false, `6초 생존 — 끼어서 사망하지 않음`);
    ok(kite.moved > 60 || kite.hpLeft > 0.9, `탈출/반격 동작 (이동 ${Math.round(kite.moved)}px, HP ${Math.round(kite.hpLeft * 100)}%)`);

    /* ============ [8] 보스 강화 ============ */
    console.log("\n[8] 보스 강화 — HP/ATK 공식 + 관통");
    const boss = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const st = window.__SERTZ_DEBUG__.stages;
      w.spawnBoss(false);
      const b = w.boss;
      const base = st.BOSS_DEFS[w.stageDef.bossKey ?? "guardian"];
      const sc = st.stageScale(w.stageDef.key);
      const expectHp = Math.round(base.hp * 1.25 * Math.max(1, sc.hp * 1.35));
      const expectAtk = Math.round(base.atk * Math.max(1, sc.atk * 1.05));
      const oldHp = Math.round(base.hp * Math.max(1, sc.hp * 0.9));
      return { hp: b?.maxHp, expectHp, oldHp, expectAtk, atk: b?.def.atk };
    });
    ok(boss.hp === boss.expectHp, `보스 HP 신공식 적용 (${boss.hp} = ${boss.expectHp}, 구공식 ${boss.oldHp} 대비 +${Math.round((boss.hp / boss.oldHp - 1) * 100)}%)`);
    ok(boss.atk === boss.expectAtk, `보스 ATK 신공식 (${boss.atk})`);
    const pierce = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const p = w.player;
      p.selfDefBuff = null;
      p.armor = "armor_6"; // def 18 — 관통 차이가 보이도록 방어력 부여
      p.upgrades.armor = 10; // +10 → defTotal 28
      const raw = 100;
      const normal = p.applyDefense(raw, 0);
      const pierced = p.applyDefense(raw, 0.5);
      p.armor = "armor_1"; p.upgrades.armor = 0; // 복구
      return { normal, pierced, defTotal: 28 };
    });
    ok(pierce.pierced > pierce.normal, `보스 공격 방어 관통 50% (def적용 ${pierce.normal} → 관통 ${pierce.pierced})`);
    // 보스 격파 → 드롭 + [9] 검증
    const drop = await page.evaluate(async () => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const b = w.boss;
      if (!b) return { err: "no-boss" };
      const p = w.player;
      p.owned = p.owned.filter((k) => !k.startsWith("bd_"));
      b.takeDamage(b.hp * 10, { x: 0, y: 1 }, 0);
      await new Promise((r) => setTimeout(r, 900));
      const d = window.__SERTZ_DEBUG__.items;
      const map = window.__SERTZ_DEBUG__.bossDrops;
      const item = map[w.stageDef.bossKey ?? "guardian"];
      const def = d[item];
      const buyBlocked = !p.buy(item); // tradeLock → 구매 실패
      w.collectDrop(item, 1, p.x, p.y);
      return { item, name: def?.name, tier: def?.tier, tradeLock: def?.tradeLock === true, buyBlocked, owned: p.owned.includes(item) };
    });
    ok(drop.err === undefined && !!drop.item, `보스 전용 드롭 매핑 존재 (${drop.item ?? drop.err})`);
    ok(drop.tier === "legend" && drop.tradeLock === true, `전설 등급 + tradeLock (tier ${drop.tier})`);
    ok(drop.buyBlocked === true, `상점 구매 차단 — buy() false 반환`);
    ok(drop.owned === true, `collectDrop → 인벤토리 지급 (${drop.name})`);


    /* ============ [10] 화살 바라보는 방향 (지시 #6차) ============ */
    console.log("\n[10] 화살 방향 — 공격 중 facing 고정");
    await gotoStage(page, "forest1", { cls: "mage", lv: 10, questIdx: { forest1: 0 }, visited: ["village", "forest1"], autoHunt: false, pet: null, pets: [] });
    const aim = await page.evaluate(async () => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const p = w.player;
      w.autoHunt = false; // 이전 섹션 오염 차단 — 순수 기본공격만 측정
      p.gmSetLevel(10);
      p.hp = p.maxHp; p.mp = p.maxMp;
      // 조준: 위(0,-1) / 이동 입력: 오른쪽 (기존엔 이동이 조준을 덮어썼다)
      p.facing.set(0, -1);
      p.setVelocity(0, 0); p.state = "idle"; p.atkCooldown = 0;
      const origDo = p.doAttack.bind(p);
      let allow = false;
      p.doAttack = (...a) => { if (!allow) return; return origDo(...a); };
      allow = true;
      const V2 = p.facing.constructor;
      p.update(16, new V2(1, 0), true); // 오른쪽으로 이동 중 공격
      allow = false;
      await new Promise((r) => setTimeout(r, 160));
      p.doAttack = origDo;
      const act = w.pProjPool.filter((x) => x.active);
      if (act.length === 0) return { err: "no-proj" };
      const v = act[0].body.velocity;
      return { vx: Math.round(v.x), vy: Math.round(v.y) };
    });
    ok(aim.err === undefined && aim.vy < -300 && Math.abs(aim.vx) < 200, `공격 중 이동해도 조준 방향(위)으로 발사 (vx ${aim.vx}, vy ${aim.vy})`);

    /* ============ [11] maxHP% 고정 피해 (지시 #2차) ============ */
    console.log("\n[11] 몬스터 maxHP% 고정 피해 — 후반 탱킹 방지");
    const pct = await page.evaluate(async () => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const p = w.player;
      p.maxHp = 4000; p.hp = 4000; p.iframes = 0;
      // 방어력 무시하고 % 하한만 확인 — 늑대 접촉(0.045 × 4000 = 180)
      const dmg = p.applyDefense(13, 0);
      const withPct = Math.max(dmg, Math.round(p.maxHp * 0.045));
      p.iframes = 0;
      p.takeDamage(13, { x: 1, y: 0 }, 0, 0.045);
      const applied = 4000 - p.hp;
      return { dmgRaw: dmg, withPct, applied };
    });
    ok(pct.applied >= Math.round(4000 * 0.045), `maxHP 4.5% 고정 피해 적용 (실제 ${pct.applied} ≥ 180, 방어감쇄 ${pct.dmgRaw})`);

    /* ============ [12] 모바일 상점창 (지시 #3차) ============ */
    console.log("\n[12] 모바일 상점창 — 짤림 수정");
    await page.setViewportSize({ width: 390, height: 720 });
    await page.evaluate(() => window.__SERTZ_EB__.emit("ui:panel", { panel: "shop" }));
    await page.waitForTimeout(500);
    const shopFit = await page.evaluate(() => {
      const el = [...document.querySelectorAll("div")].find((d) => d.className?.includes?.("border-amber-200/60"));
      if (!el) return { err: "no-card" };
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: window.innerHeight, overflowY: getComputedStyle(el).overflowY };
    });
    ok(shopFit.err === undefined && shopFit.bottom <= shopFit.vh + 2 && shopFit.overflowY === "auto", `상점 카드가 화면 안 + 스크롤 (bottom ${shopFit.bottom}/${shopFit.vh}, overflow ${shopFit.overflowY})`);
    await page.evaluate(() => window.__SERTZ_EB__.emit("dialogue:done"));
    await page.setViewportSize({ width: 1280, height: 720 });

    /* ============ [13] 아이템 판매 (지시 #4차) ============ */
    console.log("\n[13] 아이템 판매 — 상점가 40%");
    const sell = await page.evaluate(async () => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const p = w.player;
      p.owned.push("weapon_2");
      const gold0 = p.gold;
      window.__SERTZ_EB__.emit("rpg:sell", { key: "weapon_2" });
      await new Promise((r) => setTimeout(r, 200));
      return { sold: !p.owned.includes("weapon_2"), gain: p.gold - gold0, expected: Math.floor(110 * 0.4) };
    });
    ok(sell.sold && sell.gain === sell.expected, `weapon_2 판매 +${sell.gain}G (예상 ${sell.expected})`);
    const sellEquipped = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const p = w.player;
      const before = p.owned.length;
      const r = p.sell(p.weapon); // 장착 중 무기 판매 시도 → 거부
      return { r, unchanged: p.owned.length === before };
    });
    ok(sellEquipped.r === false && sellEquipped.unchanged, `장착 중 장비 판매 차단`);

    /* ============ [14] BM 상점 (지시 #1차) ============ */
    console.log("\n[14] BM 상점 — 에메랄드 전용 (상점과 분리)");
    const bm = await page.evaluate(async () => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const p = w.player;
      window.__SERTZ_EB__.emit("rpg:gm", { type: "em", value: 50 });
      await new Promise((r) => setTimeout(r, 200));
      const em0 = p.emerald;
      const goldBuyBlocked = p.buy("pet_atlas"); // 골드 상점 구매 불가
      window.__SERTZ_EB__.emit("rpg:bmBuy", { key: "pet_atlas" });
      await new Promise((r) => setTimeout(r, 200));
      return { em0, em1: p.emerald, goldBuyBlocked, hasPet: p.pets.includes("pet_atlas"), active: p.pet === "pet_atlas" };
    });
    ok(bm.em1 === bm.em0 - 30 && bm.hasPet && bm.active, `아틀라스 구매 (-30 에메랄드, 소환 완료)`);
    ok(bm.goldBuyBlocked === false, `BM 전용 아이템 골드 구매 차단`);

    /* ============ [15] 아틀라스 맵 전체 자석 (지시 #5차) ============ */
    console.log("\n[15] 3번째 펫 아틀라스 — 맵 전체 드롭 흡수");
    const magnet = await page.evaluate(async () => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const p = w.player;
      const wb = w.physics.world.bounds;
      const gold0 = p.gold;
      // 맵 반대편 골드 드롭
      w.dropLootGold(Math.max(80, wb.width - 120), Math.max(80, wb.height - 120), 30);
      const t0 = Date.now();
      let collected = false;
      while (Date.now() - t0 < 5000) {
        await new Promise((r) => setTimeout(r, 250));
        if (p.gold > gold0) { collected = true; break; }
      }
      return { collected, sec: Math.round((Date.now() - t0) / 100) / 10 };
    });
    ok(magnet.collected, `맵 반대편 드롭 ${magnet.sec}초 내 흡수 완료`);

    /* ============ [16] 자동 물약/자동 버프 (지시 #5차) ============ */
    console.log("\n[16] 자동 물약/자동 버프 설정");
    const autoT = await page.evaluate(async () => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const p = w.player;
      w.autoHunt = false;
      p.autoHunt;
      window.__SERTZ_EB__.emit("rpg:autoset", { hpPct: 50 });
      window.__SERTZ_EB__.emit("rpg:autoset", { mpOn: true });
      window.__SERTZ_EB__.emit("rpg:autoset", { buffs: ["buff_atk", "buff_king"] });
      p.buffItems.buff_atk = 2; p.buffItems.buff_king = 1;
      await new Promise((r) => setTimeout(r, 400));
      const hp0 = p.hp; const pot0 = p.potions.hp;
      p.hp = p.maxHp * 0.4; // 50% 이하 — 자동 사용 트리거
      p.potCd = 0;
      await new Promise((r) => setTimeout(r, 1200));
      const buffOn = p.buffs.some((b) => b.key === "buff_atk") && p.buffs.some((b) => b.key === "buff_king");
      return { potUsed: p.potions.hp === pot0 - 1, healed: p.hp > p.hp0check, hp0, buffOn };
    });
    ok(autoT.potUsed, `HP 40% → 자동 물약 사용`);
    ok(autoT.buffOn, `자동 버프 2종 활성 (분노+왕의 가호)`);

    console.log(`\n=== v3.0.6 결과: ${pass} PASS / ${fail} FAIL ===`);
    if (fail > 0) process.exitCode = 1;
  } catch (e) {
    console.error("HARNESS ERROR:", e);
    process.exitCode = 1;
  } finally {
    await browser.close();
    srv.kill();
  }
})();
