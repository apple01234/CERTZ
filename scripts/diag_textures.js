/* 부트 시점에 어떤 아이템 아이콘 텍스처가 Phaser에 로드되는지 전수 확인 */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(3500);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  for (let i = 0; i < 20 && !(await p.evaluate(() => !!window.__SERTZ_DEFER_DONE__)); i++) await p.waitForTimeout(500);
  const res = await p.evaluate(() => {
    const ph = window.__SERTZ__?.game;
    if (!ph) return null;
    const title = ph.scene.getScene("title");
    const keys = [
      "i_bd_guardian", "i_bd_abudditos", "i_gm_sword", "i_tier_cube", "i_eert_cube",
      "item_coin", "item_weapon_1", "item_weapon_6", "item_armor_1",
      "exp_book", "exp_book_s", "exp_book_m", "exp_book_l",
      "item_potion_hp3", "item_potion_hp10", "item_ring_crit",
      "pet_slime", "cos_aurora", "i_cos_rainbow",
    ];
    const out = {};
    for (const k of keys) out[k] = title ? title.textures.exists(k) : "no-title";
    return out;
  });
  console.log(JSON.stringify(res, null, 1));
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
