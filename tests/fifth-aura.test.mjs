// node tests/fifth-aura.test.mjs — actual rig executed against a Phaser mock
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  let source = fs.readFileSync(file, 'utf8');
  if (process.env.AURA_RED === '1' && file.endsWith('/FifthAura.ts')) source = source.replace('auraScale(r.core, AURA_WORLD_CAPS.core, 0.95 * breath * s + 0.05)', '(0.95 * breath * s + 0.05)');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', code)(id => {
    if (id === 'phaser') return { BlendModes: { ADD: 1 } };
    if (id.endsWith('.json')) return JSON.parse(fs.readFileSync(path.resolve(path.dirname(file), id), 'utf8'));
    if (id === '../classes') return { familyOf: cls => cls || 'warrior' };
    return load(path.resolve(path.dirname(file), id + '.ts'));
  }, mod, mod.exports);
  return mod.exports;
}
const root = path.resolve('src/game/fx');
const { FifthAuraRig } = load(root + '/FifthAura.ts');
const { FIFTH_LOOKS, fifthBurstFor } = load(root + '/fifthLooks.ts');
const { AURA_TEXTURES } = load(root + '/auraTextures.ts');
const made = [], anims = new Map(), textures = new Map();
for (const def of Object.values(AURA_TEXTURES)) {
  assert.ok(fs.existsSync('public' + def.file), def.file);
  const frames = new Map();
  textures.set(def.key, { source: [{width: def.width, height: def.height}], has: name => frames.has(String(name)), add: (name, _i, x, y, width, height) => frames.set(String(name), {x,y,width,height}), frames });
}
function make(_x, _y, key, frame) {
  assert.ok(key.startsWith('aura_'), 'shared texture must never be used');
  const def = Object.values(AURA_TEXTURES).find(d => d.key === key);
  const obj = { key, visible: true, frame: { width: def.width / def.cols, height: def.height / def.rows }, width: def.width / def.cols, height: def.height / def.rows,
    setScale(x,y=x){ this.scaleX=x; this.scaleY=y; return this; }, setVisible(v){this.visible=v;return this;}, destroy(){this.dead=true;}, play(k){this.animation=k;return this;} };
  for (const m of ['setPosition','setAlpha','setDepth','setRotation','setFlipX','setTint','setBlendMode']) obj[m] = () => obj;
  obj.setScale(1); made.push(obj); return obj;
}
const scene = { add: { image: make, sprite: make }, textures: { exists: k => textures.has(k), get: k => textures.get(k) }, anims: { exists: k => anims.has(k), create: a => anims.set(a.key,a) }, time: { now: 0 } };
let count = 0;
for (const cls of [...Object.keys(FIFTH_LOOKS), 'mage','thief','ranger','pirate','unknown']) {
  const rig = new FifthAuraRig(scene);
  const start = made.length;
  for (let t=0;t<600;t++) {
    scene.time.now=t*37; rig.update(0,0,true,0xffffff,false,cls);
    const objects = made.slice(start);
    assert.equal(objects.length,4);
    // Creation order: halo, core, ground, barrier.
    for (const [i,cap] of [80,64,94,110].entries()) {
      const o=objects[i];
      assert.ok(Math.max(o.width*o.scaleX,o.height*o.scaleY)<=cap+1e-8, `${cls} ${i} exceeds ${cap}`);
    }
  }
  rig.destroy(); assert.ok(made.slice(start).every(o=>o.dead)); count++;
  const burst = fifthBurstFor(cls,0xffffff);
  const burstDef = Object.values(AURA_TEXTURES).find(d=>d.key===burst.tex);
  assert.ok(burstDef && Math.max(burstDef.width,burstDef.height)*burst.scale*1.5<=110+1e-8, 'burst fade-out cap');
}
const circle = AURA_TEXTURES.gvu_circle_aggr;
assert.equal(textures.get(circle.key).frames.size,16,'explicit 4x4 circle atlas');
assert.equal(textures.get(AURA_TEXTURES.gvb_glow_blurry.key).frames.size,0,'vertical glow is one image');
assert.equal(AURA_TEXTURES.gvb_shockwave_fiery,undefined,'typo must not exist');
const lite = new FifthAuraRig(scene,{lite:true}); lite.update(0,0,true,0,false,'shadowlord'); assert.equal(made.at(-4).visible,false); lite.destroy();
console.log(`ALL CHECKS PASS: ${count} classes/fallbacks × 600 ticks, size caps, atlas, lite, cleanup`);
