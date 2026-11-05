import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SKILL_SLOTS, SLOT_RULES, SLOT_KINDS, ZONE_SHAPES, CLASS_OPTIONS, ELEMENT_OPTIONS,
  GAME_ZONE_RANGE, COOLDOWN_TIER_STEP, COOLDOWN_TIER_FLOOR,
  createSkill, retargetSlot, zoneFor, hitTest, maxMpAt,
  previewDamage, previewCooldownMs,
  validateSkill, validateSkillSet,
  serializeSkills, deserializeSkills,
  skillsFromGame, nextSkillId,
} from '../src/game/skillEditorCore.ts';
import {
  SKILL1_KIND, SKILL2_KIND, SKILL3_KIND, SKILL4_KIND, SKILL5_INFO,
  SKILL_LABELS, ULT_CLASSES, CLASSES, FIFTH_CD_MULT, JOB_LEVELS, FIFTH_LEVEL,
} from '../src/game/classes.ts';

/**
 * 스킬 메이커 코어 (지시: "스킬 메이커").
 *
 * [왜 이 테스트가 중요한가]
 *  에디터가 보여주는 MP·쿨다운·판정·데미지가 게임과 다르면, 사용자가 만든 스킬이
 *  게임에서 다르게 동작한다. 그래서 여기서는 **코어가 게임 테이블/식을 그대로 쓰는지**를
 *  고정한다 — 코어가 값을 지어내기 시작하면 이 테스트가 깨진다.
 *
 *  · 슬롯 상수가 Player 의 리터럴(MP 15/20/25/40/100/150, 쿨 4000…120000)과 같은지
 *  · 메커니즘 팔레트가 실제 배정된 키의 합집합인지(없는 키를 만들지 않았는지)
 *  · 검증이 게임을 깨뜨리는 조합을 잡는지
 *  · 저장/불러오기 왕복이 정보를 잃지 않고 손상 입력을 거부하는지
 *  · 데미지/쿨다운이 게임 순수함수와 **같은 값**을 내는지
 */

/* ─────────────────────────── 기본값 ─────────────────────────── */

test('createSkill: 슬롯 기본값이 Player 의 MP·쿨다운 리터럴과 일치한다', () => {
  /* Player.useSkill1..5b 의 `this.mp < N` / `this.skillNMax` 실측값.
   *  여기가 틀리면 에디터가 "이 스킬은 15MP" 라고 보여줘도 게임은 100MP 를 뺀다. */
  const expected = {
    s1: { mp: 15, cooldownMs: 4000, ultSlot: 0 },
    s2: { mp: 20, cooldownMs: 6000, ultSlot: 0 },
    s3: { mp: 25, cooldownMs: 9000, ultSlot: 0 },
    s4: { mp: 40, cooldownMs: 14000, ultSlot: 0 },
    s5: { mp: 100, cooldownMs: 60000, ultSlot: 1 },
    s5b: { mp: 150, cooldownMs: 120000, ultSlot: 2 },
  };
  assert.deepEqual([...SKILL_SLOTS], Object.keys(expected));

  for (const slot of SKILL_SLOTS) {
    const s = createSkill({ slot });
    assert.equal(s.slot, slot);
    assert.equal(s.mp, expected[slot].mp, `${slot}: MP`);
    assert.equal(s.cooldownMs, expected[slot].cooldownMs, `${slot}: 쿨다운`);
    assert.equal(s.ultSlot, expected[slot].ultSlot, `${slot}: 궁극기 슬롯`);
    /* 기본값은 그 자체로 유효해야 한다 — 폼을 열자마자 빨간 에러가 뜨면 안 된다. */
    assert.equal(validateSkill(s).ok, true, `${slot}: 기본값이 검증 실패 — ${validateSkill(s).errors.join(', ')}`);
  }

  /* 해금 레벨은 게임 상수에서 온다(하드코딩 금지) */
  assert.equal(SLOT_RULES.s3.unlockLevel, JOB_LEVELS.t3);
  assert.equal(SLOT_RULES.s4.unlockLevel, JOB_LEVELS.t4);
  assert.equal(SLOT_RULES.s5.unlockLevel, FIFTH_LEVEL);

  /* 새 스킬은 중립값에서 시작하고, 메커니즘은 알파벳 순서가 아니라 슬롯의 첫 분기다 */
  const s1 = createSkill();
  assert.equal(s1.id, 'new_skill');
  assert.equal(s1.mult, 1);
  assert.equal(s1.sTier, 1);
  assert.equal(s1.kind, 'spin', 's1 기본 메커니즘은 Player.useSkill1 의 첫 분기(spin)여야 한다');
  assert.deepEqual(s1.pulsesMs, [0]);
  assert.equal(s1.hit.shape, 'circle');
  /* 반환된 객체는 매번 새것이어야 한다(공유 참조면 한 스킬 수정이 다른 스킬을 바꾼다) */
  const a = createSkill(), b = createSkill();
  a.pulsesMs.push(200);
  a.hit.radius = 999;
  assert.deepEqual(b.pulsesMs, [0]);
  assert.notEqual(b.hit.radius, 999);
});

test('메커니즘 팔레트는 게임이 실제 배정한 키의 합집합이다', () => {
  const uniq = (t) => [...new Set(Object.values(t))];

  /* 슬롯별 팔레트가 게임 테이블과 **정확히** 같아야 한다.
   *  타입 선언에만 있고 어디에도 배정되지 않은 키(예: s1 의 skyrend)는
   *  실행부 switch 에 도달할 수 없으므로 팔레트에서 빠져야 한다. */
  assert.deepEqual([...SLOT_KINDS.s1].sort(), uniq(SKILL1_KIND).sort());
  assert.deepEqual([...SLOT_KINDS.s2].sort(), uniq(SKILL2_KIND).sort());
  assert.deepEqual([...SLOT_KINDS.s3].sort(), uniq(SKILL3_KIND).sort());
  assert.deepEqual([...SLOT_KINDS.s4].sort(), uniq(SKILL4_KIND).sort());
  assert.deepEqual([...SLOT_KINDS.s5].sort(), Object.keys(SKILL5_INFO).sort());

  /* 슬롯 간 키가 섞이면 실행부 switch 가 못 찾는다 — 팔레트도 겹치지 않아야 한다 */
  for (const [a, listA] of Object.entries(SLOT_KINDS)) {
    if (a === 's5b') continue; /* s5b 는 s5 와 같은 키 집합을 쓴다(Skill5BKey = Skill5Key) */
    for (const [b, listB] of Object.entries(SLOT_KINDS)) {
      if (a >= b || b === 's5b') continue;
      const overlap = listA.filter((k) => listB.includes(k));
      assert.equal(overlap.length, 0, `${a}/${b} 팔레트가 겹친다: ${overlap.join(',')}`);
    }
  }

  /* 판정 형태는 SignatureZone 의 4종과 같다 */
  assert.deepEqual([...ZONE_SHAPES].sort(), ['beam', 'box', 'circle', 'sector']);
  /* 원소 목록은 ELEMENT_META 그대로(9종 + none) */
  assert.equal(ELEMENT_OPTIONS.length, 10);
  assert.ok(ELEMENT_OPTIONS.some((e) => e.key === 'none'));
});

test('retargetSlot: 슬롯을 바꾸면 MP·쿨다운·궁극기 슬롯이 함께 옮겨간다', () => {
  const s1 = createSkill({ id: 'move_me', slot: 's1', kind: 'spin' });
  const s5 = retargetSlot(s1, 's5');
  assert.equal(s5.slot, 's5');
  assert.equal(s5.mp, 100);
  assert.equal(s5.cooldownMs, 60000);
  assert.equal(s5.ultSlot, 1);
  /* s1 메커니즘은 s5 실행부에 없으므로 기본값으로 대체돼야 한다 */
  assert.notEqual(s5.kind, 'spin');
  assert.ok(SLOT_KINDS.s5.includes(s5.kind), `s5 팔레트에 없는 키: ${s5.kind}`);
  assert.equal(validateSkill(s5).ok, true, validateSkill(s5).errors.join(', '));

  /* 슬롯 팔레트가 서로 겹치지 않으므로(s1/s2 키 집합 무교집합) 메커니즘은 대체된다.
   *  같은 키가 두 슬롯에 있으면 유지되는데, 현재 게임 테이블에는 그런 키가 없다 —
   *  그래서 "유지" 대신 "대체 후에도 팔레트 안" 을 계약으로 고정한다. */
  const dash = createSkill({ id: 'move2', slot: 's2', kind: 'dash' });
  const moved = retargetSlot(dash, 's1');
  assert.equal(moved.slot, 's1');
  assert.ok(SLOT_KINDS.s1.includes(moved.kind), `s1 팔레트에 없는 키: ${moved.kind}`);
  assert.equal(validateSkill(moved).ok, true, validateSkill(moved).errors.join(', '));
});

/* ─────────────────────────── 검증: 성공 ─────────────────────────── */

test('validateSkill: 정상 스킬 2건은 통과한다', () => {
  const beam = createSkill({
    id: 'lance_of_dawn', name: '새벽의 창', cls: 'warlord', slot: 's1', kind: 'wallsmash',
    element: 'light', mult: 2.4, sTier: 3,
    hit: { shape: 'beam', radius: 0, length: 420, width: 64, halfAngle: 0 },
    startupMs: 220, recoveryMs: 150, pulsesMs: [0, 140],
  });
  const v1 = validateSkill(beam);
  assert.equal(v1.ok, true, v1.errors.join(', '));
  assert.deepEqual(v1.errors, []);

  const ult = createSkill({
    id: 'omega_burst', name: '종언의 폭발', cls: 'warbringer', slot: 's5',
    kind: 'warbringer', element: 'fire', mult: 6.5, sTier: 5,
  });
  const v2 = validateSkill(ult);
  assert.equal(v2.ok, true, v2.errors.join(', '));

  /* 직업 없음(base) 도 유효하다 — 미전직 스타터 스킬이 실제로 존재한다 */
  assert.equal(validateSkill(createSkill({ id: 'starter_hit', name: '기본 타격' })).ok, true);
});

/* ─────────────────────────── 검증: 실패 ─────────────────────────── */

test('validateSkill: 게임을 깨뜨리는 값을 잡는다', () => {
  /* ID 규칙 — 저장 키이자 사람이 읽는 슬러그 */
  assert.ok(validateSkill(createSkill({ id: 'Bad ID' })).errors.some((e) => e.includes('ID')));
  assert.ok(validateSkill(createSkill({ id: 'A' })).errors.some((e) => e.includes('ID')));

  /* 이름 빈값 — 게임은 빈 라벨을 "미해금"으로 본다(classes.ts:816) */
  assert.ok(validateSkill(createSkill({ id: 'x1', name: '   ' })).errors.some((e) => e.includes('이름')));

  /* 음수 MP — `this.mp -= mp` 라서 시전하면 MP 가 늘어난다 */
  assert.ok(validateSkill(createSkill({ id: 'x2', name: 'x', mp: -10 })).errors.some((e) => e.includes('MP')));

  /* 음수/비정수 쿨다운 */
  assert.ok(validateSkill(createSkill({ id: 'x3', name: 'x', cooldownMs: -1 })).errors.some((e) => e.includes('쿨다운')));
  assert.ok(validateSkill(createSkill({ id: 'x4', name: 'x', cooldownMs: 1.5 })).errors.some((e) => e.includes('쿨다운')));

  /* 배율 0/음수 — 데미지가 0 이 되거나 음수 회복이 된다 */
  assert.ok(validateSkill(createSkill({ id: 'x5', name: 'x', mult: 0 })).errors.some((e) => e.includes('계수')));
  assert.ok(validateSkill(createSkill({ id: 'x6', name: 'x', mult: -2 })).errors.some((e) => e.includes('계수')));

  /* 슬롯 ≠ 메커니즘 — 실행부 switch 불일치 */
  const wrongKind = createSkill({ id: 'x7', name: 'x', slot: 's3', kind: 'spin' });
  assert.ok(validateSkill(wrongKind).errors.some((e) => e.includes('메커니즘')), validateSkill(wrongKind).errors.join(','));

  /* 궁극기 슬롯 3 — damageModel 이 사다리·궁극기 배율을 모두 끈다 */
  assert.ok(validateSkill(createSkill({ id: 'x8', name: 'x', ultSlot: 3 })).errors.some((e) => e.includes('궁극기')));

  /* 판정 없음 — 아무것도 맞지 않는 스킬 */
  const noHit = createSkill({ id: 'x9', name: 'x', hit: { shape: 'circle', radius: 0, length: 0, width: 0, halfAngle: 0 } });
  assert.ok(validateSkill(noHit).errors.some((e) => e.includes('판정')), validateSkill(noHit).errors.join(','));
  /* 부채꼴 반각 90° 초과 */
  const wideSector = createSkill({
    id: 'x10', name: 'x',
    hit: { shape: 'sector', radius: 200, length: 0, width: 0, halfAngle: Math.PI },
  });
  assert.ok(validateSkill(wideSector).errors.some((e) => e.includes('반각')));

  /* 타격 시각 없음 */
  assert.ok(validateSkill(createSkill({ id: 'x11', name: 'x', pulsesMs: [] })).errors.some((e) => e.includes('타격')));

  /* 차수 범위 */
  assert.ok(validateSkill(createSkill({ id: 'x12', name: 'x', sTier: 9 })).errors.some((e) => e.includes('차수')));
});

test('validateSkill: 실행은 되지만 의도와 다를 수 있는 값은 경고로 분리한다', () => {
  /* 쿨다운 0 — 게임은 `cd > 0` 만 막으므로 매 프레임 시전된다 */
  const zeroCd = validateSkill(createSkill({ id: 'w1', name: 'x', cooldownMs: 0 }));
  assert.equal(zeroCd.ok, true, '쿨다운 0 은 실행 가능하므로 error 가 아니라 warning 이어야 한다');
  assert.ok(zeroCd.warnings.some((w) => w.includes('쿨다운')));

  /* 화면 밖 판정 */
  const huge = validateSkill(createSkill({
    id: 'w2', name: 'x', hit: { shape: 'circle', radius: 700, length: 0, width: 0, halfAngle: 0 },
  }));
  assert.equal(huge.ok, true);
  assert.ok(huge.warnings.some((w) => w.includes('범위')), huge.warnings.join(','));

  /* HUD 에서 잘리는 이름 (SkillButton 의 line-clamp:2, 8.5px · 18자 초과) */
  const longName = validateSkill(createSkill({ id: 'w3', name: '아주아주긴스킬이름이라서버튼에서잘려버립니다' }));
  assert.equal(longName.ok, true);
  assert.ok(longName.warnings.some((w) => w.includes('잘립')));

  /* 게임 실측 최대 배율 초과 */
  assert.ok(validateSkill(createSkill({ id: 'w4', name: 'x', mult: 12 })).warnings.some((w) => w.includes('최대')));

  /* 궁극기 보유 직업이 아님 — Player.skill5Unlocked 가 막는다 */
  const nonUlt = validateSkill(createSkill({ id: 'w5', name: 'x', cls: 'warlord', slot: 's5', kind: 'warlord' }));
  assert.equal(nonUlt.ok, true);
  assert.ok(nonUlt.warnings.some((w) => w.includes('궁극기 보유')), nonUlt.warnings.join(','));
});

test('validateSkillSet: ID 중복과 같은 (직업,슬롯) 충돌을 잡는다', () => {
  const a = createSkill({ id: 'dup_id', name: 'A', cls: 'warrior', slot: 's1' });
  const b = createSkill({ id: 'dup_id', name: 'B', cls: 'warrior', slot: 's2' });
  const v = validateSkillSet([a, b]);
  assert.equal(v.ok, false);
  /* 자기 자신을 중복으로 오인하지 않는다 — ID 당 정확히 1건만 보고한다 */
  assert.equal(v.errors.filter((e) => e.includes('쓰였습니다')).length, 1, v.errors.join('\n'));

  /* 같은 직업·같은 슬롯 — 게임은 하나만 실행한다 */
  const c = createSkill({ id: 'c1', name: 'C', cls: 'mage', slot: 's1' });
  const d = createSkill({ id: 'c2', name: 'D', cls: 'mage', slot: 's1' });
  const v2 = validateSkillSet([c, d]);
  assert.equal(v2.ok, false);
  assert.ok(v2.errors.some((e) => e.includes('이미')), v2.errors.join('\n'));

  /* 같은 슬롯이라도 직업이 다르면 허용 — 실제 게임도 직업마다 s1 을 갖는다 */
  const e = createSkill({ id: 'e1', name: 'E', cls: 'mage', slot: 's1' });
  const f = createSkill({ id: 'f1', name: 'F', cls: 'ranger', slot: 's1' });
  assert.equal(validateSkillSet([e, f]).ok, true, validateSkillSet([e, f]).errors.join('\n'));

  assert.equal(validateSkillSet([]).ok, false, '빈 묶음은 저장할 것이 없다');
});

/* ─────────────────────────── 직렬화 ─────────────────────────── */

test('save/load 왕복이 모든 필드를 보존한다', () => {
  const skills = [
    createSkill({
      id: 'round_trip', name: '왕복 시험', cls: 'archmage', slot: 's4', kind: 'manaburst',
      element: 'light', mp: 40, cooldownMs: 14000, mult: 3.14159, sTier: 4, ultSlot: 0,
      hit: { shape: 'sector', radius: 260.44, length: 0, width: 0, halfAngle: 0.72345 },
      startupMs: 300, recoveryMs: 160, pulsesMs: [0, 120, 240],
    }),
    createSkill({ id: 'plain', name: '무속성', element: 'none' }),
  ];
  const doc = serializeSkills({ name: 'unit-doc', skills });

  /* 사람이 읽는 형식: 스킬이 객체 배열로 그대로 보이고 version 이 있다 */
  assert.equal(doc.version, 1);
  assert.equal(doc.name, 'unit-doc');
  assert.equal(doc.skills.length, 2);
  assert.equal(doc.skills[0].id, 'round_trip');

  /* 숫자 반올림 규칙 — 배율 3자리, 판정 1자리, 반각 4자리 */
  assert.equal(doc.skills[0].mult, 3.142);
  assert.equal(doc.skills[0].hit.radius, 260.4);
  assert.equal(doc.skills[0].hit.halfAngle, 0.7235);

  const back = deserializeSkills(JSON.parse(JSON.stringify(doc)));
  assert.ok(back, '복원 실패');
  assert.equal(back.name, 'unit-doc');
  assert.equal(back.skills.length, 2);
  const r = back.skills[0];
  assert.equal(r.id, 'round_trip');
  assert.equal(r.name, '왕복 시험');
  assert.equal(r.cls, 'archmage');
  assert.equal(r.slot, 's4');
  assert.equal(r.kind, 'manaburst');
  assert.equal(r.element, 'light');
  assert.equal(r.mp, 40);
  assert.equal(r.cooldownMs, 14000);
  assert.equal(r.sTier, 4);
  assert.deepEqual(r.pulsesMs, [0, 120, 240]);
  assert.equal(r.hit.shape, 'sector');
  assert.equal(r.startupMs, 300);
  /* 복원된 값도 다시 검증을 통과해야 한다(왕복이 유효성을 깨지 않는다) */
  assert.equal(validateSkill(r).ok, true, validateSkill(r).errors.join(','));

  /* 두 번째 왕복도 동일 — 반올림이 누적되지 않는다 */
  const twice = deserializeSkills(JSON.parse(JSON.stringify(serializeSkills({ name: back.name, skills: back.skills }))));
  assert.deepEqual(twice, back);
});

test('deserializeSkills: 손상 입력을 거부한다', () => {
  const good = serializeSkills({ skills: [createSkill({ id: 'ok_1', name: '정상' })] });

  assert.equal(deserializeSkills(null), null);
  assert.equal(deserializeSkills('not json'), null);
  assert.equal(deserializeSkills({}), null);
  assert.equal(deserializeSkills({ version: 2, skills: good.skills }), null, '모르는 version 은 거부');
  assert.equal(deserializeSkills({ version: 1, skills: [] }), null, '빈 목록 거부');
  assert.equal(deserializeSkills({ version: 1 }), null, 'skills 키 없음');

  const bad = (mut) => {
    const doc = JSON.parse(JSON.stringify(good));
    mut(doc.skills[0]);
    return deserializeSkills(doc);
  };
  assert.equal(bad((s) => { s.id = 5; }), null, 'id 타입 오류');
  assert.equal(bad((s) => { s.slot = 's9'; }), null, '없는 슬롯');
  assert.equal(bad((s) => { s.cls = 'no_such_class'; }), null, '없는 직업');
  assert.equal(bad((s) => { s.kind = 'no_such_kind'; }), null, '슬롯에 없는 메커니즘');
  assert.equal(bad((s) => { s.element = 'plasma'; }), null, '없는 원소');
  assert.equal(bad((s) => { s.mult = '2.0'; }), null, '숫자 자리에 문자열');
  assert.equal(bad((s) => { s.hit = null; }), null, 'hit 없음');
  assert.equal(bad((s) => { s.hit.shape = 'triangle'; }), null, '없는 판정 형태');
  assert.equal(bad((s) => { s.pulsesMs = []; }), null, '타격 시각 없음');
  assert.equal(bad((s) => { s.pulsesMs = ['0']; }), null, '타격 시각 타입 오류');

  /* 값이 범위를 벗어난 것은 **거부하지 않는다** — 에디터가 보여주고 validateSkill 이
   *  표시해야 사용자가 고칠 수 있다(구조만 거부). */
  const negative = bad((s) => { s.mp = -5; });
  assert.ok(negative, '음수 MP 는 구조가 유효하므로 불러와야 한다');
  assert.equal(validateSkill(negative.skills[0]).ok, false, '그 대신 검증이 잡아야 한다');
});

/* ─────────────────────────── 계산 ─────────────────────────── */

test('previewDamage: 게임의 damageModel 과 같은 값을 낸다', () => {
  const skill = createSkill({ id: 'dmg', name: '피해', slot: 's1', mult: 2.5, sTier: 3, pulsesMs: [0, 120] });

  /* 손계산: mult 2.5 × skillMult 1(base) × tierScl(1+0.22*2)=1.44 × SKILL_PWR 1.25 = 4.5
   *  1000 atk × 4.5 = 4500, 2타 → 9000 */
  const p = previewDamage(skill, { atkTotal: 1000 });
  assert.equal(p.perHit, 4500);
  assert.equal(p.hits, 2);
  assert.equal(p.total, 9000);
  assert.equal(p.multiplier, 4.5);
  assert.equal(p.crit, false);

  /* 직업 보정은 bonusOf(cls) 에서 온다 — 인자로 넘기면 그 값이 이긴다 */
  const withCls = previewDamage({ ...skill, cls: 'warbringer' }, { atkTotal: 1000 });
  assert.ok(withCls.multiplier > 4.5, `직업 보정이 반영되지 않았다: ${withCls.multiplier}`);
  const forced = previewDamage({ ...skill, cls: 'warbringer' }, { atkTotal: 1000, clsSkillMult: 1 });
  assert.equal(forced.multiplier, 4.5, 'clsSkillMult 를 명시하면 그 값만 쓴다');

  /* 크리는 critDmg 를 곱한다 — 기본 1.7 (Player.CRIT_MULT) */
  const critP = previewDamage(skill, { atkTotal: 1000, crit: true });
  assert.equal(critP.perHit, Math.round(4500 * 1.7));
  assert.equal(critP.crit, true);

  /* 궁극기 슬롯은 고정 배율(×3.0 / ×5.0)로 대체된다 — 사다리·스킬배율이 곱해지지 않는다 */
  const ult1 = previewDamage(createSkill({ id: 'u1', name: 'u', slot: 's5', mult: 1 }), { atkTotal: 1000 });
  assert.equal(ult1.multiplier, 3.0);
  const ult2 = previewDamage(createSkill({ id: 'u2', name: 'u', slot: 's5b', mult: 1 }), { atkTotal: 1000 });
  assert.equal(ult2.multiplier, 5.0);

  /* 타수가 0 이 되지 않는다 — 최소 1회 */
  assert.equal(previewDamage(createSkill({ id: 'd0', name: 'd', pulsesMs: [0] }), { atkTotal: 10 }).hits, 1);
});

test('previewCooldownMs: Player.skillNMaxEff 의 차수 사다리와 같다', () => {
  /* Player.ts:349 — max(0.68, 1 - 0.08*(sTier-1)) × cdMult × (5차 ? 0.85 : 1) */
  assert.equal(COOLDOWN_TIER_STEP, 0.08);
  assert.equal(COOLDOWN_TIER_FLOOR, 0.68);
  assert.equal(FIFTH_CD_MULT, 0.85);

  const s = createSkill({ id: 'cd', name: 'c', cooldownMs: 4000, sTier: 1 });
  assert.equal(previewCooldownMs(s), 4000);
  assert.equal(previewCooldownMs({ ...s, sTier: 2 }), 3680);   // 4000 * 0.92
  assert.equal(previewCooldownMs({ ...s, sTier: 3 }), 3360);   // 4000 * 0.84
  assert.equal(previewCooldownMs({ ...s, sTier: 5 }), 2720);   // 4000 * 0.68 (하한)
  /* 하한 아래로 내려가지 않는다 */
  assert.equal(previewCooldownMs({ ...s, sTier: 9 }), 2720);

  /* 직업 cdMult 와 5차 보정 */
  assert.equal(previewCooldownMs(s, { cdMult: 0.9 }), 3600);
  assert.equal(previewCooldownMs(s, { isFifth: true }), 3400); // 4000 * 1 * 0.85
});

test('hitTest/zoneFor: 게임 판정 함수를 그대로 쓴다', () => {
  const beam = createSkill({
    id: 'b', name: '광선', hit: { shape: 'beam', radius: 0, length: 300, width: 80, halfAngle: 0 },
  });
  assert.equal(hitTest(beam, { x: 0, y: 0 }, 0, { x: 200, y: 0 }), true, '정면은 맞는다');
  assert.equal(hitTest(beam, { x: 0, y: 0 }, 0, { x: 200, y: 300 }), false, '옆은 안 맞는다');
  assert.equal(hitTest(beam, { x: 0, y: 0 }, 0, { x: -100, y: 0 }), false, '뒤는 안 맞는다');

  /* 원은 방향과 무관 */
  const circle = createSkill({ id: 'c', name: '원', hit: { shape: 'circle', radius: 150, length: 0, width: 0, halfAngle: 0 } });
  assert.equal(hitTest(circle, { x: 0, y: 0 }, 0, { x: 0, y: 150 }), true);
  assert.equal(hitTest(circle, { x: 0, y: 0 }, 0, { x: 0, y: 400 }), false);

  /* 부채꼴은 조준 방향을 따른다 — 각도를 돌리면 명중이 바뀐다 */
  const sector = createSkill({ id: 's', name: '부채', hit: { shape: 'sector', radius: 250, length: 0, width: 0, halfAngle: 0.5 } });
  assert.equal(hitTest(sector, { x: 0, y: 0 }, 0, { x: 200, y: 0 }), true);
  assert.equal(hitTest(sector, { x: 0, y: 0 }, Math.PI, { x: 200, y: 0 }), false);

  /* 도형 변환도 게임 좌표계 그대로 */
  assert.deepEqual(zoneFor(circle, { x: 5, y: 7 }, 0), { kind: 'circle', x: 5, y: 7, radius: 150 });
  assert.deepEqual(zoneFor(beam, { x: 1, y: 2 }, 0.5), { kind: 'beam', x: 1, y: 2, angle: 0.5, length: 300, width: 80 });
  assert.equal(zoneFor(sector, { x: 0, y: 0 }, 0).kind, 'sector');
});

test('maxMpAt: data.ts 의 공식(maxMp = 60 + 6*(lv-1))과 같다', () => {
  assert.equal(maxMpAt(1), 60);
  assert.equal(maxMpAt(200), 1254);
  /* 음수/0 레벨은 1로 클램프 — MP 가 음수가 되면 검증이 무의미해진다 */
  assert.equal(maxMpAt(0), 60);
  /* 그래서 궁극기 MP 150 은 해금 레벨(200)에서 충분하고, Lv1 에서는 부족하다 */
  assert.ok(maxMpAt(SLOT_RULES.s5.unlockLevel) > SLOT_RULES.s5.mp);
  assert.ok(maxMpAt(1) < SLOT_RULES.s5b.mp);
});

/* ─────────────────────────── 게임 연동 ─────────────────────────── */

test('skillsFromGame: 실제 게임 테이블을 그대로 복원한다', () => {
  const all = skillsFromGame();
  assert.ok(all.length > 100, `게임 스킬이 ${all.length}개뿐 — 테이블을 못 읽었다`);

  /* 전부 검증을 통과해야 한다 — 게임에 있는 것이 에디터에서 빨간불이면 안 된다 */
  const v = validateSkillSet(all);
  assert.equal(v.ok, true, v.errors.slice(0, 5).join('\n'));

  /* S1 은 무기 멘토 프로필에서 판정/타이밍을 가져온다(Player.useSkill1 과 같은 근거) */
  const berserkerS1 = all.find((s) => s.cls === 'berserker' && s.slot === 's1');
  assert.ok(berserkerS1, '버서커 S1 이 없다');
  assert.equal(berserkerS1.name, SKILL_LABELS.berserker[1]);
  assert.equal(berserkerS1.kind, 'ragespin');
  assert.equal(berserkerS1.hit.shape, 'sector', '태양검은 부채꼴(solar)이어야 한다');
  assert.equal(berserkerS1.startupMs, 180);
  assert.equal(berserkerS1.element, 'fire');

  /* 이름은 SKILL_LABELS 와 정확히 일치(지어내지 않았다) */
  const warlordS3 = all.find((s) => s.cls === 'warlord' && s.slot === 's3');
  assert.equal(warlordS3.name, SKILL_LABELS.warlord[3]);
  assert.equal(warlordS3.kind, 'warcry');

  /* 궁극기는 4차 10직업만 — Player.skill5Unlocked 의 ULT_CLASSES 와 같은 집합 */
  const ultClasses = new Set(all.filter((s) => s.slot === 's5').map((s) => s.cls));
  assert.deepEqual([...ultClasses].sort(), [...ULT_CLASSES].sort());
  const wb = all.find((s) => s.cls === 'warbringer' && s.slot === 's5');
  assert.equal(wb.name, SKILL5_INFO.warbringer.name);
  assert.equal(wb.sTier, 5);
  assert.equal(wb.mp, 100);

  /* 1차 직업은 s3/s4 가 없다 — SKILL3_KIND/SKILL4_KIND 에 1차 키가 없기 때문 */
  assert.equal(all.filter((s) => s.cls === 'warrior' && s.slot === 's3').length, 0);
  /* 2차 직업도 s3 가 없다 */
  assert.equal(all.filter((s) => s.cls === 'berserker' && s.slot === 's3').length, 0);
  /* 3차는 s3 까지, 4차는 s4 까지 */
  assert.ok(all.some((s) => s.cls === 'warlord' && s.slot === 's3'));
  assert.equal(all.filter((s) => s.cls === 'warlord' && s.slot === 's4').length, 0);
  assert.ok(all.some((s) => s.cls === 'warbringer' && s.slot === 's4'));

  /* 모든 직업이 s1/s2 를 갖는다 — 게임의 최소 스킬 구성 */
  for (const cls of Object.keys(CLASSES)) {
    assert.ok(all.some((s) => s.cls === cls && s.slot === 's1'), `${cls}: s1 없음`);
    assert.ok(all.some((s) => s.cls === cls && s.slot === 's2'), `${cls}: s2 없음`);
  }

  /* 로드한 묶음은 왕복 저장도 가능해야 한다 */
  const roundTrip = deserializeSkills(JSON.parse(JSON.stringify(serializeSkills({ name: 'game', skills: all }))));
  assert.ok(roundTrip);
  assert.equal(roundTrip.skills.length, all.length);
});

test('nextSkillId: 기존 ID 와 겹치지 않는 키를 만든다', () => {
  assert.equal(nextSkillId([]), 'skill_1');
  assert.equal(nextSkillId([{ id: 'skill_1' }]), 'skill_2');
  /* 구멍을 메운다 — 중간이 비면 그 번호를 재사용(목록이 무한히 커지지 않게) */
  assert.equal(nextSkillId([{ id: 'skill_1' }, { id: 'skill_3' }]), 'skill_2');
  /* 게임에서 가져온 ID(game_*) 와도 충돌하지 않는다 */
  assert.ok(!nextSkillId(skillsFromGame()).startsWith('game_'));
});
