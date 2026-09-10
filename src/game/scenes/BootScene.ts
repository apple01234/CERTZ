import Phaser from "phaser";
import { buildAllAnims } from "../textures";
import { BGM_PRELOAD_TRACKS, SKILL_SFX_TRACKS } from "../audio";

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

/** v3.0.2 — 신규 외부 에셋 정의 (CC0) */
const X2_MONSTERS = [
  "x2_frog", "x2_rat", "x2_bat", "x2_firebird", "x2_frostfly",
  "x2_snail", "x2_stonegolem", "x2_darkhound", "x2_reeffish",
] as const;
/** v3.0.3 — 0x72 DungeonTileset II (itch.io) 신규 몬스터 7종 */
const X3_MONSTERS = [
  "x3_swampy", "x3_imp", "x3_icezombie", "x3_tinyzombie",
  "x3_ogre", "x3_chort", "x3_necromancer",
  /* v3.0.4 — itch.io 0x72 팩 추가 6종 (지시 #8 — itch.io 에셋 확대) */
  "x3_maskedorc", "x3_orcwarrior", "x3_orcshaman", "x3_wogol", "x3_goblin", "x3_bigzombie",
] as const;
/** [키, 시트폭, 프레임폭] — 프레임폭은 시트 높이와 동일 (가로 나열) */
const X2_SPELLS: [string, number, number][] = [
  ["x2_sp_arcane", 96, 16],
  ["x2_sp_magicorb", 96, 16],
  ["x2_sp_fireball", 96, 16],
  ["x2_sp_icelance", 64, 16],
  ["x2_sp_darkbolt", 96, 16],
  ["x2_sp_sparks", 96, 16],
];

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
  // v3.0.23 (#55) — 던전 벽 석벽 텍스처 (구 x2_bricks "검은 카펫" 교체)
  "wall_rock",
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
  // v2.2 실내 소품 (여관/내 집)
  "cv_candle",
  "sv_door",
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
  // v2.0 아뜰란티스 신규 보스 (니드호그/수르트/펜리르/스콜&하티/가름[구 그람]/아부디토스)
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
  // v2.5 신규 아이템 아이콘 (상급 물약/상위 장비/장신구/스크롤)
  "item_potion_hp2", "item_potion_mp2",
  "item_weapon_5", "item_weapon_6",
  "item_armor_5", "item_armor_6",
  "item_ring_crit", "item_ring_guard",
  "item_scroll_return", "item_scroll_warp",
  "item_scroll_star", // v3.0.7 — 강화 주문서
  "item_potion_elixir", // v3.0.20 (#7) — 엘릭서 (HP/MP 전부 회복)
  /* v1.0.8 무한 콘텐츠 — 제작 재료 아이콘 3종 (scripts/gen_mat_icons.py 픽셀아트) */
  "item_mat_mana", "item_mat_heart", "item_mat_mithril",
  "item_weapon_1", "item_weapon_2", "item_weapon_3", "item_weapon_4",
  "item_armor_1", "item_armor_2", "item_armor_3", "item_armor_4",
  "npc_merchant",
  /* 시작 마을 (인간들의 마을) — v4.1.8: 무료 플레이스홀더 npc_villager1/2·npc_jobmaster 제거,
   *  Unity 에셋스토어 유료 SPUM 캐릭터(spum_*)로 전면 교체 (아래 목록 참조) */
  "house_a", "house_b", "well",
  // 펫 (v1.9 BM)
  "pet_slime", "pet_pixie",
  // v3.0.6 — BM 상점 신규 아이콘 (에메랄드 전용)
  "pet_atlas", "cos_aurora", "ring_bless", "buff_king",
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
  /* v4.1.5 — Kenney Particle Pack (CC0) — v4.1.8: 조명 마스크(pk_light_01)만 유지,
   *  이펙트용 26종은 Unity 에셋스토어 유료 CFXR 텍스처로 전면 교체 (저품질 무료 이펙트 제거) */
  "pk_light_01",
  /* v4.1.7 — Unity Asset Store 유료 에셋 (유저 구매): Cartoon FX Remaster(JMO) + FireworksEffect2D
   *  레벨업 불꽃놀이·보스 룬 마법진/오라·타격 임팩트 등 프리미엄 VFX 텍스처 */
  "pfx_hit", "pfx_magic", "pfx_star", "pfx_runic", "pfx_aura",
  "pfx_ring", "pfx_elec", "pfx_skull", "pfx_fw_b", "pfx_fw_y",
  "pfx_heart", "pfx_spark_y",
  /* v4.1.8 — 유료 CFXR 애니메이션급 파티클 텍스처: 타격 임팩트/레벨업 별/사망 연기/
   *  포탈·수집 마법 별/카오스 잉걸불 화염 — Kenney 무료 이펙트 완전 대체 */
  "cfxr_impact", "cfxr_star", "cfxr_mstar", "cfxr_flamme",
  "cfxr_puff", /* v4.1.9 — 사망 연기 단일 패프 (구름 4장 시트 소형화, smoke 시트 대체) */
  /* v4.9.0 — 유저 제공 VFX 팩(Hovl Studio Magic effects) 신규 채택:
   *  rune_circle = 보스 등장 룬 마법진 / slash_arc = 회전베기 참격 궤적 오버레이 */
  "rune_circle", "slash_arc",
  /* v4.1.8 — Unity 에셋스토어 유료 SPUM 캐릭터: Unity 프리팹을 정밀 파싱해 조합한
   *  프리미엄 픽셀 NPC 14종 — 챕터 마을 주민/상점/직업교관 비주얼 전면 업그레이드 */
  "spum_villager_m", "spum_villager_f", "spum_knight", "spum_elf", "spum_mage",
  "spum_skel", "spum_devil", "spum_smith", "spum_miner", "spum_fisher",
  "spum_forager", "spum_scout", "spum_mystic", "spum_butler",
] as const;

const AUDIO_LIST: string[] = [
  /* v3.0.24 — BGM은 타이틀 1곡만 프리로드 (나머지 39트랙은 구역 진입 시 지연 로딩 —
   *  풀버전 q4 재인코딩과 함께: 부트 디코드 시간 단축 + WebAudio PCM 수 GB 크래시 방지) */
  ...BGM_PRELOAD_TRACKS,
  "sfx_swing", "sfx_hit", "sfx_spin", "sfx_dash", "sfx_hurt",
  "sfx_pickup", "sfx_quest", "sfx_levelup", "sfx_portal",
  "sfx_roar", "sfx_die", "sfx_bossdie",
  /* v4.1.7 — Unity Asset Store 유료 SFX (Fantasy UI SFX) 전용음 8종:
   *  코인/물약/장착/강화는 타 음원 피치변주 대용 → 실제 정체성 음원으로 승격 */
  "sfx_coin", "sfx_potion", "sfx_equip", "sfx_upgrade",
  "sfx_click", "sfx_open", "sfx_close", "sfx_ach",
  /* v3.0.24 — 직업별 스킬 전용 효과음 27종 (효과음연구소) */
  ...SKILL_SFX_TRACKS,
];

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
    for (const key of ASSET_LIST) this.load.image(key, `${key}.webp`);
    /* v1.0.7 — SPUM식 코스튬 프레임 4종×28 + 포니테일 (scripts/gen_outfits.py 생성 —
     *  hero_* 프레임의 의상 픽셀만 재색상화, 피부/머리카락/외곽선 보호 — 총 31KB) */
    for (const key of ASSET_LIST) {
      if (!key.startsWith("hero_")) continue;
      const f = key.slice(5);
      for (const s of ["royal", "shadow", "spring", "navy"]) {
        this.load.image(`outfit_${s}_${f}`, `outfit_${s}_${f}.webp`);
      }
    }
    this.load.image("hair_ponytail", "hair_ponytail.webp");
    /* v1.0.7 — 프리렌더 3D VFX 추가 (Hovl Studio Magic effects · UNI VFX — 연구용 원본 재확보분,
     *  유니티 3D 파이프라인 프리렌더 텍스처 → 2D 스프라이트. 보스 격파/각성 의식 등 희소 고급스 순간 전용) */
    this.load.image("hv_slash", "hv_slash.webp");
    this.load.image("hv_flash", "hv_flash.webp");
    this.load.image("uni_boom", "uni_boom.webp");
    /* v1.0.10 — GameStudio FX: Vefects(Unity 3D VFX) 프리렌더 25종 — 4차/5차 스킬 강화 +
     *  전투 상시 연출 (펜타클/원소 플레어/링/엠블럼/화이트 제네릭). scripts/gen_vfx_v1010.py 산출 */
    for (const t of [
      "vf_pentacle", "vf_penta_fire", "vf_penta_elec", "vf_penta_dark", "vf_penta_ice",
      "vf_flare_fire", "vf_flare_elec", "vf_flare_dark", "vf_flare_ice", "vf_flare_nature",
      "vf_flare_void", "vf_flare_water", "vf_flare_earth",
      "vf_ring_void", "vf_ring_fire", "vf_emb_fire", "vf_emb_void", "vf_emb_nature", "vf_emb_sound",
      "vf_slash", "vf_impact", "vf_ring", "vf_lightning", "vf_star", "vf_arrow",
    ]) this.load.image(t, `${t}.webp`);
    /* v3.0.2 — 외부 신규 에셋 (전부 CC0, CREDITS.md 참조)
     *  50 Monsters Pack (isaiah658): 신규 몬스터 9종 × idle2/run4/atk1 프레임
     *  Pixelart Spells (Anokolisa?): 마법 투사체 6프레임 시트
     *  4-Color Dungeon Bricks (LOSCH): 던전 벽 벽돌 타일
     *  Bow 20x20 (CoolNav.js): 궁수 활 */
    for (const k of X2_MONSTERS) {
      for (const f of ["idle0", "idle1", "run0", "run1", "run2", "run3", "atk0"]) {
        this.load.image(`${k}_${f}`, `${k}_${f}.webp`);
      }
    }
    /* v3.0.3 — 0x72 DungeonTileset II (itch.io, CC0): 신규 몬스터 7종 idle4/run4/atk1
     *  + 무기 스프라이트 (활/지팡이/단검/표창) + GM NPC */
    for (const k of X3_MONSTERS) {
      for (const f of ["idle0", "idle1", "idle2", "idle3", "run0", "run1", "run2", "run3", "atk0"]) {
        this.load.image(`${k}_${f}`, `${k}_${f}.webp`);
      }
    }
    for (const k of ["x3_bow", "x3_staff", "x3_dagger", "x3_shuriken", "npc_gm"]) {
      this.load.image(k, `${k}.webp`);
    }
    for (const [k, w, h] of X2_SPELLS) this.load.spritesheet(k, `${k}.webp`, { frameWidth: h, frameHeight: h });
    for (const k of ["x2_arrow", "x2_arrow_green", "x2_arrow_sky", "x2_bricks", "x2_bow"]) this.load.image(k, `${k}.webp`); // v3.0.16 — 데드아이 초록 화살 · v3.0.20 — 스카이로드 구름색 화살
    // 마을 모닥불 (Serene Village 32x32 4프레임 — v1.5 이관)
    this.load.spritesheet("sv_campfire", "sv_campfire.webp", { frameWidth: 32, frameHeight: 32 });
    /* v3.0.8 디자인 개편 — Warped Shooting Fx / Cartoon FX Remaster 신규 VFX 시트 */
    const VFX2: [string, number, number][] = [
      ["vfx2_bolt", 48, 32], ["vfx2_charged", 63, 48],
      ["vfx2_hit1", 96, 96], ["vfx2_hit3", 96, 96], ["vfx2_hit5", 96, 96],
      ["vfx2_pulse", 64, 32], ["vfx2_wspark", 64, 32],
      ["vfx2_elec", 128, 128], ["vfx2_tri", 128, 128], ["vfx2_cfx1", 128, 128],
    ];
    for (const [k, w, h] of VFX2) this.load.spritesheet(k, `${k}.webp`, { frameWidth: w, frameHeight: h });
    for (const k of ["vfx2_boom", "vfx2_blood"]) this.load.image(k, `${k}.webp`);
    /* v3.0.11 — 토네이도 전용 스프라이트 (gen_tornado_fx.py — 스카이로드 폭풍 소용돌이/천공의 폭풍) */
    this.load.spritesheet("fx_tornado", "fx_tornado.webp", { frameWidth: 64, frameHeight: 64 });
    /* v4.7.0 — Cainos 상자 개봉 애니 (가방 개봉/BM 구매/광고 상자 공용 연출) */
    this.load.spritesheet("chest_anim", "chest_anim.webp", { frameWidth: 64, frameHeight: 64 });
    // 지형 전환 타일 5세트 x 9종 (build_tile_transitions.py — 타일맵 경계 부자연 개선)
    for (const s of TX_SETS) for (const k of TX_KINDS) this.load.image(`tx_${s}_${k}`, `tx_${s}_${k}.webp`);
    this.load.setPath("assets/audio");
    for (const key of AUDIO_LIST) this.load.audio(key, `${key}.ogg`);
  }

  async create() {
    buildAllAnims(this);
    /* v4.1.5 — Galmuri 픽셀 폰트 로딩 대기 (최대 2.5초 폴백).
     *  Phaser 캔버스 텍스트(데미지 숫자/배너/월드 라벨)가 Galmuri로 렌더되려면
     *  씬 시작 전 document.fonts 로드 완료가 필요하다. 실패해도 sans-serif 폴백. */
    try {
      if (typeof document !== "undefined" && document.fonts) {
        await Promise.race([
          Promise.all([
            document.fonts.load('400 22px Galmuri11'),
            document.fonts.load('700 22px Galmuri11'),
            document.fonts.load('400 18px Galmuri9'),
            document.fonts.load('400 30px Galmuri14'),
          ]),
          new Promise((r) => setTimeout(r, 2500)),
        ]);
      }
    } catch {
      /* 폰트 로드 실패 — 기본 폰트로 계속 */
    }
    this.scene.start("title");
  }
}
