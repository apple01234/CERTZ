/**
 * e2e_vc142.js — 보스 디자인 교체 검증:
 *  ① 유저 아틀라스 6종 교체 적용 (boss/boss3/skoll/hati/fenrir + jorm 신설) — 프레임 기하 실측
 *  ② 10종 LINEAR 필터 + hero NEAREST 대조
 *  ③ 애니 등록 실측 (skoll/hati 4프레임·jorm 3프레임 idle + jorm sp3 부재)
 *  ④ 10종 인게임 렌더 + 스크린샷
 *  ⑤ 초상화 6종 HTTP 200
 */
const { chromium } = require("playwright");

/* [w, fh, rows, frames] */
const EXPECT = {
  atl_boss:       [304, 269, 7, 84],
  atl_boss2:      [330, 212, 7, 84],
  atl_boss3:      [303, 248, 7, 84],
  atl_boss_nidhog:[226, 232, 7, 84],
  atl_boss_surt:  [330, 224, 7, 84],
  atl_boss_fenrir:[303, 227, 7, 84],
  atl_boss_skoll: [303, 257, 7, 84],
  atl_boss_nagr:  [286, 240, 6, 72],
  atl_boss_hati:  [304, 257, 7, 84],
  atl_boss_jorm:  [304, 201, 6, 72],
};
const KEYS = Object.keys(EXPECT);

(async () => {
  const base = "http://127.0.0.1:3000";
  let pass = 0, fail = 0;
  const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("PASS", name, extra); } else { fail++; console.log("FAIL", name, extra); } };
  const errors = [];

  const browser = await chromium.launch({
    args: ["--no-sandbox"],
    executablePath: "/home/z/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome",
  });
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  p.setDefaultTimeout(40000);
  p.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));

  /* ── 1) 부팅 + 월드 진입 ── */
  await p.goto(base, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
  await p.waitForSelector("text=게임 시작", { timeout: 40000 });
  await p.getByRole("button", { name: /게임 시작/ }).first().click();
  await p.waitForTimeout(900);
  const createBtn = p.getByText("캐릭터 생성", { exact: false }).first();
  if ((await createBtn.count()) > 0) await createBtn.click().catch(() => {});
  await p.waitForTimeout(400);
  const ni = p.locator('input[placeholder*="캐릭터 이름"]').first();
  if ((await ni.count()) > 0) {
    await ni.fill("디자인테스터");
    await p.getByRole("button", { name: /다음 — 외형 선택/ }).first().click().catch(() => {});
    await p.waitForTimeout(300);
    await p.getByRole("button", { name: /모험가로 생성!/ }).first().click().catch(() => {});
    await p.waitForTimeout(800);
  }
  await p.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const t = btns.find((x) => /이 캐릭터로 시작/.test(x.textContent || "")) || btns.find((x) => /시작/.test(x.textContent || ""));
    if (t) t.click();
  });
  await p.waitForTimeout(8000);

  /* ── 2) 10종 LINEAR 필터 ── */
  const filters = await p.evaluate((KEYS) => {
    const g = window.__SERTZ__?.game;
    if (!g) return null;
    const out = {};
    for (const k of KEYS) {
      const t = g.textures.get(k);
      const src = t && t.source && t.source[0];
      out[k] = src ? src.scaleMode : null;
    }
    const hero = g.textures.get("hero_idle0");
    out.__hero = hero && hero.source && hero.source[0] ? hero.source[0].scaleMode : null;
    return out;
  }, KEYS);
  ok("보스 아틀라스 10종 LINEAR(0) — jorm 포함", !!filters && KEYS.every((k) => filters[k] === 0), JSON.stringify(filters));
  ok("대조군 hero_idle0 NEAREST(1) 유지", filters && filters.__hero === 1, `hero=${filters && filters.__hero}`);

  /* ── 3) 프레임 기하 실측 ── */
  const atlas = await p.evaluate((EXPECT) => {
    const g = window.__SERTZ__?.game;
    if (!g) return null;
    const out = {};
    for (const [k, exp] of Object.entries(EXPECT)) {
      const t = g.textures.get(k);
      const src = t && t.key !== "__MISSING" ? t.getSourceImage() : null;
      const fr = t ? t.frames && t.getFrameNames().length : 0;
      const f0 = t && t.getFrameNames ? t.frames["0"] || t.frames[Object.keys(t.frames)[0]] : null;
      out[k] = src ? { w: src.width, h: src.height, frames: fr, fw: f0 ? f0.cutWidth || f0.width : 0, fh: f0 ? f0.cutHeight || f0.height : 0, exp } : null;
    }
    return out;
  }, EXPECT);
  ok("아틀라스 10종 프레임 기하 (vc142 실측 일치)", !!atlas && Object.entries(EXPECT).every(([k, e]) => {
    const a = atlas[k];
    return a && a.w === e[0] * 12 && a.h === e[1] * e[2] && a.frames === e[3];
  }), JSON.stringify(Object.fromEntries(KEYS.map((k) => [k, atlas && atlas[k] ? `${atlas[k].w}x${atlas[k].h}/${atlas[k].frames}fr` : "null"]))));

  /* ── 4) 애니 등록 실측 ── */
  const anims = await p.evaluate(() => {
    const g = window.__SERTZ__?.game;
    if (!g) return null;
    const a = g.anims;
    const get = (k) => { const an = a.get(k); return an ? { frames: an.frames.length, rate: an.frameRate } : null; };
    return {
      bossIdle: get("boss-idle"),
      skollIdle: get("boss_skoll-idle"), hatiIdle: get("boss_hati-idle"),
      jormIdle: get("boss_jorm-idle"), jormSp3: get("boss_jorm-sp3"), jormDie: get("boss_jorm-die"),
    };
  });
  ok("boss-idle 8프레임", anims && anims.bossIdle && anims.bossIdle.frames === 8, JSON.stringify(anims && anims.bossIdle));
  ok("skoll-idle 4프레임(쌍랑 시트 절반)", anims && anims.skollIdle && anims.skollIdle.frames === 4, JSON.stringify(anims && anims.skollIdle));
  ok("hati-idle 4프레임", anims && anims.hatiIdle && anims.hatiIdle.frames === 4, JSON.stringify(anims && anims.hatiIdle));
  ok("jorm-idle 3프레임 + die 6프레임", anims && anims.jormIdle && anims.jormIdle.frames === 3 && anims.jormDie && anims.jormDie.frames === 6, JSON.stringify({ idle: anims && anims.jormIdle, die: anims && anims.jormDie }));
  ok("jorm sp3 부재(6행 시트)", anims && anims.jormSp3 === null, JSON.stringify(anims && anims.jormSp3));
  ok("12FPS 등록", anims && anims.bossIdle && anims.bossIdle.rate === 12, `rate=${anims && anims.bossIdle && anims.bossIdle.rate}`);

  /* ── 5) 10종 인게임 렌더 + 스크린샷 ── */
  await p.evaluate((KEYS) => {
    const g = window.__SERTZ__.game;
    const ws = g.scene.getScene("world");
    const c = ws.cameras.main.midPoint ?? { x: ws.player.x, y: ws.player.y };
    KEYS.forEach((k, i) => {
      const col = i % 5, row = Math.floor(i / 5);
      ws.add.sprite(c.x - 320 + col * 160, c.y - 120 + row * 220, k, 0)
        .setDepth(50).setName("q_" + k);
    });
    /* 대화창 자동 팝업 제거 — 스크린샷 가림 방지 */
    const dlg = document.querySelector("[class*=dialogue]");
    if (dlg) dlg.style.display = "none";
  }, KEYS);
  await p.waitForTimeout(900);
  await p.evaluate(() => {
    const ws = window.__SERTZ__.game.scene.getScene("world");
    ws.children.each((c) => { if (c.name && c.name.startsWith("q_")) c.setDepth(9999); });
  });
  await p.waitForTimeout(500);
  await p.screenshot({ path: "scripts/atlas_preview/ingame_vc142_10boss.png" });
  const rendered = await p.evaluate((KEYS) => {
    const ws = window.__SERTZ__.game.scene.getScene("world");
    return KEYS.map((k) => {
      const s = ws.children.getByName("q_" + k);
      return s ? { k, vis: s.visible, w: Math.round(s.displayWidth) } : null;
    });
  }, KEYS);
  ok("10종 인게임 렌더(displayWidth 200~360급)", rendered.every((r) => r && r.vis && r.w >= 200 && r.w <= 360), JSON.stringify(rendered));

  /* ── 6) 초상화 6종 HTTP 200 ── */
  const ports = ["boss", "boss3", "boss_skoll", "boss_hati", "boss_fenrir", "boss_jorm"];
  let portOk = 0;
  for (const t of ports) {
    const r = await p.request.get(`${base}/assets/bossport_${t}.webp`);
    if (r.status() === 200) portOk++;
    else console.log("  초상화 실패:", t, r.status());
  }
  ok("초상화 6종 200", portOk === 6, `${portOk}/6`);

  ok("pageerror 0", errors.length === 0, errors.join(" | ").slice(0, 200));

  console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
