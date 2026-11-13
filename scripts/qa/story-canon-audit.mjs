/* Story canon audit — dumps chapter plan + beats + quests + dialogue presence as JSON. */
import { HOWLRSTONE_CHAPTERS } from '../../src/game/howlrstone.ts';
import { CHAPTER_STORY_PLAN } from '../../src/game/chapterStoryPlan.ts';
import { DIALOGUES } from '../../src/game/data.ts';
import { CHAPTERS } from '../../src/game/stages.ts';

const out = { howlrstone: [], main: [] };

for (const ch of HOWLRSTONE_CHAPTERS) {
  const plan = CHAPTER_STORY_PLAN[ch.key];
  out.howlrstone.push({
    key: ch.key,
    episodes: ch.episodes,
    planTitle: plan?.title ?? null,
    canon: plan?.canon ?? null,
    planBoss: plan ? ([...plan.places].reverse().find(p => p.boss)?.boss ?? null) : null,
    boss: ch.boss,
    places: plan?.places.map(p => `${p.title}(${p.role}${p.boss ? ':' + p.boss : ''})`) ?? [],
    stages: ch.stages,
    beats: ch.beats.map(b => ({
      sub: b.sub,
      dialogue: b.dialogue || null,
      dialogueExists: b.dialogue ? !!DIALOGUES[b.dialogue] : null,
      quest: b.quest ? { id: b.quest.id, type: b.quest.type, title: b.quest.title } : null,
    })),
    intro: ch.intro,
    introExists: !!DIALOGUES[ch.intro],
    bossDone: ch.bossDone,
    bossDoneExists: !!DIALOGUES[ch.bossDone],
  });
}

for (const ch of CHAPTERS) {
  const plan = CHAPTER_STORY_PLAN[ch.key];
  out.main.push({
    key: ch.key, title: ch.title, episodes: ch.episodes, stages: ch.stages,
    planTitle: plan?.title ?? null, canon: plan?.canon ?? null,
    boss: ch.boss, planBoss: plan ? ([...plan.places].reverse().find(p => p.boss)?.boss ?? null) : null,
    beats: ch.beats.map(b => ({ sub: b.sub, dialogue: b.dialogue || null, dialogueExists: b.dialogue ? !!DIALOGUES[b.dialogue] : null, quest: b.quest ? { id: b.quest.id, type: b.quest.type, title: b.quest.title } : null })),
  });
}

console.log(JSON.stringify(out, null, 1));
