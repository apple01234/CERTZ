import Phaser from "phaser";

/**
 * v4.8.0 — 충격파 링 셰이더 (3D 느낌 VFX 2단계 — 타격감 강화)
 *
 *  Phaser 4 Shader GameObject 풀. 크리티컬·약점·보스 격파 같은 "강한 순간"에
 *  확장하는 절차적 GLSL 링. 기존 스프라이트 링(shock_ring 트윈)과 별개 보강 레이어:
 *   - 반경 falloff가 매끈한 링 + 발동 초반 래디얼 플래시 2겹 구성
 *   - Shader GameObject는 오브젝트마다 독자 renderNode/programManager를 새로 할당받는다
 *     (phaser/src/gameobjects/shader/Shader.js — new ShaderQuad per object) →
 *     유니폼이 슬롯별로 독립이므로 풀링 안전.
 *   - 프래그먼트는 슬롯마다 shaderName을 다르게 줘 프로그램도 분리.
 *  - WebGL 전용: Canvas 폴백 환경에서는 풀이 비어 spawn이 조용히 무시된다
 *    (기존 이펙트는 그대로 — 기존 틀 유지 원칙).
 *  - 풀 3장 = 강한 순간 동시 최대 3건. 고갈 시 생략 → 남발돼도 프레임 예산 3쿼드로 상한.
 */

/** 충격파 프래그먼트 셰이더 (standalone 완결 GLSL).
 *  uProgress 0→1: 반경 확장 + 페이드아웃. uColor/uAlpha는 슬롯별 유니폼.
 *  NORMAL 블렌드(프리멀티플라이드) 대응 — RGB에 알파 선곱 필수. */
const SHOCK_FRAG = [
  "precision mediump float;",
  "varying vec2 outTexCoord;",
  "uniform float uProgress;",
  "uniform vec3 uColor;",
  "uniform float uAlpha;",
  "void main ()",
  "{",
  "    vec2 uv = outTexCoord - 0.5;",
  "    float r = length(uv) * 2.0;",
  "    float radius = uProgress * 1.12;",
  "    float d = abs(r - radius);",
  "    float ring = smoothstep(0.16, 0.0, d) * (1.0 - uProgress);",
  "    float flash = (1.0 - smoothstep(0.0, 0.24, uProgress)) * smoothstep(radius + 0.3, radius, r);",
  "    float a = clamp(ring * 0.85 + flash * 0.45, 0.0, 1.0) * uAlpha;",
  "    gl_FragColor = vec4(uColor * a, a);",
  "}",
].join("\n");

type WaveSlot = {
  obj: Phaser.GameObjects.Shader;
  startAt: number;
  duration: number;
  color: [number, number, number];
  alpha: number;
  live: boolean;
  timer?: Phaser.Time.TimerEvent;
};

export class ShockwaveFX {
  private slots: WaveSlot[] = [];

  constructor(private scene: Phaser.Scene, size = 3) {
    if (scene.game.renderer.type !== Phaser.WEBGL) return;
    for (let i = 0; i < size; i++) {
      try {
        const slot: WaveSlot = {
          obj: null as unknown as Phaser.GameObjects.Shader,
          startAt: 0,
          duration: 360,
          color: [1, 0.9, 0.5],
          alpha: 0.85,
          live: false,
        };
        const obj = scene.add.shader(
          {
            name: `Shockwave${i}`,
            /* shaderName 슬롯별 분리 — 프로그램 캐시 충돌 방지 */
            shaderName: `ShockwaveFrag${i}`,
            fragmentSource: SHOCK_FRAG,
            setupUniforms: (setUniform) => {
              const t = slot.live
                ? Phaser.Math.Clamp((scene.time.now - slot.startAt) / slot.duration, 0, 1)
                : 1;
              setUniform("uProgress", t);
              setUniform("uColor", slot.color);
              setUniform("uAlpha", slot.live ? slot.alpha : 0);
            },
            initialUniforms: { uProgress: 1, uAlpha: 0 },
          },
          0,
          0,
          96,
          96
        );
        /* depth 39 — 엔티티(30) 위 데미지텍스트(40) 아래 */
        obj.setDepth(39).setActive(false).setVisible(false);
        slot.obj = obj;
        this.slots.push(slot);
      } catch {
        /* 셰이더 미지원/컴파일 실패 — 이 슬롯만 생략 (기존 이펙트는 유지) */
      }
    }
  }

  /** 충격파 링 재생 — 풀 고갈 시 조용히 생략(강한 순간 과다 노출 방지) */
  spawn(x: number, y: number, tint = 0xffd76a, scale = 1, duration = 360, alpha = 0.85) {
    const slot = this.slots.find((s) => !s.live);
    if (!slot) return;
    const c = Phaser.Display.Color.IntegerToColor(tint);
    slot.color = [c.redGL, c.greenGL, c.blueGL];
    slot.alpha = alpha;
    slot.duration = duration;
    slot.startAt = this.scene.time.now;
    slot.live = true;
    slot.obj.setPosition(x, y).setScale(scale).setActive(true).setVisible(true);
    slot.timer?.remove();
    slot.timer = this.scene.time.delayedCall(duration + 30, () => {
      slot.live = false;
      try {
        slot.obj.setActive(false).setVisible(false);
      } catch {
        /* 씬 종료 경합 무시 */
      }
    });
  }

  destroy() {
    for (const s of this.slots) {
      s.timer?.remove();
      try {
        s.obj.destroy();
      } catch {
        /* 중복 파괴 무시 */
      }
    }
    this.slots = [];
  }
}
