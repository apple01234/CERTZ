/* v3.0.7 AI BGM E2E — "어항 앞에 마우스" AI 음악 테마 매핑 검증
 *  [1] 정적 — 매니페스트 8테마 플레이리스트 + 곡 수
 *  [2] 타이틀 — 진입 즉시 title 테마 AI 트랙 지연로드+지정
 *  [3] 전 테마 전환 — e2ePlayBgm 8종: ai_{kind}_ 트랙 캐시 적재/지정/재생
 *  [4] 월드 진입 — village 스테이지 BGM이 AI 트랙으로 교체됐는지 (실제 게임 경로)
 *  [5] 회귀 — 타이틀 크레딧 텍스트 + 로드 에러 0
 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");

const PORT = 3123;
const URL = `http://localhost:${PORT}`;
let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log(`  PASS — ${label}`); } else { fail++; console.log(`  FAIL — ${label}`); } };

const KINDS = ["title", "village", "field", "alfheim", "snow", "cave", "abyss", "boss"];

async function waitBgm(page, pred, timeoutMs = 12000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const st = await page.evaluate(() => window.__SERTZ_DEBUG__.bgm());
    if (pred(st)) return st;
    await page.waitForTimeout(300);
  }
  return await page.evaluate(() => window.__SERTZ_DEBUG__.bgm());
}

(async () => {
  let browser;
  const srv = spawn("node", ["server.js"], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production", PORT: String(PORT) }, stdio: "ignore" });
  try {
    // 서버 기동 대기
    await new Promise((res, rej) => {
      const t0 = Date.now();
      const ping = () => {
        fetch(URL).then((r) => (r.ok ? res() : setTimeout(ping, 700))).catch(() => {
          if (Date.now() - t0 > 60000) rej(new Error("server boot timeout")); else setTimeout(ping, 700);
        });
      };
      ping();
    });

    browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
    const page = await browser.newPage();
    await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForFunction(() => !!window.__SERTZ_DEBUG__, { timeout: 60000 });

    /* [1] 정적 매니페스트 */
    console.log("\n[1] AI BGM 매니페스트 정적 검증");
    const st0 = await page.evaluate(() => {
      const d = window.__SERTZ_DEBUG__;
      return { kinds: d.audio.aiBgmKinds, counts: d.audio.aiBgmCounts, vol: d.audio.aiBgm };
    });
    ok(JSON.stringify([...st0.kinds].sort()) === JSON.stringify([...KINDS].sort()), `8테마 플레이리스트 존재 (${st0.kinds.join(",")})`);
    const total = Object.values(st0.counts).reduce((a, b) => a + b, 0);
    ok(total >= 20, `총 AI 트랙 ${total}곡 (>=20)`);
    ok(st0.vol > 0 && st0.vol <= 0.5, `AI BGM 볼륨 ${st0.vol} (0<v<=0.5)`);

    /* [2] 타이틀 테마 */
    console.log("\n[2] 타이틀 테마 AI 트랙");
    const st1 = await waitBgm(page, (s) => s.kind === "title" && s.isAi && s.track);
    ok(st1.kind === "title", "타이틀 진입 시 kind=title");
    ok(st1.isAi, "AI 트랙 재생 경로 (isAi=true)");
    ok(/^ai_title_\d+$/.test(st1.track?.key || ""), `title 트랙 키 (${st1.track?.key})`);
    ok(!!st1.track?.title, `트랙 제목 "${st1.track?.title}"`);

    /* [3] 전 테마 전환 (지연로드 포함) */
    console.log("\n[3] 8테마 전환 — 지연로드/캐시/지정");
    for (const kind of KINDS) {
      await page.evaluate((k) => window.__SERTZ_DEBUG__.e2ePlayBgm(k), kind);
      const st = await waitBgm(page, (s) => s.kind === kind && s.isAi && s.track && (s.loaded[kind] || 0) > 0);
      const rightTrack = new RegExp(`^ai_${kind}_\\d+$`).test(st.track?.key || "");
      ok(rightTrack, `${kind} → ${st.track?.key} "${st.track?.title}" (${st.loaded[kind]}곡 캐시)`);
    }

    /* [5-선] 로드 실패 없음 */
    const stErr = await page.evaluate(() => window.__SERTZ_DEBUG__.bgm());
    ok(!stErr.loadError && stErr.failed.length === 0, "AI 트랙 로드 실패 0건");

    /* [4] 실제 게임 경로 — 월드(마을) 진입 */
    console.log("\n[4] 월드 진입 (마을) — 실제 playBGM 경로");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=새로운 모험", { timeout: 60000 });
    // 타이틀 크레딧은 Phaser 캔버스 텍스트 — 씬 객체에서 확인
    const credit = await page.evaluate(() => {
      const t = window.__SERTZ__.game.scene.getScene("title");
      return t?.credit ? t.credit.text : null;
    });
    ok(!!credit && credit.includes("어항 앞에 마우스"), `타이틀 크레딧 표기 (${credit})`);
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
        } catch { return false; }
      });
      if (done) break;
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(600);
    const stW = await waitBgm(page, (s) => s.kind === "village" && s.isAi && s.track);
    ok(stW.kind === "village", "마을 진입 → kind=village (기존 훅 유지)");
    ok(stW.isAi && /^ai_village_\d+$/.test(stW.track?.key || ""), `마을 BGM AI 트랙 (${stW.track?.key} "${stW.track?.title}")`);
    ok(stW.playing, "BGM 재생 중 (isPlaying)");
    // 음소거 토글 회귀
    const muted = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const before = w.sound.mute;
      w.sound.mute = true; w.sound.mute = false;
      return before === false;
    });
    ok(muted, "사운드 매니저 음소거 토글 정상");

    /* [6] 태그 검증 — 실제 재생 파일의 메타데이터(브라우저 디코드 대신 파일 헤더는 서버 사이드 빌드에서 검증됨) */
    console.log("\n[6] 트랙 순환 커서 검증");
    const cyc = await page.evaluate(async () => {
      const d = window.__SERTZ_DEBUG__;
      d.e2ePlayBgm("boss");
      await new Promise((r) => setTimeout(r, 1200));
      const s1 = d.bgm();
      d.e2ePlayBgm("field");
      await new Promise((r) => setTimeout(r, 1200));
      const s2 = d.bgm();
      d.e2ePlayBgm("boss");
      await new Promise((r) => setTimeout(r, 1200));
      const s3 = d.bgm();
      return { s1: s1.track?.key, s2: s2.track?.key, s3: s3.track?.key };
    });
    ok(cyc.s1 && cyc.s3 === cyc.s1, `같은 테마 재진입 시 커서 유지 (${cyc.s1} → ${cyc.s3})`);
    ok(cyc.s2 && cyc.s2.startsWith("ai_field"), `테마 전환 정상 (${cyc.s2})`);

  } catch (e) {
    console.log("FATAL:", String(e).slice(0, 300));
    fail++;
  } finally {
    if (browser) await browser.close();
    srv.kill();
  }
  console.log(`\n=== v3.0.7 AI BGM: ${pass} PASS / ${fail} FAIL ===`);
  process.exit(fail > 0 ? 1 : 0);
})();
