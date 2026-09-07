import Phaser from "phaser";

/**
 * v4.1.5 — 동적 조명 레이어 (Lighting Framework)
 *
 *  지형별 "암전 오버레이" + 광원 스프라이트(ADD 블렌드) 풀로 구성된
 *  모바일 친화적 2D 조명 시스템. Phaser Light2D 파이프라인(노멀맵 요구·
 *  스프라이트 전체 파이프라인 교체) 대비:
 *   - 오버레이 1매 + ADD 광원 N장으로 구성 → 저사양 기기에서도 안정
 *   - Canvas 렌더러 폴백에서도 동일하게 동작
 *
 *  구성:
 *   1. ambient  — 챕터별 어둠(반투명 렉트, 스크롤 고정, depth 55)
 *   2. light    — 광원 스프라이트(ADD, depth 56) + 플리커 트윈
 *   3. player   — 플레이어 추종 횃불 광원(암전 챕터에서 시야 확보)
 *
 *  depth 규약: 지형(≤10) < 엔티티(15~30) < 데미지텍스트(40→v4.1.5에서 56으로 상향)
 *              < 어둠(55) < 광원(56) < 미니맵/HUD(95+)
 */

/** 챕터별 암전 프로필 — alpha 0 = 암전 없음
 *  v4.3.0 — 유저 지시 "니플헤임, 요툰헤임, 스바르트알프헤임 등 어두운 분위기의 챕터만 맵 어둡게 + 불빛":
 *  화산(무스펠헤임)·빛의 성전(알프헤임)은 밝은 분위기라 암전 목록에서 제외하고,
 *  극지/동굴/광산/저승/심연 계열 5챕터만 암전 + 횃불 광원을 유지한다. */
const CHAPTER_AMBIENT: Record<string, { color: number; alpha: number }> = {
  cave: { color: 0x0a0818, alpha: 0.58 },       // 7장 스바르트알프헤임 — 어둠 요정의 수정 광맥
  nidavellir: { color: 0x0a0818, alpha: 0.58 }, // 8장 니다벨리르 — 룬 광산
  hel: { color: 0x120a10, alpha: 0.54 },        // 9장 헬
  abyss: { color: 0x080614, alpha: 0.55 },      // 10장 세계수의 뿌리 — 심연
  niflheim: { color: 0x060c16, alpha: 0.48 },   // 6장 니플헤임 — 얼음의 성전
};

export type AmbientProfile = { color: number; alpha: number } | null;

/** 챕터 키로 암전 프로필 조회 (비암전 챕터는 null) */
export function ambientFor(chapter: string): AmbientProfile {
  return CHAPTER_AMBIENT[chapter] ?? null;
}

export type LightOpts = {
  /** 광원 색조 (기본 따뜻한 횃불빛) */
  tint?: number;
  /** 반경 배율 (pk_light_01 512px 기준) */
  scale?: number;
  /** 기본 밝기 */
  alpha?: number;
  /** 플리커(깜빡임) 진폭 — 0이면 정상광 */
  flicker?: number;
};

export class Lighting {
  private scene: Phaser.Scene;
  private overlay: Phaser.GameObjects.Rectangle | null = null;
  private lights: Phaser.GameObjects.Image[] = [];
  private playerLight: Phaser.GameObjects.Image | null = null;
  private ambientAlpha = 0;
  private baseScale = 1;
  private baseAlpha = 0;
  private flickerAmt = 0;
  private phase = Math.random() * Math.PI * 2;
  /** v4.2.0 — 구역 진행에 따른 횃불 축소 배율 (1 = 기본, 구역마다 ×0.93, 최소 0.4) */
  private torchMul = 1;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** 챕터 암전 + 플레이어 광원 구성 — create()에서 1회 호출 */
  setupAmbient(chapter: string, hasPlayer: boolean) {
    const prof = ambientFor(chapter);
    if (!prof) return;
    const cam = this.scene.cameras.main;
    this.ambientAlpha = prof.alpha;
    // 어둠 오버레이 — 카메라 고정(스크롤 무관). 카메라 크기보다 넉넉히(회전/줌 대비)
    this.overlay = this.scene.add
      .rectangle(0, 0, cam.width + 4, cam.height + 4, prof.color, prof.alpha)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(55);
    // 플레이어 추종 광원 — 암전 챕터에서 시야 확보 (횃불을 든 사냥꾼)
    if (hasPlayer) {
      this.playerLight = this.scene.add
        .image(0, 0, "pk_light_01")
        .setDepth(56)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xffc890)
        .setScale(1.35)
        .setAlpha(0.5);
      this.baseScale = 1.35;
      this.baseAlpha = 0.5;
      this.flickerAmt = 0.05;
    }
  }

  /** v4.2.0 — 구역(sub) 진행률에 따른 횃불 광원 축소 (유저 지시: 스테이지를 지날때마다 줄어들게 —
   *  보스 구역에서 시야가 좁아져 투사체 회피 난이도 상승). sub 1 = 100%, 이후 구역마다 ×0.93, 하한 40%.
   *  밝은 챕터(오버레이 없음)는 효과가 체감되지 않는다 (암전 챕터에서만 의미 있음). */
  setTorchStage(sub: number) {
    this.torchMul = Math.max(0.4, 1 - Math.max(0, sub - 1) * 0.07);
    if (this.playerLight) {
      this.playerLight.setScale(this.baseScale * this.torchMul);
      this.playerLight.setAlpha(this.baseAlpha * (0.7 + 0.3 * this.torchMul));
    }
  }

  /** 정적 광원 등록 (횃불/모닥불/포탈/수정 등) — ADD 글로우 + 플리커 */
  addLight(x: number, y: number, opts: LightOpts = {}) {
    const tint = opts.tint ?? 0xffa040;
    const scale = opts.scale ?? 0.9;
    const alpha = opts.alpha ?? 0.3;
    const flicker = opts.flicker ?? 0.08;
    const g = this.scene.add
      .image(x, y, "pk_light_01")
      .setDepth(56)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(tint)
      .setScale(scale)
      .setAlpha(alpha);
    if (flicker > 0) {
      this.scene.tweens.add({
        targets: g,
        alpha: Math.min(1, alpha + flicker * 2),
        scale: scale * 1.12,
        duration: 480 + Math.random() * 420,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });
    }
    this.lights.push(g);
    return g;
  }

  /** 매 프레임 갱신 — 플레이어 광원 추적 + 미세 플리커 (update에서 호출) */
  update(px: number, py: number, dt: number) {
    if (this.playerLight) {
      const k = 1 - Math.pow(0.001, dt / 1000); // 프레임율 독립 보간
      this.playerLight.x += (px - this.playerLight.x) * k;
      this.playerLight.y += (py - this.playerLight.y) * k;
      this.phase += dt * 0.006;
      const f = 1 + Math.sin(this.phase) * this.flickerAmt + Math.sin(this.phase * 2.7) * this.flickerAmt * 0.5;
      /* v4.2.0 — torchMul 반영: 구역 진행할수록 작아지고 어두워지는 횃불 */
      this.playerLight.setAlpha(this.baseAlpha * f * (0.7 + 0.3 * this.torchMul));
      this.playerLight.setScale(this.baseScale * this.torchMul * (1 + (f - 1) * 0.35));
    }
  }

  /** 씬 종료 정리 — shutdown에서 호출 */
  destroy() {
    this.overlay?.destroy();
    this.overlay = null;
    for (const l of this.lights) l.destroy();
    this.lights = [];
    this.playerLight?.destroy();
    this.playerLight = null;
  }
}
