import Phaser from "phaser";

/** Phaser 게임 ↔ React UI 사이의 유일한 통로 */
export const EventBus = new Phaser.Events.EventEmitter();

/** 활성 버프 상태 (v1.9 BM) */
export type HudBuff = { key: string; remain: number; total: number };

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
  /** 전직 클래스 (미전직 null) — HUD 배지 */
  cls: string | null;
  /* ----- v1.9 ----- */
  /** 활성 버프 목록 (남은 시간 바 표시) */
  buffs: HudBuff[];
  /** 배분 가능한 AP 포인트 — 남아 있으면 HUD 스탯 버튼 강조 */
  ap: number;
  /** 최종 이동 속도 (스탯 창 표시용) */
  speed: number;
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
  /** 현재 전직 클래스키 (v1.8 다차원 트리 — 미전직 null) */
  cls: string | null;
  /** 전직/승격 가능 조건 (다음 단계 Lv 달성) — HUD 전직 버튼 */
  canJob: boolean;
  /* ----- v1.9 BM + 스탯 ----- */
  /** 버프 물약 보유 개수 (BuffKey → 개수) */
  buffItems: Record<string, number>;
  /** 보유 펫 / 소환 중 펫 */
  pets: string[];
  pet: string | null;
  /** 보유 치장 / 착용 중 치장 */
  cosmetics: string[];
  cosmetic: string | null;
  /** AP 스탯 */
  stats: { str: number; dex: number; int: number; luk: number };
  ap: number;
};

export type PanelKind = "shop" | "inv" | "job" | "stat" | "quest" | "opt" | null;

export type QuestState = {
  title: string;
  desc: string;
  current: number;
  target: number;
  /** 목표물까지의 거리 (m 단위 환산용 px 값) */
  distance: number | null;
};

/** 퀘스트 로그 (J — 스테이지별 메인 체인 진행 상황) */
export type QuestLogState = {
  stageName: string;
  list: { title: string; desc: string; state: "done" | "active" | "locked" }[];
  repeat: { title: string; desc: string } | null;
};

export type EndState = {
  victory: boolean;
  playTime: number;
  kills: number;
  lv: number;
};

/** 상호작용 프롬프트 상태 (NPC 대화/상점/전직 교관 — E키·모바일 버튼 공용) */
export type InteractState = {
  active: boolean;
  label: string;
  kind: "talk" | "shop" | "job" | null;
};
