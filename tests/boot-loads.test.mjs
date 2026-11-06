/* vc240 — 부팅 로드 회귀 방지.
 *
 * [왜] vc239 에서 PixelLab 몬스터 16장 + Wang 타일셋 16장을 preload 에 넣었지만
 *  이걸 **쓰는 코드가 0곳**이었다. 결과적으로 부팅 HTTP 요청 32개가 순수 낭비였고
 *  아무도 알아채지 못했다(콘솔 에러도, 테스트 실패도 없었음).
 *
 * [계약] BootScene 의 preload 는 "로드한 키를 실제로 쓰는 곳이 있는 것"만 담는다.
 *  에셋 파일은 남겨두되(나중에 붙일 수 있게) 로드만 하고 버리는 일은 막는다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

/* src 전체에서 editorAssetManifest(카탈로그)를 뺀 실제 코드 텍스트 */
function codeText() {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(new URL('../' + dir, import.meta.url), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) { walk(rel); continue; }
      if (!/\.(ts|tsx)$/.test(e.name)) continue;
      if (e.name === 'editorAssetManifest.ts') continue; // 전 자산 목록 — 신호를 오염시킨다
      out.push(read(rel));
    }
  };
  walk('src');
  return out.join('\n');
}

test('부팅에서 로드한 vc239 몬스터/타일셋은 실제로 쓰여야 한다', () => {
  const boot = read('src/game/scenes/BootScene.ts');
  const code = codeText();

  /* [vc240] 지금은 로드하지 않는 상태 — 되살리면 반드시 쓰는 곳이 있어야 한다.
   *  주석에 남긴 이름(VC239_MONSTERS)에 걸리지 않도록 **실제 로드문**만 본다. */
  const loadsTiles = /this\.load\.image\(\s*`vc239_tile_/.test(boot);
  const loadsMonsters = /for \(const k of VC239_MONSTERS\)/.test(boot);

  if (loadsTiles) {
    /* `vc239_tile_` 로 실제 텍스처를 꺼내는 곳이 BootScene 밖에 있어야 한다. */
    const users = code.split('vc239_tile_').length - 1;
    assert.ok(users > 1, 'vc239_tile_* 를 로드만 하고 쓰는 곳이 없다 — 부팅 요청 16개가 낭비된다');
  }
  if (loadsMonsters) {
    const users = code.split('VC239_MONSTERS').length - 1;
    assert.ok(users > 1, 'VC239_MONSTERS 를 로드만 하고 쓰는 곳이 없다 — 부팅 요청 16개가 낭비된다');
  }
});

test('사용처가 없는 대형 에셋을 preload 에 넣지 않는다', () => {
  const boot = read('src/game/scenes/BootScene.ts');
  const code = codeText();

  /* preload 안의 `vc239/<key>` 형태 로드 키를 뽑아, 그 키가 BootScene 밖에서 쓰이는지 본다. */
  const declared = [...boot.matchAll(/const\s+(VC\d+_[A-Z_]+)\s*=\s*\[([^\]]*)\]/g)];
  for (const [, name, body] of declared) {
    const keys = [...body.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    if (keys.length === 0) continue;
    const usedOutside = keys.filter((k) => {
      /* BootScene 을 뺀 나머지 코드에서 키 문자열이 등장하는지 */
      const elsewhere = code.replace(boot, '');
      return elsewhere.includes(k);
    });
    assert.ok(
      usedOutside.length > 0 || !boot.includes(name),
      `${name} 의 키 ${keys.length}개 중 실제 사용처가 하나도 없다`,
    );
  }
});
