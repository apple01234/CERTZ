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
import { loadFx } from "../config";
import {
  classFxOf,
  elemFxOf,
  familyOfClass,
  type ClassFxProfile,
  type ElemFxProfile,
} from "./classFxProfiles";

type CamLike = {
  filters?: {
    external?: {
       
      remove: (filter: any, forceDestroy?: boolean) => unknown;
    };
  } | null;
};
type SceneLike = Phaser.Scene & { textures: Phaser.Textures.TextureManager };

/** 카메라에 서브틀 앰비언트 블룸 부착 — 반환된 필터는 detachAmbientBloom으로 제거.
 *  반환 길이 0 = 미지원 환경(WebGL 아님/필터 불가). 중복 부착은 호출자가 length로 가드.
 *  v1.0.18 — 셰이더 효과 강도 설정 반영: 0이면 부착하지 않고(완전 끄기), 기본값보다
 *  낮은 강도는 blendAmount를 비례 축소해 눈 피로도를 낮춘다 (기본 강도 = 55).
 *  v1.4.13 (#6 셰이더 약화) — 평시 앰비언트 블룸도 눈에 띄게 약화: blendAmount 0.32 → 0.14,
 *  threshold 0.74 → 0.82, blurSteps 3 → 2. 챕터 진입 시 "너무 강해" 체감 해소. */
export function addAmbientBloom(cam: CamLike, opts?: { blurSteps?: number; blendAmount?: number }): unknown[] {
  const out: unknown[] = [];
  try {
    if (!cam.filters) return out;
    const fx = loadFx();
    if (fx.intensity <= 0) return out; // 셰이더 완전 끄기
    /* 보스 블룸(threshold 0.68/blend 0.24~0.30)보다 눈에 덜 띄는 서브틀 프리셋 —
     * 프레임버퍼 패스 1개 추가분이라 모바일 비용은 보스전 대비 가볍다
     * v1.4.13 — 평시 블룸 반강도 (0.14)로 눈부심 없는 서브틀로 축소 */
    const k = Math.min(3.0, fx.intensity / 55); // 55(기본)=1.0 · vc149 #3 상한 1.6→3.0 (200에서 3.0 캡)
    const bloom = Phaser.Actions.AddEffectBloom(cam as unknown as Phaser.Cameras.Scene2D.Camera, {
      threshold: 0.82 + (1 - Math.min(1, k)) * 0.06,
      blurRadius: 1,
      blurSteps: opts?.blurSteps ?? 2,
      blendAmount: (opts?.blendAmount ?? 0.14) * k,
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

/* ---------------- v1.4.32 (지시 #5·#7·#13) — 일반 스킬용 고해상도 임팩트 ---------------- *
 * 궁극기(ultLayers)에만 fx2 고해상도 텍스처가 붙어 있어 1~4차 스킬은 여전히
 * 256px 패턴 이펙트만 써서 같은 화면에서 품질 격차가 났다.
 * 이 함수 하나로 "링(지면 파동) + 히트 섬광(캐릭터 앞)" 2겹을 얹는다.
 *  - 원소별로 이미 쓰던 vf_* 연출은 그대로 두고 **위에 한 겹만** 더한다(제거 없음).
 *  - 피해 판정과 무관한 순수 시각 레이어다(판정은 호출부에서 이미 확정).
 *  - 미로드 텍스처면 조용히 생략 — vfImage 가 null 을 돌려준다.
 */
export function spawnSkillImpact(
  scene: SceneLike, x: number, y: number, tint: number,
  opts: { scale?: number; ringTex?: string; hitTex?: string; ringDep?: number; hitDep?: number;
    /* vc276 — 3단 시점 분리용. 미지정이면 기존과 동일하게 동작한다. */
    stepMs?: number; dustTex?: string; hitDx?: number; hitDy?: number } = {},
) {
  const s = opts.scale ?? 1;
  /* v1.4.33 (긴급수정 — "전사 스킬 사용시 캐릭터 멈추는 버그")
   *  스킬 1·3·4 가 한 번에 2겹씩 만들면 기존 vf_* 연출과 합쳐져 프레임이 끊겼다.
   *  저사양 게이트(__sertzFxLevel===0)에서는 아예 생략하고, 평소에도 1겹만 쓴다. */
  const fxLevel = (() => {
    try { return (scene.game as unknown as { __sertzFxLevel?: number }).__sertzFxLevel ?? 2; } catch { return 2; }
  })();
  if (fxLevel === 0) return;

  /* v1.4.39 (이펙트 강화) — 종전엔 링 1겹(0.4→3.0, 560ms)뿐이라 밋밋했다.
   *  Hovl 텍스처로 교체하면서 **3겹 합성**으로 올린다. 단, 저사양(1)은 링만 유지한다.
   *    ① 확산 링  : 바닥에서 퍼지는 원(기존)
   *    ② 코어 섬광: 중심에서 짧고 강하게 터지는 flash (가산)
   *    ③ 잔류 슬라이스: 진행 방향을 따라 남는 참격 잔상
   *  오브젝트 수는 1 → 3 이지만 수명이 340~560ms 로 짧고, 생성은 스킬 시전 시점 1회뿐이라
   *  매 프레임 생성하지 않는다(멈춤의 원인이던 배라주와 다르다). */
  /* vc276 — 시전/먼지/타격 3단 시점 분리 (ISEKAI GATE `_c`/`_Dust`/`_Hit` 구조 참고)
   *
   *  종전에는 링·코어·슬라이스 3겹이 **전부 t=0** 에 동시에 터졌다. 셋이 겹쳐 한 덩어리로
   *  보였고, "터졌다"는 인상만 남고 "무엇이 어떻게" 남는지가 없었다.
   *
   *  상용 2D 액션(ISEKAI GATE)의 스킬 이펙트는 한 덩어리가 아니라 **시점이 다른 3개**다:
   *    _c    (시전)  t=0    발밑/몸 중심 — 준비 동작을 알린다
   *    _Dust (먼지)  t≈70   발밑에서 옆으로 — 무게를 만든다
   *    _Hit  (타격)  t≈140  전방 — 실제로 맞는 지점
   *  같은 그림을 시점만 옮겨도 "차고 → 내려찍고 → 터진다"로 읽힌다. 새 에셋은 0장.
   *
   *  저사양(fxLevel 1)과 즉발 판정에는 영향을 주지 않는다 — 순수 시각 지연이다.
   *  판정(피해)은 호출부에서 이미 확정되므로 이 지연은 전투 결과를 바꾸지 않는다.
   */
  const stepMs = opts.stepMs ?? 70;
  const delayed = (ms: number, run: () => void) => {
    if (ms <= 0) run();
    else scene.time.delayedCall(ms, run);
  };

  const ring = vfImage(scene, opts.ringTex ?? "hv2_circle2", x, y, tint); // vc232 (#2) fx_Circle2 는 미존재 키
  if (ring) {
    /* vfImage 가 depth 24 를 기본으로 잡으므로 **호출 후** 덮어써야 한다(순서 중요). */
    ring.setDepth(opts.ringDep ?? 6).setAlpha(0.7).setScale(0.4 * s);
    scene.tweens.add({
      targets: ring, scale: 3.0 * s, alpha: 0, duration: 560, ease: "Cubic.out",
      onComplete: () => ring.destroy(),
    });
  }
  if (fxLevel >= 2) {
    /* ② 발밑 먼지 — 링보다 살짝 늦게, 몸에서 옆으로 퍼진다. 무게 담당.
     *    hv2_smoke26 은 회색 연기라 tint 로 클래스색을 옅게만 얹는다. */
    delayed(stepMs, () => {
      const dust = vfImage(scene, opts.dustTex ?? "hv2_smoke26", x, y + 4, tint);
      if (!dust) return;
      dust.setDepth((opts.ringDep ?? 6) + 1).setAlpha(0.42).setScale(0.34 * s)
        .setAngle(Phaser.Math.Between(-18, 18));
      scene.tweens.add({
        targets: dust, scale: 0.92 * s, alpha: 0, duration: 380, ease: "Quad.out",
        onComplete: () => dust.destroy(),
      });
    });
    /* ③ 타격 — 전방으로 살짝 밀어 배치. 링/먼지가 깔린 뒤에 터져야 "맞은 지점"으로 읽힌다. */
    delayed(stepMs * 2, () => {
      const core = vfImage(scene, "vf_impact", x + (opts.hitDx ?? 0), y + (opts.hitDy ?? 0), 0xffffff);
      if (core) {
        core.setDepth(opts.hitDep ?? 23).setAlpha(0.85).setScale(0.22 * s)
          .setBlendMode(Phaser.BlendModes.ADD);
        scene.tweens.add({
          targets: core, scale: 0.9 * s, alpha: 0, duration: 280, ease: "Quad.out",
          onComplete: () => core.destroy(),
        });
      }
      /* 참격 잔상 — 회전하며 옅게 남는다. 스킬마다 방향이 달라도 자연스럽게 겹친다. */
      const slice = vfImage(scene, "vf_slash", x + (opts.hitDx ?? 0), y + (opts.hitDy ?? 0), tint);
      if (slice) {
        slice.setDepth((opts.hitDep ?? 23) - 1).setAlpha(0.6).setScale(0.7 * s)
          .setAngle(-24).setBlendMode(Phaser.BlendModes.ADD);
        scene.tweens.add({
          targets: slice, angle: 24, scale: 1.35 * s, alpha: 0, duration: 420, ease: "Sine.out",
          onComplete: () => slice.destroy(),
        });
      }
    });
  }
  /* 히트 섬광은 궁극기에서만 쓴다 — 일반 스킬은 위 3겹으로 충분(부하 절감). */
  if (opts.hitTex === undefined) return;
  delayed(stepMs * 2, () => {
    const hit = vfImage(scene, opts.hitTex as string, x + (opts.hitDx ?? 0), y + (opts.hitDy ?? 0), tint);
    if (!hit) return;
    hit.setDepth(opts.hitDep ?? 23).setAlpha(0.9).setScale(0.35 * s);
    scene.tweens.add({
      targets: hit, scale: 1.9 * s, alpha: 0, duration: 340, ease: "Quad.out",
      onComplete: () => hit.destroy(),
    });
  });
}

/* ---------------- 5차 궁극기 공통 인트로 (마법진+링+코어 4중 합성) ----------------
 * 기존: 단색 원 링 1개 + 파티클 버스트 → "밋밋하다"는 유저 지시.
 * 신규: 3D 프리렌더 펜타클(클래스 컬러 틴트·스핀) + 이중 확장 링 + 임팩트 코어 + 4방향 스파크
 * v1.4.39 (이펙트 강화) — 저사양 게이트 도입 + Hovl 텍스처. 종전엔 게이트가 없어
 *  저사양 기기에서도 궁극기마다 6~8겹을 만들어 프레임이 끊겼다(멈춤 신고의 잔여 원인).
 *  이제 fxLevel 0=생략 / 1=3겹 / 2=풀(6겹 + 스모크 잔향)으로 나눈다. */
export function spawnUltimateIntro(scene: SceneLike, x: number, y: number, tint: number) {
  const fxLevel = (() => {
    try { return (scene.game as unknown as { __sertzFxLevel?: number }).__sertzFxLevel ?? 2; } catch { return 2; }
  })();
  if (fxLevel === 0) return;

  spawnPentacle(scene, x, y, tint, { scale: 1.25, duration: 1000, spin: true, alpha: 0.62 });
  spawnRingPop(scene, x, y, "vf_ring", tint, 2.4, 720);
  spawnRingPop(scene, x, y, "vf_ring", 0xffffff, 1.6, 520);
  spawnFlarePop(scene, x, y - 4, "vf_impact", { tint, scale: 0.9, duration: 560 });
  if (fxLevel < 2) return;
  /* 5겹·6겹 — 풀 연출에서만. 짧은 수명(420~620ms)이라 프레임 부담이 제한적이다. */
  spawnRingPop(scene, x, y, "vf_ring", tint, 3.1, 900);           // 3차 확산(가장 느린 외곽)
  spawnFlarePop(scene, x, y, "vf_star", { tint: 0xffffff, scale: 0.5, duration: 420 });
  /* ⑥ 잔향 — 축복/심판 계열은 스모크가 남아 "여파"가 보인다. */
  const haze = vfImage(scene, "vf_flare_dark", x, y, tint);
  if (haze) {
    haze.setDepth(5).setAlpha(0.28).setScale(1.1).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: haze, scale: 2.6, alpha: 0, duration: 1100, ease: "Cubic.out",
      onComplete: () => haze.destroy(),
    });
  }
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

/* ═══════════════ vc147 (#14) — 계열별 지면 시그니처 (마법진 우려먹기 개선) ═══════════════
 *  유저 지시: "마법진 우려먹지마!! 마법사만 거의 마법진 사용하고 나머지는 내가 준 200가지
 *  이상의 고급 에셋을 적극 사용해" — 전 직업 궁극기 인트로가 같은 펜타클을 썼던 것을
 *  계열별 고유 지면 연출로 분화한다. 마법사만 마법진을 유지.
 *  · warrior  — 대지 균열(gw_crack 데칼) + Guz 충격링(gw_shock) + 공헌 균열 링
 *  · ranger   — 화살 부채꼴(vf_arrow 3방향) + 질주 잔상(gw_dash) + 바람 아크(gw_arc)
 *  · thief    — 공허 링(vf_ring_void) + 섬광(gw_flash) + 결정 파편(gw_crystal 5방)
 *  · pirate   — 대폭발 코어(mg_explode) + 골드 스파크(gw_spark 6방) + 충격링(gw_shock)
 *  · mage/기타 — 기존 마법진(vf_pentacle) 유지 */
export function spawnGroundSig(scene: SceneLike, x: number, y: number, fam: FamKey | "pirate" | "default", tint: number, scale = 1) {
  if (fam === "warrior") {
    const crack = vfImage(scene, "gw_crack", x, y + 8, 0xffb090);
    if (crack) {
      crack.setAlpha(0).setScale(0.4 * scale);
      scene.tweens.add({ targets: crack, alpha: 0.85, scale: 1.1 * scale, duration: 260, ease: "Cubic.out" });
      scene.tweens.add({ targets: crack, alpha: 0, scale: 1.3 * scale, delay: 620, duration: 420, onComplete: () => crack.destroy() });
    }
    spawnRingPop(scene, x, y, "gw_shock", tint, 2.6 * scale, 620);
    spawnRingPop(scene, x, y, "vf_ring_void", 0xff8050, 1.5 * scale, 480);
  } else if (fam === "ranger") {
    for (let i = 0; i < 3; i++) {
      const ang = -Math.PI / 2 + (i - 1) * 0.55;
      const a = vfImage(scene, "vf_arrow", x, y, tint);
      if (!a) break;
      a.setAlpha(0.9).setScale(0.9 * scale).setRotation(ang + Math.PI / 2);
      scene.tweens.add({
        targets: a, x: x + Math.cos(ang) * 70 * scale, y: y + Math.sin(ang) * 70 * scale,
        alpha: 0, duration: 460, delay: i * 60, ease: "Cubic.out", onComplete: () => a.destroy(),
      });
    }
    const dash = vfImage(scene, "gw_dash", x, y, 0xffffff);
    if (dash) {
      dash.setAlpha(0.75).setScale(0.7 * scale);
      scene.tweens.add({ targets: dash, alpha: 0, scale: 1.5 * scale, duration: 420, onComplete: () => dash.destroy() });
    }
    spawnRingPop(scene, x, y, "gw_arc", tint, 2.2 * scale, 560);
  } else if (fam === "thief") {
    spawnRingPop(scene, x, y, "vf_ring_void", 0xb08aff, 2.6 * scale, 700);
    const fl = vfImage(scene, "gw_flash", x, y - 6, 0xcabaff);
    if (fl) {
      fl.setAlpha(0.95).setScale(0.5 * scale);
      scene.tweens.add({ targets: fl, alpha: 0, scale: 1.4 * scale, duration: 300, ease: "Cubic.out", onComplete: () => fl.destroy() });
    }
    for (let i = 0; i < 5; i++) {
      const ang = (Math.PI * 2 * i) / 5 + 0.5;
      const c = vfImage(scene, "gw_crystal", x, y, 0xa88aff);
      if (!c) break;
      c.setAlpha(0.9).setScale(0.3 * scale).setRotation(ang);
      scene.tweens.add({
        targets: c, x: x + Math.cos(ang) * 62 * scale, y: y + Math.sin(ang) * 46 * scale,
        alpha: 0, scale: 0.08, rotation: ang + 1.4, duration: 520, ease: "Quad.out", onComplete: () => c.destroy(),
      });
    }
  } else if (fam === "pirate") {
    const ex = vfImage(scene, "mg_explode", x, y, 0xffe0a0);
    if (ex) {
      ex.setAlpha(0.9).setScale(0.5 * scale);
      scene.tweens.add({ targets: ex, alpha: 0, scale: 1.35 * scale, duration: 480, ease: "Cubic.out", onComplete: () => ex.destroy() });
    }
    spawnRingPop(scene, x, y, "gw_shock", 0xffd76a, 2.4 * scale, 600);
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI * 2 * i) / 6;
      const s = vfImage(scene, "gw_spark", x, y, 0xffd76a);
      if (!s) break;
      s.setAlpha(0.95).setScale(0.34 * scale);
      scene.tweens.add({
        targets: s, x: x + Math.cos(ang) * 78 * scale, y: y + Math.sin(ang) * 56 * scale,
        alpha: 0, scale: 0.06, duration: 500, ease: "Cubic.out", onComplete: () => s.destroy(),
      });
    }
  } else {
    /* mage/default — 마법진 유지 (마법사의 정체성) */
    spawnPentacle(scene, x, y, tint, { scale: 1.25 * scale, duration: 1000, spin: true, alpha: 0.62 });
  }
}

/** 계열별 궁극기 인트로 — 공통 링/코어/스파크는 유지하되 지면 연출만 계열 시그니처로 교체.
 *  (vc147 #14 — 전 직업 동일 펜타클 "마법진 우려먹기" 해소)
 *  아이템 14 — `cls` 를 넘기면 계열 시그니처 **위에** 직업 고유 악센트를 한 겹 더한다
 *  (궁극기는 최저빈도·최대연출 지점이라 여기만 풀 강도). 생략 시 종전과 완전 동일. */
export function spawnUltIntroSig(scene: SceneLike, x: number, y: number, tint: number, fam: FamKey | "pirate" | "default", cls?: string | null) {
  spawnGroundSig(scene, x, y, fam, tint, 1.0);
  spawnRingPop(scene, x, y, "vf_ring", tint, 2.4, 720);
  spawnRingPop(scene, x, y, "vf_ring", 0xffffff, 1.6, 520);
  spawnFlarePop(scene, x, y - 4, "vf_impact", { tint, scale: 0.9, duration: 560 });
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
  /* 직업 고유 악센트 — 궁극기 전용. cls 미지정이면 씬 playerRef 에서 자동 보정. */
  const clsKey = cls ?? (() => {
    try {
      const p = (scene as unknown as { playerRef?: { cls?: string | null } | null }).playerRef;
      return p?.cls ?? null;
    } catch { return null; }
  })();
  spawnClassAccent(scene, x, y, clsKey, tint, 1.0, 0);
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
  fam?: FamKey, angle = 0, major = false, cls?: string | null,
) {
  if (tier < 2) return;
  /* v1.4.30 (#6 5차 공통 이펙트 축소) — major(중요 스킬: 4차기·필살기)일 때만 4·5차 풀 패키지.
   *  Z/C/V 일반 스킬은 5차여도 3차 수준 경량판 — "모든 스킬에 공통 이펙트가 과하다" 완화 */
  const full = tier >= 4 && major; // v1.0.13 — 4·5차만 풀 규모 → v1.4.30 major 게이트 추가
  /* 아이템 14 — 직업 35종 고유 악센트. 계열 base 위에 한 겹만 얹는다(하위호환: cls 미지정 시 무동작).
   *  호출부가 cls 를 넘기지 않아도, 씬의 playerRef 에서 읽어 자동 보정한다. */
  const clsKey = cls ?? (() => {
    try {
      const p = (scene as unknown as { playerRef?: { cls?: string | null } | null }).playerRef;
      return p?.cls ?? null;
    } catch { return null; }
  })();
  /* 2차+ — 광점 팝 (절제판은 희미하게) */
  spawnFlarePop(scene, x, y - 8, "gw_dot", {
    tint: hex, scale: full ? 0.85 : 0.5, duration: full ? 420 : 300, alpha: full ? 0.82 : 0.38,
  });
  /* 3차+ — 계열별 시그니처 (v1.0.16 — 유저 "다 너무 마법진 이펙트로 우려먹는 느낌" 해소:
   *  v1.0.13의 전 직업 공통 룬 마법진을 폐지하고 마법사만 마법진 정체성을 유지한다.
   *  전사=대지 충격 링 / 궁수=질풍 링 / 도적=그림자 스트릭 / 마법사=룬 마법진.
   *  4차 풀 규모 공통 연출(충격 링+궤도 스파크)은 계열색 그대로 유지) */
  if (tier >= 3) {
    if (fam === "mage") {
      /* 마법사 — 유일하게 마법진 시그니처 유지 (절제판: 반투명 소형) */
      spawnMagicCircleGW(scene, x, y, hex, {
        tex: "gw_rune",
        scale: full ? 1.3 : 0.72,
        duration: full ? 840 : 560,
        alpha: full ? 0.66 : 0.28,
      });
      if (!full) spawnShockGW(scene, x, y, hex, 1.5, 360, 0.3); // 얕은 링 — 절제판
    } else if (fam === "ranger") {
      /* 궁수 — 질풍 링 (바람이 원을 그리며 퍼지는 경쾌한 기동감) */
      spawnShockGW(scene, x, y, 0x9dffc4, full ? 2.1 : 1.45, full ? 470 : 340, full ? 0.55 : 0.3);
    } else if (fam === "thief") {
      /* 도적 — 그림자 스트릭 (조준 방향으로 지나가는 암흑 잔상) */
      const st = vfImage(scene, "gw_dash", x, y - 6, hex);
      if (st) {
        st.setRotation(angle).setAlpha(0).setScale(full ? 1.0 : 0.68);
        scene.tweens.add({ targets: st, alpha: full ? 0.62 : 0.34, scale: full ? 1.18 : 0.85, duration: 170, ease: "Cubic.out" });
        scene.tweens.add({ targets: st, alpha: 0, delay: 170, duration: 250, onComplete: () => st.destroy() });
      }
      if (!full) spawnShockGW(scene, x, y, hex, 1.35, 320, 0.24);
    } else {
      /* 전사(기본) — 대지 충격 링 (무게감 있는 지진 파동) */
      spawnShockGW(scene, x, y, hex, full ? 2.3 : 1.5, full ? 500 : 350, full ? 0.6 : 0.3);
    }
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
    }
  }
  /* 4차+ — 플레어 + 크리티컬 플래시 (major만 — v1.4.30 #6) */
  if (tier >= 4 && major) {
    spawnFlarePop(scene, x, y - 10, "gw_flare", { tint: 0xffffff, scale: 1.0, duration: 460 });
    const cr = vfImage(scene, "gw_crit", x, y - 8, hex);
    if (cr) {
      cr.setAlpha(0).setScale(0.5);
      scene.tweens.add({ targets: cr, alpha: 0.55, scale: 0.9, duration: 200, ease: "Cubic.out" });
      scene.tweens.add({ targets: cr, alpha: 0, scale: 1.15, delay: 180, duration: 320, ease: "Sine.out", onComplete: () => cr.destroy() });
    }
  }
  /* 5차 각성 — 폭발 코어 + 화염 잔연 (major만 — v1.4.30 #6, 각성의 격은 중요 스킬에만) */
  if (tier >= 5 && major) {
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

  /* ══ 아이템 14 — 직업 고유 악센트 (계열 base 위 한 겹) ══
   *  스킬 전용 경로에서만 호출된다(tierFlair 는 Z/V/B 스킬 4곳에서만 쓰임 —
   *  기본공격/적 처치 경로에서는 호출되지 않는다). 강도는 티어에 비례해
   *  3차 절제 / 4차+ 풀. 계열 base 연출은 위에서 이미 그려졌으므로 여기선 더하지 않고 얹기만 한다. */
  spawnClassAccent(scene, x, y, clsKey, hex, full ? 1.0 : 0.62, angle);
}

/* ═══════════════ v1.4.0 (Task 3-1 — 유저 지시 #13) — 5차 궁극기 클래스별 고유 시그니처 ═══════════════
 *  유저 지시 "4·5차가 스킬+마법진뿐" 개선: 8직업 궁극기마다 서로 다른 VFX2 팩 에셋으로
 *  고유 연출을 부여한다 — 같은 이펙트 재활용 0건 (직업별 1:1 매핑).
 *  데이터: docs/skill-asset-mapping.md */
type UltKey = string;

/** 클래스별 궁극기 고유 연출 — vfx2 팩 에셋 1:1 매핑 (텍스처 미로드 시 조용히 생략) */
export function spawnUltFlourish(scene: SceneLike, x: number, y: number, key5: UltKey, tint: number) {
  /* vc185 (지시 #2 — 5차 스킬 사용 시 게임 멈춤) — 동시 생성 캡.
   *  이 함수는 한 번 호출에 오브젝트를 23개 만든다. 궁극기 직후 제2궁극기를 연달아 쓰면
   *  70개 이상이 한 프레임에 몰려 300ms 넘는 스파이크가 났다(실측 max 313ms).
   *  기기 성능과 무관하게 프레임이 튀지 않도록, 최근 1.6초 안에 이미 연출했으면
   *  가벼운 버전(오브젝트 1/3)으로 대체한다. 연출이 아예 사라지지는 않는다. */
  const g = globalThis as unknown as { __sertzLastFlourish?: number };
  const now = (() => { try { return (scene as unknown as { time: { now: number } }).time.now; } catch { return 0; } })();
  const throttled = typeof g.__sertzLastFlourish === "number" && now - g.__sertzLastFlourish < 1600;
  g.__sertzLastFlourish = now;

  const orbit = (tex: string, count: number, radius: number, scale: number, alpha = 0.9, spinMs = 1500) => {
    if (throttled) count = Math.max(1, Math.round(count / 3)); // 연속 시전 시 1/3로 감축

    const imgs: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < count; i++) {
      const im = scene.add.image(x, y, tex) as Phaser.GameObjects.Image;
      if (!im.texture || im.texture.key === "__MISSING") { im.destroy(); return; }
      im.setDepth(30).setBlendMode(Phaser.BlendModes.ADD).setAlpha(alpha).setScale(scale);
      imgs.push(im);
    }
    const t0 = scene.time.now;
    const ev = scene.time.addEvent({
      delay: 16, repeat: Math.ceil(spinMs / 16),
      callback: () => {
        const p = (scene.time.now - t0) / spinMs;
        imgs.forEach((im, i) => {
          const a = p * Math.PI * 2 + (i / imgs.length) * Math.PI * 2;
          im.setPosition(x + Math.cos(a) * radius, y + Math.sin(a) * radius * 0.55);
          im.setAlpha(alpha * (1 - p));
        });
      },
      callbackScope: scene,
    });
    scene.time.delayedCall(spinMs + 30, () => { ev.remove(); imgs.forEach((im) => im.destroy()); });
  };
  const flashSprite = (tex: string, scale: number, dur: number, t = tint, yOff = 0) => {
    const im = scene.add.image(x, y + yOff, tex) as Phaser.GameObjects.Image;
    if (!im.texture || im.texture.key === "__MISSING") { im.destroy(); return; }
    im.setDepth(29).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setScale(scale * 0.4);
    scene.tweens.add({ targets: im, alpha: 0.95, scale, duration: dur * 0.3, ease: "Cubic.out" });
    scene.tweens.add({ targets: im, alpha: 0, scale: scale * 1.25, delay: dur * 0.3, duration: dur * 0.7, onComplete: () => im.destroy() });
  };

  switch (key5) {
    case "warbringer": // 천멸극 — 참격 십자 궤적 + 붉은 스플래시 (vfx_slash_m·vfx_splat)
      flashSprite("vfx_slash_m", 2.6, 620, 0xffb08a);
      flashSprite("vfx_splat", 1.8, 700, 0xff7a5a, -14);
      orbit("vfx_slash", 3, 74, 0.9, 0.85, 1300);
      break;
    case "crusader": // 성흔극 — 성스러운 삼중 링 + 빛 기둥 플래시 (vfx_ring1·vfx_flash)
      flashSprite("vfx_flash", 2.2, 560, 0xffe9a0);
      orbit("vfx_ring1", 3, 64, 0.7, 0.8, 1600);
      break;
    case "deadeye": // 신시극 — 화살 파티클 소용돌이 + 크리티컬 십자 (vfx_arrowp·vfx_crit)
      flashSprite("vfx_crit", 1.9, 520, 0xffe66a);
      orbit("vfx_arrowp", 5, 82, 0.75, 0.9, 1200);
      break;
    case "skylord": // 궁극 폭풍 — 설풍 소용돌이 + 클라우드 링 (vfx_snow·vfx_cl1)
      flashSprite("vfx_cl1", 2.4, 640, 0x9fd8ff);
      orbit("vfx_cl1", 5, 90, 0.7, 0.85, 1400); // vc234 (#1) vfx_snow(비/눈) 제거 — 구름 소용돌이로
      break;
    case "arclord": // 아르카나 — 크리스탈 붕괴 + 마나 링 (vfx_crystal·vfx_ring3)
      flashSprite("vfx_crystal", 2.0, 700, 0xc08aff);
      orbit("vfx_ring3", 3, 70, 0.65, 0.8, 1500);
      break;
    case "eternal": // 영원의 고리 — 룬 육각형 궤도 + 시간 트윙클 (vfx_hex·vfx_twinkle)
      flashSprite("vfx_hex", 1.7, 900, 0x7de8ff);
      orbit("vfx_twinkle", 4, 78, 0.5, 0.9, 1800);
      break;
    case "shadowlord": // 그림자 군주 — 잔상 분신 3체 방사 (vfx_ist·vfx_is2)
      flashSprite("vfx_ist", 1.8, 620, 0x9a7aff);
      orbit("vfx_is2", 4, 86, 0.55, 0.8, 1350);
      break;
    case "blademaster": // 검무 — 아크 검기 4연 회전 (vfx_arc·vfx_slash_turn)
      flashSprite("vfx_slash_turn", 2.4, 560, tint);
      orbit("vfx_arc", 4, 80, 0.7, 0.9, 1100);
      break;
    /* vc232 (#12 "5차 스킬 끝나고 후속 이펙트가 전 직업이 같고 너무 짜침")
     *  [원인] 궁극기 보유 직업은 **4차 10직업**(ULT_CLASSES)뿐인데 이 switch 는
     *   8개만 처리했다. 빠진 둘은 **해적 계열 seaking·dreadnought** 로,
     *   이 둘만 default(vfx_explosion + vfx_pt1)로 떨어져 다른 직업과 똑같은
     *   연출이 나왔다. 10직업 전부 자기 연출을 갖도록 나머지 둘을 채운다. */
    case "seaking":      // 해신 — 심해 소용돌이 + 물기둥
      /* vc234 (#1 "궁극기 후딜에 비내리는 듯한 이펙트 그거 쓰지마")
       *  vfx_snow 는 위에서 눈/비가 흩날리는 텍스처라 '비 내리는' 인상을 준다.
       *  물 계열이지만 물기둥·소용돌이로 읽혀야 하므로 snow 를 쓰지 않는다. */
      flashSprite("vfx_ring3", 2.4, 680, tint);
      orbit("vfx_crystal", 4, 88, 0.8, 0.85, 1500);
      break;
    case "dreadnought":  // 드레드노트 — 중갑 충격 + 포연
      flashSprite("vfx_explosion", 2.8, 700, tint);
      orbit("vfx_splat", 6, 96, 0.85, 0.9, 1300);
      break;
    default: // 궁극기 없는 직업의 안전 폴백(도달하지 않음) // 계열 폴백(전사/궁수/마법사/도적) — 계열색 코어 플래시 + 링
      flashSprite("vfx_explosion", 2.0, 620, tint);
      orbit("vfx_pt1", 4, 76, 0.6, 0.8, 1400);
      break;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 아이템 14 — 직업 35종 / 몬스터 원소 9종 pixel FX 매칭
 *
 * [왜 계열 5종으로 부족한가]
 *  위의 `spawnGroundSig`/`spawnTierFlair`/`spawnUltFlourish` 는 계열(warrior/ranger/
 *  mage/thief/pirate) 또는 4차 직업 10종까지만 분기한다. 그런데 실제 직업은 35개이고
 *  같은 계열 안에서도 warbringer(참격) ↔ crusader(심판의 빛),
 *  arclord(크리스탈) ↔ eternal(시간) 처럼 정체성이 정반대다.
 *
 * [설계 — 기존 계열 시스템을 대체하지 않는다]
 *  계열 base 연출은 **그대로 두고**, 그 위에 직업 고유 악센트를 한 겹 얹는다.
 *  따라서 기존 exported 함수 시그니처는 하나도 바뀌지 않는다(하위 호환 100%).
 *  새 호출부는 아래 두 함수만 쓰면 된다.
 *
 * [안전]
 *  모든 텍스처는 `vfImage()` 를 거치며, 이 함수가 `textures.exists` 로 미로드 키를
 *  걸러낸다(`StudioFX.ts:64`). 미로드 시 조용히 null → 연출 생략. 검은 __MISSING 박스 없음.
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 직업 고유 악센트를 계열 base 연출 위에 얹는다.
 *
 * **스킬 전용**이다. 기본공격/적 처치 등 고빈도 지점에서 호출하지 말 것
 * (AGENTS.md: "자주 호출되는 지점은 절대 과하게").
 *
 * @param cls   직업 키 (`classes.ts` ClassKey). 미등록/null 이면 아무것도 안 한다.
 * @param hex   직업 계통색 (미지정 시 프로파일 tint → 없으면 흰색)
 * @param scale 강도 배율 (호출부 티어에 맞춰 0.6~1.2 권장)
 */
export function spawnClassAccent(
  scene: SceneLike, x: number, y: number, cls: string | null | undefined,
  hex: number, scale = 1, angle = 0,
) {
  const p = classFxOf(cls);
  if (!p) return; // 계열 base 만으로 충분 — 중복 연출 금지
  const tint = p.tint ?? hex;
  const s = scale * p.weight;

  /* 저사양 게이트 — 기존 spawnTierFlair 와 동일 규약(__sertzFxLevel===0 이면 생략) */
  const fxLevel = (() => {
    try { return (scene.game as unknown as { __sertzFxLevel?: number }).__sertzFxLevel ?? 2; } catch { return 2; }
  })();
  if (fxLevel === 0) return;

  /* 형태별 궤적 — 같은 텍스처라도 움직임이 다르면 다르게 읽힌다 */
  switch (p.shape) {
    case "slash": {
      const im = vfImage(scene, p.accent, x + Math.cos(angle) * 24, y - 6 + Math.sin(angle) * 24, tint);
      if (im) {
        im.setRotation(angle).setAlpha(0).setScale(s * 0.55);
        scene.tweens.add({ targets: im, alpha: 0.85, scale: s * 1.05, duration: 160, ease: "Cubic.out" });
        scene.tweens.add({ targets: im, alpha: 0, scale: s * 1.3, delay: 160, duration: 240, ease: "Sine.out", onComplete: () => im.destroy() });
      }
      break;
    }
    case "burst": {
      spawnFlarePop(scene, x, y - 6, p.accent, { tint, scale: s * 0.95, duration: 420, alpha: 0.8 });
      break;
    }
    case "ring": {
      spawnRingPop(scene, x, y, p.accent, tint, 2.0 * s, 460, 0.6);
      break;
    }
    case "beam": {
      const im = vfImage(scene, p.accent, x, y - 8, tint);
      if (im) {
        const fly = 74 * s;
        im.setRotation(angle).setAlpha(0).setScale(s * 0.6);
        scene.tweens.add({ targets: im, alpha: 0.9, x: x + Math.cos(angle) * fly, y: y - 8 + Math.sin(angle) * fly, duration: 260, ease: "Cubic.out" });
        scene.tweens.add({ targets: im, alpha: 0, delay: 240, duration: 200, onComplete: () => im.destroy() });
      }
      break;
    }
    case "orbit": {
      /* 3~5개가 원을 그리며 퍼진다 — 소수만 쓴다(과밀 금지) */
      const n = fxLevel >= 2 ? 4 : 2;
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + angle;
        const im = vfImage(scene, p.accent, x, y - 6, tint);
        if (!im) break;
        im.setAlpha(0.9).setScale(s * 0.28);
        scene.tweens.add({
          targets: im, x: x + Math.cos(a) * 62 * s, y: y - 6 + Math.sin(a) * 44 * s,
          alpha: 0, scale: s * 0.08, duration: 480, ease: "Cubic.out", onComplete: () => im.destroy(),
        });
      }
      break;
    }
    case "pillar": {
      const im = vfImage(scene, p.accent, x, y - 18, tint);
      if (im) {
        im.setAlpha(0).setScale(s * 0.5);
        scene.tweens.add({ targets: im, alpha: 0.8, scaleY: s * 1.5, scaleX: s * 0.85, duration: 220, ease: "Cubic.out" });
        scene.tweens.add({ targets: im, alpha: 0, scaleY: s * 1.9, delay: 220, duration: 380, ease: "Sine.out", onComplete: () => im.destroy() });
      }
      break;
    }
    case "shard": {
      const n = fxLevel >= 2 ? 5 : 3;
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + 0.4;
        const im = vfImage(scene, p.accent, x, y - 4, tint);
        if (!im) break;
        im.setAlpha(0.9).setScale(s * 0.26).setRotation(a);
        scene.tweens.add({
          targets: im, x: x + Math.cos(a) * 56 * s, y: y - 4 + Math.sin(a) * 42 * s,
          alpha: 0, scale: s * 0.06, rotation: a + 1.4, duration: 500, ease: "Quad.out", onComplete: () => im.destroy(),
        });
      }
      break;
    }
    case "wave": {
      spawnRingPop(scene, x, y, p.accent, tint, 1.8 * s, 520, 0.55);
      if (p.accent2) spawnRingPop(scene, x, y, p.accent2, tint, 2.4 * s, 620, 0.35);
      break;
    }
  }

  /* 보조 악센트 — 주 악센트가 끝나갈 때 한 번만(과밀 방지) */
  if (p.accent2 && p.shape !== "wave" && fxLevel >= 2) {
    const im2 = vfImage(scene, p.accent2, x, y - 4, tint);
    if (im2) {
      im2.setAlpha(0).setScale(s * 0.4).setBlendMode(Phaser.BlendModes.ADD);
      scene.tweens.add({ targets: im2, alpha: 0.55, scale: s * 0.9, duration: 200, delay: 90, ease: "Cubic.out" });
      scene.tweens.add({ targets: im2, alpha: 0, scale: s * 1.1, delay: 290, duration: 260, onComplete: () => im2.destroy() });
    }
  }
}

/**
 * 몬스터 **원소**에 맞는 FX. `Enemy.elem` + `data.ts:1296 ELEMENT_META` 기반.
 *
 * `Enemy.ts` 는 편집 범위 밖이므로, 이 함수를 **호출부에서** 연결해야 한다.
 * 권장 호출 지점(리드가 연결):
 *   · `Enemy.ts:865`  — 속성 틴트 적용 지점 바로 옆
 *   · `Enemy.ts:870-890` — 원소 반응(reaction) 발동 블록
 *
 * **적 피격/사망 지점은 강도를 낮게 유지한다** — `scale` 기본값 0.55 는
 * 기본공격·처치가 초당 수 회 발생하는 것을 전제한 값이다. 스킬 수준으로 올리지 말 것.
 *
 * @param elem  `ElemKey` 또는 한글 별칭. 미지 값은 none 프로파일로 폴백.
 * @param scale 강도 (기본 0.55 — 고빈도 지점 전제. 반드시 1.0 미만 유지 권장)
 */
export function spawnEnemyElemFx(
  scene: SceneLike, x: number, y: number, elem: string | null | undefined,
  tint: number, scale = 0.55,
) {
  const p: ElemFxProfile = elemFxOf(elem);

  const fxLevel = (() => {
    try { return (scene.game as unknown as { __sertzFxLevel?: number })?.__sertzFxLevel ?? 2; } catch { return 2; }
  })();
  if (fxLevel === 0) return;

  const s = scale * p.weight;
  switch (p.shape) {
    case "burst":
      spawnFlarePop(scene, x, y - 4, p.tex, { tint, scale: s * 0.8, duration: 300, alpha: 0.5 });
      break;
    case "ring":
      spawnRingPop(scene, x, y, p.tex, tint, 1.3 * s, 340, 0.35);
      break;
    case "pillar": {
      const im = vfImage(scene, p.tex, x, y - 14, tint);
      if (im) {
        im.setAlpha(0).setScale(s * 0.45);
        scene.tweens.add({ targets: im, alpha: 0.55, scaleY: s * 1.2, duration: 180, ease: "Cubic.out" });
        scene.tweens.add({ targets: im, alpha: 0, delay: 180, duration: 260, onComplete: () => im.destroy() });
      }
      break;
    }
    case "orbit": {
      const im = vfImage(scene, p.tex, x, y - 4, tint);
      if (im) {
        im.setAlpha(0.7).setScale(s * 0.3);
        scene.tweens.add({ targets: im, alpha: 0, scale: s * 0.6, y: y - 22, duration: 340, ease: "Cubic.out", onComplete: () => im.destroy() });
      }
      break;
    }
    case "wave":
      spawnRingPop(scene, x, y, p.tex, tint, 1.5 * s, 380, 0.3);
      break;
    case "shard":
      spawnRingPop(scene, x, y, p.tex, tint, 1.1 * s, 320, 0.3);
      break;
  }
}

/* ═══════════════════════════════════════════════════════════════
 * vc239 (지시 #2·#12) — PixelLab 생성 VFX 재생.
 *
 * [왜 별도 함수인가] 위의 spawnEnemyElemFx / spawnClassAccent 는 기존 vfx2/vfx3
 *  단일 이미지를 쓰는 경로다. 여기 3종은 **다중 프레임 아틀라스**(gif→시트 변환)라
 *  Phaser animation 으로 재생해야 한다. 섞으면 기존 연출이 깨진다.
 *
 * [규격] public/assets/vc239/<key>.png + .json (프레임 이름 <key>__<n>)
 *  프레임 수는 생성 시 자동 결정되므로 textures.json 으로 실측해 애니를 만든다.
 *  캔버스 크기가 서로 달라(75x182 / 128x128 / 224x195) scale 로 정규화한다.
 * ═══════════════════════════════════════════════════════════════ */
const VC239_VFX_KEYS = ["vfx_holy_judgement", "vfx_void_collapse", "vfx_tidal_wave"] as const;
export type Vc239FxKey = (typeof VC239_VFX_KEYS)[number];

/** 아틀라스에서 프레임 이름 목록을 읽어 `<key>-anim` 을 1회 등록한다. */
export function ensureVc239Anim(scene: SceneLike, key: Vc239FxKey): string | null {
  const animKey = `${key}-anim`;
  const anims = (scene as unknown as { anims?: Phaser.Animations.AnimationManager }).anims;
  if (!anims) return null;
  if (anims.exists(animKey)) return animKey;
  let names: string[] = [];
  try {
    const tex = (scene as unknown as { textures: Phaser.Textures.TextureManager }).textures;
    if (!tex.exists(key)) return null;
    const t = tex.get(key);
    names = t.getFrameNames().sort((a, b) => {
      const na = Number(a.split("__").pop()), nb = Number(b.split("__").pop());
      return na - nb;
    });
  } catch { return null; }
  if (!names.length) return null;
  try {
    anims.create({
      key: animKey,
      frames: names.map((n) => ({ key, frame: n })),
      frameRate: 14, // PixelLab 기본 fps
      repeat: 0,
    });
  } catch { return null; }
  return animKey;
}

/** VFX 재생 — targetScale 은 화면상 목표 크기(px). 캔버스가 달라 자동 정규화한다. */
export function spawnVc239Fx(
  scene: SceneLike, x: number, y: number, key: Vc239FxKey, targetScale = 1, tint?: number,
) {
  const animKey = ensureVc239Anim(scene, key);
  if (!animKey) return null;
  const s = scene as unknown as {
    add: { sprite: (x: number, y: number, tex: string, frame?: string) => Phaser.GameObjects.Sprite };
    time?: { delayedCall: (ms: number, cb: () => void) => unknown };
  };
  let spr: Phaser.GameObjects.Sprite;
  try { spr = s.add.sprite(x, y, key, "0"); } catch { return null; }
  if (!spr) return null;
  spr.setDepth(24).setBlendMode(Phaser.BlendModes.ADD).setOrigin(0.5, 0.65);
  if (tint !== undefined) spr.setTint(tint);
  // 캔버스 최대변이 목표 크기에 맞도록 스케일 (기본 128px 기준)
  const maxSide = Math.max(spr.width || 1, spr.height || 1);
  spr.setScale((128 / maxSide) * targetScale);
  try { spr.play(animKey); } catch { /* 애니 실패 → 정지 프레임 */ }
  spr.once("animationcomplete", () => { try { spr.destroy(); } catch { /* noop */ } });
  // 애니 완료 이벤트를 놓쳐도 누수되지 않게 안전 파괴
  if (s.time) s.time.delayedCall(4000, () => { try { if (spr.active) spr.destroy(); } catch { /* noop */ } });
  return spr;
}