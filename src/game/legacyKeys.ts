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

/** 사람이 입력한 글(이름·친구 이름·채팅 등)은 건드리지 않는다. */
const FREE_TEXT_FIELDS = new Set(["playerName", "name", "title", "friends", "chat", "memo", "nick"]);

/** 세이브(JSON) 전체를 훑어 문자열 값과 객체 키의 옛 식별자를 새 식별자로 바꾼다. 제자리 수정 후 같은 객체를 돌려준다. */
export function migrateLegacyKeys<T>(value: T): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return rekeyLegacy(v);
    if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i++) v[i] = walk(v[i]);
      return v;
    }
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      for (const k of Object.keys(o)) {
        const val = FREE_TEXT_FIELDS.has(k) ? o[k] : walk(o[k]);
        const nk = rekeyLegacy(k);
        if (nk !== k) {
          delete o[k];
          /* 같은 새 키가 이미 있으면 기존 값을 둔다(구 세이브에는 새 키가 없으므로 사실상 발생하지 않는다). */
          if (!(nk in o)) o[nk] = val;
        } else o[k] = val;
      }
      return o;
    }
    return v;
  };
  return walk(value) as T;
}
