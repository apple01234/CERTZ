// 상태이상 확장 + 시너지 태그 검증
// 실행: node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs tests/synergy.test.mjs
import assert from "node:assert/strict";

const {
  STATUS_DEFS, MAX_RECEIVED_MULT, MAX_CRIT_BONUS, MIN_ATK_MULT,
  stackEffect, receivedDamageMult, critChanceBonus, atkMultFromStatuses,
  applyStatus, tickStatuses,
} = await import("../src/game/combat/statusEffects.ts");
const {
  SYNERGY_TAGS, MAX_TOTAL_ATK_PCT, MAX_TOTAL_CRIT_ADD, MAX_TOTAL_CDR_PCT,
  activeTier, synergyTotals, describeSynergies,
} = await import("../src/game/synergy.ts");

let checks = 0;
const ok = (name, cond) => { assert.ok(cond, `✗ ${name}`); checks++; };

/* ── 1. SYNERGY_TAGS 정의 — 6태그 × 3단계(need 2/4/6) ── */
{
  const tags = ["fire", "frost", "storm", "blade", "guard", "vitality"];
  ok("태그 6종", Object.keys(SYNERGY_TAGS).length === 6);
  ok("모든 태그에 이름/색/3단계", tags.every((t) => {
    const d = SYNERGY_TAGS[t];
    return d && d.name && /^#[0-9a-f]{6}$/i.test(d.color) && d.tiers.length === 3;
  }));
  ok("need 는 전 태그 공통 2/4/6",
    tags.every((t) => SYNERGY_TAGS[t].tiers.map((x) => x.need).join(",") === "2,4,6"));
  ok("3단계는 태그 정체성 효과를 갖는다(전부 서로 다르지 않아도, 3단계마다 최소 1개 고유 필드)",
    tags.every((t) => {
      const t3 = SYNERGY_TAGS[t].tiers[2];
      return Object.keys(t3).some((k) => k !== "need" && k !== "desc" && typeof t3[k] === "number");
    }));
  /* fire 3단계는 elemDmgPct, guard 3단계는 defPct — 스펙이 든 예시 그대로 */
  ok("fire 3단계 = 원소 피해", (SYNERGY_TAGS.fire.tiers[2].elemDmgPct ?? 0) > 0);
  ok("guard 3단계 = 방어력", (SYNERGY_TAGS.guard.tiers[2].defPct ?? 0) > 0);
  ok("desc 는 비어있지 않다", tags.every((t) => SYNERGY_TAGS[t].tiers.every((x) => x.desc.length > 0)));
}

/* ── 2. activeTier 경계값 — 0/1/2/3/4/6 ── */
{
  const exp = [[0, 0], [1, 0], [2, 1], [3, 1], [4, 2], [5, 2], [6, 3], [7, 3], [99, 3]];
  ok("activeTier 경계값 0/1/2/3/4/6",
    exp.every(([count, tier]) => activeTier("fire", count) === tier));
  ok("activeTier 는 모든 태그에서 동일 규칙",
    exp.every(([count, tier]) =>
      ["fire", "frost", "storm", "blade", "guard", "vitality"].every((t) => activeTier(t, count) === tier)));
  /* 방어: 음수/NaN/소수 */
  ok("음수는 0단계", activeTier("fire", -5) === 0);
  ok("NaN 은 0단계", activeTier("fire", NaN) === 0);
  ok("소수는 내림(3.9 → 3개 → 1단계)", activeTier("fire", 3.9) === 1);
}

/* ── 3. synergyTotals — 합산 정확성 + 누적형 ── */
{
  const zero = synergyTotals({});
  ok("태그 없음 → 전부 0",
    zero.atkPct === 0 && zero.critAdd === 0 && zero.defPct === 0 &&
    zero.hpPct === 0 && zero.cdrPct === 0 && zero.elemDmgPct === 0);

  /* fire: 2 → 1단계, 4 → 1+2단계 누적 */
  const f2 = synergyTotals({ fire: 2 });
  ok("fire 2 → atk 0.02", f2.atkPct === 0.02);
  const f4 = synergyTotals({ fire: 4 });
  ok("fire 4 → 1단계+2단계 누적(atk 0.06)", f4.atkPct === 0.06);
  ok("fire 4 → elem 0.15", f4.elemDmgPct === 0.15);

  /* 여러 태그 동시 집계 */
  const multi = synergyTotals({ fire: 4, blade: 4, storm: 4, guard: 2 });
  /* fire4=.02+.04 / blade4=.03+.06 / storm4=.02+.03 → 누적 합 0.20 */
  ok("다중 태그 atk = fire.06 + blade.09 + storm.05", multi.atkPct === 0.2);
  ok("다중 태그 crit = storm .03+.05", multi.critAdd === 0.08);
  ok("다중 태그 cdr = storm.02", multi.cdrPct === 0.02);
  ok("다중 태그 elem = fire.15 + 0", multi.elemDmgPct === 0.15);
  ok("다중 태그 def = guard.04", multi.defPct === 0.04);
  ok("다중 태그 hp = guard.02", multi.hpPct === 0.02);

  /* 한 태그만 6개여도 다른 태그는 0 */
  const onlyBlade = synergyTotals({ blade: 6 });
  ok("blade 6 → atk 0.19", onlyBlade.atkPct === 0.19);
  ok("blade 6 → crit 0.03", onlyBlade.critAdd === 0.03);
  ok("blade 6 → cdr 0", onlyBlade.cdrPct === 0);
}

/* ── 4. 상한 준수 — 극단(전 태그 6개)에서도 넘지 않는다 ── */
{
  const all6 = { fire: 6, frost: 6, storm: 6, blade: 6, guard: 6, vitality: 6 };
  const t = synergyTotals(all6);
  ok("극단 atkPct ≤ 0.60", t.atkPct <= MAX_TOTAL_ATK_PCT && MAX_TOTAL_ATK_PCT === 0.6);
  ok("극단 critAdd ≤ 0.20", t.critAdd <= MAX_TOTAL_CRIT_ADD && MAX_TOTAL_CRIT_ADD === 0.2);
  ok("극단 cdrPct ≤ 0.20", t.cdrPct <= MAX_TOTAL_CDR_PCT && MAX_TOTAL_CDR_PCT === 0.2);
  /* 설계값이 실제로 얼마인지 고정 — 나중에 단계를 올리면 이 테스트가 먼저 깨진다 */
  ok("극단 atkPct = 0.41", t.atkPct === 0.41);
  ok("극단 critAdd = 0.18", t.critAdd === 0.18);
  ok("극단 cdrPct = 0.19", t.cdrPct === 0.19);

  /* 상한보다 큰 입력(개수를 왕창 넣어도) 3단계에서 포화 */
  const huge = synergyTotals({ fire: 9999, storm: 9999, blade: 9999, frost: 9999 });
  ok("개수 폭주해도 3단계 포화 — 극단과 동일", JSON.stringify(huge) === JSON.stringify(
    synergyTotals({ fire: 6, storm: 6, blade: 6, frost: 6 })));
  ok("폭주 입력도 atkPct ≤ 0.60", huge.atkPct <= 0.6);
  ok("폭주 입력도 critAdd ≤ 0.20", huge.critAdd <= 0.2);
  ok("폭주 입력도 cdrPct ≤ 0.20", huge.cdrPct <= 0.2);
}

/* ── 5. describeSynergies — HUD 문자열 ── */
{
  const lines = describeSynergies({ fire: 2, blade: 0, storm: 3 });
  ok("0개 태그는 표시하지 않는다", lines.length === 2);
  ok("화염 2/4 — 공격력 +2% 형태", lines[0].startsWith("화염 2/4 — 공격력 +2%"));
  ok("스톰(3개, 1단계) → 폭풍 3/4", lines[1].startsWith("폭풍 3/4 — "));
  ok("없는 태그 → 빈 배열", describeSynergies({}).length === 0);
  /* 1개(1단계 미만)는 다음 단계까지 남은 개수를 보여준다 */
  const one = describeSynergies({ fire: 1 });
  ok("1개는 1/2 + 남은 개수 안내", one[0] === "화염 1/2 — 다음 단계까지 1");
  /* 6개(3단계 완료)는 임계값을 반복한다 */
  const maxed = describeSynergies({ fire: 6 });
  ok("6개는 6/6", maxed[0].startsWith("화염 6/6 — "));
  ok("6개는 3단계 효과를 보여준다", maxed[0].includes("원소 피해 +18%"));
  /* 순서 고정 — 입력 키 순서와 무관 */
  ok("표시 순서 고정(fire→frost→storm→blade→guard→vitality)",
    describeSynergies({ vitality: 2, fire: 2 })[0].startsWith("화염"));
}

/* ── 6. 결정론 — 동일 입력 → 동일 출력 ── */
{
  const counts = { fire: 5, frost: 2, blade: 6, guard: 3 };
  ok("synergyTotals 결정론",
    JSON.stringify(synergyTotals(counts)) === JSON.stringify(synergyTotals({ ...counts })));
  ok("describeSynergies 결정론",
    JSON.stringify(describeSynergies(counts)) === JSON.stringify(describeSynergies({ ...counts })));
  const src = { fire: 6 };
  synergyTotals(src);
  ok("입력 객체를 변형하지 않는다", JSON.stringify(src) === '{"fire":6}');
}

/* ── 7. STATUS_DEFS 정의 ── */
{
  const keys = ["slow", "stun", "dot", "chill", "shock", "mark", "weaken"];
  ok("상태 7종", Object.keys(STATUS_DEFS).length === 7 && keys.every((k) => STATUS_DEFS[k]));
  ok("모든 상태에 이름/설명/색/스택/지속/가중치", keys.every((k) => {
    const d = STATUS_DEFS[k];
    return d.key === k && d.name && d.desc && /^#[0-9a-f]{6}$/i.test(d.color)
      && d.maxStacks >= 1 && d.durationRange[0] <= d.durationRange[1] && d.weight > 0;
  }));
  /* 신규 4종이 실제로 있는지 (스펙의 핵심) */
  ok("chill/shock/mark/weaken 정의됨",
    ["chill", "shock", "mark", "weaken"].every((k) => STATUS_DEFS[k].name));
}

/* ── 8. stackEffect — 스택 포화 ── */
{
  ok("mark 0스택 = 0", stackEffect("mark", 0) === 0);
  ok("mark 4스택 = 0.24", stackEffect("mark", 4) === 0.24);
  ok("mark 99스택도 0.24(포화)", stackEffect("mark", 99) === 0.24);
  ok("weaken 4스택 = 0.4", stackEffect("weaken", 4) === 0.4);
  ok("chill 3스택 = 0.18", stackEffect("chill", 3) === 0.18);
  ok("stun 은 이진(1스택)", stackEffect("stun", 1) === 1 && stackEffect("stun", 3) === 1);
  ok("음수 스택 = 0", stackEffect("mark", -3) === 0);
}

/* ── 9. receivedDamageMult — 상한 1.6 ── */
{
  ok("상태 없음 = 1", receivedDamageMult([]) === 1);
  ok("mark 만 있어도 받는 피해는 는다", receivedDamageMult([{ key: "mark", stacks: 4 }]) === 1.2);
  ok("chill 3 = 1.18", receivedDamageMult([{ key: "chill", stacks: 3 }]) === 1.18);
  ok("shock 2 = 1.20", receivedDamageMult([{ key: "shock", stacks: 2 }]) === 1.2);
  ok("합산(chill3+shock2+mark4) = 1.58",
    receivedDamageMult([
      { key: "chill", stacks: 3 }, { key: "shock", stacks: 2 }, { key: "mark", stacks: 4 },
    ]) === 1.58);
  /* 상한: 중복 엔트리로도 우회 불가 */
  const dup = [];
  for (let i = 0; i < 20; i++) dup.push({ key: "shock", stacks: 2 }, { key: "chill", stacks: 3 });
  ok("중복 엔트리 폭주해도 ≤ 1.6", receivedDamageMult(dup) <= MAX_RECEIVED_MULT);
  ok("중복 엔트리는 병합된다(shock+chill = 1.38)", receivedDamageMult(dup) === 1.38);
  ok("받는 피해 배수는 항상 ≤ 1.6", receivedDamageMult(dup) <= 1.6 && MAX_RECEIVED_MULT === 1.6);
  ok("slow/dot 은 받는 피해에 기여하지 않는다",
    receivedDamageMult([{ key: "slow", stacks: 3 }, { key: "dot", stacks: 5 }]) === 1);
}

/* ── 10. critChanceBonus — 상한 0.25 ── */
{
  ok("mark 없음 = 0", critChanceBonus([{ key: "chill", stacks: 3 }]) === 0);
  ok("mark 2 = 0.12", critChanceBonus([{ key: "mark", stacks: 2 }]) === 0.12);
  ok("mark 4 = 0.24", critChanceBonus([{ key: "mark", stacks: 4 }]) === 0.24);
  ok("치명타 가산 ≤ 0.25", critChanceBonus([{ key: "mark", stacks: 999 }]) <= MAX_CRIT_BONUS);
}

/* ── 11. atkMultFromStatuses — 하한 0.6 ── */
{
  ok("weaken 없음 = 1", atkMultFromStatuses([{ key: "chill", stacks: 3 }]) === 1);
  ok("weaken 2 = 0.8", atkMultFromStatuses([{ key: "weaken", stacks: 2 }]) === 0.8);
  ok("weaken 4 = 0.6(정확히 하한)", atkMultFromStatuses([{ key: "weaken", stacks: 4 }]) === 0.6);
  ok("weaken 폭주해도 하한 0.6", atkMultFromStatuses([{ key: "weaken", stacks: 100 }]) === MIN_ATK_MULT);
  ok("공격력 배수는 항상 ≥ 0.6", atkMultFromStatuses([{ key: "weaken", stacks: 100 }]) >= 0.6);
}

/* ── 12. applyStatus — 순수, 중첩/갱신 ── */
{
  const base = [];
  const one = applyStatus(base, "chill", 1, 2000);
  ok("빈 배열에 부여", one.length === 1 && one[0].key === "chill" && one[0].stacks === 1);
  ok("원본 배열 불변", base.length === 0);
  const two = applyStatus(one, "chill", 1, 1000);
  ok("스택 누적", two.length === 1 && two[0].stacks === 2);
  ok("지속시간은 갱신(max) — 짧은 재적용이 깎지 않는다", two[0].remainingMs === 2000);
  ok("입력 배열은 변형되지 않는다", one[0].stacks === 1);
  const capped = applyStatus(applyStatus(one, "chill", 9), "chill", 9);
  ok("maxStacks 포화", capped[0].stacks === STATUS_DEFS.chill.maxStacks);
  const twoKinds = applyStatus(one, "mark", 2, 5000);
  ok("다른 key 는 별도 엔트리", twoKinds.length === 2 && twoKinds.some((s) => s.key === "mark"));
}

/* ── 13. tickStatuses — 만료 처리 ── */
{
  const live = [{ key: "chill", stacks: 1, remainingMs: 500 }];
  const half = tickStatuses(live, 200);
  ok("200ms 흐르면 300ms 남는다", half.statuses.length === 1 && half.statuses[0].remainingMs === 300);
  ok("만료 없음", half.expired.length === 0);
  ok("입력은 변형되지 않는다(remainingMs 500 유지)", live[0].remainingMs === 500);

  const gone = tickStatuses(live, 600);
  ok("600ms 흐르면 만료", gone.statuses.length === 0);
  ok("만료 key 를 보고한다", gone.expired.length === 1 && gone.expired[0] === "chill");

  /* 정확히 0 이 되는 순간 만료 (<= 0) */
  const edge = tickStatuses(live, 500);
  ok("정확히 0 이면 만료", edge.statuses.length === 0 && edge.expired[0] === "chill");

  const mixed = tickStatuses([
    { key: "chill", stacks: 2, remainingMs: 1000 },
    { key: "mark", stacks: 1, remainingMs: 100 },
  ], 300);
  ok("살아남은 것만 남는다", mixed.statuses.length === 1 && mixed.statuses[0].key === "chill");
  ok("만료는 mark 만", mixed.expired.length === 1 && mixed.expired[0] === "mark");
  ok("dt 0 이면 그대로", tickStatuses(live, 0).statuses.length === 1);
  ok("빈 배열 tick 안전", tickStatuses([], 100).statuses.length === 0);
}

console.log(`synergy: ${checks} checks passed`);
