/**
 * 궁극기 시네마틱 연출 검증 (v1.4.41 — 유저 지시 #13 "가장 공들이기")
 *
 * 유저 지시: "13. 스킬 개편에 많은 시간을 투자해" / "가장 공들이기"
 *
 * 헤드리스에서는 실제 픽셀을 볼 수 없으므로 **연출 계약**을 숫자로 못박는다.
 * 특히 카메라 셰이크는 이 프로젝트에서 조용히 실패하기 쉬운 지점이다:
 *   applyManualCameraFollow 가 매 프레임 scroll 을 산술 확정하므로,
 *   셰이크가 setScroll 로 직접 제어하면 다음 프레임에 덮어써져 **아무것도 안 보인다**.
 *   (camera-systems: "smooth follow first, add shake offset last")
 *
 *   node tools/verify-ult-cinematic.js
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const results = [];
function check(name, fn) {
  try { fn(); results.push(["PASS", name]); }
  catch (e) { results.push(["FAIL", name + " — " + e.message]); }
}

const cine = fs.readFileSync(path.join(root, "src/game/fx/UltCinematic.ts"), "utf8");
const scene = fs.readFileSync(path.join(root, "src/game/scenes/WorldScene.ts"), "utf8");
const player = fs.readFileSync(path.join(root, "src/game/entities/Player.ts"), "utf8");

/* ── 1. 셰이크가 팔로우와 싸우지 않는가 (가장 중요한 회귀) ── */
check("TraumaShake 가 setScroll 로 카메라를 직접 제어하지 않는다", () => {
  const cls = cine.match(/class TraumaShake[\s\S]*?\n\}/);
  if (!cls) throw new Error("TraumaShake 클래스를 찾지 못함");
  if (/setScroll|scrollX\s*=|scrollY\s*=/.test(cls[0])) {
    throw new Error("카메라를 직접 조작한다 — 팔로우가 매 프레임 덮어써 셰이크가 안 보인다");
  }
  if (!/ox\s*=|oy\s*=/.test(cls[0])) throw new Error("오프셋 노출이 없음");
});

check("씬이 팔로우 결과 뒤에 셰이크 오프셋을 더한다 (순서 고정)", () => {
  const fn = scene.match(/private applyManualCameraFollow\(dt: number\)[\s\S]*?\n  \}/);
  if (!fn) throw new Error("applyManualCameraFollow 를 찾지 못함");
  const body = fn[0];
  const followAt = body.indexOf("cam.scrollX += (tx - cam.scrollX) * k;");
  const shakeAt = body.indexOf("this.ultShake.ox");
  if (followAt < 0) throw new Error("팔로우 적용 지점을 찾지 못함");
  if (shakeAt < 0) throw new Error("셰이크 오프셋 합성이 없음");
  if (shakeAt < followAt) throw new Error("셰이크가 팔로우보다 먼저 더해진다 — 상쇄된다");
});

/* ── 2. 피드백 채널이 5~8개 겹치는가 (game-feel) ── */
check("연출 채널이 6개 이상 겹친다 (game-feel: 5~8개)", () => {
  const markers = [
    [/stop\(scene, \d+\)/, "히트스톱"],
    [/shake\.add\(/, "trauma 셰이크"],
    [/cam\.flash\(/, "화면 플래시"],
    [/fx_shockwave/, "충격파"],
    [/fx_Flare/, "광주/플레어"],
    [/tweens\.addCounter/, "궤도 회전"],
    [/setAlpha\(|fade/, "크로스페이드"],
  ];
  const missing = markers.filter(([re]) => !re.test(cine)).map(([, n]) => n);
  if (missing.length) throw new Error(`누락 채널: ${missing.join(", ")}`);
});

/* ── 3. 히트스톱이 3단(진입/중반/종결) ── */
check("히트스톱이 3단으로 배치됐다", () => {
  const n = (cine.match(/stop\(scene, \d+\)/g) || []).length;
  if (n < 3) throw new Error(`히트스톱 ${n}회 (3단 필요)`);
});

check("종결 히트스톱이 가장 길다", () => {
  const v = [...cine.matchAll(/stop\(scene, (\d+)\)/g)].map((m) => parseInt(m[1], 10));
  if (v.length < 3) throw new Error("히트스톱이 3개 미만");
  const last = v[v.length - 1];
  if (last !== Math.max(...v)) throw new Error(`종결 ${last}ms 가 최대가 아님 (${v.join(",")})`);
  if (last < 90) throw new Error(`종결 히트스톱 ${last}ms — 너무 약함`);
});

/* ── 4. trauma 감쇠 모델 ── */
check("trauma 가 제곱으로 스케일된다 (약한 흔들림 억제)", () => {
  if (!/trauma \* this\.trauma|this\.trauma \* this\.trauma/.test(cine)) {
    throw new Error("trauma^2 스케일 없음 — 작은 타격도 크게 흔들린다");
  }
});

check("trauma 가 시간에 따라 감쇠한다 (영구 진동 금지)", () => {
  if (!/trauma = Math\.max\(0, this\.trauma -/.test(cine)) throw new Error("감쇠 없음");
});

check("셰이크가 Math.random 이 아니라 샘플링된 사인파", () => {
  const cls = cine.match(/class TraumaShake[\s\S]*?\n\}/);
  if (/random\(\)/.test(cls[0])) throw new Error("매 프레임 random — 정전기처럼 떨린다");
  if (!/Math\.sin\(/.test(cls[0])) throw new Error("사인 샘플링 없음");
});

check("셰이크가 정리된다 (reset 경로)", () => {
  if (!/reset\(\): void/.test(cine)) throw new Error("reset() 없음");
  if (!/ultShake\?\.reset\(\)/.test(scene)) throw new Error("shutdown 에서 reset 호출 없음");
});

/* ── 5. 지속 시간이 시전 시간과 일치 ── */
check("연출 길이가 시전 시간(ultHold)에서 온다", () => {
  if (!/durationMs: ult5HoldOf\(/.test(player)) throw new Error("1차가 시전 시간을 안 씀");
  if (!/durationMs: ult5bHoldOf\(/.test(player)) throw new Error("2차가 시전 시간을 안 씀");
});

check("2차가 1차보다 큰 규모로 재생된다", () => {
  if (!/scale: 1\.35/.test(player)) throw new Error("2차 scale 배율 없음");
});

check("연출이 판정에 관여하지 않는다 (피해 계산 없음)", () => {
  if (/takeDamage|rollDamage|applyDamage/.test(cine)) {
    throw new Error("연출 파일에서 피해를 계산한다 — view/rule 분리 위반");
  }
});

/* ── 6. 저사양/Canvas 대응 ── */
check("Canvas(ADD 미지원)에서 알파만으로 동작", () => {
  if (!/renderer\.type === Phaser\.WEBGL/.test(cine)) throw new Error("WEBGL 분기 없음");
  const n = (cine.match(/if \(webgl\)/g) || []).length;
  if (n < 3) throw new Error(`webgl 분기 ${n}곳 — 부족`);
});

check("저사양에서 파편 수를 줄인다", () => {
  if (!/webgl \? 1 : 0\.5/.test(cine)) throw new Error("파편 수 감축 없음");
});

/* ── 7. 파괴 누수 방지 ── */
check("모든 임시 이미지가 destroy 된다", () => {
  const created = (cine.match(/scene\.add\.image\(/g) || []).length;
  const destroyed = (cine.match(/\.destroy\(\)/g) || []).length;
  if (destroyed < created - 1) {
    throw new Error(`생성 ${created} / 파괴 ${destroyed} — 누수 위험`);
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
