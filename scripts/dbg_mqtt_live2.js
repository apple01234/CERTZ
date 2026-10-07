/**
 * 라이브 2페이지 + 스니퍼 통합 진단 — A→B 수신 실패 비대칭의 원인 특정
 *  · 스니퍼: pid별 presence/hi/st 수신 타임라인 기록
 *  · 두 페이지 부팅 → 서로 보이는지 + 부 커 내부 상태 덤프 (debugState 훅)
 */
const { chromium } = require("playwright");
const mqtt = require("mqtt");

const CHROME = "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome";
const BASE = "https://sertz.vercel.app";

(async () => {
  /* 스니퍼 — pid별 카운트 */
  const sn = mqtt.connect("wss://broker.emqx.io:8084/mqtt", { clientId: "sz_diag2_" + Date.now().toString(36), protocolVersion: 4, connectTimeout: 8000 });
  const counts = {};
  sn.on("connect", () => sn.subscribe("sertz/mp/v2/#"));
  sn.on("message", (t, p) => {
    try {
      const m = JSON.parse(p.toString());
      const pid = String(m.pid || "?").slice(-8);
      counts[pid] = counts[pid] || { pr: 0, hi: 0, st: 0, last: 0 };
      if (m.k === "pr") counts[pid].pr++;
      if (m.k === "hi") counts[pid].hi++;
      if (m.k === "st") counts[pid].st++;
      counts[pid].last = Date.now();
    } catch {}
  });

  async function boot(browser, name, tag) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await ctx.addInitScript((nm) => {
      try {
        window.localStorage.setItem("sertz_save_v2", JSON.stringify({
          stage: "village", lv: 12, exp: 0, maxHp: 180, atk: 24, cleared: true,
          maxMp: 70, playerName: nm, gold: 500, potions: { hp: 5, mp: 5 },
          introSeen: true, tutorialDone: true, tutStep: 99, seen: ["prologue", "intro", "village_intro"], questIdx: {},
        }));
      } catch {}
    }, name);
    const p = await ctx.newPage();
    await p.goto(BASE, { waitUntil: "domcontentloaded", timeout: 40000 });
    await p.waitForTimeout(2000);
    await p.waitForSelector("text=게임 시작", { timeout: 30000 });
    await p.getByRole("button", { name: /게임 시작/ }).first().click();
    await p.waitForTimeout(900);
    await p.evaluate(() => {
      const t = [...document.querySelectorAll("button")].find((x) => /이 캐릭터로 시작/.test(x.textContent || ""));
      if (t) t.click();
    });
    await p.waitForTimeout(3500);
    for (let i = 0; i < 25; i++) {
      const ok = await p.evaluate(() => !!window.__SERTZ_SCENE__?.player).catch(() => false);
      if (ok) break;
      await p.waitForTimeout(1000);
    }
    for (let i = 0; i < 15 && await p.evaluate(() => !!window.__SERTZ_SCENE__?.dialoguing).catch(() => true); i++) {
      await p.keyboard.press("Enter");
      await p.waitForTimeout(600);
    }
    console.log(`[${tag}] 부팅 완료`);
    return { ctx, p };
  }

  const b = await chromium.launch({ executablePath: CHROME, args: ["--use-gl=swiftshader", "--no-sandbox"] });
  const A = await boot(b, "멀티에이", "A");
  await A.p.waitForTimeout(10000);

  const dumpA = async (label) => {
    const d = await A.p.evaluate(() => {
      const dbg = window.__SERTZ_MQTT__;
      const s = window.__SERTZ_SCENE__;
      return dbg ? {
        connected: dbg.connected, broker: dbg.broker, pid: dbg.pid,
        stage: dbg.stage, subStage: dbg.subStage, presenceSub: dbg.presenceSub,
        peers: Object.keys(dbg.peers || {}).length, friends: Object.keys(dbg.friends || {}).length,
        remotes: s?.remotes ? s.remotes.size : -1,
        dialoguing: !!s?.dialoguing, hasPlayer: !!s?.player,
      } : { dbg: "no hook" };
    });
    console.log(`[A덤프 ${label}]`, JSON.stringify(d));
    return d;
  };

  await dumpA("부팅후");
  const B = await boot(b, "멀티비", "B");
  await B.p.waitForTimeout(10000);

  /* B 시점에서 서로 보임 확인 */
  const bRem = await B.p.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    return s?.remotes ? [...s.remotes.values()].map((r) => r.name) : [];
  });
  console.log("[B] remotes:", JSON.stringify(bRem));
  await dumpA("B부팅10초후");

  await A.p.waitForTimeout(15000);
  await dumpA("15초추가경과");
  console.log("[스니퍼 카운트]", JSON.stringify(counts, null, 1));

  await A.ctx.close(); await B.ctx.close();
  await b.close();
  sn.end(true);
  process.exit(0);
})();
