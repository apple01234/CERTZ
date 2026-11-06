/**
 * verify_boss_quests.mjs — howlrstone 15챕터 보스 퀘스트 배치 검증
 *
 * 실측 대상: STAGES[howlrstoneNxM] 의 quests 배열과 boss 플래그.
 * 기대: 보스 챕터의 마지막 스테이지에 type:"boss" 퀘스트가 정확히 1개 있고,
 *       그 보스 스테이지의 뒤에 reach 퀘스트가 붙으며, 보스가 아닌 구역에는
 *       boss/reach 가 없어야 한다.
 */
import { STAGES } from "../src/game/stages.ts";
import { HOWLRSTONE_CHAPTERS } from "../src/game/howlrstone.ts";

let fail = 0, pass = 0;
for (const spec of HOWLRSTONE_CHAPTERS) {
  const last = spec.stages;
  for (let sub = 1; sub <= last; sub++) {
    const key = `${spec.key}x${sub}`;
    const def = STAGES[key];
    if (!def) { console.log(`✗ ${key} 스테이지 없음`); fail++; continue; }
    const bossQ = def.quests.filter((q) => q.type === "boss");
    const reachQ = def.quests.filter((q) => q.type === "reach");
    const isBossStage = !!def.boss;

    if (isBossStage) {
      const okBoss = bossQ.length === 1 && def.bossKey === spec.boss;
      const okReach = reachQ.length === 1;
      if (okBoss && okReach) pass++;
      else {
        fail++;
        console.log(`✗ ${key} (보스구역) bossQ=${bossQ.length} reachQ=${reachQ.length} bossKey=${def.bossKey} 기대=${spec.boss}`);
      }
    } else {
      if (bossQ.length === 0 && reachQ.length === 0) pass++;
      else {
        fail++;
        console.log(`✗ ${key} (일반구역) bossQ=${bossQ.length} reachQ=${reachQ.length} — 보스/차원문 퀘스트가 새면 안 됨`);
      }
    }
  }
  /* 보스 챕터는 마지막 구역이 보스여야 한다 */
  const lastKey = `${spec.key}x${last}`;
  if (spec.boss && !STAGES[lastKey]?.boss) {
    fail++;
    console.log(`✗ ${spec.key} 마지막 구역(${lastKey})이 보스가 아님`);
  }
  if (!spec.boss) pass++;
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);

/* howlrstone3 상세 — 크라켄 신고 케이스 */
console.log("\n=== howlrstone3 (크라켄·해롤드) 상세 ===");
for (let sub = 1; sub <= 5; sub++) {
  const d = STAGES[`howlrstone3x${sub}`];
  console.log(`  x${sub} boss=${d.boss} bossKey=${d.bossKey ?? "-"} quota=${d.quests.length}`);
  for (const q of d.quests) console.log(`      [${q.type}] ${q.title}`);
}
process.exit(fail ? 1 : 0);
