/** 아틀라스 보스 렌더 클린 스크린샷 v2 — 대화창 클릭으로 진행 */
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto("http://127.0.0.1:3000", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.getByRole("button", { name: /게임 시작/ }).first().click();
  await p.waitForTimeout(900);
  const createBtn = p.getByText("캐릭터 생성", { exact: false }).first();
  if (await createBtn.count() > 0) await createBtn.click().catch(() => {});
  await p.waitForTimeout(400);
  const ni = p.locator('input[placeholder*="캐릭터 이름"]').first();
  if (await ni.count() > 0) {
    await ni.fill("비주얼체크");
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
  await p.waitForTimeout(6000);
  // 대화창(React) 클릭으로 프로로그 전부 스킵 — 최대 40회
  for (let i = 0; i < 40; i++) {
    const dlg = await p.locator('div:has-text("프롤로그"), [class*="dialogue"], [class*="Dialogue"]').count();
    // 대화 텍스트 박스 영역 클릭 (화면 하단 대화 박스)
    const clicked = await p.evaluate(() => {
      // dialoguebox 계열 요소 탐색
      const cands = [...document.querySelectorAll("div")].filter((d) => {
        const cls = d.className || "";
        return typeof cls === "string" && /pointer-events-auto/.test(cls) && d.getBoundingClientRect().height > 60 && d.getBoundingClientRect().height < 300 && d.getBoundingClientRect().top > 400;
      });
      const el = cands[cands.length - 1];
      if (el) { el.click(); return true; }
      return false;
    });
    await p.mouse.click(640, 620);
    await p.waitForTimeout(250);
  }
  const dlgLeft = await p.evaluate(() => document.body.innerText.includes("프롤로그") || document.body.innerText.includes("스포트라이트"));
  console.log("dialogue 남음:", dlgLeft);
  await p.evaluate(() => {
    const g = window.__SERTZ__.game;
    const ws = g.scene.getScene("world");
    const cx = ws.player?.x ?? 400;
    const cy = ws.player?.y ?? 400;
    const y0 = cy - 150;
    ws.add.sprite(cx, y0, "atl_boss_nidhog", 0).setDepth(200).setName("v1");
    ws.add.sprite(cx - 160, y0 + 30, "atl_boss_fenrir", 0).setDepth(200).setName("v2");
    ws.add.sprite(cx + 160, y0 + 30, "atl_boss_skoll", 0).setDepth(200).setName("v3");
    ws.add.sprite(cx - 80, y0 + 170, "atl_boss2", 0).setDepth(200).setName("v4");
    ws.add.sprite(cx + 80, y0 + 170, "atl_boss_surt", 0).setDepth(200).setName("v5");
    ws.add.sprite(cx, y0 + 290, "atl_boss_nagr", 0).setDepth(200).setName("v6");
    try { ws.dialoguing = false; ws.physics.world.resume(); } catch {}
  });
  await p.waitForTimeout(900);
  await p.screenshot({ path: "scripts/atlas_preview/ingame_clean2.png" });
  console.log("saved");
  await browser.close();
})();
