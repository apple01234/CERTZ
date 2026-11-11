/**
 * vc276 — 스킬 이펙트 3단 시점 분리 실제 브라우저 검증.
 *
 * 확인하는 것 (수치로):
 *  ① 스킬 시전 시 임팩트 오브젝트가 **시점을 달리해** 등장한다 (전부 t=0 이면 실패)
 *  ② 먼지 레이어(hv2_smoke26)가 실제로 생성된다
 *  ③ 저사양 모드(fxLevel 0)에서 3겹이 생성되지 않는다
 *  ④ 시각 지연이 판정(피해)을 바꾸지 않는다 — 스킬 사용 후 상태가 정상 복귀
 *
 * 실행: E2E_URL=http://127.0.0.1:PORT node scripts/playtest-skill-impact-staging.mjs
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";

const URL_ = process.env.E2E_URL ?? "http://127.0.0.1:4321";
const OUT = process.env.E2E_OUT ?? "/dev/shm/certz-v276";
mkdirSync(OUT, { recursive: true });

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
    await i.fill("이펙트검증");
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

/**
 * 씬에 훅을 심어 spawnSkillImpact 가 만드는 오브젝트의 생성 시각을 기록한다.
 * Phaser 오브젝트 추가를 가로채는 대신, 씬의 add.image 를 감싼다.
 * 엔진 함수 자체는 E2E 훅으로 주입한다 — 스킬 게이트(직업/해금/튜토리얼)와 무관하게
 * 계측 대상 함수만 호출하기 위해서다.
 */
async function instrument() {
  return page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    if (!s) return { ok: false, why: "no scene" };
    const g = window;
    // 1) spawnSkillImpact 훅 주입 (PhaserGame 이 노출한 __SERTZ__.spawnSkillImpact)
    s.__spawnSkillImpact = g.__SERTZ__?.spawnSkillImpact ?? s.__spawnSkillImpact;
    // 2) 이미 계측했으면 중복 방지
    if (s.__impactLog) return { ok: true, reused: true, hasFn: typeof s.__spawnSkillImpact === "function" };
    s.__impactLog = [];
    /* t 의 기준점은 **매 측정 시작 시점**으로 리셋한다. instrument 시점을 쓰면
     * 측정 사이에 흐른 시간이 섞여 지연값이 부풀려진다(첫 구현의 실제 버그). */
    s.__impactT0 = s.time.now;
    const orig = s.add.image.bind(s.add);
    s.add.image = function (x, y, key, frame) {
      const im = orig(x, y, key, frame);
      if (typeof key === "string" && (key.startsWith("vf_") || key.startsWith("hv2_"))) {
        s.__impactLog.push({ t: Math.round(s.time.now - s.__impactT0), key, x: Math.round(x), y: Math.round(y) });
      }
      return im;
    };
    return { ok: true, fxLevel: s.game.__sertzFxLevel, hasFn: typeof s.__spawnSkillImpact === "function" };
  });
}

async function castAndMeasure(label, opts = {}) {
  await page.evaluate((o) => {
    const s = window.__SERTZ_SCENE__;
    s.__impactLog.length = 0;
    s.__impactT0 = s.time.now; // 기준점 리셋 — 지연 측정의 정확도
    /* 튜토리얼 게이트 해제 — 이 검증은 "이펙트 생성 시점"만 본다.
     * 게이트는 조작 가능 여부일 뿐 이펙트 로직과 무관하므로, 여기서 열어도
     * 측정 대상(spawnSkillImpact)의 동작은 바뀌지 않는다. */
    if (o.openGate) {
      s.canPlayerAction = () => true;
      if (s.player && "featureTutOpen" in s.player) s.player.featureTutOpen = false;
    }
    if (o.fxLevel !== undefined) s.game.__sertzFxLevel = o.fxLevel;
  }, opts);
  // spawnSkillImpact 를 **직접** 호출해 3단 시점을 측정한다.
  // 스킬 진입 게이트(직업/해금/튜토리얼)와 무관하게, 계측 대상 함수만 본다.
  const cast = await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    const p = s.player;
    if (!p) return { ok: false, why: "no player" };
    const fn = s.__spawnSkillImpact;
    if (typeof fn !== "function") return { ok: false, why: "no hook" };
    try {
      fn(s, p.x, p.y, p.clsHex ? p.clsHex() : 0xffffff, { scale: 0.9 });
      return { ok: true, via: "direct" };
    } catch (e) { return { ok: false, why: String(e).slice(0, 200) }; }
  });
  await page.waitForTimeout(700); // stepMs*2(140) + 여유
  const log = await page.evaluate(() => window.__SERTZ_SCENE__.__impactLog.slice());
  await page.screenshot({ path: `${OUT}/${label}.png` });
  return { cast, log };
}

const out = {};
try {
  await enterGame();
  const ins = await instrument();
  out.instrument = ins;

  // ① 정상 모드 (튜토리얼 게이트 해제)
  out.normal = await castAndMeasure("normal", { openGate: true, fxLevel: 2 });

  // ② 저사양 모드
  out.lowFx = await castAndMeasure("lowfx", { openGate: true, fxLevel: 0 });
  await page.evaluate(() => { window.__SERTZ_SCENE__.game.__sertzFxLevel = 2; });

  // ③ 상태 복귀 확인
  out.after = await page.evaluate(() => {
    const p = window.__SERTZ_SCENE__.player;
    return { state: p?.state, mp: p?.mp, alive: !p?.dead };
  });
} catch (e) {
  out.fatal = String(e).slice(0, 300);
}

out.pageErrors = errors;
writeFileSync(`${OUT}/result.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
await b.close();
