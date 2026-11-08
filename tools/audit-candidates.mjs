/* 개편 후보 20개를 정확히 감사한다 (4차 — 앞선 3번은 오탐이 있었다).
 * 이번엔 각 항목의 **실제 구현 파일·줄**을 함께 출력해 눈으로 검증할 수 있게 한다. */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const FILES = [];
function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f);
    else if (/\.(ts|tsx)$/.test(e.name)) FILES.push([f, readFileSync(f, "utf8").replace(/\r/g, "")]);
  }
}
walk("src");

/** 정규식에 맞는 첫 위치를 파일:줄 로 돌려준다. */
function find(re) {
  for (const [f, t] of FILES) {
    const lines = t.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) return `${path.basename(f)}:${i + 1}`;
    }
  }
  return null;
}

/* 항목 / 검색식 / 기대 근거 */
const ITEMS = [
  ["일격 방향 표시기", /Graphics\(\)\.setDepth\(8800\)|ang - 0\.42/, "Player.takeDamage 피격 호"],
  ["연속 처치 콤보 배너", /combo\?:\s*\{ n: number/, "HudState.combo"],
  ["스킬별 화면 흔들림 강도", /shakeScale|impactFX\.shake\(/, "shake() 호출"],
  ["보스 페이즈 전환 연출", /phaseBanner|— \$\{canonForm\}|phaseChange/, "onPhaseChange"],
  ["침묵 전용 사운드", /sfxSilence|silence.*sfx/i, "(없어도 무방)"],
  ["처치 시 콤보 획득", /comboStreak = nowMs < this\.comboUntil/, "WorldScene 콤보 누적"],
  ["데미지 숫자 크기 차등", /tierScale = 1\.32|ratio >= 3\) \{/, "WorldScene.spawnDamageText 배율별 색/크기"],
  ["침묵 전용 사운드", /sfxHurt\(\)|sfxSkill\(/, "기존 사운드 재사용(전용 없음 — 의도적)"],
  ["상태이상 HUD 아이콘", /hud\.dots\.map/, "HUD dots 렌더"],
  ["스킬 쿨다운 초 표시", /Math\.ceil\(\(\(cdMax/, "SkillButton"],
  ["미니맵 퀘스트 마커", /퀘스트 목표 \(금색\)|fillCircle\(mx\(t\.x\)/, "WorldScene 미니맵"],
  ["현재 버프/디버프 남은 시간 바", /buff\.remain|remain \/ d\.total/, "HUD 버프 바"],
  ["상점 다중 구매", /\+10|onChange\(Math\.min\(99/, "QtyStepper"],
  ["인벤 정렬·필터", /invSort|sortMode|정렬/, "인벤 UI"],
  ["스킬 프리셋 2~3개", /SKILL_PRESET_LABELS|keyMapForPreset/, "keymap.ts (vc288)"],
  ["자동 물약 임계 슬라이더", /autoPotion|autoHealPct/, "자동 물약"],
  ["퀘스트 자동 추적", /autoTrack|questTrack/, "퀘스트 추적"],
  ["일일 보스", /dailyBoss|DAILY_BOSS/, "일일 보스"],
  ["무한 탑", /TOWER|towerFloor/, "무한 탑"],
  ["협동 레이드", /raid|RAID/, "레이드"],
  ["코스튬 수집", /COSMETIC_DEFS/, "코스튬"],
  ["업적 시스템", /achievement|ACHIEVEMENT/, "업적"],
];

let missing = [];
for (const [name, re, why] of ITEMS) {
  const hit = find(re);
  if (hit) console.log(`OK    ${name.padEnd(26)} ${hit}`);
  else {
    console.log(`MISS  ${name.padEnd(26)} (${why})`);
    missing.push(name);
  }
}
console.log(`\n미구현 ${missing.length}/${ITEMS.length}`);
if (missing.length) console.log(missing.join("\n"));
