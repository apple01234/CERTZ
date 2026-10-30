// 런타임 증거: 무스펠헤임에서 실제로 어떤 텍스처 키가 지면에 쓰였는지 덤프
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = '/root/.hermes/cache/scratch/deploy/texproof';
const SAVE_KEY = 'sertz_save_v2';

function makeSave(stage) {
  return { stage, lv: 40, exp: 0, maxHp: 3000, atk: 200, cleared: false,
    gold: 5000, potions: { hp: 5, mp: 5 }, maxMp: 300, playerName: 'TEST', questLog: [], inv: {}, owned: [] };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();

  await page.addInitScript(({ k, v }) => {
    try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  }, { k: SAVE_KEY, v: makeSave('muspelheim1') });

  // Phaser Game 인스턴스를 window 에 노출시켜 잡는다
  await page.addInitScript(() => {
    const origAdd = window.addEventListener;
    window.__PHASER_GAMES__ = [];
    let tries = 0;
    const iv = setInterval(() => {
      for (const k of Object.keys(window)) {
        try {
          const v = window[k];
          if (v && v.constructor && v.constructor.name === 'Game' && v.scene && !window.__PHASER_GAMES__.includes(v)) {
            window.__PHASER_GAMES__.push(v);
          }
        } catch (e) {}
      }
      if (++tries > 60) clearInterval(iv);
    }, 500);
  });

  await page.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(14000);

  const canvas = page.locator('canvas').first();
  await canvas.click({ position: { x: 640, y: 252 }, force: true });
  await page.waitForTimeout(4500);
  await page.mouse.click(1090, 200);   // 캐릭터 생성/입장
  await page.waitForTimeout(3500);
  await page.mouse.click(640, 560);
  await page.waitForTimeout(6000);

  const dump = await page.evaluate(() => {
    const out = { games: window.__PHASER_GAMES__?.length || 0, results: [] };
    const G = window.__PHASER_GAMES__?.[0];
    if (!G) return out;
    out.scenes = G.scene.scenes.map((s) => s.scene.key);
    for (const s of G.scene.scenes) {
      if (!s.scene.isActive()) continue;
      const info = { key: s.scene.key, tileSprites: [], groundTheme: null };
      // TileSprite 들의 텍스처 키 수집
      s.children?.list?.forEach?.((c) => {
        if (c.type === 'TileSprite' && c.depth === 0) info.tileSprites.push(c.texture?.key);
      });
      try { info.groundTheme = s.stageDef ? { ground: s.stageDef.groundTex } : null; } catch (e) {}
      out.results.push(info);
    }
    return out;
  });
  console.log(JSON.stringify(dump, null, 1));

  // 텍스처 존재 여부 확인
  const tex = await page.evaluate(() => {
    const G = window.__PHASER_GAMES__?.[0];
    if (!G) return {};
    const keys = ['tile_lava','tile_magma','tile_basalt','tile_blood','tile_dark','tile_path','tile_grass'];
    const o = {};
    for (const k of keys) {
      const exists = G.textures.exists(k);
      let w = null, h = null;
      if (exists) { const t = G.textures.get(k).getSourceImage(); w = t.width; h = t.height; }
      o[k] = { exists, w, h };
    }
    return o;
  });
  console.log('TEXTURES:', JSON.stringify(tex, null, 1));
  await page.screenshot({ path: path.join(OUT, 'proof.png') });
  await browser.close();
})();
