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
