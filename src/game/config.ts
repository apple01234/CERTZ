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

export type SaveData = {
  stage: string;
  lv: number;
  exp: number;
  maxHp: number;
  atk: number;
  cleared: boolean;
};

export function loadSave(): SaveData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as SaveData;
    if (!d || typeof d.stage !== "string") return null;
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
