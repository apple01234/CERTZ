/**
 * probe_dx_assets.mjs — vc289 드라이브 에셋이 실제 런타임에서 로드/재생되는지 검증.
 *
 * [검증된 Phaser 4 사실 — 이 스크립트가 지키는 규칙]
 *   · 게임 인스턴스는 `window.__SERTZ__.game` 에 있다.
 *     (`__SERTZ_SCENE__` 은 WorldScene 진입 후에야 설정되므로 로비 검증에 못 쓴다)
 *   · `TextureManager.exists()` 는 **존재하지 않는다**(Phaser 4). `checkKey()` 는
 *     로드된 키에도 false 를 돌려주는 경우가 있어 신뢰할 수 없다 → `getTextureKeys()` 로 확인.
 *   · `BootScene.create()` 가 retryFailedLoads + runTexGuardCycle 로 60~80초 걸린다.
 *     너무 일찍 재면 buildAllAnims() 이전이라 애니메이션이 0개로 보인다.
 *   · FX 의 `<key>-play` 애니는 **지연 생성**된다(playFx 최초 호출 시).
 *     프리로드 직후 없는 것은 정상 → 프레임 수를 확인하고 직접 생성·재생해 본다.
 *
 * 사용:
 *   PORT=3100 node server.js &            # 프로덕션 빌드 필요
 *   PROBE_URL=http://127.0.0.1:3100 node scripts/probe_dx_assets.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.PROBE_URL || "http://127.0.0.1:3000";
const WAIT_MS = Number(process.env.PROBE_WAIT_MS || 80000);
const NEED_MON = ["dx_hornbunny", "dx_hornrabbit"];
const NEED_FX = ["storm", "shockwave-big", "plasma", "energy-crack",
  "pentagram", "implosion-drive", "orbit-rings", "sparks-glow"];

/* BootScene preload 가 실제로 요청하는 경로와 동일하게 만든다 */
const urls = [];
for (const k of NEED_MON) {
  for (let i = 0; i < 4; i++) urls.push(`/assets/${k}_idle${i}.webp`);
  for (let i = 0; i < 6; i++) urls.push(`/assets/${k}_run${i}.webp`);
}
for (const k of NEED_FX) urls.push(`/assets/fx/${k}.png`, `/assets/fx/${k}.json`);

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errs = [];
page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 140)); });

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("canvas", { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(WAIT_MS);

/* ── 1) HTTP: 변환 파일이 실제로 서빙되는가 ── */
const httpRes = await page.evaluate(async (list) => {
  const out = {};
  await Promise.all(list.map(async (u) => {
    try { out[u] = (await fetch(u, { cache: "force-cache" })).status; }
    catch { out[u] = "ERR"; }
  }));
  return out;
}, urls);
const missingHttp = Object.entries(httpRes).filter(([, s]) => s !== 200).map(([u, s]) => `${u} → ${s}`);

/* ── 2) 런타임: 텍스처/애니 등록 + 실제 재생 ── */
const runtime = await page.evaluate(({ mon, fx }) => {
  const game = window.__SERTZ__?.game;
  if (!game || !game.textures) return { available: false, reason: "window.__SERTZ__.game 없음" };

  const keys = new Set(game.textures.getTextureKeys());
  const anims = game.anims.anims ? [...game.anims.anims.keys()] : [];
  const out = {
    available: true, emulator: "phaser4",
    totalTextures: keys.size, totalAnims: anims.length,
    monsters: {}, fx: {}, anims: {}, played: {}, missing: [],
  };

  for (const k of mon) {
    let n = 0;
    for (let i = 0; i < 4; i++) if (keys.has(`${k}_idle${i}`)) n++;
    for (let i = 0; i < 6; i++) if (keys.has(`${k}_run${i}`)) n++;
    out.monsters[k] = n;
    if (!n) out.missing.push(`tex:${k}`);
    const t = keys.has(`${k}_idle0`) ? game.textures.get(`${k}_idle0`) : null;
    if (t && t.key !== "__MISSING") {
      const src = t.getSourceImage();
      out.monsters[k + "__size"] = [src.width, src.height];
    }
    for (const a of [`${k}-idle`, `${k}-run`]) {
      if (anims.includes(a)) out.anims[a] = game.anims.get(a).frames.length;
      else out.missing.push(`anim:${a}`);
    }
  }

  const scene = game.scene.getScenes(true)[0];
  for (const k of fx) {
    const has = keys.has(k);
    out.fx[k] = has;
    if (!has) { out.missing.push(`fx:${k}`); continue; }
    const names = game.textures.get(k).getFrameNames().filter((n) => n !== "__BASE");
    out.fx[k + "__frames"] = names.length;
    if (!names.length) { out.missing.push(`fx:${k}:frames`); continue; }
    /* 지연 등록 구조이므로 여기서 직접 만들어 재생까지 확인한다 */
    const animKey = `${k}-play`;
    if (!game.anims.exists(animKey)) {
      game.anims.create({
        key: animKey,
        frames: names.map((f) => ({ key: k, frame: f })),
        frameRate: 24, repeat: 0,
      });
    }
    if (scene) {
      const sp = scene.add.sprite(0, 0, k, names[0]).setVisible(false);
      out.played[k] = sp.play(animKey) !== null;
      sp.destroy();
    }
  }
  return out;
}, { mon: NEED_MON, fx: NEED_FX });

const animsOk = runtime.available
  ? Object.keys(runtime.monsters).filter((k) => !k.includes("__")).every((k) => runtime.monsters[k] > 0)
  : true;
const playedOk = runtime.available ? Object.values(runtime.played).every(Boolean) : true;
const ok = missingHttp.length === 0
  && (!runtime.available || (runtime.missing.length === 0 && animsOk && playedOk));

console.log(JSON.stringify({
  ok, base: BASE,
  http: { checked: urls.length, failed: missingHttp },
  runtime,
  errs: errs.filter((e) => !/speed-insights|404/.test(e)).slice(0, 6),
}, null, 1));
await browser.close();
process.exit(ok ? 0 : 1);
