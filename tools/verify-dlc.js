// DLC 챕터 검증 — 기존 9챕터 무손상 + DLC 3챕터 정합
const fs = require('fs');
const src = fs.readFileSync('src/game/stages.ts', 'utf8');

const chs = [...src.matchAll(/key: "([a-z]+)", num: (\d+)(?:, dlc: true)?,\s*\n?\s*title: "([^"]+)"/g)]
  .map(m => ({ key: m[1], num: +m[2], title: m[3], dlc: src.slice(m.index, m.index + 200).includes('dlc: true') }));

console.log(`[챕터] total=${chs.length}`);
for (const c of chs) console.log(`  ${String(c.num).padStart(2)}. ${c.key.padEnd(14)} ${c.dlc ? '[DLC] ' : '      '}${c.title}`);

// 1) 기존 9챕터 키가 그대로인가 (회귀 방지)
const BASE = ['forest', 'kingdom', 'alfheim', 'muspelheim', 'niflheim', 'cave', 'nidavellir', 'hel', 'abyss'];
const keys = chs.map(c => c.key);
const lostBase = BASE.filter(k => !keys.includes(k));
console.log(`\n[기존 9챕터 보존] 실종=${lostBase.length}`);
if (lostBase.length) console.log('  LOST:', lostBase);

// 2) DLC 는 정확히 3개이고 전부 dlc:true 인가
const dlc = chs.filter(c => c.dlc);
console.log(`[DLC] 개수=${dlc.length} (기대 10 — 기획서 2기 10행성)`);

// 3) num 연속성 (CH_HP[num-2] 인덱스 정합)
const nums = chs.map(c => c.num).sort((a, b) => a - b);
const expect = Array.from({ length: nums.length }, (_, i) => i + 2);
const gaps = nums.filter((n, i) => n !== expect[i]);
console.log(`[num 연속성] 위반=${gaps.length}`);

// 4) 배열 길이 충분한가
const arrLen = n => {
  const m = new RegExp(`const ${n} = \\[([^\\]]+)\\]`).exec(src);
  return m ? m[1].split(',').length : -1;
};
const hp = arrLen('CH_HP'), atk = arrLen('CH_ATK'), exp = arrLen('CH_EXP');
console.log(`[배열] CH_HP=${hp} CH_ATK=${atk} CH_EXP=${exp} need>=${chs.length}`);
const short = [hp, atk, exp].filter(n => n < chs.length);

// 5) parseStage 정규식에 DLC 키 포함
const re = /\^\((forest[^)]+)\)\(\[1-9\]\|10\)\$/.exec(src);
const inRe = re ? re[1].split('|') : [];
const missingRe = chs.map(c => c.key).filter(k => !inRe.includes(k));
console.log(`[parseStage] 정규식=${inRe.length} 누락=${missingRe.length}`);
if (missingRe.length) console.log('  MISSING:', missingRe);

// 6) DLC 게이트가 gotoStage 에 있는가
const ws = fs.readFileSync('src/game/scenes/WorldScene.ts', 'utf8');
const hasGate = ws.includes('spec?.dlc && !this.cleared');
console.log(`[DLC 잠금 게이트] ${hasGate ? 'OK' : 'MISSING'}`);

// 7) 텍스처 로드 확인
const boot = fs.readFileSync('src/game/scenes/BootScene.ts', 'utf8');
const tex = [...new Set([...src.matchAll(/(?:groundTex|pathTex): "([a-z_]+)"/g)].map(m => m[1]))];
const notLoaded = tex.filter(t => !boot.includes(`"${t}"`));
console.log(`[텍스처] 사용=${tex.length} 미등록=${notLoaded.length}`);
if (notLoaded.length) console.log('  NOT LOADED:', notLoaded);

/* vc192 — DLC 10챕터로 확장(기획서 2기 10행성). 기대값을 10 으로 갱신 */
const fail = lostBase.length + (dlc.length < 10 ? 1 : 0) + gaps.length + short.length
  + missingRe.length + (hasGate ? 0 : 1) + notLoaded.length;
console.log(fail === 0 ? '\nALL CHECKS PASS' : `\nFAILURES: ${fail}`);
process.exit(fail === 0 ? 0 : 1);
