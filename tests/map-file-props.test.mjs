// vc253 — 맵 파일(public/assets/maps/<seed>.json) 기반 프롭 배치 계약.
//
// [지키는 것]
//  1) 파일의 props 가 overrideToLayout 을 거쳐 authored.props 로 **살아 넘어온다**
//     (종전엔 읽지도 않고 버려서 에디터 배치가 게임에 반영되지 않았다)
//  2) 파일 좌표 규칙: 발밑 = 셀 아래쪽 중앙 → y=(row+1)*cellH
//  3) solid:true 인 프롭만 셀을 막는다 → 그림과 판정이 같은 출처
//  4) props 가 없으면 authored.props 도 없어야 한다(절차 생성 맵의 자동 배치 보존)
import assert from 'node:assert/strict';
import {
  __setMapOverride, __resetMapOverrides, overrideToLayout,
} from '../src/game/mapOverrides.ts';

const CELL_W = 144;
const CELL_H = 128;

function doc(props, extra = {}) {
  return {
    version: 1,
    name: 'contract',
    cols: 5,
    rows: 4,
    cellW: CELL_W,
    cellH: CELL_H,
    openRows: [
      '#####',
      '#...#',
      '#...#',
      '#####',
    ],
    pathRows: [
      '.....',
      '.===.',
      '.===.',
      '.....',
    ],
    entry: 1 * 5 + 1,
    exit: 2 * 5 + 3,
    theme: 'dungeon',
    ground: 'ground_ash',
    path: 'ground_slate',
    structure: 'ground_cavern',
    structureTint: 0x967958,
    ...extra,
    ...(props ? { props } : {}),
  };
}

/* ── 1. props 가 버려지지 않고 넘어온다 ─────────────────────────────── */
{
  __resetMapOverrides();
  __setMapOverride('t1', doc([
    { key: 'obj_dungeon_bookshelf', cell: 1 * 5 + 1, x: 1.5 * CELL_W, y: 2 * CELL_H, scale: 1 },
  ]));
  const out = overrideToLayout('t1');
  assert.ok(out, 'overrideToLayout 이 null 이면 안 된다');
  const props = out.layout.authored?.props;
  assert.ok(Array.isArray(props) && props.length === 1, `props 가 넘어와야 한다 (받은 값: ${JSON.stringify(props)})`);
  assert.equal(props[0].key, 'obj_dungeon_bookshelf');
  assert.equal(props[0].scale, 1);
  assert.equal(props[0].solid, false, 'solid 미지정이면 장식(충돌 없음)');
}

/* ── 2. 좌표 규칙 — x/y 가 없으면 셀 아래쪽 중앙으로 계산 ────────────── */
{
  __resetMapOverrides();
  __setMapOverride('t2', doc([
    { key: 'obj_dungeon_torch', cell: 1 * 5 + 1, x: 0, y: 0, scale: 1 },
    { key: 'obj_dungeon_jar__1', cell: 2 * 5 + 3, x: 0, y: 0, scale: 1 },
  ]));
  const out = overrideToLayout('t2');
  const props = out.layout.authored.props;
  assert.equal(props[0].x, 1.5 * CELL_W, 'x = (col+0.5)*cellW');
  assert.equal(props[0].y, 2 * CELL_H, 'y = (row+1)*cellH (발밑이 셀 아래 경계)');
  assert.equal(props[1].x, 3.5 * CELL_W);
  assert.equal(props[1].y, 3 * CELL_H);
}

/* ── 3. solid:true 만 셀을 막는다 ──────────────────────────────────── */
{
  __resetMapOverrides();
  __setMapOverride('t3', doc([
    { key: 'obj_dungeon_throne', cell: 1 * 5 + 1, x: 1.5 * CELL_W, y: 2 * CELL_H, scale: 1, solid: false },
  ]));
  const free = overrideToLayout('t3');
  assert.equal(free.layout.open[1 * 5 + 1], true, 'solid:false 는 통행을 막지 않는다');

  __resetMapOverrides();
  __setMapOverride('t4', doc([
    { key: 'obj_dungeon_throne', cell: 1 * 5 + 1, x: 1.5 * CELL_W, y: 2 * CELL_H, scale: 1, solid: true },
  ]));
  const solid = overrideToLayout('t4');
  assert.equal(solid.layout.open[1 * 5 + 1], false, 'solid:true 는 그 셀을 막는다');
}

/* ── 4. props 가 없으면 authored.props 도 없다 ─────────────────────── */
{
  __resetMapOverrides();
  __setMapOverride('t5', doc(null));
  const out = overrideToLayout('t5');
  assert.equal(out.layout.authored.props, undefined,
    'props 미지정이면 authored.props 가 없어야 절차 생성 자동 배치가 그대로 동작한다');
}

/* ── 5. 모든 맵 파일이 로더 계약을 만족하는가 (실제 파일) ───────────── */
{
  const fs = await import('node:fs');
  const path = await import('node:path');
  const dir = 'public/assets/maps';
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('_'));
    for (const f of files) {
      const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      assert.ok(Number.isInteger(d.cols) && Number.isInteger(d.rows), `${f}: cols/rows`);
      assert.equal(d.openRows.length, d.rows, `${f}: openRows 길이`);
      for (const p of d.props ?? []) {
        assert.ok(typeof p.key === 'string' && p.key.length > 0, `${f}: prop key`);
        assert.ok(Number.isInteger(p.cell) && p.cell >= 0 && p.cell < d.cols * d.rows,
          `${f}: ${p.key} cell 범위 밖 (${p.cell})`);
      }
    }
    console.log(`map-file: ${files.length}개 맵 파일 계약 OK`);
  }
}

__resetMapOverrides();
console.log('map file props: all checks OK');
