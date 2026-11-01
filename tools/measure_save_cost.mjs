/**
 * vc229 — 세이브 비용 실측.
 *
 * 목적: "세이브 방식 개선"에서 **무엇이 실제로 비싼지** 수치로 확정한다.
 * 추측으로 구조를 바꾸면 위험만 늘어난다.
 *
 * 측정 항목
 *  1. 세이브 1건 JSON 크기 (필드별 기여도)
 *  2. DB 전체 암호화·base64 시간 (유저 수별)
 *  3. GitHub Contents API 페이로드 크기 (= 매 저장마다 재전송되는 양)
 *
 * 실행: node tools/measure_save_cost.mjs
 */
import crypto from "node:crypto";

/* ---- 실제 SaveData 와 같은 형태의 표본을 만든다 ---- */
function makeSave(level, opts = {}) {
  const n = level; // 진행도 척도
  return {
    v: 1, gold: 100000 + n * 1000, emerald: 50 + n, level,
    name: "테스트", cls: "warrior", jobTier: 4, exp: 123456789,
    hp: 1000, mp: 500, str: 100, dex: 100, int: 100, vit: 100, luk: 100,
    pot: { hp: 10, mp: 8 }, autoAlloc: false, autoHunt: true,
    stage: "ch3_4", questIdx: { ch1: 10, ch2: 8, ch3: 3 },
    owned: Array.from({ length: 40 + n }, (_, i) => `item_${i}`),
    accessories: Array.from({ length: 12 + n }, (_, i) => `acc_${i}`),
    cosmetics: Array.from({ length: 20 + n }, (_, i) => `cos_${i}`),
    pets: Array.from({ length: 5 + Math.min(n, 10) }, (_, i) => `pet_${i}`),
    figures: Array.from({ length: 15 + n }, (_, i) => `fig_${i}`),
    badges: Array.from({ length: 8 + n }, (_, i) => `bdg_${i}`),
    badgeSlots: ["a", "b", "c"], runeSlots: ["r1", "r2", null, null],
    constel: Array.from({ length: 10 + n }, (_, i) => `c_${i}`),
    unlockedSets: Array.from({ length: 5 + n }, (_, i) => `set_${i}`),
    coupons: ["WELCOME", "NEWYEAR"],
    achClaimed: Array.from({ length: 30 + n * 2 }, (_, i) => `ach_${i}`),
    gateStars: Array.from({ length: 27 }, () => true),
    seen: Array.from({ length: 100 + n * 3 }, (_, i) => `seen_${i}`),
    visited: Array.from({ length: 50 + n * 2 }, (_, i) => `vis_${i}`),
    tutSeen: Array.from({ length: 20 }, (_, i) => `tut_${i}`),
    monsterKills: Object.fromEntries(Array.from({ length: 40 + n }, (_, i) => [`mon_${i}`, 100 + i])),
    fragmentsFound: Object.fromEntries(Array.from({ length: 20 + n }, (_, i) => [`frag_${i}`, 3])),
    accUp: Object.fromEntries(Array.from({ length: 12 + n }, (_, i) => [`acc_${i}`, i])),
    buffItems: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`buf_${i}`, i * 2])),
    gatherBag: Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`g_${i}`, 10])),
    potentials: Object.fromEntries(Array.from({ length: 10 + n }, (_, i) => [`pot_${i}`, { grade: (i % 5) + 1, lv: i }])),
    starMap: Object.fromEntries(Array.from({ length: 10 + n }, (_, i) => [`star_${i}`, i])),
    runes: Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`rune_${i}`, i])),
    chibiQuests: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`cq_${i}`, { done: 1, t: 0 }])),
    questAccepted: { q1: 1, q2: 1 },
    jobStoryDone: [1, 2, 3], repeatProg: [3, 0, 1],
    fishing: { caught: Array.from({ length: 20 + n }, (_, i) => `fish_${i}`), rod: 3, bait: 20 },
    daily: { date: "2026-11-01", hunts: 5, gate: 1, closet: 1, farms: 2, bosses: 1, praid: 0, claimed: [], ads: 3, adChest: 1, adDrop: 2 },
    pass: { season: "s1", xp: 5000, prem: true, claimedFree: [1, 2, 3], claimedPrem: [1], subUntil: 0 },
    missions: { day: "2026-11-01", week: "w44", daily: { d1: 3, d2: 5 }, weekly: { w1: 10 }, claimedDaily: [], claimedWeekly: [] },
    inf: { towerBest: 50, closetTier: 4, trialDone: "20", rebirths: 2, mats: { a: 100, b: 50 }, petLv: 30, petExp: 9999, abyss: 12, orbs: { o1: 3, o2: 1 }, rebirthEss: 400 },
    ...(opts.extra || {}),
  };
}

const sizes = { mid: makeSave(60), high: makeSave(200), max: makeSave(400) };

console.log("=== 1) 세이브 1건 크기 ===");
for (const [k, v] of Object.entries(sizes)) {
  const j = JSON.stringify(v);
  console.log(`  ${k.padEnd(5)} ${(j.length / 1024).toFixed(1)} KB`);
}

/* 필드별 기여도 (가장 큰 세이브 기준) */
console.log("\n=== 2) 크기 상위 필드 (max) ===");
const maxSave = sizes.max;
const contrib = Object.entries(maxSave)
  .map(([k, v]) => [k, JSON.stringify(v).length])
  .sort((a, b) => b[1] - a[1]);
for (const [k, n] of contrib.slice(0, 8)) {
  console.log(`  ${k.padEnd(18)} ${(n / 1024).toFixed(1)} KB`);
}
const total = JSON.stringify(maxSave).length;
const top8 = contrib.slice(0, 8).reduce((s, [, n]) => s + n, 0);
console.log(`  상위 8개 = ${(top8 / 1024).toFixed(1)} KB / 전체 ${(total / 1024).toFixed(1)} KB (${((top8 / total) * 100).toFixed(0)}%)`);

/* ---- 3) 암복호화 + base64 비용 (유저 수별) ---- */
console.log("\n=== 3) 전체 DB 암호화 비용 (저장 1회당) ===");
const KEY = crypto.randomBytes(32);
function encrypt(json) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([c.update(json, "utf8"), c.final()]);
  return Buffer.concat([Buffer.from("SZBK1"), iv, c.getAuthTag(), enc]).toString("base64");
}

console.log("  유저수  DB크기    암호화   base64    합계   GitHub PUT 본문");
for (const users of [10, 50, 200, 500, 1000]) {
  const db = {
    users: Object.fromEntries(Array.from({ length: users }, (_, i) => [`u${i}`, { id: `u${i}`, name: `n${i}`, salt: "a".repeat(32), hash: "b".repeat(128), createdAt: 1, role: "user" }])),
    tokens: Object.fromEntries(Array.from({ length: users * 2 }, (_, i) => [`t${i}`, { userId: `u${i % users}`, expiresAt: 9e12 }])),
    saves: Object.fromEntries(Array.from({ length: users }, (_, i) => [`u${i}`, { data: sizes.mid, updatedAt: 1 }])),
    market: { nextId: 100, listings: {} },
    payouts: {}, rank: {}, charNames: {}, iapUsed: {},
  };
  const json = JSON.stringify(db);
  const t0 = performance.now();
  const enc = encrypt(json);
  const t1 = performance.now();
  /* GitHub PUT body = base64(파일내용) — 파일내용이 이미 base64 인코딩된 암호문 */
  const body = Buffer.from(enc, "utf8").toString("base64").length;
  console.log(
    `  ${String(users).padStart(5)}  ${((json.length / 1024) | 0).toString().padStart(6)}KB  ` +
    `${(t1 - t0).toFixed(1).padStart(6)}ms  ${((enc.length / 1024) | 0).toString().padStart(6)}KB  ` +
    `${((body / 1024 / 1024)).toFixed(1).padStart(5)}MB`
  );
}

/* ---- 4) GitHub API 한도 ---- */
console.log("\n=== 4) 한도 대비 ===");
console.log("  GitHub Contents API: 파일 100MB / PUT 1회당 권장 1MB 미만");
console.log("  무료 rate limit: 5000 req/hour (인증 기준)");
const users = 500;
const saveKB = 15.4;
const dbKB = users * saveKB;
console.log(`  유저 ${users}명 × 세이브 ${saveKB}KB = DB 약 ${(dbKB / 1024).toFixed(1)}MB (암호화 전)`);
console.log(`  → 저장 1회당 PUT 본문 약 ${((dbKB * 1.34 * 1.34) / 1024).toFixed(1)}MB 재전송`);
console.log(`  → 세이브 1건 저장에 전체 DB 비용을 지불 (O(N) 쓰기)`);
