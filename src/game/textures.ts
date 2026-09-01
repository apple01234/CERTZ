import Phaser from "phaser";

/**
 * 애니메이션 등록 전용 모듈.
 * 그래픽 자체는 모두 외부 에셋(public/assets/) — 캔버스 절차 생성 코드는 전면 제거되었다.
 *  - 참격: Weapon Slash - Effect by Cethiel (CC0) 6프레임
 *  - 차원문: Animated Portal by varkalandar (CC-BY 4.0) 8프레임
 *  - 이외 캐릭터/몬스터/이펙트: ArMM1998/Kenney/LPC/Sotrak (CREDITS.md 참조)
 */

/** 전역 애니메이션 등록 (최초 1회) — 실제 에셋 시트 프레임 기반 */
export function buildAllAnims(scene: Phaser.Scene) {
  const a = scene.anims;
  if (a.exists("hero-idle")) return;
  const fr = (prefix: string, n: number, rate: number, repeat: number) => ({
    frames: Array.from({ length: n }, (_, i) => ({ key: `${prefix}${i}` })),
    frameRate: rate,
    repeat,
  });
  // 주인공 (방향별 실제 스윙 프레임)
  a.create({ key: "hero-idle", ...fr("hero_idle", 4, 4, -1) });
  a.create({ key: "hero-walk", ...fr("hero_walk", 4, 9, -1) }); // 아래
  a.create({ key: "hero-walk-up", ...fr("hero_walkup", 4, 9, -1) });
  a.create({ key: "hero-walk-side", ...fr("hero_walkside", 4, 9, -1) }); // 오른쪽 기준(좌는 flipX)
  a.create({ key: "hero-atk", ...fr("hero_atk", 4, 16, 0) }); // 측면(오른쪽)
  a.create({ key: "hero-atk-down", ...fr("hero_atkdown", 4, 16, 0) });
  a.create({ key: "hero-atk-up", ...fr("hero_atkup", 4, 16, 0) });
  /* v3.0.2 — 신규 외부 몬스터 9종 (50 Monsters Pack, CC0) */
  for (const k of [
    "x2_frog", "x2_rat", "x2_bat", "x2_firebird", "x2_frostfly",
    "x2_snail", "x2_stonegolem", "x2_darkhound", "x2_reeffish",
  ]) {
    a.create({ key: `${k}-idle`, ...fr(`${k}_idle`, 2, 2, -1) });
    a.create({ key: `${k}-run`, ...fr(`${k}_run`, 4, 10, -1) });
    a.create({ key: `${k}-atk`, ...fr(`${k}_atk`, 1, 1, 0) });
  }
  /* v3.0.3 — 0x72 DungeonTileset II (itch.io, CC0) 신규 몬스터 7종: idle4+run4 */
  for (const k of [
    "x3_swampy", "x3_imp", "x3_icezombie", "x3_tinyzombie",
    "x3_ogre", "x3_chort", "x3_necromancer",
    /* v3.0.4 — itch.io 추가 6종 */
    "x3_maskedorc", "x3_orcwarrior", "x3_orcshaman", "x3_wogol", "x3_goblin", "x3_bigzombie",
  ]) {
    a.create({ key: `${k}-idle`, ...fr(`${k}_idle`, 4, 4, -1) });
    a.create({ key: `${k}-run`, ...fr(`${k}_run`, 4, 10, -1) });
    a.create({ key: `${k}-atk`, ...fr(`${k}_atk`, 1, 1, 0) });
  }
  /* v3.0.2 — 마법 투사체/시전 이펙트 (Pixelart Spells, CC0) */
  a.create({ key: "fx-arcane", frames: Array.from({ length: 6 }, (_, i) => ({ key: "x2_sp_arcane", frame: i })), frameRate: 14, repeat: -1 });
  a.create({ key: "fx-magicorb", frames: Array.from({ length: 6 }, (_, i) => ({ key: "x2_sp_magicorb", frame: i })), frameRate: 12, repeat: -1 });
  a.create({ key: "fx-fireball", frames: Array.from({ length: 6 }, (_, i) => ({ key: "x2_sp_fireball", frame: i })), frameRate: 14, repeat: -1 });
  a.create({ key: "fx-icelance", frames: Array.from({ length: 4 }, (_, i) => ({ key: "x2_sp_icelance", frame: i })), frameRate: 12, repeat: -1 });
  a.create({ key: "fx-darkbolt", frames: Array.from({ length: 6 }, (_, i) => ({ key: "x2_sp_darkbolt", frame: i })), frameRate: 14, repeat: -1 });
  a.create({ key: "fx-sparks", frames: Array.from({ length: 6 }, (_, i) => ({ key: "x2_sp_sparks", frame: i })), frameRate: 18, repeat: 0 });
  /* v3.0.8 디자인 개편 — Warped Shooting Fx / Cartoon FX Remaster 신규 VFX 애님 */
  a.create({ key: "fx2-bolt", frames: Array.from({ length: 4 }, (_, i) => ({ key: "vfx2_bolt", frame: i })), frameRate: 12, repeat: -1 });
  a.create({ key: "fx2-charged", frames: Array.from({ length: 6 }, (_, i) => ({ key: "vfx2_charged", frame: i })), frameRate: 14, repeat: -1 });
  a.create({ key: "fx2-hit1", frames: Array.from({ length: 4 }, (_, i) => ({ key: "vfx2_hit1", frame: i })), frameRate: 22, repeat: 0 });
  a.create({ key: "fx2-hit3", frames: Array.from({ length: 4 }, (_, i) => ({ key: "vfx2_hit3", frame: i })), frameRate: 22, repeat: 0 });
  a.create({ key: "fx2-hit5", frames: Array.from({ length: 4 }, (_, i) => ({ key: "vfx2_hit5", frame: i })), frameRate: 22, repeat: 0 });
  a.create({ key: "fx2-pulse", frames: Array.from({ length: 4 }, (_, i) => ({ key: "vfx2_pulse", frame: i })), frameRate: 8, repeat: -1 });
  a.create({ key: "fx2-elec", frames: Array.from({ length: 8 }, (_, i) => ({ key: "vfx2_elec", frame: i })), frameRate: 20, repeat: 0 });
  a.create({ key: "fx2-tri", frames: Array.from({ length: 2 }, (_, i) => ({ key: "vfx2_tri", frame: i })), frameRate: 16, repeat: 0 });
  /* v3.0.11 — 토네이도 회전 애님 (스카이로드 폭풍 소용돌이/천공의 폭풍/윈드러너 회오리 화살) */
  a.create({ key: "fx-tornado", frames: Array.from({ length: 8 }, (_, i) => ({ key: "fx_tornado", frame: i })), frameRate: 16, repeat: -1 });
  // 몬스터
  a.create({ key: "wolf-idle", ...fr("wolf_idle", 2, 2, -1) });
  a.create({ key: "wolf-run", ...fr("wolf_run", 4, 10, -1) });
  a.create({ key: "minion-idle", ...fr("minion_idle", 2, 3, -1) });
  a.create({ key: "minion-run", ...fr("minion_run", 4, 8, -1) });
  // 스토리 확장 몬스터 (동굴/니플헤임/심연)
  a.create({ key: "spider-idle", ...fr("spider_idle", 2, 3, -1) });
  a.create({ key: "spider-run", ...fr("spider_run", 4, 9, -1) });
  a.create({ key: "golem-idle", ...fr("golem_idle", 2, 2, -1) });
  a.create({ key: "golem-run", ...fr("golem_run", 4, 6, -1) });
  a.create({ key: "frostwolf-idle", ...fr("frostwolf_idle", 2, 2, -1) });
  a.create({ key: "frostwolf-run", ...fr("frostwolf_run", 4, 10, -1) });
  a.create({ key: "icegolem-idle", ...fr("icegolem_idle", 2, 2, -1) });
  a.create({ key: "icegolem-run", ...fr("icegolem_run", 4, 6, -1) });
  a.create({ key: "wraith-idle", ...fr("wraith_idle", 2, 3, -1) });
  a.create({ key: "wraith-run", ...fr("wraith_run", 4, 7, -1) });
  // 보스 3종 (guardian / behemoth / abysslord)
  a.create({ key: "boss-idle", ...fr("boss_idle", 2, 2, -1) });
  a.create({ key: "boss2-idle", ...fr("boss2_idle", 2, 2, -1) });
  a.create({ key: "boss3-idle", ...fr("boss3_idle", 2, 2, -1) });
  // v2.0 아뜰란티스 확장 몬스터 (v1.5 이관)
  a.create({ key: "swampbeast-idle", ...fr("swampbeast_idle", 2, 2, -1) });
  a.create({ key: "swampbeast-run", ...fr("swampbeast_run", 4, 7, -1) });
  a.create({ key: "emberwolf-idle", ...fr("emberwolf_idle", 2, 2, -1) });
  a.create({ key: "emberwolf-run", ...fr("emberwolf_run", 4, 10, -1) });
  a.create({ key: "firespirit-idle", ...fr("firespirit_idle", 2, 3, -1) });
  a.create({ key: "firespirit-run", ...fr("firespirit_run", 4, 8, -1) });
  a.create({ key: "runegolem-idle", ...fr("runegolem_idle", 2, 2, -1) });
  a.create({ key: "runegolem-run", ...fr("runegolem_run", 4, 6, -1) });
  a.create({ key: "helhound-idle", ...fr("helhound_idle", 2, 2, -1) });
  a.create({ key: "helhound-run", ...fr("helhound_run", 4, 10, -1) });
  // v2.0 아뜰란티스 신규 보스
  a.create({ key: "boss_nidhog-idle", ...fr("boss_nidhog_idle", 2, 2, -1) });
  a.create({ key: "boss_surt-idle", ...fr("boss_surt_idle", 2, 2, -1) });
  a.create({ key: "boss_fenrir-idle", ...fr("boss_fenrir_idle", 2, 2, -1) });
  a.create({ key: "boss_skoll-idle", ...fr("boss_skoll_idle", 2, 2, -1) });
  a.create({ key: "boss_gram-idle", ...fr("boss_gram_idle", 2, 2, -1) });
  a.create({ key: "boss_abudditos-idle", ...fr("boss_abudditos_idle", 2, 2, -1) });
  // 배치1 — 마을 모닥불 (Serene_Village campfire 32x32 4프레임)
  a.create({
    key: "sv-campfire",
    frames: [0, 1, 2, 3].map((f) => ({ key: "sv_campfire", frame: f })),
    frameRate: 6,
    repeat: -1,
  });
  // VFX — 참격 초승달 스윕(외부 애니), 차원문 소용돌이
  a.create({ key: "fx-slash", ...fr("slash", 6, 30, 0) });
  a.create({ key: "portal-spin", ...fr("portal", 8, 10, -1) });
  // 장식 이펙트
  a.create({ key: "flame-burn", ...fr("flame", 4, 8, -1) });
  a.create({ key: "sparkle", ...fr("sparkle", 2, 3, -1) });
}
