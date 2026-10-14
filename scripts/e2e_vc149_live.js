/** vc149 라이브 검증 — 월드 진입 + gv 텍스처 로드 + 페이지 에러 0 */
const { chromium } = require("playwright");

(async () => {
  let pass = 0, fail = 0;
  const ok = (n, c, extra = "") => { if (c) { pass++; console.log("PASS", n, extra); } else { fail++; console.log("FAIL", n, extra); } };
  const errors = [];
  const gvRequested = [];
  const browser = await chromium.launch({ args: ["--no-sandbox", "--enable-unsafe-swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome" });
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  p.on("pageerror", (e) => errors.push(String(e).slice(0, 150)));
  p.on("request", (r) => { const u = r.url(); if (u.includes("/assets/vfx3/gv_")) gvRequested.push(u.split("/").pop()); });
  await p.goto("http://127.0.0.1:3000", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(3000);
  await p.waitForSelector("text=게임 시작", { timeout: 40000 });
  ok("타이틀 로딩", true);
  await p.getByRole("button", { name: /게임 시작/ }).first().click();
  await p.waitForTimeout(1200);
  const createBtn = p.getByText("캐릭터 생성", { exact: false }).first();
  if ((await createBtn.count()) > 0) await createBtn.click().catch(() => {});
  await p.waitForTimeout(400);
  const nameInput = p.locator("input").first();
  await nameInput.fill("테스터");
  await p.getByRole("button", { name: /시작|결정|생성/ }).last().click().catch(() => {});
  await p.waitForTimeout(6000);
  ok("월드 진입 (캔버스)", (await p.locator("canvas").count()) > 0);
  ok("gv_ 텍스처 로드", gvRequested.length >= 40, "(" + gvRequested.length + "요청)");
  ok("페이지 에러 0", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log("=== LIVE: " + pass + " PASS / " + fail + " FAIL ===");
  process.exit(fail > 0 ? 1 : 0);
})();
