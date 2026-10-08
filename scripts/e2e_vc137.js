/**
 * e2e_vc137.js — v1.4.31 검증: 보스 아틀라스 렌더 + 교실 파티 게임 3종 + 니플헤임 조정
 *  브라우저 실측 — 아틀라스 텍스처 로드/애니 등록/보스 스폰 렌더 + 교실 활동 UI
 */
const { chromium } = require("playwright");

(async () => {
  const base = "http://127.0.0.1:3000";
  let pass = 0, fail = 0;
  const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("PASS", name, extra); } else { fail++; console.log("FAIL", name, extra); } };
  const errors = [];

  const browser = await chromium.launch({
    args: ["--no-sandbox"],
    executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome",
  });
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  p.setDefaultTimeout(30000);
  p.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));

  /* ── 1) 부팅 + 캐릭터 생성 ── */
  await p.goto(base, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.getByRole("button", { name: /게임 시작/ }).first().click();
  await p.waitForTimeout(900);
  const createBtn = p.getByText("캐릭터 생성", { exact: false }).first();
  if (await createBtn.count() > 0) await createBtn.click().catch(() => {});
  await p.waitForTimeout(400);
  const ni = p.locator('input[placeholder*="캐릭터 이름"]').first();
  if (await ni.count() > 0) {
    await ni.fill("아틀라스테스터");
    await p.getByRole("button", { name: /다음 — 외형 선택/ }).first().click().catch(() => {});
    await p.waitForTimeout(300);
    await p.getByRole("button", { name: /모험가로 생성!/ }).first().click().catch(() => {});
    await p.waitForTimeout(800);
  }
  await p.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const t = btns.find((x) => /이 캐릭터로 시작/.test(x.textContent || "")) || btns.find((x) => /시작/.test(x.textContent || ""));
    if (t) t.click();
  });
  await p.waitForTimeout(7000);

  /* ── 2) 아틀라스 텍스처 로드 + 애니 등록 확인 ── */
  const atlas = await p.evaluate(() => {
    const g = window.__SERTZ__?.game;
    if (!g) return null;
    const tex = g.textures;
    const out = {};
    for (const k of ["atl_boss", "atl_boss2", "atl_boss3", "atl_boss_nidhog", "atl_boss_surt", "atl_boss_fenrir", "atl_boss_skoll", "atl_boss_nagr", "atl_boss_hati"]) {
      const t = tex.get(k);
      out[k] = t && t.key !== "__MISSING" ? { frames: t.getFrameNames().length, w: t.getSourceImage()?.width, h: t.getSourceImage()?.height } : null;
    }
    const an = g.anims;
    out.anims = ["boss_nidhog-idle", "boss_nidhog-walk", "boss_nidhog-atk", "boss_nidhog-sp1", "boss_nidhog-sp2", "boss_nidhog-sp3", "boss_nidhog-die", "boss2-idle", "atl_boss_hati-idle"].map((k) => ({ k, ok: an.exists(k) }));
    return out;
  });
  ok("아틀라스 9종 텍스처 로드", !!atlas && Object.entries(atlas).filter(([k]) => k.startsWith("atl_")).every(([, v]) => v && v.frames >= 72));
  const fr = atlas?.["atl_boss_nidhog"];
  ok("니드호그 아틀라스 84프레임", fr && fr.frames === 84, fr ? `${fr.frames}fr ${fr.w}x${fr.h}` : "null");
  ok("아틀라스 풀애니 7종 등록", !!atlas && atlas.anims.filter((a) => a.k.startsWith("boss_nidhog")).every((a) => a.ok));
  ok("구형 보스도 아틀라스 애니로 등록(boss2-idle=시트 기반)", !!atlas && atlas.anims.find((a) => a.k === "boss2-idle")?.ok === true);

  /* ── 3) 보스 스폰 렌더 (니드호그 — 알프헤임 보스) ── */
  await p.evaluate(() => {
    const g = window.__SERTZ__.game;
    const ws = g.scene.getScene("world");
    const stages = window.__SERTZ_DEBUG__.stages;
    const px = ws.player?.x ?? ws.cameras.main.width / 2;
    const py = ws.player?.y ?? ws.cameras.main.height / 2;
    const boss = new (g.scene.getScene("world").constructor.prototype.constructor === Object ? Object : Object)();
  }).catch(() => {});
  // Boss 클래스는 번들 내부라 직접 접근 불가 → 스테이지 전이 대신 렌더 확인용 스프라이트를 씬에 직접 추가
  await p.evaluate(() => {
    const g = window.__SERTZ__.game;
    const ws = g.scene.getScene("world");
    const cx = ws.cameras.main.midPoint?.x ?? ws.player.x;
    const cy = ws.cameras.main.midPoint?.y ?? ws.player.y;
    ws.add.sprite(cx, cy - 60, "atl_boss_nidhog", 0).setDepth(50).setScale(1).setName("dbg_atlas_boss");
    ws.add.sprite(cx - 90, cy - 60, "atl_boss_fenrir", 12).setDepth(50).setName("dbg_atlas_boss2");
    ws.add.sprite(cx + 90, cy - 60, "atl_boss_skoll", 24).setDepth(50).setName("dbg_atlas_boss3");
    ws.add.sprite(cx, cy + 90, "atl_boss2", 36).setDepth(50).setName("dbg_atlas_boss4");
  });
  await p.waitForTimeout(900);
  await p.screenshot({ path: "scripts/atlas_preview/ingame_atlas.png" });
  const rendered = await p.evaluate(() => {
    const g = window.__SERTZ__.game;
    const ws = g.scene.getScene("world");
    return ["dbg_atlas_boss", "dbg_atlas_boss2", "dbg_atlas_boss3", "dbg_atlas_boss4"].map((n) => {
      const s = ws.children.getByName(n);
      return s ? { n, vis: s.visible, w: s.displayWidth, h: s.displayHeight } : null;
    });
  });
  ok("아틀라스 보스 인게임 렌더 4종", Array.isArray(rendered) && rendered.every((r) => r && r.vis && r.w > 200), JSON.stringify(rendered));

  /* ── 4) 교실 파티 게임 UI ── */
  const more = p.locator('button[aria-label*="더보기"]').first();
  await more.click();
  await p.waitForTimeout(300);
  await p.locator('button[aria-label*="클래스룸"]').first().click();
  await p.waitForTimeout(500);
  await p.getByRole("button", { name: /교실 생성/ }).first().click();
  await p.waitForTimeout(1800);
  const body1 = await p.locator("body").innerText();
  ok("교실 생성 + 코드 발급", /\b[A-Z2-9]{6}\b/.test(body1));
  ok("파티 게임 입구 3종 (팀 킬전·보물 사냥·퀴즈쇼)", body1.includes("팀 킬전") && body1.includes("보물 사냥") && body1.includes("퀴즈쇼"));
  ok("기존 3종 유지", body1.includes("학급 토벌전") && body1.includes("공유 보스 레이드") && body1.includes("사냥 경쟁전"));

  /* 퀴즈쇼 출제 → 퀴즈 뷰 + 답안 버튼 */
  await p.getByText("퀴즈쇼", { exact: false }).first().click();
  await p.waitForTimeout(400);
  const quizBody1 = await p.locator("body").innerText();
  ok("퀴즈 뱅크 펼침", quizBody1.includes("게임의 첫 시작 마을 이름은?"));
  await p.getByText("게임의 첫 시작 마을 이름은?").first().click();
  await p.waitForTimeout(700);
  const quizBody2 = await p.locator("body").innerText();
  ok("퀴즈 진행 뷰 + 카운트다운", quizBody2.includes("미드가르드 마을") && /29초|30초|28초/.test(quizBody2));
  await p.screenshot({ path: "scripts/atlas_preview/ingame_quiz.png" });
  // 답안 제출 (host 화면에서도 버튼 동작)
  await p.getByText("알프헤임", { exact: false }).first().click();
  await p.waitForTimeout(500);
  const quizBody3 = await p.locator("body").innerText();
  ok("답안 제출 (내 답 표시)", quizBody3.includes("(내 답)"));

  /* 활동 종료 → 팀 킬전 */
  await p.getByRole("button", { name: /활동 종료/ }).first().click();
  await p.waitForTimeout(400);
  await p.getByText("팀 킬전", { exact: false }).first().click();
  await p.waitForTimeout(800);
  const teamBody = await p.locator("body").innerText();
  ok("팀 킬전 뷰 (레드/블루 + 내 팀)", teamBody.includes("레드") && teamBody.includes("블루") && teamBody.includes("나는"));
  await p.screenshot({ path: "scripts/atlas_preview/ingame_team.png" });

  /* 보물 사냥 */
  await p.getByRole("button", { name: /활동 종료/ }).first().click();
  await p.waitForTimeout(400);
  await p.getByText("보물 사냥", { exact: false }).first().click();
  await p.waitForTimeout(800);
  const trBody = await p.locator("body").innerText();
  ok("보물 사냥 뷰 (정예 카운트 안내)", trBody.includes("정예 몬스터만 카운트") && /0 \/ \d+/.test(trBody));

  await p.screenshot({ path: "scripts/atlas_preview/ingame_treasure.png" });

  ok("페이지 에러 0", errors.length === 0, errors.slice(0, 3).join(" | "));

  console.log(`\n=== RESULT: ${pass} PASS / ${fail} FAIL ===`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})();
