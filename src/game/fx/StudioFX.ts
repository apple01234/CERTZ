/**
 * SERTZ GameStudio FX (v1.0.10) — 스튜디오급 연출 통합 레이어
 *  유저 지시 대응: "Game Studio 플러그인 적용" · "평소에도 쉐이더 적용" · "4차/5차 스킬 이펙트 강화"
 *
 *  ① 앰비언트 포스트FX — 보스전 전용이던 카메라 블룸을 **전투 상시(서브틀)** 로:
 *     스킬 이펙트·파티클·참격이 평소에도 카메라 블룸으로 빛난다 (fxLevel 0에선 해제 — 모바일 프레임 보호).
 *     보스전 진입 시 앰비언트를 걷어내고 강한 보스 블룸으로 교체, 종료 시 앰비언트로 복귀 (이중 부착 방지).
 *  ② 프리렌더 3D VFX 프리셋 — Vefects(Unity 3D VFX 팩, 유료 라이선스) 25종을 프리셋 트윈으로 래핑:
 *     펜타클(마법진) / 원소 플레어 / 확장 링 / 엠블럼 / 화이트 제네릭(tint 대응).
 *     화이트 텍스처는 setTint로 전 직업 클래스 컬러 대응, 컬러 텍스처는 베이크드 컬러 그대로.
 */
import Phaser from "phaser";

type CamLike = {
  filters?: {
    external?: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      remove: (filter: any, forceDestroy?: boolean) => unknown;
    };
  } | null;
};
type SceneLike = Phaser.Scene & { textures: Phaser.Textures.TextureManager };

/** 카메라에 서브틀 앰비언트 블룸 부착 — 반환된 필터는 detachAmbientBloom으로 제거.
 *  반환 길이 0 = 미지원 환경(WebGL 아님/필터 불가). 중복 부착은 호출자가 length로 가드. */
export function addAmbientBloom(cam: CamLike): unknown[] {
  const out: unknown[] = [];
  try {
    if (!cam.filters) return out;
    /* 보스 블룸(threshold 0.6/blend 0.46~0.68)보다 눈에 덜 띄는 서브틀 프리셋 —
     * 프레임버퍼 패스 1개 추가분이라 모바일 비용은 보스전 대비 가볍다 */
    const bloom = Phaser.Actions.AddEffectBloom(cam as unknown as Phaser.Cameras.Scene2D.Camera, {
      threshold: 0.74,
      blurRadius: 1,
      blurSteps: 3,
      blendAmount: 0.32,
    });
    if (bloom[0]) out.push(bloom[0].threshold, bloom[0].blur, bloom[0].parallelFilters);
  } catch { /* 필터 미지원 무시 */ }
  return out;
}

export function detachAmbientBloom(cam: CamLike, filters: unknown[]) {
  for (const f of filters) {
    try { cam.filters?.external?.remove(f); } catch { /* 이미 해제됨 */ }
  }
  filters.length = 0;
}

/* ---------------- 프리렌더 3D VFX 프리셋 (Vefects — vf_*.webp) ---------------- */

type Img = Phaser.GameObjects.Image & { setDepth(d: number): Img };

function vfImage(scene: SceneLike, tex: string, x: number, y: number, tint?: number): Img | null {
  if (!scene.textures.exists(tex)) return null; // 에셋 미탑재 환경(구 세이브/CDN 지연) — 조용히 스킵
  const im = scene.add.image(x, y, tex) as Img;
  im.setDepth(24).setBlendMode(Phaser.BlendModes.ADD);
  if (tint !== undefined) im.setTint(tint);
  return im;
}

/** 마법진(펜타클) — 페이드인 + 스핀 + 페이드아웃. 5차 궁극기 인트로·4차 시그니처용 */
export function spawnPentacle(
  scene: SceneLike, x: number, y: number, tint: number,
  opts: { tex?: string; scale?: number; duration?: number; spin?: boolean; alpha?: number } = {},
) {
  const tex = opts.tex ?? "vf_pentacle";
  const im = vfImage(scene, tex, x, y + 6, tint);
  if (!im) return;
  const dur = opts.duration ?? 900;
  const target = opts.scale ?? 1.0;
  im.setAlpha(0).setScale(target * 0.4);
  if (opts.spin) im.setRotation(Phaser.Math.FloatBetween(-0.7, 0.7));
  scene.tweens.add({ targets: im, alpha: opts.alpha ?? 0.66, scale: target, duration: Math.min(260, dur * 0.3), ease: "Cubic.out" });
  if (opts.spin) scene.tweens.add({ targets: im, rotation: `+=${Phaser.Math.FloatBetween(1.6, 2.6)}`, duration: dur, ease: "Sine.inOut" });
  scene.tweens.add({
    targets: im, alpha: 0, scale: target * 1.18,
    delay: dur * 0.6, duration: dur * 0.4, ease: "Sine.in",
    onComplete: () => im.destroy(),
  });
}

/** 원소 플레어 코어 팝 — 타격/폭발 중심 (베이크드 컬러 텍스처 권장: vf_flare_*)
 *  v1.0.13 — alpha 옵션 추가(티어별 강약: 2~3차는 희미하게, 4~5차만 풀) */
export function spawnFlarePop(
  scene: SceneLike, x: number, y: number, tex: string,
  opts: { tint?: number; scale?: number; duration?: number; angle?: number; alpha?: number } = {},
) {
  const im = vfImage(scene, tex, x, y, opts.tint);
  if (!im) return;
  if (opts.angle !== undefined) im.setRotation(opts.angle);
  const dur = opts.duration ?? 420;
  const target = opts.scale ?? 1.0;
  im.setAlpha(0).setScale(target * 0.3);
  scene.tweens.add({ targets: im, alpha: opts.alpha ?? 0.82, scale: target, duration: dur * 0.32, ease: "Cubic.out" });
  scene.tweens.add({
    targets: im, alpha: 0, scale: target * 1.3, angle: `+${Phaser.Math.Between(-14, 14)}`,
    delay: dur * 0.3, duration: dur * 0.7, ease: "Sine.out",
    onComplete: () => im.destroy(),
  });
}

/** 확장 링 — 충격파/시전 경계 (vf_ring: 화이트 tint 대응 · vf_ring_void/fire: 베이크드)
 *  v1.0.13 — alpha 파라미터 추가(티어별 강약) */
export function spawnRingPop(
  scene: SceneLike, x: number, y: number, tex: string, tint: number,
  toScale = 3.0, duration = 560, alpha = 0.72,
) {
  const im = vfImage(scene, tex, x, y, tint);
  if (!im) return;
  im.setAlpha(alpha).setScale(0.3);
  scene.tweens.add({
    targets: im, scale: toScale, alpha: 0, duration, ease: "Cubic.out",
    onComplete: () => im.destroy(),
  });
}

/* ---------------- 5차 궁극기 공통 인트로 (마법진+링+코어 4중 합성) ----------------
 * 기존: 단색 원 링 1개 + 파티클 버스트 → "밋밋하다"는 유저 지시.
 * 신규: 3D 프리렌더 펜타클(클래스 컬러 틴트·스핀) + 이중 확장 링 + 임팩트 코어 + 4방향 스파크 */
export function spawnUltimateIntro(scene: SceneLike, x: number, y: number, tint: number) {
  spawnPentacle(scene, x, y, tint, { scale: 1.25, duration: 1000, spin: true, alpha: 0.62 });
  spawnRingPop(scene, x, y, "vf_ring", tint, 2.4, 720);
  spawnRingPop(scene, x, y, "vf_ring", 0xffffff, 1.6, 520);
  spawnFlarePop(scene, x, y - 4, "vf_impact", { tint, scale: 0.9, duration: 560 });
  /* 4방향 스파크 — 십자 광륜 */
  for (let i = 0; i < 4; i++) {
    const ang = (Math.PI / 2) * i + 0.4;
    const dist = Phaser.Math.Between(64, 88);
    const sx = x + Math.cos(ang) * 18;
    const sy = y - 4 + Math.sin(ang) * 18;
    const sp = vfImage(scene, "vf_star", sx, sy, 0xffffff);
    if (!sp) break;
    sp.setAlpha(0.95).setScale(0.22);
    scene.tweens.add({
      targets: sp, x: sx + Math.cos(ang) * dist, y: sy + Math.sin(ang) * dist,
      alpha: 0, scale: 0.05, duration: 520, ease: "Cubic.out", onComplete: () => sp.destroy(),
    });
  }
}

/* ═══════════════ v1.0.11 — Gameworks 프리셋 (유저 업로드 Unity 팩) ═══════════════
 *  Hovl Studio Magic effects · Matthew Guz Slash Effects 프리렌더 텍스처 (Petal Particles는 v1.0.13 철수).
 *  용도: ① N차마다 기존 스킬 강화(1차~3차 주력/기동/3차기) ② 튜토리얼 축하 연출 ③ 축제 이펙트 */

/** 마법진 (gw_magic: Hovl MagicCircle2 베이크드 퍼플 / gw_rune: 룬 서클 화이트 — 틴트 대응) */
export function spawnMagicCircleGW(
  scene: SceneLike, x: number, y: number, tint: number,
  opts: { tex?: string; scale?: number; duration?: number; alpha?: number; yOff?: number } = {},
) {
  const tex = opts.tex ?? "gw_rune";
  const im = vfImage(scene, tex, x, y + (opts.yOff ?? 4), opts.tex === "gw_magic" ? undefined : tint);
  if (!im) return;
  const dur = opts.duration ?? 820;
  const target = opts.scale ?? 1.0;
  im.setAlpha(0).setScale(target * 0.55);
  scene.tweens.add({ targets: im, alpha: opts.alpha ?? 0.72, scale: target, duration: Math.min(240, dur * 0.3), ease: "Cubic.out" });
  scene.tweens.add({ targets: im, rotation: `+=${Phaser.Math.FloatBetween(1.2, 2.2)}`, duration: dur, ease: "Sine.inOut" });
  scene.tweens.add({
    targets: im, alpha: 0, scale: target * 1.14,
    delay: dur * 0.62, duration: dur * 0.38, ease: "Sine.in",
    onComplete: () => im.destroy(),
  });
}

/** 충격 링 (gw_shock — Guz Shockwave2, 화이트 틴트 대응) — v1.0.13 alpha 파라미터(티어별 강약) */
export function spawnShockGW(scene: SceneLike, x: number, y: number, tint: number, toScale = 2.6, duration = 520, alpha = 0.78) {
  const im = vfImage(scene, "gw_shock", x, y, tint);
  if (!im) return;
  im.setAlpha(alpha).setScale(0.35);
  scene.tweens.add({
    targets: im, scale: toScale, alpha: 0, duration, ease: "Cubic.out",
    onComplete: () => im.destroy(),
  });
}

/** 참격 호 (gw_arc — Hovl 초승달 참격, 각도 지정 화이트 틴트) */
export function spawnSlashGW(scene: SceneLike, x: number, y: number, tint: number, angle: number, scale = 1.0, duration = 300) {
  const im = vfImage(scene, "gw_arc", x, y, tint);
  if (!im) return;
  im.setRotation(angle).setScale(scale * 0.6).setAlpha(0);
  scene.tweens.add({ targets: im, alpha: 0.9, scale, duration: duration * 0.3, ease: "Cubic.out" });
  scene.tweens.add({
    targets: im, alpha: 0, scale: scale * 1.25, angle: `+${Phaser.Math.Between(-18, 18)}`,
    delay: duration * 0.28, duration: duration * 0.72, ease: "Sine.out",
    onComplete: () => im.destroy(),
  });
}

/** 폭발 버스트 (gw_boom — Guz 폭발 스파이크, 클래스색 틴트) */
export function spawnBoomGW(scene: SceneLike, x: number, y: number, tint: number, scale = 1.0, duration = 460) {
  const im = vfImage(scene, "gw_boom", x, y, tint);
  if (!im) return;
  im.setScale(scale * 0.4).setAlpha(0);
  scene.tweens.add({ targets: im, alpha: 0.85, scale, duration: duration * 0.28, ease: "Cubic.out" });
  scene.tweens.add({
    targets: im, alpha: 0, scale: scale * 1.28, angle: `+${Phaser.Math.Between(-10, 10)}`,
    delay: duration * 0.26, duration: duration * 0.74, ease: "Sine.out",
    onComplete: () => im.destroy(),
  });
}

/** 축하 스파클 버스트 (v1.0.13 — 벚꽃 소나기 완전 제거에 따른 대체 연출) —
 *  골드 톤 광륜: 링 + 플레어 + 방사 스파크. 튜토리얼 완료 등 승리의 순간용 */
export function spawnCelebrateBurst(scene: SceneLike, x: number, y: number, count = 14) {
  spawnRingPop(scene, x, y, "vf_ring", 0xffd98a, 2.2, 640);
  spawnFlarePop(scene, x, y - 6, "gw_flare", { tint: 0xffe9b0, scale: 1.0, duration: 480 });
  for (let i = 0; i < count; i++) {
    const ang = (Math.PI * 2 * i) / count + Phaser.Math.FloatBetween(-0.15, 0.15);
    const dist = Phaser.Math.Between(70, 120);
    const sp = vfImage(scene, "gw_spark", x, y, i % 3 === 0 ? 0xffffff : 0xffd98a);
    if (!sp) break;
    sp.setAlpha(0.9).setScale(0.18);
    scene.tweens.add({
      targets: sp,
      x: x + Math.cos(ang) * dist, y: y + Math.sin(ang) * dist,
      alpha: 0, scale: 0.04, angle: `+${Phaser.Math.Between(40, 160)}`,
      duration: Phaser.Math.Between(500, 800), ease: "Cubic.out", onComplete: () => sp.destroy(),
    });
  }
}

export type FamKey = "warrior" | "ranger" | "mage" | "thief";

/** ═══ N차마다 기존 스킬 강화 (유저 상시 지시) ═══
 *  v1.0.13 재설계 (유저 3건 지시 반영):
 *   ① 벚꽃잎 연출 완전 제거  ② 모든 직업이 자기 계열색 마법진 시그니처 보유 (마법사 전용이 아님)
 *   ③ 4·5차만 풀 규모, 2·3차는 절제판(눈아픔 완화 — 알파·크기·요소 수 축소)
 *  skill1(주력기)/skill2(기동기)/skill3(3차기) 호출부에서 sTier에 비례해 합성:
 *   t2 (2차)  — [절제] 계열색 광점 1 (희미)
 *   t3 (3차)  — [절제] 계열색 소형 마법진(반투명) + 얕은 링 + 계열 악센트 1개(소형)
 *   t4 (4차)  — [풀] 룬 마법진 스핀(계열색) + 충격 링 + 궤도 스파크 3 + 플레어 + 크리티컬 플래시 + 계열 악센트 풀
 *   t5 (5차각성) — [풀] 4차 전부 + 폭발 코어 + 화염 잔연 (각성의 격)
 *  fam 계열 악센트 (전사=초승달 참격+지면 균열 / 궁수=화살+혜성 궤적 /
 *       마법사=오브 마법진+수정 파편 / 도적=교차 참격날). angle: 조준 방향(라디안) */
export function spawnTierFlair(
  scene: SceneLike, x: number, y: number, hex: number, tier: number,
  fam?: FamKey, angle = 0,
) {
  if (tier < 2) return;
  const full = tier >= 4; // v1.0.13 — 4·5차만 풀 규모, 2~3차는 절제(유저: "나머지는 이펙트를 넣되 약하게")
  /* 2차+ — 광점 팝 (절제판은 희미하게) */
  spawnFlarePop(scene, x, y - 8, "gw_dot", {
    tint: hex, scale: full ? 0.85 : 0.5, duration: full ? 420 : 300, alpha: full ? 0.82 : 0.38,
  });
  /* 3차+ — 계열색 시그니처 마법진 (모든 직업 공통 — v1.0.13 "마법사만 마법진" 해소)
   *  절제판: 반투명 소형 / 풀: 충격 링 + 궤도 스파크 3 동반 */
  if (tier >= 3) {
    spawnMagicCircleGW(scene, x, y, hex, {
      tex: "gw_rune",
      scale: full ? 1.3 : 0.72,
      duration: full ? 840 : 560,
      alpha: full ? 0.66 : 0.28,
    });
    if (full) {
      spawnShockGW(scene, x, y, hex, 2.5, 520);
      for (let i = 0; i < 3; i++) {
        const ang = (Math.PI * 2 * i) / 3 + Phaser.Math.FloatBetween(-0.2, 0.2);
        const sp = vfImage(scene, "gw_spark", x + Math.cos(ang) * 14, y - 8 + Math.sin(ang) * 14, 0xffffff);
        if (!sp) break;
        sp.setAlpha(0.9).setScale(0.16);
        scene.tweens.add({
          targets: sp, x: x + Math.cos(ang) * 78, y: y - 8 + Math.sin(ang) * 78,
          alpha: 0, scale: 0.03, angle: `+${Phaser.Math.Between(60, 160)}`,
          duration: 560, ease: "Cubic.out", onComplete: () => sp.destroy(),
        });
      }
    } else {
      spawnShockGW(scene, x, y, hex, 1.5, 360, 0.3); // 얕은 링 — 절제판
    }
  }
  /* 4차+ — 플레어 + 크리티컬 플래시 (마법진은 위 3차+ 공통 구간에서 이미 합성) */
  if (tier >= 4) {
    spawnFlarePop(scene, x, y - 10, "gw_flare", { tint: 0xffffff, scale: 1.0, duration: 460 });
    const cr = vfImage(scene, "gw_crit", x, y - 8, hex);
    if (cr) {
      cr.setAlpha(0).setScale(0.5);
      scene.tweens.add({ targets: cr, alpha: 0.55, scale: 0.9, duration: 200, ease: "Cubic.out" });
      scene.tweens.add({ targets: cr, alpha: 0, scale: 1.15, delay: 180, duration: 320, ease: "Sine.out", onComplete: () => cr.destroy() });
    }
  }
  /* 5차 각성 — 폭발 코어 + 화염 잔연 (각성의 격 — 벚꽃잎은 v1.0.13 유저 지시로 제거) */
  if (tier >= 5) {
    spawnBoomGW(scene, x, y, hex, 1.15, 520);
    const fire = vfImage(scene, "gw_fire", x, y + 2);
    if (fire) {
      fire.setAlpha(0).setScale(0.7);
      scene.tweens.add({ targets: fire, alpha: 0.5, scale: 0.95, duration: 260, ease: "Cubic.out" });
      scene.tweens.add({ targets: fire, alpha: 0, scale: 1.2, delay: 240, duration: 480, ease: "Sine.out", onComplete: () => fire.destroy() });
    }
  }

  /* 계열 악센트 — 절제판(3차)은 소형 1개, 풀(4·5차)은 전 요소 */
  if (tier >= 3) {
    const ax = x + Math.cos(angle) * 26;
    const ay = y - 8 + Math.sin(angle) * 26;
    if (fam === "warrior") {
      /* 전사 — 조준 방향 초승달 참격 (+풀: 지면 균열) */
      spawnSlashGW(scene, ax, ay, hex, angle, full ? 1.05 : 0.62, full ? 300 : 230);
      if (full) {
        const crack = vfImage(scene, "gw_crack", x, y + 14, 0xffd0a0);
        if (crack) {
          crack.setAlpha(0).setScale(0.5);
          scene.tweens.add({ targets: crack, alpha: 0.5, scale: 0.9, duration: 180, ease: "Cubic.out" });
          scene.tweens.add({ targets: crack, alpha: 0, scale: 1.1, delay: 220, duration: 420, ease: "Sine.out", onComplete: () => crack.destroy() });
        }
      }
    } else if (fam === "ranger") {
      /* 궁수 — 조준 방향 화살 (+풀: 혜성 궤적) */
      const ar = vfImage(scene, "gw_arrow", ax, ay, hex);
      if (ar) {
        const fly = full ? 96 : 58;
        ar.setRotation(angle).setAlpha(0).setScale(full ? 0.7 : 0.5);
        scene.tweens.add({ targets: ar, alpha: full ? 0.9 : 0.45, x: ax + Math.cos(angle) * fly, y: ay + Math.sin(angle) * fly, duration: full ? 300 : 240, ease: "Cubic.out" });
        scene.tweens.add({ targets: ar, alpha: 0, delay: full ? 260 : 220, duration: 200, onComplete: () => ar.destroy() });
      }
      if (full) {
        const tr = vfImage(scene, "gw_trail", ax, ay, hex);
        if (tr) {
          tr.setRotation(angle).setAlpha(0.75).setScale(1.1, 0.9);
          scene.tweens.add({ targets: tr, alpha: 0, scaleX: 1.9, duration: 380, ease: "Sine.out", onComplete: () => tr.destroy() });
        }
      }
    } else if (fam === "mage") {
      /* 마법사 — 계열색 마법진은 위 공통 구간에서 수령 (+풀: 퍼플 오브 마법진·전기 아크·수정 파편) */
      if (full) {
        spawnMagicCircleGW(scene, x, y, hex, { tex: "gw_magic", scale: 0.95, duration: 780, alpha: 0.6 });
        const el = vfImage(scene, "gw_electro", x + Phaser.Math.Between(-18, 18), y - 26, 0xffffff);
        if (el) {
          el.setAlpha(0).setScale(0.55);
          scene.tweens.add({ targets: el, alpha: 0.8, scale: 0.8, duration: 160, ease: "Cubic.out" });
          scene.tweens.add({ targets: el, alpha: 0, scale: 1.0, delay: 160, duration: 260, onComplete: () => el.destroy() });
        }
        for (let i = 0; i < 2; i++) {
          const cy = vfImage(scene, "gw_crystal", x + Phaser.Math.Between(-34, 34), y - Phaser.Math.Between(10, 30), hex);
          if (!cy) break;
          cy.setAlpha(0).setScale(0.2).setRotation(Phaser.Math.FloatBetween(-0.6, 0.6));
          scene.tweens.add({ targets: cy, alpha: 0.85, y: cy.y - Phaser.Math.Between(26, 44), duration: 380, ease: "Cubic.out" });
          scene.tweens.add({ targets: cy, alpha: 0, scale: 0.08, delay: 340, duration: 260, onComplete: () => cy.destroy() });
        }
      } else {
        const el = vfImage(scene, "gw_electro", x + Phaser.Math.Between(-14, 14), y - 22, 0xffffff);
        if (el) {
          el.setAlpha(0).setScale(0.4);
          scene.tweens.add({ targets: el, alpha: 0.4, scale: 0.55, duration: 140, ease: "Cubic.out" });
          scene.tweens.add({ targets: el, alpha: 0, scale: 0.7, delay: 150, duration: 200, onComplete: () => el.destroy() });
        }
      }
    } else if (fam === "thief") {
      /* 도적 — 교차 참격날 (절제판은 1개, 풀은 X자 2개 + 잔상 스트릭) */
      spawnSlashGW(scene, ax, ay, hex, angle + 0.5, full ? 0.95 : 0.58, full ? 280 : 220);
      if (full) {
        spawnSlashGW(scene, ax, ay, 0xffffff, angle - 0.5, 0.85, 300);
        const st = vfImage(scene, "gw_dash", x, y - 6, hex);
        if (st) {
          st.setRotation(angle).setAlpha(0).setScale(0.8);
          scene.tweens.add({ targets: st, alpha: 0.6, scale: 1.05, duration: 160, ease: "Cubic.out" });
          scene.tweens.add({ targets: st, alpha: 0, delay: 160, duration: 240, onComplete: () => st.destroy() });
        }
      }
    }
  }
}
