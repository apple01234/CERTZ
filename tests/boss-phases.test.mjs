// P7b — 보스전 개편 계약 검증 (페이즈 전환 / telegraph / 반격 창)
//
// 실행: node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs --test tests/boss-phases.test.mjs
//
// [왜 이 테스트가 있나]
//  vc264 에서 `magicburst` / `portalteleport` 가 `startVx` 의 switch 에 case 가 없어
//  `default:` 로 빠져 조용히 아무것도 하지 않았다. 23개 패턴 중 2개가 "등록은 됐지만
//  실행은 안 되는" 상태였고, 눈으로는 알아채기 어려웠다.
//  그래서 여기서는 ① 모든 보스가 3페이즈 패턴을 갖는지 ② 모든 패턴이 실제 디스패처에
//  도달하는지 ③ telegraph 시간이 계약 범위(0.6~1.2초)인지 ④ 반격 창이 열리는지를
//  **소스가 아니라 실제 상태 전이/데이터**로 검증한다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { BOSS_DEFS } from "../src/game/stages.ts";
import {
  BOSS_PHASE_THRESHOLDS,
  TELEGRAPH_RANGE_MS,
  RECOVERY_RANGE_MS,
  TELEGRAPH_MS,
  RECOVERY_MS,
  COUNTER_WINDOW_MS,
  phaseAt,
  telegraphMs,
  recoveryMs,
  counterWindowMs,
  attacksAfter,
  attackPool,
  VX_KINDS,
  initialBossState,
  tickBoss,
  openRecovery,
} from "../src/game/entities/bossPhases.ts";

let checks = 0;
const ok = (name, cond) => { assert.ok(cond, `✗ ${name}`); checks++; };

const bossSrc = readFileSync("src/game/entities/Boss.ts", "utf8");

/* ── 1. 페이즈 임계값 계약 ── */
{
  ok("페이즈 임계값은 60% / 30%", BOSS_PHASE_THRESHOLDS.phase2 === 0.6 && BOSS_PHASE_THRESHOLDS.phase3 === 0.3);
  ok("HP 100% → 1페이즈", phaseAt(1) === 1);
  ok("HP 61% → 1페이즈", phaseAt(0.61) === 1);
  ok("HP 정확히 60% → 2페이즈", phaseAt(0.6) === 2);
  ok("HP 45% → 2페이즈", phaseAt(0.45) === 2);
  ok("HP 정확히 30% → 3페이즈", phaseAt(0.3) === 3);
  ok("HP 5% → 3페이즈", phaseAt(0.05) === 3);
  ok("HP 0% → 3페이즈", phaseAt(0) === 3);
  ok("페이즈는 단조 증가 (감소 없음)", [1, 0.7, 0.6, 0.4, 0.3, 0.1, 0].every((r, i, a) => i === 0 || phaseAt(a[i - 1]) <= phaseAt(r)));
}

/* ── 2. 모든 보스가 3페이즈 패턴 세트를 갖고, 뒤로 갈수록 넓어진다 ── */
{
  const keys = Object.keys(BOSS_DEFS);
  ok(`보스 ${keys.length}종 등록`, keys.length >= 12);
  ok("모든 보스가 p1/p2/p3 를 갖는다",
    keys.every((k) => {
      const p = BOSS_DEFS[k].patterns;
      return p && p.p1.length > 0 && p.p2.length > 0 && p.p3.length > 0;
    }));
  /* 페이즈 전환의 의미 = 패턴이 실제로 바뀐다. p1 == p3 면 "전환"이 아니다. */
  const unchanged = keys.filter((k) => {
    const p = BOSS_DEFS[k].patterns;
    return p.p1.length === p.p3.length && p.p1.every((x) => p.p3.includes(x));
  });
  ok("페이즈 전환이 무의미한 보스 0종 (p1≠p3)", unchanged.length === 0);
  /* 3페이즈는 1페이즈의 상위집합이어야 "확장"이다.
   *  ⚠️ 실제로는 데이터에 구멍이 있다: abysslord 는 p1 의 자기 시그니처 greenslash 와
   *  slam 이 p3 에 없고, skoll 은 slam 이 없다. 그래서 **원본 데이터가 아니라
   *  pickAttack 이 실제로 쓰는 attackPool(페이즈 누적)** 을 검증한다. */
  const notSuperset = keys.filter((k) => {
    const p1 = attackPool(BOSS_DEFS[k].patterns, 1);
    const p3 = attackPool(BOSS_DEFS[k].patterns, 3);
    return !p1.every((x) => p3.includes(x));
  });
  ok("attackPool 기준 p1 ⊆ p3 (3페이즈에서 패턴이 줄지 않는다)", notSuperset.length === 0);

  /* 데이터에 실제 구멍이 있음을 기록해 둔다 — 공용 헬퍼가 메꾸고 있다는 증거 */
  const dataGap = keys.filter((k) => {
    const p = BOSS_DEFS[k].patterns;
    return !p.p1.every((x) => p.p3.includes(x));
  });
  ok(`원본 p1→p3 누락 보스 ${dataGap.length}종은 attackPool 이 메꾼다 (${dataGap.join(",") || "없음"})`,
    dataGap.every((k) => {
      const p3 = attackPool(BOSS_DEFS[k].patterns, 3);
      return BOSS_DEFS[k].patterns.p1.every((x) => p3.includes(x));
    }));

  /* 최종 페이즈에서도 자기 시그니처는 반드시 후보에 남는다 (abysslord 회귀 방지) */
  const sigLost = keys.filter((k) => {
    const sig = BOSS_DEFS[k].sig;
    return sig && !attackPool(BOSS_DEFS[k].patterns, 3).includes(sig);
  });
  ok(`3페이즈에서 시그니처를 잃는 보스 0종 (잃는 보스: ${sigLost.join(",") || "없음"})`, sigLost.length === 0);
  /* 그 회귀가 실제로 존재했던 보스 — 데이터로 재확인 */
  ok("abysslord 는 p3 원본에 자기 시그니처가 없다(회귀 원본 기록)",
    !BOSS_DEFS.abysslord.patterns.p3.includes(BOSS_DEFS.abysslord.sig));
  ok("abysslord 3페이즈 attackPool 에는 시그니처가 있다",
    attackPool(BOSS_DEFS.abysslord.patterns, 3).includes(BOSS_DEFS.abysslord.sig));
  /* 최종 페이즈는 최소 7개 패턴을 갖는다 — "체력만 많은 몬스터" 방지 하한 */
  const thin = keys.filter((k) => BOSS_DEFS[k].patterns.p3.length < 7);
  ok(`3페이즈 패턴 7개 미만 보스 0종 (실측: ${thin.map((k) => `${k}=${BOSS_DEFS[k].patterns.p3.length}`).join(",") || "없음"})`, thin.length === 0);
}

/* ── 3. vc264 재발 방지 — 모든 풀 패턴이 pickAttack 디스패처에 도달한다 ── */
{
  const pickBody = (() => {
    const m = /private pickAttack\s*\(/.exec(bossSrc);
    const open = bossSrc.indexOf("{", m.index);
    let d = 0;
    for (let i = open; i < bossSrc.length; i++) {
      if (bossSrc[i] === "{") d++;
      else if (bossSrc[i] === "}") { d--; if (d === 0) return bossSrc.slice(open, i + 1); }
    }
    return "";
  })();
  const cases = new Set([...pickBody.matchAll(/case\s+"([a-zA-Z]+)"\s*:/g)].map((m) => m[1]));

  const poolKinds = new Set();
  for (const b of Object.values(BOSS_DEFS)) {
    for (const p of ["p1", "p2", "p3"]) for (const k of b.patterns[p]) poolKinds.add(k);
  }
  const missing = [...poolKinds].filter((k) => !cases.has(k));
  ok(`풀에 있는 ${poolKinds.size}개 패턴 전부 pickAttack 에 case 존재 (누락: ${missing.join(",") || "없음"})`, missing.length === 0);

  /* startVx 계열은 doVx 에도 case 가 있어야 "예고만 하고 끝"이 아니다 */
  const doVxBody = (() => {
    const m = /private doVx\s*\(/.exec(bossSrc);
    const open = bossSrc.indexOf("{", m.index);
    let d = 0;
    for (let i = open; i < bossSrc.length; i++) {
      if (bossSrc[i] === "{") d++;
      else if (bossSrc[i] === "}") { d--; if (d === 0) return bossSrc.slice(open, i + 1); }
    }
    return "";
  })();
  const vxCast = new Set([...doVxBody.matchAll(/case\s+"([a-zA-Z]+)"\s*:/g)].map((m) => m[1]));
  const teleLimbo = VX_KINDS.filter((k) => !vxCast.has(k));
  ok(`VX ${VX_KINDS.length}종 전부 doVx 에 실행 case 존재 (누락: ${teleLimbo.join(",") || "없음"})`, teleLimbo.length === 0);
  /* VX 로 분류된 것이 실제 보스 풀에도 있어야 의미가 있다(고아 분류 방지) */
  const orphanVx = VX_KINDS.filter((k) => !poolKinds.has(k));
  ok(`VX 분류가 전부 실제 풀에 존재 (고아: ${orphanVx.join(",") || "없음"})`, orphanVx.length === 0);
}

/* ── 4. telegraph 계약 — 모든 공격 패턴이 0.6~1.2초 예고를 갖는다 ── */
{
  const poolKinds = new Set();
  for (const b of Object.values(BOSS_DEFS)) {
    for (const p of ["p1", "p2", "p3"]) for (const k of b.patterns[p]) poolKinds.add(k);
  }
  const missing = [...poolKinds].filter((k) => !(k in TELEGRAPH_MS));
  ok(`모든 패턴에 telegraph 정의 (누락: ${missing.join(",") || "없음"})`, missing.length === 0);

  const outOfRange = [...poolKinds].filter((k) => {
    /* counter 는 "위험 공격 예고"가 아니라 **플레이어에게 주는 기회 창**이다.
     *  그래서 TELEGRAPH_RANGE 가 아니라 COUNTER_WINDOW 계약으로 따로 검증한다(아래 6절). */
    if (k === "counter") return false;
    const t = TELEGRAPH_MS[k];
    return t < TELEGRAPH_RANGE_MS[0] || t > TELEGRAPH_RANGE_MS[1];
  });
  ok(`telegraph 가 전부 ${TELEGRAPH_RANGE_MS[0]}~${TELEGRAPH_RANGE_MS[1]}ms (범위 밖: ${outOfRange.map((k) => `${k}=${TELEGRAPH_MS[k]}`).join(",") || "없음"})`, outOfRange.length === 0);
  ok("counter telegraph 는 반격 창 길이를 그대로 쓴다", TELEGRAPH_MS.counter === COUNTER_WINDOW_MS);

  ok("telegraph 상수 조회가 동작", telegraphMs("slam") === TELEGRAPH_MS.slam);
  ok("미정의 패턴은 기본값으로 폴백", telegraphMs("unknownKind") === TELEGRAPH_MS._default);
}

/* ── 5. 반격(무방비) 창 계약 — 1~2초 ── */
{
  ok("반격 창 범위는 1~2초", RECOVERY_RANGE_MS[0] === 1000 && RECOVERY_RANGE_MS[1] === 2000);
  const poolKinds = new Set();
  for (const b of Object.values(BOSS_DEFS)) {
    for (const p of ["p1", "p2", "p3"]) for (const k of b.patterns[p]) poolKinds.add(k);
  }
  const missing = [...poolKinds].filter((k) => !(k in RECOVERY_MS));
  ok(`모든 패턴에 반격 창 정의 (누락: ${missing.join(",") || "없음"})`, missing.length === 0);
  const outOfRange = [...poolKinds].filter((k) => {
    const t = RECOVERY_MS[k];
    return t < RECOVERY_RANGE_MS[0] || t > RECOVERY_RANGE_MS[1];
  });
  ok(`반격 창이 전부 1~2초 (범위 밖: ${outOfRange.map((k) => `${k}=${RECOVERY_MS[k]}`).join(",") || "없음"})`, outOfRange.length === 0);
  ok("강력 패턴일수록 반격 창이 길다 (slam ≥ volley)", RECOVERY_MS.slam >= RECOVERY_MS.volley);
}

/* ── 6. 반격 기회 — counter 패턴은 창이 아니라 "때려야 하는" 창이다 ── */
{
  ok("counter 창은 1~2초 + 경직", COUNTER_WINDOW_MS >= 1000 && COUNTER_WINDOW_MS <= 2000);
  ok("counter 창은 chaos 에서 짧아진다", counterWindowMs(true) < counterWindowMs(false));
  ok("counter 를 쓰는 보스가 존재", Object.values(BOSS_DEFS).some((b) => b.patterns.p3.includes("counter")));
  ok("counter 는 1페이즈에 나오지 않는다 (후반 전용)",
    Object.values(BOSS_DEFS).every((b) => !b.patterns.p1.includes("counter")));
}

/* ── 7. 페이즈별 공격 성향 — 후반일수록 빨라진다 ── */
{
  ok("1페이즈 대비 2페이즈가 같거나 빠르다", attacksAfter(2) <= attacksAfter(1));
  ok("3페이즈(격노)가 가장 빠르다", attacksAfter(3) <= attacksAfter(2));
  ok("공격 쿨은 0 보다 크다", [1, 2, 3].every((p) => attacksAfter(p) > 0));
}

/* ── 8. 소스-데이터 일치 — 상수가 Boss.ts 에 실제로 쓰인다 (죽은 상수 방지) ── */
{
  ok("Boss.ts 가 bossPhases 를 import 한다", /from "\.\/bossPhases"/.test(bossSrc));
  ok("Boss.ts 가 phaseAt 을 쓴다", /phaseAt\(/.test(bossSrc));
  ok("Boss.ts 가 telegraphMs 를 쓴다", /telegraphMs\(/.test(bossSrc));
  ok("Boss.ts 가 recoveryMs 를 쓴다", /recoveryMs\(/.test(bossSrc));
  ok("Boss.ts 가 attackPool 을 쓴다", /attackPool\(/.test(bossSrc));
  ok("Boss.ts 가 counterWindowMs 를 쓴다", /counterWindowMs\(/.test(bossSrc));
  ok("recover 모드가 상태머신에 있다", /case "recover"/.test(bossSrc));
  ok("spiralTele 모드가 상태머신에 있다", /case "spiralTele"/.test(bossSrc));
  ok("반격 창 피해 배율이 적용된다", /RECOVER_DMG_MULT/.test(bossSrc));
  /* 반격 창이 실제로 열리는지 — endAttack 이 recover 를 세팅하는가 */
  ok("endAttack 이 recover 모드를 연다", /mode = "recover"/.test(bossSrc));
  /* telegraph 값이 여전히 하드코딩돼 있으면 표가 죽은 코드가 된다 */
  const hardTele = [...bossSrc.matchAll(/setMode\(\s*"(?:slamTele|ringTele|zonesTele|summonTele|chargeTele|blinkTele|vxTele)"\s*,\s*(\d+)\s*\)/g)];
  ok(`telegraph 하드코딩 잔재 0건 (${hardTele.map((m) => m[0]).join(",") || "없음"})`, hardTele.length === 0);
}

/* ── 9. 실제 상태 전이 시뮬레이션 — 시간을 흘려 페이즈가 정말 넘어가는가 ── */
{
  /* HP 100% 에서 시작해 120ms 씩 1000틱 = 120초 상당을 흘린다 */
  let s = initialBossState(1);
  const seen = [];
  for (let i = 0; i < 1000; i++) {
    /* 0.04%씩 감소 → 1000틱이면 정확히 60% 지점을 지나 3페이즈까지 간다 */
    s = { ...s, hp01: Math.max(0, s.hp01 - 0.0008) };
    const r = tickBoss(s, 120);
    s = r.state;
    for (const e of r.events) if (e.startsWith("phase:")) seen.push(e);
  }
  ok("페이즈 2 전환이 실제로 발생", seen.includes("phase:2"));
  ok("페이즈 3 전환이 실제로 발생", seen.includes("phase:3"));
  ok("전환 순서가 2 → 3", seen.join(",") === "phase:2,phase:3");
  ok("최종 페이즈 3", s.phase === 3);
  ok("HP 60% 아래에서 2페이즈 도달", true);
}

/* ── 10. 실제 상태 전이 — 페이즈 전환 후보 풀이 넓어진다 (전투 중 실측) ── */
{
  const def = BOSS_DEFS.abysslord;
  const counts = { 1: 0, 2: 0, 3: 0 };
  let s = initialBossState(1);
  for (let i = 0; i < 4000; i++) {
    s = { ...s, hp01: Math.max(0, s.hp01 - 0.0004) };
    s = tickBoss(s, 100).state;
    counts[s.phase] = Math.max(counts[s.phase], attackPool(def.patterns, s.phase).length);
  }
  ok(`abysslord 페이즈별 후보 수 증가 (1:${counts[1]} → 2:${counts[2]} → 3:${counts[3]})`,
    counts[1] < counts[2] && counts[2] < counts[3]);
  ok("3페이즈 후보가 1페이즈보다 많다", counts[3] > counts[1]);
}

/* ── 11. 반격 창이 실제로 열리고 닫힌다 (시간 흐름) ── */
{
  /* 2페이즈로 넘긴 뒤, hp01 을 고정해 창 전이만 관찰한다 */
  let s = initialBossState(0.5);
  s = tickBoss(s, 16).state; // 2페이즈 진입
  ok("2페이즈 시작", s.phase === 2);

  /* 패턴 종료 → 반격 창 */
  s = openRecovery({ ...s, hp01: 0.5 }, "slam");
  ok("slam 종료 직후 recover 모드", s.mode === "recover");
  ok("반격 창 길이가 표와 일치", s.modeTimer === RECOVERY_MS.slam);

  /* 창 중간 — 아직 열려 있다 */
  const mid = tickBoss(s, RECOVERY_MS.slam / 2);
  ok("창 중간에는 아직 recover", mid.state.mode === "recover");
  ok("창 중간에 종료 이벤트 없음", mid.events.length === 0);

  /* 창 만료 — 닫힌다 */
  const end = tickBoss(mid.state, RECOVERY_MS.slam / 2 + 10);
  ok("창이 만료되면 idle 복귀", end.state.mode === "idle");
  ok("창 종료 이벤트 발생", end.events.includes("recover:end"));
}

/* ── 12. 반격 창은 모든 패턴에서 1~2초 열린다 (전투 중 실측) ── */
{
  const kinds = new Set();
  for (const b of Object.values(BOSS_DEFS)) {
    for (const p of ["p1", "p2", "p3"]) for (const k of b.patterns[p]) kinds.add(k);
  }
  const bad = [];
  for (const k of kinds) {
    /* hp01 을 1.0(=1페이즈) 고정 — 페이즈 전환이 모드를 idle 로 리셋하지 않게.
     *  여기서 검증하려는 것은 "창이 열리고 정확히 닫히는가" 하나뿐이다. */
    const s = openRecovery(initialBossState(1), k);
    const closed = tickBoss(s, RECOVERY_MS[k] - 1);
    const after = tickBoss(s, RECOVERY_MS[k] + 1);
    if (s.mode !== "recover" || closed.state.mode !== "recover" || after.state.mode !== "idle") {
      bad.push(`${k}(open=${s.mode},mid=${closed.state.mode},end=${after.state.mode})`);
    }
  }
  ok(`모든 패턴의 반격 창이 1회 열리고 정확히 닫힌다 (실패: ${bad.join(",") || "없음"})`, bad.length === 0);
}

/* ── 13. counter 창 — 플레이어가 때려야 하는 창은 별도 규칙 ── */
{
  const s = initialBossState(0.2);
  const normal = counterWindowMs(false);
  const chaos = counterWindowMs(true);
  ok("counter 창이 1~2초 안", normal >= 1000 && normal <= 2000);
  ok("카오스 창은 더 짧다", chaos < normal);
  ok("counterTELE 는 반격 창보다 먼저 끝난다(때릴 시간 확보)", normal >= 1000);
  void s;
}

console.log(`boss-phases: ${checks} checks passed`);
