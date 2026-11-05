/**
 * 로비 제작 도구 진입점 검증 (vc262).
 *
 * [왜 이 테스트가 필요한가]
 *  에디터 라우트(`/editor`, `/skill-editor`)는 vc257·vc259 부터 HTTP 200 으로
 *  살아 있었는데, **게임 안에 링크가 없어서** 사용자가 존재 자체를 못 찾았다.
 *  ("타일맵&스킬에디터는 어디감?")
 *  라우트 존재 검사만 하던 종전 검증으로는 이 결함이 잡히지 않는다.
 *  → 로비에 진입점이 **렌더되는지**를 본다.
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://127.0.0.1:3150";
const ID = process.env.SERTZ_ID || "";
const PW = process.env.SERTZ_PW || "";

let pass = 0, fail = 0;
const ck = (n, ok, d = "") => { console.log(`${ok ? "✓" : "✗"} ${n}${d ? ` — ${d}` : ""}`); ok ? pass++ : fail++; };

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 150)));

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(2500);

/* 1) 로그인 (관리자) */
if (ID && PW) {
  await page.evaluate(async ([id, pw]) => {
    await fetch("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, pw }),
    }).then((r) => r.json()).then((d) => {
      if (d?.token) localStorage.setItem("sertz_token", d.token);
    });
  }, [ID, PW]);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
}

/* 2) 로비로 이동 — 게임 시작 → 캐릭터 선택 화면 */
const startBtn = page.locator("button", { hasText: "게임 시작" }).first();
if (await startBtn.count()) {
  await startBtn.click({ timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2000);
}

const body = await page.evaluate(() => document.body.innerText || "");
const anchors = await page.evaluate(() =>
  [...document.querySelectorAll("a")].map((a) => ({ text: (a.innerText || "").trim(), href: a.getAttribute("href") }))
);

console.log("페이지 텍스트(앞 200):", body.slice(0, 200).replace(/\n+/g, " | "));
console.log("링크:", JSON.stringify(anchors).slice(0, 300));

const mapLink = anchors.find((a) => a.href === "/editor");
const skillLink = anchors.find((a) => a.href === "/skill-editor");

ck("로비에 '맵 에디터' 링크 존재", !!mapLink, mapLink?.text ?? "없음");
ck("로비에 '스킬 메이커' 링크 존재", !!skillLink, skillLink?.text ?? "없음");
ck("제작 도구 라벨 노출", body.includes("제작 도구"), body.includes("제작 도구") ? "" : "없음");

/* 3) 링크를 실제로 눌러 이동되는지 */
if (mapLink) {
  await Promise.all([
    page.waitForURL(/\/editor/, { timeout: 30000 }).catch(() => {}),
    page.locator('a[href="/editor"]').first().click().catch(() => {}),
  ]);
  await page.waitForTimeout(1500);
  ck("맵 에디터로 실제 이동", /\/editor/.test(page.url()), page.url());
  const canvas = await page.evaluate(() => document.querySelectorAll("canvas").length);
  ck("이동한 맵 에디터에 canvas 존재", canvas > 0, `canvas ${canvas}`);
}

ck("pageerror 없음", errs.length === 0, errs.slice(0, 2).join(" | "));

await page.screenshot({ path: "/root/.hermes/cache/scratch/lobby_tools.png" });
await browser.close();
console.log(`\nRESULT ${pass}/${pass + fail} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
