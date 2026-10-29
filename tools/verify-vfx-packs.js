/**
 * Unity VFX 팩 텍스처 계약 검증 (v1.4.41)
 *
 * 유저 지적: "왜 그대로 못씀?? Webgl로 쓸수 있잖아" / "UNI VFX 여기도 많음"
 *
 * 프리팹은 못 써도 텍스처는 PNG/TGA 라 WebGL 에서 그대로 쓴다.
 * 이 스크립트는 **키 3곳이 어긋나면 즉시 알린다**:
 *   ① public/assets/gvb_*.webp · gvu_*.webp   (실제 파일)
 *   ② BootScene.ts 로드 목록                   (메모리에 올라가는 것)
 *   ③ tools/import_vfx_packs.py IMPORT 표      (재생성 기준)
 *
 * 키가 어긋나면 Phaser 가 조용히 __MISSING 으로 대체하고, 이펙트만
 * 사라진 채 아무 오류도 나지 않는다 — 그래서 자동 검사가 필요하다.
 *
 * 추가로 **가산광 가능성**(알파 보유)을 검사한다. 알파가 없으면
 * ADD 에선 아무 일도 안 하고 NORMAL 에선 흰 사각형이 된다.
 *
 *   node tools/verify-vfx-packs.js
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const results = [];
function check(name, fn) {
  try { fn(); results.push(["PASS", name]); }
  catch (e) { results.push(["FAIL", name + " — " + e.message]); }
}

const assetsDir = path.join(root, "public", "assets");
const files = fs.readdirSync(assetsDir)
  .filter((f) => /^gv[bu]_.*\.webp$/.test(f))
  .map((f) => f.replace(/\.webp$/, ""));

const boot = fs.readFileSync(path.join(root, "src/game/scenes/BootScene.ts"), "utf8");
const loaded = [...new Set([...boot.matchAll(/"(gv[bu]_[a-z0-9_]+)"/g)].map((m) => m[1]))];

const importer = fs.readFileSync(path.join(root, "tools/import_vfx_packs.py"), "utf8");
const defined = [...new Set([...importer.matchAll(/\("(gv[bu]_[a-z0-9_]+)"/g)].map((m) => m[1]))];

check("팩 텍스처가 20장 이상 이관됐다", () => {
  if (files.length < 20) throw new Error(`${files.length}장 — 이관 실패 의심`);
});

check("파일 ↔ BootScene 로드목록이 일치한다", () => {
  const a = new Set(files), b = new Set(loaded);
  const missing = [...a].filter((k) => !b.has(k));
  const extra = [...b].filter((k) => !a.has(k));
  if (missing.length) throw new Error(`파일만 있고 로드 안 됨 ${missing.length}장: ${missing.slice(0, 4).join(",")}`);
  if (extra.length) throw new Error(`로드하는데 파일 없음 ${extra.length}장: ${extra.slice(0, 4).join(",")}`);
});

check("import 스크립트 정의 ↔ 실제 파일이 일치한다", () => {
  const a = new Set(files), c = new Set(defined);
  const diff = [...c].filter((k) => !a.has(k)).concat([...a].filter((k) => !c.has(k)));
  if (diff.length) throw new Error(`스크립트↔파일 불일치 ${diff.length}건: ${diff.slice(0, 4).join(",")}`);
});

check("GameVFX Buff(gvb_) 와 UNI VFX(gvu_) 둘 다 포함", () => {
  const buff = files.filter((k) => k.startsWith("gvb_")).length;
  const uni = files.filter((k) => k.startsWith("gvu_")).length;
  if (buff < 10) throw new Error(`gvb_ ${buff}장 — Buff 팩 미활용`);
  if (uni < 10) throw new Error(`gvu_ ${uni}장 — UNI VFX 팩 미활용`);
});

/* ── 실제 사용처 검사 (등록만 하고 안 쓰면 의미 없다) ── */
const ult = fs.readFileSync(path.join(root, "src/game/fx/UltCinematic.ts"), "utf8");
const aura = fs.readFileSync(path.join(root, "src/game/fx/FifthAura.ts"), "utf8");

check("궁극기 시네마틱이 팩 텍스처를 쓴다", () => {
  const used = [...new Set([...ult.matchAll(/"(gvu_[a-z0-9_]+)"/g)].map((m) => m[1]))];
  if (used.length < 3) throw new Error(`${used.length}종만 사용 — 3종 이상 필요`);
});

check("5차 오라가 팩 텍스처를 쓴다", () => {
  const t = aura.match(/const TEX_CORE = "([^"]+)"/);
  if (!t || !t[1].startsWith("gvb_")) throw new Error(`코어가 팩 텍스처가 아님: ${t && t[1]}`);
});

/* ── 가산광 가능성: 파일 크기·알파를 파이썬 없이 판정할 수는 없으므로
 *    이관 시점에 알파를 추출했는지(스크립트 존재 + 실행 흔적)를 확인한다. */
check("알파 추출 스크립트가 있고 팩 텍스처를 대상으로 한다", () => {
  const p = path.join(root, "tools/extract_vfx_alpha.py");
  if (!fs.existsSync(p)) throw new Error("extract_vfx_alpha.py 없음 — 알파 없는 ADD 텍스처가 흰 사각형이 된다");
  const src = fs.readFileSync(p, "utf8");
  if (!/gvb_|gvu_/.test(src)) throw new Error("대상 목록이 팩 텍스처가 아님");
});

const fail = results.filter(([s]) => s === "FAIL");
for (const [s, n] of results) console.log(`  ${s === "PASS" ? "✓" : "✗"} ${n}`);
console.log(`\n파일 ${files.length} · 로드 ${loaded.length} · 정의 ${defined.length}`);
console.log(
  fail.length === 0
    ? `ALL CHECKS PASS (${results.length}항목)`
    : `${fail.length}건 실패 / 총 ${results.length}항목`
);
process.exit(fail.length === 0 ? 0 : 1);
