// 챕터/스테이지 데이터 계약 검증 — 신규 2기·3기 챕터가 실제로 생성 가능한지
const fs = require('fs');
const src = fs.readFileSync('src/game/stages.ts', 'utf8');

const keys = [...src.matchAll(/key: "([a-z]+)", num: (\d+), title: "([^"]+)"/g)]
  .map(m => ({ key: m[1], num: +m[2], title: m[3] }));
console.log(`[chapters] total=${keys.length}`);
for (const c of keys) console.log(`  ${String(c.num).padStart(2)}. ${c.key.padEnd(11)} ${c.title}`);

// 1) num 이 2부터 연속인가 (CH_HP[num-2] 인덱스가 어긋나면 밸런스가 깨진다)
const nums = keys.map(k => k.num).sort((a, b) => a - b);
const expect = Array.from({ length: nums.length }, (_, i) => i + 2);
const gap = nums.filter((n, i) => n !== expect[i]);
console.log(`[num] contiguous=${gap.length === 0} bad=${gap.length}`);

// 2) CH_HP/CH_ATK/CH_EXP 길이가 챕터 수 이상인가
const arrLen = (name) => {
  const m = new RegExp(`const ${name} = \\[([^\\]]+)\\]`).exec(src);
  return m ? m[1].split(',').length : -1;
};
const hp = arrLen('CH_HP'), atk = arrLen('CH_ATK'), exp = arrLen('CH_EXP');
console.log(`[arrays] CH_HP=${hp} CH_ATK=${atk} CH_EXP=${exp} need>=${keys.length}`);
const short = [hp, atk, exp].filter(n => n < keys.length);

// 3) parseStage 정규식에 모든 챕터 키가 들어있는가
const re = /\^\((forest[^)]+)\)\(\[1-9\]\|10\)\$/.exec(src);
const inRegex = re ? re[1].split('|') : [];
const missingRe = keys.map(k => k.key).filter(k => !inRegex.includes(k));
console.log(`[parse] regex=${inRegex.length} missing=${missingRe.length}`);
if (missingRe.length) console.log('  MISSING:', missingRe);

// 4) groundTex/pathTex 가 BootScene 로드 목록에 있는가
const boot = fs.readFileSync('src/game/scenes/BootScene.ts', 'utf8');
const tex = [...new Set([...src.matchAll(/(?:groundTex|pathTex): "([a-z_]+)"/g)].map(m => m[1]))];
const notLoaded = tex.filter(t => !boot.includes(`"${t}"`));
console.log(`[texture] used=${tex.length} notLoaded=${notLoaded.length}`);
if (notLoaded.length) console.log('  NOT LOADED:', notLoaded);

// 5) 신규 챕터 보스가 BossKey 에 있는가
const bossType = /export type BossKey =([\s\S]*?);/.exec(src)[1];
const bosses = [...new Set([...src.matchAll(/boss: "([a-z]+)"/g)].map(m => m[1]))];
const badBoss = bosses.filter(b => !bossType.includes(`"${b}"`));
console.log(`[boss] used=${bosses.length} invalid=${badBoss.length}`);
if (badBoss.length) console.log('  INVALID:', badBoss);

const fail = gap.length + short.length + missingRe.length + notLoaded.length + badBoss.length;
console.log(fail === 0 ? '\nALL CHECKS PASS' : `\nFAILURES: ${fail}`);
process.exit(fail === 0 ? 0 : 1);
