import Phaser from "phaser";

/**
 * v4.7.0 — Phaser 4 Shader GameObject 기반 차원문 소용돌이 (3D 느낌 VFX 첫 단계)
 *
 *  Phaser 4 신 렌더러(Beam)의 ShaderQuad 파이프라인을 사용한 절차적 GLSL 이펙트.
 *  - 기존 차원문(8프레임 스프라이트 + CFXR 마법 입자 + 광원)은 그대로 유지하고
 *    뒤에 은은한 소용돌이 오라를 얹는 보강 레이어 — 기존 틀 유지 원칙 준수.
 *  - WebGL 전용: Canvas 폴백 환경에서는 생성하지 않는다 (호출부 가드).
 *  - 셰이더 1장 = 배치 종료 후 단독 드로우콜 1회 → 포탈당 1장으로 절제.
 */

/** 차원문 소용돌이 프래그먼트 셰이더 (standalone — pragma 없이 완결 GLSL).
 *  outTexCoord는 Phaser 4 ShaderQuad 버텍스가 제공하는 0~1 UV.
 *  극좌표 반경 기반 회전 변위로 3갈래 소용돌이 팔 + 중심 코어 글로우. */
const PORTAL_SWIRL_FRAG = [
  "precision mediump float;",
  "varying vec2 outTexCoord;",
  "uniform float uTime;",
  "uniform vec3 uColorInner;",
  "uniform vec3 uColorOuter;",
  "uniform float uAlpha;",
  "",
  "void main ()",
  "{",
  "    vec2 uv = outTexCoord - 0.5;",
  "    float r = length(uv) * 2.0;",
  "    float ang = atan(uv.y, uv.x);",
  "    float swirl = ang + uTime * 1.6 - r * 4.6;",
  "    float arm = sin(swirl * 3.0) * 0.5 + 0.5;",
  "    float glow = smoothstep(1.0, 0.12, r);",
  "    float core = smoothstep(0.46, 0.0, r);",
  "    float halo = smoothstep(0.9, 0.3, r) * (0.35 + 0.65 * arm);",
  "    vec3 col = mix(uColorOuter, uColorInner, core + arm * 0.35);",
  "    float alpha = (halo * 0.6 + core * 0.9) * glow * uAlpha;",
  "    float strength = 0.9 + 0.7 * core;",
  "    /* Phaser 4 NORMAL 블렌드 = 프리멀티플라이드 알파 (funcSrc=ONE) — RGB에 알파 선곱 필수 */",
  "    gl_FragColor = vec4(col * strength * alpha, alpha);",
  "}",
].join("\n");

export type PortalSwirl = {
  obj: Phaser.GameObjects.Shader;
  destroy: () => void;
};

/** 차원문 위치에 소용돌이 오라 생성 — WebGL 환경에서만, 실패 시 null(기존 포탈은 유지)
 *  @param tint1 중심색 (활성 파랑 계열 0x9adcff 권장) @param tint2 외곽색 (0x5a6cff 등) */
export function addPortalSwirl(
  scene: Phaser.Scene,
  x: number,
  y: number,
  tint1 = 0xd8f4ff,
  tint2 = 0x7e9bff,
  alpha = 0.5
): PortalSwirl | null {
  try {
    if (scene.game.renderer.type !== Phaser.WEBGL) return null;
    const c1 = Phaser.Display.Color.IntegerToColor(tint1);
    const c2 = Phaser.Display.Color.IntegerToColor(tint2);
    const obj = scene.add.shader(
      {
        name: "PortalSwirl",
        shaderName: "PortalSwirlFrag",
        fragmentSource: PORTAL_SWIRL_FRAG,
        setupUniforms: (setUniform) => {
          setUniform("uTime", scene.time.now / 1000);
          setUniform("uColorInner", [c1.redGL, c1.greenGL, c1.blueGL]);
          setUniform("uColorOuter", [c2.redGL, c2.greenGL, c2.blueGL]);
          setUniform("uAlpha", alpha);
        },
        initialUniforms: { uTime: 0, uAlpha: alpha },
      },
      x,
      y,
      104,
      128
    );
    obj.setDepth(2.8); // 포탈 스프라이트(depth 3) 뒤 — 지형(≤10) 아래 오라
    return {
      obj,
      destroy: () => {
        try { obj.destroy(); } catch { /* 씬 종료 경합 무시 */ }
      },
    };
  } catch {
    /* 셰이더 미지원/컴파일 실패 — 기존 포탈 그대로 동작 */
    return null;
  }
}
