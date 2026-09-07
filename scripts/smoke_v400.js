/**
 * v4.0.0 "이세카이 업데이트" 스모크 테스트
 *  — ISEKAI GATE 오마주 20종 시스템 실측 (Playwright headless)
 *  검증: 출석부/오프라인/티켓 → 게이트(웨이브·카드·실버·정산) → 옷장 던전 → 가챠/쿠폰/배지/룬/성좌/업적 → 도장 회귀
 */
const { chromium } = require("playwright");

const BASE = process.env.SERTZ_URL || "http://localhost:3000";
const results = [];
function ok(name, cond, detail = "") {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
}

(async () => {
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--disable-web-security"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });

  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(6500);

  /* 새 게임 (클린 세이브) */
  await page.evaluate(() => localStorage.removeItem("sertz_save_v2"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6500);
  let clicked = false;
  for (let i = 0; i < 3 && !clicked; i++) {
    clicked = await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      const b = btns.find((x) => x.textContent?.includes("새로운 모험"));
      if (b) { b.click(); return true; }
      return false;
    });
    if (!clicked) await page.waitForTimeout(2500);
  }
  ok("타이틀 → 새 게임 진입", clicked);
  await page.waitForTimeout(5000);

  const scene = () => page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    if (!s) return null;
    return { key: s.stageDef?.key, gateActive: s.gateActive, closetActive: s.closetActive, lv: s.player?.lv };
  });

  const st0 = await scene();
  ok("WorldScene 부팅", !!st0 && st0.key === "village", `stage=${st0?.key}`);

  /* 1) 출석부 자동 체크 (신규 게임 → 1일차) */
  const attend = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("sertz_save_v2") || "{}");
    return { count: d.attend?.count ?? 0, last: d.attend?.last ?? "" };
  });
  ok("출석부 자동 체크", attend.count >= 1 && attend.last.length === 10, `count=${attend.count} last=${attend.last}`);

  /* 2) 일일 티켓 지급 */
  const tickets = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("sertz_save_v2") || "{}");
    return d.tickets;
  });
  ok("일일 티켓 지급 (게이트3/던전2)", tickets?.gate === 3 && tickets?.closet === 2, JSON.stringify(tickets));

  /* 3) GM → 이세카이 게이트 입장 */
  await page.evaluate(() => window.__SERTZ_EB__.emit("rpg:gm", { type: "gate" }));
  await page.waitForTimeout(2600);
  const g0 = await scene();
  ok("게이트 입장 + 빌드", g0?.key === "gate" && g0.gateActive === true, `stage=${g0?.key} gateActive=${g0?.gateActive}`);

  /* 4) 웨이브 1 스폰 (2.6초 브레이크 후) */
  await page.waitForTimeout(3500);
  const g1 = await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    return { wave: s.gateWave, enemies: s.enemies.filter((e) => e.alive).length, phase: s.gatePhase, core: Math.round(s.gateCoreHp), coreMax: Math.round(s.gateCoreMax), silver: s.gateSilver };
  });
  ok("웨이브 1 스폰", g1.wave === 1 && g1.enemies > 0 && g1.phase === "fight", `enemies=${g1.enemies} core=${g1.core}/${g1.coreMax}`);
  ok("게이트 코어 HP 스케일", g1.coreMax > 1000, `coreMax=${g1.coreMax}`);

  /* 5) 웨이브 클리어 → 카드 선택 페이즈 */
  await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    s.enemies.forEach((e) => { if (e.alive) e.takeDamage(1e9, { x: 0, y: -1 }, 0); });
  });
  await page.waitForTimeout(900);
  const g2 = await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    return { phase: s.gatePhase, cards: s.gatePendingCards.length, silver: s.gateSilver };
  });
  ok("웨이브 클리어 → 카드 페이즈", g2.phase === "cards" && g2.cards === 3, `phase=${g2.phase} cards=${g2.cards} silver=${g2.silver}`);

  /* 6) 카드 선택 → 런 버프 적용 (선택된 카드의 실제 스탯 검증) */
  const pick = await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    const EB = window.__SERTZ_EB__;
    const card = s.gatePendingCards[0];
    const rb0 = { ...s.player.runBuffs };
    EB.emit("rpg:gatePick", 0);
    const rb1 = { ...s.player.runBuffs };
    const stat = card.stat;
    const changed =
      (stat.atkPct && rb1.atkPct > rb0.atkPct) ||
      (stat.skillPct && rb1.skillPct > rb0.skillPct) ||
      (stat.crit && rb1.crit > rb0.crit) ||
      (stat.lifesteal && rb1.lifesteal > rb0.lifesteal) ||
      (stat.silverPct && rb1.silverPct > rb0.silverPct) ||
      (stat.speedPct && rb1.speedPct > rb0.speedPct) ||
      (stat.hpPct && s.player.runHpFlat > 0);
    return { phase: s.gatePhase, card: card.id, stat: card.desc, changed };
  });
  ok("카드 선택 → 인런 버프", pick.phase === "break" && pick.changed, JSON.stringify(pick));

  /* 7) 실버 상점 (실버 부족 시 배너만 — 예외 없는지) */
  await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    s.gateSilver = 500;
    window.__SERTZ_EB__.emit("rpg:gateShop", "sh_mp");
  });
  await page.waitForTimeout(300);
  const g3 = await page.evaluate(() => window.__SERTZ_SCENE__.gateSilver);
  ok("실버 상점 구매 동작", g3 < 500, `silver=${g3}`);

  /* 8) 게이트 정산 (중간 퇴장) — 보상/티켓/랭킹 제출 */
  const beforeGold = await page.evaluate(() => window.__SERTZ_SCENE__.player.gold);
  await page.evaluate(() => window.__SERTZ_SCENE__.finishGate("exit"));
  await page.waitForTimeout(700);
  const settled = await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    const d = JSON.parse(localStorage.getItem("sertz_save_v2") || "{}");
    return { gold: s.player.gold, gateBest: s.gateBest, saveBest: d.gateBest, runBuffsAtk: s.player.runBuffs.atkPct, gateActive: s.gateActive };
  });
  ok("게이트 정산 (골드/기록/버프 해제)", settled.gold > beforeGold && settled.gateBest >= 1 && settled.runBuffsAtk === 0 && !settled.gateActive, JSON.stringify(settled));

  /* 9) 옷장 던전 */
  await page.waitForTimeout(2500); // 복귀 전환 대기
  await page.evaluate(() => window.__SERTZ_EB__.emit("rpg:gm", { type: "closet" }));
  await page.waitForTimeout(2600);
  const c0 = await scene();
  ok("옷장 던전 입장", c0?.key === "closet" && c0.closetActive === true, `stage=${c0?.key}`);
  await page.waitForTimeout(3000);
  const c1 = await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    const gold = s.player.gold;
    return { enemies: s.enemies.filter((e) => e.alive).length, gold };
  });
  ok("던전 몬스터 지속 소환", c1.enemies > 0, `enemies=${c1.enemies}`);
  await page.evaluate(() => window.__SERTZ_SCENE__.finishCloset());
  await page.waitForTimeout(600);
  const c2 = await page.evaluate(() => ({ active: window.__SERTZ_SCENE__.closetActive, best: window.__SERTZ_SCENE__.closetBest }));
  ok("던전 정산 + 최고기록", !c2.active && c2.best >= 0, JSON.stringify(c2));

  /* 10) GM 무료 뽑기 + 가챠 */
  await page.waitForTimeout(2400); // 마을 복귀 대기
  await page.evaluate(() => window.__SERTZ_EB__.emit("rpg:gm", { type: "freegacha" }));
  await page.waitForTimeout(300);
  const fg = await page.evaluate(() => window.__SERTZ_SCENE__.gachaTickets);
  ok("GM 무료 뽑기 → 뽑기권 +1", fg >= 1, `tickets=${fg}`);
  await page.evaluate(() => window.__SERTZ_EB__.emit("rpg:isekai", { action: "gacha" }));
  await page.waitForTimeout(500);
  const gacha = await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    return { figures: s.figures.length, tickets: s.gachaTickets };
  });
  ok("피규어 가챠 1회", gacha.figures >= 1 || gacha.tickets === fg - 1, JSON.stringify(gacha));

  /* 11) 쿠폰 */
  const cp = await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    const g0 = s.player.gold;
    window.__SERTZ_EB__.emit("rpg:isekai", { action: "coupon", code: "hellosertz" });
    const g1 = s.player.gold;
    return { g0, g1, coupons: s.couponsUsed.length, tickets: s.gachaTickets };
  });
  ok("쿠폰 HELLOSERTZ 사용", cp.g1 > cp.g0 && cp.coupons === 1, JSON.stringify(cp));

  /* 12) 조각 상점 → 룬 구매/합성/장착 */
  await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    s.shards += 200; // 테스트용 충전
    window.__SERTZ_EB__.emit("rpg:isekai", { action: "shardBuy", id: "sh_rune" });
  });
  await page.waitForTimeout(300);
  const rune = await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    const keys = Object.keys(s.runes);
    if (keys.length === 0) return { has: false };
    const kind = keys[0].split("#")[0];
    window.__SERTZ_EB__.emit("rpg:isekai", { action: "runeEquip", key: keys[0], slot: 0 });
    return { has: true, key: keys[0], equipped: s.runeSlots[0] };
  });
  ok("룬 획득 + 장착", rune.has && rune.equipped === rune.key, JSON.stringify(rune));

  /* 13) 성좌 개방 */
  await page.evaluate(() => window.__SERTZ_EB__.emit("rpg:isekai", { action: "constelUnlock", ck: "aries", idx: 0 }));
  await page.waitForTimeout(300);
  const constel = await page.evaluate(() => window.__SERTZ_SCENE__.constel.length);
  ok("성좌 개방", constel === 1, `nodes=${constel}`);

  /* 14) 업적 수령 (첫 사냥 100마리 — 강제로 프로그레스 채워 수령 검증은 프록시로) */
  await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    s.monsterKills["wolf"] = 150;
    s.monsterKills["golem"] = 50;
    window.__SERTZ_EB__.emit("rpg:isekai", { action: "achClaim", id: "ach_h1" });
  });
  await page.waitForTimeout(300);
  const ach = await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    return { claimed: s.achClaimed.includes("ach_h1"), shards: s.shards };
  });
  ok("업적 수령 → 조각 지급", ach.claimed, JSON.stringify(ach));

  /* 15) 필드 사냥 → 일일 토벌 카운트 */
  await page.waitForTimeout(1800);
  const hunt = await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    window.__SERTZ_EB__.emit("rpg:isekai", {}); // 예외 없음 확인
    return { dailyHunts: s.dailyHunts };
  });
  ok("일일 토벌 카운트 존재", typeof hunt.dailyHunts === "number" && hunt.dailyHunts >= 0, JSON.stringify(hunt));

  /* 16) UI 패널 개폐 */
  await page.evaluate(() => window.__SERTZ_EB__.emit("ui:panel", { panel: "isekai" }));
  await page.waitForTimeout(500);
  const hubOpen = await page.evaluate(() => !!document.body.textContent?.includes("이세카이 허브"));
  ok("이세카이 허브 패널 열림", hubOpen);
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__SERTZ_EB__.emit("ui:panel", { panel: "benefit" }));
  await page.waitForTimeout(500);
  const benefitOpen = await page.evaluate(() => !!document.body.textContent?.includes("출석부"));
  ok("혜택 패널 열림 (출석부/일일퀘/쿠폰)", benefitOpen);
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));

  /* 17) 무릉도장 회귀 (기존 기능 무손상) */
  await page.evaluate(() => window.__SERTZ_EB__.emit("ui:panel", { panel: "gm" }));
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    document.querySelectorAll("button").forEach((b) => { if (b.textContent?.includes("무릉도장 입장")) b.click(); });
  });
  await page.waitForTimeout(2500);
  const d0 = await scene();
  ok("무릉도장 입장 (기존 기능)", d0?.key === "dojang", `stage=${d0?.key}`);
  const dummies = await page.evaluate(() => window.__SERTZ_SCENE__.enemies.filter((e) => e.dummy).length);
  ok("도장 허수아비 6기", dummies === 6, `dummies=${dummies}`);

  /* 18) 소켓 + 유해 에러 */
  const netOk = await page.evaluate(() => {
    const s = window.__SERTZ_NET__;
    return !!s && (s.connected || s.connecting);
  });
  ok("멀티 소켓 연결", netOk);
  const harmful = errors.filter((e) => !/favicon|Download the React DevTools|net::|the server responded with a status|WebSocket|engineio|socket/i.test(e));
  ok("유해 콘솔 에러 0", harmful.length === 0, harmful.slice(0, 3).join(" | "));

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n==== 결과: ${passed}/${results.length} 통과 ====`);
  await browser.close();
  process.exit(passed === results.length ? 0 : 1);
})().catch((e) => { console.error("SMOKE FATAL", e); process.exit(2); });
