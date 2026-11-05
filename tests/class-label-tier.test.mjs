import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * 직업명 표기 — "2차 이후 4차 직업명 고정 + 차수만 증가" (vc246, 지시 #2).
 *
 * [요구] "2차 전직 이후 각 분기별 4차 직업 이름으로 이름을 고정하고 차수만 올리기
 *  (예: 3차 워브링어, 5차 워브링어)"
 *
 * [종전 동작] classLabel 이 체인의 마지막(=실제 현재 직업) 이름을 그대로 썼다.
 *  그래서 같은 분기에서 승급할 때마다 버서커 → 워로드 → 워브링어 로 이름이 바뀌었다.
 *
 * [함정] 처음 구현에서 tier2RootOf() 를 썼다가 워브링어가 "버서커 4차"로 나왔다.
 *  - tier2RootOf 는 **2차** 루트를 준다(외형 승계용)
 *  - chainOf 는 **위로만** 올라가므로 3차에서 호출하면 4차 후손이 체인에 없다
 *  → 현재 단계에서 jobOptions 로 내려가며 4차를 찾아야 한다.
 *  이 테스트는 그 회귀를 잡는다.
 */

const m = await import('../src/game/classes.ts');
const { classLabel, classDef, jobOptions, FIFTH_LEVEL } = m;

test('같은 분기의 2·3·4차는 모두 4차 이름으로 고정된다', () => {
  /* 전사 계열: berserker(2차) → warlord(3차) → warbringer(4차) */
  assert.equal(classLabel('berserker'), '워브링어 2차');
  assert.equal(classLabel('warlord'), '워브링어 3차');
  assert.equal(classLabel('warbringer'), '워브링어 4차');
  /* 이름 부분(차수 제외)이 셋 다 같아야 한다 */
  const names = ['berserker', 'warlord', 'warbringer'].map((k) => classLabel(k).replace(/\s\d차$/, ''));
  assert.deepEqual(names, ['워브링어', '워브링어', '워브링어']);
});

test('5차는 이름을 바꾸지 않고 차수만 5로 오른다', () => {
  for (const k of ['berserker', 'warlord', 'warbringer']) {
    assert.equal(classLabel(k, true), '워브링어 5차');
  }
  assert.equal(classLabel('warbringer'), '워브링어 4차');
});

test('모든 분기(8+해적 2)가 각자의 4차 이름으로 고정된다', () => {
  /* 각 2차 직업에서 4차까지 내려가며 이름이 동일한지 확인 — 분기 누락 방지 */
  const branches = ['berserker', 'guardian', 'sniper', 'windrunner', 'archmage', 'sage', 'assassin', 'swashbuckler', 'raider', 'corsair'];
  for (const root of branches) {
    const rootDef = classDef(root);
    assert.ok(rootDef, `${root} 정의 없음`);
    if (rootDef.tier !== 2) continue; // 2차 루트만
    /* 분기 끝(4차)까지 내려간다 */
    let cur = rootDef;
    const seen = [];
    for (let g = 0; g < 4 && cur; g++) {
      seen.push(cur);
      const next = jobOptions(cur.key)[0];
      if (!next || next.tier > 4) break;
      cur = next;
    }
    const finalDef = seen.find((d) => d.tier === 4);
    if (!finalDef) continue; // 4차가 없는 분기(해적 일부)는 대상 아님
    /* 2·3차 라벨의 이름부가 4차 이름과 같아야 한다 */
    for (const d of seen) {
      const name = classLabel(d.key).replace(/\s\d차$/, '');
      assert.equal(name, finalDef.name, `${d.key} 라벨 이름이 4차(${finalDef.name})와 다르다`);
    }
    /* 차수는 실제 단계와 일치 */
    for (const d of seen) {
      assert.equal(classLabel(d.key), `${finalDef.name} ${d.tier}차`, `${d.key} 차수 표기 오류`);
    }
  }
});

test('1차/미전직은 기존 표기를 유지한다', () => {
  /* 1차는 "계열 · 칭호" 형식 그대로 — 4차 이름으로 고정하지 않는다 */
  const war = classLabel('warrior');
  assert.match(war, / · /, `1차 표기가 바뀌었다: ${war}`);
  assert.equal(classLabel(null), '');
  assert.equal(classLabel(undefined), '');
});

test('5차 임계 레벨 상수가 존재한다', () => {
  assert.equal(typeof FIFTH_LEVEL, 'number');
  assert.ok(FIFTH_LEVEL > 0);
});
