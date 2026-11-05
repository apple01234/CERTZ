/**
 * 초상화 파이프라인 검증 — 정본 인물 초상화가 대화창에 실제로 뜨는가.
 *
 * [왜 필요한가]
 *  AI 생성 이미지를 `_map.json` 에 넣는 것만으로는 부족하다. 대화창이
 *  그 키를 찾아 **실제로 렌더**하는지, 잘린 이미지가 아닌지 확인해야 한다.
 *
 * 사용: node scripts/verify-portraits.mjs http://127.0.0.1:3140
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://127.0.0.1:3140";

let pass = 0, fail = 0;
const ck = (n, ok, d = "") => { console.log(`${ok ? "✓" : "✗"} ${n}${d ? ` — ${d}` : ""}`); ok ? pass++ : fail++; };

const browser = await chromium.launch({
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.locator("button", { hasText: "게임 시작" }).first().click({ timeout: 120000 });
await page.getByRole("button", { name: "캐릭터 생성", exact: true }).first().click();
await page.locator("input").first().fill("초상" + String(Date.now()).slice(-4));
await page.getByRole("button", { name: /다음/ }).click();
await page.getByRole("button", { name: "모험가로 생성!" }).click({ timeout: 30000 });
await page.getByRole("button", { name: "이 캐릭터로 시작" }).click({ timeout: 30000 });
await page.waitForFunction(() => window.__SERTZ_SCENE__?.player, { timeout: 90000 });
await page.waitForTimeout(1500);

/* 1) 파일 자체가 브라우저에서 로드되는가 (404 아님) */
const fileCheck = await page.evaluate(async () => {
  const keys = ["lilac", "riel", "haru", "scarlet", "lucy", "ari", "rian", "feron",
    "cartel", "aden", "ran", "elbert", "iris", "ion", "jade", "littlestar", "jenifer", "ihyun"];
  const out = [];
  for (const k of keys) {
    const url = `/assets/npcportrait/npc_${k}.png`;
    try {
      const r = await fetch(url, { method: "HEAD" });
      out.push({ k, ok: r.ok, status: r.status });
    } catch (e) { out.push({ k, ok: false, status: String(e).slice(0, 40) }); }
  }
  return out;
});
const badFiles = fileCheck.filter((f) => !f.ok);
ck("18명 초상화 파일 HTTP 200", badFiles.length === 0, badFiles.map((b) => `${b.k}:${b.status}`).join(",") || `${fileCheck.length}개`);

/* 2) 대화창에 초상화가 실제로 그려지는가 — 라일락 대사로 확인 */
const dlg = await page.evaluate(async () => {
  const s = window.__SERTZ_SCENE__;
  s.showDialogueRaw({ speaker: "라일락", lines: ["초상화 검증용 대사입니다."] });
  await new Promise((r) => setTimeout(r, 1200));
  /* 대화창 안의 img 를 찾는다 */
  const panel = [...document.querySelectorAll("div")].find((d) =>
    d.className.includes?.("game-panel") && d.textContent.includes("라일락"));
  if (!panel) return { found: false };
  const img = panel.querySelector("img");
  if (!img) return { found: true, hasImg: false, panelText: panel.textContent.slice(0, 60) };
  return {
    found: true, hasImg: true,
    src: img.getAttribute("src"),
    natural: [img.naturalWidth, img.naturalHeight],
    visible: img.offsetParent !== null && img.style.display !== "none",
    rect: (() => { const r = img.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })(),
  };
});
console.log("대화창:", JSON.stringify(dlg));
ck("라일락 대화창이 열림", dlg.found === true);
ck("초상화 img 가 존재", dlg.hasImg === true, JSON.stringify(dlg).slice(0, 120));
if (dlg.hasImg) {
  ck("초상화가 npc_lilac.png 를 가리킴", String(dlg.src).includes("npc_lilac"), dlg.src);
  ck("이미지가 실제로 로드됨(0 아님)", dlg.natural?.[0] > 0 && dlg.natural?.[1] > 0, JSON.stringify(dlg.natural));
  ck("초상화가 표시됨(display!=none)", dlg.visible === true);
}

/* 3) 여러 화자로 반복 — 매핑이 살아있는지 */
const multi = await page.evaluate(async () => {
  const s = window.__SERTZ_SCENE__;
  const speakers = ["스칼렛", "리안", "페르온", "카르텔", "아덴"];
  const out = [];
  for (const sp of speakers) {
    s.showDialogueRaw({ speaker: sp, lines: ["검증"] });
    await new Promise((r) => setTimeout(r, 500));
    const panel = [...document.querySelectorAll("div")].find((d) =>
      d.className.includes?.("game-panel") && d.textContent.includes(sp));
    const img = panel?.querySelector("img");
    out.push({ sp, src: img?.getAttribute("src") ?? null, nat: img ? img.naturalWidth : 0 });
  }
  return out;
});
console.log("다중 화자:", JSON.stringify(multi));
const badMulti = multi.filter((m) => !m.src || m.nat === 0);
ck("5명 화자 초상화 전부 로드", badMulti.length === 0, JSON.stringify(badMulti));

ck("pageerror 없음", errs.length === 0, errs.slice(0, 2).join(" | "));

await page.screenshot({ path: "/root/.hermes/cache/scratch/portrait_ingame.png" });
console.log(`\nRESULT ${pass}/${pass + fail} passed, ${fail} failed`);
await browser.close();
process.exit(fail === 0 ? 0 : 1);
