/**
 * REVAMP_ABC_300 B39 — 보스 격노 오라 "런타임 렌더" 확증 프로브.
 *
 * [왜 이 스크립트가 필요한가]
 *  tests/boss-enrage-aura.test.mjs 는 전부 **소스 계약**(정적 정규식)이다.
 *  "startEnrageAura() 안에 add.graphics 가 있다"까지만 보장하고,
 *  "그게 실제로 화면에 붉은 고리로 보이는가"는 아무도 확인하지 못했다.
 *  vc288 커밋도 이 지점을 🟡 로 남겼다(hasAura:false 의 원인 미규명).
 *
 * [검증 방식]
 *  1) 보스전에 진입해 보스를 스폰한다.
 *  2) 보스 HP 를 28% 로 떨어뜨려 페이즈 3(=enraged) 을 만든다.
 *  3) 씬에 실제로 존재하는 Graphics 객체의 depth/위치/명령 수를 런타임에서 읽는다.
 *  4) **오라만 켜고 끈 두 장**을 캔버스에서 떠서 붉은 픽셀 차이를 잰다.
 *     (한 장은 enrageAura.setVisible(false), 다른 한 장은 true)
 *     → 배경·보스 스프라이트·파편 같은 공통 요소가 상쇄되어 "오라 자체"가 증명된다.
 *     종전엔 격노 전/후 두 장을 비교했는데, onPhaseChange 가 붉은 3D 파편
 *     (cine3d tint 0xff4a3a, 1300ms)을 뿌려 오라가 없어도 붉은 픽셀이 늘었다.
 *
 * 사용: node scripts/probe_b39_enrage_aura.js
 *       BOSS_STAGE=howlrstone3x5 node scripts/probe_b39_enrage_aura.js
 * 종료코드: 0 전부 PASS / 2 FAIL 있음 / 3 픽셀 증명 불가(snapshot 미동작)
 */
const { chromium } = require("playwright");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const OUT = "/root/.hermes/cache/scratch/b39";
fs.mkdirSync(OUT, { recursive: true });

/* ── 진입 스테이지 결정 ───────────────────────────────────────────
 *  src/game/stages.ts 의 parseStage() 가 받는 형식만 유효하다.
 *  종전 기본값 "alfheim10" 은 파서에 없어 { ch:"village", sub:0 } 로
 *  떨어졌고, 프로브는 항상 마을에서 돌아 보스가 없었다. */
const BOSS_STAGE = process.env.BOSS_STAGE || "dlcstargate10";
const STAGE_KEY_RE = new RegExp(
  "^(?:" +
    "howlrstone(?:[1-9]|1[0-5])x(?:[1-9]|10)" + // 영프 편 15장 × 10구역
    "|(?:dlcstargate|dlcprisma|dlcocean|dlcreverse|dlcneocity|dlcmech" +
    "|dlcswallow|dlcopinicia|dlcnovel|dlcsernium)(?:[1-9]|10)" + // 본편/DLC
  ")$"
);
if (!STAGE_KEY_RE.test(BOSS_STAGE)) {
  console.error(`!! BOSS_STAGE="${BOSS_STAGE}" 는 parseStage 가 인식하지 못하는 키다(village 로 떨어진다).`);
  console.error("   예: dlcstargate10, howlrstone3x5");
  process.exit(1);
}

/** 캔버스 영역의 붉은 픽셀 비율을 sharp 로 계산한다. */
async function redRatio(buf, crop) {
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

/**
 * Phaser 캔버스에서 직접 픽셀을 뜬다.
 *
 * [왜 page.screenshot 이 아니라 이걸 쓰나]
 *  vc290 에서 page.screenshot() 이 계속 로딩/타이틀 화면을 찍었다.
 *  원인은 React 오버레이(#root 위 DOM)가 <canvas> 를 덮고 있어서다.
 *  보스 객체는 정상 생성되고 Graphics 명령도 28개 있는데 스크린샷엔 안 잡혔다.
 *  renderer.snapshot() 은 **캔버스 백킹스토어만** 읽으므로 DOM 오버레이와 무관하다.
 */
async function canvasPng(page) {
  const dataUrl = await page.evaluate(async () => {
    const g = window.__SERTZ__?.game;
    if (!g?.renderer?.snapshot) return null;
    return await new Promise((res) => {
      try {
        g.renderer.snapshot((img) => res(img && img.src ? img.src : null));
      } catch (e) { res(null); }
    });
  });
  if (!dataUrl || !dataUrl.startsWith("data:image")) return null;
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

/** 캔버스 좌표(월드→캔버스 픽셀)로 보스 발밑 크롭을 계산한다. */
async function bossCrop(page, radius) {
  return await page.evaluate((rad) => {
    const s = window.__B39_W__;
    const b = s?.boss;
    const cam = s?.cameras?.main;
    if (!b || !cam) return null;
    const zoom = cam.zoom || 1;
    /* snapshot 은 캔버스 백킹스토어 크기 기준. camera.width/height 가 그 값이다. */
    const cw = cam.width;
    const ch = cam.height;
    const cx = (b.x - cam.worldView.x) * zoom;
    const cy = (b.y + 12 - cam.worldView.y) * zoom;
    const left = Math.min(Math.max(0, Math.round(cx - rad)), Math.max(0, cw - 2));
    const top = Math.min(Math.max(0, Math.round(cy - rad)), Math.max(0, ch - 2));
    return {
      crop: { left, top, width: Math.max(1, Math.min(rad * 2, cw - left)), height: Math.max(1, Math.min(rad * 2, ch - top)) },
      canvas: { w: cw, h: ch }, center: [Math.round(cx), Math.round(cy)], zoom,
    };
  }, radius);
}

/** 오라 표시 여부를 바꾸고 두 프레임 이상 지나길 기다린다. */
async function setAuraVisible(page, vis) {
  return await page.evaluate(async (v) => {
    const b = window.__B39_W__?.boss;
    if (!b?.enrageAura) return false;
    b.enrageAura.setVisible(v);
    /* 백킹스토어에 반영되려면 최소 한 프레임은 그려져야 한다 */
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return true;
  }, vis);
}

/** 부팅 완료(=타이틀의 "게임 시작" 버튼이 보임)까지 조건 대기. */
async function waitForStart(page, timeoutMs = 150000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const hasBtn = await page.evaluate(() => {
      if (!window.__SERTZ__?.game) return false;
      return [...document.querySelectorAll("button")]
        .some((x) => x.offsetParent !== null && /게임 시작/.test(x.textContent || ""));
    }).catch(() => false);
    if (hasBtn) return { ok: true, ms: Date.now() - t0 };
    await page.waitForTimeout(1000);
  }
  return { ok: false, ms: Date.now() - t0 };
}

/**
 * 로비에서 캐릭터를 만든다. 이미 있으면 건너뛴다.
 *  각 클릭의 성공/실패를 log 에 남겨 실패 지점을 알 수 있게 한다.
 *  (종전엔 false 만 돌려줘서 왜 멈췄는지 로그로 알 수 없었다)
 */
async function ensureCharacter(page) {
  return await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const log = [];
    const clickBy = (re) => {
      const el = [...document.querySelectorAll("button")].filter((x) => x.offsetParent !== null)
        .find((x) => re.test((x.textContent || "").trim()));
      if (el) { el.click(); log.push([re.source, "ok"]); return true; }
      log.push([re.source, "miss"]);
      return false;
    };
    const hasChar = () => {
      try {
        const s = JSON.parse(localStorage.getItem("sertz_slots_v1") || "null");
        return !!(s && s.chars && Object.keys(s.chars).length);
      } catch { return false; }
    };

    if (hasChar()) return { hasChar: true, skipped: true, log };

    clickBy(/게임 시작/);
    await wait(1500);
    clickBy(/캐릭터 생성/);
    await wait(1200);
    /* 이름 입력 — vc290 실패 원인이었다. input 이벤트를 직접 디스패치해야 React 가 인식한다. */
    const inp = document.querySelector('input[placeholder*="캐릭터 이름"]');
    log.push(["input(캐릭터 이름)", inp ? "ok" : "miss"]);
    if (inp) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(inp, "오라검증");
      inp.dispatchEvent(new Event("input", { bubbles: true }));
      inp.dispatchEvent(new Event("change", { bubbles: true }));
      await wait(500);
    }
    /* 버튼 문구는 "다음 — 외형 선택" 처럼 부가 설명이 붙는다. 앵커(^$)를 걸면 놓친다. */
    clickBy(/다음/);
    await wait(1300);
    clickBy(/모험가로 생성/);
    await wait(2500);

    return { hasChar: hasChar(), log };
  });
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

  const report = { steps: [] };
  const note = (k, v) => {
    report.steps.push({ k, v });
    console.log(`  ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
  };
  const bail = async (why) => {
    console.log("!! " + why + " — 중단");
    fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ ...report, errs }, null, 2));
    await browser.close();
    process.exit(1);
  };

  const URL = process.env.PROBE_URL || "http://localhost:3000";
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("canvas", { timeout: 60000 }).catch(() => {});

  /* ── 캐릭터 확보 (부팅 조건 대기 + 1회 재시도) ────────────────── */
  let boot = await waitForStart(page, 150000);
  note("부팅 대기", boot);
  if (!boot.ok) await bail("부팅 실패(\"게임 시작\" 버튼이 150초 안에 안 나옴)");

  let created = await ensureCharacter(page);
  note("캐릭터 준비", created);
  if (!created.hasChar) {
    /* 폼이 어중간한 상태로 남았을 수 있으므로 새로고침 후 한 번 더 */
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("canvas", { timeout: 60000 }).catch(() => {});
    boot = await waitForStart(page, 150000);
    created = await ensureCharacter(page);
    note("캐릭터 준비(재시도)", created);
  }
  if (!created.hasChar) await bail("캐릭터 생성 실패");

  /* ── 세이브 stage 패치: 슬롯 메타 + 캐릭터 SaveData 양쪽 ──
   *  [주의] sertz_slots_bak_v1 은 사용자의 원본 백업이다.
   *  종전엔 패치한 값을 백업에 덮어써 복구 지점을 스스로 지웠다. 읽기만 한다. */
  const patched = await page.evaluate((bossStage) => {
    const out = { slots: null, chars: [], bak: "untouched" };
    try {
      const s = JSON.parse(localStorage.getItem("sertz_slots_v1") || "null");
      if (s && s.chars) {
        for (const id of Object.keys(s.chars)) {
          s.chars[id].stage = bossStage;
          s.chars[id].cleared = false;
          s.chars[id].lv = Math.max(s.chars[id].lv || 1, 120);
        }
        localStorage.setItem("sertz_slots_v1", JSON.stringify(s));
        out.slots = bossStage;
        out.bak = localStorage.getItem("sertz_slots_bak_v1") ? "present(보존)" : "none";
      }
    } catch (e) { out.slotsErr = String(e).slice(0, 120); }

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith("sertz_char_")) continue;
      try {
        const d = JSON.parse(localStorage.getItem(k));
        d.stage = bossStage;
        d.cleared = false;
        d.lv = Math.max(d.lv || 1, 120);
        localStorage.setItem(k, JSON.stringify(d));
        out.chars.push(k);
      } catch (e) { out.chars.push(k + ":err"); }
    }
    return out;
  }, BOSS_STAGE);
  note("세이브 stage 패치", { ...patched, stage: BOSS_STAGE });

  /* 새로고침 → 로비에서 캐릭터 입장 */
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 60000 }).catch(() => {});
  const boot2 = await waitForStart(page, 150000);
  note("부팅 대기(새로고침)", boot2);
  if (!boot2.ok) await bail("새로고침 후 부팅 실패");

  const dbl = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const log = [];
    const b = [...document.querySelectorAll("button")].find((x) => /게임 시작/.test(x.textContent || ""));
    if (b) { b.click(); log.push(["게임 시작", "ok"]); await wait(1500); }
    else log.push(["게임 시작", "miss"]);
    /* 슬롯 카드 더블클릭 */
    const card = document.querySelector("[class*=slot], [data-slot], [class*=char]");
    if (card) {
      card.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, detail: 2 }));
      log.push(["카드 dblclick", "ok"]);
      await wait(1200);
    } else log.push(["카드 dblclick", "miss"]);
    /* 카드가 안 잡히면 텍스트로 시작 버튼 탐색 */
    const start = [...document.querySelectorAll("button")].filter((x) => x.offsetParent !== null)
      .find((x) => /이 캐릭터로 시작|입장|시작하기/.test((x.textContent || "").trim()));
    if (start) { start.click(); log.push(["시작 버튼", "ok"]); await wait(1200); }
    else log.push(["시작 버튼", "miss"]);
    return log;
  });
  note("로비 입장 시도", dbl);

  /* 월드 씬 활성화 대기 */
  let worldOk = false;
  for (let i = 0; i < 50; i++) {
    worldOk = await page.evaluate(() => {
      const g = window.__SERTZ__?.game;
      const w = g?.scene.getScene("world");
      return !!w && w.scene.isActive();
    }).catch(() => false);
    if (worldOk) break;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
  }
  note("world 활성", worldOk);
  if (!worldOk) await bail("world 씬 활성화 실패");
  note("진입 스테이지", await page.evaluate(() => window.__SERTZ__?.game?.scene?.getScene("world")?.stageDef?.key));

  /* 프롤로그/컷신/대화 스킵 */
  for (let i = 0; i < 40; i++) {
    const done = await page.evaluate(() => {
      const g = window.__SERTZ__?.game;
      const w = g?.scene.getScene("world");
      return !!w && w.dialoguing !== true && (w.introStep ?? 99) >= 2;
    }).catch(() => false);
    if (done) break;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(350);
  }

  /* 보스 스폰 */
  const entered = await page.evaluate(async () => {
    const game = window.__SERTZ__?.game;
    const world = game?.scene.getScene("world");
    if (!world) return { ok: false, why: "world 씬 없음" };
    window.__B39_W__ = world;
    /* 보스 난이도 게이트가 걸려 있으면 해제 (spawnBoss 가 즉시 반환하는 원인) */
    world.bossDiffPending = false;
    /* vc290 — 프롤로그 유예를 끝내야 Boss.tick() 이 updatePhase() 에 도달한다.
     *  isPrologueSafe 는 introStep 0~1 이거나 agroHoldUntil 이 미래면 true 라
     *  tick() 이 조기 반환하고, HP 를 내려도 페이즈가 1 에 머문다. */
    world.introStep = 99;
    world.agroHoldUntil = 0;
    if (!world.boss) {
      try { world.spawnBoss(false); } catch (e) { return { ok: false, why: "spawnBoss: " + e.message }; }
      await new Promise((r) => setTimeout(r, 3000));
    }
    if (!world.boss) return { ok: false, why: "boss 객체 생성 안 됨" };
    return {
      ok: true,
      name: world.boss.def?.name, hp: world.boss.hp, maxHp: world.boss.maxHp,
      phase: world.boss.phase, stage: world.stageDef?.key,
    };
  });
  note("보스전 진입", entered);
  if (!entered.ok) await bail("보스전 진입 실패 — " + entered.why);

  /* 보스 인트로 대사 스킵 (tick 을 막는다) */
  for (let i = 0; i < 30; i++) {
    const done = await page.evaluate(() => window.__B39_W__?.dialoguing !== true).catch(() => false);
    if (done) break;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
  }

  /* ── 격노 전 상태 ────────────────────────────────────────────── */
  const before = await page.evaluate(() => {
    const s = window.__B39_W__;
    const b = s.boss ?? (Array.isArray(s.bosses) ? s.bosses[0] : null);
    if (!b) return { found: false };
    return {
      found: true,
      hp: b.hp, maxHp: b.maxHp,
      enraged: b.enraged,
      phase: b.phase ?? null,
      /* private 필드는 런타임에서 실제로 읽힌다(TS private 은 컴파일 후 평범한 프로퍼티) */
      auraExists: !!b.enrageAura,
      bossX: b.x, bossY: b.y,
    };
  });
  note("격노 전 보스", before);
  if (!before.found) await bail("보스 객체 없음");

  /* 보스를 플레이어 앞으로 옮기고 카메라를 맞춘다.
   *  WorldScene 은 v5.0.1 부터 엔진 follow 를 쓰지 않고 update() 에서
   *  스크롤을 직접 계산한다. cam.centerOn 만으로는 다음 프레임에 덮어써지므로
   *  camCinema 를 세워 수동 추적을 잠시 보류시킨다(6초 워치독은 그 전에 끝난다). */
  const placed = await page.evaluate(async () => {
    const w = window.__B39_W__;
    const b = w.boss;
    if (!b) return null;
    const px = w.player?.x ?? w.stageW / 2;
    const py = w.player?.y ?? w.stageH / 2;
    b.setPosition(px + 60, py);
    if (b.body && typeof b.body.reset === "function") b.body.reset(b.x, b.y);
    b.setVelocity?.(0, 0);
    const cam = w.cameras?.main;
    if (cam) {
      w.camCinema = true;      /* 수동 카메라 추적 보류 */
      cam.stopFollow?.();
      cam.centerOn(b.x, b.y);
    }
    await new Promise((r) => setTimeout(r, 900));
    return {
      bossXY: [Math.round(b.x), Math.round(b.y)],
      camWorldView: [Math.round(cam.worldView.x), Math.round(cam.worldView.y)],
      camCinema: w.camCinema,
    };
  });
  note("보스 재배치", placed);

  /* ── HP 를 28% 로 강제 → 페이즈 3 트리거 ─────────────────────── */
  const forced = await page.evaluate(() => {
    const s = window.__B39_W__;
    const b = s.boss ?? (Array.isArray(s.bosses) ? s.bosses[0] : null);
    if (!b) return { ok: false };
    const target = Math.max(1, Math.floor(b.maxHp * 0.28));
    const b4 = { hp: b.hp, enraged: b.enraged, phase: b.phase ?? null };
    /* vc290 — Boss 에는 takeDamage 가 없다(그건 Player 쪽 메서드).
     *  HP 를 직접 내리고 updatePhase() 를 부르면 tick() 과 동일한 경로를 탄다. */
    b.hp = target;
    try {
      if (typeof b.updatePhase === "function") b.updatePhase();
      return { ok: true, via: "hp+updatePhase", before: b4, after: { hp: b.hp, enraged: b.enraged, phase: b.phase ?? null } };
    } catch (e) {
      return { ok: true, via: "hp-only", err: e.message, before: b4, after: { hp: b.hp, enraged: b.enraged, phase: b.phase ?? null } };
    }
  });
  note("HP 강제 하향", forced);

  /* onPhaseChange 는 cine3d() 로 붉은 파편을 1300ms 뿌린다.
   *  그게 사라진 뒤에 찍어야 오라만 남는다(지금은 on/off 비교로도 상쇄되지만
   *  남아 있으면 대비가 약해진다). */
  await page.waitForTimeout(2400);

  const after = await page.evaluate(() => {
    const s = window.__B39_W__;
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
      timerActive: !!b.enrageAuraTimer,
      timerDelay: b.enrageAuraTimer?.delay ?? null,
    };
  });
  note("격노 후 보스", after);

  /* ── 픽셀 실측: 오라만 켜고 끈 두 장 비교 ──────────────────────
   *  [physics.world.pause() 를 쓰지 않는 이유]
   *  종전엔 보스를 고정하려고 pause() 했는데, 캡처가 단색 rgb(20,0,0) 한 장으로
   *  나왔다. pause 가 스텝을 멈추면서 백킹스토어에 아무것도 그려지지 않은 것이다
   *  (파일 크기까지 off/on 동일 = 완전히 같은 빈 프레임).
   *  대신 보스 속도만 0 으로 두고 렌더는 계속 돌린 뒤, 여러 프레임을 떠서
   *  "색이 실제로 있는 프레임"을 골라 쓴다. 오라 링은 90ms 마다 다시 그려지므로
   *  한 프레임만 떠도 잡히지만, 타이밍 편차를 줄이려 3장씩 뜬다. */
  let pixel = { verifiable: false, why: "미시도" };
  const canProbe = await page.evaluate(() => {
    const w = window.__B39_W__;
    const b = w?.boss;
    if (!b?.enrageAura) return false;
    b.setVelocity?.(0, 0);
    /* 보스가 도망가지 않게 모드도 고정 */
    b.mode = "idle";
    b.nextAttackCd = 999999;
    return true;
  });

  /**
   * 빈 프레임(단색)을 버리고 "실제로 그려진" 프레임을 얻는다.
   *
   * [왜 재시도가 필요한가]
   *  renderer.snapshot() 은 캡처를 다음 렌더에 예약한다. 토글 직후에 부르면
   *  아직 반영 전이거나, WebGL 리드백 타이밍이 어긋나 단색 rgb(20,0,0) 한 장이
   *  나오는 경우가 있었다(실측: off 3장 중 내용 있는 것 1, on 3장 전부 빈 프레임).
   *  → 최대 12회까지 떠서 빈 프레임은 버리고, 처음 나온 정상 프레임을 쓴다.
   *  토글 후 2프레임을 먼저 기다려 이전 상태가 찍히는 지연도 함께 막는다.
   */
  async function grabLive(tag) {
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    );
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(120);
      const buf = await canvasPng(page);
      if (!buf) continue;
      const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
      /* 단색 여부: 첫 픽셀과 다른 픽셀이 하나라도 있으면 그려진 프레임 */
      const [r0, g0, b0] = [data[0], data[1], data[2]];
      let varied = 0;
      for (let k = info.channels; k < data.length; k += info.channels * 53) {
        if (data[k] !== r0 || data[k + 1] !== g0 || data[k + 2] !== b0) varied++;
      }
      if (varied > 5) {
        fs.writeFileSync(path.join(OUT, `canvas_aura_${tag}.png`), buf);
        return { buf, varied, tries: i + 1 };
      }
    }
    return { buf: null, varied: 0, tries: 12 };
  }

  if (canProbe) {
    const cropInfo = await bossCrop(page, 80);
    note("발밑 크롭", cropInfo);
    if (cropInfo) {
      const { crop } = cropInfo;

      /* OFF 3장 */
      const okOff = await setAuraVisible(page, false);
      const off = await grabLive("off");
      /* ON 3장 */
      const okOn = await setAuraVisible(page, true);
      const on = await grabLive("on");

      if (off.buf && on.buf) {
        const rOff = await redRatio(off.buf, crop);
        const rOn = await redRatio(on.buf, crop);
        const gOff = await redRatio(off.buf, null);
        const gOn = await redRatio(on.buf, null);
        note("프레임 내용량", { off: off.varied, on: on.varied, offTries: off.tries, onTries: on.tries });
        note("발밑 붉은픽셀 (오라 OFF)", rOff);
        note("발밑 붉은픽셀 (오라 ON)", rOn);
        note("캔버스 전체 붉은픽셀", { off: gOff.ratio, on: gOn.ratio });
        const footDelta = rOn.ratio - rOff.ratio;
        const globalDelta = gOn.ratio - gOff.ratio;
        note("오라 기여분", {
          foot: Number(footDelta.toFixed(5)),
          global: Number(globalDelta.toFixed(5)),
          redPixels: rOn.red - rOff.red,
        });
        pixel = {
          verifiable: true,
          rose: footDelta > 0.002 || globalDelta > 0.002,
          footDelta: Number(footDelta.toFixed(5)),
          globalDelta: Number(globalDelta.toFixed(5)),
          toggleOk: okOff && okOn,
        };
      } else {
        /* 12회 재시도에도 그려진 프레임을 못 얻음 — 렌더 자체가 없는 상태 */
        pixel = {
          verifiable: false,
          why: `정상 프레임 확보 실패 (off varied=${off.varied}, on varied=${on.varied}) — snapshot 이 빈 프레임만 반환`,
        };
      }
    } else {
      pixel = { verifiable: false, why: "크롭 계산 실패(카메라/보스 없음)" };
    }
  } else {
    pixel = { verifiable: false, why: "오라 객체 없음" };
  }
  note("픽셀 검증", pixel);

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
    pixelRose: pixel.verifiable ? pixel.rose === true : null,
  };
  console.log("\n=== 판정 ===");
  for (const [k, v] of Object.entries(verdict)) {
    console.log(`  ${v === null ? "SKIP" : v ? "PASS" : "FAIL"} — ${k}`);
  }
  if (pixel.verifiable) {
    console.log(`  (오라 ON−OFF: 발밑 ${pixel.footDelta}, 전체 ${pixel.globalDelta})`);
  } else {
    console.log(`  (픽셀 증명 불가: ${pixel.why})`);
  }

  console.log("\n=== 콘솔 에러 ===", errs.length ? errs.slice(0, 5) : "없음");

  const allExplicitPass = Object.values(verdict).every((v) => v === true);
  fs.writeFileSync(
    path.join(OUT, "report.json"),
    JSON.stringify({ ...report, verdict, latestErr: errs.slice(0, 10) }, null, 2)
  );
  console.log(`\n캔버스 캡처: ${OUT}/canvas_aura_off.png, ${OUT}/canvas_aura_on.png`);

  await browser.close();
  if (allExplicitPass) process.exit(0);
  process.exit(verdict.pixelRose === null ? 3 : 2);
})();
