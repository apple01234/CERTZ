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
  /* 2D MMORPG 기본 요소 */
  gold: number;
  atkTotal: number;
  defTotal: number;
  critRate: number;
};

/** 인벤토리/상점 패널 상태 */
export type RpgState = {
  gold: number;
  hpPot: number;
  mpPot: number;
  owned: string[];
  weapon: string;
  armor: string;
  accessory: string | null;
  upWea: number;
  upArm: number;
  nearShop: boolean;
  shopStock: string[];
};

export type PanelKind = "shop" | "inv" | null;

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

/** 상호작용 프롬프트 상태 (NPC 대화/상점 — E키·모바일 버튼 공용) */
export type InteractState = {
  active: boolean;
  label: string;
  kind: "talk" | "shop" | null;
};
