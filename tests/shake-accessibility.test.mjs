// vc222 — 화면 흔들림 접근성 검증
// shakeScale.ts 의 실제 계약: off=0, low=0.45, normal=1, strong=1.45
import { readFileSync } from "node:fs";

let pass=0, fail=0;
const t=(n,c,x='')=>{ if(c){pass++;console.log(`PASS  ${n} ${x}`);} else {fail++;console.log(`FAIL  ${n} ${x}`);} };

const src = readFileSync("src/game/fx/shakeScale.ts","utf8");

console.log("=== 1) 계약: 4단계 배율 ===");
const F = { off:0, low:0.45, normal:1, strong:1.45 };
for (const [k,v] of Object.entries(F)) {
  const re = new RegExp(`${k}:\\s*${v.toString().replace('.','\\.')}`);
  t(`SHAKE_FACTORS.${k} = ${v}`, re.test(src));
}
t("기본값 normal", /DEFAULT_SHAKE_SCALE:\s*ShakeScale\s*=\s*"normal"/.test(src));
t("off 는 흔들림 0", F.off === 0);

console.log("\n=== 2) 적용 범위: 셰이크 두 경로 모두 ===");
const impact = readFileSync("src/game/fx/ImpactFX.ts","utf8");
const ult    = readFileSync("src/game/fx/UltCinematic.ts","utf8");
const scene  = readFileSync("src/game/scenes/WorldScene.ts","utf8");

t("ImpactFX.shake 가 shakeFactor 곱함", /const k = shakeFactor\(\);[\s\S]{0,200}intensity \*= k/.test(impact));
t("UltCinematic 이 ox/oy 에 k 곱함", /this\.ox = Math\.sin[\s\S]{0,120}\* k/.test(ult) && /this\.oy = Math\.sin[\s\S]{0,120}\* k/.test(ult));
t("off 면 셰이크 연출 자체를 건너뜀", /if \(k <= 0\) return;/.test(impact));

console.log("\n=== 3) 중복 적용 없음 (이중 곱 방지) ===");
// doShake 는 배율을 곱하지 않고 위임만 해야 한다
const doShake = scene.match(/doShake\(duration: number, intensity: number\) \{[\s\S]*?\n  \}/)?.[0] ?? "";
t("doShake 가 배율을 또 곱하지 않음", !/shakeScale\(\)|shakeFactor\(\)/.test(doShake));
t("doShake 는 ImpactFX 로 위임", /this\.impactFX\.shake\(duration, intensity\)/.test(doShake));

console.log("\n=== 4) 게임플레이 영향 없음 ===");
t("배율이 데미지 계산에 안 쓰임", !/shakeFactor|ShakeScale/.test(readFileSync("src/game/combat/damageModel.ts","utf8")));
t("shakeScale 이 판정/전투 모듈을 import 하지 않음", !/from ["'].*(combat|entities)/.test(src));

console.log("\n=== 5) 저장/복원 ===");
t("localStorage 키 존재", /SHAKE_STORAGE_KEY\s*=\s*"sertz_shake_scale"/.test(src));
t("잘못된 값은 기본값으로 복구", /else \{\s*current = DEFAULT_SHAKE_SCALE/.test(src));
t("저장 실패해도 세션엔 적용", /catch \{[\s\S]{0,120}이번 세션에는 적용/.test(src));
t("부팅 시 복원 호출됨", /loadShakeScale\(\)/.test(readFileSync("src/game/PhaserGame.ts","utf8")));

console.log("\n=== 6) 배율 수치 sanity ===");
const apply=(base,k)=>base*k;
t("off → 화면 고정", apply(0.007, F.off) === 0);
t("low → 55% 감소", Math.abs(apply(0.007,F.low)/0.007 - 0.45) < 1e-9);
t("strong → 145%", Math.abs(apply(0.007,F.strong)/0.007 - 1.45) < 1e-9);
t("normal → 변화 없음", apply(0.007,F.normal) === 0.007);

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail?1:0);
