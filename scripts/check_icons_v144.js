/* v1.4.3 진단 — ITEMS icon → 실제 파일 존재 전수 대조 (유저 리포트 #4: 보스 유물·일부 아이템 이미지 로드 실패) */
const fs = require("fs");
const path = require("path");

const dataSrc = fs.readFileSync("/home/z/my-project/src/game/data.ts", "utf8");
const assetDir = "/home/z/my-project/public/assets";

/* 1) data.ts에서 icon: "xxx" 전수 추출 */
const iconRe = /icon:\s*"([a-z0-9_]+)"/g;
const icons = new Set();
let m;
while ((m = iconRe.exec(dataSrc))) icons.add(m[1]);

/* 2) 각 아이콘 키로 후보 파일 탐색 (.webp / .png) */
const missing = [];
for (const ic of [...icons].sort()) {
  const webp = path.join(assetDir, ic + ".webp");
  const png = path.join(assetDir, ic + ".png");
  if (!fs.existsSync(webp) && !fs.existsSync(png)) missing.push(ic);
}

console.log(`아이콘 키 총 ${icons.size}종`);
if (missing.length === 0) {
  console.log("누락 0 — 모든 아이콘 파일 존재");
} else {
  console.log(`누락 ${missing.length}종:`);
  for (const ic of missing) console.log("  - " + ic);
}

/* 3) 아이콘에선 참조되지 않지만 i_ 로 시작하는 파일(역방향) — 참고용 */
const files = fs.readdirSync(assetDir).filter((f) => f.startsWith("i_"));
const iconSet = new Set([...icons].map((i) => i + ".webp"));
const orphan = files.filter((f) => !iconSet.has(f) && !fs.existsSync(path.join(assetDir, f.replace(/\.png$/, ".webp"))));
console.log(`\n역방향: 파일은 있으나 data.ts 참조 없는 i_* 파일 ${orphan.length}종`);
for (const o of orphan.slice(0, 30)) console.log("  - " + o);
