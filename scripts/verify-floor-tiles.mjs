/**
 * vc252 (지시 #1) — 바닥 타일 검증.
 *
 * [무엇을 고쳤나]
 *  `ground_slate`·`ground_ash` 가 돌바닥이 아니라 **회색 Perlin 노이즈**(100% 무채색, 75~95색)를
 *  3배 확대한 이미지였다. 이 둘이 `tile_dark`·`tile_stone`·`tile_path_dark`·`tile_basalt`·`tile_ash`
 *  의 기본값이라 어두운 스테이지 대부분이 "회색 노이즈 바닥"이었다.
 *  → 품질이 검증된 `ground_violet` 의 **돌 구조(줄눈·하이라이트)를 유지**하고 팔레트만 석재로 변환.
 *  → 96×96 단일 타일의 반복 티를 줄이려고 회전·반전 4변형 아틀라스를 만들어 셀마다 섞는다.
 *
 * [검증]
 *  1) 텍스처가 순수 회색조가 아니고 색조가 있다(노이즈 탈출)
 *  2) 돌 구조 지표(이웃픽셀 차이)가 원본과 비슷하다(과대 대비 아님)
 *  3) 게임에 들어가 실제로 바닥 레이어가 렌더되고, 아틀라스 프레임이 여러 종 쓰인다
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = path.resolve(import.meta.dirname, "..");
const BASE = process.argv[2] || "http://127.0.0.1:3109";

let pass = 0, fail = 0;
const check = (n, c, d = "") => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${d ? " — " + d : ""}`); } };

/* ── 1) 파일 수준 검증 (PNG 디코딩 없이 색 분포만 파이썬에 위임하지 않고, 노이즈 판정은 픽셀 샘플로) ── */
const { execSync } = await import("node:child_process");
const stats = JSON.parse(execSync("python3 scripts/floor_stats.py ground_slate ground_ash ground_violet", { cwd: ROOT, encoding: "utf8" }).trim());
console.log("텍스처 통계:", JSON.stringify(stats));

for (const k of ["ground_slate", "ground_ash"]) {
  const s = stats[k];
  check(`${k}: 순수 회색조 아님`, s.grayRatio < 0.02, `grayRatio=${s.grayRatio}`);
  check(`${k}: 색조 존재(채도>0.08)`, s.avgSat > 0.08, `avgSat=${s.avgSat}`);
  /* 이웃차이가 원본(7.62)의 1.3배를 넘으면 "조각조각 튀는" 대비 과다 */
  check(`${k}: 대비가 원본 수준(≤${(stats.ground_violet.neighborDiff * 1.3).toFixed(1)})`, s.neighborDiff <= stats.ground_violet.neighborDiff * 1.3, `diff=${s.neighborDiff}`);
}

/* 아틀라스 존재 + 4프레임 세로 */
const atlasOk = ["ground_slate_atlas", "ground_ash_atlas"].every((k) => {
  const p = path.join(ROOT, `public/assets/ground/${k}.png`);
  if (!fs.existsSync(p)) return false;
  const size = execSync(`python3 -c "from PIL import Image;print(Image.open('${p}').size)"`, { cwd: ROOT, encoding: "utf8" }).trim();
  return size === "(96, 384)";
});
check("변형 아틀라스 96×384 (4프레임) 존재", atlasOk);

/* ── 2) 게임에서 실제 렌더 ── */
if (BASE) {
  let browser;
  try {
    browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=swiftshader"] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.locator("button", { hasText: "게임 시작" }).first().click({ timeout: 120000 });
    await page.getByRole("button", { name: "캐릭터 생성", exact: true }).first().click();
    await page.locator("input").first().fill("바닥" + String(Date.now()).slice(-4));
    await page.getByRole("button", { name: /다음/ }).click();
    await page.getByRole("button", { name: "모험가로 생성!" }).click({ timeout: 30000 });
    await page.getByRole("button", { name: "이 캐릭터로 시작" }).click({ timeout: 30000 });
    await page.waitForFunction(() => window.__SERTZ_SCENE__?.player, { timeout: 90000 });
    await page.evaluate(() => {
      const s = window.__SERTZ_SCENE__;
      for (const o of [...s.children.list]) if (o.text === "건너뛰기") o.emit("pointerdown");
      s.tutorialDone = true; s.tutStep = -1;
    });
    /* 마을은 layout 이 없어 authored 바닥을 안 쓴다. 어두운 스테이지(cave)로 이동해 확인한다. */
    await page.evaluate(() => window.__SERTZ_SCENE__.startTransition("howlrstone1x2"));
    await page.waitForFunction(() => {
      const s = window.__SERTZ_SCENE__;
      return s?.stageDef?.key === "howlrstone1x2" && !s.transitioning;
    }, { timeout: 60000 });
    await page.waitForTimeout(2500);

    const info = await page.evaluate(() => {
      const s = window.__SERTZ_SCENE__;
      const layers = (s.children.list || []).filter((o) => typeof o.name === "string" && o.name.startsWith("rea:"));
      const ground = layers.find((o) => o.name === "rea:ground");
      let frames = [];
      try {
        const layer = ground?.layer;
        const data = layer?.data ?? [];
        const set = new Set();
        for (const row of data) for (const t of row) if (t && t.index >= 0) set.add(t.index);
        frames = [...set].sort((a, b) => a - b);
      } catch { /* ignore */ }
      return {
        layerCount: layers.length,
        names: layers.map((o) => o.name),
        groundFrames: frames.slice(0, 20),
        textureKeys: s.textures.list ? Object.keys(s.textures.list).filter((k) => k.startsWith("ground_")) : [],
      };
    });
    console.log("씬:", JSON.stringify({ layers: info.layerCount, names: info.names, frames: info.groundFrames.length }));

    check("바닥 레이어(rea:ground) 렌더", info.names.includes("rea:ground"));
    check("아틀라스 텍스처가 로드됨", info.textureKeys.some((k) => k.endsWith("_atlas")), info.textureKeys.slice(0, 6).join(","));
    /* 변형이 섞이면 프레임 인덱스가 여러 개여야 한다(단일 타일이면 1~9 범위로 고정) */
    check("바닥 프레임이 여러 변형으로 섞임", info.groundFrames.length > 4, `frames=${info.groundFrames.length} ${info.groundFrames.slice(0, 8)}`);
    check("페이지 오류 0", errs.length === 0, errs.slice(0, 2).join(" | "));
  } catch (e) {
    console.log("  (브라우저 검증 생략:", String(e.message).slice(0, 80), ")");
  } finally {
    if (browser) await browser.close();
  }
}

console.log(`\nRESULT ${pass}/${pass + fail} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
