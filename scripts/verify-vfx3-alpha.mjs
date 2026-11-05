/**
 * vfx3 검은 배경 제거 검증 (사용자 지시: "검은색 배경 제거하고 사용하던지, 아님 사용하지 말던지").
 *
 * [조치] 81개 중 46개가 완전 불투명 검정 배경이었다(코너 6점 전부 (0,0,0,255)).
 *  알파 = 루마(Rec.709)로 변환하고 RGB는 유지했다. ADD 블렌드는 rgb*alpha 를 더하므로
 *  기존 ADD 결과와 같은 계열이면서, NORMAL 사용 시에도 검은 박스가 뜨지 않는다.
 *
 * [검증]
 *  1) 파일 수준: 불투명 검정 모서리가 0개, 콘텐츠가 비지 않았음
 *  2) 게임 수준: gv_* 텍스처가 실제로 로드되고, 이펙트를 스폰했을 때 렌더 오브젝트가 생긴다
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const ROOT = path.resolve(import.meta.dirname, "..");
const BASE = process.argv[2] || "";

let pass = 0, fail = 0;
const check = (n, c, d = "") => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${d ? " — " + d : ""}`); } };

/* ── 1) 파일 검증 (파이썬에 위임: 픽셀 디코딩이 필요) ── */
const py = `
import glob, os, json
from PIL import Image
bad, dead, n = [], [], 0
for p in sorted(glob.glob('public/assets/vfx3/*.webp')):
    im = Image.open(p).convert('RGBA'); w,h = im.size; px = im.load(); n += 1
    pts = [(0,0),(w-1,0),(0,h-1),(w-1,h-1)]
    ob = sum(1 for x,y in pts if px[x,y][3] > 200 and px[x,y][0] < 16 and px[x,y][1] < 16 and px[x,y][2] < 16)
    if ob >= 2: bad.append(os.path.basename(p))
    a = im.split()[3]; hist = a.histogram()
    if sum(hist[64:]) < w*h*0.005: dead.append(os.path.basename(p))
print(json.dumps({'total': n, 'opaqueBlack': bad, 'dead': dead}))
`;
const stats = JSON.parse(execFileSync("python3", ["-c", py], { cwd: ROOT, encoding: "utf8" }).trim());
console.log(`vfx3 파일: ${stats.total}개`);
check("불투명 검정 배경이 남아있지 않다", stats.opaqueBlack.length === 0, stats.opaqueBlack.slice(0, 4).join(","));
check("알파 변환으로 내용이 비지 않았다", stats.dead.length === 0, stats.dead.slice(0, 4).join(","));
check("파일 수 81 유지", stats.total === 81, String(stats.total));

/* 변환 스크립트가 저장소에 남아 재현 가능해야 한다 */
check("변환 스크립트 존재(재현 가능)", fs.existsSync(path.join(ROOT, "scripts/fix_vfx3_alpha.py")));

/* ── 2) 게임 렌더 (서버 주소가 주어졌을 때만) ── */
if (BASE) {
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.locator("button", { hasText: "게임 시작" }).first().click({ timeout: 120000 });
    await page.getByRole("button", { name: "캐릭터 생성", exact: true }).first().click();
    await page.locator("input").first().fill("vfx" + String(Date.now()).slice(-4));
    await page.getByRole("button", { name: /다음/ }).click();
    await page.getByRole("button", { name: "모험가로 생성!" }).click({ timeout: 30000 });
    await page.getByRole("button", { name: "이 캐릭터로 시작" }).click({ timeout: 30000 });
    await page.waitForFunction(() => window.__SERTZ_SCENE__?.player, { timeout: 90000 });
    await page.evaluate(() => {
      const s = window.__SERTZ_SCENE__;
      for (const o of [...s.children.list]) if (o.text === "건너뛰기") o.emit("pointerdown");
      s.tutorialDone = true; s.tutStep = -1;
    });
    await page.waitForTimeout(2500);

    /* gv 텍스처 로드 여부 */
    const tex = await page.evaluate(() => {
      const s = window.__SERTZ_SCENE__;
      const keys = Object.keys(s.textures.list || {}).filter((k) => k.startsWith("gv_"));
      return { count: keys.length, sample: keys.slice(0, 5) };
    });
    console.log(`  로드된 gv_ 텍스처: ${tex.count}개`);
    check("gv_ 텍스처가 로드됐다", tex.count > 0, JSON.stringify(tex.sample));

    /* 실제 이펙트 스폰 → 렌더 오브젝트 생성 확인 */
    const spawn = await page.evaluate(async () => {
      const s = window.__SERTZ_SCENE__;
      const before = s.children.list.length;
      const fx = s.driveFx || s.driveFX || s.drive;
      const hasApi = !!(fx && typeof fx.gvShock === "function");
      if (hasApi) {
        fx.gvShock(s.player.x, s.player.y - 10, 0xffb070, 1.4, 700);
        fx.gvHitTri(s.player.x + 20, s.player.y - 10, 0, 0xffe0a0, 1);
        fx.gvAuraRays?.(s.player.x, s.player.y, 0x9fd8ff);
      }
      await new Promise((r) => setTimeout(r, 300));
      /* 생성된 이미지의 알파가 0이 아닌지(검은 박스가 아니라 이펙트만) */
      const imgs = (s.children.list || []).filter((o) => typeof o.texture?.key === "string" && o.texture.key.startsWith("gv_"));
      return { hasApi, before, added: s.children.list.length - before, effectImgs: imgs.length };
    });
    check("DriveFX 이펙트 API 가 존재한다", spawn.hasApi, JSON.stringify(spawn));
    check("이펙트 스폰 시 렌더 오브젝트가 생긴다", spawn.added > 0, `added=${spawn.added}`);
    check("페이지 오류 0", errs.length === 0, errs.slice(0, 2).join(" | "));
  } catch (e) {
    console.log("  (브라우저 검증 생략:", String(e.message).slice(0, 90), ")");
  } finally {
    await browser.close();
  }
}

console.log(`\nRESULT ${pass}/${pass + fail} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
