import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadMapOverrides, overrideToLayout, hasMapOverride, mapOverrideSeeds,
  __resetMapOverrides, __setMapOverride,
} from '../src/game/mapOverrides.ts';

/**
 * 맵 오버라이드 — 에디터 저장 → 게임 반영 (사용자 지시 "맵메이커 최종 완성").
 *
 * [왜 이 테스트가 필요한가]
 *  에디터가 JSON 을 만들 수 있어도 게임이 그걸 읽지 않으면 도구가 반쪽이다.
 *  이 테스트는 "저장된 맵이 실제로 레이아웃이 되는가"와
 *  **"잘못된 맵이 게임을 막지 않는가"**를 고정한다.
 *
 *  특히 마지막 조건이 중요하다 — 맵 데이터 하나가 깨졌다고 스테이지에 진입할 수
 *  없으면 안 되므로, 불변식 위반 시 반드시 프리셋으로 폴백해야 한다.
 */

/** 에디터 serializeLayout 과 같은 형식의 문서 */
function doc(over = {}) {
  return {
    version: 1,
    name: 'howlrstone1x2',
    cols: 9, rows: 7,
    cellW: 150.667, cellH: 131.111,
    openRows: [
      '#########',
      '#.......#',
      '#.......#',
      '#.......#',
      '#.......#',
      '#.......#',
      '#########',
    ],
    pathRows: [
      '.........',
      '.........',
      '..===....',
      '.........',
      '.........',
      '.........',
      '.........',
    ],
    entry: 3 * 9 + 1,
    exit: 3 * 9 + 7,
    theme: 'library',
    ground: 'ground_ash',
    path: 'ground_slate',
    structure: 'ground_cavern',
    structureTint: 0x967958,
    props: [{ key: 'obj_dungeon_torch', cell: 2 * 9 + 3, x: 500, y: 300, scale: 1.26 }],
    ...over,
  };
}

test.beforeEach(() => __resetMapOverrides());

test('저장된 오버라이드가 레이아웃으로 변환된다', () => {
  __setMapOverride('howlrstone1x2', doc());
  assert.equal(hasMapOverride('howlrstone1x2'), true);
  assert.deepEqual(mapOverrideSeeds(), ['howlrstone1x2']);

  const r = overrideToLayout('howlrstone1x2');
  assert.ok(r, '변환 실패');
  assert.equal(r.ok, true, `불변식 위반: ${JSON.stringify(r)}`);
  assert.equal(r.layout.cols, 9);
  assert.equal(r.layout.rows, 7);
  assert.equal(r.layout.open.length, 63);
  /* 개방 셀 수 — 테두리 1칸씩 벽 */
  assert.equal(r.layout.open.filter(Boolean).length, 5 * 7);
  /* 길 레이어가 보존된다 — pathRows 의 '===는 3칸 */
  assert.equal(r.layout.authored.paths.filter(Boolean).length, 3);
  assert.equal(r.layout.authored.ground, 'ground_ash');
  assert.equal(r.layout.authored.theme, 'library');
});

test('입구/출구가 열려 있지 않으면 ok=false (게임은 프리셋으로 폴백)', () => {
  /* 입구를 벽으로 막은 문서 */
  const rows = doc().openRows.slice();
  rows[3] = '##' + rows[3].slice(2);
  __setMapOverride('howlrstone1x2', doc({ openRows: rows }));
  const r = overrideToLayout('howlrstone1x2');
  assert.ok(r, '문서는 있어야 한다');
  assert.equal(r.ok, false, '막힌 입구를 통과시켰다');
});

test('입구와 출구가 같으면 ok=false', () => {
  __setMapOverride('howlrstone1x2', doc({ exit: doc().entry }));
  assert.equal(overrideToLayout('howlrstone1x2').ok, false);
});

test('행 길이가 cols 와 다르면 null (손상 데이터 무시)', () => {
  const rows = doc().openRows.slice();
  rows[2] = '#...#';                 // 짧은 행
  __setMapOverride('howlrstone1x2', doc({ openRows: rows }));
  assert.equal(overrideToLayout('howlrstone1x2'), null);
});

test('openRows 개수가 rows 와 다르면 null', () => {
  const rows = doc().openRows.slice(0, 4);
  __setMapOverride('howlrstone1x2', doc({ openRows: rows }));
  assert.equal(overrideToLayout('howlrstone1x2'), null);
});

test('cols/rows 가 비정상이면 null', () => {
  __setMapOverride('a', doc({ cols: 0, rows: 0 }));
  assert.equal(overrideToLayout('a'), null);
  __setMapOverride('b', doc({ cols: 2, rows: 2 }));   // 3 미만
  assert.equal(overrideToLayout('b'), null);
});

test('오버라이드가 없는 시드는 null', () => {
  assert.equal(overrideToLayout('howlrstone9x9'), null);
  assert.equal(hasMapOverride('howlrstone9x9'), false);
});

test('loadMapOverrides: 매니페스트가 없으면 0 을 반환하고 throw 하지 않는다', async () => {
  /* 404 를 내는 fetch 스텁 — 에디터로 아무것도 저장하지 않은 초기 상태 */
  const fakeFetch = async () => ({ ok: false, json: async () => [] });
  const n = await loadMapOverrides(fakeFetch);
  assert.equal(n, 0, '매니페스트 없음이 예외가 되면 게임 부팅이 막힌다');
});

test('loadMapOverrides: 네트워크 오류에도 throw 하지 않는다', async () => {
  const fakeFetch = async () => { throw new Error('network down'); };
  await assert.doesNotReject(() => loadMapOverrides(fakeFetch),
    '오프라인/APK 첫 실행에서 게임이 죽으면 안 된다');
});

test('loadMapOverrides: 매니페스트와 맵을 읽어 등록한다', async () => {
  const d = doc();
  const fakeFetch = async (url) => {
    if (String(url).includes('_index.json')) {
      return { ok: true, json: async () => [{ seed: 'howlrstone1x2', file: 'howlrstone1x2.json' }] };
    }
    return { ok: true, json: async () => d };
  };
  const n = await loadMapOverrides(fakeFetch);
  assert.equal(n, 1);
  assert.equal(hasMapOverride('howlrstone1x2'), true);
  const r = overrideToLayout('howlrstone1x2');
  assert.equal(r.ok, true);
});

test('loadMapOverrides: 손상된 맵 항목은 건너뛴다', async () => {
  const fakeFetch = async (url) => {
    if (String(url).includes('_index.json')) {
      return { ok: true, json: async () => ['good', 'bad'] };
    }
    if (String(url).endsWith('bad.json')) {
      return { ok: true, json: async () => ({ cols: 'x' }) };  // openRows 없음
    }
    return { ok: true, json: async () => doc() };
  };
  const n = await loadMapOverrides(fakeFetch);
  assert.equal(n, 1, '정상 맵 1개만 등록돼야 한다');
  assert.equal(hasMapOverride('good'), true);
  assert.equal(hasMapOverride('bad'), false);
});
