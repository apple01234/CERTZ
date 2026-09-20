import Phaser from "phaser";
import { buildAllAnims } from "../textures";
import { CORE_BODY_PREFIXES } from "../data";
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

/** v1.3.0 (#에셋통합) — 유저 Drive 팩 변환산출 VFX 텍스처 58종 (public/assets/vfx2/).
 *  전투 타격감(참격/크리/폭발)·오라 링·번개·마법진·불꽃놀이·원소 이펙트.
 *  scripts/prep_drive_assets.py — Matthew Guz Slash·GameVFX Buff·Vefects Anime·
 *  Hovl Magic·UNI VFX·CartoonVFX Fireworks·Cherry Petals에서 선별 변환. */
export const VFX3_LIST = [
  /* Matthew Guz Slash Effects FREE — 근접 타격감 */
  "vfx_slash", "vfx_slash_m", "vfx_slash_turn", "vfx_crit", "vfx_explosion",
  "vfx_shock", "vfx_fire", "vfx_spark",
  /* GameVFX Buff Collection — 오라/버프/번개 */
  "vfx_bolt", "vfx_bolt2", "vfx_flare", "vfx_twinkle", "vfx_star4",
  "vfx_ring", "vfx_arc", "vfx_hex", "vfx_glowb", "vfx_glowy", "vfx_furnace",
  /* Vefects Anime Stylized VFX — 스킬 임팩트/파티클 */
  "vfx_ist", "vfx_is2", "vfx_ltn1", "vfx_ltn2", "vfx_ltn3",
  "vfx_cl1", "vfx_cl2", "vfx_cl3",
  "vfx_pt1", "vfx_pt2", "vfx_pt3", "vfx_pt4", "vfx_pt5", "vfx_pt6", "vfx_pt7", "vfx_pt8",
  "vfx_ring1", "vfx_ring3", "vfx_flower", "vfx_arrowp",
  /* Hovl Studio Magic effects — 마법진/원소 */
  "vfx_magic", "vfx_magic2", "vfx_snow", "vfx_splat", "vfx_heal_heart",
  "vfx_crystal", "vfx_proj", "vfx_flash",
  /* UNI VFX Missiles & Explosions — 폭발/별 */
  "vfx_starry", "vfx_shockf", "vfx_expc", "vfx_wisp",
  /* CartoonVFX9X Fireworks — 축하 연출(레벨업/랭킹) */
  "vfx_fw_heart", "vfx_fw_moon", "vfx_fw_star_b", "vfx_fw_star_y", "vfx_fw_tri", "vfx_fw_smile",
  /* Cherry Petals — 봄 시즌 연출용 */
  "vfx_petal",
] as const;

/** v1.3.0 — Drive 팩 VFX 사운드 48종 (Vefects WAV → OGG 변환, public/assets/audio/sfx/) */
export const SFX3_LIST = [
  "sfx_hit_basic", "sfx_arrow_cast", "sfx_arrow_hit", "sfx_bomb_cast", "sfx_bomb_exp",
  "sfx_fire_cast", "sfx_fire_hit", "sfx_bolt_cast", "sfx_bolt_hit", "sfx_heal_cast",
  "sfx_buff_cast", "sfx_debuff_cast", "sfx_dash2", "sfx_pickup2", "sfx_explosion", "sfx_explosion_ice",
  "sfx_aoe_fire_cast", "sfx_aoe_fire_burst", "sfx_aoe_ice_cast", "sfx_aoe_ice_burst",
  "sfx_aoe_light_cast", "sfx_aoe_light_burst", "sfx_aoe_dark_cast", "sfx_aoe_dark_burst",
  "sfx_aoe_elec_cast", "sfx_aoe_elec_burst", "sfx_aoe_earth_cast", "sfx_aoe_earth_burst",
  "sfx_aoe_water_cast", "sfx_aoe_water_burst", "sfx_aoe_poison_cast", "sfx_aoe_poison_burst",
  "sfx_aoe_void_cast", "sfx_aoe_void_burst", "sfx_aoe_heal_cast", "sfx_aoe_heal_burst",
  "sfx_aoe_nature_cast", "sfx_aoe_nature_burst", "sfx_aoe_magma_burst", "sfx_aoe_crystal_burst",
  "sfx_aoe_blood_burst", "sfx_aoe_air_burst",
  "sfx_smoke_fire", "sfx_smoke_snow", "sfx_smoke_thunder", "sfx_smoke_toxic", "sfx_smoke_gold", "sfx_smoke_dark",
] as const;

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
  /* v1.3.0 (#5 오라 강화) — 유저 지시 "캐시상점에서 산 오로라류 아이템 작동안함"의 본질:
   *  기존 오라가 너무 미약해 착용해도 인지 불가였다. GameVFX/Hovl Studio 실사운 에셋으로
   *  룬 서클+링+궤도 위스프를 깔아 "착용 즉시 보이는" 오라로 재탄생 */
  "aura_ring",   // GameVFX Buff Collection — 흰 링 (틴트용)
  "aura_circle", // Hovl Studio Magic Effects — 매직 서클 (발판 룬)
  "aura_wisp",   // GameVFX — 글로우 볼 (궤도 위스프)
  "aura_glow2",  // GameVFX — 청 글로우 (발광 보강)
  /* v1.3.0 (#8 에셋 활용) — Vefects/Hovl/PixelFX/Cainos/Petal 3대 팩 선별 텍스처 */
  "vfx3_impact",  // Vefects — 크리티컬 별burst
  "vfx3_ring",    // Vefects — 레벨업 링
  "vfx3_slash",   // Vefects — 참격 플래시
  "vfx3_heart",   // Hovl — 회복 하트
  "vfx3_flower",  // Vefects — 수집 꽃
  "vfx3_flare",   // Hovl — 발사체 글로우
  "px_fire0", "px_fire1", "px_fire2", "px_fire3", "px_fire4",           // PixelFX — 모닥불 화염
  "cainos_water0", "cainos_water1", "cainos_water2", "cainos_water3",   // Cainos — 분수 물 튀김
  "petal0",        // Petal Particles — 벚꽃잎
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
  /* v1.3.0 — VFX3_LIST(58종)/map 타일셋 6종은 preload에서 별도 setPath 로드 (vfx2/·map/ PNG) */
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

  /* v1.0.20 — 부팅 로딩 화면 (유저 지시: "검은화면 뜨는 버그 없애").
   *  기존엔 preload 동안 화면이 순수 검정이라 — 특히 APK 콜드스타트에서 수 초간
   *  "검은 화면 = 고장"으로 보였다. 게임형 로딩 화면(로고+진행바+팁)을 즉시 렌더해
   *  부팅 구간이 결코 검게 보이지 않게 한다. Scale.RESIZE 대응 리레이아웃 포함. */
  private bootUi?: {
    rebuild: () => void;
    destroy: () => void;
  };

  private buildLoadingUi() {
    const gold = 0xe8c064;
    const wood = 0x7a5a2e;
    const container = this.add.container(0, 0).setDepth(10).setScrollFactor(0);

    const rebuild = () => {
      container.removeAll(true);
      const W = this.cameras.main.width;
      const H = this.cameras.main.height;
      /* 배경 — 밤하늘 네이비 (게임 배경색과 동일 계열) */
      container.add(this.add.rectangle(0, 0, W, H, 0x0d1424).setOrigin(0));
      /* 로고 */
      container.add(
        this.add
          .text(W / 2, H * 0.34, "SERTZ", {
            fontFamily: "Galmuri14, Galmuri11, sans-serif",
            fontSize: `${Math.max(34, Math.round(W * 0.07))}px`,
            color: "#ffd98a",
            fontStyle: "bold",
          })
          .setOrigin(0.5)
          .setStroke("#3a2508", Math.max(6, Math.round(W * 0.012)))
          .setShadow(0, 5, "#000000", 0, true, true),
      );
      container.add(
        this.add
          .text(W / 2, H * 0.34 + Math.max(30, Math.round(W * 0.055)), "이그드라실 : 아홉 왕국", {
            fontFamily: "Galmuri11, sans-serif",
            fontSize: `${Math.max(12, Math.round(W * 0.02))}px`,
            color: "#cbb88a",
          })
          .setOrigin(0.5),
      );
      /* 진행바 프레임 (우드 프레임 + 금 채움) — 채움은 progress 핸들러가 갱신 */
      const barW = Math.min(340, W * 0.6);
      const barH = 18;
      const barY = H * 0.58;
      container.add(this.add.rectangle(W / 2, barY, barW + 8, barH + 8, wood).setStrokeStyle(2, 0x241a0d));
      const fill = this.add.rectangle(W / 2 - barW / 2, barY, 1, barH, gold).setOrigin(0, 0.5); // v1.1.0 (#14) — originY 0.5: 채움 바가 프레임 세로 중앙에 정렬 (기존 9px 하강/돌출 버그)
      container.add(fill);
      container.add(
        this.add
          .text(W / 2, barY + barH + 16, "모험의 세계를 불러오는 중…", {
            fontFamily: "Galmuri9, sans-serif",
            fontSize: "11px",
            color: "#8a97b8",
          })
          .setOrigin(0.5),
      );
      this.load.on("progress", (p: number) => {
        if (!fill.active) return; // resize로 파괴된 이전 채움 — 무시
        fill.width = Math.max(2, barW * p);
      });
      /* v1.4.0 (Task 0-1 검은화면 원인 제거) — 에셋 로드 실패를 명시 처리:
       *  실패 파일을 조용히 건너뛰고(게임은 폴백 외형/사운드로 기동) 로더가
       *  완료 신호를 반드시 내도록 보장 — "로딩 중 검은 화면 영구 정지" 원천 차단 */
      this.load.on("loaderror", (file: { key?: string; url?: string }) => {
        console.warn("[SERTZ] 에셋 로드 실패 — 건너뜀:", file?.key ?? file?.url ?? "unknown");
      });
    };
    rebuild();

    /* 로딩 팁 — 1.6초마다 순환 (전직 시스템 안내 포함) */
    const TIPS = [
      "마을의 룬 정령 이그니와 대화해 첫 퀘스트를 시작하자",
      "Lv 10이 되면 전직관의 카이엔에게 1차 전직 시련을 의뢰하자",
      "물약은 D/F 키 — 설정에서 키 배치를 바꿀 수 있다",
      "보스전이 어두우면 설정에서 셰이더 강도를 조절하자",
      "유니온에 캐릭터를 배치하면 계정 전체에 힘이 실린다",
    ];
    let tipIdx = Math.floor(Math.random() * TIPS.length);
    const tipText = this.add
      .text(this.cameras.main.width / 2, this.cameras.main.height * 0.72, "", {
        fontFamily: "Galmuri9, sans-serif",
        fontSize: "11px",
        color: "#6f7d9c",
        wordWrap: { width: this.cameras.main.width * 0.8 },
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(11)
      .setScrollFactor(0);
    const showTip = () => {
      tipText.setText(`TIP — ${TIPS[tipIdx % TIPS.length]}`);
      tipIdx++;
    };
    showTip();
    const tipTimer = this.time.addEvent({ delay: 1600, loop: true, callback: showTip });

    const onResize = () => {
      rebuild();
      tipText.setPosition(this.cameras.main.width / 2, this.cameras.main.height * 0.72);
      tipText.setWordWrapWidth(this.cameras.main.width * 0.8);
    };
    this.scale.on("resize", onResize);

    this.bootUi = {
      rebuild,
      destroy: () => {
        this.scale.off("resize", onResize);
        tipTimer.remove();
        tipText.destroy();
        container.destroy();
        this.load.off("progress");
      },
    };
  }

  preload() {
    /* v1.0.20 — 로딩 UI를 에셋 로드 시작 "직전"에 띄운다 (검은 화면 구간 0) */
    this.buildLoadingUi();
    this.load.setPath("assets");
    for (const key of ASSET_LIST) this.load.image(key, `${key}.webp`);
    /* v1.1.0 (#1/#19/#21/#22) — 외형 시스템: 여성(chf)/피부(chm) 변형 11종 + SPUM식 코스튬 완전교체(cost_*) 10종 × 28프레임
     *  + 어태치 장식 5종 (scripts/gen_char_system.py 산출). 구 outfit_* 재색상 오버레이는 폐기(미로드)
     *  v1.2.1 (#4 최적화 x3) — 부팅 분할 로드: 기본 성별/피부 시트(11종·308프레임)만 즉시 로드.
     *  코스튬/직업/GM 시트 37종(≈1036프레임)은 TitleScene 백그라운드 로드로 이관 —
     *  모바일 첫 부팅 로드 요청이 절반 이하로 줄고 로딩바가 훨씬 빨리 끝난다. */
    const heroFrames = ASSET_LIST.filter((k) => k.startsWith("hero_")).map((k) => k.slice(5));
    for (const p of CORE_BODY_PREFIXES) {
      for (const f of heroFrames) this.load.image(`${p}_${f}`, `${p}_${f}.webp`);
    }
    /* v1.2.0 (#1) — 포니테일 4종 로드 제거(아이템 폐지) · 무지개 오라 아이콘 + 어태치 장식은 유지 */
    for (const t of ["acc_crown", "acc_ribbon", "acc_halo", "acc_wings_devil", "acc_wings_fairy", "acc_cape_crimson", "acc_cape_royal", "i_cos_rainbow"]) {
      this.load.image(t, `${t}.webp`);
    }
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
    /* v1.0.11 — Gameworks Unity 팩 프리렌더 (Hovl Studio Magic effects · Matthew Guz Slash ·
     *  유저 업로드 file3). 기존 스킬 N차 강화 + 튜토리얼 축하 연출.
     *  scripts/gen_gameworks_v1011.py 산출 (512 캡 q82, 총 512K)
     *  v1.0.13 — gw_petal(벚꽃잎) 로드 제거 — 유저 지시 "벚꽃 그냥 없애" (연출 전면 철수) */
    for (const t of [
      "gw_magic", "gw_rune", "gw_tech", "gw_electro", "gw_flare", "gw_flash", "gw_glow",
      "gw_arc", "gw_crack", "gw_trail", "gw_arrow", "gw_proj", "gw_crystal", "gw_crater",
      "gw_slash_a", "gw_slash_b", "gw_slash_c", "gw_dash", "gw_shock", "gw_boom",
      "gw_spark", "gw_crit", "gw_fire", "gw_dot",
      /* v1.0.12 — Toon Shaders Pro 팩(유저 Drive 업로드) 2차 투입: 눈보라 날씨 + 크리티컬 스플랫
       * v1.0.13 — 벚꽃 날씨(wx_petal) 제거 — 유저 지시 "벚꽃 그냥 없애" (메모리·용량 절감) */
      "wx_snowflake", "wx_splat", "wx_crater", "wx_crack", "wx_smoke", "wx_spark5",
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
    /* v1.3.0 (#에셋통합) — Drive 팩 VFX 사운드 48종 + 텍스처 58종 (scripts/prep_drive_assets.py) */
    this.load.setPath("assets/vfx2");
    for (const key of VFX3_LIST) this.load.image(key, `${key}.png`);
    this.load.setPath("assets/audio/sfx");
    for (const key of SFX3_LIST) this.load.audio(key, `${key}.ogg`);
    /* v1.3.0 (#층식맵) — Cainos 타일셋 애니 자산은 스프라이트시트로 재로드 (이미지 로드는 덮어쓰기 방지)
     *  map_torch = 128×128 16px 8×8=64프레임 횃불 불꽃 / map_chest = 512×512 64px 8×5=32프레임 상자 */
    this.load.setPath("assets/map");
    this.load.spritesheet("map_torch_f", "map_torch.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("map_chest_f", "map_chest.png", { frameWidth: 64, frameHeight: 64 });
    /* v1.3.0 — 층식맵 타일셋 이미지 2종 (buildLayeredKeep: map_ground 바닥 타일 크롭 + map_props 난간/기둥)
     *  + 예비 장식 2종 (map_flame·map_bubble — 현재 미사용, 추측 확장용) */
    this.load.image("map_ground", "map_ground.png");
    this.load.image("map_props", "map_props.png");
    this.load.image("map_flame", "map_flame.png");
    this.load.image("map_bubble", "map_bubble.png");
  }

  async create() {
    /* v1.0.20 — 타이틀로 넘어가기 전 로딩 UI 정리 (검은 화면 잔상 방지) */
    this.bootUi?.destroy();
    this.bootUi = undefined;
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
