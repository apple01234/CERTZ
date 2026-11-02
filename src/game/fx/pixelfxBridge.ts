/**
 * pixelfx → Phaser 4 브리지 (v1.0.0)
 *
 * pixelfx(vendored, MIT)가 만든 **Aseprite 스프라이트시트**를 Phaser 4 아틀라스로 읽어
 * 애니메이션으로 재생한다. 런타임에 pixelfx 코드를 돌리지 않으므로 게임 번들이 가볍다.
 *
 * 왜 시트인가
 * ----------
 *  - pixelfx 런타임은 매 프레임 ImageData 를 조합한다 → WebGL 에서 텍스처 업로드 비용이 크다.
 *  - 시트는 정적 PNG + JSON 이라 Phaser 로더가 그대로 처리하고, 캐시도 된다.
 *  - 같은 이펙트를 여러 번 재생해도 텍스처는 1장만 로드된다.
 *
 * 사용법
 * -----
 *   preload:  loadFxSheet(this, "frost-nova")
 *   create :  playFx(this, "frost-nova", x, y)
 *
 * 시트 생성(빌드 전 1회)
 * ----------------------
 *   node vendor/pixelfx/tools/render.mjs ice/frost-nova --sheet
 *   → records/ice/frost-nova/frost-nova.{png,json}
 *   → public/assets/fx/ 로 복사 (tools/import-pixelfx.mjs 가 자동 처리)
 *
 * 좌표 규칙
 * --------
 * JSON 의 meta.pixelfx.pivot 은 "이펙트의 발밑" 이다. 스프라이트 origin 을 그 지점에 맞춰야
 * 캐릭터 발밑에서 터진다. 픽셀 단위라 프레임 크기로 나눠 0~1 비율로 준다.
 */
import Phaser from "phaser";

export type FxMeta = {
  id: string;
  name: string;
  fps: number;
  loop: boolean;
  frames: number;
  frameSize: [number, number];
  pivot: [number, number];
  columns: number;
  act?: {
    windup: number;
    recovery: number;
    onBody: boolean;
    targets: number[];
    hits: { t: number; freeze: number; shake: number; amp: number; push: number }[];
  };
};

export type FxSheet = { key: string; meta: FxMeta };

const SHEETS = new Map<string, FxSheet>();

/** public/assets/fx 아래의 시트를 로드한다. 이미 로드했으면 즉시 반환. */
export function loadFxSheet(scene: Phaser.Scene, key: string, dir = "assets/fx"): FxSheet | null {
  const hit = SHEETS.get(key);
  if (hit) return hit;

  const png = `${dir}/${key}.png`;
  const json = `${dir}/${key}.json`;

  if (!scene.textures.exists(key)) {
    /* atlas 는 이미지+프레임만 만들고 meta 는 캐시에 남기지 않는다.
     * pivot·fps 가 필요하므로 JSON 을 별도 키로 한 번 더 읽는다. */
    scene.load.atlas(key, png, json);
    scene.load.json(`${key}__meta`, json);
    /* 로더 완료 후 자동 등록 — 씬마다 postload 훅을 달 필요가 없다 */
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
      registerFxSheet(scene, key);
    });
    return null;
  }
  /* 텍스처는 이미 있는데 meta 캐시가 없으면(재진입) 지금 읽어둔다 */
  if (!scene.cache.json.exists(`${key}__meta`)) {
    scene.cache.json.add(`${key}__meta`, {});
  }
  return registerFxSheet(scene, key);
}

/**
 * 로더가 끝난 뒤 호출 — atlas JSON 의 meta.pixelfx 를 읽어 프레임/애니를 확정한다.
 * Phaser 의 atlas 는 이미지를 프레임으로 잘라 두지만, fps·loop·pivot 은 별도로 적용해야 한다.
 */
export function registerFxSheet(scene: Phaser.Scene, key: string): FxSheet | null {
  if (SHEETS.has(key)) return SHEETS.get(key)!;

  const tex = scene.textures.get(key);
  if (!tex || tex.key === "__MISSING") return null;

  /* atlas JSON 은 캐시에 남아 있으므로 meta 만 꺼낸다 */
  const raw = (scene.cache.json.get(`${key}__meta`) ?? scene.cache.json.get(key)) as
    | { meta?: { pixelfx?: FxMeta } }
    | undefined;
  const meta = raw?.meta?.pixelfx;
  if (!meta) return null;

  /* 프레임 이름이 없으면 인덱스 순서로 정렬해 애니메이션을 만든다 */
  const frameNames = tex.getFrameNames().filter((n) => n !== "__BASE");
  if (frameNames.length) {
    frameNames.sort((a, b) => {
      const na = parseInt(a.replace(/\D+/g, ""), 10) || 0;
      const nb = parseInt(b.replace(/\D+/g, ""), 10) || 0;
      return na - nb;
    });
    const animKey = `${key}-play`;
    if (!scene.anims.exists(animKey)) {
      scene.anims.create({
        key: animKey,
        frames: frameNames.map((f) => ({ key, frame: f })),
        frameRate: meta.fps || 30,
        repeat: meta.loop ? -1 : 0,
      });
    }
  }

  const sheet: FxSheet = { key, meta };
  SHEETS.set(key, sheet);
  return sheet;
}

export type PlayFxOpts = {
  /** 좌우 반전 */
  flip?: boolean;
  /** 크기 배율 (기본 1) */
  scale?: number;
  /** 재생 속도 배율 (기본 1) */
  speed?: number;
  /** 화면 깊이 (기본: 호출한 쪽 레이어 위 9000) */
  depth?: number;
  /** 재생 완료 콜백 */
  onComplete?: () => void;
};

/**
 * 이펙트를 재생한다. one-shot 이면 끝나고 자동 제거, loop 면 destroy() 를 호출할 때까지 남는다.
 * pivot 을 origin 으로 써서 캐릭터 발밑에 정확히 붙는다.
 */
export function playFx(
  scene: Phaser.Scene,
  key: string,
  x: number,
  y: number,
  opts: PlayFxOpts = {},
): Phaser.GameObjects.Sprite | null {
  const sheet = SHEETS.get(key) ?? registerFxSheet(scene, key);
  if (!sheet) return null;

  const { meta } = sheet;
  const animKey = `${key}-play`;
  if (!scene.anims.exists(animKey)) return null;

  const fx = scene.add.sprite(x, y, key, 0);
  fx.setDepth(opts.depth ?? 9000);

  /* pivot = 발밑. origin 을 비율로 환산해 정확히 맞춘다 */
  const [fw, fh] = meta.frameSize;
  const [px, py] = meta.pivot;
  fx.setOrigin(px / fw, py / fh);

  if (opts.scale !== undefined) fx.setScale(opts.scale);
  if (opts.flip) fx.setFlipX(true);
  /* 픽셀아트 — 선형 보간 금지 */
  fx.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);

  if (opts.speed !== undefined) fx.anims.timeScale = opts.speed;

  fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
    opts.onComplete?.();
    if (!meta.loop) fx.destroy();
  });

  fx.play(animKey);
  return fx;
}

/** 로드된 시트 전체를 순회하며 등록 (씬 create 에서 1회 호출) */
export function registerAllFx(scene: Phaser.Scene): number {
  let n = 0;
  for (const key of scene.textures.getTextureKeys()) {
    if (key.startsWith("__")) continue;
    if (registerFxSheet(scene, key)) n++;
  }
  return n;
}
