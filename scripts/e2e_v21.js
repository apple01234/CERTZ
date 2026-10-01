/* v2.1 통합 E2E (v2) — 서로 다른 브라우저 인스턴스 2개 = 실제 두 대의 기기 재현
 *  ①상호 시야(하트비트 복구) ②파티 ③친구(코드 추가→온라인) ④NPC 프롬프트 앵커 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");

const PORT = 3105;
const URL = `http://localhost:${PORT}`;
const shot = (n) => `/home/z/my-project/scripts/v21-${n}.png`;

async function enterWorld(page) {
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("text=새로운 모험", { timeout: 30000 });
  await page.click("text=새로운 모험");
  for (let i = 0; i < 30; i++) {
    const inWorld = await page.evaluate(() => {
      const g = window.__SERTZ__?.game;
      return !!(g && g.scene.getScene("world") && g.scene.getScene("world").player);
    });
    if (inWorld) break;
    await page.mouse.click(640, 400);
    await page.keyboard.press("e");
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(1600); // netJoin(650ms) + 첫 브로드캐스트
}

async function remotes(page) {
  return page.evaluate(() => window.__SERTZ__?.game?.scene.getScene("world")?.remotes?.size ?? -1);
}

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: "/home/z/my-project", env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  let up = false;
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) { up = true; break; } } catch {}
  }
  if (!up) { srv.kill(); console.error("서버 기동 실패"); process.exit(1); }
  console.log(`자식 서버 기동 (:${PORT})`);

  try {
    // 실제 두 대의 기기처럼 브라우저를 분리 — 각자 포그라운드 rAF 보장
    const browserA = await chromium.launch();
    const browserB = await chromium.launch();
    const A = await (await browserA.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
    const B = await (await browserB.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
    A.on("console", (m) => { const t = m.text(); if (t.includes("[net]")) console.log("A:", t); });
    B.on("console", (m) => { const t = m.text(); if (t.includes("[net]")) console.log("B:", t); });

    console.log("[1] 두 기기 진입");
    await enterWorld(A);
    await enterWorld(B);
    await A.waitForTimeout(4500); // 하트비트 2회 대기 — 가만히 서 있는 상태
    const ra = await remotes(A);
    const rb = await remotes(B);
    console.log(`상호 시야 — A sees ${ra}, B sees ${rb}`);
    await A.screenshot({ path: shot("1-mutual") });
    await B.screenshot({ path: shot("2-mutual-b") });

    console.log("[2] 파티 — A 창설 → B 참여");
    await A.click('[aria-label="파티 열기 (Y)"]');
    await A.click("text=파티 창설");
    await A.waitForTimeout(1000);
    const t = await A.evaluate(() => document.body.innerText);
    const code = (t.match(/파티 코드\s*([A-Z0-9]+)/) || [])[1] || "P1";
    await B.click('[aria-label="파티 열기 (Y)"]');
    await B.fill('[aria-label="파티 코드"]', code);
    await B.click("text=참여");
    await B.waitForTimeout(1200);
    const aTxt = await A.evaluate(() => document.body.innerText);
    const bTxt = await B.evaluate(() => document.body.innerText);
    const aMem = (aTxt.match(/Lv\.\d+/g) || []).length;
    const bMem = (bTxt.match(/Lv\.\d+/g) || []).length;
    console.log(`파티 ${code} — A 멤버:${aMem} B 멤버:${bMem}`);
    await A.screenshot({ path: shot("3-party") });

    console.log("[3] 친구 — B 코드 → A 추가 → 온라인 확인");
    await B.click('[aria-label="친구 열기 (F)"]');
    await B.waitForTimeout(300);
    const bWidget = await B.evaluate(() => document.body.innerText);
    const bCode = (bWidget.match(/내 코드\s*([A-Z0-9]{4,12})/) || [])[1];
    console.log("B 친구코드:", bCode);
    await B.screenshot({ path: shot("4-mycode") });
    await A.click('[aria-label="친구 열기 (F)"]');
    await A.fill('[aria-label="친구 코드"]', bCode);
    await A.click("text=추가");
    await A.waitForTimeout(2800); // 친구 하트비트 대기
    const aFriendTxt = await A.evaluate(() => document.body.innerText);
    const friendOnline = aFriendTxt.includes("이동");
    console.log("A 친구창 온라인 표시(이동 버튼):", friendOnline);
    await A.screenshot({ path: shot("5-friend-online") });

    console.log("[4] NPC 프롬프트 앵커");
    const npc = await A.evaluate(() => {
      const w = window.__SERTZ__?.game?.scene.getScene("world");
      const it = w?.interactables?.[0];
      if (!it || !w?.player) return null;
      w.player.setPosition(it.x - 60, it.y + 10);
      return { x: it.x, y: it.y, label: it.label };
    });
    await A.waitForTimeout(900);
    const prompt = await A.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      const p = btns.find((b) => b.querySelector("span")?.textContent === "E" && b.style.left);
      return p ? { left: p.style.left, top: p.style.top } : null;
    });
    console.log("NPC:", JSON.stringify(npc), "프롬프트:", JSON.stringify(prompt));
    await A.screenshot({ path: shot("6-prompt-anchor") });

    await browserA.close();
    await browserB.close();
    const pass = ra >= 1 && rb >= 1 && aMem >= 2 && bMem >= 2 && !!bCode && friendOnline && !!prompt;
    console.log(pass ? "ALL PASS" : "SOME FAIL");
    srv.kill();
    process.exit(pass ? 0 : 1);
  } catch (e) {
    srv.kill();
    throw e;
  }
})().catch((e) => { console.error("E2E FAIL:", e.message); process.exit(1); });
