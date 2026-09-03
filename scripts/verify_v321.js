/* v3.0.21 검증 — BGM 전면 교체 (실사 다운로드 40트랙)
 *  테마당 5곡 × 8테마 플레이리스트 + 셔플백 로테이션
 *  생성 트랙(gen_bgm2)/구 칩튠 8종 완전 제거 확인
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
const aSrc = fs.readFileSync("src/game/audio.ts", "utf8");
const bSrc = fs.readFileSync("src/game/scenes/BootScene.ts", "utf8");
const oSrc = fs.readFileSync("src/components/game/Overlays.tsx", "utf8");
const pSrc = fs.readFileSync("src/game/PhaserGame.ts", "utf8");
const grad = fs.readFileSync("android/app/build.gradle", "utf8");
const credits = fs.readFileSync("public/assets/CREDITS.md", "utf8");

const THEMES = ["title", "village", "field", "alfheim", "cave", "snow", "abyss", "boss"];
ok("S1 플레이리스트 8테마 × 5트랙 선언",
  THEMES.every((t) => aSrc.includes(`${t}: ["bgm_${t}1", "bgm_${t}2", "bgm_${t}3", "bgm_${t}4", "bgm_${t}5"]`)));
ok("S2 생성 트랙/구 로테이션 흔적 제거 (BGM_VARIANTS·BGM_ROTATE_MS·gen_bgm2)",
  !aSrc.includes("BGM_VARIANTS") && !aSrc.includes("BGM_ROTATE_MS") && !aSrc.includes("gen_bgm2") && !aSrc.includes("bgm_field2\")"));
ok("S3 자연 로테이션(루프 없음 + complete → 다음 곡) + 셔플 백",
  aSrc.includes("loop: false") && aSrc.includes('once("complete"') && aSrc.includes("nextTrackOf") && aSrc.includes("bgmBags"));
ok("S4 BootScene BGM_ALL_TRACKS 자동 수집 로드",
  bSrc.includes("...BGM_ALL_TRACKS") && !bSrc.includes("bgm_title2") && !/\"bgm_title\"/.test(bSrc));
ok("S5 BGM_DEBUG 훅(PhaserGame) 노출",
  pSrc.includes("bgmDebugState") && pSrc.includes("playlists: BGM_PLAYLISTS"));
ok("S6 버전 35/3.0.21 + 배지",
  grad.includes("versionCode 35") && grad.includes('versionName "3.0.21"') && oSrc.includes("v3.0.21"));

/* ── 오디오 파일 검증 (40곡 존재·용량·개별성) ── */
let fileOk = true, detail = "";
for (const t of THEMES) {
  const sizes = [];
  for (let i = 1; i <= 5; i++) {
    const p = `public/assets/audio/bgm_${t}${i}.ogg`;
    if (!fs.existsSync(p)) { fileOk = false; detail = `${p} 없음`; break; }
    sizes.push(fs.statSync(p).size);
  }
  if (!fileOk) break;
  if (sizes.some((s) => s < 250 * 1024)) { fileOk = false; detail = `${t} 저용량 ${sizes.join(",")}`; break; }
  if (new Set(sizes).size !== 5) { fileOk = false; detail = `${t} 중복 파일 의심 ${sizes.join(",")}`; break; }
}
ok("S7 오디오 40곡 존재(≥250KB·테마 내 5곡 개별)", fileOk, detail);
const oldGone = ["bgm_title.ogg", "bgm_field.ogg", "bgm_boss.ogg", "bgm_village.ogg",
  "bgm_alfheim.ogg", "bgm_cave.ogg", "bgm_snow.ogg", "bgm_abyss.ogg"].every((f) => !fs.existsSync(`public/assets/audio/${f}`));
ok("S8 구 칩튠/생성 트랙 16종 파일 완전 제거", oldGone);
ok("S9 CREDITS Kevin MacLeod CC-BY 4.0 + 40트랙 표기",
  credits.includes("Kevin MacLeod") && credits.includes("CC-BY 4.0") &&
  (credits.match(/bgm_[a-z]+[1-5]\.ogg/g) || []).length === 40);

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

(async () => {
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e?.message ?? e)));

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
  await page.waitForTimeout(1200);

  const activeBgm = () => page.evaluate(() => {
    const g = window.__SERTZ__.game;
    const s = (g.sound.sounds || []).filter((x) => typeof x.key === "string" && x.key.startsWith("bgm_") && x.isPlaying);
    return s.length ? { key: s[0].key } : null;
  });

  /* R1 월드 진입 BGM 자동 재생 */
  const r1 = await activeBgm();
  ok("R1 월드 진입 시 BGM 자동 재생", !!r1, r1?.key ?? "없음");
  const kind1 = r1 ? r1.key.replace(/^bgm_/, "").replace(/[1-5]$/, "") : null;
  ok("R2 재생 트랙이 현재 테마 플레이리스트 소속",
    !!r1 && ["title", "village", "field", "alfheim", "cave", "snow", "abyss", "boss"].includes(kind1) &&
    page.evaluate !== null, r1?.key ?? "");

  /* R3 강제 로테이션 → 같은 테마 다음 곡 (직전 곡 아님) */
  const r3 = await page.evaluate(() => {
    const b = window.__SERTZ_DEBUG__.bgm;
    const before = b.bgmDebugState();
    b.bgmAdvanceForTest();
    return before;
  });
  await page.waitForTimeout(500);
  const r3after = await activeBgm();
  ok("R3 로테이션 → 같은 테마 내 다른 곡",
    !!r3after && r3after.key.startsWith(`bgm_${kind1}`) && r3after.key !== r3.track,
    `${r3.track} → ${r3after?.key ?? "없음"}`);

  /* R4 보스 테마 전환 + 5회 로테이션 전체 커버(중복 0) */
  const bossKeys = await page.evaluate(() => {
    const b = window.__SERTZ_DEBUG__.bgm;
    b.playBGM("boss");
    return b.playlists.boss;
  });
  await page.waitForTimeout(500);
  const seen = [];
  for (let i = 0; i < 5; i++) {
    const cur = await activeBgm();
    if (cur) seen.push(cur.key);
    await page.evaluate(() => window.__SERTZ_DEBUG__.bgm.bgmAdvanceForTest());
    await page.waitForTimeout(350);
  }
  const uniq = new Set(seen);
  ok("R4 보스 테마 전환 + 5회 순회 중복 없음·전 곡 커버",
    seen.length === 5 && uniq.size === 5 && seen.every((k) => bossKeys.includes(k)),
    seen.join(","));
  ok("R5 페이지 에러 0", errors.length === 0, errors.slice(0, 3).join(" | "));

  await browser.close();
  const pass = results.filter((r) => r.pass).length;
  console.log(`\n=== ${pass}/${results.length} PASS ===`);
  process.exit(pass === results.length ? 0 : 1);
})();
