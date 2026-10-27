// DLC 입구 검증 — NPC 대화 → 마을 포탈 → DLC 챕터 연결이 코드에 실제로 있는지
const fs = require('fs');
const ws = fs.readFileSync('src/game/scenes/WorldScene.ts', 'utf8');
const data = fs.readFileSync('src/game/data.ts', 'utf8');
const stages = fs.readFileSync('src/game/stages.ts', 'utf8');
const cfg = fs.readFileSync('src/game/config.ts', 'utf8');

const checks = [
  ['SaveData.dlcTalked 필드',            cfg.includes('dlcTalked?: boolean')],
  ['씬 dlcTalked 필드',                  /dlcTalked = false/.test(ws)],
  ['세이브 복원',                        /this\.dlcTalked = savedPlayer\.dlcTalked/.test(ws)],
  ['세이브 기록',                        /dlcTalked: this\.dlcTalked/.test(ws)],
  ['개방 조건(isDlcPortalOpen)',         /isDlcPortalOpen\(\)/.test(ws) && /this\.cleared && this\.dlcTalked/.test(ws)],
  ['포탈 생성(spawnDlcPortal)',          /private spawnDlcPortal\(\)/.test(ws)],
  ['마을 빌드에서 호출',                 /if \(this\.isDlcPortalOpen\(\)\) this\.spawnDlcPortal\(\)/.test(ws)],
  ['대화 종료 후 개방(resumeFromDialogue)', /this\.cleared && !this\.dlcTalked/.test(ws)],
  ['DLC 대사 데이터(dlcVillage)',        data.includes('dlcVillage:')],
  ['구원 후 NPC 대사 전환',              /this\.cleared \? "dlcVillage" : "villager1"/.test(ws)],
  ['interactables 타입에 dlcgate',       /"decor" \| "dlcgate"/.test(ws)],
  ['dlcgate 상호작용 처리',              /it\.kind === "dlcgate"/.test(ws)],
  ['enterDlcGate → 첫 DLC 챕터',         /startTransition\("dlcstargate1"/.test(ws)],
  ['dlcstargate1 스테이지 생성 가능',    /dlcstargate/.test(stages)],
  ['DLC 잠금 게이트(gotoStage)',         /spec\?\.dlc && !this\.cleared/.test(ws)],
];

let fail = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? '  OK  ' : ' FAIL '} ${name}`);
  if (!ok) fail++;
}

// DLC 챕터 3종이 실제로 정의돼 있는지
const dlcKeys = [...stages.matchAll(/key: "(dlc[a-z]+)", num: (\d+)/g)].map(m => m[1]);
console.log(`\n[DLC 챕터] ${dlcKeys.length}종: ${dlcKeys.join(', ')}`);
if (dlcKeys.length !== 3) fail++;

// 기존 9챕터 보존
const BASE = ['forest','kingdom','alfheim','muspelheim','niflheim','cave','nidavellir','hel','abyss'];
const lost = BASE.filter(k => !stages.includes(`key: "${k}", num:`));
console.log(`[기존 9챕터] 보존 ${9 - lost.length}/9${lost.length ? ' 실종: ' + lost.join(',') : ''}`);
fail += lost.length;

console.log(fail === 0 ? '\nALL CHECKS PASS' : `\nFAILURES: ${fail}`);
process.exit(fail === 0 ? 0 : 1);
