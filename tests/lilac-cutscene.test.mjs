// node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs tests/lilac-cutscene.test.mjs
import assert from "node:assert/strict";
import { LILAC_SCENARIOS, LILAC_CHAPTER_MAP, lilacScenarioIdAt } from "../src/game/lilacScenarios.ts";
import { HOWLRSTONE_CHAPTERS } from "../src/game/howlrstone.ts";
import { chapterIntroOf, resolveChapterIntroShots } from "../src/game/storyCutscenes.ts";
import { cutsceneCharacter, castTexture } from "../src/game/cutsceneCast.ts";

let checks = 0;
const ok = (name, cond) => { assert.ok(cond, name); checks++; };

/* 1) 시나리오 구조 */
const ids = Object.keys(LILAC_SCENARIOS);
ok("시나리오 16편", ids.length === 16);

/* vc279 (P7c) — "choice" 추가: 중심 질문에 플레이어가 답하는 스텝. */
const VALID = new Set(["cam","enter","exit","move","pose","say","wait","flash","fade","shake","choice"]);
for (const id of ids) {
  const s = LILAC_SCENARIOS[id];
  ok(`${id}: id 일치`, s.id === id);
  ok(`${id}: 스텝 있음`, s.steps.length > 0);
  for (const st of s.steps) ok(`${id}: 스텝 타입 유효(${st.t})`, VALID.has(st.t));
}

/* 2) 배우 좌표계 — enter 한 배우는 반드시 exit 되거나 say 로 소비된다(누수 방지) */
for (const id of ids) {
  const s = LILAC_SCENARIOS[id];
  const entered = s.steps.filter(x => x.t === "enter").map(x => x.id);
  const exited  = new Set(s.steps.filter(x => x.t === "exit").map(x => x.id));
  for (const a of entered) ok(`${id}: 배우 ${a} 퇴장 처리`, exited.has(a));
}

/* 3) 매핑 전수 — 모든 시나리오가 어딘가에 배치됨 */
const placed = new Set();
for (const ch of Object.keys(LILAC_CHAPTER_MAP)) {
  const chapter = HOWLRSTONE_CHAPTERS.find((chapter) => chapter.key === ch);
  ok(`${ch}: 실제 챕터`, chapter);
  const fields = chapter.stages;
  for (const p of LILAC_CHAPTER_MAP[ch]) {
    ok(`${ch}/${p.sub}: 실제 구역`, p.sub >= 1 && p.sub <= fields);
  }
  for (const p of LILAC_CHAPTER_MAP[ch]) placed.add(p.id);
}
for (const id of ids) ok(`매핑 존재: ${id}`, placed.has(id));
ok("15개 장 모두 연출 있음", Object.keys(LILAC_CHAPTER_MAP).length === 15);

/* 4) Only the fifteen real Lilac chapters carry these directions. */
ok("howlrstone1/1 → lilac00", lilacScenarioIdAt("howlrstone1", 1) === "lilac00");
ok("howlrstone1/4 → lilac01", lilacScenarioIdAt("howlrstone1", 4) === "lilac01");
ok("howlrstone15/1 → lilac15", lilacScenarioIdAt("howlrstone15", 1) === "lilac15");
ok("존재하지 않는 howlrstone5/10 금지", lilacScenarioIdAt("howlrstone5", 10) === null);
ok("howlrstone1/2 미배치 구역은 null", lilacScenarioIdAt("howlrstone1", 2) === null);
ok("본편 forest 는 영프 연출 없음", lilacScenarioIdAt("forest", 1) === null);
ok("본편 abyss 도 영프 연출 없음", lilacScenarioIdAt("abyss", 1) === null);
ok("없는 챕터는 null", lilacScenarioIdAt("nope", 1) === null);
ok("null 챕터는 null", lilacScenarioIdAt(null, 1) === null);

/* 5) 대사 최소 길이 — 빈 대사 금지 */
for (const id of ids) {
  for (const st of LILAC_SCENARIOS[id].steps) {
    if (st.t === "say") {
      ok(`${id}: 화자 있음`, typeof st.speaker === "string" && st.speaker.length > 0);
      ok(`${id}: 대사 1줄 이상`, Array.isArray(st.lines) && st.lines.length > 0);
    }
  }
}

/* Revised opening precedence: Lilac gives a pendant, never Scarlet with a book. */
const opening = LILAC_SCENARIOS.lilac00.steps.filter((step) => step.t === "say");
ok("라일락 구조자", opening.some((step) => step.speaker === "라일락"));
ok("개정판 펜던트", opening.some((step) => step.lines.some((line) => line.includes("펜던트"))));
ok("구판 스칼렛 구조자 아님", !opening.some((step) => step.speaker === "스칼렛"));
for (const scenario of Object.values(LILAC_SCENARIOS)) {
  for (const step of scenario.steps.filter((step) => step.t === "enter")) {
    const c = cutsceneCharacter(step.actor.character);
    ok(`${scenario.id}: 인물별 전용 아틀라스`, c && step.actor.tex === castTexture(c.id));
    ok(`${scenario.id}: 초상과 같은 인물`, step.actor.frame === "idle-down-0");
  }
}
for (const chapter of HOWLRSTONE_CHAPTERS) {
  const intro = chapterIntroOf(chapter.key);
  ok(`${chapter.key}: 경로 인트로`, intro?.shots.length === 4);
  const shots = resolveChapterIntroShots(intro, {
    width: 1200, height: 700, entry: { x: 101, y: 202 }, feature: { x: 808, y: 404 }, player: { x: 181, y: 350 },
  });
  ok(`${chapter.key}: 실제 목표 클로즈업`, shots[2].x === 808 && shots[2].y === 404);
  ok(`${chapter.key}: 플레이어 복귀`, shots[3].x === 181 && shots[3].y === 350);
}

console.log(`lilac-cutscene: ${checks} checks passed / ${ids.length} scenarios`);
