/**
 * tools/profile-boot2.js — 부팅 에셋을 파일명 접두사별로 분해 (P1-3)
 *
 * profile-boot 은 하위 디렉터리까지만 봤다. 정작 2,993건이 assets 루트에
 * 몰려 있어 어느 계열(hero_/job_/x3_/mob_…)이 폭증 원인인지 알 수 없다.
 * 접두사 단위로 쪼개고, '/'-경로 비에셋 요청의 정체도 함께 확인한다.
 *
 * 사용: node tools/profile-boot2.js
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
    const prefixes = {};
    for (const r of assets) {
      const name = new URL(r.url).pathname.split("/").pop() || "?";
      const base = name.replace(/\.\w+$/, "");
      /* 첫 토큰 + 두 번째 토큰까지 (hero_sera_idle0 → hero_sera) */
      const toks = base.split("_");
      const key = toks.length > 1 ? `${toks[0]}_${toks[1]}` : toks[0];
      prefixes[key] = (prefixes[key] || 0) + 1;
    }

    console.log(`assets ${assets.length}건 / pageerror ${errors.length}`);
    console.log("\n[접두사별 상위 30]");
    const sorted = Object.entries(prefixes).sort((a, b) => b[1] - a[1]);
    for (const [k, v] of sorted.slice(0, 30)) console.log(`  ${String(v).padStart(5)}  ${k}`);
    console.log(`\n접두사 종류 ${sorted.length}`);

    /* '/' 경로 요청의 정체 */
    const slash = responses.filter((r) => new URL(r.url).pathname === "/");
    const byType = {};
    const byStatus = {};
    for (const r of slash) {
      const t = r.resourceType || "?";
      byType[t] = (byType[t] || 0) + 1;
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    }
    console.log(`\n['/'-경로 요청 ${slash.length}건]`);
    console.log("  resourceType:", JSON.stringify(byType));
    console.log("  status:", JSON.stringify(byStatus));
    if (slash.length) console.log("  예시:", slash.slice(0, 3).map((r) => `${r.status} ${r.url}`).join(" | "));
  } finally {
    await browser.close();
  }
})();
