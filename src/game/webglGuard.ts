/**
 * webglGuard.ts — Phaser 모듈 로드 전에 설치하는 WebGL 프로브 가드 (vc190)
 *
 * ── 문제 (실측 diag-ctxloss5, 스택 트레이스로 확정) ──
 *   1389ms  webgl   1x1  ok=true   @ phaser testWebGL → init → __webpack_require__
 *   1729ms  webgl2  1x1  ok=false  @ desiredRenderer
 *   1902ms  webgl   1x1  ok=false  @ desiredRenderer
 *   2790ms  *** LOST *** 1x1
 *
 *   Phaser 4.2.1 은 **모듈이 로드되는 순간**(`import Phaser from "phaser"` 평가 시점)
 *   `testWebGL()` 로 1x1 캔버스에 WebGL 컨텍스트를 만들고 **반납하지 않는다**.
 *   SwiftShader 같은 소프트웨어 GL 백엔드에서는 이 잔존 컨텍스트가 살아 있는 채로
 *   진짜 렌더러가 두 번째 컨텍스트를 요청하면 첫 번째가 강제로 죽고,
 *   chromium 은 페이지를 "Web page caused context loss and was blocked" 로 차단한다.
 *   그 뒤로는 어떤 WebGL 요청도 실패해 Canvas 로 폴백한다.
 *
 *   → 게임 렌더러가 컨텍스트를 얻는 시점엔 이미 늦다. 프로브가 만들어지는 **그 순간**
 *     반납해야 한다. 그래서 Phaser import 보다 먼저 이 모듈을 import 한다
 *     (ESM import 는 선언 순서대로 평가된다).
 *
 * ── 동작 ──
 *   getContext 를 감싸서 **1x1 이하 + DOM 밖** 캔버스의 WebGL 컨텍스트는
 *   돌려주기 직전에 `WEBGL_lose_context.loseContext()` 로 반납한다.
 *   프로브는 `!!gl` 만 확인하므로 지원 판정 결과는 그대로 유지된다.
 *   진짜 렌더러의 캔버스(960x540, DOM 안)는 건드리지 않는다.
 *
 * ── 안전성 ──
 *   · 이미 패치했으면 재패치하지 않는다(중복 import·HMR 대비).
 *   · 지원 판정값은 바꾸지 않는다 — 반납은 컨텍스트를 얻은 **뒤**에 한다.
 *   · 실패는 전부 조용히 무시한다(가드 때문에 게임이 죽으면 안 된다).
 */

const PROBE_MAX_SIDE = 1;

interface GuardedWindow {
  __sertzWebglGuard?: boolean;
}

export function installWebglGuard(): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as GuardedWindow;
  if (w.__sertzWebglGuard) return; // 이미 설치됨
  w.__sertzWebglGuard = true;

  const proto = HTMLCanvasElement.prototype;
  const orig = proto.getContext;

  proto.getContext = function patchedGetContext(
    this: HTMLCanvasElement,
    type: string,
    ...rest: unknown[]
  ) {
    const ctx = (orig as unknown as (t: string, ...a: unknown[]) => unknown).call(this, type, ...rest);
    try {
      const isGL = typeof type === "string" && /webgl/i.test(type);
      const tiny = this.width <= PROBE_MAX_SIDE && this.height <= PROBE_MAX_SIDE;
      const detached = !this.isConnected;
      /* 프로브(작은 캔버스, DOM 밖)만 반납 대상 — 실제 렌더러 캔버스는 그대로 */
      if (ctx && isGL && tiny && detached) {
        const gl = ctx as WebGLRenderingContext;
        /* 즉시 반납하지 않는다 — 같은 tick 에 반납하면 chromium 이 그 호출을
         * "페이지가 컨텍스트를 죽였다"로 판정해 이후 모든 WebGL 을 차단한다
         * (실측 statusMessage: "Web page caused context loss and was blocked").
         * 다음 tick 으로 미루면 Phaser 의 지원 판정(!!gl)은 이미 끝난 뒤이고,
         * 프로브 컨텍스트도 진짜 렌더러 생성 전에 정리된다. */
        setTimeout(() => {
          try {
            gl.getExtension("WEBGL_lose_context")?.loseContext();
          } catch { /* 무시 */ }
        }, 0);
      }
    } catch {
      /* 반납 실패 무시 — 게임 진행이 우선 */
    }
    return ctx;
  } as typeof proto.getContext;
}

/* import 즉시 설치 — Phaser 가 모듈 로드 시점에 프로브를 만들기 때문에
 *  함수 호출을 기다릴 수 없다. */
installWebglGuard();
