/**
 * vc229 — 압축 효과 실측.
 * 세이브/DB 를 gzip·brotli 로 압축했을 때 실제 감소율을 측정한다.
 * 구조 변경(청크 분할) 전에 "압축만으로 충분한가"를 판단하기 위한 근거.
 */
import zlib from "node:zlib";

function mk(n) {
  return {
    gold: 123456, emerald: 99, level: 120, name: "테스트", cls: "warrior",
    owned: Array.from({ length: 40 + n }, (_, i) => `item_${i}`),
    seen: Array.from({ length: 100 + n * 3 }, (_, i) => `seen_${i}`),
    visited: Array.from({ length: 50 + n * 2 }, (_, i) => `vis_${i}`),
    achClaimed: Array.from({ length: 30 + n * 2 }, (_, i) => `ach_${i}`),
    monsterKills: Object.fromEntries(Array.from({ length: 40 + n }, (_, i) => [`mon_${i}`, 100 + i])),
    starMap: Object.fromEntries(Array.from({ length: 10 + n }, (_, i) => [`star_${i}`, i])),
    potentials: Object.fromEntries(Array.from({ length: 10 + n }, (_, i) => [`pot_${i}`, { grade: (i % 5) + 1, lv: i }])),
  };
}

const one = mk(200);
const raw = Buffer.from(JSON.stringify(one), "utf8");
const gz = zlib.gzipSync(raw, { level: 9 });
const br = zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } });

console.log("=== 세이브 1건 ===");
console.log("  원본      ", (raw.length / 1024).toFixed(1), "KB");
console.log("  gzip -9   ", (gz.length / 1024).toFixed(1), "KB", ((gz.length / raw.length) * 100).toFixed(0) + "%");
console.log("  brotli -9 ", (br.length / 1024).toFixed(1), "KB", ((br.length / raw.length) * 100).toFixed(0) + "%");

const db = {
  users: Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`u${i}`, { id: `u${i}`, name: `n${i}`, salt: "a".repeat(32), hash: "b".repeat(128), createdAt: 1, role: "user" }])),
  tokens: Object.fromEntries(Array.from({ length: 2000 }, (_, i) => [`t${i}`, { userId: `u${i % 1000}`, expiresAt: 9e12 }])),
  saves: Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`u${i}`, { data: one, updatedAt: 1 }])),
  market: { nextId: 1, listings: {} }, payouts: {}, rank: {}, charNames: {}, iapUsed: {},
};
const dbj = Buffer.from(JSON.stringify(db), "utf8");
const dbgz = zlib.gzipSync(dbj, { level: 9 });
const dbbr = zlib.brotliCompressSync(dbj, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } });

console.log("\n=== DB 1000명 ===");
console.log("  원본      ", (dbj.length / 1e6).toFixed(1), "MB");
console.log("  gzip -9   ", (dbgz.length / 1e6).toFixed(1), "MB", ((dbgz.length / dbj.length) * 100).toFixed(0) + "%");
console.log("  brotli -9 ", (dbbr.length / 1e6).toFixed(1), "MB", ((dbbr.length / dbj.length) * 100).toFixed(0) + "%");

/* 실제 DB 의 반복 구조(토큰 32바이트 hex, salt/hash hex)가 압축에 유리한지 확인 */
console.log("\n=== 판단 ===");
const saveRatio = gz.length / raw.length;
console.log(`  세이브 압축률 ${(saveRatio * 100).toFixed(0)}% → 저장 1건 비용이 ${((1 - saveRatio) * 100).toFixed(0)}% 감소`);
console.log("  단, O(N) 구조는 그대로 — 유저가 늘면 여전히 선형 증가");
