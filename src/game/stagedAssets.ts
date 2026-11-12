import type Phaser from "phaser";
import { DEFERRED_BODY_PREFIXES, ALL_ITEM_ICONS } from "./data";
import type { SaveData } from "./config";
import { rememberTexture } from "./texGuard";
import { assetUrl, TITLE_ASSETS, type AssetDefinition } from "./assetSelection";

export type LoadProgress = { phase: string; elapsedMs: number; total: number; complete: number; active: number; failed: string[]; error?: string };
const PHASE_LIMIT_MS = 30000;
// 동시 24개가 대역폭을 나눠 쓰므로 큰 파일(최대 6.7MB) 하나의 제한도 넉넉히 둔다. 멈춤 감지는 PHASE_LIMIT_MS 가 맡는다.
const FILE_LIMIT_MS = 20000;
const FRAME_NAMES = ["idle0", "idle1", "idle2", "idle3", "walk0", "walk1", "walk2", "walk3", "walkside0", "walkside1", "walkside2", "walkside3", "walkup0", "walkup1", "walkup2", "walkup3", "atk0", "atk1", "atk2", "atk3", "atkdown0", "atkdown1", "atkdown2", "atkdown3", "atkup0", "atkup1", "atkup2", "atkup3"];
const managers = new WeakMap<Phaser.Game, AssetManager>();

let lastProgress: LoadProgress | undefined;
let lastEmit = 0;
let retryAction: (() => void) | undefined;
export function retryLoading() { retryAction?.(); }
export function getLoadingProgress() { return lastProgress; }
const history: LoadProgress[] = [];
function publish(progress: LoadProgress) {
  const changed = progress.phase !== lastProgress?.phase || !!progress.error;
  if (changed) { history.push({ ...progress, failed: [...progress.failed] }); if (history.length > 20) history.shift(); }
  lastProgress = progress;
  (window as unknown as { __SERTZ_LOAD_HISTORY__?: LoadProgress[] }).__SERTZ_LOAD_HISTORY__ = history;
  if (!changed && performance.now() - lastEmit < 100 && progress.complete !== progress.total) return;
  lastEmit = performance.now();
  (window as unknown as { __SERTZ_LOAD__?: LoadProgress }).__SERTZ_LOAD__ = progress;
  window.dispatchEvent(new CustomEvent("sertz:loading", { detail: progress }));
}

/** Record the existing registrations without creating thousands of queued Phaser Files. */
export function captureAssetCatalog(scene: Phaser.Scene, register: () => void): AssetDefinition[] {
  const original = scene.load;
  const definitions: AssetDefinition[] = [];
  let path = "";
  const recorder = new Proxy(original, {
    get(target, property) {
      if (property === "setPath") return (value = "") => { path = value && !value.endsWith("/") ? value + "/" : value; return recorder; };
      if (["image", "spritesheet", "atlas", "audio", "json"].includes(String(property))) {
        return (key: string, source: string | string[], extra?: string | Record<string, unknown>) => {
          const urls = (Array.isArray(source) ? source : [source]).map(url => assetUrl(path, url));
          if (property === "atlas" && typeof extra === "string") urls.push(assetUrl(path, extra));
          definitions.push({ type: property as AssetDefinition["type"], key, urls, ...(typeof extra === "object" ? { config: extra } : {}) });
          return recorder;
        };
      }
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  scene.load = recorder;
  try { register(); } finally { scene.load = original; }
  const registered = new Set(definitions.map(def => def.key));
  for (const prefix of DEFERRED_BODY_PREFIXES) for (const frame of FRAME_NAMES) definitions.push({ type: "image", key: `${prefix}_${frame}`, urls: [`assets/${prefix}_${frame}.webp`] });
  for (const key of ALL_ITEM_ICONS) if (key && !registered.has(key)) definitions.push({ type: "image", key, urls: [`assets/${key}.webp`], backgroundOnly: true });
  // A key has one authoritative definition, as in the original texture cache.
  return [...new Map(definitions.map(def => [def.key, def])).values()];
}

function image(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const finish = (error?: Error) => {
      clearTimeout(timer); img.onload = null; img.onerror = null;
      if (error) { img.src = ""; reject(error); } else resolve(img);
    };
    const timer = window.setTimeout(() => finish(new Error("image timeout")), FILE_LIMIT_MS);
    img.onload = () => finish(); img.onerror = () => finish(new Error("image unavailable"));
    img.src = url;
  });
}

async function json(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(FILE_LIMIT_MS) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

type Job = { def: AssetDefinition; scene: Phaser.Scene; priority: boolean; resolve: () => void; reject: (error: Error) => void; promise: Promise<void> };
class AssetManager {
  static readonly MAX_PARALLEL = 24;
  readonly definitions: Map<string, AssetDefinition>;
  private jobs = new Map<string, Job>();
  private metadata = new Map<string, ReturnType<typeof json>>();
  private queue: Job[] = [];
  private active = 0;
  private disposed = false;
  private phase = 0;
  constructor(private game: Phaser.Game, definitions: AssetDefinition[], private register: (scene: Phaser.Scene) => void) {
    this.definitions = new Map(definitions.map(def => [def.key, def]));
    game.events.once("destroy", () => { this.disposed = true; retryAction = undefined; });
  }
  private exists(def: AssetDefinition) {
    return def.type === "audio" ? this.game.cache.audio.exists(def.key) : def.type === "json" ? this.game.cache.json.exists(def.key) : this.game.textures.exists(def.key);
  }
  private metadataFor(url: string) {
    let pending = this.metadata.get(url);
    if (!pending) {
      pending = json(url).catch(error => { this.metadata.delete(url); throw error; });
      this.metadata.set(url, pending);
    }
    return pending;
  }
  private async fetch(def: AssetDefinition) {
    if (this.exists(def)) return;
    if (def.type === "json") { const data = await this.metadataFor(def.urls[0]); if (!this.disposed) this.game.cache.json.add(def.key, data); return; }
    if (def.type === "audio") {
      const context = (this.game.sound as Phaser.Sound.WebAudioSoundManager).context;
      if (!context) return;
      const response = await fetch(def.urls[0], { signal: AbortSignal.timeout(FILE_LIMIT_MS) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.arrayBuffer();
      let timer: number | undefined;
      try {
        const decoded = await Promise.race([context.decodeAudioData(data), new Promise<never>((_, reject) => { timer = window.setTimeout(() => reject(new Error("audio timeout")), FILE_LIMIT_MS); })]);
        if (!this.disposed && !this.exists(def)) this.game.cache.audio.add(def.key, decoded);
      } finally { clearTimeout(timer); }
      return;
    }
    const [img, atlas] = await Promise.all([image(def.urls[0]), def.type === "atlas" ? this.metadataFor(def.urls[1]) : Promise.resolve(null)]);
    if (this.disposed) throw new Error("game destroyed");
    if (this.exists(def)) return;
    if (def.type === "atlas") this.game.textures.addAtlas(def.key, img, atlas);
    else if (def.type === "spritesheet") this.game.textures.addSpriteSheet(def.key, img, def.config as unknown as Phaser.Types.Textures.SpriteSheetConfig);
    else this.game.textures.addImage(def.key, img);
    if (!this.exists(def)) throw new Error(`texture registration failed: ${def.key}`);
    if (def.type !== "atlas") rememberTexture(def.key, { url: def.urls[0], type: def.type, ...(def.config ? { fw: Number(def.config.frameWidth), fh: Number(def.config.frameHeight) } : {}) });
  }
  private pump() {
    // Native Image/TextureManager is already used by loadBodyPrefix. This avoids
    // Phaser4's documented re-entrant queue stall while bounding network pressure.
    // vc279(2.2.23): 6 → 24. 운영(HTTP/2)은 파일당 지연이 지배적이라 6개 동시로는 3,675개에
    // 약 92초가 걸렸다(평가 실측). 같은 80개 실측: 6개 2.4초 / 16개 0.8초 / 32개 0.5초.
    // ponytail: 더 줄이려면 현재 맵 필수분만 기다리고 나머지는 뒤에서 받는 분할 로딩.
    while (!this.disposed && this.active < AssetManager.MAX_PARALLEL && this.queue.length) {
      const index = this.queue.findIndex(job => job.priority);
      const job = this.queue.splice(index < 0 ? 0 : index, 1)[0]; this.active++;
      void (async () => {
        let failure: Error | undefined;
        for (let attempt = 0; attempt < 2; attempt++) {
          try { await this.fetch(job.def); failure = undefined; break; }
          catch (error) { failure = error instanceof Error ? error : new Error(String(error)); }
        }
        if (failure) { this.jobs.delete(job.def.key); job.reject(failure); }
        else job.resolve();
      })().finally(() => { this.active--; this.pump(); });
    }
  }
  private request(def: AssetDefinition, scene: Phaser.Scene, priority: boolean): Promise<void> {
    if (this.exists(def)) return Promise.resolve();
    const existing = this.jobs.get(def.key);
    if (existing) { if (priority) existing.priority = true; return existing.promise; }
    let resolve!: () => void, reject!: (error: Error) => void;
    const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
    const job = { def, scene, priority, promise, resolve, reject };
    this.jobs.set(def.key, job); this.queue.push(job); this.pump(); return promise;
  }
  async ensure(scene: Phaser.Scene, keys: string[], phase: string) {
    const generation = ++this.phase, started = performance.now();
    const uniqueKeys = [...new Set(keys)];
    const definitions = uniqueKeys.map(key => this.definitions.get(key)).filter((def): def is AssetDefinition => !!def);
    let complete = 0, cancelled = false, settled = false;
    const failed = uniqueKeys.filter(key => !this.definitions.has(key));
    retryAction = undefined;
    const emit = (error?: string) => { if (this.phase === generation && !cancelled && !settled) publish({ phase, elapsedMs: Math.round(performance.now() - started), total: definitions.length, complete, active: this.active, failed, ...(error ? { error } : {}) }); };
    let rejectCancelled!: (error: Error) => void;
    const cancellation = new Promise<never>((_, reject) => { rejectCancelled = reject; });
    const onShutdown = () => { cancelled = true; rejectCancelled(new DOMException("Scene closed", "AbortError")); };
    scene.events.once("shutdown", onShutdown); scene.events.once("destroy", onShutdown);
    let timer: number | undefined;
    let rejectDeadline!: (error: Error) => void;
    const deadline = new Promise<never>((_, reject) => { rejectDeadline = reject; });
    // A full catalog can exceed 30s on mobile; only a stalled load times out.
    const advanceDeadline = () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => rejectDeadline(new Error("loading deadline")), PHASE_LIMIT_MS);
    };
    advanceDeadline();
    emit();
    try {
      if (failed.length) throw new Error(`asset definitions missing: ${failed.join(", ")}`);
      await Promise.race([
        Promise.all(definitions.map(async def => { try { await this.request(def, scene, true); complete++; if (!settled && !cancelled) advanceDeadline(); emit(); } catch (error) { failed.push(def.key); throw error; } })),
        deadline, cancellation,
      ]);
      if (cancelled || this.disposed) throw new DOMException("Scene closed", "AbortError");
      this.register(scene); emit();
    } catch (error) {
      if (!cancelled) {
        retryAction = () => {
          retryAction = undefined;
          if (!this.disposed && scene.sys.isActive()) scene.scene.restart(scene.registry.get("initData"));
        };
        emit("자료를 불러오지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.");
      }
      throw error;
    } finally { settled = true; clearTimeout(timer); scene.events.off("shutdown", onShutdown); scene.events.off("destroy", onShutdown); }
  }
}

export function installAssetCatalog(scene: Phaser.Scene, definitions: AssetDefinition[], register: (scene: Phaser.Scene) => void) {
  // Scene retries share completed textures and in-flight requests.
  if (!managers.has(scene.game)) managers.set(scene.game, new AssetManager(scene.game, definitions, register));
}
export async function ensureTitleAssets(scene: Phaser.Scene) {
  await managers.get(scene.game)!.ensure(scene, [...TITLE_ASSETS], "title-assets");
  publish({ ...lastProgress!, phase: "title-ready" });
}

export async function ensureWorldAssets(scene: Phaser.Scene, _data: { stage?: string; save?: SaveData; gmBoss?: string; replayBoss?: string }) {
  const manager = managers.get(scene.game);
  if (!manager) throw new Error("Asset catalog not installed");
  // Preserve the original game queue, but finish it before gameplay starts.
  // Music outside this catalog keeps audio.ts's bounded PCM cache.
  await manager.ensure(scene, [...manager.definitions.keys()], "game-assets");
  publish({ ...lastProgress!, phase: "world-assets-ready" });
}

export function markWorldReady(started: number) {
  publish({ ...lastProgress!, phase: "world-ready", elapsedMs: Math.round(performance.now() - started) });
}
export function reportLoadingFailure() {
  retryAction ??= () => window.location.reload();
  publish({ ...(lastProgress ?? { phase: "engine", elapsedMs: 0, total: 0, complete: 0, active: 0, failed: [] }),
    error: "게임을 불러오지 못했습니다. 다시 시도해 주세요." });
}
