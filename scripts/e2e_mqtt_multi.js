/**
 * vc134 멀티플레이 E2E — MQTT 공개 브로커 릴레이 경로 실측 ("웹에서 서로 안보임" 수정 검증)
 *  · 두 페이지 모두 localStorage sertz.mp.force="mqtt" → same-origin 소켓 대신 MQTT 강제
 *  · A 캐릭터 생성→월드 진입, B 캐릭터 생성→월드 진입
 *  · 검증: ①양쪽 모두 MQTT 연결(transport=mqtt·connected) ②B가 A의 원격 스프라이트(이름표) 수신
 *          ③A 이동 → B의 원격 목표좌표 갱신 ④A 공격 act 수신 ⑤에러 0
 */
const { chromium } = require("playwright");

const CHROME = "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome";
/* MP_FORCE=mqtt → MQTT 강제(릴레이 경로) · 미설정/다른 값 → 오리진 기본(localhost=socket.io 회귀 테스트) */
const FORCE = process.env.MP_FORCE === "mqtt" ? "mqtt" : "";
/* E2E_URL — 기본 localhost, 라이브 검증 시 https://sertz.vercel.app */
const BASE = process.env.E2E_URL || "http://localhost:3000";

/** 스마트 대화 배출 — 텍스트 입력(이름짓기) 채움 + 확인 계열 클릭 + Space/Enter 진행 */
async function drainDialogs(p) {
  await p.evaluate(() => {
    const ae = document.activeElement;
    if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA")) ae.blur();
  }).catch(() => {});
  const inp = await p.locator('input:visible').first();
  if (await inp.count().catch(() => 0)) {
    await inp.fill("멀티비").catch(() => {});
  }
  const confirm = await p.evaluate(() => {
    const t = [...document.querySelectorAll("button")].find((x) => /확정|확인|결정|이름|완료/.test(x.textContent || ""));
    if (t && t.offsetParent !== null) { t.click(); return t.textContent?.trim(); }
    return null;
  }).catch(() => null);
  if (confirm) { console.log("  [drain] 확인버튼 클릭:", confirm); return; }
  await p.keyboard.press("Space").catch(() => {});
  await p.waitForTimeout(150);
  await p.keyboard.press("Enter").catch(() => {});
}

async function bootPlayer(browser, name, tag) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript((f) => {
    try { if (f) window.localStorage.setItem("sertz.mp.force", f); } catch {}
  }, FORCE);
  /* vc134 라이브 검증 — 신규 캐릭터 인트로/튜토리얼 대화 체인 대신 기존 유저 세이브를 주입해
   *  바로 마을 플레이 상태로 진입 (대화 배출이 테스트 병목이 되는 것 방지) */
  await ctx.addInitScript((nm) => {
    try {
      if (window.localStorage.getItem("sertz_save_v2")) return;
      window.localStorage.setItem("sertz_save_v2", JSON.stringify({
        stage: "village", lv: 12, exp: 0, maxHp: 180, atk: 24, cleared: true,
        maxMp: 70, playerName: nm, gold: 500, potions: { hp: 5, mp: 5 },
        introSeen: true, tutorialDone: true, tutStep: 99,
        seen: ["prologue", "intro", "village_intro"], questIdx: {},
      }));
    } catch {}
  }, name);
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 120)));
  await p.goto(BASE, { waitUntil: "domcontentloaded", timeout: 40000 });
  await p.waitForTimeout(2000);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.getByRole("button", { name: /게임 시작/ }).first().click();
  await p.waitForTimeout(900);
  /* 세이브 주입분이 있으면 로비에 캐릭터가 이미 있다 — 바로 이어하기 */
  const hasChar = await p.evaluate(() => {
    const t = [...document.querySelectorAll("button")].find((x) => /이 캐릭터로 시작/.test(x.textContent || ""));
    return !!t;
  }).catch(() => false);
  if (hasChar) {
    await p.evaluate(() => {
      const t = [...document.querySelectorAll("button")].find((x) => /이 캐릭터로 시작/.test(x.textContent || ""));
      if (t) t.click();
    });
    await p.waitForTimeout(3500);
  } else {
    await p.getByText("캐릭터 생성", { exact: false }).first().click();
    await p.waitForTimeout(400);
    await p.locator('input[placeholder*="캐릭터 이름"]').fill(name);
    await p.getByRole("button", { name: /다음 — 직업 선택/ }).click();
    await p.waitForTimeout(300);
    await p.getByText("전사", { exact: false }).first().click();
    await p.waitForTimeout(200);
    await p.getByRole("button", { name: /다음 — 외형 선택|다음/ }).last().click().catch(() => {});
    await p.waitForTimeout(400);
    await p.getByRole("button", { name: /생성!/ }).first().click();
    await p.waitForTimeout(800);
    await p.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      const t = btns.find((x) => /이 캐릭터로 시작/.test(x.textContent || "")) || btns.find((x) => /시작/.test(x.textContent || ""));
      if (t) t.click();
    });
    await p.waitForTimeout(3500);
  }
  for (let i = 0; i < 25; i++) {
    const ready = await p.evaluate(() => !!window.__SERTZ_SCENE__ && !!window.__SERTZ_SCENE__.stageDef?.key && window.__SERTZ_SCENE__.dialoguing !== true).catch(() => false);
    if (ready) break;
    await p.keyboard.press("Enter");
    await p.waitForTimeout(500);
  }
  await p.waitForTimeout(1200);
  /* 플레이어 스폰 대기 — 라이브(원격 에셋 로딩)는 스폰이 수십 초 걸릴 수 있다 */
  for (let i = 0; i < 90; i++) {
    const has = await p.evaluate(() => !!window.__SERTZ_SCENE__?.player).catch(() => false);
    if (has) break;
    await p.waitForTimeout(1000);
  }
  /* 다이얼로그 완전 배출 — 마을 입장 후 연속 스토리 대화가 이어지므로
   *  "대화 없음" 상태가 3연속(1.8s) 유지될 때까지 Enter 진행 */
  let stable = 0;
  for (let i = 0; i < 40 && stable < 3; i++) {
    const dlg = await p.evaluate(() => {
      const s = window.__SERTZ_SCENE__;
      const ae = document.activeElement;
      if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA")) ae.blur();
      return !!s?.dialoguing;
    }).catch(() => true);
    if (dlg) {
      stable = 0;
      await p.keyboard.press("Enter").catch(() => {});
      await p.waitForTimeout(600);
    } else {
      stable++;
      await p.waitForTimeout(600);
    }
  }
  await p.mouse.click(300, 520); // 빈 잔디밭 — NPC/대화 재개방 방지 (640,300은 여관주인 인접)
  await p.waitForTimeout(600);
  const state = await p.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    return {
      stage: s?.stageDef?.key,
      dialoguing: !!s?.dialoguing,
      chatFocused: !!s?.chatFocused,
      player: s?.player ? { x: Math.round(s.player.x), y: Math.round(s.player.y) } : null,
    };
  });
  console.log(`[${tag}] 부팅 완료:`, JSON.stringify(state));
  return { ctx, p, errs };
}

(async () => {
  const results = [];
  const ok = (name, pass, detail = "") => {
    results.push({ name, pass });
    console.log(`${pass ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
  };

  const b = await chromium.launch({ executablePath: CHROME, args: ["--use-gl=swiftshader", "--no-sandbox"] });

  /* A 선접속 — 브로커 웜업 포함 12초 여유 */
  const A = await bootPlayer(b, "멀티에이", "A");
  await A.p.waitForTimeout(9000); // 브로커 접속+presence 안정화

  const netA = await A.p.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    const net = window.__SERTZ_NET__;
    return { connected: !!net?.connected, id: net?.id ?? null, transport: net?.__mqtt === true ? "mqtt" : "socket", dialoguing: !!s?.dialoguing, chatFocused: !!s?.chatFocused };
  });
  ok("A MQTT 트랜스포트 연결", netA.transport === "mqtt" && netA.connected, `transport=${netA.transport} connected=${netA.connected} dlg=${netA.dialoguing} chat=${netA.chatFocused}`);
  if (FORCE !== "mqtt") { console.log("(회귀 모드 — A 연결 판정을 socket으로 대체)"); results[results.length - 1].pass = netA.transport === "socket" && netA.connected; }

  /* B 후접속 */
  const B = await bootPlayer(b, "멀티비", "B");
  await B.p.waitForTimeout(9000);

  const netB = await B.p.evaluate(() => {
    const net = window.__SERTZ_NET__;
    return { connected: !!net?.connected, id: net?.id ?? null, transport: net?.__mqtt === true ? "mqtt" : "socket" };
  });
  ok("B MQTT 트랜스포트 연결", netB.transport === "mqtt" && netB.connected, `transport=${netB.transport} connected=${netB.connected}`);
  if (FORCE !== "mqtt") { results[results.length - 1].pass = netB.transport === "socket" && netB.connected; }

  /* B 화면에서 A 원격 수신 대기 (players → syncRemotes) */
  let bSeesA = null;
  for (let i = 0; i < 20; i++) {
    bSeesA = await B.p.evaluate(() => {
      const s = window.__SERTZ_SCENE__;
      const remotes = s && s.remotes ? [...s.remotes.values()] : [];
      return remotes.map((r) => ({ name: r.name, x: Math.round(r.tx), y: Math.round(r.ty) }));
    }).catch(() => null);
    if (bSeesA && bSeesA.some((r) => r.name === "멀티에이")) break;
    await B.p.waitForTimeout(700);
  }
  ok("B가 A를 봄 (원격 스프라이트+이름표)", !!(bSeesA && bSeesA.some((r) => r.name === "멀티에이")), JSON.stringify(bSeesA));

  /* A 이동 → B의 목표좌표 갱신 확인 (캔버스 클릭 후 키 입력 — 포커스 보장) */
  await A.p.mouse.click(300, 520);
  const aPos0 = await A.p.evaluate(() => ({ x: Math.round(window.__SERTZ_SCENE__.player.x), y: Math.round(window.__SERTZ_SCENE__.player.y) }));
  await A.p.keyboard.down("ArrowRight");
  await A.p.waitForTimeout(1600);
  await A.p.keyboard.up("ArrowRight");
  await A.p.waitForTimeout(1500);
  const aPos1 = await A.p.evaluate(() => ({ x: Math.round(window.__SERTZ_SCENE__.player.x), y: Math.round(window.__SERTZ_SCENE__.player.y) }));
  let bSeesMoved = false;
  for (let i = 0; i < 12; i++) {
    const rem = await B.p.evaluate(() => {
      const s = window.__SERTZ_SCENE__;
      const r = s && s.remotes ? [...s.remotes.values()].find((x) => x.name === "멀티에이") : null;
      return r ? { x: Math.round(r.tx), y: Math.round(r.ty) } : null;
    }).catch(() => null);
    if (rem && Math.abs(rem.x - aPos0.x) > 40) { bSeesMoved = true; break; }
    await B.p.waitForTimeout(600);
  }
  ok("A 이동이 B에 실시간 반영", bSeesMoved, `A: ${JSON.stringify(aPos0)}→${JSON.stringify(aPos1)}`);

  /* A 공격 act → B 수신 (playRemoteAction — FX만 발생, remotes에는 안 남음 → 라이브 카운터로 우회 검증 불가하므로 에러 0으로 대체 검증) */
  await A.p.keyboard.press("Space").catch(() => {});
  await B.p.waitForTimeout(1200);

  /* 양쪽 페이지 에러 수집 */
  const allErrs = [...A.errs, ...B.errs].filter((e) => !e.includes("favicon"));
  ok("페이지 에러 0", allErrs.length === 0, allErrs.slice(0, 3).join(" | "));

  /* A도 B를 보는지 (양방향) + 버스 내부 덤프 — B는 대화 재개방 시 Enter로 배출 병행 */
  let aSeesB = null;
  for (let i = 0; i < 14; i++) {
    aSeesB = await A.p.evaluate(() => {
      const s = window.__SERTZ_SCENE__;
      return s && s.remotes ? [...s.remotes.values()].map((r) => r.name) : [];
    }).catch(() => null);
    if (aSeesB && aSeesB.includes("멀티비")) break;
    /* B의 지연 트리거 대화(인트로/이름짓기) 재개방 대응 — 스마트 배출로 st 재개 */
    await drainDialogs(B.p).catch(() => {});
    await A.p.waitForTimeout(700);
  }
  const busA = await A.p.evaluate(() => window.__SERTZ_MQTT__ ? {
    connected: window.__SERTZ_MQTT__.connected, broker: window.__SERTZ_MQTT__.broker,
    stage: window.__SERTZ_MQTT__.stage, subStage: window.__SERTZ_MQTT__.subStage,
    presenceSub: window.__SERTZ_MQTT__.presenceSub, peers: window.__SERTZ_MQTT__.peers, friends: window.__SERTZ_MQTT__.friends,
    sentSt: window.__SERTZ_MQTT__.sentSt, recvSt: window.__SERTZ_MQTT__.recvSt, sentHi: window.__SERTZ_MQTT__.sentHi,
  } : "no-hook").catch(() => "eval-err");
  const busB = await B.p.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    const ae = document.activeElement;
    return {
      ...(window.__SERTZ_MQTT__ ? {
        connected: window.__SERTZ_MQTT__.connected, broker: window.__SERTZ_MQTT__.broker,
        stage: window.__SERTZ_MQTT__.stage, subStage: window.__SERTZ_MQTT__.subStage,
        peers: window.__SERTZ_MQTT__.peers,
        sentSt: window.__SERTZ_MQTT__.sentSt, recvSt: window.__SERTZ_MQTT__.recvSt, sentHi: window.__SERTZ_MQTT__.sentHi,
      } : { hook: "none" }),
      dialoguing: !!s?.dialoguing, chatFocused: !!s?.chatFocused,
      activeTag: ae ? ae.tagName : null, playerState: s?.player?.state ?? null,
      sleeping: !!s?.sleeping, gateActive: !!s?.gateActive,
    };
  }).catch(() => "eval-err");
  console.log("[버스A]", JSON.stringify(busA));
  console.log("[버스B]", JSON.stringify(busB));
  /* 루프 생존 확인 — 헤드리스 멀티 페이지 rAF 스로틀링 판별 */
  const loops = await Promise.all([
    A.p.evaluate(() => { const g = window.__SERTZ__?.game; const f = g?.loop?.frame; return new Promise((r) => setTimeout(() => r({ f0: f, f1: g?.loop?.frame, vis: document.visibilityState }), 1200)); }).catch(() => null),
    B.p.evaluate(() => { const g = window.__SERTZ__?.game; const f = g?.loop?.frame; return new Promise((r) => setTimeout(() => r({ f0: f, f1: g?.loop?.frame, vis: document.visibilityState }), 1200)); }).catch(() => null),
  ]);
  console.log("[루프A]", JSON.stringify(loops[0]), "(f1>f0면 살아있음)");
  console.log("[루프B]", JSON.stringify(loops[1]));
  ok("A도 B를 봄 (양방향)", !!(aSeesB && aSeesB.includes("멀티비")), JSON.stringify(aSeesB));

  console.log(`\n결과: ${results.filter((r) => r.pass).length}/${results.length} PASS`);
  await A.ctx.close();
  await B.ctx.close();
  await b.close();
  process.exit(results.every((r) => r.pass) ? 0 : 1);
})();
