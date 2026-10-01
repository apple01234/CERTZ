/**
 * v1.0.18 E2E — 로비 / 캐릭터 생성 / 유니온 / 몬스터 파크 / FX 설정
 * 화면: 1280×720 고정 (가로)
 */
const { chromium } = require("playwright");

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 240)));
  p.on("console", (m) => { if (m.type() === "error") errs.push("CONSOLE: " + m.text().slice(0, 240)); });

  const shot = (n) => p.screenshot({ path: `/tmp/e2e_1018_${n}.png` });
  const vis = async (text) => p.getByText(text, { exact: false }).first().isVisible().catch(() => false);

  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(6000);
  console.log("1. 타이틀 배지 v1.0.18:", await vis("v1.0.18"));
  await shot("01_title");

  /* 로비 열기 */
  await p.getByRole("button", { name: /게임 시작/ }).first().click();
  await p.waitForTimeout(900);
  console.log("2. 로비 진입:", await vis("캐릭터 선택"));

  /* 구 세이브 마이그레이션 확인 (기존 세이브가 있으면 카드 1장) */
  const cardCount = await p.locator("button:has-text('Lv. ')").count();
  console.log("3. 마이그레이션된 캐릭터 카드 수:", cardCount);
  await shot("02_lobby");

  /* 캐릭터 생성 */
  await p.getByText("캐릭터 생성", { exact: false }).first().click();
  await p.waitForTimeout(500);
  await p.getByText("마법사", { exact: false }).first().click(); // 직업 카드
  await p.waitForTimeout(400);
  console.log("4. 마법사 프리뷰(주 스탯):", await vis("INT (지력)"));
  await shot("03_create_preview");
  await p.locator('input[placeholder*="캐릭터 이름"]').fill("유니온테스터");
  await p.getByRole("button", { name: /로 생성/ }).click();
  await p.waitForTimeout(700);
  console.log("5. 생성된 카드:", await vis("유니온테스터"));
  await shot("04_created");

  /* 게임 시작 */
  await p.getByRole("button", { name: /이 캐릭터로 시작/ }).click();
  await p.waitForTimeout(7000);
  const playing = await p.evaluate(() => {
    const s = window.__SERTZ__?.game?.scene;
    return !!s && !!s.getScene("world")?.player;
  });
  console.log("6. 월드 진입 + 플레이어:", playing);
  console.log("   시작 클래스=마법사:", await p.evaluate(() => window.__SERTZ__?.game?.scene.getScene("world")?.player?.cls ?? null));
  await shot("05_world");

  /* 퀘스트 패널 자동 오픈 닫기 */
  await p.keyboard.press("Escape");
  await p.waitForTimeout(500);

  /* 유니온 패널 */
  await p.getByRole("button", { name: /유니온 열기/ }).click();
  await p.waitForTimeout(900);
  console.log("7. 유니온 패널:", await vis("유니온 레벨"));
  console.log("   등급 배지:", await vis("브론즈"));
  await shot("06_union");
  /* 자동 추천 배치 */
  await p.getByText("자동 추천 배치").click().catch(() => {});
  await p.waitForTimeout(500);
  await shot("07_union_auto");
  /* 아티팩트 탭 */
  await p.getByRole("button", { name: "아티팩트" }).click();
  await p.waitForTimeout(400);
  console.log("8. 아티팩트 탭:", await vis("용맹의 문장"));
  /* 레이드 탭 */
  await p.getByRole("button", { name: "레이드", exact: true }).click();
  await p.waitForTimeout(400);
  console.log("9. 레이드 탭:", await vis("참전 파티"));
  await shot("08_raid");
  /* 닫기 */
  await p.getByRole("button", { name: "유니온 패널 닫기" }).click();
  await p.waitForTimeout(400);

  /* 콘텐츠 → 파크 탭 */
  await p.getByRole("button", { name: /콘텐츠 열기/ }).click();
  await p.waitForTimeout(700);
  await p.getByRole("button", { name: "파크", exact: true }).click();
  await p.waitForTimeout(500);
  console.log("10. 파크 탭:", await vis("몬스터 파크 — 90초"));
  await shot("09_park");
  await p.getByRole("button", { name: "콘텐츠 패널 닫기" }).click();
  await p.waitForTimeout(400);

  /* 설정 → FX 슬라이더 */
  await p.getByRole("button", { name: /설정\/키 매핑 열기/ }).click();
  await p.waitForTimeout(700);
  console.log("11. 셰이더 강도 UI:", await vis("셰이더 · 화면 편안함"), "/", await vis("플리커 완화 모드"));
  await shot("10_settings");
  await p.keyboard.press("Escape");

  /* 환생 로그는 세이브에 기록이 있어야 보임 — 생략 */

  console.log("----");
  console.log(errs.length ? errs.slice(0, 10).join("\n") : "pageerror/console 에러 0");
  await b.close();
})().catch((e) => { console.error("E2E FAIL:", e.message); process.exit(1); });
