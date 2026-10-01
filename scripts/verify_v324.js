/* v3.0.24 검증 — 피드백 8건
 *  ① 용량 무관·퀄리티 우선 (BGM 풀버전 q4·48kHz + 지연 로딩)
 *  ② 직업별 스킬 효과음 매우 적절히 배치 (27종 신규 + 48종 매핑)
 *  ③ 1차 궁수 화살 이펙트 완화
 *  ④ BM 상점 eert 큐브 1개만 구매 버그
 *  ⑤ 상점 수량 선택 구매
 *  ⑥ 기본 이속 nerf + 스탯/강화 연동
 *  ⑦ 보스 재도전(재림) 모드
 *  ⑧ 대사창 화자 초상화
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
const pSrc = fs.readFileSync("src/game/entities/Player.ts", "utf8");
const wSrc = fs.readFileSync("src/game/scenes/WorldScene.ts", "utf8");
const oSrc = fs.readFileSync("src/components/game/Overlays.tsx", "utf8");
const paSrc = fs.readFileSync("src/components/game/Panels.tsx", "utf8");
const dbSrc = fs.readFileSync("src/components/game/DialogueBox.tsx", "utf8");
const bootSrc = fs.readFileSync("src/game/scenes/BootScene.ts", "utf8");
const grad = fs.readFileSync("android/app/build.gradle", "utf8");
const apkSh = fs.readFileSync("scripts/build_apk.sh", "utf8");
const cred = fs.readFileSync("public/assets/CREDITS.md", "utf8");

/* ① BGM 풀버전 + 지연 로딩 */
ok("S1 BGM 지연 로딩 구현(fetch+decodeAudioData+LRU)",
  aSrc.includes("ensureBgmDecoded") && aSrc.includes("decodeAudioData") &&
  aSrc.includes("MAX_DECODED_BGM") && aSrc.includes("bgmInflight"));
ok("S2 부트 프리로드는 타이틀 1곡만 (39트랙은 구역 진입 시 로딩)",
  bootSrc.includes("BGM_PRELOAD_TRACKS") && !bootSrc.includes("BGM_ALL_TRACKS"));
ok("S3 audio.ts startTrack 비동기 stale 가드(이중 재생 방지)",
  aSrc.includes("async function startTrack") && aSrc.includes("stale"));

/* ② 직업별 스킬 효과음 */
const sklFiles = fs.readdirSync("public/assets/audio").filter((f) => f.startsWith("skl_"));
ok("S4 스킬 전용 SFX 27종 파일 존재", sklFiles.length === 27, `${sklFiles.length}/27`);
ok("S5 audio.ts 스킬 사운드 매핑(SKILL_SFX_FILES+sfx.skill)",
  aSrc.includes("SKILL_SFX_FILES") && aSrc.includes("skill(key: string, rate = 1)") &&
  aSrc.includes("skl_arrow1") && aSrc.includes("skl_timestop1"));
ok("S6 스킬1 12종 개별 배치(총 8종 교체+버서커 분기)",
  pSrc.includes('sfxSkill("arrow"') && pSrc.includes('sfxSkill("flame"') &&
  pSrc.includes('sfxSkill("knife"') && pSrc.includes('sfxSkill("quake"') &&
  pSrc.includes('sfxSkill("arrowpierce"') && pSrc.includes('sfxSkill("wind"') &&
  pSrc.includes('sfxSkill("electron"') && pSrc.includes('sfxSkill("cure"') &&
  pSrc.includes('sfxSkill("iainuki"') && pSrc.includes('sfxSkill("swift"') &&
  pSrc.includes('sfxSkill("bigsword"'));
ok("S7 기동기 12종 DASH_SND 맵 + 3차기 SND3 16종 + 4차기 SND4 8종",
  pSrc.includes("DASH_SND") && pSrc.includes("SND3") && pSrc.includes("SND4") &&
  pSrc.includes('warcry: ["warcry"') && pSrc.includes('eternalloop: ["timestop"'));
ok("S8 WorldScene sfxSkill 래퍼",
  wSrc.includes("sfxSkill(key: string, rate = 1)"));
ok("S9 기본공격 계열 분리(궁수=활·마법사=지팡이·도적=단검·전사=검 유지)",
  pSrc.includes('sfxSkill("arrow", 0.96') && pSrc.includes('sfxSkill("cast"') &&
  pSrc.includes('sfxSkill("knife", 1.08') && /else this\.scene\.sfxSwing\(\)/.test(pSrc));

/* ③ 1차 궁수 화살 완화 */
ok("S10 화살 크기 차수별 계층(1차 1.0 ~ 4차 1.5)",
  pSrc.includes("const arrowScale = t >= 4 ? 1.5 : t === 3 ? 1.3 : t === 2 ? 1.15 : 1.0;"));
ok("S11 1차는 잔상·머즐 플래시 없음(2차+만)",
  pSrc.includes("const showTrail = t >= 2 || isDeadeye || isSkylord") &&
  pSrc.includes("const showFlash = t >= 2 || isDeadeye || isSkylord") &&
  !pSrc.includes("scale: 1.35 + 0.06 * t"));

/* ④ eert 큐브 구매 버그 */
ok("S12 buyBm 소모품 누적 구매(owned 판정 회피)",
  pSrc.includes('if (item.kind === "consumable") {\n      // 소모품은 누적 구매') ||
  /buyBm[\s\S]{0,600}kind === "consumable"[\s\S]{0,300}for \(let i = 0; i < n; i\+\+\) this\.owned\.push/.test(pSrc));
ok("S13 BM 패널 bmState 소모품 항상 구매 가능 판정",
  /bmState[\s\S]{0,700}kind === "consumable"\) return rpg\.emerald >= \(it\.bmPrice \?\? 0\) \? "buyable" : "poor"/.test(paSrc));

/* ⑤ 수량 선택 구매 */
ok("S14 QtyStepper 컴포넌트 + 양쪽 상점 적용 + qty 이벤트",
  paSrc.includes("function QtyStepper") &&
  (paSrc.match(/QtyStepper qty=/g) || []).length >= 2 &&
  paSrc.includes('{ key: k as ItemKey, qty: stackable ? qty : 1 }') &&
  paSrc.includes('{ key: k as ItemKey, qty: stackable ? qty : 1 }'));
ok("S15 Player.buy/buyBm qty 파라미터(×N 비용·버프 n개)",
  pSrc.includes("buy(key: ItemKey, qty = 1)") && pSrc.includes("buyBm(key: ItemKey, qty = 1)") &&
  pSrc.includes("addBuffItem(key as BuffKey, n)"));
ok("S16 WorldScene 구매 핸들러 qty 수용 + 배너 합산 표시",
  wSrc.includes('onBuy = (v: { key: ItemKey; qty?: number })') &&
  wSrc.includes('onBmBuy = (v: { key: string; qty?: number })') &&
  wSrc.includes("×${qty}"));

/* ⑥ 이속 nerf + 성장 연동 */
ok("S17 기본 이속 300→225 nerf",
  pSrc.includes("static readonly BASE_SPEED = 225;") && pSrc.includes("speed = 225;"));
ok("S18 이속 성장 연동(민첩 0.5%/점 캡 60% + 강화 0.5%/성 캡 15%)",
  pSrc.includes("const dexPct = Math.min(60, this.stats.dex * 0.5)") &&
  pSrc.includes("const starPct = Math.min(15, ((this.upgrades.weapon ?? 0) + (this.upgrades.armor ?? 0)) * 0.5)"));
ok("S19 스탯창 민첩 설명 갱신(이동속도 명시)",
  paSrc.includes("크리티컬 +0.4%p · 이동속도 +0.5%/점"));

/* ⑦ 보스 재도전 */
ok("S20 재림 보스 스폰(HP×5·ATK×2.2·보상×3) + 스폰 메서드",
  wSrc.includes("spawnReplayBoss") && wSrc.includes("재림한") &&
  wSrc.includes("* 5.0") && wSrc.includes("* 2.2") && wSrc.includes("* 3)"));
ok("S21 재도전 이벤트/핸들러/보스퀘스트 완료 게이트",
  wSrc.includes('EventBus.on("rpg:bossReplay", onBossReplay)') &&
  wSrc.includes("EventBus.off(\"rpg:bossReplay\"") &&
  wSrc.includes("q.type === \"boss\"") && wSrc.includes("아직 스토리를 완료하지 않은 챕터"));
ok("S22 재림 보스 사망 분기(전용 보상·퀘스트 진행 없음 + 보상 팝업)",
  wSrc.includes("if (this.replayBossActive)") && wSrc.includes("재도전 성공") &&
  wSrc.includes("replayBossActive = false"));
ok("S23 퀘스트 로그 패널 보스 재도전 섹션(9챕터 그리드)",
  paSrc.includes("보스 재도전 — 재림") && paSrc.includes("rpg:bossReplay") &&
  paSrc.includes("bossKills[`boss_${bk}`]"));
ok("S24 init 데이터 replayBoss 전달 + 스폰 소비",
  wSrc.includes("replayBoss?: string") && wSrc.includes("pendingReplayBoss"));

/* ⑧ 대사 초상화 */
ok("S25 대사창 좌측 초상 프레임(픽셀 확대·톤 라이트)",
  dbSrc.includes("NPC_PORTRAITS") && dbSrc.includes("portraitOf") &&
  dbSrc.includes("imageRendering") && dbSrc.includes("pet_pixie"));
ok("S26 보스 화자 자동 매칭(BOSS_DEFS 이름→텍스처)",
  dbSrc.includes("bossPortrait") && dbSrc.includes("BOSS_DEFS"));

/* 버전/문서 */
ok("S27 versionCode 38 / 3.0.24 + APK명",
  grad.includes("versionCode 38") && grad.includes('versionName "3.0.24"') &&
  apkSh.includes("SERTZ-v3.0.24.apk"));
ok("S28 타이틀 배지 v3.0.24 + CREDITS 스킬 SFX 출처",
  oSrc.includes("v3.0.24") && cred.includes("soundeffect-lab.info") && cred.includes("skl_"));

/* ① BGM 오디오 무결성 — 전부 48kHz 풀버전 */
let fullCnt = 0;
let cnt48 = 0;
let capCnt = 0;
try {
  const out = execSync(
    `for f in public/assets/audio/bgm_*.ogg; do echo "$f $(ffprobe -v error -select_streams a:0 -show_entries stream=sample_rate -of csv=p=0 "$f") $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")"; done`,
    { shell: "/bin/bash", encoding: "utf8" }
  );
  for (const l of out.trim().split("\n")) {
    const [, sr, d] = l.split(" ");
    const dur = parseFloat(d);
    if (sr === "48000") cnt48++;
    if (dur > 131) fullCnt++;
    if (dur >= 129.5 && dur <= 130.5) capCnt++;
  }
} catch {
  /* ffprobe 실패 */
}
ok("S29 40트랙 전부 48kHz 정규화", cnt48 === 40, `${cnt48}/40`);
ok("S30 풀버전(>131s) 다수 + 130s 캡본 0개", fullCnt >= 30 && capCnt === 0, `풀버전 ${fullCnt} · 캡본 ${capCnt}`);

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
    await page.mouse.click(640, 360);
    await page.waitForTimeout(600);

    /* 부트 프리로드 — BGM은 타이틀 1곡만 (SFX만 캐시 + bgm_title1)
     *  bgm_title1이 가장 큰 파일(3.3MB) — 캐시 완료까지 대기 */
    await page.waitForFunction(
      () => ((window).__SERTZ__?.game?.cache?.audio?.getKeys() ?? []).some((k) => k === "bgm_title1"),
      undefined,
      { timeout: 60000 }
    );
    const bootKeys = await page.evaluate(() => {
      const keys = (window).__SERTZ__.game.cache.audio.getKeys();
      return { total: keys.length, bgm: keys.filter((k) => k.startsWith("bgm_")) };
    });
    ok("R1 부트 BGM 프리로드 = 타이틀 1곡만(지연 로딩)", bootKeys.bgm.length === 1 && bootKeys.bgm[0] === "bgm_title1",
      `bgm ${bootKeys.bgm.length}개 · 전체 ${bootKeys.total}키`);

    /* 타이틀 BGM 재생 — 디코드 완료까지 대기(풀버전 3.3MB) */
    await page.evaluate(() => (window).__SERTZ_DEBUG__ && (window).__SERTZ_DEBUG__.bgm && (window).__SERTZ_DEBUG__.bgm.playBGM("village"));
    await page.waitForFunction(
      () => (window).__SERTZ_DEBUG__.bgm.bgmDebugState().playing === true,
      undefined,
      { timeout: 30000 }
    );
    const st = await page.evaluate(() => (window).__SERTZ_DEBUG__.bgm.bgmDebugState());
    ok("R2 지연 로딩 후 BGM 재생(loop 고정)", st.playing === true && st.loop === true, JSON.stringify(st));
    ok("R3 디코드 캡 노출(decodedMax=3)", st.decodedMax === 3);

    /* 구역 진입 — 지연 로딩 재생 (미프리로드 트랙, 배치표 기대값은 stageTrack으로 동일 산출) */
    const expectTrack = await page.evaluate(() => (window).__SERTZ_DEBUG__.bgm.stageTrack("niflheim7"));
    await page.evaluate(() => (window).__SERTZ_DEBUG__.bgm.playStageBGM("niflheim7"));
    await page.waitForFunction(
      (t) => (window).__SERTZ_DEBUG__.bgm.bgmDebugState().playing === true &&
        (window).__SERTZ_DEBUG__.bgm.bgmDebugState().track === t,
      expectTrack,
      { timeout: 30000 }
    );
    const st2 = await page.evaluate(() => (window).__SERTZ_DEBUG__.bgm.bgmDebugState());
    ok("R4 미로드 트랙 지연 로딩→재생(niflheim7→배치표 트랙)", st2.track === expectTrack && st2.playing === true, `${st2.track} playing=${st2.playing}`);

    /* LRU 캡 — 여러 구역 순회해도 디코드 캐시 3개 이하 */
    for (const zone of ["forest3", "alfheim5", "muspelheim3", "hel8", "cave2"]) {
      await page.evaluate((z) => (window).__SERTZ_DEBUG__.bgm.playStageBGM(z), zone);
      await page.waitForTimeout(2200); // 트랙별 디코드 시간 확보
    }
    const st3 = await page.evaluate(() => (window).__SERTZ_DEBUG__.bgm.bgmDebugState());
    ok("R5 LRU 캡 유지(구역 6회 순회 후 decoded ≤ 3)", st3.decoded <= 3, `decoded=${st3.decoded} track=${st3.track}`);

    /* 교체 없음 — 재시작 후 같은 트랙 (재시작 재시작 재생 재개까지 대기) */
    const t1 = await page.evaluate(() => (window).__SERTZ_DEBUG__.bgm.bgmDebugState().track);
    await page.evaluate(() => (window).__SERTZ_DEBUG__.bgm.bgmAdvanceForTest());
    await page.waitForFunction(
      () => (window).__SERTZ_DEBUG__.bgm.bgmDebugState().playing === true,
      undefined,
      { timeout: 30000 }
    );
    const t2 = await page.evaluate(() => (window).__SERTZ_DEBUG__.bgm.bgmDebugState().track);
    ok("R6 재시작 후에도 같은 곡(교체 없음)", !!t1 && t1 === t2, `${t1} → ${t2}`);

    /* 구역→트랙 결정론적 배치 (v3.0.23 회귀 확인) */
    const mapping = await page.evaluate(() => {
      const b = (window).__SERTZ_DEBUG__.bgm;
      const keys = ["village", "forest1", "forest10", "kingdom2", "niflheim7", "cave5", "muspelheim3", "hel8", "abyss9", "forestv", "interior_home"];
      const m = {};
      for (const k of keys) m[k] = b.stageTrack(k);
      return m;
    });
    const uniq = new Set(Object.values(mapping));
    ok("R7 구역→고정 트랙 배치 유지(11구역)", mapping.forest1 === "bgm_field1" && mapping.village === "bgm_village1");
    ok("R8 배치 다양성 + 보스구역 전투곡", uniq.size >= 8 && /bgm_boss\d/.test(mapping.forest10), `${uniq.size}종 · ${mapping.forest10}`);

    /* 스킬 SFX — 실제 재생 호출 (미로드 시 자동 스킵만 안전 확인) */
    const sfxOk = await page.evaluate(() => {
      try {
        const audioDebug = (window).__SERTZ_DEBUG__.audio;
        return audioDebug && typeof audioDebug.volumes === "object";
      } catch {
        return false;
      }
    });
    ok("R9 스킬 SFX 부트 프리로드(캐시에 skl_* 존재)", await page.evaluate(() => {
      const keys = (window).__SERTZ__.game.cache.audio.getKeys();
      return keys.filter((k) => k.startsWith("skl_")).length >= 27;
    }) && sfxOk);

    ok("R10 pageerror 0", errors.length === 0, errors.slice(0, 2).join(" | "));
  } catch (e) {
    ok("런타임 실행", false, String(e).slice(0, 160));
  }
  await browser.close();

  const pass = results.filter((r) => r.pass).length;
  console.log(`\n=== verify_v324: ${pass}/${results.length} PASS ===`);
  process.exit(pass === results.length ? 0 : 1);
})();
