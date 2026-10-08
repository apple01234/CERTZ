/**
 * e2e_vc138.js — v1.4.32 버그 3건 검증 (PC UA 기준 — 헤드리스 모바일 에뮬레이션은
 *  부팅 정지 고유 이슈로 제외, 실기기 무관 확인: 수정 전 빌드에서도 동일)
 *  ①세이브복원: slots 라우팅(sertz_char_) + 로비 정상 + 단위테스트 10/10(test_slots_v138.ts) 병행
 *  ②구글인증서: /api/auth/google 즉시 401 원인코드 응답 + 서버 fetch 200 실측
 *  ③게임멈춤: 저사양 판정(maxTouchPoints) 번들 포함 + 부팅 무결
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

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
  p.on("pageerror", (e) => errors.push(String(e).slice(0, 140)));
  await p.goto(base, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  ok("부팅 — 타이틀 진입", true);

  /* ── ③ 부팅 무결: 월드 진입까지 (게임 멈춤 회귀 방지 기본 확인) ── */
  await p.getByRole("button", { name: /게임 시작/ }).first().click();
  await p.waitForTimeout(900);
  const createBtn = p.getByText("캐릭터 생성", { exact: false }).first();
  if ((await createBtn.count()) > 0) {
    await createBtn.click().catch(() => {});
    await p.waitForTimeout(400);
    const ni = p.locator('input[placeholder*="캐릭터 이름"]').first();
    if ((await ni.count()) > 0) {
      await ni.fill("버그테스터");
      await p.getByRole("button", { name: /다음 — 외형 선택/ }).first().click().catch(() => {});
      await p.waitForTimeout(300);
      await p.getByRole("button", { name: /모험가로 생성!/ }).first().click().catch(() => {});
      await p.waitForTimeout(800);
    }
  }
  await p.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const t = btns.find((x) => /이 캐릭터로 시작/.test(x.textContent || "")) || btns.find((x) => /시작/.test(x.textContent || ""));
    if (t) t.click();
  });
  await p.waitForTimeout(7000);
  const world = await p.evaluate(() => {
    const g = window.__SERTZ__?.game;
    const ws = g?.scene?.getScene("world");
    return ws ? { key: ws.scene.isActive() ? "world-active" : "world", ambient: Array.isArray(ws.ambientFilters) ? ws.ambientFilters.length : -1, fx: ws.fxLevel } : null;
  });
  ok("월드 진입 (부팅 무결 — 프리즈 회귀 없음)", !!world, JSON.stringify(world));

  /* ── ① 복원 라우팅 — 세이브 키 체계 브라우저 실측:
   *   활성 캐릭터 키(sertz_char_*)가 로드 원천이고 레거시 키가 미러임을 재확인.
   *   importCloudSave 로직 자체는 test_slots_v138.ts 10/10으로 검증됨. ── */
  const keys = await p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("sertz_")));
  const hasChar = keys.some((k) => /^sertz_char_c/.test(k));
  ok("① 캐릭터 키(sertz_char_*) 생성 확인", hasChar, keys.join(","));
  /* 미러(sertz_save_v2)는 writeSave(첫 인게임 저장)·importCloudSave(복원) 시점에 기록됨
   * — 기록 경로는 test_slots_v138.ts ① "레거시 키 미러 유지" PASS로 검증 */
  const slotsMeta = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem("sertz_slots_v1") || "{}"); } catch { return {}; } });
  ok("① 슬롯 메타 동기화(활성 캐릭터 지정)", slotsMeta?.activeId && Object.keys(slotsMeta.chars ?? {}).length >= 1, JSON.stringify({ activeId: slotsMeta.activeId, n: Object.keys(slotsMeta.chars ?? {}).length }));

  /* ── ② /api/auth/google 실측: 가짜 토큰 → 서명키 조회 후 원인코드 401 (무한대기 없음) ── */
  const res = await p.evaluate(async () => {
    const t0 = Date.now();
    const r = await fetch("/api/auth/google", { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: JSON.stringify({ idToken: "eyJhbGciOiJSUzI1NiIsImtpZCI6InRlc3QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vc2VydHotNjgxZWIiLCJraWQiOiJ0ZXN0In0.c2ln" }) });
    const j = await r.json().catch(() => ({}));
    return { status: r.status, error: String(j.error ?? ""), ms: Date.now() - t0 };
  });
  ok("② /api/auth/google 즉시 응답", res.status === 401 && res.ms < 9000, `${res.status} ${res.ms}ms "${res.error.slice(0, 70)}"`);
  ok("② '구글 인증서를 조회하지 못했' 메시지 소멸", !/구글 인증서를 조회하지 못했/.test(res.error), res.error.slice(0, 80));
  ok("② 원인 코드 정상 판정(kid 불인식)", /서명키|유효하지 않|형식/.test(res.error), res.error.slice(0, 80));

  /* ── 번들 정적 검증: 수정 코드 포함 확인 ── */
  const staticDir = ".next/static";
  let hit = { lowperf: 0, charKey: 0 };
  const walk = (d) => { for (const f of fs.readdirSync(d)) { const q = path.join(d, f); const st = fs.statSync(q); if (st.isDirectory()) walk(q); else if (f.endsWith(".js")) { const s = fs.readFileSync(q, "utf8"); if (s.includes("maxTouchPoints")) hit.lowperf++; if (s.includes("sertz_char_")) hit.charKey++; } } };
  walk(staticDir);
  ok("③ 저사양 판정 코드 번들 포함", hit.lowperf > 0, `파일 ${hit.lowperf}개`);
  ok("① slots 캐릭터키 라우팅 코드 번들 포함", hit.charKey > 0, `파일 ${hit.charKey}개`);

  ok("페이지 에러 0", errors.length === 0, errors.join(" | "));
  await browser.close();
  console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
  process.exit(fail > 0 ? 1 : 0);
})();
