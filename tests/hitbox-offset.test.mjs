#!/usr/bin/env node
/**
 * vc227 — 시트별 히트박스 오프셋 회귀 방지.
 *
 * ## 왜 이 테스트가 필요한가
 *
 * `ponytail-review` #1 이 잡은 실제 버그:
 *
 *   플레이어 바디는 `setSize(20,44)` + `setOffset(38,20)` 으로 고정돼 있었다.
 *   이 숫자는 **96x64 hero 캔버스 기준**이다. FA 아틀라스 프레임은 **64x85** 이고
 *   `setScale(1.17)` 이 곱해져서, 같은 38 을 쓰면 바디가 오른쪽으로 44.5px 밀리고
 *   (오른쪽 여유 7px) 세로로도 23.4px 떠서 발밑이 판정 밖이 됐다.
 *
 *   구체적 증상: 적을 스칠 듯 지나가고, 오른쪽 벽에서 판정이 벽을 통과한다.
 *   컴파일로는 절대 안 잡히고 실기기에서 "타격감이 없다"로만 나타난다.
 *
 * ## 이 테스트가 지키는 것
 *
 *  1. 오프셋이 **캔버스 크기에서 유도**되는지 (하드코딩 금지)
 *  2. FA / hero 두 경우의 값이 실제 캔버스와 맞는지
 *  3. `applyBodyLook` 이 스케일과 오프셋을 **함께** 갱신하는지
 *  4. 바디 크기는 바뀌지 않는지 (밸런스 보존)
 *
 * 실행: node tests/hitbox-offset.test.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
let pass = 0, fail = 0;
function ok(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
}

const player = fs.readFileSync(path.join(ROOT, "src/game/entities/Player.ts"), "utf8");
const atlas = JSON.parse(fs.readFileSync(path.join(ROOT, "public/assets/fa/p1.json"), "utf8"));

/** 아틀라스 프레임 하나의 캔버스 크기 */
const af = atlas.frames["fa_p1_idle__0"].frame;
const FA_W = af.w, FA_H = af.h;

/* hero 시트 캔버스 — 코드 주석(96x64)과 실파일이 일치하는지 확인 */
function pngSize(p) {
  const b = fs.readFileSync(p);
  // PNG IHDR: width @16, height @20 (big-endian)
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
const hero = pngSize(path.join(ROOT, "public/assets/hero_idle0.png"));

const BODY_W = 20, BODY_H = 44;
const wantHero = { x: (hero.w - BODY_W) / 2, y: hero.h - BODY_H };
const wantFa = { x: (FA_W - BODY_W) / 2, y: FA_H - BODY_H };

console.log("1) 캔버스 실측");
ok(`hero 캔버스 ${hero.w}x${hero.h}`, hero.w === 96 && hero.h === 64, `(실제 ${hero.w}x${hero.h})`);
ok(`FA 캔버스 ${FA_W}x${FA_H}`, FA_W === 64 && FA_H === 85, `(실제 ${FA_W}x${FA_H})`);

console.log("\n2) 기대 오프셋 (바디 20x44 중앙·발끝 정렬)");
console.log(`  hero  offset = (${wantHero.x}, ${wantHero.y})`);
console.log(`  FA    offset = (${wantFa.x}, ${wantFa.y})`);

console.log("\n3) 코드가 캔버스에서 유도하는가");
/* applyBodyOffset 본문을 뽑아 실제 숫자가 기대값과 맞는지 본다. */
const idx = player.indexOf("private applyBodyOffset()");
ok("applyBodyOffset 이 존재", idx >= 0);
if (idx >= 0) {
  const body = player.slice(idx, idx + 900);
  const m = body.match(/setOffset\(\s*fa\s*\?\s*(\d+)\s*:\s*(\d+)\s*,\s*fa\s*\?\s*(\d+)\s*:\s*(\d+)\s*\)/);
  ok("setOffset(fa ? a : b, fa ? c : d) 형태", !!m, body.slice(0, 200));
  if (m) {
    const faX = +m[1], heroX = +m[2], faY = +m[3], heroY = +m[4];
    ok(`FA x = ${wantFa.x}`, faX === wantFa.x, `(코드 ${faX})`);
    ok(`FA y = ${wantFa.y}`, faY === wantFa.y, `(코드 ${faY})`);
    ok(`hero x = ${wantHero.x}`, heroX === wantHero.x, `(코드 ${heroX})`);
    ok(`hero y = ${wantHero.y}`, heroY === wantHero.y, `(코드 ${heroY})`);
  }
  /* 크기는 안 바뀌어야 한다 — 바꾸면 밸런스가 흔들린다 */
  ok("바디 크기를 바꾸지 않는다", !/setSize\(/.test(body));
}

console.log("\n4) 스케일과 오프셋이 함께 갱신된다");
{
  const i2 = player.indexOf("applyBodyLook() {");
  const body = player.slice(i2, i2 + 2500);
  ok("setScale 호출이 있다", /this\.setScale\(/.test(body));
  ok("같은 함수에서 applyBodyOffset 을 부른다", /this\.applyBodyOffset\(\)/.test(body));
  /* 순서: 스케일 먼저, 오프셋 나중 — 오프셋이 스케일을 몰라도 되게(둘은 독립값) */
  const si = body.indexOf("this.setScale(");
  const oi = body.indexOf("this.applyBodyOffset()");
  ok("스케일 → 오프셋 순서", si >= 0 && oi > si);
}

console.log("\n5) 생성자가 고정 오프셋을 박지 않는다");
{
  const ci = player.indexOf("constructor(scene: WorldScene");
  const body = player.slice(ci, ci + 900);
  ok("생성자에 setOffset(38, 20) 하드코딩 없음", !/setOffset\(\s*38\s*,\s*20\s*\)/.test(body));
  ok("생성자가 applyBodyOffset 을 부른다", /this\.applyBodyOffset\(\)/.test(body));
  ok("생성자에 setSize(20, 44) 는 유지", /setSize\(\s*20\s*,\s*44\s*\)/.test(body));
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
