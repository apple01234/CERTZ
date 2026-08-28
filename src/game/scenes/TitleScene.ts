import Phaser from "phaser";
import { EventBus } from "../../components/game/EventBus";
import { loadSave, type SaveData } from "../config";
import * as audio from "../audio";

/** 타이틀: Phaser는 배경 연출만, 버튼은 React 오버레이가 담당 */
export class TitleScene extends Phaser.Scene {
  private started = false;
  private glow!: Phaser.GameObjects.Image;
  private tree!: Phaser.GameObjects.Image;
  private frag!: Phaser.GameObjects.Image;

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

    // 중앙 세계수 실루엣 + 빛 + 파편
    this.glow = this.add.image(w / 2, h / 2 + 40, "glow").setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
    this.tree = this.add.image(w / 2, h / 2 + 10, "tree").setAlpha(0.92);
    this.frag = this.add.image(w / 2 + 120, h / 2 + 60, "fragment").setBlendMode(Phaser.BlendModes.ADD);

    // 반응형: 리사이즈 시 화면 높이 비례로 스케일/위치 재계산 + 부유 트윈 재생성
    //  (카메라 줌 미사용 — 단순/견고. 기준: 720p에서 나무 ×3.4)
    const layout = () => {
      const gw = this.scale.width;
      const gh = this.scale.height;
      const s = Phaser.Math.Clamp(gh / 210, 1.5, 5.2); // 화면 높이의 ~30% 크기 유지
      this.tweens.killTweensOf([this.glow, this.tree, this.frag]);
      this.glow.setScale(s * 2.65).setPosition(gw / 2, gh / 2 + 40).setAlpha(0.35);
      this.tweens.add({ targets: this.glow, scale: s * 2.95, alpha: 0.5, duration: 2400, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      this.tree.setScale(s).setPosition(gw / 2, gh / 2 + 10);
      this.tweens.add({ targets: this.tree, y: gh / 2 + 16, duration: 3000, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      this.frag.setScale(s * 0.65).setPosition(gw / 2 + Math.min(130, gw * 0.15), gh / 2 + 60);
      this.tweens.add({ targets: this.frag, y: gh / 2 + 52, alpha: 0.6, duration: 1200, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    };
    this.scale.on("resize", layout);
    layout();

    EventBus.emit("ui:title");
    audio.playBGM("title");

    const onNew = () => {
      if (this.started) return;
      this.started = true;
      audio.initAudio();
      audio.sfx.questDone();
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.time.delayedCall(420, () => {
        this.scene.start("world", { stage: "village", fresh: true });
      });
    };
    const onContinue = (save: SaveData) => {
      if (this.started) return;
      this.started = true;
      audio.initAudio();
      audio.sfx.questDone();
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.time.delayedCall(420, () => {
        this.scene.start("world", { save, fresh: true });
      });
    };

    EventBus.on("game:new", onNew);
    EventBus.on("game:continue", onContinue);
    this.events.once("shutdown", () => {
      EventBus.off("game:new", onNew);
      EventBus.off("game:continue", onContinue);
      this.scale.off("resize", layout);
      audio.stopBGM();
    });
  }
}
