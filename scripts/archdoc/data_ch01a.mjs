// 모듈 1 (001~005): 웹 & 크로스플랫폼 기술 아키텍처 — 전반부
// 스택: TypeScript, Phaser 3/PixiJS, uWebSockets.js(Client Ws), IndexedDB

export const items = [
  {
    id: "001",
    title: "WebGL/Canvas 기반 2D 렌더링 엔진 기본 루프 구조",
    role: [
      "2D 탑다운 MMORPG의 모든 화면 출력은 requestAnimationFrame(rAF) 기반 고정 스텝 시뮬레이션 + 가변 렌더 구조에서 출발한다. Phaser 3는 내부적으로 이 구조를 갖추고 있지만, 대규모 씬 전환·커스텀 매니저 운용을 위해서는 프레임 루프의 3단계(입력 수집 → 고정 스텝 업데이트 → 렌더)를 명시적으로 분리한 게임 루프 관리자가 필요하다. 고정 스텝(FIXED_STEP)은 물리·전투 판정의 결정론성을 보장하고, 렌더는 누적 시간을 보간해 프레임율과 무관하게 부드러운 움직임을 만든다. 렌더러는 WebGL을 우선 사용하고 WebGL 컨텍스트 상실 시 Canvas2D로 자동 폴백한다.",
      "이 모듈은 Phaser 게임 인스턴스의 부팅 순서(부트 → 프리로드 → 월드 → UI)를 통제하며, 프레임 타임아웃 감시(스파이크 감지)와 FPS/드로우콜 계측 훅을 함께 제공한다. 특히 모바일 저사양 기기에서는 렌더 해상도 스케일을 동적으로 낮추어 30fps 하한을 지키는 적응형 품질 제어의 기반이 된다.",
    ],
    blocks: [
      {
        lang: "src/engine/RenderLoop.ts",
        code: `import Phaser from "phaser";

export const FIXED_STEP = 1000 / 60; // 60Hz 고정 시뮬레이션 스텝(ms)

export interface LoopStats {
  fps: number; drawCalls: number; entities: number; spikeMs: number;
}

export class RenderLoop {
  private acc = 0;
  private last = 0;
  private alpha = 0;              // 보간 계수 (0~1)
  private stats: LoopStats = { fps: 0, drawCalls: 0, entities: 0, spikeMs: 0 };
  private frameCount = 0;
  private fpsTimer = 0;
  private renderScale = 1;

  constructor(
    private game: Phaser.Game,
    private onFixedUpdate: (dtMs: number) => void,
    private onRender?: (alpha: number) => void,
  ) {
    // WebGL 컨텍스트 상실 감지 → Canvas 폴백 유도
    const canvas = game.canvas;
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      console.warn("[RenderLoop] WebGL context lost — pause & hint reload");
      this.game.loop.sleep();
    });
    canvas.addEventListener("webglcontextrestored", () => {
      this.game.loop.wake();
    });
  }

  /** Phaser 씬 밖에서 구동하는 독립 루프(커스텀 매니저용) */
  start() {
    this.last = performance.now();
    const tick = (now: number) => {
      requestAnimationFrame(tick);
      let frame = now - this.last;
      this.last = now;
      if (frame > 250) frame = 250;          // 탭 복귀 등 스파이크 클램프
      this.stats.spikeMs = Math.max(this.stats.spikeMs, frame);

      this.acc += frame;
      let steps = 0;
      while (this.acc >= FIXED_STEP && steps < 5) {   // 스파이럴 오브 데스 방지
        this.onFixedUpdate(FIXED_STEP);
        this.acc -= FIXED_STEP;
        steps++;
      }
      this.alpha = this.acc / FIXED_STEP;
      this.onRender?.(this.alpha);

      this.measure(frame, now);
    };
    requestAnimationFrame(tick);
  }

  private measure(frameMs: number, now: number) {
    this.frameCount++; this.fpsTimer += frameMs;
    if (this.fpsTimer >= 1000) {
      this.stats.fps = Math.round(this.frameCount * 1000 / this.fpsTimer);
      this.frameCount = 0; this.fpsTimer = 0;
      this.adaptQuality();                    // 1초마다 품질 자동 조정
    }
  }

  /** 적응형 품질: fps 하방 미달 시 렌더 스케일 축소 */
  private adaptQuality() {
    if (this.stats.fps < 28 && this.renderScale > 0.6) {
      this.renderScale = Math.max(0.6, this.renderScale - 0.1);
      this.game.scale.setZoom(this.renderScale);
    } else if (this.stats.fps > 55 && this.renderScale < 1) {
      this.renderScale = Math.min(1, this.renderScale + 0.05);
      this.game.scale.setZoom(this.renderScale);
    }
  }

  getStats(): LoopStats { return this.stats; }
}

// ── Phaser 부팅 설정 예시 ─────────────────────────────────────
export function bootGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,                       // WebGL 우선, 미지원 시 Canvas
    parent,
    width: 1280, height: 720,
    backgroundColor: "#0b1c2c",
    render: { antialias: false, powerPreference: "high-performance" },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    fps: { target: 60, forceSetTimeOut: false },
    scene: [],                                // 씬은 AssetFlow 이후 등록
  });
}`,
      },
    ],
    tips: [
      "고정 스텝과 렌더 보간(alpha)을 분리하면 144Hz 모니터와 30fps 모바일에서 동일한 전투 판정 결과를 얻는다.",
      "스파이럴 오브 데스 방지를 위해 한 프레임의 최대 업데이트 스텝(여기서는 5회)을 반드시 제한한다.",
      "드로우콜은 텍스처 아틀라스 단위로 줄어드므로, 스프라이트는 반드시 정적 아틀라스 또는 동적 텍스처 아틀라스로 묶는다.",
      "powerPreference: high-performance는 하이브리드 GPU 노트북에서 전용 GPU를 우선 사용하게 한다.",
    ],
  },
  {
    id: "002",
    title: "uWebSockets.js 서버 연결용 바이너리(ArrayBuffer) 소켓 핸들러",
    role: [
      "MMORPG 트래픽의 대부분은 위치·액션·상태 동기화 패킷이며, JSON 텍스트 대신 ArrayBuffer 바이너리 프로토콜을 사용하면 패킷 크기를 1/5~1/10 수준으로 줄일 수 있다. 이 핸들러는 클라이언트와 서버(uWebSockets.js)가 공유하는 패킷 ID 체계를 기준으로 DataView로 직렬화/역직렬화를 수행하고, 수신 버퍼를 패킷 단위로 분할하는 스트림 파서를 포함한다. 모든 패킷은 [u16 길이][u8 타입][페이로드] 헤더 구조를 따라 파셔링이 단순하고 서버 측 C++ 코어(uWS)의 메모리 복사를 최소화한다.",
      "핸들러는 연결 생명주기(오픈/클로즈/에러) 이벤트를 EventBus로 중계하고, 송신 큐에 백프레셔(전송 지연 누적)를 감시해 네트워크 포화 시 패킷 우선순위 드롭(장식 이펙트 패킷 폐기)을 적용한다. 이는 100명 이상 동시 접속 구역에서의 프레임 드랍을 방지하는 핵심 장치다.",
    ],
    blocks: [
      {
        lang: "src/net/packet.ts — 공유 패킷 정의 및 코덱",
        code: `// 클라이언트/서버 공유 패킷 ID (uWebSockets.js 서버와 동일 상수 사용)
export const enum PKT {
  C2S_MOVE       = 1,   // 이동 의도
  C2S_SKILL      = 2,   // 스킬 사용
  C2S_PING       = 3,
  S2C_SNAPSHOT   = 64,  // AOI 스냅샷(델타)
  S2C_ENTITY_SPAWN = 65,
  S2C_ENTITY_DESPAWN = 66,
  S2C_PONG       = 67,
  S2C_KICK       = 68,
}

export interface MoveIntent { seq: number; x: number; y: number; dx: number; dy: number; }

export function encodeMove(m: MoveIntent): ArrayBuffer {
  const buf = new ArrayBuffer(1 + 4 + 4 + 4 + 4);   // type + seq + x + y + (dx,dy packed)
  const v = new DataView(buf);
  let o = 0;
  v.setUint8(o++, PKT.C2S_MOVE);
  v.setUint32(o, m.seq); o += 4;
  v.setInt16(o, Math.round(m.x * 10)); o += 2;      // x100 배율 고정소수
  v.setInt16(o, Math.round(m.y * 10)); o += 2;
  v.setInt8(o, Math.round(m.dx * 127)); o += 1;     // -1~1 정규화 → i8
  v.setInt8(o, Math.round(m.dy * 127)); o += 1;
  return buf.slice(0, o);                            // 실제 길이만큼 절단
}

export function decodeMove(buf: ArrayBuffer): MoveIntent {
  const v = new DataView(buf);
  let o = 1; // skip type
  const seq = v.getUint32(o); o += 4;
  const x = v.getInt16(o) / 10; o += 2;
  const y = v.getInt16(o) / 10; o += 2;
  const dx = v.getInt8(o) / 127; o += 1;
  const dy = v.getInt8(o) / 127;
  return { seq, x, y, dx, dy };
}`,
      },
      {
        lang: "src/net/BinarySocket.ts — 핸들러 본체",
        code: `import { PKT } from "./packet";

type Handler = (type: number, payload: ArrayBuffer) => void;

export class BinarySocket {
  private ws: WebSocket | null = null;
  private rx = new Uint8Array(0);          // 수신 스트림 버퍼
  private outQueue: ArrayBuffer[] = [];
  private outBytes = 0;
  private static MAX_OUT_BYTES = 256 * 1024; // 백프레셔 한계(256KB)

  constructor(private url: string, private onPacket: Handler,
              private onState: (s: "open" | "closed" | "error") => void) {}

  connect() {
    this.ws = new WebSocket(this.url);
    this.ws.binaryType = "arraybuffer";
    this.ws.onopen = () => this.onState("open");
    this.ws.onclose = () => this.onState("closed");
    this.ws.onerror = () => this.onState("error");
    this.ws.onmessage = (ev) => this.consume(ev.data as ArrayBuffer);
  }

  /** 스트림 버퍼에서 [u16 len][u8 type][payload] 단위로 절단 */
  private consume(chunk: ArrayBuffer) {
    const merged = new Uint8Array(this.rx.length + chunk.byteLength);
    merged.set(this.rx); merged.set(new Uint8Array(chunk), this.rx.length);
    this.rx = merged;

    const v = new DataView(this.rx.buffer);
    let off = 0;
    while (this.rx.length - off >= 3) {
      const len = v.getUint16(off);              // 페이로드 길이
      if (this.rx.length - off < 3 + len) break; // 아직 덜 도착
      const type = v.getUint8(off + 2);
      const payload = this.rx.buffer.slice(off + 3, off + 3 + len);
      this.onPacket(type, payload);
      off += 3 + len;
    }
    if (off > 0) this.rx = this.rx.slice(off);
  }

  /** 우선순위 송신: 큐 포화 시 low 패킷 폐기 */
  send(data: ArrayBuffer, priority: "high" | "low" = "high") {
    if (priority === "low" && this.outBytes > BinarySocket.MAX_OUT_BYTES * 0.7) return;
    this.outQueue.push(data);
    this.outBytes += data.byteLength;
    this.flush();
  }

  private flush() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    while (this.outQueue.length) {
      const item = this.outQueue.shift()!;
      this.ws.send(item);
      this.outBytes -= item.byteLength;
    }
  }

  close() { this.ws?.close(); this.outQueue = []; this.outBytes = 0; }
}`,
      },
    ],
    tips: [
      "uWebSockets.js 서버 측에서는 message 이벤트가 ArrayBuffer가 아닌 Buffer를 주므로, 서버 코덱은 Buffer/DataView 양쪽에서 동작하도록 만들어 둔다.",
      "위치는 절대 float64 대신 i16 고정소수(×10 배율)로 보내면 패킷이 절반 이하로 줄어든다.",
      "수신 버퍼 절단 로직은 반드시 부분 패킷(3+len 미만)을 남기고 대기해야 TLS 단편화에서도 안전하다.",
      "백프레셔 드롭은 채팅/전투 패킷에 적용하면 안 되며, 이펙트·파티클 등 재생성 가능한 트래픽에만 적용한다.",
    ],
  },
  {
    id: "003",
    title: "PC/모바일 가로형 반응형 화면 스케일링 모듈",
    role: [
      "웹 MMORPG는 4K 모니터부터 폴더블 폰, 세로 회전까지 화면 환경이 극단적으로 다양하다. 이 모듈은 가로형(landscape) 게임 기준 해상도(예: 1280x720)를 베이스로, 화면 종횡비에 따라 Phaser Scale.FIT / EXPAND 모드를 자동 전환하고 HUD(DOM 오버레이)의 크기·터치 영역을 디바이스 등급별로 스케일링한다. 세로로 회전하면 '화면을 가로로 돌려주세요' 가이드 오버레이를 표시해 모바일 UX 파손을 막는다.",
      "또한 devicePixelRatio(DPR)를 상한(2.0)으로 클램프해 고해상도 폰에서의 필 레이트 폭증을 방지하고, resize 이벤트를 디바운싱하여 아이폰 사파리 주소창 수축/확장으로 인한 수십 회의 리사이즈 폭풍을 흡수한다. 게임 캔버스와 DOM HUD의 좌표계가 어긋나지 않도록 두 영역에 동일한 스케일 팩터를 적용하는 것이 핵심 설계 포인트다.",
    ],
    blocks: [
      {
        lang: "src/engine/ResponsiveScaler.ts",
        code: `import Phaser from "phaser";

export interface ScaleInfo {
  width: number; height: number;       // CSS 픽셀 기준 뷰포트
  dpr: number;                         // 클램프된 devicePixelRatio
  isMobile: boolean;                   // 터치 + 화면 폭 기준 판정
  landscape: boolean;
}

const BASE_W = 1280, BASE_H = 720;
const DPR_MAX = 2.0;

export class ResponsiveScaler {
  private info: ScaleInfo;
  private rotateOverlay: HTMLElement;
  private resizeTimer = 0;

  constructor(private game: Phaser.Game, private hudRoot: HTMLElement) {
    this.rotateOverlay = document.getElementById("rotate-guide")!;
    this.info = this.measure();
    this.apply();
    this.bind();
  }

  private measure(): ScaleInfo {
    const vw = window.innerWidth, vh = window.innerHeight;
    const rawDpr = window.devicePixelRatio || 1;
    const isMobile = matchMedia("(pointer: coarse)").matches && Math.min(vw, vh) < 820;
    return {
      width: vw, height: vh,
      dpr: Math.min(rawDpr, DPR_MAX),
      isMobile,
      landscape: vw >= vh,
    };
  }

  private bind() {
    // 디바운스 200ms: 사파리 주소창 리사이즈 폭풍 흡수
    window.addEventListener("resize", () => {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = window.setTimeout(() => {
        this.info = this.measure();
        this.apply();
      }, 200);
    });
    window.addEventListener("orientationchange", () =>
      setTimeout(() => { this.info = this.measure(); this.apply(); }, 120));
  }

  private apply() {
    const { width, height, dpr, isMobile, landscape } = this.info;

    // 1) 세로 화면 + 모바일 → 회전 가이드
    this.rotateOverlay.style.display = (!landscape && isMobile) ? "flex" : "none";
    if (!landscape && isMobile) { this.game.loop.sleep(); return; }
    this.game.loop.wake();

    // 2) 종횡비에 따른 Scale 모드 전환
    const ratio = width / height;
    const mode = ratio > BASE_W / BASE_H
      ? Phaser.Scale.FIT        // 더 넓으면 게임 전체 표시(레터박스 좌우)
      : Phaser.Scale.EXPAND;    // 더 좁으면 가로 절단 없이 확장
    this.game.scale.setGameSize(BASE_W, BASE_H);
    this.game.scale.scaleManager.setMode(mode);
    this.game.scale.refresh();

    // 3) 캔버스 해상도 = CSS 크기 x 클램프 DPR
    this.game.canvas.style.width = width + "px";
    this.game.canvas.style.height = height + "px";

    // 4) HUD 스케일: 모바일에서 터치 타깃 44px 이상 보장
    const hudScale = isMobile
      ? Math.max(1, Math.min(width / BASE_W, 1.6))
      : Math.max(0.8, Math.min(width / BASE_W, 1.35));
    this.hudRoot.style.setProperty("--hud-scale", hudScale.toFixed(3));
    this.hudRoot.style.setProperty("--touch-min", isMobile ? "44px" : "32px");
  }

  getInfo(): ScaleInfo { return this.info; }
}

// HUD CSS 예: .hud-panel { transform: scale(var(--hud-scale)); transform-origin: top left; }
//              .btn { min-width: var(--touch-min); min-height: var(--touch-min); }`,
      },
    ],
    tips: [
      "DPR 클램프(2.0)만으로 고해상도 폰에서 fill-rate 병목을 크게 줄일 수 있다 — 3x/4x DPR 기기는 픽셀 수가 9~16배다.",
      "resize 디바운스는 200ms가 적정이며, orientationchange는 물리 회전이 끝난 뒤 치수가 확정되므로 120ms 지연 후 측정한다.",
      "게임 캔버스(Phaser)와 DOM HUD의 스케일 팩터를 동일 변수(--hud-scale)로 공유해야 좌표가 어긋나지 않는다.",
      "EXPAND 모드는 렌더 영역이 커지므로, 카메라 경계와 미니맵 계산에 game.scale.gameSize를 기준으로 사용한다.",
    ],
  },
  {
    id: "004",
    title: "점진적 자원 로딩(Lazy Loading) 및 에셋 번들러",
    role: [
      "MMORPG는 맵·스프라이트·음원·이펙트 수천 개를 다루지만, 플레이어가 동시에 필요로 하는 자원은 현재 구역 주변뿐이다. 이 모듈은 에셋을 '번들(bundle)' 단위로 정의하고(예: village-base, village-npc, dungeon-fire), 현재 씬에서 도달 가능한 번들을 우선순위 큐로 로딩하며, 거리·스테이지 전환 예측에 따라 프리페치한다. 로딩은 우선순위 + 동시성 제한(4개)으로 진행되어 대역폭 경쟁으로 인한 지연 폭증을 막는다.",
      "번들러(build 타임)는 에셋 파일을 해시명으로 카피하고 manifest.json을 생성한다. 매니페스트에는 각 번들의 파일 목록·용량·해시가 기록되어, 클라이언트는 이를 참조해 캐시 히트(IndexedDB, 006번)를 먼저 확인하고 누락분만 네트워크로 받는다. 이 구조는 이후 핫픽스(096번)와도 연결되어 부분 업데이트의 기반이 된다.",
    ],
    blocks: [
      {
        lang: "src/assets/BundleManifest.ts — 빌드 타임 매니페스트 타입",
        code: `export interface AssetEntry {
  key: string;          // 게임 내 참조 키 (예: "hero_idle")
  url: string;          // 해시 경로 (예: "/a/s/hero_idle.a1b2c3.png")
  bytes: number;
  hash: string;         // SHA-1(내용) — 캐시 무효화 판정
  type: "image" | "atlas" | "audio" | "json" | "bitmapfont";
}
export interface AssetBundle {
  id: string;                       // "village-base"
  priority: number;                 // 낮을수록 먼저 로딩
  entries: AssetEntry[];
  preloadWith?: string[];           // 의존 번들
}
export interface Manifest { version: string; bundles: Record<string, AssetBundle>; }`,
      },
      {
        lang: "src/assets/AssetFlow.ts — 우선순위 지연 로딩 관리자",
        code: `import Phaser from "phaser";
import type { Manifest, AssetBundle } from "./BundleManifest";

export class AssetFlow {
  private loaded = new Set<string>();     // 번들 id
  private queue: AssetBundle[] = [];
  private active = 0;
  private static CONCURRENCY = 4;

  constructor(private game: Phaser.Game, private manifest: Manifest,
              private cache: { has(key: string, hash: string): boolean }) {}

  /** 현재 구역 진입 시 호출 — 필요 번들을 우선순위로 적재 */
  request(bundleIds: string[], onProgress?: (p: number) => void) {
    const need = bundleIds
      .map(id => this.manifest.bundles[id])
      .filter(b => b && !this.loaded.has(b.id));
    this.queue.push(...need);
    this.queue.sort((a, b) => a.priority - b.priority);
    this.pump(onProgress);
  }

  private pump(onProgress?: (p: number) => void) {
    while (this.active < AssetFlow.CONCURRENCY && this.queue.length) {
      const bundle = this.queue.shift()!;
      this.active++;
      this.loadBundle(bundle, onProgress).finally(() => {
        this.active--;
        this.loaded.add(bundle.id);
        this.pump(onProgress);
      });
    }
  }

  private async loadBundle(b: AssetBundle, onProgress?: (p: number) => void) {
    const loader = this.game.load;
    let done = 0;
    for (const e of b.entries) {
      if (this.cache.has(e.key, e.hash)) { done++; continue; }  // IndexedDB 히트
      switch (e.type) {
        case "image": loader.image(e.key, e.url); break;
        case "atlas": loader.atlas(e.key, e.url, e.url.replace(".png", ".json")); break;
        case "audio": loader.audio(e.key, e.url); break;
        case "json":  loader.json(e.key, e.url); break;
        case "bitmapfont": loader.bitmapFont(e.key, e.url); break;
      }
      loader.once("filecomplete-" + e.type + "-" + e.key, () => {
        done++;
        onProgress?.(done / b.entries.length);
      });
    }
    if (!loader.isLoading()) loader.start();
    await new Promise<void>(res => loader.once("complete", () => res()));
  }

  /** 스테이지 전환 예측 프리페치 — idle 시 낮은 우선순위로 미리 받기 */
  prefetch(bundleIds: string[]) {
    setTimeout(() => this.request(bundleIds), 1500);
  }
}`,
      },
    ],
    tips: [
      "번들 경계는 '한 구역에서 반드시 함께 필요한 세트'로 자르는 것이 원칙이며, 개별 파일 단위 로딩은 HTTP 오버헤드로 오히려 느려진다.",
      "매니페스트 해시로 캐시 무효화를 판정하면 배포 후 같은 URL을 재사용해도 안전하다(캐시 폭독 방지).",
      "동시성 4~6개가 일반적인 적정값이며, HTTP/2 환경에서는 이후 6~8개로 올려도 된다.",
      "오디오는 무손실 대신 m4a/ogg 이중 인코딩으로 제공해 총 번들 용량을 60~70% 줄일 수 있다.",
    ],
  },
  {
    id: "005",
    title: "네트워크 끊김 시 소켓 자동 재접속 및 세션 복구 로직",
    role: [
      "이동 중 지하철 진입, Wi-Fi 전환, 서버 배포 등으로 소켓은 언제든 끊긴다. 재접속 모듈의 목표는 두 가지다. 첫째, 지수 백오프(exponential backoff) + 지터(jitter)로 재접속 폭풍(스웜)을 막으면서 빠르게 재연결하고, 둘째, 재연결 후 세션 토큰으로 서버에 '이어하기'를 요청해 캐릭터 상태·위치·파티 정보를 복원한다. 오프라인 동안의 로컬 입력은 큐잉했다가 복구 시 서버와 조정(reconcile)한다.",
      "세션 복구의 핵심은 '재접속에 성공해도 세션이 살아 있으면 씬을 다시 로드하지 않는다'는 것이다. 서버는 세션 토큰과 마지막 처리 시퀀스 번호를 유지하며, 클라이언트가 보낸 미처리 입력을 seq 기준으로 거르고, 누락 구간의 스냅샷을 재전송한다. 이를 통해 끊김 복구가 유저 눈에 보이는 '재접속 로딩'이 아니라 1~2초의 반투명 오버레이로 끝난다.",
    ],
    blocks: [
      {
        lang: "src/net/ReconnectingSocket.ts",
        code: `import { BinarySocket } from "./BinarySocket";

export interface SessionRestore {
  sessionToken: string;
  lastAckSeq: number;          // 서버가 마지막으로 승인한 입력 seq
  characterSnapshot: unknown;  // HP/MP/버프/위치 등
}

export class ReconnectingSocket {
  private sock: BinarySocket | null = null;
  private attempts = 0;
  private token = localStorage.getItem("sessionToken") || "";
  private pendingInputs: ArrayBuffer[] = [];   // 오프라인 입력 큐
  private alive = true;
  onRestore?: (r: SessionRestore) => void;

  constructor(private makeSocket: () => BinarySocket,
              private ui: { show: (msg: string) => void; hide: () => void }) {}

  start() {
    this.sock = this.makeSocket();
    this.sock.connect();
  }

  onDisconnected() {
    if (!this.alive) return;
    this.attempts++;
    if (this.attempts > 8) { this.ui.show("연결이 불안정합니다. 앱을 다시 시작해 주세요."); return; }

    // 지수 백오프 + 지터: 0.5s, 1s, 2s, 4s ... 최대 15s
    const base = Math.min(15000, 500 * Math.pow(2, this.attempts - 1));
    const wait = base * (0.7 + Math.random() * 0.6);   // ±30% 지터
    this.ui.show("연결 끊김 — " + Math.round(wait / 1000) + "초 후 재접속합니다 (" + this.attempts + "회차)");
    setTimeout(() => this.tryReconnect(), wait);
  }

  private tryReconnect() {
    this.sock = this.makeSocket();
    this.sock.connect();
    // 실제로는 onOpen 콜백에서 tryResume() 호출
  }

  /** 연결 성공 직후: 세션 토큰으로 이어하기 시도 */
  tryResume() {
    this.ui.show("세션 복구 중...");
    const hello = new TextEncoder().encode(JSON.stringify({
      t: "resume", token: this.token, ts: Date.now(),
    }));
    this.sock!.send(hello.buffer, "high");
    // 서버 응답 S2C_RESTORE 수신 시 onRestore 콜백으로 스냅샷 반영
  }

  /** 복구 성공: 끊긴 동안 쌓인 입력 재전송(서버가 seq로 중복 거름) */
  flushPendingInputs() {
    for (const p of this.pendingInputs) this.sock!.send(p, "high");
    this.pendingInputs = [];
    this.attempts = 0;
    this.ui.hide();
  }

  /** 서버가 세션을 폐기한 경우 — 전체 재로그인 플로우로 전환 */
  fallbackFullLogin() {
    localStorage.removeItem("sessionToken");
    location.reload();
  }

  destroy() { this.alive = false; this.sock?.close(); }
}`,
      },
      {
        lang: "서버 측 세션 유지 개념 (uWebSockets.js 핸들러 발췌)",
        code: `// server/ws/session.ts (개념 발췌)
import uWS from "uWebSockets.js";

interface LiveSession {
  userId: number; token: string; lastAckSeq: number;
  roomId: string; dirtyAt: number;
}
const sessions = new Map<string, LiveSession>();   // token → session
const GRACE_MS = 20_000;                            // 끊김 유예 20초

uWS.App().ws("/*", {
  open(ws) { /* 인증 후 세션 생성 */ },
  message(ws, msg, isBinary) {
    const s = sessions.get(wsToken(ws));
    if (s) s.dirtyAt = Date.now();
    // ... 패킷 처리: seq <= s.lastAckSeq 인 입력은 중복 폐기
  },
  close(ws) {
    const s = sessions.get(wsToken(ws));
    if (s) setTimeout(() => {                 // 유예 시간 내 재접속 시 세션 보존
      if (Date.now() - s.dirtyAt > GRACE_MS) sessions.delete(s.token);
    }, GRACE_MS);
  },
}).listen(3001, (t) => console.log("ws ready", t));`,
      },
    ],
    tips: [
      "재접속 백오프에는 반드시 지터를 섞는다 — 접속자 수천 명이 동시에 끊기는 순간(서버 롤링 배포) 동시 재시도는 서버를 다시 죽인다.",
      "세션 유예(grace) 20초는 모바일 엘리베이터/지하 구간을 커버하는 실무적 값이며, 게임 성격에 따라 10~60초로 조정한다.",
      "입력 seq 기반 중복 폐기는 멱등성의 기본이며, 재화 소모 같은 비가역 연산은 seq가 아니라 서버 트랜잭션 ID로 이중 방어한다.",
      "재접속 UI는 반드시 유저가 조작을 계속할 수 있게 남겨두고, 복구가 되면 조용히 사라지게 한다 — 재시도 블로킹 화면은 이탈률을 올린다.",
    ],
  },
];
