/* e2e_v146_reactions.js — v1.4.16 원소 반응 시스템 검증 (자동 리뷰 라운드 2)
 *  [A] 정적: 반응 테이블·Enemy/Boss 연결·WorldScene 연출 헬퍼·가이드 문구
 *  [B] 유닛: __SERTZ_DEBUG__.data.elementReaction (4반응 + 부정 케이스)
 *  [C] 실측: 전사(화염) → forest1(자연) 진입 → takeDamage 수치 실측
 *      ① 첫 타격: 100 × 1.25(약점) × 1.35(폭발 반응) = 169 (±2)
 *      ② 즉시 재타격: 쿨다운 1.6초 내 → 100 × 1.25 = 125 (반응 없음)
 *      ③ 반응 텍스트 풀 활성화 확인
 *      ④ 스플래시: 반응 시 주변 적 피해 (noReact 플래그) */
const fs = require("fs");
const path = require("path");
const ROOT = "/home/z/my-project";
let pass = 0, fail = 0;
const results = [];
function chk(name, cond, detail = "") {
  if (cond) { pass++; results.push(`PASS  ${name}`); }
  else { fail++; results.push(`FAIL  ${name}${detail ? " — " + detail : ""}`); }
}
function read(p) { return fs.readFileSync(path.join(ROOT, p), "utf8"); }

/* ---------- [A] 정적 검증 ---------- */
const data = read("src/game/data.ts");
const enemy = read("src/game/entities/Enemy.ts");
const boss = read("src/game/entities/Boss.ts");
const world = read("src/game/scenes/WorldScene.ts");
const panels = read("src/components/game/Panels.tsx");

chk("A1 반응 테이블 4종 정의", data.includes("blast:") && data.includes("frostbite:") && data.includes("melt:") && data.includes("annihilate:"));
chk("A2 elementReaction 4조합 매핑", /fire.*nature.*blast|elementReaction[\s\S]*blast/.test(data) && data.includes('"light" && def === "dark"'));
chk("A3 반응 데미지 배율 범위 (1.2~1.35)", /dmgMul: 1\.(2|3|35)/.test(data));
chk("A4 반응 쿨다운 1.6초 (Enemy)", enemy.includes("now - this.lastReactAt > 1600"));
chk("A5 반응 쿨다운 1.6초 (Boss)", boss.includes("now - this.lastReactAt > 1600"));
chk("A6 Enemy noReact 파라미터 (스플래시 연쇄 방지)", enemy.includes("noReact = false"));
chk("A7 Enemy 반응 상태이상 (스턴/슬로우)", enemy.includes("applyStun(R.stunMs)") && enemy.includes("applySlow(R.slowMult, R.slowMs)"));
chk("A8 Boss 반응 CC 면역 (스플래시/스턴 호출 없음)", !/ELEM_REACTION_META\[reactKey\][\s\S]{0,400}applyReactionSplash/.test(boss) && !boss.includes("applyStun(R"));
chk("A9 WorldScene 반응 연출 (텍스트+폭발+이중 링)", world.includes("spawnElementReaction") && world.includes("spawnShockwave(x, y, R.hex, 1.25"));
chk("A10 WorldScene 스플래시 헬퍼 (120px)", world.includes("applyReactionSplash") && world.includes("> 120"));
chk("A11 반응 텍스트 풀 3장", world.includes("reactTextPool") && world.includes("for (let i = 0; i < 3; i++)"));
chk("A12 가이드에 원소 반응 안내", panels.includes("원소 반응 (유리 상성)"));
chk("A13 스플래시 takeDamage noReact=true 전달", world.includes("e.takeDamage(dmg, new Phaser.Math.Vector2(e.x - x, e.y - y).normalize(), 40, false, true)"));

/* ---------- [B/C] 라이브 실측 ---------- */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message.slice(0, 160)));

  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForSelector("text=게임 시작", { timeout: 40000 });
  await p.getByText("게임 시작", { exact: false }).first().click();
  await p.waitForTimeout(2000);
  const hasStart = await p.getByText("이 캐릭터로 시작").first().isVisible().catch(() => false);
  if (!hasStart) {
    await p.getByText("캐릭터 생성").first().click(); await p.waitForTimeout(1200);
    await p.getByPlaceholder("캐릭터 이름 (최대 8자)").fill("반응러");
    await p.getByText("다음 — 직업 선택").click(); await p.waitForTimeout(1000);
    await p.getByText("전사", { exact: false }).first().click();
    await p.getByText("다음 — 외형 선택").click(); await p.waitForTimeout(1000);
    await p.getByText("남캐").first().click(); await p.waitForTimeout(600);
    await p.getByText("전사로 생성!").click(); await p.waitForTimeout(1500);
  }
  await p.getByText("이 캐릭터로 시작").first().click();
  await p.waitForTimeout(3000);

  /* [B] 유닛 — elementReaction 로직 */
  const unit = await p.evaluate(() => {
    const d = window.__SERTZ_DEBUG__?.data;
    if (!d || !d.elementReaction) return { ok: false };
    const r = (a, b) => d.elementReaction(a, b);
    return {
      ok: true,
      fireNature: r("fire", "nature") === "blast",
      natureIce: r("nature", "ice") === "frostbite",
      iceFire: r("ice", "fire") === "melt",
      lightDark: r("light", "dark") === "annihilate",
      darkLight: r("dark", "light") === "annihilate",
      negFireIce: r("fire", "ice") === null,
      negNone: r("none", "nature") === null,
      negSame: r("nature", "nature") === null,
      metaNames: ["blast", "frostbite", "melt", "annihilate"].every((k) => !!d.ELEM_REACTION_META?.[k]?.name),
    };
  });
  chk("B1 화염>자연=폭발", unit.ok && unit.fireNature);
  chk("B2 자연>냉기=결빙", unit.ok && unit.natureIce);
  chk("B3 냉기>화염=융해", unit.ok && unit.iceFire);
  chk("B4 빛↔어둠=소멸 (양방향)", unit.ok && unit.lightDark && unit.darkLight);
  chk("B5 불리/무속성/동원소 반응 없음", unit.ok && unit.negFireIce && unit.negNone && unit.negSame);
  chk("B6 반응 메타 완전성 (이름/색상)", unit.ok && unit.metaNames);

  /* [C] 실측 — 전사(화염) vs forest1(자연) */
  const jumped = await p.evaluate(() => {
    try {
      const g = window.__SERTZ__?.game;
      if (!g) return false;
      const stub = { stage: "forest1", lv: 3, exp: 0, maxHp: 140, atk: 14, cleared: false, maxMp: 60, playerName: "반응러", cls: "warrior", startCls: "warrior", gold: 50, introSeen: true };
      /* scene.restart(data) — init(data) → registry.set("initData") → create 경로와 동일 (stop/start 경합 회피) */
      const w = g.scene.getScene("world");
      if (!w) return false;
      w.scene.restart({ stage: "forest1", save: stub, fresh: true });
      return true;
    } catch (e) { return false; }
  });
  await p.waitForTimeout(7000);
  const probe = await p.evaluate(() => {
    const g = window.__SERTZ__?.game;
    const w = g?.scene?.getScene?.("world");
    if (!w) return { ok: false };
    const e = (w.enemies || []).find((x) => x.active && x.alive);
    return { ok: !!e, stage: w.stageKey || w.stageDef?.key, elem: e?.elem, playerElem: w.playerRef?.attackElem, count: (w.enemies || []).filter((x) => x.active && x.alive).length };
  });
  chk("C1 forest1 강제 진입 + 적 존재", jumped && probe.ok && probe.count > 0, `count=${probe.count} stage=${probe.stage}`);
  chk("C2 원소 조건: 전사(화염) vs 적(자연)", probe.ok && probe.playerElem === "fire" && probe.elem === "nature", `player=${probe.playerElem} enemy=${probe.elem}`);

  if (probe.ok) {
    const hit = await p.evaluate(() => {
      const g = window.__SERTZ__.game;
      const w = g.scene.getScene("world");
      const e = (w.enemies || []).find((x) => x.active && x.alive);
      e.hp = 100000; e.maxHp = Math.max(e.maxHp, 100000); // 즉사 방지 — 쿨다운 비교용
      const before = e.hp;
      const others = (w.enemies || []).filter((x) => x.active && x.alive && x !== e);
      const othersBefore = others.map((o) => ({ o, hp: o.hp }));
      e.takeDamage(100, { x: 0, y: -1 }, 0); // 첫 타격 → 반응 발동 (dir은 duck-typed)
      const afterReact = e.hp;
      const reactedText = w.reactTextPool.some((t) => t.active);
      const splashDropped = othersBefore.filter(({ o, hp }) => o.hp < hp).length; // 주변 적 피해
      e.takeDamage(100, { x: 0, y: -1 }, 0); // 쿨다운 내 재타격 → 반응 없음
      const afterCd = e.hp;
      return {
        firstDrop: before - afterReact,
        secondDrop: afterReact - afterCd,
        reactedText, splashDropped,
        nearOthers: othersBefore.filter(({ o }) => Math.abs(o.x - e.x) < 400 && Math.abs(o.y - e.y) < 400).length,
      };
    });
    // 100 × 1.25 × 1.35 = 168.75 → 169 (±3 반올림 여유)
    chk("C3 반응 발동: 첫 타격 ≈169 (약점1.25×반응1.35)", hit.firstDrop >= 165 && hit.firstDrop <= 175, `실측=${hit.firstDrop}`);
    chk("C4 쿨다운: 재타격 ≈125 (반응 미발동)", hit.secondDrop >= 120 && hit.secondDrop <= 130, `실측=${hit.secondDrop}`);
    chk("C5 반응 텍스트 연출 활성", hit.reactedText);
    chk("C6 반응 스플래시 (주변 적 피해)", hit.splashDropped >= 1 || hit.nearOthers === 0, `splash=${hit.splashDropped} near=${hit.nearOthers}`);
    await p.screenshot({ path: "/tmp/e2e_reaction_world.png" }).catch(() => {});
  }

  chk("전체 pageerror 0건", errs.length === 0, errs.slice(0, 2).join("|"));
  await b.close();
})().catch((e) => { results.push(`FAIL  라이브 실측 실행 실패 — ${e.message}`); fail++; });

process.on("exit", () => {
  console.log(results.join("\n"));
  console.log(`\n총 ${pass + fail}항목 — PASS ${pass} / FAIL ${fail}`);
  if (fail > 0) process.exitCode = 1;
});
