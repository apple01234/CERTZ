/**
 * vc181 — 3D 시네마틱 레이어 (사용자 지시 #1·#2).
 *
 * 요구:
 *  ① 3D 에셋을 5차 궁극기 1·2, 4차 스킬, 보스 패턴/연출에 사용
 *  ② 3D 카메라로 역동적인 연출
 *
 * 설계:
 *  · Phaser는 2D 엔진이라 GLB를 직접 그리지 못한다. 그래서 게임 캔버스 **위에**
 *    투명 three.js 캔버스를 겹쳐 얹고, 연출이 필요한 순간에만 켠다.
 *    - 평상시: display:none (렌더 루프도 정지 → 발열 0)
 *    - 연출 중: pointer-events:none 으로 입력은 게임이 계속 받는다
 *  · 게임 좌표 → 3D 좌표 변환은 호출부가 아니라 이 레이어가 흡수한다(정사영 느낌 유지).
 *  · GLB는 CDN/에셋 경로에서 지연 로드하고, 한 번 쓴 모델은 캐시한다.
 *  · three.js는 이미 의존성에 있다(0.186.1). 동적 import로 초기 번들에서 분리한다.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type ThreeNS = typeof THREE;

/** 연출 프리셋 — 어떤 3D 오브젝트를 어떻게 띄울지 */
export type CinematicPreset =
  | "ultimate"      // 5차 궁극기: 거대 스컬/톱니가 카메라를 향해 돌진
  | "ultimate2"     // 제2궁극기: 와이어/나선이 감싸며 폭발
  | "skill4"        // 4차 스킬: 검기 메시가 궤도를 그림
  | "bossPattern"   // 보스 패턴: 충격 링·수정 파편이 사방으로
  | "bossIntro";    // 보스 등장: 카메라가 위에서 내려앉는다

type CineJob = {
  preset: CinematicPreset;
  /** 월드 좌표 (Phaser 기준) */
  x: number;
  y: number;
  /** 클래스/보스 색 */
  tint: number;
  /** ms */
  duration: number;
};

const GLB_DIR = "assets3d";

/** 프리셋 → 사용할 GLB 목록 (중복 없는 유니크 이름 기준) */
const PRESET_ASSETS: Record<CinematicPreset, string[]> = {
  ultimate: ["sertz__uni_skull", "sertz__cfxr_mesh_donut", "sertz__uni_ring_warped"],
  ultimate2: ["uni__worm", "sertz__cfxr_mesh_sword_slashes", "sertz__uni_arc"],
  skill4: ["sertz__cfxr_mesh_sword_slashes", "sertz__Slash", "sertz__uni_scythe"],
  bossPattern: ["sertz__Crystal1", "sertz__uni_ring_warped", "sertz__Torus1"],
  bossIntro: ["sertz__uni_skull2", "sertz__uni_ring_warped"],
};

export class Cinematic3D {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private THREE: ThreeNS | null = null;
  private clock: { getElapsedTime: () => number } | null = null;
  /** 로드된 GLB 씬 원본 (clone해서 쓴다) */
  private cache = new Map<string, unknown>();
  private active: { root: THREE.Group; startedAt: number; duration: number; preset: CinematicPreset } | null = null;
  private raf = 0;
  private ready = false;
  private dead = false;

  /** 지연 초기화 — 첫 연출 때 three.js를 동적 import (초기 번들 영향 0) */
  async ensure(): Promise<boolean> {
    if (this.ready) return true;
    if (this.dead) return false;
    if (typeof window === "undefined") return false;
    try {
      /* vc181 수리 — 종전엔 `await import("three")`로 동적 로드했는데,
       *  Next.js 번들러가 런타임 문자열로 남겨 브라우저에서
       *  "Failed to resolve module specifier 'three'"로 실패했다(실측).
       *  정적 import로 바꿔 번들러가 해석하게 한다. three는 이미 의존성에 있다. */
      this.THREE = THREE;

      /* WebGL이 없는 환경(구형 기기·일부 WebView)에서는 조용히 비활성.
       *  2D 연출은 그대로 남으므로 게임은 정상 진행된다. */
      const probe = document.createElement("canvas");
      const hasGL = !!(probe.getContext("webgl2") || probe.getContext("webgl"));
      if (!hasGL) {
        this.dead = true;
        return false;
      }

      const canvas = document.createElement("canvas");
      canvas.id = "sertz-cine3d";
      canvas.style.cssText =
        "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:8;display:none;";
      document.body.appendChild(canvas);
      this.canvas = canvas;

      const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "default", // 발열 대책: 고성능 강제 금지
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      renderer.setClearColor(0x000000, 0);
      this.renderer = renderer;

      this.scene = new THREE.Scene();
      const cam = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
      cam.position.set(0, 1.6, 6);
      this.camera = cam;

      this.scene.add(new THREE.AmbientLight(0xffffff, 0.9));
      const key = new THREE.DirectionalLight(0xffffff, 1.4);
      key.position.set(3, 5, 4);
      this.scene.add(key);
      const rim = new THREE.PointLight(0x66ccff, 8, 30);
      rim.position.set(-3, 2, 2);
      this.scene.add(rim);

      this.loader = new GLTFLoader();
      this.loader.setPath(`${GLB_DIR}/`);

      const resize = () => {
        if (!this.renderer || !this.camera) return;
        this.renderer.setSize(window.innerWidth, window.innerHeight, false);
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
      };
      window.addEventListener("resize", resize);

      this.ready = true;
      return true;
    } catch {
      this.dead = true;
      return false;
    }
  }

  private loader: GLTFLoader | null = null;

  /** GLB 하나 로드(캐시) */
  private async loadModel(name: string): Promise<unknown | null> {
    if (this.cache.has(name)) return this.cache.get(name);
    if (!this.loader) return null;
    try {
      const gltf = await this.loader.loadAsync(`${name}.glb`);
      const root = (gltf as unknown as { scene: unknown }).scene;
      this.cache.set(name, root);
      return root;
    } catch {
      return null;
    }
  }

  /** 연출 재생 — 이미 재생 중이면 교체(궁극기 연타 대비) */
  async play(job: CineJob): Promise<boolean> {
    const ok = await this.ensure();
    if (!ok || !this.THREE || !this.scene || !this.canvas) return false;

    const THREE = this.THREE;
    const names = PRESET_ASSETS[job.preset];

    // 기존 연출 정리
    this.stop();

    const group = new THREE.Group();
    for (const n of names) {
      const src = (await this.loadModel(n)) as THREE.Object3D | null;
      if (!src) continue;
      const inst = src.clone(true);
      // 메시 머티리얼을 발광 톤으로 — 어두운 배경에서도 보이게
      inst.traverse((o: THREE.Object3D) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.material) {
          const mat = (m.material as THREE.MeshStandardMaterial).clone();
          mat.transparent = true;
          mat.opacity = 0.92;
          mat.emissive = new THREE.Color(job.tint);
          mat.emissiveIntensity = 1.5;
          m.material = mat;
        }
      });
      // 배치: 프리셋별로 다른 궤도
      const idx = group.children.length;
      switch (job.preset) {
        case "ultimate":
          inst.position.set((idx - 1) * 1.5, 0.2 + idx * 0.25, -idx * 1.2);
          inst.scale.setScalar(1.6);
          break;
        case "ultimate2":
          inst.position.set(Math.cos(idx * 2.1) * 1.6, Math.sin(idx * 1.7) * 1.0, -1 - idx * 0.9);
          inst.scale.setScalar(1.3);
          break;
        case "skill4":
          inst.position.set(Math.sin(idx * 1.4) * 1.2, 0.1, -0.8 - idx * 0.6);
          inst.scale.setScalar(1.1);
          break;
        case "bossPattern":
          inst.position.set(Math.cos(idx * 2.4) * 1.8, Math.sin(idx * 2.4) * 1.2, -1.5);
          inst.scale.setScalar(1.9);
          break;
        case "bossIntro":
          inst.position.set(0, 1.2 - idx * 0.6, -2 - idx);
          inst.scale.setScalar(2.2);
          break;
      }
      group.add(inst as unknown as THREE.Object3D);
    }

    if (group.children.length === 0) return false;
    this.scene.add(group);
    this.active = { root: group, startedAt: performance.now(), duration: job.duration, preset: job.preset };
    this.canvas.style.display = "block";
    this.startLoop(job);
    return true;
  }

  /** 프레임 루프 — 프리셋별 카메라 워크가 핵심(지시 #2) */
  private startLoop(job: CineJob) {
    const THREE = this.THREE;
    if (!THREE || !this.camera || !this.renderer || !this.scene) return;
    const cam = this.camera;
    const root = this.active?.root;
    if (!root) return;

    const t0 = performance.now();
    const loop = () => {
      if (!this.active || this.dead) return;
      const t = (performance.now() - t0) / 1000;
      const p = Math.min(1, (performance.now() - t0) / Math.max(1, job.duration));
      const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;

      // ── 프리셋별 카메라 워크 (역동성) ──
      switch (job.preset) {
        case "ultimate": {
          // 카메라가 낮게 붙었다가 급상승하며 오브젝트를 내려다본다
          cam.position.set(Math.sin(t * 0.9) * 2.2, 0.4 + ease * 3.2, 6 - ease * 2.6);
          cam.lookAt(0, 0.4 + ease * 0.6, -1.4);
          cam.rotation.z = Math.sin(t * 3.2) * 0.05 * (1 - ease);
          break;
        }
        case "ultimate2": {
          // 나선 궤도 — 오브젝트를 한 바퀴 감아 돈다
          const a = t * 2.4;
          cam.position.set(Math.cos(a) * 4.2, 1.4 + Math.sin(t * 1.6) * 0.8, Math.sin(a) * 4.2);
          cam.lookAt(0, 0.2, -1.2);
          cam.rotation.z = Math.sin(t * 2.6) * 0.1;
          break;
        }
        case "skill4": {
          // 측면 트래킹 — 검기가 옆으로 지나가는 느낌
          cam.position.set(-3 + ease * 6, 1.1, 4.2 - ease * 1.4);
          cam.lookAt(0, 0.2, -1);
          cam.rotation.z = -0.06 * ease;
          break;
        }
        case "bossPattern": {
          // 풀백 + 살짝 흔들림 (보스 압박감)
          cam.position.set(Math.sin(t * 0.6) * 1.2, 1.8, 7.4 - ease * 1.2);
          cam.lookAt(0, 0.3, -1.5);
          cam.rotation.z = Math.sin(t * 11) * 0.006;
          break;
        }
        case "bossIntro": {
          // 위에서 내려앉는다 (조감 → 정면)
          const inv = 1 - ease;
          cam.position.set(0, 1.2 + inv * 5.5, 3 + inv * 2.5);
          cam.lookAt(0, 0.6, -2);
          break;
        }
      }

      // 오브젝트 자체 모션
      root.rotation.y = t * 0.9;
      root.children.forEach((c, i) => {
        c.rotation.x = t * (0.5 + i * 0.22);
        c.rotation.z = t * (0.3 + i * 0.17);
        if (job.preset === "ultimate2" || job.preset === "bossPattern") {
          const s = 1 + Math.sin(t * 3 + i) * 0.06;
          c.scale.multiplyScalar(1); // 기준 스케일 유지 (아래에서 개별 적용)
          c.scale.setScalar((i === 0 ? 1.3 : 1.6) * s);
        }
      });

      // 페이드 아웃
      if (p > 0.72) {
        const a = 1 - (p - 0.72) / 0.28;
        root.traverse((o: THREE.Object3D) => {
          const m = o as THREE.Mesh;
          if (m.isMesh && m.material) {
            const mat = m.material as THREE.MeshStandardMaterial;
            mat.opacity = Math.max(0, a * 0.92);
          }
        });
      }

      this.renderer!.render(this.scene!, cam);
      if (p >= 1) {
        this.stop();
        return;
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** 연출 정지 + 자원 반납 */
  stop() {
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
    if (this.active && this.scene) {
      this.scene.remove(this.active.root);
      this.active.root.traverse((o: THREE.Object3D) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry?.dispose?.();
          const mat = m.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
          else mat?.dispose?.();
        }
      });
      this.active = null;
    }
    if (this.canvas) this.canvas.style.display = "none";
  }

  /** 씬 전환/종료 시 완전 정리 */
  dispose() {
    this.stop();
    this.dead = true;
    this.renderer?.dispose();
    this.canvas?.remove();
    this.canvas = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.cache.clear();
  }
}

/** 싱글턴 — 게임 전체가 하나의 3D 레이어를 공유 */
let inst: Cinematic3D | null = null;
export function cine3d(): Cinematic3D {
  if (!inst) inst = new Cinematic3D();
  return inst;
}
