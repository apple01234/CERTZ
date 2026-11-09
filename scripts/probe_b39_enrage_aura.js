/**
 * REVAMP_ABC_300 B39 — 보스 격노 오라 "런타임 렌더" 확증 프로브.
 *
 * [왜 이 스크립트가 필요한가]
 *  tests/boss-enrage-aura.test.mjs 는 전부 **소스 계약**(정적 정규식)이다.
 *  "startEnrageAura() 안에 add.graphics 가 있다"까지만 보장하고,
 *  "그게 실제로 화면에 붉은 고리로 보이는가"는 아무도 확인하지 못했다.
 *  vc288 커밋도 이 지점을 🟡 로 남겼다(hasAura:false 의 원인 미규명).
 *
 * [검증 방식 — 픽셀 실측]
 *  1) 보스전에 진입해 보스를 스폰한다.
 *  2) 보스 HP 를 30% 이하로 떨어뜨려 페이즈 3(=enraged) 을 만든다.
 *  3) 씬에 실제로 존재하는 Graphics 객체와 그 depth/위치/명령 수를 런타임에서 읽는다.
 *  4) 캔버스에서 보스 발밑 영역을 잘라 붉은 픽셀(R 우세) 비율을 측정한다.
 *  5) 격노 전/후를 비교해 "오라 켜짐"이 픽셀로 드러나는지 본다.
 *
 * 사용: node scripts/probe_b39_enrage_aura.js
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = "/root/.hermes/cache/scratch/b39";
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 캔버스 영역의 붉은 픽셀 비율을 sharp 로 계산한다. */
async function redRatio(buf, crop) {
  const sharp = require("sharp");
  let img = sharp(buf);
  if (crop) img = img.extract(crop);
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  let red = 0, total = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    total++;
    /* 붉은 고리 판정: R 이 G·B 보다 확실히 크고, 너무 어둡지 않을 것 */
    if (r > 90 && r - g > 28 && r - b > 20) red++;
  }
  return { ratio: total ? red / total : 0, red, total };
}

(async () => {
  const browser = await chromium.launch({
    args: ["--use-gl=swiftshader", "--no-sandbox", "--disable-web-security"],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 200)));
  page.on("console", (m) => {
    if (m.type() === "error") errs.push("CONSOLE: " + m.text().slice(0, 200));
  });

  const report = { steps: [], errors: [] };
  const note = (k, v) => {
    report.steps.push({ k, v });
    console.log(`  ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
  };

  await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);

  /* ── 캐릭터 생성 → 시작 (기존 E2E 와 동일 경로) ───────────────── */
  await page.evaluate(() => localStorage.removeItem("sertz_save_v2"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  const clickedStart = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const t = btns.find((x) => /새로운 모험|게임 시작/.test(x.textContent || ""));
    if (t) { t.click(); return t.textContent.trim(); }
    return null;
  });
  note("입장 버튼", clickedStart);
  await page.waitForTimeout(1200);

  /* 이미 세이브가 있으면 바로 시작, 없으면 생성 플로우 */
  const startedGame = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const t = btns.find((x) => /이 캐릭터로 시작|캐릭터 생성/.test(x.textContent || ""));
    if (t) { t.click(); return t.textContent.trim(); }
    return null;
  });
  note("시작/생성 버튼", startedGame);
  await page.waitForTimeout(1500);

  const created = await page.evaluate(() => {
    const inp = document.querySelector('input[placeholder*="캐릭터 이름"]');
    if (inp) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(inp, "오라확증");
      inp.dispatchEvent(new Event("input", { bubbles: true }));
      return "이름 입력";
    }
    return "입력창 없음(이미 생성됨)";
  });
  note("캐릭터명", created);
  await page.waitForTimeout(400);

  for (const label of [/다음/, /생성!/, /이 캐릭터로 시작/]) {
    await page.evaluate((src) => {
      const re = new RegExp(src);
      const b = [...document.querySelectorAll("button")].find((x) => re.test(x.textContent || ""));
      if (b) b.click();
    }, label.source).catch(() => {});
    await page.waitForTimeout(700);
  }

  /* ── 월드 씬 대기 ─────────────────────────────────────────────── */
  let sceneOk = false;
  for (let i = 0; i < 40; i++) {
    sceneOk = await page.evaluate(() => {
      const s = window.__SERTZ_SCENE__;
      return !!s && !!s.stageDef?.key;
    }).catch(() => false);
    if (sceneOk) break;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
  }
  note("월드 씬 준비", sceneOk);
  if (!sceneOk) {
    console.log("!! 월드 씬 진입 실패 — 중단");
    await browser.close();
    process.exit(1);
  }

  /* 프롤로그/컷신 스킵 */
  for (let i = 0; i < 40; i++) {
    const done = await page.evaluate(() => {
      const s = window.__SERTZ_SCENE__;
      return !!s && s.dialoguing !== true;
    }).catch(() => false);
    if (done) break;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
  }
  note("현재 스테이지", await page.evaluate(() => window.__SERTZ_SCENE__?.stageDef?.key));

  /* ── 보스 스테이지로 이동 ─────────────────────────────────────── */
  const bossKey = "alfheim10";
  let landed = false;
  for (let i = 0; i < 30 && !landed; i++) {
    landed = await page.evaluate((key) => {
      const s = window.__SERTZ_SCENE__;
      if (!s?.gotoStage) return false;
      if (s.stageDef?.key === key) return true;
      try { s.gotoStage(key); } catch (e) { return "err:" + e.message; }
      return false;
    }, bossKey);
    if (landed === true) break;
    await page.waitForTimeout(800);
    await page.keyboard.press("Enter");
  }
  note("보스 스테이지 도착", landed);
  if (landed !== true) {
    console.log("!! 보스 스테이지 이동 실패 — 중단");
    await browser.close();
    process.exit(1);
  }
  await page.waitForTimeout(3500);

  /* 보스 객체 찾기 — 씬의 후보 필드를 훑는다 */
  const bossInfo = await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    const cands = [];
    for (const k of Object.keys(s)) {
      const v = s[k];
      if (v && typeof v === "object" && (v.isBoss === true || v.constructor?.name === "Boss")) {
        cands.push(k);
      }
    }
    return {
      fields: cands,
      listLen: Array.isArray(s.bosses) ? s.bosses.length : null,
      bossFieldType: s.boss ? s.boss.constructor?.name : null,
    };
  });
  note("보스 필드 탐색", bossInfo);

  /* ── 격노 전: 오라 상태 + 픽셀 ────────────────────────────────── */
  const before = await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    const b = s.boss ?? (Array.isArray(s.bosses) ? s.bosses[0] : null);
    if (!b) return { found: false };
    return {
      found: true,
      hp: b.hp, maxHp: b.maxHp,
      enraged: b.enraged,
      phase: b.phase ?? null,
      alive: b.alive,
      /* private 필드는 런타임에서 실제로 읽힌다(TS private 은 컴파일 후 평범한 프로퍼티) */
      auraExists: !!b.enrageAura,
      auraDepth: b.enrageAura?.depth ?? null,
      bossDepth: b.depth,
      auraCmd: b.enrageAura?.commandBuffer?.length ?? null,
      auraX: b.enrageAura?.x ?? null,
      auraY: b.enrageAura?.y ?? null,
      bossX: b.x, bossY: b.y,
      visible: b.enrageAura?.visible ?? null,
      alpha: b.enrageAura?.alpha ?? null,
    };
  });
  note("격노 전 보스", before);

  const shotBefore = await page.screenshot();
  fs.writeFileSync(path.join(OUT, "before.png"), shotBefore);

  /* ── HP 를 30% 이하로 강제 → 페이즈 3 트리거 ─────────────────── */
  const forced = await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    const b = s.boss ?? (Array.isArray(s.bosses) ? s.bosses[0] : null);
    if (!b) return { ok: false };
    const target = Math.max(1, Math.floor(b.maxHp * 0.28));
    const before = { hp: b.hp, enraged: b.enraged, phase: b.phase ?? null };
    /* 실제 피해 경로를 태워야 onPhaseChange/destroyPool 등 부수효과가 같이 돈다 */
    try {
      if (typeof b.takeDamage === "function") b.takeDamage(b.hp - target, null, null, "probe");
      else b.hp = target;
    } catch (e) {
      b.hp = target;
      return { ok: true, via: "direct", err: e.message, before };
    }
    return {
      ok: true, via: "takeDamage", before,
      after: { hp: b.hp, enraged: b.enraged, phase: b.phase ?? null },
    };
  });
  note("HP 강제 하향", forced);

  /* 오라 타이머 2틱 이상 돌 시간을 준다 (90ms 간격) */
  await page.waitForTimeout(1200);

  const after = await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    const b = s.boss ?? (Array.isArray(s.bosses) ? s.bosses[0] : null);
    if (!b) return { found: false };
    return {
      found: true,
      hp: b.hp, maxHp: b.maxHp,
      enraged: b.enraged,
      phase: b.phase ?? null,
      alive: b.alive,
      auraExists: !!b.enrageAura,
      auraDepth: b.enrageAura?.depth ?? null,
      bossDepth: b.depth,
      auraCmd: b.enrageAura?.commandBuffer?.length ?? null,
      auraX: b.enrageAura?.x ?? null,
      auraY: b.enrageAura?.y ?? null,
      bossX: b.x, bossY: b.y,
      visible: b.enrageAura?.visible ?? null,
      alpha: b.enrageAura?.alpha ?? null,
      timerActive: !!b.enrageAuraTimer,
      timerDelay: b.enrageAuraTimer?.delay ?? null,
    };
  });
  note("격노 후 보스", after);

  const shotAfter = await page.screenshot();
  fs.writeFileSync(path.join(OUT, "after.png"), shotAfter);

  /* ── 픽셀 실측: 보스 발밑 영역 ──────────────────────────────── */
  /* 월드 좌표 → 화면 좌표 변환은 카메라 스크롤/줌을 따라야 한다. 씬에서 직접 받아온다. */
  const screenPos = await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    const b = s.boss ?? (Array.isArray(s.bosses) ? s.bosses[0] : null);
    if (!b) return null;
    const cam = s.cameras?.main;
    if (!cam) return null;
    const px = (b.x - cam.worldView.x) * cam.zoom;
    const py = (b.y + 12 - cam.worldView.y) * cam.zoom;
    /* 캔버스가 CSS 로 스케일되므로 캔버스 픽셀 좌표로 환산 */
    const cv = s.game?.canvas;
    const rect = cv?.getBoundingClientRect();
    const scale = cv && rect && rect.width ? cv.width / rect.width : 1;
    return {
      cx: px * scale, cy: py * scale,
      zoom: cam.zoom, scale,
      canvasW: cv?.width, canvasH: cv?.height, dpr: window.devicePixelRatio,
    };
  });
  note("보스 화면 좌표", screenPos);

  if (screenPos) {
    const rad = Math.round(56 * (screenPos.zoom ?? 1) * (screenPos.scale ?? 1));
    const crop = {
      left: Math.max(0, Math.round(screenPos.cx - rad)),
      top: Math.max(0, Math.round(screenPos.cy - rad)),
      width: Math.min(rad * 2, 1280 - Math.max(0, Math.round(screenPos.cx - rad))),
      height: Math.min(rad * 2, 720 - Math.max(0, Math.round(screenPos.cy - rad))),
    };
    const rBefore = await redRatio(shotBefore, crop);
    const rAfter = await redRatio(shotAfter, crop);
    note("발밑 붉은픽셀 비율 (격노 전)", rBefore);
    note("발밑 붉은픽셀 비율 (격노 후)", rAfter);
    const delta = rAfter.ratio - rBefore.ratio;
    note("붉은픽셀 증가분", { delta: Number(delta.toFixed(5)), x: (rAfter.ratio / (rBefore.ratio || 1e-9)).toFixed(2) + "배" });
  }

  /* ── 판정 ────────────────────────────────────────────────────── */
  const verdict = {
    auraCreated: after.auraExists === true,
    auraBehindBoss: after.auraExists ? after.auraDepth < after.bossDepth : false,
    auraHasCommands: (after.auraCmd ?? 0) > 0,
    auraFollowsBoss:
      after.auraExists && Math.abs((after.auraX ?? 0) - after.bossX) < 80 &&
      Math.abs((after.auraY ?? 0) - (after.bossY + 12)) < 80,
    enragedFlag: after.enraged === true,
    timerRunning: after.timerActive === true,
  };
  console.log("\n=== 판정 ===");
  for (const [k, v] of Object.entries(verdict)) console.log(`  ${v ? "PASS" : "FAIL"} — ${k}`);

  console.log("\n=== 콘솔 에러 ===", errs.length ? errs.slice(0, 5) : "없음");

  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ ...report, verdict, errs }, null, 2));
  console.log(`\n스크린샷: ${OUT}/before.png, ${OUT}/after.png`);

  await browser.close();
  const allPass = Object.values(verdict).every(Boolean);
  process.exit(allPass ? 0 : 2);
})();
