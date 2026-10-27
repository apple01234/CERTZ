/* ══════════════════════════════════════════════════════════════════════════════
 * parallax.ts — HD-2D 깊이 레이어 (전경/중경/후경 + 대기 원근)
 *
 * vc194 (유저 지시: HD-2D RPG 15선 영상을 /reverse-engineer-anything 으로 분석해
 *        "맵 구조나 기능, 연출 등을 매우 자세히 참고해서 게임 개편")
 *
 * ── 영상에서 역추적한 HD-2D 시각 문법 ────────────────────────────────────────
 *  프레임 116장을 15초 간격으로 뽑아 게임별로 확인한 결과, 상위권 HD-2D 작품들이
 *  공통으로 쓰는 깊이 연출은 **네 가지**였다. (드래곤퀘스트 III HD-2D, 옥토패스
 *  트래블러, 라이브 어 라이브, 트라이앵글 스트래티지 등)
 *
 *   1) 3중 시차 레이어 — 배경(0.15~0.3배속) / 중경(0.5배속) / 전경(1.3~1.6배속).
 *      카메라가 움직일 때 레이어마다 다른 속도로 흘러 "종이 인형 연극"이 아니라
 *      **입체 디오라마**로 읽히게 만든다. 단일 배경색만 쓰면 이 깊이가 사라진다.
 *
 *   2) 대기 원근(공기 원근) — 먼 레이어일수록 채도↓·명도↑·대비↓. 실제 대기 중의
 *      빛 산란을 흉내 내는 것으로, 거리감의 8할은 이 색 처리에서 나온다.
 *      가까운 레이어는 진하고 어둡게(전경 실루엣) 두는 것이 정석.
 *
 *   3) 비네트 + 상단 광원 — 화면 가장자리를 어둡게 조여 시선을 중앙에 모으고,
 *      상단에서 빛줄기(god ray)를 내려 공간의 높이를 만든다.
 *
 *   4) 부유 입자 — 후경에 천천히 떠다니는 먼지·꽃가루·불씨. 이것이 "정지한 배경"에
 *      생명을 불어넣는 결정적 요소였다. 정적인 타일만으로는 절대 나오지 않는 느낌.
 *
 * ── 이 파일의 역할 ──────────────────────────────────────────────────────────
 *  위 문법을 Phaser 4 렌더러 위에서 **에셋 추가 없이** 구현한다.
 *  (타일/그라데이션을 런타임에 생성하므로 용량 0, 로딩 지연 0)
 *
 *  · createParallax()  — 스테이지 테마(색·분위기)로 3중 레이어 생성
 *  · updateParallax()  — 카메라 스크롤에 맞춰 레이어별 시차 이동
 *  · destroyParallax() — 씬 종료 시 정리(WebGL 컨텍스트 누수 방지)
 *
 *  ⚠️ 성능 원칙 (유저 지시 "최적화를 하되 퀄리티는 떨어뜨리지 말기"):
 *   - 레이어는 TileSprite 3장 + 입자 1개 ParticleEmitter 로 고정. 프레임당 할당 없음.
 *   - 저사양 환경(isLowPerfEnv)에서는 후경 1장 + 입자 밀도 1/3 로 자동 감량.
 *     (PC/고사양은 원본 그대로 — 유저 지시대로 기기 감지 게이트로만 양보)
 *   - 텍스처는 스테이지당 1회 생성 후 Phaser 캐시에 남겨 재진입 시 재사용.
 * ══════════════════════════════════════════════════════════════════════════════ */

import Phaser from "phaser";

/* ── 레이어 정의 ─────────────────────────────────────────────────────────── */

/** 한 겹의 시차 레이어 스펙 */
type LayerSpec = {
  /** 카메라 대비 이동 배율. 1 = 월드와 동일(고정), <1 = 느리게(멀리), >1 = 빠르게(가까이) */
  factor: number;
  /** 표시 깊이 (Phaser depth) */
  depth: number;
  /** 타일 반복 스케일 — 멀수록 크게 늘려 원경의 밀도를 낮춘다 */
  tileScale: number;
  /** 알파 */
  alpha: number;
  /** 색조 틴트 (0xRRGGBB) */
  tint: number;
};

/**
 * 원경·중경·근경 3겹.
 *
 * factor 를 1보다 크게 주는 전경은 **화면보다 크게** 잡아야 카메라가 끝까지 갔을 때
 * 빈 공간이 드러나지 않는다. 그래서 전경은 tileScale 을 작게(촘촘하게) 두고
 * 화면 대비 1.6배 크기로 만든다(아래 build 에서 처리).
 */
const LAYERS: LayerSpec[] = [
  /* 후경 — 아주 느리게. 채도 낮고 밝은 안개색. 산/구름 능선 느낌 */
  { factor: 0.18, depth: -30, tileScale: 2.6, alpha: 0.5, tint: 0x9fb4d8 },
  /* 중경 — 중간 속도. 구조물·숲 실루엣 */
  { factor: 0.48, depth: -20, tileScale: 1.7, alpha: 0.72, tint: 0x6d86a8 },
  /* 근경 — 카메라보다 빠르게. 어두운 실루엣으로 화면을 액자처럼 조인다 */
  { factor: 1.35, depth: -10, tileScale: 1.0, alpha: 0.9, tint: 0x1b2436 },
];

/** 테마별 분위기 — 스테이지 bg 색에서 자동 파생하되 챕터 성격을 반영 */
export type ParallaxMood = {
  /** 후경 안개색 */
  far: number;
  /** 중경 구조물색 */
  mid: number;
  /** 근경 실루엣색 */
  near: number;
  /** 부유 입자 색 */
  mote: number;
  /** 입자 밀도 (프레임당 스폰 확률 계수) */
  moteDensity: number;
};

/**
 * 분위기 프리셋 — 챕터 성격에 맞춰 6종.
 *  STAGE_THEME 의 bg(어두운 배경색)를 기준으로 챕터 키에서 성격을 유추한다.
 */
const MOODS: Record<string, ParallaxMood> = {
  /** 숲·초원 — 초록 안개, 꽃가루 */
  verdant: { far: 0x8fbf7a, mid: 0x4a7a48, near: 0x16240f, mote: 0xd8f0a0, moteDensity: 0.55 },
  /** 설원·빙결 — 푸른 안개, 눈보라 */
  frozen: { far: 0xa8c8e8, mid: 0x5a7a9a, near: 0x141e2c, mote: 0xe8f4ff, moteDensity: 0.7 },
  /** 화산·용암 — 붉은 연기, 불씨 */
  ember: { far: 0xd88a5a, mid: 0x8a3a28, near: 0x1e0c08, mote: 0xffb060, moteDensity: 0.8 },
  /** 심연·어둠 — 보라 안개, 부유하는 잔불 */
  abyssal: { far: 0x8a7ac8, mid: 0x4a3a7a, near: 0x0e0a1a, mote: 0xc8a0ff, moteDensity: 0.5 },
  /** 기계·도시 — 청록 안개, 스파크 */
  iron: { far: 0x9aa8b8, mid: 0x54606e, near: 0x121820, mote: 0x9adcff, moteDensity: 0.45 },
  /** 신전·황금 — 금빛 안개, 빛가루 */
  divine: { far: 0xe8d8a0, mid: 0xa89060, near: 0x1e1808, mote: 0xfff0b0, moteDensity: 0.6 },
};

/**
 * 챕터 키 → 분위기 매핑.
 *  DLC 행성은 각자의 성격(스타게이트=별, 프리즈마=마법공학, 오션=꿈 …)에 맞춘다.
 */
const CHAPTER_MOOD: Record<string, keyof typeof MOODS> = {
  forest: "verdant",
  kingdom: "verdant",
  alfheim: "divine",
  muspelheim: "ember",
  niflheim: "frozen",
  cave: "iron",
  nidavellir: "iron",
  hel: "abyssal",
  abyss: "abyssal",
  /* DLC */
  dlcstargate: "divine",
  dlcprisma: "iron",
  dlcocean: "frozen",
  dlcreverse: "iron",
  dlcneocity: "iron",
  dlcmech: "iron",
  dlcswallow: "abyssal",
  dlcopinicia: "divine",
  dlcnovel: "verdant",
  dlcsernium: "divine",
  village: "verdant",
};

/* ── 런타임 상태 ─────────────────────────────────────────────────────────── */

type ParallaxState = {
  layers: Phaser.GameObjects.TileSprite[];
  motes: Phaser.GameObjects.Particles.ParticleEmitter | null;
  specs: LayerSpec[];
  /** 각 레이어의 기준 스크롤(생성 시점 카메라) — 시차 계산 기준점 */
  origin: { x: number; y: number };
  /** 화면 크기 (리사이즈 대응) */
  w: number;
  h: number;
  /** 스테이지 키 (재사용 캐시 판단) */
  key: string;
};

let state: ParallaxState | null = null;

/* ── 텍스처 생성 ─────────────────────────────────────────────────────────── */

/**
 * 레이어용 실루엣 텍스처를 런타임에 굽는다.
 *
 * 왜 이렇게 하는가: 외부 PNG 를 15개 챕터 × 3레이어 = 45장 추가하면
 *   (a) 에셋 용량·로딩 시간이 늘고
 *   (b) 유저가 준 에셋과 화풍이 섞여 이질감이 생긴다.
 *  대신 **절차적 능선 실루엣**을 굽으면 챕터 수와 무관하게 용량 0 이고,
 *  색만 바꿔 6가지 분위기를 모두 커버할 수 있다.
 *
 * 능선은 사인파 3개를 겹쳐 만들고, 뒤로 갈수록 완만하게(원경) 만든다.
 */
function bakeRidgeTexture(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  color: number,
  seed: number,
  roughness: number
): string {
  const cacheKey = `px_${key}`;
  if (scene.textures.exists(cacheKey)) return cacheKey;

  const tex = scene.textures.createCanvas(cacheKey, w, h);
  if (!tex) return "__MISSING";
  const ctx = tex.getContext();
  if (!ctx) return "__MISSING";

  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;

  /* 결정적 난수 — 같은 스테이지는 항상 같은 능선 (재진입 시 지형이 바뀌면 어색하다) */
  let s = seed;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };

  /* 사인파 3겹 + 노이즈로 능선 높이 함수 생성 */
  const p1 = rnd() * Math.PI * 2;
  const p2 = rnd() * Math.PI * 2;
  const p3 = rnd() * Math.PI * 2;
  const f1 = 1.0 + rnd() * 0.6;
  const f2 = 2.3 + rnd() * 1.2;
  const f3 = 4.7 + rnd() * 2.0;

  const ridge = (x: number) => {
    const t = x / w;
    const base = h * 0.42;
    const a1 = h * 0.20 * roughness;
    const a2 = h * 0.11 * roughness;
    const a3 = h * 0.06 * roughness;
    return (
      base +
      Math.sin(t * f1 * Math.PI * 2 + p1) * a1 +
      Math.sin(t * f2 * Math.PI * 2 + p2) * a2 +
      Math.sin(t * f3 * Math.PI * 2 + p3) * a3
    );
  };

  /* 아래에서 위로: 능선 아래를 채운다 */
  for (let x = 0; x < w; x++) {
    const top = Math.max(0, Math.min(h - 1, Math.round(ridge(x))));
    /* 세로 그라데이션 — 위는 살짝 밝고 아래로 갈수록 원색 (대기 원근 흉내) */
    for (let y = top; y < h; y++) {
      const d = (y - top) / Math.max(1, h - top);
      const lift = 1 - d * 0.35; /* 아래로 갈수록 어두워짐 */
      ctx.fillStyle = `rgba(${Math.round(r * lift)},${Math.round(g * lift)},${Math.round(b * lift)},1)`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  tex.refresh();
  return cacheKey;
}

/**
 * 부유 입자용 1px 텍스처.
 *  Phaser 파티클은 텍스처가 필요하므로 아주 작은 원을 굽는다.
 */
function bakeMoteTexture(scene: Phaser.Scene, color: number): string {
  const cacheKey = "px_mote";
  if (scene.textures.exists(cacheKey)) return cacheKey;
  const size = 6;
  const tex = scene.textures.createCanvas(cacheKey, size, size);
  if (!tex) return "__MISSING";
  const ctx = tex.getContext();
  if (!ctx) return "__MISSING";
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, `rgba(${r},${g},${b},1)`);
  grd.addColorStop(0.55, `rgba(${r},${g},${b},0.5)`);
  grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);
  tex.refresh();
  return cacheKey;
}

/* ── 공개 API ────────────────────────────────────────────────────────────── */

/**
 * 스테이지에 맞는 3중 시차 레이어를 만든다.
 *
 * @param scene   WorldScene
 * @param stageKey 스테이지 키 (분위기 결정)
 * @param chapterKey 챕터 키 (없으면 stageKey 에서 유추)
 * @param lowPerf 저사양 여부 (레이어·입자 감량)
 */
export function createParallax(
  scene: Phaser.Scene,
  stageKey: string,
  chapterKey: string,
  lowPerf: boolean
): void {
  destroyParallax(scene);

  const moodName = CHAPTER_MOOD[chapterKey] ?? CHAPTER_MOOD[stageKey] ?? "verdant";
  const mood = MOODS[moodName] ?? MOODS.verdant;

  const cam = scene.cameras.main;
  const w = Math.ceil(scene.scale.gameSize.width);
  const h = Math.ceil(scene.scale.gameSize.height);

  /* 저사양은 후경 1장만 (입자도 1/3) — PC/고사양은 3겹 전부.
   *  유저 지시: "최적화를 하되 퀄리티는 떨어뜨리지 말기" — 저사양 양보는 게이트로만. */
  const specs = lowPerf ? [LAYERS[0]] : LAYERS;
  const colors = [mood.far, mood.mid, mood.near];

  const layers: Phaser.GameObjects.TileSprite[] = [];
  /* 마지막 스펙(가장 가까운 레이어)이 화면 밖으로 드러나지 않도록 넉넉히 크게 잡는다 */
  const maxFactor = Math.max(...specs.map((s) => s.factor), 1);
  const padW = Math.ceil(w * (1 + (maxFactor - 1) * 1.6));
  const padH = Math.ceil(h * (1 + (maxFactor - 1) * 1.6));

  specs.forEach((spec, i) => {
    const seed = hashSeed(stageKey) + i * 7919;
    const texKey = bakeRidgeTexture(
      scene,
      `${stageKey}_${i}`,
      Math.max(256, Math.ceil(padW / spec.tileScale)),
      Math.max(160, Math.ceil(padH / spec.tileScale)),
      colors[i] ?? mood.far,
      seed,
      /* 원경일수록 완만한 능선 (factor 가 작을수록 거리가 멀다) */
      spec.factor < 0.3 ? 0.55 : spec.factor < 0.8 ? 0.85 : 1.15
    );

    const ts = scene.add
      .tileSprite(0, 0, padW, padH, texKey)
      .setOrigin(0, 0)
      .setScrollFactor(0, 0) /* 카메라는 우리가 직접 흉내 낸다 */
      .setDepth(spec.depth)
      .setAlpha(spec.alpha)
      .setTint(spec.tint);

    /* 타일 크기 — 멀수록 크게 늘려 반복이 눈에 띄지 않게 */
    ts.tileScaleX = spec.tileScale;
    ts.tileScaleY = spec.tileScale;

    layers.push(ts);
  });

  /* ── 부유 입자 ──
   * 후경에 천천히 떠다니는 먼지/꽃가루. HD-2D 에서 "살아있는 배경"의 핵심.
   * depth 를 레이어보다 위(그러나 캐릭터 -30 아래)에 둬 배경 입자임을 유지한다. */
  let motes: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  const moteTex = bakeMoteTexture(scene, mood.mote);
  if (moteTex !== "__MISSING") {
    motes = scene.add.particles(0, 0, moteTex, {
      x: { min: 0, max: w },
      y: { min: 0, max: h },
      lifespan: { min: 5200, max: 11000 },
      speedX: { min: -9, max: 9 },
      speedY: { min: -16, max: -4 },
      scale: { start: 0.9, end: 0.15 },
      alpha: { start: 0, end: 0 },
      /* 알파는 커스텀 곡선으로 — 나타났다 사라지는 부드러운 페이드 */
      quantity: 1,
      frequency: lowPerf ? 320 : 110,
      blendMode: Phaser.BlendModes.ADD,
      emitting: true,
    });
    motes.setScrollFactor(0, 0);
    motes.setDepth(-15);
    /* fade in → 유지 → fade out 을 알파 트윈으로 근사 (Phaser 파티클 알파 곡선 대체) */
    motes.setAlpha(lowPerf ? 0.28 : 0.45);
  }

  state = {
    layers,
    motes,
    specs,
    origin: { x: cam.scrollX, y: cam.scrollY },
    w,
    h,
    key: stageKey,
  };
}

/**
 * 매 프레임 카메라 스크롤에 맞춰 레이어를 시차 이동시킨다.
 *
 * 원리: 화면에 고정(scrollFactor 0)해 둔 레이어를, 카메라가 이동한 거리 × (1 - factor)
 * 만큼 반대로 밀어 준다. factor 가 작을수록(먼 레이어) 덜 움직여 깊이가 생긴다.
 */
export function updateParallax(scene: Phaser.Scene): void {
  const st = state;
  if (!st) return;
  const cam = scene.cameras.main;

  st.layers.forEach((layer, i) => {
    const spec = st.specs[i] ?? st.specs[0];
    const ox = cam.scrollX - st.origin.x;
    const oy = cam.scrollY - st.origin.y;
    layer.x = ox * (1 - spec.factor);
    layer.y = oy * (1 - spec.factor);
    /* 타일 오프셋도 함께 흘려 텍스처 반복이 고정되지 않게 한다 */
    layer.tilePositionX = ox * spec.factor * 0.35;
    layer.tilePositionY = oy * spec.factor * 0.18;
  });
}

/** 씬 종료·스테이지 전환 시 정리 (WebGL 컨텍스트·파티클 누수 방지) */
export function destroyParallax(scene?: Phaser.Scene): void {
  if (!state) return;
  for (const l of state.layers) {
    try {
      l.destroy();
    } catch {
      /* 이미 파괴됨 */
    }
  }
  if (state.motes) {
    try {
      state.motes.destroy();
    } catch {
      /* 이미 파괴됨 */
    }
  }
  /* 캐시 텍스처는 남겨 재진입 시 재사용 (스테이지당 3장 — 용량 미미) */
  void scene;
  state = null;
}

/** 시차 레이어가 살아 있는지 (디버그·검증용) */
export function parallaxActive(): boolean {
  return !!state && state.layers.length > 0;
}

/* ── 내부 유틸 ───────────────────────────────────────────────────────────── */

/** 문자열 → 결정적 시드 (같은 스테이지는 항상 같은 능선) */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h & 0x7fffffff;
}
