// node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs tests/story-progression.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { STAGES, NEXT_STAGE, PREV_STAGE, STAGE_THEME, STORY_SEQUENCE, resolveStage } from '../src/game/stages.ts';
const modulePath = new URL('../src/game/storyProgression.ts',import.meta.url);
assert.ok(fs.existsSync(modulePath),'separate story progression contract required');
const progress = await import(modulePath.href);
const { YOUNG_PRINCESS_VILLAGE, storyPortalDestination, storyEntryAllowed, MIDDLE_CHAPTER_IMPLEMENTED } = progress;
const howlrstone = STORY_SEQUENCE.find(s => s.id === 'howlrstone');
assert.equal(MIDDLE_CHAPTER_IMPLEMENTED, howlrstone.status !== 'not-implemented','잠금은 영프 편 구현 여부 데이터에서만 파생');
const base={cleared:false,youngPrincessCleared:false};
assert.equal(storyPortalDestination('village',base),null);
assert.equal(storyPortalDestination('village',{...base,cleared:true}),YOUNG_PRINCESS_VILLAGE);
assert.equal(storyPortalDestination('village',{cleared:true,youngPrincessCleared:true}),YOUNG_PRINCESS_VILLAGE,'base town never skips directly to Grand Planet');
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
assert.equal(storyEntryAllowed(YOUNG_PRINCESS_VILLAGE,base),false);
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
assert.deepEqual(events,[YOUNG_PRINCESS_VILLAGE],'real base portal enters young princess');
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
console.log(`ALL CHECKS PASS: base ending → young princess start; Grand Planet gate follows MIDDLE_CHAPTER_IMPLEMENTED=${MIDDLE_CHAPTER_IMPLEMENTED}; base-clear requirement enforced`);
