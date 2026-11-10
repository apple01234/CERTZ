import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CHAPTERS,STAGES,NEXT_STAGE,STORY_SEQUENCE,resolveStage} from '../src/game/stages.ts';
import {DIALOGUES} from '../src/game/data.ts';
import {storyPortalDestination,storyEntryAllowed} from '../src/game/storyProgression.ts';

/* vc251 — 수련 원정 9지역(forest/kingdom/alfheim/muspelheim/niflheim/cave/nidavellir/hel/abyss)
 *  완전 삭제. 종전 이 테스트는 `TRAINING_REGIONS` 가 존재하고 9지역 스테이지가 살아 있는 것을
 *  "계약"으로 강제했다. 이제 계약이 뒤집혔다 — 삭제된 상태를 고정한다. */
const REMOVED = ['forest','kingdom','alfheim','muspelheim','niflheim','cave','nidavellir','hel','abyss'];

test('9개 수련 지역은 완전히 삭제됐다',()=>{
  /* ① CHAPTERS 에 없다 */
  for(const key of REMOVED){
    assert.equal(CHAPTERS.find(c=>c.key===key),undefined,`CHAPTERS 에 ${key} 가 남아 있다`);
  }
  /* ② STAGES 에 지역 스테이지가 없다 (1~10 + 마을) */
  for(const key of REMOVED){
    for(let sub=1;sub<=10;sub++) assert.equal(STAGES[`${key}${sub}`],undefined,`STAGES.${key}${sub} 가 남아 있다`);
    assert.equal(STAGES[`${key}v`],undefined,`STAGES.${key}v 가 남아 있다`);
  }
  /* ③ 모듈 자체가 삭제됐다 */
  assert.equal(fs.existsSync(new URL('../src/game/trainingRegions.ts',import.meta.url)),false,'trainingRegions.ts 가 남아 있다');
  /* ④ 삭제 지역 워크라인 대사도 없다 */
  for(const key of REMOVED) assert.equal(DIALOGUES[key],undefined,`DIALOGUES.${key} 가 남아 있다`);
});

test('구 세이브의 삭제 지역 키는 village 로 폴백한다',()=>{
  /* `forest3` 같은 지역명+번호 키 — 계단 없이 최종 폴백으로 떨어진다 */
  for(const key of REMOVED){
    assert.equal(resolveStage(key),'village',`${key} 폴백 실패`);
    assert.equal(resolveStage(`${key}1`),'village',`${key}1 폴백 실패`);
  }
  /* 정상 키는 그대로 유지된다 */
  assert.equal(resolveStage('village'),'village');
  assert.equal(resolveStage('howlrstone1x1'),'howlrstone1x1');
  assert.equal(resolveStage('dlcstargate1'),'dlcstargate1');
});

test('진행 경로는 village → howlrstone1x1 → … → dlcstargate1 로 이어진다',()=>{
  const progress={cleared:false,youngPrincessCleared:false};
  /* 유저 지시 — 애델리오나 마을 다음은 별도 시작 마을이 아니라 1-1 스테이지다. */
  assert.equal(storyPortalDestination('village',progress),'howlrstone1x1');
  assert.equal(storyEntryAllowed('youngprincessv',progress),true);
  assert.equal(storyEntryAllowed('dlcstargate1',{cleared:true}),false);
  assert.equal(storyEntryAllowed('dlcstargate1',{youngPrincessCleared:true}),true);
  /* 마을에서 DLC 진입까지 삭제 지역을 거치지 않는다 */
  let stage='village';const visited=new Set();
  while(stage&&!visited.has(stage)&&stage!=='dlcstargate1'){
    visited.add(stage);
    for(const key of REMOVED) assert.ok(!stage.startsWith(key),`경로에 삭제 지역 ${stage} 가 남아 있다`);
    stage=NEXT_STAGE[stage];
  }
  assert.equal(stage,'dlcstargate1');
  assert.ok(!STORY_SEQUENCE.some(s=>s.id==='atlantis'));
});

test('runtime dialogue and UI cannot resurrect removed story branding',()=>{
  const forbidden=/이그드라실|아뜰란티스|아틀란티스|9개의 바다|아홉 바다|아홉 개의 바다/;
  assert.doesNotMatch(JSON.stringify(DIALOGUES),forbidden);
  for(const file of ['src/components/game/Overlays.tsx','src/game/scenes/BootScene.ts','src/game/scenes/WorldScene.ts']){
    assert.doesNotMatch(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),forbidden);
  }
  const root=fs.readFileSync(new URL('../src/app/page.tsx',import.meta.url),'utf8');
  assert.ok(root.includes('@/components/game/GameRoot'));
  assert.ok(!root.includes('CampaignRoot'));
});

/* 앱 셸(창 제목·EXE 메타데이터·크레딧)은 테스트 대상 UI 밖이라 위 검사에서 빠져 있었다.
 * 옛 서사가 다시 새어 들어오지 않도록 배포 산출물에 직접 들어가는 파일을 따로 잠근다. */
test('app shell and shipped docs carry no removed story branding',()=>{
  const forbidden=/이그드라실|아뜰란티스|아틀란티스|9개의 바다|아홉 바다|아홉 개의 바다|세계수/;
  for(const file of ['electron/main.js','public/assets/CREDITS.md','src/game/data.ts']){
    assert.doesNotMatch(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),forbidden,`${file} 에 옛 서사 표기가 남아 있다`);
  }
  /* 옛 서사 자막 원본이 리포지토리에 다시 커밋되지 않게 한다. */
  const root=fs.readFileSync(new URL('../package.json',import.meta.url),'utf8');
  assert.ok(!root.includes('atlantis'));
});
