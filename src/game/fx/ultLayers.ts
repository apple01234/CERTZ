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
  /** 후면 오라에 쓸 VFX 키 */
  auraKey: string;
  /** 지면 룬에 쓸 VFX 키 */
  runeKey: string;
  /** 전면 폭발에 쓸 VFX 키 */
  burstKey: string;
  /**
   * v1.4.32 (지시 #5·#7·#13 "스킬 개편에 많은 시간을 투자해") —
   * Hovl Magic effects 팩에서 뽑은 고해상도 임팩트 텍스처(fx2/).
   *  기존 fx_* 18종은 256px·패턴 계열이라 큰 화면에서 뿌옇고 실루엣이 약했다.
   *  fx2 는 흰색 마스크 + alpha 경계가 정교해 메인 타격 순간에 쓰면
   *  같은 tint 로도 훨씬 선명한 임팩트가 난다(하이브리드: 메인=신규, 보조=기존).
   *  미지정이면 종전과 완전히 동일하게 동작한다(하위 호환).
   */
  hitKey?: string;
  /** 링/충격파 계열 — 지면에서 퍼지는 파동 (fx2/Circle2 계열) */
  ringKey?: string;
};

/**
 * 10계열 + 1차 폴백 프로파일.
 * 계열 키는 classes.ts의 familyOf()가 돌려주는 값(warrior/ranger/mage/thief/pirate)과
 * 4차 세부직업 leaf 키를 모두 받는다.
 */
const PROFILES: Record<string, UltBurstProfile> = {
  /* ── 전사 — 묵직하고 긴 암전, 강한 흔들림 ── */
  warrior: { darken: 0.66, darkenMs: 1400, hitStop: 90, shake: [340, 0.013], zoomPunch: 1.045, auraKey: "fx_aura", runeKey: "fx_glow", burstKey: "fx_flarebig", hitKey: "fx_FlashFree3", ringKey: "fx_Circle2"},
  berserker: { darken: 0.70, darkenMs: 1500, hitStop: 110, shake: [380, 0.016], zoomPunch: 1.055, auraKey: "fx_aura", runeKey: "fx_glow", burstKey: "fx_flarebig", hitKey: "fx_FlashFree2", ringKey: "fx_Circle2"},
  guardian: { darken: 0.62, darkenMs: 1300, hitStop: 80, shake: [300, 0.010], zoomPunch: 1.035, auraKey: "fx_glowyellow", runeKey: "fx_hex", burstKey: "fx_flare", hitKey: "fx_FlashFree1", ringKey: "fx_Circle2"},

  /* ── 궁수 — 짧은 암전, 정밀한 단발 충격 ── */
  ranger: { darken: 0.60, darkenMs: 1100, hitStop: 60, shake: [240, 0.009], zoomPunch: 1.030, auraKey: "fx_glowblue", runeKey: "fx_hex", burstKey: "fx_burst", hitKey: "fx_Flare", ringKey: "fx_Circle"},
  sniper: { darken: 0.68, darkenMs: 1200, hitStop: 75, shake: [260, 0.010], zoomPunch: 1.040, auraKey: "fx_glowblue", runeKey: "fx_electro", burstKey: "fx_burst", hitKey: "fx_Flash", ringKey: "fx_Circle2"},
  windrunner: { darken: 0.58, darkenMs: 1300, hitStop: 55, shake: [300, 0.011], zoomPunch: 1.025, auraKey: "fx_glowblue", runeKey: "fx_caustic", burstKey: "fx_shockwave", hitKey: "fx_Flash", ringKey: "fx_Circle"},

  /* ── 마법사 — 가장 긴 암전(발광 극대화), 낮은 흔들림(가독성) ── */
  mage: { darken: 0.70, darkenMs: 1600, hitStop: 70, shake: [320, 0.010], zoomPunch: 1.050, auraKey: "fx_purple", runeKey: "fx_hex", burstKey: "fx_flarebig", hitKey: "fx_FlashFree3", ringKey: "fx_Circle2"},
  archmage: { darken: 0.70, darkenMs: 1700, hitStop: 80, shake: [340, 0.011], zoomPunch: 1.055, auraKey: "fx_purple", runeKey: "fx_hex", burstKey: "fx_flarebig", hitKey: "fx_FlashFree3", ringKey: "fx_Circle2"},
  sage: { darken: 0.66, darkenMs: 1500, hitStop: 65, shake: [280, 0.008], zoomPunch: 1.040, auraKey: "fx_glowyellow", runeKey: "fx_hex", burstKey: "fx_flarew", hitKey: "fx_FlashFree1", ringKey: "fx_Circle2"},

  /* ── 도적 — 짧고 날카롭게, 흔들림 최소·히트스톱 다수 ── */
  thief: { darken: 0.64, darkenMs: 900, hitStop: 55, shake: [180, 0.008], zoomPunch: 1.035, auraKey: "fx_noise", runeKey: "fx_electro", burstKey: "fx_burst", hitKey: "fx_FlashFree1", ringKey: "fx_Circle"},
  assassin: { darken: 0.68, darkenMs: 900, hitStop: 65, shake: [190, 0.009], zoomPunch: 1.040, auraKey: "fx_noise", runeKey: "fx_electro", burstKey: "fx_burst", hitKey: "fx_FlashFree1", ringKey: "fx_Circle"},
  swashbuckler: { darken: 0.62, darkenMs: 1000, hitStop: 50, shake: [200, 0.008], zoomPunch: 1.030, auraKey: "fx_noise", runeKey: "fx_hex", burstKey: "fx_shockwave", hitKey: "fx_Flash", ringKey: "fx_Circle"},

  /* ── 해적 — 화염/포격. 넓은 암전 + 큰 흔들림 ── */
  pirate: { darken: 0.68, darkenMs: 1500, hitStop: 85, shake: [400, 0.015], zoomPunch: 1.050, auraKey: "fx_glow", runeKey: "fx_shockwave", burstKey: "fx_flarebig", hitKey: "fx_FlashFree2", ringKey: "fx_Circle2"},
  raider: { darken: 0.66, darkenMs: 1400, hitStop: 80, shake: [360, 0.013], zoomPunch: 1.045, auraKey: "fx_glow", runeKey: "fx_shockwave", burstKey: "fx_flarebig", hitKey: "fx_FlashFree2", ringKey: "fx_Circle2"},
  corsair: { darken: 0.70, darkenMs: 1500, hitStop: 90, shake: [420, 0.016], zoomPunch: 1.050, auraKey: "fx_flarew", runeKey: "fx_shockwave", burstKey: "fx_flarebig", hitKey: "fx_FlashFree2", ringKey: "fx_Circle2"},

  /* ══════════════════════════════════════════════════════════════════════════
   * vc194 — 누락 20직업 프로파일 추가.
   *
   *  [발견한 문제] 위 표는 15개 키만 정의하고 있었고, ClassKey 는 30개다.
   *  그래서 warlord·paladin·eagleeye·tempest·stormbringer·chronicle·nightblade·
   *  duelist·warbringer·crusader·deadeye·skylord·arclord·eternal·shadowlord·
   *  blademaster·stormcaptain·powdermaster·seaking·dreadnought **20직업이 전부
   *  DEFAULT_PROFILE 하나로 떨어져 궁극기 연출이 완전히 동일**했다.
   *  (유저 지적: "궁극기가 다 똑같다"의 실제 원인)
   *
   *  [설계 원칙] 각 직업의 SKILL5_INFO 정체성(무기·속성·역할)을 수치로 옮긴다.
   *   - 전사형: 긴 암전 + 강한 흔들림 + 큰 줌 (묵직함)
   *   - 궁수형: 짧은 암전 + 정밀 단발 (히트스톱 길고 흔들림 작게)
   *   - 마법형: 가장 긴 암전 + 낮은 흔들림 (발광 극대화·가독성)
   *   - 도적형: 가장 짧은 암전 + 잦은 히트스톱 (연격감)
   *   - 해적형: 넓은 암전 + 최대 흔들림 (포격)
   *  auraKey/runeKey/burstKey 는 ultLayers 가 실제로 쓰는 fx_* 18종 안에서만 고른다.
   * ══════════════════════════════════════════════════════════════════════════ */

  /* ── 4차 전사 계열 (warlord/paladin) ── */
  warlord: { darken: 0.72, darkenMs: 1600, hitStop: 120, shake: [420, 0.018], zoomPunch: 1.060, auraKey: "fx_aura", runeKey: "fx_shockwave", burstKey: "fx_flarebig", hitKey: "fx_FlashFree3", ringKey: "fx_Circle2"},
  paladin: { darken: 0.60, darkenMs: 1700, hitStop: 95, shake: [300, 0.011], zoomPunch: 1.045, auraKey: "fx_glowyellow", runeKey: "fx_hex", burstKey: "fx_flarew", hitKey: "fx_FlashFree3", ringKey: "fx_Circle2"},

  /* ── 4차 궁수 계열 (eagleeye/tempest/stormbringer) ── */
  eagleeye: { darken: 0.66, darkenMs: 1100, hitStop: 90, shake: [240, 0.009], zoomPunch: 1.055, auraKey: "fx_glowblue", runeKey: "fx_hex", burstKey: "fx_burst", hitKey: "fx_Flash", ringKey: "fx_Circle2"},
  tempest: { darken: 0.60, darkenMs: 1200, hitStop: 60, shake: [320, 0.012], zoomPunch: 1.030, auraKey: "fx_caustic", runeKey: "fx_electro", burstKey: "fx_shockwave", hitKey: "fx_Flash", ringKey: "fx_Circle2"},
  stormbringer: { darken: 0.68, darkenMs: 1300, hitStop: 70, shake: [360, 0.014], zoomPunch: 1.040, auraKey: "fx_electro", runeKey: "fx_electro", burstKey: "fx_flarebig", hitKey: "fx_Electro", ringKey: "fx_Circle2"},

  /* ── 4차 마법 계열 (chronicle) ── */
  chronicle: { darken: 0.72, darkenMs: 1800, hitStop: 75, shake: [300, 0.009], zoomPunch: 1.050, auraKey: "fx_purple", runeKey: "fx_hex", burstKey: "fx_flarew", hitKey: "fx_FlashFree3", ringKey: "fx_Circle2"},

  /* ── 4차 도적 계열 (nightblade/duelist) ── */
  nightblade: { darken: 0.70, darkenMs: 850, hitStop: 60, shake: [170, 0.007], zoomPunch: 1.038, auraKey: "fx_noise", runeKey: "fx_electro", burstKey: "fx_burst", hitKey: "fx_FlashFree1", ringKey: "fx_Circle"},
  duelist: { darken: 0.62, darkenMs: 950, hitStop: 70, shake: [200, 0.009], zoomPunch: 1.042, auraKey: "fx_noise", runeKey: "fx_hex", burstKey: "fx_burst", hitKey: "fx_FlashFree1", ringKey: "fx_Circle"},

  /* ── 5차 궁극 4직업 (warbringer 이하 전용) ── */
  warbringer: { darken: 0.74, darkenMs: 1700, hitStop: 130, shake: [460, 0.020], zoomPunch: 1.065, auraKey: "fx_aura", runeKey: "fx_shockwave", burstKey: "fx_flarebig", hitKey: "fx_FlashFree3", ringKey: "fx_Circle2"},
  crusader: { darken: 0.62, darkenMs: 1800, hitStop: 100, shake: [310, 0.012], zoomPunch: 1.048, auraKey: "fx_glowyellow", runeKey: "fx_hex", burstKey: "fx_flarew", hitKey: "fx_FlashFree3", ringKey: "fx_Circle2"},
  deadeye: { darken: 0.68, darkenMs: 1150, hitStop: 100, shake: [250, 0.010], zoomPunch: 1.058, auraKey: "fx_glowblue", runeKey: "fx_hex", burstKey: "fx_burst", hitKey: "fx_Flash", ringKey: "fx_Circle2"},
  skylord: { darken: 0.66, darkenMs: 1350, hitStop: 75, shake: [380, 0.015], zoomPunch: 1.042, auraKey: "fx_caustic", runeKey: "fx_electro", burstKey: "fx_flarebig", hitKey: "fx_Flash", ringKey: "fx_Circle2"},
  arclord: { darken: 0.70, darkenMs: 1400, hitStop: 85, shake: [400, 0.016], zoomPunch: 1.046, auraKey: "fx_electro", runeKey: "fx_electro", burstKey: "fx_flarebig", hitKey: "fx_Electro", ringKey: "fx_Circle2"},
  eternal: { darken: 0.74, darkenMs: 1900, hitStop: 110, shake: [340, 0.012], zoomPunch: 1.055, auraKey: "fx_purple", runeKey: "fx_hex", burstKey: "fx_flarew", hitKey: "fx_FlashFree3", ringKey: "fx_Circle2"},
  shadowlord: { darken: 0.76, darkenMs: 900, hitStop: 80, shake: [180, 0.008], zoomPunch: 1.040, auraKey: "fx_noise", runeKey: "fx_electro", burstKey: "fx_burst", hitKey: "fx_FlashFree1", ringKey: "fx_Circle"},

  /* ── 5차 검성·혼혈 직업 (blademaster) ── */
  blademaster: { darken: 0.72, darkenMs: 1500, hitStop: 115, shake: [390, 0.017], zoomPunch: 1.058, auraKey: "fx_glow", runeKey: "fx_hex", burstKey: "fx_flarebig", hitKey: "fx_FlashFree1", ringKey: "fx_Circle2"},

  /* ── 해적 4·5차 (stormcaptain/powdermaster/seaking/dreadnought) ── */
  stormcaptain: { darken: 0.68, darkenMs: 1450, hitStop: 88, shake: [410, 0.015], zoomPunch: 1.048, auraKey: "fx_electro", runeKey: "fx_shockwave", burstKey: "fx_flarebig", hitKey: "fx_Electro", ringKey: "fx_Circle2"},
  powdermaster: { darken: 0.72, darkenMs: 1500, hitStop: 95, shake: [470, 0.019], zoomPunch: 1.052, auraKey: "fx_flarew", runeKey: "fx_shockwave", burstKey: "fx_flarebig", hitKey: "fx_FlashFree2", ringKey: "fx_Circle2"},
  seaking: { darken: 0.70, darkenMs: 1600, hitStop: 100, shake: [430, 0.016], zoomPunch: 1.050, auraKey: "fx_caustic", runeKey: "fx_shockwave", burstKey: "fx_flarew", hitKey: "fx_FlashFree2", ringKey: "fx_Circle2"},
  dreadnought: { darken: 0.76, darkenMs: 1700, hitStop: 135, shake: [500, 0.021], zoomPunch: 1.068, auraKey: "fx_aura", runeKey: "fx_shockwave", burstKey: "fx_flarebig", hitKey: "fx_FlashFree3", ringKey: "fx_Circle2"},
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
 * v1.4.32 (지시 #5·#7·#13 "스킬 개편에 많은 시간을 투자해") — 밀집 타격 레이어.
 *
 *  [문제] 기존 궁극기의 타격 간격은 직업별 200~280ms 였다(warbringer 210ms,
 *  crusader 200ms). 메이플 5·6차가 화려하게 읽히는 실제 이유는 색이나 폭발
 *  크기가 아니라 **0.05초 간격의 15~30연타**라는 시간 밀도다. 간격이 4배
 *  느리면 같은 오브젝트 수를 써도 "폭발 한 번"으로 읽힌다.
 *
 *  [해결] 피해 판정은 건드리지 않는다(밸런스 불변 — 각 직업의 delayedCall 은
 *  그대로). 대신 그 사이를 채우는 **시각 전용 잔상 타격**을 45~55ms 간격으로
 *  흩뿌린다. 실제 피해는 기존 스케줄이 결정하므로 프레임률·연출 시간에
 *  피해가 의존하지 않는다는 원칙도 유지된다.
 *
 *  [에셋] fx2/(Hovl 512px 흰색 마스크) 8종만 사용 — tint 로 원소색을 입힌다.
 */
export function playUltBarrage(
  scene: Scene3,
  x: number,
  y: number,
  tint: number,
  opts?: { count?: number; spanMs?: number; radius?: number; scale?: number },
) {
  const webgl = scene.game.renderer.type === Phaser.WEBGL;
  const count = opts?.count ?? 18;
  const span = opts?.spanMs ?? 820;
  const radius = opts?.radius ?? 130;
  const baseScale = (opts?.scale ?? 1) * 0.55;

  /* 원소색에서 살짝 변주를 줘 단조로움을 피한다(같은 tint 반복은 도장 찍은 듯 보인다). */
  const variants = [tint, 0xffffff, tint];

  for (let i = 0; i < count; i++) {
    const delay = Math.round((span / count) * i);
    scene.time.delayedCall(delay, () => {
      try {
        const key = i % 5 === 4 ? "fx_Flare" : i % 3 === 2 ? "fx_Circle" : "fx_FlashFree3";
        if (!scene.textures.exists(key)) return;
        /* 플레이어 주변에 도넛 형태로 흩뿌린다 — 중앙에 몰리면 캐릭터가 가려진다. */
        const a = (i / count) * Math.PI * 2 + Math.random() * 0.7;
        const r = radius * (0.42 + Math.random() * 0.58);
        const ix = x + Math.cos(a) * r;
        const iy = y + Math.sin(a) * r * 0.62;
        const im = scene.add
          .image(ix, iy, key)
          .setDepth(i % 2 === 0 ? 21 : 7)
          .setScale(baseScale * (0.8 + Math.random() * 0.7))
          .setAlpha(0.9)
          .setTint(variants[i % variants.length])
          .setRotation(Math.random() * Math.PI * 2);
        if (webgl) im.setBlendMode(Phaser.BlendModes.ADD); // Canvas 는 ADD 미지원 — 알파만
        scene.tweens.add({
          targets: im,
          scale: im.scale * (1.7 + Math.random() * 0.8),
          alpha: 0,
          duration: 170 + Math.random() * 90,
          ease: "Quad.out",
          onComplete: () => im.destroy(),
        });
      } catch { /* 씬 종료 경합 무시 */ }
    });
  }

  /* 저속 잔상 — 화면 전체에 얇은 빛줄기를 3~4개 흘려 "시간이 늘어난" 느낌을 준다. */
  for (let k = 0; k < 3; k++) {
    scene.time.delayedCall(90 + k * 130, () => {
      try {
        if (!scene.textures.exists("fx_Flare")) return;
        const im = scene.add
          .image(x + (Math.random() - 0.5) * 90, y + (Math.random() - 0.5) * 50, "fx_Flare")
          .setDepth(20)
          .setScale(baseScale * 2.4, baseScale * 0.5)
          .setAlpha(0.5)
          .setTint(tint)
          .setRotation((Math.random() - 0.5) * 0.9);
        if (webgl) im.setBlendMode(Phaser.BlendModes.ADD);
        scene.tweens.add({
          targets: im,
          alpha: 0,
          scaleX: im.scaleX * 1.9,
          duration: 260,
          ease: "Cubic.out",
          onComplete: () => im.destroy(),
        });
      } catch { /* 무시 */ }
    });
  }
}

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
  opts?: { scale?: number; timeScale?: number },
) {
  const p = ultProfile(profileKey);
  const s = opts?.scale ?? 1;
  /* v1.4.41 (#3 "궁극기 쿨타임에 비해 시전시간이 다들 너무 짧아") —
   *  종전 1차 궁극기 연출은 darkenMs 평균 1,374ms(최소 850~최대 1,900)뿐이었는데
   *  쿨타임은 60초였다. 실측상 60초를 기다려 1.4초 보고 끝나는 비율이라
   *  "궁극기를 썼다"는 감각이 남지 않았다. timeScale 로 암전·이펙트·연타 구간을
   *  함께 늘려 1차는 약 2.6초, 2차는 opts 로 더 길게 잡는다.
   *  피해 판정 시점(아래 각 case 의 delayedCall)은 건드리지 않는다 — 연출만 늘린다. */
  const ts = Math.max(1, opts?.timeScale ?? 1.9);
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
          duration: Math.round(p.darkenMs * ts),
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
  /* v1.4.32 (지시 #7) — depth 12 → 8 로 교정. 플레이어 depth 는 perspDepthOf() = 9~10 이라
   *  종전 12 는 "캐릭터 뒤"가 아니라 **앞**이었고, ADD 블렌드 오라가 스프라이트를 덮어
   *  캐릭터가 하얗게 씻겨 보였다(주석과 실제 렌더 순서 불일치). */
  addFx(p.auraKey, 8, 0.6, 2.6, 0.75, Math.round(620 * ts));
  // 지면 룬 — 바닥에 깔리는 평면 연출(depth 5). 살짝 늦게 떠서 층이 생긴다.
  addFx(p.runeKey, 5, 0.4, 3.2, 0.6, Math.round(780 * ts), Math.round(60 * ts));

  /* v1.4.32 (지시 #5·#7·#13) — 고해상도 임팩트 레이어.
   *  기존 3레이어만으로는 "큰 폭발 하나"로 읽혀 메이플 5·6차의 다층 타격감이 안 났다.
   *  fx2 는 512px 흰색 마스크라 tint 시 실루엣이 살아 있다.
   *  순서: 링(지면 파동, depth 6) → 히트 섬광(depth 23, 캐릭터 앞).
   *  히트스톱과 같은 프레임에 떠야 타격으로 읽히므로 delay 를 주지 않는다. */
  if (p.ringKey) addFx(p.ringKey, 6, 0.5, 3.6, 0.7, Math.round(700 * ts), Math.round(30 * ts));
  if (p.hitKey) addFx(p.hitKey, 23, 0.4, 2.4, 0.95, Math.round(380 * ts));

  // 전면 폭발 — 캐릭터 앞(depth 22). 짧고 강하게.
  addFx(p.burstKey, 22, 0.35, 2.2, 0.9, Math.round(420 * ts), Math.round(100 * ts));

  /* v1.4.32 (지시 #5·#7·#13) — 밀집 타격 레이어.
   *  v1.4.33 (긴급수정 — "전사 스킬 사용시 캐릭터 멈추는 버그")
   *  16개를 40ms 간격으로 만들면 전사 스킬의 기존 연출(9연타 + 종결)과 겹쳐
   *  한 프레임에 오브젝트가 몰린다. 저사양·Canvas 렌더러에서 프레임이 끊겨
   *  캐릭터가 멈춘 것처럼 보였다. 개수를 절반으로 줄이고 간격을 늘린다. */
  playUltBarrage(scene, x, y, tint, {
    count: Math.max(6, Math.round(8 * s)),
    spanMs: Math.round(1100 * s * ts),
    radius: 140 * s,
    scale: s,
  });

  /* ── ③ 카메라·스크린 피드백 ── */
  try {
    scene.hitStop?.(p.hitStop);
    cam.shake(p.shake[0], p.shake[1] * s);
    /* vc185 (지시 #2 — 5차 스킬 사용 시 게임 멈춤) — 줌 펀치를 콜백 재귀에서 delayedCall 로 교체.
     *  종전엔 zoomTo 의 onUpdate 콜백 안에서 prog>=1 일 때 다시 zoomTo 를 호출했다.
     *  Phaser 콜백은 조건이 참인 프레임마다 반복 호출되므로 복귀 트윈이 매 프레임 새로
     *  생성됐고, 트윈 목록이 끝없이 늘어 카메라가 잠기며 게임이 멈췄다(5차 전용 증상).
     *  DeathSlash.ts 가 쓰는 검증된 패턴(고정 지연 후 복귀)으로 바꾼다. */
    if (p.zoomPunch > 1) {
      /* vc185 (지시 #2) — 복원 기준을 cam.zoom(=이미 변형된 값)이 아니라 **기준 줌**에서 잡는다.
       *  종전엔 base = cam.zoom 이라, 레벨업 연출(WorldScene 7763) 등 다른 줌 연출이
       *  겹치면 1.25 를 base 로 잡아 영구히 남았다(실측: 시전 후 zoom 1.25 고정).
       *  기준값(absoluteBase)에서 복원하면 어떤 연출과 겹쳐도 원위치로 돌아온다. */
      const absoluteBase = (() => {
        try {
          const sc = scene as unknown as { perspZoom?: number; cameras: { main: { zoom: number } } };
          // 기준 줌을 알 수 있으면 그걸, 모르면 1.0 (Phaser 기본)
          return typeof sc.perspZoom === "number" && sc.perspZoom > 0 ? sc.perspZoom : 1;
        } catch { return 1; }
      })();
      const from = cam.zoom;
      cam.zoomTo(from * p.zoomPunch, 120);
      scene.time.delayedCall(160, () => {
        try {
          /* 1) 복귀 트윈 2) 최종 보정 — 다른 연출이 그 사이에 끼어들어도 원위치 보장 */
          cam.zoomTo(absoluteBase, 240);
          scene.time.delayedCall(300, () => {
            try { cam.zoom = absoluteBase; } catch { /* 씬 종료 무시 */ }
          });
        } catch { /* 씬 종료 경합 무시 */ }
      });
    }
  } catch { /* 카메라 미지원 무시 */ }
}
