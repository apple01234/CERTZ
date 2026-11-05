import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 스토리 NPC 고유 능력을 일반 모험가 직업에서 분리 — vc249 (지시 #4).
 *
 * [요구] "라일락 등 스토리 NPC의 스킬을 일반 모험가 직업에 넣지 않기.
 *  스토리 캐릭터는 이후 시즌 픽업 캐릭터로 출시 예정"
 *
 * [실제로 발견된 위반]
 *  WEAPON_MASTER_PROFILES.swashbuckler 가 mentor:"하루", name:"카피 · 원소 순환" 이었다.
 *  - 카피/원소 순환은 기획서상 **하루의 고유 능력**(무의 원소·타인 능력 복사)
 *  - 하루는 플레이어 본인 → 멘토가 플레이어인 **자기참조**
 *  - 픽업 캐릭터로 분리 예정인 정체성을 일반 직업이 선점
 *
 * [경계] 나머지 멘토(아리·루시·벨리카·리안·제르·란·페르온·카르텔·제이드)는
 *  정본 인물이 각자 자기 무기를 대표해 제자를 가르치는 정상 구조다. 이건 유지한다.
 *  즉 "스토리 NPC 이름이 있다"가 문제가 아니라 **플레이어 자신의 고유 능력**이 문제였다.
 */

const ROOT = path.resolve(import.meta.dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('일반 직업 기술명에 하루의 고유 능력(카피·원소 순환)이 없다', () => {
  const classes = read('src/game/classes.ts');
  const profiles = read('src/game/weaponMasterProfiles.ts');
  /* 주석에 사유를 적어둔 것은 허용하되, 실제 문자열/데이터에는 없어야 한다 */
  for (const [name, src] of [['classes.ts', classes], ['weaponMasterProfiles.ts', profiles]]) {
    const dataOnly = src
      .split('\n')
      .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('/*') && !l.trim().startsWith('//'))
      .join('\n');
    assert.equal(dataOnly.includes('카피 · 원소 순환'), false, `${name} 에 하루 고유 기술명이 남아 있다`);
  }
});

test('멘토가 플레이어 자신(하루)인 직업이 없다', () => {
  const profiles = read('src/game/weaponMasterProfiles.ts');
  const mentors = [...profiles.matchAll(/mentor:\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(mentors.length >= 9, `멘토 목록을 못 읽었다(${mentors.length})`);
  assert.equal(mentors.includes('하루'), false, '멘토가 하루(플레이어)인 직업이 있다 — 자기참조');
});

test('정본 인물 멘토는 유지된다(과도한 삭제 방지)', () => {
  /* 스토리 인물이 자기 무기를 전수하는 구조 자체는 정상이다.
   *  이걸 전부 지우면 게임에서 "왜 배우는 사람이 없지"가 된다. */
  const profiles = read('src/game/weaponMasterProfiles.ts');
  for (const m of ['아리', '루시', '벨리카', '리안', '제르', '란', '페르온', '카르텔']) {
    assert.ok(profiles.includes(`mentor: "${m}"`), `정본 멘토 ${m} 가 사라졌다`);
  }
});

test('스와시버클러는 자기 무기 체계(쌍검) 기술명을 쓴다', () => {
  const profiles = read('src/game/weaponMasterProfiles.ts');
  const i = profiles.indexOf('swashbuckler:');
  assert.ok(i > 0);
  const line = profiles.slice(i, profiles.indexOf('\n', i));
  assert.ok(line.includes('쌍검'), `스와시버클러 기술명이 쌍검 계열이 아니다: ${line.slice(0, 120)}`);
  /* classes.ts 스킬 표 3단계(swashbuckler/duelist/blademaster)도 같은 이름을 써야 한다 */
  const classes = read('src/game/classes.ts');
  for (const row of ['swashbuckler:', 'duelist:', 'blademaster:']) {
    const j = classes.indexOf(`${row} [`);
    assert.ok(j > 0, `${row} 스킬 행을 못 찾았다`);
    const seg = classes.slice(j, classes.indexOf(']', j));
    assert.ok(seg.includes('쌍검'), `${row} 스킬명이 쌍검 계열이 아니다`);
  }
});

test('라일락은 스킬 멘토가 아니다', () => {
  /* 라일락은 구조자/펜던트 주인 — 무기 전수자가 아니다(1.txt:12,17) */
  const profiles = read('src/game/weaponMasterProfiles.ts');
  const mentors = [...profiles.matchAll(/mentor:\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.equal(mentors.includes('라일락'), false);
});
