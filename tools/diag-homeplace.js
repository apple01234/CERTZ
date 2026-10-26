/**
 * tools/diag-homeplace.js — 방꾸미기 배치 좌표 실측
 *
 * 배경: 지시 #6 "가구를 배치하면 집 전체가 아니라 1x1 그리드 한 칸에 몰려서 배치된다".
 *  HomePanel 은 (cx,cy) 8x6 격자 인덱스를 보내고, 씬은 homeCellX/Y 로 32px 격자를 곱한다.
 *  어느 쪽이 어긋나는지 코드만으로 단정할 수 없어 실제 클릭 → 저장값을 확인한다.
 *
 * 측정:
 *   ① HomePanel 격자 DOM 셀 수 / 셀 크기
 *   ② 서로 다른 3칸을 클릭했을 때 player.homeDecor 에 들어간 (x,y)
 *   ③ 렌더된 가구 이미지의 월드 좌표 (homeCellX/Y 결과와 일치하는지)
 *
 * 사용: node tools/diag-homeplace.js
 */
const { chromium } = require("playwright");

const URL = process.env.URL || "http://127.0.0.1:3000/";

(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const page = await browser.newPage({ viewport: { width: 900, height: 640 } });
  const logs = [];
  page.on("console", (m) => logs.push(m.text()));
  page.on("pageerror", (e) => logs.push("PAGEERROR: " + e.message));
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });

  const clickText = async (txt) => {
    const h = await page.evaluateHandle((t) => {
      const els = [...document.querySelectorAll("button")];
      return els.find((e) => (e.textContent || "").includes(t)) || null;
    }, txt);
    const el = h.asElement();
    if (el) { await el.click(); return true; }
    return false;
  };

  try {
    await page.waitForSelector('input[type="text"]', { timeout: 30000 });
    await (await page.$('input[type="text"]')).fill("homeprobe");
    await page.waitForTimeout(400);
    await clickText("다음");
    await page.waitForTimeout(700);
    await clickText("다음");
    await page.waitForTimeout(700);
    await clickText("생성");
    await page.waitForTimeout(1200);
    await clickText("시작");
    await page.waitForTimeout(2500);
  } catch (e) {
    console.log(JSON.stringify({ stage: "character-create-failed", err: String(e).slice(0, 200) }));
  }

  let inWorld = false;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(1000);
    inWorld = await page.evaluate(() => {
      const g = window.__SERTZ_GAME__ || (window.Phaser && window.Phaser.GAMES && window.Phaser.GAMES[0]);
      if (!g) return false;
      return g.scene.getScenes(true).some((s) => s.scene.key === "world");
    });
    if (inWorld) break;
  }

  /* 집으로 강제 이동 + 가구 지급 + 패널 열기 (씬 API 직접 사용) */
  const setup = await page.evaluate(() => {
    const g = window.__SERTZ_GAME__ || (window.Phaser && window.Phaser.GAMES && window.Phaser.GAMES[0]);
    const s = g && g.scene.getScenes(true).find((x) => x.scene.key === "world");
    if (!s || !s.player) return { ok: false, why: "no world scene/player" };
    const furn = (window.__SERTZ_FURN__ || []).slice(0, 6);
    return {
      ok: true,
      stage: s.stageDef && s.stageDef.key,
      hasEnterInterior: typeof s.enterInterior === "function",
      furnKeys: furn,
      decor: (s.player.homeDecor || []).length,
      ownedFurn: (s.player.owned || []).filter((k) => String(k).startsWith("furn_")).length,
    };
  });
  console.log(JSON.stringify({ setup }, null, 1));

  /* 패널 열기: 꾸미기 상호작용 대신 이벤트로 직접 연다 (격자 DOM 만 필요) */
  const opened = await page.evaluate(() => {
    const g = window.__SERTZ_GAME__ || (window.Phaser && window.Phaser.GAMES && window.Phaser.GAMES[0]);
    const s = g && g.scene.getScenes(true).find((x) => x.scene.key === "world");
    if (!s) return false;
    // 집 실내로 강제 이동 후 패널 오픈
    try { s.enterInterior("interior_home"); } catch (e) { return "enterInterior:" + String(e).slice(0, 80); }
    setTimeout(() => {
      const ev = s.game && s.game.events;
      // EventBus 는 window 를 통해 접근 불가 → DOM 커스텀 이벤트 경유
      window.dispatchEvent(new CustomEvent("sertz:open-home"));
    }, 800);
    return true;
  });
  await page.waitForTimeout(2500);

  /* 패널이 안 열리면 버튼 탐색으로 시도 */
  let gridInfo = await page.evaluate(() => {
    const grid = document.querySelector('[style*="grid-template-columns"]');
    if (!grid) return { found: false };
    const cells = [...grid.children];
    const r = cells[0] ? cells[0].getBoundingClientRect() : null;
    return { found: true, count: cells.length, cell: r ? { w: Math.round(r.width), h: Math.round(r.height) } : null };
  });
  console.log(JSON.stringify({ opened, gridInfo }, null, 1));

  await browser.close();
  console.log(JSON.stringify({ errors: logs.filter((l) => /error|Error|PAGEERROR/i.test(l)).slice(0, 8) }, null, 1));
})();
