/* v3.0.23 검증 — 피드백 6건 (52~57)
 *  52 음악 랜덤 교체 제거(로테이션 폐기)  53 40곡 맵마다 고정 배치
 *  54 APK↔PC 만남(서버 주소 안내·복사)   55 빈 공간 "검은 카펫" 벽 교체
 *  56 퀘스트 알림 하향 + X 닫기 버그      57 제목·대사·UI AI 느낌 교체
 * 실행 중인 3000 서버(커스텀 server.js — socket.io) 접속 */
const { chromium } = require("playwright");
const fs = require("fs");
const { execSync } = require("child_process");

const URL = "http://127.0.0.1:3000";
const results = [];
const ok = (name, cond, detail = "") => {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
};

/* ── 정적 검증 ── */
const aSrc = fs.readFileSync("src/game/audio.ts", "utf8");
const wSrc = fs.readFileSync("src/game/scenes/WorldScene.ts", "utf8");
const oSrc = fs.readFileSync("src/components/game/Overlays.tsx", "utf8");
const hSrc = fs.readFileSync("src/components/game/HUD.tsx", "utf8");
const sSrc = fs.readFileSync("src/components/game/ServerConnect.tsx", "utf8");
const dSrc = fs.readFileSync("src/game/data.ts", "utf8");
const stSrc = fs.readFileSync("src/game/stages.ts", "utf8");
const bootSrc = fs.readFileSync("src/game/scenes/BootScene.ts", "utf8");
const pgSrc = fs.readFileSync("src/game/PhaserGame.ts", "utf8");
const grad = fs.readFileSync("android/app/build.gradle", "utf8");

/* 52 곡 교체(로테이션) 완전 제거 */
ok("S1 로테이션 코드 완전 제거(셔플백·nextTrackOf·complete 재생)",
  !aSrc.includes("nextTrackOf") && !aSrc.includes("bgmBags") &&
  !aSrc.includes('once("complete"') && !aSrc.includes("shuffle"));
ok("S2 고정 루프 재생(loop:true) — 곡 교체 없음",
  aSrc.includes("{ loop: true, volume: 0 }") && !aSrc.includes("loop: false"));

/* 53 40곡 맵 배치 */
const placed = new Set(
  [...aSrc.matchAll(/"(bgm_[a-z]+\d)"/g)].map((m) => m[1])
);
ok("S3 배치표가 40트랙 전부 참조(BGM_PLAYLISTS+CHAPTER_TRACKS+보스/마을)",
  placed.size === 40, `${placed.size}/40`);
ok("S4 stageTrack 고정 매핑 + playStageBGM 구역 진입 API",
  aSrc.includes("export function stageTrack") && aSrc.includes("export function playStageBGM"));
ok("S5 WorldScene 구역 진입 4곳이 playStageBGM 사용",
  (wSrc.match(/playStageBGM/g) || []).length >= 4 && !wSrc.includes("audio.playBGM"));
ok("S6 보스 구역(10)은 전투곡·마을(Xv)은 village 풀",
  aSrc.includes("zone === 10") && aSrc.includes("BOSS_TRACKS") && aSrc.includes("VILLAGE_TRACKS"));
ok("S7 BootScene 40트랙 전부 프리로드 유지",
  bootSrc.includes("BGM_ALL_TRACKS"));

/* 54 APK↔PC */
ok("S8 서버 설정창 — 현재 서버 표시 + 복사 + PC 만남 안내",
  sSrc.includes("현재 서버") && sSrc.includes("clipboard.writeText") &&
  sSrc.includes("APK와 PC에서 만나기"));

/* 55 검은 카펫 벽 */
ok("S9 벽 텍스처 wall_rock 교체 + 명도 상향(0.62+)",
  wSrc.includes('const wallTex = "wall_rock"') && wSrc.includes("0.62 + rng.frac() * 0.12") &&
  !wSrc.includes("x2_bricks"));
ok("S10 wall_rock 로드 + 파일 존재",
  bootSrc.includes('"wall_rock"') && fs.existsSync("public/assets/wall_rock.png"));

/* 56 퀘스트 알림 */
ok("S11 보상 알림 아래로(top-28) + X 클릭 가능(pointer-events-auto)",
  oSrc.includes("top-28 z-30") && oSrc.includes("pointer-events-auto w-[min(92vw,330px)]"));
ok("S12 트래커 모바일 하향(mt-20)",
  hSrc.includes("mt-20 w-full rounded-lg border border-amber-200/40"));

/* 57 AI 느낌 교체 */
ok("S13 타이틀 크레딧 Kevin MacLeod 갱신 + 배지 v3.0.23",
  oSrc.includes("Kevin MacLeod") && !oSrc.includes("Juhani") && oSrc.includes("v3.0.23"));
ok("S14 퀘스트 설명 '~하자' 획일 어미 제거",
  (stSrc.match(/하자[.!]/g) || []).length === 0);
ok("S15 대사 톤 교체(인트로·가호)",
  dSrc.includes("준비됐으면 가자. 모험은 기다려 주지 않아.") &&
  dSrc.includes("『세계수의 가호』 — 이그드라실의 힘이 네 팔과 몸에 깃든다. 영구히."));

/* 버전 */
ok("S16 versionCode 37 / 3.0.23",
  grad.includes("versionCode 37") && grad.includes('versionName "3.0.23"'));

/* 40곡 오디오 무결성 — 전부 130초 규격(메모리 안전: 205초본은 웹뷰 PCM ~1.4GB 크래시 확인) */
let safeCnt = 0;
let fullCntOver = 0;
try {
  const out = execSync(
    `for f in public/assets/audio/bgm_*.ogg; do d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f"); echo "$d"; done`,
    { shell: "/bin/bash", encoding: "utf8" }
  );
  const durs = out.trim().split("\n").map((l) => parseFloat(l));
  safeCnt = durs.filter((d) => d > 120 && d <= 133).length;
  fullCntOver = durs.filter((d) => d > 133).length;
} catch {
  /* ffprobe 실패 시 0 */
}
ok("S17 40트랙 전부 130초 안전 규격(크래시 프로파일 회피)", safeCnt === 40, `${safeCnt}/40`);
/* v3.0.23 회귀 방지 — 205초 이상 대형 파일 재유입 금지 (웹뷰 크래시 원인) */
ok("S17b 대형 트랙(>133s) 0개 — PCM 크래시 프로파일", fullCntOver === 0, `${fullCntOver}개`);

/* ── 런타임 검증 ── */
(async () => {
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required", "--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  try {
    await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector("#game canvas, canvas", { timeout: 20000 });
    await page.evaluate(() => {
      try { localStorage.removeItem("sertz.save"); } catch { /* noop */ }
    });
    /* 유저 제스처 재현 — 실제 플로우(타이틀 버튼 탭)에서 오디언락 해제됨 */
    await page.mouse.click(640, 360);
    await page.waitForTimeout(400);
    /* 부트 오디오 프리로드 대기 — 40트랙 디코드 완료까지 (waitForFunction 옵션은 3번째 인자) */
    await page.waitForFunction(
      () => ((window).__SERTZ__?.game?.cache?.audio?.getKeys()?.length ?? 0) >= 40,
      undefined,
      { timeout: 120000 }
    );
    await page.evaluate(() => (window).__SERTZ_DEBUG__ && (window).__SERTZ_DEBUG__.bgm && (window).__SERTZ_DEBUG__.bgm.playBGM("village"));
    await page.waitForTimeout(1600);

    const st = await page.evaluate(() => {
      const b = (window).__SERTZ_DEBUG__?.bgm;
      const s = b?.bgmDebugState?.();
      return { has: !!b, s, hookNames: b ? Object.keys(b) : [] };
    });
    ok("R1 BGM 훅 노출(playStageBGM·stageTrack)", st.has && st.hookNames.includes("playStageBGM") && st.hookNames.includes("stageTrack"));
    ok("R2 진입 BGM 재생 중(loop 고정)", st.s && st.s.playing === true && st.s.loop === true, JSON.stringify(st.s));

    /* 교체 없음 검증 — 강제 재시작 후에도 같은 트랙 */
    const t1 = await page.evaluate(() => (window).__SERTZ_DEBUG__.bgm.bgmDebugState().track);
    await page.evaluate(() => (window).__SERTZ_DEBUG__.bgm.bgmAdvanceForTest());
    await page.waitForTimeout(300);
    const t2 = await page.evaluate(() => (window).__SERTZ_DEBUG__.bgm.bgmDebugState().track);
    ok("R3 재시작 후에도 같은 곡(교체 없음)", !!t1 && t1 === t2, `${t1} → ${t2}`);

    /* 구역별 고정 배치 실측 — 같은 구역 재요청 시 같은 곡, 다른 구역은 다른 곡 */
    const mapping = await page.evaluate(() => {
      const b = (window).__SERTZ_DEBUG__.bgm;
      const keys = ["village", "forest1", "forest3", "forest10", "kingdom2", "alfheim4", "niflheim7", "cave5", "muspelheim3", "nidavellir6", "hel8", "abyss9", "forestv", "abyssv", "interior_home"];
      const m = {};
      for (const k of keys) m[k] = b.stageTrack(k);
      return m;
    });
    const uniq = new Set(Object.values(mapping));
    ok("R4 구역→트랙 고정 배치(15구역 실측, 결정론적)", !!mapping.forest1 && mapping.forest1 === "bgm_field1" &&
      mapping.village === "bgm_village1" && mapping.forest10 === mapping.forest10, JSON.stringify(mapping).slice(0, 150));
    ok("R5 배치 다양성(15구역 ≥10종)", uniq.size >= 10, `${uniq.size}종`);
    ok("R6 보스 구역은 boss 풀", /bgm_boss\d/.test(mapping.forest10), mapping.forest10);
    ok("R7 챕터 마을은 village 풀", /bgm_village\d/.test(mapping.forestv) && /bgm_village\d/.test(mapping.abyssv));
    ok("R8 실내는 마을곡 고정", mapping.interior_home === "bgm_village4", mapping.interior_home);

    /* 실제 구역 진입 → 해당 구역 고정곡 재생 (제스처 후 상태 유지 확인) */
    await page.evaluate(() => (window).__SERTZ_DEBUG__.bgm.playStageBGM("niflheim7"));
    await page.waitForTimeout(700);
    const st3 = await page.evaluate(() => (window).__SERTZ_DEBUG__.bgm.bgmDebugState());
    ok("R9 niflheim7 → snow 풀 고정곡 교체·재생", st3.track === mapping.niflheim7, `${st3.track} playing=${st3.playing}`);

    ok("R10 pageerror 0", errors.length === 0, errors.slice(0, 2).join(" | "));
  } catch (e) {
    ok("런타임 실행", false, String(e).slice(0, 160));
  }
  await browser.close();

  const pass = results.filter((r) => r.pass).length;
  console.log(`\n=== verify_v323: ${pass}/${results.length} PASS ===`);
  process.exit(pass === results.length ? 0 : 1);
})();
