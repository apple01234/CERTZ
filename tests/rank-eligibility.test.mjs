/**
 * vc283 (지시 #24) — 랭킹 4차 전직 조건 회귀 테스트.
 *
 * [왜 필요한가]
 *  지시 원문: "4차 전직 이상을 완료한 캐릭터만 랭킹에 등록한다. ...
 *  **랭킹 집계 서버에서도 동일한 조건을 적용한다.**"
 *  화면 문구만 넣고 집계를 안 고치면 1차 캐릭터가 그대로 명예의 전당에 남는다.
 *  반대로 조건을 너무 세게 걸면 5차 유저가 목록에서 사라진다.
 *  두 방향 모두 실제로 일어날 수 있는 회귀이므로 경계를 고정한다.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rankEligible, RANK_MIN_TIER } from '../src/lib/rankEligibility.ts';
import { CLASSES, classDef } from '../src/game/classes.ts';

test('RANK_MIN_TIER 는 4차 전직을 가리킨다', () => {
  assert.equal(RANK_MIN_TIER, 4);
});

test('1~3차 직업은 랭킹에서 제외된다', () => {
  const excluded = [];
  for (const [key, def] of Object.entries(CLASSES)) {
    if (def.tier < 4) {
      excluded.push(key);
      assert.equal(rankEligible({ cls: key }), false, `${key} (tier ${def.tier}) must be excluded`);
    }
  }
  /* 실제로 1~3차가 존재하는지 확인 — 전부 4차 이상이면 이 테스트는 공허하다. */
  assert.ok(excluded.length >= 20, `expected many sub-4th classes, got ${excluded.length}`);
});

test('4차 직업은 랭킹에 등록된다', () => {
  const tier4 = Object.entries(CLASSES).filter(([, d]) => d.tier === 4).map(([k]) => k);
  assert.ok(tier4.length >= 8, `expected 4th-tier classes, got ${tier4.length}`);
  for (const key of tier4) {
    assert.equal(rankEligible({ cls: key }), true, `${key} (tier 4) must be eligible`);
  }
});

test('5차 각성도 랭킹 자격을 유지한다 (sTier=5 는 cls 를 4차로 유지)', () => {
  /* 5차는 별도 ClassKey 가 아니라 4차에서 각성한 상태다.
   *  세이브에 sTier 가 5 로 찍혀 있어도 cls 는 4차 키이므로 통과해야 한다 —
   *  이게 깨지면 5차 유저가 랭킹에서 통째로 사라진다. */
  const tier4 = Object.entries(CLASSES).filter(([, d]) => d.tier === 4).map(([k]) => k);
  for (const key of tier4) {
    assert.equal(rankEligible({ cls: key, sTier: 5 }), true, `${key} at sTier 5 must stay eligible`);
  }
});

test('미전직·잘못된 cls 는 제외된다 (크래시 없이)', () => {
  assert.equal(rankEligible({}), false, 'no cls');
  assert.equal(rankEligible({ cls: null }), false, 'null cls');
  assert.equal(rankEligible({ cls: '' }), false, 'empty cls');
  assert.equal(rankEligible({ cls: 'not_a_class' }), false, 'unknown cls');
  assert.equal(rankEligible({ cls: 123 }), false, 'non-string cls');
});

test('classDef 가 4차 경계를 정확히 보고한다', () => {
  /* 랭킹 판정이 의존하는 사실을 직접 고정 — tier 값이 바뀌면 여기서 먼저 깨진다. */
  assert.equal(classDef('warbringer')?.tier, 4);
  assert.equal(classDef('deadeye')?.tier, 4);
  assert.equal(classDef('warlord')?.tier, 3);
  assert.equal(classDef('berserker')?.tier, 2);
  assert.equal(classDef('warrior')?.tier, 1);
  assert.equal(classDef(null), null);
});

/* ═══ vc283 후속 (리뷰 지적) — 환생 직후 경로를 고정한다 ═══
 *
 * [리뷰 지적] 환생하면 `resetClass()` 가 cls=null 로 만들고 곧바로 tier-1 클래스를
 *  부여한다(WorldScene.ts:8442-8443). 그래서 이전에 랭킹에 있던 캐릭터도
 *  환생 직후에는 목록에서 빠진다.
 *
 * [판단] 이것은 **의도된 동작**이다. 요구사항 #24 는 "4차 전직 이상만 등록"이지
 *  "한 번 올랐으면 영구 유지"가 아니고, 레벨 1 로 돌아간 캐릭터가 상위 랭킹에
 *  남아 있으면 명예의 전당이 무의미해진다.
 *  다만 이 경로가 테스트로 고정돼 있지 않아, 나중에 누가 "환생자가 사라졌다"를
 *  버그로 착각하고 조건을 느슨하게 풀 수 있다. 그래서 **의도임을 테스트로 못박는다.**
 */
test('환생 직후(cls 가 1차로 리셋됨)에는 랭킹에서 제외된다 — 의도된 동작', () => {
  /* 환생 직후 상태를 실제 구성과 같게 만든다: cls 는 1차, 레벨은 1, 환생 횟수는 남아 있음 */
  const afterRebirth = { cls: 'warrior', lv: 1, inf: { rebirths: 3 } };
  assert.equal(rankEligible(afterRebirth), false,
    '환생 직후 1차 클래스는 랭킹 제외 — 4차 조건의 자연스러운 결과다');

  /* 미전직(null) 상태도 동일 */
  assert.equal(rankEligible({ cls: null, lv: 1, inf: { rebirths: 3 } }), false);

  /* 4차에 다시 도달하면 복귀한다 — 영구 박탈이 아님을 함께 고정 */
  assert.equal(rankEligible({ cls: 'warbringer', lv: 200, inf: { rebirths: 3 } }), true);
});
