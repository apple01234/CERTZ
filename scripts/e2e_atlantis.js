/* 아뜰란티스 E2E — Phaser 타일맵/상성/진행 전체 검증
 *  [1] 부팅 — JSON 타일맵 11종 로드, 타이틀 UI
 *  [2] 시작/이동/전투 — 실이동 좌표 변화, 실공격 HP 감소
 *  [3] 상성 시스템 (RelicAffinitySystem) — 중립 1.0 / 카운터 2.2 / 라그나로크 0.6
 *  [4] 포탈 10기 · 월드 전환
 *  [5] 상자 · 화염결계(장착 통과) · 룬 퍼즐(순서/리셋) · 룬 보상 상자
 *  [6] 보스 4연전 — 보석/성물 드롭 · 스테이지 진행 · 아스가르드 개방
 *  [7] 라그나로크 격파 → 엔딩 → 새로 시작
 *  [8] 세이브/이어하기 (localStorage)
 *  [9] 본편 회귀 — / 타이틀 + 스핀오프 링크 클릭 → /atlantis 진입
 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");

const PORT = 3123;
const URL = `http://localhost:${PORT}`;
let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log(`  PASS — ${label}`); } else { fail++; console.log(`  FAIL — ${label}`); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let browser;
  const srv = spawn("node", ["server.js"], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production", PORT: String(PORT) }, stdio: "ignore" });
  try {
    await new Promise((res, rej) => {
      const t0 = Date.now();
      const ping = () => fetch(URL).then((r) => (r.ok ? res() : setTimeout(ping, 700))).catch(() => {
        if (Date.now() - t0 > 60000) rej(new Error("server boot timeout")); else setTimeout(ping, 700);
      });
      ping();
    });
    console.log("server up");

    browser = await chromium.launch({ args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on("pageerror", (e) => console.log("  [pageerror]", String(e).slice(0, 160)));

    const step = () => page.evaluate(() => window.__ATL_STEP);
    const G = () => page.evaluate(() => window.__ATL__?.G());
    const scene = () => page.evaluate(() => (window.__ATL__ ? { player: !!window.__ATL__.scene().player } : null));
    const ev = (fn, ...args) => page.evaluate(fn, ...args);

    const waitBoot = async () => {
      const t0 = Date.now();
      while (Date.now() - t0 < 30000) {
        if ((await step()) === "done") return true;
        await sleep(250);
      }
      return false;
    };
    const waitWorld = async (id) => {
      const t0 = Date.now();
      while (Date.now() - t0 < 15000) {
        const g = await G();
        if (g && g.world === id && (await step()) === "done") { await sleep(350); await ev(() => window.__ATL__?.god(true)); return true; }
        await sleep(200);
      }
      const g2 = await G(); const err = await page.evaluate(() => window.__ATL_ERR || null);
      console.log(`  [waitWorld timeout] want=${id} got=${g2?.world} err=${err ? String(err).slice(0, 200) : "none"}`);
      return false;
    };
    const ww = async (id) => { const r = await waitWorld(id); ok(r, `월드 전환 → ${id}`); return r; };
    const teleport = (x, y) => ev(({ tx, ty }) => {
      const s = window.__ATL__.scene();
      s.player.setPosition(tx, ty);
      s.player.body.reset(tx, ty);
    }, { tx: x, ty: y });
    const nearObj = (kind, id) => ev(({ k, i }) => {
      const s = window.__ATL__.scene();
      const it = s.interactables.find((t) => t.kind === k && t.obj.active !== false && (!i || String(t.data.id) === i || String(t.data.def?.id) === i));
      return it ? { x: it.obj.x, y: it.obj.y, hint: it.hint } : null;
    }, { k: kind, i: id });

    // ── [1] 부팅 ──
    console.log("\n[1] 부팅/타이틀");
    await page.goto(`${URL}/atlantis`, { waitUntil: "domcontentloaded" });
    ok(await waitBoot(), "부팅 완료 (__ATL_STEP=done)");
    ok((await page.getByText("새로운 모험").count()) > 0, "타이틀 UI 렌더");
    const maps = await ev(() => {
      const c = window.__ATL__.game.cache.json;
      const ids = ["hub","midgard","forest","alfheim","svartalf","nevada","niflheim","jotunheim","jormungand","muspelheim","asgard"];
      return ids.map((id) => { const m = c.get(`atlmap_${id}`); return { id, ok: !!m && m.grid?.length === m.rows && m.grid[0].length >= m.cols - 1 }; });
    });
    ok(maps.every((m) => m.ok), `JSON 타일맵 11종 로드+형양식 (${maps.filter(m=>m.ok).length}/11)`);
    ok(maps.length === 11, "JSON 타일맵 11종 개수");

    // ── [2] 시작/이동/전투 ──
    console.log("\n[2] 시작/이동/전투");
    await page.getByText("새로운 모험").click();
    await ww("midgard");
    const s1 = await scene();
    ok(s1 && s1.player, "월드 씬 + 플레이어 생성 (미드가르드)");
    const x0 = await ev(() => window.__ATL__.scene().player.x);
    await page.keyboard.down("KeyD"); await sleep(320);
    const vx = await ev(() => window.__ATL__.scene().player.body.velocity.x);
    await sleep(330); await page.keyboard.up("KeyD");
    await sleep(200);
    const x1 = await ev(() => window.__ATL__.scene().player.x);
    ok(vx > 10, `WASD 이동 — D키 홀드 시 velocity.x=${Math.round(vx)}`);
    ok(x1 > x0 + 4, `이동 변위 실측 (${Math.round(x0)} → ${Math.round(x1)})`);
    // 근접 몬스터 실공격
    const tgt = await ev(() => {
      const s = window.__ATL__.scene();
      const m = s.monsters.find((mm) => mm.active && !mm.dying);
      return m ? { uid: m.uid, hp: m.hp, x: m.x, y: m.y } : null;
    });
    if (tgt) {
      await teleport(tgt.x - 22, tgt.y);
      await sleep(150);
      await ev(() => window.__ATL__.attack());
      await sleep(250);
      const after = await ev((uid) => {
        const s = window.__ATL__.scene();
        const m = s.monsters.find((mm) => mm.uid === uid);
        return m ? { hp: m.hp, dying: m.dying } : { hp: 0, dying: true };
      }, tgt.uid);
      ok(after.dying || after.hp < tgt.hp, `실공격 HP 감소 (${tgt.hp} → ${after.dying ? "처치" : after.hp})`);
    } else ok(false, "미드가르드 몬스터 스폰");

    // ── [3] 상성 시스템 ──
    console.log("\n[3] 상성 시스템 (RelicAffinitySystem)");
    await ev(() => { window.__ATL__.give("sword"); window.__ATL__.equip("sword"); });
    const slime = await ev(() => {
      const s = window.__ATL__.scene();
      const m = s.monsters.find((mm) => mm.active && !mm.dying && mm.def.attr && mm.def.attr !== "gluttony");
      return m ? { key: m.def.key, attr: m.def.attr, mult: s.elementMult(m) } : null;
    });
    ok(slime && slime.mult === 1, `중립 판정 ×1.0 (${slime ? `${slime.key}[${slime.attr}]` : "대상 없음"})`);
    await ev(() => window.__ATL__.warp("forest"));
    await ww("forest");
    const gob = await ev(() => {
      const s = window.__ATL__.scene();
      const m = s.monsters.find((mm) => mm.active && !mm.dying && mm.def.attr === "gluttony");
      return m ? { key: m.def.key, mult: s.elementMult(m) } : null;
    });
    ok(gob && gob.mult === 2.2, `탐식↔절제의 검 카운터 ×2.2 (${gob ? gob.key : "대상 없음"})`);
    await ev(() => window.__ATL__.warp("asgard"));
    await ww("asgard");
    const ragna = await ev(() => {
      const s = window.__ATL__.scene();
      return s.boss ? s.elementMult(s.boss) : null;
    });
    ok(ragna === 0.6, `라그나로크 비카운터 ×0.6 (실측 ${ragna})`);

    // ── [4] 포탈/월드 전환 ──
    console.log("\n[4] 포탈/월드 전환");
    await ev(() => window.__ATL__.warp("hub"));
    await ww("hub");
    const portals = await ev(() => window.__ATL__.scene().interactables.filter((t) => t.kind === "portal").length);
    ok(portals === 10, `쿠소디아 포탈 10기 (실측 ${portals})`);
    ok((await G()).world === "hub", "월드 전환 상태 동기화");

    // ── [5] 상자/결계/룬 ──
    console.log("\n[5] 상자/결계/룬 퍼즐");
    await ev(() => window.__ATL__.warp("midgard"));
    await ww("midgard");
    const chest = await nearObj("chest", "mg_c1");
    if (chest) {
      await teleport(chest.x, chest.y); await sleep(200);
      ok((await ev(() => window.__ATL__.near())) === "chest", "상자 접근 힌트");
      await ev(() => window.__ATL__.interact()); await sleep(200);
      const g = await G();
      ok(g.potions >= 2 && g.flags.includes("chest_mg_c1"), "상자 개봉 → 포션 + 플래그");
    } else ok(false, "mg_c1 상자 존재");
    // 화염 결계 — 순결의 반지 장착 시 통과
    await ev(() => window.__ATL__.warp("nevada"));
    await ww("nevada");
    const gateBlocked = await ev(() => window.__ATL__.scene().gates.length > 0 && window.__ATL__.scene().gates[0].body.body.enable === true);
    ok(gateBlocked, "불길 결계 — 미장착 시 차단");
    await ev(() => { window.__ATL__.give("ring"); window.__ATL__.equip("ring"); });
    const gateOpen = await ev(() => window.__ATL__.scene().gates.every((gt) => gt.body.body.enable === false));
    ok(gateOpen, "불길 결계 — 순결의 반지 장착 시 전체 해제");
    // 룬 퍼즐 (b→g→r, 틀리면 리셋)
    await ev(() => window.__ATL__.warp("alfheim"));
    await ww("alfheim");
    const runeAt = async (id) => { const r = await nearObj("rune", id); await teleport(r.x, r.y); await sleep(180); await ev(() => window.__ATL__.interact()); await sleep(150); };
    const r1 = await nearObj("rune", "rune1");
    ok(!!r1, "룬석 3개 배치");
    await runeAt("rune2"); // 오답 먼저
    const stepAfterWrong = await ev(() => window.__ATL__.scene().runeStep);
    ok(stepAfterWrong === 0, "룬 오답 → 진행 리셋");
    await runeAt("rune1"); await runeAt("rune2"); await runeAt("rune3");
    const runesDone = await ev(() => window.__ATL__.G().flags.includes("runesDone"));
    ok(runesDone, "룬 정답 (b→g→r) → 룬의 비밀 개방");
    const ringChest = await nearObj("chest", "al_ring");
    if (ringChest) {
      await teleport(ringChest.x, ringChest.y); await sleep(200);
      await ev(() => window.__ATL__.interact()); await sleep(200);
      ok((await G()).relics.includes("ring"), "룬 보상 — 순결의 반지 상자 획득");
    } else ok(false, "al_ring 상자 생성");

    // ── [6] 보스 4연전 → 아스가르드 ──
    console.log("\n[6] 보스/보석/아스가르드 개방");
    await ev(() => { window.__ATL__.give("sword"); window.__ATL__.give("trident"); window.__ATL__.give("staff"); window.__ATL__.give("necklace");
      window.__ATL__.gem("light"); window.__ATL__.gem("dark"); window.__ATL__.gem("wave"); window.__ATL__.stage(4); });
    await ev(() => window.__ATL__.warp("forest"));
    await ww("forest");
    await ev(() => window.__ATL__.killBoss()); await sleep(400);
    let g = await G();
    ok(g.gems.includes("forest") && g.stage === 5 && g.flags.includes("b_nidhogg"), "니드호그 → 숲의 보석 + 스테이지 5");
    await ev(() => { window.__ATL__.stage(7); window.__ATL__.warp("nevada"); });
    await ww("nevada");
    await ev(() => window.__ATL__.killBoss()); await sleep(400);
    g = await G();
    ok(g.gems.includes("flame") && g.stage === 8, "수르트 → 화염의 보석 + 니플헤임 개방");
    await ev(() => { window.__ATL__.warp("niflheim"); });
    await ww("niflheim");
    await ev(() => window.__ATL__.killBoss()); await sleep(400);
    g = await G();
    ok(g.gems.includes("frost") && g.relics.includes("bow"), "펜리르 → 서리의 보석 + 희망의 활");
    await ev(() => window.__ATL__.warp("jotunheim"));
    await ww("jotunheim");
    await ev(() => window.__ATL__.killBoss()); await sleep(400);
    g = await G();
    ok(g.relics.includes("shield") && g.gems.includes("earth"), "돌거인 왕 → 겸손의 방패 + 대지의 보석");
    ok(g.flags.includes("asgard_open"), "성물 7 + 보석 7 → 아스가르드 포탈 개방");
    ok(g.relics.length === 7 && g.gems.length === 7, `수집 완료 — 성물 ${g.relics.length}/7 보석 ${g.gems.length}/7`);

    // ── [7] 라그나로크/엔딩 ──
    console.log("\n[7] 라그나로크 → 엔딩");
    await ev(() => { window.__ATL__.stage(10); window.__ATL__.warp("asgard"); });
    await ww("asgard");
    await ev(() => window.__ATL__.killBoss()); await sleep(500);
    ok((await page.getByText("세계는 다시 노래한다").count()) > 0, "엔딩 화면 렌더");
    await page.getByText("처음부터 다시").click();
    await ww("midgard");
    g = await G();
    ok(g.relics.length === 0 && g.stage === 0, "새로 시작 — 상태 초기화");

    // ── [8] 세이브/이어하기 ──
    console.log("\n[8] 세이브/이어하기");
    // 진행 만들기: 왕 대화 없이 훅으로 절제의 검 → 세이브
    await ev(() => { window.__ATL__.give("sword"); window.__ATL__.equip("sword"); window.__ATL__.stage(3); });
    await ev(() => window.__ATL__.warp("hub"));
    await ww("hub");
    const saveRaw = await page.evaluate(() => localStorage.getItem("sertz_atlantis_save_v1"));
    ok(!!saveRaw && JSON.parse(saveRaw).world === "hub" && JSON.parse(saveRaw).relics.includes("sword"), "localStorage 세이브 기록");
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitBoot();
    ok((await page.getByText("이어하기").count()) > 0, "재접속 → 이어하기 버튼");
    await page.getByText("이어하기").click();
    await ww("hub");
    g = await G();
    ok(g.world === "hub" && g.relics.includes("sword") && g.eq === "sword", "이어하기 — 월드/성물/장착 복원");

    // ── [9] 본편 회귀 ──
    console.log("\n[9] 본편 회귀");
    await page.goto(`${URL}/`, { waitUntil: "domcontentloaded" });
    await page.getByText("새로운 모험").first().waitFor({ timeout: 20000 });
    ok(true, "본편 타이틀 렌더");
    const link = page.getByText("아뜰란티스: 잠뜰의 인어").first();
    ok((await link.count()) > 0, "본편 → 스핀오프 링크 존재");
    await link.click();
    await page.waitForURL("**/atlantis", { timeout: 10000 });
    ok(page.url().includes("/atlantis"), "스핀오프 링크 → /atlantis 진입");
    ok(await waitBoot(), "아뜰란티스 재부팅 정상");

    console.log(`\n=== 결과: ${pass} PASS / ${fail} FAIL ===`);
    process.exitCode = fail ? 1 : 0;
  } catch (e) {
    console.error("E2E ERROR:", e);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    srv.kill("SIGKILL");
  }
})();
