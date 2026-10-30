import { startRun } from "./sim/deterministic"; // vc183 — 세션 시드
import Phaser from "phaser";
import { GAME_W, GAME_H } from "./config";
import { BootScene } from "./scenes/BootScene";
import { TitleScene } from "./scenes/TitleScene";
import { WorldScene } from "./scenes/WorldScene";
import { attachAudio } from "./audio";
/* v3.0.6 — E2E 정적 검증용 노출 (window.__SERTZ_DEBUG__) */
import * as classesMod from "./classes";
import * as stagesMod from "./stages";
import * as dataMod from "./data";
import { ACC_ANCHORS } from "./acc_anchors"; // v1.2.1 (#1) — E2E 앵커 실측용
import * as partyContentMod from "./partyContent"; // v1.4.3 — 파티 콘텐츠 (E2E 시너지/보드 검증)
import { showRecoveryOverlay } from "../components/game/crashGuard";
import { EventBus } from "../components/game/EventBus"; // vc147 (#29) — 절전 모드 토글 이벤트 // v1.4.5 — 재부팅 루프 차단 수동 복구
import { SFX_THROTTLE_MS, SFX_MAX_CONCURRENT, BGM_VOLUME, SFX_VOLUMES, playBGM, playStageBGM, stageTrack, bgmDebugState, bgmAdvanceForTest, BGM_PLAYLISTS, getBgmVolume, getSfxVolume } from "./audio";

const audioDebug = { throttle: SFX_THROTTLE_MS, cap: SFX_MAX_CONCURRENT, bgm: BGM_VOLUME, volumes: SFX_VOLUMES, getBgmVolume, getSfxVolume };

/**
 * F3 반응형 핵심:
 *  - Scale.RESIZE → 캔버스가 부모(뷰포트)를 항상 1:1로 꽉 채움 — 레터박스/검은 여백 0
 *  - 화면 밀도는 각 씬의 카메라 줌으로 조정 (보기 좋은 세계 단위 유지)
 *    camera zoom = clamp(innerHeight / 560, 1, 2.5) — 0.25 스텝 스냅
 *  - pixelArt + roundPixels → 픽셀아트 선명도 유지
 */

/** 뷰포트 높이 기준 카메라 줌 계산 (씬들 공용) */
export function viewZoom(): number {
  if (typeof window === "undefined") return 1;
  const raw = window.innerHeight / 560;
  return Math.min(2.5, Math.max(1, Math.round(raw * 4) / 4));
}

/* vc204 (지시서 #1 "모바일 화질") — 백버퍼 해상도 상한.
 *  vc178 주석이 계획만 남기고 구현되지 않아, S20+(1440×3200 @ DPR 2.625)처럼
 *  고밀도 기기에서 매 프레임 460만 픽셀을 그렸다. 이 게임 타일은 16~64px
 *  픽셀아트라 그 해상도가 시각적으로 의미가 없고, 발열·배터리만 소모한다.
 *
 *  상한 규칙: CSS 표시 크기는 그대로 두고 **백버퍼의 긴 변**만 BACKBUF_MAX 로 제한.
 *   · PC 1920×1080 → 긴 변 1920 ≤ 1600? 아니오 → 0.83배. 다만 PC 는 화질 우선이라
 *     BACKBUF_MAX 를 1920 으로 두어 1920 화면까지는 원본 유지(초과분만 축소).
 *   · S20+ 1440×3200 → 긴 변 3200 → 0.6배 → GPU 채우기 약 64% 절감.
 *  pixelArt + roundPixels 라 축소해도 픽셀 경계가 흐려지지 않는다(정수배 근처). */
export const BACKBUF_MAX = 1920;
export function renderResolutionFor(w: number, h: number): number {
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return 1;
  const longSide = Math.max(w, h);
  if (longSide <= BACKBUF_MAX) return 1; // 상한 이내 — 원본 화질
  /* 정수배에 가깝게 떨어뜨려 픽셀아트 정렬을 유지한다(0.05 스텝 스냅). */
  const r = BACKBUF_MAX / longSide;
  return Math.max(0.5, Math.floor(r * 20) / 20);
}

/* ================= v1.4.5 (#무한재부팅) — 자가치유 재부팅 예산 =================
 * 유저 리포트: "이상한 돌·ARG 웹페이지 접속 후 복귀 시 게임 무한 재부팅".
 * 원인: 컨텍스트 유실/프리즈 워치독·백그라운드 복귀 재부팅이 전부 무한 reload를
 * 허용했다. 외부 페이지 이동 후 복귀한 WebView는 GPU/컨텍스트 상태가 나빠져
 * 부팅 직후 다시 실패 → reload → 실패 → … 무한 루프.
 * 해결: 세션(탭) 단위 2분 창에 자동 재부팅 2회까지만 허용하고, 초과 시
 * 자동 재부팅을 완전히 중단하고 수동 복구 오버레이를 표시한다.
 * 수동 "다시 시작" 버튼은 예산을 리셋하므로 정상 복구 후 자가치유도 살아난다. */
const REBOOT_WINDOW_MS = 120000;
const REBOOT_MAX = 2;
function rebootLedger(): number[] {
  try {
    const raw = JSON.parse(sessionStorage.getItem("sertz.reboots") ?? "[]") as unknown;
    return Array.isArray(raw) ? raw.filter((n): n is number => typeof n === "number") : [];
  } catch {
    return [];
  }
}
function safeReload(reason: string) {
  const now = Date.now();
  /* vc143 (#눈맵튕김) — 크래시 브레드크럼: 재부팅 이유+순간 성능 스냅샷을 세션에 남겨
   *  "자꾸 튕긴다" 리포트의 원인 파악 가시성 확보 (기존엔 콘솔 외 흔적이 없었다) */
  try {
    const perf = (window as unknown as { __SERTZ_PERF__?: { fps?: number; mode?: string; enemies?: number } }).__SERTZ_PERF__;
    sessionStorage.setItem(
      "sertz.lastcrash",
      JSON.stringify({ reason, at: now, fps: perf?.fps ?? null, mode: perf?.mode ?? null, enemies: perf?.enemies ?? null }),
    );
  } catch { /* 스토리지 불가 환경 무시 */ }
  const list = rebootLedger().filter((t) => now - t < REBOOT_WINDOW_MS);
  if (list.length >= REBOOT_MAX) {
    console.error(`[SERTZ] 재부팅 예산 초과(${reason}) — 자동 재부팅 중단, 수동 복구 대기`);
    showRecoveryOverlay(
      "게임이 반복적으로 재시작된다",
      `자가치유 한도 초과 (${reason}) — 화면이 계속 재부팅되던 문제를 막았다. 다시 시작을 눌러 주세요`,
      "재부팅 루프 방지 — 세이브는 주기적으로 저장되어 대부분 보존된다",
    );
    return;
  }
  list.push(now);
  try {
    sessionStorage.setItem("sertz.reboots", JSON.stringify(list));
  } catch {
    /* 세션 스토리지 불가 환경 — 예산 없이 기존 동작 */
  }
  window.location.reload();
}

export function createGame(parent: HTMLElement): Phaser.Game {
  /* vc183 (액터 기반 결정 문서) — 세션 시드 확정.
   *  ?seed=1234 로 고정하면 같은 판을 100% 재현할 수 있다(버그 재추적·리플레이).
   *  지정이 없으면 매번 새 시드 — qs 없이도 결정론 경로 자체는 항상 동작한다. */
  try {
    const q = new URLSearchParams(window.location.search).get("seed");
    startRun(q ? Number(q) >>> 0 : undefined);
  } catch { startRun(); }
  /* v1.4.16 (QA) — 렌더러 강제 오버라이드: ?renderer=canvas
   *  소프트웨어 GL(SwiftShader)에서 WebGL 파이프라인 컴파일이 메인 스레드를 수십 초
   *  블록하는 환경(QA 헤드리스·에뮬레이터·일부 저사양 GPU)에서 Canvas 백엔드로
   *  강등해 게임 자체는 항상 플레이 가능하게 하는 비상 통로. 기본은 AUTO(변경 없음). */
  const forceCanvas = (() => {
    try {
      const q = new URLSearchParams(window.location.search).get("renderer");
      if (q === "canvas") return true;
      /* v1.4.23 (#반짝임) — ?renderer=webgl로 세션 폴백 해제 */
      if (q === "webgl") {
        try { localStorage.removeItem("sertz.renderer"); } catch { /* 무시 */ }
        sessionStorage.removeItem("sertz.renderer");
        return false;
      }
      /* v1.4.23 (#반짝임) — GPU 불안정으로 Canvas 폴백이 예약된 세션.
       * vc196 — sessionStorage → localStorage. 종전엔 새로고침마다 강등이 풀려
       *  WebGL 재시도 → 컨텍스트 손실 → 안전 새로고침 → 다시 WebGL … 무한 루프였다. */
      let stored = false;
      try { stored = localStorage.getItem("sertz.renderer") === "canvas"; } catch { /* 무시 */ }
      if (!stored) stored = sessionStorage.getItem("sertz.renderer") === "canvas";
      if (stored) return true;
      /* vc196 (#WebGL 무한 재부팅) — 저장된 강등이 없어도 **GPU가 소프트웨어 구현**이면
       *  처음부터 Canvas 로 시작한다. 종전엔 이 판정이 WorldScene 안에만 있어서
       *  로비/부팅 단계에서 이미 WebGL 이 죽었고(블룸 이전에 파이프라인 컴파일 부하),
       *  WorldScene 게이트는 인게임에 도달하기도 전에 무의미했다.
       *  ?renderer=webgl 로 강제 해제할 수 있으므로 탈출구는 유지된다. */
      return WorldScene.isSoftwareGL();
    } catch {
      return false;
    }
  })();
  const game = new Phaser.Game({
    type: forceCanvas ? Phaser.CANVAS : Phaser.AUTO,
    parent,
    width: GAME_W,
    height: GAME_H,
    backgroundColor: "#05070d",
    pixelArt: true,
    roundPixels: true,
    /* v3.2.0 (#최적화) — GPU 전원 우선순위 상향 + 프레임 관리 명시
     *  v1.4.13 (#5 최적화) — batchSize 4096 (기본 2000)으로 상향: 파티클·스프라이트 많은
     *  장면에서 WebGL 드로우콜 수 감소, 데스크톱/모바일 공통 안정. desynchronized:true로
     *  캔버스 래스터 동기화 우회 — 캔버스 2D 백엔드에서 입력-렌더 지연 단축. */
    render: {
      /* vc178 (#5 발열) — "high-performance"는 모바일에서 GPU를 최대 클럭으로 고정한다.
       *  S20+ 같은 기기는 이 게임(2D 픽셀아트, 드로우콜 60~90, 백버퍼 28만 px)에
       *  과분한 성능이라, 최대 클럭 요구가 곧 발열·배터리 소모로 이어졌다.
       *  "default"로 두면 OS가 상황에 맞춰 클럭을 관리한다(체감 프레임 차이 없음). */
      powerPreference: "default",
      antialias: false,
      batchSize: 4096,
      maxTextures: 16,
      /* v1.4.23 (#반짝임) — desynchronized 제거: 캔버스 프레젠테이션 동기화 우회는
       *  이동/스킬처럼 갱신이 격한 순간 Android WebView·일부 Chromium에서
       *  "검은 프레임 반짝임"을 유발하는 문서화된 유발점 — 지연 단축 이익보다 크다. */
    },
    fps: { target: 60, min: 30 },
    physics: {
      default: "arcade",
      arcade: {
        debug: false,
        fps: 60,
        /* v1.4.13 (#5 최적화) — physics useTree:true로 공간 분할 — 많은 적 스프라이트
         *  환경에서 충돌 체크 비용 O(n²)에서 O(n log n)으로 완화. */
        useTree: true,
      },
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.NO_CENTER,
      width: GAME_W,
      height: GAME_H,
      expandParent: true,
    },
    /* vc204 (지시서 #1 "모바일 화질") — 백버퍼 해상도 상한.
     *  vc178 은 주석만 있고 구현이 없었다. Phaser 4 의 Scale.RESIZE 는 뷰포트를
     *  1:1 로 그리므로 S20+(1440×3200)에서 매 프레임 460만 픽셀을 채웠다.
     *  이 게임 타일은 16~64px 픽셀아트라 그 해상도가 시각적으로 무의미하다.
     *  → 백버퍼 긴 변을 BACKBUF_MAX(1920)로 제한한다. CSS 표시 크기는 그대로.
     *    PC(긴 변 ≤1920)는 1.0 이라 원본 화질이 유지된다. */
    zoom: renderResolutionFor(
      typeof window !== "undefined" ? window.innerWidth : GAME_W,
      typeof window !== "undefined" ? window.innerHeight : GAME_H,
    ),
    /* vc178 (#5 발열) — 렌더 해상도 상한.
     *  Scale.RESIZE + expandParent는 뷰포트를 1:1로 그린다. S20+(1440×3200)처럼
     *  고밀도 기기에서는 460만 픽셀을 매 프레임 채우게 되는데 이 게임은 16~64px
     *  픽셀아트라 그 해상도가 시각적으로 의미가 없다(업스케일 낭비).
     *  CSS 표시 크기는 그대로 두고 "백버퍼"만 상한을 둔다 — 발열·배터리의 최대 절감.
     *  (render.resolution 은 Phaser가 창 크기에 곱하므로 1 미만으로 두고,
     *   실제 축소는 scale manager 의 zoom 으로 처리한다.)
     *
     *  vc204 (지시서 #1 "모바일 화질") — vc178 은 주석만 있고 구현이 없었다.
     *  DPR 상한을 실제로 건다: 백버퍼의 긴 변이 BACKBUF_MAX 를 넘지 않게
     *  render.resolution 을 1 미만으로 낮춘다. pixelArt:true + roundPixels 라
     *  축소해도 픽셀 경계가 흐려지지 않고, GPU 채우기 비용만 줄어든다.
     *  PC(넓은 화면)는 상한에 걸리지 않아 원본 화질이 그대로 유지된다. */

    scene: [BootScene, TitleScene, WorldScene],
  });
  /* v3.2.0 (#흑화) — WebGL 컨텍스트 손실 자가복구.
   *  모바일 WebView/구형 GPU에서 긴 세션 중 컨텍스트가 유실되면 캔버스가 검은 채로
   *  멈춘다(입력도 죽음). lost에서 복구 대기, 4초 내 미복구 시 세이브가 살아있으므로
   *  안전하게 새로고침해 부팅한다. */
  let ctxLostAt = 0;
  /* v1.4.23 (#반짝임) — GPU 불안정 브레이커:
   *  유저 리포트 "움직이거나 스킬 사용 시 화면이 검게 반짝임". 유실 동안은
   *  render()의 contextLost 가드가 그리기를 스킵 → 캔버스가 검게 보인다(반짝임의 정체).
   *  60초 창 반복 유실은 "블룸/툰 셰이더 프레임버퍼 경로를 GPU가 못 버틴다"는 신호:
   *   ① 2회 — 세션 이벤트(sertz:gpu-unstable)로 WorldScene에 절전 전환 요청
   *   ② 4회 — Canvas 백엔드 폴백 예약 + 예산화된 안전 재부팅 */
  const ctxLossTimes: number[] = [];
  const canvas = game.canvas;
  /* vc205 (감사 #20) — 전역 리스너 1회 등록 가드.
   *  HMR·StrictMode 처럼 이 모듈이 두 번 실행되면 webglcontextlost 핸들러가 중복 등록돼
   *  ctxLossTimes 가 두 배로 쌓인다. 그 값이 4회에서 Canvas 폴백 재부팅을 걸기 때문에
   *  실제 유실 2회로 재부팅 조건이 채워졌다. 캔버스에 표식을 남겨 1회만 붙인다. */
  const LISTENER_FLAG = "__sertzCtxGuardInstalled";
  const alreadyGuarded = (canvas as unknown as Record<string, unknown>)[LISTENER_FLAG] === true;
  if (!alreadyGuarded) (canvas as unknown as Record<string, unknown>)[LISTENER_FLAG] = true;

  if (!alreadyGuarded) canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    ctxLostAt = Date.now();
    const now = Date.now();
    while (ctxLossTimes.length > 0 && now - ctxLossTimes[0] > 60000) ctxLossTimes.shift();
    ctxLossTimes.push(now);
    console.error("[SERTZ] WebGL 컨텍스트 손실 — 복구 대기 (", ctxLossTimes.length, "회/60초)");
    try {
      if (ctxLossTimes.length >= 2) {
        window.dispatchEvent(new CustomEvent("sertz:gpu-unstable", { detail: { losses: ctxLossTimes.length } }));
      }
      if (ctxLossTimes.length >= 4) {
        /* vc196 — localStorage 에도 기록한다. sessionStorage 만 쓰면 새로고침(안전
         *  재부팅)마다 강등이 사라져 WebGL 재시도 → 손실 → 재부팅 무한 루프가 됐다. */
        try { localStorage.setItem("sertz.renderer", "canvas"); } catch { /* 무시 */ }
        try { sessionStorage.setItem("sertz.renderer", "canvas"); } catch { /* 무시 */ }
        console.error("[SERTZ] 컨텍스트 반복 유실 — Canvas 백엔드 폴백 재부팅");
        safeReload("gpu-unstable");
      }
    } catch { /* 무시 */ }
  });
  canvas.addEventListener("webglcontextrestored", () => {
    ctxLostAt = 0;
    console.log("[SERTZ] WebGL 컨텍스트 복구됨");
  });
  window.setInterval(() => {
    if (ctxLostAt > 0 && Date.now() - ctxLostAt > 4000) {
      /* vc182 (#2 보스전 멈춤) — 4초는 모바일 GPU 복구 시간보다 짧다.
       *  S20+(Adreno 650)급에서도 컨텍스트 복구는 5~15초 걸린다. 4초에 새로고침하면
       *  복구될 상황에서도 전투를 통째로 날려 "멈추고 튕긴다"로 체감된다.
       *  유실 횟수에 따라 예산을 차등: 첫 유실은 15초까지 기다려 복구를 살린다.
       *  반복 유실(2회+)은 GPU가 못 버티는 신호이므로 예전처럼 빠르게 재부팅한다. */
      const grace = ctxLossTimes.length <= 1 ? 15000 : 6000;
      if (Date.now() - ctxLostAt > grace) {
        console.error("[SERTZ] 컨텍스트 미복구 — 안전 새로고침 (", Math.round(grace / 1000), "초 경과)");
        safeReload("webgl-context");
      }
    }
  }, 1000);

  /* v4.9.0 — 렌더 프리즈 최후 워치독 (유저 지시: GM 보스 이동·긴급귀환 후 검은 화면이 안 사라짐).
   *  컨텍스트 유실 외에도 약한 GPU에서 필터/셰이더 경합으로 게임 루프 자체가 멈추면
   *  캔버스가 검은 채로 얼어붙는다(씬 내 자가치유는 update가 살아 있어야 동작).
   *  화면이 보이는 상태에서 2초 간격 샘플로 프레임 카운터가 연속 3회(≥6초) 무변화면
   *  진짜 프리즈다(배터리 세이버도 0fps까지는 안 끊는다). 세이브가 살아있으므로
   *  안전하게 새로고침해 부팅한다. 부팅 직후 12초는 유예(느린 기기 초기 로딩 보호). */
  const freezeBootAt = Date.now();
  let freezeSamples = 0;
  let lastFrame = -1;
  let hadFrame = false; // v1.4.5 — 루프가 실제로 살아본 적이 있어야 프리즈로 인정
  let resumeGraceUntil = 0; // v1.4.5 — 백그라운드 복귀 직후 관찰 유예
  window.setInterval(() => {
    try {
      if (document.hidden) return;
      if (Date.now() - freezeBootAt < 12000) return;
      const f = game.loop.frame;
      if (f > 0 && f !== lastFrame) hadFrame = true;
      if (!hadFrame) return; // 부팅 실패 루프 — 프리즈가 아니라 재부팅 예산이 보호한다
      if (Date.now() < resumeGraceUntil) {
        lastFrame = f;
        freezeSamples = 0;
        return;
      }
      if (f === lastFrame) {
        freezeSamples++;
        if (freezeSamples >= 3) {
          console.error("[SERTZ] 렌더 루프 정지 감지 — 안전 새로고침");
          safeReload("render-freeze");
        }
      } else {
        freezeSamples = 0;
        lastFrame = f;
      }
    } catch {
      /* 게임 미부팅 단계 무시 */
    }
  }, 2000);

  /* v1.3.1 (#5 검은화면 수정) — 장시간 백그라운드 복귀 자가치유:
   *  모바일 WebView는 백그라운드 동안 GPU 텍스처를 회수해 복귀 시 캔버스가 검은 채로
   *  남는다(webglcontextlost 이벤트 없이). 루프는 살아 있어 프리즈 워치독도 못 잡는다.
   *  45초 이상 숨겨있다 돌아오면 세이브가 살아있으므로 안전하게 재부팅한다(모바일만).
   *  짧은 전환(알림 확인 등)은 재부팅하지 않는다 — 플레이 흐름 보호. */
  let hiddenAt = 0;
  document.addEventListener("visibilitychange", () => {
    try {
      if (document.hidden) {
        hiddenAt = Date.now();
        return;
      }
      const gone = Date.now() - hiddenAt;
      hiddenAt = 0;
      const isMobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || "");
      if (isMobile && gone > 45000 && Date.now() - freezeBootAt > 20000) {
        /* v1.4.5 (#무한재부팅) — 즉시 reload 폐지: 15초 관찰 유예를 두고 프리즈 워치독
         *  (예산화됨)이 실제 정지를 확인하면 그때 복구. ARG/외부 페이지 이동 후 복귀에서
         *  즉시 reload가 누적되던 것이 루프의 시작점이었다. */
        console.warn("[SERTZ] 장시간 백그라운드 복귀 — 15초 관찰 후 필요 시 자가치유");
        resumeGraceUntil = Date.now() + 15000;
        freezeSamples = 0;
        lastFrame = -1;
        hadFrame = false;
      }
    } catch {
      /* 무시 */
    }
  });

  // 오디오 모듈에 게임 인스턴스 연결 (Phaser SoundManager 사용)
  attachAudio(game);

  // E2E 검증/디버그 훅
  (window as unknown as { __SERTZ__?: unknown }).__SERTZ__ = { game };
  /* v1.3.1 (#9) — 부팅 판정 노출 (모바일 절전 기본 — 월드 진입 없이도 E2E 검증 가능) */
  (window as unknown as { __SERTZ_BOOT__?: unknown }).__SERTZ_BOOT__ = { fxMode: WorldScene.DEFAULT_FX_MODE };
  /* v1.4.39 (이펙트 강화) — **죽은 게이트 연결.**
   *  fx 계층(StudioFX/DriveFX)이 `game.__sertzFxLevel` 을 읽어 연출 겹수를 결정하는데,
   *  이 값을 **쓰는 곳이 아무 데도 없었다**(grep 결과 읽기 3곳·쓰기 0곳). 그래서 항상
   *  undefined → `?? 2` 로 폴백해 저사양 기기에서도 풀 연출이 돌았다.
   *  WorldScene.DEFAULT_FX_MODE(auto|high|low) → 0|1|2 로 변환해 실제로 설정한다.
   *    high → 2(풀) / auto → 저사양 여부에 따라 1|2 / low → 1(축소)
   *  ⚠️ 0(완전 생략)은 사용자가 설정에서 low 를 고른 경우에만 준다 — 이펙트 강화 요청과
   *     정면으로 충돌하므로 auto 에서는 0 을 쓰지 않는다. */
  try {
    const mode = WorldScene.DEFAULT_FX_MODE;
    const lowPerf =
      typeof navigator !== "undefined" &&
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const level = mode === "high" ? 2 : mode === "low" ? 1 : lowPerf ? 1 : 2;
    (game as unknown as { __sertzFxLevel?: number }).__sertzFxLevel = level;
    console.info(`[SERTZ] 이펙트 레벨 ${level} (모드=${mode}, 저사양UA=${lowPerf})`);
  } catch { /* 무시 */ }

  /* vc147 (#29) — 30FPS 절전 모드: 프레임 상한을 런타임에 전환한다.
   *  기기 발열 → GPU 서멀 스로틀 → 프리즈의 직접 대책. 설정 패널에서 토글. */
  const applyFpsCap = (on: boolean) => {
    try { window.localStorage.setItem("sertz_fps30", on ? "1" : "0"); } catch { /* 무시 */ }
    try {
      const loop = (game as unknown as { loop?: { targetFps?: number } }).loop;
      if (loop && typeof loop.targetFps === "number") {
        loop.targetFps = on ? 30 : 60;
        console.info(`[SERTZ] 절전 모드: 프레임 상한 ${on ? 30 : 60}FPS`);
      }
    } catch { /* 루프 미지원 환경 무시 */ }
  };
  applyFpsCap((() => { try { return window.localStorage.getItem("sertz_fps30") === "1"; } catch { return false; } })());
  EventBus.on("fx:battery", (on: boolean) => applyFpsCap(!!on));
  // v3.0.6 — E2E 정적 검증용 모듈 노출 (클래스/사운드/스테이지/아이템 테이블)
  // v3.0.23 — BGM 고정배치 검증 훅 (구역→트랙 매핑 실측)
  (window as unknown as { __SERTZ_DEBUG__?: unknown }).__SERTZ_DEBUG__ = {
    classes: classesMod,
    audio: audioDebug,
    bgm: { playBGM, playStageBGM, stageTrack, bgmDebugState, bgmAdvanceForTest, playlists: BGM_PLAYLISTS },
    stages: stagesMod,
    items: dataMod.ITEMS,
    bossDrops: dataMod.BOSS_DROP_ITEMS,
    /* v3.0.7 — 거래소/강화 주문서 정적 검증용 */
    data: dataMod,
    /* v1.2.1 (#1) — 치장 앵커 테이블 (E2E 프레임 정확 판정용) */
    anchors: ACC_ANCHORS,
    /* v1.4.0 — 이스터에그/ARG 트래커 (E2E 100종 데이터 검증용) */
    /* v1.4.3 — 파티 시너지/퀘스트 보드 (E2E 로직 검증용) */
    party: partyContentMod,
    /* vc178 — 게임 인스턴스 (집 꾸미기 등 런타임 동작 실측용) */
    game,
  };
  return game;
}
