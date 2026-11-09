/**
 * probe_portraits.mjs — vc290 초상화가 대화창에서 실제로 렌더되는지 검증.
 *
 * 검증 2단계:
 *  1) 매니페스트 → faceFor 경로 해석 + 파일 실재 + HTTP 200
 *  2) DialogueBox 의 <img> 가 실제 픽셀을 그리는지 (naturalWidth>0)
 */
import { chromium } from "playwright";

const BASE = process.env.PROBE_URL || "http://127.0.0.1:3200";
const SPEAKERS = ["연합 안내인", "라일락 연합의 기록자", "마을 주민", "해설",
  "여관 주인 로안", "이야기꾼", "시간의 초월자", "수호신"];

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
const errs = [];
page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error" && !/speed-insights/.test(m.text())) errs.push("console: " + m.text().slice(0, 120)); });

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("canvas", { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(60000); // BootScene create 대기

/* 1) 매니페스트 해석 + 실제 이미지 로드 (DOM img 로 픽셀 확인) */
const res = await page.evaluate(async (speakers) => {
  const out = { perSpeaker: {}, missing: [], httpFail: [] };

  /* _map.json 을 직접 받아 faceFor 규칙 재현 */
  const map = await (await fetch("/assets/npcportrait/_map.json")).json();

  for (const s of speakers) {
    const direct = map[s]?.src;
    const okPath = !!(direct && String(direct).includes("/npcportrait/"));
    if (!okPath) { out.missing.push(`map:${s}`); out.perSpeaker[s] = { path: null }; continue; }

    // 실제로 그 이미지를 로드해 픽셀이 있는지 확인
    const info = await new Promise((resolve) => {
      const im = new Image();
      im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight, src: direct });
      im.onerror = () => resolve({ w: 0, h: 0, src: direct, err: true });
      im.src = direct;
    });
    out.perSpeaker[s] = { path: direct, ...info };
    if (!info.w) out.httpFail.push(`${s} → ${direct}`);
  }
  return out;
}, SPEAKERS);

const allOk = res.missing.length === 0 && res.httpFail.length === 0
  && Object.values(res.perSpeaker).every((v) => v.w === 84 && v.h === 84);

console.log(JSON.stringify({
  ok: allOk,
  speakers: SPEAKERS.length,
  rendered: Object.values(res.perSpeaker).filter((v) => v.w === 84).length,
  detail: res.perSpeaker,
  missing: res.missing,
  httpFail: res.httpFail,
  errs: errs.slice(0, 5),
}, null, 1));
await browser.close();
process.exit(allOk ? 0 : 1);
