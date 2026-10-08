/**
 * e2e_vc139.js — v1.4.32 검증: 보스 아틀라스 화질 복구 (HD 4종 교체 + LANCZOS 5종)
 *  브라우저 실측 — 신규 프레임 크기/카운트 + 9종 전체 인게임 렌더 + 페이지 에러 수집
 */
const { chromium } = require("playwright");

const EXPECT = {
  // key: [fw, fh, rows, 총프레임]
  atl_boss:       [268, 234, 6, 72],
  atl_boss2:      [330, 212, 7, 84],
  atl_boss3:      [286, 234, 6, 72],
  atl_boss_nidhog:[226, 232, 7, 84],
  atl_boss_surt:  [330, 224, 7, 84],
  atl_boss_fenrir:[304, 274, 7, 84],
  atl_boss_skoll: [274, 234, 7, 84],
  atl_boss_nagr:  [286, 240, 6, 72],
  atl_boss_hati:  [280, 258, 7, 84],
};

(async () => {
  const base = "http://127.0.0.1:3000";
  let pass = 0, fail = 0;
  const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("PASS", name, extra); } else { fail++; console.log("FAIL", name, extra); } };
  const errors = [];

  const browser = await chromium.launch({
    args: ["--no-sandbox"],
    executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome",
  });
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  p.setDefaultTimeout(30000);
  p.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));

  /* ── 1) 부팅 + 월드 진입 ── */
  await p.goto(base, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.getByRole("button", { name: /게임 시작/ }).first().click();
  await p.waitForTimeout(900);
  const createBtn = p.getByText("캐릭터 생성", { exact: false }).first();
  if ((await createBtn.count()) > 0) await createBtn.click().catch(() => {});
  await p.waitForTimeout(400);
  const ni = p.locator('input[placeholder*="캐릭터 이름"]').first();
  if ((await ni.count()) > 0) {
    await ni.fill("화질테스터");
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
  await p.waitForTimeout(7000);

  /* ── 2) 아틀라스 9종 실측 (프레임 크기·개수) ── */
  const atlas = await p.evaluate((EXPECT) => {
    const g = window.__SERTZ__?.game;
    if (!g) return null;
    const out = {};
    for (const [k, exp] of Object.entries(EXPECT)) {
      const t = g.textures.get(k);
      const src = t && t.key !== "__MISSING" ? t.getSourceImage() : null;
      const fr = t ? t.frames && t.getFrameNames().length : 0;
      const f0 = t && t.getFrameNames ? t.frames["0"] || t.frames[Object.keys(t.frames)[0]] : null;
      out[k] = src ? {
        w: src.width, h: src.height, frames: fr,
        fw: f0 ? f0.cutWidth || f0.width : 0, fh: f0 ? f0.cutHeight || f0.height : 0,
        exp,
      } : null;
    }
    out.anims = ["boss_surt-idle", "boss_surt-die", "boss2-sp3", "boss_nidhog-sp3", "boss_fenrir-die", "boss_nagr-idle"]
      .map((k) => ({ k, ok: g.anims.exists(k) }));
    return out;
  }, EXPECT);
  ok("아틀라스 9종 로드+프레임 크기 일치", !!atlas && Object.entries(EXPECT).every(([k, e]) => {
    const a = atlas[k];
    return a && a.w === e[0] * 12 && a.h === e[1] * e[2] && a.frames === e[3];
  }), JSON.stringify(Object.fromEntries(Object.entries(atlas || {}).filter(([k]) => k.startsWith("atl_")).map(([k, v]) => [k, v ? `${v.w}x${v.h}/${v.frames}fr` : "null"]))));
  ok("신규 애니 6종 등록(surt die·boss2 sp3·nidhog sp3 등)", !!atlas && atlas.anims.every((a) => a.ok), JSON.stringify(atlas?.anims));

  /* ── 3) 9종 전체 인게임 렌더 + 스크린샷 ── */
  await p.evaluate(() => {
    const g = window.__SERTZ__.game;
    const ws = g.scene.getScene("world");
    const c = ws.cameras.main.midPoint ?? { x: ws.player.x, y: ws.player.y };
    const keys = ["atl_boss", "atl_boss2", "atl_boss3", "atl_boss_nidhog", "atl_boss_surt", "atl_boss_fenrir", "atl_boss_skoll", "atl_boss_nagr", "atl_boss_hati"];
    keys.forEach((k, i) => {
      const col = i % 5, row = Math.floor(i / 5);
      ws.add.sprite(c.x - 320 + col * 160, c.y - 120 + row * 220, k, 0)
        .setDepth(50).setName("q_" + k);
    });
  });
  await p.waitForTimeout(900);
  /* 프롤로그 대화 스킵 (클릭 연타) */
  for (let i = 0; i < 14; i++) {
    await p.mouse.click(640, 400);
    await p.waitForTimeout(180);
  }
  await p.evaluate(() => {
    const g = window.__SERTZ__.game;
    const dlg = g.scene.getScene("world");
    dlg.children.each((c) => { if (c.name && c.name.startsWith("q_")) c.setDepth(9999); });
  });
  await p.waitForTimeout(500);
  await p.screenshot({ path: "scripts/atlas_preview/ingame_vc139_9boss.png" });
  const rendered2 = await p.evaluate(() => {
    const ws = window.__SERTZ__.game.scene.getScene("world");
    return ["atl_boss", "atl_boss2", "atl_boss3", "atl_boss_nidhog", "atl_boss_surt", "atl_boss_fenrir", "atl_boss_skoll", "atl_boss_nagr", "atl_boss_hati"].map((k) => {
      const s = ws.children.getByName("q_" + k);
      return s ? { k, vis: s.visible, w: Math.round(s.displayWidth), h: Math.round(s.displayHeight) } : null;
    });
  });
  ok("9종 인게임 렌더(displayWidth 220~340급)", rendered2.every((r) => r && r.vis && r.w >= 200 && r.w <= 360), JSON.stringify(rendered2));

  ok("페이지 에러 0", errors.length === 0, errors.join(" | ").slice(0, 200));
  console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})();
