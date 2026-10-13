/**
 * vc142 (#9) — Three.js 3D VFX 오버레이 (phas3d 아이디어의 자체 구현)
 *
 * 유저 지시: "https://github.com/phaserjs/phas3d 및 Three.js 를 사용해서 내가 준 3D VFX 들로
 *  이펙트들 전면 개편" + "에셋 전부 최대한 활용하기"
 *
 * 구조:
 *  - Phaser 캔버스 위에 투명 WebGL 캔버스를 얹고(포인터 이벤트 차단) Three.js 장면을 렌더
 *  - 오쏘 카메라가 Phaser 메인 카메라(scroll/zoom)와 매 프레임 동기화 → 월드 좌표 그대로 사용
 *  - 파티클은 유저 에셋팩(UNI VFX·Hovl·Cartoon FX) 크롭 텍스처(vx_*)의 3D 빌보드 스프라이트
 *  - 프리셋: boom(폭발) / pillar(빛기둥) / ring(확장 링) / spiral(수렴 소용돌이)
 *
 * 안전장치:
 *  - WebGL 미지원/절전 모드(fxLevel 0)/저사양 환경 → 아예 비활성 (2D 이펙트만)
 *  - 동시 이펙트 상한 6개 초과분 스킵, rAF는 이펙트 존재 시에만 가동 (유휴 비용 0)
 *  - 컨텍스트 유실 시 자가 파괴 후 재초기화는 다음 트리거에서 재시도
 */
import * as THREE from "three";
import { EventBus } from "../../components/game/EventBus";

type Preset = "boom" | "pillar" | "ring" | "spiral";

const MAX_LIVE = 6;
const TINT = 0xffffff;

/** 절전/저사양 판정 — 모바일 UA 또는 초저코스 기기만 (데스크톱 4코어도 허용).
 *  ?vfx3d=1 쿼리로 강제 활성 (진단/E2E용) */
function lowPerf(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get("vfx3d") === "1") return false;
    const cores = navigator.hardwareConcurrency ?? 4;
    const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    return mobile || cores <= 2;
  } catch {
    return false;
  }
}

class Vfx3DImpl {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-100, 100, 100, -100, 0.1, 4000);
  private live: { until: number; dispose: () => void; update: (t: number) => void }[] = [];
  private rafId = 0;
  private ok = false;
  private failed = false;
  private texCache = new Map<string, THREE.Texture>();
  private canvas: HTMLCanvasElement | null = null;
  private lastW = 0;
  private lastH = 0;

  /** 오버레이 초기화 — Phaser 캔버스 부모에 투명 캔버스 얹기 */
  ensure(gameCanvas: HTMLCanvasElement): boolean {
    if (this.ok || this.failed) return this.ok;
    if (lowPerf()) { this.failed = true; return false; }
    const parent = gameCanvas.parentElement;
    if (!parent) { this.failed = true; return false; }
    try {
      const canvas = document.createElement("canvas");
      canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:5;";
      parent.appendChild(canvas);
      this.canvas = canvas;
      this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "low-power" });
      this.renderer.setClearColor(0x000000, 0);
      this.ok = true;
      this.resize();
    } catch (e) {
      console.warn("[SERTZ] Vfx3D 초기화 실패 — 2D 이펙트만 사용", e);
      this.failed = true;
      return false;
    }
    return true;
  }

  private resize() {
    if (!this.renderer || !this.canvas) return;
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    /* vc146 (#10 크래시) — 같은 크기면 setSize를 건너뛴다.
     *  기존엔 sync()에서 매 프레임 setSize를 호출해 그리기 버퍼를 재할당했고, 이 GPU 메모리
     *  churn이 장시간 플레이 시 탭/앱 크래시("게임이 자꾸 꺼져")의 직접 후보다.
     *  캔버스 실제 리사이즈 시에만 재할당한다. */
    if (this.lastW === w && this.lastH === h) return;
    this.lastW = w;
    this.lastH = h;
    this.renderer.setSize(w, h, false);
  }

  private tex(key: string): THREE.Texture | null {
    const cached = this.texCache.get(key);
    if (cached) return cached;
    try {
      const t = new THREE.TextureLoader().load(`/assets/${key}.webp`);
      t.colorSpace = THREE.SRGBColorSpace;
      this.texCache.set(key, t);
      return t;
    } catch {
      return null;
    }
  }

  /** Phaser 카메라와 동기화 — 월드 좌표 → 오버레이 오쏘 좌표
   *  vc146 (#7 우측 구석 유령 이펙트) — 근본 수정:
   *  Phaser P4 렌더 변환은 screen = origin + z×(world - scroll - origin)이므로 실제 보이는
   *  뷰 중심 = scroll + origin×(1 - 1/z) + vw/2. 기존 sync는 보정항 origin×(1-1/z)를 빼먹어
   *  PC(줌≈2)에서 3D 이펙트가 실제 위치보다 최대 ~(w/2)(1-1/z), (h/2)(1-1/z)px 우하단으로
   *  어긋났다 — 보스 격파 폭발·수르트 불기둥 등이 "오른쪽 구석"에 떠던 원인. */
  sync(cam: { scrollX: number; scrollY: number; width: number; height: number; zoom: number }) {
    if (!this.ok || !this.renderer) return;
    const z = cam.zoom || 1;
    const vw = cam.width / z;
    const vh = cam.height / z;
    const ox = (cam.width * 0.5) * (1 - 1 / z); // P4 origin 보정 (WorldScene.applyManualCameraFollow와 동일 모델)
    const oy = (cam.height * 0.5) * (1 - 1 / z);
    const cx = cam.scrollX + ox + vw / 2;
    const cy = cam.scrollY + oy + vh / 2;
    this.camera.left = -vw / 2;
    this.camera.right = vw / 2;
    this.camera.top = vh / 2;
    this.camera.bottom = -vh / 2;
    this.camera.position.set(cx, -cy, 1000);
    this.camera.updateProjectionMatrix();
    this.resize();
  }

  private startLoop() {
    if (this.rafId) return;
    const loop = () => {
      this.rafId = 0;
      if (!this.ok || !this.renderer) return;
      const now = performance.now();
      /* vc146 (#10) — 개별 이펙트 update 예외가 rAF 체인·렌더를 죽이지 않게 격리 */
      for (const fx of this.live) {
        try { fx.update(now); } catch { /* 다음 프레임에 정상 복귀 */ }
      }
      this.live = this.live.filter((fx) => now < fx.until);
      try { this.renderer.render(this.scene, this.camera); } catch { /* 컨텍스트 일시 유실 — 무시 */ }
      if (this.live.length > 0) this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  /** 프리셋 스폰 — x/y는 Phaser 월드 좌표, tint는 0xRRGGBB
   *  vc146 (#7 방어) — 유한 좌표 가드: 파괴된 엔티티의 NaN 좌표로 스폰되면
   *  화면 구석에 유령 이펙트가 뜨는 것을 원천 차단 */
  spawn(kind: Preset, x: number, y: number, tint = TINT, scale = 1) {
    if (!this.ok) return;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (this.live.length >= MAX_LIVE) return;
    const now = performance.now();
    const dur = kind === "boom" ? 900 : kind === "pillar" ? 700 : kind === "ring" ? 800 : 1000;
    const group = new THREE.Group();
    group.position.set(x, -y, 0);
    const parts: THREE.Sprite[] = [];
    const col = new THREE.Color(tint);

    const mkSprite = (texKey: string, s: number, opacity = 1): THREE.Sprite | null => {
      const t = this.tex(texKey);
      if (!t) return null;
      const m = new THREE.SpriteMaterial({ map: t, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, color: col });
      const sp = new THREE.Sprite(m);
      sp.scale.setScalar(s);
      sp.userData.baseOp = opacity;
      group.add(sp);
      parts.push(sp);
      return sp;
    };

    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    if (kind === "boom") {
      /* 중심 코어 + 잔연기 + 12방향 파편 — uni_expcore/vx_expcore·vx_smoke·vx_debris */
      const core = mkSprite("vx_expcore", 90 * scale);
      const glow = mkSprite("vx_glowball", 70 * scale, 0.8);
      if (core) core.material.rotation = rand(0, Math.PI * 2);
      for (let i = 0; i < 12; i++) {
        const p = mkSprite(i % 3 === 0 ? "vx_debris" : "vx_smoke", rand(14, 30) * scale, 0.9);
        if (!p) continue;
        const a = (Math.PI * 2 * i) / 12 + rand(-0.2, 0.2);
        const dist = rand(60, 130) * scale;
        const z0 = rand(-30, 30);
        const sx = p.position.x, sy = p.position.y, sz = z0;
        p.userData.vel = { x: Math.cos(a) * dist, y: Math.sin(a) * dist, z: rand(20, 70) };
        p.position.set(sx, sy, sz);
      }
      if (glow) glow.userData.grow = 130 * scale;
    } else if (kind === "pillar") {
      /* 세로 빛기둥 — vx_flare 세로 스케일 + 상승 파티클 */
      const beam = mkSprite("vx_flare", 40 * scale);
      if (beam) beam.scale.set(34 * scale, 210 * scale, 1);
      const tip = mkSprite("vx_glowball", 54 * scale, 0.9);
      if (tip) tip.position.set(0, 100 * scale, 0);
      for (let i = 0; i < 6; i++) {
        const p = mkSprite("vx_smoke", rand(10, 22) * scale, 0.7);
        if (!p) continue;
        p.position.set(rand(-24, 24) * scale, rand(-80, 40) * scale, rand(-10, 10));
        p.userData.rise = rand(90, 160);
      }
    } else if (kind === "ring") {
      /* 확장 링 — vx_ring 평면 확장 */
      const ring = mkSprite("vx_ring", 30 * scale);
      if (ring) ring.userData.grow = 300 * scale;
      const haze = mkSprite("vx_circlehazy", 44 * scale, 0.5);
      if (haze) haze.userData.grow = 260 * scale;
    } else {
      /* spiral — 수렴 소용돌이 (vx_glowh 10개가 나선 궤도로 중심 수렴) */
      for (let i = 0; i < 10; i++) {
        const p = mkSprite("vx_glowh", rand(12, 22) * scale, 0.95);
        if (!p) continue;
        const a0 = (Math.PI * 2 * i) / 10;
        p.userData.orbit = { a0, r0: 150 * scale, spin: rand(2.2, 3.4) };
        p.position.set(Math.cos(a0) * 150 * scale, Math.sin(a0) * 150 * scale, rand(-20, 20));
      }
    }

    if (parts.length === 0) return;
    this.scene.add(group);
    const t0 = now;
    const entry = {
      until: t0 + dur,
      update: (t: number) => {
        const k = Math.min(1, (t - t0) / dur);
        const fade = 1 - k;
        for (const p of parts) {
          const m = p.material as THREE.SpriteMaterial;
          m.opacity = fade * ((p.userData.baseOp as number) ?? 1);
          const ud = p.userData as { vel?: { x: number; y: number; z: number }; rise?: number; grow?: number; orbit?: { a0: number; r0: number; spin: number } };
          if (ud.vel) {
            const v = ud.vel;
            p.position.x += (v.x / dur) * 16;
            p.position.y += (v.y / dur) * 16;
            p.position.z += (v.z / dur) * 16;
          }
          if (ud.rise) p.position.y += (ud.rise / dur) * 16;
          if (ud.grow) p.scale.multiplyScalar(1 + 0.055 * (1 - k * 0.4));
          const orb = ud.orbit;
          if (orb) {
            const a = orb.a0 + orb.spin * k;
            const r = orb.r0 * (1 - k);
            p.position.x = Math.cos(a) * r;
            p.position.y = Math.sin(a) * r;
          }
        }
        group.rotation.z += 0.01;
      },
      dispose: () => {
        this.scene.remove(group);
        for (const p of parts) (p.material as THREE.Material).dispose();
      },
    };
    this.live.push(entry);
    this.startLoop();
  }

  /** 이벤트 버스 연결 — vfx3d { kind, x, y, tint, scale } */
  wireEvents() {
    EventBus.on("vfx3d", (v: { kind: Preset; x: number; y: number; tint?: number; scale?: number }) => {
      try { this.spawn(v.kind, v.x, v.y, v.tint ?? TINT, v.scale ?? 1); } catch { /* 렌더 실패 무시 */ }
    });
  }

  destroy() {
    this.ok = false;
    this.failed = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    for (const fx of this.live) fx.dispose();
    this.live = [];
    this.renderer?.dispose();
    this.renderer = null;
    this.canvas?.remove();
    this.canvas = null;
    this.lastW = 0;
    this.lastH = 0;
    this.texCache.clear();
  }
}

export const Vfx3D = new Vfx3DImpl();
