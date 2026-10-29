#!/usr/bin/env node
/**
 * GLB 를 three.js GLTFLoader 로 **실제 파싱** 검증 (v1.4.41).
 *
 * 바이너리 규격 검사(tools/verify-glb-binary.js)만으로는 부족하다 —
 * glTF 스펙은 맞는데 three.js 가 지원하지 않는 확장/속성이 섞이면
 * 런타임에서만 실패한다. 궁극기 연출은 그때 조용히 사라진다.
 *
 * 그래서 게임과 **같은 라이브러리**로 파싱해 본다.
 *
 *   node tools/verify-glb-parse.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const threeDir = path.join(root, "node_modules", "three");
const { GLTFLoader } = await import(threeDir + "/examples/jsm/loaders/GLTFLoader.js");

const dir = path.join(root, "public", "assets3d");
const targets = fs.readdirSync(dir).filter((f) => f.endsWith(".glb"));
const loader = new GLTFLoader();

let ok = 0;
let meshTotal = 0;
const fail = [];

for (const f of targets) {
  const buf = fs.readFileSync(path.join(dir, f));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  try {
    const gltf = await new Promise((res, rej) => loader.parse(ab, "", res, rej));
    let meshes = 0;
    gltf.scene.traverse((o) => { if (o.isMesh) meshes++; });
    if (meshes === 0) throw new Error("메시 0개");
    meshTotal += meshes;
    ok++;
  } catch (e) {
    fail.push([f, String(e.message || e).slice(0, 80)]);
  }
}

console.log(`three.js GLTFLoader 파싱: ${ok}/${targets.length} · 메시 ${meshTotal}개`);
if (fail.length) {
  console.log(`\n✗ 실패 ${fail.length}개:`);
  for (const [f, e] of fail.slice(0, 12)) console.log(`   ${f} — ${e}`);
  process.exit(1);
}
console.log("✓ 전 파일이 런타임 로더로 파싱된다 (궁극기 연출에서 조용히 사라지지 않음)");
