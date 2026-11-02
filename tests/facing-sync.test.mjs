// node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs tests/facing-sync.test.mjs
//
// 버그: "모든 방향있는 스킬들이 캐릭터가 바라보는 방향이랑 동기화 안되는 버그"
//
// 원인은 소스에 있었고 두 가지였다.
//   ① faceAtk 가 |x| >= |y| 일 때만 flipX 를 갱신 → 세로 조준에서 이전 방향 유지
//   ② 스킬들이 `setFlipX(dir.y === 0 && dir.x > 0)` 를 썼다.
//      dir 은 aimDir() = 4방향 스냅이라, 대각선 조준이면 dir.y !== 0 이 되어
//      조건이 false → flipX 가 강제로 false(왼쪽)가 됐다.
//
// 이 테스트는 소스에서 그 패턴이 되돌아오지 않게 막는다(회귀 방지).

import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const playerPath = fileURLToPath(new URL("../src/game/entities/Player.ts", import.meta.url));
const src = fs.readFileSync(playerPath, "utf8");
let checks = 0;
const ok = (name, cond) => { assert.ok(cond, name); checks++; };

/* 1) 금지 패턴: 대각선에서 flip 을 강제로 false 로 누르던 식 */
ok("금지 패턴 `dir.y === 0 && dir.x > 0` 없음",
  !src.includes("dir.y === 0 && dir.x > 0"));

/* 2) faceAtk 는 세로 조준에서도 facing 을 갱신해야 한다 */
const faceAtkBlock = src.slice(src.indexOf("private faceAtk("), src.indexOf("private faceAtk(") + 900);
ok("faceAtk 가 facing 을 갱신", faceAtkBlock.includes("this.facing.copy(aim)"));
ok("faceAtk 가 좌우 판정 유지", faceAtkBlock.includes("this.setFlipX(aim.x > 0)"));

/* 3) **공격(attack) 상태**에서 이동이 flipX 를 move 기준으로 덮어쓰지 않아야 한다.
 *    idle 이동(577행)은 이동 방향을 보는 게 정상이므로 제외한다.
 *    공격 블록은 `state === "attack" && this.lungeTime <= 0` 이후에 온다. */
{
  const atkIdx = src.indexOf('this.state === "attack" && this.lungeTime <= 0');
  ok("공격 상태 블록 존재", atkIdx > 0);
  const atkBlock = src.slice(atkIdx, atkIdx + 1400);
  ok("공격 중 flipX 를 move.x 로 덮어쓰지 않음",
    !atkBlock.includes("this.setFlipX(move.x > 0)"));
  ok("공격 중 flipX 는 facing 기준", atkBlock.includes("this.setFlipX(this.facing.x > 0)"));
}

/* 4) 방향 스킬들은 faceAtk 를 호출해야 한다 (snipe/volley/bolt 등) */
const dirSkills = ["skill1Arrows", "skill1Bolt", "skill1Snipe", "skill1GustArrow", "skill1SkyVolley", "skill1ArcBolt"];
for (const name of dirSkills) {
  const i = src.indexOf(`private ${name}(`);
  ok(`${name} 정의 존재`, i >= 0);
  if (i < 0) continue;
  const body = src.slice(i, i + 2200);
  ok(`${name} 가 faceAtk 호출`, body.includes("faceAtk("));
}

/* 5) faceAtk 호출이 사라지지 않았는지 (총량) */
const faceCalls = (src.match(/faceAtk\(/g) || []).length;
ok(`faceAtk 호출 15곳 이상 (실제 ${faceCalls})`, faceCalls >= 15);

console.log(`facing-sync: ${checks} checks passed`);
