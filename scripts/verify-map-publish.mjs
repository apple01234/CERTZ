/**
 * 맵 에디터 → 게임 반영 엔드투엔드 검증.
 *
 * [왜 필요한가]
 *  에디터가 화면에서 편집되고 JSON 을 내려받는 것만으로는 "맵메이커 완성"이 아니다.
 *  **에디터에서 저장한 맵이 실제 게임 스테이지 레이아웃으로 쓰이는지** 확인해야 한다.
 *
 * [검증 경로]
 *  1) /api/maps 로 맵 저장 (관리자 세션이 필요하므로, 실패하면 파일 직접 주입으로 폴백)
 *  2) 게임 부팅 → loadMapOverrides 가 매니페스트를 읽는다
 *  3) WorldScene 의 layout.open 이 저장한 맵과 일치한다
 *
 * 사용: node scripts/verify-map-publish.mjs http://127.0.0.1:3131
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.argv[2] || "http://127.0.0.1:3131";
const ROOT = path.resolve(import.meta.dirname, "..");
const SEED = "howlrstone1x2";
const MAPS_DIR = path.join(ROOT, "public/assets/maps");

let pass = 0, fail = 0;
const ck = (n, ok, d = "") => { console.log(`${ok ? "✓" : "✗"} ${n}${d ? ` — ${d}` : ""}`); ok ? pass++ : fail++; };

/* ── 1) 고유한 맵을 파일로 직접 주입한다.
 *  API 는 관리자 인증이 필요하므로, 파이프라인(부팅 로드 → 레이아웃 적용)만 검증한다.
 *  API 경로는 별도 ck 로 존재/응답만 확인한다. */
const COLS = 15, ROWS = 9;
const openRows = [];
const pathRows = [];
for (let r = 0; r < ROWS; r++) {
  let line = "", pl = "";
  for (let c = 0; c < COLS; c++) {
    /* 테두리는 벽. 안쪽은 개방하되, 3행에만 벽 한 칸을 두어 "저장한 맵이 반영됐는지"를
     *  프리셋과 구분할 수 있게 한다(프리셋은 이 위치가 열려 있다). */
    const edge = r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1;
    const marker = (r === 3 && c === 7);
    line += edge || marker ? "#" : ".";
    pl += (r === 4 && c >= 3 && c <= 8) ? "=" : ".";
  }
  openRows.push(line);
  pathRows.push(pl);
}
const doc = {
  version: 1, name: SEED, cols: COLS, rows: ROWS, cellW: 150.667, cellH: 131.111,
  openRows, pathRows,
  entry: 4 * COLS + 1, exit: 4 * COLS + (COLS - 2),
  theme: "library", ground: "ground_ash", path: "ground_slate",
  structure: "ground_cavern", structureTint: 0x967958, props: [],
};

fs.mkdirSync(MAPS_DIR, { recursive: true });
fs.writeFileSync(path.join(MAPS_DIR, `${SEED}.json`), JSON.stringify(doc, null, 2));
fs.writeFileSync(path.join(MAPS_DIR, "_index.json"), JSON.stringify([{ seed: SEED, file: `${SEED}.json` }], null, 2));
ck("테스트 맵 파일 주입", fs.existsSync(path.join(MAPS_DIR, `${SEED}.json`)));

const markerCell = 3 * COLS + 7;   // 저장한 맵에만 있는 벽

/* ── 2) API 존재 확인 ── */
const apiRes = await fetch(`${BASE}/api/maps`).catch(() => null);
ck("GET /api/maps 응답", !!apiRes && apiRes.ok, apiRes ? `HTTP ${apiRes.status}` : "요청 실패");
if (apiRes?.ok) {
  const body = await apiRes.json();
  const list = Array.isArray(body) ? body : [];
  ck("매니페스트에 테스트 시드 포함", list.some((it) => (it.seed ?? it) === SEED), JSON.stringify(list).slice(0, 80));
}

/* ── 3) 게임에서 실제 레이아웃 확인 ── */
const browser = await chromium.launch({
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.locator("button", { hasText: "게임 시작" }).first().click({ timeout: 120000 });
await page.getByRole("button", { name: "캐릭터 생성", exact: true }).first().click();
await page.locator("input").first().fill("맵검" + String(Date.now()).slice(-4));
await page.getByRole("button", { name: /다음/ }).click();
await page.getByRole("button", { name: "모험가로 생성!" }).click({ timeout: 30000 });
await page.getByRole("button", { name: "이 캐릭터로 시작" }).click({ timeout: 30000 });
await page.waitForFunction(() => window.__SERTZ_SCENE__?.player, { timeout: 90000 });

/* 오버라이드가 로드됐는지 (부팅 시 로드) */
const ovLoaded = await page.evaluate(async () => {
  try {
    const m = await import("/_next/static/chunks/_.js").catch(() => null);
    void m;
  } catch { /* 번들 경로는 환경마다 다르다 — 아래 런타임 검사로 대체 */ }
  return null;
});
void ovLoaded;

/* 대상 스테이지로 이동 */
await page.evaluate(() => { const s = window.__SERTZ_SCENE__; try { s.dialoguing = false; } catch { /* noop */ } });
await page.evaluate((st) => window.__SERTZ_SCENE__.startTransition(st), SEED);
await page.waitForFunction((st) => window.__SERTZ_SCENE__?.stageDef?.key === st, SEED, { timeout: 90000 }).catch(() => {});
await page.waitForTimeout(3000);

const lay = await page.evaluate(([cols, rows, marker]) => {
  const s = window.__SERTZ_SCENE__;
  const L = s.layout;
  if (!L) return { ok: false, reason: "layout 없음" };
  /* 씬은 필드 크기로 cols/rows 를 재계산한다 — 저장 맵과 개수를 비교해야 한다 */
  const openCount = L.open.filter(Boolean).length;
  const wallCount = L.open.filter((v) => !v).length;
  return {
    ok: true,
    stage: s.stageDef?.key,
    cols: L.cols, rows: L.rows,
    openCount, wallCount,
    entryOpen: L.open[L.entry],
    exitOpen: L.open[L.exit],
    pathCount: L.authored?.paths ? L.authored.paths.filter(Boolean).length : null,
    ground: L.authored?.ground ?? null,
  };
}, [COLS, ROWS, markerCell]);
console.log("게임 레이아웃:", JSON.stringify(lay));

ck("스테이지 진입", lay.ok && lay.stage === SEED, lay.ok ? `${lay.stage}` : (lay.reason ?? "?"));
if (lay.ok) {
  /* 저장한 맵은 15×9 안쪽 전부 개방 + (3,7) 1칸 벽.
   *  [주의] 게임은 필드 크기로 격자를 재계산하지 않고 **저장된 격자를 그대로** 쓴다
   *  (배열과 cols/rows 가 어긋나면 인덱스가 깨지므로). 따라서 개수도 저장값과 같아야 한다.
   *  안쪽 개방 = (15-2)*(9-2) - 1 = 91 - 1 = 90. */
  const expectOpen = (COLS - 2) * (ROWS - 2) - 1;
  ck("저장한 맵의 개방 셀 수가 반영됨", lay.openCount === expectOpen, `open=${lay.openCount} (기대 ${expectOpen})`);
  ck("입구/출구가 개방", lay.entryOpen === true && lay.exitOpen === true);
  /* 길은 4행 c=3..8 → 6칸 */
  ck("길 레이어 반영", lay.pathCount === 6, `paths=${lay.pathCount} (기대 6)`);
  ck("테마 지면 반영", lay.ground === "ground_ash", String(lay.ground));
}
ck("pageerror 없음", errs.length === 0, errs.slice(0, 2).join(" | "));

/* ── 4) 정리 — 테스트 맵 제거(게임 기본 동작 복원) ── */
fs.rmSync(path.join(MAPS_DIR, `${SEED}.json`), { force: true });
fs.rmSync(path.join(MAPS_DIR, "_index.json"), { force: true });

console.log(`\nRESULT ${pass}/${pass + fail} passed, ${fail} failed`);
await browser.close();
process.exit(fail === 0 ? 0 : 1);
