/* v1.4.18 진단 — "또 에셋 안불러와짐" 실측:
 *  ① 부트→타이틀 전 구간 콘솔 loaderror/texGuard 경고 수집
 *  ② 네트워크 4xx/5xx 응답 URL 수집 (에셋 404 실측)
 *  ③ 타이틀 진입 후 텍스처 감사 상태 보고 */
const { chromium } = require("playwright");

(async () => {
  const b = await chromium.launch({
    args: ["--use-gl=swiftshader"],
    executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome",
  });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();

  const badNet = [];
  const loadErrs = [];
  const guardWarns = [];
  const allConsole = [];

  p.on("response", (r) => {
    if (r.status() >= 400) badNet.push(`${r.status()} ${r.url()}`);
  });
  p.on("requestfailed", (r) => badNet.push(`FAILED ${r.url()} :: ${r.failure()?.errorText ?? ""}`));
  p.on("console", (m) => {
    const t = m.text();
    allConsole.push(t);
    if (t.includes("로드 실패") || t.includes("loaderror")) loadErrs.push(t);
    if (t.includes("texGuard") || t.includes("텍스처")) guardWarns.push(t);
  });
  p.on("pageerror", (e) => allConsole.push("PAGEERROR: " + e.message));

  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });

  // 부트 → 타이틀 진입 대기 (최대 90초)
  let reachedTitle = false;
  try {
    await p.waitForSelector("text=게임 시작", { timeout: 90000 });
    reachedTitle = true;
  } catch { /* 타임아웃 — 아래에서 상태 보고 */ }

  // 지연 로드 완료 신호 대기 (있으면)
  for (let i = 0; i < 12 && !(await p.evaluate(() => !!window.__SERTZ_DEFER_DONE__)); i++)
    await p.waitForTimeout(500);

  const state = await p.evaluate(() => {
    const ph = window.__SERTZ__?.game ?? null;
    let texStats = null;
    try {
      const scene = ph?.scene?.getScene("title") ?? ph?.scene?.getScene("boot");
      if (scene) texStats = { textures: scene.textures.getTextureKeys().length };
    } catch {}
    return {
      hasGame: !!ph,
      texStats,
      texguard: window.__SERTZ_TEXGUARD__ ?? null,
      deferDone: !!window.__SERTZ_DEFER_DONE__,
    };
  });

  console.log("=== 결과 ===");
  console.log("타이틀 진입:", reachedTitle);
  console.log("게임 인스턴스:", JSON.stringify(state));
  console.log("네트워크 실패(4xx/5xx/failed):", badNet.length);
  for (const u of badNet.slice(0, 40)) console.log("  ✗ " + u);
  console.log("콘솔 로드실패:", loadErrs.length);
  for (const e of loadErrs.slice(0, 30)) console.log("  ! " + e);
  console.log("texGuard 관련:", guardWarns.length);
  for (const e of guardWarns.slice(0, 30)) console.log("  ! " + e);
  console.log("=== 전체 콘솔 (앞 40개) ===");
  for (const t of allConsole.slice(0, 40)) console.log("  · " + t.slice(0, 180));

  await b.close();
})().catch((e) => { console.error("진단 실패:", e.message); process.exit(1); });
