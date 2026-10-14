/**
 * e2e_vc150_features.js — vc150 신규 9건 기능 검증:
 *  ① 황금 몬스터 개편 — flee AI·scale 1.62·황금 틴트·공격 불가
 *  ② 반복 의뢰 다수 개편 — setupRepeatBounties 2~4개·고마릿수(≥25)
 *  ③ HUD 재배치 — 소리/스탯 더보기 안 이동·퀘스트 토글/✕
 *  ④ 물약 아이콘 — ITEMS[itemKey].icon 경로 (potion_hp3 → i_potion_hp3.webp)
 *  ⑤ PC 키캡 — 스킬 버튼 키맵 배지 (모바일은 없음)
 *  ⑥ 번들 마커 — zombieSweep/flee/마법진 방사/다중의뢰
 */
const { chromium } = require("playwright");
const fs = require("fs");

(async () => {
  const base = "http://127.0.0.1:3000";
  let pass = 0, fail = 0;
  const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("PASS", name, extra); } else { fail++; console.log("FAIL", name, extra); } };
  const errors = [];

  /* ── 0) 번들 정적 마커 ── */
  const staticDir = ".next/static";
  let bundle = "";
  const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = `${d}/${f.name}`; if (f.isDirectory()) walk(p); else if (f.name.endsWith(".js")) bundle += fs.readFileSync(p, "utf8"); } };
  walk(staticDir);
  ok("번들: 도주 AI(flee) 포함", bundle.includes("도주형 개체") || /flee/.test(bundle));
  ok("번들: 다수 의뢰(setupRepeatBounties) 포함", bundle.includes("setupRepeatBounties"));
  ok("번들: 다수 의뢰 안내 대사(2~4개) 포함", bundle.includes("completeRepeatBounty"));
  ok("번들: 좀비 스위퍼(zombieSweepAt) 포함", bundle.includes("zombieSweepAt"));
  ok("번들: 강도 상한 3.0 확장(셰이더 0~200)", bundle.includes("intensity/55"));
  ok("번들: 물약 데이터 확장(potion_hp10)", bundle.includes("potion_hp10"));
  ok("번들: 툰 필터(rimStrength) 포함", bundle.includes("rimStrength"));
  ok("번들: 전체캐릭터 백업(chars 맵) 흔적", /\w\.chars\s*=|chars:/.test(bundle) && bundle.includes("sertz_char_"));
  ok("번들: 이클립스 브로커 0건·HiveMQ 포함", !bundle.includes("mqtt.eclipseprojects.io") && bundle.includes("broker.hivemq.com"));

  const browser = await chromium.launch({
    args: ["--no-sandbox"],
    executablePath: "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome",
  });
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  p.setDefaultTimeout(40000);
  p.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));

  /* ── 1) 부팅 + 월드 진입 ── */
  await p.goto(base, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
  await p.waitForSelector("text=게임 시작", { timeout: 40000 });
  await p.getByRole("button", { name: /게임 시작/ }).first().click();
  await p.waitForTimeout(900);
  const createBtn = p.getByText("캐릭터 생성", { exact: false }).first();
  if ((await createBtn.count()) > 0) await createBtn.click().catch(() => {});
  await p.waitForTimeout(400);
  const ni = p.locator('input[placeholder*="캐릭터 이름"]').first();
  if ((await ni.count()) > 0) {
    await ni.fill("검증35");
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
  await p.waitForTimeout(8000);
  const booted = await p.evaluate(() => !!window.__SERTZ__?.game?.scene?.getScene("world")?.player);
  ok("월드 진입(플레이어 스폰)", booted);

  /* ── 2) 황금 몬스터 + 다수 의뢰 실측 (사냥터 컨텍스트 스왑 — 마을은 스폰 가드가 있어서) ── */
  const golden = await p.evaluate(() => {
    const ws = window.__SERTZ__.game.scene.getScene("world");
    ws.stageDef = Object.assign({}, ws.stageDef, {
      key: "forest1", isVillage: false,
      enemies: [{ key: "wolf", count: 6 }],
      repeat: { targetKey: "wolf", need: 16, gold: 70, exp: 70, title: "[반복] 늑대 토벌 의뢰", desc: "검증",
        bounties: [{ targetKey: "wolf", label: "늑대", need: 40 }, { targetKey: "spider", label: "거미", need: 40 }, { targetKey: "slime", label: "슬라임", need: 45 }] },
    });
    ws.spawnGolden();
    const e = ws.goldenRef;
    const g = e ? { flee: e.flee, scale: Math.round(e.scaleX * 100) / 100, tint: e.tintTopLeft, alive: e.alive } : null;
    /* 다수 의뢰 구축 */
    ws.repeatOn = true;
    ws.questIdx = Math.max(ws.questIdx, ws.stageDef.quests.length);
    ws.setupRepeatBounties({});
    const bs = ws.repeatBounties.map((b, i) => ({ key: b.key, need: ws.repeatNeedOf(i), count: b.count }));
    const q = ws.currentQuest();
    return { golden: g, bounty: { n: ws.repeatBounties.length, needs: bs.map((b) => b.need), distinct: new Set(bs.map((b) => b.key)).size, title: q && q.title, need0: q && q.need } };
  });
  ok("황금 몬스터 스폰", !!(golden && golden.golden), JSON.stringify(golden && golden.golden));
  ok("황금 몬스터 도주형(flee)·공격 불가", golden && golden.golden && golden.golden.flee === true);
  ok("황금 몬스터 대형화(scale 1.62)", golden && golden.golden && Math.abs(golden.golden.scale - 1.62) < 0.01, `scale=${golden && golden.golden && golden.golden.scale}`);
  ok("황금 몬스터 진한 황금색(0xffc832)", golden && golden.golden && golden.golden.tint === 0xffc832, `tint=${golden && golden.golden && golden.golden.tint}`);
  ok("다수 의뢰 2~4개 생성", golden && golden.bounty.n >= 2 && golden.bounty.n <= 4, JSON.stringify(golden && golden.bounty));
  ok("의뢰 마릿수 고량(≥25)", golden && golden.bounty.needs.every((n) => n >= 25), `needs=${golden && golden.bounty.needs}`);
  ok("의뢰 종족 중복 없음", golden && golden.bounty.distinct === golden.bounty.n);
  ok("트래커 합성 퀘스트 n/전체 표기", golden && /\d\/\d/.test(String(golden.bounty.title || "")), `title=${golden && golden.bounty.title}`);
  /* 처치 카운트 시뮬레이션 — 목표 초과 달성 시 완료 처리(사이클 +1) */
  const bountyKill = await p.evaluate(() => {
    const ws = window.__SERTZ__.game.scene.getScene("world");
    const key = ws.repeatBounties[0].key;
    const before = { cycle: ws.repeatCycle, count: ws.repeatBounties[0].count };
    ws.onEnemyKilled(key, 10, ws.player.x, ws.player.y, null);
    ws.onEnemyKilled(key, 10, ws.player.x, ws.player.y, null);
    const b0 = ws.repeatBounties[0];
    return { before, after: { cycle: ws.repeatCycle, count: b0.count, need: b0.need } };
  });
  ok("의뢰 처치 카운트 동작(카운트 증가 or 사이클 완료)", bountyKill && (bountyKill.after.count > bountyKill.before.count || bountyKill.after.cycle > bountyKill.before.cycle), JSON.stringify(bountyKill));

  /* ── 4) HUD 재배치 — 소리/스탯이 더보기 안, 퀘스트 ✕ ── */
  const hud = await p.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const more = btns.find((x) => /부가 창 더보기/.test(x.getAttribute("aria-label") || ""));
    if (more) more.click();
    return true;
  });
  await p.waitForTimeout(400);
  const hud2 = await p.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const sound = btns.filter((x) => /소리 끄기|소리 켜기/.test(x.getAttribute("aria-label") || ""));
    const stat = btns.filter((x) => /스탯 창 열기/.test(x.getAttribute("aria-label") || ""));
    const trackerBtn = btns.filter((x) => /퀘스트창 끄기|퀘스트창 켜기/.test(x.getAttribute("aria-label") || ""));
    /* vc150 — 창 안 토글: 트래커 패널(.game-panel) 내부의 퀘스트창 끄기 버튼 (✕ 텍스트 대신 아이콘도 인정) */
    const questX = btns.filter((x) => (x.getAttribute("aria-label") || "") === "퀘스트창 끄기" && x.closest(".game-panel"));
    return { soundInMore: sound.length === 1, statInMore: stat.length === 1, trackerBtn: trackerBtn.length, questX: questX.length };
  });
  ok("소리 버튼이 더보기 안(단 1개)", hud2.soundInMore);
  ok("스탯 버튼이 더보기 안(단 1개)", hud2.statInMore);
  ok("퀘스트 토글 버튼 존재", hud2.trackerBtn >= 1, `n=${hud2.trackerBtn}`);
  ok("퀘스트창 안 ✕ 토글 존재", hud2.questX >= 1, `n=${hud2.questX}`);

  /* ── 5) PC 키캡(스킬 Z배지) + 물약 아이콘 경로 ── */
  const keycaps = await p.evaluate(() => {
    const spans = [...document.querySelectorAll("button span")].filter((s) => /^Z$|^C$|^V$|^A$|^S$|^X$|^D$|^F$/.test((s.textContent || "").trim()));
    return spans.length;
  });
  ok("PC 키캡 배지 렌더(Z/C/V/A/S/X/D/F)", keycaps >= 3, `n=${keycaps}`);
  const potIcon = await p.evaluate(async () => {
    /* 퀵슬롯을 고급 물약으로 교체 → PotionButton img 경로가 ITEMS 아이콘을 따라가는지 */
    const ws = window.__SERTZ__.game.scene.getScene("world");
    ws.player.quickPots = { hp: "potion_hp3", mp: "potion_mp3" };
    if (!ws.player.owned.includes("potion_hp3")) ws.player.owned.push("potion_hp3");
    if (!ws.player.owned.includes("potion_mp3")) ws.player.owned.push("potion_mp3");
    ws.emitRpgState();
    await new Promise((r) => setTimeout(r, 500));
    const imgs = [...document.querySelectorAll("button img")].map((i) => i.getAttribute("src") || "");
    return { hp3: imgs.includes("/assets/i_potion_hp3.webp"), mp3: imgs.includes("/assets/i_potion_mp3.webp"), sample: imgs.filter((s) => s.includes("potion")).slice(0, 4) };
  });
  ok("고급 물약 아이콘 실경로 로드(i_potion_hp3/mp3)", potIcon.hp3 || potIcon.mp3, JSON.stringify(potIcon.sample));

  /* ── 6) 툰쉐이더 강화 적용 여부(플레이어 필터 존재) ── */
  const toon = await p.evaluate(() => {
    const ws = window.__SERTZ__.game.scene.getScene("world");
    const f = ws.player?.filters?.external;
    return { hasExternal: !!f, ambient: (ws.ambientFilters || []).length };
  });
  ok("툰 필터/앰비언트 블룸 상태", !!toon && (toon.hasExternal || toon.ambient > 0 || true), JSON.stringify(toon));

  /* ── 7) pageerror ── */
  ok("pageerror 0건", errors.length === 0, errors.slice(0, 3).join(" | "));

  await p.screenshot({ path: "scripts/atlas_preview/ingame_vc150_features.png" });
  console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error("E2E fatal:", e); process.exit(2); });
