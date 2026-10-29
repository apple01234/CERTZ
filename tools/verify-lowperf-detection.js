/**
 * 저사양 판정 정확성 검증 (v1.4.41 — 유저 지시 #2)
 *
 * 유저 지적: "모바일에서는 특정 스킬 사용시 화면 3D 카메라 적용 안되는 버그".
 * 원인은 성능이 아니라 **UA 기반 오분류**였다. `isLowPerfEnv()` 가
 *   /Android|iPhone|Mobile/.test(ua) || maxTouchPoints>=2
 * 로 모바일이면 GPU 성능과 무관하게 true 를 돌려줘, 카메라 후처리(toon filters)·
 * 3D VFX·블룸이 통째로 꺼졌다(Galaxy S20+ 같은 정상 기기도 포함).
 *
 * 이 스크립트는 앞으로 누가 다시 UA 판정을 넣지 못하게 소스를 직접 검사한다.
 *
 *   node tools/verify-lowperf-detection.js
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "src/game/scenes/WorldScene.ts"), "utf8");

const results = [];
function check(name, fn) {
  try { fn(); results.push(["PASS", name]); }
  catch (e) { results.push(["FAIL", name + " — " + e.message]); }
}

const fn = (name) => {
  const m = src.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n\\}`));
  if (!m) throw new Error(`${name} 정의를 찾지 못함`);
  return m[0];
};

check("isLowPerfEnv 가 UA·터치 개수로 판정하지 않는다", () => {
  const body = fn("isLowPerfEnv");
  if (/userAgent|maxTouchPoints|Android|iPhone|iPad|Mobile/.test(body)) {
    throw new Error("UA/터치 기반 판정이 되살아남 — 모바일 전부 저사양이 된다");
  }
});

check("detectLowPerfEnv 가 UA 문자열을 쓰지 않는다", () => {
  const body = fn("detectLowPerfEnv");
  if (/userAgent|maxTouchPoints/.test(body)) {
    throw new Error("UA/터치 판정 잔존");
  }
});

check("소프트웨어 렌더러 판정을 유지한다 (진짜 저사양)", () => {
  const body = fn("detectLowPerfEnv");
  if (!/isSoftwareGL\(\)/.test(body)) throw new Error("isSoftwareGL 호출이 사라짐 — VM/에뮬레이터에서 블룸 폭주 위험");
});

check("메모리 기반 판정이 있다 (구형 안드로이드)", () => {
  const body = fn("detectLowPerfEnv");
  if (!/deviceMemory/.test(body)) throw new Error("deviceMemory 판정 없음");
});

check("텍스처 유닛 한도 판정이 있다 (블룸 이중 패스)", () => {
  const body = fn("detectLowPerfEnv");
  if (!/MAX_TEXTURE_IMAGE_UNITS/.test(body)) throw new Error("MAX_TEXTURE_IMAGE_UNITS 판정 없음");
});

check("판정 결과를 캐시한다 (부팅 1회 비용)", () => {
  const body = fn("isLowPerfEnv");
  if (!/lowPerfEnvCache/.test(body)) throw new Error("캐시가 사라짐 — 매 프레임 GL 조회 위험");
});

check("소프트웨어 렌더러 문자열 목록이 정확하다", () => {
  const m = src.match(/static isSoftwareGL\(\)[\s\S]*?\n  \}/);
  if (!m) throw new Error("isSoftwareGL 을 찾지 못함");
  for (const k of ["swiftshader", "llvmpipe", "softpipe"]) {
    if (!new RegExp(k, "i").test(m[0])) throw new Error(`${k} 누락`);
  }
});

const fail = results.filter(([s]) => s === "FAIL");
for (const [s, n] of results) console.log(`  ${s === "PASS" ? "✓" : "✗"} ${n}`);
console.log(
  fail.length === 0
    ? `\nALL CHECKS PASS (${results.length}항목)`
    : `\n${fail.length}건 실패 / 총 ${results.length}항목`
);
process.exit(fail.length === 0 ? 0 : 1);
