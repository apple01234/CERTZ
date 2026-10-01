const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const cdp = await p.context().newCDPSession(p);
  await cdp.send("Debugger.enable");
  const scripts = {};
  cdp.on("Debugger.scriptParsed", (ev) => { scripts[ev.scriptId] = ev.url || "(no-url):" + ev.scriptId; });
  let stackDumped = false;
  cdp.on("Debugger.paused", async (ev) => {
    if (stackDumped) { await cdp.send("Debugger.resume"); return; }
    stackDumped = true;
    console.log("=== PAUSED — top frames ===");
    for (const f of ev.callFrames.slice(0, 12)) {
      const sid = f.location.scriptId;
      console.log(`${f.functionName || "(anon)"} @ script#${sid}(${(scripts[sid] || "?").split("/").pop()}):${f.location.lineNumber}:${f.location.columnNumber}`);
    }
    await cdp.send("Debugger.resume").catch(() => {});
  });
  p.on("pageerror", (e) => console.log("PAGEERROR:", e.message.slice(0, 300)));
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2600);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1200);
  await p.evaluate(() => Array.from(document.querySelectorAll("button")).find(x => x.textContent?.includes("캐릭터 생성"))?.click());
  await p.waitForTimeout(700);
  await p.locator("input").first().fill("세라144");
  await p.waitForTimeout(300);
  for (const label of ["직업 선택", "외형 선택"]) {
    await p.evaluate((lb) => Array.from(document.querySelectorAll("button")).find(x => x.textContent?.includes(lb))?.click(), label);
    await p.waitForTimeout(400);
  }
  await p.evaluate(() => Array.from(document.querySelectorAll("button")).find(x => x.textContent?.includes("생성!"))?.click());
  await p.waitForTimeout(1400);
  await p.evaluate(() => { document.querySelector(".cursor-pointer")?.click(); });
  await p.waitForTimeout(400);
  await p.evaluate(() => Array.from(document.querySelectorAll("button")).find(x => x.textContent?.includes("이 캐릭터로 시작"))?.click());
  console.log("world start clicked — polling with stack sampling");
  for (let i = 0; i < 30; i++) {
    await p.waitForTimeout(1000);
    // 페이지 응답성 검사 — 800ms 안에 안 오면 메인 스레드 정지로 판정
    let resp = "no";
    for (let t = 0; t < 8; t++) {
      resp = await Promise.race([
        p.evaluate(() => "yes").catch(() => "err"),
        new Promise((r) => setTimeout(() => r("STUCK"), 800)),
      ]);
      if (resp !== "STUCK") break;
      await cdp.send("Debugger.pause").catch(() => {});
      await p.waitForTimeout(120);
    }
    console.log(`[${i}s] responsive=${resp}${resp === "STUCK" ? " — stack sampled above" : ""}`);
    if (resp === "yes") {
      const ok2 = await p.evaluate(() => {
        const sc = window.__SERTZ__?.game?.scene?.getScene("world");
        return `player=${!!sc?.player} stageDef=${!!sc?.stageDef}`;
      });
      console.log(`   ${ok2}`);
      if (ok2.includes("player=true")) break;
    }
  }
  await b.close();
})().catch(e => { console.error("FAIL", e.message); process.exit(1); });
