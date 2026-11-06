// 구역 단위 컷씬 — 배정/1회 시청 키/대사 키 정합성
// 실행: node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs --test tests/stageCutscene.test.mjs
import assert from "node:assert/strict";

const { stageIntroOf, stageIntroSeenKey, stageBeatOf, STAGE_INTROS, chapterIntroOf } =
  await import("../src/game/storyCutscenes.ts");
const { DIALOGUES } = await import("../src/game/data.ts");
const { CHAPTERS } = await import("../src/game/stages.ts");

let checks = 0;
const ok = (name, cond) => { assert.ok(cond, `✗ ${name}`); checks++; };
const eq = (name, a, b) => { assert.deepEqual(a, b, `✗ ${name}`); checks++; };

/* ── 1. 본편+DLC 모든 사냥터 구역(2~9)에 연출이 배정된다 ── */
{
  let covered = 0, total = 0;
  for (const spec of CHAPTERS) {
    for (let sub = 2; sub <= 9; sub++) {
      total++;
      const s = stageIntroOf(spec.key, sub);
      ok(`${spec.key}:${sub} 연출 존재`, !!s && s.shots.length >= 2);
      if (s) covered++;
    }
  }
  eq(`전 구역 연출 커버리지 ${covered}/${total}`, covered, total);
}

/* ── 2. 구역 1(챕터 인트로)과 10(보스)은 이 경로가 담당하지 않는다 ── */
{
  for (const spec of CHAPTERS.slice(0, 3)) {
    eq(`${spec.key}:1 → null (챕터 인트로 담당)`, stageIntroOf(spec.key, 1), null);
    eq(`${spec.key}:10 → null (보스 담당)`, stageIntroOf(spec.key, 10), null);
  }
  eq("빈 챕터 → null", stageIntroOf(null, 3), null);
  eq("빈 챕터2 → null", stageIntroOf("", 3), null);
}

/* ── 3. 1회 시청 키가 챕터 키와 절대 겹치지 않는다 ──
 *  겹치면 챕터 인트로를 본 사람이 구역 연출을 못 보거나 그 반대가 된다. */
{
  for (const spec of CHAPTERS) {
    for (let sub = 2; sub <= 9; sub++) {
      const k = stageIntroSeenKey(spec.key, sub);
      ok(`${k}: 챕터 인트로 키와 다름`, k !== spec.key && k !== spec.num);
      ok(`${k}: 접두어 형식`, /^stage:[a-z0-9]+:[2-9]$/.test(k));
    }
  }
  /* 같은 구역은 항상 같은 키, 다른 구역은 다른 키 */
  eq("seen 키 결정론", stageIntroSeenKey("forest", 3), stageIntroSeenKey("forest", 3));
  ok("seen 키 구역별 고유", stageIntroSeenKey("forest", 3) !== stageIntroSeenKey("forest", 4));
}

/* ── 4. 수작업 연출의 dialogue 키가 DIALOGUES 에 실재한다 ── */
{
  for (const [slot, spec] of Object.entries(STAGE_INTROS)) {
    for (const shot of spec.shots) {
      if (!shot.dialogue) continue;
      ok(`${slot} → ${shot.dialogue} 실재`, !!DIALOGUES[shot.dialogue]);
    }
  }
}

/* ── 5. once 기본값 — 기존 1회 규칙을 깨지 않는다 ── */
{
  for (const spec of CHAPTERS.slice(0, 5)) {
    for (let sub = 2; sub <= 9; sub++) {
      const s = stageIntroOf(spec.key, sub);
      ok(`${spec.key}:${sub} once:true`, s?.once === true);
    }
  }
  for (const [slot, spec] of Object.entries(STAGE_INTROS)) {
    ok(`수작업 ${slot} once:true`, spec.once === true);
  }
}

/* ── 6. 샷 좌표가 0~1 비율 범위 안 (맵 크기 무관 규칙) ── */
{
  for (const [slot, spec] of Object.entries(STAGE_INTROS)) {
    for (const shot of spec.shots) {
      ok(`${slot} rx 범위`, shot.rx >= 0 && shot.rx <= 1);
      ok(`${slot} ry 범위`, shot.ry >= 0 && shot.ry <= 1);
    }
  }
}

/* ── 7. 성격 판정 — 정예/보스 직전은 전용 성격 ── */
{
  eq("sub5 → narrow", stageBeatOf("forest", 5), "narrow");
  eq("sub9 → descend", stageBeatOf("forest", 9), "descend");
  eq("sub1 → rise", stageBeatOf("forest", 1), "rise");
  const others = new Set();
  for (let sub = 2; sub <= 8; sub++) if (sub !== 5) others.add(stageBeatOf("forest", sub));
  ok("일반 구역은 sweep/rise 를 섞는다", others.size === 2);
}

/* ── 8. 챕터 인트로 경로는 종전 그대로 (회귀 금지) ── */
{
  ok("forest 챕터 인트로 유지", !!chapterIntroOf("forest"));
  ok("howlrstone1 챕터 인트로 유지", !!chapterIntroOf("howlrstone1"));
  eq("없는 챕터 → null", chapterIntroOf("없는키"), null);
}

console.log(`stageCutscene: ${checks} checks OK`);
