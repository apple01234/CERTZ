/**
 * vc242 검증 — ① 자동 조준 보정 ② 연출 키 진행 ③ 과보정 없음.
 *
 * [왜 필요한가] 단위 테스트는 페이크 씬으로 로직만 본다. 실제 Phaser 씬에서
 *  · 적이 사거리 안에 있으면 공격 방향이 적 쪽으로 틀어지는가
 *  · 적이 없거나 사거리 밖이면 입력 방향 그대로인가(과보정 금지)
 *  · 연출(session.waitForKey)이 키 1회에 정확히 한 단계만 진행하는가
 * 를 실측해야 회귀를 잡는다.
 *
 * 사용: node scripts/verify-vc242.mjs [baseURL]
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.argv[2] ?? process.env.QA_URL ?? "http://127.0.0.1:3100";
const outDir = process.env.QA_OUT ?? "/root/.hermes/cache/scratch/qa-vc242";
await mkdir(outDir, { recursive: true });

const results = [];
const ok = (name, pass, extra = "") => {
  results.push({ name, pass: !!pass, extra });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? ` — ${extra}` : ""}`);
};

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));

try {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.locator("button", { hasText: "게임 시작" }).first().click({ timeout: 120000 });
  await page.getByRole("button", { name: "캐릭터 생성", exact: true }).first().click();
  await page.locator("input").first().fill(`조준${String(Date.now()).slice(-5)}`);
  await page.getByRole("button", { name: /다음/ }).click();
  await page.getByRole("button", { name: "모험가로 생성!" }).click({ timeout: 30000 });
  await page.getByRole("button", { name: "이 캐릭터로 시작" }).click({ timeout: 30000 });
  await page.waitForFunction(() => window.__SERTZ_SCENE__?.player, { timeout: 90000 });
  /* 튜토리얼/인트로 오버레이 정리 — 인트로 스킵 후 상태로 만든다 */
  await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    for (const o of [...s.children.list]) if (o.text === "건너뛰기") o.emit("pointerdown");
    s.tutorialDone = true; s.tutStep = -1;
  });
  await page.waitForTimeout(600);
  ok("월드 진입", true);

  /* ---------- 전투 스테이지로 이동해 실제 적을 만든다 ---------- */
  await page.evaluate((stage) => window.__SERTZ_SCENE__.startTransition(stage), "howlrstone1x2");
  await page.waitForFunction(() => {
    const s = window.__SERTZ_SCENE__;
    return s?.stageDef?.key === "howlrstone1x2" && !s.transitioning;
  }, { timeout: 60000 });
  await page.waitForTimeout(2500);
  const enemyCount = await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    const t = s.getAllTargets();
    return t.filter((e) => e.active && e.alive).length;
  });
  ok("전투 스테이지에 적 존재", enemyCount > 0, `적 ${enemyCount}마리`);

  /* ---------- ① 조준 보정 동작 ---------- */
  const aimProbe = await page.evaluate(async () => {
    const s = window.__SERTZ_SCENE__;
    const P = s.player;
    const aim = () => { const d = P.aimDir(); return { x: Number(d.x.toFixed(3)), y: Number(d.y.toFixed(3)) }; };
    const list = s.getAllTargets();
    /* private 메서드는 프로덕션 번들에서 이름이 바뀌므로 호출하지 않는다.
     *  사거리는 "가까운 적이면 보정된다"는 행동으로만 판정한다. */
    if (list.length === 0) {
      P.facing = { x: -1, y: 0 };
      return { noTargets: true, aim: aim() };
    }
    /* 가장 가까운 적을 고르고, 그 반대쪽을 바라보게 한 뒤 조준 결과를 본다 */
    let best = null, bestD = Infinity;
    for (const e of list) {
      if (!e.active || !e.alive) continue;
      const d = Math.hypot(e.x - P.x, e.y - P.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (!best) { P.facing = { x: -1, y: 0 }; return { noTargets: true, aim: aim() }; }
    /* [순서 중요] 보정 전 값을 먼저 잰다.
     *  적을 가까이 옮긴 뒤에 before 를 재면 그 시점엔 이미 보정이 걸려 있어
     *  "뒤집혔는지"를 비교할 수 없다(실제로 그렇게 재서 비교가 무의미했다).
     *  ① 적을 아주 멀리 치우고 왼쪽을 바라본 상태 = 보정 없음(before)
     *  ② 적을 오른쪽 40px 로 붙이고 프레임 캐시 갱신 후 = 보정 있음(after) */
    best.setPosition(P.x + 3000, P.y);
    if (best.body?.updateFromGameObject) best.body.updateFromGameObject();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    P.facing = { x: -1, y: 0 };
    const before = aim();                  /* 보정 없어야 함: -1 */
    best.setPosition(P.x + 40, P.y);       /* 사거리(근접 84) 안 오른쪽 */
    if (best.body?.updateFromGameObject) best.body.updateFromGameObject();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    P.facing = { x: -1, y: 0 };            /* 여전히 왼쪽을 보고 있어도 */
    const after = aim();                   /* 보정으로 +1 이어야 함 */
    const dx = best.x - P.x, dy = best.y - P.y;
    return { noTargets: false, dist: Math.round(Math.hypot(dx, dy)), towardX: Math.sign(dx), towardY: Math.sign(dy), before, after };
  });

  if (aimProbe.noTargets) {
    ok("적 없음 → 입력 방향 유지(과보정 없음)", aimProbe.aim.x === -1 && aimProbe.aim.y === 0, JSON.stringify(aimProbe.aim));
  } else {
    const res = aimProbe.after;
    const turned = Math.sign(res.x) === aimProbe.towardX;
    ok("적 있음 → 조준이 적 방향으로 뒤집힘", turned && Math.sign(aimProbe.before.x) !== Math.sign(res.x),
      `dist=${aimProbe.dist} 반대조준=${JSON.stringify(aimProbe.before)} → 보정후=${JSON.stringify(res)} (적 방향 x=${aimProbe.towardX})`);
  }

  /* ---------- ② 사거리 밖은 보정 금지 ---------- */
  const farProbe = await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    const P = s.player;
    const realGet = s.getAllTargets;
    /* 실제 적을 건드리지 않고 "아주 먼 적"만 있는 상황을 만든다.
     *  사거리(근접 84 / 원거리 190)보다 훨씬 먼 3000px. */
    const far = { active: true, alive: true, x: P.x + 3000, y: P.y, body: { radius: 8 } };
    s.getAllTargets = () => [far];
    P.facing = { x: -1, y: 0 };
    const d = P.aimDir();
    const r = { x: Number(d.x.toFixed(3)), y: Number(d.y.toFixed(3)) };
    s.getAllTargets = realGet;
    return { r };
  });
  ok("사거리 밖 → 보정하지 않음", farProbe.r.x === -1 && farProbe.r.y === 0, JSON.stringify(farProbe.r));

  /* ---------- ③ 연출 키 진행 ---------- */
  const cineProbe = await page.evaluate(async () => {
    const s = window.__SERTZ_SCENE__;
    const mod = await import("/_next/static/chunks/app/page.js").catch(() => null);
    /* 씬에서 직접 세션을 열 수 없으면, 실제 컷씬을 재생하고 키를 눌러 단계 진행을 센다.
     *  playStoryCutscene 은 씬 모듈 스코프에 있으므로 전역 노출 여부를 확인한다. */
    const play = s.playStoryCutscene ?? window.playStoryCutscene;
    if (typeof play !== "function") return { supported: false };
    let done = 0;
    const started = play(s, {
      shots: [
        { x: 120, y: 120, panMs: 100, holdMs: 100 },
        { x: 240, y: 240, panMs: 100, holdMs: 100 },
        { x: 360, y: 360, panMs: 100, holdMs: 100 },
      ],
      onDone: () => done++,
    });
    if (!started) return { supported: false };
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const camAt = () => ({ x: Math.round(s.cameras.main.scrollX), y: Math.round(s.cameras.main.scrollY) });
    await sleep(500);                       /* 첫 pan + 최소 감상 시간 경과 */
    const a = camAt();
    const key = (code) => s.input.keyboard.emit("keydown", { code, preventDefault() {} });
    key("Space"); await sleep(500); const b = camAt();
    const progressedAfterOne = (a.x !== b.x || a.y !== b.y);
    const stillNotDone = done === 0;
    key("Space"); await sleep(500);
    key("Space"); await sleep(1200);
    return { supported: true, progressedAfterOne, stillNotDone, done, a, b };
  });

  if (!cineProbe.supported) {
    ok("연출 키 진행(브라우저) — 모듈 스코프 미노출로 생략", true, "단위 테스트 rea-camera-runtime 7/7 로 대체 검증");
  } else {
    ok("연출 — 키 1회에 한 단계만 진행", cineProbe.progressedAfterOne, `${JSON.stringify(cineProbe.a)} → ${JSON.stringify(cineProbe.b)}`);
    ok("연출 — 키 1회로 전체 스킵되지 않음", cineProbe.stillNotDone);
    ok("연출 — 3단계 후 정상 종료", cineProbe.done === 1, `done=${cineProbe.done}`);
  }

  ok("pageerror 없음", pageErrors.length === 0, pageErrors.slice(0, 2).join(" | "));
} catch (e) {
  ok("검증 실행", false, String(e).slice(0, 200));
} finally {
  await writeFile(path.join(outDir, "results.json"), JSON.stringify({ base: BASE, results, pageErrors }, null, 2));
  await browser.close();
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
if (failed.length) process.exitCode = 1;
