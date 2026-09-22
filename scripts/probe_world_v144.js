const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errs = [], cons = [];
  p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 400)));
  p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") cons.push(m.type() + ": " + m.text().slice(0, 200)); });
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
  for (let i = 0; i < 40; i++) {
    await p.waitForTimeout(1000);
    const st = await p.evaluate(() => {
      const sc = window.__SERTZ__?.game?.scene?.getScene("world");
      if (!sc) return "no-scene";
      return `player=${!!sc.player} stageDef=${!!sc.stageDef} dialoguing=${!!sc.dialoguing} boot=${sc.scene?.settings?.status}`;
    }).catch(() => "eval-err");
    console.log(`[${i}s] ${st} ${errs.length ? "ERRS:" + errs.slice(-1)[0] : ""}`);
    if (st.includes("player=true")) break;
  }
  console.log("ALL errs:", errs.join(" || ") || "0");
  console.log("CONS:", cons.slice(0, 6).join(" || ") || "0");
  await p.screenshot({ path: "/tmp/probe_world.png" });
  await b.close();
})().catch(e => { console.error("FAIL", e.message); process.exit(1); });
