// 전투 중 프레임 스파이크 실측: 스킬 난사 + 적 다수 상황
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
    const i = await page.$("input[placeholder*='캐릭터 이름']"); if (i) await i.fill("프레임검증");
    await page.waitForTimeout(900); await click(/^다음/); await page.waitForTimeout(1200);
    await click(/모험가로 생성/); await page.waitForTimeout(4000); ok = await click(/이 캐릭터로 시작/); }
  await wait(["world"], 60000); await page.waitForTimeout(5000);

  const prof = await page.evaluate(async () => {
    const D = window.__SERTZ_DEBUG__;
    const sc = D.game.scene.getScenes(true).find(s => s && s.player);
    sc.tut = null; sc.dialoguing = false; sc.tutorialDone = true;
    const EB = window.__SERTZ_EB__;

    const deltas = [];
    let last = performance.now();
    const t0 = performance.now();
    let atk = 0, sk = 0;
    await new Promise((res) => {
      const tick = () => {
        const now = performance.now();
        deltas.push(now - last); last = now;
        // 60ms마다 공격, 200ms마다 스킬 (전투 부하 재현)
        if (now - t0 > 80) {
          if ((deltas.length % 4) === 0) { EB.emit("input:attack"); atk++; }
          if ((deltas.length % 12) === 0) { EB.emit("input:skill1"); sk++; }
        }
        if (now - t0 > 12000) return res();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    deltas.sort((a, b) => a - b);
    const p = (q) => deltas[Math.min(deltas.length-1, Math.floor(deltas.length*q))];
    const mean = deltas.reduce((a,b)=>a+b,0)/deltas.length;
    const spikes = deltas.filter(d => d > 50);
    return {
      attacks: atk, skills: sk, frames: deltas.length,
      fps: +(1000/mean).toFixed(1), mean: +mean.toFixed(2),
      p50: +p(0.5).toFixed(1), p95: +p(0.95).toFixed(1), p99: +p(0.99).toFixed(1),
      max: +deltas[deltas.length-1].toFixed(1),
      spikes50: spikes.length,
      spikeList: spikes.slice(0, 10).map(d => Math.round(d)),
      perf: window.__SERTZ_PERF__ ?? null,
      objects: sc.children.list.length,
      enemies: sc.enemies.filter(e => e.active && e.alive).length,
    };
  });
  console.log(JSON.stringify(prof, null, 1));
  await b.close();
})();
