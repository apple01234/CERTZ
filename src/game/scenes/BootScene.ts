import Phaser from "phaser";
import { buildVfxTextures, buildAllAnims } from "../textures";

/**
 * 실제 픽셀아트 에셋 로드 (public/assets/)
 *  - Zelda-like (ArMM1998, CC0): 주인공/타일/장식/이펙트 소스/하트
 *  - Kenney Tiny Dungeon & Roguelike (CC0): 고스트 하수인/나무/횃불
 *  - LPC Wolf (williamthompsonj, CC-BY): 늑대
 *  - Sotrak Rewop (gilgaphoenixignis, CC-BY): 보스
 * 로드 후 참격/빛기둥 등 런타임 VFX만 절차 생성한다.
 */

const ASSET_LIST = [
  // 타일
  "tile_grass",
  "tile_path",
  "tile_dark",
  // 장식
  "tree",
  "pine",
  "torch",
  "rock",
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
  "boss_idle0", "boss_idle1",
  // 퀘스트/이펙트 소스
  "fragment",
  "spark",
  "sparkle0", "sparkle1",
  "impact_star",
  "flame0", "flame1", "flame2", "flame3",
] as const;

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload() {
    this.load.setPath("assets");
    for (const key of ASSET_LIST) this.load.image(key, `${key}.png`);
  }

  create() {
    buildVfxTextures(this);
    buildAllAnims(this);
    this.scene.start("title");
  }
}
