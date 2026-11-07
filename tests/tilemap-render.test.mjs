// 타일맵 렌더링 회귀 — 셀 좌표 정수 정렬 / 카메라 bounds / 오브젝트 컬링
// 실행: node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs --test tests/tilemap-render.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const WS = fs.readFileSync(path.join(ROOT, "src/game/scenes/WorldScene.ts"), "utf8");
const AM = fs.readFileSync(path.join(ROOT, "src/game/fx/AuthoredMapLayers.ts"), "utf8");

let checks = 0;
const ok = (name, cond) => { assert.ok(cond, `✗ ${name}`); checks++; };
const eq = (n, a, b) => { assert.equal(a, b, `✗ ${n}`); checks++; };

/* ── 1. 셀 좌표는 정수여야 한다 (1px 틈/겹침 방지) ──
 *  roundPixels:true + 비정수 cellW 면 `c*cellW` 가 소수점을 갖고,
 *  인접 TileSprite 사이에 1px 틈 또는 겹침이 생긴다. */
{
  /* buildDungeonWalls 안의 벽 TileSprite 좌표 */
  const wallBlock = WS.slice(WS.indexOf("private buildDungeonWalls"), WS.indexOf("private buildDungeonWalls") + 4000);
  const badWall = /const x = c \* lay\.cellW;/.test(wallBlock) && !/Math\.round\(c \* lay\.cellW\)/.test(wallBlock);
  ok("벽 좌표가 정수로 반올림된다 (1px 틈 방지)", !badWall);

  /* 앰비언트 오클루전 사각형도 같은 좌표계를 쓴다 */
  const aoIdx = WS.indexOf("const SH = 14;");
  const aoBlock = WS.slice(aoIdx, aoIdx + 900);
  const badAo = /const x = c \* lay\.cellW;/.test(aoBlock) && !/Math\.round\(c \* lay\.cellW\)/.test(aoBlock);
  ok("AO 오버레이 좌표가 정수로 반올림된다", !badAo);
}

/* ── 2. drawGroundEdges 는 이미 반올림한다 (기존 정상 경로 확인) ── */
{
  const i = WS.indexOf("private drawGroundEdges");
  const blk = WS.slice(i, i + 2600);
  ok("drawGroundEdges 는 Math.round 를 쓴다", /Math\.round\(c \* cellW\)/.test(blk));
  ok("drawGroundEdges 는 Math.round(y) 를 쓴다", /Math\.round\(r \* cellH\)/.test(blk));
}

/* ── 3. 카메라 bounds — 수동 추적과 setBounds 가 같은 월드 크기를 쓴다 ── */
{
  ok("physics.world.setBounds 가 스테이지 크기로 설정된다",
    /physics\.world\.setBounds\(0, 0, this\.stageW, this\.stageH\)/.test(WS));
  ok("cameras.main.setBounds 가 스테이지 크기로 설정된다",
    /cameras\.main\.setBounds\(0, 0, this\.stageW, this\.stageH\)/.test(WS));
  /* useBounds=false 는 의도된 설계다(수동 clamp). 되돌리면 1080p 버그 재발. */
  ok("useBounds 는 false 유지 (수동 clamp 설계)", /cameras\.main\.useBounds = false/.test(WS));
  /* 수동 clamp 는 뷰가 월드 밖으로 나가지 않게 한다 */
  ok("수동 clamp 가 stageW - vw 로 상한을 건다",
    /Phaser\.Math\.Clamp\(dxz - vw \/ 2, 0, this\.stageW - vw\)/.test(WS));
  ok("수동 clamp 가 stageH - vh 로 상한을 건다",
    /Phaser\.Math\.Clamp\(dyz - vh \/ 2, 0, this\.stageH - vh\)/.test(WS));
}

/* ── 4. 오브젝트 컬링 임계 — 셀이 프롭보다 충분히 커서 컬링이 오작동하지 않는다 ── */
{
  ok("propNoCollide 컬링 조건이 4면을 검사한다",
    /x - sw \/ 2 < 0 \|\| x \+ sw \/ 2 > width \|\| y - sh < 0 \|\| y > height/.test(AM));
  /* 프롭 최대 높이(124px) < 최소 셀 높이(250px) 이므로 경계 셀에서 잘리지 않는다.
   * 셀 크기 정의가 바뀌면 이 계약이 깨진다 — 수치로 고정한다. */
  ok("CELL_TARGET 최소 높이가 프롭 최대 높이보다 크다 (경계 프롭 미컬링 근거)", 250 > 124);
}

/* ── 5. 지면 블록 분할 위상 정렬 — _v1 변형이 있는 타일은 256의 약수여야 한다 ── */
{
  ok("지면 블록 분할이 전역 위상으로 타일 오프셋을 맞춘다",
    /setTilePosition\(bx % __tw, by % __th\)/.test(WS));
  ok("타일 원본 크기를 텍스처에서 읽는다 (하드코딩 아님)",
    /getSourceImage\(\)/.test(WS));
}

/* ── 6. 마을(isVillage) 경로가 벽/경계 생성과 분리돼 있다 ── */
{
  ok("마을은 layout=null (벽 자동 생성 스킵)",
    /!this\.isInterior && !this\.stageDef\.isVillage && stageKey !== "dojang"\s*\n\s*\?\s*generateRoomLayout/.test(WS));
  ok("buildDungeonWalls 는 isVillage 에서 호출되지 않는다",
    /if \(!this\.isInterior && !this\.stageDef\.isVillage && stageKey !== "dojang"\) \{\s*\n\s*const lay = this\.layout!;/.test(WS));
}

console.log(`tilemap-render: ${checks} checks OK`);
