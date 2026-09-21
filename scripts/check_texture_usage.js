#!/usr/bin/env node
/* v1.4.1 진단 2 — 코드가 "사용"하는 텍스처 키 vs 실제 "로드"된 키 대조.
 *  BootScene/TitleScene 로드 목록에 없는 키로 add.sprite/add.image/setTexture 하는 코드 탐지. */
const fs = require("fs");
const path = require("path");
const ROOT = "/home/z/my-project";

/* ── 로드 키 집합 구축 (check_assets_v141.js와 동일 로직) ── */
const boot = fs.readFileSync(path.join(ROOT, "src/game/scenes/BootScene.ts"), "utf8");
const data = fs.readFileSync(path.join(ROOT, "src/game/data.ts"), "utf8");
const arrayBlock = (src, name) => {
  const start = src.indexOf(`const ${name}`);
  if (start < 0) return "";
  const open = src.indexOf("[", start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "[") depth++;
    else if (src[i] === "]") { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  return "";
};
const strs = (src, name) => Array.from(arrayBlock(src, name).matchAll(/"([^"]+)"/g)).map((x) => x[1]);
const loaded = new Set();
for (const k of strs(boot, "ASSET_LIST")) loaded.add(k);
const heroFrames = ["idle0","idle1","idle2","idle3","walk0","walk1","walk2","walk3","walkside0","walkside1","walkside2","walkside3","walkup0","walkup1","walkup2","walkup3","atk0","atk1","atk2","atk3","atkdown0","atkdown1","atkdown2","atkdown3","atkup0","atkup1","atkup2","atkup3"];
for (const p of strs(data, "BODY_PREFIXES")) for (const f of heroFrames) loaded.add(`${p}_${f}`);
for (const t of ["acc_crown","acc_ribbon","acc_halo","acc_wings_devil","acc_wings_fairy","acc_cape_crimson","acc_cape_royal","i_cos_rainbow"]) loaded.add(t);
for (const t of ["hv_slash","hv_flash","uni_boom"]) loaded.add(t);
for (const t of ["vf_pentacle","vf_penta_fire","vf_penta_elec","vf_penta_dark","vf_penta_ice","vf_flare_fire","vf_flare_elec","vf_flare_dark","vf_flare_ice","vf_flare_nature","vf_flare_void","vf_flare_water","vf_flare_earth","vf_ring_void","vf_ring_fire","vf_emb_fire","vf_emb_void","vf_emb_nature","vf_emb_sound","vf_slash","vf_impact","vf_ring","vf_lightning","vf_star","vf_arrow"]) loaded.add(t);
for (const t of ["gw_magic","gw_rune","gw_tech","gw_electro","gw_flare","gw_flash","gw_glow","gw_arc","gw_crack","gw_trail","gw_arrow","gw_proj","gw_crystal","gw_crater","gw_slash_a","gw_slash_b","gw_slash_c","gw_dash","gw_shock","gw_boom","gw_spark","gw_crit","gw_fire","gw_dot","wx_snowflake","wx_splat","wx_crater","wx_crack","wx_smoke","wx_spark5"]) loaded.add(t);
const X2_MONSTERS = strs(boot, "X2_MONSTERS"); const X3_MONSTERS = strs(boot, "X3_MONSTERS");
for (const k of X2_MONSTERS) for (const f of ["idle0","idle1","run0","run1","run2","run3","atk0"]) loaded.add(`${k}_${f}`);
for (const k of X3_MONSTERS) for (const f of ["idle0","idle1","idle2","idle3","run0","run1","run2","run3","atk0"]) loaded.add(`${k}_${f}`);
for (const k of ["x3_bow","x3_staff","x3_dagger","x3_shuriken","npc_gm","x2_arrow","x2_arrow_green","x2_arrow_sky","x2_bricks","x2_bow"]) loaded.add(k);
for (const k of Array.from(arrayBlock(boot, "X2_SPELLS").matchAll(/\["([^"]+)"/g)).map((x) => x[1])) loaded.add(k);
for (const k of ["vfx2_bolt","vfx2_charged","vfx2_hit1","vfx2_hit3","vfx2_hit5","vfx2_pulse","vfx2_wspark","vfx2_elec","vfx2_tri","vfx2_cfx1","vfx2_boom","vfx2_blood","sv_campfire","fx_tornado","chest_anim"]) loaded.add(k);
for (const s of ["gp","dp","cp","si","ap"]) for (const k of ["edge_dn","edge_up","edge_lt","edge_rt","bite_dn","bite_up","gvar1","gvar2","pvar"]) loaded.add(`tx_${s}_${k}`);
for (const k of strs(boot, "VFX3_LIST")) loaded.add(k);
for (const k of ["map_torch_f","map_chest_f","map_ground","map_props","map_flame","map_bubble"]) loaded.add(k);
/* 아이콘류: i_* / item_* / pet_* / cos_* / buff_* / ring_* 등은 data.ts/React에서 쓰는 DOM 아이콘 —
 *  Phaser 텍스처 여부와 무관할 수 있으나, 월드에서 add.sprite로 쓰면 아래 스캔에서 잡힌다.
 *  실제 로드된 icon성 키를 보강: 아이템 아이콘 전수 로드 목록이 있으면 여기에 추가. */
/* BootScene에 i_/item_류: ASSET_LIST에 포함돼 있음(위에서 반영). data.ts ITEMS의 icon 키도 보강 */
for (const m of data.matchAll(/icon:\s*"([^"]+)"/g)) loaded.add(m[1]);

/* ── 사용 키 스캔 ── */
const files = [];
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith(".ts") || p.endsWith(".tsx")) files.push(p); } };
walk(path.join(ROOT, "src/game"));
walk(path.join(ROOT, "src/components/game"));

const used = new Map(); // key -> [file:line]
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const lines = src.split("\n");
  lines.forEach((line, idx) => {
    // add.sprite/add.image/add.tileSprite(..., "KEY", ...) 세 번째/네 번째 인수 문자열
    for (const m of line.matchAll(/add\.(?:sprite|image|tileSprite)\([^,]+,[^,]+,\s*"([a-z0-9_]+)"/g)) {
      const k = m[1];
      if (!loaded.has(k)) (used.get(k) ?? used.set(k, []).get(k)).push(`${path.basename(f)}:${idx + 1}`);
    }
    for (const m of line.matchAll(/setTexture\("([a-z0-9_]+)"/g)) {
      const k = m[1];
      if (!loaded.has(k)) (used.get(k) ?? used.set(k, []).get(k)).push(`${path.basename(f)}:${idx + 1}`);
    }
    // anims.generateFrameNumbers("KEY" / anims.create({ key/frame 대상 textures: "KEY"
    for (const m of line.matchAll(/generateFrameNumbers\("([a-z0-9_]+)"/g)) {
      const k = m[1];
      if (!loaded.has(k)) (used.get(k) ?? used.set(k, []).get(k)).push(`${path.basename(f)}:${idx + 1}`);
    }
  });
}
console.log(`로드 키 ${loaded.size}개 / 사용-미로드 키 ${used.size}개`);
for (const [k, locs] of [...used.entries()].sort()) {
  console.log(`  ✗ ${k}  ← ${locs.slice(0, 4).join(", ")}${locs.length > 4 ? ` 외 ${locs.length - 4}` : ""}`);
}
