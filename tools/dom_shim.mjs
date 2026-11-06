/**
 * dom_shim.mjs — Phaser 를 Node 에서 import 하기 위한 최소 DOM 셰임
 *
 * Panels.tsx 는 @/game/textures (BOSS_ATLAS) 를 import 하고 그 파일이 Phaser 를
 * import 한다. Phaser 모듈 초기화가 window/document 를 건드려 Node 에서 즉시 죽는다.
 * 서버사이드 마크업 검증에는 실제 렌더링이 필요 없으므로 **껍데기만** 제공한다.
 */
const noop = () => {};
/** Phaser 는 부팅 시 canvas 2d 컨텍스트에 fillStyle 등을 설정한다.
 *  실제 렌더는 하지 않으므로 **모든 속성을 받아주는 프록시**를 돌려준다. */
const fakeCtx = () => new Proxy(
  {
    canvas: { width: 1, height: 1 },
    fillStyle: "#000", strokeStyle: "#000", globalAlpha: 1, font: "10px sans-serif",
    measureText: () => ({ width: 0 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    createImageData: () => ({ data: new Uint8ClampedArray(4) }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createPattern: () => ({}),
    getContextAttributes: () => ({ alpha: true }),
  },
  {
    get(t, k) {
      if (k in t) return t[k];
      return noop; // 알 수 없는 메서드는 무해한 noop
    },
    set(t, k, v) { t[k] = v; return true; },
  },
);
const fakeEl = () => ({
  style: {}, dataset: {}, classList: { add: noop, remove: noop, contains: () => false },
  appendChild: noop, removeChild: noop, setAttribute: noop, getAttribute: () => null,
  addEventListener: noop, removeEventListener: noop,
  getContext: () => fakeCtx(),
  width: 1, height: 1,
  childNodes: [], children: [], innerHTML: "", textContent: "",
});
globalThis.window = globalThis;
globalThis.self = globalThis;
globalThis.document = {
  createElement: fakeEl,
  createElementNS: fakeEl,
  documentElement: fakeEl(),
  body: fakeEl(),
  head: fakeEl(),
  addEventListener: noop,
  removeEventListener: noop,
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
  createTextNode: () => fakeEl(),
};
try {
  Object.defineProperty(globalThis, "navigator", {
    value: { userAgent: "node", platform: "node", maxTouchPoints: 0 },
    configurable: true,
  });
} catch { /* 이미 정의됨 */ }
globalThis.HTMLCanvasElement = class {};
globalThis.HTMLImageElement = class {};
globalThis.Image = class { constructor() { this.style = {}; } addEventListener() {} };
globalThis.localStorage = {
  _d: {},
  getItem(k) { return this._d[k] ?? null; },
  setItem(k, v) { this._d[k] = String(v); },
  removeItem(k) { delete this._d[k]; },
};
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 16);
globalThis.cancelAnimationFrame = noop;
globalThis.matchMedia = () => ({ matches: false, addEventListener: noop, removeEventListener: noop });
