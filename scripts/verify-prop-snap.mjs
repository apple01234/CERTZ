/**
 * 프롭 타일 정렬 브라우저 검증 — vc253 (지시 #1).
 *
 * 확인 항목:
 *  1) authored 맵이 있는 스테이지에서 프롭이 실제로 렌더된다
 *  2) 프롭의 화면 크기가 셀(타일) 대비 반 칸 배수에 맞는다 (종횡비 보존 주축 기준)
 *  3) 프롭 좌표가 반 칸 격자에 정렬된다
 *  4) 프롭마다 스케일이 달라도 "제각각"이 아니라 셀 기준으로 정규화되어 있다
 *
 * 사용: node scripts/verify-prop-snap.mjs http://127.0.0.1:3109
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://127.0.0.1:3109";
const STAGE = process.argv[3] || "howlrstone1x2";

const FILTER = (s) => (s || "").replace(/\s+/g, "");
let pass = 0, fail = 0;
const ck = (name, ok, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  ok ? pass++ : fail++;
};

const browser = await chromium.launch({
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
/* 로비 → 캐릭터 생성 → 게임 진입 (다른 검증 스크립트와 동일 경로) */
await page.locator("button", { hasText: "게임 시작" }).first().click({ timeout: 120000 });
await page.getByRole("button", { name: "캐릭터 생성", exact: true }).first().click();
await page.locator("input").first().fill("격자" + String(Date.now()).slice(-4));
await page.getByRole("button", { name: /다음/ }).click();
await page.getByRole("button", { name: "모험가로 생성!" }).click({ timeout: 30000 });
await page.getByRole("button", { name: "이 캐릭터로 시작" }).click({ timeout: 30000 });
await page.waitForFunction(() => window.__SERTZ_SCENE__?.player, { timeout: 90000 });

/* 인트로 스킵 후 authored 스테이지로 이동 */
await page.evaluate(() => {
  const s = window.__SERTZ_SCENE__;
  try { s.dialoguing = false; s.cinematic = null; } catch { /* noop */ }
});
await page.evaluate((st) => window.__SERTZ_SCENE__.startTransition(st), STAGE);
await page.waitForFunction(
  (st) => {
    const s = window.__SERTZ_SCENE__;
    return s?.stageDef?.key === st && !s.transitioning;
  },
  STAGE,
  { timeout: 90000 }
).catch(() => {});
await page.waitForTimeout(3000);

const info = await page.evaluate(() => {
  const s = window.__SERTZ_SCENE__;
  const out = { stage: s?.stageDef?.key, cellW: null, cellH: null, props: [], edge: 0 };
  /* ★ 실제 셀 크기를 씬의 layout 에서 읽는다 — 하드코딩 금지.
   *  howlrstone1x2 실측: cellW 150.667 · cellH 131.111 (정수가 아니다!) */
  if (s.layout) { out.cellW = s.layout.cellW; out.cellH = s.layout.cellH; }
  /* 이미지 이름 규약: rea:prop:<key> / rea:edge:<key> */
  for (const o of s.children.list) {
    if (!o.name || !o.name.startsWith("rea:")) continue;
    if (o.name.startsWith("rea:edge:")) { out.edge++; continue; }
    if (!o.name.startsWith("rea:prop:")) continue;
    const tex = o.texture?.key;
    const src = tex ? s.textures.get(tex).getSourceImage() : null;
    if (!src) continue;
    out.props.push({
      key: o.name.replace("rea:prop:", ""),
      x: Math.round(o.x * 100) / 100,
      y: Math.round(o.y * 100) / 100,
      scale: Math.round(o.scaleX * 1000) / 1000,
      w: Math.round(src.width * o.scaleX * 10) / 10,
      h: Math.round(src.height * o.scaleY * 10) / 10,
      srcW: src.width, srcH: src.height,
    });
  }
  return out;
});

const cellW = info.cellW;
const cellH = info.cellH;
ck("셀 크기를 씬에서 읽음", !!cellW && !!cellH, `${cellW?.toFixed(2)}×${cellH?.toFixed(2)}`);

ck("authored 스테이지 진입", info.stage === STAGE, `stage=${info.stage}`);
ck("프롭이 렌더됨", info.props.length > 0, `${info.props.length}개`);
ck("pageerror 없음", errs.length === 0, errs.slice(0, 2).join(" | "));

/* 구조물 prop 은 계약상 원본 배율 1·셀 중심을 유지한다(tests/authored-layouts.test.mjs).
 *  따라서 격자 검사는 **경계 장식(rea:edge:*)에만** 적용해야 한다. */
const edgeInfo = await page.evaluate(() => {
  const s = window.__SERTZ_SCENE__;
  const out = [];
  for (const o of s.children.list) {
    if (!o.name || !o.name.startsWith("rea:edge:")) continue;
    const src = s.textures.get(o.texture.key).getSourceImage();
    out.push({
      key: o.name.replace("rea:edge:", ""),
      x: o.x, y: o.y, scale: o.scaleX,
      w: src.width * o.scaleX, h: src.height * o.scaleY,
    });
  }
  return out;
});
ck("경계 장식이 렌더됨", edgeInfo.length > 0, `${edgeInfo.length}개`);

if (edgeInfo.length) {
  /* 경계 장식 크기가 반 칸 배수인지 */
  const badSize = [];
  for (const p of new Map(edgeInfo.map((p) => [p.key, p])).values()) {
    const relW = p.w / cellW, relH = p.h / cellH;
    const major = Math.max(relW, relH);
    const cell = relW >= relH ? cellW : cellH;
    const majorPx = relW >= relH ? p.w : p.h;
    const off = Math.abs(major / 0.5 - Math.round(major / 0.5)) * 0.5 * cell;
    if (off > 1.5) badSize.push(`${p.key} ${majorPx.toFixed(0)}px(${major.toFixed(2)}칸,오차${off.toFixed(1)})`);
  }
  ck("경계 장식 주축이 반 칸 배수", badSize.length === 0, badSize.join(", ") || `${edgeInfo.length}개`);

  /* 경계 장식 좌표가 셀 안에 있고 반 칸 격자에 정렬 */
  const badPos = [];
  for (const p of new Map(edgeInfo.map((p) => [p.key + p.x + "," + p.y, p])).values()) {
    const ci = Math.floor(p.x / cellW), ri = Math.floor(p.y / cellH);
    const inCell = ci >= 0 && ci < 15 && ri >= 0;
    const ox = Math.abs(p.x / (cellW * 0.5) - Math.round(p.x / (cellW * 0.5))) * cellW * 0.5;
    const oy = Math.abs(p.y / (cellH * 0.5) - Math.round(p.y / (cellH * 0.5))) * cellH * 0.5;
    if (!inCell || ox > 1.5 || oy > 1.5) badPos.push(`${p.key}(${p.x.toFixed(0)},${p.y.toFixed(0)})`);
  }
  ck("경계 장식 좌표가 셀 내 반 칸 격자", badPos.length === 0, badPos.slice(0, 3).join(", "));

  /* 셀 2칸 초과 없음 */
  const over = edgeInfo.filter((p) => p.w > cellW * 2 + 2 || p.h > cellH * 2 + 2);
  ck("경계 장식이 셀 2칸을 넘지 않음", over.length === 0, over.map((p) => `${p.key} ${p.w.toFixed(0)}×${p.h.toFixed(0)}`).join(", "));

  const uniq = [...new Set(edgeInfo.map((p) => `${p.key}:${p.w.toFixed(0)}x${p.h.toFixed(0)}`))];
  console.log(`\n  경계 장식 ${uniq.length}종:`, uniq.slice(0, 6).join(" | "));
}

/* 구조물 prop 은 원본 배율을 유지해야 한다 */
const structBad = info.props.filter((p) => p.scale !== 1);
ck("구조물 prop 이 원본 배율(1) 유지", structBad.length === 0, structBad.map((p) => `${p.key}:${p.scale}`).join(", "));

console.log(`\n=== ${pass}/${pass + fail} PASS ===`);
await browser.close();
process.exit(fail ? 1 : 0);
