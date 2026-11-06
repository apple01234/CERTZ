/**
 * starforce_sim.mjs — 스타포스 확률 실측 (유저 지적 #5 "확률 주작함??? 왜케 안붙음??")
 *
 * Player.tryUpgrade() / tryUpgradeAcc() 의 실제 굴림 로직을 그대로 옮겨 몬테카를로로 돌린다.
 * 목적: ① 공시 확률표가 조작인지 ② 도달 가능한 난이도인지 ③ vc263c 수정 전/후 비교.
 *
 * 실측 상수 (src/game/data.ts · entities/Player.ts 와 반드시 동기화):
 *   UPGRADE_RATES         = [100,85,70,55,40,35,30,25,20,15,12,10,8,6,5]
 *   UPGRADE_FALLBACK_FROM = 9    (★9 이상 = 하락 구간)
 *   STAR_PITY_FROM=9, STEP=5, MAX=15   (실패 가산 — 보조 완화)
 *   STAR_FALLBACK_STREAK  = 3    (vc263c: 3연속 실패 시에만 1성 하락)
 */

const UPGRADE_RATES = [100, 85, 70, 55, 40, 35, 30, 25, 20, 15, 12, 10, 8, 6, 5];
const UPGRADE_MAX = 15;
const UPGRADE_FALLBACK_FROM = 9;
const STAR_PITY_FROM = 9;
const STAR_PITY_STEP = 5;
const STAR_PITY_MAX = 15;
const STAR_BLESS_RATE = 15;
const STAR_BLESS_MAX = 3;

/** 재현 가능한 PRNG (xorshift32) */
function makeRand(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/**
 * @param streakNeeded 하락에 필요한 연속 실패 횟수 (1 = 종전 "매 실패마다 하락")
 * @param usePity      실패 가산(천장) 사용 여부
 */
function simulate({ startStar = 0, trials = 2000, blessPerTry = 0, streakNeeded = 3,
                    usePity = true, seed = 20261106, maxAttempts = 400_000 } = {}) {
  const rand = makeRand(seed);
  let totalAttempts = 0, totalFallbacks = 0, done = 0, unfinished = 0;
  const reach = new Array(UPGRADE_MAX + 1).fill(null);

  for (let t = 0; t < trials; t++) {
    let cur = startStar, pity = 0, streak = 0, att = 0;
    let guard = maxAttempts;
    while (cur < UPGRADE_MAX && guard-- > 0) {
      att++;
      const bless = Math.min(blessPerTry, STAR_BLESS_MAX);
      const p = usePity ? Math.min(pity, STAR_PITY_MAX) : 0;
      const rate = (UPGRADE_RATES[cur] ?? 0) + bless * STAR_BLESS_RATE + p;
      const ok = rand() * 100 < rate;
      if (ok) {
        pity = 0; streak = 0; cur += 1;
        if (reach[cur] === null) reach[cur] = att;
      } else {
        if (usePity && cur >= STAR_PITY_FROM) pity = Math.min(STAR_PITY_MAX, pity + STAR_PITY_STEP);
        if (cur >= UPGRADE_FALLBACK_FROM) {
          streak++;
          if (streak >= streakNeeded) { cur -= 1; totalFallbacks++; streak = 0; }
        }
      }
    }
    if (guard <= 0) unfinished++;
    else { totalAttempts += att; done++; }
  }
  return {
    mean: done ? totalAttempts / done : Infinity,
    median: reach[UPGRADE_MAX],
    fallbacks: done ? totalFallbacks / done : Infinity,
    unfinished,
  };
}

const fmt = (v) => (v === Infinity ? "INF" : Math.round(v).toLocaleString());

console.log("=== ① 도달 난이도: ★0 → ★15 (몬테카를로 2,000회) ===");
console.log("조건".padEnd(34), "평균시도".padStart(12), "★하락/판".padStart(12), "미완");
const rows = [
  ["종전 · 매 실패마다 하락", { streakNeeded: 1 }],
  ["종전 · 2연속 실패 하락", { streakNeeded: 2 }],
  ["vc263c · 3연속 실패 하락", { streakNeeded: 3 }],
  ["vc263c · 4연속 실패 하락", { streakNeeded: 4 }],
];
for (const [label, opt] of rows) {
  const r = simulate(opt);
  console.log(label.padEnd(34), fmt(r.mean).padStart(12), fmt(r.fallbacks).padStart(12), r.unfinished);
}

console.log("\n=== ② 주문서 사용 시 (vc263c 규칙 = 3연속) ===");
console.log("조건".padEnd(34), "평균시도".padStart(12), "★하락/판".padStart(12), "미완");
for (const [label, bless] of [["주문서 0장", 0], ["주문서 1장/시도", 1], ["주문서 3장/시도(최대)", 3]]) {
  const r = simulate({ blessPerTry: bless, streakNeeded: 3 });
  console.log(label.padEnd(34), fmt(r.mean).padStart(12), fmt(r.fallbacks).padStart(12), r.unfinished);
}

console.log("\n=== ③ 구간별 공시 확률과 기대 성장 (조작 여부 감사) ===");
console.log("구간".padEnd(13), "공시".padStart(6), "실패시".padStart(8), "기대(매실패)".padStart(13), "기대(3연속)".padStart(13));
for (let cur = 0; cur < UPGRADE_MAX; cur++) {
  const rate = UPGRADE_RATES[cur];
  const fallback = cur >= UPGRADE_FALLBACK_FROM;
  const p = rate / 100;
  /* 매 실패 하락: p(+1) + (1-p)(-1)  /  3연속 하락: 1/3 확률로만 -1 */
  const eOld = p * 1 + (1 - p) * (fallback ? -1 : 0);
  const eNew = p * 1 + (1 - p) * (fallback ? -1 / 3 : 0);
  const flag = fallback && eOld <= 0 ? "  ← 종전엔 손해" : "";
  console.log(
    `★${cur} → ★${cur + 1}`.padEnd(13),
    `${rate}%`.padStart(6),
    (fallback ? "하락" : "유지").padStart(8),
    eOld.toFixed(3).padStart(13),
    eNew.toFixed(3).padStart(13) + flag,
  );
}

console.log("\n=== ④ ★9 → ★15 만 반복 (하락 구간 체감) ===");
console.log("시작".padEnd(6), "종전(매실패)".padStart(14), "vc263c(3연속)".padStart(16));
for (let st = 9; st < UPGRADE_MAX; st++) {
  const o = simulate({ startStar: st, streakNeeded: 1, trials: 400 });
  const n = simulate({ startStar: st, streakNeeded: 3, trials: 400 });
  console.log(`★${st}`.padEnd(6), fmt(o.mean).padStart(14), fmt(n.mean).padStart(16));
}
