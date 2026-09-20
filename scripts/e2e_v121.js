/**
 * v1.2.1 E2E — 유저 지시 7건 검증
 *  #1 치장 부착 위치 앵커 (왕관/후광/날개 — 시트 실루엣 기준 위치·날개 1.35배)
 *  #2 펫 BM 전용 (SHOP_STOCK 펫 0 · BM 전 펫 · isPremiumPet)
 *  #3 프리미엄 펫 라고스 상점 버튼 (인벤 DOM → shop 패널)
 *  #4 최적화 — 부팅 분할 로드 완료 플래그 + 직업 시트 애님 후등록 + __SERTZ_PERF__
 *  #5 비약→책 이름 (ITEMS 표기)
 *  #6 메뉴 나가기 — HUD ☰ → 오버레이 → 타이틀 전환 + 로비 오픈 + 재진입
 *  #7 미소녀 — chf0 시트 입술/볼터치 픽셀 존재 (파일 레벨)
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
  const shot = (n) => p.screenshot({ path: `/tmp/e2e_121_${n}.png` });

  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2400);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  const badge = await p.getByText("v1.4.0", { exact: false }).first().isVisible().catch(() => false);
  ok("[버전] 타이틀 배지 v1.4.0", badge);
  await shot("00_title");

  /* #4 부팅 분할 로드 — 타이틀 도달 시점에 백그라운드 로드 완료 */
  const defer = await p.evaluate(async () => {
    for (let i = 0; i < 80; i++) {
      if ((window).__SERTZ_DEFER_DONE__) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    const w = window.__SERTZ__?.game;
    const t = w?.scene?.getScene("title");
    return {
      done: !!(window).__SERTZ_DEFER_DONE__,
      jobAnim: !!t?.anims?.exists("jobf_archmage-idle"),
      jobTex: !!t?.textures?.exists("jobf_archmage_idle0"),
      costAnim: !!t?.anims?.exists("cost_silver-idle"),
      gmAnim: !!t?.anims?.exists("gm-idle"),
    };
  });
  ok("[#4] 지연 로드 완료", defer.done);
  ok("[#4] jobf 애님 후등록", defer.jobAnim && defer.jobTex);
  ok("[#4] cost 애님 후등록", defer.costAnim);
  ok("[#4] gm 애님 후등록", defer.gmAnim);

  /* 여캠 생성 (백자) */
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
  for (let i = 0; i < 5; i++) { await p.mouse.click(640, 500); await p.waitForTimeout(450); }
  await p.waitForTimeout(900);

  const inWorld = await p.evaluate(() => {
    const s = window.__SERTZ__?.game?.scene?.getScene("world");
    return { has: !!s?.player, tex: s?.player?.texture?.key ?? null };
  });
  ok("[게임] 여캠 진입", inWorld.has && String(inWorld.tex).startsWith("chf0_"), `tex=${inWorld.tex}`);

  /* #2/#5 데이터 정적 검증 */
  const data = await p.evaluate(() => {
    const d = window.__SERTZ_DEBUG__.data;
    return {
      goldPets: d.SHOP_STOCK.filter((k) => String(k).startsWith("pet_")),
      bmPets: d.BM_STOCK.filter((k) => String(k).startsWith("pet_")),
      premium: {
        reaper: d.isPremiumPet("pet_reaper"),
        unicorn: d.isPremiumPet("pet_unicorn"),
        golem: d.isPremiumPet("pet_golem"),
        atlas: d.isPremiumPet("pet_atlas"),
        slime: d.isPremiumPet("pet_slime"),
        pixie: d.isPremiumPet("pet_pixie"),
      },
      names: {
        s: d.ITEMS.exp_book_s.name,
        m: d.ITEMS.exp_book_m.name,
        l: d.ITEMS.exp_book_l.name,
      },
      slimeBm: d.ITEMS.pet_slime.bmPrice,
      pixieBm: d.ITEMS.pet_pixie.bmPrice,
    };
  });
  ok("[#2] 골드 상점 펫 0종", data.goldPets.length === 0, JSON.stringify(data.goldPets));
  ok("[#2] BM 펫 9종 전량", data.bmPets.length === 9, JSON.stringify(data.bmPets));
  ok("[#2] 슬라임/핑크이 BM가", data.slimeBm === 8 && data.pixieBm === 14, `${data.slimeBm}/${data.pixieBm}`);
  ok("[#3] isPremiumPet 4종+하위 2종", data.premium.reaper && data.premium.unicorn && data.premium.golem && data.premium.atlas && !data.premium.slime && !data.premium.pixie, JSON.stringify(data.premium));
  ok("[#5] 비약→책 이름", data.names.s === "고급 성장의 책" && data.names.m === "태풍 성장의 책" && data.names.l === "극한 성장의 책", JSON.stringify(data.names));

  /* #1 치장 부착 위치 앵커 — 왕관/후광/날개 장착 후 실측 */
  const acc = await p.evaluate(() => {
    const s = window.__SERTZ__?.game?.scene?.getScene("world");
    const pl = s.player;
    const out = {};
    /* 소유권 부여 (미소유면 setAccessory가 거절) */
    for (const k of ["acc_crown", "acc_halo", "acc_wings_devil"]) {
      if (!pl.cosmetics.includes(k)) pl.cosmetics.push(k);
    }
    const set = (k) => {
      pl.setCosmeticSlot(null, "aura"); // 오라 슬롯 초기화
      pl.setAccessory(k);
      s.syncCosmeticAura();
      s.update(16, 16);
    };
    set("acc_crown");
    const crown = s.accOverlays[0]?.img;
    out.crown = crown ? { y: crown.y, py: pl.y, tex: crown.texture.key } : null;
    set("acc_halo");
    const halo = s.accOverlays[0]?.img;
    out.halo = halo ? { y: halo.y } : null;
    set("acc_wings_devil");
    const wing = s.accOverlays[0]?.img;
    out.wing = wing ? { y: wing.y, sx: wing.scaleX, wdepth: wing.depth, pdepth: pl.depth, behind: wing.depth < pl.depth } : null;
    out.tex = pl.texture.key;
    pl.setAccessory(null);
    s.syncCosmeticAura();
    return out;
  });
  const s0 = await p.evaluate(() => {
    const s = window.__SERTZ__?.game?.scene?.getScene("world");
    /* v1.2.1 — 현재 텍스처 프레임의 실제 앵커(headTop)로 판정 (idle 고정 가정 폐기 —
     *  걷기/공격 프레임은 머리 높이가 다르고, 그에 맞게 부착되는 것이 이번 수정의 핵심) */
    const an = (window.__SERTZ_DEBUG__?.anchors ?? {})[s.player.texture.key] ?? [15, 35, 60, 56];
    return { py: s.player.y, ht: an[0], tex: s.player.texture.key };
  });
  const wantCrown = s0.py + (s0.ht - 32) - 2;
  const wantWing = s0.py + (s0.ht + 11 - 5 - 32); /* v1.3.0 — 정면(idle) dy=-5: 날개를 등 쪽으로 밀어 항상 등 뒤 유지 */
  ok("[#1] 왕관 머리 위 부착 (프레임 앵커)", acc.crown && Math.abs(acc.crown.y - wantCrown) <= 2, `crown.y=${acc.crown?.y} want=${wantCrown} tex=${s0.tex}`);
  ok("[#1] 후광 머리 위 부착", acc.halo && acc.halo.y < s0.py + (s0.ht - 32) - 5, `halo.y=${acc.halo?.y} headTop=${s0.py + (s0.ht - 32)}`);
  ok("[#1] 날개 1.35배 확대", acc.wing && Math.abs(acc.wing.sx - 1.35) < 0.01, `sx=${acc.wing?.sx}`);
  ok("[#1] 날개 플레이어 뒤 depth", acc.wing?.behind === true, `wing=${acc.wing?.wdepth} player=${acc.wing?.pdepth}`);
  ok("[#1] 날개 어깨 높이 부착 (프레임 앵커)", acc.wing && Math.abs(acc.wing.y - wantWing) <= 2, `wing.y=${acc.wing?.y} want=${wantWing}`);

  /* #3 프리미엄 펫 — pet_atlas 지급·소환 → 인벤에서 라고스 상점 버튼 */
  const petUI = await p.evaluate(() => {
    const s = window.__SERTZ__?.game?.scene?.getScene("world");
    const pl = s.player;
    if (!pl.pets.includes("pet_atlas")) pl.pets.push("pet_atlas");
    pl.setPet("pet_atlas");
    s.emitRpgState();
    return { pet: pl.pet };
  });
  ok("[#3] 아틀라스 소환", petUI.pet === "pet_atlas", petUI.pet);
  /* 인벤 열기 (HUD 가방 버튼) */
  await p.evaluate(() => { Array.from(document.querySelectorAll("button")).find((x) => x.getAttribute("aria-label")?.startsWith("가방 열기"))?.click(); });
  await p.waitForTimeout(700);
  /* 캐시 탭 → 펫 선택 */
  await p.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll("button"));
    const cash = tabs.find((x) => x.textContent?.trim() === "캐시");
    if (cash) cash.click();
  });
  await p.waitForTimeout(500);
  await p.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll("img"));
    const pet = imgs.find((i) => i.src.includes("pet_atlas"));
    pet?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    pet?.click();
  });
  await p.waitForTimeout(500);
  const shopBtn = await p.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.trim() === "라고스 상점");
    return { exists: !!btn, tag: btn?.textContent ?? null };
  });
  ok("[#3] 인벤 라고스 상점 버튼", shopBtn.exists);
  if (shopBtn.exists) {
    await p.evaluate(() => {
      Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.trim() === "라고스 상점")?.click();
    });
    await p.waitForTimeout(600);
    const shopOpen = await p.evaluate(() => !!document.querySelector("input[placeholder*='검색']") || !!Array.from(document.querySelectorAll("p")).find((x) => x.textContent?.includes("상인 라고스")));
    ok("[#3] 라고스 상점 열림", shopOpen);
    await shot("01_lagos_shop");
    /* 닫기 */
    await p.evaluate(() => {
      const close = Array.from(document.querySelectorAll("button")).find((x) => x.getAttribute("aria-label")?.includes("닫기"));
      close?.click();
    });
    await p.waitForTimeout(400);
  }
  await shot("02_inventory");

  /* #4 성능 훅 */
  const perf = await p.evaluate(() => (window).__SERTZ_PERF__ ?? null);
  ok("[#4] __SERTZ_PERF__ 노출", !!perf && typeof perf.fps === "number", perf ? `fps=${perf.fps}` : "null");

  /* #7 미소녀 — chf0_idle0 입술 픽셀 존재 (LIPS 색 (222,106,120)) */
  const lips = await p.evaluate(async () => {
    const res = await fetch("/assets/chf0_idle0.webp");
    const blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    const cv = document.createElement("canvas");
    cv.width = bmp.width; cv.height = bmp.height;
    const g = cv.getContext("2d");
    g.drawImage(bmp, 0, 0);
    const d = g.getImageData(0, 0, cv.width, cv.height).data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] === 222 && d[i + 1] === 106 && d[i + 2] === 120 && d[i + 3] === 255) return true;
    }
    return false;
  });
  ok("[#7] chf0 입술/블러셔 픽셀", lips);

  /* #6 메뉴 나가기 — v1.3.0: HUD ☰ 삭제(지시 #2) → 설정 패널의 메뉴 화면 카드로 경로 이전 */
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.getAttribute("aria-label")?.includes("설정/키 매핑 열기"))?.click();
  });
  await p.waitForTimeout(400);
  const menuCard = await p.evaluate(() => !!Array.from(document.querySelectorAll("p")).find((x) => x.textContent?.trim() === "메뉴 화면") && !!Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.trim() === "캐릭터 선택"));
  ok("[#6] 설정 패널 메뉴 화면 카드(종료 경로)", menuCard); /* v1.3.0 — ☰ 삭제로 오버레이 경로 폐지, 설정 카드에서 직접 emit */
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.trim() === "캐릭터 선택")?.click();
  });
  await p.waitForTimeout(400);
  await shot("03_exitmenu");
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.trim().startsWith("캐릭터 선택 화면으로"))?.click();
  });
  await p.waitForTimeout(1800);
  const backToTitle = await p.evaluate(() => {
    const w = window.__SERTZ__?.game;
    const active = w?.scene?.scenes?.filter((sc) => sc?.scene?.isActive())?.map((sc) => sc.scene.key) ?? [];
    const lobby = !!Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작") || x.textContent?.includes("캐릭터 생성"));
    return { active, lobby };
  });
  ok("[#6] 타이틀 전환", backToTitle.active.includes("title") && !backToTitle.active.includes("world"), JSON.stringify(backToTitle.active));
  ok("[#6] 캐릭터 선택(로비) 오픈", backToTitle.lobby);
  await shot("04_lobby");

  /* 로비에서 이어하기 → 재진입 (지연로드 게이트 통과 재확인) */
  await p.evaluate(() => {
    const cont = Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"));
    cont?.click();
  });
  await p.waitForTimeout(2800);
  for (let i = 0; i < 3; i++) { await p.mouse.click(640, 500); await p.waitForTimeout(400); }
  const reenter = await p.evaluate(() => {
    const s = window.__SERTZ__?.game?.scene?.getScene("world");
    return { has: !!s?.player, anim: s?.player?.anims?.currentAnim?.key ?? null };
  });
  ok("[#6] 재진입 정상", reenter.has, `anim=${reenter.anim}`);

  const fails = results.filter((r) => !r.pass).length;
  console.log(`\n=== v1.2.1 E2E: ${results.length - fails}/${results.length} PASS, pageerror=${errs.length} ===`);
  errs.slice(0, 6).forEach((e) => console.log("  " + e));
  await b.close();
  process.exit(fails > 0 ? 1 : 0);
})();
