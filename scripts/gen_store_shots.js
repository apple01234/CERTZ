/* v1.0.2-beta — Play 스토어 스크린샷 전수 캡처 (유저 지시 "기기당 8~12장 → download/Capture/기기별 폴더")
 *  기기 규격(Play Console 요구):
 *   · 휴대전화 1080×1920(9:16, 1080px+ — 프로모션 조건 충족) · 7인치 태블릿 720×1280(9:16)
 *   · 10인치 태블릿 1080×1920(9:16, 1080px+) · 데스크톱 1920×1080(16:9, 1080px+)
 *   · PC용 Google Play Games 스크린샷 1920×1080 · Android XR 1920×1080
 *   · PC용 로고 600×400 투명 PNG(게임 이름 표기) · PC용 그래픽 1920×1080(텍스트 없음)
 *  게임 부팅: 검증된 E2E 패턴 재사용(__SERTZ__/__SERTZ_EB__ 디버그 훅) */
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const fs = require("fs");

const PORT = 3131;
const URL = `http://localhost:${PORT}`;
const ROOT = "/home/z/my-project/download/Capture";

const DEVICES = [
  { dir: "01_휴대전화_1080x1920", vp: { width: 720, height: 1280, deviceScaleFactor: 1.5 } },
  { dir: "02_태블릿7인치_1080x1920", vp: { width: 720, height: 1280, deviceScaleFactor: 1.5 } },
  { dir: "03_태블릿10인치_1080x1920", vp: { width: 675, height: 1200, deviceScaleFactor: 1.6 } },
  { dir: "04_데스크톱_1920x1080", vp: { width: 1920, height: 1080, deviceScaleFactor: 1.0 } },
];

async function waitForServer() {
  for (let i = 0; i < 90; i++) {
    try { const r = await fetch(`${URL}/api/version`); if (r.ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("서버 기동 실패");
}

const W = () => `window.__SERTZ__.game.scene.getScene("world")`;

async function clickAny(page, texts) {
  return page.evaluate((ts) => {
    for (const t of ts) {
      const b = Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes(t));
      if (b) { b.click(); return t; }
    }
    return null;
  }, texts);
}

async function closePanel(page) {
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll("button")).find((x) => /닫기/.test(x.getAttribute("aria-label") || ""));
    if (b) b.click();
  });
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(420);
}

async function openPanel(page, panel) {
  await page.evaluate((p) => window.__SERTZ_EB__.emit("ui:panel", { panel: p }), panel);
  await page.waitForTimeout(650);
}

async function shot(page, dir, name) {
  fs.mkdirSync(`${ROOT}/${dir}`, { recursive: true });
  await page.screenshot({ path: `${ROOT}/${dir}/${name}.png`, scale: "device" });
  console.log(`  ✓ ${dir}/${name}`);
}

async function enterTitle(page) {
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  /* 타이틀 DOM 버튼은 에셋 로드 후 늦게 뜬다 — 로케이터 자동대기 필수(evaluate 즉시클릭 금지) */
  await page.getByText(/새로운 모험|게임 시작/).first().waitFor({ timeout: 70000 });
  await page.waitForTimeout(900);
}

async function enterLobby(page) {
  await page.getByText(/새로운 모험|게임 시작/).first().click({ timeout: 30000 });
  await page.getByText("캐릭터 생성").first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(800);
}

async function createCharacter(page) {
  await page.getByText("캐릭터 생성").first().click({ timeout: 30000 });
  await page.locator("input").first().fill("세르츠", { timeout: 20000 });
  await page.waitForTimeout(350);
  /* step0 → 1: "다음 — 직업 선택" */
  await page.getByText(/다음/).first().click({ timeout: 15000 });
  await page.waitForTimeout(700);
  /* 직업 카드 — 전사 우선, 실패 시 첫 카드 클릭 */
  try {
    await page.getByText(/전사/).first().click({ timeout: 6000 });
  } catch {
    await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll("button")).filter((b) => b.textContent?.includes("HP") || b.className.includes("game-chip"));
      cards[0]?.click();
    });
  }
  await page.waitForTimeout(500);
  /* step1 → 2: 다음 버튼(외형) */
  await page.getByText(/다음/).first().click({ timeout: 15000 });
  await page.waitForTimeout(700);
  /* 외형 첫 옵션 */
  await page.evaluate(() => {
    const opts = Array.from(document.querySelectorAll("button")).filter((b) => b.querySelector("img,canvas") || /피부|백자|외형|색조/.test(b.textContent || ""));
    opts[0]?.click();
  });
  await page.waitForTimeout(450);
  /* 생성 완료 — 2단 클릭: “…로 생성!”(슬롯 생성) → “이 캐릭터로 시작”(실제 입장) */
  await page.getByText(/로 생성!/).first().click({ timeout: 15000 });
  const startBtn = page.getByText("이 캐릭터로 시작").first();
  await startBtn.waitFor({ timeout: 15000 });
  await startBtn.click({ timeout: 15000 });
  for (let i = 0; i < 90; i++) {
    const ok = await page.evaluate(() => { try { return !!(window.__SERTZ__?.game?.scene?.getScene("world")?.player); } catch { return false; } });
    if (ok) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(1200);
}

async function skipIntro(page) {
  /* 인트로 정식 종료(플레이어·세이브 초기화) 후 대화 스킵 — buildSave가 lv를 읽을 수 있게 */
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    try { if (w && typeof w.finishIntro === "function" && w.introStep !== -1) w.finishIntro("세르츠"); } catch {}
  });
  for (let i = 0; i < 24; i++) {
    const dlg = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      if (w?.dialoguing) { w.resumeFromDialogue(); return true; }
      return false;
    });
    if (!dlg) { /* no-op */ }
    await page.evaluate(() => { const w = window.__SERTZ__.game.scene.getScene("world"); if (w) { w.dialoguing = false; w.introStep = -1; } });
    await page.keyboard.press("e").catch(() => {});
    await page.waitForTimeout(260);
  }
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    if (w) { w.dialoguing = false; w.introStep = -1; w.sleepPending = false; w.physics.world.resume(); }
  });
  await page.waitForTimeout(400);
}

async function waitPlayer(page) {
  /* 씬 재시작 중(buildSave의 this.player undefined) 상태 회피 — player.lv 준비 대기 */
  for (let i = 0; i < 50; i++) {
    const ok = await page.evaluate(() => {
      try { return !!(window.__SERTZ__?.game?.scene?.getScene("world")?.player?.lv); } catch { return false; }
    });
    if (ok) return true;
    await page.waitForTimeout(300);
  }
  return false;
}

async function restartWith(page, stage, patch = {}) {
  await waitPlayer(page);
  await page.evaluate(([st, p]) => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const carry = w.buildSave(st);
    Object.assign(carry, p);
    w.scene.restart({ stage: st, save: carry });
  }, [stage, patch]);
  await page.waitForTimeout(1900);
  await skipIntroShort(page);
}

async function skipIntroShort(page) {
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    if (w?.dialoguing) w.resumeFromDialogue();
    if (w) { w.dialoguing = false; w.introStep = -1; w.sleepPending = false; w.physics.world.resume(); }
  });
  await waitPlayer(page);
  await page.waitForTimeout(400);
}

async function gmBoost(page) {
  await page.evaluate(() => {
    const eb = window.__SERTZ_EB__;
    eb.emit("rpg:gm", { type: "lv", value: 32 });
    eb.emit("rpg:gm", { type: "heal" });
  });
  await page.waitForTimeout(450);
}

/* 기기당 12장 시나리오 — 각 단계 개별 복구(한 단계 실패가 나머지를 죽이지 않게) */
async function story(page, dir) {
  const S = async (name, fn) => { try { await fn(); } catch (e) { console.log(`  ! ${name} 건너뜀:`, String(e).slice(0, 140)); } };
  await S("타이틀", async () => {
    await enterTitle(page);
    await shot(page, dir, "01_타이틀화면");
  });
  await S("로비", async () => {
    await enterLobby(page);
    await shot(page, dir, "02_캐릭터선택");
    await createCharacter(page);
    await skipIntro(page);
    await gmBoost(page);
    await shot(page, dir, "03_시작마을");
  });
  await S("상점", async () => {
    await openPanel(page, "shop");
    await shot(page, dir, "04_장비상점");
    await closePanel(page);
  });
  await S("인벤토리", async () => {
    await openPanel(page, "inv");
    await shot(page, dir, "05_인벤토리");
    await closePanel(page);
  });
  await S("스탯", async () => {
    await openPanel(page, "stat");
    await shot(page, dir, "06_스탯강화");
    await closePanel(page);
  });
  // 숲 필드 — 전투
  await S("숲필드", async () => {
    await restartWith(page, "forest1");
    await page.evaluate(() => window.__SERTZ_EB__.emit("rpg:autohunt", {}));
    await page.waitForTimeout(2600);
    await shot(page, dir, "07_숲의신전_필드");
  });
  await S("스킬전투", async () => {
    for (let k = 0; k < 3; k++) {
      await page.evaluate(() => {
        const eb = window.__SERTZ_EB__;
        eb.emit("input:attack");
        setTimeout(() => eb.emit("input:skill1"), 90);
        setTimeout(() => eb.emit("input:skill2"), 180);
      });
      await page.waitForTimeout(330);
    }
    await shot(page, dir, "08_스킬전투");
  });
  await S("퀘스트", async () => {
    await openPanel(page, "quest");
    await shot(page, dir, "09_퀘스트일지");
    await closePanel(page);
  });
  // 보스 구역 (구역 10 진입 시 자동 보스 조우)
  await S("보스", async () => {
    await restartWith(page, "forest10");
    await page.waitForTimeout(2400);
    await shot(page, dir, "10_보스조우");
  });
  // 마을 복귀 — 랭킹·충전소
  await S("랭킹", async () => {
    await restartWith(page, "village");
    await openPanel(page, "rank");
    await shot(page, dir, "11_왕국랭킹");
    await closePanel(page);
  });
  await S("충전소", async () => {
    await openPanel(page, "bmshop");
    await shot(page, dir, "12_충전소");
    await closePanel(page);
  });
}

(async () => {
  /* 기기 필터: node gen_store_shots.js 1,2 | pc(PC섹션만) | (무인자=전체) */
  const arg2 = process.argv[2];
  const onlyPc = arg2 === "pc";
  const filter = onlyPc ? null : arg2?.split(",").map((s) => parseInt(s.trim(), 10)).filter(Boolean) ?? null;
  const devs = onlyPc ? [] : filter ? DEVICES.filter((_, i) => filter.includes(i + 1)) : DEVICES;
  const srv = spawn("node", ["server.js"], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production", PORT: String(PORT) }, stdio: "ignore" });
  await waitForServer();
  console.log("서버 기동 완료");
  const browser = await chromium.launch({
    executablePath: "/home/z/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell",
  });
  try {
    for (const dev of devs) {
      console.log(`▶ ${dev.dir}`);
      const page = await browser.newPage({ viewport: dev.vp });
      page.on("pageerror", (e) => console.log("  [pageerror]", String(e).slice(0, 120)));
      try { await story(page, dev.dir); }
      catch (e) { console.log(`  ! ${dev.dir} 스토리 오류:`, String(e).slice(0, 200)); }
      await page.close();
    }

    /* ── PC용 Google Play Games 스크린샷 8장 + Android XR 4장 (가로 1920×1080) ── */
    console.log("▶ PC 스크린샷·XR·PC그래픽·로고");
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const PC = `${ROOT}/09_PC스크린샷_1920x1080`;
    const XR = `${ROOT}/10_AndroidXR_1920x1080`;
    fs.mkdirSync(PC, { recursive: true });
    fs.mkdirSync(XR, { recursive: true });
    const L = async (n, fn) => { try { await fn(); } catch (e) { console.log(`  ! ${n} 건너뜀:`, String(e).slice(0, 120)); } };
    await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.getByText(/새로운 모험|게임 시작/).first().waitFor({ timeout: 70000 });
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${PC}/01_타이틀화면.png` });
    console.log("  ✓ 09/01_타이틀화면");
    await enterLobby(page);
    await page.screenshot({ path: `${PC}/02_캐릭터선택.png` });
    console.log("  ✓ 09/02_캐릭터선택");
    await createCharacter(page);
    await skipIntro(page);
    await gmBoost(page);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${PC}/03_시작마을.png` });
    fs.writeFileSync(`${XR}/04_시작마을.png`, fs.readFileSync(`${PC}/03_시작마을.png`));
    console.log("  ✓ 09/03_시작마을 + XR/04");
    await L("상점", async () => {
      await openPanel(page, "shop");
      await page.screenshot({ path: `${PC}/04_장비상점.png` });
      await closePanel(page);
      console.log("  ✓ 09/04_장비상점");
    });
    await L("숲전투", async () => {
      await restartWith(page, "forest1");
      await page.evaluate(() => window.__SERTZ_EB__.emit("rpg:autohunt", {}));
      await page.waitForTimeout(2600);
      await page.screenshot({ path: `${PC}/05_숲의신전_전투.png` });
      fs.writeFileSync(`${XR}/01_숲의신전_탐험.png`, fs.readFileSync(`${PC}/05_숲의신전_전투.png`));
      console.log("  ✓ 09/05 + XR/01");
    });
    await L("스킬", async () => {
      for (let k = 0; k < 3; k++) {
        await page.evaluate(() => {
          const eb = window.__SERTZ_EB__;
          eb.emit("input:attack");
          setTimeout(() => eb.emit("input:skill1"), 90);
          setTimeout(() => eb.emit("input:skill2"), 180);
        });
        await page.waitForTimeout(330);
      }
      await page.screenshot({ path: `${PC}/06_스킬이펙트.png` });
      fs.writeFileSync(`${XR}/02_전투이펙트.png`, fs.readFileSync(`${PC}/06_스킬이펙트.png`));
      console.log("  ✓ 09/06 + XR/02");
    });
    await L("보스", async () => {
      await restartWith(page, "forest10");
      await page.waitForTimeout(2400);
      await page.evaluate(() => window.__SERTZ_EB__.emit("input:attack", {}));
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${PC}/07_보스조우.png` });
      fs.writeFileSync(`${XR}/03_보스전.png`, fs.readFileSync(`${PC}/07_보스조우.png`));
      console.log("  ✓ 09/07 + XR/03");
    });
    await L("랭킹", async () => {
      await restartWith(page, "village");
      await openPanel(page, "rank");
      await page.screenshot({ path: `${PC}/08_왕국랭킹.png` });
      await closePanel(page);
      console.log("  ✓ 09/08_왕국랭킹");
    });

    /* ── PC용 그래픽 이미지(텍스트 없음) — 캔버스 순수 픽셀만 추출 ── */
    await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      // 캔버스 내 텍스트 전부 숨김(이름표·데미지 숫자·존 배너)
      try { w.children.list.forEach((c) => { if (c.type === "Text") c.setVisible(false); }); } catch {}
      try { if (w.uiScene) w.uiScene.children.list.forEach((c) => { if (c.type === "Text") c.setVisible(false); }); } catch {}
      try { ["ui", "hud", "minimap"].forEach((k) => { const s = window.__SERTZ__.game.scene.getScene(k); s?.children?.list?.forEach((c) => { if (c.type === "Text") c.setVisible(false); }); }); } catch {}
    });
    await page.waitForTimeout(1800);
    const b64 = await page.evaluate(() => document.querySelector("canvas").toDataURL("image/png"));
    fs.mkdirSync(`${ROOT}/08_PC그래픽_1920x1080`, { recursive: true });
    fs.writeFileSync(`${ROOT}/08_PC그래픽_1920x1080/SERTZ_PC_graphic_1920x1080_notext.png`, Buffer.from(b64.split(",")[1], "base64"));
    console.log("  ✓ 08_PC그래픽 (캔버스 순수 캡처)");
    await page.close();

    /* ── PC용 로고 600×400 투명 PNG — 게임 이름 표기 ── */
    fs.mkdirSync(`${ROOT}/07_PC로고_600x400`, { recursive: true });
    const lp = await browser.newPage({ viewport: { width: 600, height: 400 } });
    await lp.setContent(`<!DOCTYPE html><html><head><style>
      @font-face { font-family: Galmuri14; src: url("file:///home/z/my-project/public/fonts/Galmuri14-Bold.woff2") format("woff2"); }
      * { margin:0; padding:0; background: transparent !important; }
      body { width:600px; height:400px; overflow:hidden; font-family: Galmuri14, sans-serif; }
      .wrap { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
      .swords { display:flex; gap:10px; margin-bottom:6px; }
      .sw { width:10px; height:96px; background:linear-gradient(180deg,#e8e8f2 0%,#aab2c8 55%,#6d7690 100%); border-radius:5px; transform:rotate(24deg); box-shadow:0 0 14px rgba(180,200,255,.55); }
      .sw.r { transform:rotate(-24deg); }
      .name { font-size:104px; font-weight:900; letter-spacing:6px; color:#ffd98a;
              text-shadow: 0 4px 0 #7a4a12, 0 8px 18px rgba(0,0,0,.55), -3px 0 0 #2b1a05, 3px 0 0 #2b1a05, 0 -3px 0 #2b1a05, 0 3px 0 #2b1a05; }
      .sub { margin-top:10px; font-size:22px; font-weight:900; color:#e8ecff; letter-spacing:10px;
             text-shadow: 0 2px 0 #141a30, -2px 0 0 #141a30, 2px 0 0 #141a30, 0 -2px 0 #141a30; }
    </style></head><body><div class="wrap">
      <div class="swords"><div class="sw"></div><div class="sw r"></div></div>
      <div class="name">SERTZ</div>
      <div class="sub">C E R T Z&nbsp;&nbsp;R P G</div>
    </div></body></html>`);
    await lp.waitForTimeout(1200);
    await lp.screenshot({ path: `${ROOT}/07_PC로고_600x400/SERTZ_PC_logo_600x400_transparent.png`, omitBackground: true });
    console.log("  ✓ 07_PC로고");
    await lp.close();

    /* ── 메인 그래픽 1024×500 (Play 필수 — 게임 아트+타이틀 합성) ── */
    console.log("▶ 메인 그래픽 1024x500");
    await L("메인그래픽", async () => {
      /* 배경: 데스크톱 스킬전투·타이틀 중 있는 것 사용 */
      const bgPool = [`${PC}/06_스킬이펙트.png`, `${PC}/05_숲의신전_전투.png`, `${PC}/03_시작마을.png`, `${PC}/01_타이틀화면.png`];
      const bg = bgPool.find((p) => fs.existsSync(p));
      if (!bg) throw new Error("배경 후보 없음");
      const bg64 = fs.readFileSync(bg).toString("base64");
      const mg = await browser.newPage({ viewport: { width: 1024, height: 500 } });
      await mg.setContent(`<!DOCTYPE html><html><head><style>
        @font-face { font-family: Galmuri14; src: url("file:///home/z/my-project/public/fonts/Galmuri14-Bold.woff2") format("woff2"); }
        * { margin:0; padding:0; } body { width:1024px; height:500px; overflow:hidden; font-family:Galmuri14,sans-serif; }
        .bg { position:absolute; inset:0; background:url(data:image/png;base64,${bg64}) center/cover no-repeat; filter:saturate(1.15); }
        .veil { position:absolute; inset:0; background:linear-gradient(90deg, rgba(8,10,24,.88) 0%, rgba(8,10,24,.55) 42%, rgba(8,10,24,.12) 78%, rgba(8,10,24,.35) 100%); }
        .frame { position:absolute; inset:0; border:4px solid rgba(255,217,138,.85); box-shadow: inset 0 0 90px rgba(0,0,0,.6); }
        .wrap { position:absolute; left:52px; top:0; bottom:0; width:460px; display:flex; flex-direction:column; justify-content:center; }
        .name { font-size:96px; font-weight:900; letter-spacing:6px; color:#ffd98a; line-height:1;
                text-shadow: 0 4px 0 #7a4a12, 0 9px 22px rgba(0,0,0,.65), -3px 0 0 #2b1a05, 3px 0 0 #2b1a05, 0 -3px 0 #2b1a05, 0 3px 0 #2b1a05; }
        .sub { margin-top:14px; font-size:21px; font-weight:900; color:#eef2ff; letter-spacing:7px;
               text-shadow: 0 2px 0 #10162c, -2px 0 0 #10162c, 2px 0 0 #10162c, 0 -2px 0 #10162c; }
        .tags { margin-top:18px; display:flex; gap:8px; }
        .tag { font-size:13px; font-weight:900; color:#0d1226; background:linear-gradient(180deg,#ffe6a8,#f2b84b); padding:5px 12px; border-radius:999px; box-shadow:0 3px 10px rgba(0,0,0,.4); }
      </style></head><body>
        <div class="bg"></div><div class="veil"></div><div class="frame"></div>
        <div class="wrap"><div class="name">SERTZ</div><div class="sub">C E R T Z &nbsp;R P G</div>
        <div class="tags"><span class="tag">무한성장</span><span class="tag">재생성 RPG</span></div></div>
      </body></html>`);
      await mg.waitForTimeout(1400);
      fs.mkdirSync(`${ROOT}/00_메인그래픽_1024x500`, { recursive: true });
      await mg.screenshot({ path: `${ROOT}/00_메인그래픽_1024x500/SERTZ_메인그래픽_1024x500.png` });
      console.log("  ✓ 00_메인그래픽 1024x500");
      await mg.close();
    });

    /* ── 선별용 4장 (홍보 대표 컷 복사) ── */
    console.log("▶ 선별용 4장");
    fs.mkdirSync(`${ROOT}/00_선별용_4장`, { recursive: true });
    const picks = [
      [`${ROOT}/01_휴대전화_1080x1920/01_타이틀화면.png`, "선별1_타이틀화면.png"],
      [`${ROOT}/01_휴대전화_1080x1920/03_시작마을.png`, "선별2_시작마을.png"],
      [`${ROOT}/01_휴대전화_1080x1920/08_스킬전투.png`, "선별3_스킬전투.png"],
      [`${ROOT}/01_휴대전화_1080x1920/10_보스조우.png`, "선별4_보스조우.png"],
    ];
    for (const [src, dst] of picks) {
      if (fs.existsSync(src)) { fs.copyFileSync(src, `${ROOT}/00_선별용_4장/${dst}`); console.log(`  ✓ ${dst}`); }
      else console.log(`  ! 원본 없음 ${src}`);
    }
  } finally {
    await browser.close();
    srv.kill();
  }
  console.log("캡처 전체 완료");
})().catch((e) => { console.error("FAIL:", e); process.exit(1); });
