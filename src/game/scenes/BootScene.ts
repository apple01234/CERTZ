import Phaser from "phaser";
import { buildAllTextures, buildAllAnims } from "../textures";

/** 텍스처/애니메이션 전량 절차 생성 후 타이틀로 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create() {
    buildAllTextures(this);
    buildAllAnims(this);
    this.scene.start("title");
  }
}
