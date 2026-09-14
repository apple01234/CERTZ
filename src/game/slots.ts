/**
 * v1.0.18 — 계정 캐릭터 슬롯 시스템 (메이플스토리 캐릭터 선택창 재현)
 *
 *  저장 구조 3계층:
 *   1. 계정     — sertz_slots_v1 (캐릭터 메타 목록 + 슬롯 수 + 활성 캐릭터)
 *   2. 캐릭터   — sertz_char_<id> (기존 SaveData 1:1 — 캐릭터별 레벨/장비/진행도 개별 저장)
 *   3. 계정 공유 — sertz_union_v1 (유니온 — union.ts, 모든 캐릭터가 공유)
 *
 *  구 세이브(sertz_save_v2)는 첫 부팅 시 1번 캐릭터로 자동 마이그레이션되며
 *  원본은 삭제하지 않는다 (구버전 APK 롤백 안전망).
 */
import { loadSave, writeSave, registerSaveHook, setActiveCharId, type SaveData } from "./config";

export const SLOTS_KEY = "sertz_slots_v1";
export const BASE_SLOTS = 8;
export const MAX_SLOTS = 16;
/** 슬롯 확장 비용 — 유니온 코인 (계정 공유 재화, 유니온 상점에서 구매) */
export const SLOT_EXPAND_COIN = 60;

export type CharMeta = {
  id: string;
  name: string;
  /** 시작(스타트) 1차 클래스 키 — warrior/ranger/mage/thief */
  cls: string | null;
  lv: number;
  stage: string;
  cleared: boolean;
  lastSeen: number;
  createdAt: number;
  rebirths: number;
  /* v1.0.19 (B-1 외형) — 로비에서 고른 색조 (스프라이트 틴트 — 슬롯 카드 미리보기용) */
  lookTint?: number | null;
};

export type SlotsStore = {
  v: 1;
  slots: number;
  activeId: string | null;
  chars: Record<string, CharMeta>;
};

function rawSlots(): SlotsStore | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SLOTS_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as SlotsStore;
    if (!d || d.v !== 1 || typeof d.slots !== "number") return null;
    if (!d.chars || typeof d.chars !== "object") d.chars = {};
    if (d.activeId === undefined) d.activeId = null;
    return d;
  } catch {
    return null;
  }
}

/** 구 세이브 → 1번 캐릭터 마이그레이션 (원본 보존) */
function migrateLegacy(store: SlotsStore) {
  const legacy = loadSave(); // 활성 라우팅 전 레거시 키 직접 조회
  if (!legacy) return;
  const id = `c${Date.now().toString(36)}`;
  window.localStorage.setItem(`sertz_char_${id}`, JSON.stringify(legacy));
  store.chars[id] = {
    id,
    name: legacy.playerName || "세르츠",
    cls: legacy.startCls ?? legacy.cls ?? null,
    lv: legacy.lv ?? 1,
    stage: legacy.stage ?? "village",
    cleared: !!legacy.cleared,
    lastSeen: legacy.lastSeen ?? Date.now(),
    createdAt: Date.now(),
    rebirths: legacy.inf?.rebirths ?? 0,
  };
  store.activeId = id;
}

export function loadSlots(): SlotsStore {
  let store = rawSlots();
  if (!store) {
    store = { v: 1, slots: BASE_SLOTS, activeId: null, chars: {} };
    migrateLegacy(store);
    writeSlots(store);
  }
  return store;
}

export function writeSlots(s: SlotsStore) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SLOTS_KEY, JSON.stringify(s));
  } catch {
    /* 저장 실패 무시 */
  }
}

/* ---------- 활성 캐릭터 라우팅 (config.ts loadSave/writeSave가 이 값을 참조) ---------- */

let activeId: string | null = null;

export function setActiveChar(id: string | null) {
  activeId = id;
  setActiveCharId(id); // config 라우팅 위임 — loadSave/writeSave가 캐릭터 전용 키를 보게 한다
  if (id) {
    const s = loadSlots();
    s.activeId = id;
    writeSlots(s);
  }
}

export function getActiveCharId(): string | null {
  return activeId;
}

/** 로비 복귀 등 — 세션 활성 해제 (계정 화면에서는 세이브 쓰기 금지) */
export function clearActiveChar() {
  activeId = null;
}

/* ---------- 캐릭터 생성/삭제 ---------- */

export type CreateResult = { ok: true; id: string; save: SaveData } | { ok: false; reason: string };

/** 새 캐릭터 생성 — 이름·시작 클래스·외형을 받아 스텁 세이브를 즉시 기록하고 로비로 복귀한다.
 *  스텁 세이브는 game:continue로 월드에 전달되어 인트로 없이 바로 플레이 시작.
 *  v1.0.19 (B-1) — 외형(색조 lookTint) 파라미터 추가 */
export function createCharacter(name: string, cls: string | null, lookTint?: number | null): CreateResult {
  const store = loadSlots();
  const used = Object.keys(store.chars).length;
  if (used >= store.slots) return { ok: false, reason: `캐릭터 슬롯이 부족해요 (${used}/${store.slots})` };
  const trimmed = name.trim().slice(0, 8);
  if (!trimmed) return { ok: false, reason: "캐릭터 이름을 입력해 주세요" };
  const dup = Object.values(store.chars).some((c) => c.name === trimmed);
  if (dup) return { ok: false, reason: "이미 사용 중인 이름이에요" };
  const id = `c${Date.now().toString(36)}${Math.floor(Math.random() * 36).toString(36)}`;
  const now = Date.now();
  const tint = lookTint ?? null;
  const stub: SaveData = {
    stage: "village",
    lv: 1,
    exp: 0,
    maxHp: 100,
    atk: 10,
    cleared: false,
    maxMp: 60,
    playerName: trimmed,
    cls: cls,
    startCls: cls,
    gold: 30,
    lookTint: tint,
  } as SaveData;
  try {
    window.localStorage.setItem(`sertz_char_${id}`, JSON.stringify(stub));
  } catch {
    return { ok: false, reason: "저장 공간에 기록할 수 없어요" };
  }
  store.chars[id] = { id, name: trimmed, cls, lv: 1, stage: "village", cleared: false, lastSeen: now, createdAt: now, rebirths: 0, lookTint: tint };
  writeSlots(store);
  return { ok: true, id, save: stub };
}

export function deleteCharacter(id: string) {
  const store = loadSlots();
  delete store.chars[id];
  if (store.activeId === id) store.activeId = null;
  writeSlots(store);
  try {
    window.localStorage.removeItem(`sertz_char_${id}`);
  } catch {
    /* 무시 */
  }
  if (activeId === id) activeId = null;
}

/** 캐릭터 세이브 조회 — 캐릭터 키에서 직접 읽는다 (라우팅 무관) */
export function readCharSave(id: string): SaveData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`sertz_char_${id}`);
    if (!raw) return null;
    return JSON.parse(raw) as SaveData;
  } catch {
    return null;
  }
}

/** 슬롯 확장 — 유니온 코인 소모 (union.ts에서 차감 후 호출) */
export function expandSlots(): boolean {
  const store = loadSlots();
  if (store.slots >= MAX_SLOTS) return false;
  store.slots += 1;
  writeSlots(store);
  return true;
}

/** 세이브 기록 시 메타 동기화 — WorldScene save() → writeSave 라우팅에서 호출 */
export function syncCharMeta(save: SaveData) {
  const id = activeId;
  if (!id) return;
  const store = loadSlots();
  const meta = store.chars[id];
  if (!meta) {
    store.chars[id] = {
      id,
      name: save.playerName || "세르츠",
      cls: (save as { startCls?: string | null }).startCls ?? save.cls ?? null,
      lv: save.lv ?? 1,
      stage: save.stage ?? "village",
      cleared: !!save.cleared,
      lastSeen: Date.now(),
      createdAt: Date.now(),
      rebirths: save.inf?.rebirths ?? 0,
    };
  } else {
    meta.name = save.playerName || meta.name;
    meta.lv = save.lv ?? meta.lv;
    meta.stage = save.stage ?? meta.stage;
    meta.cleared = !!save.cleared;
    meta.lastSeen = Date.now();
    meta.rebirths = save.inf?.rebirths ?? meta.rebirths;
    const sc = (save as { startCls?: string | null }).startCls ?? save.cls ?? null;
    if (sc) meta.cls = sc;
    /* v1.0.19 (B-1) — 외형 색조 동기화 (세이브에 기록된 값 우선) */
    const lt = (save as { lookTint?: number | null }).lookTint;
    if (lt !== undefined) meta.lookTint = lt;
  }
  writeSlots(store);
}

/** v1.0.19 (B-2) — 유니온 기여 레벨 (메이플 실제 규칙 준용):
 *  60레벨까지는 100% 반영, 60레벨 초과분은 10레벨당 1레벨씩 추가 반영.
 *  예: Lv 75 → 60 + 1 = 61 기여 / Lv 250 → 60 + 19 = 79 기여 */
export function charUnionContribution(lv: number): number {
  if (lv <= 0) return 0;
  return Math.min(lv, 60) + Math.floor(Math.max(0, lv - 60) / 10);
}

/** 유니온 지표 — 보유한 전체 캐릭터의 기여 레벨 합산 (v1.0.19 B-2 공식).
 *  구버전(v1.0.18)은 "Lv60 이상 캐릭터의 레벨 합산"이었으나 지시서 규칙으로 교체 —
 *  이제 60 미만 캐릭터도 레벨 그대로 기여한다 (60까지 100% 반영 규칙). */
export function unionLevelOf(store: SlotsStore): number {
  return Object.values(store.chars).reduce((a, c) => a + charUnionContribution(c.lv), 0);
}

/* 세이브 기록마다 캐릭터 메타 자동 동기화 (WorldScene save() → writeSave 훅) */
registerSaveHook(syncCharMeta);
