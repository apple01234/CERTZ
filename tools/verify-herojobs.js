// heroJobs 데이터 무결성 검증 (DB 없음 — 순수 데이터 계약 검사)
const fs = require('fs');
const src = fs.readFileSync('src/game/heroJobs.ts', 'utf8');

// 1) portrait 파일 실존 + 중복 없음
const ports = [...src.matchAll(/portrait:\s*"([^"]+)"/g)].map(m => m[1]);
const missing = ports.filter(p => !fs.existsSync('public/assets/' + p));
const dupes = ports.filter((p, i) => ports.indexOf(p) !== i);
console.log(`[portrait] total=${ports.length} unique=${new Set(ports).size} missing=${missing.length} dupes=${dupes.length}`);
if (missing.length) console.log('  MISSING:', missing);
if (dupes.length) console.log('  DUPES:', [...new Set(dupes)]);

// 2) 기획서 필수 인물이 전부 있는지 (기획서 47~61행 원문 기준)
const REQUIRED = ['카타나', '솔라플레임이그니션소드', '차크람', '마법붓', '활', '망치', '마도서'];
const weapons = [...src.matchAll(/weapon:\s*"([^"]+)"/g)].map(m => m[1]);
const missW = REQUIRED.filter(w => !weapons.some(x => x.includes(w)));
console.log(`[weapon] required=${REQUIRED.length} missing=${missW.length}`);
if (missW.length) console.log('  MISSING:', missW);

// 3) 능력명 원문 반영 확인
const ABIL = ['세뇌', '핏빛 세례', '진정한 어둠의 군주', '태양의 불꽃', '검의 수호자',
  '대전화살', '벽력일섬', '아트메이크', '아트힐링', '꽃의 축제', '스핀차크람', '공학망치', '분신소환'];
const missA = ABIL.filter(a => !src.includes(a));
console.log(`[ability] required=${ABIL.length} missing=${missA.length}`);
if (missA.length) console.log('  MISSING:', missA);

// 4) 윤지왕자 존재 + playable
const hasYunji = /key:\s*"yunji"/.test(src);
const yunjiPlayable = /HERO_PLAYABLE_ACT1[^=]*=\s*\[[^\]]*"yunji"/.test(src);
console.log(`[yunji] defined=${hasYunji} playable=${yunjiPlayable}`);

// 5) 스킬 매핑 키가 HERO_JOBS 키와 일치하는지
const jobKeys = [...src.matchAll(/^\s{2}([a-z]+):\s*\{\s*$/gm)].map(m => m[1]);
const mapBlock = src.split('HERO_SKILL_KINDS')[1] || '';
const mapKeys = [...mapBlock.matchAll(/^\s{2}([a-z]+):\s*\{\s*s1:/gm)].map(m => m[1]);
const orphan = mapKeys.filter(k => !jobKeys.includes(k));
console.log(`[skill-map] jobs=${jobKeys.length} mapped=${mapKeys.length} orphan=${orphan.length}`);
if (orphan.length) console.log('  ORPHAN:', orphan);

const fail = missing.length + dupes.length + missW.length + missA.length + orphan.length
  + (hasYunji ? 0 : 1) + (yunjiPlayable ? 0 : 1);
console.log(fail === 0 ? '\nALL CHECKS PASS' : `\nFAILURES: ${fail}`);
process.exit(fail === 0 ? 0 : 1);
