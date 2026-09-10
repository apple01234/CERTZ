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

/** 원소 플레어 코어 팝 — 타격/폭발 중심 (베이크드 컬러 텍스처 권장: vf_flare_*) */
export function spawnFlarePop(
  scene: SceneLike, x: number, y: number, tex: string,
  opts: { tint?: number; scale?: number; duration?: number; angle?: number } = {},
) {
  const im = vfImage(scene, tex, x, y, opts.tint);
  if (!im) return;
  if (opts.angle !== undefined) im.setRotation(opts.angle);
  const dur = opts.duration ?? 420;
  const target = opts.scale ?? 1.0;
  im.setAlpha(0).setScale(target * 0.3);
  scene.tweens.add({ targets: im, alpha: 0.82, scale: target, duration: dur * 0.32, ease: "Cubic.out" });
  scene.tweens.add({
    targets: im, alpha: 0, scale: target * 1.3, angle: `+${Phaser.Math.Between(-14, 14)}`,
    delay: dur * 0.3, duration: dur * 0.7, ease: "Sine.out",
    onComplete: () => im.destroy(),
  });
}

/** 확장 링 — 충격파/시전 경계 (vf_ring: 화이트 tint 대응 · vf_ring_void/fire: 베이크드) */
export function spawnRingPop(
  scene: SceneLike, x: number, y: number, tex: string, tint: number,
  toScale = 3.0, duration = 560,
) {
  const im = vfImage(scene, tex, x, y, tint);
  if (!im) return;
  im.setAlpha(0.72).setScale(0.3);
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
 *  Hovl Studio Magic effects · Matthew Guz Slash Effects · Petal Particles 프리렌더 텍스처.
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

/** 충격 링 (gw_shock — Guz Shockwave2, 화이트 틴트 대응) */
export function spawnShockGW(scene: SceneLike, x: number, y: number, tint: number, toScale = 2.6, duration = 520) {
  const im = vfImage(scene, "gw_shock", x, y, tint);
  if (!im) return;
  im.setAlpha(0.78).setScale(0.35);
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

/** 벚꽃잎 소나기 (gw_petal — Petal Particles 셀 크롭) — 튜토리얼 완료/축제 연출. NORMAL 블렌드(꽃잎은 빛이 아님) */
export function spawnPetalStorm(scene: SceneLike, x: number, y: number, count = 10) {
  if (!scene.textures.exists("gw_petal")) return;
  for (let i = 0; i < count; i++) {
    const px = x + Phaser.Math.Between(-130, 130);
    const py = y - Phaser.Math.Between(20, 70);
    const petal = scene.add.image(px, py, "gw_petal") as Img;
    petal.setDepth(26).setScale(Phaser.Math.FloatBetween(0.1, 0.2)).setAlpha(0.92);
    petal.setRotation(Phaser.Math.FloatBetween(-Math.PI, Math.PI));
    const fall = Phaser.Math.Between(90, 150);
    const drift = Phaser.Math.Between(-70, 70);
    scene.tweens.add({
      targets: petal,
      y: py + fall + Phaser.Math.Between(20, 60),
      x: px + drift,
      rotation: `+=${Phaser.Math.FloatBetween(-2.4, 2.4)}`,
      alpha: 0.15,
      duration: Phaser.Math.Between(900, 1500),
      delay: i * 55,
      ease: "Sine.inOut",
      onComplete: () => petal.destroy(),
    });
  }
}

export type FamKey = "warrior" | "ranger" | "mage" | "thief";

/** ═══ N차마다 기존 스킬 강화 (유저 상시 지시) ═══
 *  skill1(주력기)/skill2(기동기)/skill3(3차기) 호출부에서 sTier에 비례해 합성:
 *   t≥2 (2차+)  — 클래스색 광점 팝 + 스파크
 *   t≥3 (3차+)  — 충격 링 확장 + 궤도 스파크 3 + 계열 정체성 악센트
 *   t≥4 (4차+)  — 룬 마법진 스핀(클래스색) + 플레어 + 크리티컬 플래시
 *   t≥5 (5차각성) — 폭발 코어 + 화염 잔연 + 벚꽃잎 6 (각성의 격)
 *  미전직/1차는 기존 연출 유지 — "강화가 체감되는 최소 단계"를 2차로 잡은 하한 설계.
 *  fam: 계열 정체성 악센트 (전사=초승달 참격+지면 균열 / 궁수=화살+혜성 궤적 /
 *       마법사=오브 마법진+수정 파편 / 도적=교차 참격날). angle: 조준 방향(라디안) */
export function spawnTierFlair(
  scene: SceneLike, x: number, y: number, hex: number, tier: number,
  fam?: FamKey, angle = 0,
) {
  if (tier < 2) return;
  /* 2차+ — 광점 팝 */
  spawnFlarePop(scene, x, y - 8, "gw_dot", { tint: hex, scale: 0.85, duration: 420 });
  /* 3차+ — 충격 링 + 궤도 스파크 3 */
  if (tier >= 3) {
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
  }
  /* 4차+ — 룬 마법진 스핀 + 플레어 + 크리티컬 플래시 */
  if (tier >= 4) {
    spawnMagicCircleGW(scene, x, y, hex, { tex: "gw_rune", scale: 1.3, duration: 840, alpha: 0.66 });
    spawnFlarePop(scene, x, y - 10, "gw_flare", { tint: 0xffffff, scale: 1.0, duration: 460 });
    const cr = vfImage(scene, "gw_crit", x, y - 8, hex);
    if (cr) {
      cr.setAlpha(0).setScale(0.5);
      scene.tweens.add({ targets: cr, alpha: 0.55, scale: 0.9, duration: 200, ease: "Cubic.out" });
      scene.tweens.add({ targets: cr, alpha: 0, scale: 1.15, delay: 180, duration: 320, ease: "Sine.out", onComplete: () => cr.destroy() });
    }
  }
  /* 5차 각성 — 폭발 코어 + 화염 잔연 + 벚꽃잎 (각성의 격) */
  if (tier >= 5) {
    spawnBoomGW(scene, x, y, hex, 1.15, 520);
    const fire = vfImage(scene, "gw_fire", x, y + 2);
    if (fire) {
      fire.setAlpha(0).setScale(0.7);
      scene.tweens.add({ targets: fire, alpha: 0.5, scale: 0.95, duration: 260, ease: "Cubic.out" });
      scene.tweens.add({ targets: fire, alpha: 0, scale: 1.2, delay: 240, duration: 480, ease: "Sine.out", onComplete: () => fire.destroy() });
    }
    spawnPetalStorm(scene, x, y, 6);
  }

  /* 계열 정체성 악센트 (3차+에서 합성 — 2차는 광점만으로 절제) */
  if (tier >= 3) {
    const ax = x + Math.cos(angle) * 26;
    const ay = y - 8 + Math.sin(angle) * 26;
    if (fam === "warrior") {
      /* 전사 — 조준 방향 초승달 참격 + 지면 균열 */
      spawnSlashGW(scene, ax, ay, hex, angle, 1.05, 300);
      const crack = vfImage(scene, "gw_crack", x, y + 14, 0xffd0a0);
      if (crack) {
        crack.setAlpha(0).setScale(0.5);
        scene.tweens.add({ targets: crack, alpha: 0.5, scale: 0.9, duration: 180, ease: "Cubic.out" });
        scene.tweens.add({ targets: crack, alpha: 0, scale: 1.1, delay: 220, duration: 420, ease: "Sine.out", onComplete: () => crack.destroy() });
      }
    } else if (fam === "ranger") {
      /* 궁수 — 조준 방향 화살 + 혜성 궤적 */
      const ar = vfImage(scene, "gw_arrow", ax, ay, hex);
      if (ar) {
        ar.setRotation(angle).setAlpha(0).setScale(0.7);
        scene.tweens.add({ targets: ar, alpha: 0.9, x: ax + Math.cos(angle) * 96, y: ay + Math.sin(angle) * 96, duration: 300, ease: "Cubic.out" });
        scene.tweens.add({ targets: ar, alpha: 0, delay: 260, duration: 200, onComplete: () => ar.destroy() });
      }
      const tr = vfImage(scene, "gw_trail", ax, ay, hex);
      if (tr) {
        tr.setRotation(angle).setAlpha(0.75).setScale(1.1, 0.9);
        scene.tweens.add({ targets: tr, alpha: 0, scaleX: 1.9, duration: 380, ease: "Sine.out", onComplete: () => tr.destroy() });
      }
    } else if (fam === "mage") {
      /* 마법사 — 퍼플 오브 마법진 + 전기 아크 + 수정 파편 2 */
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
    } else if (fam === "thief") {
      /* 도적 — 교차 참격날 2 (X자) + 잔상 스트릭 */
      spawnSlashGW(scene, ax, ay, hex, angle + 0.5, 0.95, 280);
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
