/* 아뜰란티스 — JSON 타일맵 생성기
 * data.ts의 WORLDS(ASCII grid)를 public/atlantis/maps/<id>.json 로 내보낸다.
 * 런타임(BootScene)은 이 JSON을 this.load.json 으로 로드하고,
 * WorldScene.parseGrid 는 JSON 우선 · ASCII 폴백으로 파싱한다.
 *
 * 실행: bun scripts/gen_atlantis_maps.mjs
 */
import { mkdirSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { WORLDS } from "../src/game/atlantis/data.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "atlantis", "maps");

const SOLID_CHARS = "#~W"; // WorldScene.parseGrid 의 solid 판정과 동일 유지

mkdirSync(OUT, { recursive: true });

let wrote = 0;
for (const def of Object.values(WORLDS)) {
  const cols = Math.max(def.size[0], ...def.map.map((r) => r.length));
  const rows = def.map.length;
  const grid = def.map.map((r) => r.padEnd(cols, "#"));
  const json = {
    id: def.id,
    name: def.name,
    ground: def.ground,
    tilesize: 16,
    cols,
    rows,
    solid: SOLID_CHARS,
    spawn: def.spawn,
    grid,
  };
  writeFileSync(join(OUT, `${def.id}.json`), JSON.stringify(json));
  wrote++;
  console.log(`map ${def.id.padEnd(11)} ${String(cols).padStart(3)}x${String(rows).padStart(2)} -> maps/${def.id}.json`);
}
console.log(`OK — ${wrote} maps written to public/atlantis/maps/`);
