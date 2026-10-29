/**
 * GLB 바이너리 유효성 검증 (v1.4.41)
 *
 * 왜 필요한가
 * -----------
 * FBX→GLB 변환은 Blender 배치로 돌아가고, 실패해도 파이프라인이 계속된다.
 * 깨진 GLB 는 three.js 에서 `loadAsync` reject → **궁극기 연출만 조용히 사라지고**
 * 콘솔에만 오류가 남는다(유저는 "스킬이 안 나온다"로만 체감).
 *
 * 그래서 변환 산출물을 **glTF 2.0 바이너리 규격**으로 직접 검사한다:
 *   magic='glTF' · version=2 · JSON 청크 존재 · meshes 1개 이상
 *
 *   node tools/verify-glb-binary.js
 */
const fs = require("node:fs");
const path = require("node:path");

const dir = path.join(__dirname, "..", "public", "assets3d");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".glb"));

const bad = [];
let totalMeshes = 0;
let totalBytes = 0;

for (const f of files) {
  const p = path.join(dir, f);
  const buf = fs.readFileSync(p);
  totalBytes += buf.length;

  // 헤더 12바이트: magic(4) version(4) length(4)
  if (buf.length < 20) { bad.push([f, "파일이 너무 작음"]); continue; }
  const magic = buf.toString("ascii", 0, 4);
  if (magic !== "glTF") { bad.push([f, `magic='${magic}' (glTF 아님)`]); continue; }
  const version = buf.readUInt32LE(4);
  if (version !== 2) { bad.push([f, `version=${version} (2 아님)`]); continue; }

  // 첫 청크 = JSON
  const chunkLen = buf.readUInt32LE(12);
  const chunkType = buf.toString("ascii", 16, 20);
  if (chunkType !== "JSON") { bad.push([f, `첫 청크가 JSON 아님: '${chunkType}'`]); continue; }
  let json;
  try {
    json = JSON.parse(buf.toString("utf8", 20, 20 + chunkLen));
  } catch (e) {
    bad.push([f, "JSON 파싱 실패"]); continue;
  }
  const meshes = (json.meshes || []).length;
  if (meshes < 1) { bad.push([f, "meshes 없음"]); continue; }
  totalMeshes += meshes;
}

console.log(`GLB ${files.length}개 · ${(totalBytes / 1024 / 1024).toFixed(2)}MB · 메시 ${totalMeshes}개`);
if (bad.length) {
  console.log(`\n✗ 깨진 파일 ${bad.length}개:`);
  for (const [f, why] of bad.slice(0, 20)) console.log(`   ${f} — ${why}`);
  process.exit(1);
}
console.log("✓ 전 파일 glTF 2.0 규격 통과 (magic·version·JSON청크·meshes)");
