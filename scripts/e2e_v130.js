/**
 * v1.3.0 E2E — 유저 지시 9건 검증
 *  #에셋통합  부팅 로드 에러 0 + vfx3 텍스처/사운드 로드 확인
 *  #1 SNS 임시 비활성화 (안내 문구 표시)
 *  #2 ☰ 버튼 삭제 (HUD에서 제거)
 *  #3 날개 항상 등 뒤 (depth < body 유지 + flipX 미적용)
 *  #5 오로라 강화 (auroraRings 2장 + twinkles 4개 생성)
 *  #6 소모품 개수/Max (UseQtyBox 렌더)
 *  #7 랭킹 (콘텐츠 허브 랭킹 탭 + /api/rank 200)
 *  #9 층식맵 (요새 유적 타일 + 상자 상호작용 + 층 전환)
 *  + pageerror 0
 */
const { chromium } = require("playwright");

(async () => {
  const results = [];
  const ok = (name, pass, detail = "") => {
    results.push({ name, pass });
    console.log(`${pass ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
  };
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 200)));
  p.on("console", (m) => { if (m.type() === "error") errs.push("CONSOLE: " + m.text().slice(0, 160)); });
  const shot = (n) => p.screenshot({ path: `/tmp/e2e_130_${n}.png` });

  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2600);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  const badge = await p.getByText("v1.4.1", { exact: false }).first().isVisible().catch(() => false);
  ok("[부팅] 타이틀 도달", badge, "v1.4.0 배지 표시");
  await shot("00_title");

  /* 에셋 통합 — 지연 로드 완료 + vfx3 텍스처 존재 */
  await p.evaluate(async () => {
    for (let i = 0; i < 80; i++) {
      if ((window).__SERTZ_DEFER_DONE__) break;
      await new Promise((r) => setTimeout(r, 250));
    }
  });
  const assets = await p.evaluate(() => {
    const w = window.__SERTZ__?.game;
    const sc = w?.scene?.getScene("title");
    const tex = sc?.textures ?? w?.textures;
    const has = (k) => !!tex?.exists(k);
    const snd = !!w?.cache?.audio?.exists?.("sfx_hit_basic");
    return { slash: has("vfx_slash"), ring: has("vfx_ring"), fw: has("vfx_fw_heart"), magic: has("vfx_magic"), map: has("map_ground"), snd, petal: has("vfx_petal") };
  });
  ok("[에셋] vfx_slash/vfx_ring/vfx_fw_heart 로드", assets.slash && assets.ring && assets.fw);
  ok("[에셋] vfx_magic/map_ground/vfx_petal 로드", assets.magic && assets.map && assets.petal);
  ok("[에셋] Drive SFX 로드 (sfx_hit_basic)", assets.snd);

  /* 여캠 생성 (백자) — 로비 3단 흐름: 이름 → 직업 → 외형 (v1.2.1 e2e 준용) */
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1200);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click();
  });
  await p.waitForTimeout(700);
  await p.locator("input").first().fill("시아");
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
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("생성!"))?.click();
  });
  await p.waitForTimeout(1400);
  await p.evaluate(() => { document.querySelector(".cursor-pointer")?.click(); });
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click();
  });
  await p.waitForTimeout(2600);
  for (let i = 0; i < 4; i++) { await p.mouse.click(640, 500); await p.waitForTimeout(400); }
  await p.waitForTimeout(900);

  const inWorld = await p.evaluate(() => {
    const w = window.__SERTZ__?.game;
    const sc = w?.scene?.getScene("world");
    return !!(sc && sc.player);
  });
  ok("[게임] 월드 진입", inWorld);
  await shot("01_world");

  /* #9 층식맵 — 요새 유적 존재 + 상자 상호작용 등록 */
  const keep = await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    return {
      rect: !!sc?.keepRect,
      tiles: sc?.keepTileImgs?.length ?? 0,
      chest: (sc?.interactables ?? []).some((i) => i.kind === "keepchest"),
      torchAnim: !!sc?.anims?.exists("keep_torch"),
      chestAnim: !!sc?.anims?.exists("keep_chest_open"),
    };
  });
  ok("[#9] 요새 유적 생성", keep.rect && keep.tiles >= 20, `tiles=${keep.tiles}`);
  ok("[#9] 유적 상자 상호작용 등록", keep.chest);
  ok("[#9] 횃불/상자 애니 등록", keep.torchAnim && keep.chestAnim);

  /* 층 전환 — 계단 위치로 순간이동 후 상승 */
  const layerSwap = await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!sc?.keepRect || !sc?.player) return { ok: false };
    const st = sc.keepStair;
    sc.player.setPosition(st.x + st.w / 2, st.y + 20);
    sc.tickKeepLayer();
    const after = sc.keepLayer;
    return { ok: after === 1, after };
  });
  ok("[#9] 계단 → 2층 레이어 전환", layerSwap.ok, `layer=${layerSwap.after}`);
  await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    sc.player.setPosition(sc.keepRect.x + sc.keepRect.w / 2, sc.keepRect.y + sc.keepRect.h - 10);
  });
  await p.waitForTimeout(400);
  await shot("02_keep_layer1");
  const layerBack = await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    sc.player.setPosition(sc.keepStair.x + sc.keepStair.w / 2, sc.keepStair.y + sc.keepStair.h * 0.9);
    sc.tickKeepLayer();
    return sc.keepLayer;
  });
  ok("[#9] 계단 → 지상 복귀", layerBack === 0, `layer=${layerBack}`);

  /* #5 오로라 강화 — cos_aurora 지급/착용 → 링 2장 + 트윙클 4개 */
  const aurora = await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    const pl = sc?.player;
    if (!pl) return { ok: false };
    if (!pl.cosmetics.includes("cos_aurora")) pl.cosmetics.push("cos_aurora");
    pl.setCosmeticSlot("cos_aurora", "aura");
    return { ok: true, rings: sc.auroraRings.length, tw: sc.auroraTwinkles.length };
  });
  ok("[#5] 오로라 링 2장 + 트윙클 4개", aurora.ok && aurora.rings === 2 && aurora.tw === 4, `rings=${aurora.rings} tw=${aurora.tw}`);
  await p.waitForTimeout(600);
  await shot("03_aurora");

  /* #3 날개 등 뒤 고정 — acc_wings_fairy 착용 depth/flip 검사 */
  const wings = await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    const pl = sc?.player;
    if (!pl) return { ok: false };
    if (!pl.cosmetics.includes("acc_wings_fairy")) pl.cosmetics.push("acc_wings_fairy");
    pl.setCosmeticSlot("acc_wings_fairy", "acc");
    sc.update(0, 16);
    const acc = (sc.accOverlays ?? []).find((a) => a.key === "acc_wings_fairy");
    if (!acc) return { ok: false, found: false };
    return { ok: true, found: true, depth: acc.img.depth, pdepth: pl.depth, flip: acc.img.flipX };
  });
  ok("[#3] 날개 depth 본체보다 뒤", wings.ok && wings.depth < wings.pdepth, `depth=${wings.depth} < ${wings.pdepth}`);
  ok("[#3] 날개 flipX 고정(반전 없음)", wings.ok && wings.flip === false);

  /* #1 SNS 비활성화 — 계정 패널 오픈 */
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("계정"))?.click();
  });
  await p.waitForTimeout(600);
  const sns = await p.evaluate(() => {
    const body = document.body.innerText;
    return {
      notice: body.includes("일시 중단"),
      google: body.includes("구글") && body.includes("카카오"),
    };
  });
  ok("[#1] SNS 임시 중단 안내 표시", sns.notice);
  await shot("04_sns");
  await p.keyboard.press("Escape");
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.getAttribute("aria-label")?.includes("계정 창 닫기"))?.click();
  });

  /* #2 ☰ 삭제 — HUD에 aria-label="메뉴 화면으로 나가기" 없음 */
  const noMenu = await p.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((x) => x.getAttribute("aria-label") === "메뉴 화면으로 나가기");
    return !btn;
  });
  ok("[#2] HUD ☰ 버튼 제거", noMenu);

  /* #6 소모품 개수/Max — 경험치 책 지급 후 가방에서 UseQtyBox 확인 */
  const qty = await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    const pl = sc?.player;
    if (!pl) return { ok: false };
    for (let i = 0; i < 12; i++) pl.owned.push("exp_book");
    sc.emitRpgState();
    return { ok: true };
  });
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.getAttribute("aria-label")?.includes("가방"))?.click();
  });
  await p.waitForTimeout(700);
  /* 경험치 책은 "기타" 탭 — 기본 장비 탭에서 전환 후 아이콘 타일(aria-label=아이템키) 클릭 */
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.trim() === "기타")?.click();
  });
  await p.waitForTimeout(500);
  await p.evaluate(() => {
    document.querySelector('button[aria-label="exp_book"]')?.click();
  });
  await p.waitForTimeout(500);
  const qtyBox = await p.evaluate(() => {
    const input = document.querySelector('input[aria-label="사용 수량"]');
    const max = Array.from(document.querySelectorAll("button")).find((x) => x.getAttribute("aria-label") === "전량 사용 수량 지정");
    return { input: !!input, max: !!max };
  });
  ok("[#6] 사용 수량 입력 + MAX 버튼 렌더", qty.ok && qtyBox.input && qtyBox.max);
  await shot("05_qty");

  /* #7 랭킹 탭 — 콘텐츠 허브 오픈 */
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.getAttribute("aria-label")?.includes("가방"))?.click();
  });
  await p.waitForTimeout(400);
  const rankRes = await p.evaluate(async () => {
    const r = await fetch("/api/rank");
    const j = await r.json();
    return { status: r.status, hasList: Array.isArray(j.list) };
  });
  ok("[#7] /api/rank 200", rankRes.status === 200 && rankRes.hasList);
  const hub = await p.evaluate(() => {
    /* v1.4.0 — 콘텐츠 버튼이 더보기 폴더 안으로 이동 → 먼저 펼친다 */
    Array.from(document.querySelectorAll("button")).find((x) => x.getAttribute("aria-label")?.includes("더보기"))?.click();
    return true;
  });
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.getAttribute("aria-label")?.includes("콘텐츠"))?.click();
    return true;
  });
  await p.waitForTimeout(600);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.trim() === "랭킹")?.click();
  });
  await p.waitForTimeout(900);
  const rankTab = await p.evaluate(() => {
    const body = document.body.innerText;
    return { title: body.includes("왕국 랭킹"), shop: body.includes("랭커 전용 상점") };
  });
  ok("[#7] 랭킹 탭 + 랭커 전용 상점 렌더", hub && rankTab.title && rankTab.shop);
  await shot("06_rank");

  /* pageerror 0 */
  const realErrs = errs.filter((e) => !e.includes("favicon") && !e.includes("404"));
  ok("[안정성] pageerror 0", realErrs.length === 0, realErrs.slice(0, 2).join(" | "));

  const passCount = results.filter((r) => r.pass).length;
  console.log(`\n=== ${passCount}/${results.length} PASS ===`);
  await b.close();
  process.exit(passCount === results.length ? 0 : 1);
})();
