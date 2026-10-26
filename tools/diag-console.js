const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const p = await b.newPage({ viewport: { width: 900, height: 640 } });
  const logs = [];
  p.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
  p.on("pageerror", (e) => logs.push("PAGEERROR: " + (e.stack || e.message)));
  p.on("requestfailed", (r) => logs.push(`REQFAIL ${r.url()} ${r.failure() && r.failure().errorText}`));

  await p.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(12000);

  const shot = await p.evaluate(() => {
    const root = document.getElementById("__next") || document.body;
    return {
      rootChildren: root.children.length,
      htmlLen: document.documentElement.innerHTML.length,
      bodyLen: document.body.innerHTML.length,
      canvasCount: document.querySelectorAll("canvas").length,
      hasNextData: !!document.getElementById("__NEXT_DATA__"),
      scripts: [...document.querySelectorAll("script[src]")].map((s) => s.src).slice(0, 8),
    };
  });

  await p.screenshot({ path: "/tmp/npc-shot.png", fullPage: false });
  console.log(JSON.stringify({ shot, logs: logs.slice(0, 40) }, null, 2));
  await b.close();
})();
