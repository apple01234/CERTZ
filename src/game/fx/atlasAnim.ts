/**
 * vc206 (지시 #8) — 아틀라스 스프라이트를 **애니메이션으로** 재생하는 헬퍼.
 *
 * 유저 지적: "아우라 VFX 들 아틀라스 스프라이트인지 확인하고 맞다면 애니메이션으로 적용해
 *            (지금 4개짜리 애니메이션이 그냥 사진 한장으로 표현되고 있는 버그 있음)"
 *
 * 문제
 *   `gvu_shockwave_fiery`(512×256 = 2프레임), `gvu_trail_wave`(512×256 = 2프레임),
 *   `gvu_energybolts`(512×256 = 2프레임) 등은 **가로 프레임 시트**인데
 *   `scene.add.image()` 로 1장만 그려서, 시트 전체가 납작하게 눌린 그림 한 장으로 보였다.
 *   (FifthAura 의 barrier/halo, UltCinematic 등에서 발생)
 *
 * 해법
 *   텍스처 실제 크기에서 프레임 수를 **런타임에 추론**해(가로/세로가 정확히 N배)
 *   `add.sprite` + 애니메이션으로 재생한다. 단일 이미지면 기존처럼 `add.image`.
 *
 *   추론 규칙 — 정확한 정수배만 인정하므로 일반 아트워크를 잘못 쪼갤 위험이 낮다.
 *     · 2·4·8 프레임 후보 중, 나눈 프레임이 **정사각**에 가장 가까운 것
 *     · 프레임 크기가 32px 이상 (너무 작은 조각 금지)
 */
import Phaser from "phaser";

const FRAME_CANDIDATES = [8, 4, 2] as const;

type FrameLayout = { frames: number; fw: number; fh: number; vertical: boolean };

/** 텍스처가 프레임 시트인지 추론한다. 단일 이미지면 null. */
export function detectAtlas(scene: Phaser.Scene, key: string): FrameLayout | null {
  if (!scene.textures.exists(key)) return null;
  const src = scene.textures.get(key).source?.[0];
  const w = src?.width ?? 0;
  const h = src?.height ?? 0;
  if (!w || !h) return null;

  let best: FrameLayout | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const n of FRAME_CANDIDATES) {
    for (const vertical of [false, true]) {
      const total = vertical ? h : w;
      const frameEdge = vertical ? h / n : w / n;
      if (total % n !== 0) continue;
      const fw = vertical ? w : frameEdge;
      const fh = vertical ? frameEdge : h;
      if (fw < 32 || fh < 32) continue;
      /* 프레임이 정사각에 가까울수록 점수가 좋다 (0 = 완벽한 정사각) */
      const score = Math.abs(fw - fh) / Math.max(fw, fh);
      if (score > 0.34) continue; /* 정사각에서 34% 넘게 벗어나면 아틀라스로 보지 않는다 */
      if (score < bestScore) {
        bestScore = score;
        best = { frames: n, fw, fh, vertical };
      }
    }
  }
  return best;
}

/** 아틀라스면 프레임 등록 + 애니메이션 키를 반환. 아니면 null. */
export function ensureAtlasAnim(
  scene: Phaser.Scene,
  key: string,
  frameRate = 12
): { animKey: string; layout: FrameLayout } | null {
  const layout = detectAtlas(scene, key);
  if (!layout) return null;

  const { frames, fw, fh } = layout;
  const tex = scene.textures.get(key);

  /* 프레임 등록 — 이미 등록돼 있으면 건너뛴다 (씬 재시작 대비) */
  if (!tex.has(String(frames - 1))) {
    for (let i = 0; i < frames; i++) {
      tex.add(i, 0, i * fw, 0, fw, fh);
    }
  }

  const animKey = `atlas-anim:${key}`;
  if (!scene.anims.exists(animKey)) {
    scene.anims.create({
      key: animKey,
      frames: Array.from({ length: frames }, (_, i) => ({ key, frame: i })),
      frameRate,
      repeat: -1,
    });
  }
  return { animKey, layout };
}

/**
 * 아틀라스면 애니메이션 스프라이트를, 아니면 정적 이미지를 만든다.
 * 반환 타입은 둘 다 공통으로 쓰는 GameObject 로 넓혀 호출부 변경을 최소화한다.
 */
export function addVfxSprite(
  scene: Phaser.Scene,
  x: number,
  y: number,
  key: string,
  frameRate = 12
): Phaser.GameObjects.GameObject & {
  setPosition: (x: number, y: number) => unknown;
  setScale: (x: number, y?: number) => unknown;
  setAlpha: (a: number) => unknown;
} {
  const anim = ensureAtlasAnim(scene, key, frameRate);
  if (anim) {
    const sp = scene.add.sprite(x, y, key, 0);
    sp.play(anim.animKey);
    /* 프레임 크기가 시트 전체보다 작으므로, 원래 표시 크기를 유지하려면
     * 호출부가 시트 폭 기준으로 스케일을 잡았을 수 있다. 프레임 기준으로 보정한다. */
    sp.setData("atlasFrameW", anim.layout.fw);
    sp.setData("atlasFrameH", anim.layout.fh);
    return sp as unknown as Phaser.GameObjects.GameObject & {
      setPosition: (x: number, y: number) => unknown;
      setScale: (x: number, y?: number) => unknown;
      setAlpha: (a: number) => unknown;
    };
  }
  const im = scene.add.image(x, y, key);
  return im as unknown as Phaser.GameObjects.GameObject & {
    setPosition: (x: number, y: number) => unknown;
    setScale: (x: number, y?: number) => unknown;
    setAlpha: (a: number) => unknown;
  };
}
