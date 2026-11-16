/**
 * 2026-11-14 — 옛 '9개의 바다'(하울르스톤 : 이그드라실) 시절 식별자 → 새 식별자 이관표.
 *
 *  [왜] 유저 지시 "9개의 바다 잔재 전부 없애 — 내부 코드까지". 코드·파일 이름의 옛 키
 *   (스테이지 `howlrstone…`, 보스 `nidhog`·`surt`…, 테마 `alfheim`·`hel`…, 대사 `howl…`)를
 *   전부 새 이름으로 바꿨다. 그런데 **구 세이브**(스테이지·장비·인벤토리·퀘스트 진행·본 대사·
 *   방문 지역·피규어 등)와 서버에 남은 거래 매물은 옛 키를 그대로 들고 있다.
 *   여기서 한 번에 새 키로 옮겨야 장비·진행이 사라지지 않는다(데이터 손실 방지).
 *
 *  [규칙] 옛 키는 **이 파일에만** 남긴다(테스트가 다른 파일 재유입을 막는다).
 *   토큰 경계 규칙은 코드 일괄 변경 때 쓴 것과 같다 — 앞뒤가 영문 소문자가 아닐 때만 바꾼다
 *   (예: `bd_nidhog`→`bd_blackwyrm`, `howlrstone3x2`→`lilacworld3x2`, `howlBook`→`lwBook`).
 */
const LOWER: [string, string][] = [
  ["nidhogg", "blackwyrm"], ["nidhog", "blackwyrm"], ["surt", "flamegiant"], ["fenrir", "greedwolf"],
  ["skoll", "twinwolf"], ["hati", "twinmate"], ["gram", "warden"], ["abudditos", "doomwyrm"],
  ["vord", "riftwarden"], ["jorm", "unionserpent"], ["nagr", "angelknight"],
  ["alfheim", "fairyglade"], ["muspelheim", "emberland"], ["niflheim", "frostland"],
  ["nidavellir", "forgehall"], ["hel", "duskrealm"],
];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

const RULES: [RegExp, string][] = [
  [/(?<![a-z])howlrstone/g, "lilacworld"],
  [/Howlrstone/g, "Lilacworld"],
  [/HOWLRSTONE/g, "LILACWORLD"],
  [/(?<![A-Za-z])howl(?=[A-Z])/g, "lw"],
  [/(?<![A-Za-z])helhound/g, "duskhound"],
  [/(?<![A-Za-z])muspel(?=[A-Z])/g, "emberland"],
  [/(?<=[a-z])Muspel(?=[A-Z])/g, "Emberland"],
  [/(?<![A-Za-z])nifl(?=[A-Z])/g, "frostland"],
  [/(?<![A-Za-z])yggfeast/g, "unionfeast"],
  [/(?<![A-Za-z])valkyrie(?![a-z])/g, "wingmaiden"],
  [/(?<![A-Za-z])valk(?![a-z])/g, "wingmaiden"],
  ...LOWER.flatMap(([o, n]): [RegExp, string][] => [
    [new RegExp(`(?<![A-Za-z])${o}(?![a-z])`, "g"), n],
    [new RegExp(`(?<=[a-z])${cap(o)}(?![a-z])`, "g"), cap(n)],
  ]),
];
const ANY_OLD = new RegExp(`howlrstone|Howlrstone|HOWLRSTONE|howl[A-Z]|helhound|muspel|Muspel|nifl|yggfeast|valk|${LOWER.map(([o]) => `${o}|${cap(o)}`).join("|")}`);

/** 옛 식별자가 섞인 문자열 하나를 새 식별자로 바꾼다. 해당 없으면 그대로 돌려준다. */
export function rekeyLegacy(s: string): string {
  if (!ANY_OLD.test(s)) return s;
  for (const [rx, n] of RULES) s = s.replace(rx, n);
  return s;
}

/** Transport-only aliases: old APKs subscribe to their original map topic. */
export function legacyStageKeys(stage: string): string[] {
  const m = /^([a-z]+)(\d+x\d+)$/.exec(stage);
  if (!m) return [stage];
  const old = m[1] === "lilacworld" ? ["howlrstone"] : LOWER.filter(([, next]) => next === m[1]).map(([previous]) => previous);
  return [stage, ...old.map(prefix => prefix + m[2])];
}

/** 사람이 입력한 글(이름·친구 이름·채팅 등)은 건드리지 않는다. */
const FREE_TEXT_FIELDS = new Set(["playerName", "name", "title", "friends", "chat", "memo", "nick"]);

/* 2026-11-16 (외부 평가 P0) — 옛 키와 새 키가 **동시에** 존재하는 혼합 세이브.
 *
 *  [증상] 종전엔 `starMap: { bd_nidhog: 3, bd_blackwyrm: 7 }` 처럼 둘 다 있으면 새 키 값(7)만 남기고
 *   옛 키 값(3)을 버렸다. `owned: ["bd_nidhog","bd_blackwyrm"]` 은 `["bd_blackwyrm","bd_blackwyrm"]`
 *   로 **중복**이 생겼다. 같은 아이템의 강화 수치가 두 키로 갈라져 있으면 한쪽이 사라진다(데이터 손실).
 *
 *  [해결] 세이브에는 **값의 종류**가 정해져 있다. 목록 필드는 합집합, 수치 맵은 큰 값, 나머지는 새 키 우선.
 *   · 배열(owned·accessories·cosmetics·figures…) → 옛 값 + 새 값을 합치고 중복을 지운다(아이템 보존).
 *   · 수치 맵(starMap·accUp) → 큰 값을 남긴다(강화는 내려가면 안 된다).
 *   · 진행 맵(questIdx·huntProg) → 큰 값을 남긴다(진행은 되돌리지 않는다).
 *   · 그 외 객체/원시값 → 새 키 값(최신)을 남긴다.
 *  옛 키는 어느 경우든 지운다(잔재 제거). */
const LIST_FIELDS = new Set([
  "owned", "accessories", "pets", "cosmetics", "cutsceneSeen", "seen", "unlockedSets",
  "figures", "badges", "lockedItems", "titles", "trophies", "unlocked", "visited", "cleared",
]);
const MAX_FIELDS = new Set([
  "starMap", "accUp", "questIdx", "huntProg", "monsterKills", "killTotals", "stageClears",
  "npcTalk", "gatherCounts", "storyChoices",
]);

/** 옛 키 값을 새 키 값과 합친다(필드 종류에 따라). 두 값 중 하나만 있으면 그것을 돌려준다. */
function mergeOldKey(field: string | null, oldVal: unknown, newVal: unknown): unknown {
  if (oldVal === undefined) return newVal;
  if (newVal === undefined) return oldVal;
  if (LIST_FIELDS.has(field ?? "") && Array.isArray(oldVal) && Array.isArray(newVal)) {
    /* 아이템·기록 목록 — 옛 값의 항목이 사라지면 안 된다. 순서는 새 값을 기준으로 하고 옛 값은 뒤에 붙인다. */
    const out = [...newVal];
    for (const v of oldVal) if (!out.includes(v)) out.push(v);
    return out;
  }
  if (MAX_FIELDS.has(field ?? "")) {
    if (typeof oldVal === "number" && typeof newVal === "number") return Math.max(oldVal, newVal);
    /* 중첩 맵(questIdx·starMap …) — 키 단위로 큰 값 / 합집합. */
    if (oldVal && newVal && typeof oldVal === "object" && typeof newVal === "object"
      && !Array.isArray(oldVal) && !Array.isArray(newVal)) {
      const o = oldVal as Record<string, unknown>, n = newVal as Record<string, unknown>;
      const merged: Record<string, unknown> = { ...n };
      for (const k of Object.keys(o)) {
        const a = o[k], b = merged[k];
        if (b === undefined) merged[k] = a;
        else if (typeof a === "number" && typeof b === "number") merged[k] = Math.max(a, b);
      }
      return merged;
    }
  }
  return newVal;
}

/** 세이브(JSON) 전체를 훑어 문자열 값과 객체 키의 옛 식별자를 새 식별자로 바꾼다. 제자리 수정 후 같은 객체를 돌려준다. */
export function migrateLegacyKeys<T>(value: T): T {
  const walk = (v: unknown, field: string | null): unknown => {
    if (typeof v === "string") return rekeyLegacy(v);
    if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i++) v[i] = walk(v[i], field);
      /* 2026-11-16 (외부 평가 P0) — `owned: ["bd_nidhog","bd_blackwyrm"]` 처럼 옛 키와 새 키가 같이 있으면
       *  둘 다 `bd_blackwyrm` 이 되어 **중복 항목**이 생겼다(같은 장비가 두 칸). 목록 필드의 문자열 원소는
       *  중복을 지운다 — 아이템·기록이 사라지지 않으면서 칸만 정리된다. */
      if (LIST_FIELDS.has(field ?? "") && v.every((x) => typeof x === "string")) {
        return [...new Set(v as string[])];
      }
      return v;
    }
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      for (const k of Object.keys(o)) {
        const val = FREE_TEXT_FIELDS.has(k) ? o[k] : walk(o[k], k);
        const nk = rekeyLegacy(k);
        if (nk !== k) {
          delete o[k];
          /* 2026-11-16 — 새 키가 이미 있으면 **합친다**(버리지 않는다). 값 종류는 필드 이름으로 판단한다. */
          o[nk] = mergeOldKey(field, val, o[nk]);
        } else o[k] = val;
      }
      return o;
    }
    return v;
  };
  return walk(value, null) as T;
}
