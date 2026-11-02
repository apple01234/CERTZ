#!/usr/bin/env node
/**
 * pixelfx 이펙트를 프로젝트로 가져온다 (v1.0.0).
 *
 * 하는 일
 *   1) vendor/pixelfx/tools/render.mjs 를 호출해 --sheet 렌더
 *   2) records/<category>/<name>/<name>.{png,json} 을 public/assets/fx/ 로 복사
 *   3) public/assets/CREDITS.md 에 MIT 고지를 1회만 추가
 *
 * 사용
 *   node tools/import-pixelfx.mjs ice/frost-nova
 *   node tools/import-pixelfx.mjs ice/frost-nova fire/torch explosions/explosion
 *   node tools/import-pixelfx.mjs --list frost      (카탈로그 검색)
 *
 * 주의
 *   - Patch Pixel 폰트는 쓰지 않는다(요청). pixelfx 코드/시트만 사용한다.
 *   - 시트가 무거우므로 실제로 쓰는 것만 가져온다(1개 0.3~2MB).
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FXROOT = join(ROOT, "vendor", "pixelfx");
const OUT = join(ROOT, "public", "assets", "fx");
const CREDITS = join(ROOT, "public", "assets", "CREDITS.md");

const args = process.argv.slice(2);
if (!args.length) {
  console.error("사용: node tools/import-pixelfx.mjs <category/name> [...] | --list <검색어>");
  process.exit(1);
}

if (args[0] === "--list") {
  const q = args.slice(1).join(" ");
  const r = spawnSync("node", [join(FXROOT, "tools", "list.mjs"), ...q.split(" ").filter(Boolean)], {
    cwd: FXROOT, stdio: "inherit",
  });
  process.exit(r.status ?? 0);
}

if (!existsSync(join(FXROOT, "tools", "render.mjs"))) {
  console.error(`vendor/pixelfx 가 없습니다: ${FXROOT}`);
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

const imported = [];
for (const id of args) {
  const [cat, name] = id.split("/");
  if (!cat || !name) { console.error(`잘못된 id: ${id} (category/name 형식)`); continue; }

  const r = spawnSync("node", [join(FXROOT, "tools", "render.mjs"), id, "--sheet"], {
    cwd: FXROOT, encoding: "utf8",
  });
  if (r.status !== 0) {
    console.error(`렌더 실패 ${id}: ${(r.stderr || r.stdout || "").slice(-300)}`);
    continue;
  }

  const srcPng = join(FXROOT, "records", cat, name, `${name}.png`);
  const srcJson = join(FXROOT, "records", cat, name, `${name}.json`);
  if (!existsSync(srcPng) || !existsSync(srcJson)) {
    console.error(`시트 없음 ${id} — ${srcPng}`);
    continue;
  }

  /* 파일명은 name 만 쓴다(카테고리가 달라도 name 충돌 시 덮어씀 — 그때는 cat-name 로 rename) */
  let outName = name;
  const dstPng = join(OUT, `${outName}.png`);
  if (existsSync(dstPng)) {
    const a = statSync(dstPng).size, b = statSync(srcPng).size;
    if (a !== b) outName = `${cat}-${name}`;
  }
  copyFileSync(srcPng, join(OUT, `${outName}.png`));
  copyFileSync(srcJson, join(OUT, `${outName}.json`));
  imported.push({ id, key: outName });
  console.log(`✓ ${id} → public/assets/fx/${outName}.{png,json}`);
}

/* ── MIT 고지 (1회만) ─────────────────────────────────── */
if (imported.length) {
  const MARK = "## pixelfx (Pixel Art VFX) — MIT";
  let credits = existsSync(CREDITS) ? readFileSync(CREDITS, "utf8") : "# 에셋 크레딧\n";
  if (!credits.includes(MARK)) {
    credits += `\n${MARK}\n` +
      `- Source: https://github.com/patch-gg/pixelfx (commit a841596)\n` +
      `- License: MIT — pixelfx © 2026 Patch, Hugo Duprez\n` +
      `- 사용 범위: 스프라이트시트(public/assets/fx). Patch Pixel 폰트는 사용하지 않음.\n` +
      `- 수정: 16px 원본을 게임 해상도에 맞춰 시트로 렌더(도구 옵션만 사용, 코드 수정 없음)\n`;
    writeFileSync(CREDITS, credits, "utf8");
    console.log("✓ CREDITS.md 에 MIT 고지 추가");
  }
}

console.log(`\n가져온 이펙트 ${imported.length}개`);
if (imported.length) {
  console.log("Phaser 사용:");
  for (const i of imported) console.log(`  loadFxSheet(this, "${i.key}")  →  playFx(this, "${i.key}", x, y)`);
}
