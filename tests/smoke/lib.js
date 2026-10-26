/**
 * tests/smoke/lib.js — 스모크 공통 부트스트랩
 *
 * 목적: `WorldScene` 분할(P1-4) 전에 회귀를 잡을 안전망.
 * 원칙:
 *   · 외부 서버 의존 없이 이미 떠 있는 dev 서버(http://127.0.0.1:3000)를 쓴다.
 *   · 실패는 **수치**로 판정한다(문자열 비교 최소화).
 *   · 컨테이너는 WebGL 이 없으므로 `?renderer=canvas` 로 띄운다(기존 검증 스크립트와 동일).
 */
const { chromium } = require("playwright");

const BASE = process.env.SERTZ_BASE || "http://127.0.0.1:3000";
const ARGS = ["--no-sandbox", "--disable-gpu", "--use-gl=swiftshader"];

async function launch() {
  const browser = await chromium.launch({ args: ARGS });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors = [];
  const responses = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("response", (r) => responses.push({ url: r.url(), status: r.status() }));
  return { browser, page, errors, responses };
}

/** 버튼 클릭 (정규식) */
async function clickBtn(page, re) {
  return page.evaluate((src) => {
    const rx = new RegExp(src);
    const b = Array.from(document.querySelectorAll("button")).find((x) => rx.test(x.textContent || ""));
    if (b) { b.click(); return true; }
    return false;
  }, re.source);
}

/** 타이틀 → 캐릭터 생성/선택 → 월드 진입. 성공 시 true */
async function enterWorld(page, name = "스모크") {
  await page.goto(`${BASE}/?renderer=canvas`, { waitUntil: "domcontentloaded", timeout: 120000 });

  /* vc189 — 고정 대기(12초)로는 부족했다(실측: 부팅 요청 2,594건 → 타이틀까지 15~25초).
   *  버튼 출현을 폴링해 느린 기기에서도 실패하지 않게 한다. */
  const waitBtn = (re, ms = 60000) =>
    page.waitForFunction(
      (src) => Array.from(document.querySelectorAll("button")).some((b) => new RegExp(src).test(b.textContent || "")),
      re.source,
      { timeout: ms }
    ).then(() => true).catch(() => false);

  if (!(await waitBtn(/게임 시작/, 90000))) return false;
  await clickBtn(page, /게임 시작/);
  await page.waitForTimeout(2000);

  /* 기존 캐릭터가 있으면 바로 시작, 없으면 생성 플로우 */
  let started = await waitBtn(/이 캐릭터로 시작/, 6000);
  if (started) {
    await clickBtn(page, /이 캐릭터로 시작/);
  } else {
    if (!(await waitBtn(/캐릭터 생성/, 8000))) return false;
    await clickBtn(page, /캐릭터 생성/);
    await page.waitForTimeout(1200);
    const inp = await page.$("input[placeholder*='캐릭터 이름']");
    if (inp) await inp.fill(name);
    await page.waitForTimeout(700);
    await clickBtn(page, /^다음/);
    await page.waitForTimeout(1000);
    await clickBtn(page, /모험가로 생성/);
    await page.waitForTimeout(2500);
    if (!(await waitBtn(/이 캐릭터로 시작/, 10000))) return false;
    await clickBtn(page, /이 캐릭터로 시작/);
  }

  /* WorldScene 활성화 대기 */
  await page.waitForFunction(
    () => {
      const D = window.__SERTZ_DEBUG__;
      const sc = D?.game?.scene?.getScenes(true)?.find((s) => s && s.player && s.stageDef);
      return !!sc && sc.scene.isActive();
    },
    null,
    { timeout: 45000 }
  ).catch(() => null);
  await page.waitForTimeout(2500);
  return true;
}

/** WorldScene 이 살아있는지 + 기본 필드 존재 확인 */
async function worldState(page) {
  return page.evaluate(() => {
    const D = window.__SERTZ_DEBUG__;
    const sc = D?.game?.scene?.getScenes(true)?.find((s) => s && s.player && s.stageDef);
    if (!sc) return { ok: false, reason: "WorldScene 없음" };
    return {
      ok: true,
      stageKey: sc.stageDef?.key ?? null,
      isVillage: !!sc.stageDef?.isVillage,
      playerX: Math.round(sc.player?.x ?? -1),
      playerY: Math.round(sc.player?.y ?? -1),
      hp: sc.player?.hp ?? null,
      children: sc.children?.list?.length ?? -1,
      /* 실측: WorldScene.enemies 는 Phaser 그룹이 아니라 **배열**이다(getChildren 없음) */
      enemies: (Array.isArray(sc.enemies) ? sc.enemies : (sc.enemies?.getChildren?.() ?? [])).filter((e) => e && e.alive !== false).length,
      theme: sc._vTheme ? { title: sc._vTheme.title, ground: sc._vTheme.ground, plaza: sc._vTheme.plaza } : null,
    };
  });
}

/** 결과 출력 + 종료코드 */
function report(title, checks) {
  let fail = 0;
  console.log(`\n── ${title} ──`);
  for (const c of checks) {
    const mark = c.pass ? "PASS" : "FAIL";
    if (!c.pass) fail++;
    console.log(`  [${mark}] ${c.name}${c.detail !== undefined ? ` — ${c.detail}` : ""}`);
  }
  console.log(`  → ${checks.length - fail}/${checks.length} 통과`);
  return fail;
}

module.exports = { BASE, launch, clickBtn, enterWorld, worldState, report };
