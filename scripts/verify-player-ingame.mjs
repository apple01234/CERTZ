/**
 * vc255 — 게임 안에서 기본 남캐가 새 시트(chm2)로 렌더되는지 확인.
 *
 * [확인] 캐릭터를 만들고 마을에 들어간 뒤
 *  1) bodyPrefix 가 chm2 인가
 *  2) 현재 텍스처 키가 chm2_* 이고 실제로 로드됐는가
 *  3) 캐릭터 스프라이트가 화면에 그려지고 있는가(알파 있는 픽셀)
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://127.0.0.1:3111";
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));

let pass = 0, fail = 0;
const check = (n, c, d = "") => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${d ? " — " + d : ""}`); } };

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.locator("button", { hasText: "게임 시작" }).first().click({ timeout: 120000 });
await page.getByRole("button", { name: "캐릭터 생성", exact: true }).first().click();
await page.locator("input").first().fill("외형" + String(Date.now()).slice(-4));
await page.getByRole("button", { name: /다음/ }).click();
await page.getByRole("button", { name: "모험가로 생성!" }).click({ timeout: 30000 });
await page.getByRole("button", { name: "이 캐릭터로 시작" }).click({ timeout: 30000 });
await page.waitForFunction(() => window.__SERTZ_SCENE__?.player, { timeout: 90000 });
await page.evaluate(() => {
  const s = window.__SERTZ_SCENE__;
  for (const o of [...s.children.list]) if (o.text === "건너뛰기") o.emit("pointerdown");
  s.tutorialDone = true; s.tutStep = -1;
});
await page.waitForTimeout(3000);

const info = await page.evaluate(() => {
  const s = window.__SERTZ_SCENE__;
  const p = s.player;
  const texKey = p?.texture?.key ?? "";
  const frames = p?.texture?.frame?.name ?? "";
  /* 텍스처 실제 등록 확인 */
  const has = (k) => !!s.textures.exists(k);
  return {
    bodyPrefix: p?.bodyPrefix ?? "(없음)",
    texKey,
    frame: frames,
    chm2Loaded: has("chm2_idle0"),
    chm2Webp: has("chm2_idle0"),
    displayW: p?.displayWidth ?? 0,
    displayH: p?.displayHeight ?? 0,
    visible: p?.visible ?? false,
    alpha: p?.alpha ?? 0,
    animKey: p?.anims?.currentAnim?.key ?? "",
  };
});
console.log("플레이어:", JSON.stringify(info));

check("bodyPrefix 가 chm2", info.bodyPrefix === "chm2", info.bodyPrefix);
check("chm2 텍스처가 로드됨", info.chm2Loaded === true);
check("현재 텍스처가 chm2_*", String(info.texKey).startsWith("chm2"), info.texKey);
check("캐릭터가 화면에 표시됨", info.visible === true && info.alpha > 0.5, `visible=${info.visible} alpha=${info.alpha}`);
check("표시 크기가 새 시트 규격(≈27×56)", info.displayW >= 20 && info.displayH >= 45, `${info.displayW}×${info.displayH}`);

/* 이동시켜 walk 애니메이션도 확인 */
const walk = await page.evaluate(async () => {
  const s = window.__SERTZ_SCENE__;
  const p = s.player;
  const before = p.texture.key;
  /* 아래 방향으로 이동 입력 */
  const kd = new KeyboardEvent("keydown", { code: "ArrowDown", key: "ArrowDown", bubbles: true });
  window.dispatchEvent(kd);
  await new Promise((r) => setTimeout(r, 600));
  const mid = { tex: p.texture.key, anim: p.anims?.currentAnim?.key ?? "" };
  const ku = new KeyboardEvent("keyup", { code: "ArrowDown", key: "ArrowDown", bubbles: true });
  window.dispatchEvent(ku);
  await new Promise((r) => setTimeout(r, 200));
  return { before, mid };
});
console.log("이동:", JSON.stringify(walk));
check("이동 시 chm2 계열 애니메이션", String(walk.mid.anim).includes("chm2") || String(walk.mid.tex).includes("chm2"), JSON.stringify(walk.mid));

check("페이지 오류 0", errs.length === 0, errs.slice(0, 2).join(" | "));

console.log(`\nRESULT ${pass}/${pass + fail} passed, ${fail} failed`);
await browser.close();
process.exit(fail === 0 ? 0 : 1);
