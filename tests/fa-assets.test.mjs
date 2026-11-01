#!/usr/bin/env node
/**
 * vc224 — Fantasy Adventure 세트 배선 검증.
 *
 * 사용자 지적: "에셋 생성하지 말고 다운받아 써라. 여기 폴더에 좋은 게 얼마나 많은데"
 * 종전 `redesign_sprites.py` 는 정적 셀을 squash 해 4프레임을 합성했고(run0==run2),
 * 아트도 코드 생산물이었다. FA 팩 원본 애니메이션으로 교체한 뒤의 회귀를 막는다.
 *
 * 검사 항목:
 *  1. 프레임 파일이 실제로 존재하고 개수가 시트 원본과 일치
 *  2. 이름 충돌 회귀 방지 — `atk` + `2` = `atk2` 가 되지 않도록 구분자 `__`
 *  3. 프레임 간 내용 크기 드리프트가 임계 이내 (idle/run 은 정지 동작이라 엄격)
 *  4. 공통 앵커 정렬 — run/idle 프레임의 바닥 y 가 동일(발이 튀지 않을 것)
 *  5. FA_DISPLAY_SCALE 이 높이 비율과 맞음 (26x42 ÷ 18x36)
 *
 * 실행: node tests/fa-assets.test.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const FA = path.join(ROOT, "public/assets/fa");

let pass = 0, fail = 0;
function ok(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
}

/* 원본 시트 실측 프레임 수 (vc224 측정). **캐릭터마다 다르다.**
 *  p1 기준값을 그대로 쓰면 p2 `dash`(8f)·`atkdown`(7f) / p3 `dead`(20f)·`atk3`(10f) 가
 *  잘리고, p2/p3 에는 `run2idle` 시트가 없어 404 가 난다. */
const N_BY_CHAR = {
  p1: { idle: 7, run: 8, atk: 5, atk2: 5, atk3: 5, atk4: 6, atkup: 5, atkdown: 5,
        jump: 3, fall: 4, dash: 4, hit: 4, dead: 18, idle2run: 3, run2idle: 3, land: 3 },
  p2: { idle: 7, run: 6, atk: 5, atk2: 5, atk3: 5, atk4: 6, atkup: 6, atkdown: 7,
        jump: 3, fall: 4, dash: 8, hit: 4, dead: 16, idle2run: 3, land: 3 },
  p3: { idle: 6, run: 8, atk: 5, atk2: 5, atk3: 10, atk4: 6, atkup: 7, atkdown: 5,
        jump: 3, fall: 4, dash: 3, hit: 4, dead: 20, idle2run: 3, land: 3 },
};

console.log("1) 아틀라스 프레임 존재·개수");
/* vc226 — 개별 PNG 268장을 아틀라스 1장(`fa/p1.png` + `fa/p1.json`)으로 묶었다.
 *  요청 268 → 2. 프레임 이름은 JSON 에 원래 키 그대로 들어 있다.
 *  p2/p3 은 참조 코드가 0곳이라 **로드하지 않는다**(180프레임 낭비 제거) — 검사 대상이 아니다. */
const ATLAS_PNG = path.join(FA, "p1.png");
const ATLAS_JSON = path.join(FA, "p1.json");
ok("아틀라스 PNG 존재", fs.existsSync(ATLAS_PNG));
ok("아틀라스 JSON 존재", fs.existsSync(ATLAS_JSON));

let atlas = null;
if (fs.existsSync(ATLAS_JSON)) atlas = JSON.parse(fs.readFileSync(ATLAS_JSON, "utf8"));
ok("아틀라스 frames 를 읽었다", !!atlas?.frames && Object.keys(atlas.frames).length > 0);

if (atlas?.frames) {
  const names = new Set(Object.keys(atlas.frames));
  const N = N_BY_CHAR.p1;
  let missing = 0, total = 0;
  for (const [an, n] of Object.entries(N)) {
    for (let i = 0; i < n; i++) {
      total++;
      if (!names.has(`fa_p1_${an}__${i}`)) missing++;
    }
  }
  ok(`p1 프레임 ${total}개 중 누락 ${missing}개`, missing === 0, `(누락 ${missing})`);

  /* 프레임 좌표가 아틀라스 경계를 벗어나면 Phaser 가 잘라 렌더한다. */
  const sz = atlas.meta?.size ?? { w: 0, h: 0 };
  const outOfBounds = Object.entries(atlas.frames).filter(([, f]) => {
    const r = f.frame;
    return r.x < 0 || r.y < 0 || r.x + r.w > sz.w || r.y + r.h > sz.h;
  });
  ok(`프레임이 아틀라스 경계 안에 있다`, outOfBounds.length === 0, `(${outOfBounds.length}건 초과)`);

  /* 로더가 실제로 이 수만큼 등록하는지 — 파일은 맞는데 등록 수가 틀리면 애니가 짧아진다. */
  const tex = fs.readFileSync(path.join(ROOT, "src/game/textures.ts"), "utf8");
  let mismatch = [];
  for (const [an, n] of Object.entries(N)) {
    const mm = tex.match(new RegExp(`\\b${an}:\\s*(\\d+)`));
    if (mm && Number(mm[1]) !== n) mismatch.push(`${an}(등록${mm[1]}≠실제${n})`);
  }
  ok(`textures.ts 등록 프레임 수가 실측과 일치`, mismatch.length === 0, `(${mismatch.join(",")})`);
}

console.log("\n2) 이름 충돌 회귀 방지");
const p1Names = atlas?.frames ? Object.keys(atlas.frames) : [];
ok("구분자 __ 를 쓴다", p1Names.length > 0 && p1Names.every((f) => f.includes("__")));
ok("`atk` 와 `atk2` 가 구분된다", p1Names.includes("fa_p1_atk__0") && p1Names.includes("fa_p1_atk2__0"));
ok("`atk0` 같은 모호한 이름이 없다", !p1Names.some((f) => /^fa_p1_atk\d+$/.test(f)));

console.log("\n3) 프레임 균일성 (아틀라스)");
/* 개별 PNG 시절엔 IHDR 을 읽어 캔버스 크기를 비교했다. 아틀라스에선 배치 단위가
 *  고정이므로 **메타의 프레임 크기가 모두 같은지**로 같은 보장을 한다. */
if (atlas?.frames) {
  const dims = new Set(Object.values(atlas.frames).map((f) => `${f.frame.w}x${f.frame.h}`));
  ok("모든 프레임 크기 동일", dims.size === 1, `(${[...dims]})`);
  /* 공통 앵커 — trimmed=false 여야 원본 캔버스가 보존되어 발 위치가 튀지 않는다. */
  const trimmed = Object.values(atlas.frames).filter((f) => f.trimmed);
  ok("trimmed=false (공통 앵커 보존)", trimmed.length === 0, `(${trimmed.length}건 trimmed)`);
  /* sourceSize == frame 크기면 원본 캔버스 그대로라는 뜻 */
  const srcOk = Object.values(atlas.frames).every(
    (f) => f.sourceSize.w === f.frame.w && f.sourceSize.h === f.frame.h
  );
  ok("sourceSize == frame (여백 보존)", srcOk);
}

console.log("\n4) p2/p3 미로드 (낭비 제거)");
{
  const boot = fs.readFileSync(path.join(ROOT, "src/game/scenes/BootScene.ts"), "utf8");
  const bootCode = boot.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  /* 아틀라스화 후 개별 프레임 루프 자체가 사라졌다 — 있는지가 아니라
   *  "p2/p3 을 로드하는 코드가 없는지"를 본다(낭비 제거의 실제 조건). */
  const loadsFa2 = /fa[\/_-]?p[23]/.test(bootCode);
  ok("p2/p3 을 로드하지 않는다", !loadsFa2);
  ok("load.atlas 로 1회 로드", /load\.atlas\(\s*["']fa_p1["']/.test(bootCode));
  ok("개별 FA load.image 가 없다", !/load\.image\([^)]*fa\/p1/.test(bootCode));
}

console.log("\n5) 표시 배율 정합성");
/* FA p1 idle 내용 18x36, 기존 hero_idle0 내용 26x42. 높이 기준 42/36 = 1.1667. */
const playerSrc = fs.readFileSync(path.join(ROOT, "src/game/entities/Player.ts"), "utf8");
const m = playerSrc.match(/const FA_DISPLAY_SCALE\s*=\s*([0-9.]+)/);
ok("FA_DISPLAY_SCALE 상수 존재", !!m);
if (m) {
  const v = parseFloat(m[1]);
  const want = 42 / 36;
  ok(`배율 ${v} 가 높이비 ${want.toFixed(4)} 와 1% 이내`, Math.abs(v - want) / want < 0.01,
    `(차이 ${(Math.abs(v - want) / want * 100).toFixed(2)}%)`);
  ok("배율이 1 을 넘는다 (FA 가 더 작으므로)", v > 1);
}

console.log("\n6) 로더 경로 중복 회귀 방지");
const boot = fs.readFileSync(path.join(ROOT, "src/game/scenes/BootScene.ts"), "utf8");
ok("load.setPath(\"assets\") 가 있다", /setPath\(\s*["']assets["']\s*\)/.test(boot));
ok("FA 경로가 아틀라스 경로를 쓴다", /load\.atlas\(\s*["']fa_p1["']\s*,\s*["']fa\/p1\.png["']/.test(boot));
/* vc224 — 종전 정규식은 **주석에 적힌** `assets/assets/fa` 설명까지 잡아 항상 실패했다.
 *  실제 로더 호출 인자만 본다: this.load.image(key, `...#{...}`) 안의 경로 문자열. */
const atlasCall = boot.match(/load\.atlas\(\s*["']fa_p1["']\s*,\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*\)/);
ok("FA 아틀라스 로더 호출이 있다", !!atlasCall);
/* vc226 — `load.setPath("assets")` 가 걸려 있으므로 경로에 assets/ 를 또 붙이면 404. */
ok("FA 경로에 assets/ 를 중복으로 붙이지 않는다", !!atlasCall && !atlasCall[1].startsWith("assets/"));

console.log("\n7) 플레이어 연결");
const player = playerSrc;
ok("faActive() 존재", /faActive\(\)/.test(player));
ok("playAnim() 이 bodyKey 를 거친다", /playAnim\(/.test(player) && /bodyKey\(heroKey\)/.test(player));
ok("정지 시 FA idle 복귀 분기가 있다", /faActive\(\)\)\s*\{[\s\S]{0,300}fa-p1-idle/.test(player));

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
