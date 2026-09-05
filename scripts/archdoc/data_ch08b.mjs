// 모듈 8 (076~080): UI/UX 및 크로스플랫폼 가용성 — 후반부

export const items = [
  {
    id: "076",
    title: "퀵슬롯 커스텀 배치 및 다중 페이지 스와이프 UI",
    role: [
      "퀵슬롯은 '스킬/아이템을 슬롯(1~6, 2페이지)에 자유 배치하고 키보드 숫자키/터치로 실행'하는 조작의 중심이다. 배치 데이터는 (슬롯 인덱스 → 바인딩(스킬 코드 또는 아이템 코드))의 세이브 구조로 서버에 저장되고, 075번 인벤토리 드래그로 퀵슬롯에 끌어다 놓으면 바인딩이 갱신된다. 쿨타임 오버레이(032번 ResourceMgr 잔여 시간)와 수량 표시를 각 슬롯에 렌더한다.",
      "모바일에서는 2페이지 구성 + 스와이프 전환이 표준이다. 스와이프는 074번 제스처 인식기에서 방향/속도 이벤트를 받아 페이지를 전환하고, 전환 애니메이션(0.2s 트랜지션) 중 입력은 무시해 이중 전환을 막는다. 페이지 전환은 '스와이프'와 '페이지 도트 탭' 두 경로를 모두 제공하고, 현재 페이지 번호는 세이브에 유지해 재접속 시 복원한다.",
    ],
    blocks: [
      {
        lang: "src/ui/QuickslotBar.ts",
        code: `import type { SlotBinding } from "../game/quickslot";

export class QuickslotBar {
  private page = 0;                          // 0 | 1
  private pages: SlotBinding[][] = [[], []];
  private animating = false;
  private cooldowns = new Map<string, number>();   // 바인딩 key → 잔여 ms

  constructor(private rootEl: HTMLElement,
              private exec: (b: SlotBinding) => void,
              private save: (pages: SlotBinding[][], page: number) => void) {
    this.rootEl.addEventListener("click", e => this.onTap(e));
  }

  /** 드래그 드롭(075번)에서 호출 */
  async dropTo(slotIndex: number, binding: SlotBinding) {
    this.pages[this.page][slotIndex] = binding;
    this.render();
    this.save(this.pages, this.page);          // 서버 세이브
  }

  /** 스와이프(074번 제스처)로 페이지 전환 */
  swipePage(dir: "left" | "right") {
    if (this.animating) return;
    const next = dir === "left" ? Math.min(1, this.page + 1)
                                : Math.max(0, this.page - 1);
    if (next === this.page) return;
    this.animating = true;
    this.page = next;
    this.render();
    this.save(this.pages, this.page);
    setTimeout(() => { this.animating = false; }, 220);
  }

  /** 쿨타임 게이지 갱신(032번 ResourceMgr에서 주입) */
  setCooldown(bindingKey: string, remainMs: number, totalMs: number) {
    this.cooldowns.set(bindingKey, remainMs);
    const el = this.rootEl.querySelector<HTMLElement>(
      "[data-slot-idx] .cd-overlay[data-key='" + bindingKey + "']");
    if (!el || totalMs <= 0) return;
    el.style.height = (remainMs / totalMs * 100).toFixed(1) + "%";
  }

  private onTap(e: MouseEvent) {
    const btn = (e.target as HTMLElement).closest("[data-slot-idx]");
    if (!btn) return;
    const idx = Number((btn as HTMLElement).dataset.slotIdx);
    const b = this.pages[this.page][idx];
    if (b) this.exec(b);
  }

  private render() {
    this.rootEl.dataset.page = String(this.page);
    this.rootEl.style.transform = "translateX(" + (-this.page * 100) + "%)";
    this.rootEl.style.transition = "transform 0.2s ease";
  }
}`,
      },
      {
        lang: "src/game/quickslot.ts — 바인딩 모델 + 실행 라우팅",
        code: `export type SlotBinding =
  | { kind: "skill"; code: string; label: string }
  | { kind: "item"; itemCode: string; label: string };

/** 실행 라우팅: 스킬은 ResourceMgr 검증 → 서버 요청, 아이템은 사용 트랜잭션 */
export class QuickslotExecutor {
  constructor(
    private useSkill: (code: string) => void,
    private useItem: (itemCode: string) => void,
    private resource: { canUse(code: string): { ok: boolean; reason?: string } },
  ) {}

  exec(b: SlotBinding) {
    if (b.kind === "skill") {
      const gate = this.resource.canUse(b.code);
      if (!gate.ok) {
        // 거절 사유별 UI 피드백(032번 reject 규칙 재사용)
        if (gate.reason === "cooldown") this.flash(b.code, "cd");
        if (gate.reason === "mp") this.flash(b.code, "mp");
        return;
      }
      this.useSkill(b.code);
    } else {
      this.useItem(b.itemCode);
    }
  }
  private flash(code: string, kind: "cd" | "mp") {
    document.dispatchEvent(new CustomEvent("slot-flash",
      { detail: { code, kind } }));
  }
}`,
      },
    ],
    tips: [
      "쿨타임 오버레이는 CSS 높이 퍼센트 방식이 가장 저렴하다 — 캔버스에서 다시 그리면 불필요한 오버헤드가 된다.",
      "페이지 전환 애니메이션 중 입력 무시(animating 플래그)는 이중 스와이프로 페이지가 날아가는 버그를 막는다.",
      "퀵슬롯 배치는 서버 세이브로 — 디바이스마다 다르게 하고 싶으면 로컬 오버라이드 레이어를 별도로 둔다.",
      "숫자키(1~6)와 터치 탭이 같은 exec 라우팅을 타야 PC/모바일 동작이 완전히 일치한다.",
    ],
  },
  {
    id: "077",
    title: "착용 장비 vs 선택 장비 스탯 비교 툴팁 레이어",
    role: [
      "장비 비교 툴팁은 '현재 착용 중인 동일 부위 장비'와 '선택한(호버/터치한) 장비'의 스탯 차이를 즉시 시각화한다. 표준 레이아웃은 좌우 2열(선택 장비 vs 착용 장비) + 차이 표시(증가 초록/감소 빨강, 수치와 %)다. 비교 대상 스탯은 item_def.base_mods + 랜덤 옵션(029번) + 강화 보너스(025번)의 합산 결과(021번 StatMath 장비 소스)로 계산한다.",
      "모바일에서는 호버가 없으므로 '탭 = 선택, 정보 버튼 = 툴팁 오픈'의 2단 상호작용을 쓴다. 툴팁은 화면 경계 플립(오른쪽이 넘치면 왼쪽 표시)과 뷰포트 클램프를 수행하며, 드래그 드롭(075번) 호버 중에도 동일 컴포넌트를 재사용해 '드래그 중 비교'를 지원한다. 차이 계산은 순수 함수로 분리해 도감/거래 UI에서도 재사용한다.",
    ],
    blocks: [
      {
        lang: "src/ui/StatCompare.ts",
        code: `import type { StatMod } from "../game/StatMath";

export interface EquipStats { mods: StatMod[]; enhance: number; }
export interface CompareRow { stat: string; a: number; b: number; diff: number; }

/** 장비 스탯 합산(강화 보너스 + RO 포함) — 021번 computeFinal의 장비 소스 재사용 */
export function sumEquipStats(s: EquipStats): Record<string, number> {
  const out: Record<string, number> = {};
  const bonus = 1 + 0.12 * s.enhance;               // 025번 강화 배율
  for (const m of s.mods) {
    const v = (m.flat ?? 0) * (m.flat ? bonus : 1);
    out[m.stat] = (out[m.stat] ?? 0) + v;
    if (m.mul) out["%" + m.stat] = (out["%" + m.stat] ?? 0) + m.mul;
  }
  return out;
}

export function compare(selected: EquipStats, equipped: EquipStats): CompareRow[] {
  const A = sumEquipStats(selected), B = sumEquipStats(equipped);
  const keys = new Set([...Object.keys(A), ...Object.keys(B)]);
  const rows: CompareRow[] = [];
  for (const k of keys) {
    const a = A[k] ?? 0, b = B[k] ?? 0;
    const diff = Math.round((a - b) * 100) / 100;
    if (diff === 0) continue;
    rows.push({ stat: k, a: Math.round(a * 100) / 100,
                b: Math.round(b * 100) / 100, diff });
  }
  // 중요 스탯(atk/hp 등) 우선 정렬
  const PRIORITY = ["atk", "matk", "def", "hp", "crit"];
  return rows.sort((r1, r2) => {
    const pi = PRIORITY.indexOf(r1.stat), pj = PRIORITY.indexOf(r2.stat);
    return (pi < 0 ? 99 : pi) - (pj < 0 ? 99 : pj);
  });
}

/** 툴팁 렌더 + 화면 경계 플립 */
export class CompareTooltip {
  private el: HTMLElement;
  constructor(root: HTMLElement) {
    this.el = document.createElement("div");
    this.el.className = "compare-tip";
    root.appendChild(this.el);
    this.el.style.display = "none";
  }

  show(x: number, y: number, rows: CompareRow[], names: { a: string; b: string }) {
    const html = ["<table><thead><tr><th>" + names.a + "</th><th>차이</th><th>" + names.b + "</th></tr></thead><tbody>"];
    for (const r of rows) {
      const cls = r.diff > 0 ? "up" : "down";
      html.push("<tr><td>" + r.stat + ": " + r.a + "</td>"
        + "<td class='" + cls + "'>" + (r.diff > 0 ? "+" : "") + r.diff + "</td>"
        + "<td>" + r.stat + ": " + r.b + "</td></tr>");
    }
    html.push("</tbody></table>");
    this.el.innerHTML = html.join("");
    this.el.style.display = "block";
    // 경계 플립: 우측 넘침 시 좌측 배치
    const rect = this.el.getBoundingClientRect();
    const vw = window.innerWidth;
    this.el.style.left = (x + rect.width + 16 > vw ? x - rect.width - 16 : x + 16) + "px";
    this.el.style.top = Math.max(8, Math.min(y, window.innerHeight - rect.height - 8)) + "px";
  }
  hide() { this.el.style.display = "none"; }
}`,
      },
    ],
    tips: [
      "차이 계산은 반드시 '합산된 최종 장비 스탯'끼리 비교한다 — 모드 배열끼리 비교하면 강화/RO가 누락된다.",
      "증가/감소 색상(초록/빨강)은 '선택 장비 기준'으로 통일해 유저가 헷갈리지 않게 한다.",
      "경계 플립과 뷰포트 클램프는 모바일(좁은 화면)에서 필수다 — getBoundingClientRect로 실측한다.",
      "% 스탯(mul)과 flat 스탯은 다른 행으로 분리 표시해 '공격력 +5 vs 공격력 +10%' 비교 혼란을 막는다.",
    ],
  },
  {
    id: "078",
    title: "퀘스트 자동 길찾기 경로 내비게이션 라인 표시",
    role: [
      "퀘스트 내비게이션은 '목표 지점(NPC/몬스터 구역)까지의 경로를 화면에 라인 + 목적지 화살표로 표시'하는 기능이다. 경로는 A*(043번)로 계산하고, 화면 표시는 (1) 월드 공간 경로 라인(지면 위 반투명 점선), (2) 화면 가장자리 목적지 방향 화살표(타깃이 화면 밖일 때), (3) 거리 표시(몇 미터)의 3계층으로 구성한다. 경로는 목적지 이동/맵 전환 시 재계산하며, 캐릭터가 경로에서 벗어나면(3타일 이상) 자동 재계산한다.",
      "맵 전환을 동반하는 목적지는 '포탈까지의 경로 + 포탈 이름 + 다음 맵명'을 표시해 체인 내비게이션을 만든다. 라인 렌더는 Phaser Graphics를 쓰되 매 프레임 다시 그리지 않고 경로 갱신 시점에만 다시 그린다. 경로 스무딩(코너 절단)으로 자연스러운 곡선을 만들고, 저사양 기기에서는 라인 대신 화살표만 표시하는 품질 단계(001번)를 둔다.",
    ],
    blocks: [
      {
        lang: "src/ui/QuestNavigator.ts",
        code: `import Phaser from "phaser";
import type { AStar } from "../../shared/astar";

const TILE = 32;
const RECALC_DIST = TILE * 3;             // 경로 이탈 재계산 임계

export class QuestNavigator {
  private path: { x: number; y: number }[] = [];
  private goal: { x: number; y: number; mapId: string } | null = null;
  private g: Phaser.GameObjects.Graphics;
  private lastRecalcAt = 0;

  constructor(private scene: Phaser.Scene, private astar: AStar,
              private mapW: number, mapH: number) {
    this.g = scene.add.graphics().setDepth(4500);
    (this as any).mapH = mapH;
  }

  /** 목적지 설정(퀘스트 트래커에서 호출) */
  setGoal(goal: { x: number; y: number; mapId: string } | null) {
    this.goal = goal;
    this.path = [];
    this.lastRecalcAt = 0;
  }

  /** 고정 업데이트(0.5초 주기 재계산) */
  update(self: { x: number; y: number }, now: number) {
    if (!this.goal) { this.g.clear(); return; }
    if (now - this.lastRecalcAt > 500 || this.offPath(self)) {
      this.recalc(self);
      this.lastRecalcAt = now;
    }
    this.render(self);
  }

  private offPath(self: { x: number; y: number }): boolean {
    if (!this.path.length) return true;
    const next = this.path[0];
    return Math.hypot(next.x - self.x, next.y - self.y) > RECALC_DIST * 2;
  }

  private recalc(self: { x: number; y: number }) {
    if (!this.goal) return;
    const sx = Math.floor(self.x / TILE), sy = Math.floor(self.y / TILE);
    const tx = Math.floor(this.goal.x / TILE), ty = Math.floor(this.goal.y / TILE);
    const raw = this.astar.find(sx, sy, tx, ty);
    if (!raw) return;
    // 경로 스무딩: 2타일 간격 샘플 + 코너 절단
    this.path = [];
    for (let i = 2; i < raw.length; i += 4) {
      this.path.push({ x: raw[i] * TILE + TILE / 2, y: raw[i + 1] * TILE + TILE / 2 });
    }
    this.path.push({ x: this.goal.x, y: this.goal.y });
  }

  /** 렌더: 경로 라인(점선) + 화면 밖 목적지 화살표 */
  private render(self: { x: number; y: number }) {
    const cam = this.scene.cameras.main;
    this.g.clear();
    if (!this.path.length || !this.goal) return;

    // 1) 경로 라인(월드 좌표 → 화면)
    this.g.lineStyle(3, 0x4ad0ff, 0.7);
    this.g.beginPath();
    const pts = [self, ...this.path];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      this.g.moveTo(a.x - cam.scrollX, a.y - cam.scrollY);
      this.g.lineTo(b.x - cam.scrollX, b.y - cam.scrollY);
    }
    this.g.strokePath();

    // 2) 목적지가 화면 밖 → 가장자리 화살표
    const sx = this.goal.x - cam.scrollX, sy = this.goal.y - cam.scrollY;
    const inView = sx > 0 && sy > 0 && sx < cam.width && sy < cam.height;
    if (!inView) {
      const ang = Math.atan2(sy - cam.height / 2, sx - cam.width / 2);
      const ex = cam.width / 2 + Math.cos(ang) * (Math.min(cam.width, cam.height) / 2 - 40);
      const ey = cam.height / 2 + Math.sin(ang) * (Math.min(cam.width, cam.height) / 2 - 40);
      this.g.fillStyle(0x4ad0ff, 0.9);
      this.g.save();
      this.g.translateCanvas(ex, ey);
      this.g.rotateCanvas(ang);
      this.g.fillTriangle(-14, -10, -14, 10, 14, 0);
      this.g.restore();
      // 거리 표시
      const dist = Math.hypot(this.goal.x - self.x, this.goal.y - self.y);
      this.scene.add.text(ex, ey + 16, Math.round(dist / TILE) + "m",
        { fontSize: "12px", color: "#4ad0ff" }).setOrigin(0.5);
    }
  }
}`,
      },
    ],
    tips: [
      "재계산 주기(0.5초) + 이탈 임계(3타일) 조합으로 탐색 빈도와 경로 신선도의 균형을 맞춘다.",
      "라인 렌더는 경로 갱신 시에만 다시 그린다 — 매 프레임 clear+redraw는 저사양 기기에서 눈에 띄는 비용이다.",
      "화면 가장자리 화살표 + 거리 표시는 타깃이 안 보일 때 가장 효과적인 안내이며, 미니맵(048번)과 방향이 일치해야 한다.",
      "맵 전환 목적지는 체인 표시(포탈 → 다음 맵명)로 UX를 완성해 '길이 끊긴 느낌'을 없앤다.",
    ],
  },
  {
    id: "079",
    title: "모바일 절전 모드 (프레임 제한 및 화면 암전 처리)",
    role: [
      "모바일 장기 세션에서 배터리 소모의 주범은 60fps 풀렌더와 화면 밝기다. 절전 모드는 두 단계로 대응한다. 첫째, 입력 없음 상태가 지속되면 프레임 제한(60 → 30fps)으로 렌더 비용을 절반으로 줄이고, 둘째, 장시간(3분) 무입력이면 UI를 점진 암전(오버레이 알파 상승)해 OLED 화면 전력을 줄인다. 어떤 입력(터치/키)이든 즉시 복귀한다.",
      "구현은 (1) 마지막 입력 시각 추적, (2) 단계별 상태머신(active → eco30 → dim), (3) 복귀 트랜지션의 구조다. 프레임 제한은 Phaser fps target 변경 또는 수동 rAF 스로틀로 구현하며, 암전 오버레이는 캔버스 위 DOM(불투명도 전환)으로 화면 밝기 감지(OLED)와 무관하게 확실한 전력 절감을 만든다. 오토 배틀(033번) 실행 중에는 암전을 생략해 진행 상황을 볼 수 있게 한다.",
    ],
    blocks: [
      {
        lang: "src/engine/PowerSaver.ts",
        code: `import Phaser from "phaser";

export type PowerState = "active" | "eco30" | "dim";
const ECO_AFTER_MS = 20_000;      // 20초 무입력 → 30fps
const DIM_AFTER_MS = 180_000;     // 3분 무입력 → 암전

export class PowerSaver {
  private state: PowerState = "active";
  private lastInput = performance.now();
  private overlay: HTMLDivElement;
  private rafThrottle = 0;

  constructor(private game: Phaser.Game,
              private isActiveBattle: () => boolean) {
    this.overlay = document.createElement("div");
    this.overlay.className = "power-dim";
    this.overlay.style.cssText =
      "position:fixed;inset:0;background:#000;opacity:0;" +
      "transition:opacity 1.5s;pointer-events:none;z-index:9998;";
    document.body.appendChild(this.overlay);

    for (const ev of ["pointerdown", "keydown", "touchstart"]) {
      window.addEventListener(ev, () => this.onInput(), { passive: true });
    }
  }

  private onInput() {
    this.lastInput = performance.now();
    if (this.state !== "active") this.restore();
  }

  /** 고정 업데이트(1초 주기) */
  tick(now: number) {
    const idle = now - this.lastInput;
    if (idle > DIM_AFTER_MS && this.state !== "dim" && !this.isActiveBattle()) {
      this.state = "dim";
      this.overlay.style.opacity = "0.55";         // 부드러운 암전
      this.setFrameRate(30);
    } else if (idle > ECO_AFTER_MS && this.state === "active") {
      this.state = "eco30";
      this.setFrameRate(30);
    }
  }

  /** 프레임 제한: rAF 스로틀(Phaser fps 재설정보다 부드럽다) */
  private setFrameRate(fps: number) {
    const minFrame = 1000 / fps;
    this.game.events.emit("power-fps", fps);
    const loop = this.game.loop as any;
    if (loop && "time" in loop) {
      // Phaser Loop 대체 스로틀: 외부 rAF에서 minFrame 간격으로 step 호출
      this.rafThrottle = minFrame;
    }
  }

  private restore() {
    this.state = "active";
    this.overlay.style.opacity = "0";
    this.rafThrottle = 0;
    this.game.events.emit("power-fps", 60);
  }

  get currentState() { return this.state; }
}

/* CSS: .power-dim 트랜지션은 JS opacity 제어만으로 충분 */

// 통합 방식(대안): Phaser fps.target 변경
// this.game.loop.actualFps — Phaser 3.60+ 에서 game.loop.targetFps 조정 가능
// 그러나 fps 재설정은 오디오 스케줄 드리프트를 일으킬 수 있으므로
// 오디오 재생 중(주인공 액션 사운드)에는 30fps 전환을 미룬다.`,
      },
    ],
    tips: [
      "절전 단계(20초 30fps → 3분 암전)는 유저가 체감하지 못하는 선에서 최대한 공격적으로 설정한다.",
      "암전은 OLED에서 전력 절감이 크지만, 오토 배틀 중에는 생략해 진행 상황 가시성을 유지한다.",
      "입력 복귀는 즉시(트랜지션 1.5s는 시각적 페이드만) — 조작 지연이 느껴지면 절전 기능이 결함처럼 느껴진다.",
      "30fps 전환은 파티클 수도 절반으로(045번) 줄여 렌더 비용을 두 축으로 절감한다.",
    ],
  },
  {
    id: "080",
    title: "브라우저 웹 푸시 알림 (Web Push Notification) 연동",
    role: [
      "웹 푸시는 서버 이벤트(길드전 시작, 파티 초대, 경매 낙찰)를 게임 밖(탭 닫힘/다른 앱 사용 중)으로 전달하는 채널이다. 구조는 (1) 클라: Notification.requestPermission + PushManager 구독(subscription 엔드포인트 서버 전송), (2) 서버: VAPID 키로 서명한 푸시 발송(web-push 라이브러리), (3) Service Worker: 푸시 수신 → 알림 표시 → 클릭 시 게임 딥링크 오픈이다.",
      "설계 원칙은 유저 통제다. 알림 유형별(길드/파티/경매/친구) 옵트인을 개별 설정으로 제공하고, 기본값은 끔 — 권한 요청은 게임 내 '유용한 순간'(길드 가입 직후 등)에 문맥적으로 요청해 거부율을 낮춘다. 구독은 브라우저/기기 단위로 만료가 있으므로, 서버는 발송 실패(410 Gone) 시 구독을 자동 정리한다. 푸시 페이로드는 최소화(제목+본문+딥링크)해 데이터 절약 규정을 준수한다.",
    ],
    blocks: [
      {
        lang: "src/push/PushClient.ts — 클라 구독",
        code: `const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function enablePush(kind: "guild" | "party" | "auction") {
  // 1) 권한 요청(게임 내 문맥 버튼에서 호출 — 자동 팝업 금지)
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return false;

  // 2) Service Worker 등록 + 구독 생성
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,                       // 스펙 필수
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    });
  }
  // 3) 구독 정보 서버 전송(기기별 유형 옵트인)
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON(), kinds: [kind] }),
  });
  return true;
}`,
      },
      {
        lang: "public/sw.js — Service Worker + server/push/send.ts",
        code: `// ── public/sw.js ──
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(self.registration.showNotification(data.title || "SERTZ", {
    body: data.body,
    icon: "/icons/192.png",
    badge: "/icons/badge.png",
    tag: data.tag || "default",           // 동일 태그 = 알림 교체(스팸 방지)
    data: { url: data.url || "/play" },   // 딥링크
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});

// ── server/push/send.ts (web-push 라이브러리) ──
import webpush from "web-push";
import { Kysely } from "kysely";
type DB = import("../schema").Database;

webpush.setVapidDetails(
  "mailto:ops@example.com",
  process.env.VAPID_PUBLIC!,
  process.env.VAPID_PRIVATE!,
);

export async function pushToUser(db: Kysely<DB>, charId: number,
                                 payload: { title: string; body: string; tag: string; url?: string }) {
  const subs = await db.selectFrom("push_subscriptions")
    .where("character_id", "=", charId).select(["endpoint", "p256dh", "auth"]).execute();
  const results = await Promise.allSettled(subs.map(s =>
    webpush.sendNotification({
      endpoint: s.endpoint,
      keys: { p256dh: s.p256dh, auth: s.auth },
    }, JSON.stringify(payload))));
  // 410 Gone(구독 만료) → 정리
  await Promise.all(results.map(async (r, i) => {
    if (r.status === "rejected" && (r as any).reason?.statusCode === 410) {
      await db.deleteFrom("push_subscriptions")
        .where("endpoint", "=", subs[i].endpoint).execute();
    }
  }));
}`,
      },
    ],
    tips: [
      "권한 요청은 반드시 유저 클릭(게임 내 설정 버튼)에서 — 페이지 로드 즉시 요청하면 거부 후 영구 차단될 수 있다.",
      "알림 tag를 이벤트 유형별로 두면 동일 유형이 교체되어 스팸처럼 쌓이지 않는다.",
      "410 Gone 자동 정리 없이는 만료 구독이 쌓여 발송 실패율이 지표를 오염시킨다.",
      "푸시는 게임 밖 채널이므로 온라인 유저에게는 보내지 않는다(중복 알림 방지) — presence(054번)로 게이팅한다.",
    ],
  },
];
