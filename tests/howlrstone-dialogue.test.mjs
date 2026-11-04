// node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs tests/howlrstone-dialogue.test.mjs
//
// 영프편 대사 계약 — vc239
//
// [왜 필요한가]
//  `howlrstone.ts` 의 beats[].dialogue / chapterSpec.bossDone 은 `DIALOGUES` 키 문자열만
//  들고 있다. 그 키가 없으면 `showDialogueOnce` 가 **조용히 false 를 돌려주고** 아무 일도
//  일어나지 않는다 — 오류도 경고도 없다. 실제로 22개 비트 키 + 15개 bossDone 키가
//  전부 비어 있어서 1기 15장 대사가 한 번도 재생되지 않았다(브라우저에서 확인).
//  타입 시스템도 이걸 못 잡는다(문자열 키). 그래서 런타임 계약으로 검사한다.
import assert from 'node:assert/strict';
import { DIALOGUES } from '../src/game/data.ts';
import { LILAC_INTROS } from '../src/game/lilacStory.ts';
import { HOWLRSTONE_CHAPTERS, HOWLRSTONE_BOSSES } from '../src/game/howlrstone.ts';

let checks = 0;
const ok = (name, cond) => { assert.ok(cond, `✗ ${name}`); checks++; };

/** 대사 엔트리가 화면에 실제로 뜰 수 있는 형태인지. */
function validEntry(key) {
  const d = DIALOGUES[key];
  ok(`${key}: DIALOGUES 에 존재`, !!d);
  if (!d) return;
  ok(`${key}: speaker 비어있지 않음`, typeof d.speaker === 'string' && d.speaker.length > 0);
  ok(`${key}: lines 배열`, Array.isArray(d.lines) && d.lines.length > 0);
  ok(`${key}: 모든 줄이 비어있지 않음`, d.lines.every((l) => typeof l === 'string' && l.trim().length > 0));
  /* 빈 대사창은 "대사가 있는데 내용이 없다"로 보인다 — 최소 길이도 본다. */
  ok(`${key}: 줄마다 2자 이상`, d.lines.every((l) => l.trim().length >= 2));
}

/* ── 1. 모든 비트 대사 키가 실존한다 ──────────────────────────────────── */
let beatCount = 0;
for (const spec of HOWLRSTONE_CHAPTERS) {
  for (const beat of spec.beats) {
    if (!beat.dialogue) continue;
    beatCount++;
    validEntry(beat.dialogue);
  }
}
ok(`비트 대사 ${beatCount}개 검사됨`, beatCount > 0);

/* ── 2. 모든 bossDone 키가 실존한다 ──────────────────────────────────── */
for (const spec of HOWLRSTONE_CHAPTERS) {
  validEntry(spec.bossDone);
}

/* ── 3. 모든 챕터 인트로 키가 실존한다 ───────────────────────────────── */
for (const spec of HOWLRSTONE_CHAPTERS) {
  validEntry(spec.intro);
}

/* ── 4. 보스 인트로 대사 ─────────────────────────────────────────────── */
for (const [key, boss] of Object.entries(HOWLRSTONE_BOSSES)) {
  ok(`보스 ${key}: introDialogue 키 정의`, typeof boss.introDialogue === 'string' && boss.introDialogue.length > 0);
  validEntry(boss.introDialogue);
}

/* ── 5. 정본 어휘 — 구조자/주인공이 뒤바뀌지 않는다 ───────────────────── */
{
  /* 인계 문서 규칙: 충돌 시 앞 문서(1.txt)가 우선이고, 구조자는 라일락(+펜던트),
   *  주인공은 하루다. 뒤 문서의 스칼렛+책 버전을 앞세우면 안 된다. */
  const beatText = HOWLRSTONE_CHAPTERS
    .flatMap((s) => s.beats.map((b) => b.dialogue))
    .filter(Boolean)
    .map((k) => (DIALOGUES[k]?.lines ?? []).join(' '))
    .join(' ');
  ok('비트 대사에 펜던트 언급', beatText.includes('펜던트'));
  ok('비트 대사에 라일락 언급', beatText.includes('라일락'));
  /* 옛 9개 바다/이그드라실 서사가 새 비트 대사에 섞이지 않았는지. */
  for (const banned of ['이그드라실', '아뜰란티스', '아틀란티스', '9개의 바다']) {
    ok(`비트 대사에 옛 서사 없음: ${banned}`, !beatText.includes(banned));
  }
}

/* ── 6. 챕터 인트로(LILAC_INTROS)가 참조하는 대사도 실존 ─────────────── */
{
  let refs = 0;
  for (const [id, spec] of Object.entries(LILAC_INTROS)) {
    for (const shot of spec.shots) {
      if (!shot.dialogue) continue;
      refs++;
      ok(`${id}: 인트로 대사 ${shot.dialogue}`, !!DIALOGUES[shot.dialogue]);
    }
  }
  ok('LILAC_INTROS 대사 참조가 존재', refs > 0);
}

console.log(`ALL CHECKS PASS: howlrstone dialogue — ${checks} checks`);
