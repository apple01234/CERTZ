/**
 * classFxProfiles.ts — 직업 35종 + 몬스터 원소 9종의 pixel FX 정체성 테이블
 *
 * [왜 이 파일이 필요한가]
 *  기존 `StudioFX.ts` 는 **계열 5종**(warrior/ranger/mage/thief/pirate)으로만 분기했다.
 *  그런데 실제 직업은 35개다(`classes.ts:483 CLASSES`, 5계열 × 1~4차).
 *  같은 계열 안에서도 정체성이 정반대인 쌍이 많다:
 *    · warbringer(광전사·참격) vs crusader(성기사·심판의 빛)
 *    · arclord(아르카나·크리스탈) vs eternal(시간·룬)
 *    · seaking(해신·물) vs dreadnought(중갑·포격)
 *  계열 5색으로 뭉뚱그리면 이 구분이 사라진다.
 *
 * [설계 원칙]
 *  ① **계열 시스템을 대체하지 않는다.** `StudioFX` 의 계열 분기는 그대로 base 로 남기고,
 *     이 테이블은 그 위에 얹는 "악센트 레이어"다. 계열 함수 시그니처는 무변경.
 *  ② **이미 로드된 키만 쓴다.** 모든 키는 BootScene 로드 목록에서 실측 확인했다.
 *     미로드 키는 Phaser 가 `__MISSING`(검은 사각형)으로 그리는 실제 버그 이력이 있어
 *     (`WorldScene.ts:3226-3229` 주석 참조), 소비 측에서 반드시 `textures.exists` 로 거른다.
 *  ③ **여기엔 데이터만 둔다.** 스폰/트윈 코드는 `StudioFX.classFx.ts` 가 담당한다.
 *
 * [검증된 에셋 출처]
 *  · `vfx/`    19종 — `BootScene.ts:782-788`  (`vf_*`, fx_aura, fx_glow…)
 *  · `fx2/`     8종 — `BootScene.ts:170-173`   (fx_Circle2, fx_Electro, fx_FlashFree*)
 *  · `vfx2/`   58종 — `BootScene.ts:884`       (vfx_bolt, vfx_ring3, vfx_hex…)  *.png
 *  · `vfx3/`   81종 — `BootScene.ts:825-833`   (gvb_*, gvu_*)
 *  · `gw_*`    24종 — `BootScene.ts:793-801`
 *  · `hv2_*`/`mg_*` — `BootScene.ts:897-909`
 */

/** 계열 키 — `classes.ts:familyOf()` 가 돌려주는 값과 동일 */
export type FamKey = "warrior" | "ranger" | "mage" | "thief" | "pirate";

/**
 * 직업 1종의 FX 정체성.
 *  accent : 계열 공통 연출 **위에** 얹는 고유 악센트 텍스처 1~2개
 *  shape  : 악센트의 움직임 형태 — 같은 텍스처라도 궤적이 다르면 다르게 읽힌다
 *  tint   : 계열색을 덮어쓸 때만 지정 (미지정이면 직업 고유색 hex 사용)
 */
export type ClassFxProfile = {
  /** 주 악센트 텍스처 키 (반드시 로드된 키) */
  accent: string;
  /** 보조 악센트 (선택) */
  accent2?: string;
  /** 악센트 움직임 */
  shape: "slash" | "burst" | "ring" | "beam" | "orbit" | "pillar" | "shard" | "wave";
  /** 악센트 강도 배율 — 1.0 기준. 계열 base 위에 곱해진다 */
  weight: number;
  /** 계열색 대신 쓸 고유 틴트 (선택) */
  tint?: number;
};

/**
 * 35직업 전수 매핑.
 * 각 항목 주석의 괄호는 `classes.ts` 의 직업 설명에서 딴 정체성 한 줄이며,
 * 그 정체성에 맞는 **의미가 다른** 텍스처를 골랐다(같은 계열 안 중복 최소화).
 */
export const CLASS_FX: Record<string, ClassFxProfile> = {
  /* ══════ 전사 (warrior) — 묵직함·충격·대지 ══════ */
  // 대검 회전베기 — 광범위 참격
  warrior: { accent: "vfx_slash_m", accent2: "vfx_shock", shape: "slash", weight: 1.0 },
  // 광란 — 연쇄 폭발, 붉은 기세
  berserker: { accent: "vfx_explosion", accent2: "vfx_splat", shape: "burst", weight: 1.05, tint: 0xff7a5a },
  // 수호 — 방패/성역, 기둥
  guardian: { accent: "gvb_shield_hex", accent2: "vfx_ring1", shape: "pillar", weight: 0.95, tint: 0xffe9a0 },
  // 전장의 지배자 — 대지 강타
  warlord: { accent: "mg_shock0", accent2: "vfx_shock", shape: "ring", weight: 1.1 },
  // 성기사 — 성광, 확장 링
  paladin: { accent: "gvb_star4", accent2: "vfx_ring1", shape: "ring", weight: 1.0, tint: 0xfff4c8 },
  // 천멸극 — 십자 참격의 극
  warbringer: { accent: "vfx_slash_turn", accent2: "gvu_shockwave_fiery", shape: "slash", weight: 1.25, tint: 0xffb08a },
  // 성흔극 — 심판의 빛, 수직 성광
  crusader: { accent: "vfx_flash", accent2: "gvb_lensflare", shape: "pillar", weight: 1.2, tint: 0xfff4c8 },

  /* ══════ 궁수 (ranger) — 정밀·질풍·관통 ══════ */
  // 정밀 사격
  ranger: { accent: "vfx_crit", accent2: "vfx_arc", shape: "beam", weight: 1.0 },
  // 저격 — 단일 관통
  sniper: { accent: "vfx_bolt", accent2: "vfx_crit", shape: "beam", weight: 1.05, tint: 0xffe66a },
  // 질풍 — 회오리 기동
  windrunner: { accent: "vfx_arc", accent2: "vfx_ring", shape: "orbit", weight: 0.95, tint: 0x9dffc4 },
  // 독수리의 눈 — 다중 조준
  eagleeye: { accent: "vfx_arrowp", accent2: "vfx_crit", shape: "beam", weight: 1.1 },
  // 폭풍 — 광역 돌풍
  tempest: { accent: "vfx_cl1", accent2: "vfx_ring3", shape: "orbit", weight: 1.1, tint: 0x9fd8ff },
  // 신시극 — 궁극의 관통, 혜성 궤적
  deadeye: { accent: "vfx_bolt2", accent2: "gvb_star4", shape: "beam", weight: 1.25, tint: 0xffe66a },
  // 궁극 폭풍 — 하늘의 폭풍
  skylord: { accent: "vfx_cl1", accent2: "vfx_twinkle", shape: "orbit", weight: 1.2, tint: 0x9fd8ff },

  /* ══════ 마법사 (mage) — 비전·룬·시간 ══════ */
  // 냉기 마법
  mage: { accent: "vfx_hex", accent2: "vfx_twinkle", shape: "orbit", weight: 1.0, tint: 0xc08aff },
  // 대마법사 — 다중 술식
  archmage: { accent: "vfx_magic", accent2: "vfx_ring3", shape: "orbit", weight: 1.1, tint: 0xc08aff },
  // 현자 — 치유와 빛의 장막
  sage: { accent: "vfx_glowy", accent2: "vfx_ring1", shape: "ring", weight: 0.95, tint: 0xfff4c8 },
  // 폭풍소환사 — 뇌운
  stormbringer: { accent: "gvb_lightning_blue", accent2: "vfx_twinkle", shape: "burst", weight: 1.15, tint: 0x8cdfff },
  // 연대기 — 기록/시간
  chronicle: { accent: "vfx_hex", accent2: "vfx_twinkle", shape: "orbit", weight: 1.05, tint: 0x7de8ff },
  // 아르카나 — 크리스탈 붕괴
  arclord: { accent: "vfx_crystal", accent2: "vfx_ring3", shape: "shard", weight: 1.25, tint: 0xc08aff },
  // 영원의 고리 — 시간 왜곡
  eternal: { accent: "vfx_twinkle", accent2: "vfx_hex", shape: "orbit", weight: 1.2, tint: 0x7de8ff },

  /* ══════ 도적 (thief) — 그림자·암습·난도 ══════ */
  // 표창·암습
  thief: { accent: "vfx_ist", accent2: "vfx_arc", shape: "slash", weight: 1.0 },
  // 암살 — 단일 처형
  assassin: { accent: "vfx_is2", accent2: "vfx_slash", shape: "slash", weight: 1.05, tint: 0x9a7aff },
  // 쌍검난무 — 연격
  swashbuckler: { accent: "vfx_slash", accent2: "vfx_slash_m", shape: "slash", weight: 1.0, tint: 0xf6e8ae },
  // 밤의 칼날 — 그림자 잔상
  nightblade: { accent: "vfx_ist", accent2: "gvu_trail_ghost", shape: "orbit", weight: 1.1, tint: 0x9a7aff },
  // 결투가 — 일격
  duelist: { accent: "vfx_slash_turn", accent2: "vfx_crit", shape: "slash", weight: 1.1, tint: 0xf6e8ae },
  // 그림자 군주 — 분신
  shadowlord: { accent: "vfx_is2", accent2: "gvu_trail_ghost", shape: "orbit", weight: 1.25, tint: 0x9a7aff },
  // 검무 — 연속 참격
  blademaster: { accent: "vfx_slash_turn", accent2: "vfx_arc", shape: "slash", weight: 1.2, tint: 0xf6e8ae },

  /* ══════ 해적 (pirate) — 화약·함포·심해 ══════ */
  // 권총·포격
  pirate: { accent: "vfx_explosion", accent2: "vfx_spark", shape: "burst", weight: 1.0, tint: 0xffd76a },
  // 약탈자 — 공학 망치
  raider: { accent: "mg_slash0", accent2: "vfx_shock", shape: "slash", weight: 1.0, tint: 0xf2ce83 },
  // 삼지창 — 물결
  corsair: { accent: "vfx_ring3", accent2: "vfx_ring", shape: "wave", weight: 1.0, tint: 0x68c7fa },
  // 폭풍함장 — 함포 일제사격
  stormcaptain: { accent: "vfx_bolt2", accent2: "vfx_explosion", shape: "beam", weight: 1.1, tint: 0xffd88a },
  // 화약의 대가 — 폭약
  powdermaster: { accent: "vfx_furnace", accent2: "vfx_explosion", shape: "burst", weight: 1.15, tint: 0xffb347 },
  // 해신 — 물기둥·소용돌이
  seaking: { accent: "vfx_ring3", accent2: "vfx_crystal", shape: "wave", weight: 1.2, tint: 0x68c7fa },
  // 드레드노트 — 중갑 충격·포연
  dreadnought: { accent: "vfx_explosion", accent2: "vfx_splat", shape: "burst", weight: 1.25, tint: 0xff9a5a },
};

/** 직업 키 → 계열 (계열 base 연출을 고르기 위한 최소 매핑). */
export const CLASS_FAMILY: Record<string, FamKey> = {
  warrior: "warrior", berserker: "warrior", guardian: "warrior",
  warlord: "warrior", paladin: "warrior", warbringer: "warrior", crusader: "warrior",

  ranger: "ranger", sniper: "ranger", windrunner: "ranger",
  eagleeye: "ranger", tempest: "ranger", deadeye: "ranger", skylord: "ranger",

  mage: "mage", archmage: "mage", sage: "mage",
  stormbringer: "mage", chronicle: "mage", arclord: "mage", eternal: "mage",

  thief: "thief", assassin: "thief", swashbuckler: "thief",
  nightblade: "thief", duelist: "thief", shadowlord: "thief", blademaster: "thief",

  pirate: "pirate", raider: "pirate", corsair: "pirate",
  stormcaptain: "pirate", powdermaster: "pirate", seaking: "pirate", dreadnought: "pirate",
};

/** 클래스 키 → 프로파일. 미등록/ null 은 null (호출부가 계열 base 만 쓴다). */
export function classFxOf(cls?: string | null): ClassFxProfile | null {
  if (!cls) return null;
  return CLASS_FX[cls] ?? null;
}

/** 클래스 키 → 계열. 미등록은 null. */
export function familyOfClass(cls?: string | null): FamKey | null {
  if (!cls) return null;
  return CLASS_FAMILY[cls] ?? null;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 몬스터 원소 9종 → FX
 *
 * `Enemy.elem`(`Enemy.ts:100`, `:285` 에서 `CHAPTER_ELEM[chapter]` 로 설정)을
 * 인자로 받아 그 속성에 맞는 pixel FX 를 고른다.
 * `data.ts:1296 ELEMENT_META` 의 hex 색을 그대로 틴트로 쓴다.
 *
 * ※ 이 테이블은 데이터만이다. 실제 스폰은 `StudioFX.classFx.ts` 의
 *   `spawnEnemyElemFx()` 가 하며, `Enemy.ts` 는 편집 범위 밖이므로
 *   호출 연결은 리드가 담당한다(보고서 (d) 참조).
 * ═══════════════════════════════════════════════════════════════════════════ */

/** `ElemKey` 9종 + none */
export type ElemKeyLike =
  | "none" | "fire" | "water" | "wind" | "electric"
  | "earth" | "nature" | "ice" | "light" | "dark";

export type ElemFxProfile = {
  /** 주 텍스처 */
  tex: string;
  /** 보조 텍스처 (선택) */
  tex2?: string;
  /** 움직임 형태 */
  shape: "burst" | "ring" | "pillar" | "orbit" | "wave" | "shard";
  /** 기본 강도 배율 */
  weight: number;
};

/**
 * 원소별 FX. `data.ts:1296 ELEMENT_META` 의 의미(불/물/바람/전기/땅/자연/얼음/빛/어둠)에
 * 맞춰 **서로 구별되는** 텍스처를 골랐다.
 *  · nature 와 earth 는 둘 다 초록/갈색 계열이지만,
 *    nature=식생(꽃잎·가시) / earth=암석(균열·충격) 으로 텍스처를 분리했다.
 */
export const ELEM_FX: Record<ElemKeyLike, ElemFxProfile> = {
  // 무속성 — 중립 충격 (vfx_pt1: 무채색 파티클 버스트)
  none: { tex: "vfx_pt1", shape: "burst", weight: 0.9 },
  // 불 — 화염 폭발
  fire: { tex: "vfx_furnace", tex2: "vfx_explosion", shape: "burst", weight: 1.0 },
  // 물 — 물결
  water: { tex: "vfx_ring3", tex2: "vfx_ring", shape: "wave", weight: 0.95 },
  // 바람 — 돌풍/궤적
  wind: { tex: "vfx_arc", tex2: "gvu_trail_wave", shape: "orbit", weight: 0.9 },
  // 전기 — 방전
  electric: { tex: "gvb_lightning_blue", tex2: "vfx_bolt", shape: "burst", weight: 1.0 },
  // 땅 — 균열/충격
  earth: { tex: "mg_shock0", tex2: "vfx_shock", shape: "ring", weight: 1.0 },
  // 자연 — 식생 (vfx_flower: 꽃잎 / vfx_petal: 잎사귀 흩날림)
  nature: { tex: "vfx_flower", tex2: "vfx_petal", shape: "shard", weight: 0.9 },
  // 얼음 — 결정
  ice: { tex: "vfx_crystal", tex2: "vfx_ring1", shape: "shard", weight: 0.95 },
  // 빛 — 성광
  light: { tex: "vfx_flash", tex2: "gvb_star4", shape: "pillar", weight: 1.05 },
  // 어둠 — 그림자
  dark: { tex: "vfx_ist", tex2: "gvu_trail_ghost", shape: "orbit", weight: 1.05 },
};

/** 원소 키 정규화 — 한글 별칭/대소문자 흡수 */
const ELEM_ALIAS: Record<string, ElemKeyLike> = {
  불: "fire", 물: "water", 바람: "wind", 전기: "electric",
  대지: "earth", 땅: "earth", 자연: "nature", 얼음: "ice",
  빛: "light", 어둠: "dark", 무속성: "none",
};

/** `ElemKey`(또는 한글 별칭) → 프로파일. 미지 값은 none 프로파일. */
export function elemFxOf(elem?: string | null): ElemFxProfile {
  if (!elem) return ELEM_FX.none;
  const k = elem.toLowerCase();
  const norm = (ELEM_ALIAS[elem] ?? ELEM_ALIAS[k] ?? k) as ElemKeyLike;
  return ELEM_FX[norm] ?? ELEM_FX.none;
}

/**
 * 원소 키 → `ELEMENT_META` 의 hex 색.
 *
 * `data.ts:1296 ELEMENT_META` 를 **직접 import 하지 않는다** — 이 모듈은 순수 데이터라
 * data.ts(3,300줄)를 끌어오면 번들/순환 위험이 생긴다. 대신 hex 를 여기 복제하되,
 * `data.ts` 와의 일치를 `ELEM_HEX_MATCHES_DATA` 주석으로 명시하고 테스트로 고정한다.
 * (data.ts 의 값이 바뀌면 `tests/class-fx.test.mjs` 가 잡는다)
 */
export const ELEM_HEX: Record<ElemKeyLike, number> = {
  none: 0xe8ecf2,     // ELEMENT_META.none.hex
  fire: 0xff6a3d,     // ELEMENT_META.fire.hex
  water: 0x3da5ff,    // ELEMENT_META.water.hex
  wind: 0x8ef0c0,     // ELEMENT_META.wind.hex
  electric: 0xffe14d, // ELEMENT_META.electric.hex
  earth: 0xc08a4a,    // ELEMENT_META.earth.hex
  nature: 0x6ee06e,   // ELEMENT_META.nature.hex
  ice: 0xa8e0ff,      // ELEMENT_META.ice.hex
  light: 0xfff2c4,    // ELEMENT_META.light.hex
  dark: 0x8a63d2,     // ELEMENT_META.dark.hex
};

/**
 * 원소 키 → FX + 그 원소의 hex 색을 한 번에.
 * 호출부(`Enemy.ts`)가 `ELEMENT_META[this.elem]` 를 따로 조회하지 않아도 되게 한다.
 */
export function elemFxBundle(elem?: string | null): { fx: ElemFxProfile; hex: number } {
  const k = (() => {
    if (!elem) return "none" as ElemKeyLike;
    const lower = elem.toLowerCase();
    return (ELEM_ALIAS[elem] ?? ELEM_ALIAS[lower] ?? lower) as ElemKeyLike;
  })();
  return { fx: ELEM_FX[k] ?? ELEM_FX.none, hex: ELEM_HEX[k] ?? ELEM_HEX.none };
}
