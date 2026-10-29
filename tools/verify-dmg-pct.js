/**
 * #8 "고정 % 데미지" 범위 검증 (v1.4.41)
 *
 * 유저 지시: **고정 % 데미지는 "식인초 & 카오스 보스 특정 패턴"만** 사용하고 나머지는 수치로.
 * 종전에는 DMG_PCT.mob 4.5% 하한이 모든 몹 접촉/투사체에 걸려 있어, 방어·육성 투자가
 * 무의미해지는 밸런스 붕괴가 있었다. 이 스크립트는 그 규칙이 지켜지는지 소스를 직접 검사한다.
 *
 *   node tools/verify-dmg-pct.js
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const results = [];
function check(name, fn) {
  try { fn(); results.push(["PASS", name]); }
  catch (e) { results.push(["FAIL", name + " — " + e.message]); }
}
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

/* ---- 1. DMG_PCT: plant 만 살아 있어야 한다 ---- */
check("DMG_PCT 는 plant(0.1)만 유효하고 mob/elite/boss 는 0", () => {
  const src = read("src/game/data.ts");
  const block = src.match(/export const DMG_PCT = \{[\s\S]*?\} as const;/);
  if (!block) throw new Error("DMG_PCT 정의를 찾지 못함");
  const b = block[0];
  const get = (k) => {
    const m = b.match(new RegExp(`\\b${k}:\\s*([0-9.]+)`));
    if (!m) throw new Error(`${k} 없음`);
    return parseFloat(m[1]);
  };
  if (get("plant") !== 0.1) throw new Error(`plant=${get("plant")} (0.1 이어야 함)`);
  for (const k of ["mob", "elite", "boss", "bossSlam"]) {
    if (get(k) !== 0) throw new Error(`${k}=${get(k)} (0 이어야 함)`);
  }
});

/* ---- 2. Player.takeDamage 에 stageCh 게이트가 없어야 한다 ---- */
check("takeDamage 에 stageCh>=4 전역 % 게이트가 없다", () => {
  const src = read("src/game/entities/Player.ts");
  const m = src.match(/const pctFloor = [^\n]+/);
  if (!m) throw new Error("pctFloor 계산을 찾지 못함");
  if (/stageCh/.test(m[0])) throw new Error(`전역 게이트 잔존: ${m[0].trim()}`);
  if (!/trueDmg \? 0/.test(m[0])) throw new Error("trueDmg 예외가 사라짐(식인초 경로 보존 필요)");
});

/* ---- 3. Boss.ts 의 % 인자는 전부 chaos 조건이어야 한다 ---- */
check("Boss.ts 의 모든 % 하한 인자가 this.chaos 조건", () => {
  const src = read("src/game/entities/Boss.ts");
  // player.takeDamage( ... , <4번째 인자> ) 형태에서 리터럴 % 가 남아 있으면 위반
  const calls = src.match(/player\.takeDamage\([^;]*?\);/gs) || [];
  const bad = [];
  for (const c of calls) {
    // 마지막 ')' 앞의 마지막 쉼표 인자 추출
    const inner = c.slice(c.indexOf("(") + 1, c.lastIndexOf(")"));
    const parts = inner.split(",");
    if (parts.length < 4) continue;               // % 인자를 안 넘기는 호출은 무관
    const last = parts[parts.length - 1].trim();
    if (/^(0|\d+(\.\d+)?)$/.test(last)) continue; // 명시적 0 은 허용
    if (!/this\.chaos/.test(last)) bad.push(last);
  }
  if (bad.length) throw new Error(`chaos 조건 없는 % 인자 ${bad.length}건: ${bad[0]}`);
});

/* ---- 4. Enemy.ts 접촉/돌진에 dmgPct 를 넘기지 않아야 한다 ---- */
check("Enemy 접촉·돌진이 고정 % 를 넘기지 않는다", () => {
  const src = read("src/game/entities/Enemy.ts");
  const bad = (src.match(/takeDamage\([^;]*?e\.dmgPct[^;]*?\)/g) || []);
  if (bad.length) throw new Error(`e.dmgPct 전달 ${bad.length}건 잔존`);
});

/* ---- 5. 적 투사체도 % 하한 없음 ---- */
check("적 투사체 피해에 DMG_PCT 하한이 없다", () => {
  const src = read("src/game/scenes/WorldScene.ts");
  const m = src.match(/takeDamage\(p\.getData\("dmg"\)[^;]*?\);/);
  if (!m) throw new Error("투사체 피해 호출을 찾지 못함");
  if (/DMG_PCT/.test(m[0])) throw new Error(`% 하한 잔존: ${m[0].trim()}`);
});

/* ---- 6. 식인초는 살아 있어야 한다 (지시가 허용한 예외) ---- */
check("식인초 plant trueDmg 경로 보존", () => {
  const src = read("src/game/scenes/WorldScene.ts");
  if (!/DMG_PCT\.plant[\s\S]{0,120}true\)/.test(src)) {
    throw new Error("hitPlantHazard 의 trueDmg 적용이 사라짐");
  }
});

/* ---- 출력 ---- */
const fail = results.filter(([s]) => s === "FAIL");
for (const [s, n] of results) console.log(`  ${s === "PASS" ? "✓" : "✗"} ${n}`);
console.log(
  fail.length === 0
    ? `\nALL CHECKS PASS (${results.length}항목)`
    : `\n${fail.length}건 실패 / 총 ${results.length}항목`
);
process.exit(fail.length === 0 ? 0 : 1);
