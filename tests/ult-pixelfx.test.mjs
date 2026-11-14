// 2026-11-14 — 궁극기 pixelfx 매핑 계약.
// 궁극기 10직업 전부 시전·종결 이펙트가 있고, 시트 파일이 실재하며, 모바일에서 감당할 크기인지 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

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
