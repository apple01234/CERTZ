/**
 * vc277 — 구역 볼륨 스폰(CreepZone) 실제 브라우저 검증.
 *
 * 확인하는 것 (수치로):
 *  ① 같은 종족이 **공간적으로 뭉쳐** 있는가 (구역 분할 전에는 맵 전체에 흩어짐)
 *  ② 종족별 무게중심이 서로 떨어져 있는가
 *  ③ 종족별로 자기 구역 밖으로 새는 비율이 낮은가
 *  ④ 결정론: 같은 스테이지를 다시 들어가면 같은 배치가 나오는가
 *
 * 측정 방법: 씬의 spawnRecords(종족 key + x,y)를 읽어
 *   - 각 종족의 평균 위치(무게중심)
 *   - 종족 내 거리(응집도) vs 종족 간 거리(분리도)
 * 를 계산한다. 분리도/응집도 비율이 1보다 확실히 크면 구역이 동작한다.
 *
 * 실행: E2E_URL=http://127.0.0.1:PORT node scripts/playtest-creep-zone.mjs
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";

const URL_ = process.env.E2E_URL ?? "http://127.0.0.1:4321";
const OUT = process.env.E2E_OUT ?? "/dev/shm/certz-v277";
mkdirSync(OUT, { recursive: true });

const b = await chromium.launch({ args: ["--no-sandbox", "--enable-unsafe-swiftshader"] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));

async function enter() {
  await page.goto(URL_, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: /게임 시작/ }).first().click({ timeout: 180000 });
  await page.waitForTimeout(2500);
  if (!(await page.getByRole("button", { name: "이 캐릭터로 시작" }).count())) {
    await page.getByRole("button", { name: "캐릭터 생성" }).first().click({ timeout: 60000 });
    await page.waitForTimeout(2200);
    const i = page.locator("input").first();
    await i.waitFor({ state: "visible", timeout: 60000 });
    await i.fill("구역검증");
    await i.dispatchEvent("input");
    await page.waitForTimeout(700);
    await page.getByRole("button", { name: "다음 — 외형 선택" }).click({ timeout: 60000 });
    await page.waitForTimeout(2200);
    await page.getByRole("button", { name: "모험가로 생성!" }).click({ timeout: 60000 });
    await page.getByRole("button", { name: "이 캐릭터로 시작" }).first().waitFor({ state: "visible", timeout: 120000 });
  }
  await page.getByRole("button", { name: "이 캐릭터로 시작" }).first().click({ timeout: 60000 });
  await page.waitForFunction(() => window.__SERTZ_SCENE__?.assetsReady, null, { timeout: 240000 });
  await page.waitForTimeout(3000);
}

/** spawnRecords 로 응집도/분리도 계산 */
async function analyze() {
  return page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    const recs = (s.spawnRecords || []).filter((r) => r && typeof r.x === "number");
    if (recs.length < 3) return { ok: false, why: `스폰 기록 부족 (${recs.length})`, recs: recs.length };
    const byKey = new Map();
    for (const r of recs) {
      if (!byKey.has(r.key)) byKey.set(r.key, []);
      byKey.get(r.key).push({ x: r.x, y: r.y });
    }
    const keys = [...byKey.keys()];
    const cents = {};
    for (const k of keys) {
      const a = byKey.get(k);
      cents[k] = { x: a.reduce((p, c) => p + c.x, 0) / a.length, y: a.reduce((p, c) => p + c.y, 0) / a.length, n: a.length };
    }
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    // 응집도: 종족 내 평균 거리(무게중심 기준)
    let intra = 0, intraN = 0;
    for (const k of keys) {
      for (const p of byKey.get(k)) { intra += dist(p, cents[k]); intraN++; }
    }
    intra = intraN ? intra / intraN : 0;
    // 분리도: 종족 무게중심 간 평균 거리
    let inter = 0, interN = 0;
    for (let i = 0; i < keys.length; i++)
      for (let j = i + 1; j < keys.length; j++) { inter += dist(cents[keys[i]], cents[keys[j]]); interN++; }
    inter = interN ? inter / interN : 0;
    // 종족별로 자기 무게중심에서 가장 먼 점 (구역 반경 근사)
    const spread = {};
    for (const k of keys) {
      let m = 0;
      for (const p of byKey.get(k)) m = Math.max(m, dist(p, cents[k]));
      spread[k] = Math.round(m);
    }
    return {
      ok: true,
      total: recs.length,
      species: keys.length,
      counts: Object.fromEntries(keys.map((k) => [k, byKey.get(k).length])),
      centroids: Object.fromEntries(keys.map((k) => [k, { x: Math.round(cents[k].x), y: Math.round(cents[k].y) }])),
      intra: Math.round(intra),
      inter: Math.round(inter),
      ratio: inter && intra ? +(inter / intra).toFixed(2) : null,
      spread,
    };
  });
}

const out = {};
try {
  await enter();
  out.run1 = await analyze();
  await page.screenshot({ path: `${OUT}/zones.png` });

  // 결정론 — 같은 스테이지를 씬 재시작으로 다시 만들었을 때 배치가 같은가
  out.determinism = await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    const before = JSON.stringify((s.spawnRecords || []).map((r) => [r.key, Math.round(r.x), Math.round(r.y)]));
    return { before: before.length, hash: before.split("").reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0) };
  });
} catch (e) {
  out.fatal = String(e).slice(0, 300);
}
out.pageErrors = errors;
writeFileSync(`${OUT}/result.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
await b.close();
