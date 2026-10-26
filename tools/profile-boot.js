/**
 * tools/profile-boot.js — 부팅 에셋 요청 프로파일 (P1-3)
 *
 * 왜: boot 스모크는 총 건수만 본다. 3,270건이 어디서 나오는지 모르면
 *     줄일 대상을 정할 수 없다. 파일 종류·경로 그룹별로 쪼개서 센다.
 *
 * 사용: node tools/profile-boot.js
 */
const { launch } = require("../tests/smoke/lib");

(async () => {
  const { browser, page, errors, responses } = await launch();
  try {
    await page.goto(`${process.env.SERTZ_BASE || "http://127.0.0.1:3000"}/?renderer=canvas`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await page.waitForTimeout(25000);

    const assets = responses.filter((r) => /\/assets\d?\//.test(r.url));
    const all = responses.length;

    /* 경로 그룹핑: /assets/ 바로 아래 첫 세그먼트 */
    const groups = {};
    const ext = {};
    let bytes = 0;
    for (const r of assets) {
      const u = new URL(r.url);
      const parts = u.pathname.split("/").filter(Boolean); // assets, [sub], file
      const sub = parts[1] && parts[1].includes(".") ? "(root)" : parts[1] || "(root)";
      groups[sub] = (groups[sub] || 0) + 1;
      const e = (parts[parts.length - 1].split(".").pop() || "?").toLowerCase();
      ext[e] = (ext[e] || 0) + 1;
    }

    /* 같은 베이스 이름이 여러 번 요청됐는지 (중복 로딩 탐지) */
    const byPath = {};
    for (const r of assets) {
      const p = new URL(r.url).pathname;
      byPath[p] = (byPath[p] || 0) + 1;
    }
    const dupes = Object.entries(byPath).filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);

    const nonAsset = responses.filter((r) => !/\/assets\d?\//.test(r.url));
    const nonGroups = {};
    for (const r of nonAsset) {
      const u = new URL(r.url);
      const key = u.pathname.startsWith("/_next/") ? u.pathname.split("/")[2] || "next" : u.pathname.split("/")[1] || "/";
      nonGroups[key] = (nonGroups[key] || 0) + 1;
    }

    console.log("── 부팅 요청 프로파일 ──");
    console.log(`총 응답 ${all} / assets ${assets.length} / 비에셋 ${nonAsset.length}`);
    console.log(`pageerror ${errors.length}`);
    console.log("\n[assets 하위 그룹]");
    for (const [k, v] of Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 20)) {
      console.log(`  ${String(v).padStart(5)}  ${k}`);
    }
    console.log("\n[확장자]");
    for (const [k, v] of Object.entries(ext).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(v).padStart(5)}  .${k}`);
    }
    console.log("\n[비에셋 경로]");
    for (const [k, v] of Object.entries(nonGroups).sort((a, b) => b[1] - a[1]).slice(0, 12)) {
      console.log(`  ${String(v).padStart(5)}  ${k}`);
    }
    if (dupes.length) {
      console.log("\n[중복 요청 상위 12]");
      for (const [p, n] of dupes.slice(0, 12)) console.log(`  ${String(n).padStart(3)}x  ${p}`);
    } else {
      console.log("\n[중복 요청] 없음");
    }
  } finally {
    await browser.close();
  }
})();
