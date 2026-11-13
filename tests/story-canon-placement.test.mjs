// node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs tests/story-canon-placement.test.mjs
//
// 정본 배치 계약 — vc286
//
// [왜 필요한가]
//  실제로 두 가지 결함이 있었다.
//   ① `data.ts` 의 루프가 15장 인트로/완료 대사를 템플릿 2줄로 **덮어썼다**.
//      표에 정본을 옮겨 적어도 화면에는 "${장 제목} / …에서 이야기가 이어진다." 만 나왔다.
//   ② 1~5장 인트로/완료 문구가 **옛 5챕터(3화 묶음) 체계** 기준으로 배치돼 있었다.
//      예: 4장 인트로가 10장의 "4개의 문", 5장 인트로가 14장의 "시간의 초월자".
//  둘 다 타입 검사로는 안 잡힌다(문자열). 그래서 데이터 계약으로 고정한다.
//
// [규칙] 앞 문서가 우선한다(AGENTS.md · 240 지시서 181·182).
//  1.txt(하루 개정판) > 2.txt(비트표) > 5.txt·8.txt(옛 정리본).
//  따라서 2장의 사건은 1.txt 소재여야 하고, 5.txt 의 '왕립도서관에서 떨어진 책'은
//  1장에 오면 안 된다(1장은 절벽·라일락·펜던트).
import test from 'node:test';
import assert from 'node:assert/strict';
import { DIALOGUES } from '../src/game/data.ts';
import { HOWLRSTONE_CHAPTERS } from '../src/game/howlrstone.ts';
import { CHAPTER_STORY_PLAN } from '../src/game/chapterStoryPlan.ts';

let checks = 0;
const ok = (name, cond) => { assert.ok(cond, `✗ ${name}`); checks++; };
const textOf = (key) => (DIALOGUES[key]?.lines ?? []).join(' ');
const chapterIntro = (n) => textOf(`chapterIntroHowlrstone${n}`);
const chapterDone = (n) => textOf(`howlrstone${n}Done`);

test('챕터 인트로/완료 대사가 템플릿으로 덮이지 않는다', () => {
  for (const spec of HOWLRSTONE_CHAPTERS) {
    const n = spec.key.slice('howlrstone'.length);
    for (const [label, key] of [['인트로', spec.intro], ['완료', spec.bossDone]]) {
      const text = textOf(key);
      ok(`${spec.key} ${label}: 존재`, !!DIALOGUES[key]);
      ok(`${spec.key} ${label}: 템플릿 문구 아님`, !text.includes('에서 이야기가 이어진다'));
      ok(`${spec.key} ${label}: 템플릿 문구 아님(완료)`, !text.includes('의 이야기를 기록했다'));
      /* 자동 생성문은 "장 제목 한 줄 + 안내 한 줄" 형태였다. 장 제목이 대사 첫 줄로
       *  그대로 반복되면 템플릿이 되살아난 것이다(제목은 UI가 이미 보여준다). */
      ok(`${spec.key} ${label}: 장 제목을 대사로 반복하지 않음`, DIALOGUES[key]?.lines[0] !== CHAPTER_STORY_PLAN[spec.key]?.title);
    }
  }
});

test('1장(1.txt:4-34) — 절벽 · 라일락 · 펜던트 소재다', () => {
  const intro = chapterIntro(1) + ' ' + chapterDone(1);
  ok('1장: 절벽 언급', intro.includes('절벽'));
  ok('1장: 디오 언급', intro.includes('디오'));
  ok('1장: 라일락 언급', intro.includes('라일락'));
  ok('1장: 펜던트 언급', intro.includes('펜던트'));
  /* 5.txt(뒤 문서)의 '왕립도서관에서 떨어진 책'을 1장에 앞세우지 않는다. */
  ok('1장: 정리서(뒤 문서 소재) 없음', !intro.includes('정리서'));
  ok('1장: 왕립도서관 없음', !intro.includes('왕립도서관'));
});

test('2장(1.txt:62-174) — 사념체 · 레지스터 · 데스크니스 소재다', () => {
  const spec = HOWLRSTONE_CHAPTERS.find((c) => c.key === 'howlrstone2');
  const intro = chapterIntro(2) + ' ' + chapterDone(2) + ' ' + (spec?.beats ?? []).map((b) => textOf(b.dialogue)).join(' ');
  ok('2장: 사념체 언급', intro.includes('사념체'));
  ok('2장: 레지스터 또는 시스터즈 언급', intro.includes('레지스터') || intro.includes('시스터즈'));
  ok('2장: 에스테반 왕국(2화) 소재 없음', !intro.includes('에스테반'));
});

test('옛 5챕터 체계의 문구가 해당 장에만 있다', () => {
  /* 5.txt 3화의 크라켄/해롤드는 5장(남부의 해전) 소재다 — 1장 완료에 있으면 안 된다. */
  ok('1장 완료: 크라켄 없음', !chapterDone(1).includes('크라켄'));
  ok('1장 완료: 해롤드 없음', !chapterDone(1).includes('해롤드'));
  ok('5장 인트로: 해전 소재', chapterIntro(5).includes('사흘') || chapterIntro(5).includes('나팔'));
  /* 2.txt의 "4개의 문"은 10장 소재다 — 4장 인트로에 오면 안 된다. */
  ok('4장 인트로: 4개의 문 없음', !chapterIntro(4).includes('4개의 문'));
  ok('4장 인트로: 아리 소재', chapterIntro(4).includes('아리스텔라') || chapterIntro(4).includes('근위대장'));
  /* "시간의 초월자"는 14장 소재다 — 5장 인트로에 오면 안 된다. */
  ok('5장 인트로: 시간의 초월자 없음', !chapterIntro(5).includes('시간의 초월자'));
});

test('퀘스트 진행형이 실제로 완료 가능한 형태다', () => {
  /* collect 퀘스트는 수집 오브젝트가 스테이지에 있어야 완료된다. 스토리 비트로
   *  "책 페이지를 모아라"처럼 대상이 없는 collect 를 두면 진행이 막힌다. */
  for (const spec of HOWLRSTONE_CHAPTERS) {
    for (const beat of spec.beats) {
      if (beat.quest?.type !== 'collect') continue;
      ok(`${spec.key} ${beat.quest.id}: collect 는 targetLabel 필수`, !!beat.quest.targetLabel);
    }
  }
  /* 1장은 도달(reach) + 사냥(hunt) 으로 정본 사건을 표현한다. */
  const ch1 = HOWLRSTONE_CHAPTERS.find((c) => c.key === 'howlrstone1');
  ok('1장: 비트 2개', (ch1?.beats.length ?? 0) === 2);
  ok('1장: collect 없음', !(ch1?.beats ?? []).some((b) => b.quest?.type === 'collect'));
});

test('보스가 있는 장은 다음 장소로 가는 reach 퀘스트를 자동 주입받는다', () => {
  /* stages.ts 생성기가 보스 스테이지에 boss+reach 를 넣는다. beat 에 reach 를 또 두면
   *  퀘스트 인덱스가 어긋나므로, 보스 장의 비트에는 reach 를 두지 않는다. */
  for (const spec of HOWLRSTONE_CHAPTERS) {
    if (!spec.boss) continue;
    ok(`${spec.key}: 보스 장 비트에 reach 없음`, !spec.beats.some((b) => b.quest?.type === 'reach'));
  }
});

console.log(`ALL CHECKS PASS: story canon placement — ${checks} checks`);
