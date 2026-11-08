import type Phaser from "phaser";
import type { RoomLayout } from "../mapgen";
import { isSolidDecor } from "../decorObjects";
/* vc259 (지시 #1) — 바닥 변형 아틀라스 폐기: 256px 무이음새 타일로 교체해 불필요. */
/* vc257 — 에디터와 **동일한** 순수 로직을 공유한다(단일 출처). */
import * as core from "../tilemapEditorCore";

/** Verified seamless floor textures in assets/ground/manifest.json. Native tiles
 * are sliced/reassembled in the Tilemap, without a raster copy or a prop fallback.
 * vc259 — 5종을 256px 무이음새 타일로 교체(seam ratio 0.97~1.30).
 *  unit 은 256/8 = 32px 조각. 32px 격자로 잘라 쓰면 반복 주기가 8칸 = 256px 이 된다. */
export const AUTHORED_GROUND_SOURCES: Record<string, { size: number; unit: number }> = {
  ground_meadow: { size: 256, unit: 32 },
  ground_dirt: { size: 84, unit: 28 },
  ground_sand: { size: 256, unit: 32 },
  ground_forest: { size: 256, unit: 32 },
  ground_slate: { size: 256, unit: 32 },
  ground_ash: { size: 256, unit: 32 },
  ground_violet: { size: 256, unit: 32 },
  ground_cavern: { size: 256, unit: 32 },
};

export type AuthoredMapRender = {
  maps: Phaser.Tilemaps.Tilemap[];
  layers: Phaser.Tilemaps.TilemapLayer[];
  images: Phaser.GameObjects.Image[];
};

/** 지면 경계 장식 후보 — **발밑 충돌이 없는 키만** 넣는다.
 *  isSolidDecor 가 true 인 키(bookshelf·barrel·bush 계열 일부·bench·planter·monument·anvil)를
 *  넣으면 통행로에 투명 벽이 생긴다. 여기 있는 키는 전부 바닥 장식/작은 불꽃류다.
 *
 *  [scale 기준] 기존 placeDecor 는 소품을 **원본 픽셀 크기 그대로** 깐다(setScale 없음).
 *  여기서 0.7~0.9 로 줄였더니 촛불(24×40)이 20×34 가 되어 맵 타일(≈144px)의 1/7 —
 *  사실상 점 하나로 보였다(스크린샷 확인).
 *  [대비] 촛불은 실측 주색이 (44,30,49)·(16,18,28) 인 **어두운 남보라**라, 갈색/회색
 *  바닥 위에서 윤곽이 사라졌다(픽셀 검사로 확인). 그래서 테마별로 **밝거나 큰**
 *  소품을 고른다 — torch(불꽃 192px), sign/chest(짙은 대비), bush(7024px) 등. */
const EDGE_PROP: Record<string, { key: string; scale: number }[]> = {
  library: [{ key: "obj_dungeon_torch", scale: 1.4 }, { key: "obj_dungeon_chest", scale: 1 }],
  coast: [{ key: "obj_dungeon_torch", scale: 1.4 }, { key: "obj_dungeon_carpet_v", scale: 1 }],
  grove: [{ key: "obj_forest_bush", scale: 1 }, { key: "obj_forest_bush_tall", scale: 1 }],
  town: [{ key: "obj_dungeon_torch", scale: 1.4 }, { key: "obj_forest_bush", scale: 1 }],
  citadel: [{ key: "obj_dungeon_torch", scale: 1.6 }, { key: "obj_dungeon_sign", scale: 1 }],
  ruins: [{ key: "obj_dungeon_stump", scale: 1.4 }, { key: "obj_forest_bush", scale: 1 }],
  conduit: [{ key: "obj_dungeon_torch", scale: 1.4 }, { key: "obj_dungeon_pentagram", scale: 1.2 }],
  arena: [],
};

/** 결정적 해시 — 같은 구역은 항상 같은 배치(리로드 시 흔들리지 않는다). */
function edgeHash(cell: number, salt: number): number {
  let h = (cell * 2654435761 + salt * 40503) >>> 0;
  h ^= h >>> 15; h = (h * 2246822519) >>> 0; h ^= h >>> 13;
  return (h >>> 8) / 16777216;
}

/** Ground/path/structure are presentation only. WorldScene builds exact solid
 * bodies from lay.open; an art tile never creates an accidental extra blocker. */
export function renderAuthoredMapLayers(
  scene: Phaser.Scene,
  lay: RoomLayout,
  onDecor?: (image: Phaser.GameObjects.Image) => void,
): AuthoredMapRender | null {
  const art = lay.authored;
  if (!art) return null;
  const roles = [
    { name: "ground", key: art.ground, depth: 0, tint: 0xffffff },
    { name: "paths", key: art.path, depth: 0.5, tint: 0xffffff },
    { name: "structures", key: art.structure, depth: 2, tint: art.structureTint },
  ] as const;
  // Missing/corrupt source images leave the original renderer available to the caller.
  for (const { key } of roles) {
    const source = AUTHORED_GROUND_SOURCES[key];
    if (!source || !scene.textures.exists(key)) return null;
    const image = scene.textures.get(key).getSourceImage();
    if (image.width !== source.size || image.height !== source.size) return null;
  }
  const maps: Phaser.Tilemaps.Tilemap[] = [];
  const layers: Phaser.Tilemaps.TilemapLayer[] = [];
  /** vc275 — 지면/경로/구조물을 TileSprite 밴드로 그린 결과. shutdown 에서 파괴한다. */
  const textureGroups: Phaser.GameObjects.TileSprite[][] = [];
  const width = lay.cols * lay.cellW, height = lay.rows * lay.cellH;
  for (const role of roles) {
    const { size } = AUTHORED_GROUND_SOURCES[role.key];
    /* v259 (지시 #1) — 변형 아틀라스 경로 제거. 256px 무이음새 타일로 교체해 불필요.
     *  (회전 아틀라스는 5색 얼룩의 격자를 못 없앴다 — tileThemes.ts 주석 참조) */
    /* ═══ vc275 (P1b — "건물 주변·맵 경계가 잘린 듯 보인다") ═══
     * [실측한 원인] 종전엔 타일 **중심점**이 속한 셀 하나로 그릴지 말지를 정했다:
     *   x = floor((c + 0.5) * unit / cellW)
     * 셀(145~153px)과 타일 조각(28/32px)이 정수배가 아니라서, 중심이 열린 셀에 있어도
     * 타일의 왼쪽 절반이 벽을 침범하고, 중심이 벽 셀에 있으면 오른쪽 절반이 통로를
     * 비워 **1~16px 틈**이 생겼다. 실측(게임과 동일 계산으로 재구성):
     *   howlrstone1x2 paths 61,469px² 침범 / dlcprisma1 paths 36,901px² 침범
     * 이 침범이 곧 "칼로 자른 듯한 직선 경계"·"부자연스러운 접촉"이다.
     *
     * [1차 시도 — 실패] 타일이 걸친 셀이 전부 같은 상태일 때만 칠했다.
     *  → 침범은 0 이 됐지만 경계에 걸친 타일이 통째로 빠져 **미달(지면색 구멍)이
     *    최대 +118,747px² 늘었다.** 유저가 지적한 "잘린 듯"이 오히려 심해진다.
     *
     * [최종 해결] 셀 하나를 **정확히 셀 크기로 클리핑한 TileSprite** 로 칠한다.
     *  · TileSprite 는 주어진 폭/높이로 잘리므로 셀 경계를 절대 넘지 않는다 → 침범 0.
     *  · 칠해야 하는 셀은 빠짐없이 칠한다 → 미달 0. (경계가 침범도 미달도 아닌 이유)
     *  · setTilePosition(x % period, y % period) 로 **전역 위상**을 맞춰 인접 셀의
     *    무늬가 한 장처럼 이어진다(위상 리셋 없음 — WorldScene 지면 경로와 같은 기법).
     *  · 픽셀아트 화질 보존: 타일을 확대/축소하지 않는다(원본 1:1 반복).
     *  이전 구현은 unit(28/32px) 격자 Tilemap 이라 셀 크기(145~153px)와 어긋날 수밖에
     *  없었다. 셀 크기에 맞춰 자르는 방식만이 두 오차를 동시에 없앤다. */
    const wants = role.name === "paths"
      ? (cell: number) => !!art.paths[cell]
      : (cell: number) => !lay.open[cell];
    /* 행 단위로 연속한 같은 상태 셀을 한 장으로 병합한다.
     *  셀 1개 = TileSprite 1개면 맵당 최대 cols×rows(≈150)개지만, 병합하면
     *  복도처럼 가로로 이어진 구간이 1개로 줄어 오브젝트 수가 크게 낮아진다. */
    const band: { x: number; y: number; w: number; h: number }[] = [];
    for (let r = 0; r < lay.rows; r++) {
      const y0 = Math.round(r * lay.cellH);
      const y1 = Math.round((r + 1) * lay.cellH);
      let runStart = -1;
      for (let c = 0; c <= lay.cols; c++) {
        const on = c < lay.cols
          && (role.name === "ground" || wants(r * lay.cols + c));
        if (on && runStart < 0) runStart = c;
        if (!on && runStart >= 0) {
          const x0 = Math.round(runStart * lay.cellW);
          const x1 = Math.round(c * lay.cellW);
          if (x1 > x0 && y1 > y0) band.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
          runStart = -1;
        }
      }
    }
    if (!band.length) continue;
    /* 무늬 위상 기준 — 원본 텍스처가 한 장으로 이어지도록 전역 좌표로 나머지를 잡는다. */
    const periodX = size;
    const periodY = size;
    const pieces: Phaser.GameObjects.TileSprite[] = [];
    for (const b of band) {
      const ts = scene.add.tileSprite(b.x, b.y, b.w, b.h, role.key).setOrigin(0).setDepth(role.depth);
      ts.setTilePosition(b.x % periodX, b.y % periodY);
      ts.setTint(role.tint);
      ts.setName(`rea:${role.name}`);
      pieces.push(ts);
    }
    textureGroups.push(pieces);
  }
  scene.events.once("shutdown", () => {
    for (const map of maps) map.destroy();
    for (const group of textureGroups) for (const ts of group) ts.destroy();
  });
  const images: Phaser.GameObjects.Image[] = [];
  /* vc253 (지시 #1 "오브젝트가 크기에 맞게 잘리지 않음") — 프롭을 **타일 배수**로 정규화한다.
   *
   *  [실측한 문제] 프롭 원본 크기가 제각각이고 타일(셀) 배수가 아니었다:
   *    obj_dungeon_torch 28×52 / chest 48×40 / anvil 52×36 / bookshelf 64×128
   *    obj_forest_tree_pink 65×80 / rock_monument 100×89 / town_house_blue 160×112
   *  셀은 cellW≈144 · cellH≈128 이다. 52px 토치를 그대로 깔면 0.36칸짜리 오브젝트가
   *  격자 사이에 어중간하게 걸려 "크기에 맞게 잘리지 않은" 것처럼 보인다(첨부 스크린샷의
   *  자판기·화분·벤치가 정확히 이 증상).
   *
   *  [해결] 목표 점유 칸수를 정하고, 원본 크기를 그 칸에 **딱 맞는 배율**로 스케일한다.
   *   - 프롭별 기본 점유(칸)는 원본이 셀보다 크면 1칸, 작으면 0.5칸 단위로 내림해 정한다.
   *   - 결과 크기는 항상 셀 크기의 정수/반정수배 → 격자에 정렬된다.
   *   픽셀아트이므로 정수 배율이 아니어도 nearest 이웃이라 뭉개지지 않지만,
   *   너무 작아지는 것을 막기 위해 최소 배율을 둔다. */
  /* [vc257 — 단일 출처] 프롭 배율 계산은 `tilemapEditorCore.snapPropScale` 로 옮겼다.
   *  에디터와 게임이 같은 함수를 쓰지 않으면 미리보기와 실제가 반드시 갈라진다
   *  (치수·프롭 상한·클램프 범위가 두 곳에 복제되면 한쪽만 고치는 사고가 난다). */
  const snapPropScale = (key: string, baseScale: number): number => {
    if (!scene.textures.exists(key)) return baseScale;
    const src = scene.textures.get(key).getSourceImage() as { width: number; height: number };
    if (!src?.width || !src?.height) return baseScale;
    return core.snapPropScale(src.width, src.height, baseScale, lay.cellW, lay.cellH, key);
  };
  const prop = (key: string, x: number, y: number, scale = 1, tint?: number) => {
    if (!scene.textures.exists(key)) return;
    /* [vc253 주의] 구조물 prop 은 **좌표·스케일을 건드리지 않는다**.
     *  tests/authored-layouts.test.mjs 가 계약으로 강제한다:
     *    · 발밑 셀이 통행로(lay.open=false) 안이어야 한다 → 좌표를 스냅하면 통로로 밀려 들어간다
     *    · scale === 1 (원본 픽셀 보존)
     *  "오브젝트가 크기에 맞게 잘리지 않음"(지시 #1)은 **경계 장식(propNoCollide)** 쪽
     *  문제였고, 구조물은 원래 셀 중심에 정확히 놓여 있었다. 구조물까지 정규화하면
     *  벽을 뚫거나 통로를 막는다. */
    // Match WorldScene.yDepthFor's9–10 band so canopies sort with actors' feet.
    const depth = 9 + Math.max(0, Math.min(1, y / height)) - 0.001;
    const image = scene.add.image(x, y, key).setOrigin(0.5, 1).setScale(scale).setDepth(depth).setName(`rea:prop:${key}`);
    if (tint) image.setTint(tint);
    images.push(image);
    onDecor?.(image);
  };
  const theme = art.theme;
  /* 지면 경계 장식은 이동을 막으면 안 된다.
   *  [함정] WorldScene 은 prop 마다 attachDecorCollision() 을 호출하고, 그 함수는
   *   isSolidDecor(key) 로 발밑 충돌체를 만든다(bookshelf·barrel·bush·bench 등이 전부 대상).
   *   즉 온갖 소품을 경계에 뿌리면 통행로에 투명 벽이 생긴다.
   *  [해결] 원본 prop 의 onDecor(발밑 충돌) 경로를 타지 않는 전용 emitter 를 쓰고,
   *   발밑 충돌이 없는(또는 아주 얇은) 표시물만 배치한다. 바닥 장식·작은 불꽃류는
   *   isSolidDecor 가 false 라 안전하고, 그 외에는 아래 EDGE_FREE 목록만 허용한다.
   *  → 충돌 0 을 코드가 아니라 **화이트리스트**로 보장한다. */
  const EDGE_FREE = (key: string) => !isSolidDecor(key);
  const propNoCollide = (key: string, x: number, y: number, scale = 1) => {
    if (!scene.textures.exists(key) || !EDGE_FREE(key)) return;
    /* vc253 (지시 #1 "오브젝트가 크기에 맞게 잘리지 않음") — 경계 장식 **크기** 정규화.
     *
     *  [실측한 문제] 프롭 원본 크기가 제각각이고 타일(셀) 배수가 아니었다:
     *    torch 28×52 / chest 48×40 / anvil 52×36
     *  셀은 스테이지마다 다르고 심지어 비정수다(howlrstone1x2: 150.667×131.111).
     *  52px 토치를 그대로 깔면 0.35칸짜리 오브젝트가 격자 사이에 어중간하게 걸린다.
     *  → 원본이 차지할 칸 수(0.5칸 단위)를 정하고 그 칸에 맞는 배율로 스케일한다.
     *  [좌표] 스냅은 **호출부의 snapInCell 이 이미 처리**한다(셀 경계를 넘지 않게 중앙으로
     *   당기는 로직 포함). 여기서 또 스냅하면 이중 반올림으로 셀을 넘어간다 — 하지 않는다.
     *  [주의] 이 정규화는 경계 장식에만 적용한다. 구조물 prop 은 통행로 계약이 있어
     *   원본 배율 1·셀 중심을 유지해야 한다(prop() 참고). */
    const depth = 9 + Math.max(0, Math.min(1, y / height)) - 0.001;
    const image = scene.add.image(x, y, key).setOrigin(0.5, 1).setScale(snapPropScale(key, scale)).setDepth(depth).setName(`rea:edge:${key}`);
    /* [vc241 지시 #1 "오브젝트 짤림"] origin(0.5,1) 이라 이미지가 위로 스케일*높이 만큼 뻗는다.
     *  세로로 긴 프롭(bookshelf 128·jar 116·carpet 124)은 맵 최상단에서 잘린다.
     *  → 4면이 맵 밖으로 나가면 그리지 않는다. */
    const src = scene.textures.get(key).getSourceImage() as { width?: number; height?: number } | undefined;
    const sw = (src?.width ?? 0) * image.scaleX, sh = (src?.height ?? 0) * image.scaleY;
    if (x - sw / 2 < 0 || x + sw / 2 > width || y - sh < 0 || y > height) { image.destroy(); return; }
    images.push(image);
  };
  /* ── vc253: 맵 파일이 있으면 **파일에 적힌 좌표만** 그린다 ──────────────
   *  [왜] 종전엔 아래 세 블록(구조물/랜드마크/경계장식)이 전부 해시로 좌표를
   *  자동 계산했다. 그래서 (a) 그림과 발밑 충돌이 따로 놀아 "안 보이는데 막히는 벽"이
   *  생겼고 (b) 가장자리 셀에 스냅된 프롭이 잘려 보였고 (c) 밀도를 코드로만 조절할 수
   *  있었다. 유저 지시: "타일맵을 코드로 자동배치 하지말고 파일기반으로".
   *
   *  → authored.props 가 있으면 파일 좌표를 그대로 그리고 아래 자동 배치를 전부 건너뛴다.
   *    없으면(절차 생성 맵) 종전 동작을 그대로 유지한다 — 회귀 없음. */
  if (art.props && art.props.length > 0) {
    for (const p of art.props) {
      if (!scene.textures.exists(p.key)) continue;
      const depth = 9 + Math.max(0, Math.min(1, p.y / height)) - 0.001;
      const img = scene.add.image(p.x, p.y, p.key)
        .setOrigin(0.5, 1)
        .setScale(p.scale)
        .setDepth(depth)
        .setName(`rea:file:${p.key}`);
      /* ⚠ onDecor() 을 **부르지 않는다**. onDecor 는 WorldScene.attachDecorCollision 이고,
       *  isSolidDecor(key) 로 발밑 충돌체를 또 만든다. 그러면 파일의 solid:false 프롭에도
       *  보이지 않는 벽이 생긴다(이중 판정 = 유저가 지적한 "안 보이는데 막힘").
       *  막을 프롭은 파일에서 solid:true 로 적어 open[cell]=false 가 되게 한다 —
       *  판정의 단일 출처는 open 그리드 하나뿐이다. */
      images.push(img);
    }
    return { maps, layers, images };
  }

  /* ═══ vc283 (지시 #11 "문제의 파란 지붕 타일셋 완전 교체") ═══
   * [증상] 마을 테마 구조물이 파란 삼각 지붕 + 그 아래 직사각형 판으로 보이고,
   *  지붕 윗변이 잘린 듯 평평하게 끊긴다. 지붕과 벽의 디자인이 따로 논다.
   *
   * [원인] `obj_town_house_blue.png`(160×112) 한 장에 지붕과 벽이 **분리된 채**
   *  합성돼 있고, 상단 투명 영역이 22%(opaque 0.78)라 삼각 지붕이 잘려 보인다.
   *  이 파일은 34색 안티앨리어싱 없는 도트지만 지붕/벽 색이 서로 무관해
   *  "지붕이 건물과 비정상적으로 결합"된 것처럼 읽힌다.
   *
   * [해결] 요구사항 4.3 은 "반복 수정하지 말고 에셋을 완전히 교체"라고 명시한다.
   *  이미 로드·검증된 `house_a`(빨강 지붕)/`house_b`(초록 지붕) 로 바꾼다 —
   *  지붕+벽+입구가 **한 덩어리로 그려진** 156×194 픽셀아트라
   *  (a) 배경 직사각형이 없고 (b) 지붕 윤곽이 완전하며 (c) 입구 위치가 실제로 보인다.
   *  두 장을 테마 색에 맞춰 번갈아 쓴다(단일 구조물이 반복되지 않게).
   *
   * [주의] house_a/b 는 WorldScene 마을 건물(4532행)이 이미 쓰는 **같은 에셋**이다.
   *  새 바이너리를 만들지 않았고 라이선스도 기존 그대로다(신규 에셋 0). */
  const structuralProp = theme === "library" ? "obj_dungeon_bookshelf"
    : theme === "grove" ? "obj_forest_tree_pink"
    : theme === "town" ? (edgeHash(lay.entry, 31) > 0.5 ? "house_a" : "house_b")
    : theme === "citadel" ? "obj_dungeon_torch"
    : theme === "ruins" ? "obj_forest_rock_monument"
    : theme === "conduit" ? "obj_dungeon_anvil" : null;
  if (structuralProp) {
    /* [vc241 지시 #2] 20 → 10. 구조물은 지형 일부라 0이 되면 안 되지만
     *  20개는 "방마다 책장" 수준이라 과했다. */
    // Solid feet stay inside already-closed cells; presentation cannot seal an aisle.
    for (let r = 1; r < lay.rows - 1 && images.length < 10; r++) {
      for (let c = 1; c < lay.cols - 1 && images.length < 10; c++) {
        const cell = r * lay.cols + c;
        if (lay.open[cell] || (c + r) % (theme === "town" ? 4 : 2)) continue;
        if (![cell - 1, cell + 1, cell - lay.cols, cell + lay.cols].some(i => lay.open[i])) continue;
        const safe = [lay.entry, lay.exit].every(i => Math.abs(c - i % lay.cols) + Math.abs(r - Math.floor(i / lay.cols)) > 2);
        if (!safe) continue;
        prop(structuralProp, (c + 0.5) * lay.cellW, (r + 0.8) * lay.cellH, theme === "grove" ? 2 : 1);
      }
    }
  }
  for (const { kind, cell } of art.landmarks) {
    const x = (cell % lay.cols + 0.5) * lay.cellW;
    const y = (Math.floor(cell / lay.cols) + 0.5) * lay.cellH;
    if (kind.startsWith("gate-")) {
      const colors: Record<string, number> = { "gate-water": 0x76bcff, "gate-wind": 0x8fe8ac, "gate-lightning": 0xe5c977, "gate-fire": 0xf28d79 };
      prop("obj_dungeon_torch", x - lay.cellW * 0.55, y, 1, colors[kind]);
      prop("obj_dungeon_torch", x + lay.cellW * 0.55, y, 1, colors[kind]);
    } else if (kind === "pier") {
      // The pier is three cells wide; a small barrel on its outer corner leaves the route clear.
      prop("obj_dungeon_barrel", x - lay.cellW * 0.75, y + lay.cellH * 0.15);
    } else if (kind === "arena") {
      prop("obj_dungeon_torch", x - lay.cellW * 2, lay.cellH * 1.5);
      prop("obj_dungeon_torch", x + lay.cellW * 2, lay.cellH * 1.5);
    }
  }

  /* ── 지면 경계 장식 (오토타일 엣지) ────────────────────────────────────
   *  [왜] 종전엔 방/복도 모양만 깔려 열린 바닥이 사방으로 뚝 끊겨 보였다.
   *   벽에 닿은 "열린 셀"의 안쪽에 소품을 세워 바닥 윤곽을 읽히게 한다.
   *   클로드 데모의 물가 거품/벽 상단 장식과 같은 발상이지만, 여기서는 실제
   *   런타임 텍스처를 쓰고 판정에는 절대 관여하지 않는다.
   *  [안전 규칙]
   *   · 열린 셀 안쪽으로만 밀어 넣어 통행 폭을 줄이지 않는다(발밑 충돌 없음).
   *   · 입구/출구 반경 2셀은 비운다(스폰·포탈 가림 방지).
   *   · 통행로(art.paths) **안쪽 중앙**에는 세우지 않는다 — 길이 막히면 안 된다.
   *     단 통행로라도 벽에 딱 붙은 가장자리는 허용한다(바닥 윤곽선 역할).
   *   · 최대 28개.
   *  [밀도] 종전 18% + "통행로 제외" 조합이면 coast 테마에서 배치가 0개였다
   *   (coast 는 열린 셀이 전부 통행로). 그래서 규칙을 위처럼 완화하고
   *   후보가 적은 맵은 밀도를 올려 최소 몇 개는 반드시 깔리게 한다. */
  {
    const pool = EDGE_PROP[theme] ?? [];
    if (pool.length > 0) {
      const ec = lay.entry % lay.cols, er = Math.floor(lay.entry / lay.cols);
      const xc = lay.exit % lay.cols, xr = Math.floor(lay.exit / lay.cols);
      const candidates: { cell: number; c: number; r: number; sides: string[] }[] = [];
      for (let r = 1; r < lay.rows - 1; r++) {
        for (let c = 1; c < lay.cols - 1; c++) {
          const cell = r * lay.cols + c;
          if (!lay.open[cell]) continue;
          const sides: string[] = [];
          if (!lay.open[cell - lay.cols]) sides.push("n");
          if (!lay.open[cell + lay.cols]) sides.push("s");
          if (!lay.open[cell - 1]) sides.push("w");
          if (!lay.open[cell + 1]) sides.push("e");
          if (sides.length === 0) continue;
          if (Math.abs(c - ec) + Math.abs(r - er) <= 2) continue;
          if (Math.abs(c - xc) + Math.abs(r - xr) <= 2) continue;
          candidates.push({ cell, c, r, sides });
        }
      }
      /* [vc241 지시 #2 "오브젝트 너무 과도"] — vc238-2 에서 density 를 1(100%)로 올린 뒤로
       *  벽에 닿은 열린 셀을 **전부** 칠해 맵이 빽빽해지고 지형이 안 읽혔다.
       *  경계선은 이미 타일 아트로 읽히므로(변형 아틀라스 4프레임) 장식을 되돌린다.
       *  후보가 적은 맵(coast 등)에서 0개가 되지 않도록 밀도는 두되, 과밀하지 않게 38%로. */
      const density = 0.38;
      // 결정적 셔플 — 앞에서부터 채우면 맵 위쪽만 칠해진다.
      candidates.sort((a, b) => edgeHash(a.cell, 23) - edgeHash(b.cell, 23));
      let placed = 0;
      for (const { cell, c, r, sides } of candidates) {
        /* [vc241 지시 #2] 96 → 32. 96개는 뷰포트(약 54셀)에 소품이 10개 이상 겹쳐 보이는
         *  수준이었다. 32개면 화면당 3~4개로 줄어 지형이 주인공이 되고 소품은 테마만 살린다. */
        if (placed >= 32) break;
        if (edgeHash(cell, 7) > density) continue;
        const pick = pool[Math.floor(edgeHash(cell, 11) * pool.length) % pool.length];
        if (!scene.textures.exists(pick.key)) continue;
        // 벽 쪽으로 붙인다 — 셀 안쪽으로 최대 0.3셀까지만 밀어 넣는다.
        const nudge = 0.28;
        let px = (c + 0.5) * lay.cellW;
        let py = (r + 0.5) * lay.cellH;
        if (sides.includes("n")) py -= lay.cellH * nudge;
        else if (sides.includes("s")) py += lay.cellH * nudge;
        if (sides.includes("w")) px -= lay.cellW * nudge;
        else if (sides.includes("e")) px += lay.cellW * nudge;
        /* vc253 (지시 #1) — 밀어낸 좌표를 **반 칸 격자**에 스냅한다.
         *  종전엔 0.28셀 밀어낸 임의 좌표에 그대로 놓아 오브젝트가 격자 사이에
         *  어중간하게 걸렸다(첨부 스크린샷의 벤치·화분·자판기).
         *
         *  [함정] 단순 반올림은 앵커를 **다음 셀로 넘긴다**. 0.78셀 위치는
         *   (c+1.0)으로 반올림되어 Math.floor(y/cellH) 가 c+1(벽)이 되고,
         *   `edge decor must sit on walkable ground` 불변식이 깨졌다.
         *   → 셀 경계를 넘으면 그 셀의 **중앙**(역시 반 칸 격자점)으로 당긴다. */
        /* [vc257] 셀 내 스냅은 에디터와 같은 함수(core.edgeDecorPlacement)를 쓴다.
         *  여기서 인라인으로 복제하면 에디터 미리보기와 좌표가 갈라진다. */
        const snappedTo = core.edgeDecorPlacement({ c, r, cellW: lay.cellW, cellH: lay.cellH, sides });
        px = snappedTo.x;
        py = snappedTo.y;
        /* 발밑 충돌 훅(onDecor)을 타지 않는 경로 — 통행을 줄이지 않는다. */
        propNoCollide(pick.key, px, py, pick.scale);
        placed++;
      }
    }
  }
  return { maps, layers, images };
}
