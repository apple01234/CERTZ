/**
 * v1.4.4 E2E — 첫 사냥터 Lv3 교착 근본 수정 검증
 *  ① 초행자 훈련장 복구 — 훈련용 늑대 3마리 + trainSpawns + 표지판 (2101c7b에서 유실된 분)
 *  ② 보물상자 유지 — keepchest interactable 1 + map_chest_f 텍스처 실제 로드 (렌더 가능)
 *  ③ v0 퀘스트 — "마을 NPC 3명과 인사" (need 3)
 *  ④ NPC 3명(주민2+카이엔) 대화 완료 → 레벨 3 달성 실측 (유저 지시 핵심)
 *  ⑤ 병합 무결성 — v1.4.3 리포트 6건 회귀: praid 진입 + r5 재림 재도전
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
  p.on("console", (m) => {
    const t = m.text();
    if (m.type() === "error" && !t.includes("favicon") && !t.includes("404")) errs.push("CONSOLE: " + t.slice(0, 160));
  });

  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2600);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });

  /* 부팅 + 배지 */
  const badge = await p.getByText("v1.4.4", { exact: false }).first().isVisible().catch(() => false);
  ok("[부팅] 타이틀 도달 (v1.4.4 배지)", badge);

  /* 지연 로드 대기 */
  for (let i = 0; i < 30 && !(await p.evaluate(() => !!window.__SERTZ_DEFER_DONE__)); i++) await p.waitForTimeout(300);

  console.log("STEP: defer wait done");
  /* 월드 진입 (로비 3단 흐름 준용) */
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1200);
  console.log("STEP: clicked game start");
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click();
  });
  await p.waitForTimeout(700);
  await p.locator("input").first().fill("세라144");
  await p.waitForTimeout(300);
  for (const label of ["직업 선택", "외형 선택"]) {
    await p.evaluate((lb) => {
      Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes(lb))?.click();
    }, label);
    await p.waitForTimeout(400);
  }
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("생성!"))?.click();
  });
  await p.waitForTimeout(1400);
  await p.evaluate(() => { document.querySelector(".cursor-pointer")?.click(); });
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click();
  });
  console.log("STEP: clicked start-with-char");
  /* 헤드리스는 씬 초기화가 수 초 소요 — 고정 대기 대신 player 생성 폴링(최대 60s) */
  let inWorld = false;
  for (let i = 0; i < 60; i++) {
    console.log(`POLL ${i} pre-eval`);
    await p.waitForTimeout(1000);
    inWorld = await p.evaluate(() => {
      const sc = window.__SERTZ__?.game?.scene?.getScene("world");
      return !!(sc && sc.player && sc.stageDef);
    }).catch((e) => { console.log("POLL eval err: " + String(e).slice(0, 120)); return false; });
    console.log(`POLL ${i} post=${inWorld}`);
    if (inWorld) break;
    if (i % 10 === 9) console.log(`STEP: polling world i=${i}`);
  }
  /* 인트로/대화 정리 (씬 준비된 뒤에만 판정) */
  for (let i = 0; i < 30; i++) {
    const d = await p.evaluate(() => {
      const sc = window.__SERTZ__?.game?.scene?.getScene("world");
      return !!(sc && sc.player && sc.dialoguing);
    }).catch(() => false);
    if (!d) break;
    await p.mouse.click(640, 500);
    await p.waitForTimeout(360);
  }
  ok("[게임] 월드 진입", inWorld);

  /* ① 초행자 훈련장 복구 — 훈련용 늑대 3 + trainSpawns 3 + 표지판 */
  const train = await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!sc) return null;
    const wolves = sc.enemies.filter((e) => e.active && e.displayName === "훈련용 늑대").length;
    let sign = false;
    for (const ch of sc.children.list) {
      if (ch?.text === "초행자 훈련장 — Lv.3까지 여기서 단련!") sign = true;
    }
    return {
      wolves,
      spawns: (sc.trainSpawns ?? []).length,
      sign,
      torch: sc.textures.exists("torch"),
      rune: sc.textures.exists("rune_circle"),
    };
  });
  ok("[훈련장] 훈련용 늑대 3마리 스폰", !!train && train.wolves === 3, train ? `wolves=${train.wolves}` : "씬 없음");
  ok("[훈련장] 스폰 지점 3개 등록 (리스폰 루트 복구)", !!train && train.spawns === 3, train ? `spawns=${train.spawns}` : "-");
  ok("[훈련장] 표지판 + 텍스처(torch/rune_circle)", !!train && train.sign && train.torch && train.rune, train ? `sign=${train.sign} torch=${train.torch} rune=${train.rune}` : "-");

  /* ② 보물상자 — interactable 1 + 시트 텍스처 실제 로드 + keepRect 부재 */
  const chest = await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!sc) return null;
    return {
      n: (sc.interactables ?? []).filter((it) => it.kind === "keepchest").length,
      tex: sc.textures.exists("map_chest_f"),
      sprite: !!sc.keepChestSprite,
      keepRect: !!sc.keepRect,
    };
  });
  ok("[보물상자] 유지 (interactable 1개 + 시트 로드 + 스프라이트)", !!chest && chest.n === 1 && chest.tex && chest.sprite, chest ? `n=${chest.n} tex=${chest.tex} sprite=${chest.sprite}` : "씬 없음");

  /* ③ v0 퀘스트 — 3명 기준 갱신 */
  const q0 = await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    const q = sc && sc.stageDef ? sc.currentQuest() : null;
    return q ? { id: q.id, title: q.title, need: q.need, label: q.targetLabel } : null;
  });
  ok("[퀘스트] v0 = 마을 NPC 3명과 인사 (need 3)", !!q0 && q0.id === "v0" && q0.need === 3 && /NPC 3명/.test(q0.title), q0 ? `${q0.id}:${q0.title} need=${q0.need}` : "퀘스트 없음");

  /* ④ NPC 3명 대화 → Lv3 달성 (유저 지시 핵심) */
  const talkStep = await p.evaluate(() => {
    const sc = window.__SERTZ__.game.scene.getScene("world");
    const talk = (key, npcId) => { sc.showDialogue(key, npcId); sc.resumeFromDialogue(); };
    const lvBefore = sc.player.lv;
    talk("villager1", "villager1");
    const after1 = { size: sc.talkedNpcs.size, lv: sc.player.lv };
    talk("villager2", "villager2");
    const after2 = { size: sc.talkedNpcs.size, lv: sc.player.lv };
    talk("jobMaster", "jobmaster"); // 전직 NPC 카이엔 — 3명째
    return {
      lvBefore,
      after1,
      after2,
      final: { size: sc.talkedNpcs.size, lv: sc.player.lv, questIdx: sc.questIdx },
    };
  });
  ok("[NPC3] 대화 누적 카운트 (주민2 + 카이엔 = 3)", !!talkStep && talkStep.final.size === 3, talkStep ? `1=${talkStep.after1.size} 2=${talkStep.after2.size} 3=${talkStep.final.size}` : "-");
  ok("[NPC3] 3명 대화 완료 → 레벨 3 달성", !!talkStep && talkStep.lvBefore < 3 && talkStep.final.lv === 3, talkStep ? `lv ${talkStep.lvBefore}→${talkStep.final.lv}` : "-");
  ok("[NPC3] v0 퀘스트 자동 완료 (questIdx 1 = 훈련 사냥)", !!talkStep && talkStep.final.questIdx === 1, talkStep ? `questIdx=${talkStep.final.questIdx}` : "-");

  /* 파티 보드 무한루프 수정 검증 — 응답성 + missionIds 3종 */
  const board = await Promise.race([
    p.evaluate(() => {
      const pc = window.__SERTZ_DEBUG__?.party;
      const bd = pc?.partyBoard?.();
      return { n: bd?.missionIds?.length ?? -1, ids: (bd?.missionIds ?? []).join(",") };
    }),
    new Promise((r) => setTimeout(() => r({ n: -99, ids: "FROZEN" }), 5000)),
  ]);
  ok("[파티보드] 무한루프 수정 — 3종 즉시 선택 (응답 유지)", !!board && board.n === 3, board ? `n=${board.n} ${board.ids}` : "-");

  /* ⑤ 병합 무결성 회귀 — v1.4.3 리포트 6건 (praid + r5 재림) */
  await p.waitForTimeout(600);
  /* NPC 테스트 직후 퀘스트 진행 대사가 남아 dialoguing=true일 수 있다 — 정리 후 emit */
  for (let i = 0; i < 20; i++) {
    const d = await p.evaluate(() => {
      const sc = window.__SERTZ__?.game?.scene?.getScene("world");
      if (sc && sc.player && sc.dialoguing) { sc.resumeFromDialogue(); return true; }
      return false;
    }).catch(() => false);
    if (!d) break;
    await p.waitForTimeout(200);
  }
  await p.evaluate(() => {
    const sc = window.__SERTZ__.game.scene.getScene("world");
    sc.monsterKills["boss_vord"] = 1;
    window.__SERTZ_EB__.emit("rpg:bossReplay", { ch: "r5", lv: "easy" });
  });
  let rbState = null;
  for (let i = 0; i < 40; i++) {
    await p.waitForTimeout(1000);
    rbState = await p.evaluate(() => {
      const sc = window.__SERTZ__?.game?.scene?.getScene("world");
      if (!sc) return null;
      return { stage: sc.stageDef?.key, bossName: sc.bossDef?.name ?? null, hasBoss: !!sc.boss, replayActive: sc.replayBossActive };
    });
    if (rbState && rbState.stage === "r5" && rbState.hasBoss) break;
    if (rbState && rbState.stage === "r5" && !rbState.hasBoss) await p.mouse.click(640, 500);
  }
  ok("[재림] r5 보스 재도전 진입 (병합 후에도 정상)", !!rbState && rbState.stage === "r5", rbState ? `stage=${rbState.stage}` : "씬 없음");
  ok("[재림] 재림 보스(베오르드) 스폰", !!rbState && rbState.hasBoss && /재림한 .*베오르드/.test(rbState.bossName ?? "") && rbState.replayActive, rbState ? `name=${rbState.bossName}` : "-");

  for (let i = 0; i < 20; i++) {
    const d = await p.evaluate(() => window.__SERTZ__?.game?.scene?.getScene("world")?.dialoguing);
    if (!d) break;
    await p.mouse.click(640, 500);
    await p.waitForTimeout(360);
  }
  await p.evaluate(() => window.__SERTZ_EB__.emit("rpg:partyRaid", {}));
  let raid = null;
  for (let i = 0; i < 40; i++) {
    await p.waitForTimeout(1000);
    raid = await p.evaluate(() => {
      const sc = window.__SERTZ__?.game?.scene?.getScene("world");
      if (!sc) return null;
      return { stage: sc.stageDef?.key, bossName: sc.bossDef?.name ?? null, hasBoss: !!sc.boss, emerald: sc.replayBossEmerald, returnActive: sc.returnActive };
    });
    if (raid && raid.stage === "praid" && raid.hasBoss) break;
    if (raid && raid.stage === "praid") await p.mouse.click(640, 500);
  }
  ok("[멀티] 공동 토벌전(praid) 진입 (병합 후에도 정상)", !!raid && raid.stage === "praid", raid ? `stage=${raid.stage}` : "씬 없음");
  ok("[멀티] 레이드 보스 스폰 + 복귀 포탈", !!raid && raid.hasBoss && /심연의 감시자/.test(raid.bossName ?? "") && raid.emerald >= 4 && raid.returnActive, raid ? `name=${raid.bossName} em=${raid.emerald}` : "-");

  /* 스크린샷 증거 */
  await p.waitForTimeout(700);
  try { await p.screenshot({ path: "/tmp/e2e_144_praid.png", timeout: 8000 }); } catch { /* 헤드리스 ReadPixels 지연 — 증거 스크린샷 실패는 무시 */ }

  /* 안정성 */
  const realErrors = errs.filter((e) => !e.includes("favicon") && !e.includes("404"));
  ok("[안정성] pageerror 0", realErrors.length === 0, realErrors.slice(0, 2).join(" | "));

  const pass = results.filter((r) => r.pass).length;
  console.log(`\n=== v1.4.4 E2E: ${pass}/${results.length} PASS, pageerror=${realErrors.length} ===`);
  await b.close();
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => { console.error("SCRIPT FAIL:", e.message); process.exit(1); });
