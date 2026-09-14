/**
 * v1.0.19 A-3 — 신규 스테이지 15종 데이터 무결성 검증 (tsx)
 *  · 기존 90구역 전부 유지 + 신규 15종 추가
 *  · 체인: village→...→abyss10→r1→...→r15
 *  · 보스 3종(vord/jorm/nagr) · 정예 3곳 · scaleMul 순차 상승
 *  · 테마/몬스터/보상 고유성 (중복 조합 없음)
 */
import { STAGES, NEXT_STAGE, PREV_STAGE, STAGE_SHORT, STAGE_THEME, stageScale, stageIntro, BOSS_DEFS } from "../src/game/stages";

let fails = 0;
const ok = (name: boolean, msg: string) => {
  console.log(`${name ? "PASS" : "FAIL"} — ${msg}`);
  if (!name) fails++;
};

/* 1) 기존 스테이지 전부 존재 (마을 + 9챕터×10 + 챕터마을 9 + 특별구역) */
const oldKeys = ["village", "forest1", "forest10", "forestv", "kingdom1", "kingdom10", "alfheim5", "muspelheim10", "niflheim1", "cave10", "nidavellir5", "hel10", "abyss1", "abyss10", "dojang", "gate", "closet", "tower", "park", "interior_inn"];
ok(oldKeys.every((k) => STAGES[k]), `기존 스테이지 ${oldKeys.length}키 전부 존재 (회귀 없음)`);

/* 2) 신규 15종 존재 */
const rbKeys = Array.from({ length: 15 }, (_, i) => `r${i + 1}`);
ok(rbKeys.every((k) => STAGES[k]), `신규 스테이지 15종 등록 (r1~r15)`);

/* 3) 체인 — abyss10 → r1 → ... → r15 → null */
ok(NEXT_STAGE["abyss10"] === "r1", "abyss10 다음 = 재림1 (기존 체인에서 자연 연장)");
let chainOk = true;
for (let i = 0; i < 14; i++) if (NEXT_STAGE[`r${i + 1}`] !== `r${i + 2}`) chainOk = false;
ok(chainOk, "r1→r15 순차 체인");
ok(NEXT_STAGE["r15"] === null, "r15 다음 = null (종단)");
ok(PREV_STAGE["r1"] === "abyss10", "r1 복귀 = abyss10 (역순 체인)");

/* 4) 보스 3종 */
const bossStages = rbKeys.filter((k) => STAGES[k].boss);
ok(bossStages.length === 3 && bossStages.join(",") === "r5,r10,r15", `보스 스테이지 3종 (r5·r10·r15) — 실제: ${bossStages.join(",")}`);
ok(!!BOSS_DEFS.vord && !!BOSS_DEFS.jorm && !!BOSS_DEFS.nagr, "신규 보스 3종 정의 (베오르드·요르문간드·나그라파르)");

/* 5) scaleMul 순차 상승 (난이도 곡선) */
let curveOk = true;
for (let i = 1; i < 15; i++) {
  const prev = STAGES[`r${i}`].scaleMul!.hp;
  const cur = STAGES[`r${i + 1}`].scaleMul!.hp;
  if (cur <= prev) curveOk = false;
}
ok(curveOk, "난이도 곡선 순차 상승 (hp 18 → 56)");
ok(stageScale("r15").hp === 56 && stageScale("abyss10").hp > 15 && stageScale("forest1").hp === 1, "stageScale: 재림 전용 배율 적용 + 기존 곡선 무변경 (forest1=1)");

/* 6) 고유성 — 테마(색감+지형) / 몬스터 구성 / 보상 */
const themeSet = new Set(rbKeys.map((k) => `${STAGE_THEME[k].ground}|${STAGE_THEME[k].bg}`));
ok(themeSet.size === 15, `테마 고유성 15/15 (중복 ${15 - themeSet.size}건)`);
const enemySets = new Set(rbKeys.map((k) => STAGES[k].enemies.map((e) => `${e.key}x${e.count}`).sort().join(",")));
ok(enemySets.size === 15, `몬스터 구성 고유성 15/15`);
const rewardSets = new Set(rbKeys.map((k) => (STAGES[k].quests[0] as { reward?: number }).reward));
ok(rewardSets.size === 15, `클리어 보상 고유성 15/15`);

/* 7) 정예 3곳 */
const elites = rbKeys.filter((k) => STAGES[k].elite);
ok(elites.join(",") === "r3,r9,r13", `정예 배치 (r3·r9·r13) — 실제: ${elites.join(",")}`);

/* 8) 인트로 대사 키 유효 */
const intro1 = stageIntro("r1");
const intro5 = stageIntro("r5");
ok(intro1 === "rebirthWalk1" && intro5 === "rebirthBoss", `재림 인트로 (일반=${intro1} / 보스=${intro5})`);

/* 9) 총 스테이지 수 — 마을1 + 9챕터×11(구역10+마을)=99 + 인테리어2 + 특별5(dojang/gate/closet/tower/park) + 신규15 = 122 */
ok(Object.keys(STAGES).length === 122, `총 ${Object.keys(STAGES).length} 스테이지 (기존 107 + 신규 15)`);

/* 10) 라벨 */
ok(STAGE_SHORT.r1 === "재림1" && STAGE_SHORT.r15 === "재림15", "구역 라벨 (재림1~재림15)");

console.log(fails === 0 ? "\n===== A-3 데이터 검증: ALL PASS =====" : `\n===== ${fails}건 실패 =====`);
process.exit(fails === 0 ? 0 : 1);
