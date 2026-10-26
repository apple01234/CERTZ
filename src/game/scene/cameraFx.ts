/**
 * scene/cameraFx.ts — 2.5D 원근·줌 관리 (vc189, WorldScene 분할 1차)
 *
 * 왜 분리하나
 *   `WorldScene.ts` 가 16,471줄까지 커져 한 파일에서 흐름을 잡을 수 없다.
 *   그중 **원근(y-depth) 정렬 + 줌/리사이즈 대응**은 게임 진행 로직과 무관한
 *   순수 카메라 관심사다. WorldScene 의 필드를 15개 이상 참조하므로
 *   클래스 상속이 아니라 **컨텍스트 주입** 방식으로 떼어낸다.
 *
 *   WorldScene 쪽에서는 아래 한 줄로 위임한다:
 *     this.camFx = new CameraFx(this as unknown as CameraFxHost);
 *     this.camFx.tick(dt);
 *
 * 원칙
 *   · WorldScene 의 내부 필드를 직접 만지지 않는다 — Host 인터페이스로만 접근.
 *   · 동작·타이밍(80ms 스로틀, 300ms 줌 지연, 96px 노이즈 게이트)은 **그대로 보존**한다.
 *     분할의 목적은 구조 개선이지 동작 변경이 아니다.
 */
import Phaser from "phaser";

/** 원근/줌에 필요한 최소 씬 표면 */
export interface CameraFxHost {
  cameras: Phaser.Cameras.Scene2D.CameraManager;
  add: Phaser.GameObjects.GameObjectFactory;
  textures: Phaser.Textures.TextureManager;
  scale: Phaser.Scale.ScaleManager;
  time: Phaser.Time.Clock;

  player?: { active: boolean; y: number; setDepth: (d: number) => void };
  enemies: { active: boolean; y: number; setDepth: (d: number) => void }[];
  boss?: { active: boolean; y: number; setDepth: (d: number) => void } | null;
  remotes: Map<string, { sp?: { active: boolean; y: number; setDepth: (d: number) => void } }>;

  /** 씬 전역 상태 — 원근/줌이 공유한다 */
  perspOn: boolean;
  perspFog: Phaser.GameObjects.Image | null;
  perspDepthAcc: number;
  stageH: number;
  isInterior: boolean;
  zoomLastW: number;
  zoomLastH: number;
  zoomTimer: Phaser.Time.TimerEvent | null;

  redrawMinimap: () => void;
}

/** viewZoom() 을 주입받는다 — PhaserGame 에서 가져오면 순환 import 가 생긴다 */
export type ViewZoomFn = () => number;

const PERSP_THROTTLE_MS = 80;
const ZOOM_DEBOUNCE_MS = 300;
const ZOOM_NOISE_PX = 96;
const FOG_RATIO = 0.24;
const FOG_DEPTH = 88;

export class CameraFx {
  constructor(
    private readonly host: CameraFxHost,
    private readonly viewZoom: ViewZoomFn,
  ) {}

  /** 설정값 읽기 (기본 켜짐) */
  loadPerspSetting(): boolean {
    try {
      return window.localStorage.getItem("sertz_persp") !== "0";
    } catch {
      return true;
    }
  }

  /** 상단 안개 오버레이 — 대기 원근감. 스크린 고정 */
  buildPerspFog(): void {
    const { host } = this;
    if (!host.textures.exists("persp_fog")) {
      try {
        const c = document.createElement("canvas");
        c.width = 32;
        c.height = 128;
        const g = c.getContext("2d");
        if (!g) return;
        const grad = g.createLinearGradient(0, 0, 0, 128);
        grad.addColorStop(0, "rgba(12,10,30,0.85)");
        grad.addColorStop(0.55, "rgba(12,10,30,0.28)");
        grad.addColorStop(1, "rgba(12,10,30,0)");
        g.fillStyle = grad;
        g.fillRect(0, 0, 32, 128);
        host.textures.addCanvas("persp_fog", c);
      } catch {
        /* Canvas 미지원 무시 */
      }
    }
    if (!host.textures.exists("persp_fog")) return;
    host.perspFog?.destroy();
    const cam = host.cameras.main;
    host.perspFog = host.add
      .image(cam.width / 2, 0, "persp_fog")
      .setScrollFactor(0)
      .setDepth(FOG_DEPTH)
      .setOrigin(0.5, 0)
      .setDisplaySize(cam.width, cam.height * FOG_RATIO)
      .setAlpha(0.5);
  }

  /** 2.5D y-depth — 종전엔 틱마다 화살표 함수를 새로 만들었다 */
  perspDepthOf(y: number, h: number): number {
    return 9 + Phaser.Math.Clamp(y / h, 0, 1);
  }

  /** 매 프레임 (80ms 스로틀) — y-depth 정렬 + 안개 크기 유지 */
  tick(dt: number): void {
    const H = this.host;
    H.perspDepthAcc += dt;
    if (H.perspDepthAcc < PERSP_THROTTLE_MS) return;
    H.perspDepthAcc = 0;
    if (!H.perspOn) return;
    const h = Math.max(1, H.stageH);
    if (H.player?.active) H.player.setDepth(this.perspDepthOf(H.player.y, h));
    for (const e of H.enemies) if (e.active) e.setDepth(this.perspDepthOf(e.y, h));
    if (H.boss?.active) H.boss.setDepth(this.perspDepthOf(H.boss.y, h));
    for (const r of H.remotes.values()) {
      if (r.sp?.active) r.sp.setDepth(this.perspDepthOf(r.sp.y, h));
    }
    if (H.perspFog?.scene) {
      const cam = H.cameras.main;
      H.perspFog.setX(cam.width / 2);
      H.perspFog.setDisplaySize(cam.width, cam.height * FOG_RATIO);
    }
  }

  /** 2.5D 토글 적용 */
  applyPerspSetting(): void {
    const H = this.host;
    const next = this.loadPerspSetting();
    if (next === H.perspOn) return;
    H.perspOn = next;
    if (next) {
      this.buildPerspFog();
    } else {
      H.perspFog?.destroy();
      H.perspFog = null;
      // 기존 고정 depth로 복원
      if (H.player?.active) H.player.setDepth(10);
      for (const e of H.enemies) if (e.active) e.setDepth(9);
      if (H.boss?.active) H.boss.setDepth(11);
      for (const r of H.remotes.values()) if (r.sp?.active) r.sp.setDepth(9);
    }
  }

  applyFollowZoomOffset(): void {
    const cam = this.host.cameras.main;
    const z = cam.zoom || 1;
    cam.followOffset.set(
      -(cam.width * (z - 1)) / (2 * z),
      -(cam.height * (z - 1)) / (2 * z),
    );
  }

  /** 리사이즈/회전 대응 줌 — 96px 미만 노이즈는 무시하되 follow 보정은 항상 반영 */
  applyCameraZoom(): void {
    const H = this.host;
    const w = H.scale.gameSize.width;
    const h = H.scale.gameSize.height;
    const first = H.zoomLastH === 0;
    const rotated = !first && w > h !== H.zoomLastW > H.zoomLastH;
    const dh = Math.abs(h - H.zoomLastH);
    H.zoomLastH = h;
    H.zoomLastW = w;
    this.applyFollowZoomOffset();
    if (!first && dh < ZOOM_NOISE_PX && !rotated) return;

    const apply = () => {
      // 실내(정사각 방)는 확대 줌으로 아늑한 한 방 연출
      const base = this.viewZoom();
      H.cameras.main.setZoom(H.isInterior ? Math.min(3, base * 1.45) : base);
      this.applyFollowZoomOffset();
      H.redrawMinimap();
    };
    if (first) {
      apply();
      return;
    }
    H.zoomTimer?.remove();
    H.zoomTimer = H.time.delayedCall(ZOOM_DEBOUNCE_MS, apply);
  }
}
