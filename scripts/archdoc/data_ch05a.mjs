// 모듈 5 (041~045): 월드 & 환경 시스템 — 전반부
// 스택: Tiled Map Editor(JSON), Phaser 3/PixiJS, TypeScript

export const items = [
  {
    id: "041",
    title: "Tiled 타일맵 레이어 (바닥, 벽, 상단 가림막) 파싱 및 렌더링",
    role: [
      "Tiled 에디터의 JSON 맵은 계층(layer) 단위로 의미를 부여한다. 표준 구성은 floor(바닥), wall(충돌+통과 불가), overlay(상단 가림막 — 나뭇가지/다리 아래로 캐릭터가 지나가면 위에 겹쳐 보이는 계층), objects(포탈/NPC/채집물)다. 파서는 Tiled JSON을 로드해 Phaser 타일맵으로 등록하고, 충돌 레이어는 0/1 그리드로 변환해 서버·클라가 공유하는 blocked 그리드(043번)를 만든다.",
      "상단 가림막(overlay)의 핵심은 렌더 순서와 투명도다. 캐릭터가 overlay 타일 아래에 위치하면 해당 타일을 반투명(30~40% 알파)으로 전환해 캐릭터가 가려지지 않게 한다. 맵이 클수록(3000x3000) 타일 레이어는 청크 단위로 분할 렌더(카메라 시야 밖 타일 그리기 생략)해 드로우콜과 메모리를 관리한다.",
    ],
    blocks: [
      {
        lang: "src/world/TiledLoader.ts",
        code: `import Phaser from "phaser";

export interface TiledMapJson {
  width: number; height: number; tilewidth: number; tileheight: number;
  layers: TiledLayerJson[]; tilesets: { firstgid: number; name: string; image: string }[];
}
export interface TiledLayerJson {
  name: string; type: "tilelayer" | "objectgroup";
  data?: number[]; objects?: TiledObjectJson[]; visible?: boolean; opacity?: number;
}
export interface TiledObjectJson {
  id: number; name: string; type: string; x: number; y: number;
  width?: number; height?: number; properties?: { name: string; value: unknown }[];
}

export const FLOOR = "floor", WALL = "wall", OVERLAY = "overlay", OBJECTS = "objects";

export class TiledLoader {
  blocked: Uint8Array;               // 서버/클라 공유 충돌 그리드
  tileW = 32; tileH = 32;

  constructor(private scene: Phaser.Scene, private json: TiledMapJson,
              private tilesets: string[]) {
    this.tileW = json.tilewidth; this.tileH = json.tileheight;
    this.blocked = new Uint8Array(json.width * json.height);
  }

  build(): { map: Phaser.Tilemaps.Tilemap } {
    // 1) 타일셋 등록
    for (const ts of this.json.tilesets) {
      if (!this.scene.textures.exists(ts.name)) {
        this.scene.load.image(ts.name, "/a/maps/" + ts.image);
      }
    }
    const map = this.scene.make.tilemap({ data: [], tileWidth: this.tileW, tileHeight: this.tileH });

    // 2) Tiled JSON에서 레이어 순서대로 추가 (floor → wall → overlay)
    const addToMap = (name: string) => {
      const layer = this.json.layers.find(l => l.name === name && l.type === "tilelayer");
      if (!layer?.data) return null;
      const data2d: number[][] = [];
      for (let y = 0; y < this.json.height; y++) {
        data2d.push(layer.data.slice(y * this.json.width, (y + 1) * this.json.width));
      }
      const t = map.addTilesetImage(name, name, this.tileW, this.tileH, 0, 0)!;
      const phLayer = map.createLayer(0, [t], 0, 0)!;
      phLayer.putTilesAt(data2d, 0, 0);
      phLayer.setDepth(name === OVERLAY ? 4000 : 0);   // 가림막은 캐릭터 위
      return phLayer;
    };
    addToMap(FLOOR);
    const wallLayer = addToMap(WALL);
    const overlayLayer = addToMap(OVERLAY);

    // 3) 충돌 그리드 구축 — 서버가 그대로 쓰는 blocked 배열
    if (wallLayer) {
      wallLayer.forEachTile((tile) => {
        if (tile.index > 0) this.blocked[tile.y * this.json.width + tile.x] = 1;
      });
    }
    // 4) 오브젝트 레이어는 포탈/NPC/채집물 스폰 데이터로 변환(046/047번)
    const objs = this.json.layers.find(l => l.name === OBJECTS)?.objects ?? [];
    this.scene.events.emit("tiled-objects", objs);

    return { map };
  }

  isBlocked(tx: number, ty: number): boolean {
    return this.blocked[ty * this.json.width + tx] === 1;
  }
}

/** overlay 반투명 전환: 캐릭터 타일 기준 주변 1칸 */
export function updateOverlayAlpha(
  overlayLayer: Phaser.Tilemaps.TilemapLayer,
  charTileX: number, charTileY: number,
) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const t = overlayLayer.getTileAt(charTileX + dx, charTileY + dy);
      if (t) t.alpha = 0.35;        // 복구는 다음 스캔에서 alpha=1
    }
  }
}`,
      },
    ],
    tips: [
      "레이어 이름(floor/wall/overlay/objects)은 팀 컨벤션으로 고정한다 — 파서가 이름 기반이면 에디터 작업 순서가 자유로워진다.",
      "blocked 그리드는 맵 로드 시 1회 구축해 서버로 전송(또는 동일 JSON 양쪽 로드)해야 클라/서버 충돌 판정이 일치한다.",
      "3000x3000 맵은 청크(512px) 단위 createLayer 분할이 필수다 — 단일 레이어는 WebGL 텍스처 업로드 한계에 걸린다.",
      "overlay 투명화는 타일 단위 alpha 변경으로 충분하며, 매 프레임 전체 스캔 대신 이동한 캐릭터 주변만 갱신한다.",
    ],
  },
  {
    id: "042",
    title: "Y-Sorting (Y좌표 기준 캐릭터/오브젝트 깊이 정렬) 엔진",
    role: [
      "탑다운 뷰에서 캐릭터가 나무 뒤를 지나가면 나무가 앞에 보여야 하고, 아래를 지나가면 캐릭터가 앞에 보여야 한다. Y-Sorting은 렌더 대상(캐릭터, 오브젝트, 이펙트)을 '기준선(발밑 y) + 레이어 우선순위'로 정렬해 depth를 부여하는 엔진이다. depth 계산식은 depth = layer * 100000 + floor(y * 10)로 두어, 레이어 간 충돌 없이 y 단위 0.1px 정밀 정렬을 얻는다.",
      "성능 핵심은 매 프레임 전체 정렬을 피하는 것이다. 등록된 오브젝트를 관리하고, 이동한 오브젝트만 더티로 마킹해 다음 프레임에 부분 재정렬하며, 대규모 필드(수백 개 오브젝트)에서는 시야 컬링과 결합해 정렬 대상 자체를 줄인다. Phaser는 setDepth가 비교적 저비용이지만, 수천 개 대상에 매 프레임 sort를 돌리면 GC 압박이 생기므로 사전 할당 배열을 재사용한다.",
    ],
    blocks: [
      {
        lang: "src/world/YSortEngine.ts",
        code: `import Phaser from "phaser";

const LAYER = { ground: 0, object: 1, character: 1, fx: 2, uiFx: 3 } as const;
export type Sortable = Phaser.GameObjects.Container | Phaser.GameObjects.Sprite;

export class YSortEngine {
  private items: Sortable[] = [];
  private dirty = new Set<Sortable>();
  private scratch: Sortable[] = [];          // GC 방지 재사용 배열

  register(go: Sortable, layer: keyof typeof LAYER = "character") {
    (go as any).__ysortLayer = LAYER[layer];
    this.items.push(go);
    this.markDirty(go);
  }
  unregister(go: Sortable) {
    const i = this.items.indexOf(go);
    if (i >= 0) this.items.splice(i, 1);
  }
  markDirty(go: Sortable) { this.dirty.add(go); }

  /** 이동한 오브젝트만 depth 재계산(매 프레임 호출) */
  update() {
    if (!this.dirty.size) return;
    // 1) 더티 항목 depth 갱신
    for (const go of this.dirty) {
      const layer = (go as any).__ysortLayer ?? 1;
      const y = (go as Phaser.GameObjects.Components.Origin).y ?? 0;
      go.setDepth(layer * 100000 + Math.floor(y * 10));
    }
    this.dirty.clear();

    // 2) 같은 레이어 내에서 뒤집힌 쌍만 스왑(선택적 무결성 검사)
    //    — 컨테이너 자식 순서가 depth 우선이 아닌 렌더러에서만 필요
  }

  /** 시야 컬링 결합: 카메라 뷰 밖은 정렬 스킵 */
  updateWithCulling(cam: Phaser.Cameras.Scene2D.Camera, margin = 128) {
    const view = cam.worldView;
    for (const go of this.items) {
      const b = go.getBounds();
      if (b.right < view.x - margin || b.left > view.right + margin ||
          b.bottom < view.y - margin || b.top > view.bottom + margin) continue;
      this.dirty.add(go);
    }
    this.update();
  }

  /** 정렬 무결성 검사(디버그): depth 오름차순 위반 카운트 */
  debugInversions(): number {
    this.scratch.length = 0;
    this.scratch.push(...this.items);
    this.scratch.sort((a, b) => a.depth - b.depth);
    let inv = 0;
    for (let i = 1; i < this.scratch.length; i++) {
      const prev = this.scratch[i - 1] as any, cur = this.scratch[i] as any;
      if (prev.__ysortLayer === cur.__ysortLayer && prev.y > cur.y) inv++;
    }
    return inv;
  }
}

// 사용: 캐릭터 컨테이너(027번 외형 레이어)를 그대로 register
// ysort.register(charContainer, "character");
// 이동 후 매 틱: ysort.markDirty(charContainer);
// 렌더 단계: ysort.updateWithCulling(scene.cameras.main);`,
      },
    ],
    tips: [
      "depth 식(layer*100000 + y*10)은 레이어 간 충돌과 y 정밀도를 동시에 보장한다 — y 정밀도는 맵 타일 크기에 맞춰 조정한다.",
      "전체 정렬 대신 더티 마킹 + 시야 컬링만으로 수백 오브젝트 필드가 프레임 1ms 이하로 유지된다.",
      "캐릭터는 컨테이너 단위로 정렬하고, 컨테이너 내부(외형 파트, 027번)는 항상 고정 순서를 유지한다.",
      "그림자는 정렬 대상에서 제외(항상 바닥 레이어)해야 캐릭터와 그림자가 뒤바뀌지 않는다.",
    ],
  },
  {
    id: "043",
    title: "2D A* (A-Star) 길찾기 알고리즘 및 이동 가능 영역 Grid 연산",
    role: [
      "A*는 휴리스틱(대개 유클리드/맨해튼)으로 탐색을 목표 방향으로 유도하는 그리드 최단 경로 알고리즘이다. MMORPG에서는 (1) 클라 클릭 이동 경로, (2) 오토 배틀 접근, (3) 몬스터 추격에 쓰이며, 탐색 빈도가 높아 성능이 곧 프레임이다. 구현은 이진 힙 우선순위 큐 + Uint8Array 그리드 + 부모 노드 Int32Array로 메모리를 고정해 GC를 0으로 만든다.",
      "실무 요구는 세 가지다. 대용량 맵(2000x2000)에서 탐색 시간 상한(예: 8ms)을 두고 초과 시 부분 경로 반환, 재사용을 위한 경로 스무딩(문자형 계단 제거), 그리고 동일 경로 요청 캐시(출발/도착 타일 키). 서버 몬스터 AI는 클라와 같은 구현(shared 모듈)을 쓰되, 서버는 8방향 대각선 이동 가능 여부를 blocked 그리드(041번)에서 재검증해 클라 조작을 신뢰하지 않는다.",
    ],
    blocks: [
      {
        lang: "shared/astar.ts — GC-free A*",
        code: `export class AStar {
  private w: number; private h: number;
  private blocked: Uint8Array;
  private openHeap: number[] = [];        // 노드 인덱스 힙(f값 기준)
  private fScore: Float64Array;
  private gScore: Float64Array;
  private parent: Int32Array;
  private state: Uint8Array;              // 0=미방문 1=open 2=closed
  private stamp: Int32Array;              // 재사용 검증(탐색마다 +1)
  private curStamp = 0;
  private deadline = 0;

  constructor(w: number, h: number, blocked: Uint8Array) {
    this.w = w; this.h = h; this.blocked = blocked;
    const n = w * h;
    this.fScore = new Float64Array(n);
    this.gScore = new Float64Array(n);
    this.parent = new Int32Array(n);
    this.state = new Uint8Array(n);
    this.stamp = new Int32Array(n);
  }

  /** 경로: [x0,y0,x1,y1,...] 타일 좌표. 실패 시 null, 시간 초과 시 부분 경로 */
  find(sx: number, sy: number, tx: number, ty: number, timeBudgetMs = 8): number[] | null {
    if (this.isBlocked(tx, ty)) return null;
    const start = sy * this.w + sx, goal = ty * this.w + tx;
    if (start === goal) return [sx, sy, tx, ty];
    if (++this.curStamp === 0x7fffffff) {   // 스탬프 오버플로 방지
      this.curStamp = 1; this.state.fill(0); this.stamp.fill(0);
    }
    this.deadline = performance.now() + timeBudgetMs;
    this.openHeap.length = 0;

    const s = this.curStamp;
    this.stamp[start] = s;
    this.gScore[start] = 0;
    this.fScore[start] = this.heur(sx, sy, tx, ty);
    this.parent[start] = -1;
    this.state[start] = 1;
    this.heapPush(start);

    let best = start;                        // 도달 실패 시 최근접 노드
    let bestH = this.fScore[start];

    while (this.openHeap.length) {
      if (performance.now() > this.deadline) break;   // 시간 예산 소진
      const cur = this.heapPop();
      if (this.state[cur] === 2) continue;
      this.state[cur] = 2;

      const cx = cur % this.w, cy = (cur / this.w) | 0;
      if (cur === goal) { best = goal; break; }
      const hNow = this.heur(cx, cy, tx, ty);
      if (hNow < bestH) { bestH = hNow; best = cur; }

      // 8방향 이웃
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
          if (this.isBlocked(nx, ny)) continue;
          if (dx && dy) {                  // 대각선: 양쪽 직교가 모두 뚫려야
            if (this.isBlocked(cx + dx, cy) || this.isBlocked(cx, cy + dy)) continue;
          }
          const ni = ny * this.w + nx;
          if (this.state[ni] === 2) continue;
          const stepCost = dx && dy ? 1.414 : 1;
          const g = this.gScore[cur] + stepCost;
          if (this.stamp[ni] !== s || g < this.gScore[ni]) {
            this.stamp[ni] = s;
            this.gScore[ni] = g;
            this.parent[ni] = cur;
            this.fScore[ni] = g + this.heur(nx, ny, tx, ty);
            this.state[ni] = 1;
            this.heapPush(ni);
          }
        }
      }
    }

    // 경로 복원(역추적 → 반전)
    const path: number[] = [];
    let node = best;
    if (this.stamp[node] !== s) return null;
    while (node !== -1) {
      path.push(node % this.w, (node / this.w) | 0);
      node = this.parent[node];
    }
    path.reverse();
    return path;
  }

  private isBlocked(x: number, y: number) { return this.blocked[y * this.w + x] === 1; }
  private heur(x: number, y: number, tx: number, ty: number) {
    const dx = Math.abs(x - tx), dy = Math.abs(y - ty);
    return (dx + dy) + (1.414 - 2) * Math.min(dx, dy);   // 옥타일 거리
  }

  // ── 이진 힙(fScore 기준 최소 힙) ──
  private heapPush(i: number) {
    const h = this.openHeap; h.push(i);
    let c = h.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (this.fScore[h[p]] <= this.fScore[h[c]]) break;
      [h[p], h[c]] = [h[c], h[p]]; c = p;
    }
  }
  private heapPop(): number {
    const h = this.openHeap;
    const top = h[0], last = h.pop()!;
    if (h.length) {
      h[0] = last;
      let p = 0;
      for (;;) {
        const l = p * 2 + 1, r = l + 1;
        let m = p;
        if (l < h.length && this.fScore[h[l]] < this.fScore[h[m]]) m = l;
        if (r < h.length && this.fScore[h[r]] < this.fScore[h[m]]) m = r;
        if (m === p) break;
        [h[p], h[m]] = [h[m], h[p]]; p = m;
      }
    }
    return top;
  }
}`,
      },
    ],
    tips: [
      "TypedArray + 스탬프 재사용으로 탐색마다 배열을 새로 만들지 않는다 — 몬스터 100마리 동시 탐색에서 GC 정지가 사라진다.",
      "시간 예산(8ms) 초과 시 '최근접 노드까지의 부분 경로'를 반환해 몬스터가 멈추지 않게 한다 — 다음 틱에 재탐색한다.",
      "대각선 이동은 양쪽 직교 타일이 모두 뚫려 있을 때만 허용해야 코너 뚫기(벽 끼고 비스듬히 통과) 버그가 없다.",
      "경로 캐시는 (start,goal) 키로 최대 200개 LRU — 오토 배틀 반복 요청에서 CPU를 크게 아낀다.",
    ],
  },
  {
    id: "044",
    title: "실시간 동적 2D 조명 & 낮밤 시간 변화 셰이더/파티클",
    role: [
      "2D 조명은 보통 '전체 어둠 레이어(ambient) + 광원(원형 그라디언트) 마스크' 구조로 만든다. 렌더는 (1) 월드를 렌더, (2) 조명 텍스처(라이트맵)를 별도 렌더 타깃에 그림, (3) 월드 위에 multiply/normal 블렌드로 합성 — Phaser에서는 RenderTexture + BlendMode.MULTIPLY 조합으로 구현한다. 광원은 캐릭터 횃불, 가로등, 화염, 마법 오라 등이며 각 광원은 반경·색상·깜빡임 파라미터를 가진다.",
      "낮밤 사이클은 게임 내 시간(예: 실제 30분 = 게임 하루)에 따라 ambient 색과 강도를 보간한다. 낮(밝은 ambient) → 황혼(주황 틴트) → 밤(짙은 남색 + 광원 강조) → 새벽 순서로 색상 그라디언트를 두고, 몬스터 스폰 테이블과 연동해 밤에만 등장하는 위험 구역을 만들면 콘텐츠가 깊어진다. 파티클(불티, 반딧불)은 광원 강도와 연동해 밤에만 활성화한다.",
    ],
    blocks: [
      {
        lang: "src/world/DayNightLighting.ts",
        code: `import Phaser from "phaser";

interface LightSource {
  obj: Phaser.GameObjects.Components.Transform;   // 따라갈 오브젝트
  radius: number; color: number; intensity: number;
  flicker?: number;                                // 0~1 깜빡임 강도
}

/** 게임 하루 = 실제 30분. 시간대별 ambient 색상 */
const PHASES = [
  { at: 0.00, color: 0x2a3550, name: "night" },     // 0시
  { at: 0.23, color: 0x5a5070, name: "dawn" },      // 새벽
  { at: 0.30, color: 0xffffff, name: "day" },       // 아침
  { at: 0.62, color: 0xfff3dd, name: "afternoon" },
  { at: 0.78, color: 0xe8a060, name: "dusk" },      // 황혼
  { at: 0.86, color: 0x2a3550, name: "night" },
];

export class DayNightLighting {
  private rt: Phaser.GameObjects.RenderTexture;
  private lights: LightSource[] = [];
  private dayT = 0.4;                       // 0~1 (0.4 = 오전)

  constructor(private scene: Phaser.Scene, w: number, h: number) {
    this.rt = scene.make.renderTexture({ width: w, height: h }, false);
    this.rt.setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(8000);
  }

  addLight(src: LightSource) { this.lights.push(src); }

  /** 게임 시간 진행(서버 동기 — 클라 로컬 시간은 신뢰하지 않음) */
  setDayTime(t: number) { this.dayT = Phaser.Math.Wrap(t, 0, 1); }
  get isNight() { return this.dayT < 0.23 || this.dayT > 0.86; }

  /** 렌더 프레임: 라이트맵 생성 */
  render(cam: Phaser.Cameras.Scene2D.Camera, time: number) {
    this.rt.clear();
    // 1) ambient 색 채움(시간대 보간)
    const amb = this.ambientColor();
    this.rt.fill(amb, 1);
    // 2) 광원: ERASE 블렌드로 어둠을 뚫는 구멍
    for (const l of this.lights) {
      const flicker = l.flicker
        ? 1 - Math.sin(time / 90) * l.flicker * 0.5 - Math.random() * l.flicker * 0.1
        : 1;
      const r = l.radius * flicker;
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
      const cx = l.obj.x - cam.scrollX, cy = l.obj.y - cam.scrollY;
      const grad = g.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
      // Phaser 3.60+ Graphics gradient API — 내부에서 canvas gradient 구성
      grad.addColorStop(0, "rgba(0,0,0,1)");          // 중심 = 완전 밝음
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillCircle(cx, cy, r);
      this.rt.erase(g, cx - r, cy - r);
      g.destroy();
    }
  }

  private ambientColor(): number {
    const t = this.dayT;
    for (let i = 0; i < PHASES.length; i++) {
      const a = PHASES[i], b = PHASES[(i + 1) % PHASES.length];
      const next = b.at <= a.at ? b.at + 1 : b.at;
      if (t >= a.at && t < next) {
        const r = (t - a.at) / (next - a.at);
        return Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.IntegerToColor(a.color),
          Phaser.Display.Color.IntegerToColor(b.color),
          100, r * 100,
        ).color;
      }
    }
    return 0xffffff;
  }
}`,
      },
    ],
    tips: [
      "라이트맵은 반드시 별도 RenderTexture에 그려 한 번의 multiply 합성으로 마무리한다 — 광원마다 캔버스에 직접 그리면 드로우콜이 폭증한다.",
      "깜빡임(flicker)은 sin + 약간의 랜덤 조합이 가장 자연스럽고, 순수 랜덤은 렌더 시간에 따라 성능이 불안정하다.",
      "낮밤 시간은 서버가 단일 권위로 방송(맵 진입 시 1회 + 분당 1회 보정)해야 유저 간 시간이 어긋나지 않는다.",
      "밤 전용 스폰/채집 콘텐츠는 isNight 플래그 하나로 게이팅하면 기획 데이터만으로 켜고 끌 수 있다.",
    ],
  },
  {
    id: "045",
    title: "날씨(비, 눈, 안개) 환경 파티클 시스템",
    role: [
      "날씨 파티클은 카메라 시야를 채우는 스크린 공간 효과다. 비는 얇은 라인 스프라이트를 고속 낙하 + 바람 경사, 눈은 작은 원 스프라이트를 사인파 흔들림 + 저속 낙하, 안개는 큰 반투명 텍스처를 천천히 표류시킨다. 핵심은 파티클 수를 시야 크기와 날씨 강도(0~1)에 비례해 조절하고, 화면 밖으로 나간 파티클을 상단으로 재활용(순환)해 스폰 비용을 0으로 만드는 것이다.",
      "Phaser 3.60+의 Particle Emitter를 쓰면 웹 워커 없이도 GPU 프레임 내에 수백 파티클을 처리하지만, 대규모 눈보라는 프레임 예산(001번)과 연동해 파티클 수를 동적으로 줄인다. 날씨 전환은 즉시가 아니라 3~5초 보간(강도 램프)으로 진행해 화면이 뚝 끊기는 느낌을 없앤다. 서버가 날씨 상태(맵별 스케줄)를 권위로 관리하고 클라는 표현만 담당한다.",
    ],
    blocks: [
      {
        lang: "src/world/WeatherFX.ts",
        code: `import Phaser from "phaser";

export type WeatherKind = "clear" | "rain" | "snow" | "fog";
export interface WeatherState { kind: WeatherKind; intensity: number; wind: number; }

export class WeatherFX {
  private emitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private fogLayers: Phaser.GameObjects.TileSprite[] = [];
  private current: WeatherState = { kind: "clear", intensity: 0, wind: 0 };
  private target: WeatherState = { kind: "clear", intensity: 0, wind: 0 };

  constructor(private scene: Phaser.Scene) {}

  /** 서버 날씨 방송 수신 */
  setState(s: WeatherState) { this.target = s; }

  /** 고정 업데이트: 4초 램프 보간 */
  fixedUpdate(dtMs: number, cam: Phaser.Cameras.Scene2D.Camera) {
    const k = dtMs / 4000;                       // 보간 속도
    this.current.intensity += (this.target.intensity - this.current.intensity) * k;
    this.current.wind += (this.target.wind - this.current.wind) * k;
    if (this.current.kind !== this.target.kind && this.current.intensity < 0.05) {
      this.switchKind(this.target.kind);
    }
    this.apply(cam, dtMs);
  }

  private switchKind(kind: WeatherKind) {
    this.destroyEmitters();
    this.current.kind = kind;
    if (kind === "rain" || kind === "snow") {
      const tex = kind === "rain" ? "wx_raindrop" : "wx_snowflake";
      this.emitter = this.scene.add.particles(0, 0, tex, {
        x: { min: 0, max: this.scene.scale.width + 200 },
        y: -20,
        lifespan: kind === "rain" ? 900 : 6000,
        speedY: kind === "rain" ? { min: 700, max: 950 } : { min: 40, max: 90 },
        speedX: { min: -60, max: 60 },           // 바람은 apply에서 곱연산
        scale: kind === "rain" ? { min: 0.7, max: 1.2 } : { min: 0.4, max: 1.0 },
        alpha: kind === "rain" ? { min: 0.4, max: 0.8 } : { min: 0.7, max: 1 },
        quantity: 4,
        frequency: 40,
        blendMode: "SCREEN",
      });
      this.emitter.setDepth(8500);
      this.emitter.setScrollFactor(0);           // 스크린 공간 고정
    }
    if (kind === "fog") {
      for (let i = 0; i < 2; i++) {
        const fog = this.scene.add.tileSprite(0, i * 120,
          this.scene.scale.width, this.scene.scale.height, "wx_fog");
        fog.setOrigin(0).setAlpha(0).setDepth(8400 + i).setScrollFactor(0.3 + i * 0.2);
        this.fogLayers.push(fog);
      }
    }
  }

  private apply(cam: Phaser.Cameras.Scene2D.Camera, dtMs: number) {
    const i = this.current.intensity;
    if (this.emitter) {
      this.emitter.frequency = 40 / Math.max(0.05, i);   // 강도 → 스폰 빈도
      this.emitter.ops.speedX.onChange(this.current.wind * (this.current.kind === "rain" ? 3 : 1));
    }
    this.fogLayers.forEach((fog, idx) => {
      fog.setAlpha(Math.min(0.55, i * 0.6));
      fog.tilePositionX += (0.4 + idx * 0.25) * dtMs / 16.67 + this.current.wind * 0.02;
    });
  }

  private destroyEmitters() {
    this.emitter?.destroy(); this.emitter = null;
    this.fogLayers.forEach(f => f.destroy()); this.fogLayers = [];
  }
}`,
      },
    ],
    tips: [
      "파티클은 setScrollFactor(0)로 스크린 공간에 두면 카메라 이동과 무관하게 시야를 채운다.",
      "강도 보간(4초 램프)은 종류 전환 시 0.05 이하로 내린 뒤에만 emitter를 갈아끼워 화면 끊김을 막는다.",
      "눈은 speedY를 40~90으로 낮추고 사인 흔들림(scaleY 진동)을 주면 가격 없이 자연스러워진다.",
      "날씨는 맵별 스케줄(서버 권위) + 이벤트 날씨(보스전 뇌우 등)를 구분해 데이터로 운영한다.",
    ],
  },
];
