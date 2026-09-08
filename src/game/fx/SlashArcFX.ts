import Phaser from "phaser";

/**
 * v4.9.0 — 회전베기 참격 궤적 셰이더 (스킬 전용 셰이더 1 — 유저 지시 #1)
 *
 *  Phaser 4 Shader GameObject 풀. 전사 계열 회전베기(spin/ragespin) 시전 시
 *  캐릭터 주위를 360° 한 바퀴 휩쓰는 절차적 GLSL 참격 궤적:
 *   - 이동하는 리딩 엣지(선단) + 뒤로 길게 늘어지는 잔꼬리(tail) 2겹
 *   - 반경 falloff로 스킬 반경에 맞는 얇은 링 밴드 형성 (2D 스프라이트로 못 만드는
 *     "빛의 칼날이 공간을 도는" 3D 느낌)
 *   - ShockwaveFX와 동일한 슬롯 분리 방식(shaderName별 프로그램 분리 → 유니폼 독립)
 *  - WebGL 전용: Canvas 폴백 환경에선 풀이 비어 spawn이 조용히 생략 (기존 fx-slash
 *    스프라이트 애니는 그대로 — 기존 틀 유지 원칙).
 *  - 풀 2장 = 동시 최대 2궤적 (버서커 이중 참격판 대응). fxLevel 0에선 호출부가 생략.
 */

const SLASH_ARC_FRAG = [
  "precision mediump float;",
  "varying vec2 outTexCoord;",
  "uniform float uProgress;", // 0→1 스윕 진행도
  "uniform vec3 uColor;",
  "uniform float uAlpha;",
  "uniform float uSpin;", // +1/-1 회전 방향
  "uniform float uStart;", // 시작 각도(라디안)
  "void main ()",
  "{",
  "    vec2 uv = outTexCoord - 0.5;",
  "    float r = length(uv) * 2.0;",
  "    float ang = atan(uv.y, uv.x);",
  "    /* 링 밴드 — 스킬 반경(r 0.52~0.98)에 얇은 참격 칼날 */",
  "    float band = smoothstep(0.30, 0.0, abs(r - 0.72) - 0.16);",
  "    /* 리딩 엣지 각도 — 2바퀴 중 1바퀴 스윕 */",
  "    float sweep = uStart + uSpin * uProgress * 6.2831853;",
  "    float d = uSpin * (ang - sweep);",
  "    d = mod(d + 6.2831853, 6.2831853);", // 0..2π (엣지 뒤쪽 거리)
  "    /* 잔꼬리 — 엣지 뒤 2.1라디안에 걸쳐 감쇠하는 궤적 + 선단 하이라이트 */",
  "    float tail = smoothstep(2.1, 0.0, d);",
  "    float lead = smoothstep(0.22, 0.0, d) * 1.4;",
  "    float a = clamp((tail * 0.5 + lead) * band, 0.0, 1.0) * uAlpha * (1.0 - uProgress * 0.55);",
  "    gl_FragColor = vec4(uColor * a, a);",
  "}",
].join("\n");

type ArcSlot = {
  obj: Phaser.GameObjects.Shader;
  startAt: number;
  duration: number;
  color: [number, number, number];
  alpha: number;
  spin: number;
  start: number;
  live: boolean;
  timer?: Phaser.Time.TimerEvent;
};

export class SlashArcFX {
  private slots: ArcSlot[] = [];

  constructor(private scene: Phaser.Scene, size = 2) {
    if (scene.game.renderer.type !== Phaser.WEBGL) return;
    for (let i = 0; i < size; i++) {
      try {
        const slot: ArcSlot = {
          obj: null as unknown as Phaser.GameObjects.Shader,
          startAt: 0,
          duration: 300,
          color: [1, 0.7, 0.55],
          alpha: 0.9,
          spin: 1,
          start: 0,
          live: false,
        };
        const obj = scene.add.shader(
          {
            name: `SlashArc${i}`,
            /* shaderName 슬롯별 분리 — 프로그램 캐시 충돌 방지 (ShockwaveFX 패턴) */
            shaderName: `SlashArcFrag${i}`,
            fragmentSource: SLASH_ARC_FRAG,
            setupUniforms: (setUniform) => {
              const t = slot.live
                ? Phaser.Math.Clamp((scene.time.now - slot.startAt) / slot.duration, 0, 1)
                : 1;
              setUniform("uProgress", t);
              setUniform("uColor", slot.color);
              setUniform("uAlpha", slot.live ? slot.alpha : 0);
              setUniform("uSpin", slot.spin);
              setUniform("uStart", slot.start);
            },
            initialUniforms: { uProgress: 1, uAlpha: 0 },
          },
          0,
          0,
          128,
          128
        );
        /* depth 38 — 충격파 링(39) 아래 엔티티(30) 위 */
        obj.setDepth(38).setActive(false).setVisible(false);
        slot.obj = obj;
        this.slots.push(slot);
      } catch {
        /* 셰이더 미지원/컴파일 실패 — 이 슬롯만 생략 */
      }
    }
  }

  /** 참격 궤적 재생 — spin: 회전 방향(+1/-1), start: 시작 각도(라디안, -0.9=좌측 위) */
  spawn(x: number, y: number, spin: number, tint = 0xffb090, scale = 1, duration = 300, alpha = 0.9, start = -0.9) {
    const slot = this.slots.find((s) => !s.live);
    if (!slot) return;
    const c = Phaser.Display.Color.IntegerToColor(tint);
    slot.color = [c.redGL, c.greenGL, c.blueGL];
    slot.alpha = alpha;
    slot.duration = duration;
    slot.startAt = this.scene.time.now;
    slot.spin = spin >= 0 ? 1 : -1;
    slot.start = start;
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
