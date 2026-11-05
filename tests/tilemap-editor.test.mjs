import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GROUND_SOURCES, GROUND_PALETTE, GROUND_ROLES,
  tileGidFor, buildLayerData,
  snapPropScale, PROP_MAX_CELLS, edgeDecorPlacement, propIsSolid,
  validateLayout, createLayout, serializeLayout, deserializeLayout,
} from '../src/game/tilemapEditorCore.ts';

/**
 * 타일맵 에디터 코어 (지시: "타일맵 에디터").
 *
 * [왜 이 테스트가 중요한가]
 *  에디터는 **게임과 픽셀 단위로 같은 결과**를 보여야 한다. 렌더 규칙을 복사하면
 *  반드시 갈라지므로, 게임(AuthoredMapLayers)과 에디터가 같은 코어 함수를 쓴다.
 *  이 테스트는 그 코어가 게임이 요구하는 규칙을 지키는지 고정한다.
 *
 *  · 타일 gid 규칙 (ground 항상 / paths 는 path 셀만 / structures 는 벽 셀만)
 *  · 프롭 배율이 셀의 반 칸 배수로 정규화되는지
 *  · 경계 장식 좌표가 셀을 넘지 않고 반 칸 격자에 붙는지
 *  · 레이아웃 검증이 고립된 방·막힌 입출구를 잡는지
 *  · 저장/불러오기 왕복이 정보를 잃지 않는지
 */

const CELL_W = 150.667, CELL_H = 131.111;   // howlrstone1x2 실측(비정수)

test('바닥 소스 규격이 게임과 일치한다', () => {
  /* AuthoredMapLayers.AUTHORED_GROUND_SOURCES 와 동일해야 한다 —
   *  여기가 틀리면 타일 조각 수(sourceCols)가 어긋나 엉뚱한 프레임이 나온다. */
  const expected = {
    ground_meadow: { size: 64, unit: 32 },
    ground_dirt: { size: 84, unit: 28 },
    ground_sand: { size: 84, unit: 28 },
    ground_forest: { size: 96, unit: 32 },
    ground_slate: { size: 96, unit: 32 },
    ground_ash: { size: 96, unit: 32 },
    ground_violet: { size: 96, unit: 32 },
    ground_cavern: { size: 96, unit: 32 },
  };
  assert.deepEqual(GROUND_SOURCES, expected);
  /* 팔레트는 소스 키와 일치 */
  assert.deepEqual([...GROUND_PALETTE].sort(), Object.keys(expected).sort());
  /* 조각 수가 정수여야 한다(size/unit) */
  for (const [k, v] of Object.entries(GROUND_SOURCES)) {
    assert.equal(v.size % v.unit, 0, `${k}: size ${v.size} 가 unit ${v.unit} 의 배수가 아니다`);
  }
});

test('타일 gid: ground 는 항상, paths 는 path 셀만, structures 는 벽 셀만', () => {
  const base = { tc: 2, tr: 3, cell: 0, sourceCols: 3, atlasFrames: 0 };
  /* ground — 열림/막힘 무관하게 그린다 */
  assert.notEqual(tileGidFor({ ...base, role: 'ground', cellOpen: false, isPath: false }), -1);
  assert.notEqual(tileGidFor({ ...base, role: 'ground', cellOpen: true, isPath: false }), -1);
  /* paths — path 셀에서만 */
  assert.equal(tileGidFor({ ...base, role: 'paths', cellOpen: true, isPath: false }), -1);
  assert.notEqual(tileGidFor({ ...base, role: 'paths', cellOpen: true, isPath: true }), -1);
  /* structures — 벽 셀에서만 */
  assert.equal(tileGidFor({ ...base, role: 'structures', cellOpen: true, isPath: false }), -1);
  assert.notEqual(tileGidFor({ ...base, role: 'structures', cellOpen: false, isPath: false }), -1);
});

test('타일 gid: 원본 조각을 순환 배치하고 아틀라스에서 4프레임을 고른다', () => {
  const sourceCols = 3;
  /* 같은 조각 인덱스는 같은 기본 gid (tc·tr 을 sourceCols 로 순환) */
  const a = tileGidFor({ role: 'ground', tc: 0, tr: 0, cell: 0, cellOpen: true, isPath: false, sourceCols, atlasFrames: 0 });
  const b = tileGidFor({ role: 'ground', tc: 3, tr: 0, cell: 0, cellOpen: true, isPath: false, sourceCols, atlasFrames: 0 });
  assert.equal(a, b, 'sourceCols 주기로 순환해야 한다');
  assert.equal(a, 1, '첫 조각은 gid 1 (Phaser tileset 은 1-based)');

  /* 아틀라스 사용 시 gid 는 프레임 수만큼 커진다 */
  const withAtlas = tileGidFor({ role: 'ground', tc: 1, tr: 1, cell: 0, cellOpen: true, isPath: false, sourceCols, atlasFrames: 4 });
  assert.ok(withAtlas > 0);
  assert.ok(withAtlas <= 1 + 4 * sourceCols, `gid ${withAtlas} 가 아틀라스 범위를 넘었다`);
});

test('프롭 배율: 주축이 셀의 반 칸 배수로 정규화된다', () => {
  /* 실제 프롭 원본 크기 — 회귀 방지용 대표값 */
  const samples = [
    ['obj_dungeon_torch', 28, 52],
    ['obj_dungeon_chest', 48, 40],
    ['obj_dungeon_anvil', 52, 36],
    ['obj_dungeon_bookshelf', 64, 128],
    ['obj_forest_tree_pink', 65, 80],
    ['obj_forest_rock_monument', 100, 89],
    ['obj_town_house_blue', 160, 112],
  ];
  for (const [key, w, h] of samples) {
    const s = snapPropScale(w, h, 1, CELL_W, CELL_H, key);
    assert.ok(Number.isFinite(s) && s >= 0.5 && s <= 2.5, `${key}: 배율 ${s} 가 범위를 벗어남`);
    const dw = w * s, dh = h * s;
    const cap = PROP_MAX_CELLS[key] ?? 1;
    /* 어떤 축도 상한 칸수를 넘지 않아야 한다 */
    assert.ok(dw / CELL_W <= cap + 0.01, `${key}: 폭 ${(dw / CELL_W).toFixed(2)}칸 > 상한 ${cap}`);
    assert.ok(dh / CELL_H <= cap + 0.01, `${key}: 높이 ${(dh / CELL_H).toFixed(2)}칸 > 상한 ${cap}`);
    /* 주축은 반 칸 배수에 근접해야 한다(±2px) */
    const relW = dw / CELL_W, relH = dh / CELL_H;
    const major = Math.max(relW, relH);
    const cell = relW >= relH ? CELL_W : CELL_H;
    const off = Math.abs(major / 0.5 - Math.round(major / 0.5)) * 0.5 * cell;
    assert.ok(off <= 2.0, `${key}: 주축 오차 ${off.toFixed(1)}px — 격자에 안 맞는다`);
  }
});

test('경계 장식 좌표: 셀을 넘지 않고 반 칸 격자에 붙는다', () => {
  /* 4방향 × 여러 셀에서 '셀 밖으로 나가지 않는가' */
  for (const c of [0, 1, 5, 12]) {
    for (const r of [0, 2, 7]) {
      for (const sides of [['n'], ['s'], ['e'], ['w'], ['n', 'w'], ['s', 'e']]) {
        const { x, y } = edgeDecorPlacement({ c, r, cellW: CELL_W, cellH: CELL_H, sides });
        const ci = Math.floor(x / CELL_W), ri = Math.floor(y / CELL_H);
        assert.equal(ci, c, `sides=${sides} x=${x} → 셀 ${ci} (기대 ${c})`);
        assert.equal(ri, r, `sides=${sides} y=${y} → 셀 ${ri} (기대 ${r})`);
        /* 반 칸 격자 정렬 (±1px) */
        const ox = Math.abs(x / (CELL_W * 0.5) - Math.round(x / (CELL_W * 0.5))) * CELL_W * 0.5;
        const oy = Math.abs(y / (CELL_H * 0.5) - Math.round(y / (CELL_H * 0.5))) * CELL_H * 0.5;
        assert.ok(ox <= 1 && oy <= 1, `sides=${sides} 격자 오차 ${ox.toFixed(1)},${oy.toFixed(1)}`);
      }
    }
  }
});

test('충돌 프롭 판정이 게임 규칙과 같다', () => {
  /* isSolidDecor 를 그대로 쓰므로 대표값만 확인 */
  assert.equal(propIsSolid('obj_dungeon_bookshelf'), true);
  assert.equal(propIsSolid('obj_dungeon_torch'), false);   // (torch) 예외 규칙
  assert.equal(propIsSolid('obj_dungeon_carpet_v'), false);
  assert.equal(propIsSolid('obj_town_house_blue'), true);
  assert.equal(propIsSolid('obj_forest_tree_pink'), true);
  assert.equal(propIsSolid('obj_dungeon_chest'), false);   // 목록에 없는 키 → false
});

test('레이아웃 검증: 고립된 방과 막힌 입출구를 잡는다', () => {
  /* 정상 — createLayout 은 연결된 개방 영역을 만든다 */
  const ok = createLayout(9, 7, CELL_W, CELL_H);
  const v1 = validateLayout(ok);
  assert.equal(v1.ok, true, `정상 레이아웃이 실패: ${v1.errors.join(', ')}`);

  /* 고립된 방 — 입구에서 갈 수 없는 섬을 만든다.
   *  [함정] createLayout 은 1..cols-2 를 전부 개방하므로 그 안의 셀은 이미 연결돼 있다.
   *   반드시 **벽으로 둘러싸인** 개방 셀을 만들어야 고립이 된다(테두리 안쪽 한 칸 + 사방 벽). */
  const iso = createLayout(9, 7, CELL_W, CELL_H);
  /* (c=1,r=1) 을 개방하되 사방을 벽으로 막는다 → 어떤 경로로도 도달 불가 */
  const isl = 1 * iso.cols + 1;
  iso.open[isl] = true;
  iso.open[1 * iso.cols + 0] = false;          // 좌
  iso.open[1 * iso.cols + 2] = false;          // 우
  iso.open[0 * iso.cols + 1] = false;          // 상(이미 벽)
  iso.open[2 * iso.cols + 1] = false;          // 하
  const v2 = validateLayout(iso);
  assert.equal(v2.ok, false, '고립된 셀을 못 잡았다');
  assert.ok(v2.errors.some((e) => e.includes('도달')), `예상한 오류가 없다: ${v2.errors.join(', ')}`);

  /* 입구를 벽으로 막는다 */
  const blocked = createLayout(9, 7, CELL_W, CELL_H);
  blocked.open[blocked.entry] = false;
  const v3 = validateLayout(blocked);
  assert.equal(v3.ok, false);
  assert.ok(v3.errors.some((e) => e.includes('입구')), v3.errors.join(', '));

  /* 입구=출구 */
  const same = createLayout(9, 7, CELL_W, CELL_H);
  same.exit = same.entry;
  assert.ok(validateLayout(same).errors.some((e) => e.includes('같은 셀')));
});

test('저장/불러오기 왕복이 정보를 보존한다', () => {
  const lay = createLayout(11, 8, CELL_W, CELL_H);
  lay.paths[2 * 11 + 3] = true;
  lay.paths[2 * 11 + 4] = true;
  lay.open[3 * 11 + 5] = false;
  const doc = serializeLayout({
    ...lay, props: [{ key: 'obj_dungeon_torch', cell: 2 * 11 + 3, x: 100.123, y: 200.456, scale: 1.2345 }],
    theme: 'library', ground: 'ground_ash', path: 'ground_slate',
    structure: 'ground_cavern', structureTint: 0x967958, name: 'unit',
  });

  /* 사람이 읽을 수 있는 행 문자열이어야 한다 */
  assert.equal(doc.openRows.length, 8);
  assert.equal(doc.openRows[0].length, 11);
  assert.ok(/^[.#]+$/.test(doc.openRows[0]), `openRows 가 압축 형식이 아니다: ${doc.openRows[0]}`);

  const back = deserializeLayout(JSON.parse(JSON.stringify(doc)));
  assert.ok(back, '복원 실패');
  assert.equal(back.cols, lay.cols);
  assert.equal(back.rows, lay.rows);
  assert.deepEqual(back.open, lay.open.map(Boolean), 'open 이 보존되지 않았다');
  assert.deepEqual(back.paths, lay.paths.map(Boolean), 'paths 가 보존되지 않았다');
  assert.equal(back.entry, lay.entry);
  assert.equal(back.exit, lay.exit);
  assert.equal(back.props.length, 1);
  /* 좌표는 소수 2자리, 배율은 3자리로 반올림 저장 (1.2345 는 1.235 로 올라간다) */
  assert.equal(back.props[0].x, 100.12);
  assert.equal(back.props[0].scale, 1.235);   // 1.2345 → Math.round(x*1000)/1000
});

test('불러오기: 손상 입력을 거부한다', () => {
  assert.equal(deserializeLayout(null), null);
  assert.equal(deserializeLayout({}), null);
  assert.equal(deserializeLayout({ cols: 5, rows: 3 }), null);          // openRows 없음
  assert.equal(deserializeLayout({ cols: 5, rows: 3, openRows: ['..'] }), null);  // 길이 불일치
  assert.equal(deserializeLayout({ cols: 0, rows: 3, openRows: [] }), null);
});

test('buildLayerData 가 게임과 같은 타일 배열을 만든다', () => {
  const lay = createLayout(6, 4, CELL_W, CELL_H);
  const ground = buildLayerData(lay, 'ground', 'ground_slate', 0);
  assert.ok(ground);
  /* 타일 크기는 unit, 개수는 맵 크기를 unit 으로 나눈 올림 */
  assert.equal(ground.tileWidth, 32);
  assert.equal(ground.cols, Math.ceil((6 * CELL_W) / 32));
  assert.equal(ground.rows, Math.ceil((4 * CELL_H) / 32));
  /* ground 레이어는 -1 이 없어야 한다(항상 그린다) */
  const flat = ground.data.flat();
  assert.equal(flat.filter((v) => v === -1).length, 0, 'ground 에 빈 타일이 있다');
  assert.ok(flat.every((v) => v >= 1), 'gid 는 1-based 여야 한다');

  /* 미지의 소스 키는 null */
  assert.equal(buildLayerData(lay, 'ground', 'ground_unknown', 0), null);
});
