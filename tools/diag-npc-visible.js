/**
 * NPC 표시 여부 실측 — 마을에 진입해 씹덕 NPC / 주민이 화면에 실제로 그려지는지 확인한다.
 *
 * 배경: 사용자 리포트 "Npc안보임". 코드상 텍스처·BootScene 등록·interactables 등록은
 *       전부 정상이라 정적 분석으로는 원인을 못 찾았다. 실제 캔버스에 그려졌는지
 *       Phaser 씬 객체를 직접 조회해 판정한다.
 *
 * 측정 항목
 *   ① 마을 스테이지 진입 성공 여부
 *   ② 씹덕 NPC(npc_*) 이미지 개수와 visible/alpha/depth
 *   ③ 주민(spum_*) 이미지 개수
 *   ④ 카메라 뷰포트 안에 들어오는지 (화면 밖이면 "안 보임"으로 체감된다)
 */
const { chromium } = require("playwright");

const URL = process.env.URL || "http://127.0.0.1:3000/";

(async () => {
  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 640 } });

  const logs = [];
  page.on("console", (m) => logs.push(m.text()));
  page.on("pageerror", (e) => logs.push("PAGEERROR: " + e.message));

  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });

  /* 캐릭터 생성 → 시작 (기존 측정 스크립트와 동일 흐름) */
  const fillAndStart = async () => {
    try {
      await page.waitForSelector('input[type="text"]', { timeout: 30000 });
      const inp = await page.$('input[type="text"]');
      await inp.fill("npcprobe");
      const next = await page.$x
        ? null
        : null;
      /* '다음' 버튼 — 텍스트로 찾는다 */
      const clickText = async (txt) => {
        const h = await page.evaluateHandle((t) => {
          const els = [...document.querySelectorAll("button")];
          return els.find((e) => (e.textContent || "").includes(t)) || null;
        }, txt);
        const el = h.asElement();
        if (el) { await el.click(); return true; }
        return false;
      };
      await clickText("다음");
      await page.waitForTimeout(700);
      await clickText("다음");
      await page.waitForTimeout(700);
      await clickText("생성");
      await page.waitForTimeout(1200);
      await clickText("시작");
      return true;
    } catch (e) {
      return false;
    }
  };
  const made = await fillAndStart();

  /* 월드 씬 진입 대기 */
  let inWorld = false;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(1000);
    inWorld = await page.evaluate(() => {
      const g = window.Phaser && window.__SERTZ_GAME__;
      const game = g || (window.Phaser && window.Phaser.GAMES && window.Phaser.GAMES[0]);
      if (!game) return false;
      const sc = game.scene.getScenes(true);
      return sc.some((s) => s.scene.key === "world");
    });
    if (inWorld) break;
  }

  /* 씬 내부 이미지 조사 — Phaser 표시 목록을 직접 훑는다 */
  const probe = await page.evaluate(() => {
    const games = [];
    if (window.__SERTZ_GAME__) games.push(window.__SERTZ_GAME__);
    if (window.Phaser && window.Phaser.GAMES) games.push(...window.Phaser.GAMES);
    const out = { gameFound: games.length > 0, scenes: [], images: [], interactables: 0 };
    for (const g of games) {
      const list = g.scene.getScenes(true);
      for (const s of list) {
        out.scenes.push(s.scene.key);
        if (s.scene.key !== "world") continue;
        const cam = s.cameras.main;
        const kids = s.children ? s.children.list : [];
        for (const k of kids) {
          if (k.type !== "Image" && k.type !== "Sprite") continue;
          const tex = k.texture && k.texture.key ? k.texture.key : "?";
          if (!/^(npc_|spum_)/.test(tex)) continue;
          const vx = k.x - cam.scrollX;
          const vy = k.y - cam.scrollY;
          out.images.push({
            tex,
            x: Math.round(k.x),
            y: Math.round(k.y),
            vx: Math.round(vx),
            vy: Math.round(vy),
            onScreen: vx > -60 && vx < cam.width + 60 && vy > -80 && vy < cam.height + 80,
            visible: k.visible,
            alpha: Number(k.alpha.toFixed(2)),
            depth: k.depth,
            scale: Number((k.scaleX || 1).toFixed(2)),
          });
        }
        if (Array.isArray(s.interactables)) out.interactables = s.interactables.length;
        out.stageKey = s.stageDef && s.stageDef.key;
        out.isVillage = !!(s.stageDef && s.stageDef.isVillage);
        out.camW = cam.width; out.camH = cam.height;
        out.scrollX = Math.round(cam.scrollX); out.scrollY = Math.round(cam.scrollY);
      }
    }
    return out;
  });

  const npcDark = probe.images.filter((i) => i.tex.startsWith("npc_"));
  const spum = probe.images.filter((i) => i.tex.startsWith("spum_"));
  const onScreenAll = probe.images.filter((i) => i.onScreen && i.visible && i.alpha > 0.05);

  console.log(JSON.stringify({
    madeCharacter: made,
    inWorld,
    gameFound: probe.gameFound,
    scenes: probe.scenes,
    stageKey: probe.stageKey,
    isVillage: probe.isVillage,
    cam: { w: probe.camW, h: probe.camH, scrollX: probe.scrollX, scrollY: probe.scrollY },
    interactables: probe.interactables,
    npcCount: npcDark.length,
    spumCount: spum.length,
    onScreenCount: onScreenAll.length,
    images: probe.images,
    errors: logs.filter((l) => /error|Error|PAGEERROR/.test(l)).slice(0, 10),
  }, null, 2));

  await browser.close();
})();
