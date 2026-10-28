/**
 * 키 매핑 (v1.9) — 게임 내 키 재배치 설정.
 *  - v1.0.17: 이동 스킴 2종 신설 — "화살표 이동"(기본·현행) / "WASD 이동"(스킬이 오른손 클러스터로 전환).
 *    WASD 스킴에서는 W/A/S/D가 이동 전용이 되고, 화살표가 액션 키로 자유 배정 가능해진다.
 *    스킴 전환 시 전투 키 프리셋이 함께 적용된다(이후 자유 재배치 가능).
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
  | "skill5b"
  | "fishing"
  | "potHp"
  | "potMp"
  | "interact"
  | "bag"
  | "shop"
  | "job"
  | "stat"
  | "quest"
  | "opt"
  | "collection"
  | "autohunt"
  | "friends";

/** 키 매핑 — 값은 단일 알파벳(예: "X") 또는 v1.0.17부터 화살표 코드("UP"|"DOWN"|"LEFT"|"RIGHT") */
export type KeyMap = Record<GameAction, string>;

/** v1.0.17 — 이동 스킴. "arrows"=화살표 이동(기본), "wasd"=WASD 이동(스킬 오른손) */
export type MoveScheme = "arrows" | "wasd";

const KEYMAP_STORAGE = "sertz_keymap_v2"; // v1.0.4 — 이동 체계 변경으로 저장 맵 리셋
const MOVE_SCHEME_STORAGE = "sertz_movescheme_v1"; // v1.0.17 — 이동 스킴 저장

/** 단일 알파벳 또는 화살표 코드만 허용 (v1.0.17 — 화살표 추가) */
const BIND_CODE_RE = /^(UP|DOWN|LEFT|RIGHT|[A-Z])$/;

/** 기본 배치 — v1.0.4: 이동 화살표 전용, 전투 키는 Z X C V + A S D F 클러스터 (유저 지시)
 *  Z=스킬1 X=공격 C=스킬2 V=스킬3 (기존 유지) / A=스킬4 S=스킬5 D=HP물약 F=MP물약
 *  vc145 (#4) — 친구 창 기본 단축키 R 신설. 기존 FriendsWidget의 B 하드코딩은
 *  자동전투(B)와 충돌하는 버그(#10)의 근원 — 키맵 체계로 일원화해 해지 */
export const DEFAULT_KEYMAP: KeyMap = {
  attack: "X",
  skill1: "Z",
  skill2: "C",
  skill3: "V",
  skill4: "A",
  skill5: "S",
  /* vc146 (#2) — 제2궁극기 기본 Q (Z X C V + A S D F 클러스터 인접 · 미사용 키) */
  skill5b: "Q",
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
  /* vc142 (#1) — PC 자동전투 토글 단축키 (모바일 버튼과 동일 이벤트 rpg:autohunt) */
  autohunt: "B",
  /* vc145 (#4) — 친구 창 토글 (FriendsWidget이 키맵을 읽어 처리) */
  friends: "R",
  /* v1.1.8 (#개편 A46) — 낚시. 필드에서 낚싯대를 던진다. */
  fishing: "H",
};

/** v1.0.17 — WASD 이동 스킴 기본 배치.
 *  v1.4.35 (유저 지시 #7 "WASD 배치 사용시 다른 창 단축키랑 스킬 단축키 안겹치게 해
 *   (스킬:Q, E, Z, X, C, F, R 등등)") —
 *  종전엔 전투 키를 오른손 클러스터(J K L I U O P)로 밀어냈는데,
 *  ⓐ 그 자리는 다른 프로그램·브라우저 확장이 즐겨 잡는 영역이고
 *  ⓑ UI 키(X 가방·C 전직·V 퀘스트·F 설정)가 오히려 왼손 홈에 남아
 *     사용자가 스킬로 쓰고 싶은 Q/E/Z/X/C/F/R 과 정면으로 겹쳤다.
 *  → 스킬·공격을 **왼손 홈열(Q E R F C X Z)** 로 모으고,
 *    UI 키는 오른손/숫자열(1~5, G, T, B, H)로 밀어 서로 영역을 침범하지 않게 한다.
 *  이동 WASD 는 왼손이지만 스킬은 그 바로 옆 열이라 이동 중에도 눌린다.
 */
export const WASD_KEYMAP: KeyMap = {
  /* ── 전투 (왼손 홈열) ── */
  attack: "X",   /* 손가락 바로 아래 · 가장 자주 누르는 키 */
  skill1: "Z",   /* X 왼쪽 */
  skill2: "C",   /* X 오른쪽 */
  skill3: "F",   /* 검지 홈 */
  skill4: "R",   /* 검지 위 */
  skill5: "Q",   /* 약지 위 — 궁극기 */
  skill5b: "E",  /* 중지 위 — 제2궁극기 */
  potHp: "1",
  potMp: "2",
  /* ── UI (오른손·숫자열 — 전투 키와 물리적으로 분리) ── */
  interact: "Space",
  bag: "G",
  shop: "T",
  job: "5",
  stat: "4",
  quest: "3",
  opt: "Escape",
  collection: "Y",
  autohunt: "V",
  friends: "H",
  fishing: "B",
};

/** 스킴별 기본 프리셋 */
export function presetKeyMapFor(scheme: MoveScheme): KeyMap {
  return { ...(scheme === "wasd" ? WASD_KEYMAP : DEFAULT_KEYMAP) };
}

/** v1.0.17 — 스킴별 이동 키. 이 키들은 액션 배정이 차단된다(이동 전용).
 *  arrows 스킴: 화살표 / wasd 스킴: W A S D */
export function moveKeysFor(scheme: MoveScheme): { left: string; right: string; up: string; down: string } {
  return scheme === "wasd"
    ? { left: "A", right: "D", up: "W", down: "S" }
    : { left: "LEFT", right: "RIGHT", up: "UP", down: "DOWN" };
}

/** 해당 스킴에서 code가 이동 전용 키인지 */
export function isMoveKey(code: string, scheme: MoveScheme): boolean {
  const mk = moveKeysFor(scheme);
  return code === mk.left || code === mk.right || code === mk.up || code === mk.down;
}

/** 액션 한글 라벨 (설정 UI 표시) */
export const ACTION_LABELS: Record<GameAction, string> = {
  attack: "공격",
  skill1: "스킬 1 (주력기)",
  skill2: "스킬 2 (기동기)",
  skill3: "스킬 3 (3차기)",
  skill4: "스킬 4 (4차기)",
  skill5: "스킬 5 (궁극기 · Lv.200)",
  skill5b: "스킬 6 (제2궁극기 · 쿨 2분)",
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
  autohunt: "자동전투 토글",
  friends: "친구 창",
  fishing: "낚시 (필드)",
};

/** 설정 UI에서 쓸 수 있는 키 후보 — v1.0.4: 이동이 화살표 전용이라 알파벳 전체 자유 배치
 *  v1.0.17: WASD 스킴에서는 화살표도 액션 키 후보에 합류 (W/A/S/D는 이동 전용으로 제외) */
export const ASSIGNABLE_KEYS = [
  "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P",
  "A", "S", "D", "F", "G", "H", "J", "K", "L",
  "Z", "X", "C", "V", "B", "N", "M",
  /* v1.4.35 (지시 #7) — WASD 스킴에서 물약·UI 를 숫자열로 옮겼는데
   *  이 목록에 없으면 배정 자체가 거부되어 키가 먹지 않는다. */
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "0",
  "Space", "Escape", "Tab",
] as const;

/** 화살표 코드 (WASD 스킴에서 액션 배정 가능) */
export const ARROW_CODES = ["UP", "DOWN", "LEFT", "RIGHT"] as const;

/** 키 표시 라벨 — 화살표 코드는 기호로 (설정 UI·HUD 배지 공용) */
export function keyLabel(code: string): string {
  if (code === "UP") return "↑";
  if (code === "DOWN") return "↓";
  if (code === "LEFT") return "←";
  if (code === "RIGHT") return "→";
  return code;
}

/** v1.0.17 — 이동 스킴 로드/저장 (localStorage, 기본 "arrows") */
export function loadMoveScheme(): MoveScheme {
  if (typeof window === "undefined") return "arrows";
  try {
    const v = window.localStorage.getItem(MOVE_SCHEME_STORAGE);
    return v === "wasd" ? "wasd" : "arrows";
  } catch {
    return "arrows";
  }
}

export function writeMoveScheme(s: MoveScheme) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MOVE_SCHEME_STORAGE, s);
  } catch {
    /* 저장 실패 무시 */
  }
}

/** 저장된 맵을 현재 스킴에서 유효하게 만든다 — 이동 전용 키에 묶인 액션은 스킴 프리셋값으로 되돌림 */
function sanitizeForScheme(m: KeyMap, scheme: MoveScheme): KeyMap {
  const preset = presetKeyMapFor(scheme);
  for (const a of Object.keys(DEFAULT_KEYMAP) as GameAction[]) {
    const v = m[a];
    if (typeof v !== "string" || !BIND_CODE_RE.test(v) || isMoveKey(v, scheme)) {
      m[a] = preset[a];
    }
  }
  return m;
}

export function loadKeyMap(scheme: MoveScheme = loadMoveScheme()): KeyMap {
  if (typeof window === "undefined") return { ...presetKeyMapFor(scheme) };
  try {
    const raw = window.localStorage.getItem(KEYMAP_STORAGE);
    if (!raw) return { ...presetKeyMapFor(scheme) };
    const parsed = JSON.parse(raw) as Partial<KeyMap>;
    const out = { ...presetKeyMapFor(scheme) };
    for (const k of Object.keys(DEFAULT_KEYMAP) as GameAction[]) {
      const v = parsed[k];
      if (typeof v === "string" && BIND_CODE_RE.test(v)) {
        out[k] = v;
      }
    }
    /* vc145 (#10) — 구 저장 맵에 friends가 없던 시절: 저장값이 B(구 하드코딩 잔재·자동전투와 충돌)면
     *  기본 R로 되돌린다. B는 이제 자동전투 전용. */
    if (out.friends === "B" && !parsed.friends) out.friends = "R";
    return sanitizeForScheme(out, scheme);
  } catch {
    return { ...presetKeyMapFor(scheme) };
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

/** 스킴 프리셋으로 초기화 (v1.0.17 — 스킴 인자 추가, 생략 시 현재 스킴) */
export function resetKeyMap(scheme: MoveScheme = loadMoveScheme()): KeyMap {
  const m = presetKeyMapFor(scheme);
  writeKeyMap(m);
  return m;
}

/** 키 배치 적용 — 같은 키를 쓰던 다른 액션과 자동 교체(swap). 반환: 실제 적용된 맵
 *  v1.0.17 — 현재 스킴의 이동 전용 키(WASD 스킴의 W/A/S/D 등) 배정은 무시한다. */
export function applyKeyBinding(current: KeyMap, action: GameAction, key: string, scheme: MoveScheme = loadMoveScheme()): KeyMap {
  if (isMoveKey(key, scheme)) return current; // 이동 전용 키는 액션 배정 불가
  const next: KeyMap = { ...current };
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
