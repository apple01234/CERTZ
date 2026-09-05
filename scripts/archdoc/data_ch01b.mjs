// 모듈 1 (006~010): 웹 & 크로스플랫폼 기술 아키텍처 — 후반부

export const items = [
  {
    id: "006",
    title: "IndexedDB 기반 정적 에셋(스프라이트, 음원) 캐싱 시스템",
    role: [
      "브라우저 HTTP 캐시는 용량 상한과 퇴거 정책이 불투명해, 수백 MB의 게임 에셋을 신뢰할 수 없다. IndexedDB는 오리진당 수백 MB~수 GB를 안정적으로 보관할 수 있어, 스프라이트·아틀라스·음원을 로컬에 저장하고 재방문 시 네트워크 없이 즉시 부팅하는 '설치형 웹 게임' 경험을 만든다. 이 모듈은 에셋을 Blob으로 저장하고 매니페스트 해시(004번)로 신선도를 판정하며, 용량 한계 도달 시 LRU(최근 사용 기준)로 퇴거시킨다.",
      "주의할 점은 저장 API가 비동기라는 것이고, Phaser 로더는 URL 기반이라는 점이다. 해법으로 Blob URL.createObjectURL을 사용해 캐시 히트 시 실제 HTTP 요청을 아예 발생시키지 않는다. 파이어폭스의 프라이빗 모드, iOS 사파리의 7일 미접속 데이터 삭제 정책 같은 예외 상황에서는 캐시가 실패해도 게임이 정상 동작하도록 폴백(네트워크 로딩)을 유지한다.",
    ],
    blocks: [
      {
        lang: "src/assets/AssetCache.ts",
        code: `export interface CacheRecord {
  key: string;       // 에셋 키
  hash: string;      // 매니페스트 해시 — 불일치 시 무효
  blob: Blob;
  usedAt: number;    // LRU 퇴거 기준
  bytes: number;
}

const DB_NAME = "sertz-assets";
const STORE = "assets";
const QUOTA_SOFT_LIMIT = 450 * 1024 * 1024;   // 450MB 소프트 리밋

export class AssetCache {
  private db: IDBDatabase | null = null;
  private memUrls = new Map<string, string>();  // key → blobURL

  async open(): Promise<boolean> {
    try {
      this.db = await new Promise((res, rej) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          req.result.createObjectStore(STORE, { keyPath: "key" });
        };
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
      return true;
    } catch {
      return false;   // 프라이빗 모드 등 — 네트워크 폴백
    }
  }

  /** 캐시 히트면 Blob URL 반환, 미스면 null */
  async lookup(key: string, hash: string): Promise<string | null> {
    if (this.memUrls.has(key)) return this.memUrls.get(key)!;
    if (!this.db) return null;

    const rec = await this.get<CacheRecord>(key);
    if (!rec || rec.hash !== hash) return null;    // 신선도 실패 → 무효

    rec.usedAt = Date.now();
    this.put(rec);                                  // LRU 갱신(비동기 fire & forget)
    const url = URL.createObjectURL(rec.blob);
    this.memUrls.set(key, url);
    return url;
  }

  /** 다운로드한 에셋을 저장(이미 있으면 스킵) */
  async store(key: string, hash: string, blob: Blob) {
    if (!this.db) return;
    await this.put({ key, hash, blob, usedAt: Date.now(), bytes: blob.size } as CacheRecord);
    await this.evictIfNeeded();
  }

  /** 소프트 리밋 초과 시 가장 오래된 에셋부터 퇴거 */
  private async evictIfNeeded() {
    let total = await this.totalBytes();
    if (total < QUOTA_SOFT_LIMIT) return;
    const tx = this.db!.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const all: CacheRecord[] = await new Promise(res => {
      const r = store.getAll(); r.onsuccess = () => res(r.result); });
    all.sort((a, b) => a.usedAt - b.usedAt);
    for (const rec of all) {
      if (total <= QUOTA_SOFT_LIMIT * 0.8) break;   // 20% 여유까지 축소
      store.delete(rec.key);
      total -= rec.bytes;
    }
  }

  private get<T>(key: string): Promise<T | null> {
    return new Promise(res => {
      const r = this.db!.transaction(STORE).objectStore(STORE).get(key);
      r.onsuccess = () => res(r.result ?? null);
      r.onerror = () => res(null);
    });
  }
  private put(rec: CacheRecord): Promise<void> {
    return new Promise(res => {
      const tx = this.db!.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(rec);
      tx.oncomplete = () => res(); tx.onerror = () => res();
    });
  }
  private totalBytes(): Promise<number> {
    return new Promise(res => {
      const r = this.db!.transaction(STORE).objectStore(STORE).getAll();
      r.onsuccess = () => res((r.result as CacheRecord[]).reduce((s, x) => s + x.bytes, 0));
      r.onerror = () => res(0);
    });
  }
}

// AssetFlow(004번)와의 결합: loader.url을 캐시 조회 결과로 교체
// const url = (await cache.lookup(e.key, e.hash)) ?? e.url;
// loader.image(e.key, url);`,
      },
    ],
    tips: [
      "Blob URL은 페이지 생명주기와 같으므로, 재부팅 시 매번 lookup으로 재생성한다 — memUrls 캐시로 중복 생성을 막는다.",
      "스토리지 용량은 navigator.storage.estimate()로 확인해 설정 UI에 표시하면 유저가 캐시를 관리할 수 있다.",
      "음원은 크기가 크므로 별도 스토어로 분리해, 이미지만 먼저 지우는 선택적 청소를 지원한다.",
      "iOS 사파리는 7일 미사용 시 IndexedDB를 지울 수 있다 — 매 접속 시 매니페스트 검증을 반드시 거쳐야 깨진 텍스처를 막는다.",
    ],
  },
  {
    id: "007",
    title: "마우스/터치 입력 디바이스 자동 감지 및 조작부 전환",
    role: [
      "PC 유저에게 터치 UI를, 모바일 유저에게 마우스 UI를 보여주는 것은 최악의 UX다. 이 모듈은 pointer: coarse/fine 미디어쿼리, 최초 입력 이벤트 타입, 최대 터치 포인트 수를 종합해 입력 디바이스를 판정하고, 가상 조이스틱·스킬 버튼(터치 세트) 또는 클릭 이동·단축키 안내(키보드 세트)를 런타임에 전환한다. 판정은 한 번으로 끝내지 않고, 하이브리드 기기(터치 노트북, 태블릿+키보드)에서는 마지막 입력 타입을 계속 추적해 조작부를 동적으로 바꾼다.",
      "입력 계층은 InputController 인터페이스 아래에 TouchController와 MouseKeyboardController를 둔 전략 패턴으로 구현한다. 씬 코드는 인터페이스만 의존하므로, 조작부 교체나 신규 디바이스(게이패드) 추가 시 게임 로직은 전혀 수정하지 않는다. Phaser의 input 이벤트를 컨트롤러가 흡수해, 게임 씬에는 '이동 의도 벡터'와 '액션 이벤트'만 표준화된 형태로 전달된다.",
    ],
    blocks: [
      {
        lang: "src/input/InputRouter.ts",
        code: `export interface MoveIntentVec { x: number; y: number; }   // -1~1
export type ActionEvent =
  | { kind: "skill"; slot: number }
  | { kind: "worldTap"; wx: number; wy: number }
  | { kind: "interact" };

export interface InputController {
  readonly name: "touch" | "kb";
  readonly moveVec: MoveIntentVec;             // 조이스틱/방향키 합산
  onAction: ((e: ActionEvent) => void) | null; // 씬이 구독
  destroy(): void;
}

export class InputRouter {
  private ctrl: InputController | null = null;
  private lastPointerType: "mouse" | "touch" | "pen" | null = null;

  constructor(private game: Phaser.Game,
              private buildTouch: () => InputController,
              private buildKB: () => InputController) {}

  /** 부팅 시 1회 초기 판정 */
  autoDetect() {
    const coarse = matchMedia("(pointer: coarse)").matches;
    const touchCapable = navigator.maxTouchPoints > 0;
    const fine = matchMedia("(any-pointer: fine)").matches;
    this.switchTo(coarse && touchCapable && !fine ? "touch" : "kb");
  }

  /** 하이브리드 기기: 마지막 입력으로 런타임 전환 */
  watchHybrid() {
    window.addEventListener("pointerdown", (e) => {
      if (e.pointerType === this.lastPointerType) return;
      this.lastPointerType = e.pointerType as any;
      if (e.pointerType === "touch") this.switchTo("touch");
      else if (e.pointerType === "mouse") this.switchTo("kb");
    }, { passive: true });
  }

  private switchTo(kind: "touch" | "kb") {
    if (this.ctrl?.name === kind) return;
    this.ctrl?.destroy();
    this.ctrl = kind === "touch" ? this.buildTouch() : this.buildKB();
    this.game.events.emit("input-mode-changed", kind);  // HUD가 조이스틱 표시 전환
  }

  get current(): InputController { return this.ctrl!; }
}`,
      },
      {
        lang: "src/input/KBController.ts — PC 조작부 예시",
        code: `import Phaser from "phaser";
import type { ActionEvent, InputController, MoveIntentVec } from "./InputRouter";

export class KBController implements InputController {
  readonly name = "kb" as const;
  readonly moveVec: MoveIntentVec = { x: 0, y: 0 };
  onAction: ((e: ActionEvent) => void) | null = null;

  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private static KEYMAP = {
    up: "W", down: "S", left: "A", right: "D",
    alt_up: "UP", alt_down: "DOWN", alt_left: "LEFT", alt_right: "RIGHT",
  };

  constructor(private scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    for (const [slot, code] of Object.entries(KBController.KEYMAP)) {
      this.keys[slot] = kb.addKey(code);
    }
    // 스킬 슬롯 1~6, 상호작용 E, Tab 타겟팅은 KeyDown 이벤트로
    kb.on("keydown", (ev: KeyboardEvent) => {
      if (ev.code.startsWith("Digit")) {
        const slot = Number(ev.code.slice(5)) - 1;
        if (slot >= 0 && slot < 6) this.onAction?.({ kind: "skill", slot });
      }
      if (ev.code === "KeyE") this.onAction?.({ kind: "interact" });
    });
    // 월드 클릭 이동: 카메라 좌표로 변환
    scene.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      const cam = scene.cameras.main;
      const wx = cam.getWorldPoint(p.x, p.y).x;
      const wy = cam.getWorldPoint(p.x, p.y).y;
      this.onAction?.({ kind: "worldTap", wx, wy });
    });
  }

  /** RenderLoop 고정 업데이트에서 호출 — 방향키 합산 벡터 */
  poll(): MoveIntentVec {
    const k = this.keys;
    let x = (k.right.isDown || k.alt_right.isDown ? 1 : 0) -
            (k.left.isDown || k.alt_left.isDown ? 1 : 0);
    let y = (k.down.isDown || k.alt_down.isDown ? 1 : 0) -
            (k.up.isDown || k.alt_up.isDown ? 1 : 0);
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }        // 대각선 정규화
    this.moveVec.x = x; this.moveVec.y = y;
    return this.moveVec;
  }

  destroy() {
    this.scene.input.keyboard?.removeAllListeners();
    this.scene.input.removeAllListeners("pointerdown");
  }
}`,
      },
    ],
    tips: [
      "초기 판정은 pointer 미디어쿼리가 1순위다 — userAgent 스니핑은 폴더블·터치 노트북 시대에 신뢰할 수 없다.",
      "하이브리드 전환 시 조이스틱 DOM을 페이드 트랜지션으로 바꾸면 유저가 인지 부담 없이 새 조작부를 받아들인다.",
      "대각선 이동 벡터는 반드시 정규화해야 키보드 대각 이동이 41% 빨라지는 버그를 막을 수 있다.",
      "게이패드 지원 확장 시 Gamepad API를 InputController 구현체로만 추가하면 씬 코드는 무수정으로 동작한다.",
    ],
  },
  {
    id: "008",
    title: "브라우저 탭 비활성화(Background Thread) 시 메모리 관리 및 동기화 일시정지",
    role: [
      "탭이 백그라운드로 가면 rAF는 정지되지만 setTimeout/setInterval은 1Hz로 스로틀되고, 서버로는 여전히 패킷이 흐른다. 이 상태를 방치하면 세 가지 문제가 생긴다. 백그라운드에서도 동기화 패킷을 계속 보내 대역폭을 낭비하고, 복귀 시 수분 분의 시뮬레이션을 한 프레임에 처리하려다 프레임 폭발이 일어나며, iOS 등에서는 오디오/타이머가 불규칙해져 상태가 어긋난다. 이 모듈은 visibilitychange와 blur/focus를 감시해 '일시정지 → 상태 스냅샷 → 동기화 최소화' 프로토콜을 수행한다.",
      "일시정지 시에는 서버에 AFK 상태 패킷을 보내 몬스터 어그로 목록에서 제외시키고, 로컬로는 오디오를 정지·텍스처를 유지하되 GPU 메모리 회수 가능한 파티클/이펙트 인스턴스를 정리한다. 복귀 시에는 서버 스냅샷 요청 한 번으로 현재 상태를 재동기화하고, 데드레코닝(012번) 보간 버퍼를 리셋해 캐릭터가 화면을 가로질러 튀는 현상을 막는다.",
    ],
    blocks: [
      {
        lang: "src/engine/BackgroundGuard.ts",
        code: `import Phaser from "phaser";

type SyncCtl = {
  sendAfk(on: boolean): void;          // 서버에 AFK 전환 통보
  requestResync(): Promise<unknown>;   // 복귀 시 전체 스냅샷 요청
};

export class BackgroundGuard {
  private hiddenAt = 0;
  private wasHidden = false;
  private detachFns: Array<() => void> = [];

  constructor(private game: Phaser.Game,
              private audio: Phaser.Sound.BaseSoundManager,
              private sync: SyncCtl,
              private onResumed: (snapshot: unknown, awayMs: number) => void) {}

  attach() {
    const onVis = () => (document.hidden ? this.pause() : this.resume());
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", () => this.pause());   // 탭 전환만으로는 hidden 미발생 브라우저 대응
    window.addEventListener("focus", () => this.resume());
    this.detachFns.push(() => {
      document.removeEventListener("visibilitychange", onVis);
    });
  }

  private pause() {
    if (this.wasHidden) return;
    this.wasHidden = true;
    this.hiddenAt = performance.now();

    this.sync.sendAfk(true);              // 어그로·전장 참여 해제
    this.audio.pauseAll();
    this.game.loop.sleep();               // rAF 루프 정지
    // GPU 부담 정리: 파티클 emitter 정지, 동적 텍스처 flush는 생략(비용 큼)
    this.game.scene.getScenes(true).forEach(s =>
      (s as any).particles?.emitters?.forEach?.((em: any) => em.stop?.()));
  }

  private async resume() {
    if (!this.wasHidden) return;
    this.wasHidden = false;
    const awayMs = performance.now() - this.hiddenAt;

    const snapshot = await this.sync.requestResync();   // 서버 현재 상태
    this.onResumed(snapshot, awayMs);     // 데드레코닝 버퍼 리셋 + 퀘스트 UI 갱신
    this.audio.resumeAll();
    this.game.loop.wake();

    // rAF 재개 직후 첫 프레임 delta 클램프는 RenderLoop(001)이 처리
    if (awayMs > 5 * 60_000) {
      // 5분 이상 이탈: 세션 유효성 재확인 (토큰 만료 대응)
      this.sync.sendAfk(false);
    }
  }

  detach() { this.detachFns.forEach(f => f()); this.detachFns = []; }
}`,
      },
    ],
    tips: [
      "visibilitychange가 blur보다 신뢰도가 높지만, OS 멀티데스크톱 전환 등에서 blur만 발생하는 케이스가 있어 둘 다 잡는다.",
      "백그라운드 중에도 서버는 유저를 계속 시뮬레이션해야 하나(피격 등), 어그로 대상에서는 빼는 것이 PVP/PVE 모두에서 공정하다.",
      "복귀 스냅샷은 '델타'가 아니라 '전체 AOI 스냅샷'으로 받는 것이 안전하다 — 이탈 구간의 델타를 재생하는 것은 비용 대비 신뢰도가 낮다.",
      "Page Lifecycle API(document.wasDiscarded, freeze/resume 이벤트)를 함께 감시하면 브라우저가 탭을 디스카드한 경우까지 감지할 수 있다.",
    ],
  },
  {
    id: "009",
    title: "미사용 스프라이트 가비지 컬렉션(GC) 및 메모리 해제 최적화",
    role: [
      "Phaser는 텍스처를 키 기반으로 캐시하며, 게임은 장기 세션에서 수십 개 구역을 오가며 수천 개의 텍스처·사운드·애니메이션을 적재한다. 이를 해제하지 않으면 WebGL 텍스처 메모리가 계속 누적되어 모바일 브라우저가 1~2시간 내에 크래시한다. 이 모듈은 구역 전환 시점에 '현재 구역에서 참조되지 않는 자원'을 매니페스트 기반으로 계산해 텍스처·오디오·동적 텍스처를 명시적으로 release 하고, 참조 카운트로 공용 자원(UI, 아이콘)을 보호한다.",
      "핵심은 두 계층의 분류다. 퍼시스턴트(UI, 폰트, 공용 이펙트)는 절대 해제하지 않고, 휘발성(구역 스프라이트, BGM)은 구역 이탈 시 전부 해제한다. 또한 중간 계층으로 세션 캐시(이번 세션에서 다시 방문 가능성 높은 구역)를 두어, 재진입 비용과 메모리 사이에서 트레이드오프를 조절한다. 해제 후에는 WebGL 텍스처가 실제로 GPU에서 내려갔는지 renderer 비용 로그로 검증하는 루틴을 포함한다.",
    ],
    blocks: [
      {
        lang: "src/assets/MemorySweeper.ts",
        code: `import Phaser from "phaser";
import type { Manifest } from "./BundleManifest";

export class MemorySweeper {
  private keepAlive = new Set<string>();     // 퍼시스턴트 키(UI/폰트/공용)
  private sessionPin = new Map<string, number>(); // key → 마지막 접근 시각

  constructor(private game: Phaser.Game, private manifest: Manifest,
              private maxPinned = 3) {}      // 세션 핀 유지 구역 수

  markPersistent(keys: string[]) { keys.forEach(k => this.keepAlive.add(k)); }

  /** 구역 진입 시 휘발성 키를 핀으로 갱신 */
  pinZone(zoneId: string) {
    const b = this.manifest.bundles[zoneId];
    b?.entries.forEach(e => this.sessionPin.set(e.key, Date.now()));
    this.trimPins();
  }

  private trimPins() {
    if (this.sessionPin.size <= this.maxPinned * 200) return;  // 대략적 상한
    const sorted = [...this.sessionPin.entries()].sort((a, b) => a[1] - b[1]);
    while (sorted.length > this.maxPinned * 200) {
      const [key] = sorted.shift()!;
      this.sessionPin.delete(key);
    }
  }

  /** 구역 이탈 시 호출 — 핀에 없는 휘발성 자원 전부 해제 */
  sweepZone(zoneId: string) {
    const tex = this.game.textures, snd = this.game.cache.audio;
    const b = this.manifest.bundles[zoneId];
    if (!b) return;

    let freed = 0;
    for (const e of b.entries) {
      if (this.keepAlive.has(e.key) || this.sessionPin.has(e.key)) continue;
      if (tex.exists(e.key)) { tex.remove(e.key); freed++; }   // GPU 텍스처 해제 포함
      if (e.type === "audio" && snd.exists(e.key)) snd.remove(e.key);
      if (e.type === "json" && this.game.cache.json.exists(e.key))
        this.game.cache.json.remove(e.key);
    }
    // 커스텀 애니메이션 정리: 전역 anims에 남은 구역 전용 프레임 제거
    this.game.anims.getAnimsFrom?.(zoneId)?.forEach?.((a: Phaser.Animations.Animation) =>
      this.game.anims.remove(a.key));
    console.log("[MemorySweeper] freed " + freed + " textures for " + zoneId);
  }

  /** 진단: 현재 텍스처 메모리 요약(개발용) */
  diagnose(): { count: number; bytes: number } {
    let bytes = 0, count = 0;
    this.game.textures.getTextureKeys().forEach(k => {
      const t = this.game.textures.get(k);
      if (!t || k === "__DEFAULT") return;
      count++;
      for (let i = 0; i < t.source.length; i++) {
        const s = t.source[i].image as HTMLImageElement | undefined;
        if (s?.width) bytes += s.width * s.height * 4;   // RGBA 가정
      }
    });
    return { count, bytes };
  }
}`,
      },
    ],
    tips: [
      "textures.remove(key)는 WebGL 텍스처까지 해제하지만, 씬 오브젝트가 참조 중이면 화이트 프레임이 된다 — 반드시 매니페스트 기반으로 '해당 구역 전용'만 지운다.",
      "atlas 한 장을 지우면 그 아틀라스의 모든 프레임이 사라진다 — 서로 다른 구역이 한 아틀라스를 공유하면 안 된다.",
      "Audio는 decodeAudioData 결과(AudioBuffer)가 가장 크다 — BGM은 구역 이탈 시 즉시 stop+remove가 유효하다.",
      "장기 세션 테스트는 30분마다 diagnose() 로그를 남겨 그래프 추이로 누수를 조기 발견하는 것이 표준이다.",
    ],
  },
  {
    id: "010",
    title: "WebAssembly(WASM) 연동을 위한 인터페이스 구조",
    role: [
      "A* 길찾기(1000x1000 그리드), 대규모 충돌 판정, 데미지 시뮬레이션 같은 CPU 집약 연산은 JS로 구현하면 GC 압박과 JIT 한계로 프레임 드랍이 발생한다. WASM으로 이런 연산을 이식하면 3~10배의 속도 향상을 얻지만, 모듈 로딩·메모리 관리·JS 경계 비용이라는 새로운 관리 지점이 생긴다. 이 모듈은 WASM 모듈을 동일한 인터페이스(JS 구현체와 교체 가능)로 감싸는 어댑터 계층을 제공한다 — WASM이 준비되기 전에는 JS 폴백으로 즉시 게임이 동작하고, 로딩 완료 시 런타임에 구현체를 교체(핫스왑)한다.",
      "메모리 모델은 WASM 선형 메모리를 소유자(WASM 모듈)로 두고, JS는 오프셋 핸들만 받아 다루는 단방향 소유 구조를 채택한다. 이는 구조화된 복사 비용을 없애고, WASM 내부에서 사용 후 폐기하는 대규모 임시 배열(오픈리스트 등)이 JS GC에 부하를 주지 않게 한다. 인터페이스는 init/resize/dispose 라이프사이클을 명시해 다중 씬에서 안전하게 재사용한다.",
    ],
    blocks: [
      {
        lang: "src/wasm/PathFinder.ts — 인터페이스 + JS 폴백 + WASM 어댑터",
        code: `// ── 공용 인터페이스: WASM과 JS 구현체가 모두 만족 ──
export interface IPathFinder {
  readonly backend: "wasm" | "js";
  setGrid(w: number, h: number, blocked: Uint8Array): void;
  find(sx: number, sy: number, tx: number, ty: number): Int32Array; // [x0,y0,x1,y1,...]
  dispose(): void;
}

// ── JS 폴백(간단화: 실제로는 A* 전체 구현) ──
export class JSPathFinder implements IPathFinder {
  readonly backend = "js" as const;
  private w = 0; private h = 0; private blocked!: Uint8Array;
  setGrid(w: number, h: number, blocked: Uint8Array) {
    this.w = w; this.h = h; this.blocked = blocked;
  }
  find(sx: number, sy: number, tx: number, ty: number): Int32Array {
    // 데모: 직선 경로(실제 구현은 A* — 043번 참조)
    return new Int32Array([sx, sy, tx, ty]);
  }
  dispose() {}
}

// ── WASM 어댑터: 로딩 후 핫스왑 ──
export class WasmPathFinder implements IPathFinder {
  readonly backend = "wasm" as const;
  private exports: any = null;       // wasm 인스턴스 exports
  private gridPtr = 0; private outPtr = 0; private outLen = 0;

  static async load(url: string): Promise<WasmPathFinder> {
    const self = new WasmPathFinder();
    // Rust/AssemblyScript로 빌드된 모듈 가정: alloc/setGrid/find/free export
    const { instance } = await WebAssembly.instantiateStreaming(fetch(url), {
      env: { abort: () => { throw new Error("wasm abort"); } },
    });
    self.exports = instance.exports;
    self.outPtr = self.exports.alloc(4096);      // 결과 버퍼 재사용
    return self;
  }

  setGrid(w: number, h: number, blocked: Uint8Array) {
    if (this.gridPtr) this.exports.free(this.gridPtr);
    this.gridPtr = this.exports.alloc(blocked.length);
    new Uint8Array(this.exports.memory.buffer,
                   this.gridPtr, blocked.length).set(blocked);
    this.exports.setGrid(this.gridPtr, w, h);
  }

  find(sx: number, sy: number, tx: number, ty: number): Int32Array {
    const n = this.exports.find(sx, sy, tx, ty, this.outPtr);  // 길이 반환
    // 복사는 결과 경로만 — 대규모 중간 배열은 WASM 내부에 존재
    return new Int32Array(this.exports.memory.buffer, this.outPtr, n * 2).slice();
  }

  dispose() {
    if (this.gridPtr) this.exports.free(this.gridPtr);
    if (this.outPtr) this.exports.free(this.outPtr);
    this.exports = null;
  }
}

// ── 매니저: 폴백으로 시작 → WASM 준비되면 교체 ──
export class PathFinderProvider {
  private impl: IPathFinder = new JSPathFinder();
  async upgradeToWasm(url: string) {
    try {
      const wasm = await WasmPathFinder.load(url);
      wasm.setGrid(this.gridW, this.gridH, this.grid!);
      this.impl.dispose();
      this.impl = wasm;                 // 이후 호출은 전부 WASM 경유
    } catch (e) { console.warn("WASM upgrade failed, keep JS", e); }
  }
  private gridW = 0; private gridH = 0; private grid: Uint8Array | null = null;
  setGrid(w: number, h: number, blocked: Uint8Array) {
    this.gridW = w; this.gridH = h; this.grid = blocked;
    this.impl.setGrid(w, h, blocked);
  }
  find(sx: number, sy: number, tx: number, ty: number) {
    return this.impl.find(sx, sy, tx, ty);
  }
}`,
      },
    ],
    tips: [
      "JS↔WASM 경계 통과는 호출당 수백 ns 비용이다 — 프레임당 수만 회 호출되는 소형 연산보다 큰 덩어리 연산을 이식해야 이득이다.",
      "WASM 선형 메모리는 GC 대상이 아니므로 alloc/free 규율이 필수다 — 포인터 소유자를 명확히 두지 않으면 이중 free로 즉시 크래시된다.",
      "memory.buffer는 grow 시 교체된다 — Uint8Array 뷰를 캐싱하지 말고 매 접근 시 새로 만든다.",
      "폴백 우선 부팅은 코어 웹 바이탈(LCP)을 지키면서 점진적으로 성능을 올리는 표준 전략이다.",
    ],
  },
];
