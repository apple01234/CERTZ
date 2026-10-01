/** v2.4 체인 검증 — 레벨 게이트 배치 + 각 구역 퀘스트 구성 출력 */
import { STAGES } from "../src/game/stages";

const targets = [
  "village", "forest1", "forest4", "forest10",
  "kingdom1", "kingdom4", "alfheim1", "muspelheim1",
  "niflheim1", "cave1", "nidavellir1", "hel1", "abyss1", "abyss10",
];
for (const k of targets) {
  const s = STAGES[k];
  if (!s) { console.log(`${k}: 없음!`); continue; }
  const qs = s.quests.map((q) => `${q.type}${q.type === "level" ? `:${q.need}` : q.type === "hunt" ? `:${q.need ?? ""}` : ""}`);
  console.log(`${k.padEnd(12)} [${qs.join(", ")}]`);
}
// 레벨 게이트 누락 검사: 각 챕터 sub1/sub4에는 level 퀘스트가 반드시 있어야 한다
let missing = 0;
for (const [k, s] of Object.entries(STAGES)) {
  if (k === "village" || k.startsWith("interior")) continue;
  const m = /^(forest|kingdom|alfheim|muspelheim|niflheim|cave|nidavellir|hel|abyss)(\d+)$/.exec(k);
  if (!m) continue;
  const sub = parseInt(m[2], 10);
  const hasLevel = s.quests.some((q) => q.type === "level");
  if ((sub === 1 || sub === 4) && !hasLevel) { console.log(`MISSING gate: ${k}`); missing++; }
  if (sub !== 1 && sub !== 4 && hasLevel) { console.log(`UNEXPECTED gate: ${k}`); missing++; }
  // 체인 순서 검사: level 퀘스트는 항상 맨 앞
  if (s.quests.length && s.quests[0].type !== "level" && (sub === 1 || sub === 4)) {
    console.log(`GATE NOT FIRST: ${k}`); missing++;
  }
}
console.log(missing === 0 ? "✅ 레벨 게이트 18구역(챕터×2) 모두 정상 배치" : `❌ 문제 ${missing}건`);
