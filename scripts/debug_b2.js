/* B2 디버그 — 파편 소실 보루가 왜 재생성 안 하는지 실측 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const PORT = 3111;
const URL = `http://localhost:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: process.cwd(), env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) { await sleep(500); try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) break; } catch {} }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 300)));
  page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE-ERR:", m.text().slice(0, 200)); });

  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("text=새로운 모험", { timeout: 60000 });
  await page.click("text=새로운 모험");
  for (let i = 0; i < 40; i++) {
    const inWorld = await page.evaluate(() => !!(window.__SERTZ__?.game?.scene.getScene("world")?.player));
    if (inWorld) break;
    await page.mouse.click(640, 400); await page.keyboard.press("e"); await sleep(400);
  }
  await sleep(900);
  await page.evaluate(() => { window.__SERTZ__.game.scene.getScene("world").finishIntro("테스터"); });
  await sleep(300);
  for (let i = 0; i < 6; i++) { await page.keyboard.press("Space"); await sleep(180); }
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.dialoguing = false; w.introStep = -1;
  });

  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    // 프로토타입 래핑 — 새 씬 인스턴스의 activatePortal 호출 스택 추적
    const proto = Object.getPrototypeOf(w);
    const orig = proto.activatePortal;
    window.__apCalls = [];
    proto.activatePortal = function (...a) {
      window.__apCalls.push({ t: performance.now() | 0, stack: String(new Error().stack).split("\n").slice(1, 5).join(" | ") });
      return orig.apply(this, a);
    };
    const origSpawn = proto.spawnPortal;
    window.__spCalls = [];
    proto.spawnPortal = function (...a) {
      window.__spCalls.push({ t: performance.now() | 0, stack: String(new Error().stack).split("\n").slice(1, 5).join(" | ") });
      return origSpawn.apply(this, a);
    };
  });

  await page.evaluate(([st, p]) => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const carry = w.buildSave(st);
    Object.assign(carry, p);
    w.scene.restart({ stage: st, save: carry });
  }, ["kingdom2", { lv: 12, questIdx: { kingdom2: 0 }, seen: [] }]);
  await sleep(2200);
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.dialoguing = false; w.introStep = -1;
  });

  const dump = async (tag) => {
    const r = await page.evaluate((t) => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const q = w.currentQuest();
      return `[${t}] q=${q ? q.type : "null"} fragment=${!!w.fragment} portalActive=${w.portalActive} idx=${w.questIdx}/${w.stageDef.quests.length} apCalls=${JSON.stringify(window.__apCalls ?? []).slice(0, 900)}`;
    }, tag);
    console.log(r);
  };

  await dump("초기");
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.fragment?.destroy();
    w.fragment = null;
    const evs = (w.time._events ?? []).filter((e) => e.loop && e.delay === 1500);
    console.log("보루 타이머 수:", evs.length);
  });
  let last = 0;
  for (const t of [1000, 2000, 3200]) {
    await sleep(t - last); last = t;
    await dump(`${t}ms`);
  }
  await browser.close();
  srv.kill();
  process.exit(0);
})();
