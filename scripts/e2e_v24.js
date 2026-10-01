/* v2.4 E2E — 퀘스트 개편 + 이름 변경 검증
 *  [1] forest1 진입 시 레벨 게이트 퀘스트가 맨 앞에 활성 (Lv 3 달성!!)
 *  [2] 레벨업 순간 게이트 즉시 완료 → 다음 퀘스트(토벌)로 연쇄
 *  [3] 고레벨 이어하기 시 게이트 자동 스킵 (구세이브 호환)
 *  [4] 소프트락 수정 — 체인 완료 세이브로 이어하기 시 전진 포탈 활성
 *  [5] 각 챕터 진입/중간 게이트 존재 (kingdom4: Lv 10)
 *  [6] 옵션 패널 이름 변경 — NamePanel 공용 → 이름표/세이브 반영 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");

const PORT = 3110;
const URL = `http://localhost:${PORT}`;
let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log(`  PASS — ${label}`); } else { fail++; console.log(`  FAIL — ${label}`); } };

async function enterWorld(page) {
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("text=새로운 모험", { timeout: 60000 });
  await page.click("text=새로운 모험");
  for (let i = 0; i < 40; i++) {
    const inWorld = await page.evaluate(() => !!(window.__SERTZ__?.game?.scene.getScene("world")?.player));
    if (inWorld) break;
    await page.mouse.click(640, 400); await page.keyboard.press("e"); await page.waitForTimeout(400);
  }
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.finishIntro("테스터");
  });
  await page.waitForTimeout(400);
  for (let i = 0; i < 5; i++) { await page.keyboard.press("Space"); await page.waitForTimeout(260); }
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.dialoguing = false; w.introStep = -1; w.sleepPending = false;
  });
  await page.waitForTimeout(250);
}

/** 커스텀 세이브로 스테이지 재시작 (퀘스트 인덱스/레벨 조작) */
async function restartWith(page, stage, patch) {
  await page.evaluate(([st, p]) => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const carry = w.buildSave(st);
    Object.assign(carry, p);
    w.scene.restart({ stage: st, save: carry });
  }, [stage, patch]);
  await page.waitForTimeout(1800);
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.dialoguing = false; w.introStep = -1;
  });
  await page.waitForTimeout(300);
}

const questOf = (page) => page.evaluate(() => {
  const w = window.__SERTZ__.game.scene.getScene("world");
  const q = w.currentQuest();
  return q ? { type: q.type, title: q.title, need: q.need ?? null, idx: w.questIdx } : null;
});

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: process.cwd(), env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 500)); try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) break; } catch {} }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 200)));

  console.log("[1] forest1 진입 — 레벨 게이트 퀘스트가 체인 맨 앞");
  await enterWorld(page);
  await restartWith(page, "forest1", { lv: 1, questIdx: { forest1: 0 } });
  const q1 = await questOf(page);
  ok(q1?.type === "level", `forest1 첫 퀘스트 = level (실제: ${q1?.type})`);
  ok(q1?.need === 3 && /Lv 3/.test(q1?.title ?? ""), `게이트 목표 Lv 3 — "${q1?.title}"`);
  await page.screenshot({ path: "/home/z/my-project/scripts/v24-forest-gate.png" });

  console.log("[2] 레벨업 순간 — 게이트 즉시 완료 → 토벌 퀘스트 연쇄");
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.player.gainExp(400); // Lv 1 → 4 근처 — 목표 Lv 3 돌파
  });
  await page.waitForTimeout(500);
  const q2 = await questOf(page);
  ok(q2?.type === "hunt", `게이트 완료 후 토벌 퀘스트 활성 (실제: ${q2?.type} "${q2?.title}")`);
  const lvAfter = await page.evaluate(() => window.__SERTZ__.game.scene.getScene("world").player.lv);
  ok(lvAfter >= 3, `레벨 상승 확인 (Lv ${lvAfter})`);

  console.log("[3] 고레벨 이어하기 — 게이트 자동 스킵 (구세이브 호환)");
  await restartWith(page, "forest1", { lv: 10, questIdx: { forest1: 0 } });
  const q3 = await questOf(page);
  ok(q3?.type === "hunt", `Lv 10 로드 시 게이트 스킵 → 토벌 퀘스트 (실제: ${q3?.type} idx=${q3?.idx})`);

  console.log("[4] 소프트락 수정 — 체인 완료 이어하기 시 전진 포탈 활성");
  await restartWith(page, "forest1", { lv: 10, questIdx: { forest1: 2 } });
  const portal = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    return { active: w.portalActive, hasPortal: !!w.portal, tint: w.portal ? w.portal.tintTopLeft : -1 };
  });
  ok(portal.hasPortal && portal.active, `전진 포탈 활성 (active=${portal.active})`);
  await page.screenshot({ path: "/home/z/my-project/scripts/v24-portal-open.png" });

  console.log("[5] 챕터 중간 게이트 — kingdom4 (Lv 10 달성)");
  await restartWith(page, "kingdom4", { lv: 1, questIdx: { kingdom4: 0 } });
  const q5 = await questOf(page);
  ok(q5?.type === "level" && q5?.need === 10, `kingdom4 게이트 = Lv 10 (실제: ${q5?.type}:${q5?.need})`);

  console.log("[6] 옵션 패널 이름 변경 — NamePanel 공용 연동");
  await restartWith(page, "village", { lv: 3 });
  await page.evaluate(() => window.__SERTZ_EB__.emit("name:ask"));
  await page.waitForTimeout(400);
  const panelVisible = await page.evaluate(() => !!document.querySelector('input[maxlength="8"]'));
  ok(panelVisible, "이름 입력 패널 오픈");
  if (panelVisible) {
    await page.fill('input[maxlength="8"]', "세이라");
    await page.click("text=이 이름으로 모험 시작!");
    await page.waitForTimeout(500);
    const renamed = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      return {
        tag: w.playerNameTag ? w.playerNameTag.text : null,
        saved: JSON.parse(window.localStorage.getItem("sertz_save_v2") || "{}").playerName,
      };
    });
    ok(renamed.saved === "세이라", `세이브에 이름 반영 (${renamed.saved})`);
    ok((renamed.tag ?? "").includes("세이라"), `이름표 갱신 (${renamed.tag})`);
    await page.screenshot({ path: "/home/z/my-project/scripts/v24-rename.png" });
  }

  await browser.close();
  console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error("E2E FAIL:", e); process.exit(1); });
