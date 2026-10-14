/**
 * vc153 E2E — 유저 제보 수정 5종 회귀 검증 (정적 + 라이브)
 *  ①타이틀 로그인 버튼 클릭 도달 (z-[60] — sertz-scroll z-40 덮음 해소)
 *  ②123456 로그인 E2E (라이브 — 로컬 서버)
 *  ③거래소 다수 등록 UI 요소 (수량 입력·MAX·총합)
 *  ④카오스 보스 에메랄드 차등 (bossEmeraldOf 계층)
 *  ⑤도적 제2궁극기 「사(死)의 일섬」 정의 + DeathSlash 모듈 로드
 *  ⑥스바르트알프헤임 보스 패턴 풀 (greenslash/vanish/shieldcast/magicburst/portalteleport)
 *  ⑦퀘스트 로그 fifth2 섹션 emit
 *  ⑧게이트 vc153
 */
const { chromium } = require("playwright");

const results = [];
const t = (name, ok, detail = "") => { results.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? " :: " + detail : ""}`); };

(async () => {
  /* ── 정적 소스 검증 ── */
  const fs = require("fs");
  const read = (p) => fs.readFileSync(p, "utf8");

  const gh = read("src/lib/ghdb.ts");
  t("ListingRec qty 필드", gh.includes("qty?: number"));

  const sapi = read("src/lib/sapi.ts");
  t("marketSnapshot qty 노출", sapi.includes("qty: l.qty ?? 1"));
  t("ownedCountOf 실보유 개수 검증", sapi.includes("ownedCountOf"));

  const listRoute = read("src/app/api/market/list/route.ts");
  t("list 라우트 qty 파싱", /qty.*Math\.min\(99/.test(listRoute));
  t("list 라우트 보유 수량 검증", listRoute.includes("have < qty"));

  const buyRoute = read("src/app/api/market/buy/route.ts");
  t("buy 라우트 부분 구매", buyRoute.includes("else l.qty = left") && buyRoute.includes("l.price * units"));

  const legacy = read("accounts/index.js");
  t("레거시 서버 qty 미러", legacy.includes("const qty = Math.max(1, Math.min(99")) && t("레거시 buy 부분구매", legacy.includes("left <= 0) delete db.market.listings"));

  const panels = read("src/components/game/Panels.tsx");
  t("거래소 수량 입력 UI", panels.includes('aria-label="등록 수량"') && panels.includes("MAX"));
  t("거래소 ×N 표기", panels.includes("×{l.qty}"));
  t("퀘스트 로그 fifth2 섹션 렌더", panels.includes("questLog.fifth2"));
  t("보스별 에메랄드 미리보기", panels.includes("bossEmeraldOf(bk, diff)"));

  const eb = read("src/components/game/EventBus.ts");
  t("QuestLogState fifth2 타입", eb.includes("fifth2?:"));

  const ws = read("src/game/scenes/WorldScene.ts");
  t("emitQuestLog fifth2 주입", ws.includes("fifth2: this.player.lv < 220 ? null : this.fifth2LogEntry()"));
  t("fifth2 진행 시 로그 갱신", ws.includes("vc153 (#신규4) — 퀘스트 로그가 열려 있으면"));
  t("치장 dialoguing 게이트 제거", !/const onCosmeticSet = \(v: \{ key: CosmeticKey \| null; slot\?: "aura" \| "outfit" \| "hair" \| "acc" \}\) => \{\s*\n\s*if \(!this\.player \|\| this\.dialoguing\) return;/.test(ws));
  t("치장 실패 배너", ws.includes("착용할 수 없다"));
  t("marketList qty 전달", ws.includes("v.qty ?? 1"));
  t("원격 死 근사", ws.includes("「사(死)의 일섬」 원격 근사") || ws.includes('g.textContent = "死"'));

  const stages = read("src/game/stages.ts");
  t("bossEmeraldOf 계층 공식", stages.includes("export function bossEmeraldOf"));
  t("카오스 차등 주석(수르트~나그라파르)", stages.includes("나그라파르 66"));
  t("BossAttackKind 신규 5종", ["greenslash", "vanish", "shieldcast", "magicburst", "portalteleport"].every((k) => stages.includes(`| "${k}"`)));
  t("abysslord 패턴 개편", stages.includes('sig: "greenslash"') && stages.includes('"portalteleport", "crystalburst"'));

  const boss = read("src/game/entities/Boss.ts");
  t("Boss vanished/shieldHold 모드", boss.includes('"vanished"') && boss.includes('"shieldHold"'));
  t("ShieldCast 무적 게이트", boss.includes("if (this.shieldInvuln)"));
  t("MagicBurst 반격", boss.includes("doShieldBurst"));
  t("PortalTeleport 구현", boss.includes('case "portalteleport"'));
  t("사망/페이즈 정리", boss.includes("cleanupSvartStates()"));

  const player = read("src/game/entities/Player.ts");
  t("도적 제2궁극기 DeathSlash 연결", player.includes("runDeathSlashCinematic"));
  t("cineLock 경직 유지", player.includes("cineLock"));
  t("즉발 450% + 출혈 25%", player.includes("DEATH_SLASH_CFG.instantMult") && player.includes("DEATH_SLASH_CFG.bleedMult"));

  const ds = read("src/game/fx/DeathSlash.ts");
  t("DeathSlash 설정 상수", ds.includes("instantMult: 4.5") && ds.includes("bleedMult: 0.25") && ds.includes("hitstopMs: 70"));
  t("「死」 연출", ds.includes('glyph.textContent = "死"'));
  t("안전 복구 타임아웃", ds.includes("safetyTimeoutMs: 12000"));
  t("자원 정리", ds.includes("renderer.dispose()") && ds.includes("cancelAnimationFrame"));

  const classes = read("src/game/classes.ts");
  t("제2궁극기 명칭 개편", classes.includes("사(死)의 일섬"));

  const gr = read("src/components/game/GameRoot.tsx");
  t("로그인 버튼 z-[60] 승격", gr.includes("z-[60]"));

  const srv = read("server.js");
  t("게이트 vc153 (server.js)", srv.includes("LATEST_CODE = 153") && srv.includes("1.0.11"));
  const route = read("src/app/api/version/route.ts");
  t("게이트 vc153 (route.ts)", route.includes("LATEST_CODE = 153"));
  const gradle = read("android/app/build.gradle");
  t("게이트 vc153 (gradle)", gradle.includes("versionCode 153"));
  const guide = read("public/apk-guide.html");
  t("게이트 vc153 (apk-guide)", guide.includes("v1.0.11 · vc153"));

  /* ── 라이브 검증 ── */
  const base = "http://localhost:3000";
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(base, { waitUntil: "networkidle", timeout: 30000 });

  /* ① 로그인 버튼 클릭 도달 */
  const btn = page.getByRole("button", { name: "계정 로그인" });
  await btn.click({ timeout: 5000 });
  await page.waitForTimeout(400);
  const panelVisible = await page.locator('input[placeholder*="비밀번호"], input[type="password"]').first().isVisible().catch(() => false);
  t("라이브 — 로그인 버튼 클릭 → 계정 패널 오픈", panelVisible);

  /* ② 123456 로그인 */
  const inputs = page.locator(".game-panel input");
  await inputs.nth(0).fill("123456");
  await inputs.nth(1).fill("123456");
  await page.getByRole("button", { name: "로그인", exact: true }).last().click();
  await page.waitForTimeout(2200);
  const loggedIn = await page.getByRole("button", { name: "로그아웃" }).isVisible().catch(() => false);
  t("라이브 — 123456 로그인 성공 (로그아웃 버튼 노출)", loggedIn);

  /* ⑧ 게이트 API */
  const v = await page.evaluate(async () => (await (await fetch("/api/version")).json()));
  t("라이브 — /api/version code:153", v.code === 153, `code=${v.code}`);

  /* ⑦ 퀘스트 로그 fifth2 — 게임 진입 후 검증은 무거워 소스 검증으로 대체됨 (위 정적 검증) */
  await browser.close();

  const pageErrCount = errors.length;
  t("pageerror 0", pageErrCount === 0, errors.slice(0, 2).join(" | "));

  const pass = results.filter((r) => r.ok).length;
  console.log(`\n==== vc153 E2E: ${pass}/${results.length} PASS ====`);
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => { console.error("E2E fatal:", e); process.exit(1); });
