// 2026-11-14 — 궁극기 pixelfx 매핑 계약.
// 궁극기 10직업 전부 시전·종결 이펙트가 있고, 시트 파일이 실재하며, 모바일에서 감당할 크기인지 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const { ULT_CLASSES } = await import('../src/game/classes.ts');
const src = readFileSync('src/game/fx/ultPixelFx.ts', 'utf8');
const table = src.slice(src.indexOf('export const ULT_PIXELFX'), src.indexOf('};', src.indexOf('export const ULT_PIXELFX')));
const rows = Object.fromEntries([...table.matchAll(/(\w+):\s*\{ s5: \{ cast: "([\w-]+)", finale: "([\w-]+)" \},\s*s5b: \{ cast: "([\w-]+)", finale: "([\w-]+)" \} \}/g)]
  .map(([, cls, a, b, c, d]) => [cls, [a, b, c, d]]));

/** PNG 헤더의 가로·세로 */
const dims = (key) => { const h = readFileSync(`public/assets/fx/${key}.png`).subarray(16, 24); return [h.readUInt32BE(0), h.readUInt32BE(4)]; };

test('궁극기 10직업 전부 매핑돼 있다', () => {
  assert.deepEqual(Object.keys(rows).sort(), [...ULT_CLASSES].sort());
});

test('같은 직업의 1·2차는 서로 다른 이펙트를 쓴다', () => {
  for (const [cls, keys] of Object.entries(rows)) assert.equal(new Set(keys).size, 4, cls);
});

test('시트가 실재하고 pixelfx 메타가 있으며 모바일 한도 안이다', () => {
  for (const key of new Set(Object.values(rows).flat())) {
    assert.ok(existsSync(`public/assets/fx/${key}.png`), `${key}.png 없음`);
    const meta = JSON.parse(readFileSync(`public/assets/fx/${key}.json`, 'utf8')).meta?.pixelfx;
    assert.ok(meta?.fps && meta?.pivot, `${key}.json 에 meta.pixelfx 없음`);
    const [w, h] = dims(key);
    assert.ok(w <= 4096 && h <= 4096, `${key} ${w}x${h} — 모바일 최대 텍스처 4096 초과`);
    assert.ok(w * h * 4 <= 13.5e6, `${key} 풀린 크기 ${(w * h * 4 / 1e6).toFixed(1)}MB — 13.5MB 초과`);
  }
});

/* ═══ 2026-11-15 — 외부 평가(P0·P1) 후속 ═══ */

test('씨킹·드레드노트 2차 궁극기 case 가 한 번씩만 있다 (뒤쪽 중복은 실행되지 않는 죽은 코드였다)', () => {
  const player = readFileSync('src/game/entities/Player.ts', 'utf8');
  const body = player.slice(player.indexOf('  useSkill5b() {'), player.indexOf('GM 자유전직'));
  for (const c of ['seaking', 'dreadnought', 'eternal', 'shadowlord']) {
    assert.equal(body.split(`case "${c}":`).length - 1, 1, c);
  }
});

test('전직하면 바로 새 직업의 궁극기 시트를 받는다 (첫 시전 이펙트 누락 방지)', () => {
  const player = readFileSync('src/game/entities/Player.ts', 'utf8');
  for (const m of ['gmSetClass(key: ClassKey): boolean {', 'applyClass(key: ClassKey): boolean {', 'switchClass(key: ClassKey): boolean {']) {
    const i = player.indexOf(`  ${m}`);
    const body = player.slice(i, player.indexOf('\n  }\n', i));
    assert.match(body, /prefetchUltFx\(this\.scene, this\.cls\)/, m);
  }
  /* 시트가 늦게 와도 1.5초 안이면 그 회차에 재생한다 */
  assert.match(src, /LATE_MS = 1500/);
  /* 시전 이펙트는 3D 인트로가 걷힌 뒤에 뜬다 */
  assert.match(player, /ultLater\(castFx \? introMs : 0, \(\) => playUltFx\(this\.scene, key5, 1, "cast"/);
  assert.match(player, /ultLater\(castFx2 \? introMs2 : 0, \(\) => playUltFx\(this\.scene, key5, 2, "cast"/);
});

test('게임을 다시 만들어도 시트를 다시 받고, 직업을 바꾸면 이전 직업 시트를 내린다', () => {
  /* pixelfxBridge 는 Phaser 를 불러와 노드에서 바로 돌릴 수 없다 — 계약을 소스로 고정하고 실제 동작은 브라우저에서 본다. */
  const bridge = readFileSync('src/game/fx/pixelfxBridge.ts', 'utf8');
  /* 게임 재생성 후 텍스처와 애니메이션이 모두 현재 게임에 속해야 한다. */
  assert.match(bridge, /if \(hit && \(!scene\.textures\.exists\(key\) \|\| !scene\.anims\.exists\(`\$\{key\}-play`\)\)\)/);
  assert.equal((bridge.match(/SHEETS\.get\(/g) ?? []).length, 1, 'liveSheet 밖에서 SHEETS 를 직접 믿는 곳이 있다');
  /* 받는 중 작업은 게임별 */
  assert.match(bridge, /const PENDING = new WeakMap<Phaser\.Game, Map<string, Promise<boolean>>>\(\)/);
  /* 내리기 — 화면에서 쓰는 중이면 남긴다 */
  const unload = bridge.slice(bridge.indexOf('export function unloadFxSheet'));
  assert.match(unload, /if \(inUse\) return false;/);
  for (const s of ['SHEETS.delete(key)', 'scene.anims.remove(', 'scene.textures.remove(key)']) assert.ok(unload.includes(s), s);
  /* 미리 받기가 다른 직업 시트를 내린다 */
  const pre = src.slice(src.indexOf('export function prefetchUltFx'), src.indexOf('const LATE_MS'));
  assert.match(pre, /if \(!keep\.has\(key\)\) unloadFxSheet\(scene, key\)/);
});

test('이터널 2차 궁극기 설명이 실제 동작(시간 역행 + 피해 재현)과 같다', async () => {
  const { SKILL5B_INFO } = await import('../src/game/classes.ts');
  assert.match(SKILL5B_INFO.eternal.desc, /되돌|역행/);
  assert.match(SKILL5B_INFO.eternal.desc, /재현/);
  assert.doesNotMatch(SKILL5B_INFO.eternal.desc, /블랙홀|지옥의 문/);
});

test('궁극기 예고·타격·잔상은 같은 배치를 쓰고 늦게 로드한 시트도 한 번만 나타난다', async () => {
  const draws = [];
  const marks = [];
  const tweens = [];
  let loaded = true;
  const bridge = {
    async ensureFxSheet() { loaded = true; return true; },
    playFx(_scene, key, x, y, opts) {
      if (!loaded) return null;
      const draw = { key, x, y, flip: opts.flip };
      draws.push(draw);
      return {
        width: 200, height: 100, anims: { currentAnim: { duration: 3500, repeat: 0 } },
        setScale(value) { draw.scale = value; },
        setRotation(value) { draw.rotation = value; },
      };
    },
  };
  const module = { exports: {} };
  const { outputText } = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  vm.runInNewContext(`(function(require, module, exports) { ${outputText} })`)(
    id => id === './pixelfxBridge' ? bridge : { STARTER_PIXELFX: [], classDef: () => ({ color: '#ff7654' }) },
    module, module.exports,
  );
  const { playUltFx, playUltFinaleCue } = module.exports;
  const scene = {
    fxLevel: 1,
    sys: { isActive: () => true },
    add: {
      graphics() {
        const mark = {
          active: true,
          setPosition(x, y) { this.x = x; this.y = y; },
          destroy() { this.active = false; },
        };
        for (const method of ['setDepth', 'lineStyle', 'setRotation', 'beginPath', 'arc', 'strokePath', 'lineBetween',
          'strokeEllipse', 'fillStyle', 'fillCircle', 'setAlpha', 'setScale']) mark[method] = () => mark;
        marks.push(mark);
        return mark;
      },
    },
    tweens: { add(cfg) { tweens.push(cfg); return { stop() {} }; } },
  };
  const anchor = { x: 100, y: 120 };
  const stop = playUltFinaleCue(scene, 'warbringer', 1, Math.PI / 2, () => anchor);
  assert.equal(tweens[0].duration, 190);
  assert.equal(marks[0].y, 195);
  anchor.y += 20;
  tweens[0].onUpdate();
  assert.equal(marks[0].y, 215);
  stop();
  assert.equal(marks[0].active, false);

  playUltFx(scene, 'warbringer', 1, 'finale', 100, 120, false, Math.PI / 2);
  assert.deepEqual(draws[0], {
    key: 'hammer-smash', x: 100, y: 195, flip: false, scale: 1.95, rotation: Math.PI / 2,
  });
  assert.equal(tweens[1].duration, 190);
  assert.equal(tweens[2].delay + tweens[2].duration, 1250);
  playUltFx(scene, 'warbringer', 2, 'finale', 100, 120);
  assert.deepEqual(draws[1], { key: 'quake', x: 100, y: 120, flip: false, scale: 2.55 });

  loaded = false;
  scene.fxLevel = 0;
  playUltFx(scene, 'warbringer', 1, 'finale', 100, 120, true);
  assert.equal(draws.length, 2);
  assert.equal(marks.length, 4, 'the impact mark is visible before the atlas arrives');
  await Promise.resolve();
  assert.equal(marks.length, 4, 'the late atlas does not replay the impact mark');
  assert.equal(tweens.at(-1).delay + tweens.at(-1).duration, 850);
  assert.deepEqual({ ...draws[2], y: Math.round(draws[2].y) }, {
    key: 'hammer-smash', x: 25, y: 120, flip: false,
    scale: 390 * 0.65 / 200, rotation: Math.PI,
  });
});
