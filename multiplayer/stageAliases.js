/**
 * 구역(stage) 키 별칭표 — **서버 측 상호운용 전용** (2026-11-16)
 *
 *  [왜 이 파일이 따로 있는가]
 *  49838da 에서 옛 '9개의 바다' 식별자를 전부 새 이름으로 바꿨다
 *  (`howlrstone3x2` → `lilacworld3x2`, `alfheim2x1` → `fairyglade2x1` …).
 *  그런데 멀티플레이 방 배치는 **클라가 보낸 stage 문자열을 그대로 키로** 쓴다.
 *  갱신하지 않은 구버전 APK 는 옛 이름을 계속 보내므로, 신버전 사용자와 같은 자리에
 *  있어도 서로 다른 방에 들어가 **아무도 보이지 않는다**(외부 평가 P1).
 *
 *  구버전 APK 는 이미 배포된 고정 바이너리라 클라 쪽에서 고칠 수 없다. 그래서 **서버가**
 *  받는 즉시 새 이름으로 바꿔 방을 나눈다. 양쪽이 같은 방에 모인다.
 *
 *  [규칙] 옛 키는 클라 이관표(`src/game/legacyKeys.ts`)와 이 파일,
 *  거래소 매물 변환표(`accounts/index.js`)에만 남긴다. `tests/nine-seas-removed.test.mjs`
 *  가 그 외 파일로의 재유입을 막는다.
 *
 *  [계약] 판정 규칙은 클라 이관표와 **같아야** 한다. 어긋나면 서버와 클라가 서로 다른
 *  방 이름을 만들어 여전히 갈라진다 — `tests/multiplayer-stage-compat.test.mjs` 가 두 경로의
 *  결과가 같은지 전수 비교한다.
 *
 *  토큰 경계 규칙: 앞뒤가 영문자가 아닐 때만 바꾼다.
 *  (`hel3x1` → `duskrealm3x1` 이지만 `help`·`shell`·`shelter` 는 그대로)
 */

/** 소문자 별칭 — 구역 키 안에서 위치와 무관하게 등장할 수 있다. */
const LOWER = [
  ["nidhogg", "blackwyrm"], ["nidhog", "blackwyrm"], ["surt", "flamegiant"], ["fenrir", "greedwolf"],
  ["skoll", "twinwolf"], ["hati", "twinmate"], ["gram", "warden"], ["abudditos", "doomwyrm"],
  ["vord", "riftwarden"], ["jorm", "unionserpent"], ["nagr", "angelknight"],
  ["alfheim", "fairyglade"], ["muspelheim", "emberland"], ["niflheim", "frostland"],
  ["nidavellir", "forgehall"], ["hel", "duskrealm"],
];

const cap = (s) => s[0].toUpperCase() + s.slice(1);

const RULES = [
  [/howlrstone/g, "lilacworld"],
  [/(?<![A-Za-z])helhound/g, "duskhound"],
  [/muspel(?=[A-Z])/g, "emberland"],
  [/nifl(?=[A-Z])/g, "frostland"],
  [/(?<![A-Za-z])yggfeast/g, "unionfeast"],
  [/(?<![A-Za-z])valkyrie(?![a-z])/g, "wingmaiden"],
  [/(?<![A-Za-z])valk(?![a-z])/g, "wingmaiden"],
  ...LOWER.flatMap(([o, n]) => [
    [new RegExp(`(?<![A-Za-z])${o}(?![a-z])`, "g"), n],
    [new RegExp(`(?<=[a-z])${cap(o)}(?![a-z])`, "g"), cap(n)],
  ]),
];

const ANY_OLD = new RegExp(
  `howlrstone|helhound|muspel|nifl|yggfeast|valk|${LOWER.map(([o]) => `${o}|${cap(o)}`).join("|")}`,
);

/** 구역 키 상한 — 클라(`net.ts` JoinInfo)·서버 공통 24자. */
const STAGE_MAX = 24;

/**
 * 옛 구역 키를 새 이름으로 바꾼다. 해당 없으면 그대로 돌려준다.
 * @param {unknown} key 클라가 보낸 stage
 * @returns {string} 정규화된 키 (빈 값이면 "")
 */
function normalizeStage(key) {
  const s = typeof key === "string" ? key.slice(0, STAGE_MAX) : "";
  if (!s || !ANY_OLD.test(s)) return s;
  let out = s;
  for (const [rx, n] of RULES) out = out.replace(rx, n);
  return out.slice(0, STAGE_MAX);
}

module.exports = { normalizeStage, STAGE_MAX };
