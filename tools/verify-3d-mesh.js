/**
 * FBX→GLB 3D 메시 계약 검증 (v1.4.41)
 *
 * 유저 지시: "B" — FBX 를 GLB 로 변환해 **3D 그대로** 쓰라.
 *  (메모리에 기록된 대로 "2D로 절대 변환시키지 마" — 스프라이트/빌보드 굽기 금지)
 *
 * 이 검사가 막는 사고
 * -------------------
 * cine3d.ts 가 GLB 이름을 문자열로 참조하는데, 그 파일이 없으면
 * `loadAsync` 가 reject 되고 **궁극기 연출만 조용히 사라진다**(오류는 콘솔에만).
 * 그래서 참조 ↔ 파일 존재를 기계적으로 대조한다.
 *
 *   node tools/verify-3d-mesh.js
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const results = [];
function check(name, fn) {
  try { fn(); results.push(["PASS", name]); }
  catch (e) { results.push(["FAIL", name + " — " + e.message]); }
}

const glbDir = path.join(root, "public", "assets3d");
const have = new Set(
  fs.readdirSync(glbDir).filter((f) => f.endsWith(".glb")).map((f) => f.slice(0, -4))
);

const cine = fs.readFileSync(path.join(root, "src/game/cine3d.ts"), "utf8");
const refs = [...new Set([...cine.matchAll(/"(uni__|vfx__)[a-z0-9_]+"/gi)].map((m) => m[0].slice(1, -1)))];

check("cine3d 가 GLB 를 참조한다", () => {
  if (refs.length < 20) throw new Error(`${refs.length}개만 참조 — 궁극기 매핑 손상 의심`);
});

check("참조하는 GLB 가 전부 실존한다", () => {
  const missing = refs.filter((r) => !have.has(r));
  if (missing.length) throw new Error(`${missing.length}개 없음: ${missing.slice(0, 5).join(", ")}`);
});

check("FBX→GLB 변환분(vfx__)을 실제로 사용한다", () => {
  const vfx = refs.filter((r) => r.startsWith("vfx__"));
  if (vfx.length < 4) throw new Error(`vfx__ ${vfx.length}개만 사용 — 변환해놓고 안 씀`);
});

check("변환된 GLB 가 30개 이상 카탈로그에 있다", () => {
  const vfxFiles = [...have].filter((k) => k.startsWith("vfx__"));
  if (vfxFiles.length < 30) throw new Error(`${vfxFiles.length}개 — 변환 누락`);
});

/* 2D 굽기 금지 — 사용자 명시 지시 위반 감지 */
check("2D 로 굽지 않는다 (스프라이트시트/빌보드 변환 금지)", () => {
  const bad = fs.readdirSync(path.join(root, "tools"))
    .filter((f) => /fbx.*(sprite|billboard|bake)/i.test(f));
  if (bad.length) throw new Error(`금지된 변환 스크립트: ${bad.join(", ")}`);
});

check("_report.json 카탈로그가 갱신됐다", () => {
  const rp = path.join(glbDir, "_report.json");
  if (!fs.existsSync(rp)) throw new Error("_report.json 없음");
  const r = JSON.parse(fs.readFileSync(rp, "utf8"));
  const ok = (r.summary && r.summary.ok) || 0;
  if (ok < 100) throw new Error(`카탈로그 OK ${ok}개 — 병합 누락(106 기대)`);
});

const fail = results.filter(([s]) => s === "FAIL");
for (const [s, n] of results) console.log(`  ${s === "PASS" ? "✓" : "✗"} ${n}`);
console.log(`\nGLB ${have.size}개 · cine3d 참조 ${refs.length}개 · vfx__ ${
  [...have].filter((k) => k.startsWith("vfx__")).length
}개`);
console.log(
  fail.length === 0
    ? `ALL CHECKS PASS (${results.length}항목)`
    : `${fail.length}건 실패 / 총 ${results.length}항목`
);
process.exit(fail.length === 0 ? 0 : 1);
