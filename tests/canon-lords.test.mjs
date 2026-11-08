/**
 * canon-lords.test.mjs — vc279 가문 영주 데이터 계약
 *
 * 배경: 지시서 P7c 는 "제로세계 6가문이 코드에 없다"였으나 vc278 에서 확인한 결과
 * 가문 24개는 **이미 정본 7.txt 와 1:1 일치**했다. 실제 결손은 **영주(가주) 이름**이었다:
 *   비에르·에이리·피닉스·종려·카즈하·레이지스 6개가 src/game 어디에도 없었다.
 *
 * 이 테스트는 두 가지를 고정한다:
 *   ① 정본에 명시된 영주는 반드시 lord 로 존재한다 (빠뜨리면 실패)
 *   ② 정본에 **없는** 이름을 만들어내지 않는다 (창작 금지 — 지시서 §0-1)
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CANON_FAMILIES, CANON_FAMILY_BY_NAME, CANON_FAMILY_BY_LORD, familyBlurb,
} from '../src/game/grandPlanetCanon.ts';

/** 정본 7.txt 에 명시된 영주/가주 — 이 표가 유일한 기준이다.
 *  여기 값을 고치려면 7.txt 를 먼저 고쳐야 한다(코드가 정본을 앞서면 안 된다). */
const CANON_LORDS = {
  에델리오나: ['스칼렛', '여왕'],
  에스테반: ['카르텔', '가주'],
  크렌렐브: ['시엘', '가주'],
  이덴미르: ['아덴', '가주'],
  에크레디트: ['루시', '가주'],
  그래스트: ['리안', '가주'],
  데스티니: ['아리', '가주'],
  페이트: ['루나', '가주'],
  카르리온: ['페르온', '가주'],
  아리아노: ['란', '가주'],
  '엘리자베스-플래임': ['제니퍼', '가주'],
  오르페우스: ['제르', '가주'],
  셀리나: ['시아', '가주'],
  질리언: ['캐스터', '가주'],
  페르티에스: ['레이지스', '가주'],
  에버포스: ['벨리카', '영주'],
  샌티널: ['비에르', '영주'],
  카르테르: ['에이리', '영주'],
  클로체스: ['클로체스', '가주'],
  라바이즈: ['피닉스', '영주'],
  유월: ['종려', '영주'],
  하나사키: ['카즈하', '영주'],
};

/** 정본에 사람 이름이 **없는** 가문 — null 이어야 한다(창작 금지). */
const NO_LORD = ['이그니션', '리버스'];

test('가문 24개가 정본과 일치하고 누락이 없다', () => {
  assert.equal(CANON_FAMILIES.length, 24, '가문 수가 24가 아니다');
  const names = CANON_FAMILIES.map((f) => f.name);
  assert.equal(new Set(names).size, 24, '가문명 중복');
  for (const n of Object.keys(CANON_LORDS)) {
    assert.ok(names.includes(n), `정본 가문 '${n}' 이 코드에 없다`);
  }
});

test('정본에 명시된 영주는 전부 lord 로 존재한다', () => {
  for (const [family, [lord, title]] of Object.entries(CANON_LORDS)) {
    const f = CANON_FAMILY_BY_NAME[family];
    assert.ok(f, `${family} 조회 실패`);
    assert.equal(f.lord, lord, `${family}: lord 가 ${lord} 가 아니다`);
    assert.equal(f.lordTitle, title, `${family}: lordTitle 이 ${title} 가 아니다`);
  }
});

test('정본에 사람 이름이 없는 가문은 null — 창작하지 않았다', () => {
  for (const family of NO_LORD) {
    const f = CANON_FAMILY_BY_NAME[family];
    assert.ok(f, `${family} 조회 실패`);
    assert.equal(f.lord, null, `${family}: 정본에 없는 영주 이름 '${f.lord}' 를 만들었다`);
    assert.equal(f.lordTitle, null, `${family}: 정본에 없는 칭호 '${f.lordTitle}' 를 만들었다`);
  }
});

test('lord 가 있는 가문 수는 정본과 같다 (24 - 2 = 22)', () => {
  const withLord = CANON_FAMILIES.filter((f) => f.lord !== null);
  assert.equal(withLord.length, 22, `lord 보유 가문이 ${withLord.length}개`);
  assert.equal(Object.keys(CANON_FAMILY_BY_LORD).length, 22, '역조회 맵 크기 불일치');
});

test('lord 역조회 — 이름으로 가문을 찾을 수 있다', () => {
  assert.equal(CANON_FAMILY_BY_LORD['벨리카'].name, '에버포스');
  assert.equal(CANON_FAMILY_BY_LORD['비에르'].name, '샌티널');
  assert.equal(CANON_FAMILY_BY_LORD['에이리'].name, '카르테르');
  assert.equal(CANON_FAMILY_BY_LORD['피닉스'].name, '라바이즈');
  assert.equal(CANON_FAMILY_BY_LORD['종려'].name, '유월');
  assert.equal(CANON_FAMILY_BY_LORD['카즈하'].name, '하나사키');
  assert.equal(CANON_FAMILY_BY_LORD['레이지스'].name, '페르티에스');
  /* 정본에 없는 이름으로는 조회되지 않아야 한다 */
  assert.equal(CANON_FAMILY_BY_LORD['아무개'], undefined);
});

test('familyBlurb — 정본 표기만 조합하고 null 을 문장에 노출하지 않는다', () => {
  const ever = familyBlurb(CANON_FAMILY_BY_NAME['에버포스']);
  assert.match(ever, /에버포스/);
  assert.match(ever, /번개/);
  assert.match(ever, /벨리카 영주/);
  assert.match(ever, /15가문/);

  /* 영주 없는 가문 — "null" 이나 빈 칸이 새면 안 된다 */
  const ign = familyBlurb(CANON_FAMILY_BY_NAME['이그니션']);
  assert.equal(/null|undefined/.test(ign), false, `영주 없는 가문 문구에 null 노출: ${ign}`);

  /* 몰락 가문은 '몰락한 가문' 으로 표기 */
  const fallen = familyBlurb(CANON_FAMILY_BY_NAME['클로체스']);
  assert.match(fallen, /몰락한 가문/);
  assert.match(fallen, /클로체스 가주/);
});

test('제로세계 7가문 — 정본 이름·영주·원소가 모두 살아 있다', () => {
  const zero = CANON_FAMILIES.filter((f) => f.world === 'zero');
  assert.equal(zero.length, 7, `제로세계 가문이 ${zero.length}개`);
  const expected = {
    에버포스: '벨리카', 샌티널: '비에르', 카르테르: '에이리', 클로체스: '클로체스',
    라바이즈: '피닉스', 유월: '종려', 하나사키: '카즈하',
  };
  for (const f of zero) {
    assert.equal(f.lord, expected[f.name], `${f.name} 영주 불일치`);
  }
});
