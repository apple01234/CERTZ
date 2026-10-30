/**
 * 5차(각성) 직업별 고유 외형 — vc204 (지시서 #15)
 *
 * 유저 지적: "5차 전직시 있는 캐릭터 모습(베리어&아우라) 모든 직업이 같은 버그
 *            (직업마다 아우라나 이펙트가 달라야 함)"
 *
 * 종전 상태 (`FifthAura.ts` v1.4.41)
 *   core = gvb_shield_hex / halo = gvb_glow_blurry / ground = gvb_ring_soft
 *   → **모든 직업이 같은 텍스처 3장**을 쓰고 tint 만 계통색으로 바꿨다.
 *     같은 계통 10직업은 색까지 같아 완전히 동일하게 보였다.
 *
 * 이 모듈이 하는 일
 *   4차 직업 10개마다 (오라 3겹 + 베리어 1겹) 구성을 **데이터로** 정의한다.
 *     · 오라   — 지속 파티클/광 (몸통 코어 + 상단 헤일로 + 지면 링)
 *     · 베리어 — 몸을 감싸는 형태 (직업마다 다른 텍스처·회전·스케일·맥동)
 *   색은 classes.ts 의 계통색(hex)을 그대로 쓰므로 항목 #4 의 계통 색 규칙과 일치한다.
 *
 * 모바일 저사양 상한 (지시서 요구)
 *   파티클을 새로 만들지 않고 **이미지 4장**만 쓴다(직업 무관 상수).
 *   ADD 블렌드 4장은 저사양에서도 프레임 영향이 작다 — 실측은 docs/FIFTH_LOOK_AUDIT.md.
 */
import Phaser from "phaser";

/** 직업별 외형 정의 — 텍스처 키는 public/assets 의 gvb_/gvu_ 계열 */
export type FifthLook = {
  /** 몸통 코어 (가장 밝은 광) */
  core: string;
  /** 상단 헤일로 (회전) */
  halo: string;
  /** 지면 링 (발밑 문양) */
  ground: string;
  /** 베리어 — 몸을 감싸는 형태 (직업 고유) */
  barrier: string;
  /** 베리어 회전 속도(rad/ms). 0 이면 고정 */
  barrierSpin: number;
  /** 베리어 기본 스케일 */
  barrierScale: number;
  /** 베리어 맥동 진폭 (0~1). 0 이면 정적 */
  barrierPulse: number;
  /** 지면 링 종횡비 (1=원, 0.42=납작한 타원) */
  groundAspect: number;
  /** 오라 색 보정 — 계통색 위에 곱할 색 (0xffffff = 그대로) */
  tint: number;
};

/* ── 계통 공통 모티프 ────────────────────────────────────────────
 *  전사(warrior): 금속·충격 — 각진 육각/충격파
 *  궁수(ranger) : 바람·정밀 — 가는 잔상/별
 *  마법사(mage) : 마나·마법진 — 육각 보호막/에너지웹
 *  도적(thief)  : 그림자·연기 — 마스크/노이즈
 *  해적(pirate) : 화약·파도 — 파편/연기
 *  같은 계통이라도 **형태·회전·맥동**을 직업마다 다르게 준다. */
export const FIFTH_LOOKS: Record<string, FifthLook> = {
  /* 전사 계통 */
  warbringer: {
    core: "gvb_glow_white", halo: "gvb_shockwave_fiery", ground: "gvb_ring_soft",
    barrier: "gvb_shield_hex", barrierSpin: 0.00022, barrierScale: 1.15, barrierPulse: 0.10,
    groundAspect: 0.42, tint: 0xffd0b0, // 전장의 함성 — 붉은 충격
  },
  crusader: {
    core: "gvb_glow_white", halo: "gvb_star4", ground: "gvb_ring_soft",
    barrier: "gvb_shield_hex", barrierSpin: 0.00010, barrierScale: 1.05, barrierPulse: 0.05,
    groundAspect: 1.0, tint: 0xfff4c8, // 심판의 빛 — 황금 성역(원형)
  },

  /* 궁수 계통 */
  deadeye: {
    core: "gvb_glow_blurry", halo: "gvb_star_green", ground: "gvb_ring_soft",
    barrier: "gvb_twinkle", barrierSpin: 0.0006, barrierScale: 1.0, barrierPulse: 0.16,
    groundAspect: 0.55, tint: 0xc8ffd8, // 신의 시선 — 조준 별빛
  },
  skylord: {
    core: "gvb_buff_air", halo: "gvb_trail_stylized", ground: "gvb_ring_soft",
    barrier: "gvu_trail_wave", barrierSpin: 0.00034, barrierScale: 1.25, barrierPulse: 0.08,
    groundAspect: 0.70, tint: 0xd0fff0, // 하늘의 지배자 — 바람 파형
  },

  /* 마법사 계통 */
  arclord: {
    core: "gvb_glow_blue", halo: "gvu_energyweb", ground: "gvu_circle_aggr",
    barrier: "gvb_shield_hex", barrierSpin: 0.00028, barrierScale: 1.30, barrierPulse: 0.06,
    groundAspect: 1.0, tint: 0xa8c8ff, // 마나의 절대자 — 육각 마법진
  },
  eternal: {
    core: "gvb_glow_blurry", halo: "gvb_lightning_blue", ground: "gvu_circle_aggr",
    barrier: "gvu_energyweb", barrierSpin: 0.00008, barrierScale: 1.10, barrierPulse: 0.04,
    groundAspect: 1.0, tint: 0xd8deff, // 시간을 초월한 자 — 정지된 마법진
  },

  /* 도적 계통 */
  shadowlord: {
    core: "gvu_glow", halo: "gvu_energynoise", ground: "gvb_ring_soft",
    barrier: "gvu_mask_ommi", barrierSpin: 0.00018, barrierScale: 1.05, barrierPulse: 0.12,
    groundAspect: 0.42, tint: 0xc8a8ff, // 그림자 군주 — 어둠의 가면
  },
  blademaster: {
    core: "gvb_glow_white", halo: "gvu_trail_ghost", ground: "gvb_ring_soft",
    barrier: "gvu_mask_razor", barrierSpin: 0.00042, barrierScale: 0.95, barrierPulse: 0.09,
    groundAspect: 0.55, tint: 0xffe8b0, // 검의 극한 — 칼날 잔상
  },

  /* 해적 계통 */
  seaking: {
    core: "gvb_buff_air", halo: "gvu_trail_wave", ground: "gvb_ring_soft",
    barrier: "gvu_shockwave_fiery", barrierSpin: 0.00026, barrierScale: 1.35, barrierPulse: 0.14,
    groundAspect: 1.0, tint: 0xfff0b8, // 바다의 왕 — 파도 충격
  },
  dreadnought: {
    core: "gvb_lensflare", halo: "gvu_flare_xo", ground: "gvb_ring_soft",
    barrier: "gvu_spark", barrierSpin: 0.00050, barrierScale: 1.20, barrierPulse: 0.18,
    groundAspect: 0.42, tint: 0xffd8a0, // 무쌍 포격 — 화약 불꽃
  },
};

/** 등장 연출(한 번) — 5차 전직 직후 터지는 버스트. 상시 외형과 구분한다. */
export type FifthBurst = { tex: string; scale: number; life: number; tint: number };

export function fifthBurstFor(cls: string | null | undefined, hex: number): FifthBurst {
  const look = (cls && FIFTH_LOOKS[cls]) || null;
  return {
    tex: look?.barrier ?? "gvu_exp_core",
    scale: (look?.barrierScale ?? 1.2) * 2.6,
    life: 720,
    tint: (look?.tint ?? 0xffffff) === 0xffffff ? hex : look!.tint,
  };
}

/** 텍스처가 실제로 로드됐는지 — 없으면 렌더에서 제외(크래시/빈 이미지 방지) */
export function lookTextures(look: FifthLook): string[] {
  return [look.core, look.halo, look.ground, look.barrier];
}

/* vc204 — 모바일 저사양 상한: 직업 무관 이미지 4장 고정.
 *  파티클을 스폰하지 않으므로 프레임 비용이 장수에 선형이다(4장 = 상수). */
export const FIFTH_AURA_IMAGE_BUDGET = 4;
