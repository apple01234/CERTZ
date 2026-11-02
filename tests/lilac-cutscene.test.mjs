// node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs tests/lilac-cutscene.test.mjs
import assert from "node:assert/strict";
import { LILAC_SCENARIOS, LILAC_CHAPTER_MAP, lilacScenarioIdAt } from "../src/game/lilacScenarios.ts";

let checks = 0;
const ok = (name, cond) => { assert.ok(cond, name); checks++; };

/* 1) 시나리오 구조 */
const ids = Object.keys(LILAC_SCENARIOS);
ok("시나리오 16편", ids.length === 16);

const VALID = new Set(["cam","enter","exit","move","say","wait","flash","fade","shake"]);
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
  for (const p of LILAC_CHAPTER_MAP[ch]) placed.add(p.id);
}
for (const id of ids) ok(`매핑 존재: ${id}`, placed.has(id));

/* 4) 조회 함수 동작
 *  vc234 — 영프 편은 본편 챕터와 키를 공유하지 않는다. 종전엔 forest/1 에
 *  lilac00 이 배치돼 본편을 진행하다 라일락 컷씬이 튀어나왔다(유저 지적:
 *  "아뜰란티스 → 영준프린세스 → 그랜드 플레닛 순서인데 왜 스토리를 섞나").
 *  이제 본편 키는 전부 null 이고, howlrstone 만 매핑을 가진다. */
ok("howlrstone1/1 → lilac00", lilacScenarioIdAt("howlrstone1", 1) === "lilac00");
ok("howlrstone5/10 → lilac15", lilacScenarioIdAt("howlrstone5", 10) === "lilac15");
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

console.log(`lilac-cutscene: ${checks} checks passed / ${ids.length} scenarios`);
