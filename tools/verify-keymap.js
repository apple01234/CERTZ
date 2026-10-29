/**
 * 키맵 충돌 검증 (v1.4.41 — 유저 지시 #7)
 *
 * 유저 지시: "WASD 배치 사용시 다른 창 단축키랑 스킬 단축키 안겹치게 해
 *            (스킬: Q, E, Z, X, C, F, R 등등)"
 *
 * 검사 규칙
 *  1. 같은 스킴 안에서 두 액션이 같은 키를 쓰면 안 된다.
 *  2. 이동키(W/A/S/D 또는 화살표)는 액션에 배정되면 안 된다 — isMoveKey 가 차단하므로
 *     배정해도 눌리지 않는 '죽은 바인딩'이 된다.
 *  3. 스킬·공격·물약(전투 중 상시 누르는 키)은 브라우저/OS 기본 단축키와 겹치면 안 된다
 *     (Tab, Space, F1~F12, Ctrl/Alt 조합 없이 쓰이는 브라우저 단독키 등).
 *
 *   node tools/verify-keymap.js
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "src/game/keymap.ts"), "utf8");

/** keymap.ts 의 객체 리터럴을 뽑아 JS 객체로 만든다 (주석·타입 제거) */
function extract(name) {
  const start = src.indexOf(`export const ${name}: KeyMap = {`);
  if (start < 0) throw new Error(`${name} 정의를 찾지 못함`);
  // 중괄호 균형으로 끝을 찾는다
  let i = src.indexOf("{", start), depth = 0, end = -1;
  for (let j = i; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") { depth--; if (depth === 0) { end = j; break; } }
  }
  const body = src.slice(i + 1, end);
  const out = {};
  for (const line of body.split("\n")) {
    const l = line.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/, "").trim();
    const m = l.match(/^([A-Za-z0-9_]+):\s*"([^"]+)"/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const MAPS = {
  arrows: extract("DEFAULT_KEYMAP"),
  wasd: extract("WASD_KEYMAP"),
};

/* 이동 전용 키 (keymap.ts moveKeysFor 와 동일해야 한다) */
const MOVE_KEYS = {
  arrows: ["LEFT", "RIGHT", "UP", "DOWN"],
  wasd: ["A", "D", "W", "S"],
};

/* 전투 중 상시 누르는 액션 — 이 키들은 브라우저/OS 단축키와 겹치면 안 된다 */
const COMBAT_ACTIONS = ["attack", "skill1", "skill2", "skill3", "skill4", "skill5", "skill5b", "potHp", "potMp"];

/* 브라우저·OS 예약 단축키 (단독 키로 쓰면 페이지 동작을 가로챈다) */
const RESERVED = new Set([
  "Tab", "Space", "Enter", "Escape", "Backspace", "Delete", "Home", "End",
  "PageUp", "PageDown", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12",
]);

const results = [];
function check(name, fn) {
  try { fn(); results.push(["PASS", name]); }
  catch (e) { results.push(["FAIL", name + " — " + e.message]); }
}

for (const [scheme, map] of Object.entries(MAPS)) {
  /* 1. 스킴 내 중복 */
  check(`${scheme}: 같은 키를 두 액션이 쓰지 않는다`, () => {
    const seen = new Map();
    const dup = [];
    for (const [act, key] of Object.entries(map)) {
      if (seen.has(key)) dup.push(`${key} → ${seen.get(key)} + ${act}`);
      else seen.set(key, act);
    }
    if (dup.length) throw new Error(`중복 ${dup.length}건: ${dup.join(", ")}`);
  });

  /* 2. 이동키에 액션 배정 금지 (죽은 바인딩) */
  check(`${scheme}: 이동키에 액션이 배정되지 않는다`, () => {
    const bad = Object.entries(map)
      .filter(([, key]) => MOVE_KEYS[scheme].includes(key))
      .map(([act, key]) => `${act}=${key}`);
    if (bad.length) throw new Error(`이동키 충돌 ${bad.length}건: ${bad.join(", ")} (isMoveKey 가 차단해 눌리지 않음)`);
  });

  /* 3. 전투 키가 브라우저 예약키가 아님 */
  check(`${scheme}: 전투 키가 브라우저 예약 단축키가 아니다`, () => {
    const bad = COMBAT_ACTIONS.filter((a) => map[a] && RESERVED.has(map[a])).map((a) => `${a}=${map[a]}`);
    if (bad.length) throw new Error(`예약키 ${bad.length}건: ${bad.join(", ")}`);
  });

  /* 4. 스킬 5종이 모두 배정돼 있다 (누락 시 스킬 사용 불가) */
  check(`${scheme}: 스킬 5종 + 제2궁극기가 모두 배정됨`, () => {
    const need = ["skill1", "skill2", "skill3", "skill4", "skill5", "skill5b", "attack"];
    const missing = need.filter((a) => !map[a]);
    if (missing.length) throw new Error(`미배정: ${missing.join(", ")}`);
  });
}

/* 5. 스킴 전환 시 실제로 다른 키를 쓰는가 (같으면 전환 의미 없음) */
check("arrows ↔ wasd 전환이 실제로 다른 배치를 준다", () => {
  const a = JSON.stringify(MAPS.arrows), w = JSON.stringify(MAPS.wasd);
  if (a === w) throw new Error("두 스킴이 동일");
});

/* 6. isMoveKey 구현이 계약과 일치하는가 */
check("isMoveKey 가 이동 4키를 모두 차단한다", () => {
  const m = src.match(/export function isMoveKey[\s\S]*?\n\}/);
  if (!m) throw new Error("isMoveKey 를 찾지 못함");
  if (!/mk\.left/.test(m[0]) || !/mk\.right/.test(m[0]) || !/mk\.up/.test(m[0]) || !/mk\.down/.test(m[0])) {
    throw new Error("isMoveKey 가 4방향을 모두 검사하지 않음");
  }
});

const fail = results.filter(([s]) => s === "FAIL");
for (const [s, n] of results) console.log(`  ${s === "PASS" ? "✓" : "✗"} ${n}`);
console.log(
  fail.length === 0
    ? `\nALL CHECKS PASS (${results.length}항목)`
    : `\n${fail.length}건 실패 / 총 ${results.length}항목`
);
process.exit(fail.length === 0 ? 0 : 1);
