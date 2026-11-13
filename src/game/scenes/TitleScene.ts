import Phaser from "phaser";
import { EventBus } from "../../components/game/EventBus";
import { loadSave, type SaveData } from "../config";
import { readCharSave, setActiveChar } from "../slots"; // v1.4.0 (#16) 자동 복귀
import * as audio from "../audio";

/** 타이틀: 배경 포스터·버튼은 React 오버레이(TitlePoster/TitleScreen)가 담당, 이 씬은 BGM·시작/이어하기 이벤트만 처리 */
export class TitleScene extends Phaser.Scene {
  private started = false;
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

    this.cameras.main.setBackgroundColor("#05070d");

    /* 시작 화면의 배경 연출(별빛·나무·빛·파편)은 폐기했다. 움직이는 포스터는 React 쪽
     *  TitlePoster(CSS 애니메이션)가 그리며, 이 씬은 배경색·BGM·시작/이어하기 이벤트만 맡는다. */

    EventBus.emit("ui:title");
    audio.playBGM("title");

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
