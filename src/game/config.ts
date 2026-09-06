/** 게임 전역 상수 */
export const GAME_W = 960;
export const GAME_H = 540;

export const COLORS = {
  bg: 0x05070d,
  hp: 0xe84a5a,
  mp: 0x4aa8e8,
  exp: 0x8fe84a,
  gold: 0xffd76a,
  portal: 0x9d7aff,
};

/** 세이브 키 (Capacitor WebView localStorage 호환) */
export const SAVE_KEY = "sertz_save_v2";

/** 음소거 기본 설정 키 — 세이브와 별도 보관 (저장 데이터 삭제 후에도 유지) */
const MUTE_KEY = "sertz_muted";

export function loadMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeMuted(m: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MUTE_KEY, m ? "1" : "0");
  } catch {
    /* 무시 */
  }
}

/** 기본 주인공 이름 — 인트로에서 이름을 정하기 전까지 대사 치환용 */
export const DEFAULT_NAME = "세르츠";

/** 플레이어 이름 (세이브 무관 전역 — DialogueBox/배너 치환용) */
let playerName = DEFAULT_NAME;

export function getPlayerName(): string {
  return playerName;
}

export function setPlayerName(name: string) {
  const trimmed = name.trim().slice(0, 8);
  playerName = trimmed.length > 0 ? trimmed : DEFAULT_NAME;
}

export type SaveData = {
  stage: string;
  lv: number;
  exp: number;
  maxHp: number;
  atk: number;
  cleared: boolean;
  /* ↓ 레벨업 MP 성장 복원 (v1.9 — 구 세이브 호환: 없으면 60 기본) */
  maxMp?: number;
  /* ↓ 플레이어 이름 (인트로 플레이 시퀀스에서 지정 — 구 세이브 호환 기본값) */
  playerName?: string;
  /* ↓ 2D MMORPG 기본 요소 (구 세이브 호환: 로드 시 기본값 채움) */
  gold?: number;
  potions?: { hp: number; mp: number };
  weapon?: string;
  armor?: string;
  owned?: string[];
  /* ↓ RPG 2차 확장: 강화/장신구 (구 세이브 호환) */
  upWea?: number;
  upArm?: number;
  /* v3.0.5 — 스타포스 마일스톤 HP 보너스 (이미 maxHp에 가산된 총액 — 중복 가산 방지) */
  sfHp?: number;
  /* v3.0.7 — 장신구 스타포스 (itemKey → 성) + 강화 주문서 충전 수 */
  accUp?: Record<string, number>;
  starBless?: number;
  /** v3.0.7 — 장신구 스타포스 HP 마일스톤 가산 이력 (중복 가산 방지) */
  accHp?: number;
  accessory?: string | null;
  /* v2.9 (#8) — 장신구 다중 슬롯 (반지 4 + 펜던트 2) · 과금 화폐 */
  accessories?: string[];
  emerald?: number;
  /* ↓ 퀘스트 진행 (스테이지별 퀘스트 인덱스 — 구 세이브 호환 기본값 {}) */
  questIdx?: Record<string, number>;
  /* ↓ 전직 클래스 (v1.7 — 구 세이브 호환 기본값 null) */
  cls?: string | null;
  /* ↓ AP 스탯 (v1.9 — 구 세이브 호환: 기본 5/5/5/5 + 레벨만큼 AP 소급) */
  stats?: { str: number; dex: number; int: number; luk: number };
  ap?: number;
  /* ↓ BM (v1.9 — 버프 물약/펫/치장) */
  buffItems?: Record<string, number>;
  buffs?: { key: string; remain: number; total: number }[];
  pets?: string[];
  pet?: string | null;
  /* ↓ 전직 스토리 진행 (v2.0 — 구 세이브 호환 기본값 / v3.1.0 — fam: 미전직 시련 계열) */
  jobStory?: { tier: 1 | 2 | 3; step: number; hunt: number; fam?: string } | null;
  jobStoryDone?: number[];
  /* v3.1.0 (#전직스토리선행) — 시련 스토리 중 선택해둔 1차 클래스 (스토리 완료 시 적용) */
  pendingJobClass?: string | null;
  cosmetics?: string[];
  cosmetic?: string | null;
  /* ↓ 친구 시스템 (v2.1 — 구 세이브 호환: 로드 시 자동 발급/기본값) */
  fcode?: string;
  friends?: { code: string; name: string }[];
  /* ↓ 반복 토벌 의뢰 수주 해금 (v2.3 — NPC에게 말 걸어 해금, 지시 #4) */
  repeatOn?: boolean;
  /* v3.0.6 — 반복 의뢰 진행도 (재입장 시 카운트 유지) */
  repeatNeed?: number;
  huntCount?: number;
  repeatStage?: string;
  /* v3.0.6 — 자동 물약/자동 버프 설정 (지시 #5) */
  autoUse?: { hpPct: number; mpPct?: number; mpOn: boolean; buffs: string[] };
  /* ↓ 이미 본 스토리 대사 (v2.3 — 재입장 시 대사 재생 방지, 지시 #1) */
  seen?: string[];
  /* ↓ 방문한 구역 목록 (v2.5 — 지역 이동 부적 워프 대상, 지시 #7) */
  visited?: string[];
  /* ↓ 자동사냥 토글 (v2.5 — 펫 보유 시에만 유효, 지시 #8) */
  autoHunt?: boolean;
  /* ----- v3.0.15 ----- */
  /* #2 — 레벨업 시 스탯 자동배분 on/off */
  autoAlloc?: boolean;
  /* #6/#7 — 물약 퀵슬롯 장착 (슬롯 → 아이템키). 기본 potion_hp/potion_mp */
  quickPots?: { hp: string; mp: string };
  /* #13 — eert 큐브 잠재옵션 (아이템키 → 잠재) + maxHP 가산 이력 */
  potentials?: Record<string, { grade: number; lines: { k: string; v: number }[] }>;
  potHpApplied?: number;
  /* #11 — 해금된 챕터 테마 장비 세트 (챕터키 목록) */
  unlockedSets?: string[];
  /* #8 — 퀘스트 수락/추적 (스테이지 → 수락 인덱스, 추적 스테이지 키) */
  questAccepted?: Record<string, number>;
  questTracked?: string | null;
  /* v3.0.16 — 몬스터 컬렉션 처치 기록 (id → 처치 수, 최초 처치 시 등록) */
  monsterKills?: Record<string, number>;
  /* v3.0.22 (#43/#44) — 챕터별 세계수 결정 수집 기록 (챕터키 → 수집 수) */
  fragmentsFound?: Record<string, number>;
  /* v3.0.22 (#50) — 세계수의 가호 (아홉 결정 전부 수집 시 영구 해방) */
  worldtreeBlessing?: boolean;
  /* v3.0.28 (#보스난이도) — 진행 중 보스전의 난이도 (이지/노말/하드/카오스) — 재접속 복구용 */
  bossDiff?: string;
  /* v3.3.0 (지시 #3/#8) — 5차 각성 상태 + 각성 시련 완료 여부
   *  fifth=true면 레벨 무관하게 궁극기 해금 + 전 스킬 강화 적용 */
  fifth?: boolean;
  fifthStoryDone?: boolean;
}

/* 친구 고유번호 (6자리) — 혼동되는 문자(O/0, I/1 등) 제외한 세트 */
const FCODE_CHARS = "ACDEFGHJKLMNPQRTUVWXY34679";

export function makeFcode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += FCODE_CHARS[Math.floor(Math.random() * FCODE_CHARS.length)];
  }
  return s;
}

/** 세이브의 친구 코드 확보 — 없으면 발급 후 즉시 저장 (멀티 접속 시 서버 전파용) */
export function ensureFcode(save: SaveData): string {
  if (save.fcode && /^[A-Z0-9]{4,12}$/.test(save.fcode)) return save.fcode;
  save.fcode = makeFcode();
  writeSave(save);
  return save.fcode;
}

/** 첫 세이브 생성 전 임시 코드 (세션 내 고정 — 이후 첫 저장 시 승격) */
let sessionFcode: string | null = null;

/** 친구 코드 조회 — 세이브 있으면 저장된 값, 없으면 세션 임시 코드 */
export function getFcode(): string {
  const save = loadSave();
  if (save) return ensureFcode(save);
  if (!sessionFcode) sessionFcode = makeFcode();
  return sessionFcode;
}

/** 세이브 친구 목록 조작 헬퍼 — 로드→변경→저장 후 반환 */
export function mutateFriends(fn: (list: { code: string; name: string }[]) => { code: string; name: string }[]): { code: string; name: string }[] {
  const save = loadSave();
  const list = save?.friends ?? [];
  const next = fn(list.map((f) => ({ code: String(f.code || "").toUpperCase().slice(0, 12), name: String(f.name || "").slice(0, 8) })));
  if (save) {
    save.friends = next;
    writeSave(save);
  }
  return next;
}

export function loadSave(): SaveData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as SaveData;
    if (!d || typeof d.stage !== "string") return null;
    // 신규 필드 기본값 채우기 (구버전 세이브 호환)
    if (typeof d.gold !== "number") d.gold = 30;
    if (!d.potions) d.potions = { hp: 2, mp: 1 };
    if (typeof d.weapon !== "string") d.weapon = "weapon_1";
    if (typeof d.armor !== "string") d.armor = "armor_1";
    if (!Array.isArray(d.owned)) d.owned = [d.weapon, d.armor];
    // 강화/장신구 (구버전 세이브 호환)
    if (typeof d.upWea !== "number") d.upWea = 0;
    if (typeof d.upArm !== "number") d.upArm = 0;
    // v3.0.7 — 장신구 스타포스/강화 주문서 (구버전 세이브 호환)
    if (!d.accUp || typeof d.accUp !== "object") d.accUp = {};
    if (typeof d.starBless !== "number") d.starBless = 0;
    if (d.accessory === undefined) d.accessory = null;
    // v2.9 — 장신구 다중 슬롯 마이그레이션 (구 accessory 1개 → 배열)
    if (!Array.isArray(d.accessories)) d.accessories = d.accessory ? [d.accessory] : [];
    if (typeof d.emerald !== "number") d.emerald = 0;
    // 퀘스트 진행 (구버전 세이브 호환 — 처음부터)
    if (!d.questIdx || typeof d.questIdx !== "object") d.questIdx = {};
    // 전직 클래스 (구버전 세이브 호환 — 미전직)
    if (d.cls === undefined) d.cls = null;
    // AP 스탯 (v1.9 — 구 세이브는 기본 5/5/5/5 + 레벨만큼 AP 소급 지급)
    if (!d.stats || typeof d.stats !== "object") {
      const lv = typeof d.lv === "number" ? d.lv : 1;
      d.stats = { str: 5, dex: 5, int: 5, luk: 5 };
      d.ap = Math.max(0, (lv - 1) * 5);
    }
    if (typeof d.ap !== "number") d.ap = 0;
    // BM (v1.9 — 구 세이브 호환 기본값)
    if (!d.buffItems || typeof d.buffItems !== "object") d.buffItems = {};
    if (!Array.isArray(d.buffs)) d.buffs = [];
    if (!Array.isArray(d.pets)) d.pets = [];
    if (d.pet === undefined) d.pet = null;
    if (!Array.isArray(d.cosmetics)) d.cosmetics = [];
    if (d.cosmetic === undefined) d.cosmetic = null;
    // 전직 스토리 (v2.0 — 구 세이브 호환)
    if (d.jobStory === undefined) d.jobStory = null;
    if (!Array.isArray(d.jobStoryDone)) d.jobStoryDone = [];
    // 친구 (v2.1 — 구 세이브 호환: 코드 자동 발급)
    if (!d.fcode || !/^[A-Z0-9]{4,12}$/.test(d.fcode)) {
      d.fcode = makeFcode();
      // 발급만으로 저장하지 않음 — 다음 writeSave 시 반영 (로드 폭주 방지)
    }
    if (!Array.isArray(d.friends)) d.friends = [];
    // 반복 의뢰 해금/본 대사 (v2.3 — 구 세이브 호환 기본값)
    if (typeof d.repeatOn !== "boolean") d.repeatOn = false;
    if (!Array.isArray(d.seen)) d.seen = [];
    // 방문 기록/자동사냥 (v2.5 — 구 세이브 호환 기본값)
    if (!Array.isArray(d.visited)) d.visited = [];
    if (typeof d.autoHunt !== "boolean") d.autoHunt = false;
    // v3.0.15 — 신규 설정/시스템 기본값 (구 세이브 호환)
    if (typeof d.autoAlloc !== "boolean") d.autoAlloc = false;
    if (!d.quickPots || typeof d.quickPots !== "object") d.quickPots = { hp: "potion_hp", mp: "potion_mp" };
    if (!d.potentials || typeof d.potentials !== "object") d.potentials = {};
    if (typeof d.potHpApplied !== "number") d.potHpApplied = 0;
    if (!Array.isArray(d.unlockedSets)) d.unlockedSets = [];
    if (!d.questAccepted || typeof d.questAccepted !== "object") d.questAccepted = {};
    if (d.questTracked === undefined) d.questTracked = null;
    // v3.0.16 — 몬스터 컬렉션 (구 세이브 호환)
    if (!d.monsterKills || typeof d.monsterKills !== "object") d.monsterKills = {};
    // v3.0.22 — 결정 수집/세계수 가호 (구 세이브 호환)
    if (!d.fragmentsFound || typeof d.fragmentsFound !== "object") d.fragmentsFound = {};
    if (typeof d.worldtreeBlessing !== "boolean") d.worldtreeBlessing = false;
    return d;
  } catch {
    return null;
  }
}

export function writeSave(data: SaveData) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    /* 저장 실패는 무시 */
  }
}

export function clearSave() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    /* 무시 */
  }
}
