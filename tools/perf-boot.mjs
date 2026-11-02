/**
 * vc235 — 부팅 비용 실측.
 *
 * [왜 이걸 재나]
 *  이 컨테이너에서는 SwiftShader 가 부팅 도중 WebGL 컨텍스트를 잃고 앱이
 *  "안전 새로고침" 루프에 빠진다. 즉 GPU 프레임 시간은 여기서 못 잰다.
 *  대신 **부팅에 실제로 몇 개의 요청이 나가고 몇 바이트를 받는지**는
 *  GPU 와 무관하게 정확히 잴 수 있고, 이게 모바일 체감(첫 로딩·발열·메모리)의
 *  지배 변수다. 감으로 줄이면 화질이 깎이므로, 먼저 실측한다.
 *
 * [무엇을 재나]
 *  - 요청 총수 / 총 바이트 / 카테고리별(assets 하위 폴더) 분포
 *  - 중복 로드(같은 URL 2회 이상)
 *  - 404 (없는 파일을 요청하는 낭비)
 *  - 가장 큰 파일 top 15
 *
 * [사용]
 *  PORT=3314 node tools/perf-boot.mjs
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const PORT = process.env.PORT || "3314";
const BASE = `http://127.0.0.1:${PORT}/?renderer=webgl`;
const OBSERVE_MS = Number(process.env.OBSERVE_MS || 25000);

const browser = await chromium.launch({
  args: [
    "--use-gl=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
    "--disable-gpu-sandbox",
    "--no-sandbox",
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

/** @type {Map<string, {size:number, status:number, type:string, count:number}>} */
const seen = new Map();
let totalBytes = 0;

page.on("response", async (res) => {
  const url = res.url();
  if (!url.startsWith("http")) return;
  const path = url.replace(`http://127.0.0.1:${PORT}`, "");
  let size = 0;
  try {
    /* content-length 우선. 없으면 body 길이(압축 해제 기준이라 과대할 수 있음) */
    const cl = res.headers()["content-length"];
    if (cl) size = Number(cl);
    else size = (await res.body().catch(() => Buffer.alloc(0))).length;
  } catch { /* 무시 */ }
  const prev = seen.get(path);
  if (prev) {
    prev.count += 1;
  } else {
    seen.set(path, { size, status: res.status(), type: res.request().resourceType(), count: 1 });
    totalBytes += size;
  }
});

console.log(`[boot] ${BASE} 관찰 ${OBSERVE_MS / 1000}초`);
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(OBSERVE_MS);

/* 로더 진행 상황도 함께 기록 — 실제로 몇 개까지 받았는지 */
const loader = await page
  .evaluate(() => {
    const s = window.__SERTZ__?.game?.scene?.scenes?.[0];
    return s?.load ? { toLoad: s.load.totalToLoad, done: s.load.totalComplete, failed: s.load.totalFailed } : null;
  })
  .catch(() => null);

await browser.close();

const rows = [...seen.entries()].map(([p, v]) => ({ path: p, ...v }));
const ok = rows.filter((r) => r.status === 200);
const notFound = rows.filter((r) => r.status === 404);
const dup = rows.filter((r) => r.count > 1);

/* 카테고리 — /assets/<sub>/... 의 첫 세그먼트로 묶는다 */
const byCat = new Map();
for (const r of ok) {
  const m = r.path.match(/^\/assets\/([^/]+)\//);
  const cat = m ? m[1] : r.path.startsWith("/_next/") ? "_next(코드)" : "(기타)";
  const cur = byCat.get(cat) || { n: 0, bytes: 0 };
  cur.n += 1;
  cur.bytes += r.size;
  byCat.set(cat, cur);
}
const cats = [...byCat.entries()].sort((a, b) => b[1].bytes - a[1].bytes);

const top = [...ok].sort((a, b) => b.size - a.size).slice(0, 15);

const mb = (b) => (b / 1048576).toFixed(1);

console.log("\n=== 부팅 비용 ===");
console.log(`요청(고유) : ${rows.length}  / 로더 기준 ${loader?.toLoad ?? "?"} (완료 ${loader?.done ?? "?"}, 실패 ${loader?.failed ?? 0})`);
console.log(`전송량     : ${mb(totalBytes)} MB`);
console.log(`404        : ${notFound.length}`);
console.log(`중복 로드  : ${dup.length}건 (낭비 ${mb(dup.reduce((s, d) => s + d.size * (d.count - 1), 0))} MB)`);

console.log("\n=== 카테고리별 ===");
for (const [c, v] of cats) console.log(`  ${c.padEnd(22)} ${String(v.n).padStart(5)}개  ${mb(v.bytes).padStart(7)} MB`);

console.log("\n=== 큰 파일 top 15 ===");
for (const t of top) console.log(`  ${(t.size / 1024).toFixed(0).padStart(6)} KB  ${t.path}`);

if (dup.length) {
  console.log("\n=== 중복 로드 ===");
  for (const d of dup.sort((a, b) => b.size * b.count - a.size * a.count).slice(0, 10)) {
    console.log(`  x${d.count} ${(d.size / 1024).toFixed(0)}KB  ${d.path}`);
  }
}
if (notFound.length) {
  console.log("\n=== 404 ===");
  for (const n of notFound.slice(0, 10)) console.log(`  ${n.path}`);
}

const out = {
  requests: rows.length,
  loader,
  totalBytes,
  totalMB: Number(mb(totalBytes)),
  notFound: notFound.map((n) => n.path),
  duplicates: dup.map((d) => ({ path: d.path, count: d.count, size: d.size })),
  categories: Object.fromEntries(cats),
  top: top.map((t) => ({ path: t.path, size: t.size })),
};
writeFileSync("/tmp/perf-boot.json", JSON.stringify(out, null, 2));
console.log("\n저장: /tmp/perf-boot.json");
