/**
 * e2e_vc141.js — v1.4.33 검증:
 *  ① 멀티플레이 "서로 안보임" — MQTT 브로커 교체(emqx+hivemq)·이클립스 제거·번들 검증
 *  ② 보스 화질 — 보스 아틀라스 9종 LINEAR 필터 실측(엔진 업로드 모드) + 9종 인게임 렌더
 */
const { chromium } = require("playwright");

const EXPECT = {
  atl_boss:       [268, 234, 6, 72],
  atl_boss2:      [330, 212, 7, 84],
  atl_boss3:      [286, 234, 6, 72],
  atl_boss_nidhog:[226, 232, 7, 84],
  atl_boss_surt:  [330, 224, 7, 84],
  atl_boss_fenrir:[304, 274, 7, 84],
  atl_boss_skoll: [274, 234, 7, 84],
  atl_boss_nagr:  [286, 240, 6, 72],
  atl_boss_hati:  [280, 258, 7, 84],
};
const KEYS = Object.keys(EXPECT);

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
    await ni.fill("화질테스터");
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

  /* ── 2) 보스 아틀라스 9종 LINEAR 필터 실측 (vc141 핵심) ──
   *  TextureSource.scaleMode — 0=LINEAR(보스), 1=NEAREST(픽셀아트 기본) */
  const filters = await p.evaluate((KEYS) => {
    const g = window.__SERTZ__?.game;
    if (!g) return null;
    const out = {};
    for (const k of KEYS) {
      const t = g.textures.get(k);
      const src = t && t.source && t.source[0];
      out[k] = src ? src.scaleMode : null;
    }
    /* 대조군 — 픽셀아트 스프라이트는 NEAREST(1) 유지되어야 한다 */
    const hero = g.textures.get("hero_idle0");
    out.__hero = hero && hero.source && hero.source[0] ? hero.source[0].scaleMode : null;
    return out;
  }, KEYS);
  ok("보스 아틀라스 9종 LINEAR(0) 필터", !!filters && KEYS.every((k) => filters[k] === 0), JSON.stringify(filters));
  ok("대조군 hero_idle0 NEAREST(1) 유지", filters && filters.__hero === 1, `hero=${filters && filters.__hero}`);

  /* ── 3) 프레임 크기/개수 유지 (vc139 기하 무변경) ── */
  const atlas = await p.evaluate((EXPECT) => {
    const g = window.__SERTZ__?.game;
    if (!g) return null;
    const out = {};
    for (const [k, exp] of Object.entries(EXPECT)) {
      const t = g.textures.get(k);
      const src = t && t.key !== "__MISSING" ? t.getSourceImage() : null;
      const fr = t ? t.frames && t.getFrameNames().length : 0;
      const f0 = t && t.getFrameNames ? t.frames["0"] || t.frames[Object.keys(t.frames)[0]] : null;
      out[k] = src ? { w: src.width, h: src.height, frames: fr, fw: f0 ? f0.cutWidth || f0.width : 0, fh: f0 ? f0.cutHeight || f0.height : 0, exp } : null;
    }
    return out;
  }, EXPECT);
  ok("아틀라스 9종 프레임 기하 유지", !!atlas && Object.entries(EXPECT).every(([k, e]) => {
    const a = atlas[k];
    return a && a.w === e[0] * 12 && a.h === e[1] * e[2] && a.frames === e[3];
  }), JSON.stringify(Object.fromEntries(KEYS.map((k) => [k, atlas && atlas[k] ? `${atlas[k].w}x${atlas[k].h}/${atlas[k].frames}fr` : "null"]))));

  /* ── 4) 9종 전체 인게임 렌더 + 스크린샷 ── */
  await p.evaluate((KEYS) => {
    const g = window.__SERTZ__.game;
    const ws = g.scene.getScene("world");
    const c = ws.cameras.main.midPoint ?? { x: ws.player.x, y: ws.player.y };
    const keys = KEYS;
    keys.forEach((k, i) => {
      const col = i % 5, row = Math.floor(i / 5);
      ws.add.sprite(c.x - 320 + col * 160, c.y - 120 + row * 220, k, 0)
        .setDepth(50).setName("q_" + k);
    });
  }, KEYS);
  await p.waitForTimeout(900);
  for (let i = 0; i < 14; i++) {
    await p.mouse.click(640, 400);
    await p.waitForTimeout(180);
  }
  await p.evaluate(() => {
    const ws = window.__SERTZ__.game.scene.getScene("world");
    ws.children.each((c) => { if (c.name && c.name.startsWith("q_")) c.setDepth(9999); });
  });
  await p.waitForTimeout(500);
  await p.screenshot({ path: "scripts/atlas_preview/ingame_vc141_9boss.png" });
  const rendered = await p.evaluate((KEYS) => {
    const ws = window.__SERTZ__.game.scene.getScene("world");
    return KEYS.map((k) => {
      const s = ws.children.getByName("q_" + k);
      return s ? { k, vis: s.visible, w: Math.round(s.displayWidth) } : null;
    });
  }, KEYS);
  ok("9종 인게임 렌더(displayWidth 200~360급)", rendered.every((r) => r && r.vis && r.w >= 200 && r.w <= 360), JSON.stringify(rendered));

  /* ── 5) MQTT 트랜스포트 — 버스 부팅 + 브로커 후보 검증 ──
   *  localhost는 socket.io 오리진(isGameServerHost)이라 MQTT를 안 탄다 → force=mqtt로 강제 기동 */
  await p.evaluate(() => { try { localStorage.setItem("sertz.mp.force", "mqtt"); } catch {} });
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
  try { await p.waitForSelector("text=게임 시작", { timeout: 30000 }); } catch { /* 이미 월드 */ }
  await p.getByRole("button", { name: /게임 시작/ }).first().click().catch(() => {});
  await p.waitForTimeout(1200);
  await p.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const t = btns.find((x) => /이 캐릭터로 시작/.test(x.textContent || "")) || btns.find((x) => /시작/.test(x.textContent || ""));
    if (t) t.click();
  });
  await p.waitForTimeout(9000);
  const mqttState = await p.evaluate(() => {
    const m = window.__SERTZ_MQTT__;
    return m ? { broker: m.broker, pid: !!m.pid, subStage: m.subStage, presenceSub: m.presenceSub } : null;
  });
  ok("MQTT 버스 기동(force=mqtt — 진단 훅 존재)", !!mqttState, JSON.stringify(mqttState));
  ok("브로커 후보가 emqx/hivemq(이클립스 제거)", !!mqttState && /emqx|hivemq/.test(mqttState.broker) && !/eclipse/.test(mqttState.broker), mqttState?.broker);
  await p.evaluate(() => { try { localStorage.setItem("sertz.mp.force", ""); } catch {} });

  /* ── 6) 클라이언트 번들에 이클립스 브로커 잔존 여부 ── */
  const chunkUrls = await p.evaluate(() =>
    performance.getEntriesByType("resource").map((e) => e.name).filter((u) => /_next\/static\/chunks/.test(u)).slice(0, 50),
  );
  let eclipseFound = 0, hivemqFound = 0;
  for (const u of chunkUrls) {
    try {
      const txt = await (await fetch(u)).text();
      if (/mqtt\.eclipseprojects\.io/.test(txt)) eclipseFound++;
      if (/broker\.hivemq\.com/.test(txt)) hivemqFound++;
    } catch { /* 무시 */ }
  }
  ok("번들에 죽은 이클립스 브로커 0건", eclipseFound === 0, `eclipse=${eclipseFound}`);
  ok("번들에 HiveMQ 폴백 포함", hivemqFound > 0, `hivemq=${hivemqFound}`);

  ok("페이지 에러 0", errors.length === 0, errors.join(" | ").slice(0, 200));
  console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})();
