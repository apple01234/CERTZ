/* v1.4.2 (#스프라이트로딩) — 텍스처 무결성 감시·수복 체계.
 *
 * v1.4.1 재시도 체계의 사각지대를 메는 2차 방어선:
 *  ① 재시도 3회 한도 초과 파일은 그 세션에서 영구 누락됐다 → 부트/월드 진입 시점에
 *     "기대 텍스처 전수"와 "실제 등록 상태"를 대조해 누락분을 스스로 재로드한다.
 *  ② Android WebView는 백그라운드 복귀/메모리 압박 시 이미지 소스를 회수할 수 있다
 *     (loaderror 없음 — 재시도 체계가 못 잡음) → 복귀 시점·주기 샘플링으로 재검증한다.
 *  ③ WebGL 컨텍스트 복구 직후 텍스처 재업로드 실패분을 재검증한다.
 *
 * 동작 원리:
 *  - hookLoaderForGuard(): 로더에 filecomplete/loaderror 훅을 1회 설치해
 *    기대 텍스처 키·완성 URL·시트 치수를 전역 레지스트리에 수집한다.
 *  - auditTextures(): 키별로 ①텍스처 존재 ②소스 이미지 complete ③naturalWidth>0 검사.
 *  - repairTextures(): 누락 텍스처를 remove→재로드(치수 보존)→완료 후 씬 오브제 재결합.
 *  - installWorldTexGuard(): 월드에서 복귀/컨텍스트복구/주기 샘플링 훅 설치.
 */

import Phaser from "phaser"; // v1.4.3 — installEngineFrameGuard 런타임 참조 (타입 전용 아님)

export type TexRec = { url: string; type: "image" | "spritesheet"; fw?: number; fh?: number };

/** 기대 텍스처 레지스트리 — 부트+지연로드 filecomplete/loaderror 합집합 */
const REGISTRY = new Map<string, TexRec>();

/** 훅 설치된 로더 (중복 설치 방지) */
const HOOKED = new WeakSet<object>();

/** 디버그/검증용 통계 노출 */
export function getTexGuardStats() {
  return {
    expected: REGISTRY.size,
  };
}

/* v1.4.3 — 엔진 프레임 가드:
 *  수복 체계가 텍스처를 remove→재로드하는 비동기 창 사이에 오브제(특히 Text 재굽 setText→
 *  updateText→Frame.setSize→updateUVs)가 파괴된 프레임(data=null)을 만지면
 *  "Cannot read properties of null (reading 'drawImage')"로 렌더 루프가 죽는다.
 *  (실측: Frame.updateUVs 첫 줄 var cd = this.data.drawImage — destroy()가 data를 null로)
 *  파괴된 프레임 접근을 no-op으로 무해화한다 — 수복 완료 후 새 프레임으로 정상 복귀된다. */
export function installEngineFrameGuard(): void {
  const F = (Phaser.Textures as unknown as { Frame?: { prototype: Record<string, (...a: unknown[]) => unknown> } }).Frame;
  if (!F?.prototype) return;
  for (const m of ["updateUVs", "setCutPosition", "setCutSize", "setSize", "updateData"] as const) {
    const orig = F.prototype[m];
    if (typeof orig !== "function") continue;
    F.prototype[m] = function (this: { data?: unknown } & Record<string, unknown>, ...a: unknown[]) {
      if (this.data === null || this.data === undefined) return this;
      return orig.apply(this, a);
    };
  }
}

/** 로더에 수집 훅 설치 (BootScene/TitleScene 각각 1회) */
export function hookLoaderForGuard(
  loader: Phaser.Loader.LoaderPlugin,
  textures: Phaser.Textures.TextureManager,
): void {
  const l = loader as unknown as { __texGuardHooked?: boolean };
  if (l.__texGuardHooked || HOOKED.has(loader)) return;
  HOOKED.add(loader);
  l.__texGuardHooked = true;

  loader.on(
    "filecomplete",
    (key: string, type: string, data: unknown) => {
      if (type !== "image" && type !== "spritesheet") return;
      const src =
        typeof (data as { src?: unknown })?.src === "string"
          ? (data as { src: string }).src
          : typeof (data as { currentSrc?: unknown })?.currentSrc === "string"
            ? (data as { currentSrc: string }).currentSrc
            : "";
      if (type === "spritesheet") {
        /* 시트 치수는 로드 직후 실물 텍스처에서 추출 — 재로드 시 치수 보존 보장 */
        try {
          const t = textures.get(key);
          const f0 = t?.get(0);
          if (t && f0) REGISTRY.set(key, { url: src, type, fw: f0.width, fh: f0.height });
        } catch {
          REGISTRY.set(key, { url: src, type });
        }
      } else {
        REGISTRY.set(key, { url: src, type });
      }
    },
  );

  loader.on("loaderror", (file: { key?: string; url?: string }) => {
    const key = file?.key ?? "";
    if (!key || REGISTRY.has(key)) return;
    /* 실패 파일도 기대 키로 등록 — 감사가 누락을 잡을 수 있게.
     * 타입 판별 불가 → 감사 결과가 "미등록"이면 이미지로 재로드 시도.
     * 스프라이트시트는 치수를 모르면 재로드해도 프레임이 깨지므로,
     * 치수 미상 실패 키는 재시도 체계(v1.4.1)가 치수 보존 재요청을 담당한다. */
    REGISTRY.set(key, { url: String(file?.url ?? ""), type: "image" });
  });
}

/** 오브제 재결합 대상 키 재지정 — 제거된 텍스처를 다시 쓰는 GameObjects 복구 */
function rebindChildren(scene: Phaser.Scene, keys: Set<string>): number {
  let n = 0;
  try {
    for (const ch of scene.children.list) {
      const anyCh = ch as unknown as { texture?: { key: string }; frame?: { name: string }; setTexture?: (k: string, f?: string) => unknown };
      const tk = anyCh?.texture?.key;
      if (tk && keys.has(tk) && typeof anyCh.setTexture === "function") {
        try {
          anyCh.setTexture(tk, anyCh.frame?.name);
          n++;
        } catch {
          /* 재결합 실패 개별 무시 */
        }
      }
    }
  } catch {
    /* 씬 상태 이상 — 전체 무시 */
  }
  return n;
}

/** 감사 — 손상/누락 키 배열 반환. sampleN>0이면 무작위 표본 검사. */
export function auditTextures(scene: Phaser.Scene, sampleN = 0): string[] {
  const bad: string[] = [];
  const tm = scene.textures;
  const check = (k: string) => {
    if (!tm.exists(k)) {
      bad.push(k);
      return;
    }
    try {
      const src = tm.get(k)?.source?.[0];
      const img = src?.image as HTMLImageElement | HTMLCanvasElement | undefined;
      if (img instanceof HTMLImageElement) {
        /* 캔버스 백업 소스가 아닌 이미지 소스만 검사 — complete/naturalWidth로
         * WebView의 이미지 회수(eviction)·부분 실패를 탐지한다 */
        if (!img.complete || img.naturalWidth === 0) bad.push(k);
      }
    } catch {
      bad.push(k);
    }
  };
  if (sampleN > 0 && REGISTRY.size > sampleN) {
    const all = Array.from(REGISTRY.keys());
    for (let i = 0; i < sampleN; i++) check(all[(Math.random() * all.length) | 0]);
  } else {
    for (const k of REGISTRY.keys()) check(k);
  }
  return bad;
}

/** 수복 — 누락/손상 텍스처를 remove→재로드→오브제 재결합. 수복 성공 수 반환. */
export async function repairTextures(scene: Phaser.Scene, keys: string[]): Promise<number> {
  if (keys.length === 0) return 0;
  const loader = scene.load;
  const tm = scene.textures;
  let queued = 0;
  for (const k of keys) {
    const rec = REGISTRY.get(k);
    if (!rec || !rec.url) continue;
    try {
      if (tm.exists(k)) tm.remove(k);
      if (rec.type === "spritesheet" && rec.fw && rec.fh) {
        loader.spritesheet(k, rec.url, { frameWidth: rec.fw, frameHeight: rec.fh });
      } else {
        loader.image(k, rec.url);
      }
      queued++;
    } catch {
      /* 큐잉 실패 개별 무시 */
    }
  }
  if (queued === 0) return 0;
  await new Promise<void>((resolve) => {
    loader.once("complete", () => resolve());
    try {
      loader.start();
    } catch {
      resolve();
    }
  });
  const fixed = rebindChildren(scene, new Set(keys));
  if (fixed > 0) console.log(`[SERTZ] 텍스처 수복 — 재결합 오브제 ${fixed}개`);
  return queued;
}

/** 감사+수복 1사이클. 수복한 키 수 반환 (0이면 전 정상). */
export async function runTexGuardCycle(scene: Phaser.Scene, label: string, sampleN = 0): Promise<number> {
  const t0 = Date.now();
  const bad = auditTextures(scene, sampleN);
  if (bad.length === 0) return 0;
  console.warn(`[SERTZ] 텍스처 감사(${label}) — 누락/손상 ${bad.length}건 감지, 수복 시작`);
  const n = await repairTextures(scene, bad);
  console.log(`[SERTZ] 텍스처 수복(${label}) — ${n}건 재로드 완료 (${Date.now() - t0}ms)`);
  return n;
}

/** 월드 상주 감시 설치 — 복귀 재검증 + 컨텍스트 복구 재검증 + 주기 표본 감사. */
export function installWorldTexGuard(scene: Phaser.Scene): void {
  const g = scene.game;

  /* 백그라운드 복귀 — WebView가 숨은 동안 이미지를 회수했을 수 있다. 1.5초 유예 후 전수 감사. */
  const onVis = () => {
    if (document.hidden) return;
    window.setTimeout(() => {
      if (!scene.scene.isActive()) return;
      void runTexGuardCycle(scene, "복귀");
    }, 1500);
  };
  document.addEventListener("visibilitychange", onVis);

  /* WebGL 컨텍스트 복구 — Phaser가 재업로드를 시도하지만 실패분이 남을 수 있다. */
  const canvas = g.canvas;
  const onRestored = () => {
    window.setTimeout(() => {
      if (!scene.scene.isActive()) return;
      void runTexGuardCycle(scene, "컨텍스트복구");
    }, 1200);
  };
  canvas.addEventListener("webglcontextrestored", onRestored);

  /* 주기 표본 감사 — 9초마다 48키 표본. 수복이 필요하면 전수로 확장해 처리. */
  scene.time.addEvent({
    delay: 9000,
    loop: true,
    callback: () => {
      if (document.hidden) return;
      const bad = auditTextures(scene, 48);
      if (bad.length > 0) void repairTextures(scene, bad);
    },
  });

  /* 씬 종료 시 정리 */
  scene.events.once("shutdown", () => {
    document.removeEventListener("visibilitychange", onVis);
    canvas.removeEventListener("webglcontextrestored", onRestored);
  });
}
