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
 *   - Retro Game Music Pack (Juhani Junkala, CC0): BGM 3트랙
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
  // 장식
  "tree",
  "pine",
  "pine_snow",
  "pine_dark",
  "torch",
  "rock",
  "rock_snow",
  "rock_dark",
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
  "boss_idle0", "boss_idle1",
  "boss2_idle0", "boss2_idle1",
  "boss3_idle0", "boss3_idle1",
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
] as const;

const AUDIO_LIST = [
  "bgm_title", "bgm_field", "bgm_boss",
  "sfx_swing", "sfx_hit", "sfx_spin", "sfx_dash", "sfx_hurt",
  "sfx_pickup", "sfx_quest", "sfx_levelup", "sfx_portal",
  "sfx_roar", "sfx_die", "sfx_bossdie",
  /* 효과음연구소·小森平 효과음 통합 — 전용음 신설 (기존 타키 재사용 매핑 독립화) */
  "sfx_crit", "sfx_coin", "sfx_potion", "sfx_equip", "sfx_upgradeOk", "sfx_upgradeFail",
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
