/**
 * vc252 P5 — 전직 스킬 진화 계약 테스트.
 *
 * 유저 요구: "n차 → (n+1)차 전직에서 보유 스킬이 강화되거나 상위 스킬로 교체되어야 한다.
 *             단순 공격력 증가만으로 전직을 처리하지 않는다."
 *
 * 이 테스트가 고정하는 것
 *  ① 35직업 전부 Z/C 슬롯이 resolve 된다 (미구현 직업 0)
 *  ② 3·4차 슬롯이 부모와 **동일 skillKind 인 비율**을 측정·출력한다 (개선 전후 비교 기준선)
 *  ③ `SKILL_EVOLUTIONS` 에 중복 skillId 가 없다
 *  ④ 실제로 진화시킨 슬롯은 `changes` 가 비어 있지 않고, delta 가 "부모와 다름"으로 분류된다
 *  ⑤ `skillEvolution.ts` 의 PARENT/TIER 가 `classes.ts` 와 어긋나지 않는다 (드리프트 방지)
 *  ⑥ Phaser import 금지 (순수 데이터 모듈)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CLASSES, SKILL1_KIND, SKILL2_KIND, SKILL3_KIND, SKILL4_KIND,
  resolveSkill1Of, resolveSkill2Of, chainOf, familyOf,
} from '../src/game/classes.ts';
import {
  SKILL_EVOLUTIONS, evolutionOf, evolutionDelta, countUpgraded, isZEvolved, isCEvolved,
  Z_EVOLVED_JOBS, C_EVOLVED_JOBS,
} from '../src/game/skillEvolution.ts';

const JOBS = Object.keys(CLASSES);

/* ── 1. 모든 직업의 Z/C 슬롯이 resolve 된다 ─────────────────────────────── */
test('모든 직업의 Z/C 슬롯이 resolve 된다', () => {
  const missing = [];
  for (const job of JOBS) {
    if (!resolveSkill1Of(job)) missing.push(`${job}:z`);
    if (!resolveSkill2Of(job)) missing.push(`${job}:c`);
  }
  assert.deepEqual(missing, [], `미구현 슬롯: ${missing.join(', ')}`);
  assert.equal(JOBS.length, 35, '직업은 35개');
});

/* ── 2. 부모와 동일 skillKind 비율 측정 (개선 전후 비교 기준선) ─────────── */
function parentKind(job, slot) {
  const chain = chainOf(job);
  if (chain.length < 2) return null; // 1차는 비교 대상 없음
  const parent = chain[chain.length - 2].key;
  if (slot === 'z') return resolveSkill1Of(parent);
  if (slot === 'c') return resolveSkill2Of(parent);
  const table = slot === 'v' ? SKILL3_KIND : SKILL4_KIND;
  for (const k of [...chainOf(parent)].reverse()) if (table[k.key]) return table[k.key];
  return null;
}
function ownKind(job, slot) {
  if (slot === 'z') return resolveSkill1Of(job);
  if (slot === 'c') return resolveSkill2Of(job);
  const table = slot === 'v' ? SKILL3_KIND : SKILL4_KIND;
  for (const k of [...chainOf(job)].reverse()) if (table[k.key]) return table[k.key];
  return null;
}

test('3·4차 슬롯의 "부모와 동일 skillKind" 비율을 측정해 출력한다', () => {
  const stats = {};
  for (const slot of ['z', 'c', 'v', 'b']) {
    let cmp = 0, same = 0;
    const sameJobs = [];
    for (const job of JOBS) {
      const mine = ownKind(job, slot);
      if (!mine) continue;
      const pk = parentKind(job, slot);
      if (pk === null) continue;
      cmp++;
      if (pk === mine) { same++; sameJobs.push(`${job}(${mine})`); }
    }
    stats[slot] = { cmp, same };
    const pct = cmp ? ((same / cmp) * 100).toFixed(1) : '-';
    console.log(`  ${slot.toUpperCase()} 슬롯: 비교가능 ${cmp} │ 동일(승계) ${same} │ 동일비율 ${pct}%` + (sameJobs.length ? `\n      ${sameJobs.join(', ')}` : ''));
  }
  /* 개선 전 실측(Z 40.0% / C 53.3%)을 기록으로 남긴다.
   *  종류 테이블은 건드리지 않았으므로 이 수치는 그대로다 — 진화는 그 "위"에서 일어난다. */
  assert.ok(stats.z.cmp > 0 && stats.c.cmp > 0, 'Z/C 비교 가능 슬롯이 있어야 한다');
  console.log(`  → Z/C 합계: 비교가능 ${stats.z.cmp + stats.c.cmp} 중 동일 ${stats.z.same + stats.c.same}`);
});

/* ── 3. SKILL_EVOLUTIONS 무결성 ─────────────────────────────────────────── */
test('SKILL_EVOLUTIONS 에 중복 skillId 가 없다', () => {
  const ids = SKILL_EVOLUTIONS.map((e) => e.skillId);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual([...new Set(dup)], [], `중복 skillId: ${[...new Set(dup)].join(', ')}`);
  assert.ok(ids.length > 0, '데이터가 비어 있으면 안 된다');
  console.log(`  SkillEvolution 항목 수: ${SKILL_EVOLUTIONS.length}`);
});

test('모든 항목이 필수 필드를 갖추고 tier 가 classes.ts 와 일치한다', () => {
  for (const e of SKILL_EVOLUTIONS) {
    assert.ok(e.skillId.includes(':'), `${e.skillId}: 형식 오류`);
    assert.ok(CLASSES[e.jobId], `${e.skillId}: 없는 직업 ${e.jobId}`);
    assert.equal(e.tier, CLASSES[e.jobId].tier, `${e.skillId}: tier 불일치`);
    assert.equal(typeof e.damageMultiplier, 'number');
    assert.equal(typeof e.cooldownMs, 'number');
    assert.ok(e.cooldownMs > 0, `${e.skillId}: 쿨다운은 양수`);
    assert.ok(typeof e.effectAssetKey === 'string' && e.effectAssetKey.length > 0);
    assert.ok(Array.isArray(e.changes));
  }
});

/* ── 4. 실제로 진화시킨 슬롯 검증 ───────────────────────────────────────── */
test('실제 진화 슬롯은 changes 가 비어 있지 않고 delta 가 upgraded=true 다', () => {
  const evolvedZ = [...Z_EVOLVED_JOBS];
  assert.ok(evolvedZ.length >= 8 && evolvedZ.length <= 12, `Z 진화 슬롯은 8~12개 (현재 ${evolvedZ.length})`);
  for (const job of evolvedZ) {
    const e = evolutionOf(job, 'z');
    assert.ok(e, `${job}:z 항목 없음`);
    assert.ok(e.changes.length > 0, `${job}:z 는 changes 가 있어야 진화다`);
    const d = evolutionDelta(job, 'z');
    assert.equal(d.upgraded, true, `${job}:z delta 가 upgraded 여야 한다`);
    assert.ok(isZEvolved(job), `${job}: isZEvolved true`);
  }
  console.log(`  Z 실제 진화 슬롯 ${evolvedZ.length}개: ${evolvedZ.join(', ')}`);
  console.log(`  전체 진화(변화 있음) 항목: ${countUpgraded()}개 / 슬롯별 Z=${countUpgraded('z')} C=${countUpgraded('c')}`);
});

test('진화 대상이 아닌 직업의 delta 는 upgraded=false (거짓 진화 금지)', () => {
  /* 1차 5직업은 부모가 없으므로 진화가 아니다. */
  for (const job of ['warrior', 'ranger', 'mage', 'thief', 'pirate']) {
    assert.equal(isZEvolved(job), false, `${job} 는 1차라 진화 대상 아님`);
    const d = evolutionDelta(job, 'z');
    assert.equal(d.upgraded, false, `${job}:z 는 변화 없음이 정직하다`);
    assert.deepEqual(d.changed, []);
  }
});

/* ── 5. skillEvolution.ts 가 classes.ts 와 드리프트하지 않았는지 ────────── */
test('PARENT/TIER 가 classes.ts 와 일치한다 (드리프트 방지)', () => {
  for (const job of JOBS) {
    const def = CLASSES[job];
    for (const slot of ['z', 'c']) {
      const e = evolutionOf(job, slot);
      assert.ok(e, `${job}:${slot} 항목 없음`);
      assert.equal(e.tier, def.tier, `${job}:${slot} tier`);
      const expectedParent = def.parent ?? null;
      const actualParent = e.evolvesFrom ? e.evolvesFrom.split(':')[0] : null;
      assert.equal(actualParent, expectedParent, `${job}:${slot} evolvesFrom 부모 불일치`);
    }
  }
});

/* ── 6. 순수 데이터 모듈 (Phaser 미의존) ────────────────────────────────── */
test('skillEvolution.ts 는 Phaser 를 import 하지 않는다', () => {
  const src = fs.readFileSync(new URL('../src/game/skillEvolution.ts', import.meta.url), 'utf8');
  assert.ok(!/from\s+["']phaser["']/.test(src), 'Phaser import 금지');
  assert.ok(!/from\s+["']\.\/scenes\//.test(src), '씬 import 금지');
});

/* ── 7. 계열 정체성 — 진화해도 계열을 벗어나지 않는다 ───────────────────── */
test('진화 슬롯은 자기 계열 안에 머문다', () => {
  for (const job of Z_EVOLVED_JOBS) {
    const fam = familyOf(job);
    assert.ok(fam, `${job}: 계열 없음`);
    const parent = CLASSES[job].parent;
    if (parent) assert.equal(familyOf(parent), fam, `${job}: 부모와 계열이 다르다`);
  }
});
