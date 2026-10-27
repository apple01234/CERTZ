// 9원소 상성표 검증 — 대칭성·자기상성·반응 일관성
const fs = require('fs');
const src = fs.readFileSync('src/game/data.ts', 'utf8');

// ELEM_STRONG_AGAINST / ELEM_WEAK_AGAINST 파싱
function parseTable(name) {
  const m = new RegExp(`export const ${name}: Record<ElemKey, ElemKey\\[\\]> = \\{([\\s\\S]*?)\\n\\};`).exec(src);
  if (!m) throw new Error(name + ' not found');
  const out = {};
  for (const line of m[1].split('\n')) {
    const mm = /^\s*(\w+):\s*\[([^\]]*)\]/.exec(line);
    if (!mm) continue;
    out[mm[1]] = mm[2].split(',').map(s => s.trim().replace(/"/g, '')).filter(Boolean);
  }
  return out;
}

const STRONG = parseTable('ELEM_STRONG_AGAINST');
const WEAK = parseTable('ELEM_WEAK_AGAINST');
const ELEMS = ['none', 'fire', 'water', 'wind', 'electric', 'earth', 'nature', 'ice', 'light', 'dark'];

console.log('=== 원소 목록 ===');
console.log(' ', ELEMS.length, '종:', ELEMS.join(' '));

// 1) 모든 원소가 테이블에 있는가
const missingS = ELEMS.filter(e => !STRONG[e]);
const missingW = ELEMS.filter(e => !WEAK[e]);
console.log(`\n[테이블 완전성] strong누락=${missingS.length} weak누락=${missingW.length}`);
if (missingS.length) console.log('  MISSING strong:', missingS);
if (missingW.length) console.log('  MISSING weak:', missingW);

// 2) 자기 자신을 강/약 목록에 넣지 않았는가
const selfRef = [];
for (const e of ELEMS) {
  if (STRONG[e]?.includes(e)) selfRef.push(`${e}.strong`);
  if (WEAK[e]?.includes(e)) selfRef.push(`${e}.weak`);
}
console.log(`[자기참조] ${selfRef.length}`);
if (selfRef.length) console.log('  SELF:', selfRef);

// 3) 같은 쌍이 strong과 weak에 동시에 있지 않은가 (빛↔어둠 예외)
const conflicts = [];
for (const e of ELEMS) {
  for (const t of (STRONG[e] || [])) {
    if ((WEAK[e] || []).includes(t)) conflicts.push(`${e}->${t}`);
  }
}
console.log(`[상충(강+약 동시)] ${conflicts.length}`);
if (conflicts.length) console.log('  CONFLICT:', conflicts);

// 4) 대칭성: A가 B에게 강하면 B는 A에게 약해야 한다
const asym = [];
for (const a of ELEMS) {
  for (const b of (STRONG[a] || [])) {
    const bWeak = (WEAK[b] || []).includes(a);
    const bStrong = (STRONG[b] || []).includes(a);
    // 빛↔어둠은 상호 강함이 정상
    if (bStrong) continue;
    if (!bWeak) asym.push(`${a}->${b} 강인데 ${b}->${a} 약 아님`);
  }
}
console.log(`[대칭성 위반] ${asym.length}`);
if (asym.length) asym.forEach(x => console.log('  ASYM:', x));

// 5) 9원소가 실제로 쓰이는가 (챕터+계열)
const start = src.indexOf('export const CHAPTER_ELEM');
const end = src.indexOf('};', src.indexOf('export const FAMILY_ELEM'));
const usage = src.slice(start, end);
const used = ELEMS.filter(e => e !== 'none' && usage.includes(`"${e}"`));
console.log(`\n[실사용] 챕터+계열에 등장하는 원소 ${used.length}/9: ${used.join(' ')}`);
const unused = ELEMS.filter(e => e !== 'none' && !used.includes(e));
if (unused.length) console.log('  미사용:', unused);

// 6) 상성 매트릭스 출력 (9x9)
console.log('\n=== 상성 매트릭스 (행=공격, 열=방어) ===');
const short = { none:'-', fire:'불', water:'물', wind:'바람', electric:'전기', earth:'땅', nature:'자연', ice:'얼음', light:'빛', dark:'어둠' };
console.log('       ' + ELEMS.slice(1).map(e => short[e].padEnd(3)).join(''));
for (const a of ELEMS.slice(1)) {
  const row = ELEMS.slice(1).map(d => {
    if (a === d) return ' - ';
    if ((STRONG[a] || []).includes(d)) return ' ++';
    if ((WEAK[a] || []).includes(d)) return ' --';
    return ' · ';
  });
  console.log(short[a].padEnd(6) + row.join(''));
}

const fail = missingS.length + missingW.length + selfRef.length + conflicts.length + asym.length + unused.length;
console.log(fail === 0 ? '\nALL CHECKS PASS' : `\nFAILURES: ${fail}`);
process.exit(fail === 0 ? 0 : 1);
