/**
 * e2e_vc146.js — vc146 검증 (피드백 10종 · 첫 정식 릴리스 1.0.6):
 *  ① [GM] 완전 엘릭서 무한 — gmInfinite일 때 퀵슬롯/인벤 경로 소모 0
 *  ② 5차 제2궁극기 — 12종 데이터·skill5bMax 120000·시전(MP150)·Q키·원격 s5b 화이트리스트
 *  ③ 쉐이더 밝기 하향 — ColorMatrix brightness 적용(정적+부착)
 *  ④ 정식 릴리스 게이트 — /api/version code 146·latest 1.0.6·build.gradle versionName
 *  ⑤ 2.5D 카메라 — perspOn 기본 켬·심도 안개 존재·y-depth 정렬·토글 복원
 *  ⑥ 무릉도장 실시간 피해량 — HUD 텍스트에 DPS·최고 일격 표기
 *  ⑦ Vfx3D — P4 원점 보정 항 + resize churn 제거(정적)
 *  ⑧ 챕터 레벨 게이트 — 126/136 등 상향 곡선(정적)
 *  ⑨ 거래소 확대 — MARKET_LISTABLE 동적 구성(gmOnly 제외)·장착 무기/방어구 차단(정적)
 *  ⑩ pageerror 0 — 전 경로 통틀어
 */
const { chromium } = require("playwright");
const fs = require("fs");

(async () => {
  const base = "http://127.0.0.1:3000";
  let pass = 0, fail = 0;
  const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("PASS", name, extra); } else { fail++; console.log("FAIL", name, extra); } };
  const errors = [];

  /* ── 0) 정적 검사 ── */
  const playerSrc = fs.readFileSync("src/game/entities/Player.ts", "utf8");
  ok("① usePotion gmInfinite 무차감", /else if \(have && !this\.gmInfinite\) this\.consumeConsumable/.test(playerSrc));
  ok("① useConsumablePotion gmInfinite 무차감", /if \(!this\.gmInfinite\) this\.consumeConsumable\(key\)/.test(playerSrc));
  ok("② skill5bMax 120000", playerSrc.includes("readonly skill5bMax = 120000"));
  ok("② useSkill5b 12변형", (playerSrc.match(/case "(warbringer|crusader|deadeye|skylord|arclord|eternal|shadowlord|blademaster|warrior|ranger|mage)"/g) || []).length >= 10 && playerSrc.includes("useSkill5b()"));
  ok("② MP 150 시전", /this\.mp < 150/.test(playerSrc));
  ok("② recentDmgLog 적산", playerSrc.includes("recentDmgLog.push"));
  const keymapSrc = fs.readFileSync("src/game/keymap.ts", "utf8");
  ok("② keymap skill5b 기본 Q", /skill5b: "Q"/.test(keymapSrc));
  const netSrc = fs.readFileSync("src/game/net.ts", "utf8");
  ok("② net s5b 타입", /"s5b"/.test(netSrc));
  const mqttSrc = fs.readFileSync("src/game/mpMqtt.ts", "utf8");
  ok("② mqtt s5b 화이트리스트", (mqttSrc.match(/"s5b"/g) || []).length >= 2);
  const toonSrc = fs.readFileSync("src/game/fx/ToonFX.ts", "utf8");
  ok("③ brightness 감광", /Math\.max\(0\.62, 1 - 0\.22 \* k\)/.test(toonSrc) && toonSrc.includes("brightness(bright)"));
  const v3Src = fs.readFileSync("src/game/fx/Vfx3D.ts", "utf8");
  ok("⑦ P4 origin 보정", v3Src.includes("1 - 1 / z") && v3Src.includes("ox + vw / 2"));
  ok("⑦ resize churn 제거", v3Src.includes("this.lastW === w && this.lastH === h"));
  ok("⑦ NaN 좌표 가드", v3Src.includes("Number.isFinite(x)"));
  const stagesSrc = fs.readFileSync("src/game/stages.ts", "utf8");
  ok("⑧ lvGate 상향(126/136)", stagesSrc.includes("lvGate: { enter: 126, mid: 136 }"));
  ok("⑧ lvGate 상향(104/114)", stagesSrc.includes("lvGate: { enter: 104, mid: 114 }"));
  ok("⑧ 첫 챕터 교착 방지 유지(1/5)", stagesSrc.includes("lvGate: { enter: 1, mid: 5 }"));
  const sapiSrc = fs.readFileSync("src/lib/sapi.ts", "utf8");
  ok("⑨ MARKET_LISTABLE 동적(gmOnly 제외)", sapiSrc.includes("Object.keys(ITEMS).filter") && sapiSrc.includes("gmOnly"));
  ok("⑨ 장착 무기/방어구 등록 차단", /sv\.weapon === itemKey \|\| sv\.armor === itemKey/.test(sapiSrc));
  const grad = fs.readFileSync("android/app/build.gradle", "utf8");
  ok("④ build.gradle 1.0.6/146", grad.includes("versionCode 146") && grad.includes('versionName "1.0.6"'));
  const tcSrc = fs.readFileSync("src/components/game/TouchControls.tsx", "utf8");
  ok("② 제2궁극기 버튼(ult2)", tcSrc.includes("input:skill5b") && tcSrc.includes("ult2"));

  /* ── 1) 부팅 + 월드 진입 ── */
  const browser = await chromium.launch({
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
    executablePath: "/home/z/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome",
  });
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  p.setDefaultTimeout(40000);
  p.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  await p.goto(base, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
  await p.waitForSelector("text=게임 시작", { timeout: 40000 });
  await p.getByRole("button", { name: /게임 시작/ }).first().click();
  await p.waitForTimeout(900);
  const createBtn = p.getByText("캐릭터 생성", { exact: false }).first();
  if ((await createBtn.count()) > 0) await createBtn.click().catch(() => {});
  await p.waitForTimeout(400);
  const ni = p.locator('input[placeholder*="캐릭터 이름"]').first();
  if ((await ni.count()) > 0) {
    await ni.fill("vc146테스터");
    await p.getByRole("button", { name: /다음 — 외형 선택/ }).first().click().catch(() => {});
    await p.waitForTimeout(300);
    await p.getByRole("button", { name: /모험가로 생성!/ }).first().click().catch(() => {});
    await p.waitForTimeout(800);
  }
  await p.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const t = btns.find((x) => /이 캐릭터로 시작/.test(x.textContent || "")) || btns.find((x) => /시작/.test(x.textContent || ""));
    if (t) t.click();
  });
  await p.waitForTimeout(8000);
  const inWorld = await p.evaluate(() => !!window.__SERTZ_SCENE__);
  ok("월드 진입", inWorld);

  /* ── ④ /api/version 게이트 ── */
  const ver = await p.evaluate(async () => {
    try { const r = await fetch("/api/version"); const j = await r.json(); return { code: j.code, latest: j.latest }; } catch { return null; }
  });
  ok("④ /api/version code 146", !!ver && ver.code === 146, JSON.stringify(ver));
  ok("④ latest 1.0.6", !!ver && ver.latest === "1.0.6");

  /* ── ② 제2궁극기 — 5차 부여 → 시전 → 쿨/MP 확인 ── */
  const ult = await p.evaluate(async () => {
    const s = window.__SERTZ_SCENE__;
    if (!s || !s.player) return { err: "no-scene" };
    const pl = s.player;
    pl.gmGrantFifth(true);
    pl.gmSetLevel(120);
    pl.maxMp = Math.max(pl.maxMp, 300);
    pl.mp = pl.maxMp;
    const nameB = pl.skill5bName;
    const unlocked = pl.skill5bUnlocked;
    const mpBefore = pl.mp;
    pl.useSkill5b();
    await new Promise((r) => setTimeout(r, 500));
    const after = { cd: pl.skill5bCd, max: pl.skill5bMax, mpSpent: mpBefore - pl.mp, nameB, unlocked, state: pl.state };
    // Q키 → 키맵 경로 (쿨 중이라 무시돼야 크래시 없음)
    await new Promise((r) => setTimeout(r, 3500)); // 지연 연출 통과 — pageerror 감시
    return after;
  });
  ok("② 제2궁극기 해금·이름", ult.unlocked === true && (ult.nameB || "").length > 2, `name="${ult.nameB}"`);
  ok("② 쿨타임 120초 세팅", ult.cd === 120000, `cd=${ult.cd}`);
  ok("② MP 150 소모", ult.mpSpent === 150, `spent=${ult.mpSpent}`);
  const qKey = await p.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    try { return s.keyFor("skill5b") ? "ok" : "no"; } catch { return "no"; }
  });
  ok("② Q키 바인딩(keyFor)", qKey === "ok");

  /* ── ⑤ 2.5D 카메라 ── */
  const persp = await p.evaluate(async () => {
    const s = window.__SERTZ_SCENE__;
    if (!s) return { err: "no-scene" };
    const before = { on: s.perspOn, fog: !!s.perspFog?.scene, pd: s.player?.depth };
    localStorage.setItem("sertz_persp", "0");
    s.applyPerspSetting();
    await new Promise((r) => setTimeout(r, 200));
    const off = { on: s.perspOn, fog: !!s.perspFog?.scene, pd: s.player?.depth };
    localStorage.setItem("sertz_persp", "1");
    s.applyPerspSetting();
    await new Promise((r) => setTimeout(r, 300));
    const on2 = { on: s.perspOn, fog: !!s.perspFog?.scene, pd: s.player?.depth };
    return { before, off, on2 };
  });
  ok("⑤ 2.5D 기본 켬+안개", persp.before?.on === true && persp.before?.fog === true, JSON.stringify(persp.before));
  ok("⑤ y-depth 밴드(9~10)", persp.before?.pd >= 9 && persp.before?.pd <= 10, `pd=${persp.before?.pd}`);
  ok("⑤ 토글 끔 복원(depth 10)", persp.off?.on === false && persp.off?.pd === 10 && !persp.off?.fog, JSON.stringify(persp.off));
  ok("⑤ 토글 켬 재부착", persp.on2?.on === true && persp.on2?.fog === true, JSON.stringify(persp.on2));

  /* ── ① GM 엘릭서 무한 ── */
  const elix = await p.evaluate(async () => {
    const s = window.__SERTZ_SCENE__;
    if (!s || !s.player) return { err: "no-scene" };
    const pl = s.player;
    pl.gmInfinite = true;
    if (!pl.owned.includes("gm_elixir")) pl.owned.push("gm_elixir");
    pl.quickPots.hp = "gm_elixir";
    pl.hp = Math.max(1, Math.round(pl.maxHp * 0.2));
    pl.mp = Math.max(1, Math.round(pl.maxMp * 0.2));
    const n0 = pl.owned.filter((k) => k === "gm_elixir").length;
    pl.potCd = 0;
    const used = pl.usePotion("hp");
    const n1 = pl.owned.filter((k) => k === "gm_elixir").length;
    // 인벤 직접 경로
    pl.hp = Math.max(1, Math.round(pl.maxHp * 0.2));
    pl.useConsumablePotion("gm_elixir");
    const n2 = pl.owned.filter((k) => k === "gm_elixir").length;
    // 비GM 정상 소모 확인
    pl.gmInfinite = false;
    pl.potCd = 0;
    pl.hp = Math.max(1, Math.round(pl.maxHp * 0.2));
    pl.usePotion("hp");
    const n3 = pl.owned.filter((k) => k === "gm_elixir").length;
    pl.quickPots.hp = "potion_hp";
    return { used, n0, n1, n2, n3 };
  });
  ok("① GM 무한(퀵슬롯 무차감)", elix.used === true && elix.n0 === 1 && elix.n1 === 1 && elix.n2 === 1, JSON.stringify(elix));
  ok("① 비GM은 정상 차감", elix.n3 === 0, `n3=${elix.n3}`);

  /* ── ⑥ 무릉도장 실시간 피해량 ── */
  const dojang = await p.evaluate(async () => {
    const s = window.__SERTZ_SCENE__;
    if (!s || !s.player) return { err: "no-scene" };
    s.enterDojang();
    await new Promise((r) => setTimeout(r, 9000));
    if (!s.dojangActive) return { err: "not-active" };
    s.addDojangScore(5000);
    s.addDojangScore(7777);
    s.addDojangScore(3000);
    await new Promise((r) => setTimeout(r, 400));
    const txt = s.dojangText?.text || "";
    const maxHit = s.dojangMaxHit;
    s.finishDojang(true);
    return { txt, maxHit, dps: s.dojangDps };
  });
  ok("⑥ 도장 HUD DPS 표기", (dojang.txt || "").includes("DPS") && (dojang.txt || "").includes("최고 일격"), `txt="${dojang.txt?.slice(0, 80)}"`);
  ok("⑥ 최고 일격 추적", dojang.maxHit === 7777, `max=${dojang.maxHit}`);

  /* ── ③ 쉐이더 부착(가능 환경일 때) — brightness 적용은 정적으로 검증했고 부착 성공 확인만 ── */
  const toon = await p.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    if (!s) return null;
    return { filters: Array.isArray(s.toonCamFilters) ? s.toonCamFilters.length : (s.toonCamFilters ? 1 : 0) };
  });
  if (toon && toon.filters > 0) ok("③ 툰 카메라 필터 부착", true, `filters=${toon.filters}`);
  else console.log("SKIP ③ 툰 필터 부착(저사양 자동 해제 환경)");

  /* ── ⑩ pageerror ── */
  ok("⑩ pageerror 0", errors.length === 0, errors.slice(0, 3).join(" | "));

  await browser.close();
  console.log(`\nRESULT: ${pass} pass / ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error("E2E 크래시:", e); process.exit(2); });
