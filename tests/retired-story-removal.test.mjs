import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CHAPTERS,STAGES,NEXT_STAGE,STORY_SEQUENCE} from '../src/game/stages.ts';
import {DIALOGUES} from '../src/game/data.ts';
import {TRAINING_REGIONS,isTrainingStage} from '../src/game/trainingRegions.ts';
import {storyPortalDestination,storyEntryAllowed} from '../src/game/storyProgression.ts';

test('removed campaign has no mandatory route or completion gate while old maps remain usable',()=>{
  const progress={cleared:false,youngPrincessCleared:false};
  assert.equal(storyPortalDestination('village',progress),'youngprincessv');
  assert.equal(storyEntryAllowed('youngprincessv',progress),true);
  assert.equal(storyEntryAllowed('dlcstargate1',{cleared:true}),false);
  assert.equal(storyEntryAllowed('dlcstargate1',{youngPrincessCleared:true}),true);
  let stage='village';const visited=new Set();
  while(stage&&!visited.has(stage)&&stage!=='dlcstargate1'){
    visited.add(stage);assert.equal(isTrainingStage(stage),false);stage=NEXT_STAGE[stage];
  }
  assert.equal(stage,'dlcstargate1');
  for(const key of Object.keys(TRAINING_REGIONS)){
    const chapter=CHAPTERS.find(c=>c.key===key);
    assert.ok(chapter);assert.deepEqual(chapter.beats,[]);
    assert.equal(chapter.intro,'trainingIntro');
    for(let sub=1;sub<=10;sub++)assert.ok(STAGES[`${key}${sub}`]);
  }
  assert.equal(NEXT_STAGE.abyss10,'village');
  assert.ok(!STORY_SEQUENCE.some(s=>s.id==='atlantis'));
});

test('runtime dialogue and UI cannot resurrect removed story branding',()=>{
  const forbidden=/이그드라실|아뜰란티스|아틀란티스|9개의 바다|세계수/;
  assert.doesNotMatch(JSON.stringify(DIALOGUES),forbidden);
  for(const file of ['src/components/game/Overlays.tsx','src/game/scenes/BootScene.ts','src/game/scenes/WorldScene.ts']){
    assert.doesNotMatch(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),forbidden);
  }
  const root=fs.readFileSync(new URL('../src/app/page.tsx',import.meta.url),'utf8');
  assert.ok(root.includes('@/components/game/GameRoot'));
  assert.ok(!root.includes('CampaignRoot'));
});
