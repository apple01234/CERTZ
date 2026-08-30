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
  accessory?: string | null;
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
  cosmetics?: string[];
  cosmetic?: string | null;
};

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
    if (d.accessory === undefined) d.accessory = null;
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
