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
import { SFX_THROTTLE_MS, SFX_MAX_CONCURRENT, BGM_VOLUME, SFX_VOLUMES, playBGM, playStageBGM, stageTrack, bgmDebugState, bgmAdvanceForTest, BGM_PLAYLISTS } from "./audio";

const audioDebug = { throttle: SFX_THROTTLE_MS, cap: SFX_MAX_CONCURRENT, bgm: BGM_VOLUME, volumes: SFX_VOLUMES };

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

export function createGame(parent: HTMLElement): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_W,
    height: GAME_H,
    backgroundColor: "#05070d",
    pixelArt: true,
    roundPixels: true,
    /* v3.2.0 (#최적화) — GPU 전원 우선순위 상향 + 프레임 관리 명시 */
    render: { powerPreference: "high-performance", antialias: false },
    fps: { target: 60, min: 30 },
    physics: {
      default: "arcade",
      arcade: {
        debug: false,
        fps: 60,
      },
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.NO_CENTER,
      width: GAME_W,
      height: GAME_H,
      expandParent: true,
    },
    scene: [BootScene, TitleScene, WorldScene],
  });

  /* v3.2.0 (#흑화) — WebGL 컨텍스트 손실 자가복구.
   *  모바일 WebView/구형 GPU에서 긴 세션 중 컨텍스트가 유실되면 캔버스가 검은 채로
   *  멈춘다(입력도 죽음). lost에서 복구 대기, 4초 내 미복구 시 세이브가 살아있으므로
   *  안전하게 새로고침해 부팅한다. */
  let ctxLostAt = 0;
  const canvas = game.canvas;
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    ctxLostAt = Date.now();
    console.error("[SERTZ] WebGL 컨텍스트 손실 — 복구 대기");
  });
  canvas.addEventListener("webglcontextrestored", () => {
    ctxLostAt = 0;
    console.log("[SERTZ] WebGL 컨텍스트 복구됨");
  });
  window.setInterval(() => {
    if (ctxLostAt > 0 && Date.now() - ctxLostAt > 4000) {
      console.error("[SERTZ] 컨텍스트 미복구 — 안전 새로고침");
      window.location.reload();
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
  window.setInterval(() => {
    try {
      if (document.hidden) return;
      if (Date.now() - freezeBootAt < 12000) return;
      const f = game.loop.frame;
      if (f === lastFrame) {
        freezeSamples++;
        if (freezeSamples >= 3) {
          console.error("[SERTZ] 렌더 루프 정지 감지 — 안전 새로고침");
          window.location.reload();
        }
      } else {
        freezeSamples = 0;
        lastFrame = f;
      }
    } catch { /* 게임 미부팅 단계 무시 */ }
  }, 2000);

  // 오디오 모듈에 게임 인스턴스 연결 (Phaser SoundManager 사용)
  attachAudio(game);

  // E2E 검증/디버그 훅
  (window as unknown as { __SERTZ__?: unknown }).__SERTZ__ = { game };
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
  };
  return game;
}
