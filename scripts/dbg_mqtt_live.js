/**
 * 라이브 MQTT 수신 경로 격리 진단:
 *  1) 라이브 페이지 1개 부팅(자연 MQTT 경로) → 버스 연결 확인
 *  2) Node에서 가짜 피어 hi/st를 stage/village에 발행
 *  3) 페이지 remotes에 가짜 피어가 뜨는지 확인 (수신 경로 정상 판정)
 *  4) 페이지 자체 발신도 스니핑 (발신 경로 판정)
 */
const { chromium } = require("playwright");
const mqtt = require("mqtt");

const CHROME = "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome";
const BASE = process.env.E2E_URL || "https://sertz.vercel.app";

(async () => {
  /* 스니퍼 */
  const sn = mqtt.connect("wss://broker.emqx.io:8084/mqtt", { clientId: "sz_diag_sniff_" + Date.now().toString(36), protocolVersion: 4, connectTimeout: 8000 });
  const seen = [];
  sn.on("connect", () => sn.subscribe("sertz/mp/v2/#"));
  sn.on("message", (t, p) => seen.push(`${t} :: ${p.toString().slice(0, 120)}`));

  const b = await chromium.launch({ executablePath: CHROME, args: ["--use-gl=swiftshader", "--no-sandbox"] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message.slice(0, 100)));
  await p.goto(BASE, { waitUntil: "domcontentloaded", timeout: 40000 });
  await p.waitForTimeout(2500);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.getByRole("button", { name: /게임 시작/ }).first().click();
  await p.waitForTimeout(800);
  await p.getByText("캐릭터 생성", { exact: false }).first().click();
  await p.waitForTimeout(400);
  await p.locator('input[placeholder*="캐릭터 이름"]').fill("진단테스터");
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
  await p.waitForTimeout(4000);
  for (let i = 0; i < 30; i++) {
    const ready = await p.evaluate(() => !!window.__SERTZ_SCENE__ && !!window.__SERTZ_SCENE__.stageDef?.key).catch(() => false);
    if (ready) break;
    await p.keyboard.press("Enter");
    await p.waitForTimeout(500);
  }
  await p.waitForTimeout(8000); // 브로커 연결+join 여유

  const st = await p.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    const net = window.__SERTZ_NET__;
    return { connected: !!net?.connected, transport: net?.__mqtt === true ? "mqtt" : "socket", pid: net?.id, dialoguing: !!s?.dialoguing };
  });
  console.log("페이지 상태:", JSON.stringify(st));

  /* 가짜 피어 발행 */
  const pub = mqtt.connect("wss://broker.emqx.io:8084/mqtt", { clientId: "sz_diag_fake_" + Date.now().toString(36), protocolVersion: 4, connectTimeout: 8000 });
  await new Promise((r) => pub.on("connect", r));
  pub.publish("sertz/mp/v2/stage/village", JSON.stringify({ k: "hi", pid: "szFAKEPEER01", name: "가짜", lv: 7, cls: "warrior", code: "AAAAAA", stage: "village", x: 400, y: 400, t: Date.now() }));
  await p.waitForTimeout(500);
  pub.publish("sertz/mp/v2/stage/village", JSON.stringify({ k: "st", pid: "szFAKEPEER01", name: "가짜", lv: 7, cls: "warrior", code: "AAAAAA", stage: "village", x: 420, y: 410, flip: false, moving: true, t: Date.now() }));
  await p.waitForTimeout(2500);

  const remotes = await p.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    return s && s.remotes ? [...s.remotes.values()].map((r) => ({ name: r.name, x: Math.round(r.tx), y: Math.round(r.ty) })) : null;
  });
  console.log("가짜 피어 발행 후 remotes:", JSON.stringify(remotes));
  console.log("remotes에 가짜 수신:", remotes?.some((r) => r.name === "가짜") ? "YES — 수신 경로 정상" : "NO — 수신 경로 문제");

  /* 페이지 발신 스니핑 (hi/st/presence 중 하나라도 왔는지) */
  await p.waitForTimeout(6000);
  const mine = seen.filter((s) => s.includes(st.pid || "????"));
  console.log(`스니퍼 수신 총 ${seen.length}건 중 내 페이지 발신 ${mine.length}건`);
  console.log("발신 샘플:", mine.slice(0, 4).join(" | ") || "없음!");

  console.log("페이지 에러:", errs.length ? errs.join(" | ") : "0");
  pub.end(true);
  sn.end(true);
  await b.close();
})();
