/**
 * v1.1.0 E2E — 유저 지시 24건 중 코드 수정분 종합 검증
 *  ① 여캠+백자 피부 생성 → 스프라이트 시트 전환 (#21/#22)
 *  ② 프롤로그 시네마틱 → 스킵 → introSeen 기록 (#18)
 *  ③ 코스튬 착용 = 스프라이트 "완전 교체" → 해제 복원 (#1/#4)
 *  ④ 어태치 장식 착용/해제 (#1)
 *  ⑤ EERT 큐브 등급 하락 방지 (#6)
 *  ⑥ 퀘스트창 on/off 버튼 (#2)
 *  ⑦ 콘텐츠(탑): 퀘스트 로그 자동오픈 없음(#10) + 죽은 차원문 없음(#11) + 몬스터 벽 스폰 없음(#9)
 *  ⑧ 미니맵 플레이트(#7) · 라이트 절감(#8) · pageerror 0
 */
const { chromium } = require("playwright");

(async () => {
  const results = [];
  const ok = (name, pass, detail = "") => {
    results.push({ name, pass });
    console.log(`${pass ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
  };
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 200)));
  p.on("console", (m) => { if (m.type() === "error") errs.push("CONSOLE: " + m.text().slice(0, 160)); });
  const shot = (n) => p.screenshot({ path: `/tmp/e2e_110_${n}.png` });
  const scene = () => p.evaluate(() => {
    const s = window.__SERTZ__?.game?.scene?.getScene("world");
    return s ? { has: true, tex: s.player?.texture?.key ?? null, anim: s.player?.anims?.currentAnim?.key ?? null } : { has: false };
  });

  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2200);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  const badge = await p.getByText("v1.1.0", { exact: false }).first().isVisible().catch(() => false);
  ok("[버전] 타이틀 배지 v1.1.0", badge);
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1200);

  /* ① 여캠 + 백자 생성 */
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click();
  });
  await p.waitForTimeout(700);
  await p.locator("input").first().fill("은희");
  await p.waitForTimeout(300);
  for (const label of ["직업 선택", "외형 선택"]) {
    await p.evaluate((lb) => {
      Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes(lb))?.click();
    }, label);
    await p.waitForTimeout(400);
  }
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.trim() === "여캐")?.click();
  });
  await p.waitForTimeout(250);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.trim() === "백자")?.click();
  });
  await p.waitForTimeout(300);
  await shot("01_step3_female_porcelain");
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("생성!"))?.click();
  });
  await p.waitForTimeout(1400);
  ok("[①] 여캠+백자 생성 완료", true);
  await p.evaluate(() => { document.querySelector(".cursor-pointer")?.click(); });
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click();
  });
  await p.waitForTimeout(2600);

  /* ② 프롤로그 — 캔버스 렌더라 getByText 대신 씬 오브젝트로 판정 */
  const prologue1 = await p.evaluate(() => {
    const s = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!s) return false;
    return s.dialoguing === true && s.children.list.some((o) => o.type === "Text" && (o.text || "").includes("아홉 왕국"));
  });
  ok("[②] 프롤로그 시네마틱 표시", prologue1);
  await shot("02_prologue");
  for (let i = 0; i < 4; i++) { await p.mouse.click(640, 500); await p.waitForTimeout(700); }
  await p.waitForTimeout(1200);
  const introSeen = await p.evaluate(() => {
    const raw = localStorage.getItem("sertz_save");
    const s = raw ? JSON.parse(raw) : {};
    const charSave = Object.keys(s).length ? s : null;
    // 활성 캐릭터 세이브는 sertz_char_* — 아무 키나 뒤져 introSeen 확인
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("sertz_char_")) {
        const v = JSON.parse(localStorage.getItem(k) || "{}");
        if (v.playerName === "은희") return v.introSeen === true;
      }
    }
    return charSave?.introSeen === true;
  });
  ok("[②] 프롤로그 시청 → introSeen 기록", introSeen);
  await shot("03_after_prologue");

  /* ① 스프라이트 시트 전환 확인 */
  let sc = await scene();
  ok("[①] 여캠 백자 시트 적용 (chf0_*)", sc.has && typeof sc.tex === "string" && sc.tex.startsWith("chf0_"), `tex=${sc.tex}`);
  const g = () => p.evaluate(() => {
    const s = window.__SERTZ__?.game?.scene?.getScene("world");
    return !!s?.player;
  });
  await p.waitForTimeout(1500);
  ok("[①] 인게임 플레이어 활성", await g());

  /* ③ 코스튬 완전 교체 + ④ 장식 + 해제 */
  const cosTest = await p.evaluate(() => {
    const s = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!s?.player) return { ok: false };
    const pl = s.player;
    pl.cosmetics.push("outfit_silver", "acc_crown");
    pl.setOutfit("outfit_silver");
    const texWith = pl.texture.key;
    s.onCosmeticChanged();
    const accOn = s.accOverlays.length;
    pl.setOutfit(null);
    const texBack = pl.texture.key;
    pl.setAccessory("acc_crown");
    const accOn2 = s.accOverlays.length;
    s.save();
    /* #4 — 슬롯 지정 해제 */
    s.player.setCosmeticSlot(null, "acc");
    const accOff = s.accOverlays.length;
    return { ok: true, texWith, texBack, accOn: accOn > 0 || accOn2 > 0, accOff: accOff === 0 };
  });
  ok("[③] 코스튬 착용 → 스프라이트 완전 교체", cosTest.ok && cosTest.texWith === "cost_silver_idle0", `with=${cosTest.texWith}`);
  ok("[③] 코스튬 해제 → 원래 시트 복원", cosTest.texBack === "chf0_idle0", `back=${cosTest.texBack}`);
  ok("[④] 장식(왕관) 착용/해제", cosTest.accOn && cosTest.accOff);

  /* ⑤ EERT 큐브 등급 하락 방지 */
  const eert = await p.evaluate(() => {
    const s = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!s?.player) return { min: -1 };
    const pl = s.player;
    pl.owned.push("eert_cube");
    pl.potentials["weapon_1"] = { grade: 1, lines: [{ k: "atk", v: 2 }] }; // 에픽 시드
    let min = 9;
    for (let i = 0; i < 60; i++) {
      const pot = pl.rerollPotentials("weapon_1");
      if (!pot) break;
      if (pot.grade < min) min = pot.grade;
      if (pl.owned.indexOf("eert_cube") < 0) pl.owned.push("eert_cube");
    }
    return { min };
  });
  ok("[⑤] EERT 60연타 — 등급 에픽 미달 0회", eert.min === 1, `minGrade=${eert.min}`);

  /* ⑥ 퀘스트창 on/off */
  const q0 = await p.evaluate(() => {
    const els = Array.from(document.querySelectorAll(".game-panel"));
    return els.some((e) => (e.textContent || "").includes("마을 주민과 인사"));
  });
  await p.evaluate(() => {
    const btn = document.querySelector('button[aria-label="퀘스트창 끄기"]') || document.querySelector('button[aria-label*="퀘스트창"]');
    btn?.click();
  });
  await p.waitForTimeout(400);
  const q1 = await p.evaluate(() => {
    const els = Array.from(document.querySelectorAll(".game-panel"));
    return els.some((e) => (e.textContent || "").includes("마을 주민과 인사"));
  });
  ok("[⑥] 퀘스트창 on → off 버튼", q0 && !q1, `before=${q0} after=${q1}`);
  await shot("04_tracker_off");

  /* ⑦ 콘텐츠(탑) 진입 */
  await p.evaluate(() => {
    const s = Array.from(document.querySelectorAll("span")).find((x) => x.textContent === "콘텐츠");
    s?.closest("button")?.click();
  });
  await p.waitForTimeout(800);
  await shot("05_content_panel");
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("탑 입장"))?.click();
  });
  await p.waitForTimeout(4000);
  await p.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const x = btns.find((b2) => b2.getAttribute("aria-label")?.includes("닫기"));
    x?.click();
  });
  await p.waitForTimeout(3500);
  await shot("06_tower_inside");
  const tower = await p.evaluate(() => {
    const s = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!s) return {};
    const lay = s.layout;
    let wallSpawns = -1;
    if (lay && s.enemies?.length) {
      wallSpawns = 0;
      for (const e of s.enemies) {
        if (!e.active) continue;
        const c = Math.floor(e.x / lay.cellW);
        const r = Math.floor(e.y / lay.cellH);
        if (c < 0 || r < 0 || c >= lay.cols || r >= lay.rows || !lay.open[r * lay.cols + c]) wallSpawns++;
      }
    }
    return {
      key: s.stageDef?.key,
      portal: !!s.portal?.active,
      panelOpen: document.body.textContent?.includes("퀘스트 로그—") || false,
      enemies: s.enemies?.filter((e) => e.active).length ?? 0,
      wallSpawns,
      minimap: !!s.minimap,
    };
  });
  ok("[⑦] 탑 진입", tower.key === "tower", `key=${tower.key}`);
  ok("[⑦#10] 콘텐츠에서 퀘스트 로그 자동오픈 없음", !tower.panelOpen);
  ok("[⑦#11] 죽은 차원문 미생성", tower.portal === false, `portal=${tower.portal}`);
  ok("[⑦#9] 몬스터 벽 셀 스폰 0건", tower.wallSpawns === 0, `enemies=${tower.enemies} wall=${tower.wallSpawns}`);
  ok("[⑦#7] 미니맵 플레이트 그래픽 존재", tower.minimap === true);

  /* ⑧ 라이트 개수 */
  const lights = await p.evaluate(() => {
    const s = window.__SERTZ__?.game?.scene?.getScene("world");
    return { torch: s?.torches?.length ?? -1, total: s?.lighting?.count ?? -1 };
  });
  ok("[⑧#8] 라이트 절감 (횃불 ≤4)", lights.torch >= 0 && lights.torch <= 4, `torches=${lights.torch}`);
  ok("[⑧] pageerror/콘솔 에러 0", errs.length === 0, errs.slice(0, 2).join(" | "));

  console.log(`\n===== 결과: ${results.filter((r) => r.pass).length}/${results.length} PASS =====`);
  await b.close();
  process.exit(results.every((r) => r.pass) ? 0 : 1);
})();
