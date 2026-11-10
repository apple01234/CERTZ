import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { CUTSCENE_CAST, CAST_FRAME_NAMES, castPortrait, castTexture, cutsceneCharacter } from '../src/game/cutsceneCast.ts';
import { LILAC_SCENARIOS } from '../src/game/lilacScenarios.ts';
import { CHAPTER_INTROS, STAGE_INTROS } from '../src/game/storyCutscenes.ts';
import { BOSS_DEFS, DIALOGUES } from '../src/game/data.ts';
import { pythonBin, pythonEnv } from './python.mjs';

const root = new URL('../', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');

test('every speaking cutscene character has one portrait-matched identity and a real on-stage actor', () => {
  const used = new Set();
  const aliases = new Set();
  for (const c of CUTSCENE_CAST) {
    for (const name of [c.id, c.name, ...c.aliases]) {
      assert.ok(!aliases.has(name), `duplicate identity: ${name}`); aliases.add(name);
      assert.equal(cutsceneCharacter(name)?.id, c.id);
    }
    assert.ok(fs.existsSync(new URL(`public${castPortrait(c.id)}`, root)), c.id);
  }
  for (const scenario of Object.values(LILAC_SCENARIOS)) {
    const live = new Map();
    for (const step of scenario.steps) {
      if (step.t === 'enter') {
        const c = cutsceneCharacter(step.actor.character);
        assert.ok(c, `${scenario.id}: unknown actor`);
        assert.equal(step.actor.tex, castTexture(c.id));
        live.set(step.id, c.id); used.add(c.id);
      }
      if (step.t === 'exit') live.delete(step.id);
      if (step.t === 'say') {
        const c = cutsceneCharacter(step.speaker);
        assert.ok(c, `${scenario.id}: missing speaker ${step.speaker}`);
        if (!step.speaker.includes('회상')) assert.equal(live.get(step.actor), c.id, `${scenario.id}: wrong or absent speaker body`);
      }
      if (step.t === 'pose') assert.ok(live.has(step.id), `${scenario.id}: posing an absent actor`);
    }
    assert.equal(live.size, 0, `${scenario.id}: leaked cast`);
  }
  for (const spec of Object.values({ ...CHAPTER_INTROS, ...STAGE_INTROS })) {
    for (const shot of spec.shots) if (shot.dialogue) {
      const c = cutsceneCharacter(DIALOGUES[shot.dialogue]?.speaker);
      assert.ok(c, `chapter shot ${shot.dialogue}: no atlas`); used.add(c.id);
    }
  }
  for (const boss of Object.values(BOSS_DEFS)) if (DIALOGUES[boss.introDialogue]) {
    const c = cutsceneCharacter(DIALOGUES[boss.introDialogue].speaker);
    if (!c && boss.tex.startsWith('story_')) {
      assert.ok(fs.existsSync(new URL(`public/assets/story-bosses/${boss.tex.slice(6)}.json`, root))); continue;
    }
    assert.ok(c, `${boss.introDialogue}: missing boss/guide actor`); used.add(c.id);
  }
  assert.match(read('src/game/entities/StoryBossMechanics.ts'), /"cast_dean"/);
  used.add('dean'); // Actual two-caster companion, not a second name for Veronica.
  assert.deepEqual([...used].sort(), CUTSCENE_CAST.map((c) => c.id).sort(), 'no generated atlas is left unconnected');
});

test('all character frames are present, transparent, unclipped and contain actual distinct animation poses', () => {
  const inspect = `
import json, hashlib
from pathlib import Path
from PIL import Image
base=Path('public/assets/cutscene-cast')
spec=json.loads((base/'manifest.json').read_text())
for c in spec['characters']:
 im=Image.open(base/(c['id']+'.png'))
 assert im.mode=='RGBA' and im.size==(384,384),c['id']
 atlas=json.loads((base/(c['id']+'.json')).read_text())
 assert len(atlas['frames'])==16 and len(atlas['meta']['sourceSHA256'])==64,c['id']
 hashes={}
 for name,d in atlas['frames'].items():
  b=d['frame']; assert b['w']==96 and b['h']==96
  frame=im.crop((b['x'],b['y'],b['x']+96,b['y']+96)); alpha=frame.getchannel('A'); bounds=alpha.getbbox()
  assert bounds and bounds[0]>0 and bounds[1]>0 and bounds[2]<96 and bounds[3]<=90,(c['id'],name,bounds)
  assert alpha.getpixel((0,0))==0
  hashes[name]=hashlib.sha256(frame.tobytes()).hexdigest()
 for direction in ['down','side','up']:
  assert len({hashes['idle-'+direction+'-0'],hashes['walk-'+direction+'-0'],hashes['walk-'+direction+'-1']})==3,(c['id'],direction)
 assert len({hashes['talk'],hashes['reach'],hashes['hurt'],hashes['ready']})==4,c['id']
 p=Image.open(base/'portraits'/(c['id']+'.png')); assert p.mode=='RGBA' and p.size==(84,84)
print(str(len(spec['characters']) * 16)+' valid frames')
`;
  const output = execFileSync(pythonBin(), ['-c', inspect], { cwd: new URL('../', import.meta.url), env: pythonEnv, encoding: 'utf8' });
  assert.match(output, new RegExp(`${CUTSCENE_CAST.length * 16} valid frames`));
  for (const c of CUTSCENE_CAST) {
    const atlas = JSON.parse(read(`public/assets/cutscene-cast/${c.id}.json`));
    assert.deepEqual(Object.keys(atlas.frames), [...CAST_FRAME_NAMES]);
  }
});

test('canon fixes: women and weapons, relationship, injury, pendant and the actual discoverer of Ether', () => {
  assert.equal(cutsceneCharacter('도사'), cutsceneCharacter('리엘'));
  assert.equal(cutsceneCharacter('아리스텔라'), cutsceneCharacter('아리'));
  assert.notEqual(cutsceneCharacter('라일락 연합의 기록자'), cutsceneCharacter('라일락'));
  const says = (id) => LILAC_SCENARIOS[id].steps.filter((s) => s.t === 'say');
  assert.ok(says('lilac08').some((s) => s.lines.some((l) => l.includes('페르온의 연인'))));
  assert.ok(!says('lilac08').some((s) => s.lines.some((l) => l.includes('네 연인'))));
  assert.ok(says('lilac14').filter((s) => s.lines.some((l) => l.includes('에테르'))).every((s) => s.speaker === '하루'));
  assert.ok(LILAC_SCENARIOS.lilac06.steps.some((s) => s.t === 'pose' && s.pose === 'hurt'));
  assert.ok(LILAC_SCENARIOS.lilac00.steps.some((s) => s.t === 'pose' && s.pose === 'reach'));
  for (const s of Object.values(LILAC_SCENARIOS).filter((s) => Number(s.id.slice(5)) >= 2)) {
    assert.ok(!s.steps.some((step) => step.t === 'enter' && step.actor.character === 'lilac'), 'no resurrected Lilac in the alliance');
  }
  const poses = read('src/game/fx/cutsceneActors.ts');
  for (const name of ['idle-side', 'idle-up', 'walk-side', 'walk-up', 'talk', 'hurt', 'ready']) assert.ok(poses.includes(name));
});
