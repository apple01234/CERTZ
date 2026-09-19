import Phaser from "phaser";
import { EventBus } from "../../components/game/EventBus";
import { loadSave, type SaveData } from "../config";
import * as audio from "../audio";
import { DEFERRED_BODY_PREFIXES } from "../data"; // v1.2.1 (#4 최적화) — 지연 로드 외형 시트
import { registerBodyAnims } from "../textures";

/** 타이틀: Phaser는 배경 연출만, 버튼은 React 오버레이가 담당 */
export class TitleScene extends Phaser.Scene {
  private started = false;
  private glow!: Phaser.GameObjects.Image;
  private tree!: Phaser.GameObjects.Image;
  private frag!: Phaser.GameObjects.Image;
  /* v1.2.1 (#4 최적화 x3) — 백그라운드 에셋 로더 상태:
   *  부팅은 기본 시트만 로드하고 나머지(코스튬/직업/GM 37종·≈1036프레임)는 타이틀 화면에서
   *  유저가 메뉴를 보는 동안 몰래 받는다. 게임 시작 버튼을 눌렀는데 미완료면 잠깐 기다렸다 진입. */
  private deferDone = false;
  private deferStarted = false;
  /** v1.3.1 (#5) — 월드 진입 이중 실행 방지 + 로더 교착 폴백 판정 플래그 */
  private launched = false;

  constructor() {
    super("title");
  }

  /** v1.2.1 (#4 최적화) — 월드 진입 공통 게이트: 백그라운드 시트 로드가 끝났을 때만 시작.
   *  대기 중엔 화면 하단에 작은 안내문 (평균 0~1초). */
  private beginWorld(data: Record<string, unknown>) {
    const launch = () => {
      /* 이중 진입 방지 — 워치독 폴백과 complete 콜백이 경합해도 restart는 1번만 */
      if (this.launched) return;
      this.launched = true;
      this.scene.start("world", data);
    };
    if (this.deferDone || this.load.totalToLoad === 0) {
      launch();
      return;
    }
    const note = this.add
      .text(this.scale.width / 2, this.scale.height - 28, "에셋 정리 중… 잠시만요", {
        fontFamily: "Galmuri11, 'Galmuri11', sans-serif",
        fontSize: "14px",
        color: "#cfe3ff",
      })
      .setOrigin(0.5)
      .setDepth(50);
    this.load.once("complete", () => {
      registerBodyAnims(this, DEFERRED_BODY_PREFIXES);
      this.deferDone = true;
      (window as unknown as { __SERTZ_DEFER_DONE__?: boolean }).__SERTZ_DEFER_DONE__ = true;
      note.destroy();
      launch();
    });
    /* v1.3.1 (#5 검은화면 수정) — 로더 교착 폴백: 백그라운드 전환 등으로 로더가 영원히
     *  끝나지 않으면 "에셋 정리 중…" 검은 화면에 갇힌다. 8초 후엔 무조건 진입
     *  (미로드 코스튬/직업 시트는 applyBodyLook이 기본 외형으로 폴백 — 게임은 정상 기동) */
    this.time.delayedCall(8000, () => {
      if (!this.launched) {
        console.warn("[SERTZ] 지연 로드 교착 — 폴백 진입");
        try { this.load.removeAllListeners(); this.load.reset(); } catch { /* 무시 */ }
        note.destroy();
        launch();
      }
    });
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

    /* v1.2.1 (#4 최적화 x3) — 백그라운드 지연 로드: 타이틀 진입 즉시 코스튬/직업/GM 시트를 받는다.
     *  완료 시 애님 후등록 + deferDone 플래그. 유저가 시작 버튼을 누르는 시점엔 대부분 완료돼 있다. */
    if (!this.deferStarted) {
      this.deferStarted = true;
      const heroFrames = ["idle0", "idle1", "idle2", "idle3", "walk0", "walk1", "walk2", "walk3", "walkside0", "walkside1", "walkside2", "walkside3", "walkup0", "walkup1", "walkup2", "walkup3", "atk0", "atk1", "atk2", "atk3", "atkdown0", "atkdown1", "atkdown2", "atkdown3", "atkup0", "atkup1", "atkup2", "atkup3"];
      this.load.setPath("assets");
      for (const p of DEFERRED_BODY_PREFIXES) {
        for (const f of heroFrames) this.load.image(`${p}_${f}`, `${p}_${f}.webp`);
      }
      this.load.start();
      this.load.once("complete", () => {
        registerBodyAnims(this, DEFERRED_BODY_PREFIXES);
        this.deferDone = true;
        (window as unknown as { __SERTZ_DEFER_DONE__?: boolean }).__SERTZ_DEFER_DONE__ = true;
      });
    }

    const onNew = () => {
      if (this.started) return;
      this.started = true;
      audio.initAudio();
      audio.sfx.questDone();
      this.cameras.main.fadeOut(400, 0, 0, 0);
      /* v1.2.1 (#4) — 지연 로드 미완료면 완료를 기다렸다 진입 (직업/코스튬 시트 미로드 진입 방지).
       *  타이틀에서 이미 받는 동안이라 대기는 보통 0ms — 잠깐이면 로딩 표시 없이 넘어간다. */
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
  }
}
