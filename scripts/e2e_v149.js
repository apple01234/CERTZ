/** v1.4.9 E2E — 유저 지시 3건 검증: 전투 UI 우측 정렬·보스 아트 9종 리페인트 서빙·admin 로그인 + v1.4.8 회귀 */
const { chromium } = require("playwright");

const BASE = "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (n, cond, extra = "") => {
  if (cond) { pass++; console.log(`PASS ${n} ${extra}`); }
  else { fail++; console.log(`FAIL ${n} ${extra}`); }
};

(async () => {
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  /* 1. 버전 API */
  const ver = await (await fetch(`${BASE}/api/version`)).json();
  ok(1, ver.latest === "1.4.9" && ver.code === 101, `latest=${ver.latest} code=${ver.code}`);

  /* 2. admin 계정 로그인 실측 (SERTZ_ADMIN_PASSWORD 동기화 검증) */
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: "admin", pw: "Sertz!2026" }),
  });
  const loginBody = await login.json().catch(() => ({}));
  ok(2, login.status === 200 && loginBody?.user?.role === "admin" && !!loginBody?.token,
    `status=${login.status} role=${loginBody?.user?.role}`);

  /* 3. 보스 아트 9종 — 신규 리페인트 webp 서빙 (구 픽셀아트 ≤498B → 신규 ≥3KB, 임계 2500B) */
  const keys = ["boss", "boss2", "boss3", "boss_nidhog", "boss_surt", "boss_fenrir", "boss_skoll", "boss_gram", "boss_abudditos"];
  let servedOk = 0, newArt = 0;
  for (const k of keys) {
    const r = await fetch(`${BASE}/assets/${k}_idle0.webp`);
    const buf = Buffer.from(await r.arrayBuffer());
    if (r.ok && buf.length > 100) servedOk++;
    if (r.ok && buf.length > 2500) newArt++;
  }
  ok(3, servedOk === 9 && newArt === 9, `서빙 ${servedOk}/9 · 신규아트 ${newArt}/9`);

  /* 4. 보안 헤더 (v1.4.8 회귀) */
  const res = await fetch(BASE);
  const h = res.headers;
  ok(4, (h.get("content-security-policy") || "").includes("default-src 'self'")
        && h.get("x-content-type-options") === "nosniff"
        && h.get("x-frame-options") === "SAMEORIGIN", "CSP+nosniff+XFO");

  /* 5. 게임 부팅 */
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000);
  for (let i = 0; i < 30 && !(await page.evaluate(() => !!window.__SERTZ_DEFER_DONE__)); i++) await page.waitForTimeout(300);
  const hasCanvas = await page.locator("canvas").count();
  ok(5, hasCanvas >= 1 && errors.length === 0, `canvas=${hasCanvas} errors=${errors.length}`);

  /* 6. 월드 진입 */
  await page.getByText("게임 시작").first().click();
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click();
  });
  await page.waitForTimeout(700);
  await page.locator("input").first().fill("세라149");
  await page.waitForTimeout(300);
  for (const label of ["직업 선택", "외형 선택"]) {
    await page.evaluate((lb) => {
      Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes(lb))?.click();
    }, label);
    await page.waitForTimeout(400);
  }
  await page.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("생성!"))?.click();
  });
  await page.waitForTimeout(1400);
  await page.evaluate(() => { document.querySelector(".cursor-pointer")?.click(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click();
  });
  await page.waitForTimeout(2600);
  for (let i = 0; i < 4; i++) { await page.mouse.click(640, 500); await page.waitForTimeout(400); }
  for (let i = 0; i < 30; i++) {
    const d = await page.evaluate(() => window.__SERTZ__?.game?.scene?.getScene("world")?.dialoguing);
    if (!d) break;
    await page.mouse.click(640, 500);
    await page.waitForTimeout(360);
  }
  const inWorld = await page.evaluate(() => !!(window.__SERTZ__?.game?.scene?.getScene("world")?.player));
  ok(6, inWorld, inWorld ? "월드 진입" : "월드 진입 실패");

  /* 7. 전투 UI 우측 정렬 — 스킬·물약·자동 클러스터가 화면 오른쪽 끝(≤5px)에 붙어야 함 */
  const tc = await page.evaluate(() => {
    const el = [...document.querySelectorAll("div.absolute")].find((d) => (d.className || "").includes("bottom-[max(0.75rem"));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { gap: Math.round(window.innerWidth - r.right), visible: r.width > 100 };
  });
  ok(7, !!tc && tc.visible && tc.gap >= 0 && tc.gap <= 5, `우하단 클러스터 우측여백 ${tc?.gap}px (≤5 기대)`);

  /* 8. HUD 우상단(자동 토글 포함)도 오른쪽 끝 정렬 */
  const hud = await page.evaluate(() => {
    const el = [...document.querySelectorAll("div.absolute")].find((d) => (d.className || "").includes("right-[max(0.25rem") && (d.className || "").includes("top-[max(0.5rem"));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { gap: Math.round((window.innerWidth - r.right) * 100) / 100 };
  });
  ok(8, !!hud && hud.gap >= 0 && hud.gap <= 5, `HUD 우측여백 ${hud?.gap}px (≤5 기대, zoom 0.85 보정)`);

  /* 9. 보스 텍스처 게임 로드 확인 — 월드 텍스처 레지스트리에 신규 9종 존재 */
  const texOk = await page.evaluate(() => {
    const w = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!w) return false;
    return ["boss_idle0", "boss2_idle0", "boss_nidhog_idle0", "boss_abudditos_idle0"].every((k) => w.textures.exists(k));
  });
  ok(9, texOk, "보스 텍스처 9종(대표 4종) 로드");

  /* 10. 패널 애니메이션 + 트래커 축소 (v1.4.8 회귀) */
  const anim = await page.evaluate(() => {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSKeyframesRule && rule.name === "panelIn") return true;
        }
      } catch { /* cross-origin */ }
    }
    return false;
  });
  const tracker = await page.evaluate(() => {
    const el = [...document.querySelectorAll(".game-panel")].find((d) => d.className.includes("max-w-[260px]"));
    return !!el;
  });
  ok(10, anim && tracker, `panelIn=${anim} 트래커=${tracker}`);

  /* 11. 콘솔 에러 최종 집계 */
  ok(11, errors.length === 0, `콘솔/페이지 에러 ${errors.length}건`);
  if (errors.length) console.log("에러 목록:", errors.slice(0, 5));

  await browser.close();
  console.log(`\n=== E2E 결과: ${pass} PASS / ${fail} FAIL ===`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("E2E 실행 실패:", e); process.exit(1); });
