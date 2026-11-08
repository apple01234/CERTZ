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
const INTERACT_SPACE_MIGRATION = "haru_interact_space_v1"; // 하루 v1 — E→Space 마이그레이션 플래그

/** 단일 알파벳 또는 화살표 코드만 허용 (v1.0.17 — 화살표 추가) */
const BIND_CODE_RE = /^(UP|DOWN|LEFT|RIGHT|SPACE|[A-Z0-9])$/; // 하루 v1 — SPACE·숫자 저장 허용 (WASD 프리셋 1~5 보존)

/** 기본 배치 — v1.0.4: 이동 화살표 전용, 전투 키는 Z X C V + A S D F 클러스터 (유저 지시)
 *  Z=스킬1 X=공격 C=스킬2 V=스킬3 (기존 유지) / A=스킬4 S=스킬5 D=HP물약 F=MP물약
 *  vc145 (#4) — 친구 창 기본 단축키 R 신설. 기존 FriendsWidget의 B 하드코딩은
 *  자동전투(B)와 충돌하는 버그(#10)의 근원 — 키맵 체계로 일원화해 해지
 *  v1.4.41 (#7) — 화살표 이동 스킴에서는 A/S/D/F 가 이동키가 아니므로 그대로 유효하다.
 *  (WASD 스킴은 아래 WASD_KEYMAP 을 쓴다 — 이동키와 충돌하지 않는 별도 배치) */
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
  /* 하루 v1 (유저 지시) — 상호작용(NPC 대화·채집·상자·차원문)은 "NPC/채집 키" Space 로 통일.
   *  공격은 X 전용(종전 Space 하드코딩 공격 제거). */
  interact: "SPACE",
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
  interact: "SPACE", // vc233 (#1) — Phaser 키 코드는 "SPACE"(전대문자)다. "Space" 는
  //  keyObjs/keys 어느 테이블에도 없어 keyFor("interact") 가 undefined 를 반환했고,
  //  JustDown(undefined) 가 TypeError 를 던져 rAF 루프가 재예약되지 못했다(WASD 프리즈).
  bag: "G",
  shop: "T",
  job: "5",
  stat: "4",
  quest: "3",
  opt: "Escape",
  collection: "Y",
  autohunt: "V",
  friends: "H",
};

/** 스킴별 기본 프리셋 */
export function presetKeyMapFor(scheme: MoveScheme): KeyMap {
  return { ...(scheme === "wasd" ? WASD_KEYMAP : DEFAULT_KEYMAP) };
}

/* ═══ vc288 — 스킬 배치 프리셋 (REVAMP_100 개편 후보 "스킬 프리셋 2~3개") ═══
 *
 * [왜 필요한가]
 *  지금까지 프리셋은 **이동 스킴**(화살표/WASD) 2종뿐이었다. 그건 "손 위치"를 고르는
 *  것이지 "어떤 스킬을 먼저 누를지"를 고르는 것이 아니다.
 *  플레이어마다 손이 다르고, 보스전에서는 생존기가 손에 붙어 있어야 한다.
 *  매번 옵션 창에서 키를 하나씩 바꾸는 건 번거롭다 — 한 번에 갈아끼울 수 있어야 한다.
 *
 * [설계]
 *  프리셋은 **배치만** 바꾼다. 스킬 자체(데미지·쿨·판정)는 건드리지 않는다.
 *  그래야 "프리셋 바꿨더니 세져졌다"는 오해가 생기지 않는다.
 *
 *  · combat  — 기본. 공격 X 를 중심으로 스킬1~3 을 좌우에 몰아 넣는다(현행 유지).
 *  · boss    — 보스전용. 궁극기(5·5b)를 손 닿는 곳으로 올리고, 물약을 멀리 둔다.
 *              보스전은 "궁극기를 언제 쓰나"가 승패를 가르므로 그걸 먼저 손에 쥔다.
 *  · ranged  — 원거리/카이팅. 이동키 반대편에 공격을 두어 달리면서 쏠 수 있게 한다.
 *
 * ponytail: 프리셋을 늘리려면 SKILL_PRESETS 에 항목만 추가한다.
 *  4개를 넘기면 고르는 비용이 이득을 넘으므로 지금은 3개다.
 */

/** 스킬 배치 프리셋 키 */
export type SkillPreset = "combat" | "boss" | "ranged";

/** 프리셋 표시 이름 — UI 는 이걸 그대로 쓴다(문자열 중복 금지). */
export const SKILL_PRESET_LABELS: Record<SkillPreset, string> = {
  combat: "전투 기본",
  boss: "보스전",
  ranged: "원거리",
};

/** 프리셋 설명 — "무엇이 달라지는지" 한 줄. */
export const SKILL_PRESET_HINTS: Record<SkillPreset, string> = {
  combat: "공격 X 중심으로 스킬 1~3 을 좌우에 모읍니다.",
  boss: "궁극기 두 개를 손 닿는 곳으로 올리고 물약을 멀리 둡니다.",
  ranged: "이동키 반대편에 공격을 두어 달리면서 쏠 수 있게 합니다.",
};

/**
 * 프리셋별 배치. **전투/물약 키만** 정의한다 —
 * UI 키(가방·상점·옵션 등)는 스킴 기본값을 그대로 상속한다.
 * 일부만 덮어쓰는 이유: 프리셋마다 UI 키까지 적으면 18개를 3번 반복해야 하고,
 * 그중 하나만 어긋나도 "프리셋 바꿨더니 가방이 안 열린다"가 된다.
 */
const PRESET_OVERRIDES: Record<SkillPreset, Partial<KeyMap>> = {
  combat: {}, // 스킴 기본값 그대로
  boss: {
    /* 궁극기를 검지/중지 바로 아래로 — 보스전에서 가장 늦게 누르면 지는 키다.
     *
     * 주의: 기본 배치가 이미 1~5, A~Z 중 SPACE 를 뺀 대부분을 쓴다.
     * 남는 알파벳은 L N P U W 뿐이므로, 덮어쓸 수 있는 키는 **원래 스킬이 쓰던 키**다
     * (교체 방식: skill5 는 S 를 쓰고 있었으니 F 를 주고, F 를 쓰던 skill3 을 U 로 옮긴다).
     * 중복이 생기면 테스트가 잡는다 — 실제로 Z·G 중복을 두 번 잡았다. */
    skill5: "F",    /* F 를 가져옴 */
    skill3: "U",    /* 비어 있던 키로 밀어냄 */
    skill5b: "W",   /* 빈 키 (제2궁극기) */
    attack: "X",    /* 그대로 */
    potHp: "1",
    potMp: "2",
  },
  ranged: {
    /* 이동키(화살표 또는 WASD)와 물리적으로 먼 **오른손 쪽**에 공격 계열을 둔다.
     * 왼손은 이동, 오른손은 공격 — 달리면서 쏘는 자세.
     *
     * 빈 알파벳은 L N P U W 뿐이다. 기존 키를 빼앗으면 그 액션이 다른 키와
     * 충돌하므로(실제로 shop·friends 와 두 번 충돌했다), **빈 키에만** 배정하고
     * 나머지는 스킴 기본값을 그대로 둔다. */
    attack: "P",
    skill1: "L",
    skill2: "N",
    skill3: "U",
    skill4: "W",
    potHp: "1",
    potMp: "2",
  },
};

/**
 * 프리셋 + 스킴을 합쳐 완전한 키맵을 만든다.
 *
 * 이동키와 충돌하는 배정은 **버린다** — WASD 스킴에서 W/A/S/D 를 스킬에 주면
 * 이동이 막혀 게임이 진행되지 않는다.
 */
export function keyMapForPreset(preset: SkillPreset, scheme: MoveScheme): KeyMap {
  const base = presetKeyMapFor(scheme);
  const out: KeyMap = { ...base, ...PRESET_OVERRIDES[preset] };
  /* 이동 키와 겹치면 스킴 기본값으로 되돌린다(안전망). */
  const move = moveKeysFor(scheme);
  const moveCodes = new Set([move.left, move.right, move.up, move.down]);
  for (const action of Object.keys(out) as GameAction[]) {
    if (moveCodes.has(out[action])) out[action] = base[action];
  }
  return out;
}

const SKILL_PRESET_STORAGE = "sertz_skillpreset_v1";

/** 저장된 스킬 프리셋을 읽는다. 없거나 이상하면 "combat". */
export function loadSkillPreset(): SkillPreset {
  try {
    const v = window.localStorage.getItem(SKILL_PRESET_STORAGE);
    if (v === "combat" || v === "boss" || v === "ranged") return v;
  } catch {
    /* 저장소 접근 불가 — 기본값 */
  }
  return "combat";
}

/** 스킬 프리셋을 저장한다. */
export function writeSkillPreset(p: SkillPreset) {
  try {
    window.localStorage.setItem(SKILL_PRESET_STORAGE, p);
  } catch {
    /* 저장 실패는 게임 진행에 영향 없음 */
  }
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
  /* vc233 (#1) — Phaser 키 코드는 "SPACE"/"ESC"/"TAB" 이다.
   *  종전 "Space"/"Escape"/"Tab" 은 keyObjs·keys 어느 테이블에도 없어,
   *  이 키를 액션에 배정하면 keyFor() 가 undefined 를 반환하고
   *  JustDown(undefined) 가 TypeError 로 rAF 루프를 정지시켰다(WASD 프리즈와 동일 경로).
   *  등록 코드(ALL_KEYS)와 동일한 표기를 쓴다. */
  "SPACE", "ESC", "TAB",
] as const;

/** 화살표 코드 (WASD 스킴에서 액션 배정 가능) */
export const ARROW_CODES = ["UP", "DOWN", "LEFT", "RIGHT"] as const;

/** 키 표시 라벨 — 화살표 코드는 기호로 (설정 UI·HUD 배지 공용) */
export function keyLabel(code: string): string {
  if (code === "UP") return "↑";
  if (code === "DOWN") return "↓";
  if (code === "LEFT") return "←";
  if (code === "RIGHT") return "→";
  if (code === "SPACE") return "Space";
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
    /* 하루 v1 — 상호작용 E → Space 1회 마이그레이션. Space 를 쓰던 다른 액션은 E 와 맞교환. */
    if (!window.localStorage.getItem(INTERACT_SPACE_MIGRATION)) {
      if (out.interact === "E") {
        for (const a of Object.keys(out) as GameAction[]) if (a !== "interact" && out[a] === "SPACE") out[a] = "E";
        out.interact = "SPACE";
        try { window.localStorage.setItem(KEYMAP_STORAGE, JSON.stringify(out)); } catch { /* 무시 */ }
      }
      try { window.localStorage.setItem(INTERACT_SPACE_MIGRATION, "1"); } catch { /* 무시 */ }
    }
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
