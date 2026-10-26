/** 마을 테마 검증 — 9개 챕터의 배치/지면/NPC 복장이 실제로 다른지 코드에서 확인 */
const fs=require("fs");
const src=fs.readFileSync("src/game/villageThemes.ts","utf8");
const keys=["forest","kingdom","alfheim","muspelheim","niflheim","cave","nidavellir","hel","abyss"];
const rows=[];
for(const k of keys){
  const re=new RegExp(`\\n  ${k}: \\{([\\s\\S]*?)\\n  \\},`);
  const m=src.match(re);
  if(!m){ rows.push({k,err:"미발견"}); continue; }
  const b=m[1];
  const ground=(b.match(/ground: "([a-z_]+)"/)||[])[1];
  const plaza=(b.match(/plaza: \{ x: ([\d.]+), y: ([\d.]+) \}/)||[]);
  const builds=(b.match(/\{ dx:/g)||[]).length;
  const job=(b.match(/jobMasterTex: "([a-z_]+)"/)||[])[1];
  const merch=(b.match(/merchantTex: "([a-z_]+)"/)||[])[1];
  rows.push({k,ground,plaza:plaza[1]+","+plaza[2],builds,job,merch});
}
console.table(rows);
// 고유성 판정
const sig=rows.map(r=>[r.ground,r.plaza,r.builds,r.job,r.merch].join("|"));
const uniq=new Set(sig);
console.log(`\n챕터 ${rows.length}개 중 배치 시그니처 고유: ${uniq.size}개`);
// 파일 존재 확인
const path=require("path");
const need=new Set();
for(const r of rows){ if(r.ground) need.add(r.ground); if(r.job) need.add(r.job); if(r.merch) need.add(r.merch); }
const missing=[...need].filter(t=>!fs.existsSync(path.join("public/assets",t+".webp")));
console.log("누락 텍스처:", missing.length? missing : "없음");
