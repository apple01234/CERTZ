#!/usr/bin/env node
/* v1.4.1 진단 — BootScene/TitleScene이 로드하는 모든 에셋 키 vs 실제 파일 대조.
 *  "몇몇 스프라이트 이미지 안불러와짐" 원인 특화: 누락 파일(404) 목록 + 미참조 고아 파일 요약. */
const fs = require("fs");
const path = require("path");

const ROOT = "/home/z/my-project";
const boot = fs.readFileSync(path.join(ROOT, "src/game/scenes/BootScene.ts"), "utf8");
const data = fs.readFileSync(path.join(ROOT, "src/game/data.ts"), "utf8");
const audio = fs.readFileSync(path.join(ROOT, "src/game/audio.ts"), "utf8");
const title = fs.readFileSync(path.join(ROOT, "src/game/scenes/TitleScene.ts"), "utf8");

const uniq = (a) => Array.from(new Set(a));
/* 주의: X2_SPELLS는 "as const"가 없는 배열 — name 배열 블록을 중괄호 균형으로 정확히 자른다 */
const arrayBlock = (src, name) => {
  const start = src.indexOf(`const ${name}`);
  if (start < 0) throw new Error(name + " not found");
  const open = src.indexOf("[", start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "[") depth++;
    else if (src[i] === "]") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(name + " unterminated");
};
const strs = (src, name) => Array.from(arrayBlock(src, name).matchAll(/"([^"]+)"/g)).map((x) => x[1]);

const img = []; // {key, path}
const aud = [];
const addImg = (key, p) => img.push({ key, path: p });
const addAud = (key, p) => aud.push({ key, path: p });

/* 1) ASSET_LIST (assets/ *.webp) */
for (const k of strs(boot, "ASSET_LIST")) addImg(k, `public/assets/${k}.webp`);
/* 2) 코어 바디 프리픽스 × heroFrames */
const heroFrames = ["idle0","idle1","idle2","idle3","walk0","walk1","walk2","walk3","walkside0","walkside1","walkside2","walkside3","walkup0","walkup1","walkup2","walkup3","atk0","atk1","atk2","atk3","atkdown0","atkdown1","atkdown2","atkdown3","atkup0","atkup1","atkup2","atkup3"];
/* BODY_PREFIXES 배열만 정확히 파싱 (data.ts 다른 곳의 gm_sword 등 아이템 키 오염 방지) */
const bodyPrefixes = strs(data, "BODY_PREFIXES");
/* BootScene: core prefixes 즉시 로드 / TitleScene: 나머지(body) 지연 로드 — 전부 검사 */
for (const p of bodyPrefixes) for (const f of heroFrames) addImg(`${p}_${f}`, `public/assets/${p}_${f}.webp`);
/* 3) acc 어태치 8종 */
for (const t of ["acc_crown","acc_ribbon","acc_halo","acc_wings_devil","acc_wings_fairy","acc_cape_crimson","acc_cape_royal","i_cos_rainbow"]) addImg(t, `public/assets/${t}.webp`);
/* 4) hv/uni/vf/gw/wx 개별 리스트 */
addImg("hv_slash", "public/assets/hv_slash.webp"); addImg("hv_flash", "public/assets/hv_flash.webp"); addImg("uni_boom", "public/assets/uni_boom.webp");
for (const t of ["vf_pentacle","vf_penta_fire","vf_penta_elec","vf_penta_dark","vf_penta_ice","vf_flare_fire","vf_flare_elec","vf_flare_dark","vf_flare_ice","vf_flare_nature","vf_flare_void","vf_flare_water","vf_flare_earth","vf_ring_void","vf_ring_fire","vf_emb_fire","vf_emb_void","vf_emb_nature","vf_emb_sound","vf_slash","vf_impact","vf_ring","vf_lightning","vf_star","vf_arrow"]) addImg(t, `public/assets/${t}.webp`);
for (const t of ["gw_magic","gw_rune","gw_tech","gw_electro","gw_flare","gw_flash","gw_glow","gw_arc","gw_crack","gw_trail","gw_arrow","gw_proj","gw_crystal","gw_crater","gw_slash_a","gw_slash_b","gw_slash_c","gw_dash","gw_shock","gw_boom","gw_spark","gw_crit","gw_fire","gw_dot","wx_snowflake","wx_splat","wx_crater","wx_crack","wx_smoke","wx_spark5"]) addImg(t, `public/assets/${t}.webp`);
/* 5) X2/X3 몬스터 */
const X2_MONSTERS = strs(boot, "X2_MONSTERS");
const X3_MONSTERS = strs(boot, "X3_MONSTERS");
for (const k of X2_MONSTERS) for (const f of ["idle0","idle1","run0","run1","run2","run3","atk0"]) addImg(`${k}_${f}`, `public/assets/${k}_${f}.webp`);
for (const k of X3_MONSTERS) for (const f of ["idle0","idle1","idle2","idle3","run0","run1","run2","run3","atk0"]) addImg(`${k}_${f}`, `public/assets/${k}_${f}.webp`);
for (const k of ["x3_bow","x3_staff","x3_dagger","x3_shuriken","npc_gm","x2_arrow","x2_arrow_green","x2_arrow_sky","x2_bricks","x2_bow"]) addImg(k, `public/assets/${k}.webp`);
/* X2_SPELLS: [키, 폭, 높이][] — 키만 추출 (as const 없음 → arrayBlock으로 정확 파싱) */
const spellKeys = Array.from(arrayBlock(boot, "X2_SPELLS").matchAll(/\["([^"]+)"/g)).map((x) => x[1]);
for (const k of spellKeys) addImg(k, `public/assets/${k}.webp`);
/* 6) VFX2 시트 + 단일 */
for (const k of ["vfx2_bolt","vfx2_charged","vfx2_hit1","vfx2_hit3","vfx2_hit5","vfx2_pulse","vfx2_wspark","vfx2_elec","vfx2_tri","vfx2_cfx1","vfx2_boom","vfx2_blood","sv_campfire","fx_tornado","chest_anim"]) addImg(k, `public/assets/${k}.webp`);
/* 7) tx 전환타일 5세트×9 */
for (const s of ["gp","dp","cp","si","ap"]) for (const k of ["edge_dn","edge_up","edge_lt","edge_rt","bite_dn","bite_up","gvar1","gvar2","pvar"]) addImg(`tx_${s}_${k}`, `public/assets/tx_${s}_${k}.webp`);
/* 8) vfx2/ 폴더 58종 PNG */
for (const k of strs(boot, "VFX3_LIST")) addImg(k, `public/assets/vfx2/${k}.png`);
/* 9) map/ 폴더 */
for (const k of ["map_torch_f","map_chest_f"]) addImg(k, `public/assets/map/${k.replace("_f","")}.png`);
for (const k of ["map_ground","map_props","map_flame","map_bubble"]) addImg(k, `public/assets/map/${k}.png`);
/* 10) 오디오: audio.ts의 BGM_PRELOAD_TRACKS/SKILL_SFX_TRACKS + BootScene AUDIO_LIST 고정분 */
const bgmPre = Array.from(audio.match(/BGM_PRELOAD_TRACKS[^=]*=\[[\s\S]*?\]/)?.[0].matchAll(/"([^"]+)"/g) ?? []).map((x) => x[1]);
const skillSfx = Array.from(audio.match(/SKILL_SFX_TRACKS[^=]*=\[[\s\S]*?\]/)?.[0].matchAll(/"([^"]+)"/g) ?? []).map((x) => x[1]);
for (const k of [...bgmPre, "sfx_swing","sfx_hit","sfx_spin","sfx_dash","sfx_hurt","sfx_pickup","sfx_quest","sfx_levelup","sfx_portal","sfx_roar","sfx_die","sfx_bossdie","sfx_coin","sfx_potion","sfx_equip","sfx_upgrade","sfx_click","sfx_open","sfx_close","sfx_ach", ...skillSfx]) addAud(k, `public/assets/audio/${k}.ogg`);
for (const k of strs(boot, "SFX3_LIST")) addAud(k, `public/assets/audio/sfx/${k}.ogg`);

/* ── 검증 ── */
const missingImg = img.filter((x) => !fs.existsSync(path.join(ROOT, x.path)));
const missingAud = aud.filter((x) => !fs.existsSync(path.join(ROOT, x.path)));
console.log(`이미지 로드 항목: ${img.length} (유니크 ${new Set(img.map((x) => x.path)).size}) — 누락 ${missingImg.length}`);
for (const x of missingImg) console.log("  ✗ " + x.key + " → " + x.path);
console.log(`오디오 로드 항목: ${aud.length} (유니크 ${new Set(aud.map((x) => x.path)).size}) — 누락 ${missingAud.length}`);
for (const x of missingAud) console.log("  ✗ " + x.key + " → " + x.path);

/* 보너스: 0바이트/손상 webp 스캔 (public/assets 전체) */
const scanDir = (d, exts, out) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) scanDir(p, exts, out);
    else if (exts.some((x) => e.name.endsWith(x))) {
      const st = fs.statSync(p);
      if (st.size === 0) out.push(p + " (0바이트)");
      else if (e.name.endsWith(".webp")) {
        const b = fs.readFileSync(p);
        if (!(b.length > 12 && b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP")) out.push(p + " (webp 시그니처 이상)");
      } else if (e.name.endsWith(".png")) {
        const b = fs.readFileSync(p);
        if (!(b.slice(0, 8).toString("hex") === "89504e470d0a1a0a")) out.push(p + " (png 시그니처 이상)");
      }
    }
  }
  return out;
};
const corrupt = scanDir(path.join(ROOT, "public/assets"), [".webp", ".png"], []);
console.log(`손상/0바이트 이미지: ${corrupt.length}`);
for (const c of corrupt) console.log("  ✗ " + c);
