/**
 * e2e_vc148.js — 보스 그리드 수리 검증:
 *  ① 아틀라스 3종 신규 로드(abudditos/vord/gram) + 풀애니 등록 + 프레임 기하 일치
 *  ② vord가 boss2(유령선)가 아닌 전용 흑룡 아틀라스를 쓰는지(정적)
 *  ③ 페이지 에러 0 · 게이트 148/1.0.8
 */
const { chromium } = require("playwright");
const fs = require("fs");

(async () => {
  const base = "http://127.0.0.1:3000";
  let pass = 0, fail = 0;
  const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("PASS", name, extra); } else { fail++; console.log("FAIL", name, extra); } };
  const errors = [];

  const tex = fs.readFileSync("src/game/textures.ts", "utf8");
  ok("BOSS_ATLAS 3종 등록", /boss_abudditos:\s*\{ key: "atl_boss_abudditos", file: "atl_boss_abudditos\.webp", fw: 298, fh: 220 \}/.test(tex) && /boss_vord:\s*\{ key: "atl_boss_vord"/.test(tex) && /boss_gram:\s*\{ key: "atl_boss_gram"/.test(tex));
  ok("행 프레임 수 실측값", tex.includes("boss_abudditos: [8, 8, 7, 8, 8, 8, 8]") && /boss_gram:\s*\[6, 6, 6, 6, 6, 6, 6\]/.test(tex));
  const st = fs.readFileSync("src/game/stages.ts", "utf8");
  ok("vord 전용 아틀라스 전환", /key: "vord"[\s\S]{0,600}?tex: "boss_vord"/.test(st) && !/key: "vord"[\s\S]{0,600}?tex: "boss2"/.test(st));
  for (const f of ["atl_boss_abudditos", "atl_boss_vord", "atl_boss_gram"]) {
    ok(`파일 ${f}.webp`, fs.existsSync(`public/assets/${f}.webp`));
    ok(`초상화 bossport_${f.replace("atl_boss_", "")}.webp`, fs.existsSync(`public/assets/bossport_boss_${f.replace("atl_boss_", "")}.webp`));
  }

  const browser = await chromium.launch({
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
    executablePath: "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome",
  });
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  p.setDefaultTimeout(40000);
  p.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
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
    await ni.fill("vc148테스터");
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
  await p.waitForTimeout(16000);
  ok("월드 진입", await p.evaluate(() => !!window.__SERTZ_SCENE__));

  const atlas = await p.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    if (!s) return { err: "no-scene" };
    const out = {};
    for (const [texKey, key] of [["boss_abudditos", "atl_boss_abudditos"], ["boss_vord", "atl_boss_vord"], ["boss_gram", "atl_boss_gram"]]) {
      const t = s.textures.exists(key) ? s.textures.get(key) : null;
      const fr = t && t.get ? t.get(0) : null;
      out[texKey] = {
        loaded: !!t,
        w: fr ? fr.width : 0,
        h: fr ? fr.height : 0,
        idle: s.anims.exists(`${texKey}-idle`),
        die: s.anims.exists(`${texKey}-die`),
        sp3: s.anims.exists(`${texKey}-sp3`),
      };
    }
    return out;
  });
  for (const k of ["boss_abudditos", "boss_vord", "boss_gram"]) {
    const a = atlas[k] || {};
    ok(`${k} 아틀라스 로드+기하`, a.loaded === true && a.w === (k === "boss_gram" ? 304 : 298) && a.h === (k === "boss_gram" ? 274 : 220), JSON.stringify(a));
    ok(`${k} 풀애니(idle/sp3/die)`, a.idle && a.sp3 && a.die);
  }

  const ver = await p.evaluate(async () => {
    try { const r = await fetch("/api/version"); const j = await r.json(); return { code: j.code, latest: j.latest }; } catch { return null; }
  });
  ok("게이트 148/1.0.8", !!ver && ver.code === 148 && ver.latest === "1.0.8", JSON.stringify(ver));

  await p.waitForTimeout(2000);
  ok("pageerror 0", errors.length === 0, errors.slice(0, 3).join(" | "));
  console.log(`\n=== e2e_vc148: ${pass} PASS / ${fail} FAIL ===`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})();
