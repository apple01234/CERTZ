// node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs --test tests/ultimate-coverage.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 궁극기 커버리지 — 유저 지시 "모든 직업에 확실히 구별되는 고유 궁극기".
 *
 * [왜 이 테스트가 필요한가]
 *  `SKILL5_INFO` 에 직업이 추가될 때마다 `ULT_FINALE` 에 마무리 연출을 넣어야 하는데,
 *  빠뜨리면 `finaleFallback()` 으로 조용히 떨어진다. 폴백은 항상 같은 원형 충격파라
 *  **에러도 로그도 없이** 여러 직업의 궁극기가 동일해진다. 실제로 6직업이 그 상태였다
 *  (ranger/warlord/sniper/sage/swashbuckler/raider).
 *
 * [검사 3종]
 *  1) 커버리지 — SKILL5_INFO 의 모든 키가 ULT_FINALE 에 있어야 한다(폴백 금지).
 *  2) 소리 — ULT_FINALE 의 sfx 는 `audio.ts` 의 `SKILL_SFX_FILES` 에 실제로 있어야 한다.
 *     `audio.sfx.skill()` 은 `const file = SKILL_SFX_FILES[key]; if (!file) return;` 로
 *     **조용히 무음 처리**하므로, 오타/없는 키는 런타임에 아무 표시 없이 사라진다.
 *     (실측: 수정 전 29개 중 13개가 이 상태로 무음이었다.)
 *  3) 구별 — (shape, tex, sfx) 조합이 직업마다 달라야 한다.
 *
 * [왜 소스를 파싱하는가]
 *  `ultFinale.ts` 는 `import Phaser from "phaser"` 를 갖고 있어 Node 에서 바로 import 하면
 *  `window is not defined` 로 죽는다. 형제 테스트(tests/ultimate-finale.test.mjs)도 같은
 *  이유로 Phaser import 를 제거하고 실행한다. 여기서는 테이블 "데이터"만 검사하므로
 *  소스를 읽어 파싱하는 편이 더 단순하고 안정적이다.
 */

const ROOT = path.resolve(import.meta.dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/* SKILL5_INFO 는 순수 데이터 모듈이라 직접 import 할 수 있다. */
const { SKILL5_INFO, SKILL5B_INFO } = await import('../src/game/classes.ts');

/** `export const ULT_FINALE = { ... }` 블록만 잘라낸다. */
function finaleSource() {
  const src = read('src/game/fx/ultFinale.ts');
  const start = src.indexOf('export const ULT_FINALE');
  assert.ok(start > 0, 'ultFinale.ts 에서 ULT_FINALE 을 찾지 못했다');
  const end = src.indexOf('export function finaleFallback', start);
  assert.ok(end > start, 'ULT_FINALE 블록의 끝(finaleFallback)을 찾지 못했다');
  return src.slice(start, end);
}

/** 각 항목의 필드만 뽑는다. 항목은 `키: { ... },` 형태다. */
function parseFinale() {
  const body = finaleSource();
  const rows = [];
  /* 키: { 로 시작해 } 로 닫히는 한 덩어리 — 값에 중괄호가 없어 안전하다. */
  const entry = /(\w+):\s*\{([^}]*)\}/g;
  let m;
  while ((m = entry.exec(body))) {
    const [, key, inner] = m;
    const str = (f) => inner.match(new RegExp(`${f}:\\s*"([\\w]+)"`))?.[1];
    const num = (f) => Number(inner.match(new RegExp(`${f}:\\s*(-?[\\d.]+)`))?.[1]);
    const shake = inner.match(/shake:\s*\[\s*(\d+)\s*,\s*([\d.]+)\s*\]/);
    const arc = inner.match(/arc:\s*Math\.PI\s*\*\s*([\d.]+)/)?.[1];
    rows.push({
      key,
      shape: str('shape'),
      tex: str('tex'),
      tex2: str('tex2'),
      sfx: str('sfx'),
      reach: num('reach'),
      shakeMs: shake ? Number(shake[1]) : NaN,
      shakeAmt: shake ? Number(shake[2]) : NaN,
      arc: arc === undefined ? NaN : Math.PI * Number(arc),
    });
  }
  return rows;
}

/** audio.ts 의 skill() 이 실제로 해석하는 키 집합 */
const SKILL_SFX_FILES = (() => {
  const src = read('src/game/audio.ts');
  const start = src.indexOf('const SKILL_SFX_FILES');
  assert.ok(start > 0, 'audio.ts 에서 SKILL_SFX_FILES 를 찾지 못했다');
  const end = src.indexOf('\n};', start);
  const body = src.slice(start, end);
  return new Set([...body.matchAll(/^\s{2}(\w+):/gm)].map((x) => x[1]));
})();

const skillKeys = Object.keys(SKILL5_INFO);
const finale = parseFinale();

test('ULT_FINALE 파싱이 실제 항목 수와 맞는다(파서 자체 검증)', () => {
  assert.ok(finale.length >= 35, `ULT_FINALE 항목이 35 미만: ${finale.length}`);
  for (const r of finale) {
    assert.ok(r.shape, `${r.key}: shape 누락`);
    assert.ok(r.tex, `${r.key}: tex 누락`);
    assert.ok(r.sfx, `${r.key}: sfx 누락`);
  }
});

test('SKILL5_INFO 의 모든 직업이 ULT_FINALE 을 갖는다(폴백 없음)', () => {
  const have = new Set(finale.map((r) => r.key));
  const missing = skillKeys.filter((k) => !have.has(k));
  assert.deepEqual(
    missing, [],
    `궁극기 마무리가 없는 직업: ${missing.join(', ')} — finaleFallback(원형 충격파)으로 떨어진다`,
  );
  assert.ok(skillKeys.length >= 35, `직업 수가 35 미만이다: ${skillKeys.length}`);
});

test('ULT_FINALE 의 sfx 키가 audio.ts 에 실제로 존재한다 (35/35 무음 0)', () => {
  const bad = finale
    .filter((r) => !SKILL_SFX_FILES.has(r.sfx))
    .map((r) => `${r.key} → "${r.sfx}"`);
  assert.deepEqual(
    bad, [],
    `audio.sfx.skill() 이 조용히 무음 처리하는 키: ${bad.join(', ')}`,
  );
  /* 요구: "35/35 통과를 명시적으로 출력" — 항목 수와 실재 수를 둘 다 남긴다. */
  const ok = finale.filter((r) => SKILL_SFX_FILES.has(r.sfx)).length;
  console.log(`ULT_FINALE sfx 실재: ${ok}/${finale.length} (무음 ${finale.length - ok}건)`);
  assert.equal(ok, finale.length, '모든 항목의 sfx 가 실재해야 한다');
});

/* ── 제2궁극기(SKILL5B) ────────────────────────────────────────────────
 * SKILL5B_INFO 는 SKILL5_KEY 와 같은 키 집합이지만 **별도 실행부** `useSkill5b()` 를
 * 쓰고 `ULT_FINALE` 을 참조하지 않는다(자체 switch + 자체 sfxSkill 호출).
 * 그래서 ULT_FINALE 커버리지와 별개로 그 실행부의 sfx 키를 직접 검사해야 한다.
 * 실제로 seaking/dreadnought 가 "water"/"wave"/"cannon"/"explosion" 을 쓰고 있었고
 * 넷 다 SKILL_SFX_FILES 에 없어 무음이었다(1차 useSkill5 에서도 동일). */
const skillCalls = (() => {
  const src = read('src/game/entities/Player.ts');
  const out = {};
  for (const method of ['useSkill5', 'useSkill5b']) {
    const start = src.indexOf(`  ${method}() {`);
    assert.ok(start > 0, `Player.ts 에서 ${method} 를 찾지 못했다`);
    let i = src.indexOf('{', start), depth = 0, end = -1;
    for (let j = i; j < src.length; j++) {
      const c = src[j];
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) { end = j; break; } }
    }
    const body = src.slice(start, end);
    out[method] = [...new Set([...body.matchAll(/sfxSkill\(\s*"(\w+)"/g)].map((m) => m[1]))];
  }
  return out;
})();

test('SKILL5B_INFO 가 SKILL5_INFO 와 같은 직업 집합을 덮는다', () => {
  const a = Object.keys(SKILL5_INFO).sort();
  const b = Object.keys(SKILL5B_INFO).sort();
  assert.deepEqual(b, a, 'SKILL5B_INFO 키 집합이 SKILL5_INFO 와 다르다');
  console.log(`SKILL5B_INFO 커버리지: ${b.length}/${a.length}`);
});

test('useSkill5 / useSkill5b 가 부르는 sfx 키가 모두 실재한다', () => {
  const bad = [];
  for (const [method, keys] of Object.entries(skillCalls)) {
    for (const k of keys) if (!SKILL_SFX_FILES.has(k)) bad.push(`${method}: "${k}"`);
  }
  assert.deepEqual(bad, [], `조용히 무음이 되는 호출: ${bad.join(', ')}`);
  for (const [method, keys] of Object.entries(skillCalls)) {
    console.log(`${method} sfx 실재: ${keys.length}종 전부 확인`);
  }
});

test('(shape, tex, sfx) 조합이 직업마다 구별된다', () => {
  const seen = new Map();
  const dup = [];
  for (const r of finale) {
    const sig = `${r.shape}|${r.tex}|${r.sfx}`;
    if (seen.has(sig)) dup.push(`${sig} → ${seen.get(sig)}, ${r.key}`);
    else seen.set(sig, r.key);
  }
  assert.deepEqual(dup, [], `구별되지 않는 조합: ${dup.join(' / ')}`);
});

test('각 마무리의 reach / shake 값이 유효하다', () => {
  const bad = [];
  for (const r of finale) {
    if (!(r.reach > 0)) bad.push(`${r.key}: reach=${r.reach}`);
    if (!(r.shakeMs > 0)) bad.push(`${r.key}: shake ms=${r.shakeMs}`);
    if (!(r.shakeAmt > 0)) bad.push(`${r.key}: shake 강도=${r.shakeAmt}`);
    if (r.shape === 'cone' && !(r.arc > 0)) bad.push(`${r.key}: cone 인데 arc 없음`);
  }
  assert.deepEqual(bad, []);
});

console.log(
  `ultimate coverage: ${skillKeys.length} 직업 / ${finale.length} 마무리 / ` +
  `${SKILL_SFX_FILES.size} 스킬음 — 전부 통과`,
);
console.log(
  `제2궁극기: SKILL5B_INFO ${Object.keys(SKILL5B_INFO).length}키 / ` +
  `useSkill5b sfx ${skillCalls.useSkill5b?.length ?? 0}종 — 무음 0`,
);
