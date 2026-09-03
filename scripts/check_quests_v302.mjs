/* v3.0.2 퀘스트-스폰 일치 감사: 모든 hunt 퀘스트 targetKey가 해당 구역 스폰 조합에 존재해야 함 */
import { STAGES } from "../src/game/stages.ts";

let bad = 0, total = 0;
for (const [key, st] of Object.entries(STAGES)) {
  if (!st.quests || st.boss === undefined && !st.enemies) continue;
  const pool = new Set((st.enemies ?? []).map((g) => g.key));
  if (st.bossKey) pool.add(st.bossKey);
  for (const q of st.quests) {
    if (q.type !== "hunt") continue;
    total++;
    if (!pool.has(q.targetKey)) {
      bad++;
      console.log(`MISMATCH ${key} quest=${q.id} target=${q.targetKey} pool=[${[...pool].join(",")}]`);
    }
  }
}
console.log(`\nhunt 퀘스트 ${total}건 중 불일치 ${bad}건 — ${bad === 0 ? "ALL OK" : "FIX NEEDED"}`);
