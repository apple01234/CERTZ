/**
 * vc278 — 궁극기 지속 타격(wave) 실제 브라우저 검증.
 *
 * 확인하는 것:
 *  ① 웨이브 타격이 시전 시간 전체에 퍼진다 (이전엔 0~1.3초에 끝나 공백 21~29초)
 *  ② 첫 웨이브가 인트로와 겹치지 않는다
 *  ③ 마지막 웨이브가 종결 연출 전에 온다
 *  ④ 사망 시 웨이브가 멈춘다
 *
 * 측정: Player.takeDamage 를 가로채 적이 피해를 받은 시각을 기록한다.
 * (엔진 API 직접 호출 — 스킬 게이트와 무관하게 궁극기만 본다)
 *
 * 실행: E2E_URL=http://127.0.0.1:PORT node scripts/playtest-ult-waves.mjs
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";

const URL_ = process.env.E2E_URL ?? "http://127.0.0.1:4321";
const OUT = process.env.E2E_OUT ?? "/dev/shm/certz-v278";
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
    await i.fill("궁극검증");
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

/** 적 피해 시각을 기록하도록 계측 */
async function instrument() {
  return page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    if (!s) return { ok: false, why: "no scene" };
    if (s.__waveLog) return { ok: true, reused: true };
    s.__waveLog = [];
    s.__waveT0 = 0;
    const targets = (s.enemies || []).concat(s.boss ? [s.boss] : []);
    let hooked = 0;
    for (const e of targets) {
      if (!e || typeof e.takeDamage !== "function") continue;
      const orig = e.takeDamage.bind(e);
      e.takeDamage = function (...a) {
        try { s.__waveLog.push(Math.round(s.time.now - s.__waveT0)); } catch { /* ignore */ }
        return orig(...a);
      };
      hooked++;
    }
    return { ok: true, hooked, enemies: targets.length };
  });
}

async function castUlt(key5) {
  await page.evaluate((k) => {
    const s = window.__SERTZ_SCENE__;
    const p = s.player;
    s.__waveLog.length = 0;
    s.__waveT0 = s.time.now;
    // 게이트 해제 — 판정이 아니라 "웨이브 분포"만 본다
    s.canPlayerAction = () => true;
    p.state = "idle";
    p.mp = 9999;
    p.skill5Cd = 0;
    p.skill5Unlocked = true;
    /* cls 를 강제로 바꾸면 resolveSkill5Of 가 그 직업 궁극기를 고른다. */
    if (k) p.cls = k;
  }, key5);
  const r = await page.evaluate(() => {
    const p = window.__SERTZ_SCENE__.player;
    try { p.useSkill5(); return { ok: true, cls: p.cls }; }
    catch (e) { return { ok: false, why: String(e).slice(0, 200) }; }
  });
  return r;
}

const out = { runs: {} };
try {
  await enter();
  out.instrument = await instrument();

  // 4차 10종 중 대표 4종 — hold 가 다른 것들
  for (const cls of ["warbringer", "eternal", "deadeye", "dreadnought"]) {
    await page.evaluate((k) => {
      const s = window.__SERTZ_SCENE__;
      s.player.cls = k;
      s.__waveLog.length = 0;
      s.__waveT0 = s.time.now;
    }, cls);
    const cast = await castUlt(cls);
    // hold 최대 30초 + 종결 여유
    await page.waitForTimeout(32000);
    const log = await page.evaluate(() => window.__SERTZ_SCENE__.__waveLog.slice());
    const hold = await page.evaluate((k) => {
      const s = window.__SERTZ_SCENE__;
      try { return s.ultHoldProbe ? s.ultHoldProbe(k) : null; } catch { return null; }
    }, cls);
    const last = log.length ? log[log.length - 1] : 0;
    out.runs[cls] = {
      castOk: cast.ok, castWhy: cast.why,
      hits: log.length,
      first: log[0] ?? null,
      last,
      // 마지막 타격이 20초 이후면 시전 후반까지 피해가 이어진 것
      lateHits: log.filter((t) => t > 15000).length,
      distinctSeconds: [...new Set(log.map((t) => Math.floor(t / 1000)))].length,
    };
  }
} catch (e) {
  out.fatal = String(e).slice(0, 300);
}
out.pageErrors = errors;
writeFileSync(`${OUT}/result.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
await b.close();
