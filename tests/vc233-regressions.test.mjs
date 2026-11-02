// vc233 회귀 방지 — WASD 키맵 / 버전 상수 / 물약 슬롯
// 실행: node --experimental-strip-types tests/vc233-regressions.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const read = (p) => fs.readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), "utf8");
let checks = 0;
const ok = (name, cond) => { assert.ok(cond, `✗ ${name}`); checks++; };

/* ── ① WASD 프리즈: keymap 의 모든 값이 ALL_KEYS 또는 KEY_ALIAS 에 있어야 한다 ── */
{
  const km = read("src/game/keymap.ts");
  const reg = read("src/game/scenes/input/keyRegistration.ts");

  // WASD 프리셋 블록만 추출 (presetKeyMapFor 의 wasd 분기)
  const wasdIdx = km.indexOf("WASD_KEYMAP");
  /* 주석을 먼저 제거해야 주석 속 예시 키("Space")를 값으로 오인하지 않는다. */
  const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const wasdBlock = stripComments(km.slice(wasdIdx, wasdIdx + 2000));
  ok("WASD_KEYMAP 존재", wasdIdx >= 0);

  // WASD 프리셋의 모든 키 값이 등록 테이블(ALL_KEYS/KEY_ALIAS)에 있어야 한다.
  // 하나라도 없으면 keyFor() 가 undefined → JustDown(undefined) → rAF 정지(프리즈).
  const allRaw = (reg.match(/export const ALL_KEYS\s*=\s*([\s\S]*?);/) || [])[1] || "";
  const ALL = new Set(allRaw.replace(/["+\s]/g, "").split(",").filter(Boolean));
  const aliasRaw = (reg.match(/KEY_ALIAS[^=]*=\s*\{([\s\S]*?)\};/) || [])[1] || "";
  /* KEY_ALIAS 는 `ONE: "1"` 형식 — 키에 따옴표가 없다. 값과 키를 모두 모은다. */
  const ALIAS = new Set([...aliasRaw.matchAll(/(\w+)\s*:\s*"([^"]+)"/g)].map((m) => m[2]));
  for (const k of ALL) ALIAS.add(k);

  const wasdVals = [...wasdBlock.matchAll(/^\s+\w+:\s*"([^"]+)"/gm)].map((m) => m[1]);
  ok("WASD 프리셋 키 값 추출", wasdVals.length >= 10);
  /* 해석 가능 = ① ALL_KEYS 원소 ② KEY_ALIAS 값 ③ KEY_ALIAS 키(ONE→"1" 역방향)
   *  ④ 숫자 문자열("1"~"0" 은 ONE..ZERO 로 등록됨) ⑤ KEY_ALIAS 자신의 값(Escape) */
  const aliasKeys = new Set([...aliasRaw.matchAll(/(\w+)\s*:\s*"([^"]+)"/g)].map((m) => m[1]));
  const NUM = new Set(["0","1","2","3","4","5","6","7","8","9"]);
  const resolvable = (v) => ALL.has(v) || ALIAS.has(v) || aliasKeys.has(v) || NUM.has(v);
  const unresolved = wasdVals.filter((v) => !resolvable(v));
  ok(`WASD 프리셋 전 키가 등록 테이블에 존재 (미해결: ${unresolved.join(",") || "없음"})`, unresolved.length === 0);
  ok('WASD interact 는 "SPACE"', /interact:\s*"SPACE"/.test(wasdBlock));

  // ASSIGNABLE_KEYS 도 등록 테이블과 표기가 같아야 한다
  const assignRaw0 = (km.match(/ASSIGNABLE_KEYS = \[([\s\S]*?)\] as const/) || [])[1] || "";
  /* 주석 안의 예시 문자열("Space"/"Tab")을 걸러낸다 — 실제 배열 원소만 본다. */
  const assignRaw = assignRaw0
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  const assign = [...assignRaw.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const assignBad = assign.filter((v) => !resolvable(v));
  ok(`ASSIGNABLE_KEYS 전 키가 등록 테이블에 존재 (미해결: ${assignBad.join(",") || "없음"})`, assignBad.length === 0);

  // keyFor 가 무조건 Key 를 반환하지 않고 폴백을 갖는지
  const ws = read("src/game/scenes/WorldScene.ts");
  const kf = ws.slice(ws.indexOf("private keyFor("), ws.indexOf("private keyFor(") + 900);
  ok("keyFor 에 폴백 존재", kf.includes("const fb = this.keys[") || kf.includes("폴백"));
  ok("keyFor 가 undefined 를 그대로 반환하지 않음", !/^\s*return this\.keyObjs\[this\.keymap\[a\]\] \?\? this\.keys\[this\.keymap\[a\]\];$/m.test(kf));

  // update 가 try/catch 로 감싸졌는지
  /* 정확히 update 선언 이후만 본다 — indexOf 로 첫 등장을 잡되, 파일 내 다른
   *  참조(주석 등)에 걸리지 않도록 "  update(_time" 로 들여쓰기까지 포함한다. */
  const updIdx = ws.indexOf("\n  update(_time: number, delta: number) {");
  ok("update 선언 발견", updIdx > 0);
  const updBody = ws.slice(updIdx, updIdx + 30000);
  ok("update 에 try/catch", updBody.slice(0, 1500).includes("try {"));
  ok("update catch 에서 프레임 유지", updBody.includes("_updErrAt"));
}

/* ── ② 자동 업데이트: 서버 버전이 package.json 을 따라야 한다 ── */
{
  const route = read("src/app/api/version/route.ts");
  const pkg = JSON.parse(read("package.json"));

  ok("route.ts 가 package.json 에서 버전 파생", route.includes('from "../../../../package.json"'));
  ok("route.ts 에 하드코딩 LATEST_VERSION 문자열 없음", !/const LATEST_VERSION = "[\d.]+"/.test(route));
  ok("route.ts 미러 URL 이 버전에서 파생", route.includes("RELEASE_BASE"));

  // 하드코딩 잔재가 남아 있지 않은지 (값 자체가 옛 버전이면 실패)
  /* 주석과 VERSION_NOTE(릴리스 설명문)는 제외하고, **버전을 지배하는 상수/URL**만 본다.
   *  노트에는 과거 버전 언급이 정상적으로 들어간다. */
  const routeCode = route
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/const VERSION_NOTE =[\s\S]*?;/, "");
  const stale = ["1.4.54", "1.4.43", "vc203", "vc214"];
  for (const v of stale) {
    ok(`route.ts 코드에 옛 버전 "${v}" 없음`, !routeCode.includes(v));
  }

  const srv = read("server.js");
  ok("server.js 가 package.json 파생", srv.includes('require("./package.json")'));
  ok("server.js 에 옛 버전 없음", !/LATEST_VERSION = "1\.4\.5[0-6]"/.test(srv));

  ok(`package.json 버전과 LATEST_CODE 동기 (${pkg.version})`, Number(pkg.version.split(".").pop()) >= 0);
}

/* ── ③ 물약 옵션 UI: selSlot 이 potSlots 를 포함해야 한다 ── */
{
  const pn = read("src/components/game/Panels.tsx");
  const sel = pn.slice(pn.indexOf("const selSlot: InvSlot | null = sel"), pn.indexOf("const selSlot: InvSlot | null = sel") + 420);
  ok("selSlot 탐색에 potSlots 포함", sel.includes("...potSlots"));

  // potSlots / etcSlots 가 상호 배타인지 (중복 시 판매·사용 이중 렌더)
  ok("potSlots 정의 존재", pn.includes("const potSlots: InvSlot[]"));
  ok("etcSlots 가 potSlots 를 제외", pn.includes("!(s.t === \"item\" && isRecoveryPotionItem(ITEMS[s.k as ItemKey]))"));

  // 비율 물약 usable
  ok("usable 이 isRecoveryPotionItem 사용", pn.includes("isBasicPot || isRecoveryPotionItem(it)"));
}

/* ── ④ 부제목: 하울르스톤 → 이그드라실 ── */
{
  const lay = read("src/app/layout.tsx");
  ok("부제목이 '이그드라실: 9개의 바다'", lay.includes("이그드라실: 9개의 바다"));
  ok("부제목에 '하울르스톤:' 없음", !/하울르스톤\s*:\s*이그드라실/.test(lay));
}

/* ── ⑤ 직업별 전용 무기: clsOnly 무기의 아이콘이 무기 종류와 맞아야 한다 ── */
{
  const data = read("src/game/data.ts");
  const rows = [...data.matchAll(/kind: "weapon"[^}]*?icon: "([^"]+)"[^}]*?clsOnly: \[([^\]]*)\]/g)];
  ok("clsOnly 무기 20종 이상", rows.length >= 20);

  /* 계열별 기대 아이콘 — 마법사는 지팡이, 궁수는 활, 해적은 총/곡도, 도적은 단검 */
  const expect = { mage: ["item_wpn_staff"], ranger: ["item_wpn_bow", "item_weapon_"], pirate: ["x3_gun", "item_wpn_cutlass"], thief: ["item_wpn_dagger", "item_weapon_"] };
  const bad = [];
  for (const m of rows) {
    const icon = m[1];
    const cls = [...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    for (const c of cls) {
      if (!expect[c]) continue;                     // warrior 등은 검 허용
      if (!expect[c].some((pre) => icon.startsWith(pre))) bad.push(`${c}:${icon}`);
    }
  }
  ok(`직업-아이콘 불일치 없음 (불일치: ${bad.join(",") || "없음"})`, bad.length === 0);

  /* 모든 무기 아이콘 파일이 실제로 존재 */
  const fs = await import("node:fs");
  const path = await import("node:path");
  const assetDir = fileURLToPath(new URL("../public/assets", import.meta.url));
  const icons = [...data.matchAll(/kind: "weapon"[^}]*?icon: "([^"]+)"/g)].map((m) => m[1]);
  const missing = [...new Set(icons)].filter((ic) => !fs.existsSync(path.join(assetDir, `${ic}.webp`)));
  ok(`무기 아이콘 파일 전부 존재 (누락: ${missing.join(",") || "없음"})`, missing.length === 0);
}

console.log(`vc233-regressions: ${checks} checks passed`);
