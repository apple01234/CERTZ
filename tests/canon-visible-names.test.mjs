import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/* 2026-11-14 — 정본(docs/handoff/evernote-approved/1~8.txt)에 없는 고유명사와 폐기 별칭이
 * 플레이어에게 보이는 데이터로 다시 들어오지 않게 잠근다. 주석·내부 키(boss_nidhog 등)는 대상이 아니다.
 * 근거: docs/handoff/CANON_NAMES.md §10-2(정본 외 명칭) · §10-3(폐기 별칭) · §11(채택 규칙). */
const FORBIDDEN = /니드호그|수르트|펜리르|스콜|하티|가름|요르문간드|나그라파르|아부디토스|베오르드|가르간|하울르스톤|바르가|세라피나|무스펠|니플헤임|발할라|라그나로크|발키리|이현|리엘의 스승|에스텔라|윤지|라일락월드|그랜드플래닛|그랜드 플래닛|그렌드플레닛|헬의/;

const MODULES = ['stages', 'data', 'howlrstone', 'lilacStory', 'lilacScenarios', 'grandPlanetCanon', 'bossRush', 'union', 'isekai', 'classroom', 'fifth2', 'unlocks', 'chibiQuests', 'storyCutscenes'];

function strings(v, path, out, seen) {
  if (v == null) return;
  if (typeof v === 'string') { out.push([path, v]); return; }
  if (typeof v !== 'object' || seen.has(v)) return;
  seen.add(v);
  for (const [k, c] of Object.entries(v)) strings(c, `${path}.${k}`, out, seen);
}

test('플레이어에게 보이는 데이터에 정본 외 명칭·폐기 별칭이 없다', async () => {
  const bad = [];
  for (const m of MODULES) {
    const mod = await import(`../src/game/${m}.ts`);
    const out = [];
    for (const [k, v] of Object.entries(mod)) strings(v, `${m}.${k}`, out, new Set());
    for (const [p, s] of out) if (FORBIDDEN.test(s)) bad.push(`${p}: ${s.slice(0, 80)}`);
  }
  assert.deepEqual(bad, []);
});

test('보스 이름이 바뀌어도 의뢰문 조사가 맞는다', async () => {
  const { objJosa, STAGES } = await import('../src/game/stages.ts');
  assert.equal(objJosa('재림의 파수꾼'), '재림의 파수꾼을');
  assert.equal(objJosa('재림의 천사기사'), '재림의 천사기사를');
  for (const st of Object.values(STAGES)) {
    for (const q of st.quests ?? []) assert.doesNotMatch(q.desc ?? '', /[을를]를 처치|[가-힣]을을|를를/, `${st.key}: ${q.desc}`);
  }
});

test('도사의 사부는 태을선인 초상화를 쓰고 폐기 별칭 초상 키는 없다', () => {
  const map = JSON.parse(fs.readFileSync(new URL('../public/assets/npcportrait/_map.json', import.meta.url), 'utf8'));
  assert.ok(map['태을선인'], '태을선인 초상 없음');
  for (const k of ['이현', '이현선인', '리엘의 스승']) assert.equal(map[k], undefined, `${k} 초상 키가 남아 있다`);
});
