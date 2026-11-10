import Phaser from "phaser";
import { EventBus } from "../../components/game/EventBus";
import { loadSave, type SaveData } from "../config";
import { readCharSave, setActiveChar } from "../slots"; // v1.4.0 (#16) 자동 복귀
import * as audio from "../audio";

/** 타이틀: Phaser는 배경 연출만, 버튼은 React 오버레이가 담당 */
export class TitleScene extends Phaser.Scene {
  private started = false;
  private glow!: Phaser.GameObjects.Image;
  private tree!: Phaser.GameObjects.Image;
  private frag!: Phaser.GameObjects.Image;
  /* v1.4.12 — 벚꽃 언덕/꽃잎 낙하 전면 제거 (유저 지시 "짜치는 벚꽃 이펙트·배경 없애") */
  /** 월드 중복 진입 방지. 필수 에셋은 WorldScene 진입 시 기다린다. */
  private launched = false;

  constructor() {
    super("title");
  }

  private beginWorld(data: Record<string, unknown>) {
    if (this.launched) return;
    this.launched = true;
    this.scene.start("world", data);
  }

  create() {
    this.started = false;
    this.launched = false; // v1.3.1 (#5) — 타이틀 재진입 시 진입 플래그 리셋 (씬 인스턴스 재사용)
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

    // 중앙 연합 실루엣 + 빛 + 파편
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

    /* v1.4.12 — 벚꽃 잎 낙하 제거 (유저 지시) — 타이틀은 별빛+연합 실루엣만 유지 */

    const onNew = () => {
      if (this.started) return;
      this.started = true;
      audio.initAudio();
      audio.sfx.questDone();
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.time.delayedCall(420, () => this.beginWorld({ stage: "village", fresh: true }));
    };
    const onContinue = (save: SaveData) => {
      if (this.started) return;
      this.started = true;
      audio.initAudio();
      audio.sfx.questDone();
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.time.delayedCall(420, () => this.beginWorld({ save, fresh: true }));
    };

    EventBus.on("game:new", onNew);
    EventBus.on("game:continue", onContinue);
    this.events.once("shutdown", () => {
      EventBus.off("game:new", onNew);
      EventBus.off("game:continue", onContinue);
      this.scale.off("resize", layout);
      audio.stopBGM();
    });

    /* v1.4.12 (유저 지시 #5 — "캐릭터를 선택하기도 전에 게임이 자동 시작되는 버그") —
     *  sertz.autoResume 자동 복귀 플래그 폐지. 업데이트/재부팅 후 플래그가 남아
     *  캐릭터 선택 화면을 건너뛰고 월드로 자동 진입하던 문제의 근원.
     *  이제 항상 타이틀(캐릭터 선택)에서 시작하며, 잔존 플래그는 즉시 청소한다. */
    try {
      localStorage.removeItem("sertz.autoResume");
    } catch { /* 무시 */ }
  }
}
