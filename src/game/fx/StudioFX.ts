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
