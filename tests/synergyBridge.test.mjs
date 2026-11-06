// 시너지 브리지 검증 — 장비 → 태그 유도, 태그 0개 항등성
// 실행: node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs tests/synergyBridge.test.mjs
import assert from "node:assert/strict";

const { countSynergyTags, applySynergy, synergyFor } = await import("../src/game/synergyBridge.ts");
const { SYNERGY_TAGS, synergyTotals } = await import("../src/game/synergy.ts");

let checks = 0;
const ok = (name, cond) => { assert.ok(cond, `✗ ${name}`); checks++; };
const eq = (name, actual, expected) => {
  assert.deepEqual(actual, expected, `✗ ${name} — ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
  checks++;
};

const ZERO = { atkPct: 0, critAdd: 0, defPct: 0, hpPct: 0, cdrPct: 0, elemDmgPct: 0 };

/* ── 1. 태그 0개 → 모든 델타 정확히 0 (수치 보존 계약) ── */
{
  eq("장착 없음 → 태그 없음", countSynergyTags([]), {});
  const d = applySynergy(ZERO, { atk: 500, crit: 30, def: 80, maxHp: 3000, cdr: 1200 });
  eq("태그 0개 → 델타 전부 0", d, { atk: 0, crit: 0, def: 0, maxHp: 0, cdr: 0 });
  ok("태그 0개 → atk +0", d.atk === 0 && d.crit === 0 && d.def === 0 && d.maxHp === 0 && d.cdr === 0);
  /* 종전과 동일하다는 계약은 "0 을 더한다"로 성립한다 */
  const base = { atk: 500, crit: 30, def: 80, maxHp: 3000, cdr: 1200 };
  eq("종전 수치 그대로", {
    atk: base.atk + d.atk, crit: base.crit + d.crit, def: base.def + d.def,
    maxHp: base.maxHp + d.maxHp, cdr: base.cdr + d.cdr,
  }, base);
}

/* ── 2. 원소 → fire/frost/storm (ElemKey 실제 값만) ── */
{
  /* 세트 장비: 프리픽스 오프셋 버그로 setOfItem 이 null 이므로 SET_GEAR 직접 조회를 쓴다 */
  eq("화염 세트 무기 → fire + blade", countSynergyTags([{ key: "sfw_muspelheim" }]), { fire: 1, blade: 1 });
  eq("서리 세트 방어구 → frost + guard", countSynergyTags([{ key: "sfa_niflheim" }]), { frost: 1, guard: 1 });
  eq("전기 세트 장신구 → storm + vitality", countSynergyTags([{ key: "sfr_nidavellir" }]), { storm: 1, vitality: 1 });
  /* 대응 태그가 없는 원소는 원소 태그를 만들지 않는다 (억지 매핑 금지) */
  eq("자연 원소 → 원소 태그 없음", countSynergyTags([{ key: "sfw_forest" }]), { blade: 1 });
  eq("빛 원소 → 원소 태그 없음", countSynergyTags([{ key: "sfw_alfheim" }]), { blade: 1 });
  /* 명시된 elem 이 세트 유도보다 우선한다 */
  eq("elem 명시 우선", countSynergyTags([{ key: "sfw_forest", elem: "ice" }]), { frost: 1, blade: 1 });
  /* elem/setKey 직접 지정 경로 */
  eq("elem 직접 지정", countSynergyTags([{ key: "weapon_1", elem: "electric" }]), { storm: 1, blade: 1 });
  eq("setKey 직접 지정", countSynergyTags([{ key: "x", setKey: "muspelheim" }]), { fire: 1 });
}

/* ── 3. 종류 → blade/guard/vitality ── */
{
  eq("무기 → blade", countSynergyTags([{ key: "weapon_1" }]), { blade: 1 });
  eq("방어구 → guard", countSynergyTags([{ key: "armor_1" }]), { guard: 1 });
  ok("소모품은 태그 없음", Object.keys(countSynergyTags([{ key: "potion_hp" }])).length === 0);
  ok("없는 키여도 throw 하지 않는다", Object.keys(countSynergyTags([{ key: "___nope___" }])).length === 0);
  ok("null/undefined 안전", Object.keys(countSynergyTags([null, undefined])).length === 0);
}

/* ── 4. 누적 + 단계 발동까지 실제로 이어지는지 ── */
{
  const gear = [
    { key: "sfw_muspelheim" }, // fire, blade
    { key: "weapon_2" },       // blade
    { key: "weapon_3" },       // blade
  ];
  const counts = countSynergyTags(gear);
  eq("fire 1 · blade 3", counts, { fire: 1, blade: 3 });
  const totals = synergyFor(gear);
  eq("synergyFor == synergyTotals(counts)", totals, synergyTotals(counts));
  /* blade need 2 → 1단계 atkPct 0.03 */
  ok("blade 1단계 발동", Math.abs(totals.atkPct - 0.03) < 1e-9);
  const d = applySynergy(totals, { atk: 1000, crit: 10, def: 100, maxHp: 1000, cdr: 1000 });
  ok("공격력 델타 양수", d.atk > 0);
}

/* ── 5. applySynergy 수치 정확성 + 방어 ── */
{
  const t = { atkPct: 0.1, critAdd: 0.05, defPct: 0.04, hpPct: 0.03, cdrPct: 0.06, elemDmgPct: 0.2 };
  const d = applySynergy(t, { atk: 1000, crit: 10, def: 100, maxHp: 2000, cdr: 1000 });
  eq("atk 10% of 1000", d.atk, 100);
  eq("crit +5%p", d.crit, 5);
  eq("def 4% of 100", d.def, 4);
  eq("maxHp 3% of 2000", d.maxHp, 60);
  eq("cdr 6% of 1000", d.cdr, 60);
  /* 비정상 입력은 0 으로 접힌다 (음수 배율로 스탯이 깎이면 안 된다) */
  const bad = applySynergy({ ...ZERO, atkPct: -0.5, hpPct: 0.5 }, { atk: 100, crit: 0, def: 0, maxHp: NaN, cdr: 0 });
  eq("음수 배율 무시", bad.atk, 0);
  eq("NaN 기준값 무시", bad.maxHp, 0);
  ok("elemDmgPct 는 델타에 없다(별도 통로)", !("elemDmgPct" in d));
}

/* ── 6. 결정론 ── */
{
  const gear = [{ key: "sfw_muspelheim" }, { key: "sfa_hel" }, { key: "sfr_cave" }];
  const a = countSynergyTags(gear);
  const b = countSynergyTags(gear);
  eq("같은 입력 → 같은 출력", a, b);
  /* 입력 불변 */
  const snapshot = JSON.stringify(gear);
  countSynergyTags(gear);
  eq("입력 배열 비변형", JSON.stringify(gear), snapshot);
}

/* ── 7. 태그 정의와 어긋나지 않는지 (6태그 전부 실제 태그) ── */
{
  const counts = countSynergyTags([
    { key: "sfw_muspelheim" }, { key: "sfa_niflheim" }, { key: "sfr_nidavellir" },
  ]);
  for (const tag of Object.keys(counts)) {
    ok(`유효 태그: ${tag}`, tag in SYNERGY_TAGS);
  }
}

console.log(`synergyBridge: ${checks} checks OK`);
