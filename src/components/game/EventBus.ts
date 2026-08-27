import Phaser from "phaser";

/** Phaser 게임 ↔ React UI 사이의 유일한 통로 */
export const EventBus = new Phaser.Events.EventEmitter();

export type HudState = {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  lv: number;
  exp: number;
  expNext: number;
};

export type QuestState = {
  title: string;
  desc: string;
  current: number;
  target: number;
  /** 목표물까지의 거리 (m 단위 환산용 px 값) */
  distance: number | null;
};

export type EndState = {
  victory: boolean;
  playTime: number;
  kills: number;
  lv: number;
};
