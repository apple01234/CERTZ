import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { resolveVillageNpcTexture } from '../src/game/villageNpcAssets.ts';

/**
 * NPC 본체 ↔ 대화창 초상화 일치 — vc248 (지시 #8).
 *
 * [조사 결과] 매핑은 기계적으로 이미 일치했다. 본체 텍스처(spum_*)와
 *  초상화(_map.json)가 같은 npcbody_* 파일을 가리키고, 픽셀 비교로도 동일 인물이었다.
 *  즉 "불일치"의 실체는 매핑 버그가 아니라 **캐릭터성 불일치**였다:
 *    · 허브 채집가·정원사가 평범한 마을 주민(villager_m) 외형 → 직업성이 드러나지 않음
 *    · 신전 관리인이 마법사(mage) → 신전 관리인에게 사제가 맞음
 *    · npcbody_priest 에셋이 로드만 되고 **아무도 쓰지 않음**(미사용)
 *
 * [이 테스트가 막는 것]
 *  1) 화자의 본체 텍스처와 초상화가 서로 다른 파일을 가리키는 회귀
 *  2) 로드했지만 아무 화자도 쓰지 않는 본체 에셋(미사용 에셋) 재발
 *  3) 채집가/정원사가 다시 평범한 주민으로 되돌아가는 것
 */

const ROOT = path.resolve(import.meta.dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));

/** `NPC_BODY_OF` 같은 매핑 리터럴에서 spum_* → npcbody_* 를 뽑는다 */
function bodyMapOf(src) {
  const out = {};
  for (const m of src.matchAll(/(spum_\w+|npc_\w+):\s*"(npcbody_\w+)"/g)) out[m[1]] = m[2];
  return out;
}

test('화자의 본체 텍스처와 초상화가 같은 파일을 가리킨다', () => {
  const dlg = read('src/components/game/DialogueBox.tsx');
  const map = readJson('public/assets/npcportrait/_map.json');
  const body = dlg.slice(dlg.indexOf('const NPC_PORTRAITS'), dlg.indexOf('};', dlg.indexOf('const NPC_PORTRAITS')));
  const rows = [...body.matchAll(/"([^"]+)":\s*\{\s*tex:\s*"([^"]+)"/g)].map((m) => ({ speaker: m[1], tex: m[2] }));
  assert.ok(rows.length > 30, `화자 목록을 못 읽었다(${rows.length})`);

  const world = bodyMapOf(read('src/game/scenes/WorldScene.ts'));
  const boot = bodyMapOf(read('src/game/scenes/BootScene.ts'));
  const bad = [];
  for (const r of rows) {
    if (!r.tex.startsWith('spum_')) continue;
    const bodyTex = resolveVillageNpcTexture(r.tex, key => fs.existsSync(path.join(ROOT, `public/assets/${key}.webp`)), world[r.tex] ?? boot[r.tex]);
    const portraitSrc = map[r.tex]?.source?.split('/').pop()?.replace(/\.(png|webp)$/, '');
    if (bodyTex && portraitSrc && bodyTex !== portraitSrc) {
      bad.push(`${r.speaker}: 본체 ${bodyTex} / 초상화 ${portraitSrc}`);
    }
  }
  assert.deepEqual(bad, [], `본체·초상화 불일치: ${bad.join(' | ')}`);
});

test('로드하는 본체 에셋은 전부 실제로 쓰인다', () => {
  /* 미사용 에셋은 "왜 이 NPC만 다른 옷을 입지"의 원인이 된다(priest 가 그랬다) */
  const world = bodyMapOf(read('src/game/scenes/WorldScene.ts'));
  const boot = bodyMapOf(read('src/game/scenes/BootScene.ts'));
  const used = new Set([...Object.values(world), ...Object.values(boot)]);
  const files = fs.readdirSync(path.join(ROOT, 'public/assets/npcbody'))
    .filter((f) => f.endsWith('.png'))
    .map((f) => f.replace('.png', ''));
  const unused = files.filter((f) => !used.has(f));
  assert.deepEqual(unused, [], `미사용 본체 에셋: ${unused.join(', ')}`);
});

test('채집가·정원사는 주민이 아니라 직업성 있는 외형을 쓴다', () => {
  const data = read('src/game/data.ts');
  for (const name of ['허브 채집가 베르', '정원사']) {
    const i = data.indexOf(name);
    assert.ok(i > 0, `${name} 를 못 찾았다`);
    const seg = data.slice(i, i + 120);
    assert.equal(seg.includes('"spum_forager"'), false, `${name} 가 다시 forager(주민) 외형이다`);
    assert.ok(seg.includes('"spum_mystic"'), `${name} 가 mystic 외형이 아니다: ${seg.slice(0, 90)}`);
  }
});

test('신전 관리인은 사제 외형을 쓴다', () => {
  const data = read('src/game/data.ts');
  const i = data.indexOf('신전 관리인 노아');
  assert.ok(i > 0);
  const seg = data.slice(i, i + 120);
  assert.ok(seg.includes('"spum_priest"'), `신전 관리인이 사제가 아니다: ${seg.slice(0, 90)}`);
  /* spum_priest 매핑이 3곳(본체 2 + 초상화 1) 모두에 있어야 한다 */
  const map = readJson('public/assets/npcportrait/_map.json');
  assert.ok(map['spum_priest'], '초상화 매핑에 spum_priest 가 없다');
  assert.equal(map['spum_priest'].source.endsWith('npcbody_priest.png'), true);
  assert.ok(bodyMapOf(read('src/game/scenes/WorldScene.ts'))['spum_priest'], 'WorldScene 본체 매핑 누락');
  assert.ok(bodyMapOf(read('src/game/scenes/BootScene.ts'))['spum_priest'], 'BootScene 본체 매핑 누락');
});

test('전쟁 유령은 투구+방패 실루엣(devil)을 유지한다', () => {
  /* npcbody_devil 은 이름과 달리 실제로는 투구·방패·갑옷의 데스나이트형이라
   *  "전쟁 유령"에 가장 맞는 에셋이다. 이름만 보고 다른 것으로 바꾸면 실루엣이 깨진다. */
  const data = read('src/game/data.ts');
  const i = data.indexOf('전쟁 유령 아르벨');
  assert.ok(i > 0);
  assert.ok(data.slice(i, i + 120).includes('"spum_skel"'), '전쟁 유령 외형이 바뀌었다');
  assert.equal(bodyMapOf(read('src/game/scenes/WorldScene.ts'))['spum_skel'], 'npcbody_devil');
});
