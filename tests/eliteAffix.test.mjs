// vc236 — 정예 어픽스(eliteAffix) 순수 코어 검증
// 실행: node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs tests/eliteAffix.test.mjs
import assert from "node:assert/strict";

const {
  ELITE_AFFIXES, ELITE_AFFIX_KEYS,
  rollEliteAffixes, affixHpMult, affixAtkMult,
  swiftSpeedMult, thornReflect, regenPerTick, wardedShield,
  volatileDamage, splitSpawnCount, describeAffixes, hasAffix,
  THORN_MAX_PCT, VOLATILE_MAX_PCT, REGEN_MAX_PCT_PER_SEC, SWIFT_MAX_BONUS,
  WARDED_SHIELD_PCT, SPLIT_SPAWN,
} = await import("../src/game/combat/eliteAffix.ts");

let checks = 0;
const ok = (name, cond) => { assert.ok(cond, `✗ ${name}`); checks++; };

/* 시드 주입형 rng — mulberry32. 라이브러리 없이 결정론만 확인하면 되므로 자체 구현. */
const makeRng = (seed) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/* ── 1. 정의 테이블 계약 ── */
{
  const keys = Object.keys(ELITE_AFFIXES);
  ok("어픽스 6종", keys.length === 6 && ELITE_AFFIX_KEYS.length === 6);
  ok("키 목록과 정의 테이블이 일치한다", ELITE_AFFIX_KEYS.every((k) => ELITE_AFFIXES[k].key === k));
  ok("모든 정의에 한국어 이름/설명이 있다",
    ELITE_AFFIX_KEYS.every((k) => ELITE_AFFIXES[k].name.length > 0 && ELITE_AFFIXES[k].desc.length > 0));
  ok("모든 색이 hex 형식이다", ELITE_AFFIX_KEYS.every((k) => /^#[0-9a-f]{6}$/i.test(ELITE_AFFIXES[k].color)));
  ok("magnitudeRange 는 min ≤ max", ELITE_AFFIX_KEYS.every((k) => {
    const [lo, hi] = ELITE_AFFIXES[k].magnitudeRange;
    return lo <= hi;
  }));
  ok("모든 weight > 0", ELITE_AFFIX_KEYS.every((k) => ELITE_AFFIXES[k].weight > 0));
}

/* ── 2. 중복 없음 — 같은 rng 로 100회 굴려도 한 번도 겹치지 않는다 ── */
{
  const rng = makeRng(0xc0ffee);
  let dupFree = true;
  for (let i = 0; i < 100; i++) {
    const roll = rollEliteAffixes(rng, 3);
    const set = new Set(roll.map((a) => a.key));
    if (set.size !== roll.length) dupFree = false;
    if (roll.length !== 3) dupFree = false;
  }
  ok("100회 굴려도 중복 키가 없다 (maxCount=3)", dupFree);

  const rng2 = makeRng(7);
  let dupFree2 = true;
  for (let i = 0; i < 100; i++) {
    const roll = rollEliteAffixes(rng2, 6); // 전 종류 소진
    const set = new Set(roll.map((a) => a.key));
    if (set.size !== 6 || roll.length !== 6) dupFree2 = false;
  }
  ok("maxCount=6 이면 6종을 정확히 한 번씩 뽑는다", dupFree2);
}

/* ── 3. 결정론 — 같은 시드 → 같은 결과, 다른 시드 → (적어도 한 번은) 다른 결과 ── */
{
  const a = rollEliteAffixes(makeRng(12345), 3);
  const b = rollEliteAffixes(makeRng(12345), 3);
  assert.deepEqual(a, b); // 객체까지 동일
  checks++;
  ok("같은 시드 → 같은 어픽스 + 같은 magnitude", JSON.stringify(a) === JSON.stringify(b));

  /* 100개 시드 중 결과가 갈리는 게 있는지 (rng 가 실제로 소비되는지 확인) */
  const seen = new Set();
  for (let s = 0; s < 100; s++) seen.add(JSON.stringify(rollEliteAffixes(makeRng(s), 2)));
  ok("시드가 다르면 결과도 갈린다 (rng 를 실제로 소비한다)", seen.size > 1);
}

/* ── 4. magnitude 는 정의된 범위 안 (균등분포 위반 없음) ── */
{
  const rng = makeRng(999);
  let inRange = true;
  for (let i = 0; i < 200; i++) {
    for (const a of rollEliteAffixes(rng, 6)) {
      const [lo, hi] = ELITE_AFFIXES[a.key].magnitudeRange;
      if (!(a.magnitude >= lo && a.magnitude <= hi)) inRange = false;
    }
  }
  ok("모든 magnitude 가 magnitudeRange 안에 있다", inRange);
}

/* ── 5. maxCount 경계 — 0 / 기본값 2 / 상한 초과 클램프 ── */
{
  ok("maxCount 0 → 빈 배열", rollEliteAffixes(makeRng(1), 0).length === 0);
  ok("maxCount 생략 시 기본 2개", rollEliteAffixes(makeRng(1)).length === 2);
  ok("maxCount 1 → 1개", rollEliteAffixes(makeRng(1), 1).length === 1);
  ok("maxCount 99 → 6 으로 클램프", rollEliteAffixes(makeRng(1), 99).length === 6);
  ok("maxCount 음수 → 빈 배열", rollEliteAffixes(makeRng(1), -3).length === 0);
}

/* ── 6. 어픽스 0개 — 종전 정예와 완전히 동일해야 한다 ── */
{
  const none = [];
  ok("HP 배수 1.0", affixHpMult(none) === 1.0);
  ok("ATK 배수 1.0", affixAtkMult(none) === 1.0);
  ok("가속 1.0", swiftSpeedMult(none, 0, 0.4) === 1);
  ok("반사 0", thornReflect(none, 0.08, 10_000) === 0);
  ok("재생 0", regenPerTick(none, 0.02, 10_000, 1000) === 0);
  ok("실드 0", wardedShield(none, 10_000) === 0);
  ok("폭발 0", volatileDamage(none, 0.12, 10_000) === 0);
  ok("분열 0", splitSpawnCount(none) === 0);
  ok("설명 빈 문자열", describeAffixes(none) === "");
}

/* ── 7. 배수 — 개수만 늘고, 중복 키는 한 번만 센다 ── */
{
  const one = [{ key: "swift", magnitude: 0.2 }];
  const two = [...one, { key: "thorned", magnitude: 0.05 }];
  const three = [...two, { key: "volatile", magnitude: 0.09 }];

  ok("HP: 0개 1.0 / 1개 1.15 / 2개 1.35 / 3개 1.58",
    affixHpMult([]) === 1.0 && affixHpMult(one) === 1.15 &&
    affixHpMult(two) === 1.35 && affixHpMult(three) === 1.58);
  ok("ATK: 0개 1.0 / 1개 1.10 / 2개 1.22 / 3개 1.36",
    affixAtkMult([]) === 1.0 && affixAtkMult(one) === 1.1 &&
    affixAtkMult(two) === 1.22 && affixAtkMult(three) === 1.36);
  ok("중복 키는 1개로 센다", affixHpMult([one[0], one[0]]) === 1.15);
  ok("배수는 단조 증가한다", affixHpMult(one) > affixHpMult([]) &&
    affixHpMult(two) > affixHpMult(one) && affixHpMult(three) > affixHpMult(two));
  /* 기존 정예(hp×7.5) 위에 곱하는 구조 — 0개일 때 정확히 7.5 로 남는다 */
  ok("기존 정예 hp×7.5 를 대체하지 않는다", 7.5 * affixHpMult([]) === 7.5);
}

/* ── 8. 반사 상한 — 단일 피해의 8% 를 넘지 않는다 ── */
{
  const thorn = [{ key: "thorned", magnitude: 0.08 }];
  ok("반사: 1000 피해 → 80 이하", thornReflect(thorn, 0.08, 1000) <= 80);
  ok("반사: 굴림이 범위를 벗어나도 8% 상한", thornReflect(thorn, 9.9, 1000) <= 80);
  ok("반사: 큰 한 방에도 8% 상한", thornReflect(thorn, 0.08, 1_000_000) <= 80_000);
  ok("반사는 정수", Number.isInteger(thornReflect(thorn, 0.05, 333)));
  ok("반사는 음수 피해에서 0", thornReflect(thorn, 0.08, -500) === 0);
  ok("반사는 음수 magnitude 에서 0", thornReflect(thorn, -1, 1000) === 0);
  ok("반사 상수는 0.08", THORN_MAX_PCT === 0.08);

  /* 100회 무작위 대입 — 어떤 조합에서도 8% 초과 없음 */
  const rng = makeRng(4242);
  let over = false;
  for (let i = 0; i < 100; i++) {
    const dmg = Math.floor(rng() * 100_000);
    const mag = rng() * 2; // 일부러 범위 밖
    if (thornReflect(thorn, mag, dmg) > Math.floor(dmg * THORN_MAX_PCT)) over = true;
  }
  ok("반사: 100회 무작위 대입에서도 8% 초과 없음", !over);
}

/* ── 9. 폭발 상한 — 플레이어 최대HP의 12% 를 넘지 않는다 ── */
{
  const vol = [{ key: "volatile", magnitude: 0.12 }];
  const playerMaxHp = 1200;
  ok("폭발: 1200 HP → 144 이하", volatileDamage(vol, 0.12, playerMaxHp) <= 144);
  ok("폭발: 굴림이 범위를 벗어나도 12% 상한", volatileDamage(vol, 9.9, playerMaxHp) <= 144);
  ok("폭발: 큰 최대HP 에서도 12% 상한", volatileDamage(vol, 0.12, 10_000_000) <= 1_200_000);
  ok("폭발은 정수", Number.isInteger(volatileDamage(vol, 0.09, 777)));
  ok("폭발은 음수 maxHp 에서 0", volatileDamage(vol, 0.12, -100) === 0);
  ok("폭발 상수는 0.12", VOLATILE_MAX_PCT === 0.12);

  const rng = makeRng(8080);
  let over = false;
  for (let i = 0; i < 100; i++) {
    const hp = Math.floor(rng() * 20_000);
    const mag = rng() * 2;
    if (volatileDamage(vol, mag, hp) > Math.floor(hp * VOLATILE_MAX_PCT)) over = true;
  }
  ok("폭발: 100회 무작위 대입에서도 12% 초과 없음", !over);
}

/* ── 10. 재생 상한 — 정예 자신의 최대HP 대비 초당 2% ── */
{
  const regen = [{ key: "regenerating", magnitude: 0.02 }];
  const maxHp = 10_000;
  ok("재생: 1초에 2% 이하", regenPerTick(regen, 0.02, maxHp, 1000) <= maxHp * 0.02);
  ok("재생: 굴림이 범위를 벗어나도 2%/s 상한", regenPerTick(regen, 5, maxHp, 1000) <= maxHp * 0.02);
  ok("재생: 3초를 한 번에 넣어도 6% 이하", regenPerTick(regen, 0.02, maxHp, 3000) <= maxHp * 0.06);
  ok("재생: 16ms 틱에서 0 으로 깎이지 않는다(반올림 안 함)",
    regenPerTick(regen, 0.02, maxHp, 16) > 0);
  ok("재생: dtMs 0 이면 0", regenPerTick(regen, 0.02, maxHp, 0) === 0);
  ok("재생 상수는 초당 0.02", REGEN_MAX_PCT_PER_SEC === 0.02);

  /* 부동소수 비교는 순서만 달라도 흔들린다 — 상대오차 허용으로 검증한다. */
  let over = false;
  for (let dt = 1; dt <= 2000; dt += 7) {
    const limit = (maxHp * REGEN_MAX_PCT_PER_SEC * dt) / 1000;
    if (regenPerTick(regen, 5, maxHp, dt) > limit * (1 + 1e-9)) over = true;
  }
  ok("재생: 여러 dt 에서도 2%/s 초과 없음", !over);
}

/* ── 11. 가속 — HP 가 낮을수록 빠르고, 상한을 넘지 않는다 ── */
{
  const swift = [{ key: "swift", magnitude: 0.4 }];
  ok("가속 없으면 최대HP 에서도 1.0", swiftSpeedMult([], 0, 0.4) === 1);
  ok("HP 만땅이면 1.0", swiftSpeedMult(swift, 1, 0.4) === 1);
  ok("HP 0 이면 최대 가속", Math.abs(swiftSpeedMult(swift, 0, 0.4) - (1 + SWIFT_MAX_BONUS)) < 1e-9);
  ok("HP 가 낮을수록 빠르다",
    swiftSpeedMult(swift, 0.2, 0.4) > swiftSpeedMult(swift, 0.8, 0.4));
  ok("가속: 범위 밖 magnitude 도 상한 클램프",
    swiftSpeedMult(swift, 0, 99) <= 1 + SWIFT_MAX_BONUS);
  ok("가속: hp01 범위 밖(2) 도 1.0 으로 클램프", swiftSpeedMult(swift, 2, 0.4) === 1);
}

/* ── 12. 보호막 / 분열 / 설명 문자열 ── */
{
  const warded = [{ key: "warded", magnitude: 0.3 }];
  ok("실드는 최대HP 의 30%", Math.abs(wardedShield(warded, 1000) - 1000 * WARDED_SHIELD_PCT) < 1e-9);
  ok("실드: 음수 maxHp 는 0", wardedShield(warded, -50) === 0);

  const split = [{ key: "splitting", magnitude: 0.45 }];
  ok("분열은 2기", splitSpawnCount(split) === SPLIT_SPAWN && SPLIT_SPAWN === 2);

  const combo = [{ key: "volatile", magnitude: 0.09 }, { key: "regenerating", magnitude: 0.015 }];
  ok('설명: "폭발 · 재생"', describeAffixes(combo) === "폭발 · 재생");
  ok("설명: 중복 키는 한 번만", describeAffixes([combo[0], combo[0]]) === "폭발");
  ok("설명: 굴린 순서를 유지한다",
    describeAffixes([{ key: "thorned", magnitude: 0.05 }, { key: "volatile", magnitude: 0.09 }]) === "반사 · 폭발");
}

/* ── 13. hasAffix 게이트 — 정의에 있는 키만 참 ── */
{
  const roll = [{ key: "swift", magnitude: 0.3 }];
  ok("swift 있음", hasAffix(roll, "swift"));
  ok("volatile 없음", !hasAffix(roll, "volatile"));
  ok("빈 배열은 전부 false", ELITE_AFFIX_KEYS.every((k) => !hasAffix([], k)));
}

console.log(`eliteAffix: ${checks} checks passed`);
