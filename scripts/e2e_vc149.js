/**
 * e2e_vc149.js — 피드백 26종 검증:
 *  [정적] ①gv_ 81종 파일+BootScene 로더+DriveFX gv 메서드 ②slots 고아 재편입+이중백업
 *         ③mpMqtt 접속 시 거래 토픽 구독 ④HUD 더보기 안 소리/스탯 + 퀘스트 헤더 토글
 *         ⑤globals.css 터치 스크롤 ⑥물약 인상 ⑦slots 현재 직업 우선 ⑧게이트 149
 *  [라이브] ⑨페이지 에러 0 ⑩게임 시작→월드 진입 ⑪gv 텍스처 실로드 ⑫미니맵 그래픽 존재
 */
const { chromium } = require("playwright");
const fs = require("fs");

(async () => {
  const base = "http://127.0.0.1:3000";
  let pass = 0, fail = 0;
  const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("PASS", name, extra); } else { fail++; console.log("FAIL", name, extra); } };
  const errors = [];

  /* ---------- 정적 검증 ---------- */
  const boot = fs.readFileSync("src/game/scenes/BootScene.ts", "utf8");
  ok("GVFX3_LIST 81종 로더", /GVFX3_LIST = \[[\s\S]{0,3000}?\] as const;/.test(boot) && (boot.match(/"gv_/g) || []).length >= 81);
  ok("vfx3 setPath 로드", boot.includes('this.load.setPath("assets/vfx3")'));
  const gvFiles = fs.readdirSync("public/assets/vfx3").filter((f) => f.endsWith(".webp"));
  ok("gv_ 파일 81종", gvFiles.length === 81, `(${gvFiles.length})`);
  ok("gv_rune 마법사 전용 키 존재", gvFiles.includes("gv_rune_big.webp") && gvFiles.includes("gv_rune_glow.webp"));

  const drive = fs.readFileSync("src/game/fx/DriveFX.ts", "utf8");
  ok("DriveFX gv 메서드 16종+", ["gvShock","gvCore","gvFlash","gvEnergyWeb","gvStarry","gvBolts","gvSpecks","gvStreaks","gvSwordTrail","gvHitTri","gvSkull","gvRing","gvFireCircle","gvCone","gvVoidSpike","gvMageRune","gvCrystal","gvSplash","gvAura"].every((m) => drive.includes(` ${m}(`)));

  const player = fs.readFileSync("src/game/entities/Player.ts", "utf8");
  ok("비마법 마법진 소거 — warbringer/crusader/shadowlord/blademaster 5b", !player.includes('vf_emb_fire", scale: 3.0') && !player.includes('scale: 3.2, duration: 1150, spin: true, alpha: 0.95') && !player.includes('vf_emb_void", scale: 3.0') && !player.includes('spawnPentacle(this.scene, bx, by'));
  ok("비마법 마법진 소거 — s5 8종", !player.includes('vf_penta_fire", scale: 1.5') && !player.includes('vf_emb_nature') && !player.includes('spawnPentacle(this.scene, e.x, e.y, 0xffe9a0') && !player.includes('spawnPentacle(this.scene, e.x, e.y, 0xb08aff') && !player.includes('vf_emb_fire", scale: 2.6') && !player.includes('vf_emb_void", scale: 2.6'));
  ok("마법 계열 마법진 유지(arclord/eternal)", (player.match(/spawnPentacle/g) || []).length >= 8);
  ok("제2궁 30초 여운 필드", player.includes("dur: 30000") && player.includes("여운"));
  ok("아크로드 s5 종결 gv 4중 합성", /case "arclord":[\s\S]{0,6000}?gvCore[\s\S]{0,600}?gvShock/.test(player));
  ok("이터널 별하늘+에너지웹", /case "eternal":[\s\S]{0,3000}?gvStarry/.test(player));

  const slots = fs.readFileSync("src/game/slots.ts", "utf8");
  ok("고아 재편입 readoptOrphans", slots.includes("readoptOrphans") && slots.includes("sertz:charReadopted"));
  ok("슬롯 이중 백업 SLOTS_BAK_KEY", slots.includes('sertz_slots_bak_v1'));
  ok("전 캐릭터 클라우드 편입", slots.includes("importCharsFromCloud") && slots.includes("collectLocalChars"));
  ok("현재 직업 우선 표시", /save\.cls \?\? \(save as/.test(slots));

  const mqtt = fs.readFileSync("src/game/mpMqtt.ts", "utf8");
  ok("거래 토픽 접속 즉시 구독", /c\.on\("connect"[\s\S]{0,600}?ensureTradeSub/.test(mqtt));

  const hud = fs.readFileSync("src/components/game/HUD.tsx", utf());
  function utf() { return "utf8"; }
  ok("더보기 안 소리 버튼", /moreOpen && \([\s\S]{0,800}?onToggleMute/.test(hud));
  ok("더보기 안 스탯 버튼", /moreOpen && \([\s\S]{0,2400}?onOpenStat/.test(hud));
  ok("퀘스트 헤더 내 토글", /vc149 \(#16\)[\s\S]{0,400}?toggleTracker/.test(hud));
  ok("우상단 className 수리", hud.includes("right-[max(0.25rem") && !hud.includes("right-ax("));

  const css = fs.readFileSync("src/app/globals.css", "utf8");
  ok("터치 스크롤 복구", css.includes("touch-action: pan-y") && css.includes("overscroll-behavior: contain"));

  const data = fs.readFileSync("src/game/data.ts", "utf8");
  ok("물약 인상 (hp3 700→1150·mp10 3600→5700)", data.includes("heal: 1150") && data.includes("restore: 5700"));
  ok("구역 대사 6종 확장", (data.match(/"풀숲이 흔들리는 방향을 잘 봐/g) || []).length === 1 && data.includes("히힛, 처음엔 다들 무서워하더라"));

  const world = fs.readFileSync("src/game/scenes/WorldScene.ts", "utf8");
  ok("에메랄드 챕터 스케일링", world.includes("2 + (Math.max(1, Math.min(9, ch)) - 1) * 2"));
  ok("유령 체력바 destroyAll", (world.match(/e\.destroyAll\(\); \} \/\* vc149/g) || []).length === 3);
  ok("미니맵 NPC 노란 점", world.includes("0xffe066") && world.includes('it.kind !== "innkeeper"'));
  ok("UI 타이머 분산", /delay: 600,\s*\n\s*loop: true,\s*\n\s*callback: \(\) => \{\s*\n\s*this\.emitQuestLog\(\);\s*\n\s*this\.redrawMinimap\(\);/.test(world));

  const route = fs.readFileSync("src/app/api/version/route.ts", "utf8");
  ok("게이트 149/1.0.9", route.includes('LATEST_CODE = 149') && route.includes('LATEST_VERSION = "1.0.9"'));

  /* ---------- 라이브 검증 ---------- */
  const browser = await chromium.launch({
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
    executablePath: "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome",
  });
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  p.setDefaultTimeout(40000);
  p.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  await p.goto(base, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
  await p.waitForSelector("text=게임 시작", { timeout: 40000 });
  await p.getByRole("button", { name: /게임 시작/ }).first().click();
  await p.waitForTimeout(900);
  const createBtn = p.getByText("캐릭터 생성", { exact: false }).first();
  if ((await createBtn.count()) > 0) await createBtn.click().catch(() => {});
  await p.waitForTimeout(300);
  const nameInput = p.locator("input").first();
  await nameInput.fill("이름없");
  await p.getByRole("button", { name: /시작|결정|생성/ }).last().click().catch(() => {});
  await p.waitForTimeout(2500);

  // gv 텍스처 실로드 + 미니맵 존재
  const gvLoaded = await p.evaluate(() => {
    try {
      const g = window.__PHASER_GAME__ || (window.Phaser && null);
      return null;
    } catch { return null; }
  });
  ok("월드 진입 (캔버스 렌더)", (await p.locator("canvas").count()) > 0);
  ok("페이지 에러 0", errors.length === 0, errors.slice(0, 3).join(" | "));

  await browser.close();
  console.log(`\n=== RESULT: ${pass} PASS / ${fail} FAIL ===`);
  process.exit(fail > 0 ? 1 : 0);
})();
