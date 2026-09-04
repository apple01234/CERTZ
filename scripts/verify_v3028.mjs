/**
 * v3.0.28 검증 스크립트 — 이번 라운드 6건 수정의 데이터/로직 정합성 점검
 *  [A] 챕터 마을 NPC 대사 복구 (무스펠헤임/니플헤임/니다벨리르 키 불일치)
 *  [B] 이동형(reach) 퀘스트 구조 (village v1 + 각 챕터 sub10 "다음 해역으로")
 *  [C] 보스 난이도 테이블 (이지/노말/하드/카오스)
 *  [D] 자동 토벌 퀘스트 targetKeys = 구역 스폰 조합 일치
 *  [E] 자동전투 개편 (퀘스트 우선 필터 제거 — 소스 정적 검사)
 */
import { readFileSync } from "node:fs";
import { CHAPTERS, STAGES, ENEMIES, BOSS_DEFS, BOSS_DIFFS, BOSS_DIFF_ORDER } from "../src/game/stages.ts";

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}`); } };

console.log("[A] 챕터 마을 NPC 대사 키 규칙 (vlg{챕터명}A/B)");
{
  // data.ts의 VLG 등록 규칙: vlg + 챕터키 첫글자 대문자 + A/B
  // NPC dlg 키가 이 규칙과 일치해야 DIALOGUES에 존재 → NPC 대화 가능
  const chapters = ["forest", "kingdom", "alfheim", "muspelheim", "niflheim", "cave", "nidavellir", "hel", "abyss"];
  const src = readFileSync(new URL("../src/game/data.ts", import.meta.url), "utf8");
  const npcSrc = src.slice(src.indexOf("export const CHAPTER_VILLAGE_NPC"));
  for (const ch of chapters) {
    const expectA = `vlg${ch.charAt(0).toUpperCase()}${ch.slice(1)}A`;
    const expectB = `vlg${ch.charAt(0).toUpperCase()}${ch.slice(1)}B`;
    // 각 챕터 정의 블록 시작 위치부터 700자 세그먼트에서 dlg 키 추출
    const idx = npcSrc.indexOf(`\n  ${ch}: {`);
    const seg = npcSrc.slice(idx, idx + 700);
    const mA = seg.match(/npcA:.*?dlg:\s*"(vlg\w+)"/);
    const mB = seg.match(/npcB:.*?dlg:\s*"(vlg\w+)"/);
    ok(mA && mB && mA[1] === expectA && mB[1] === expectB,
      `${ch}: dlg=${mA && mB ? `${mA[1]}/${mB[1]}` : "N/A"} → ${expectA}/${expectB} 일치`);
  }
  // 등록 블록이 실제로 VLG 규칙으로 DIALOGUES에 넣는지
  ok(/vlg\$\{key\.charAt\(0\)\.toUpperCase\(\)\}\$\{key\.slice\(1\)\}A/.test(src), "DIALOGUES 등록 규칙 vlg{Cap}A 존재");
}

console.log("[B] 이동형 퀘스트 구조");
{
  const v1 = STAGES.village.quests.find((q) => q.id === "v1");
  ok(v1 && v1.type === "reach" && v1.title === "숲의 신전으로", "village v1 '숲의 신전으로' reach 존재");
  let reachCount = 0;
  for (const ch of CHAPTERS) {
    for (let sub = 1; sub <= 10; sub++) {
      const st = STAGES[`${ch.key}${sub}`];
      if (!st) continue;
      if (st.quests.some((q) => q.type === "reach" && q.title === "다음 해역으로")) reachCount++;
    }
  }
  ok(reachCount === CHAPTERS.length, `각 챕터 10구역 '다음 해역으로' reach — ${reachCount}/${CHAPTERS.length}챕터`);
}

console.log("[C] 보스 난이도 테이블");
{
  const keys = BOSS_DIFF_ORDER;
  ok(JSON.stringify(keys) === JSON.stringify(["easy", "normal", "hard", "chaos"]), "4단계 순서 easy/normal/hard/chaos");
  ok(BOSS_DIFFS.easy.hp < 1 && BOSS_DIFFS.normal.hp === 1 && BOSS_DIFFS.hard.hp > 1 && BOSS_DIFFS.chaos.hp > BOSS_DIFFS.hard.hp,
    `HP 배율 단조 증가 ${BOSS_DIFFS.easy.hp}/${BOSS_DIFFS.normal.hp}/${BOSS_DIFFS.hard.hp}/${BOSS_DIFFS.chaos.hp}`);
  ok(BOSS_DIFFS.easy.reward < 1 && BOSS_DIFFS.chaos.reward > 3,
    `보상 배율 이지 ${BOSS_DIFFS.easy.reward} < 노말 1 < 카오스 ${BOSS_DIFFS.chaos.reward}`);
  ok(BOSS_DIFFS.easy.emerald < BOSS_DIFFS.normal.emerald && BOSS_DIFFS.normal.emerald < BOSS_DIFFS.hard.emerald && BOSS_DIFFS.hard.emerald < BOSS_DIFFS.chaos.emerald,
    `에메랄드 단조 증가 ${BOSS_DIFFS.easy.emerald}/${BOSS_DIFFS.normal.emerald}/${BOSS_DIFFS.hard.emerald}/${BOSS_DIFFS.chaos.emerald}`);
  // 재림판 배율 적용식 — spawnReplayBoss 소스에서 dif.hp/dif.atk/dif.reward 사용 확인
  const ws = readFileSync(new URL("../src/game/scenes/WorldScene.ts", import.meta.url), "utf8");
  ok(/spawnReplayBoss[\s\S]{0,1200}dif\.hp[\s\S]{0,600}dif\.atk[\s\S]{0,600}dif\.reward/.test(ws), "재림판 수치에 난이도 배율 적용");
  ok(/rpg:bossDifficulty/.test(ws) && /ui:panel[\s\S]{0,80}bossdiff/.test(ws), "스토리 보스 난이도 선택 이벤트 연결");
  ok(/bossDiffPending\) return;/.test(ws), "난이도 선택 전 보스 스폰 게이트");
  ok(/bossDiffPendingSince > 4000/.test(ws), "보루 4초 노말 자가치유");
  ok(/bossDiff: this\.bossDiff/.test(ws), "세이브에 난이도 기록");
  const panels = readFileSync(new URL("../src/components/game/Panels.tsx", import.meta.url), "utf8");
  ok(/rpg:bossReplay[\s\S]{0,60}lv: diff/.test(panels), "재림 패널에서 난이도 전송");
  ok(panels.includes("BossDifficultyPanel"), "난이도 선택 패널 존재");
}

console.log("[D] 자동 토벌 퀘스트 targetKeys = 구역 스폰 조합");
{
  let checked = 0, match = 0;
  const bad = [];
  for (const ch of CHAPTERS) {
    for (let sub = 1; sub <= 9; sub++) {
      const st = STAGES[`${ch.key}${sub}`];
      if (!st) continue;
      const q = st.quests.find((x) => x.type === "hunt" && x.id.endsWith("-auto-hunt"));
      if (!q) continue;
      checked++;
      const spawnKeys = [...new Set(st.enemies.map((g) => g.key))];
      const qKeys = [...new Set(q.targetKeys ?? [])];
      const same = spawnKeys.length === qKeys.length && spawnKeys.every((k) => qKeys.includes(k));
      if (same) match++;
      else bad.push(`${ch.key}${sub}: 퀘스트[${qKeys}] vs 스폰[${spawnKeys}]`);
    }
  }
  ok(match === checked, `자동 토벌 대상 = 구역 스폰 전체 (${match}/${checked} 구역)${bad.length ? ` — 불일치: ${bad.slice(0, 3).join(", ")}` : ""}`);
  // 스토리 beat 토벌은 단일 대상 유지
  const beat = STAGES.forest3?.quests.find((q) => q.id === "forest3-f1");
  ok(beat && beat.targetKey === "spider" && !beat.targetKeys, "스토리 beat 토벌은 단일 대상 유지(숲의 거미)");
  ok(typeof ENEMIES.x3_icezombie.name === "string" && ENEMIES.x3_icezombie.name === "얼어붙은 좀비", "얼어붙은 좀비 공식 명칭 정상");
}

console.log("[E] 자동전투 개편 (정적 검사)");
{
  const ws = readFileSync(new URL("../src/game/scenes/WorldScene.ts", import.meta.url), "utf8");
  ok(!/퀘스트 타겟 최우선/.test(ws), "퀘스트 타겟 최우선 필터 제거 확인");
  ok(/autoThreatScore\(/.test(ws), "위협도 스코어링 도입");
  ok(/HP \* 0\.3|hp <= p\.maxHp \* 0\.3/.test(ws), "근접 포위 이탈(HP 30% 이하) 도입");
  ok(!/cq\.type === "hunt"|qKey = cq/.test(ws.split("autoThreatScore")[0].split("tickAutoHunt").pop() ?? ""), "tickAutoHunt에서 currentQuest() 타겟 필터 미사용");
  ok(/enterPortal\(\)[\s\S]{0,900}type === "reach"\) this\.advanceQuest\(\)/.test(ws), "enterPortal reach 완료 처리");
  ok(/vlg\$\{cap\}A/.test(ws), "showDialogue 챕터 폴백");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
