/**
 * 부팅 로딩 실측 — 타이틀까지 몇 개 에셋을 몇 초에 걸쳐 받는지, 실패는 몇 건인지.
 * 성능 기획의 근거 수치를 얻기 위한 읽기 전용 계측기.
 */
const { chromium } = require("playwright");

(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const p = await b.newPage({ viewport: { width: 900, height: 640 } });

  const reqs = [];
  const fails = [];
  let bytes = 0;
  const t0 = Date.now();

  p.on("response", async (r) => {
    const u = r.url();
    if (!/\/assets\//.test(u)) return;
    let len = 0;
    try { len = Number(r.headers()["content-length"] || 0); } catch {}
    bytes += len;
    reqs.push({ u: u.split("/assets/")[1], s: r.status(), len });
  });
  p.on("requestfailed", (r) => {
    if (/\/assets\//.test(r.url())) fails.push(r.url().split("/assets/")[1]);
  });

  await p.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded", timeout: 90000 });

  /* 타이틀 도달까지 대기 (Phaser 부팅 완료 신호 = 게임 인스턴스 존재) */
  let bootMs = -1;
  for (let i = 0; i < 60; i++) {
    await p.waitForTimeout(500);
    const ok = await p.evaluate(() => !!(window.Phaser && window.Phaser.GAMES && window.Phaser.GAMES.length));
    if (ok) { bootMs = Date.now() - t0; break; }
  }

  /* Phaser 로더가 실제로 몇 개를 성공/실패로 기록했는지 */
  const loader = await p.evaluate(() => {
    const g = window.Phaser && window.Phaser.GAMES && window.Phaser.GAMES[0];
    if (!g) return null;
    const bs = g.scene.getScene("boot") || g.scene.getScenes(false).find((s) => s.scene.key === "boot");
    if (!bs || !bs.load) return { note: "boot 씬 접근 불가" };
    return {
      total: bs.load.totalToLoad,
      complete: bs.load.totalComplete,
      failed: bs.load.totalFailed,
      progress: Number((bs.load.progress || 0).toFixed(3)),
    };
  });

  const byStatus = {};
  for (const r of reqs) byStatus[r.s] = (byStatus[r.s] || 0) + 1;

  console.log(JSON.stringify({
    bootMs,
    assetRequests: reqs.length,
    statusCounts: byStatus,
    failedRequests: fails.length,
    failedSample: fails.slice(0, 12),
    totalMB: Number((bytes / 1048576).toFixed(1)),
    phaserLoader: loader,
  }, null, 2));

  await b.close();
})();
