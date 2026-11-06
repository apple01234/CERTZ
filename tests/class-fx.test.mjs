/**
 * 아이템 14 — 직업/몬스터 FX 매칭 회귀 방지 테스트.
 *
 * 고정하는 것 (깨지면 실제 버그):
 *  ① 35직업 전부 프로파일이 있고, 그 텍스처 키가 **실제 로드 목록에 존재**한다
 *     (미로드 키 = Phaser __MISSING 검은 사각형 — 과거 실제 버그)
 *  ② ELEM_HEX 10종이 data.ts 의 ELEMENT_META 와 **정확히 일치**한다
 *  ③ 계열 매핑이 classes.ts 의 CLASSES 35키를 빠짐없이 덮는다
 *  ④ 원소 9종이 서로 다른 주 텍스처를 쓴다 (뭉뚱그려지면 매칭 의미 없음)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = new URL("../", import.meta.url);

const profiles = await import("../src/game/fx/classFxProfiles.ts");
const { CLASS_FX, CLASS_FAMILY, ELEM_FX, ELEM_HEX, classFxOf, familyOfClass, elemFxOf, elemFxBundle } = profiles;

/** BootScene.ts 소스에서 로드 키를 수집 (문자열 리터럴 + aura 매니페스트) */
function loadedKeys() {
  const boot = readFileSync(new URL("src/game/scenes/BootScene.ts", ROOT), "utf8");
  const keys = new Set();
  for (const m of boot.matchAll(/"([a-zA-Z0-9_]+)"/g)) keys.add(m[1]);
  // aura/gvb_* 는 별도 매니페스트(auraTextures)에서 온다 — 실제 파일명 기준으로 보강
  try {
    const dir = fileURLToPath(new URL("public/assets/aura/", ROOT));
    for (const f of readdirSync(dir)) keys.add(f.replace(/\.(webp|png)$/, ""));
  } catch { /* 디렉터리 없으면 BootScene 리터럴만으로 검증 */ }
  return keys;
}

test("35직업 전부 FX 프로파일을 가진다", () => {
  const EXPECTED = [
    "warrior", "berserker", "guardian", "warlord", "paladin", "warbringer", "crusader",
    "ranger", "sniper", "windrunner", "eagleeye", "tempest", "deadeye", "skylord",
    "mage", "archmage", "sage", "stormbringer", "chronicle", "arclord", "eternal",
    "thief", "assassin", "swashbuckler", "nightblade", "duelist", "shadowlord", "blademaster",
    "pirate", "raider", "corsair", "stormcaptain", "powdermaster", "seaking", "dreadnought",
  ];
  assert.equal(EXPECTED.length, 35, "직업 수는 35");
  for (const k of EXPECTED) {
    assert.ok(CLASS_FX[k], `프로파일 누락: ${k}`);
    assert.ok(CLASS_FAMILY[k], `계열 매핑 누락: ${k}`);
  }
  assert.equal(Object.keys(CLASS_FX).length, 35, "CLASS_FX 는 정확히 35개");
  assert.equal(Object.keys(CLASS_FAMILY).length, 35, "CLASS_FAMILY 는 정확히 35개");
});

test("모든 프로파일 텍스처 키가 실제 로드된다 (MISSING 박스 방지)", () => {
  const have = loadedKeys();
  const missing = [];
  for (const [cls, p] of Object.entries(CLASS_FX)) {
    if (!have.has(p.accent)) missing.push(`${cls}.accent = ${p.accent}`);
    if (p.accent2 && !have.has(p.accent2)) missing.push(`${cls}.accent2 = ${p.accent2}`);
  }
  assert.deepEqual(missing, [], `미로드 텍스처: ${missing.join(", ")}`);
});

test("원소 FX 텍스처 키도 실제 로드된다", () => {
  const have = loadedKeys();
  const missing = [];
  for (const [el, p] of Object.entries(ELEM_FX)) {
    if (!have.has(p.tex)) missing.push(`${el}.tex = ${p.tex}`);
    if (p.tex2 && !have.has(p.tex2)) missing.push(`${el}.tex2 = ${p.tex2}`);
  }
  assert.deepEqual(missing, [], `미로드 텍스처: ${missing.join(", ")}`);
});

test("ELEM_HEX 가 data.ts ELEMENT_META 와 일치한다", () => {
  const data = readFileSync(new URL("src/game/data.ts", ROOT), "utf8");
  for (const [elem, hex] of Object.entries(ELEM_HEX)) {
    // none: { name: "무속성", color: "#e8ecf2", hex: 0xe8ecf2 },
    const re = new RegExp(`${elem}:\\s*\\{\\s*name:\\s*"[^"]*",\\s*color:\\s*"[^"]*",\\s*hex:\\s*(0x[0-9a-fA-F]+)`);
    const m = data.match(re);
    assert.ok(m, `data.ts 에서 ${elem} 를 찾지 못함`);
    assert.equal(
      m[1].toLowerCase(), "0x" + hex.toString(16).padStart(6, "0"),
      `${elem} hex 불일치 — data.ts=${m[1]} classFxProfiles=${hex}`,
    );
  }
});

test("원소 9종(무속성 제외)은 서로 다른 주 텍스처를 쓴다", () => {
  const elems = ["fire", "water", "wind", "electric", "earth", "nature", "ice", "light", "dark"];
  const used = new Map();
  for (const e of elems) {
    const t = ELEM_FX[e].tex;
    assert.ok(!used.has(t), `${used.get(t)} 와 ${e} 가 같은 텍스처 ${t} 를 쓴다`);
    used.set(t, e);
  }
  assert.equal(used.size, 9);
});

test("classFxOf / familyOfClass / elemFxOf 폴백", () => {
  assert.equal(classFxOf(null), null);
  assert.equal(classFxOf("unknown-class"), null);
  assert.equal(classFxOf("warbringer")?.accent, "vfx_slash_turn");
  assert.equal(familyOfClass("seaking"), "pirate");
  assert.equal(familyOfClass("nope"), null);
  // 원소 폴백 — 미지/한글/대소문자 모두 none 으로 안전 착지
  assert.equal(elemFxOf("fire").tex, ELEM_FX.fire.tex);
  assert.equal(elemFxOf("불").tex, ELEM_FX.fire.tex);
  assert.equal(elemFxOf("FIRE").tex, ELEM_FX.fire.tex);
  assert.equal(elemFxOf("unknown").tex, ELEM_FX.none.tex);
  assert.equal(elemFxOf(null).tex, ELEM_FX.none.tex);
  // 번들 — fx + hex 동시
  const b = elemFxBundle("ice");
  assert.equal(b.fx.tex, ELEM_FX.ice.tex);
  assert.equal(b.hex, 0xa8e0ff);
});

test("같은 계열 안에서 4차 직업끼리 텍스처가 겹치지 않는다", () => {
  // warbringer vs crusader, arclord vs eternal, seaking vs dreadnought —
  // 사용자가 지적한 "정체성이 정반대인 쌍"이 실제로 다른 연출을 받는지 고정.
  const pairs = [
    ["warbringer", "crusader"],
    ["deadeye", "skylord"],
    ["arclord", "eternal"],
    ["shadowlord", "blademaster"],
    ["seaking", "dreadnought"],
  ];
  for (const [a, b] of pairs) {
    assert.notEqual(CLASS_FX[a].accent, CLASS_FX[b].accent, `${a} 와 ${b} 가 같은 텍스처`);
  }
});
