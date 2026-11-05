/**
 * 제작 도구 진입점 검증 (vc263) — 운영/로컬 사이트.
 *
 * [이 테스트가 존재하는 이유]
 *  에디터 라우트(`/editor`, `/skill-editor`)는 vc257·vc259 부터 HTTP 200 으로
 *  **살아 있었다.** 그런데 게임 안에 링크가 하나도 없어서 URL 을 직접 치지 않는 한
 *  닿을 수 없었고, 사용자는 존재 자체를 못 찾았다("타일맵&스킬에디터는 어디감?").
 *  라우트 존재만 보던 종전 검증은 이 결함을 통과시켰다 — 진입 경로를 아무도 안 봤다.
 *
 * [검증 중에 실제로 틀렸던 것들 — 다시 밟지 않도록 여기 남긴다]
 *  1) SERTZ 는 Phaser canvas 게임이다. 초기 DOM 은 13 노드에 텍스트가 비어 있다.
 *     "페이지 열고 바로 querySelector" 로 검사하면 항상 '없음' 이 나온다.
 *     → 로딩이 끝나 오버레이가 붙을 때까지 **폴링**해야 한다.
 *  2) 토큰 저장 키는 `sertz.auth.token` / `sertz.auth.user` 다.
 *     임의 키(`sertz_token`)에 심으면 로그인이 안 된 것으로 보인다.
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://127.0.0.1:3150";
const ID = process.env.SERTZ_ID || "";
const PW = process.env.SERTZ_PW || "";
const TOKEN_KEY = "sertz.auth.token";
const USER_KEY = "sertz.auth.user";

let pass = 0, fail = 0;
const ck = (n, ok, d = "") => { console.log(`${ok ? "✓" : "✗"} ${n}${d ? ` — ${d}` : ""}`); ok ? pass++ : fail++; };

const browser = await chromium.launch({
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });

/* 1) 관리자 로그인 주입 — 앱이 실제로 쓰는 키에 넣는다 */
if (ID && PW) {
  const r = await page.evaluate(async ([id, pw, tk, uk]) => {
    const res = await fetch("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, pw }),
    });
    const d = await res.json();
    if (d?.token) {
      localStorage.setItem(tk, d.token);
      localStorage.setItem(uk, JSON.stringify(d.user));
    }
    return { status: res.status, role: d?.user?.role, hasToken: !!d?.token };
  }, [ID, PW, TOKEN_KEY, USER_KEY]);
  console.log("로그인 주입:", JSON.stringify(r));
  ck("관리자 로그인 성공", r?.status === 200 && r?.role === "admin", `status ${r?.status} role ${r?.role}`);
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
}

/* 2) 오버레이가 붙을 때까지 폴링 (canvas 게임이라 즉시 DOM 검사는 무의미) */
let snap = { nodes: 0, links: [], text: "" };
for (let i = 0; i < 45; i++) {
  snap = await page.evaluate(() => ({
    nodes: document.querySelectorAll("body *").length,
    links: [...document.querySelectorAll("a")].map((a) => ({ href: a.getAttribute("href"), text: (a.innerText || "").trim() })),
    text: (document.body.innerText || "").replace(/\n+/g, " | ").slice(0, 200),
  }));
  if (snap.links.some((l) => l.href === "/editor")) break;
  await page.waitForTimeout(1000);
}
console.log(`DOM nodes=${snap.nodes} | text="${snap.text}"`);
console.log("links:", JSON.stringify(snap.links).slice(0, 240));

/* 3) 패널이 닫혀 있으면 로그인/계정 버튼으로 연다 */
if (!snap.links.some((l) => l.href === "/editor")) {
  const btn = page.locator('button:has-text("로그인"), button:has-text("계정")').first();
  if (await btn.count()) {
    await btn.click({ timeout: 15000 }).catch(() => {});
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(800);
      snap = await page.evaluate(() => ({
        nodes: document.querySelectorAll("body *").length,
        links: [...document.querySelectorAll("a")].map((a) => ({ href: a.getAttribute("href"), text: (a.innerText || "").trim() })),
        text: (document.body.innerText || "").replace(/\n+/g, " | ").slice(0, 300),
      }));
      if (snap.links.some((l) => l.href === "/editor")) break;
    }
    console.log("패널 연 뒤 links:", JSON.stringify(snap.links).slice(0, 240));
  }
}

const mapLink = snap.links.find((l) => l.href === "/editor");
const skillLink = snap.links.find((l) => l.href === "/skill-editor");

ck("'맵 에디터' 진입점이 화면에 있다", !!mapLink, mapLink?.text ?? "없음");
ck("'스킬 메이커' 진입점이 화면에 있다", !!skillLink, skillLink?.text ?? "없음");

await page.screenshot({ path: "/root/.hermes/cache/scratch/tools_entry.png" });

/* 4) 실제 클릭으로 이동되는지 */
if (mapLink) {
  await page.locator('a[href="/editor"]').first().click({ timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(4000);
  const ok = /\/editor/.test(page.url());
  ck("클릭 → 맵 에디터 이동", ok, page.url());
  if (ok) {
    const c = await page.evaluate(() => ({
      canvas: document.querySelectorAll("canvas").length,
      text: (document.body.innerText || "").slice(0, 60).replace(/\n+/g, " "),
    }));
    ck("맵 에디터가 렌더된다", c.canvas > 0, `canvas ${c.canvas} | ${c.text}`);
    await page.screenshot({ path: "/root/.hermes/cache/scratch/editor_arrived.png" });
  }
  await page.goto(`${BASE}/skill-editor`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  const c2 = await page.evaluate(() => document.querySelectorAll("canvas").length);
  ck("스킬 메이커가 렌더된다", c2 > 0, `canvas ${c2}`);
}

ck("pageerror 없음", errs.length === 0, errs.slice(0, 2).join(" | "));

await browser.close();
console.log(`\nRESULT ${pass}/${pass + fail} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
