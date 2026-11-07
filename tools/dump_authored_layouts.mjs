/**
 * dump_authored_layouts.mjs — authored 레이아웃을 JSON 으로 덤프
 *
 * verify_floor_bands.py 의 입력. 게임이 실제로 쓰는 authoredRoomLayout() 을
 * 그대로 호출하므로 렌더 검증이 게임과 어긋나지 않는다.
 *
 * 사용법:
 *   node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs \
 *        tools/dump_authored_layouts.mjs > /tmp/layouts.json
 *
 * 인자 없이 실행하면 대표 5개 스테이지만, `--all` 이면 authored 전부.
 */
import fsp from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './dom_shim.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const { authoredRoomLayout } = await import(path.join(here, '../src/game/authoredLayouts.ts'));
const { STAGES } = await import(path.join(here, '../src/game/stages.ts'));

const DEFAULT_KEYS = ['howlrstone1x2', 'dlcstargate1', 'dlcocean1', 'dlcneocity1', 'dlcprisma1'];
const all = process.argv.includes('--all');

const out = [];
for (const def of Object.values(STAGES)) {
  if (!all && !DEFAULT_KEYS.includes(def.key)) continue;
  const lay = authoredRoomLayout(def.key, def.width, def.height);
  if (!lay?.authored) continue;
  out.push({
    key: def.key,
    w: def.width,
    h: def.height,
    cols: lay.cols,
    rows: lay.rows,
    cellW: lay.cellW,
    cellH: lay.cellH,
    open: lay.open,
    paths: lay.authored.paths,
    authored: {
      theme: lay.authored.theme,
      ground: lay.authored.ground,
      path: lay.authored.path,
      structure: lay.authored.structure,
    },
  });
}
fsp.writeFileSync('/dev/stdout', JSON.stringify(out));
console.error(`dumped ${out.length} authored layouts`);
