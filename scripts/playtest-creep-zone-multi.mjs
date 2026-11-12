/**
 * vc278 — 인게임 구역 몰이(ratio) 다중 스테이지 측정.
 *
 * 왜 필요한가
 * -----------
 * vc277 핸드오프 작업 B: "1-1 은 8마리/2종족이라 표본이 작다. **20마리 이상·3종족 이상**
 *  스테이지에서 ratio 를 재측정." — vc278 1차 작업에서 1-1 만 쟀다(ratio 9.65).
 *  표본이 큰 스테이지에서도 유지되는지 확인해야 목표를 닫을 수 있다.
 *
 * 측정 방법
 * ---------
 * 씬의 spawnRecords(종족 key + 월드 x,y)를 읽어
 *   intra = 종족 내 평균 거리(무게중심 기준)      ← 작을수록 뭉침
 *   inter = 종족 무게중심 간 평균 거리            ← 클수록 분리
 *   ratio = inter / intra                          ← 1.5 이상이면 "구역이 동작한다"
 *
 * 스테이지 이동은 gameKeys 로 노출된 씬 재시작 경로를 쓴다. 경로가 없으면
 * URL 해시/내부 상태를 통해 진입을 시도하고, 실패하면 그 스테이지는 건너뛴다
 * (건너뛴 것을 **성공으로 보고하지 않는다**).
 *
 * 실행: E2E_URL=http://127.0.0.1:4321 node scripts/playtest-creep-zone-multi.mjs
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

const URL_ = process.env.E2E_URL ?? "http://127.0.0.1:4321";
const OUT = process.env.E2E_OUT ?? ".e2e-multi";
mkdirSync(OUT, { recursive: true });

/* 후보 스테이지 — 큰 표본(20마리+) 위주로, 하나는 반드시 3종족 이상.
 * 키는 src/game/stages.ts 의 `key` 필드와 일치해야 한다. */
const CANDIDATES = (process.env.E2E_STAGES ?? "howlrstone1x1,1-2,1-3,2-1,3-1,howlrstone5x5").split(",");

const b = await chromium.launch({ args: ["--no-sandbox", "--enable-unsafe-swiftshader"] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));

async function enterGame() {
  await page.goto(URL_, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: /게임 시작/ }).first().click({ timeout: 180000 });
  await page.waitForTimeout(2500);
  if (!(await page.getByRole("button", { name: "이 캐릭터로 시작" }).count())) {
    await page.getByRole("button", { name: "캐릭터 생성" }).first().click({ timeout: 60000 });
    await page.waitForTimeout(2200);
    const i = page.locator("input").first();
    await i.waitFor({ state: "visible", timeout: 60000 });
    await i.fill("구역다중");
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

/** 씬에 붙은 분석기 — analyze 와 동일 식을 쓴다(비교 가능성 유지) */
async function analyze() {
  return page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    const recs = (s.spawnRecords || []).filter((r) => r && typeof r.x === "number");
    if (recs.length < 3) return { ok: false, why: `스폰 기록 부족 (${recs.length})`, total: recs.length };
    const byKey = new Map();
    for (const r of recs) {
      if (!byKey.has(r.key)) byKey.set(r.key, []);
      byKey.get(r.key).push({ x: r.x, y: r.y });
    }
    const keys = [...byKey.keys()];
    const cents = {};
    for (const k of keys) {
      const a = byKey.get(k);
      cents[k] = { x: a.reduce((p, c) => p + c.x, 0) / a.length, y: a.reduce((p, c) => p + c.y, 0) / a.length };
    }
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    let intra = 0, intraN = 0;
    for (const k of keys) for (const p of byKey.get(k)) { intra += dist(p, cents[k]); intraN++; }
    intra = intraN ? intra / intraN : 0;
    let inter = 0, interN = 0;
    for (let i = 0; i < keys.length; i++)
      for (let j = i + 1; j < keys.length; j++) { inter += dist(cents[keys[i]], cents[keys[j]]); interN++; }
    inter = interN ? inter / interN : 0;
    const spread = {};
    for (const k of keys) {
      let m = 0;
      for (const p of byKey.get(k)) m = Math.max(m, dist(p, cents[k]));
      spread[k] = Math.round(m);
    }
    return {
      ok: true,
      stageKey: s.stageDef?.key ?? null,
      total: recs.length,
      species: keys.length,
      counts: Object.fromEntries(keys.map((k) => [k, byKey.get(k).length])),
      intra: Math.round(intra),
      inter: Math.round(inter),
      ratio: inter && intra ? +(inter / intra).toFixed(2) : null,
      spread,
    };
  });
}

/** 특정 스테이지로 진입 시도. 성공하면 true.
 *
 * WorldScene 의 실제 전환 경로는 `this.scene.restart({ stage, save })` 다
 * (WorldScene.ts L4256 — gotoStage 의 마지막 줄). 그래서 여기서도 같은 형태를 쓴다.
 * `save` 를 넘기지 않으면 `lastCarry`(직전 buildSave 결과)가 재사용된다.
 */
async function gotoStage(stageKey) {
  const entered = await page.evaluate((key) => {
    const s = window.__SERTZ_SCENE__;
    if (!s) return { ok: false, why: "씬 없음" };
    if (typeof s.scene?.restart !== "function") return { ok: false, why: "scene.restart 없음" };
    try {
      /* transitioning 게이트를 먼저 닫지 않으면 restart 가 무시될 수 있다.
       * 이건 판정과 무관한 순수 UI 게이트라 여기서만 해제한다(핸드오프 §1-5 허용 범위). */
      if ("transitioning" in s) s.transitioning = false;
      /* ⚠️ init() L876: `data.stage === data.save.stage` 이면 save.stage 로 덮어쓴다.
       *  → save 의 stage 필드를 대상 스테이지로 맞춘 사본을 넘긴다.
       * ⚠️ 더 결정적인 것 — L1741:
       *    rawStage = resumeTutorial !== null
       *                 ? tutorialStage(resumeTutorial)      // ← data.stage 를 완전히 무시
       *                 : data.stage ?? save.stage
       *  새 캐릭터는 **튜토리얼 진행 중**이라 resumeTutorial 이 non-null 이고, 그러면
       *  어떤 stage 를 넘겨도 튜토리얼 스테이지로 되돌아간다(실측: dlcocean 요청 → 실제
       *  howlrstone1x1 유지). 측정을 위해 튜토리얼 플래그만 끈다 — 판정·전투와 무관하다. */
      if ("tutStep" in s) s.tutStep = -1;
      const base = s.buildSave?.(key) ?? s.lastCarry ?? null;
      const save = base ? { ...base, stage: key, tutorialDone: true } : undefined;
      s.scene.restart({ stage: key, save });
      return { ok: true, via: "scene.restart" };
    } catch (e) {
      return { ok: false, why: `restart 실패: ${e}` };
    }
  }, stageKey);
  if (!entered.ok) return entered;
  try {
    await page.waitForFunction(
      (k) => window.__SERTZ_SCENE__?.assetsReady && window.__SERTZ_SCENE__?.stageDef?.key === k,
      stageKey,
      { timeout: 120000 },
    );
  } catch {
    const actual = await page.evaluate(() => window.__SERTZ_SCENE__?.stageDef?.key ?? null);
    return { ok: false, why: `진입 후 stageKey 불일치 (실제 ${actual})` };
  }
  await page.waitForTimeout(2500);
  return { ok: true };
}

const report = { url: URL_, at: new Date().toISOString(), stages: [] };
try {
  await enterGame();
  report.base = await analyze();

  for (const stageKey of CANDIDATES) {
    const cur = await page.evaluate(() => window.__SERTZ_SCENE__?.stageDef?.key ?? null);
    if (cur === stageKey) {
      const a = await analyze();
      report.stages.push({ requested: stageKey, entered: true, ...a });
      continue;
    }
    const g = await gotoStage(stageKey);
    if (!g.ok) {
      report.stages.push({ requested: stageKey, entered: false, why: g.why });
      continue;
    }
    const a = await analyze();
    report.stages.push({ requested: stageKey, entered: true, ...a });
    await page.screenshot({ path: `${OUT}/stage-${stageKey}.png` }).catch(() => {});
  }
} catch (e) {
  report.fatal = String(e).slice(0, 400);
}
report.pageErrors = errors;
writeFileSync(`${OUT}/result.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
await b.close();
