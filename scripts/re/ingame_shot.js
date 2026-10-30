/**
 * ingame_shot.js — 실제 게임 화면을 캡처해 타일과 스킬 버튼 레이아웃을 검증 (vc206)
 *
 * 실행: URL=http://127.0.0.1:3045 node scripts/re/ingame_shot.js
 *
 * 검증 항목
 *   ① 지면 타일이 "종이 쪼가리"가 아닌지 — 캡처 후 별도 픽셀 계측
 *   ② 스킬 버튼: 아이콘 아래 스킬명이 잘리지 않고 보이는지
 *   ③ 궁극기(10시 방향) 버튼의 단축키 탭이 표시되는지
 *   ④ pageerror 0
 */
const { chromium } = require("playwright");
const CHROME = "/root/.cache/ms-playwright/chromium-1234/chrome-linux/chrome";
const URL = process.env.URL || "http://127.0.0.1:3045";
const OUT = "/root/.hermes/cache/scratch";

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));

  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(7000);

  /* 타이틀은 **React DOM 오버레이**다(Phaser 씬이 아님). 딤 처리도 DOM 이라
   *  씬을 stop 해도 화면이 그대로 덮인다. 실제 "게임 시작" 버튼을 눌러야 인게임이 된다. */
  /* 타이틀 UI 는 Phaser 캔버스 안에 그려져 DOM button 이 없다.
   *  beginWorld 는 지연 로더 완료를 8초까지 기다리므로, 검증용으로는
   *  씬을 직접 교체해 인게임 화면을 즉시 얻는다. */
  const entered = await page.evaluate(() => {
    const g = window.__SERTZ__?.game;
    if (!g) return "no-game";
    try {
      g.scene.start("world", { stage: "village", fresh: true });
      return "started";
    } catch (e) { return String(e).slice(0, 120); }
  });
  console.log("진입:", entered);
  await page.waitForTimeout(12000);

  /* scene.stop("title") 만으로는 타이틀 GameObjects 가 캔버스에 남는다(캡처로 확인).
   *  검증 화면을 위해 남은 오브젝트를 강제로 destroy 하고, 카메라를 맵 개활지로 옮긴다. */
  await page.evaluate(() => {
    const g = window.__SERTZ__?.game;
    const t = g?.scene.getScene("title");
    if (t?.children?.list) {
      t.children.list.slice().forEach((o) => { try { o.destroy(); } catch {} });
    }
    try { g.scene.stop("title"); } catch {}
    const w = g?.scene.getScene("world");
    if (w?.cameras?.main) {
      const cx = (w.stageW ?? 2000) / 2;
      const cy = (w.stageH ?? 1200) / 2;
      try { w.cameras.main.centerOn(cx, cy); } catch {}
    }
  });
  await page.waitForTimeout(2000);

  /* beginWorld 는 scene.start("world") 로 타이틀을 대체해야 하는데, 실제로는 타이틀이
   *  살아남아 화면을 덮는다(캡처로 확인). 월드만 남기고 타이틀/오버레이를 정지시킨다. */
  await page.evaluate(() => {
    const g = window.__SERTZ__?.game;
    if (!g) return;
    try { g.scene.stop("title"); } catch {}
    try { g.scene.getScenes(true).forEach((s) => { if (s.scene.key !== "world") g.scene.stop(s.scene.key); }); } catch {}
    const w = g.scene.getScene("world");
    if (w) { try { w.scene.bringToTop?.(); } catch {} }
  });
  await page.waitForTimeout(2500);

  const state = await page.evaluate(() => {
    const g = window.__SERTZ__?.game;
    const w = g?.scene.getScene("world");
    return {
      scenes: g?.scene.getScenes(true).map((s) => s.scene.key) ?? [],
      hasPlayer: !!w?.player,
      groundTs: w?.groundTs ? 1 : 0,
      tileKeys: g?.textures ? Object.keys(g.textures.list).filter((k) => k.startsWith("tile_")).slice(0, 12) : [],
    };
  });
  console.log("씬:", JSON.stringify(state));

  /* 타이틀은 React DOM 오버레이가 캔버스를 덮고 있다(probe: DOM 에 그려짐).
   *  월드 화면만 보려면 **canvas 요소 자체**를 캡처해야 한다. */
  const cv = await page.$("canvas");
  if (cv) {
    await cv.screenshot({ path: `${OUT}/shot_canvas.png` });
    console.log("canvas 캡처 완료");
  }
  // 오버레이 제거 후 전체 캡처
  await page.evaluate(() => {
    [...document.querySelectorAll("div")].forEach((d) => {
      const st = getComputedStyle(d);
      if (st.position === "fixed" && st.zIndex && Number(st.zIndex) > 10) d.style.display = "none";
    });
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/shot_world.png` });

  // 스킬 버튼 영역만 확대 캡처 (우하단)
  const vp = page.viewportSize();
  await page.screenshot({
    path: `${OUT}/shot_skills.png`,
    clip: { x: vp.width * 0.55, y: vp.height * 0.55, width: vp.width * 0.45, height: vp.height * 0.45 },
  });

  // DOM 에서 스킬명 라벨 확인 — 버튼 밖(아래)에 있는지
  const labels = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button[aria-label]")];
    return btns.slice(0, 12).map((b) => {
      const r = b.getBoundingClientRect();
      const wrap = b.parentElement;
      const sib = wrap ? [...wrap.children].filter((c) => c !== b) : [];
      const hasLabelOutside = sib.some((c) => c.tagName === "SPAN" && c.textContent?.trim());
      return {
        label: b.getAttribute("aria-label"),
        w: Math.round(r.width),
        h: Math.round(r.height),
        labelOutside: hasLabelOutside,
      };
    });
  });
  console.log("버튼:", JSON.stringify(labels, null, 0).slice(0, 900));
  console.log("pageerror:", errors.length, errors.slice(0, 3));

  await browser.close();
})();
