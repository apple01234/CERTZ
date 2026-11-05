/** 게임 화면 구조 진단 — 로비가 canvas 인지 DOM 인지, 어디에 렌더되는지. */
import { chromium } from "playwright";

const BASE = process.argv[2] || "https://sertz.vercel.app";
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 120)); });

await page.goto(BASE, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(4000);

const dump = async (tag) => {
  const s = await page.evaluate(() => ({
    url: location.href,
    title: document.title,
    canvas: document.querySelectorAll("canvas").length,
    bodyText: (document.body.innerText || "").replace(/\n+/g, " | ").slice(0, 250),
    domNodes: document.querySelectorAll("#__next *, body *").length,
    links: [...document.querySelectorAll("a")].map((a) => a.getAttribute("href")).slice(0, 10),
    buttons: [...document.querySelectorAll("button")].map((b) => (b.innerText || "").trim()).filter(Boolean).slice(0, 12),
    localKeys: Object.keys(localStorage).slice(0, 8),
  }));
  console.log(`\n===== ${tag} =====`);
  console.log(JSON.stringify(s, null, 1));
  return s;
};

await dump("초기 화면");
await page.screenshot({ path: "/root/.hermes/cache/scratch/g0.png" });

/* 로그인 주입 */
const ID = process.env.SERTZ_ID, PW = process.env.SERTZ_PW;
if (ID && PW) {
  const r = await page.evaluate(async ([id, pw]) => {
    const res = await fetch("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, pw }),
    });
    const d = await res.json();
    if (d?.token) {
      localStorage.setItem("sertz_token", d.token);
      localStorage.setItem("sertz_user", JSON.stringify(d.user));
    }
    return { status: res.status, user: d?.user, hasToken: !!d?.token };
  }, [ID, PW]);
  console.log("\n로그인:", JSON.stringify(r));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(4000);
  await dump("로그인 후");
  await page.screenshot({ path: "/root/.hermes/cache/scratch/g1.png" });

  /* 게임 시작류 버튼 모두 시도 */
  for (const label of ["게임 시작", "시작", "START", "들어가기"]) {
    const b = page.locator(`button:has-text("${label}")`).first();
    if (await b.count()) {
      await b.click({ timeout: 15000 }).catch((e) => console.log("클릭실패", label, String(e).slice(0, 60)));
      await page.waitForTimeout(2500);
      await dump(`'${label}' 클릭 후`);
      await page.screenshot({ path: `/root/.hermes/cache/scratch/g_after_${label}.png` });
      break;
    }
  }
}

console.log("\nerrors:", JSON.stringify(errs.slice(0, 5), null, 1));
await browser.close();
