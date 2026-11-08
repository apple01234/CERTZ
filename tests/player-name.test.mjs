// 닉네임 검증 — 클라 3입력처와 서버(claimname)가 같은 규칙을 쓰는지 증명
// 실행: node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs --test tests/player-name.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const { validateName, normalizeName, isNameValid, NAME_MIN, NAME_MAX } =
  await import("../src/game/playerName.ts");

let checks = 0;
const ok = (name, cond) => { assert.ok(cond, `✗ ${name}`); checks++; };
const eq = (n, a, b) => { assert.deepEqual(a, b, `✗ ${n}`); checks++; };

/* ── 1. 상수 ── */
eq("NAME_MIN = 2 (서버 2자 하한과 일치)", NAME_MIN, 2);
eq("NAME_MAX = 8 (서버 slice(0,8) 과 일치)", NAME_MAX, 8);

/* ── 2. 숫자 허용 — "숫자를 못 쓴다"는 제보의 실제 원인은 길이 규칙 불일치였다 ── */
for (const n of ["12", "12345678", "71", "한글1", "ab12", "99", "00", "루시123"]) {
  ok(`숫자 포함 통과: ${n}`, validateName(n).ok);
}
ok("순수 숫자 2자 통과", validateName("42").ok);
ok("1자 숫자는 길이 규칙으로 거부", !validateName("7").ok);
ok("0 단독은 1자라 거부(길이 규칙이지 숫자 금지가 아님)", !validateName("0").ok);
eq("1자 거부 사유는 tooShort", validateName("0").reason, "tooShort");

/* ── 3. 한글/영문/숫자 혼합 ── */
for (const n of ["하루", "Lilac", "아리42", "a1가2", "루시"]) {
  ok(`혼합 통과: ${n}`, validateName(n).ok);
}

/* ── 4. 경계값: 1자 거부 / 2자 통과 / 8자 통과 / 9자 절단 ── */
ok("1자 거부", !validateName("가").ok);
ok("2자 통과", validateName("가나").ok);
ok("8자 통과", validateName("12345678").ok);
eq("9자는 8자로 절단", validateName("123456789").name, "12345678");
ok("9자도 ok (절단 후 8자)", validateName("123456789").ok);

/* ── 5. 공백-only / 빈 문자열 ── */
ok("빈 문자열 거부", !validateName("").ok);
ok("공백만 거부", !validateName("   ").ok);
ok("탭/개행만 거부", !validateName("\t\n ").ok);
ok("null 거부", !validateName(null).ok);
ok("undefined 거부", !validateName(undefined).ok);
eq("공백-only 사유는 empty", validateName("   ").reason, "empty");

/* ── 6. 앞뒤 공백은 trim 후 통과 ── */
eq("앞뒤 공백 제거", validateName("  하루  ").name, "하루");
ok("공백 포함 2자 통과", validateName(" 가나 ").ok);

/* ── 7. 제어문자/제로폭 ── */
eq("제로폭 제거", normalizeName("하\u200b루"), "하루");
eq("제어문자 제거", normalizeName("하\u0000루"), "하루");
eq("BOM/구분자 제거", normalizeName("하\u2028루"), "하루");
ok("제거 후 2자면 통과", validateName("하\u200b루").ok);
ok("제로폭만 있으면 거부", !validateName("\u200b\u200b").ok);
eq("제로폭만 사유 empty", validateName("\u200b\u200b").reason, "empty");

/* ── 8. isNameValid 는 validateName().ok 와 항상 같다 ── */
for (const v of ["", "가", "가나", "42", "   ", null, "123456789", "하\u200b루"]) {
  eq(`isNameValid 일치: ${JSON.stringify(v)}`, isNameValid(v), validateName(v).ok);
}

/* ── 9. ★ 핵심: 클라 규칙 == 서버 규칙 (같은 모듈을 import 하므로 구조적으로 보장) ──
 *  서버 route.ts 가 playerName.ts 를 import 하는지 소스로 확인한다.
 *  이게 깨지면 규칙이 다시 갈라져 "클라 통과·서버 거부" 버그가 재발한다. */
{
  const ROOT = path.resolve(import.meta.dirname, "..");
  const route = fs.readFileSync(path.join(ROOT, "src/app/api/auth/claimname/route.ts"), "utf8");
  ok("서버 route 가 공용 검증을 import 한다", /from\s+["']@\/game\/playerName["']/.test(route));
  ok("서버가 validateName 을 호출한다", /validateName\s*\(/.test(route));
  /* 서버가 자체 하드코딩 규칙을 다시 들고 있지 않은지 (slice(0,8) / length < 2 재도입 금지) */
  ok("서버가 slice(0,8) 을 직접 하지 않는다", !/\.slice\(0,\s*8\)/.test(route));
  ok("서버가 길이 2를 직접 비교하지 않는다", !/length\s*<\s*2/.test(route));

  /* 클라 3입력처도 같은 모듈을 쓴다 */
  for (const f of ["src/components/game/Overlays.tsx", "src/components/game/Lobby.tsx", "src/components/game/AuthPanel.tsx"]) {
    const src = fs.readFileSync(path.join(ROOT, f), "utf8");
    ok(`${f} 가 playerName 을 import 한다`, /from\s+["']@\/game\/playerName["']/.test(src));
  }
  /* Lobby 의 1자 통과 버그가 다시 들어오지 않았는지.
   *  주석에 옛 규칙이 인용돼 있을 수 있으므로 **주석을 걷어낸 코드**에서만 찾는다. */
  const lobby = fs.readFileSync(path.join(ROOT, "src/components/game/Lobby.tsx"), "utf8");
  const lobbyCode = lobby
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  ok("Lobby 코드에 length >= 1 규칙이 없다", !/\.trim\(\)\.length\s*>=\s*1/.test(lobbyCode));
  ok("Lobby 가 validateName 결과로 nameOk 를 만든다", /validateName\(nameInput\)/.test(lobbyCode));
}

/* ── 10. 결정론 ── */
eq("같은 입력 → 같은 출력", validateName("하루12"), validateName("하루12"));

console.log(`player-name: ${checks} checks OK`);
