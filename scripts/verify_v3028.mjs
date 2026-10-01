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
  /* v3.1.0 — 보스 밸런스 재조정: 노말 1.5/1.25 상향 (유저 지시 "보스 너무 약함") */
  ok(BOSS_DIFFS.easy.hp < BOSS_DIFFS.normal.hp && BOSS_DIFFS.normal.hp >= 1.5 && BOSS_DIFFS.hard.hp > BOSS_DIFFS.normal.hp && BOSS_DIFFS.chaos.hp > BOSS_DIFFS.hard.hp,
    `HP 배율 단조 증가 + 노말 상향 ${BOSS_DIFFS.easy.hp}/${BOSS_DIFFS.normal.hp}/${BOSS_DIFFS.hard.hp}/${BOSS_DIFFS.chaos.hp}`);
  ok(BOSS_DIFFS.easy.reward < 1 && BOSS_DIFFS.chaos.reward > 3,
    `보상 배율 이지 ${BOSS_DIFFS.easy.reward} < 노말 1 < 카오스 ${BOSS_DIFFS.chaos.reward}`);
  ok(BOSS_DIFFS.easy.emerald < BOSS_DIFFS.normal.emerald && BOSS_DIFFS.normal.emerald < BOSS_DIFFS.hard.emerald && BOSS_DIFFS.hard.emerald < BOSS_DIFFS.chaos.emerald,
    `에메랄드 단조 증가 ${BOSS_DIFFS.easy.emerald}/${BOSS_DIFFS.normal.emerald}/${BOSS_DIFFS.hard.emerald}/${BOSS_DIFFS.chaos.emerald}`);
  // 재림판 배율 적용식 — spawnReplayBoss 소스에서 dif.hp/dif.atk/dif.reward 사용 확인
  const ws = readFileSync(new URL("../src/game/scenes/WorldScene.ts", import.meta.url), "utf8");
  ok(/spawnReplayBoss[\s\S]{0,1200}dif\.hp[\s\S]{0,600}dif\.atk[\s\S]{0,600}dif\.reward/.test(ws), "재림판 수치에 난이도 배율 적용");
  /* v3.1.0 — 스토리 보스는 난이도 선택창 없이 전용 난이도(노말 고정)로 즉시 스폰 */
  ok(!/rpg:bossDifficulty/.test(ws) && !/ui:panel[\s\S]{0,80}bossdiff/.test(ws), "스토리 보스 난이도 선택창 제거");
  ok(/else if \(q\.type === "boss"\) \{[\s\S]{0,320}spawnBoss\(true\)/.test(ws), "스토리 보스 즉시 스폰 (전용 난이도)");
  ok(/bossDiffPending\) return;/.test(ws), "난이도 선택 전 보스 스폰 게이트(안전망 유지)");
  ok(/bossDiff: this\.bossDiff/.test(ws), "세이브에 난이도 기록");
  const panels = readFileSync(new URL("../src/components/game/Panels.tsx", import.meta.url), "utf8");
  ok(/rpg:bossReplay[\s\S]{0,60}lv: diff/.test(panels), "재림 패널에서 난이도 전송");
  ok(!panels.includes("BossDifficultyPanel"), "스토리 난이도 선택 패널 제거됨");
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

console.log("[F] v3.1.0 — 유저 지시 13건 정적 검사");
{
  const ws = readFileSync(new URL("../src/game/scenes/WorldScene.ts", import.meta.url), "utf8");
  const data = readFileSync(new URL("../src/game/data.ts", import.meta.url), "utf8");
  const stages = readFileSync(new URL("../src/game/stages.ts", import.meta.url), "utf8");
  const panels = readFileSync(new URL("../src/components/game/Panels.tsx", import.meta.url), "utf8");
  const audio = readFileSync(new URL("../src/game/audio.ts", import.meta.url), "utf8");
  const hud = readFileSync(new URL("../src/components/game/HUD.tsx", import.meta.url), "utf8");
  const player = readFileSync(new URL("../src/game/entities/Player.ts", import.meta.url), "utf8");

  /* #3 — BGM/SFX 분리 볼륨 UI */
  ok(/export function setBgmVolume/.test(audio) && /export function setSfxVolume/.test(audio), "audio.ts — BGM/SFX 볼륨 API");
  ok(/VolumeSliders/.test(panels) && /setBgmVolume\(v \/ 100\)/.test(panels) && /setSfxVolume\(v \/ 100\)/.test(panels), "설정 창 — 볼륨 슬라이더 UI 연결");
  ok(/SFX_VOLUME_DEFAULT = 0\.62/.test(audio), "효과음 기본 게인 하향 (0.62)");
  ok(/audio\.loadVolumes\(\)/.test(readFileSync(new URL("../src/components/game/GameRoot.tsx", import.meta.url), import.meta.url ? "utf8" : "utf8")), "부팅 시 저장된 볼륨 복원");

  /* #4 — 퀘스트 창 수동 접기만 (자동 접힘 없음) */
  ok(!/sertz\.trackerOpen/.test(ws), "씬이 퀘스트 트래커 상태를 강제하지 않음");
  ok(/sertz\.trackerOpen/.test(hud) && /toggleTracker/.test(hud), "트래커 토글은 HUD(사용자) 전용");

  /* #5/#13 — 전직 스토리 선행 */
  ok(/startJobStory\(fam: FamilyKey, tier: 1 \| 2 \| 3\)/.test(ws), "전직 시련 스토리 시작 API");
  ok(/시련 완료 후 전직 적용/.test(ws) && /finTier === 1 && !this\.player\.cls && this\.pendingJobClass/.test(ws), "1차 전직은 시련 완료 후 적용");
  ok(/chainOf\(this\.player\.cls\)\.length === 0\)[\s\S]{0,1200}startJobStory\(fam, 1\)/.test(ws), "미전직 계열 선택 → 시련 시작 (즉시 전직 아님)");
  ok(/jobStoryDone\.includes\(\(tier \+ 1\) as 2 \| 3\)/.test(ws), "2/3차 승격 = 다음 차수 시련 완료 조건");

  /* #6 — 판매 수량 + MAX */
  ok(/function SellQtyBox/.test(panels) && /MAX/.test(panels), "판매 수량 입력 + MAX 버튼");
  ok(/sell\(key: ItemKey, qty = 1\): number/.test(player), "Player.sell 수량 판매");
  ok(/sellPotion\([\s\S]{0,200}qty = 1/.test(player), "Player.sellPotion 수량 판매");

  /* #7 — 능대 명칭 */
  ok(/name: "능대"/.test(stages), "ENEMIES — 늪 몬스터 '능대' 명칭");
  ok(!/식인초/.test(stages.replace(/\/\*[\s\S]*?\*\//g, "").replace(/v2\.6[^\n]*\n/g, "")), "stages.ts — 식인초 잔여 표기 없음");
  ok(!/식인초/.test(data), "data.ts — 대사 포함 식인초 잔여 없음");

  /* #8 — 흑화 수정 */
  ok(/private transitioning = false/.test(ws) && /gotoStage\(next: StageKey/.test(ws), "구역 전환 공통 게이트 (이중 restart 차단)");
  ok(/fadeIn\(350, 0, 0, 0\)/.test(ws) && /fadeEffect\?\.isRunning\) cam\.fadeEffect\.stop\(\)/.test(ws), "구역 진입 fadeIn + 페이드 워치독");

  /* #9 — 스토리 보스 전용 난이도 */
  ok(/BOSS_DIFFS\.normal\.hp = 1\.5|normal: \{ key: "normal"[^\n]*hp: 1\.5/.test(stages), "스토리 보스 전용 기준 — 노말 상향치");

  /* #10 — 시련 리스폰 차단 */
  ok(/ref === this\.jobTrialEnemy\)[\s\S]{0,200}재소환 금지[\s\S]{0,60}\} else \{[\s\S]{0,200}respawnEnemy/.test(ws), "시험 상대 리스폰 차단");

  /* #12 — 최적화 */
  ok(/emitHud\(\) \{[\s\S]{0,240}lastHudEmit/.test(ws), "HUD 브로드캐스트 스로틀");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
