import Phaser from "phaser";
import { GAME_W, GAME_H } from "./config";
import { BootScene } from "./scenes/BootScene";
import { TitleScene } from "./scenes/TitleScene";
import { WorldScene } from "./scenes/WorldScene";

/**
 * F3 반응형 핵심:
 *  - Scale.FIT + CENTER_BOTH → 어떤 화면 비율이든 레터박스로 완전수용
 *  - expandParent + fullScreen 부모 div → 모바일 WebView에서도 정확히 채움
 *  - pixelArt + roundPixels → 픽셀아트 선명도 유지
 */
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
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_W,
      height: GAME_H,
      expandParent: true,
    },
    scene: [BootScene, TitleScene, WorldScene],
  });
  // E2E 검증/디버그 훅
  (window as unknown as { __SERTZ__?: unknown }).__SERTZ__ = { game };
  return game;
}
