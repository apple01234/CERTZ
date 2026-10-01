/**
 * 키 매핑 (v1.9) — 게임 내 키 재배치 설정.
 *  - v1.0.4: 이동은 화살표 전용 (WASD 이동 제거 — 유저 지시). W/A/S/D/F도 자유 배치 가능
 *  - ESC는 고정, 나머지 액션 키는 localStorage에 저장 후 자유 배치
 *  - 중복 바인딩 방지: 다른 액션이 쓰던 키를 지정하면 서로 교체(swap)
 */

export type GameAction =
  | "attack"
  | "skill1"
  | "skill2"
  | "skill3"
  | "skill4"
  | "skill5"
  | "potHp"
  | "potMp"
  | "interact"
  | "bag"
  | "shop"
  | "job"
  | "stat"
  | "quest"
  | "opt"
  | "collection";

export type KeyMap = Record<GameAction, string>; // 값은 Phaser KeyCode 문자열 (예: "X")

const KEYMAP_STORAGE = "sertz_keymap_v2"; // v1.0.4 — 이동 체계 변경으로 저장 맵 리셋

/** 기본 배치 — v1.0.4: 이동 화살표 전용, 전투 키는 Z X C V + A S D F 클러스터 (유저 지시)
 *  Z=스킬1 X=공격 C=스킬2 V=스킬3 (기존 유지) / A=스킬4 S=스킬5 D=HP물약 F=MP물약 */
export const DEFAULT_KEYMAP: KeyMap = {
  attack: "X",
  skill1: "Z",
  skill2: "C",
  skill3: "V",
  skill4: "A",
  skill5: "S",
  potHp: "D",
  potMp: "F",
  interact: "E",
  bag: "I",
  shop: "G",
  job: "K",
  stat: "T",
  quest: "J",
  opt: "O",
  collection: "M",
};

/** 액션 한글 라벨 (설정 UI 표시) */
export const ACTION_LABELS: Record<GameAction, string> = {
  attack: "공격",
  skill1: "스킬 1 (주력기)",
  skill2: "스킬 2 (기동기)",
  skill3: "스킬 3 (3차기)",
  skill4: "스킬 4 (4차기)",
  skill5: "스킬 5 (궁극기 · Lv.200)",
  potHp: "HP 물약",
  potMp: "MP 물약",
  interact: "대화/상호작용",
  bag: "가방",
  shop: "상점 (상인 근처)",
  job: "전직",
  stat: "스탯 창",
  quest: "퀘스트 로그",
  opt: "설정 (키 매핑)",
  collection: "몬스터 컬렉션",
};

/** 설정 UI에서 쓸 수 있는 키 후보 — v1.0.4: 이동이 화살표 전용이라 알파벳 전체 자유 배치 */
export const ASSIGNABLE_KEYS = [
  "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P",
  "A", "S", "D", "F", "G", "H", "J", "K", "L",
  "Z", "X", "C", "V", "B", "N", "M",
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
      if (typeof v === "string" && /^[A-Z]$/.test(v)) {
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
  // 화살표는 KeyMap 값이 아니라 정규식 /^[A-Z]$/에서 자동 차단
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
