import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { authoredOpenXY, authoredRoomLayout } from '../src/game/authoredLayouts.ts';
import { AUTHORED_GROUND_SOURCES, renderAuthoredMapLayers } from '../src/game/fx/AuthoredMapLayers.ts';
import { isSolidDecor } from '../src/game/decorObjects.ts';
import { HOWLRSTONE_CHAPTERS } from '../src/game/howlrstone.ts';

function reachable(lay) {
  const visited = new Set([lay.entry]), queue = [lay.entry];
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i], x = cell % lay.cols, y = Math.floor(cell / lay.cols);
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const xx = x + dx, yy = y + dy, next = yy * lay.cols + xx;
      if (xx >= 0 && xx < lay.cols && yy >= 0 && yy < lay.rows && lay.open[next] && !visited.has(next)) {
        visited.add(next); queue.push(next);
      }
    }
  }
  return visited;
}

test('all 65 story rooms and 100 planet fields have one connected, protected route', () => {
  const cases = HOWLRSTONE_CHAPTERS.flatMap(spec => Array.from({ length: spec.stages }, (_, i) => ({
    key: `${spec.key}x${i + 1}`, width: spec.width + (i + 1) * 130, height: spec.height + (i + 1) * 30,
    boss: !!spec.boss && i + 1 === spec.stages,
  })));
  assert.equal(cases.length, 65);
  for (const planet of ['stargate','prisma','ocean','reverse','neocity','mech','swallow','opinicia','novel','sernium']) {
    for (let sub = 1; sub <= 10; sub++) cases.push({ key: `dlc${planet}${sub}`, width: 2200 + sub * 130, height: 1200 + sub * 30, boss: sub === 10 });
  }
  for (const { key, width, height, boss } of cases) {
    const lay = authoredRoomLayout(key, width, height);
    assert.ok(lay, key);
    const seen = reachable(lay);
    assert.equal(seen.size, lay.open.filter(Boolean).length, `${key}: disconnected chamber`);
    assert.ok(seen.has(lay.exit), `${key}: exit unreachable`);
    assert.equal(lay.authored.theme === 'arena', boss, `${key}: arena only at real chapter bosses`);
    assert.deepEqual(lay, authoredRoomLayout(key, width, height), `${key}: deterministic revisit`);
    assert.ok(lay.cellW < 170 && lay.cellH < 150, `${key}: detailed room grid`);
    assert.ok(lay.authored.paths.every((p, i) => !p || lay.open[i]), `${key}: path inside wall`);
    for (let r = 0; r < lay.rows; r++) for (let c = 0; c < lay.cols; c++) {
      const cell = r * lay.cols + c;
      if (!lay.open[cell]) {
        assert.equal(authoredOpenXY(lay, (c + 0.5) * lay.cellW, (r + 0.5) * lay.cellH, 26), false);
      } else {
        if (c < lay.cols - 1 && lay.open[cell + 1]) assert.ok(authoredOpenXY(lay, (c + 1) * lay.cellW, (r + 0.5) * lay.cellH, 26), `${key}: false horizontal seam blocker`);
        if (r < lay.rows - 1 && lay.open[cell + lay.cols]) assert.ok(authoredOpenXY(lay, (c + 0.5) * lay.cellW, (r + 1) * lay.cellH, 26), `${key}: false vertical seam blocker`);
      }
    }
    for (const { cell } of lay.authored.landmarks) assert.ok(seen.has(cell), `${key}: unreachable landmark`);
    // Existing entryHome adds70px; its whole player footprint must remain on walkable cells.
    const entryX = (lay.entry % lay.cols + 0.5) * lay.cellW + 70;
    const entryY = (Math.floor(lay.entry / lay.cols) + 0.5) * lay.cellH;
    for (const dx of [-24,24]) for (const dy of [-24,24]) {
      const cell = Math.floor((entryY + dy) / lay.cellH) * lay.cols + Math.floor((entryX + dx) / lay.cellW);
      assert.ok(lay.open[cell], `${key}: entry body inside wall`);
    }
  }
});

test('story geography has distinct authored structures and no changes to feature maps', () => {
  const expected = { howlrstone1x1: 'library', howlrstone3x1: 'coast', howlrstone6x1: 'grove', howlrstone10x1: 'citadel' };
  const masks = [];
  for (const [key, theme] of Object.entries(expected)) {
    const lay = authoredRoomLayout(key, 2400, 1280);
    assert.equal(lay.authored.theme, theme);
    masks.push(lay.open.join(','));
  }
  assert.equal(new Set(masks).size, 4);
  const citadel = authoredRoomLayout('howlrstone10x2', 2400, 1280);
  assert.deepEqual(citadel.authored.landmarks.map(x => x.kind), ['gate-water','gate-wind','gate-lightning','gate-fire']);
  assert.equal(citadel.open[citadel.cols + 6], false, 'gate rooms retain walls between their north entrances');
  const coast = authoredRoomLayout('howlrstone3x1', 2400, 1280);
  assert.equal(coast.authored.landmarks.filter(x => x.kind === 'pier').length, 2);
  for (const key of ['village', 'youngprincessv', 'dlcstargatev', 'forest1', 'dojang', 'tower1', 'howlrstone99x1', 'howlrstone1x99', 'dlcunknown1']) {
    assert.equal(authoredRoomLayout(key, 2400, 1280), null, key);
  }
});

test('Authored floor bands clip to cell edges and never bleed or leave gaps', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../public/assets/ground/manifest.json', import.meta.url)));
  const existingProp = key => ['dungeon','forest','town'].some(set => fs.existsSync(new URL(`../public/assets/objects/${set}/${key}.png`, import.meta.url)));
  const events = [];
  const makeScene = () => {
    const bands = [];
    return {
      bands,
      textures: { exists: key => key in manifest || existingProp(key), get: key => ({ getSourceImage: () => manifest[key] }) },
      add: {
        image: (x, y, key) => {
          const image = { x, y, key, setOrigin() { return this; }, setScale(scale) { this.scale = scale; return this; }, setDepth() { return this; }, setName(name) { this.name = name; return this; }, setTint() { return this; } };
          return image;
        },
        /* vc275 — 지면/경로/구조물은 셀 크기로 클리핑한 TileSprite 밴드로 그린다. */
        tileSprite: (x, y, w, h, key) => {
          const ts = { x, y, w, h, key, name: '', tilePosition: { x: 0, y: 0 },
            setOrigin() { return this; }, setDepth() { return this; }, setTint() { return this; },
            setName(name) { this.name = name; return this; },
            setTilePosition(tx, ty) { this.tilePosition = { x: tx, y: ty }; return this; },
            destroy() { this.destroyed = true; } };
          bands.push(ts); return ts;
        },
      },
      events: { once: (event, fn) => events.push({ event, fn }) },
    };
  };
  const scene = makeScene();
  const lay = authoredRoomLayout('howlrstone1x1', 2400, 1280);
  const before = [...lay.open];
  const result = renderAuthoredMapLayers(scene, lay, () => {});
  assert.ok(result, 'authored layers render');
  assert.deepEqual(lay.open, before, 'rendering never mutates collision grid');
  /* vc275 — 지면/경로/구조물은 images 가 아니라 TileSprite 밴드로 그린다.
   *  images 에는 프롭(구조물/경계장식)만 담긴다. */
  assert.ok(scene.bands.length > 0, 'floor art is emitted as tile bands');
  assert.ok(result.images.every(x => String(x.name).startsWith('rea:')),
    'images only carries props, never floor art');

  /* ═══ vc275 핵심 계약 — P1b "경계 잘림/틈" 회귀 방지 ═══
   *  각 밴드는 (1) 셀 경계에 정확히 붙고 (2) 셀 크기를 넘지 않아야 한다.
   *  이 두 조건이 깨지면 통로 침범(bleed) 또는 지면색 구멍(miss)이 생긴다. */
  const roleOf = name => String(name).replace('rea:', '');
  const byRole = { ground: [], paths: [], structures: [] };
  for (const band of scene.bands) {
    const role = roleOf(band.name);
    assert.ok(role in byRole, `unexpected band name ${band.name}`);
    byRole[role].push(band);
  }
  for (const role of ['ground', 'paths', 'structures']) {
    assert.ok(byRole[role].length > 0, `${role}: bands must be emitted`);
  }
  const { cellW, cellH, cols, rows } = lay;
  const xsOf = v => Math.round(v / cellW), ysOf = v => Math.round(v / cellH);
  for (const band of scene.bands) {
    assert.ok(band.w > 0 && band.h > 0, 'band has positive size');
    /* 경계 정렬: 모든 밴드의 좌상단/우하단이 셀 격자에 정수로 맞아야 한다. */
    for (const v of [band.x, band.x + band.w]) {
      assert.equal(Math.abs(v - Math.round(v / cellW) * cellW) < 1e-6, true,
        `band x=${v} must land on a cell boundary (cellW=${cellW})`);
    }
    for (const v of [band.y, band.y + band.h]) {
      assert.equal(Math.abs(v - Math.round(v / cellH) * cellH) < 1e-6, true,
        `band y=${v} must land on a cell boundary (cellH=${cellH})`);
    }
    /* 셀 범위 안 */
    assert.ok(xsOf(band.x) >= 0 && xsOf(band.x + band.w) <= cols, 'band inside horizontal bounds');
    assert.ok(ysOf(band.y) >= 0 && ysOf(band.y + band.h) <= rows, 'band inside vertical bounds');
    /* 무늬 위상은 원본 타일 주기의 나머지 — 인접 밴드끼리 무늬가 이어진다. */
    const size = AUTHORED_GROUND_SOURCES[band.key].size;
    assert.equal(band.tilePosition.x, band.x % size, `${band.key}: tile phase x follows global coordinate`);
    assert.equal(band.tilePosition.y, band.y % size, `${band.key}: tile phase y follows global coordinate`);
  }
  /* 경로/구조물 밴드는 반드시 통로/벽 상태와 일치해야 한다(침범·미달 0의 근거). */
  const checkCover = (role, want) => {
    const covered = new Set();
    for (const band of byRole[role]) {
      for (let r = ysOf(band.y); r < ysOf(band.y + band.h); r++) {
        for (let c = xsOf(band.x); c < xsOf(band.x + band.w); c++) covered.add(r * cols + c);
      }
    }
    for (let cell = 0; cell < cols * rows; cell++) {
      assert.equal(covered.has(cell), want(cell), `${role}: cell ${cell} coverage mismatch`);
    }
  };
  checkCover('paths', cell => !!lay.authored.paths[cell]);
  checkCover('structures', cell => !lay.open[cell]);
  checkCover('ground', () => true);

  assert.equal(events[0].event, 'shutdown', 'bands are released on scene shutdown');
  events[0].fn();
  assert.ok(scene.bands.every(b => b.destroyed), 'every band destroyed on shutdown');
  scene.textures.exists = () => false;
  assert.equal(renderAuthoredMapLayers(scene, lay), null, 'missing assets preserve legacy renderer fallback');
});

test('vc238 edge decor outlines the floor without ever narrowing a route', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../public/assets/ground/manifest.json', import.meta.url)));
  const existingProp = key => ['dungeon','forest','town'].some(set => fs.existsSync(new URL(`../public/assets/objects/${set}/${key}.png`, import.meta.url)));
  const makeScene = () => ({
    textures: { exists: key => key in manifest || existingProp(key), get: key => ({ getSourceImage: () => manifest[key] }) },
    add: {
      image: (x, y, key) => {
        const image = { x, y, key, name: 'obj_x', setOrigin() { return this; }, setScale(s) { this.scale = s; return this; }, setDepth() { return this; }, setName(n) { this.name = n; return this; }, setTint() { return this; } };
        return image;
      },
      /* vc275 — 지면/경로/구조물 밴드. 경계 장식 검증에는 관여하지 않는다. */
      tileSprite: (x, y, w, h, key) => ({ x, y, w, h, key, name: '',
        setOrigin() { return this; }, setDepth() { return this; }, setTint() { return this; },
        setName(n) { this.name = n; return this; }, setTilePosition() { return this; }, destroy() {} }),
    },
    events: { once: () => {} },
  });

  /* 모든 영프 구역 + 그랜드 플래닛 일부 — 경계 장식이 통행로/입출구를 건드리지 않아야 한다. */
  const cases = HOWLRSTONE_CHAPTERS.flatMap(spec => Array.from({ length: spec.stages }, (_, i) => ({
    key: `${spec.key}x${i + 1}`, width: spec.width + (i + 1) * 130, height: spec.height + (i + 1) * 30,
  })));
  cases.push({ key: 'dlcstargate1', width: 2330, height: 1230 });
  cases.push({ key: 'dlcsernium5', width: 2850, height: 1350 });

  let total = 0;
  for (const { key, width, height } of cases) {
    const lay = authoredRoomLayout(key, width, height);
    assert.ok(lay, key);
    const attached = [];
    const result = renderAuthoredMapLayers(makeScene(), lay, img => attached.push(img));
    assert.ok(result, `${key}: layers render`);
    const edges = result.images.filter(x => String(x.name).startsWith('rea:edge:'));
    total += edges.length;
    assert.ok(edges.length <= 96, `${key}: edge budget (${edges.length} > 96)`);
    assert.equal(attached.some(x => String(x.name).startsWith('rea:edge:')), false, `${key}: edge decor reached the collider hook`);
    for (const img of edges) {
      assert.equal(isSolidDecor(img.key), false, `${key}/${img.key}: solid edge decor would seal an aisle`);
      const c = Math.floor(img.x / lay.cellW), r = Math.floor(img.y / lay.cellH);
      const cell = r * lay.cols + c;
      assert.ok(c >= 0 && c < lay.cols && r >= 0 && r < lay.rows, `${key}: edge decor inside bounds`);
      assert.equal(lay.open[cell], true, `${key}: edge decor must sit on walkable ground, not inside a wall`);
      /* 경계 장식은 통행로 중앙을 막지 않는다 — 단 벽에 붙은 가장자리는 허용.
       *  (coast 처럼 열린 셀이 전부 통행로인 맵에서 배치가 0개가 되던 문제를 풀려면
       *   가장자리는 열어줘야 한다. 소품은 모두 충돌 없는 키라 통행 자체는 유지된다.) */
      if (lay.authored.paths[cell]) {
        const onWallEdge = c <= 1 || c >= lay.cols - 2 || r <= 1 || r >= lay.rows - 2
          || !lay.open[cell - 1] || !lay.open[cell + 1] || !lay.open[cell - lay.cols] || !lay.open[cell + lay.cols];
        assert.ok(onWallEdge, `${key}: edge decor must hug a wall, not block mid-route`);
      }
      assert.notEqual(cell, lay.entry, `${key}: entry cell must stay clear`);
      assert.notEqual(cell, lay.exit, `${key}: exit cell must stay clear`);
    }
  }
  assert.ok(total > 0, 'edge decor actually gets placed somewhere');
});
