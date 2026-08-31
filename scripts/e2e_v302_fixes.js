/* v3.0.2 E2E — 15항목 수정 검증
 *  [1] 이동 애니메이션 — 정지→같은 방향 재입력 시 걷기 애니 재시작
 *  [2] 접속 메세지 — 맵 이동마다 재공지 없음 (소켓당 1회)
 *  [3] 몬스터 캡 20 — 정예/보스 구역 포함 총량
 *  [4] 퀘스트-스폰 일치 — hunt 대상이 실제 스폰 조합에 존재
 *  [5] 전직 스킬 라벨 변경 + 1차 전직 스토리 자동 시작 + 트래커 병기
 *  [6] 신규 몬스터 스폰 (7~8구역 신규 종 주력)
 *  [7] 던전 벽 — 벽돌 텍스처 적용 확인 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");

const PORT = 3116;
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
    // v3.0.3 — 대사 강제 종료 시 physics.world.pause() 잔존 방지 (정식 종료 경로 사용)
    if (w.dialoguing) w.resumeFromDialogue();
    w.dialoguing = false; w.introStep = -1; w.sleepPending = false;
    w.physics.world.resume();
  });
  await page.waitForTimeout(300);
}

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: process.cwd(), env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 500)); try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) break; } catch {} }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 200)));

  try {
    console.log("[1] 이동 애니메이션 — 같은 방향 재입력 재시작");
    await enterWorld(page);
    const anim1 = await page.evaluate(async () => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const p = w.player;
      // 오른쪽 이동 (autoHuntMove 경유 대신 키 이벤트 — 실제 입력 경로)
      return await new Promise((resolve) => {
        const states = [];
        const iv = setInterval(() => states.push({ playing: p.anims.isPlaying, key: p.anims.currentAnim?.key ?? null }), 80);
        window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyD", keyCode: 68, bubbles: true }));
        setTimeout(() => {
          window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyD", keyCode: 68, bubbles: true }));
          // 정지 (애니 stop + setTexture) — 500ms 대기
          setTimeout(() => {
            const idleSnap = { playing: p.anims.isPlaying, key: p.anims.currentAnim?.key ?? null };
            // 같은 방향 재입력
            window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyD", keyCode: 68, bubbles: true }));
            setTimeout(() => {
              const reSnap = { playing: p.anims.isPlaying, key: p.anims.currentAnim?.key ?? null };
              clearInterval(iv);
              window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyD", keyCode: 68, bubbles: true }));
              resolve({ idleSnap, reSnap });
            }, 350);
          }, 500);
        }, 350);
      });
    });
    ok(anim1.reSnap.playing && (anim1.reSnap.key ?? "").startsWith("hero-walk"), `정지→재입력 애니 재시작 (${JSON.stringify(anim1.reSnap)})`);

    console.log("[2] 접속 메세지 — 소켓당 1회");
    // Bob 접속 (page2) — Alice(page)가 이후 맵 이동 시 재공지 없어야 함
    const page2 = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.evaluate(() => {
      window.__chatLog = [];
      window.__SERTZ_EB__.on("chat:msg", (m) => window.__chatLog.push(m.text ?? m.msg ?? ""));
    });
    await enterWorld(page2);
    await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const carry = w.buildSave("forest2");
      w.scene.restart({ stage: "forest2", save: carry });
    });
    await page.waitForTimeout(2000);
    const joins = await page.evaluate(() => (window.__chatLog || []).filter((t) => String(t).includes("접속했습니다")).length);
    ok(joins <= 1, `Bob 접속 공지 1회 (이동 후 재공지 없음) — ${joins}건`);
    await page2.close();

    console.log("[3] 몬스터 캡 20 — 정예/보스 포함");
    await restartWith(page, "forest5", { lv: 8 });
    const capElite = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      return { total: w.getAllTargets().length, elite: !!(w.eliteEnemy && w.eliteEnemy.alive) };
    });
    ok(capElite.total <= 20 && capElite.total >= 19, `5구역(정예) 총량 ${capElite.total}/20 (정예 포함=${capElite.elite})`);
    await restartWith(page, "forest10", { lv: 10 });
    const capBoss = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      return { total: w.getAllTargets().length, boss: !!(w.boss && w.boss.alive) };
    });
    ok(capBoss.total <= 20 && capBoss.total >= 19, `10구역(보스) 총량 ${capBoss.total}/20 (보스 포함=${capBoss.boss})`);

    console.log("[4] 퀘스트-스폰 일치");
    await restartWith(page, "forest6", { lv: 9 });
    const qMatch = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const pool = new Set(w.stageDef.enemies.map((g) => g.key));
      if (w.stageDef.bossKey) pool.add(w.stageDef.bossKey);
      const hunts = w.stageDef.quests.filter((q) => q.type === "hunt");
      return hunts.map((q) => ({ id: q.id, target: q.targetKey, ok: pool.has(q.targetKey) }));
    });
    ok(qMatch.length > 0 && qMatch.every((q) => q.ok), `forest6 hunt 대상 전부 스폰 조합에 존재 (${JSON.stringify(qMatch.map((q) => q.target))})`);
    await restartWith(page, "kingdom3", { lv: 12 });
    const qMatch2 = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const pool = new Set(w.stageDef.enemies.map((g) => g.key));
      const hunts = w.stageDef.quests.filter((q) => q.type === "hunt");
      return hunts.every((q) => pool.has(q.targetKey));
    });
    ok(qMatch2, "kingdom3 hunt 대상 일치 (기존 불일치 구역)");

    console.log("[5] 전직 스킬 라벨 + 스토리 자동 시작");
    await restartWith(page, "village", { lv: 12, cls: null, jobStory: null, jobStoryDone: [] });
    await page.evaluate(() => window.__SERTZ_EB__.emit("job:select", { key: "warrior" }));
    await page.waitForTimeout(1200);
    const after1 = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      return { atk: w.player.attackName, s1: w.player.skill1Name, story: w.jobStory?.tier ?? null };
    });
    ok(after1.atk === "강화 참격", `1차 전직 라벨 — ${after1.atk}`);
    ok(after1.story === 1, "1차 전직 스토리 자동 시작");
    // 2차 — 버서커 (Lv30 필요)
    await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      w.player.lv = 30;
      w.player.gainExp(1); // 레벨 동기화
      window.__SERTZ_EB__.emit("job:select", { key: "berserker" });
    });
    await page.waitForTimeout(500);
    const after2 = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      return { atk: w.player.attackName, s1: w.player.skill1Name, s2: w.player.skill2Name, story: w.jobStory?.tier ?? null };
    });
    ok(after2.atk === "광폭 연타" && after2.s1 === "파괴의 회전베기", `2차 전직 라벨 변경 — ${after2.atk} / ${after2.s1}`);
    // 트래커 병기 확인
    const tracker = await page.evaluate(async () => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      return await new Promise((resolve) => {
        const h = (v) => { resolve(v.jobStory ?? null); };
        window.__SERTZ_EB__.on("quest", h);
        w.emitQuest();
        setTimeout(() => resolve(null), 800);
      });
    });
    ok(!!tracker && tracker.step >= 1, `트래커 전직 스토리 병기 — ${tracker ? `${tracker.step}/${tracker.total} ${tracker.stepTitle}` : "none"}`);

    console.log("[6] 신규 몬스터 스폰 (7구역 신규 종 주력)");
    await restartWith(page, "forest7", { lv: 11 });
    const newMon = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const counts = {};
      for (const e of w.getAllTargets()) {
        const k = e.def?.key ?? e.enemyKey ?? "?";
        counts[k] = (counts[k] ?? 0) + 1;
      }
      return counts;
    });
    const frog = Object.keys(newMon).find((k) => k.includes("x2_frog")) ?? Object.keys(newMon).find((k) => k.startsWith("x2_"));
    ok(!!frog, `신규 몬스터 스폰 — ${JSON.stringify(newMon)}`);

    console.log("[7] 던전 벽 벽돌 텍스처");
    await restartWith(page, "cave1", { lv: 30 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: "scripts/v302-dungeon.png" });
    const brick = await page.evaluate(() => {
      // Phaser 3.90 TileSprite는 내부 텍스처 키를 UUID로 생성하므로 키 매칭 불가.
      // 검증: 벽 TileSprite 존재 + x2_bricks 소스 텍스처 로드 + 스크린샷 육안(별도)
      const w = window.__SERTZ__.game.scene.getScene("world");
      const g = w.game;
      const walls = w.solidGroup.getChildren().filter((c) => c.constructor.name === "TileSprite");
      return { walls: walls.length, texExists: g.textures.exists("x2_bricks") };
    });
    ok(brick.walls > 0 && brick.texExists, `던전 벽 벽돌 — 벽 TileSprite ${brick.walls}개, x2_bricks 소스=${brick.texExists} (스크린샷 육안 확인)`);

    await page.screenshot({ path: "scripts/v302-final.png" });
  } finally {
    await browser.close().catch(() => {});
    srv.kill();
  }
  console.log(`\n=== v3.0.2: ${pass} PASS / ${fail} FAIL ===`);
  process.exit(fail > 0 ? 1 : 0);
})();
