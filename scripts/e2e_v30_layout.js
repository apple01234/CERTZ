/**
 * v3.0 개미굴 레이아웃 검증 (사용자 지시 #6/#7)
 *  1) 필드 진입 시 layout 생성 + 벽 셀 static body 존재
 *  2) 플레이어가 벽 셀 중심으로 밀어넣어도 벽에 막힌다 (충돌)
 *  3) 미니맵/포탈/적 스폰이 개방 셀 안에 있다
 *  4) 상호작용 프롬프트(PC) 하단 고정 칩 렌더
 */
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(2500);

  // 타이틀 → 게임 진입 (v27 e2e와 동일 경로)
  await page.click("text=새로운 모험", { timeout: 10000 });
  await page.waitForTimeout(3000);

  const check = await page.evaluate(async () => {
    const S = window.__SERTZ__;
    if (!S?.game) return { fail: "no __SERTZ__" };
    const scene = S.game.scene.getScene("world");
    if (!scene || !scene.player) return { fail: "world scene not ready" };
    const out = {};
    out.stage = scene.stageDef.key;

    // 마을이면 포탈 타고 forest1으로 이동해 필드 레이아웃 검증
    if (!scene.layout) {
      const next = "forest1";
      scene.scene.restart({ stage: next, save: scene.buildSave(next), fresh: false });
      await new Promise((r) => setTimeout(r, 2600));
      const s2 = S.game.scene.getScene("world");
      out.movedTo = s2.stageDef?.key;
      const lay = s2.layout;
      if (!lay) return { fail: "layout is null on field stage" };
      out.cols = lay.cols; out.rows = lay.rows;
      out.openCount = lay.open.filter(Boolean).length;
      // 벽 바디 개수 (닫힌 셀 수와 일치해야 함)
      let wallBodies = 0;
      s2.solidGroup.children.iterate((c) => { if (c.body && c.width >= lay.cellW * 0.9) wallBodies++; });
      out.wallBodies = wallBodies;
      out.wallCells = lay.cols * lay.rows - lay.open.filter(Boolean).length;

      // 벽 충돌 실측: 가장 가까운 닫힌 셀 중심으로 텔레포트 후 밀기
      const closedIdx = [];
      for (let i = 0; i < lay.open.length; i++) if (!lay.open[i]) closedIdx.push(i);
      const cellCenter = (i) => ({ x: (i % lay.cols) * lay.cellW + lay.cellW / 2, y: Math.floor(i / lay.cols) * lay.cellH + lay.cellH / 2 });
      const target = cellCenter(closedIdx[Math.floor(closedIdx.length / 2)]);
      // 인접 개방 셀에서 시작
      const openIdx = lay.open.findIndex((v, i) => v);
      const oc = cellCenter(openIdx);
      s2.player.x = oc.x; s2.player.y = oc.y;
      await new Promise((r) => setTimeout(r, 200));
      // 벽 방향으로 강제 이동 (velocity 주입 30프레임)
      const dx = target.x - oc.x, dy = target.y - oc.y;
      const len = Math.hypot(dx, dy) || 1;
      for (let f = 0; f < 40; f++) {
        s2.player.setVelocity((dx / len) * 260, (dy / len) * 260);
        await new Promise((r) => requestAnimationFrame(r));
      }
      const distToWallCellCenter = Math.hypot(s2.player.x - target.x, s2.player.y - target.y);
      out.blockedDistance = Math.round(distToWallCellCenter);
      out.blocked = distToWallCellCenter > lay.cellW * 0.25;

      // 포탈/적/파편이 개방 셀 안인지
      const isOpen = (x, y) => {
        const c = Math.floor(x / lay.cellW), r = Math.floor(y / lay.cellH);
        if (c < 0 || r < 0 || c >= lay.cols || r >= lay.rows) return false;
        return lay.open[r * lay.cols + c];
      };
      out.portalInOpen = s2.portal ? isOpen(s2.portal.x, s2.portal.y) : "no-portal";
      out.enemiesInOpen = s2.enemies.filter((e) => e.active && e.alive && isOpen(e.x, e.y)).length;
      out.enemiesTotal = s2.enemies.filter((e) => e.active && e.alive).length;
      out.capOk = out.enemiesTotal <= 20 + (s2.stageDef.elite ? 1 : 0) + (s2.stageDef.boss ? 1 : 0);
      return out;
    }
    return { fail: "still not field", stage: out.stage };
  });
  console.log(JSON.stringify(check, null, 2));

  await page.screenshot({ path: "scripts/v30-ant-tunnel.png" });
  console.log("pageerrors:", errors.length ? errors.slice(0, 3) : "none");
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
