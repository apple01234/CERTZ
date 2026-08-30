import Phaser from "phaser";
import { buildAllAnims } from "../textures";

/**
 * 외부 에셋 로드 (public/assets/)
 *  그래픽:
 *   - Zelda-like (ArMM1998, CC0): 주인공/타일/장식/하트/? 마커/파편/불꽃
 *   - Kenney Tiny Dungeon & Roguelike & Particle Pack & Light Masks (CC0):
 *       고스트 하수인/나무/횃불/화살표/글로우·링·구슬·스코치/빛기둥
 *       + 물약·무기·방패·상인 NPC·금화 (2D MMORPG 기본 요소)
 *   - Weapon Slash - Effect (Cethiel, CC0): 참격 6프레임
 *   - Animated Portal (varkalandar, CC-BY 4.0): 차원문 8프레임
 *   - LPC Wolf (williamthompsonj, CC-BY): 늑대 / Sotrak Rewop (gilgaphoenixignis, CC-BY): 보스
 *  오디오:
 *   - Retro Game Music Pack (Juhani Junkala, CC0): BGM 3트랙 (title/field/boss)
 *   - OpenGameArt BGM 5트랙 (v1.2): TownTheme(cynicmusic CC0) / cave theme(HaelDB CC0)
 *     / snow theme(CC0) / Mystical Theme(Alexandr Zhelanov CC-BY 3.0) / Dark Descent(Matthew Pablo CC-BY 3.0)
 *   - 80 CC0 RPG SFX / creature SFX (Rubberduck, CC0): 효과음 12종
 *  절차 텍스처 생성은 없음 — 전부 실제 에셋.
 */

const ASSET_LIST = [
  // 타일
  "tile_grass",
  "tile_path",
  "tile_dark",
  "tile_snow",
  "tile_ice",
  "tile_cave",
  "tile_abyss",
  "tile_path_dark",
  // v2.0 아뜰란티스 확장 타일 (v1.5 이관)
  "tile_magma", "tile_magma_path", "tile_stone", "tile_hel",
  // 장식
  "tree",
  "pine",
  "pine_snow",
  "pine_dark",
  "torch",
  "rock",
  "rock_snow",
  "rock_dark",
  "rock_stone",
  "flower_r",
  "flower_y",
  "flower_w",
  // 주인공
  "hero_idle0", "hero_idle1", "hero_idle2", "hero_idle3",
  "hero_walk0", "hero_walk1", "hero_walk2", "hero_walk3",
  "hero_walkside0", "hero_walkside1", "hero_walkside2", "hero_walkside3",
  "hero_walkup0", "hero_walkup1", "hero_walkup2", "hero_walkup3",
  "hero_atk0", "hero_atk1", "hero_atk2", "hero_atk3",
  "hero_atkdown0", "hero_atkdown1", "hero_atkdown2", "hero_atkdown3",
  "hero_atkup0", "hero_atkup1", "hero_atkup2", "hero_atkup3",
  // 몬스터
  "wolf_idle0", "wolf_idle1",
  "wolf_run0", "wolf_run1", "wolf_run2", "wolf_run3",
  "wolf_atk0",
  "minion_idle0", "minion_idle1",
  "minion_run0", "minion_run1", "minion_run2", "minion_run3",
  "spider_idle0", "spider_idle1",
  "spider_run0", "spider_run1", "spider_run2", "spider_run3",
  "golem_idle0", "golem_idle1",
  "golem_run0", "golem_run1", "golem_run2", "golem_run3",
  "frostwolf_idle0", "frostwolf_idle1",
  "frostwolf_run0", "frostwolf_run1", "frostwolf_run2", "frostwolf_run3",
  "icegolem_idle0", "icegolem_idle1",
  "icegolem_run0", "icegolem_run1", "icegolem_run2", "icegolem_run3",
  "wraith_idle0", "wraith_idle1",
  "wraith_run0", "wraith_run1", "wraith_run2", "wraith_run3",
  // v2.0 아뜰란티스 확장 몬스터 (v1.5 이관)
  "swampbeast_idle0", "swampbeast_idle1",
  "swampbeast_run0", "swampbeast_run1", "swampbeast_run2", "swampbeast_run3",
  "emberwolf_idle0", "emberwolf_idle1",
  "emberwolf_run0", "emberwolf_run1", "emberwolf_run2", "emberwolf_run3",
  "firespirit_idle0", "firespirit_idle1",
  "firespirit_run0", "firespirit_run1", "firespirit_run2", "firespirit_run3",
  "runegolem_idle0", "runegolem_idle1",
  "runegolem_run0", "runegolem_run1", "runegolem_run2", "runegolem_run3",
  "helhound_idle0", "helhound_idle1",
  "helhound_run0", "helhound_run1", "helhound_run2", "helhound_run3",
  "boss_idle0", "boss_idle1",
  "boss2_idle0", "boss2_idle1",
  "boss3_idle0", "boss3_idle1",
  // v2.0 아뜰란티스 신규 보스 (니드호그/수르트/펜리르/스콜&하티/그람/아부디토스)
  "boss_nidhog_idle0", "boss_nidhog_idle1",
  "boss_surt_idle0", "boss_surt_idle1",
  "boss_fenrir_idle0", "boss_fenrir_idle1",
  "boss_skoll_idle0", "boss_skoll_idle1",
  "boss_gram_idle0", "boss_gram_idle1",
  "boss_abudditos_idle0", "boss_abudditos_idle1",
  // 퀘스트/이펙트 소스
  "fragment",
  "spark",
  "sparkle0", "sparkle1",
  "impact_star",
  "flame0", "flame1", "flame2", "flame3",
  // RPG 기본 요소 (2D MMORPG) — Kenney Tiny Dungeon/Roguelike CC0
  "item_coin",
  "item_potion_hp", "item_potion_mp",
  "item_weapon_1", "item_weapon_2", "item_weapon_3", "item_weapon_4",
  "item_armor_1", "item_armor_2", "item_armor_3", "item_armor_4",
  "npc_merchant",
  // 시작 마을 (인간들의 마을)
  "npc_villager1", "npc_villager2",
  "house_a", "house_b", "well",
  "npc_jobmaster", // 전직 관리관 (v1.5 이관)
  // 펫 (v1.9 BM)
  "pet_slime", "pet_pixie",
  // VFX (외부 에셋)
  "slash0", "slash1", "slash2", "slash3", "slash4", "slash5",
  "shock_ring",
  "ring",
  "glow",
  "orb",
  "scorch",
  "beam",
  "edge_arrow",
  "quest_mark",
  "portal0", "portal1", "portal2", "portal3",
  "portal4", "portal5", "portal6", "portal7",
  // v2.0 배치1 — 업로드 무료 에셋 팩 장식 (docs/ASSET_BATCH1.md — 사용자 지시 #10)
  "fm_tree1", "fm_tree2", "fm_tree3", "fm_tree4", "fm_shrub1",
  "fm_prop1", "fm_prop2", "fm_prop3",
  "ud_deadtree1", "ud_deadtree2", "ud_deadtree3", "ud_brokentree",
  "ud_grave1", "ud_grave2", "ud_grave3", "ud_skulls", "ud_bones",
  "cl_mflower", "cl_eyeplant", "cl_jawsplant", "cl_manyeyes", "cl_pustules", "cl_rock", "cl_bones",
] as const;

const AUDIO_LIST = [
  "bgm_title", "bgm_field", "bgm_boss",
  // 스테이지별 전용 BGM (v1.2 이관 — 사용자 지시 #7 BGM 다양화)
  "bgm_village", "bgm_alfheim", "bgm_cave", "bgm_snow", "bgm_abyss",
  "sfx_swing", "sfx_hit", "sfx_spin", "sfx_dash", "sfx_hurt",
  "sfx_pickup", "sfx_quest", "sfx_levelup", "sfx_portal",
  "sfx_roar", "sfx_die", "sfx_bossdie",
] as const;

/* 지형 전환 타일 세트/종류 (scripts/build_tile_transitions.py 생성) */
const TX_SETS = ["gp", "dp", "cp", "si", "ap"] as const;
const TX_KINDS = [
  "edge_dn", "edge_up", "edge_lt", "edge_rt",
  "bite_dn", "bite_up", "gvar1", "gvar2", "pvar",
] as const;

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload() {
    this.load.setPath("assets");
    for (const key of ASSET_LIST) this.load.image(key, `${key}.png`);
    // 마을 모닥불 (Serene Village 32x32 4프레임 — v1.5 이관)
    this.load.spritesheet("sv_campfire", "sv_campfire.png", { frameWidth: 32, frameHeight: 32 });
    // 지형 전환 타일 5세트 x 9종 (build_tile_transitions.py — 타일맵 경계 부자연 개선)
    for (const s of TX_SETS) for (const k of TX_KINDS) this.load.image(`tx_${s}_${k}`, `tx_${s}_${k}.png`);
    this.load.setPath("assets/audio");
    for (const key of AUDIO_LIST) this.load.audio(key, `${key}.ogg`);
  }

  create() {
    buildAllAnims(this);
    this.scene.start("title");
  }
}
