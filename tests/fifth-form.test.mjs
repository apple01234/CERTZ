/**
 * task-19 — 5차 전직 공격 형태 변경 + 궁극기 공통 낙하 연출 제거 계약 테스트.
 *
 * 유저 요구
 *  9.4: "5차 전직은 공격 형태 자체가 바뀌어야 한다. 단순히 투사체를 한 발 더 추가하지 않는다."
 *  18 : "모든 직업의 5차 궁극기에 공통적으로 보이는 비가 내리는 듯한 이펙트를 제거하라."
 *
 * 고정하는 것
 *  ① 5차는 별도 ClassKey 가 아니라 sTier=5 → kind 는 4차와 구조적으로 동일(기준선 수치)
 *  ② FIFTH_FORMS 표에 중복 키가 없고, 등록된 직업은 실제 4차 원거리 직업이다
 *  ③ 각 5차 형태의 파라미터가 유효 범위 안이다
 *  ④ 5차가 아닌 경로(1~4차)는 종전과 동일함을 보장하는 가드가 소스에 있다
 *  ⑤ 낙하형("비") 연출이 5차에서 제거됐다 — arrowrain 5차 분기가 수직 낙하를 쓰지 않는다
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CLASSES, resolveSkill1Of, chainOf, familyOf,
} from '../src/game/classes.ts';
import {
  FIFTH_FORMS, FIFTH_FORM_JOBS, fifthFormDef, hasFifthForm,
} from '../src/game/skillEvolution.ts';

const JOBS = Object.keys(CLASSES);
const RANGED = ['ranger', 'mage'];

/* ── 1. 기준선 — 5차 kind 는 4차와 동일 (개선 "전" 수치) ───────────────── */
test('기준선: 5차는 별도 클래스가 아니라 sTier=5 이므로 kind 가 4차와 동일하다', () => {
  /* 5차 전용 ClassKey 가 존재하지 않음을 확인 — 이게 "형태가 안 바뀌는" 구조적 원인. */
  const fifthKeys = JOBS.filter((j) => CLASSES[j].tier >= 5);
  assert.equal(fifthKeys.length, 0, '5차는 ClassKey 가 아니다(tier 5 직업 0개)');

  /* 원거리 4차 직업 목록을 뽑아 출력 */
  const ranged4 = JOBS.filter((j) => CLASSES[j].tier === 4 && RANGED.includes(familyOf(j)));
  console.log(`  원거리 4차 직업 ${ranged4.length}개: ${ranged4.join(', ')}`);
  for (const j of ranged4) {
    console.log(`    ${j.padEnd(12)} family=${familyOf(j)} Z=${resolveSkill1Of(j)}`);
  }
  assert.ok(ranged4.length > 0);
});

/* ── 2. FIFTH_FORMS 무결성 ─────────────────────────────────────────────── */
test('FIFTH_FORMS 키가 유효하고 중복이 없다', () => {
  const keys = Object.keys(FIFTH_FORMS);
  const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
  assert.deepEqual([...new Set(dup)], [], `중복 키: ${[...new Set(dup)].join(', ')}`);
  for (const k of keys) {
    const [job, slot] = k.split(':');
    assert.ok(CLASSES[job], `${k}: 없는 직업 ${job}`);
    assert.ok(['z', 'c', 'v', 'b'].includes(slot), `${k}: 잘못된 슬롯 ${slot}`);
    /* 5차 형태는 4차 직업에만 의미가 있다(3차 이하가 5차에 도달하는 경로는 없음). */
    assert.equal(CLASSES[job].tier, 4, `${k}: 5차 형태는 4차 직업 전용`);
  }
  console.log(`  FIFTH_FORMS 항목 ${keys.length}개 / 직업 ${FIFTH_FORM_JOBS.size}개: ${[...FIFTH_FORM_JOBS].join(', ')}`);
});

test('원거리 4차 직업 전부 Z 슬롯에 5차 형태가 정의돼 있다', () => {
  const ranged4 = JOBS.filter((j) => CLASSES[j].tier === 4 && RANGED.includes(familyOf(j)));
  const missing = ranged4.filter((j) => !hasFifthForm(j, 'z'));
  /* ponytail: 근접 계열은 이번 범위 밖. 원거리는 전부 덮는다. */
  assert.deepEqual(missing, [], `5차 형태 미정의 원거리 직업: ${missing.join(', ')}`);
});

/* ── 3. 파라미터 유효성 ────────────────────────────────────────────────── */
test('5차 형태 파라미터가 유효 범위 안이다', () => {
  for (const [key, def] of Object.entries(FIFTH_FORMS)) {
    assert.ok(def.label.length > 0, `${key}: label 필수`);
    const p = def.params;
    if (p.count !== undefined) {
      assert.ok(p.count >= 2 && p.count <= 12, `${key}: count 는 2~12 (현재 ${p.count})`);
    }
    if (p.arc !== undefined) {
      assert.ok(p.arc > 0 && p.arc <= Math.PI * 1.2, `${key}: arc 범위`);
    }
    if (p.chains !== undefined) {
      assert.ok(p.chains >= 2 && p.chains <= 8, `${key}: chains 는 2~8`);
    }
    if (p.durationMs !== undefined) {
      assert.ok(p.durationMs >= 500 && p.durationMs <= 6000, `${key}: durationMs 범위`);
    }
    if (p.radius !== undefined) {
      assert.ok(p.radius >= 60 && p.radius <= 400, `${key}: radius 범위`);
    }
    /* 형태별로 최소 1개 파라미터가 있어야 한다 — 빈 형태는 "바뀐 게 없다". */
    assert.ok(Object.keys(p).length > 0, `${key}: params 가 비어 있다`);
  }
});

test('fifthFormDef 는 등록되지 않은 직업/슬롯에 undefined 를 돌려준다 (종전 경로 보장)', () => {
  assert.equal(fifthFormDef('warrior', 'z'), undefined);
  assert.equal(fifthFormDef('nope', 'z'), undefined);
  assert.equal(fifthFormDef(null, 'z'), undefined);
  assert.equal(fifthFormDef('deadeye', 'c'), undefined); // C 는 이번 범위 밖
  assert.ok(fifthFormDef('deadeye', 'z'));
  console.log(`  deadeye:z → ${fifthFormDef('deadeye', 'z').form} (${fifthFormDef('deadeye', 'z').label})`);
});

/* ── 4. 5차가 아닌 경로 보존 가드 (소스 검사) ──────────────────────────── */
test('5차 분기는 sTier===5 로만 진입한다 (1~4차 수치 불변 보장)', () => {
  const src = fs.readFileSync(new URL('../src/game/entities/Player.ts', import.meta.url), 'utf8');
  /* fifthZForm 게터가 sTier===5 에서만 값을 돌려주는 구조여야 한다. */
  assert.match(src, /get fifthZForm\(\)[\s\S]{0,120}this\.sTier !== 5[\s\S]{0,40}return null/,
    'fifthZForm 은 sTier===5 가 아니면 null 이어야 한다');
  /* 각 5차 분기 블록은 f5?.form 체크로 들어가야 한다(무조건 실행 금지). */
  const f5Guards = src.match(/f5\?\.form === "(pierce-spread|chain-burst|wide-barrage|zone-sustain)"/g) ?? [];
  assert.ok(f5Guards.length >= 2, `5차 형태 가드가 최소 2곳 있어야 한다 (현재 ${f5Guards.length})`);
  console.log(`  5차 형태 분기 가드: ${f5Guards.length}곳`);
});

/* ── 5. 요구사항 18 — 낙하형 "비" 연출 5차 제거 ────────────────────────── */
test('arrowrain 5차 분기는 수직 낙하를 쓰지 않는다 (빗줄기 제거)', () => {
  const src = fs.readFileSync(new URL('../src/game/entities/Player.ts', import.meta.url), 'utf8');
  /* arrowrain 케이스 본문 추출 */
  const start = src.indexOf('case "arrowrain": {');
  assert.ok(start > 0, 'arrowrain 케이스가 있어야 한다');
  const end = src.indexOf('break;', src.indexOf('spawnPickupText', start));
  const body = src.slice(start, end);
  /* 5차 분기(f5V) 가 존재해야 한다. */
  assert.ok(body.includes('fifthFormDef(this.cls, "v")'), 'arrowrain 에 5차 V 형태 분기가 있어야 한다');
  /* 1~4차 낙하 경로(oy - 320)는 남아 있어야 한다 — 종전 동작 보존. */
  assert.ok(body.includes('oy - 320'), '1~4차 낙하 경로는 보존돼야 한다');
  /* 5차 분기 블록 안에는 낙하 좌표가 없어야 한다(동시 사격만). */
  const f5Block = body.slice(body.indexOf('if (f5V?.form === "wide-barrage")'));
  const f5End = f5Block.indexOf('break;');
  const f5Body = f5Block.slice(0, f5End > 0 ? f5End : f5Block.length);
  assert.ok(!f5Body.includes('oy - 320'), '5차 분기에 수직 낙하가 남아 있으면 안 된다');
  assert.ok(f5Body.includes('firePlayerProj'), '5차 분기는 전방 사격을 써야 한다');
  console.log('  arrowrain: 1~4차 낙하 유지 / 5차 부채꼴 동시 사격으로 분기 확인');
});

/* ── 6. 5차 형태가 실제로 "형태"인지 (배율이 아님) ─────────────────────── */
test('5차 형태는 배율이 아니라 판정 구조를 바꾼다', () => {
  /* 각 형태가 개수/연쇄/지속 같은 이산 파라미터를 가진다. */
  for (const [key, def] of Object.entries(FIFTH_FORMS)) {
    const p = def.params;
    const structural =
      (p.count ?? 0) >= 2 || (p.chains ?? 0) >= 2 || (p.durationMs ?? 0) > 0;
    assert.ok(structural, `${key}: 형태 변경이라면 개수/연쇄/지속 중 하나는 있어야 한다`);
  }
  const forms = new Set(Object.values(FIFTH_FORMS).map((d) => d.form));
  console.log(`  사용된 형태 종류 ${forms.size}가지: ${[...forms].join(', ')}`);
});
