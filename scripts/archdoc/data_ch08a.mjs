// 모듈 8 (071~075): UI/UX 및 크로스플랫폼 가용성 — 전반부
// 스택: HTML5/DOM, Phaser 3 UI, TypeScript, Web Push API

export const items = [
  {
    id: "071",
    title: "모바일 가상 조이스틱 (Touch Virtual Joystick) 반응형 구현",
    role: [
      "가상 조이스틱은 '터치 다운 시점에 베이스 생성 → 드래그 벡터 계산 → 터치 업 시 소멸'의 동적 배치 방식이 고정 배치보다 우수하다. 화면 어디든 터치하면 그 자리가 중심이 되어 조작이 시작되므로, 엄지 도달 범위의 개인차를 흡수한다. 벡터 계산은 (터치 위치 - 중심)/반경으로 정규화하고, 반경을 벗어나면 중심을 손가락 방향으로 이동시키는 '슬라이딩 베이스'로 장거리 드래그도 부드럽게 만든다.",
      "출력은 -1~1 정규화 벡터이며, 데드존(중심 15%는 0으로)을 두어 정지 중 미세 흔들림을 제거한다. Phaser Input과 DOM 터치 이벤트의 이중 발생(multi-touch 중복)을 방지하기 위해 pointerId 기반 추적으로 같은 손가락만 추적하고, 두 번째 손가락은 스킬 버튼에 남겨둔다. 조이스틱 표시는 캔버스 위 DOM 오버레이(반투명 링)로 구현해 게임 렌더와 분리한다.",
    ],
    blocks: [
      {
        lang: "src/input/VirtualJoystick.ts",
        code: `import type { InputController, MoveIntentVec, ActionEvent } from "./InputRouter";

const DEADZONE = 0.15;                 // 데드존(정규화)
const BASE_RADIUS = 72;                // 베이스 반경(px, 반응형으로 확장)

export class VirtualJoystick implements InputController {
  readonly name = "touch" as const;
  readonly moveVec: MoveIntentVec = { x: 0, y: 0 };
  onAction: ((e: ActionEvent) => void) | null = null;

  private baseEl: HTMLDivElement;
  private stickEl: HTMLDivElement;
  private pointerId: number | null = null;
  private cx = 0; private cy = 0;       // 현재 베이스 중심

  constructor(private root: HTMLElement, private worldTap: (wx: number, wy: number) => void) {
    this.baseEl = document.createElement("div");
    this.baseEl.className = "vjoy-base";
    this.stickEl = document.createElement("div");
    this.stickEl.className = "vjoy-stick";
    this.baseEl.appendChild(this.stickEl);
    this.baseEl.style.display = "none";
    this.root.appendChild(this.baseEl);

    root.addEventListener("pointerdown", e => this.onDown(e));
    root.addEventListener("pointermove", e => this.onMove(e));
    root.addEventListener("pointerup", e => this.onUp(e));
    root.addEventListener("pointercancel", e => this.onUp(e));
  }

  private onDown(e: PointerEvent) {
    if (this.pointerId !== null) return;           // 이미 조작 중(두 번째 손가락 무시)
    this.pointerId = e.pointerId;
    this.cx = e.clientX; this.cy = e.clientY;
    this.baseEl.style.display = "block";
    this.placeBase();
    this.updateStick(e.clientX, e.clientY);
  }

  private onMove(e: PointerEvent) {
    if (e.pointerId !== this.pointerId) return;
    const dx = e.clientX - this.cx, dy = e.clientY - this.cy;
    const dist = Math.hypot(dx, dy);
    // 슬라이딩 베이스: 반경 초과 시 중심을 따라 이동
    if (dist > BASE_RADIUS) {
      const k = (dist - BASE_RADIUS) / dist;
      this.cx += dx * k; this.cy += dy * k;
      this.placeBase();
    }
    this.updateStick(e.clientX, e.clientY);
  }

  private onUp(e: PointerEvent) {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.moveVec.x = this.moveVec.y = 0;
    this.baseEl.style.display = "none";
    this.stickEl.style.transform = "translate(-50%,-50%)";
  }

  private updateStick(x: number, y: number) {
    let nx = (x - this.cx) / BASE_RADIUS, ny = (y - this.cy) / BASE_RADIUS;
    const len = Math.hypot(nx, ny);
    if (len < DEADZONE) { this.moveVec.x = this.moveVec.y = 0; }
    else {
      const clamped = Math.min(1, len);
      nx = nx / len * clamped; ny = ny / len * clamped;
      this.moveVec.x = nx; this.moveVec.y = ny;
    }
    this.stickEl.style.transform =
      "translate(-50%,-50%) translate(" + (nx * BASE_RADIUS) + "px," + (ny * BASE_RADIUS) + "px)";
  }

  private placeBase() {
    this.baseEl.style.left = this.cx + "px";
    this.baseEl.style.top = this.cy + "px";
  }

  destroy() {
    this.baseEl.remove();
  }
}

/* CSS 예:
.vjoy-base { position: fixed; width: 144px; height: 144px; margin-left:-72px; margin-top:-72px;
  border-radius: 50%; background: rgba(255,255,255,.08);
  border: 2px solid rgba(255,255,255,.25); pointer-events: none; z-index: 900; }
.vjoy-stick { position:absolute; left:50%; top:50%; width:56px; height:56px;
  border-radius:50%; background: rgba(255,255,255,.35); transform: translate(-50%,-50%); } */`,
      },
    ],
    tips: [
      "동적 배치(터치 위치 = 중심)는 엄지 도달 범위 문제를 근본적으로 해결한다 — 고정 좌하단 배치는 대형 폰에서 닿지 않는다.",
      "데드존 15% + 슬라이딩 베이스의 조합이 조작감 표준이며, 데드존이 없으면 정지 상태에서 캐릭터가 떨린다.",
      "pointerId 추적으로 첫 손가락은 이동, 나머지는 스킬 버튼에 자연스럽게 남긴다.",
      "터치 영역 최적화(073번 --touch-min 44px)와 조합해 조이스틱 반경도 화면 크기 비율로 확장한다.",
    ],
  },
  {
    id: "072",
    title: "PC용 마우스 클릭 이동 및 WASD/방향키 조작 통합 컨트롤러",
    role: [
      "PC 컨트롤러는 두 조작 모드(WASD 자유 이동, 클릭 지점 이동)를 하나의 인터페이스로 통합한다. WASD 입력 중이면 키보드 우선, 없으면 클릭 경로(A* 경로, 043번)를 따라 이동한다. 클릭 이동은 경로가 살아 있는 동안 '다음 웨이포인트 방향 벡터'를 moveVec으로 내보내고, 새 클릭이 오면 경로를 교체한다. ESC 또는 이동키 입력으로 클릭 이동을 취소한다.",
      "통합 컨트롤러의 설계 목표는 씬 코드가 조작 모드를 신경 쓰지 않게 하는 것이다. 두 모드 모두 최종적으로 moveVec + 액션 이벤트만 방출하므로, 예측 엔진(011번)과 오토 배틀(033번)은 같은 입력 계약을 공유한다. 키 바인딩은 설정 가능(퀵슬롯 076번과 연동)하며, 기본값은 WASD + 스킬 1~6 + E 상호작용 + Tab 타겟팅이다.",
    ],
    blocks: [
      {
        lang: "src/input/UnifiedController.ts",
        code: `import type { MoveIntentVec, ActionEvent, InputController } from "./InputRouter";
import type { AStar } from "../../shared/astar";

export class UnifiedController implements InputController {
  readonly name = "kb" as const;
  readonly moveVec: MoveIntentVec = { x: 0, y: 0 };
  onAction: ((e: ActionEvent) => void) | null = null;

  private keys = new Set<string>();
  private path: { x: number; y: number }[] = [];    // 클릭 이동 웨이포인트(월드 px)
  private TILE = 32;

  constructor(private scene: Phaser.Scene, private astar: AStar,
              private mapW: number, private mapH: number,
              private blocked: Uint8Array) {
    scene.input.keyboard!.on("keydown", (e: KeyboardEvent) => {
      this.keys.add(e.code);
      if (e.code.startsWith("Digit")) {
        const slot = Number(e.code.slice(5)) - 1;
        if (slot >= 0 && slot < 6) this.onAction?.({ kind: "skill", slot });
      }
      if (e.code === "KeyE") this.onAction?.({ kind: "interact" });
      if (e.code === "ESCAPE") this.cancelPath();
    });
    scene.input.keyboard!.on("keyup", (e: KeyboardEvent) => this.keys.delete(e.code));

    scene.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (p.button !== 0) return;                    // 좌클릭만
      const cam = scene.cameras.main;
      const wx = cam.getWorldPoint(p.x, p.y).x;
      const wy = cam.getWorldPoint(p.x, p.y).y;
      this.setClickPath(wx, wy);
      this.onAction?.({ kind: "worldTap", wx, wy });
    });
  }

  /** 클릭 → A* 경로 → 웨이포인트 체인 */
  private setClickPath(wx: number, wy: number) {
    const self = (this.scene as any).playerPos as { x: number; y: number };
    const sx = Math.floor(self.x / this.TILE), sy = Math.floor(self.y / this.TILE);
    const tx = Math.floor(wx / this.TILE), ty = Math.floor(wy / this.TILE);
    const raw = this.astar.find(sx, sy, tx, ty);
    if (!raw) return;
    this.path = [];
    for (let i = 2; i < raw.length; i += 2) {
      this.path.push({ x: raw[i] * this.TILE + this.TILE / 2,
                       y: raw[i + 1] * this.TILE + this.TILE / 2 });
    }
  }
  cancelPath() { this.path = []; }

  /** 고정 업데이트: 키보드 우선, 없으면 경로 추적 */
  poll(dtMs: number): MoveIntentVec {
    let x = 0, y = 0;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) x += 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) x -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) y += 1;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) y -= 1;

    if (x || y) {
      this.cancelPath();                              // 키 입력 시 클릭 경로 취소
      const len = Math.hypot(x, y);
      this.moveVec.x = x / len; this.moveVec.y = y / len;
      return this.moveVec;
    }
    if (this.path.length) {
      const self = (this.scene as any).playerPos as { x: number; y: number };
      const wp = this.path[0];
      const dx = wp.x - self.x, dy = wp.y - self.y;
      const dist = Math.hypot(dx, dy);
      if (dist < this.TILE * 0.4) {
        this.path.shift();                            // 웨이포인트 도달
        if (!this.path.length) { this.moveVec.x = this.moveVec.y = 0; return this.moveVec; }
      }
      this.moveVec.x = dx / dist; this.moveVec.y = dy / dist;
      return this.moveVec;
    }
    this.moveVec.x = this.moveVec.y = 0;
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
      "키 입력이 들어오면 클릭 경로를 즉시 취소해야 '자동 이동 중 원치 않는 이동' 충돌이 없다.",
      "웨이포인트 도달 판정(타일 40%)은 빡빡하면 지그재그가 커지고 느슨하면 벽에 붙어 떨린다.",
      "클릭 이동 경로는 A* 결과를 그대로 쓰지 말고 2~3타일 단위로 스무딩해 부자연스러운 계단 이동을 제거한다.",
      "이동키 우선순위(키보드 > 경로 > 정지)는 씬이 아니라 컨트롤러 내부에서 해결해 계약을 단일화한다.",
    ],
  },
  {
    id: "073",
    title: "해상도 반응형 HUD 스케일링 및 모바일 터치 영역 최적화",
    role: [
      "HUD(DOM 오버레이)는 게임 캔버스와 별개의 반응형 스케일 체계를 갖는다. CSS 변수(--hud-scale)에 뷰포트 폭 기반 스케일을 주입(003번 ResponsiveScaler)하고, 모든 HUD 패널은 transform: scale(var(--hud-scale))로 동일 배율을 따른다. 터치 타깃은 최소 44x44px(Apple HIG 기준)을 CSS 변수(--touch-min)로 보장해 손가락 미스터치를 줄인다.",
      "레이아웃은 안전 영역(safe-area-inset)을 반영해야 한다. 아이폰 노치/홈바 영역에 HUD 요소가 침범하면 시스템 제스처와 충돌한다. env(safe-area-inset-*)을 CSS에 적용하고, 가로 고정(화면 회전 잠금 유도) 상태에서 좌우 여백을 동적으로 계산한다. 또한 미니맵·채팅·스킬바 같은 핵심 HUD는 중앙 상단/하단의 '엄지 비충돌 구역'에 배치하는 것이 표준이다.",
    ],
    blocks: [
      {
        lang: "src/ui/hud.css + HudLayout.ts",
        code: `/* ── HUD 반응형 CSS ─────────────────────────── */
:root {
  --hud-scale: 1;
  --touch-min: 32px;                 /* 모바일에서 JS가 44px로 교체 */
}
html, body { margin: 0; overflow: hidden; touch-action: none; }
#hud {
  position: fixed; inset: 0;
  padding: calc(env(safe-area-inset-top) + 8px)
           calc(env(safe-area-inset-right) + 8px)
           calc(env(safe-area-inset-bottom) + 8px)
           calc(env(safe-area-inset-left) + 8px);
  pointer-events: none;              /* 자식만 상호작용 */
}
.hud-panel {
  transform: scale(var(--hud-scale));
  transform-origin: top left;
  pointer-events: auto;
}
.hud-btn {
  min-width: var(--touch-min);
  min-height: var(--touch-min);
  display: grid; place-items: center;
  border-radius: 10px;
}
/* 스킬바: 하단 중앙 — 엄지 비충돌 구역 */
#skillbar {
  position: absolute; left: 50%; bottom: 12px;
  transform: translateX(-50%) scale(var(--hud-scale));
  display: flex; gap: 8px;
}
/* 모바일 전용: 조이스틱 우측 스킬 휠 */
@media (pointer: coarse) {
  #skillbar { bottom: calc(env(safe-area-inset-bottom) + 96px); }
  .hud-chat { opacity: 0.85; max-width: 46vw; }   /* 화면 좌측 절반 이하 */
}`,
      },
      {
        lang: "src/ui/HudLayout.ts — 스케일 주입 + 세이프 에어리어",
        code: `export class HudLayout {
  constructor(private hudRoot: HTMLElement) {}

  /** ResponsiveScaler(003번)에서 호출 */
  apply(viewportW: number, viewportH: number, isMobile: boolean) {
    const scale = isMobile
      ? Math.max(0.9, Math.min(viewportW / 1280, 1.5))
      : Math.max(0.8, Math.min(viewportW / 1280, 1.35));
    this.hudRoot.style.setProperty("--hud-scale", scale.toFixed(3));
    this.hudRoot.style.setProperty("--touch-min", isMobile ? "44px" : "32px");

    // 세이프 에어리어 미지원 브라우저 폴백(노치 폰 추정 여백)
    if (!CSS.supports("padding-left: env(safe-area-inset-left)")) {
      const portrait = viewportH > viewportW;
      const notch = isMobile && portrait ? 24 : 0;
      this.hudRoot.style.padding =
        notch + "px 12px " + (isMobile ? 16 : 8) + "px 12px";
    }
  }

  /** 터치 타깃 실측 검증(개발 콘솔용): 44px 미만 요소 나열 */
  auditTouchTargets() {
    const min = parseFloat(getComputedStyle(this.hudRoot)
      .getPropertyValue("--touch-min"));
    const bad: Element[] = [];
    this.hudRoot.querySelectorAll("button, .hud-btn, [data-touch]").forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width < min - 2 || r.height < min - 2) bad.push(el);
    });
    if (bad.length) console.warn("[HUD] touch targets below " + min + "px:", bad);
    return bad;
  }
}`,
      },
    ],
    tips: [
      "HUD는 pointer-events: none(컨테이너) + auto(요소) 패턴으로 게임 캔버스 터치를 막지 않아야 한다.",
      "transform: scale은 레이아웃 재계산이 없어 font-size 기반 반응형보다 프레임 비용이 훨씬 저렴하다.",
      "safe-area-inset 미지원 브라우저 폴백(노치 추정)은 중국 안드로이드 계열에서 반드시 필요하다.",
      "auditTouchTargets를 CI 스크린샷 테스트와 함께 돌리면 터치 타깃 위반을 코드 리뷰 전에 잡는다.",
    ],
  },
  {
    id: "074",
    title: "터치 제스처 (핀치 투 줌, 스와이프) 이벤트 핸들러",
    role: [
      "멀티터치 제스처는 두 손가락(핀치 줌)과 빠른 한 손가락(스와이프)을 구분해 처리한다. 핀치 줌은 두 터치 포인트 사이 거리 변화율로 카메라 줌을 조절하고, 스와이프는 이동 속도(빠른 이동 = 지나간 거리/시간)와 방향으로 퀵슬롯 페이지 전환(076번)이나 카메라 스냅을 트리거한다. 제스처 인식기는 '터치 시작 → 움직임 추적 → 판정(거리/시간 임계)'의 상태머신으로 구현한다.",
      "핵심은 조이스틱(071번)과의 충돌 방지다. 첫 손가락이 조이스틱이면 두 번째 손가락만 제스처 대상이 되고, 반대로 두 손가락이 동시에 화면에 나타나면(조이스틱 시작 전) 핀치로 판정한다. 또한 브라우저 기본 제스처(페이지 줌/당겨서 새로고침)를 touch-action: none과 preventDefault로 차단해 게임 내 제스처가 OS 제스처와 섞이지 않게 한다.",
    ],
    blocks: [
      {
        lang: "src/input/Gesture.ts",
        code: `export interface GestureHandlers {
  pinch: (scaleDelta: number) => void;     // 1.0 = 변화 없음
  swipe: (dir: "left" | "right" | "up" | "down", speedPxMs: number) => void;
  tap?: (x: number, y: number) => void;
}

const PINCH_THRESHOLD = 0.06;             // 줌 판정 변화율
const SWIPE_DIST = 60;                    // px
const SWIPE_MAX_MS = 260;
const TAP_MAX_MS = 200, TAP_MAX_DIST = 12;

export class GestureRecognizer {
  private pointers = new Map<number, { x: number; y: number; t: number; startX: number; startY: number }>();
  private startDist = 0;
  private startZoom = 1;
  private reserved = false;               // 조이스틱이 선점한 첫 터치

  constructor(private root: HTMLElement, private handlers: GestureHandlers,
              joystickReserve: { isCapturing: (pointerId: number) => boolean }) {
    this.joystickReserve = joystickReserve;
    root.addEventListener("pointerdown", e => this.down(e));
    root.addEventListener("pointermove", e => this.move(e));
    root.addEventListener("pointerup", e => this.up(e));
    root.addEventListener("pointercancel", e => this.up(e));
  }
  private joystickReserve: { isCapturing: (id: number) => boolean };

  private down(e: PointerEvent) {
    if (this.joystickReserve.isCapturing(e.pointerId)) { this.reserved = true; return; }
    this.pointers.set(e.pointerId, {
      x: e.clientX, y: e.clientY, t: performance.now(),
      startX: e.clientX, startY: e.clientY,
    });
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.startDist = Math.hypot(a.x - b.x, a.y - b.y);
      this.startZoom = 1;
    }
  }

  private move(e: PointerEvent) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX; p.y = e.clientY;

    if (this.pointers.size === 2 && this.startDist > 0) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const delta = d / this.startDist - 1;
      if (Math.abs(delta - (this.startZoom - 1)) > PINCH_THRESHOLD) {
        this.handlers.pinch(1 + delta);
        this.startZoom = 1 + delta;
      }
    }
  }

  private up(e: PointerEvent) {
    const p = this.pointers.get(e.pointerId);
    if (!p) { this.reserved = false; return; }
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 2) this.startDist = 0;   // 핀치 끊김 → 재시작

    const dt = performance.now() - p.t;
    const dx = e.clientX - p.startX, dy = e.clientY - p.startY;
    const dist = Math.hypot(dx, dy);

    if (this.pointers.size === 0) {
      if (dt < TAP_MAX_MS && dist < TAP_MAX_DIST) {
        this.handlers.tap?.(e.clientX, e.clientY);
      } else if (dist > SWIPE_DIST && dt < SWIPE_MAX_MS) {
        const dir = Math.abs(dx) > Math.abs(dy)
          ? (dx > 0 ? "right" : "left")
          : (dy > 0 ? "down" : "up");
        this.handlers.swipe(dir, dist / dt);
      }
    }
  }
}`,
      },
    ],
    tips: [
      "핀치는 거리 변화율(배수)로 계산하되 판정 임계(6%)를 두어 손가락 떨림으로 줌이 왔다 갔다 하는 것을 막는다.",
      "스와이프는 거리와 시간(속도)을 함께 판정해야 의도된 제스처와 그냥 드래그가 구분된다.",
      "조이스틱 선점(reserve) 상태를 제스처 인식기에 알려주는 인터페이스가 멀티터치 충돌의 해법이다.",
      "브라우저 기본 제스처 차단(touch-action: none, preventDefault)은 iOS 사파리에서 특히 중요하다.",
    ],
  },
  {
    id: "075",
    title: "드래그 앤 드롭 & 터치 인벤토리 아이템 그리드 인터페이스",
    role: [
      "인벤토리 UI는 '그리드(칸) 기반 렌더 + 드래그 앤 드롭(마우스) + 탭-홀드-이동(터치)'을 하나의 드래그 세션 모델로 처리한다. 드래그 세션은 (1) 원본 칸에서 시작, (2) 자유 이동 중 고스트(반투명 아이콘) 표시, (3) 드롭 대상 판정(칸/장비 슬롯/퀵슬롯/삭제), (4) 서버 요청 → 성공 시 로컬 반영, 실패 시 원위치의 흐름이다. HTML5 DnD API는 모바일 미지원이므로 pointer 이벤트로 직접 구현한다.",
      "터치에서는 롱프레스(300ms)로 드래그 시작을 판정해 일반 스크롤과 구분한다. 서버 동기화는 낙관적(로컬 먼저 반영 → 실패 시 롤백)이되, 스택 분할(Shift 클릭/분할 모달)과 장비 착용(장비 슬롯 드롭)은 각각 전용 요청으로 분기한다. 60칸 그리드는 DOM 재사용(가상화 불필요 수준) + CSS grid로 구현해 렌더 비용을 낮춘다.",
    ],
    blocks: [
      {
        lang: "src/ui/InventoryGrid.ts",
        code: `import Phaser from "phaser";

export interface InvItem {
  id: number; itemCode: string; qty: number;
  bagSlot: number;                    // 그리드 칸
}
export type DropTarget =
  | { kind: "slot"; index: number }             // 인벤토리 칸
  | { kind: "equip"; part: string }             // 장비 슬롯
  | { kind: "quickslot"; slot: number };        // 퀵슬롯(076번)

export class InventoryGrid {
  private drag: { item: InvItem; ghost: HTMLDivElement; x: number; y: number }
    | null = null;
  private pressTimer = 0;

  constructor(private rootEl: HTMLElement,
              private cellSize = 52,
              private api: {
                moveItem(itemId: number, toSlot: number): Promise<boolean>;
                equipItem(itemId: number): Promise<boolean>;
              }) {}

  /** pointer 이벤트 통합(마우스/터치 공용) */
  bind() {
    this.rootEl.addEventListener("pointerdown", e => this.start(e));
    this.rootEl.addEventListener("pointermove", e => this.move(e));
    window.addEventListener("pointerup", e => this.end(e));
    window.addEventListener("pointercancel", () => this.cancel());
  }

  private cellAt(x: number, y: number): number | null {
    const rect = this.rootEl.getBoundingClientRect();
    const cx = Math.floor((x - rect.left) / this.cellSize);
    const cy = Math.floor((y - rect.top) / this.cellSize);
    return (cx >= 0 && cy >= 0) ? cy * this.columns() + cx : null;
  }
  private columns() {
    return Math.floor(this.rootEl.clientWidth / this.cellSize);
  }

  private start(e: PointerEvent) {
    const slot = this.cellAt(e.clientX, e.clientY);
    if (slot == null) return;
    const item = (this as any).items?.find?.((i: InvItem) => i.bagSlot === slot);
    if (!item) return;
    // 터치: 롱프레스 300ms 후 드래그 / 마우스: 즉시
    if (e.pointerType === "touch") {
      this.pressTimer = window.setTimeout(() => this.beginDrag(item, e), 300);
    } else {
      this.beginDrag(item, e);
    }
  }

  private beginDrag(item: InvItem, e: PointerEvent) {
    const ghost = document.createElement("div");
    ghost.className = "inv-ghost";
    ghost.textContent = item.itemCode;
    document.body.appendChild(ghost);
    this.drag = { item, ghost, x: e.clientX, y: e.clientY };
    this.positionGhost(e.clientX, e.clientY);
  }

  private move(e: PointerEvent) {
    if (!this.drag) return;
    // 롱프레스 대기 중 이동 → 드래그 취소(스크롤로 판단)
    if (this.pressTimer && (e.pointerType === "touch")) {
      clearTimeout(this.pressTimer); this.pressTimer = 0; return;
    }
    this.drag.x = e.clientX; this.drag.y = e.clientY;
    this.positionGhost(e.clientX, e.clientY);
  }

  private async end(e: PointerEvent) {
    clearTimeout(this.pressTimer); this.pressTimer = 0;
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    d.ghost.remove();

    const target = this.resolveTarget(e);
    const orig = d.item.bagSlot;
    if (!target) return;
    if (target.kind === "slot" && target.index !== orig) {
      const ok = await this.api.moveItem(d.item.id, target.index);
      if (!ok) (this as any).render?.();          // 실패 시 원위치 리렌더
    } else if (target.kind === "equip") {
      await this.api.equipItem(d.item.id);
    }
    // quickslot은 076번 시스템에 위임
  }

  private resolveTarget(e: PointerEvent): DropTarget | null {
    const slot = this.cellAt(e.clientX, e.clientY);
    if (slot != null) return { kind: "slot", index: slot };
    const eq = (e.target as HTMLElement).closest?.("[data-equip-part]");
    if (eq) return { kind: "equip", part: (eq as HTMLElement).dataset.equipPart! };
    const qs = (e.target as HTMLElement).closest?.("[data-quickslot]");
    if (qs) return { kind: "quickslot", slot: Number((qs as HTMLElement).dataset.quickslot) };
    return null;
  }
  private positionGhost(x: number, y: number) {
    if (!this.drag) return;
    this.drag.ghost.style.left = x - this.cellSize / 2 + "px";
    this.drag.ghost.style.top = y - this.cellSize / 2 + "px";
  }
  private cancel() {
    clearTimeout(this.pressTimer); this.pressTimer = 0;
    this.drag?.ghost.remove(); this.drag = null;
  }
}`,
      },
    ],
    tips: [
      "HTML5 DnD API(dragstart 등)는 모바일에서 동작하지 않는다 — pointer 이벤트로 통합 구현해야 PC/터치가 한 코드로 동작한다.",
      "터치 롱프레스(300ms) + 이동 취소 판정으로 일반 스크롤과 드래그를 구분한다.",
      "서버 요청은 낙관적 반영 + 실패 롤백이 원칙이며, 롤백은 전체 리렌더(간단하고 안전)로 처리한다.",
      "장비 슬롯/퀵슬롯 드롭 판정은 closest([data-...]) 셀렉터 기반이 확장성이 가장 좋다.",
    ],
  },
];
