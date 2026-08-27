import Phaser from "phaser";
import { EventBus } from "../../components/game/EventBus";
import { loadSave, type SaveData } from "../config";
import * as audio from "../audio";

/** 타이틀: Phaser는 배경 연출만, 버튼은 React 오버레이가 담당 */
export class TitleScene extends Phaser.Scene {
  private started = false;

  constructor() {
    super("title");
  }

  create() {
    this.started = false;
    const w = this.scale.width;
    const h = this.scale.height;

    this.cameras.main.setBackgroundColor("#05070d");

    // 별 반짝임 배경 (저렴한 타일 + 알파 트윈)
    for (let i = 0; i < 60; i++) {
      const s = this.add.rectangle(
        Phaser.Math.Between(0, w),
        Phaser.Math.Between(0, h),
        2,
        2,
        0xbfd8ff
      );
      this.tweens.add({
        targets: s,
        alpha: { from: 0.15, to: 0.9 },
        duration: Phaser.Math.Between(700, 2200),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 1500),
      });
    }

    // 중앙 세계수 실루엣 + 빛
    const glow = this.add.image(w / 2, h / 2 + 40, "glow").setScale(9).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, scale: 10, alpha: 0.5, duration: 2400, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    const tree = this.add.image(w / 2, h / 2 + 10, "tree").setScale(3.4).setAlpha(0.92);
    this.tweens.add({ targets: tree, y: h / 2 + 16, duration: 3000, yoyo: true, repeat: -1, ease: "Sine.inOut" });

    // 파편이 반짝이는 연출
    const frag = this.add.image(w / 2 + 120, h / 2 + 60, "fragment").setScale(2.2).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: frag, y: h / 2 + 52, alpha: 0.6, duration: 1200, yoyo: true, repeat: -1, ease: "Sine.inOut" });

    EventBus.emit("ui:title");
    audio.playBGM("title");

    const onNew = () => {
      if (this.started) return;
      this.started = true;
      audio.initAudio();
      audio.sfx.questDone();
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.time.delayedCall(420, () => {
        this.scene.start("world", { stage: "forest" });
      });
    };
    const onContinue = (save: SaveData) => {
      if (this.started) return;
      this.started = true;
      audio.initAudio();
      audio.sfx.questDone();
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.time.delayedCall(420, () => {
        this.scene.start("world", { save });
      });
    };

    EventBus.on("game:new", onNew);
    EventBus.on("game:continue", onContinue);
    this.events.once("shutdown", () => {
      EventBus.off("game:new", onNew);
      EventBus.off("game:continue", onContinue);
      audio.stopBGM();
    });
  }
}
