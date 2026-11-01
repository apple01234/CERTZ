// node --experimental-strip-types tests/ground-tiles.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { STAGE_THEME } from '../src/game/stages.ts';
import { resolveGroundTile } from '../src/game/tileThemes.ts';
const manifestPath = new URL('../public/assets/ground/manifest.json', import.meta.url);
assert.ok(fs.existsSync(manifestPath), 'native terrain manifest is required: object/border crops cannot be floor fills');
const manifest = JSON.parse(fs.readFileSync(manifestPath));
const rejected = new Set(['tile_grass','tile_forest','tile_garden','tile_moss','tile_dirt','tile_path','tile_sand','tile_snow','tile_cave','tile_basalt','tile_magma_path','tile_lava','tile_blood','tile_desert','tile_amber','tile_vault','tile_deep','tile_morgue','tile_ruin']);
let n = 0;
for (const [stage,theme] of Object.entries(STAGE_THEME)) {
  for (const type of ['ground','path']) {
    if (!theme[type]) continue;
    const key = resolveGroundTile(theme[type]);
    assert.ok(!rejected.has(key), `${stage}:${type} still resolves to border/object texture ${key}`);
    if (key.startsWith('ground_')) assert.ok(manifest[key], `untracked native tile ${key}`);
    n++;
  }
}
for (const [key, entry] of Object.entries(manifest)) {
  assert.ok(fs.existsSync(new URL(`../public/assets/ground/${key}.png`,import.meta.url)),key);
  assert.ok(entry.source && entry.crop && entry.license, `${key} provenance`);
}
console.log(`ALL CHECKS PASS: ${n} terrain references / ${Object.keys(manifest).length} native floor cells / object-or-border fills 0`);
