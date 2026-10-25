const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu", "--use-gl=swiftshader"] });
  const page = await b.newPage({ viewport: { width: 1100, height: 760 } });
  await page.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded", timeout: 120000 });
  const wait = async (w, ms) => { const t0 = Date.now(); let c = [];
    while (Date.now() - t0 < ms) { try { c = await page.evaluate(() => window.__SERTZ_DEBUG__?.game?.scene.getScenes(true).map(s => s.scene.key) ?? []);
      if (w.every(x => c.includes(x))) return c; } catch {} await page.waitForTimeout(700); } return c; };
  const click = async (re) => page.evaluate((s) => { const rx = new RegExp(s);
    const bt = Array.from(document.querySelectorAll("button")).find(x => rx.test(x.textContent||"") && x.offsetParent !== null);
    if (bt) { bt.click(); return true; } return false; }, re.source);
  await wait(["title"], 60000);
  await click(/게임 시작/); await page.waitForTimeout(2500);
  let ok = await click(/이 캐릭터로 시작/);
  if (!ok) { await click(/캐릭터 생성/); await page.waitForTimeout(1500);
    const i = await page.$("input[placeholder*='캐릭터 이름']"); if (i) await i.fill("해적검증");
    await page.waitForTimeout(900); await click(/^다음/); await page.waitForTimeout(1200);
    await click(/모험가로 생성/); await page.waitForTimeout(4000); ok = await click(/이 캐릭터로 시작/); }
  await wait(["world"], 60000); await page.waitForTimeout(5000);

  const res = await page.evaluate(async () => {
    const D = window.__SERTZ_DEBUG__;
    const sc = D.game.scene.getScenes(true).find(s => s && s.player);
    sc.tut = null; sc.dialoguing = false; sc.tutorialDone = true;
    sc.player.cls = "pirate";
    sc.player.lv = 30;
    await new Promise(r => setTimeout(r, 400));
    // 무기 스프라이트 키 확인
    const before = { weaponSprite: sc.weaponImg?.texture?.key ?? null };
    const EB = window.__SERTZ_EB__;
    // 공격 4방향 각각 — 스프라이트 회전/머즐 확인
    const seen = [];
    for (const dir of ["up","down","left","right"]) {
      EB.emit("input:move", { x: dir==="left"?-1:dir==="right"?1:0, y: dir==="up"?-1:dir==="down"?1:0 });
      await new Promise(r => setTimeout(r, 120));
      EB.emit("input:attack");
      await new Promise(r => setTimeout(r, 220));
      seen.push({ dir,
        wepKey: sc.weaponImg?.texture?.key ?? null,
        wepRot: sc.weaponImg ? +sc.weaponImg.rotation.toFixed(2) : null,
        wepVisible: sc.weaponImg?.visible ?? null,
        projCount: sc.playerProjs?.length ?? sc.projs?.length ?? -1,
      });
    }
    return { cls: sc.player.cls, before, seen };
  });
  console.log(JSON.stringify(res, null, 1));
  await b.close();
})();
