/**
 * 5차 발광 계약 검증 (v1.4.41 — 유저 지시 #9)
 *
 * 유저 지시: "5차 시에는 캐릭터에 블룸 및 약한 라이트 효과 ㄱㄱ"
 *
 * 헤드리스 환경에서는 WebGL 이 없어 실제 픽셀을 볼 수 없다. 그래서 **연출 파라미터를
 * 숫자로 고정**하고 회귀를 막는다. 임계값은 "약한 라이트"에 맞춘 상한이다 — 강하면
 * 캐릭터가 하얗게 씻겨 보이므로(과거 v1.4.32 에서 실제로 겪음) 알파를 낮게 유지한다.
 *
 *   node tools/verify-fifth-aura.js
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const results = [];
function check(name, fn) {
  try { fn(); results.push(["PASS", name]); }
  catch (e) { results.push(["FAIL", name + " — " + e.message]); }
}

const auraSrc = fs.readFileSync(path.join(root, "src/game/fx/FifthAura.ts"), "utf8");
const sceneSrc = fs.readFileSync(path.join(root, "src/game/scenes/WorldScene.ts"), "utf8");
const playerSrc = fs.readFileSync(path.join(root, "src/game/entities/Player.ts"), "utf8");

/** 알파 계수 추출 (0.42 * s * breath 같은 식에서 선행 상수) */
function alphaOf(layer) {
  const re = new RegExp(`${layer}\\.setAlpha\\(([0-9.]+)`);
  const m = auraSrc.match(re);
  if (!m) throw new Error(`${layer} setAlpha 를 찾지 못함`);
  return parseFloat(m[1]);
}

check("3개 레이어(코어·헤일로·지면)가 모두 존재", () => {
  for (const k of ["core:", "halo:", "ground:"]) {
    if (!auraSrc.includes(k)) throw new Error(`${k} 누락`);
  }
});

check("가산광(ADD) 블렌드로 그린다 — 빛처럼 보이게", () => {
  if (!/BlendModes\.ADD/.test(auraSrc)) throw new Error("ADD 블렌드 없음");
});

check("코어 알파가 약하다 (0.3~0.6) — 캐릭터가 씻기지 않게", () => {
  const a = alphaOf("r.core");
  if (a < 0.3 || a > 0.6) throw new Error(`코어 알파 ${a} (0.3~0.6 이어야 함)`);
});

check("헤일로 알파가 더 약하다 (<= 0.4) — '약한 라이트'", () => {
  const a = alphaOf("r.halo");
  if (a > 0.4) throw new Error(`헤일로 알파 ${a} (>0.4 는 과함)`);
});

check("지면 라이트 알파가 가장 약하다 (<= 0.3)", () => {
  const a = alphaOf("r.ground");
  if (a > 0.3) throw new Error(`지면 알파 ${a}`);
});

check("호흡 애니메이션이 있다 (사인파)", () => {
  if (!/Math\.sin\(/.test(auraSrc)) throw new Error("호흡 사인파 없음 — 정지광은 죽어 보인다");
});

check("켜짐/꺼짐이 급격하지 않다 (보간 계수 < 0.2)", () => {
  const m = auraSrc.match(/r\.strength \+= \(r\.target - r\.strength\) \* ([0-9.]+)/);
  if (!m) throw new Error("강도 보간을 찾지 못함");
  const k = parseFloat(m[1]);
  if (k > 0.2) throw new Error(`보간 계수 ${k} — 깜빡임`);
});

check("5차 판정으로만 켜진다 (isFifth)", () => {
  if (!/this\.player\.isFifth/.test(sceneSrc)) throw new Error("isFifth 조건이 없음");
});

check("죽은 상태에서는 꺼진다", () => {
  const m = sceneSrc.match(/this\.fifthAura\.update\([\s\S]{0,200}?\);/);
  if (!m) throw new Error("fifthAura.update 호출을 찾지 못함");
  if (!/state !== "dead"/.test(m[0])) throw new Error("사망 시 소등 조건 없음");
});

check("매 프레임 플레이어 좌표를 따라간다", () => {
  const m = sceneSrc.match(/this\.fifthAura\.update\(([\s\S]{0,200}?)\);/);
  if (!m) throw new Error("update 호출 없음");
  if (!/this\.player\.x/.test(m[1]) || !/this\.player\.y/.test(m[1])) {
    throw new Error("좌표 추적 인자가 없음");
  }
});

check("파괴 경로가 있다 (씬 종료/해제 시 누수 방지)", () => {
  if (!/destroy\(\): void/.test(auraSrc)) throw new Error("destroy() 없음");
  if (!/\.destroy\(\)/.test(auraSrc)) throw new Error("오브젝트 파괴 없음");
});

check("직업 색을 반영한다 (전직 시 색 변화)", () => {
  if (!/clsHexPublic/.test(sceneSrc)) throw new Error("clsHexPublic 미사용");
  if (!/get clsHexPublic\(\)/.test(playerSrc)) throw new Error("접근자 미정의");
});

check("씬 종료 시 오라를 정리한다", () => {
  if (!/fifthAura\?\.destroy\(\)|fifthAura\.destroy\(\)/.test(sceneSrc)) {
    throw new Error("shutdown 정리 없음 — 씬 재진입마다 이미지가 누적된다");
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
