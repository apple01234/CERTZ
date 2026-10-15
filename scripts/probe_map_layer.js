/**
 * probe_map_layer.js — "맵 레이어가 맨 위로" 실측 프로브
 *  모바일 가로(740×360)에서 게임 진입 → 미니맵 영역 기준:
 *  ① DOM elementsFromPoint (React가 덮는지) ② Phaser depth 94+ 객체 목록 (씬 내부 충돌)
 *  ③ 스크린샷 3장 (타이틀/월드/전투)
 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");

const PORT = 3123;
const URL = `http://localhost:${PORT}`;

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production", PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 180; i++) { await new Promise((r) => setTimeout(r, 500)); try { const r2 = await fetch(`${URL}/api/version`); if (r2.ok) break; } catch {} }

  const browser = await chromium.launch({ args: ["--no-sandbox","--disable-dev-shm-usage","--disable-gpu"], executablePath: "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome" });
  const page = await browser.newPage({ viewport: { width: 740, height: 360 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 100)));

  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.waitForSelector("text=게임 시작", { timeout: 40000 });
  await page.screenshot({ path: "/tmp/m1_title.png" });

  /* 로그인 (123456) */
  await page.getByRole("button", { name: /게임 시작/ }).first().click();
  await page.waitForTimeout(1200);
  const cb = page.getByRole("button", { name: /🔑 로그인|로그인\/계정/ }).first();
  if ((await cb.count()) > 0) {
    await cb.click().catch(() => {});
    await page.waitForTimeout(1000);
    await page.locator("input").first().fill("123456").catch(() => {});
    await page.locator("input[type=password]").first().fill("123456").catch(() => {});
    await page.getByRole("button", { name: /로그인/ }).last().click().catch(() => {});
    await page.waitForTimeout(2500);
  }
  /* 캐릭터 선택/생성 → 월드 진입 */
  const mk = page.getByRole("button", { name: /캐릭터 생성/ }).first();
  if ((await mk.count()) > 0) {
    await mk.click().catch(() => {});
    await page.waitForTimeout(1200);
    const nameInput = page.locator("input:visible").first();
    if ((await nameInput.count()) > 0) await nameInput.fill("맵프로브").catch(() => {});
    await page.getByRole("button", { name: /다음 — 외형 선택/ }).first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(900);
    await page.getByRole("button", { name: /모험가로 생성!/ }).first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1800);
  }
  await page.getByRole("button", { name: /이 캐릭터로 시작/ }).first().click({ timeout: 12000 }).catch(() => {});
  /* 프롤로그 스킵 — 세이브의 introSeen을 즉시 true로 (씬 생성이 저장을 읽기 전 레이스 승리) */
  for (let i = 0; i < 40; i++) {
    const done = await page.evaluate(() => {
      try {
        const raw = window.localStorage.getItem("sertz_save_v2");
        if (!raw) return false;
        const s = JSON.parse(raw);
        if (s.introSeen === true) return true;
        s.introSeen = true;
        window.localStorage.setItem("sertz_save_v2", JSON.stringify(s));
        return false;
      } catch { return false; }
    }).catch(() => false);
    if (done) break;
    await page.waitForTimeout(80);
  }
  /* 인트로 컷신 스킵 — canvas 포커스 부여 후 Space(overlay pointerdown도 병행) */
  await page.mouse.click(370, 300).catch(() => {});
  await page.waitForTimeout(400);
  for (let i = 0; i < 12; i++) {
    const introGone = await page.evaluate(() => {
      const s = window.__SERTZ_SCENE__;
      if (!s) return true;
      const has = s.children?.list?.some((c) => c.depth === 3000);
      if (has) {
        /* Phaser 인트로 overlay에 pointerdown을 직접 발사 (DOM 게이트 우회) */
        const ov = s.children.list.find((c) => c.depth === 3000);
        try { ov.emit("pointerdown", {}); } catch {}
        try { s.input?.keyboard?.emit("keydown-SPACE"); } catch {}
      }
      return !has;
    });
    if (introGone) break;
    await page.keyboard.press("Space").catch(() => {});
    await page.waitForTimeout(650);
  }
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "/tmp/m2_world.png" });

  /* 미니맵 실측 */
  const probe = await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    if (!s) return { err: "no scene" };
    const cam = s.cameras?.main;
    const z = cam?.zoom || 1;
    const gw = (cam.width < 900 ? 128 : 156) / z;
    const gh = (cam.width < 900 ? 72 : 88) / z;
    const cx = cam.width / 2;
    const bossUp = !!(s.boss?.active && s.boss.alive);
    const mmShift = bossUp || s.gateActive ? (cam.height < 560 ? 54 : 74) : 0;
    const mmTop = 8 + mmShift;
    const cy = cam.height / 2 + (mmTop + gh * z * 0.5 - cam.height / 2) / z;
    const scaleX = window.innerWidth / cam.width, scaleY = window.innerHeight / cam.height;
    const px = cx * (window.innerWidth / cam.width), py = cy * (window.innerHeight / cam.height);
    const dom = document.elementsFromPoint(px, py).map((el) => `${el.tagName}.${String(el.className).slice(0, 60)}`);
    /* Phaser: 화면좌표 → 월드좌표 역산은 scrollFactor 0이라 카메라 좌표=월드 좌표 */
    const top = [];
    s.children?.list?.forEach((c) => {
      if (c.depth >= 94 && c.visible !== false) {
        const inX = Math.abs((c.x ?? 0) - cx) < (gw || 200);
        const inY = Math.abs((c.y ?? 0) - cy) < (gh || 120);
        if (inX && inY) top.push(`${c.type || c.constructor?.name} d=${c.depth} x=${Math.round(c.x)} y=${Math.round(c.y)} sf=${c.scrollFactorX}`);
      }
    });
    return { cam: { w: cam.width, h: cam.height, zoom: z }, mm: { cx: Math.round(cx), cy: Math.round(cy), gw: Math.round(gw), gh: Math.round(gh) }, domTop: dom.slice(0, 6), phaserOver: top.slice(0, 12) };
  });
  console.log("PROBE:", JSON.stringify(probe, null, 1));

  /* 미니맵 영역 크롭 + depth>=94 전체 덤프 */
  if (probe.mm) {
    await page.screenshot({ path: "/tmp/m4_mm_crop.png", clip: { x: probe.mm.cx - 90, y: Math.max(0, probe.mm.cy - 56), width: 180, height: 112 } });
  }
  const dump = await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    const out = [];
    s.children?.list?.forEach((c) => {
      if (c.depth >= 60 && (c.scrollFactorX === 0 || c.depth >= 90)) {
        out.push({ t: c.type || c.constructor?.name, d: c.depth, x: Math.round(c.x ?? -1), y: Math.round(c.y ?? -1), txt: typeof c.text === "string" ? c.text.slice(0, 40) : undefined, vis: c.visible, a: Math.round((c.alpha ?? 1) * 100) / 100 });
      }
    });
    return out.sort((a, b) => a.d - b.d).slice(0, 40);
  });
  console.log("DUMP:", JSON.stringify(dump, null, 0).replace(/},\{/g, "}\n{"));

  /* 전투 유도(공격) 후 스크린샷 */
  await page.keyboard.press("x").catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "/tmp/m3_battle.png" });

  console.log("pageerrors:", errs.length ? errs.join(" | ") : "0");
  await browser.close();
  srv.kill();
  process.exit(0);
})().catch((e) => { console.error("PROBE FAIL", e); process.exit(1); });
