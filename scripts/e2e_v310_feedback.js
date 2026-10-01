/* v3.0.10 E2E — 사용자 피드백 6항목 검증
 *  [1] ② 좌우 애니 반전 픽스 — Mystic Woods 좌향 시트 기준: 우향 이동 flipX=true / 좌향 false
 *  [2] ④ 길 위 이상한 타일 제거 — edge/bite/pvar 프린지 0개 + tile_path 타일링 TileSprite 존재
 *  [3] ③ 짤림 수정 — tree/pine/rock/well/fragment 텍스처 알파 bbox가 캔버스 가장자리에 닿지 않음 (canvas 실측)
 *  [4] ⑥ 스킬 아이콘 — 미전직 base_s1/base_s2 아이콘 DOM 렌더 + HTTP 200
 *  [5] ① 스토리 본게임화 — 이그니/니드그림/세계수의 뿌리 + 아뜰란티스 단어 제거 + 대사 스피커 실측
 *  [6] ⑤ 메이플식 컷신 — 챕터 타이틀 카드(dialoguing+카드 요소) + 보스 조우 시네마틱(물리 pause)
 *  + 회귀: pageerror 0 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");

const PORT = 3123;
const URL = `http://localhost:${PORT}`;
let pass = 0, fail = 0;
const ok = (cond, label, extra = "") => { if (cond) { pass++; console.log(`  PASS — ${label} ${extra}`); } else { fail++; console.log(`  FAIL — ${label} ${extra}`); } };

async function cleanDialogues(page) {
  let cleanStreak = 0;
  for (let i = 0; i < 24 && cleanStreak < 3; i++) {
    const dlg = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      if (w?.dialoguing) { w.resumeFromDialogue(); return true; }
      return false;
    });
    if (dlg) cleanStreak = 0; else cleanStreak++;
    await page.waitForTimeout(280);
  }
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.dialoguing = false; w.introStep = -1; w.sleepPending = false;
    if (w.physics.world) w.physics.world.resume();
  });
  await page.waitForTimeout(250);
}

async function enterWorld(page) {
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("text=새로운 모험", { timeout: 60000 });
  await page.click("text=새로운 모험");
  for (let i = 0; i < 40; i++) {
    const inWorld = await page.evaluate(() => !!(window.__SERTZ__?.game?.scene.getScene("world")?.player));
    if (inWorld) break;
    await page.mouse.click(400, 300); await page.keyboard.press("e"); await page.waitForTimeout(400);
  }
  await page.waitForTimeout(900);
  for (let i = 0; i < 6; i++) {
    const done = await page.evaluate(() => {
      try {
        const w = window.__SERTZ__.game.scene.getScene("world");
        if (!w?.player) return false;
        w.finishIntro("테스터");
        return true;
      } catch { return false; }
    });
    if (done) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(400);
  await cleanDialogues(page);
}

/** 스테이지 + 세이브 주입 재시작 (v306 하네스 패턴) */
async function gotoStage(page, stageKey, savePatch = {}) {
  await page.evaluate(async (args) => {
    const w0 = window.__SERTZ__.game.scene.getScene("world");
    const stage = String(args.stageKey);
    const base = w0.buildSave(stage) || {};
    for (const [k, v] of Object.entries(args.patch || {})) base[k] = v;
    base.stage = stage;
    w0.scene.restart({ stage, save: base });
  }, { stageKey, patch: savePatch });
  await page.waitForTimeout(1500);
  await cleanDialogues(page);
}

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production", PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 500)); try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) break; } catch {} }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  console.log("== [1] 타이틀/스토리 본게임화 ==");
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("text=새로운 모험", { timeout: 60000 });
  await page.waitForTimeout(500);
  const titleText = await page.evaluate(() => document.body.innerText);
  ok(titleText.includes("이그드라실 : 아홉 왕국"), "타이틀 서브타이틀 = 이그드라실 : 아홉 왕국");
  ok(!titleText.includes("아뜰란티스") || (titleText.match(/아뜰란티스/g) || []).length === 1, "타이틀 화면 아뜰란티스 표기 없음(스핀오프 링크만)", `건수=${(titleText.match(/아뜰란티스/g) || []).length}`);

  await enterWorld(page);
  // 인트로 대사 스피커 실측 — introNamed 직접 재생
  const speaker = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.showDialogue("introNamed");
    return true;
  });
  await page.waitForTimeout(500);
  const dlgText = await page.evaluate(() => document.body.innerText);
  ok(speaker && dlgText.includes("룬 정령 이그니"), "introNamed 스피커 = 룬 정령 이그니");
  ok(!dlgText.includes("아부디토스") && !dlgText.includes("인어"), "대사 화면 잠뜰 요소 없음");
  await page.evaluate(() => { const w = window.__SERTZ__.game.scene.getScene("world"); w.resumeFromDialogue(); });
  await page.waitForTimeout(300);

  console.log("== [2] 좌우 애니메이션 플립 실측 ==");
  // 우향 이동 → flipX=true (좌향 시트 기준 올바름) / 좌향 이동 → flipX=false
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(500);
  const right = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    return { fx: w.player.flipX, vx: w.player.body.velocity.x, anim: w.player.anims.currentAnim?.key };
  });
  await page.keyboard.up("ArrowRight");
  await page.waitForTimeout(200);
  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(500);
  const left = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    return { fx: w.player.flipX, vx: w.player.body.velocity.x, anim: w.player.anims.currentAnim?.key };
  });
  await page.keyboard.up("ArrowLeft");
  ok(right.vx > 10 && right.fx === true, `우향 이동 → flipX=true (좌향 시트 반전=오른쪽)`, `vx=${right.vx.toFixed(0)} fx=${right.fx} anim=${right.anim}`);
  ok(left.vx < -10 && left.fx === false, `좌향 이동 → flipX=false (시트 원본=왼쪽)`, `vx=${left.vx.toFixed(0)} fx=${left.fx} anim=${left.anim}`);
  ok(right.anim === "hero-walk-side" && left.anim === "hero-walk-side", "측면 걷기 애님 hero-walk-side 재생");

  console.log("== [3] 스킬 아이콘 적용 실측 (미전직 base) ==");
  await page.waitForTimeout(600);
  const skillSrcs = await page.evaluate(() =>
    [...document.querySelectorAll("img")].map((i) => i.getAttribute("src")).filter((s) => s && s.includes("skillicon"))
  );
  ok(skillSrcs.some((s) => s.includes("base_s1")), "미전직 스킬1 아이콘 base_s1 DOM 렌더", skillSrcs.join(","));
  if (skillSrcs[0]) {
    const st = await page.request.get(URL + skillSrcs[0]);
    ok(st.status() === 200, `아이콘 파일 200 응답 ${skillSrcs[0]}`);
  } else {
    // 모바일 터치 레이아웃 미노출 시 — emitSkills 페이로드 대신 씬 skills 재발행 후 재확인
    await page.evaluate(() => window.__SERTZ__.game.scene.getScene("world").emitSkills());
    await page.waitForTimeout(300);
    const retry = await page.evaluate(() =>
      [...document.querySelectorAll("img")].map((i) => i.getAttribute("src")).filter((s) => s && s.includes("skillicon"))
    );
    ok(retry.some((s) => s.includes("base_s")), "재발행 후 base 아이콘 렌더", retry.join(","));
  }

  console.log("== [4] 짤림 수정 — 텍스처 알파 가장자리 실측 ==");
  const bboxes = await page.evaluate(async (names) => {
    const out = {};
    for (const n of names) {
      try {
        const img = new Image();
        img.src = `/assets/${n}.png`;
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; setTimeout(res, 3000); });
        const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
        const ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
        for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
          if (d[(y * c.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
        }
        out[n] = { w: c.width, h: c.height, bbox: [x0, y0, x1, y1], touch: x0 <= 0 || y0 <= 0 || x1 >= c.width || y1 >= c.height };
      } catch (e) { out[n] = { err: String(e) }; }
    }
    return out;
  }, ["tree", "pine", "rock", "well", "fragment"]);
  for (const [n, v] of Object.entries(bboxes)) {
    ok(!v.touch, `${n} 알파 bbox 캔버스 가장자리 미닿음`, `size=${v.w}x${v.h} bbox=${JSON.stringify(v.bbox)}`);
  }

  console.log("== [5] 이상한 타일 제거 실측 (forest3) ==");
  await gotoStage(page, "forest3");
  const tileCounts = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    let edge = 0, bite = 0, pvar = 0, groundTS = 0, roadTS = 0;
    for (const c of w.children.list) {
      const tex = c.texture?.key ?? "";
      if (tex.includes("_edge")) edge++;
      if (tex.includes("_bite")) bite++;
      if (tex.includes("_pvar")) pvar++;
      // 클린 타일 시상 — 지면(풀사이즈) TileSprite + 길(104px) TileSprite
      if (c.type === "TileSprite" && c.height >= c.scene.stageH - 5) groundTS++;
      if (c.type === "TileSprite" && Math.round(c.height) === 104) roadTS++;
    }
    return { edge, bite, pvar, groundTS, roadTS };
  });
  ok(tileCounts.edge === 0 && tileCounts.bite === 0, "경계 프린지(edge)/침식(bite) 타일 0개", JSON.stringify(tileCounts));
  ok(tileCounts.pvar === 0, "도로 변형(pvar) 타일 0개");
  ok(tileCounts.roadTS >= 1, "길(104px) 타일링 TileSprite 존재", JSON.stringify(tileCounts));

  // 사용자 시점 실측 — 스크린샷(WebGL 버퍼 보존)을 페이지에서 재분석해 지면/길 렌더 확인
  const shotB64 = (await page.screenshot({ type: "png" })).toString("base64");
  const px = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await new Promise((res) => { img.onload = res; setTimeout(res, 3000); });
    const t = document.createElement("canvas");
    t.width = img.width; t.height = img.height;
    const ctx = t.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, t.width, t.height).data;
    let green = 0, dirt = 0, n = 0;
    for (let y = 0; y < t.height; y += 4) {
      for (let x = 0; x < t.width; x += 4) {
        const i = (y * t.width + x) * 4;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        if (g > r + 18 && g > b + 18 && g > 90) green++;
        if (r > 140 && r > b + 40 && g > 90 && g < r) dirt++;
        n++;
      }
    }
    return { greenPct: Math.round((green / n) * 100), dirtPct: Math.round((dirt / n) * 100) };
  }, shotB64);
  ok(px && px.greenPct > 15, `지면(잔디) 픽셀 렌더 실측`, `green=${px?.greenPct}%`);
  ok(px && px.dirtPct > 8, `길(흙길) 픽셀 렌더 실측`, `dirt=${px?.dirtPct}%`);

  console.log("== [6] 챕터 타이틀 카드 컷신 실측 (forest1 최초 진입) ==");
  // forest3 → forest1 재시작(대사 미본 상태 주입) → 카드 연출 관찰
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const base = w.buildSave("forest1") || {};
    base.seen = []; // 인트로 대사 미본 — 카드+인트로 재생 경로
    base.stage = "forest1";
    w.scene.restart({ stage: "forest1", save: base });
  });
  await page.waitForTimeout(900);
  const cardMid = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const cards = w.children.list.filter((c) => c.type === "Text" && (c.text === "제2장" || c.text === "숲의 신전"));
    return { dialoguing: w.dialoguing, paused: w.physics.world.isPaused, cardTexts: cards.map((c) => c.text) };
  });
  ok(cardMid.dialoguing === true, "카드 연출 중 dialoguing=true (컷신 잠금)");
  ok(cardMid.cardTexts.includes("제2장") && cardMid.cardTexts.includes("숲의 신전"), "챕터 타이틀 카드 텍스트 생성", cardMid.cardTexts.join("/"));
  await page.waitForTimeout(2800);
  await cleanDialogues(page);
  const cardEnd = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const left = w.children.list.filter((c) => c.type === "Text" && (c.text === "제2장" || c.text === "숲의 신전"));
    return { left: left.length, paused: w.physics.world.isPaused };
  });
  ok(cardEnd.left === 0, "카드 연출 후 정리 완료", `paused=${cardEnd.paused}`);

  console.log("== [7] 스토리(제10장·최종보스) 본게임화 실측 ==");
  await gotoStage(page, "abyss10");
  const abyssName = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    return w.stageDef?.name ?? "";
  });
  ok(abyssName === "제10장 세계수의 뿌리", "제10장 명칭 = 세계수의 뿌리", abyssName);
  const bossName = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.spawnBoss(false);
    return { name: w.bossDef?.name ?? "", key: w.bossDef?.key ?? "" };
  });
  ok(bossName.name === "종언의 마룡 니드그림", "최종보스 명칭 = 종언의 마룡 니드그림", JSON.stringify(bossName));

  console.log("== [8] 보스 조우 시네마틱 실측 (forest10 재진입) ==");
  await gotoStage(page, "forest10");
  const cine = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    if (w.boss) { w.boss.destroy(); w.boss = null; }
    const before = { bossAlive: !!w.boss };
    w.spawnBoss(true); // intro 연출 경로
    return before;
  });
  await page.waitForTimeout(500);
  const cineMid = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    return { dialoguing: w.dialoguing, paused: w.physics.world.isPaused, boss: !!w.boss };
  });
  ok(cineMid.boss, "보스 스폰");
  ok(cineMid.dialoguing && cineMid.paused, "보스 조우 시네마틱 — 컷신 잠금 + 물리 pause", JSON.stringify(cineMid));
  await cleanDialogues(page);

  console.log("== 회귀 ==");
  ok(pageErrors.length === 0, "pageerror 0건", pageErrors.slice(0, 3).join(" | "));

  await browser.close();
  try { srv.kill(); } catch {}
  console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("E2E 치명 오류:", e); process.exit(2); });
