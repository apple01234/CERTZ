import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { authoredOpenXY, authoredRoomLayout } from '../src/game/authoredLayouts.ts';
import { AUTHORED_GROUND_SOURCES, renderAuthoredMapLayers } from '../src/game/fx/AuthoredMapLayers.ts';
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

test('Tilemap layers reuse native admitted floors, keep collision separate, and destroy on shutdown', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../public/assets/ground/manifest.json', import.meta.url)));
  const created = [], layers = [], events = [], images = [], attached = [];
  const existingProp = key => ['dungeon','forest','town'].some(set => fs.existsSync(new URL(`../public/assets/objects/${set}/${key}.png`, import.meta.url)));
  const scene = {
    textures: { exists: key => key in manifest || existingProp(key), get: key => ({ getSourceImage: () => manifest[key] }) },
    add: { image: (x,y,key) => {
      const image = { x,y,key, setOrigin() { return this; }, setScale(scale) { this.scale = scale; return this; }, setDepth() { return this; }, setName(name) { this.name = name; return this; }, setTint() { return this; } };
      images.push(image); return image;
    } },
    events: { once: (event, fn) => events.push({ event, fn }) },
    make: { tilemap: options => {
      const map = { options, destroyed: false,
        addTilesetImage: (name,key,w,h,_margin,_spacing,gid) => ({ name,key,w,h,gid }),
        createLayer: (_index, tiles) => {
          const layer = { tiles, setName(name) { this.name = name; return this; }, setDepth() { return this; }, setTint() { return this; } };
          layers.push(layer); return layer;
        },
        destroy() { this.destroyed = true; },
      };
      created.push(map); return map;
    } },
  };
  const lay = authoredRoomLayout('howlrstone1x1', 2400, 1280);
  const before = [...lay.open];
  const result = renderAuthoredMapLayers(scene, lay, image => attached.push(image));
  assert.equal(result.maps.length, 3);
  assert.deepEqual(layers.map(x => x.name), ['rea:ground','rea:paths','rea:structures']);
  assert.deepEqual(lay.open, before);
  assert.ok(images.some(x => x.key === 'obj_dungeon_bookshelf'), 'library uses retained native bookshelf art');
  assert.deepEqual(attached, images, 'all props reach the original feet-collision hook');
  for (const image of images) {
    const cell = Math.floor(image.y / lay.cellH) * lay.cols + Math.floor(image.x / lay.cellW);
    assert.equal(lay.open[cell], false, 'solid shelf feet stay outside the traversable aisles');
    assert.equal(image.scale, 1, 'native bookshelf pixels retain their scale');
  }
  for (const { key, w, h, gid } of layers.map(x => x.tiles)) {
    assert.equal(manifest[key].width, AUTHORED_GROUND_SOURCES[key].size);
    assert.equal(manifest[key].height % h, 0);
    assert.equal(manifest[key].width % w, 0);
    assert.equal(gid, 1);
  }
  assert.ok(created[1].options.data.flat().includes(-1), 'paths must not cover entire map');
  assert.ok(created[2].options.data.flat().includes(-1), 'structures must not fill open rooms');
  assert.equal(events[0].event, 'shutdown');
  events[0].fn();
  assert.ok(created.every(x => x.destroyed));
  scene.textures.exists = () => false;
  assert.equal(renderAuthoredMapLayers(scene, lay), null, 'missing assets preserve legacy renderer fallback');
});
