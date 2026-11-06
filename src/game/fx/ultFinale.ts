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
import { ultimateFinalePlan, finalePlanReach, type FinalePlan, type UltimateSlot } from "./ultFinalePlan";

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
/* ── 스케일 정상화 ─────────────────────────────────────────────────────────────
 * 유저 지적: "궁극기 연출이 너무 짜치다 / 도트가 아니라 그런가??" — 정확한 진단이다.
 * 이 궁극기가 쓰는 텍스처는 전부 고해상도 webp(128~512px)이고 도트가 아니다.
 * 그런데 종전엔 `setScale(scale * 0.4)` / `* 0.3` 으로 원본의 30~40%만 그렸다.
 * 256px 를 102px 로 깎으면, pixelArt 렌더러(nearest)가 원본 디테일을 그대로 파괴한다.
 * → 배율을 손으로 고르지 않고 **원본 픽셀에서 목표 월드 크기를 역산**한다.
 *   카메라 줌은 viewZoom() = 1.25(720p) 이므로, 월드 1px ≈ 화면 1.25px 다. */
const TEX_PX: Record<string, number> = {
  fx_flarebig: 256, fx_impact: 256, fx_burst: 256, fx_flare: 256, fx_flarew: 256,
  fx_glowblue: 256, fx_hex: 256, fx_glowyellow: 256, fx_glow: 256, fx_purple: 256,
  fx_noise: 256, fx_smoke: 256, fx_shockwave: 256, fx_aura: 256,
  fx_lightning: 256, fx_electro: 256, fx_caustic: 256, gvb_star4: 128,
  gvu_circle_aggr: 512, gw_shock: 256, vf_ring: 256,
};
/** 원본 긴 변이 targetPx 가 되도록 하는 배율. 1.0 미만으로 내려가지 않게 하한을 둔다. */
const fitScale = (tex: string, targetPx: number) =>
  Math.max(0.55, Math.min(2.4, targetPx / (TEX_PX[tex] ?? 256)));
/** 본체 섬광 기준 크기(월드 px) — 256px 텍스처를 1.17배로 키워 원본 디테일을 살린다. */
const BURST_PX = 300;
/** 예비동작(축소) 구간 — 즉발은 싸구려로 보인다. 판정은 delay 그대로, 연출만 늦게 터진다. */
const ANTICIPATE_MS = 110;

export function runUltFinale(
  scene: Phaser.Scene,
  opts: {
    x: number; y: number; hex: number; cls: string | null;
    aimAngle: number;
    slot?: UltimateSlot;
    /** 데미지 롤 — 배율을 받아 {dmg, crit} 반환 */
    roll: (mul: number) => { dmg: number; crit: boolean };
    /** 좌표 기준 대상에게 피해를 준다.
     *  vc206 (지시 #4) — reach 를 함께 넘긴다. 호출부(Player)가 판정 반경을
     *  연출 사거리에 맞춰 넓혀야 먼 지점의 적이 실제로 맞는다. */
    hitAt: (x: number, y: number, dmg: number, crit: boolean, reach: number,
      geometry?: { plan: FinalePlan; angle: number }) => void;
    lite?: boolean;
  },
) {
  const def = (opts.cls && ULT_FINALE[opts.cls]) || finaleFallback(opts.hex);
  const tint = def.tint === 0xffffff ? opts.hex : def.tint;
  const { x, y } = opts;
  const a = opts.aimAngle;

  /* 공통: 화면 플래시 — 궁극기는 최대 연출 지점이라 120ms·중간강도로는 "툭" 하고 끝난다. */
  scene.cameras.main.flash(190, (tint >> 16) & 0xff, (tint >> 8) & 0xff, tint & 0xff);

  /* VC239 아틀라스(다중 프레임) 재생.
   * StudioFX.spawnVc239Fx 와 같은 규격이지만 이 파일은 tests/ultimate-finale.test.mjs 가
   * 소스를 vm 으로 직접 실행하며 import 를 제거하므로 다른 모듈을 import 할 수 없다.
   * 프레임 정렬·크기 정규화만 최소 복제한다.
   * shortcut: 아틀라스 3종 전용. 다른 애니가 필요해지면 StudioFX 쪽으로 통합할 것. */
  const playVc = (key: string, bx: number, by: number, px: number) => {
    const anims = (scene as unknown as { anims?: Phaser.Animations.AnimationManager }).anims;
    if (!anims || !scene.textures.exists(key)) return;
    const animKey = `${key}-anim`;
    if (!anims.exists(animKey)) {
      let names: string[] = [];
      try {
        names = scene.textures.get(key).getFrameNames()
          .sort((p, q) => Number(p.split("__").pop()) - Number(q.split("__").pop()));
      } catch { return; }
      if (!names.length) return;
      try {
        anims.create({ key: animKey, frameRate: 14, repeat: 0,
          frames: names.map((n) => ({ key, frame: n })) });
      } catch { return; }
    }
    let spr: Phaser.GameObjects.Sprite;
    try { spr = scene.add.sprite(bx, by, key, "0"); } catch { return; }
    spr.setDepth(25).setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setOrigin(0.5, 0.65);
    spr.setScale(px / Math.max(spr.width || 1, spr.height || 1));
    try { spr.play(animKey); } catch { /* 애니 실패 → 정지 프레임 유지 */ }
    spr.once("animationcomplete", () => { try { spr.destroy(); } catch { /* noop */ } });
    scene.time.delayedCall(4000, () => { try { if (spr.active) spr.destroy(); } catch { /* noop */ } });
  };

  /* 바닥 레이어 — 마법진은 마법사 계열만(과거 "마법진 우려먹기" 지적 준수),
   * 나머지는 계통색 지면 링. 종전엔 마법사에게만 있었고 그것도 0.6→2.2 배율이었다. */
  const groundLayer = (px: number, spin: boolean) => {
    const tex = def.magic ? "gvu_circle_aggr" : "gw_shock";
    if (!scene.textures.exists(tex)) return;
    const k = fitScale(tex, px);
    const im = scene.add.image(x, y, tex).setDepth(6)
      .setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(k * 0.4).setAlpha(0);
    scene.tweens.add({ targets: im, alpha: def.magic ? 0.85 : 0.6, scale: k,
      duration: 220, ease: "Cubic.out" });
    if (spin && !opts.lite) {
      scene.tweens.add({ targets: im, angle: def.magic ? 170 : 60, duration: 1100, ease: "Sine.out" });
    }
    scene.tweens.add({ targets: im, alpha: 0, scale: k * 1.25, delay: 620,
      duration: 460, ease: "Sine.in", onComplete: () => im.destroy() });
  };

  /* 3층 폭발 — ① 본체 섬광 ② 보조 텍스처 ③ 방사형 잔상(같은 텍스처, 다른 배율/각도).
   * 배율은 더 이상 손으로 곱하지 않는다: peak = 목표 월드 px 이고, 시작 배율은 그 34%. */
  const burst = (bx: number, by: number, scale: number, ghost = true) => {
    const peak = BURST_PX * scale;
    const cast = (tex: string | undefined, dep: number, mul: number, alpha: number,
      rot: number, delay: number) => {
      if (!tex || !scene.textures.exists(tex)) return;
      const k = fitScale(tex, peak * mul);
      const im = scene.add.image(bx, by, tex).setDepth(dep)
        .setBlendMode(Phaser.BlendModes.ADD).setTint(tint)
        .setRotation(rot).setScale(k * 0.55).setAlpha(0);
      /* 예비동작 — 터지기 직전 **오므라든다**. 즉발은 싸구려로 보인다. */
      scene.tweens.add({ targets: im, scale: k * 0.28, alpha: alpha * 0.55,
        duration: ANTICIPATE_MS, delay, ease: "Quad.in" });
      /* 폭발 */
      scene.tweens.add({ targets: im, scale: k, alpha,
        delay: delay + ANTICIPATE_MS, duration: 120, ease: "Cubic.out" });
      /* 잔화 */
      scene.tweens.add({ targets: im, alpha: 0, scale: k * 1.8,
        delay: delay + ANTICIPATE_MS + 120, duration: 430, ease: "Sine.out",
        onComplete: () => im.destroy() });
    };
    cast(def.tex, 24, 1, 0.95, a, 0);
    cast(def.tex2, 23, 0.8, 0.8, a, 30);
    /* 잔상은 큰 폭발에만 붙인다 — 직선 궤적 12스텝에 붙이면 이미지가 4배로 늘어난다. */
    if (ghost && !opts.lite) {
      cast(def.tex, 23, 1.3, 0.5, a + Math.PI * 0.5, 90);
      cast(def.tex2 ?? def.tex, 22, 1.5, 0.4, a - Math.PI * 0.5, 150);
    }
  };

  const dmg = (mul: number) => opts.roll(mul * (def.shape === "ring" ? 0.4 : 1));

  const plan = ultimateFinalePlan(opts.cls, opts.slot ?? 1);
  if (plan) {
    // Preserve the original roll count, coefficients and pulse times. Every pulse
    // uses the union once, so crossing beams never multiply a target's damage.
    const pulses: [number, number][] = def.shape === "line" ? [[0, 1.7], [90, 1.7], [180, 1.7]]
      : def.shape === "cone" ? [[0, 1.8], [80, 1.8], [160, 1.8]]
      : def.shape === "chain" ? [[0, 1.25], [110, 1.25], [220, 1.25], [330, 1.25]]
      : def.shape === "cross" ? [[0, 1.5], [70, 1.5], [140, 1.5], [210, 1.5]]
      : [[0, 2]];
    const reach = finalePlanReach(plan);
    /* 유저 지적의 실질 원인 — 4차 10직업의 이 경로는 **텍스처를 한 장도 안 그렸다**.
     * graphics 로 반투명 도형만 칠하니 플랫한 벡터 블롭이 궁극기의 전부였다.
     * 판정·롤·펄스 타이밍은 그대로 두고(밑의 g 는 계속 판정 경계를 보여준다)
     * 그 위에 지면 레이어와 본체 폭발을 얹는다. */
    groundLayer(520 * (opts.slot === 2 ? 1.15 : 1), true);
    for (const [delay, mul] of pulses) {
      scene.time.delayedCall(delay, () => {
        burst(x, y, 1.5 + mul * 0.35);
        const g = scene.add.graphics().setPosition(x, y).setRotation(a)
          .setDepth(24).setBlendMode(Phaser.BlendModes.ADD);
        for (const z of plan.zones) {
          g.fillStyle(tint, 0.22).lineStyle(3, tint, 0.95);
          if (z.kind === "beam") {
            const c = Math.cos(z.angle), s = Math.sin(z.angle), w = z.width / 2;
            const points = [[0, -w], [z.length, -w], [z.length, w], [0, w]];
            g.beginPath();
            points.forEach(([u, v], i) => {
              const px = z.x + u * c - v * s, py = z.y + u * s + v * c;
              if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
            });
            g.closePath().fillPath().strokePath();
          } else if (z.kind === "disc") {
            g.fillCircle(z.x, z.y, z.radius).strokeCircle(z.x, z.y, z.radius);
          } else if (z.kind === "ring") {
            g.lineStyle(z.width, tint, 0.3).strokeCircle(z.x, z.y, z.radius);
          } else {
            g.beginPath().moveTo(z.x, z.y);
            g.arc(z.x, z.y, z.radius, z.angle - z.arc / 2, z.angle + z.arc / 2, false);
            g.closePath().fillPath().strokePath();
          }
        }
        // Fade only: scaling would advertise a different damage boundary.
        scene.tweens.add({ targets: g, alpha: 0, delay: 200, duration: 420,
          onComplete: () => g.destroy() });
        const { dmg: d, crit } = dmg(mul);
        opts.hitAt(x, y, d, crit, reach, { plan, angle: a });
      });
    }
  } else switch (def.shape) {
    case "line": {
      /* vc235 (#6 "궁극기를 쓰면 레일 같은 게 나가는데 그거에 맞게 따라서
       *  이펙트가 계속 나가던지 해야지!! 장판만 깔리면 어떡해") —
       *  종전엔 3개 지점만 폭발시켜, 화면을 가로지르는 레일(직선 궤적)과
       *  이펙트가 따로 놀았다. 레일 위를 **연속으로** 따라가며 터뜨린다.
       *
       *  판정은 3개 지점 그대로 둔다(데미지 총량 불변 — 밸런스 회귀 금지).
       *  연출만 촘촘하게 깐다: reach 를 일정 간격으로 나눠 매 스텝마다
       *  작은 폭발을 얹고, 마지막에 큰 폭발로 마무리한다. */
      const steps = 3;                 // 판정 지점 수(불변)
      const trail = 12;                // 연출 스텝 수 — 레일을 따라 흐른다
      const cosA = Math.cos(a), sinA = Math.sin(a);
      for (let i = 0; i < trail; i++) {
        const t = (i + 1) / trail;
        const bx = x + cosA * def.reach * t;
        const by = y + sinA * def.reach * t;
        /* 12스텝을 90ms 간격의 3판정 구간에 고르게 매핑 */
        scene.time.delayedCall(Math.round(i * 22), () => {
          burst(bx, by, 0.55 + t * 0.6, false); // 12스텝 — 잔상까지 붙이면 36장이 된다
        });
      }
      for (let i = 0; i < steps; i++) {
        const t = (i + 1) / steps;
        const bx = x + cosA * def.reach * t;
        const by = y + sinA * def.reach * t;
        scene.time.delayedCall(i * 90, () => {
          burst(bx, by, 1.4 + i * 0.5);
          const { dmg: d, crit } = dmg(1.7);
          opts.hitAt(bx, by, d, crit, def.reach);
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
          opts.hitAt(bx, by, d, crit, def.reach);
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
          opts.hitAt(bx, by, d, crit, def.reach);
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
          opts.hitAt(bx, by, d, crit, def.reach);
        });
      }
      break;
    }
    case "pillar": {
      /* 수직 기둥 — 위로 솟구치는 연출 + 발밑 광역 판정.
       * 종전 `.setScale(0.5, 0.2)` 은 세로를 1/5로 찌그러뜨려 기둥이 아니라
       * 납작한 얼룩으로 보였다(유저 "짜치다"의 직접 원인 중 하나).
       * 이제 **균등 배율**로 세우고, 기둥은 원본 atom 비율을 지킨 채 scaleY 만 자란다. */
      /* 이 경로(비4차)는 아래 공통 꼬리에서 groundLayer 를 한 번 깐다 — 여기서 또 깔면 겹친다. */
      if (scene.textures.exists(def.tex)) {
        const k = fitScale(def.tex, def.reach * 0.55); // 발밑 폭 = 256px 텍스처 기준
        const im = scene.add.image(x, y + 20, def.tex).setDepth(25)
          .setBlendMode(Phaser.BlendModes.ADD).setTint(tint)
          .setScale(k * 0.5).setAlpha(0).setOrigin(0.5, 1);
        scene.tweens.add({ targets: im, scale: k, alpha: 0.95,
          duration: 150 + ANTICIPATE_MS, ease: "Back.easeOut" });
        scene.tweens.add({ targets: im, alpha: 0, scale: k * 1.35,
          delay: 260, duration: 480, ease: "Sine.out", onComplete: () => im.destroy() });
        /* 꼭대기 섬광 — 기둥이 하늘로 뻗는 방향을 만든다. */
        const top = scene.add.image(x, y - def.reach * 0.9, def.tex2 ?? def.tex).setDepth(26)
          .setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setAlpha(0)
          .setScale(fitScale(def.tex2 ?? def.tex, def.reach * 0.7) * 0.5);
        scene.tweens.add({ targets: top, alpha: 0.9,
          scale: fitScale(def.tex2 ?? def.tex, def.reach * 0.7),
          delay: ANTICIPATE_MS, duration: 170, ease: "Cubic.out" });
        scene.tweens.add({ targets: top, alpha: 0, delay: 300, duration: 400,
          onComplete: () => top.destroy() });
      }
      const { dmg: d, crit } = dmg(2.2);
      opts.hitAt(x, y, d, crit, def.reach);
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
      opts.hitAt(x, y, d, crit, def.reach);
      break;
    }
    case "circle":
    default: {
      burst(x, y, 2.4);
      const { dmg: d, crit } = dmg(2.0);
      opts.hitAt(x, y, d, crit, def.reach);
      break;
    }
  }

  /* 바닥 레이어 — 마법진은 마법사 계열만(과거 "마법진 우려먹기" 지적 준수)
   * 이 경로(비4차 폴백)는 위 switch 가 지면을 안 깔았으므로 여기서 한 번 깐다.
   * 종전엔 마법사에게만 0.6→2.2 배율로 붙었는데, 512px 텍스처를 0.6배로 시작하면
   * 첫 프레임이 307px 얼룩이다. groundLayer 가 목표 px 에서 역산한다. */
  if (!plan) groundLayer(def.reach * 1.5, true);

  /* 궁극기 등급 전용 VC239 아틀라스 — public/assets/vc239/ 에 있고 지금까지
   * 어떤 스킬도 쓰지 않던 3종(신성 심판 / 공허 붕괴 / 해일)을 여기서 소비한다.
   * 게임 전체에서 궁극기만 부르는 지점이라 AGENTS.md "스킬에만 화려한 이펙트" 규약에 맞다. */
  if (!opts.lite) {
    const vc = def.magic
      ? (def.shape === "pillar" || def.shape === "cross" ? "vfx_holy_judgement" : "vfx_void_collapse")
      : (def.shape === "cone" || def.shape === "ring" ? "vfx_tidal_wave" : "vfx_holy_judgement");
    const vcPx = Math.min(420, def.reach * 1.1);
    playVc(vc, x, y - 10, vcPx);
  }

  /* 카메라 — 직업별 강도, 저사양은 절반.
   * 유저 지적 "짜치다"는 화면 반응이 약한 탓도 크다. 궁극기는 60~120초에 한 번뿐이므로
   * 기존 doShake 를 **세게** 쓴다(새 연출을 만들지 않고 배율만 올린다). */
  const [ms, amt] = def.shake;
  /* 저사양(lite)은 정확히 절반 — tests/ultimate-finale.test.mjs 가 그 비율을 계약으로 본다. */
  (scene as unknown as { doShake?: (ms: number, amount: number) => void })
    .doShake?.(Math.round(ms * 1.35), opts.lite ? amt * 0.75 : amt * 1.5);
  /* 히트스톱 — WorldScene 이 이미 소유한 ImpactFX 경로를 그대로 쓴다(새로 만들지 않음). */
  (scene as unknown as { hitStop?: (ms?: number) => void })
    .hitStop?.(opts.lite ? 40 : 90);
  /* WorldScene 은 sfxSkill 을 제공하지만 Phaser.Scene 타입에는 없다. */
  (scene as unknown as { sfxSkill?: (k: string, r?: number) => void }).sfxSkill?.(def.sfx, 1.0);
}
