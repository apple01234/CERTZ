// node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs tests/story-progression.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { STAGES, NEXT_STAGE, PREV_STAGE, STAGE_THEME, STORY_SEQUENCE, resolveStage } from '../src/game/stages.ts';
import { HOWLRSTONE_ENTRY } from '../src/game/howlrstone.ts';
const modulePath = new URL('../src/game/storyProgression.ts',import.meta.url);
assert.ok(fs.existsSync(modulePath),'separate story progression contract required');
const progress = await import(modulePath.href);
const { YOUNG_PRINCESS_VILLAGE, storyPortalDestination, storyEntryAllowed, MIDDLE_CHAPTER_IMPLEMENTED } = progress;
const howlrstone = STORY_SEQUENCE.find(s => s.id === 'howlrstone');
assert.equal(MIDDLE_CHAPTER_IMPLEMENTED, howlrstone.status !== 'not-implemented','잠금은 영프 편 구현 여부 데이터에서만 파생');
const base={cleared:false,youngPrincessCleared:false};
/* 유저 지시 — 애델리오나 마을 → 1-1 스테이지 직행 (별도 시작 마을 경유 없음) */
assert.equal(storyPortalDestination('village',base),HOWLRSTONE_ENTRY,'new story is available without the removed campaign');
assert.equal(storyPortalDestination('village',{...base,cleared:true}),HOWLRSTONE_ENTRY);
assert.equal(storyPortalDestination('village',{cleared:true,youngPrincessCleared:true}),HOWLRSTONE_ENTRY,'base town never skips directly to Grand Planet');
assert.equal(storyPortalDestination(YOUNG_PRINCESS_VILLAGE,{...base,cleared:true}),MIDDLE_CHAPTER_IMPLEMENTED?null:'dlcstargate1','해제 수단 없는 잠금은 그랜드 플레닛을 고립시킨다');
assert.equal(storyPortalDestination(YOUNG_PRINCESS_VILLAGE,{cleared:true,youngPrincessCleared:true}),'dlcstargate1');
assert.equal(storyPortalDestination('forestv',{cleared:true,youngPrincessCleared:true}),null,'no portal in unrelated town');
for(const stage of ['dlcstargate1','dlcstargatev','dlcsernium10']) {
 assert.equal(storyEntryAllowed(stage,base),false,'본편 미클리어 세이브는 그랜드 플레닛 진입 불가');
 assert.equal(storyEntryAllowed(stage,{cleared:true,youngPrincessCleared:true}),true);
 if (MIDDLE_CHAPTER_IMPLEMENTED) {
  assert.equal(storyEntryAllowed(stage,{cleared:true}),false,'영프 편 구현 이후에는 엔딩이 필요');
  assert.equal(storyEntryAllowed(stage,{cleared:true,dlcTalked:true}),false,'old NPC flag is not an ending');
 }
}
assert.equal(storyEntryAllowed(YOUNG_PRINCESS_VILLAGE,base),true);
assert.equal(storyEntryAllowed(YOUNG_PRINCESS_VILLAGE,{cleared:true}),true);
assert.equal(storyEntryAllowed('forest1',base),true);
assert.ok(STAGES[YOUNG_PRINCESS_VILLAGE]?.isVillage,'young princess has a real safe start village');
assert.equal(resolveStage(YOUNG_PRINCESS_VILLAGE),YOUNG_PRINCESS_VILLAGE);
assert.ok(STAGE_THEME[YOUNG_PRINCESS_VILLAGE]);
assert.ok(!NEXT_STAGE.abyss10?.startsWith('dlc'),'base ending cannot walk straight into Grand Planet');
assert.equal(PREV_STAGE.dlcstargatev,YOUNG_PRINCESS_VILLAGE,'Grand Planet return route remains in the preceding world');
const source=fs.readFileSync(new URL('../src/game/scenes/WorldScene.ts',import.meta.url),'utf8');
const ast=ts.createSourceFile('world.ts',source,ts.ScriptTarget.Latest,true);
const methods={};
function walk(n){if(ts.isMethodDeclaration(n))methods[n.name.getText(ast)]=n.getText(ast).replace(/^private\s+/,'');ts.forEachChild(n,walk);}walk(ast);
const events=[];
const context={...progress,chapterSpec:()=>({dlc:true}),notice:()=>{},audio:{sfx:{portal(){}}},writeSave(){},window:{setTimeout(){}},result:null};
vm.runInNewContext(ts.transpile(`result={${methods.isDlcPortalOpen},${methods.enterDlcGate},${methods.gotoStage}}`),context);
const world={cleared:true,youngPrincessCleared:false,isInterior:false,stageDef:{key:'village'},player:{memoSkillCooldowns(){}},transitioning:false,
 showBanner(){},startTransition(stage){events.push(stage)},isDlcPortalOpen:context.result.isDlcPortalOpen,scene:{restart(v){events.push(v.stage)}},buildSave(){return {}}};
context.result.enterDlcGate.call(world);
/* 유저 지시 — 베이스 마을 포탈은 별도 시작 마을을 거치지 않고 1-1 로 직행한다 */
assert.deepEqual(events,[HOWLRSTONE_ENTRY],'real base portal enters howlrstone 1-1');
events.length=0;world.stageDef.key=YOUNG_PRINCESS_VILLAGE;
context.result.enterDlcGate.call(world);
if (MIDDLE_CHAPTER_IMPLEMENTED) assert.equal(events.length,0,'young princess portal stays closed before its ending');
else assert.deepEqual(events,['dlcstargate1'],'미구현 상태에서는 경유지로 통과');
events.length=0;
world.youngPrincessCleared=true;
context.result.enterDlcGate.call(world);assert.deepEqual(events,['dlcstargate1']);
events.length=0;world.youngPrincessCleared=false;world.cleared=false;
context.result.gotoStage.call(world,'dlcsernium10');assert.equal(events.length,0,'본편 미클리어 상태의 직접 진입 차단');
assert.ok(source.includes('youngPrincessCleared: this.youngPrincessCleared'),'ending flag serialized');
assert.ok(source.includes('this.youngPrincessCleared = savedPlayer.youngPrincessCleared ?? false'),'missing legacy flag restores false');
assert.equal(storyEntryAllowed('dlcstargate1',{cleared:false,youngPrincessCleared:true}),true,'only the retained story ending gates Grand Planet');
/* 유저 지시 — 애델리오나 마을 → 1-1 스테이지 직행 (youngprincessv 경유 제거) */
assert.equal(NEXT_STAGE.village,HOWLRSTONE_ENTRY);
assert.ok(!('abyss10' in NEXT_STAGE),'vc251 — 삭제된 수련 지역 스테이지가 진행 체인에 남아 있으면 안 된다');
console.log('PASS: direct Lilac entry; Grand Planet requires Lilac ending; training is optional');
