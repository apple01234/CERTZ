/* v3.0.20 검증 — 신규 10개 항목
 *  #1 스카이로드 구름색 화살  #2 타일 선 제거  #3 MP 자동사용 %  #4 자동사냥 밀집 선호
 *  #5 이터널 노랑 기본공격   #6 근접 직업별 검기색  #7 물약 판매+엘릭서
 *  #8 스타포스 1성당 성장    #9 eert 큐브 BM전용/5000G  #10 BGM 16트랙 로테이션
 * 실행 중인 3000 서버 접속 */
const { chromium } = require("playwright");
const fs = require("fs");

const URL = "http://127.0.0.1:3000";
const results = [];
const ok = (name, cond, detail = "") => {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
};

/* ── 소스 정적 검증 ── */
const dSrc = fs.readFileSync("src/game/data.ts", "utf8");
const pSrc = fs.readFileSync("src/game/entities/Player.ts", "utf8");
const wSrc = fs.readFileSync("src/game/scenes/WorldScene.ts", "utf8");
const aSrc = fs.readFileSync("src/game/audio.ts", "utf8");
const panSrc = fs.readFileSync("src/components/game/Panels.tsx", "utf8");
const bSrc = fs.readFileSync("src/game/scenes/BootScene.ts", "utf8");
const oSrc = fs.readFileSync("src/components/game/Overlays.tsx", "utf8");
const cSrc = fs.readFileSync("src/game/config.ts", "utf8");
const eSrc = fs.readFileSync("src/components/game/EventBus.ts", "utf8");
const gSrc = fs.readFileSync("scripts/gen_floor_tiles.py", "utf8");

/* #8 스타포스 */
ok("S1 스타포스 본당 상승 헬퍼(무기 +2+8% / 방어 +1+6%+HP12)",
  dSrc.includes("export function starPerStarAtk") && dSrc.includes("itemAtk * 0.08") && dSrc.includes("itemDef * 0.06") && dSrc.includes("hp: 12 }"));
ok("S1 마일스톤 대폭 상향(무기 8/14/24·치명 3/6/12 / 방어구 1/3/6·HP 80/160/220)",
  dSrc.includes("5: { atk: 8, crit: 3 }") && dSrc.includes("10: { atk: 14, crit: 6 }") && dSrc.includes("15: { atk: 24, crit: 12 }") &&
  dSrc.includes("5: { def: 1, hp: 80 }") && dSrc.includes("15: { def: 6, hp: 220 }"));
ok("S1 atkTotal/defTotal/syncStarHp 본당 반영",
  pSrc.includes("starPerStarAtk(ITEMS[this.weapon].atk ?? 0) * this.upgrades.weapon") &&
  pSrc.includes("starPerStarDef(ITEMS[this.armor].def ?? 0).def * this.upgrades.armor") &&
  pSrc.includes("starPerStarDef(ITEMS[this.armor].def ?? 0).hp * this.upgrades.armor"));

/* #7 엘릭서 */
ok("S2 엘릭서 아이템(400G·epic·healFull) + 상점 재고 등록",
  dSrc.includes("potion_elixir: { key: \"potion_elixir\"") && dSrc.includes("name: \"엘릭서\"") && dSrc.includes("healFull: true") &&
  dSrc.includes("\"potion_elixir\", // v3.0.20 (#7) — 엘릭서"));
ok("S2 엘릭서 사용 경로(usePotion 퀵슬롯 + useConsumablePotion + rpg:useItem)",
  pSrc.includes("item.healFull ? this.restoreAll()") && pSrc.includes("\"potion_hp2\" | \"potion_mp2\" | \"potion_elixir\"") &&
  wSrc.includes("key === \"potion_elixir\""));
ok("S2 물약 판매(sellPotion 카운터/owned 분기 + rpg:sellPotion + 판매 버튼)",
  pSrc.includes("sellPotion(key: \"potion_hp\" | \"potion_mp\"") && wSrc.includes("rpg:sellPotion") &&
  panSrc.includes("rpg:sellPotion"));

/* #9 eert */
ok("S3 eert BM 전용(bmPrice 8) + 판매 5000G + 골드 상점 제외",
  dSrc.includes("eert_cube: { key: \"eert_cube\"") && /eert_cube: \{[^}]*bmOnly: true/.test(dSrc) &&
  /eert_cube: \{[^}]*sellPrice: 5000/.test(dSrc) &&
  !dSrc.includes("\"eert_cube\", // v3.0.15 (#13) — 잠재옵션 리롤 큐브"));
ok("S3 sellValue sellPrice 우선 + 배너 문구 BM 전환",
  dSrc.includes("if (item.sellPrice) return item.sellPrice;") && wSrc.includes("eert 큐브가 없습니다 (BM 상점 8💎)"));
ok("S3 eert 큐브 '마시기' 제거 → 장비에서 사용 안내",
  panSrc.includes("장비에서 사용") && panSrc.includes("{isEertCube ? ("));

/* #10 BGM */
const bgmKinds = ["field", "boss", "title", "village", "alfheim", "cave", "snow", "abyss"];
ok("S4 BGM 변주 로테이션(8종 × 제2트랙 + 78s 크로스페이드)",
  bgmKinds.every((k) => aSrc.includes(`bgm_${k}2`)) && aSrc.includes("BGM_ROTATE_MS") && aSrc.includes("fadeBgm"));
ok("S8 BootScene 로드: bgm 8종 + x2_arrow_sky + item_potion_elixir",
  bgmKinds.every((k) => bSrc.includes(`"bgm_${k}2"`)) && bSrc.includes("x2_arrow_sky") && bSrc.includes("item_potion_elixir"));

/* #1/#5/#6 클래스 색상 */
ok("S5 스카이로드 구름색 화살(기본공격+일제사격)",
  pSrc.includes("isSkylord ? \"x2_arrow_sky\"") && pSrc.includes("this.cls === \"skylord\" ? \"x2_arrow_sky\" : \"x2_arrow\""));
ok("S5 이터널 기본공격/유도뢰 노랑(0xffdf6e/0xffc94a)",
  pSrc.includes("this.cls === \"eternal\" ? 0xffdf6e : 0xffffff") && pSrc.includes("this.cls === \"eternal\" ? 0xffc94a : 0xffffff"));
ok("S5 데드아이 초록 화살 회귀 유지(클래스키 판정)",
  pSrc.includes("isDeadeye ? \"x2_arrow_green\""));
const meleeClasses = ["warrior", "berserker", "guardian", "warlord", "paladin", "warbringer", "crusader", "thief", "assassin", "swashbuckler", "nightblade", "duelist", "shadowlord", "blademaster"];
ok("S5 근접 14클래스 검기 색 맵 + 참격/파동 적용",
  meleeClasses.every((c) => pSrc.includes(`${c}: 0x`)) && pSrc.includes("meleeSlashTint()") && pSrc.includes("tint: slashTint ?? 0xffb08a"));

/* #2 타일 */
ok("S6 타일 선 제거(grid_bevel 호출 0 + 연속 노이즈 밝기)",
  !gSrc.includes("grid_bevel(px)") && !gSrc.includes("def grid_bevel") && gSrc.includes("n_cell[y][x] * 0.05"));

/* #3 MP % */
ok("S6/S7 MP 자동사용 % (타입+로드+onAutoSet+UI 사이클+tick)",
  cSrc.includes("mpPct?: number") && eSrc.includes("mpPct?: number") && wSrc.includes("mpPct: savedPlayer.autoUse.mpPct") &&
  wSrc.includes("mpPct: v.mpPct") && panSrc.includes("자동 MP 물약 —") && pSrc.includes("cfg.mpPct > 0 ? cfg.mpPct : cfg.mpOn ? 25 : 0"));

/* #4 밀집 선호 */
ok("S6 자동사냥 밀집 가중(220px당 12%·최대 45% + 히스테리시스)",
  wSrc.includes("densityEff") && wSrc.includes("near * 0.12") && wSrc.includes("Math.min(0.45, near * 0.12)") &&
  wSrc.includes("densityEff(curT, curD)"));

/* #9 배지 */
ok("S9 타이틀 배지 v3.0.20", oSrc.includes("v3.0.20"));

/* PNG 크기 헤더 검증 (IHDR width) */
function pngWidth(path) {
  const b = fs.readFileSync(path);
  return b.readUInt32BE(16);
}
ok("R1a 타일 8종 256px + x2_arrow_sky/엘릭서 아이콘 존재",
  ["tile_grass", "tile_dark", "tile_magma", "tile_snow", "tile_cave", "tile_stone", "tile_hel", "tile_abyss"].every((t) => pngWidth(`public/assets/${t}.png`) === 256) &&
  pngWidth("public/assets/x2_arrow_sky.png") === 28 && fs.existsSync("public/assets/item_potion_elixir.png"));

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

(async () => {
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await enterWorld(page);

  const bgmKindsLite = ["field", "boss", "title", "village", "alfheim", "cave", "snow", "abyss"];

  /* R1b 런타임 리소스 */
  const res = await page.evaluate((kinds) => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const tex = (k) => !!w.textures.exists(k);
    const audio = kinds.map((k) => w.cache.audio.exists(`bgm_${k}2`));
    return {
      tile256: w.textures.get("tile_grass").getSourceImage().width === 256,
      skyArrow: tex("x2_arrow_sky"), elixir: tex("item_potion_elixir"),
      bgm8: audio.every(Boolean), greenArrow: tex("x2_arrow_green"),
    };
  }, bgmKindsLite).catch(() => null);
  ok("R1b 런타임: tile_grass 256 + sky 화살/엘릭서 텍스처 + bgm 2세대 8종 캐시",
    res && res.tile256 && res.skyArrow && res.elixir && res.bgm8 && res.greenArrow, JSON.stringify(res));

  /* R2 #1 스카이로드 하늘색 화살 */
  const skyArrow = await page.evaluate(async () => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const p = w.player;
    p.cls = "skylord"; p.atkCooldown = 0; p.state = "idle";
    w.spawnMerchant = () => {};
    p.doAttack();
    await new Promise((r) => setTimeout(r, 260));
    const found = w.children.list.some((o) => o.texture && o.texture.key === "x2_arrow_sky" && o.active);
    return found;
  });
  ok("R2 #1 스카이로드 기본공격 → x2_arrow_sky 발사 실측", skyArrow);

  /* R3 #5 이터널 노랑 볼트 */
  const eternalYellow = await page.evaluate(async () => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const p = w.player;
    p.cls = "eternal"; p.atkCooldown = 0; p.state = "idle";
    p.doAttack();
    await new Promise((r) => setTimeout(r, 260));
    const found = w.children.list.some((o) => o.active && ((o.tintTopLeft ?? 0) >>> 0) === 0xffdf6e);
    return found;
  });
  ok("R3 #5 이터널 마법탄 tint 0xffdf6e (노랑) 실측", eternalYellow);

  /* R4 #6 버서커 검기 붉은색 */
  const berserkerRed = await page.evaluate(async () => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const p = w.player;
    p.cls = "berserker"; p.atkCooldown = 0; p.state = "idle";
    p.doAttack();
    await new Promise((r) => setTimeout(r, 120));
    const found = w.children.list.some((o) => o.active && ((o.tintTopLeft ?? 0) >>> 0) === 0xff5c4a);
    return found;
  });
  ok("R4 #6 버서커 참격 검기 tint 0xff5c4a (혈색) 실측", berserkerRed);

  /* R5 #7 엘릭서 + 물약 판매 */
  const elixirTest = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const p = w.player;
    p.owned.push("potion_elixir");
    p.hp = Math.floor(p.maxHp * 0.1); p.mp = Math.floor(p.maxMp * 0.1);
    const okUse = p.useConsumablePotion("potion_elixir");
    const full = p.hp === p.maxHp && p.mp === p.maxMp;
    const consumed = !p.owned.includes("potion_elixir");
    // 물약 판매 — 기본 HP 물약 12G (30의 40%)
    const g0 = p.gold; p.potions.hp += 5;
    const sellBefore = p.potions.hp;
    const okSell = p.sellPotion("potion_hp");
    return { okUse, full, consumed, okSell, gain: p.gold - g0, hpLeft: p.potions.hp, sellBefore };
  });
  ok("R5 #7 엘릭서 100% 회복+소모 실측", elixirTest && elixirTest.okUse && elixirTest.full && elixirTest.consumed, JSON.stringify(elixirTest));
  ok("R5 #7 물약 판매 +12G·카운터 차감 실측", elixirTest && elixirTest.okSell && elixirTest.gain === 12 && elixirTest.hpLeft === elixirTest.sellBefore - 1, `gain=${elixirTest && elixirTest.gain} hp ${elixirTest && elixirTest.sellBefore}→${elixirTest && elixirTest.hpLeft}`);

  /* R6 #8 스타포스 본당 성장 실측 */
  const starTest = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const p = w.player;
    if (!p.owned.includes("weapon_6")) p.owned.push("weapon_6");
    p.weapon = "weapon_6";
    p.upgrades.weapon = 3;
    const a3 = p.atkTotal;
    p.upgrades.weapon = 4;
    const a4 = p.atkTotal;
    const wAtk = 38; // weapon_6
    const expected = 2 + Math.round(wAtk * 0.08); // = 5
    // 방어구 — 기본 장비 기준
    const armorDef = (window.__SERTZ__ ? null : null);
    p.upgrades.armor = 2;
    const d2 = p.defTotal;
    p.upgrades.armor = 3;
    const d3 = p.defTotal;
    const hp2 = p.maxHp; p.syncStarHp(); const hp3 = p.maxHp;
    return { a3, a4, delta: a4 - a3, expected, dDelta: d3 - d2, hpDelta: hp3 - hp2 };
  });
  ok("R6 #8 무기 ★3→★4 atkTotal +5(구 +2 대비) 실측", starTest.delta === starTest.expected, `delta=${starTest.delta} expected=${starTest.expected}`);
  ok("R6 #8 방어구 ★0→★3 본당 방어 3회·HP 36 동기화 실측", starTest.dDelta === 1 && starTest.hpDelta === 36, `defΔ=${starTest.dDelta} hpΔ=${starTest.hpDelta}`);

  /* R7 #9 eert 1개 소모 */
  const eertTest = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const p = w.player;
    if (!p.owned.includes("eert_cube")) p.owned.push("eert_cube");
    const before = p.owned.filter((k) => k === "eert_cube").length;
    const pot = p.rerollPotentials(p.weapon);
    const after = p.owned.filter((k) => k === "eert_cube").length;
    return { before, after, gotPot: !!pot, grade: pot ? pot.grade : -1 };
  });
  ok("R7 #9 eert 큐브 1개 소모 + 잠재옵션 재추첨 실측",
    eertTest.before === 1 && eertTest.after === 0 && eertTest.gotPot, JSON.stringify(eertTest));

  /* R8 #3 MP % 설정 */
  const mpPctSet = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.player.setAutoUse({ mpPct: 50, mpOn: false }); // UI는 rpg:autoset 이벤트로 동일 경로
    return w.player.autoUse.mpPct;
  });
  ok("R8 #3 MP 자동사용 50% 설정 반영", mpPctSet === 50);

  /* R9 이동 회귀 */
  const moveDist = await page.evaluate(async () => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const dirs = [[1, 0], [-1, 0], [0, -1], [0, 1]];
    let best = 0;
    for (const [dx, dy] of dirs) {
      w.touchMove.set(dx, dy);
      const sx = w.player.x, sy = w.player.y;
      await new Promise((r) => setTimeout(r, 1000));
      best = Math.max(best, Math.hypot(w.player.x - sx, w.player.y - sy));
      w.touchMove.set(0, 0);
      await new Promise((r) => setTimeout(r, 120));
      if (best >= 250) break;
    }
    return Math.round(best);
  });
  ok("R9 이동 회귀 ≥ 250px/s (v3.0.18 이속 유지)", moveDist >= 250, `${moveDist}px/s`);

  ok("R10 pageerror 0", errors.length === 0, errors.slice(0, 3).join(" | "));

  await browser.close();
  const pass = results.filter((r) => r.pass).length;
  console.log(`\n=== ${pass}/${results.length} PASS ===`);
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => { console.error("FATAL", e); process.exit(2); });
