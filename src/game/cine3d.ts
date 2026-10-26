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
  /** vc185 (#4) — 직업 계열. 주면 계열 전용 3D 메시 세트를 쓴다(직업 정체성). */
  /** vc185 — 4차 leaf 직업키(10종) 또는 계열키(5종). 직업별로 다른 메시를 고른다. */
  fam?: string | null;
};

const GLB_DIR = "assets3d";

/** 프리셋 → 사용할 GLB 목록 (중복 없는 유니크 이름 기준) */
/* vc185 (지시 #4 — "개짜치는 3d 효과 말고 좀 직업에 맞는 멋있는 3d효과") — 전면 재매핑.
 *
 *  종전 문제: 프리셋이 직업과 무관한 메시를 돌려썼다.
 *    ultimate  = 해골(skull) + 도넛(donut) + 고리  → 마법사가 해골을, 전사가 도넛을 띄웠다
 *    ultimate2 = 벌레(worm) + 검날 + 아크        → 직업 정체성 0
 *
 *  이제 **직업 계열 → 메시**로 매핑한다. 계열별 시각 언어:
 *    전사(warrior) — 검날·충격파·균열. 무게와 타격.
 *    궁수(ranger)  — 관통선·화살비·바람. 직선과 속도.
 *    마법사(mage)  — 결정·전기 아크·별. 원소와 마법진.
 *    도적(thief)   — 낫·연속 참격·잔상. 날카로움.
 *    해적(pirate)  — 미사일·포격·수류. 화력.
 *
 *  5차 1차(ultimate) = 계열 상징을 크게 3개
 *  5차 2차(ultimate2) = 계열 최종형 — 더 많고 웅장하게 4개
 *  4차(skill4) = 가볍게 2개 (남발되는 슬롯이라 부담 최소화)
 *
 *  사용자가 준 GLB 팩만 쓴다(신규 생성 없음). */
type Fam = "warrior" | "ranger" | "mage" | "thief" | "pirate";

/* vc185 (지시 #1·#4 — "4차·5차 스킬 아직 안 바뀜" · "개짜치는 3d 효과 말고 직업에 맞는 멋있는 3d")
 *
 *  진단: 종전엔 계열(familyOf = 1차 직업 5종)로만 메시를 골랐다. 그래서 10개 4차 직업이
 *  5가지 연출을 공유했다 — 워브링어와 크루세이더가 같은 검기, 아크로드와 이터널이 같은 수정.
 *  "스킬이 안 바뀐다"는 체감의 정체가 이것이다.
 *
 *  해결: **4차 leaf 직업 10종 단위**로 메시 세트를 따로 준다. 같은 계열 안에서도
 *  무기·속성이 다르므로 다른 메시를 쓴다(검/망치/저격/폭풍/수정/시간/그림자/쌍검/삼지창/대포).
 *  제공된 GLB 34종만 사용한다 — 신규 생성 없음. */

/** 4차 leaf 직업 + 계열(1~3차 폴백용) */
type UltKey = Fam | "warbringer" | "crusader" | "deadeye" | "skylord" | "arclord" | "eternal" | "shadowlord" | "blademaster" | "seaking" | "dreadnought";

/** 1차 궁극기 — 직업 상징 3종. 무기 형태가 한눈에 읽히게 고른다. */
const ULT_1: Record<UltKey, string[]> = {
  /* ── 계열 폴백 (1~3차) ── */
  warrior: ["uni__cfxr_mesh_sword_slashes", "uni__uni_onslaught", "uni__cfxr_mesh_ring"],
  ranger:  ["uni__uni_streak", "uni__uni_missile_blade", "uni__cfxr_mesh_star4"],
  mage:    ["uni__Crystal1", "uni__cfxr_electric_arc_circle", "uni__cfxr_mesh_star6"],
  thief:   ["uni__uni_scythe", "uni__Slash", "uni__uni_arc"],
  pirate:  ["uni__uni_razor_missile", "uni__cfxr_mesh_donut", "uni__uni_hitfan"],
  /* ── 전사 ── */
  // 워브링어: 거대 대검 연쇄 참격 + 지면 충격
  warbringer: ["uni__cfxr_mesh_sword_slashes", "uni__uni_onslaught", "uni__cfxr_mesh_disk"],
  // 크루세이더: 황금 방벽 + 성광 고리 (수호·심판)
  crusader:   ["uni__cfxr_electric_barrier", "uni__cfxr_mesh_ring", "uni__cfxr_mesh_star8"],
  /* ── 궁수 ── */
  // 데드아이: 일직선 관통 궤적 + 조준 별
  deadeye:    ["uni__uni_streak", "uni__uni_missile_blade", "uni__cfxr_mesh_star4"],
  // 스카이로드: 회오리 + 폭풍 잔상 (다중 히트)
  skylord:    ["uni__uni_orb_swoosh", "uni__uni_arc", "uni__cfxr_mesh_star6"],
  /* ── 마법사 ── */
  // 아크로드: 수정 + 전격 아크 (원소 폭발)
  arclord:    ["uni__Crystal1", "uni__cfxr_electric_arc_circle", "uni__cfxr_particle_electric_arc"],
  // 이터널: 고리 + 시계톱니(시간) — 수정 대신 시간 상징
  eternal:    ["uni__Torus1", "uni__cfxr_mesh_ring", "uni__uni_ring_warped"],
  /* ── 도적 ── */
  // 섀도우로드: 낫 + 해골 (그림자 왕국)
  shadowlord: ["uni__uni_scythe", "uni__uni_skull", "uni__uni_arc"],
  // 블레이드마스터: 쌍검 난무 + 참격 부채
  blademaster:["uni__Slash", "uni__uni_hitfan", "uni__cfxr_mesh_sword_slashes"],
  /* ── 해적 ── */
  // 시킹: 삼지창 대신 예리한 미사일 + 파도 고리 (수압)
  seaking:    ["uni__uni_razor_missile", "uni__cfxr_mesh_foam", "uni__cfxr_mesh_donut"],
  // 드레드노트: 포격 탄막 + 충격파 (중포격)
  dreadnought:["uni__uni_onslaught", "uni__cfxr_mesh_disk", "uni__uni_hitfan"],
};

/** 2차 궁극기(120초) — 4종으로 더 웅장하게. 1차와 다른 조합을 써서 "한 단계 위"가 보이게. */
const ULT_2: Record<UltKey, string[]> = {
  warrior: ["uni__cfxr_mesh_sword_slashes", "uni__uni_onslaught", "uni__Torus1", "uni__cfxr_mesh_star8"],
  ranger:  ["uni__uni_streak", "uni__uni_missile_blade", "uni__cfxr_mesh_star6", "uni__uni_orb_swoosh"],
  mage:    ["uni__Crystal1", "uni__cfxr_electric_arc_circle", "uni__cfxr_electric_barrier", "uni__cfxr_mesh_star8"],
  thief:   ["uni__uni_scythe", "uni__Slash", "uni__uni_arc", "uni__cfxr_mesh_star4"],
  pirate:  ["uni__uni_razor_missile", "uni__cfxr_mesh_donut", "uni__uni_hitfan", "uni__uni_onslaught"],
  warbringer: ["uni__cfxr_mesh_sword_slashes", "uni__uni_onslaught", "uni__cfxr_mesh_star8", "uni__cfxr_mesh_donut"],
  crusader:   ["uni__cfxr_electric_barrier", "uni__cfxr_mesh_star8", "uni__cfxr_mesh_ring", "uni__Torus1"],
  deadeye:    ["uni__uni_missile_blade", "uni__uni_streak", "uni__cfxr_mesh_star4", "uni__uni_orb_swoosh"],
  skylord:    ["uni__uni_orb_swoosh", "uni__cfxr_mesh_star6", "uni__uni_arc", "uni__cfxr_electric_arc_circle"],
  arclord:    ["uni__Crystal1", "uni__cfxr_particle_electric_arc", "uni__cfxr_electric_arc_circle", "uni__cfxr_mesh_star8"],
  eternal:    ["uni__Torus1", "uni__uni_ring_warped", "uni__cfxr_mesh_ring", "uni__cfxr_mesh_star6"],
  shadowlord: ["uni__uni_scythe", "uni__uni_skull2", "uni__uni_arc", "uni__cfxr_mesh_star4"],
  blademaster:["uni__uni_hitfan", "uni__cfxr_mesh_sword_slashes", "uni__uni_arc", "uni__Slash"],
  seaking:    ["uni__uni_razor_missile", "uni__cfxr_mesh_foam", "uni__cfxr_mesh_donut", "uni__uni_orb_swoosh"],
  dreadnought:["uni__uni_onslaught", "uni__cfxr_mesh_disk", "uni__uni_hitfan", "uni__cfxr_mesh_star8"],
};

/** 4차기 — 2종으로 가볍게(남발 슬롯). 직업 무기만 즉시 읽히게. */
const ULT_S4: Record<UltKey, string[]> = {
  warrior: ["uni__cfxr_mesh_sword_slashes", "uni__uni_hitfan"],
  ranger:  ["uni__uni_streak", "uni__Slash"],
  mage:    ["uni__Crystal1", "uni__cfxr_mesh_ring"],
  thief:   ["uni__Slash", "uni__uni_arc"],
  pirate:  ["uni__uni_razor_missile", "uni__uni_hitfan"],
  warbringer: ["uni__cfxr_mesh_sword_slashes", "uni__uni_onslaught"],
  crusader:   ["uni__cfxr_electric_barrier", "uni__cfxr_mesh_ring"],
  deadeye:    ["uni__uni_streak", "uni__cfxr_mesh_star4"],
  skylord:    ["uni__uni_orb_swoosh", "uni__uni_arc"],
  arclord:    ["uni__cfxr_electric_arc_circle", "uni__Crystal1"],
  eternal:    ["uni__cfxr_mesh_ring", "uni__Torus1"],
  shadowlord: ["uni__uni_scythe", "uni__uni_arc"],
  blademaster:["uni__uni_hitfan", "uni__Slash"],
  seaking:    ["uni__uni_razor_missile", "uni__cfxr_mesh_foam"],
  dreadnought:["uni__uni_onslaught", "uni__cfxr_mesh_disk"],
};

/** 보스 연출은 직업 무관 — 그대로 유지(위압감이 목적) */
const PRESET_ASSETS: Record<CinematicPreset, string[]> = {
  ultimate: ULT_1.warrior,   // 폴백 — play()에서 직업으로 교체된다
  ultimate2: ULT_2.warrior, // 폴백
  skill4: ULT_S4.warrior,      // 폴백
  bossPattern: ["sertz__Crystal1", "sertz__uni_ring_warped", "sertz__Torus1"],
  bossIntro: ["sertz__uni_skull2", "sertz__uni_ring_warped"],
};

/**
 * vc185 (#4) — 계열·프리셋으로 실제 메시 목록을 고른다.
 * play() 가 fam 을 넘기면 그 계열 세트를, 없으면 프리셋 폴백을 쓴다.
 */
function assetsFor(preset: CinematicPreset, key?: string | null): string[] {
  /* vc185 — key 는 4차 leaf 직업 우선, 없으면 계열(1~3차 폴백).
   *  같은 계열이라도 4차 직업이 다르면 다른 메시를 쓴다. */
  const k = key as UltKey | null | undefined;
  if (k) {
    if (preset === "ultimate") return ULT_1[k] ?? ULT_1.warrior;
    if (preset === "ultimate2") return ULT_2[k] ?? ULT_2.warrior;
    if (preset === "skill4") return ULT_S4[k] ?? ULT_S4.warrior;
  }
  return PRESET_ASSETS[preset] ?? PRESET_ASSETS.ultimate;
}

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
       *  2D 연출은 그대로 남으므로 게임은 정상 진행된다.
       *
       *  vc190 (컨텍스트 유실 수리) — 종전엔 probe 용 **새 캔버스로 컨텍스트를 생성**했다.
       *  이 모듈은 현재 호출되지 않지만(2D 로 대체됨) 되살릴 때 같은 버그를 재도입하지
       *  않도록, 이미 있는 캔버스를 재사용하는 방식으로 바꾼다.
       *  컨텍스트 개수를 늘리는 것이 유실의 원인이었다(diag-ctxloss4 실측). */
      const host = document.querySelector("canvas") as HTMLCanvasElement | null;
      const hasGL = !!(host && (host.getContext("webgl2") ?? host.getContext("webgl")));
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
  /* vc187 (지시 #3·#11·#17) — 3D 컷신 전면 비활성.
   *  유저 지시: "3d 컷씬 없어도 되니까 2d로 ... 스킬 좀 멋있게 수정해",
   *            "3d 연출 개별로임 (차라리 빼고 아크로드 궁극기처럼 멋있게 만들어)",
   *            "블렌더 에셋으로 만든 3d 컷씬 말고 내가 준 VFX 팩 ... 적용해야지!!"
   *  세 지시가 같은 방향이다 — 3D 레이어를 쓰지 말고 2D VFX 로만 연출한다.
   *  play() 진입점 한 곳에서 막으면 5개 프리셋(skill4/ultimate/ultimate2/…)이
   *  전부 꺼지고, 호출부(Player.ts 3곳)는 손대지 않아도 된다.
   *  (메시 매핑·로더 코드는 남겨 둔다 — 나중에 되살릴 때 그대로 쓴다.) */
  static DISABLED = true;

  async play(job: CineJob): Promise<boolean> {
    if (Cinematic3D.DISABLED) return false;
    const ok = await this.ensure();
    if (!ok || !this.THREE || !this.scene || !this.canvas) return false;

    const THREE = this.THREE;
    /* vc185 (#4) — 계열이 오면 그 계열 전용 메시 세트. 없으면 프리셋 폴백. */
    const names = assetsFor(job.preset, job.fam);

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
