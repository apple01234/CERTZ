/**
 * e2e_vc154.js — 유저 제보 3건 검증
 *  ① 기본공격 X 키탭 제거 (자동 버튼 위 유령 X 소실)
 *  ② NPC 선택지 E키 확정 — 한글 IME(e.key="ㄷ")에서도 작동
 *  ③ 블레이드마스터 궁극기 백연타 — 가속 100베기 + 死 한자 + HIT 카운터 + pageerror 0
 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");

const PORT = 3123;
const URL = `http://localhost:${PORT}`;
let pass = 0, fail = 0;
const ok = (cond, label, extra = "") => { if (cond) { pass++; console.log("PASS", label, extra); } else { fail++; console.log("FAIL", label, extra); } };

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production", PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 500)); try { const r2 = await fetch(`${URL}/api/version`); if (r2.ok) break; } catch {} }

  const browser = await chromium.launch({
    args: ["--no-sandbox","--disable-dev-shm-usage","--disable-gpu"],
    executablePath: "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome",
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 120)));

  /* ── 부팅 + 월드 진입 ── */
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.waitForSelector("text=게임 시작", { timeout: 40000 });
  await page.getByRole("button", { name: /게임 시작/ }).first().click();
  await page.waitForTimeout(900);
  const cb = page.getByText("캐릭터 생성", { exact: false }).first();
  if ((await cb.count()) > 0) await cb.click().catch(() => {});
  await page.waitForTimeout(400);
  const ni = page.locator('input[placeholder*="캐릭터 이름"]').first();
  if ((await ni.count()) > 0) {
    await ni.fill("vc154검증");
    await page.getByRole("button", { name: /다음 — 외형 선택/ }).first().click().catch(() => {});
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /모험가로 생성!/ }).first().click().catch(() => {});
    await page.waitForTimeout(900);
  }
  await page.getByText("vc154검증").first().click({ timeout: 6000 }).catch(() => {});
  await page.getByRole("button", { name: /이 캐릭터로 시작/ }).first().click({ timeout: 15000 }).catch(() => {});
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000);
    const st = await page.evaluate(() => {
      const g = window.__SERTZ__;
      const w = g?.game?.scene?.getScene("world");
      return w ? w.children.list.length : -1;
    });
    if (st > 20) break;
  }
  /* 인트로 강제 완료 + 대화 청소 */
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    try { w.finishIntro("vc154검증"); } catch { /* 이미 완료 */ }
  });
  for (let i = 0; i < 14; i++) {
    const dlg = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      if (w?.dialoguing) { w.resumeFromDialogue(); return true; }
      return false;
    });
    if (!dlg) break;
    await page.waitForTimeout(250);
  }

  /* ── ① X 키탭 제거 실측 ── */
  await page.waitForTimeout(1200);
  const chips = await page.evaluate(() => {
    const out = [];
    const walk = (el) => {
      for (const c of el.children) walk(c);
      const t = (el.textContent || "").trim();
      if ((t === "X" || t === "Z" || t === "C" || t === "V") && el.children.length === 0 && el.tagName !== "INPUT") {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) out.push({ t, x: Math.round(r.x), y: Math.round(r.y) });
      }
    };
    walk(document.body);
    return out;
  });
  ok(!chips.some((c) => c.t === "X"), "① 기본공격 X 키탭 소실", JSON.stringify(chips));
  ok(chips.some((c) => c.t === "Z"), "① 스킬 키탭(Z)은 유지", JSON.stringify(chips));

  /* ── ② 상점 패널 — IME key="ㄷ" code="KeyE" 확정 실측 ── */
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.dialoguing = false;
  });
  const goldBefore = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const s = w.buildSave ? null : null;
    /* gold는 HUD 상태에서 — rpg:state 이벤트 데이터 대신 세이브 골드 사용 */
    return window.__SERTZ__.game.scene.getScene("world").saveGold ?? null;
  });
  /* 상점 NPC 앞으로 순간이동 후 G(shop 키)로 패널 오픈 */
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const shop = (w.interactables || []).find((it) => it.kind === "shop");
    if (shop && w.player) { w.player.setPosition(shop.x, shop.y); w.updateInteractPrompt?.(); }
  });
  await page.waitForTimeout(900);
  await page.keyboard.press("g");
  await page.waitForTimeout(900);
  if ((await page.evaluate(() => document.querySelectorAll('[data-navsel]').length)) === 0) {
    /* 폴백 — interact 키(E)로 상점 대화 후 패널 */
    await page.evaluate(() => { const w = window.__SERTZ__.game.scene.getScene("world"); w.tryInteract?.(); });
    await page.waitForTimeout(1200);
    for (let i = 0; i < 6; i++) {
      const dlg = await page.evaluate(() => { const w = window.__SERTZ__.game.scene.getScene("world"); if (w?.dialoguing) { w.resumeFromDialogue(); return true; } return false; });
      if (!dlg) break;
      await page.waitForTimeout(300);
    }
  }
  const navRows = await page.evaluate(() => document.querySelectorAll('[data-navsel]').length);
  const selRow = await page.evaluate(() => {
    const el = document.querySelector('[data-navsel="1"]');
    return el ? (el.textContent || "").slice(0, 40) : null;
  });
  ok(navRows > 0, "② 상점 목록 + 선택 하이라이트 존재", `rows=${navRows} sel=${selRow ?? "없음"}`);

  /* ArrowDown 이동 확인 — 선택 행(data-navsel="1")의 텍스트가 바뀌면 이동한 것 */
  const selText0 = await page.evaluate(() => document.querySelector('[data-navsel="1"]')?.textContent?.slice(0, 24) ?? null);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(250);
  const selText1 = await page.evaluate(() => document.querySelector('[data-navsel="1"]')?.textContent?.slice(0, 24) ?? null);
  ok(!!selText0 && !!selText1 && selText0 !== selText1, "② ↑/↓ 선택 이동", `${selText0} → ${selText1}`);

  /* 골드 스냅샷 (세이브에서) */
  const gold0 = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    try { return w.player?.gold ?? null; } catch { return null; }
  });
  /* IME 조합 키 디스패치 — e.key="ㄷ", e.code="KeyE" */
  await page.evaluate(() => {
    const ev = new KeyboardEvent("keydown", { key: "ㄷ", code: "KeyE", bubbles: true, cancelable: true });
    window.dispatchEvent(ev);
  });
  await page.waitForTimeout(900);
  const gold1 = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    try { return w.player?.gold ?? null; } catch { return null; }
  });
  const panelClosed = await page.evaluate(() => (window.__SERTZ__.game.scene.getScene("world").dialoguing ?? false));
  ok(gold0 != null && gold1 != null && gold1 < gold0, "② E키(IME ㄷ)로 구매 확정 — 골드 차감", `${gold0} → ${gold1}`);
  void panelClosed;

  /* ── ③ 블레이드마스터 백연타 — 헤들리스 FPS 확보 위해 사냥터(forest1)로 이동 후 시험 ── */
  await page.evaluate(() => {
    const w0 = window.__SERTZ__.game.scene.getScene("world");
    const stage = "forest1";
    const base = w0.buildSave(stage) || {};
    base.stage = stage;
    w0.scene.restart({ stage, save: base });
  });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.dialoguing = false; w.introStep = -1; w.sleepPending = false;
    if (w.physics?.world) w.physics.world.resume();
    if (w.player) {
      try { w.player.gmSetClass("blademaster"); } catch { /* 폴백 */ }
      try { w.player.gmSetLevel(220); } catch { /* 폴백 */ }
      w.player.healFull();
      w.emitSkills?.();
    }
  });
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.player?.useSkill5?.();
  });
  await page.waitForTimeout(1200);
  const cine = await page.evaluate(() => {
    const kanji = [...document.querySelectorAll("div")].find((d) => d.children.length === 0 && d.textContent === "死" && d.style.cssText.includes("Noto Serif"));
    const hit = [...document.querySelectorAll("div")].find((d) => d.children.length === 0 && /^\d+ HIT$/.test((d.textContent || "").trim()));
    const bars = [...document.querySelectorAll("div")].filter((d) => d.style.height === "42px" && d.children.length === 0 && d.textContent === "");
    return { kanji: !!kanji, hitText: hit ? hit.textContent.trim() : null, bars: bars.length };
  });
  ok(cine.kanji, "③ 死 한자 블룸(절제) 표시");
  ok(cine.bars >= 2, "③ 시네마 레터박스", `bars=${cine.bars}`);
  /* 헤들리스 9FPS 환경은 게임 시간이 ~0.45×로 흐른다 — 100 HIT 도달을 폴링 대기 (최대 30초) */
  let hitFinal = null;
  for (let i = 0; i < 100; i++) {
    await page.waitForTimeout(1000);
    const smp = await page.evaluate(() => {
      const hit = [...document.querySelectorAll("div")].find((d) => d.children.length === 0 && /^\d+ HIT$/.test((d.textContent || "").trim()));
      const w = window.__SERTZ__.game.scene.getScene("world");
      const hb = [...document.querySelectorAll("div")].find((d) => d.children.length === 0 && /Noto Serif/.test(d.style.cssText || "") && /right: ?6%/.test(d.style.cssText || ""));
      return { hit: hit ? hit.textContent.trim() : null, hb: hb ? `${hb.textContent}|${hb.style.opacity}` : null, dlg: w.dialoguing, st: w.player?.state, dead: w.player?.state === "dead", fps: Math.round(w.game?.loop?.actualFps ?? 0) };
    });
    hitFinal = smp.hit;
    if (i % 8 === 0) console.log("  sample", JSON.stringify(smp));
    if (hitFinal === "100 HIT") break;
  }
  ok(hitFinal === "100 HIT", "③ HIT 카운터 100 도달", `text=${hitFinal ?? "없음"}`);

  /* 오버레이 소산 폴링 (종결+페이드아웃 — 최대 12초) */
  let overlayGone = false;
  for (let i = 0; i < 24; i++) {
    await page.waitForTimeout(1000);
    overlayGone = await page.evaluate(() => {
      return ![...document.querySelectorAll("div")].some((d) => d.children.length === 0 && d.textContent === "死" && d.style.cssText.includes("Noto Serif"));
    });
    if (overlayGone) break;
  }
  ok(overlayGone, "③ 오버레이 완전 소산 (유출 없음)");
  void hitFinal;

  ok(pageErrors.length === 0, "pageerror 0", pageErrors.slice(0, 3).join(" | "));
  console.log(`\n=== vc154 E2E: ${pass} pass / ${fail} fail ===`);
  await browser.close();
  try { srv.kill(); } catch {}
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error("E2E FAIL", e); process.exit(1); });
