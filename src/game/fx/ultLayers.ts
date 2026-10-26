/**
 * vc183 (지시 — 극딜 스킬 메커니즘 설계 문서) — 극딜 연출 3단계 레이어.
 *
 * 문서(2D 탑다운 RPG 극딜 스킬 메커니즘 설계)의 핵심 요구는 스킬 자체를 바꾸는 게 아니라
 * **연출을 3개 레이어로 분리**하는 것이다:
 *
 *   ① 배경 암전 레이어 — 발동 순간 배경 불투명도를 60~70% 낮춰 오라·이펙트 발광을 극대화
 *   ② 이펙트 레이어 — 캐릭터 후면 오라 / 지면 룬 / 전면 검기·투사체를 Z 순서로 분리
 *   ③ 카메라·스크린 피드백 — 히트스톱 + 화면 흔들림 + (가능하면) 방사형 블러 동기화
 *
 * 지금까지 극딜 연출은 스킬마다 각자 flash/shake를 흩뿌려 강도가 제각각이었다.
 * 여기서 한 곳에 모아 계열별 강도를 표로 관리한다.
 *
 * 에셋 정책: 신규 VFX를 만들지 않고 이미 있는 18종(fx_*)만 재사용한다.
 */
import Phaser from "phaser";

/** 극딜 연출 강도 — 계열별로 다르게 준다(전사는 묵직, 도적은 짧고 날카롭게). */
export type UltBurstProfile = {
  /** 배경 암전 알파 (0.6~0.7 권장 — 문서 기준) */
  darken: number;
  /** 암전 유지 시간(ms) */
  darkenMs: number;
  /** 히트스톱(ms) — 타격감의 핵심 */
  hitStop: number;
  /** 화면 흔들림 강도·시간 */
  shake: [duration: number, intensity: number];
  /** 카메라 줌 펀치 (0이면 생략) */
  zoomPunch: number;
  /** vc187 (지시 #9) — 줌아웃이 필요한 직업만 true.
   *  화면 전체를 쓰는 스킬(포격·폭격)은 넓게 보여줄 이유가 있지만,
   *  근접 돌진형(워브링어·블레이드마스터 등)은 줌을 건드릴 이유가 없다.
   *  false 면 줌을 아예 만지지 않아 "복귀 안 됨" 버그 자체가 생기지 않는다. */
  needsZoom?: boolean;
  /** 후면 오라에 쓸 VFX 키 */
  auraKey: string;
  /** 지면 룬에 쓸 VFX 키 */
  runeKey: string;
  /** 전면 폭발에 쓸 VFX 키 */
  burstKey: string;
};

/**
 * 10계열 + 1차 폴백 프로파일.
 * 계열 키는 classes.ts의 familyOf()가 돌려주는 값(warrior/ranger/mage/thief/pirate)과
 * 4차 세부직업 leaf 키를 모두 받는다.
 */
const PROFILES: Record<string, UltBurstProfile> = {
  /* ── 전사 — 묵직하고 긴 암전, 강한 흔들림 ── */
  warrior: { darken: 0.66, darkenMs: 1400, hitStop: 90, shake: [340, 0.013], zoomPunch: 1.045, auraKey: "fx_aura", runeKey: "fx_glow", burstKey: "fx_flarebig" },
  berserker: { darken: 0.70, darkenMs: 1500, hitStop: 110, shake: [380, 0.016], zoomPunch: 1.055, needsZoom: true, auraKey: "fx_aura", runeKey: "fx_glow", burstKey: "fx_flarebig" },
  guardian: { darken: 0.62, darkenMs: 1300, hitStop: 80, shake: [300, 0.010], zoomPunch: 1.035, auraKey: "fx_glowyellow", runeKey: "fx_hex", burstKey: "fx_flare" },

  /* ── 궁수 — 짧은 암전, 정밀한 단발 충격 ── */
  ranger: { darken: 0.60, darkenMs: 1100, hitStop: 60, shake: [240, 0.009], zoomPunch: 1.030, auraKey: "fx_glowblue", runeKey: "fx_hex", burstKey: "fx_burst" },
  sniper: { darken: 0.68, darkenMs: 1200, hitStop: 75, shake: [260, 0.010], zoomPunch: 1.040, auraKey: "fx_glowblue", runeKey: "fx_electro", burstKey: "fx_burst" },
  windrunner: { darken: 0.58, darkenMs: 1300, hitStop: 55, shake: [300, 0.011], zoomPunch: 1.025, auraKey: "fx_glowblue", runeKey: "fx_caustic", burstKey: "fx_shockwave" },

  /* ── 마법사 — 가장 긴 암전(발광 극대화), 낮은 흔들림(가독성) ── */
  mage: { darken: 0.70, darkenMs: 1600, hitStop: 70, shake: [320, 0.010], zoomPunch: 1.050, auraKey: "fx_purple", runeKey: "fx_hex", burstKey: "fx_flarebig" },
  archmage: { darken: 0.70, darkenMs: 1700, hitStop: 80, shake: [340, 0.011], zoomPunch: 1.055, needsZoom: true, auraKey: "fx_purple", runeKey: "fx_hex", burstKey: "fx_flarebig" },
  sage: { darken: 0.66, darkenMs: 1500, hitStop: 65, shake: [280, 0.008], zoomPunch: 1.040, auraKey: "fx_glowyellow", runeKey: "fx_hex", burstKey: "fx_flarew" },

  /* ── 도적 — 짧고 날카롭게, 흔들림 최소·히트스톱 다수 ── */
  thief: { darken: 0.64, darkenMs: 900, hitStop: 55, shake: [180, 0.008], zoomPunch: 1.035, auraKey: "fx_noise", runeKey: "fx_electro", burstKey: "fx_burst" },
  assassin: { darken: 0.68, darkenMs: 900, hitStop: 65, shake: [190, 0.009], zoomPunch: 1.040, auraKey: "fx_noise", runeKey: "fx_electro", burstKey: "fx_burst" },
  swashbuckler: { darken: 0.62, darkenMs: 1000, hitStop: 50, shake: [200, 0.008], zoomPunch: 1.030, auraKey: "fx_noise", runeKey: "fx_hex", burstKey: "fx_shockwave" },

  /* ── 해적 — 화염/포격. 넓은 암전 + 큰 흔들림 ── */
  pirate: { darken: 0.68, darkenMs: 1500, hitStop: 85, shake: [400, 0.015], zoomPunch: 1.050, needsZoom: true, auraKey: "fx_glow", runeKey: "fx_shockwave", burstKey: "fx_flarebig" },
  raider: { darken: 0.66, darkenMs: 1400, hitStop: 80, shake: [360, 0.013], zoomPunch: 1.045, auraKey: "fx_glow", runeKey: "fx_shockwave", burstKey: "fx_flarebig" },
  corsair: { darken: 0.70, darkenMs: 1500, hitStop: 90, shake: [420, 0.016], zoomPunch: 1.050, needsZoom: true, auraKey: "fx_flarew", runeKey: "fx_shockwave", burstKey: "fx_flarebig" },
};

/** 폴백 — 계열을 못 찾았을 때(무직·1차) */
const DEFAULT_PROFILE: UltBurstProfile = {
  darken: 0.64, darkenMs: 1200, hitStop: 70, shake: [280, 0.010], zoomPunch: 1.035,
  auraKey: "fx_glow", runeKey: "fx_hex", burstKey: "fx_burst",
};

export function ultProfile(key?: string | null): UltBurstProfile {
  if (!key) return DEFAULT_PROFILE;
  return PROFILES[key] ?? DEFAULT_PROFILE;
}

type Scene3 = Phaser.Scene & {
  cameras: Phaser.Cameras.Scene2D.CameraManager;
  hitStop?: (ms?: number) => void;
};

/**
 * 극딜 3단계 연출을 한 번에 재생한다.
 *  - 암전: 카메라 위 고정(fixed) 검은 사각형을 알파 0→darken으로 올렸다 서서히 복귀
 *  - 후면 오라 / 지면 룬 / 전면 폭발: 서로 다른 depth로 분리해 공간감 형성
 *  - 히트스톱 + 흔들림 + 줌 펀치를 같은 프레임에 동기화
 *
 * 렌더러가 Canvas면 ADD 블렌드가 비용 대비 효과가 적어 암전·룬만 남기고 생략한다.
 */
export function playUltLayers(
  scene: Scene3,
  x: number,
  y: number,
  tint: number,
  profileKey?: string | null,
  opts?: { scale?: number },
) {
  const p = ultProfile(profileKey);
  const s = opts?.scale ?? 1;
  const cam = scene.cameras.main;
  const webgl = scene.game.renderer.type === Phaser.WEBGL;

  /* ── ① 배경 암전 (카메라 고정 — 스크롤과 무관하게 화면 전체를 덮는다) ── */
  let veil: Phaser.GameObjects.Rectangle | null = null;
  try {
    veil = scene.add
      .rectangle(cam.midPoint.x, cam.midPoint.y, cam.width * 1.4, cam.height * 1.4, 0x000000, 0)
      .setScrollFactor(0)
      .setDepth(140)
      .setAlpha(0);
    scene.tweens.add({
      targets: veil,
      alpha: p.darken * s,
      duration: 120,
      ease: "Quad.out",
      onComplete: () => {
        if (!veil) return;
        scene.tweens.add({
          targets: veil,
          alpha: 0,
          duration: p.darkenMs,
          ease: "Quad.in",
          onComplete: () => veil?.destroy(),
        });
      },
    });
  } catch {
    veil = null;
  }

  /* ── ② 이펙트 레이어 (후면 오라 → 지면 룬 → 전면 폭발) ── */
  const addFx = (key: string, depth: number, scaleFrom: number, scaleTo: number, alpha: number, dur: number, delay = 0) => {
    if (!scene.textures.exists(key)) return;
    try {
      const im = scene.add
        .image(x, y, key)
        .setDepth(depth)
        .setScale(scaleFrom * s)
        .setAlpha(alpha)
        .setTint(tint);
      if (webgl) im.setBlendMode(Phaser.BlendModes.ADD);
      scene.tweens.add({
        targets: im,
        scale: scaleTo * s,
        alpha: 0,
        duration: dur,
        delay,
        ease: "Cubic.out",
        onComplete: () => im.destroy(),
      });
    } catch { /* 텍스처 미로드/렌더러 미지원 무시 */ }
  };

  // 후면 오라 — 캐릭터 뒤(depth 12). 크게 퍼지며 사라진다.
  addFx(p.auraKey, 12, 0.6, 2.6, 0.75, 620);
  // 지면 룬 — 바닥에 깔리는 평면 연출(depth 5). 살짝 늦게 떠서 층이 생긴다.
  addFx(p.runeKey, 5, 0.4, 3.2, 0.6, 780, 60);
  // 전면 폭발 — 캐릭터 앞(depth 22). 짧고 강하게.
  addFx(p.burstKey, 22, 0.35, 2.2, 0.9, 420, 100);

  /* ── ③ 카메라·스크린 피드백 ── */
  try {
    scene.hitStop?.(p.hitStop);
    cam.shake(p.shake[0], p.shake[1] * s);
    /* vc185 (지시 #2 — 5차 스킬 사용 시 게임 멈춤) — 줌 펀치를 콜백 재귀에서 delayedCall 로 교체.
     *  종전엔 zoomTo 의 onUpdate 콜백 안에서 prog>=1 일 때 다시 zoomTo 를 호출했다.
     *  Phaser 콜백은 조건이 참인 프레임마다 반복 호출되므로 복귀 트윈이 매 프레임 새로
     *  생성됐고, 트윈 목록이 끝없이 늘어 카메라가 잠기며 게임이 멈췄다(5차 전용 증상).
     *  DeathSlash.ts 가 쓰는 검증된 패턴(고정 지연 후 복귀)으로 바꾼다. */
    /* vc187 (#2·#9) — needsZoom 직업만 줌을 건드린다. 근접형은 아예 안 만져
     *  "드레드노트 5차 후 줌아웃이 안 돌아온다" 같은 버그가 발생할 여지를 없앤다. */
    if (p.zoomPunch > 1 && p.needsZoom) {
      /* vc185 (지시 #2) — 복원 기준을 cam.zoom(=이미 변형된 값)이 아니라 **기준 줌**에서 잡는다.
       *  종전엔 base = cam.zoom 이라, 레벨업 연출(WorldScene 7763) 등 다른 줌 연출이
       *  겹치면 1.25 를 base 로 잡아 영구히 남았다(실측: 시전 후 zoom 1.25 고정).
       *  기준값(absoluteBase)에서 복원하면 어떤 연출과 겹쳐도 원위치로 돌아온다. */
      /* vc187 (#2) — 복원 기준을 정확히 잡는다.
       *  종전엔 perspZoom(존재하지 않는 필드)을 찾아 실패 → 항상 1.0 으로 복원했다.
       *  그런데 이 게임의 실제 기준 줌은 viewZoom() = clamp(innerHeight/560, 1, 2.5) 다.
       *  세로가 긴 기기에서는 1.5~2.5 이므로 1.0 으로 "복원"하면 오히려 줌이 풀려
       *  화면이 넓어지고, 그 상태가 남아 "줌아웃이 안 돌아온다"로 보였다.
       *  → 시전 직전의 cam.zoom 을 그대로 기억해 그 값으로 되돌린다(가장 확실). */
      const zoomBefore = cam.zoom;
      cam.zoomTo(zoomBefore * p.zoomPunch, 120);
      scene.time.delayedCall(170, () => {
        try {
          cam.zoomTo(zoomBefore, 240);
          /* 최종 보정 — 다른 연출이 끼어들어도 시전 전 값으로 고정 */
          scene.time.delayedCall(320, () => {
            try { cam.zoom = zoomBefore; } catch { /* 씬 종료 무시 */ }
          });
        } catch { /* 씬 종료 경합 무시 */ }
      });
    }
  } catch { /* 카메라 미지원 무시 */ }
}
