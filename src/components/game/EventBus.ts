import Phaser from "phaser";

/** Phaser 게임 ↔ React UI 사이의 유일한 통로 */
export const EventBus = new Phaser.Events.EventEmitter();

/* E2E/디버그 훅 — UI 이벤트 직접 트리거/감시용 (window.__SERTZ_EB__) */
if (typeof window !== "undefined") {
  (window as unknown as { __SERTZ_EB__?: unknown }).__SERTZ_EB__ = EventBus;
}

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
  /** v2.9 (#8) — 장착 중 장신구 (반지 4 + 펜던트 2 중복 장착) */
  accessories: string[];
  /** v2.9 (#12) — 과금 화폐 에메랄드 */
  emerald: number;
  upWea: number;
  upArm: number;
  /* v3.0.7 — 장신구 스타포스 성(아이템별) + 강화 주문서 충전 수 + HP 가산 이력 */
  accUp?: Record<string, number>;
  starBless?: number;
  accHp?: number;
  nearShop: boolean;
  shopStock: string[];
  /* v3.0.6 — BM 상점 재고 + 자동 사용 설정 */
  bmStock?: string[];
  autoUse?: { hpPct: number; mpPct?: number; mpOn: boolean; buffs: string[] };
  /** 현재 전직 클래스키 (v1.8 다차원 트리 — 미전직 null) */
  cls: string | null;
  /** 전직/승격 가능 조건 (다음 단계 Lv 달성) — HUD 전직 버튼 */
  canJob: boolean;
  /** v3.0.22 (#38) — 전직 퀘스트 게이트 미완료 사유 (null = 퀘스트 조건 충족) */
  jobLock?: string | null;
  /** v3.0.22 (#43/#44/#50) — 세계수 결정 수집 진행도 + 가호 여부 */
  fragFound?: number;
  fragTotal?: number;
  blessing?: boolean;
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
  /* ----- v2.5 자동사냥 ----- */
  /** 자동사냥 ON 여부 */
  autoHunt: boolean;
  /** 자동사냥 사용 가능 (v3.0.15: 항상 true — 펫 조건 제거) */
  canAutoHunt: boolean;
  /* ----- v3.0.15 ----- */
  /** #2 — 레벨업 스탯 자동배분 on/off */
  autoAlloc?: boolean;
  /** #7 — 물약 퀵슬롯 장착 상태 */
  quickPots?: { hp: string; mp: string };
  /** #13 — eert 잠재옵션 (아이템키 → 잠재) */
  potentials?: Record<string, { grade: number; lines: { k: string; v: number }[] }>;
  /** #13 — eert 큐브 보유 수 */
  eertCube?: number;
  /** #11 — 해금된 챕터 테마 세트 (챕터키 목록) */
  unlockedSets?: string[];
  /* ----- v3.0.16 ----- */
  /** 몬스터 컬렉션 — 등록 종수/전체 종수/처치 수 (컬렉션 패널) */
  collection?: { registered: number; total: number; kills: Record<string, number> };
  /** 활성 세트 효과 (인벤토리/스탯창 표시) */
  activeSet?: { title: string; lines: string[] } | null;
};

export type PanelKind = "shop" | "inv" | "job" | "stat" | "quest" | "opt" | "warp" | "gm" | "bmshop" | "trade" | "collection" | "boss" | null;

export type QuestState = {
  title: string;
  desc: string;
  current: number;
  target: number;
  /** 목표물까지의 거리 (m 단위 환산용 px 값) */
  distance: number | null;
  /** v3.0.2 — 진행 중인 전직 스토리 (트래커 병기) */
  jobStory?: { title: string; step: number; total: number; stepTitle: string };
  /** v3.0.15 (#8) — 퀘스트 미수락 (수락 대기 배지) */
  pending?: boolean;
};

/** 퀘스트 로그 (J — 스테이지별 메인 체인 진행 상황) */
export type QuestLogState = {
  stageName: string;
  list: { title: string; desc: string; state: "done" | "active" | "locked"; canAccept?: boolean; accepted?: boolean }[];
  repeat: { title: string; desc: string } | null;
  /* v2.3 — 반복 의뢰 수주 여부 (미수주 시 NPC 수주 안내 표시) */
  repeatActive?: boolean;
  /* v3.0.15 (#3) — 반복 의뢰 수주 해금 여부 */
  repeatUnlocked?: boolean;
  /* v3.0.15 (#8) — 전 구역 수락 퀘스트 목록 (메이플식 퀘스트 선택/추적) */
  trackedList?: { stage: string; stageName: string; title: string; desc: string; isCurrent: boolean; isTracked: boolean; state: "done" | "active" | "move" }[];
};

export type EndState = {
  victory: boolean;
  playTime: number;
  kills: number;
  lv: number;
};

/* v3.0.16 — 퀘스트 보상 수령 팝업 (메이플식 보상 내역 창 — 지급 내역을 명확히 보여준다) */
export type RewardPopupState = {
  title: string;
  lines: { text: string; color?: string }[];
};

/** 상호작용 프롬프트 상태 (NPC 대화/상점/전직 교관 — E키·모바일 버튼 공용) */
export type InteractState = {
  active: boolean;
  label: string;
  kind: "talk" | "shop" | "job" | null;
  /** 대상 월드 좌표 (v2.1 — 프롬프트를 NPC 위에 고정) */
  x?: number;
  y?: number;
};
