// 스테이지별 대사 — "3개 순환" 회귀 방지
// 실행: node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs --test tests/stageDialogue.test.mjs
import assert from "node:assert/strict";

const { stageDialogueLines, hasStageDialogue } = await import("../src/game/stageDialogue.ts");
const { DIALOGUES } = await import("../src/game/data.ts");
const { CHAPTERS, stageIntro, parseStage } = await import("../src/game/stages.ts");

let checks = 0;
const ok = (name, cond) => { assert.ok(cond, `✗ ${name}`); checks++; };
const eq = (name, a, b) => { assert.deepEqual(a, b, `✗ ${name}`); checks++; };

/* ── 1. 순환 폐지의 핵심 계약: 구역마다 다른 세트 ── */
{
  /* 본편 9챕터 + DLC 10챕터 전부에 대해, 같은 챕터 안 8개 구역(sub 2~9)이
   * 서로 다른 대사 세트를 가져야 한다. 종전엔 3개를 돌려써서 8개 중 최대 3종류였다. */
  for (const spec of CHAPTERS) {
    const sigs = [];
    for (let sub = 2; sub <= 9; sub++) {
      const id = stageIntro(`${spec.key}${sub}`);
      const d = DIALOGUES[id];
      ok(`${spec.key}${sub}: 대사 키 실재 (${id})`, !!d);
      sigs.push(JSON.stringify(d?.lines ?? null));
    }
    const uniq = new Set(sigs);
    ok(`${spec.key}: 서브 2~9 중복 없이 ${uniq.size}/8 세트`, uniq.size === sigs.length);
    /* 첫 줄이 같으면 "또 그 얘기"로 읽힌다 — 시작점이 달라야 한다 */
    const firsts = sigs.map((s) => JSON.parse(s)?.[0]);
    ok(`${spec.key}: 첫 줄이 구역마다 다름`, new Set(firsts).size === firsts.length);
    /* 키 자체도 구역별로 달라야 한다 (같은 키를 재사용하면 seenSet 이 1회만 재생) */
    const ids = [];
    for (let sub = 2; sub <= 9; sub++) ids.push(stageIntro(`${spec.key}${sub}`));
    ok(`${spec.key}: 대사 키도 구역별로 다름`, new Set(ids).size === ids.length);
  }
}

/* ── 2. 결정론 — 같은 (챕터, 구역)이면 언제나 같은 결과 ── */
{
  for (const key of ["forest", "abyss", "dlcstargate", "dlcsernium"]) {
    for (let sub = 2; sub <= 9; sub++) {
      eq(`${key}${sub} 결정론`, stageDialogueLines(key, sub), stageDialogueLines(key, sub));
    }
  }
}

/* ── 3. 풀 없는 키는 빈 배열 — 호출부가 기존 키로 폴백해야 한다 ── */
{
  for (const k of ["village", "rebirth", "howlrstone1", "youngprincessv"]) {
    eq(`${k}: 풀 없음 → 빈 배열`, stageDialogueLines(k, 3), []);
    ok(`${k}: hasStageDialogue false`, hasStageDialogue(k) === false);
  }
  /* 재림/영프 편은 종전 경로가 그대로 살아 있어야 한다 */
  ok("재림 r7 은 기존 rebirthWalk 키", /^rebirthWalk[123]$/.test(stageIntro("r7")));
  ok("영프 howlrstone1x2 는 기존 howlWalk 키", /^howlWalk1_[123]$/.test(stageIntro("howlrstone1x2")));
}

/* ── 4. 서사 금지어 미포함 (retired-story-removal 과 같은 규칙) ── */
{
  const forbidden = /이그드라실|아뜰란티스|아틀란티스|9개의 바다|아홉 바다|아홉 개의 바다|세계수/;
  assert.doesNotMatch(JSON.stringify(DIALOGUES), forbidden, "✗ 옛 서사 표기가 대사에 남아 있다");
  checks++;
}

/* ── 5. 구역 대사 형식 — 3줄, 빈 줄 없음, 중복 줄 없음 ── */
{
  let bad = 0;
  for (const spec of CHAPTERS) {
    for (let sub = 2; sub <= 9; sub++) {
      const lines = stageDialogueLines(spec.key, sub);
      if (lines.length !== 3) bad++;
      if (lines.some((l) => !l || !l.trim())) bad++;
      if (new Set(lines).size !== lines.length) bad++;
    }
  }
  eq("모든 구역 대사: 3줄·비어있지 않음·중복 없음", bad, 0);
}

/* ── 6. stageIntro 가 모든 사냥터에서 유효 키를 낸다 ──
 *  챕터 마을(Xv)은 제외한다 — stageIntro 가 sub=0 을 받으면 `ch{num}Walk-1` 이라는
 *  존재하지 않는 키를 내는 **기존 버그**가 있다(내 변경 이전부터 동일). 마을은
 *  WorldScene 이 isVillage 로 먼저 분기해 stageIntro 를 쓰지 않으므로 실해는 없다.
 *  ponytail: 이 버그는 이번 범위(대사 다양화) 밖이라 고치지 않는다. */
{
  const { STAGES } = await import("../src/game/stages.ts");
  let missing = 0, tested = 0;
  for (const key of Object.keys(STAGES)) {
    if (/v$/.test(key)) continue; // 챕터 마을 — 위 주석 참고
    const id = stageIntro(key);
    if (!id || !DIALOGUES[id]) { missing++; console.log(`  누락: ${key} -> ${id}`); }
    tested++;
  }
  ok(`사냥터 ${tested}개: stageIntro → DIALOGUES 키 누락 ${missing}`, missing === 0);
}

console.log(`stageDialogue: ${checks} checks OK`);
