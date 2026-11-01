import Phaser from "phaser";

/**
 * vc214 — 적 소멸 dissolve 셰이더 (Phaser 4 ShaderQuad)
 *
 * 왜 필요한가
 * -----------
 * 현재 적은 `die()` 에서 파티클(폭발·연기)을 터뜨린 뒤 **60ms 후 즉시 destroy** 된다.
 * 즉 스프라이트 자체는 사라지는 과정이 없고 "팟 하고 없어진" 인상만 남는다.
 * 여기에 노이즈 임계값 dissolve 를 넣으면 몸이 위에서부터 재로 흩어지며 사라진다.
 *
 * 설계 근거 (`agd-shader-programming` 스킬)
 * ----------------------------------------
 *  · 임계값을 `amount` 로 직접 자르면 amount=0 일 때도 노이즈 < edge 인 픽셀이 남아
 *    "완전히 보임" 상태에 반짝이는 점이 생긴다. 스킬이 경고한 바로 그 버그다.
 *    → `cut = amount * (1 + edge) - edge` 로 보정해 amount=0 에서 cut<0 → 절대 잘리지 않게.
 *  · `smoothstep(e0, e1, x)` 는 e0 >= e1 이면 GPU 별로 미정의 동작이다.
 *    → 경계 밴드는 항상 `smoothstep(cut, cut + edge, n)` 처럼 오름차순으로 쓴다.
 *  · Phaser 4 NORMAL 블렌드는 프리멀티플라이드 알파(ONE) → RGB 에 알파를 선곱한다.
 *    (PortalFX.ts 의 같은 주석 참고 — 이 게임의 확립된 규약)
 *  · `discard` 는 early-Z 를 깨고 모바일 타일 GPU 에서 비싸다. 소멸은 어차피
 *    반투명 합성이 필요하므로 alpha 로 처리한다(discard 미사용).
 */

/** dissolve 프래그먼트 — standalone GLSL (pragma 없이 완결) */
const DISSOLVE_FRAG = [
  "precision mediump float;",
  "varying vec2 outTexCoord;",
  "uniform sampler2D uTex;",       // 원본 스프라이트
  "uniform sampler2D uNoise;",     // 노이즈(그레이스케일)
  "uniform float uAmount;",        // 0 = 완전히 보임, 1 = 완전 소멸
  "uniform float uEdge;",          // 경계 밴드 폭
  "uniform vec3 uEdgeColor;",      // 밴드 발광색
  "uniform float uAlpha;",         // 전체 투명도
  "",
  "void main ()",
  "{",
  "    vec4 src = texture2D(uTex, outTexCoord);",
  "    if (src.a <= 0.004) { gl_FragColor = vec4(0.0); return; }",
  "    float n = texture2D(uNoise, outTexCoord).r;",
  /* amount=0 → cut<0 (아무것도 안 잘림), amount=1 → cut>=1 (전부 잘림).
   * edge 를 더해 밴드가 0 아래에서 시작하므로 "완전히 보임"에 점이 생기지 않는다. */
  "    float cut = uAmount * (1.0 + uEdge) - uEdge;",
  "    float keep = smoothstep(cut, cut + uEdge, n);",  // 0=소멸, 1=유지
  "    float band = 1.0 - abs(keep - 0.5) * 2.0;",      // 밴드에서 1, 양 끝에서 0
  "    vec3 col = mix(src.rgb, uEdgeColor, band * 0.85);",
  "    float a = src.a * keep * uAlpha;",
  /* 프리멀티플라이드 알파 유지 */
  "    gl_FragColor = vec4(col * a, a);",
  "}",
].join("\n");

export type DissolveHandle = {
  /** 0..1 진행도 설정 */
  setAmount: (v: number) => void;
  destroy: () => void;
};

/* 동시 활성 dissolve 수. 이 프로젝트는 모바일 WebView 에서 **GPU 컨텍스트 유실**을
 * 실제로 겪어 셰이더를 의도적으로 줄여 왔다(WorldScene 1656 주석 참고).
 * 사망은 몰려서 일어나므로(한 화면 몬스터 15~20마리) 예산 없이 붙이면
 * 셰이더 오브젝트가 순간적으로 십수 개 생겨 그 위험을 다시 만든다.
 * 여기서는 **동시 6개**로 제한하고, 초과분은 조용히 null 을 돌려 기존 연출만 남긴다. */
const MAX_ACTIVE = 6;
let activeCount = 0;

/** 현재 활성 dissolve 수 (디버그/테스트용) */
export function activeDissolveCount(): number {
  return activeCount;
}

/** 64x64 노이즈 텍스처를 1회 생성해 캐시한다(몬스터마다 만들면 메모리 낭비) */
const NOISE_KEY = "vc214_dissolve_noise";
function ensureNoise(scene: Phaser.Scene): string | null {
  if (scene.textures.exists(NOISE_KEY)) return NOISE_KEY;
  try {
    const size = 64;
    const cv = document.createElement("canvas");
    cv.width = cv.height = size;
    const ctx = cv.getContext("2d");
    if (!ctx) return null;
    const img = ctx.createImageData(size, size);
    /* 값 노이즈 + 2회 스무딩: 순수 난수는 dissolve 경계가 '지글지글' 거린다.
     * 부드러운 장(field)을 쓰면 재가 덩어리로 흩어지는 느낌이 난다. */
    const raw = new Float32Array(size * size);
    let seed = 20261031;
    const rnd = () => {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      return ((seed >>> 0) % 100000) / 100000;
    };
    for (let i = 0; i < raw.length; i++) raw[i] = rnd();
    const smooth = new Float32Array(raw.length);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let s = 0, n = 0;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const xx = (x + dx + size) % size;
            const yy = (y + dy + size) % size;
            s += raw[yy * size + xx];
            n++;
          }
        }
        smooth[y * size + x] = s / n;
      }
    }
    // 0..1 로 정규화
    let lo = 1, hi = 0;
    for (const v of smooth) { if (v < lo) lo = v; if (v > hi) hi = v; }
    const span = Math.max(1e-6, hi - lo);
    for (let i = 0; i < smooth.length; i++) {
      const g = Math.round(((smooth[i] - lo) / span) * 255);
      img.data[i * 4] = g;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = g;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    scene.textures.addCanvas(NOISE_KEY, cv);
    return NOISE_KEY;
  } catch {
    return null;
  }
}

/**
 * 스프라이트 소멸 dissolve 를 재생한다.
 * WebGL 이 아니거나 준비 실패 시 `null` 을 돌려주고, 호출부는 기존 연출을 그대로 쓴다.
 *
 * @param texKey  dissolve 할 스프라이트가 든 텍스처 키
 * @param frame   프레임 이름(아틀라스/시트인 경우)
 */
export function spawnDissolve(
  scene: Phaser.Scene,
  textureKey: string,
  x: number,
  y: number,
  opts: {
    frame?: string | number;
    duration?: number;
    edgeColor?: number;
    alpha?: number;
    depth?: number;
    scale?: number;
    flipX?: boolean;
  } = {},
): DissolveHandle | null {
  try {
    if (scene.game.renderer.type !== Phaser.WEBGL) return null;
    if (!scene.textures.exists(textureKey)) return null;
    /* 예산 초과 → 이번 사망은 dissolve 를 생략한다(기존 파티클만).
     * 프레임이 밀리는 것보다 연출 1개를 빼는 편이 낫다. */
    if (activeCount >= MAX_ACTIVE) return null;
    const noiseKey = ensureNoise(scene);
    if (!noiseKey) return null;

    const dur = opts.duration ?? 420;
    const edge = 0.16;
    const c = Phaser.Display.Color.IntegerToColor(opts.edgeColor ?? 0xffc98a);

    const obj = scene.add.shader(
      {
        name: "vc214-dissolve",
        fragmentSource: DISSOLVE_FRAG,
        // 셰이더가 샘플링할 텍스처를 유니폼으로 넘긴다
        setupUniforms: (setUniform: (name: string, value: unknown) => void) => {
          setUniform("uTex", scene.textures.get(textureKey));
          setUniform("uNoise", scene.textures.get(noiseKey));
          setUniform("uAmount", 0);
          setUniform("uEdge", edge);
          setUniform("uEdgeColor", [c.red / 255, c.green / 255, c.blue / 255]);
          setUniform("uAlpha", opts.alpha ?? 1);
        },
      },
      x,
      y,
      64,
      64,
    );
    obj.setOrigin(0.5);
    obj.setDepth(opts.depth ?? 30);
    obj.setScale(opts.scale ?? 1);
    /* Shader 에는 setFlipX 가 없다(타입 확인). 좌우 반전은 음수 스케일로 준다
     * — 프리멀티플라이드 알파에는 영향이 없다. */
    if (opts.flipX) obj.setScale(-(opts.scale ?? 1), opts.scale ?? 1);

    activeCount++;
    let released = false;
    const release = () => {
      if (released) return;   // onComplete 와 수동 destroy 가 겹쳐도 1회만 감소
      released = true;
      activeCount = Math.max(0, activeCount - 1);
    };

    let amount = 0;
    const setAmount = (v: number) => {
      amount = v;
      try {
        obj.setUniform("uAmount", v);
      } catch {
        /* 셰이더가 파괴된 뒤 호출 — 무시 */
      }
    };

    /* 트윈으로 진행도만 올린다. 셰이더 내부에서 임계값을 다루므로
     * 매 프레임 텍스처를 굽지 않는다(고비용 회피). */
    scene.tweens.add({
      targets: { v: 0 },
      v: 1,
      duration: dur,
      ease: "Quad.easeIn",
      onUpdate: (tw) => setAmount((tw.targets[0] as { v: number }).v),
      onComplete: () => {
        release();
        try { obj.destroy(); } catch { /* 이미 파괴됨 */ }
      },
    });
    // 초기값 0 은 setupUniforms 가 이미 넣었다 — 상태 일관성을 위해 한 번 더
    void amount;

    return {
      setAmount,
      destroy: () => {
        release();
        try { obj.destroy(); } catch { /* noop */ }
      },
    };
  } catch {
    return null;
  }
}
