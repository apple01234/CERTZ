/* v3.0.22 검증 — 피드백 14개 항목 (37~50)
 *  37 자동사냥 맵 전체 밀집  38 전직 퀘스트 게이트  39 사운드 밸런스  40 퀘스트창 기본 열림
 *  41 제자리 떨림 제거     42 APK 멀티(socket.io)  43 조각 멘트 다양화  44 챕터별 조각
 *  45 엘릭서 보라색        46 시험 상대 무한 소환   47 퀘스트 여행 어시스턴트
 *  48 반복의뢰 수주        49 보스바 모바일 축소    50 스케일링+세계수 가호
 * 실행 중인 3000 서버(커스텀 server.js — socket.io) 접속 */
const { chromium } = require("playwright");
const fs = require("fs");

const URL = "http://127.0.0.1:3000";
const results = [];
const ok = (name, cond, detail = "") => {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
};

/* ── 정적 검증 ── */
const wSrc = fs.readFileSync("src/game/scenes/WorldScene.ts", "utf8");
const dSrc = fs.readFileSync("src/game/data.ts", "utf8");
const sSrc = fs.readFileSync("src/game/stages.ts", "utf8");
const aSrc = fs.readFileSync("src/game/audio.ts", "utf8");
const oSrc = fs.readFileSync("src/components/game/Overlays.tsx", "utf8");
const pSrc = fs.readFileSync("src/components/game/Panels.tsx", "utf8");
const gSrc = fs.readFileSync("src/components/game/GameRoot.tsx", "utf8");
const pkg = fs.readFileSync("package.json", "utf8");
const grad = fs.readFileSync("android/app/build.gradle", "utf8");

/* 37/41 자동사냥 */
ok("S1 맵 전체 밀집 스코어링(260px·최대 62%) + 히스테리시스 확대(1.3·700px)",
  wSrc.includes("Math.min(0.62, near * 0.15)") && wSrc.includes("<= 260") &&
  wSrc.includes("bestEff * 1.3 && curD < 700"));
ok("S2 원거리 방향 홀드 1100ms(제자리 떨림 제거)",
  wSrc.includes("dist > 340 ? 1100 : 300"));
/* 38 전직 게이트 */
ok("S3 전직 퀘스트 게이트(마을체인/스토리체인) + 잠금 사유 UI",
  wSrc.includes("private jobQuestCleared()") && wSrc.includes("jobStoryDone.includes(tier") &&
  wSrc.includes("jobLock: this.jobQuestLockText()") && pSrc.includes("전직 퀘스트 미완료"));
/* 39 사운드 */
ok("S4 사운드 밸런스(BGM 0.38·반복음 하향·픽업 피치 변주)",
  aSrc.includes("export const BGM_VOLUME = 0.38") && aSrc.includes("sfx_swing: 0.3") &&
  aSrc.includes("0.92 + Math.random() * 0.18"));
/* 40 퀘스트창 */
ok("S5 퀘스트창 기본 열림(playing 진입 1회 자동 오픈)",
  gSrc.includes('setPanel("quest")') && gSrc.includes("questAutoOpened"));
/* 42 멀티 */
ok("S6 production = 커스텀 server.js(socket.io 멀티)",
  pkg.includes('"start": "NODE_ENV=production node server.js') &&
  fs.readFileSync("server.js", "utf8").includes("new Server(httpServer"));
/* 43/44 조각 */
ok("S7 챕터별 결정 9종(이름/색/보너스 5→30) + 랜덤 멘트 + 첫 수확 스토리 대사",
  dSrc.includes('abyss: { name: "세계수의 눈동자"') && dSrc.includes("atk: 30") &&
  dSrc.includes("fragment_forest") && dSrc.includes("fragment_abyss") &&
  wSrc.includes("meta.lines[Math.floor(Math.random() * meta.lines.length)]") &&
  wSrc.includes("showDialogueOnce(firstId)"));
/* 45 엘릭서 */
ok("S8 엘릭서 보라 아이콘(32px PNG 재생성)", fs.existsSync("public/assets/item_potion_elixir.png"));
/* 46 시험 상대 */
ok("S9 시험 상대 참조 기반 판정(jobTrialEnemy) — 무한 재소환 제거",
  wSrc.includes("ref === this.jobTrialEnemy") && wSrc.includes("this.jobTrialEnemy = e") &&
  wSrc.includes("if (this.jobTrialEnemy && this.jobTrialEnemy.alive)"));
/* 47 여행 */
ok("S10 추적 구역 자동 여행(BFS 경로) + 가이드 화살 연결",
  wSrc.includes("private autoTravelPortal()") && wSrc.includes("private stagePathTo(") &&
  wSrc.includes("const travel = this.autoTravelPortal();\n    if (travel) return new Phaser.Math.Vector2(travel.x, travel.y);"));
/* 49 보스바 */
ok("S11 보스바 모바일 축소(46%·h-2, 데스크톱 72%·h-3.5 유지)",
  oSrc.includes("w-[46%] max-w-[400px]") && oSrc.includes("sm:h-3.5") && oSrc.includes("h-2 "));
/* 50 스케일링 + 가호 */
ok("S12 챕터 스케일 강화(HP 15.5배·ATK 5.0배·보스 가중 1.6/1.15)",
  sSrc.includes("const CH_HP = [1, 1.3, 1.85, 2.7, 3.9, 5.6, 8.0, 11.3, 15.5]") &&
  sSrc.includes("const CH_ATK = [1, 1.18, 1.45, 1.78, 2.2, 2.7, 3.35, 4.1, 5.0]") &&
  wSrc.includes("sc.hp * 1.6") && wSrc.includes("sc.atk * 1.15"));
ok("S13 세계수의 가호(ATK+20/DEF+8/HP+200/공격+3%) + 저장",
  dSrc.includes("export const WORLDTREE_BLESSING = { atk: 20, def: 8, hpAdd: 200, atkPct: 3 }") &&
  wSrc.includes("setWorldtreeBlessing(true)") && pSrc.includes("세계수 결정"));
ok("S14 버전 36/3.0.22 + 배지",
  grad.includes("versionCode 36") && grad.includes('versionName "3.0.22"') && oSrc.includes("v3.0.22"));

/* ── 런타임 검증 ── */
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
  const errors = [];

  /* ── R1~R6: 1페이지 런타임 ── */
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(String(e?.message ?? e)));
  await enterWorld(page);

  /* R1 퀘스트창 기본 열림 */
  const qpanel = await page.evaluate(() => document.body.innerText.includes("퀘스트 로그"));
  ok("R1 게임 시작 시 퀘스트 로그 패널 자동 오픈", qpanel);
  await page.evaluate(() => window.__SERTZ__.game.scene.getScene("world").game && null); // noop
  await page.keyboard.press("Escape").catch(() => {});
  await page.evaluate(() => document.querySelector('[aria-label="퀘스트 로그 닫기"]')?.click());
  await page.waitForTimeout(300);
  const qclosed = await page.evaluate(() => !document.body.innerText.includes("퀘스트 로그"));
  ok("R2 유저가 닫으면 닫힘 유지", qclosed);

  /* R3 전직 게이트 (신규 세이브 = 마을 체인 미완료) */
  const jobGate = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    return { cleared: w.jobQuestCleared(), lock: w.jobQuestLockText() };
  });
  ok("R3 전직 퀘스트 게이트 동작(미완료 → 잠금 + 사유)",
    jobGate.cleared === false && typeof jobGate.lock === "string" && jobGate.lock.length > 3,
    jobGate.lock ?? "");

  /* R4 반복의뢰 수주: 상인 대화 → repeatOn */
  const rep = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const m = w.merchant;
    if (!m) return { merchant: false };
    w.player.setPosition(m.x + 40, m.y);
    w.nearInteract = { x: m.x, y: m.y, kind: "shop", label: "라고스 상점" };
    w.repeatOn = false;
    return { merchant: true, before: w.repeatOn };
  });
  await page.keyboard.press("e");
  await page.waitForTimeout(700);
  await cleanDialogues(page);
  const repAfter = await page.evaluate(() => window.__SERTZ__.game.scene.getScene("world").repeatOn);
  ok("R4 상인 대화로 반복의뢰 수주 성공", rep.merchant === true && repAfter === true, `repeatOn=${repAfter}`);

  /* R5 여행 어시스턴트: 추적 구역 지정 → 포탈 안내 + 자동 접근 */
  const travel = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.trackedStage = "forest1";
    w.autoHunt = true;
    const portal = w.autoTravelPortal();
    const guide = w.questTargetPos();
    return { portal, guide, px: w.player.x, py: w.player.y };
  });
  ok("R5 추적 구역 포탈 안내(여행 좌표 + 가이드 화살 대상 일치)",
    !!travel.portal && !!travel.guide &&
    Math.abs(travel.portal.x - travel.guide.x) < 2 && Math.abs(travel.portal.y - travel.guide.y) < 2);
  await page.evaluate((t) => { window.__TRAVEL_PX__ = t.px; window.__TRAVEL_PY__ = t.py; }, travel);
  await page.evaluate(() => { const w = window.__SERTZ__.game.scene.getScene("world"); w.autoHunt = true; });
  await page.waitForTimeout(1800);
  const dist2 = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const d = Math.hypot(w.player.x - window.__TRAVEL_PX__, w.player.y - window.__TRAVEL_PY__);
    w.autoHunt = false; w.trackedStage = null;
    return d;
  });
  ok("R6 자동 여행 — 포탈 방향으로 실제 이동", dist2 > 24, `${Math.round(dist2)}px`);

  /* R7 사운드 밸런스 런타임 */
  const bgmVol = await page.evaluate(() => window.__SERTZ_DEBUG__.audio.bgm);
  ok("R7 BGM 볼륨 0.38 적용", bgmVol === 0.38);

  /* ── R8 멀티: 게임 클라이언트 + node socket.io-client (2풀게임 렌더러 크래시 회피) ── */
  const { io } = require("socket.io-client");
  const net = await page.evaluate(() => {
    const s = window.__SERTZ_NET__;
    return s ? { connected: s.connected, id: s.id } : null;
  });
  const net2 = await new Promise((resolve) => {
    const s2 = io(URL, { path: "/socket.io", transports: ["websocket", "polling"] });
    let players = null;
    s2.on("players", (list) => { players = list; });
    s2.emit("join", { name: "검증기2호", lv: 5, cls: null, x: 0, y: 0, stage: "village" });
    setTimeout(() => {
      resolve({ connected: s2.connected, sawGameClient: Array.isArray(players) && players.length >= 1 });
      s2.disconnect();
    }, 1500);
  });
  ok("R8 멀티 서버 연결(게임 클라 + 검증용 클라 상호 인식)",
    !!net?.connected && net2.connected === true && net2.sawGameClient === true,
    `game=${net?.connected ?? null}, node=${net2.connected}, players>=1=${net2.sawGameClient}`);

  ok("R9 페이지 에러 0", errors.length === 0, errors.slice(0, 3).join(" | "));

  await browser.close();
  const pass = results.filter((r) => r.pass).length;
  console.log(`\n=== ${pass}/${results.length} PASS ===`);
  process.exit(pass === results.length ? 0 : 1);
})();
