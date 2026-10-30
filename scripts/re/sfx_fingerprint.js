/**
 * sfx_fingerprint.js — sertz3/sertz4 배포본 오디오·타일 실측 대조 (지시서 #21)
 *
 * 유저 지적: "효과음&타일맵은 이때가 훠어어어얼씬 낫다. https://sertz3.space-z.ai/ https://sertz4.space-z.ai/"
 *
 * 하는 일
 *   1) 두 배포본을 열어 실제로 로드되는 **오디오**와 **타일** 요청을 캡처한다.
 *   2) 각 파일을 내려받아 해시·크기·비트레이트를 기록한다.
 *   3) 현재 저장소 public/assets 의 같은 이름 파일과 대조한다.
 *
 * 실행: cd /root/workspace/CERTZ && node scripts/re/sfx_fingerprint.js
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const CHROME = "/root/.cache/ms-playwright/chromium-1234/chrome-linux/chrome";
const OUT = "/root/.hermes/cache/scratch/deploy/sfx_fingerprint.json";
const DL = "/root/.hermes/cache/scratch/deploy/s4s3";

const SITES = [
  { name: "sertz3", url: "https://sertz3.space-z.ai" },
  { name: "sertz4", url: "https://sertz4.space-z.ai" },
];

const AUDIO_RE = /\.(ogg|mp3|wav|m4a)(\?|$)/i;
const TILE_RE = /tile_[\w-]+\.(webp|png)(\?|$)/i;

async function probe(browser, site) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const seen = new Map(); // url -> {kind, bytes, status}
  page.on("response", async (res) => {
    const u = res.url();
    if (!AUDIO_RE.test(u) && !TILE_RE.test(u)) return;
    if (seen.has(u)) return;
    seen.set(u, { kind: AUDIO_RE.test(u) ? "audio" : "tile", status: res.status() });
  });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));

  try {
    await page.goto(site.url, { waitUntil: "domcontentloaded", timeout: 45000 });
  } catch (e) {
    errs.push("goto:" + String(e).slice(0, 100));
  }
  await page.waitForTimeout(7000);
  // 타이틀 → 월드 진입 시도 (있으면 더 많은 오디오가 로드된다)
  try {
    await page.evaluate(() => {
      const t = window.__SERTZ__?.game?.scene.getScene("title");
      if (t && typeof t.beginWorld === "function") t.beginWorld();
    });
  } catch {}
  await page.waitForTimeout(9000);

  // 실제 파일 크기/해시
  const files = {};
  fs.mkdirSync(path.join(DL, site.name), { recursive: true });
  for (const [u, meta] of seen) {
    const name = u.split("/").pop().split("?")[0];
    try {
      const res = await page.request.get(u);
      if (!res.ok()) continue;
      const buf = await res.body();
      const h = crypto.createHash("sha1").update(buf).digest("hex").slice(0, 12);
      files[name] = { kind: meta.kind, bytes: buf.length, sha1: h, url: u };
      fs.writeFileSync(path.join(DL, site.name, name), buf);
    } catch {}
  }
  await page.close();
  return { name: site.name, count: Object.keys(files).length, files, errors: errs.slice(0, 5) };
}

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=swiftshader", "--autoplay-policy=no-user-gesture-required"],
  });

  const results = [];
  for (const s of SITES) results.push(await probe(browser, s));
  await browser.close();

  // 저장소 현재 파일과 대조
  const repo = "/root/workspace/CERTZ/public/assets";
  const cmp = [];
  for (const r of results) {
    for (const [name, info] of Object.entries(r.files)) {
      const p = path.join(repo, name);
      let repoInfo = null;
      if (fs.existsSync(p)) {
        const b = fs.readFileSync(p);
        repoInfo = {
          bytes: b.length,
          sha1: crypto.createHash("sha1").update(b).digest("hex").slice(0, 12),
        };
      }
      cmp.push({
        site: r.name, name, kind: info.kind,
        siteBytes: info.bytes, repoBytes: repoInfo?.bytes ?? null,
        same: repoInfo ? repoInfo.sha1 === info.sha1 : false,
      });
    }
  }

  const report = {
    generated: new Date().toISOString(),
    sites: results.map((r) => ({ name: r.name, count: r.count, errors: r.errors })),
    audio: cmp.filter((c) => c.kind === "audio"),
    tile: cmp.filter((c) => c.kind === "tile"),
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

  /* ── 콘솔 요약 ── */
  for (const s of results) {
    console.log(`\n=== ${s.name} — ${s.count}개 파일 ===`);
    const a = Object.entries(s.files).filter(([, v]) => v.kind === "audio");
    const t = Object.entries(s.files).filter(([, v]) => v.kind === "tile");
    console.log(`  오디오 ${a.length} / 타일 ${t.length}`);
    console.log("  오디오:", a.slice(0, 6).map(([n, v]) => `${n}(${v.bytes}B)`).join(", ") || "없음");
    console.log("  타일  :", t.slice(0, 6).map(([n, v]) => `${n}(${v.bytes}B)`).join(", ") || "없음");
    if (s.errors.length) console.log("  오류:", s.errors.slice(0, 2));
  }

  const aud = report.audio;
  const same = aud.filter((c) => c.same).length;
  const diff = aud.filter((c) => !c.same && c.repoBytes !== null).length;
  const missing = aud.filter((c) => c.repoBytes === null).length;
  console.log(`\n=== 오디오 대조 (총 ${aud.length}) ===`);
  console.log(`  저장소와 동일: ${same} / 다름: ${diff} / 저장소에 없음: ${missing}`);

  const tt = report.tile;
  console.log(`\n=== 타일 대조 (총 ${tt.length}) ===`);
  console.log(`  저장소와 동일: ${tt.filter((c) => c.same).length} / 다름: ${tt.filter((c) => !c.same && c.repoBytes !== null).length}`);
  console.log(`\n저장: ${OUT}\n내려받은 파일: ${DL}`);
})();
