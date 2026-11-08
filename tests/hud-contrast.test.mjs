/**
 * HUD·대화 텍스트의 WCAG AA 대비 계약 (REVAMP_100 #15).
 *
 * [왜 필요한가]
 *  `docs/REVAMP_100.md` #15 가 "HUD 텍스트 대비 WCAG AA 미달 구간"을 근거 없이 ⬜ 로
 *  남겨 두고 있었다. 실제로 재 봐야 통과인지 미달인지 알 수 있다.
 *
 * [측정 방법 — 그리고 한 번 틀렸던 이야기]
 *  처음엔 배경을 "밝은 풀밭(캔버스)"으로 가정해 21개 전부 FAIL 이 나왔다.
 *  그건 **틀린 측정**이었다. HUD 텍스트는 거의 전부 `game-chip`(bg-stone-950/90) 위에
 *  얹히고, 대화창 텍스트는 `.px` 패널(어두운 보라) 위에 있다.
 *  배경을 실제 값으로 바꾸니 21개 전부 8.7:1 이상이었다.
 *
 *  그래서 이 테스트는 **소스에서 전경색을 읽고, 실제 배경색과 대조**한다.
 *  배경을 추측하지 않는다.
 *
 * [기준]
 *  HUD/대화 텍스트는 8~11px 소형 → WCAG AA 일반 텍스트 4.5:1.
 *  (18pt 이상 굵은 글씨만 3:1 이 허용되지만, 여기선 보수적으로 4.5:1 을 쓴다.)
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

/** WCAG 상대 휘도. */
function luminance(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255), ((n >> 8) & 255), (n & 255)]
    .map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    })
    .reduce((t, c, i) => t + c * [0.2126, 0.7152, 0.0722][i], 0);
}

/** WCAG 대비비. */
function contrast(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** 파일에서 쓰이는 전경색(hex)을 모은다. `text-game-*` 토큰도 hex 로 풀어서 포함한다. */
function foregroundsOf(path) {
  const src = readFileSync(path, "utf8");
  const out = new Set();
  for (const m of src.matchAll(/text-\[#([0-9a-fA-F]{3,8})\]/g)) out.add("#" + m[1]);
  for (const m of src.matchAll(/color:\s*"(#[0-9a-fA-F]{3,8})"/g)) out.add(m[1]);
  /* vc288 — 토큰 클래스(text-game-gold 등)로 바꾼 곳도 계속 검사한다.
   * 토큰을 쓰면 hex 가 사라져 검사에서 빠지므로, globals.css 의 정의를 읽어 되살린다. */
  const css = readFileSync("src/app/globals.css", "utf8");
  const tokens = new Map();
  for (const m of css.matchAll(/--color-(game-[a-z-]+):\s*(#[0-9a-fA-F]{6})/g)) tokens.set(m[1], m[2]);
  for (const m of src.matchAll(/text-(game-[a-z-]+)\b/g)) {
    const hex = tokens.get(m[1]);
    if (hex) out.add(hex);
  }
  return [...out];
}

const AA_SMALL = 4.5;

/* 실제 배경 — globals.css 의 정의에서 확인한 값 */
const BG_CHIP = "#0c0a09"; // .game-chip = bg-stone-950/90
const BG_PANEL = "#1b1233"; // 대화창 .px 패널

test("game-chip 배경 정의가 그대로다 (이 값이 바뀌면 아래 대비 계산이 무효가 된다)", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  assert.match(
    css,
    /\.game-chip\s*\{[^}]*bg-stone-950\/90/,
    "game-chip 배경이 bg-stone-950/90 이 아니다 — 대비 기준을 다시 계산해야 한다",
  );
});

test("HUD 텍스트가 칩 배경 위에서 AA(4.5:1)를 넘는다", () => {
  const fgs = foregroundsOf("src/components/game/HUD.tsx");
  assert.ok(fgs.length >= 10, `HUD 에서 전경색을 ${fgs.length}개만 찾았다 — 파싱이 깨졌다`);
  const fails = fgs
    .map((hex) => ({ hex, r: contrast(hex, BG_CHIP) }))
    .filter((x) => x.r < AA_SMALL);
  assert.deepEqual(
    fails.map((f) => `${f.hex}=${f.r.toFixed(2)}`),
    [],
    `HUD 텍스트가 칩 배경에서 AA 미달: ${fails.map((f) => `${f.hex}(${f.r.toFixed(2)}:1)`).join(", ")}`,
  );
});

test("대화창 텍스트가 패널 배경 위에서 AA(4.5:1)를 넘는다", () => {
  const fgs = foregroundsOf("src/components/game/DialogueBox.tsx");
  assert.ok(fgs.length >= 3, `대화창에서 전경색을 ${fgs.length}개만 찾았다 — 파싱이 깨졌다`);
  const fails = fgs
    .map((hex) => ({ hex, r: contrast(hex, BG_PANEL) }))
    .filter((x) => x.r < AA_SMALL);
  assert.deepEqual(
    fails.map((f) => `${f.hex}=${f.r.toFixed(2)}`),
    [],
    `대화창 텍스트가 AA 미달: ${fails.map((f) => `${f.hex}(${f.r.toFixed(2)}:1)`).join(", ")}`,
  );
});

test("대비 계산기 자체가 맞다 (알려진 값으로 검증)", () => {
  /* 흰색 대 검정 = 21:1, 같은 색끼리 = 1:1. 이게 틀리면 위 테스트가 무의미하다. */
  assert.ok(Math.abs(contrast("#ffffff", "#000000") - 21) < 0.01);
  assert.ok(Math.abs(contrast("#3a3a3a", "#3a3a3a") - 1) < 0.01);
  /* 밝은 풀밭 위 흰 글씨는 실제로 미달이어야 한다 — 측정기가 미달을 잡는지 확인. */
  assert.ok(contrast("#ffffff", "#8fbf6a") < AA_SMALL, "측정기가 명백한 미달을 통과시켰다");
});

test("게임 색 토큰이 globals.css 에 정의돼 있다 (REVAMP_100 #14)", () => {
  /* 반복 3회 이상인 색만 토큰화했다. 토큰이 사라지면 tsx 가 참조를 못 찾아
   * 그 글자가 투명/기본색이 된다 — 조용한 회귀다. */
  const css = readFileSync("src/app/globals.css", "utf8");
  const need = ["game-gold", "game-danger", "game-info", "game-surface"];
  for (const t of need) {
    assert.match(css, new RegExp(`--color-${t}:\\s*#[0-9a-fA-F]{6}`), `--color-${t} 토큰이 없다`);
  }
});

test("tsx 가 참조하는 game-* 토큰이 전부 정의돼 있다", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  const defined = new Set([...css.matchAll(/--color-(game-[a-z-]+):/g)].map((m) => m[1]));
  const used = new Set();
  for (const f of ["src/components/game/HUD.tsx", "src/components/game/DialogueBox.tsx"]) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/(?:text|bg|border)-(game-[a-z-]+)\b/g)) used.add(m[1]);
  }
  const missing = [...used].filter((u) => !defined.has(u));
  assert.deepEqual(missing, [], `정의 없는 토큰 참조: ${missing.join(", ")}`);
});
