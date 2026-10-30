/**
 * ultFinale.ts — 궁극기 직업별 고유 마무리 — vc204 (지시서 #10)
 *
 * 유저 지적: "궁극기가 뒤에 부분 바뀐게 다 똑같잖아 ㅅ1ㅂ 똑바로 안만듬???
 *            내가 메이플스토리 전직업 극딜 스킬 콤보 참고 해랬잖아!!"
 *
 * 실측 (`tools/ult_dedup.py`, docs/ULT_DEDUP.md)
 *   34직업의 마지막 3개 연출 호출을 비교하니 다음 조합이 반복됐다.
 *     · `spawnBurstAt → sfxSkill → sfxCrit`  … archmage, berserker, chronicle,
 *       eagleeye, seaking, stormbringer, tempest, warrior, windrunner 등
 *     · `sfxSkill → sfxSkill → sfxCrit`      … arclord, blademaster, dreadnought,
 *       mage, pirate, shadowlord 등
 *   마무리가 "원형 폭발 + 효과음 + 크리티컬음"으로 수렴해 직업 구분이 사라졌다.
 *
 * 이 모듈이 하는 일
 *   직업마다 **판정 형태**가 다른 마무리를 하나씩 정의한다(지시서 요구: "원형/직선/
 *   전방 부채꼴/연쇄"). 색은 계통색을 쓰고, 마법진은 마법사 계열만 쓴다.
 *   각 마무리는 (형태 · 이펙트 텍스처 · 카메라 · 소리)가 모두 다르다.
 *
 * 성능
 *   1회성 연출이다(쿨 60~120초). 이미지 2~4장 + 기존 파티클 1회.
 *   저사양 게이트에서는 카메라 셰이크와 이미지 장수를 줄인다.
 */
import Phaser from "phaser";

/** 마무리 판정 형태 — 직업마다 다르게 준다 */
export type FinaleShape =
  | "circle"     // 원형 폭발
  | "line"       // 직선 관통
  | "cone"       // 전방 부채꼴
  | "chain"      // 연쇄 폭발
  | "cross"      // 십자
  | "ring"       // 확장 링(피해 없이 연출만)
  | "pillar";    // 수직 기둥

export type FinaleDef = {
  shape: FinaleShape;
  /** 대표 이펙트 텍스처 */
  tex: string;
  /** 보조 텍스처 (없으면 생략) */
  tex2?: string;
  /** 판정 반경/길이(px) */
  reach: number;
  /** 부채꼴 각도(rad) — cone 전용 */
  arc?: number;
  /** 카메라 셰이크 (ms, 강도) */
  shake: [number, number];
  /** 마무리 효과음 키 */
  sfx: string;
  /** 계통색 위에 곱할 tint (0xffffff = 계통색 그대로) */
  tint: number;
  /** 이 마무리가 마법진을 쓰는가 (마법사 계열만 true) */
  magic: boolean;
};

/* 4차 직업 10개 + 계열 기본 5종.
 *  "뒷부분"이 겹치지 않도록 (shape, tex, shake, sfx) 조합을 전부 다르게 배치했다. */
export const ULT_FINALE: Record<string, FinaleDef> = {
  /* ── 전사 계통 ───────────────────────────────────── */
  warbringer: { // 천멸극 — 분노의 대붕괴: 전방 부채꼴 3연 참격
    shape: "cone", tex: "fx_flarebig", tex2: "fx_impact", reach: 460, arc: Math.PI * 0.62,
    shake: [220, 0.026], sfx: "bigsword", tint: 0xffd0b0, magic: false },
  crusader: { // 심판의 빛 — 십자 성광
    shape: "cross", tex: "gvb_star4", tex2: "fx_glowyellow", reach: 400,
    shake: [180, 0.014], sfx: "holy", tint: 0xfff4c8, magic: false },
  warrior: { // 계열 기본 — 원형 충격
    shape: "circle", tex: "fx_shockwave", reach: 380,
    shake: [200, 0.020], sfx: "bigsword", tint: 0xffffff, magic: false },
  berserker: { // 광란 — 연쇄 폭발
    shape: "chain", tex: "fx_burst", reach: 340,
    shake: [240, 0.028], sfx: "roar", tint: 0xffb0a0, magic: false },
  guardian: { // 수호 — 수직 기둥
    shape: "pillar", tex: "fx_aura", reach: 300,
    shake: [140, 0.010], sfx: "holy", tint: 0xfff0c0, magic: false },
  paladin: { // 성기사 — 확장 링
    shape: "ring", tex: "fx_glowyellow", reach: 360,
    shake: [120, 0.008], sfx: "holy", tint: 0xfff8d8, magic: false },

  /* ── 궁수 계통 ───────────────────────────────────── */
  deadeye: { // 신의 시선 — 직선 관통 저격
    shape: "line", tex: "fx_caustic", tex2: "fx_electro", reach: 620,
    shake: [150, 0.012], sfx: "arrowpierce", tint: 0xc8ffd8, magic: false },
  skylord: { // 하늘의 지배자 — 전방 부채꼴 돌풍
    shape: "cone", tex: "fx_electro", tex2: "fx_glow", reach: 480, arc: Math.PI * 0.5,
    shake: [160, 0.014], sfx: "wind", tint: 0xd0fff0, magic: false },
  eagleeye: { // 계열 기본 — 직선
    shape: "line", tex: "fx_caustic", reach: 560,
    shake: [140, 0.011], sfx: "arrowpierce", tint: 0xffffff, magic: false },
  windrunner: { // 질풍 — 연쇄
    shape: "chain", tex: "fx_glow", reach: 320,
    shake: [130, 0.010], sfx: "wind", tint: 0xe0fff0, magic: false },
  tempest: { // 폭풍 — 원형
    shape: "circle", tex: "fx_electro", reach: 420,
    shake: [200, 0.018], sfx: "thunder", tint: 0xd8fff8, magic: false },

  /* ── 마법사 계통 (마법진 허용) ───────────────────── */
  arclord: { // 마나의 절대자 — 대형 마법진 원형 폭발
    shape: "circle", tex: "fx_glowblue", tex2: "fx_lightning", reach: 500,
    shake: [220, 0.020], sfx: "thunder", tint: 0xa8c8ff, magic: true },
  eternal: { // 시간을 초월한 자 — 정지된 십자
    shape: "cross", tex: "fx_glowblue", tex2: "fx_flarew", reach: 440,
    shake: [100, 0.006], sfx: "slowmo", tint: 0xd8deff, magic: true },
  mage: { // 계열 기본 — 원형
    shape: "circle", tex: "fx_lightning", reach: 440,
    shake: [190, 0.016], sfx: "thunder", tint: 0xffffff, magic: true },
  archmage: { // 대마법사 — 기둥
    shape: "pillar", tex: "fx_glowblue", tex2: "fx_hex", reach: 380,
    shake: [170, 0.014], sfx: "elemcast", tint: 0xb8d8ff, magic: true },
  chronicle: { // 기록자 — 링
    shape: "ring", tex: "fx_glowblue", reach: 400,
    shake: [90, 0.005], sfx: "slowmo", tint: 0xe2e8ff, magic: true },
  stormbringer: { // 폭풍소환사 — 연쇄 낙뢰
    shape: "chain", tex: "fx_lightning", reach: 360,
    shake: [210, 0.019], sfx: "thunder", tint: 0xc8e0ff, magic: true },

  /* ── 도적 계통 ───────────────────────────────────── */
  shadowlord: { // 그림자 군주 — 연쇄 암습
    shape: "chain", tex: "fx_purple", tex2: "fx_noise", reach: 380,
    shake: [130, 0.011], sfx: "dagger", tint: 0xc8a8ff, magic: false },
  blademaster: { // 검의 극한 — 직선 일섬
    shape: "line", tex: "fx_flarew", tex2: "fx_impact", reach: 580,
    shake: [180, 0.015], sfx: "slash", tint: 0xffe8b0, magic: false },
  thief: { // 계열 기본 — 원형
    shape: "circle", tex: "fx_purple", reach: 360,
    shake: [150, 0.012], sfx: "dagger", tint: 0xffffff, magic: false },
  assassin: { // 암살자 — 직선
    shape: "line", tex: "fx_noise", reach: 520,
    shake: [160, 0.013], sfx: "dagger", tint: 0xc8b0ff, magic: false },
  nightblade: { // 야습 — 부채꼴
    shape: "cone", tex: "fx_purple", reach: 400, arc: Math.PI * 0.45,
    shake: [140, 0.011], sfx: "slash", tint: 0xd0b0ff, magic: false },
  duelist: { // 결투가 — 십자
    shape: "cross", tex: "fx_flarew", reach: 380,
    shake: [150, 0.012], sfx: "slash", tint: 0xffe0c0, magic: false },

  /* ── 해적 계통 ───────────────────────────────────── */
  seaking: { // 바다의 왕 — 거대 파도(전방 부채꼴)
    shape: "cone", tex: "fx_flare", tex2: "fx_smoke", reach: 520, arc: Math.PI * 0.7,
    shake: [230, 0.022], sfx: "cannon", tint: 0xfff0b8, magic: false },
  dreadnought: { // 무쌍 포격 — 연쇄 함포
    shape: "chain", tex: "fx_flare", tex2: "fx_impact", reach: 420,
    shake: [260, 0.030], sfx: "cannon", tint: 0xffd8a0, magic: false },
  pirate: { // 계열 기본 — 원형 폭발
    shape: "circle", tex: "fx_flare", reach: 400,
    shake: [220, 0.020], sfx: "cannon", tint: 0xffffff, magic: false },
  corsair: { // 해적선장 — 부채꼴
    shape: "cone", tex: "fx_flarebig", reach: 440, arc: Math.PI * 0.55,
    shake: [200, 0.018], sfx: "cannon", tint: 0xffe0b0, magic: false },
  stormcaptain: { // 폭풍의 선장 — 직선 뇌격
    shape: "line", tex: "fx_electro", reach: 540,
    shake: [200, 0.017], sfx: "thunder", tint: 0xffd88a, magic: false },
  powdermaster: { // 화약술사 — 연쇄
    shape: "chain", tex: "fx_burst", reach: 350,
    shake: [240, 0.026], sfx: "cannon", tint: 0xffc890, magic: false },
};

/** 정의가 없는 직업의 폴백 — 계통 모티프만 살린 보수적 마무리 */
export function finaleFallback(hex: number): FinaleDef {
  return {
    shape: "circle", tex: "fx_shockwave", reach: 380,
    shake: [180, 0.016], sfx: "bigsword", tint: hex, magic: false,
  };
}

/**
 * 마무리 실행 — 판정 형태별로 다른 지오메트리와 연출을 낸다.
 *
 * @param hit  실제 피해를 주는 콜백. (dx, dy, dmgMul) → 호출하면 그 지점 대상에게 피해.
 *             마무리는 판정 형태가 다르므로 콜백에 좌표를 넘긴다.
 */
export function runUltFinale(
  scene: Phaser.Scene,
  opts: {
    x: number; y: number; hex: number; cls: string | null;
    aimAngle: number;
    /** 데미지 롤 — 배율을 받아 {dmg, crit} 반환 */
    roll: (mul: number) => { dmg: number; crit: boolean };
    /** 좌표 기준 대상에게 피해를 준다 */
    hitAt: (x: number, y: number, dmg: number, crit: boolean) => void;
    lite?: boolean;
  },
) {
  const def = (opts.cls && ULT_FINALE[opts.cls]) || finaleFallback(opts.hex);
  const tint = def.tint === 0xffffff ? opts.hex : def.tint;
  const { x, y } = opts;
  const a = opts.aimAngle;

  /* 공통: 마무리 이름 표기 + 화면 플래시 (강도만 직업별 차등) */
  scene.cameras.main.flash(120, (tint >> 16) & 0xff, (tint >> 8) & 0xff, tint & 0xff);

  const burst = (bx: number, by: number, scale: number) => {
    if (scene.textures.exists(def.tex)) {
      const im = scene.add.image(bx, by, def.tex).setDepth(24)
        .setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(scale * 0.4).setAlpha(0);
      scene.tweens.add({ targets: im, alpha: 0.95, scale, duration: 180, ease: "Cubic.out" });
      scene.tweens.add({ targets: im, alpha: 0, scale: scale * 1.6, delay: 200,
        duration: 420, onComplete: () => im.destroy() });
    }
    if (def.tex2 && scene.textures.exists(def.tex2)) {
      const im2 = scene.add.image(bx, by, def.tex2).setDepth(23)
        .setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(scale * 0.3).setAlpha(0)
        .setRotation(a);
      scene.tweens.add({ targets: im2, alpha: 0.8, scale: scale * 0.9, duration: 200, ease: "Cubic.out" });
      scene.tweens.add({ targets: im2, alpha: 0, scale: scale * 1.4, delay: 220,
        duration: 400, onComplete: () => im2.destroy() });
    }
  };

  const dmg = (mul: number) => opts.roll(mul * (def.shape === "ring" ? 0.4 : 1));

  switch (def.shape) {
    case "line": {
      /* 직선 관통 — 조준 방향으로 3개 지점을 차례로 폭발시킨다 */
      const steps = 3;
      for (let i = 0; i < steps; i++) {
        const t = (i + 1) / steps;
        const bx = x + Math.cos(a) * def.reach * t;
        const by = y + Math.sin(a) * def.reach * t;
        scene.time.delayedCall(i * 90, () => {
          burst(bx, by, 1.4 + i * 0.5);
          const { dmg: d, crit } = dmg(1.7);
          opts.hitAt(bx, by, d, crit);
        });
      }
      break;
    }
    case "cone": {
      /* 전방 부채꼴 — 각도 범위 안의 지점 3개를 순차 폭발 */
      const arc = def.arc ?? Math.PI * 0.6;
      for (let i = -1; i <= 1; i++) {
        const ang = a + (i * arc) / 2;
        const bx = x + Math.cos(ang) * def.reach * 0.8;
        const by = y + Math.sin(ang) * def.reach * 0.8;
        scene.time.delayedCall((i + 1) * 80, () => {
          burst(bx, by, 2.0);
          const { dmg: d, crit } = dmg(1.8);
          opts.hitAt(bx, by, d, crit);
        });
      }
      break;
    }
    case "chain": {
      /* 연쇄 폭발 — 주변 4방향으로 튀며 폭발, 매번 판정 */
      for (let i = 0; i < 4; i++) {
        const ang = a + (i * Math.PI) / 2;
        const bx = x + Math.cos(ang) * def.reach * 0.55;
        const by = y + Math.sin(ang) * def.reach * 0.55;
        scene.time.delayedCall(i * 110, () => {
          burst(bx, by, 1.5);
          const { dmg: d, crit } = dmg(1.25);
          opts.hitAt(bx, by, d, crit);
        });
      }
      break;
    }
    case "cross": {
      /* 십자 — 정/횡 2축 4방향 */
      for (let i = 0; i < 4; i++) {
        const ang = a + (i * Math.PI) / 2;
        const bx = x + Math.cos(ang) * def.reach * 0.7;
        const by = y + Math.sin(ang) * def.reach * 0.7;
        scene.time.delayedCall(i * 70, () => {
          burst(bx, by, 1.7);
          const { dmg: d, crit } = dmg(1.5);
          opts.hitAt(bx, by, d, crit);
        });
      }
      break;
    }
    case "pillar": {
      /* 수직 기둥 — 위로 솟구치는 연출 + 발밑 광역 판정 */
      if (scene.textures.exists(def.tex)) {
        const im = scene.add.image(x, y - 40, def.tex).setDepth(25)
          .setBlendMode(Phaser.BlendModes.ADD).setTint(tint)
          .setScale(0.5, 0.2).setAlpha(0);
        scene.tweens.add({ targets: im, alpha: 0.9, scaleX: 1.3, scaleY: 4.2,
          duration: 260, ease: "Cubic.out" });
        scene.tweens.add({ targets: im, alpha: 0, duration: 420, delay: 280,
          onComplete: () => im.destroy() });
      }
      const { dmg: d, crit } = dmg(2.2);
      opts.hitAt(x, y, d, crit);
      break;
    }
    case "ring": {
      /* 확장 링 — 피해는 작고 연출 중심(파티 버프형 직업) */
      const ring = scene.add.circle(x, y, 30)
        .setStrokeStyle(6, tint, 0.95).setDepth(24).setBlendMode(Phaser.BlendModes.ADD);
      scene.tweens.add({ targets: ring, scale: def.reach / 30, alpha: 0,
        duration: 560, ease: "Cubic.out", onComplete: () => ring.destroy() });
      burst(x, y, 1.2);
      const { dmg: d, crit } = dmg(0.9);
      opts.hitAt(x, y, d, crit);
      break;
    }
    case "circle":
    default: {
      burst(x, y, 2.4);
      const { dmg: d, crit } = dmg(2.0);
      opts.hitAt(x, y, d, crit);
      break;
    }
  }

  /* 마법진 — 마법사 계열만 (지시서 §3: "마법진은 마법사 계열만") */
  if (def.magic && scene.textures.exists("gvu_circle_aggr")) {
    const mc = scene.add.image(x, y, "gvu_circle_aggr").setDepth(22)
      .setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(0.6).setAlpha(0);
    scene.tweens.add({ targets: mc, alpha: 0.85, scale: 2.2, duration: 300, ease: "Cubic.out" });
    scene.tweens.add({ targets: mc, alpha: 0, scale: 3.0, delay: 320,
      duration: 500, onComplete: () => mc.destroy() });
    if (!opts.lite) scene.tweens.add({ targets: mc, angle: 140, duration: 900, ease: "Sine.out" });
  }

  /* 카메라 — 직업별 강도, 저사양은 절반 */
  const [ms, amt] = def.shake;
  scene.cameras.main.shake(ms, opts.lite ? amt * 0.5 : amt);
  /* WorldScene 은 sfxSkill 을 제공하지만 Phaser.Scene 타입에는 없다. */
  (scene as unknown as { sfxSkill?: (k: string, r?: number) => void }).sfxSkill?.(def.sfx, 1.0);
}
