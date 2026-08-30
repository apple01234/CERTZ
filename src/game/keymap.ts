/**
 * 키 매핑 (v1.9) — 게임 내 키 재배치 설정.
 *  - 이동(화살표)·ESC는 고정, 나머지 액션 키는 localStorage에 저장 후 자유 배치
 *  - 중복 바인딩 방지: 다른 액션이 쓰던 키를 지정하면 서로 교체(swap)
 */

export type GameAction =
  | "attack"
  | "skill1"
  | "skill2"
  | "potHp"
  | "potMp"
  | "interact"
  | "bag"
  | "shop"
  | "job"
  | "stat"
  | "quest"
  | "opt";

export type KeyMap = Record<GameAction, string>; // 값은 Phaser KeyCode 문자열 (예: "X")

const KEYMAP_STORAGE = "sertz_keymap_v1";

/** 기본 배치 — v1.8까지의 왼손 배치 + 신규 패널 키 */
export const DEFAULT_KEYMAP: KeyMap = {
  attack: "X",
  skill1: "Z",
  skill2: "C",
  potHp: "Q",
  potMp: "R",
  interact: "E",
  bag: "I",
  shop: "F",
  job: "K",
  stat: "T",
  quest: "J",
  opt: "O",
};

/** 액션 한글 라벨 (설정 UI 표시) */
export const ACTION_LABELS: Record<GameAction, string> = {
  attack: "공격",
  skill1: "스킬 1 (주력기)",
  skill2: "스킬 2 (기동기)",
  potHp: "HP 물약",
  potMp: "MP 물약",
  interact: "대화/상호작용",
  bag: "가방",
  shop: "상점 (상인 근처)",
  job: "전직",
  stat: "스탯 창",
  quest: "퀘스트 로그",
  opt: "설정 (키 매핑)",
};

/** 설정 UI에서 쓸 수 있는 키 후보 — WASD 이동 보존을 위해 W/A/S/D 제외 */
export const ASSIGNABLE_KEYS = [
  "Q", "E", "R", "T", "Y", "U", "I", "O", "P",
  "F", "G", "H", "J", "K", "L",
  "V", "B", "N", "M",
  "Z", "X", "C",
] as const;

export function loadKeyMap(): KeyMap {
  if (typeof window === "undefined") return { ...DEFAULT_KEYMAP };
  try {
    const raw = window.localStorage.getItem(KEYMAP_STORAGE);
    if (!raw) return { ...DEFAULT_KEYMAP };
    const parsed = JSON.parse(raw) as Partial<KeyMap>;
    const out = { ...DEFAULT_KEYMAP };
    for (const k of Object.keys(DEFAULT_KEYMAP) as GameAction[]) {
      const v = parsed[k];
      if (typeof v === "string" && /^[A-Z]$/.test(v) && v !== "W" && v !== "A" && v !== "S" && v !== "D") {
        out[k] = v;
      }
    }
    return out;
  } catch {
    return { ...DEFAULT_KEYMAP };
  }
}

export function writeKeyMap(m: KeyMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEYMAP_STORAGE, JSON.stringify(m));
  } catch {
    /* 저장 실패 무시 */
  }
}

export function resetKeyMap(): KeyMap {
  const m = { ...DEFAULT_KEYMAP };
  writeKeyMap(m);
  return m;
}

/** 키 배치 적용 — 같은 키를 쓰던 다른 액션과 자동 교체(swap). 반환: 실제 적용된 맵 */
export function applyKeyBinding(current: KeyMap, action: GameAction, key: string): KeyMap {
  const next: KeyMap = { ...current };
  // W/A/S/D/화살표 보호
  if (["W", "A", "S", "D"].includes(key)) return next;
  if (next[action] === key) return next;
  for (const a of Object.keys(next) as GameAction[]) {
    if (a !== action && next[a] === key) {
      next[a] = next[action]; // 서로 교체 — 바인딩 소실 방지
    }
  }
  next[action] = key;
  writeKeyMap(next);
  return next;
}
