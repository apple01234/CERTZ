/**
 * enemy-damage-pipeline-equivalence.test.mjs — vc277 회귀 방지
 *
 * Enemy.takeDamage 의 배율 구간을 JENNY DamageData 파이프라인으로 교체했다.
 * **계산 결과가 종전과 완전히 동일**해야 한다.
 *
 * 종전:
 *   dealt = mitigate(rcvd === 1 ? raw : max(1, round(raw * rcvd)), def)
 *   hp -= dealt
 * 신식:
 *   pre = resolveDamage(makeDamage(raw), { received: rcvd })
 *   dealt = mitigate(pre, def)
 *   hp = applyDamage(...).health
 *
 * 두 식이 모든 조합에서 같은지 확인한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { makeDamage, resolveDamage, applyDamage } from '../src/game/combat/damageData.ts';

/** 종전 인라인 식 — 상태이상 받는피해 배율만 적용 */
function legacyPre(raw, rcvd) {
  return rcvd === 1 ? raw : Math.max(1, Math.round(raw * rcvd));
}

/** 신식 — resolveDamage(received) */
function newPre(raw, rcvd) {
  const d = makeDamage(raw);
  return resolveDamage(d, { received: rcvd });
}

test('Enemy 피해 — 받는피해 배율 1 이면 raw 를 가공 없이 넘긴다', () => {
  /* vc236 주석의 계약: 상태이상이 없으면 미리 반올림하지 않는다.
   * 소수 피해에서 정액 방어 감산 순서가 달라지면 1 이 어긋난다. */
  for (const raw of [1, 3, 7, 12.4, 12.5, 12.6, 99.99, 1234.56, 3000]) {
    assert.equal(newPre(raw, 1), raw, `raw=${raw}`);
    assert.equal(newPre(raw, 1), legacyPre(raw, 1));
  }
});

test('Enemy 피해 — 받는피해 배율이 있으면 max(1, round(raw*rcvd))', () => {
  const cases = [
    [100, 1.15], [100, 1.3], [100, 0.85], [37, 1.25], [1, 0.5],
    [12.4, 1.2], [999, 1.5], [250, 0.7], [7, 2.0], [1, 0.01],
  ];
  for (const [raw, rcvd] of cases) {
    assert.equal(newPre(raw, rcvd), legacyPre(raw, rcvd), `raw=${raw} rcvd=${rcvd}`);
  }
});

test('Enemy 피해 — 체력 차감 결과가 동일하다 (음수 방지 포함)', () => {
  const cases = [
    [100, 1000, 50],   // 피해 < 체력
    [100, 40, 1000],   // 피해 > 체력 (hp 0)
    [1, 1, 1],         // 경계
    [0, 100, 0],       // 0 피해
  ];
  for (const [hp, raw, maxHp] of cases) {
    const d = makeDamage(raw);
    const viaPipeline = applyDamage(d, hp, maxHp).health;
    const viaLegacy = Math.max(0, hp - raw); // applyDamage 는 min(raw,hp) 만 깎는다
    assert.equal(viaPipeline, viaLegacy, `hp=${hp} raw=${raw}`);
  }
});

test('Enemy 피해 — 원본 피해량이 보존된다 (파이프라인 이식의 실제 이득)', () => {
  /* 이게 이식의 이유다. 종전에는 raw 가 어디에도 남지 않았다. */
  const d = makeDamage(150);
  resolveDamage(d, { received: 1.4 });
  assert.equal(d.damage, 210, '실제 들어간 피해');
  assert.equal(d.originalDamage, 150, '원본 보존 — 배율 적용 전 값');
});

test('Enemy 피해 — 전 구간 조합 대조 (raw × rcvd 격자)', () => {
  const raws = [1, 2, 5, 10.5, 37, 100, 250.25, 999, 3000, 12345];
  const rcvds = [1, 0.7, 0.85, 1, 1.15, 1.25, 1.3, 1.5, 2];
  let n = 0;
  for (const raw of raws) {
    for (const rcvd of rcvds) {
      assert.equal(newPre(raw, rcvd), legacyPre(raw, rcvd), `raw=${raw} rcvd=${rcvd}`);
      n++;
    }
  }
  assert.ok(n >= 90, `${n} 조합 검증`);
});
