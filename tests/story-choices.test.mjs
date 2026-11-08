/**
 * story-choices.test.mjs — vc279 P7c 스토리 선택지 계약
 *
 * 지시서 요구: "스토리를 텍스트 대화만으로 처리하지 말고 게임플레이와 연결".
 *
 * 이 테스트가 고정하는 것:
 *   ① 중심 질문의 선택지가 **정본의 세 갈래**와 정확히 일치한다(네 번째 창작 금지)
 *   ② 시나리오의 choice 스텝과 CANON_STORY_CHOICES 의 id 집합이 동일하다
 *      (한쪽만 고치면 저장된 id 를 라벨로 못 바꿔 대사에 "flee" 같은 id 가 노출된다)
 *   ③ recall 키가 실제로 저장되는 키와 같다
 *   ④ id→label 변환이 동작하고, 모르는 값이면 undefined(원문 유지)
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { CANON_STORY_CHOICES, storyChoiceLabel } from '../src/game/grandPlanetCanon.ts';
import { LILAC_SCENARIOS } from '../src/game/lilacScenarios.ts';

/** 1.txt 정본의 세 갈래 — 이 표가 유일한 기준이다. */
const CANON_WHO = [
  { id: 'kill', label: '누군가를 죽이는 사람' },
  { id: 'flee', label: '두려움에 도망치는 사람' },
  { id: 'save', label: '누군가를 살리는 사람' },
];

test('중심 질문 선택지가 정본 세 갈래와 정확히 일치한다', () => {
  const opts = CANON_STORY_CHOICES['haruWho'];
  assert.ok(opts, 'haruWho 선택지가 없다');
  assert.equal(opts.length, 3, `선택지가 ${opts.length}개 — 정본은 3개다(네 번째 창작 금지)`);
  assert.deepEqual([...opts], CANON_WHO);
});

test('시나리오의 choice 스텝이 정본 표와 같은 id 집합을 쓴다', () => {
  const scen = LILAC_SCENARIOS['lilac00'];
  assert.ok(scen, 'lilac00 시나리오가 없다');
  const choiceSteps = scen.steps.filter((s) => s.t === 'choice');
  assert.equal(choiceSteps.length, 1, `lilac00 에 choice 스텝이 ${choiceSteps.length}개`);

  const step = choiceSteps[0];
  assert.equal(step.key, 'haruWho', 'key 가 저장 키와 다르다');
  assert.equal(step.prompt, '너는 어떤 사람이 되고 싶니?', '정본 질문 문구와 다르다');
  const stepIds = step.options.map((o) => o.id).sort();
  const canonIds = CANON_STORY_CHOICES['haruWho'].map((o) => o.id).sort();
  assert.deepEqual(stepIds, canonIds, '시나리오와 정본 표의 id 가 어긋난다');

  /* 라벨까지 같아야 한다 — 한쪽만 문구를 고치면 화면과 저장값이 갈라진다. */
  for (const o of step.options) {
    const canon = CANON_STORY_CHOICES['haruWho'].find((c) => c.id === o.id);
    assert.equal(o.label, canon.label, `${o.id} 라벨 불일치`);
  }
});

test('recall 스텝이 저장되는 key 를 가리킨다', () => {
  /* 15막에 회수(recall) 스텝이 있고, 그 키가 실제 저장 키(haruWho)여야 한다.
   *  키가 틀리면 치환이 안 되고 "{haruWho}" 가 그대로 화면에 나온다. */
  const late = LILAC_SCENARIOS['lilac15'];
  assert.ok(late, 'lilac15 시나리오가 없다');
  const recalls = late.steps.filter((s) => s.t === 'say' && s.recall);
  assert.ok(recalls.length >= 1, 'lilac15 에 recall 스텝이 없다');
  for (const s of recalls) {
    assert.ok(s.recall in CANON_STORY_CHOICES, `recall 키 '${s.recall}' 가 정본 표에 없다`);
    /* 대사 안에 실제로 치환 자리표시가 있어야 의미가 있다 */
    assert.ok(s.lines.some((l) => l.includes(`{${s.recall}}`)), `recall 키 '{${s.recall}}' 자리표시가 대사에 없다`);
    /* 구 세이브·스킵 대비 기본값이 있어야 빈 칸이 안 생긴다 */
    assert.ok(s.recallFallback, 'recallFallback 이 없다 — 저장값이 없으면 문장이 깨진다');
  }
});

test('storyChoiceLabel — id 를 표시 라벨로 바꾼다', () => {
  assert.equal(storyChoiceLabel('haruWho', 'flee'), '두려움에 도망치는 사람');
  assert.equal(storyChoiceLabel('haruWho', 'save'), '누군가를 살리는 사람');
  assert.equal(storyChoiceLabel('haruWho', 'kill'), '누군가를 죽이는 사람');
  /* 모르는 값·빈 값은 undefined — 호출부가 원문을 유지한다 */
  assert.equal(storyChoiceLabel('haruWho', 'unknown'), undefined);
  assert.equal(storyChoiceLabel('haruWho', undefined), undefined);
  assert.equal(storyChoiceLabel('noSuchKey', 'flee'), undefined);
});

test('recallFallback 은 정본에서 하루가 실제로 한 답이다', () => {
  /* 1.txt: 하루는 "두려움에 도망치는 사람이 되고 싶어요" 라고 답했다.
   *  임의의 기본값(예: 'save')을 넣으면 정본과 어긋난다. */
  const s = LILAC_SCENARIOS['lilac15'].steps.find((x) => x.t === 'say' && x.recall === 'haruWho');
  assert.equal(s.recallFallback, '두려움에 도망치는 사람');
});
