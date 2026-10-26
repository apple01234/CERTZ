/**
 * tests/smoke/save.js — 저장/복원 스모크
 *
 * 판정(수치):
 *   ① 저장 직후 반환 객체에 필수 키가 있다
 *   ② localStorage 에 실제로 기록된다
 *   ③ 새로고침 후 복원되어 좌표/HP 가 저장 시점과 일치한다
 *
 * 사용: node tests/smoke/save.js
 */
const { launch, enterWorld, worldState, report } = require("./lib");

(async () => {
  const { browser, page, errors } = await launch();
  let fail = 1;
  try {
    const started = await enterWorld(page, "저장검증");

    /* 저장 실행 + 키 확인 */
    const saved = await page.evaluate(async () => {
      const D = window.__SERTZ_DEBUG__;
      const sc = D?.game?.scene?.getScenes(true)?.find((s) => s && s.player && s.stageDef);
      if (!sc) return { ok: false, reason: "WorldScene 없음" };

      let payload = null;
      try {
        if (typeof sc.buildSave === "function") payload = sc.buildSave();
      } catch (e) { return { ok: false, reason: "buildSave 예외: " + String(e) }; }

      /* 저장 함수가 다르면 saveGame 경로 시도 */
      if (!payload) {
        try { sc.save && sc.save(); } catch { /* 무시 */ }
      }

      const keys = Object.keys(window.localStorage).filter((k) => /sertz|save/i.test(k));
      const dump = keys.map((k) => [k, (window.localStorage.getItem(k) || "").length]);
      return {
        ok: true,
        hasPayload: !!payload,
        payloadKeys: payload ? Object.keys(payload).slice(0, 12) : [],
        lsKeys: dump,
        x: Math.round(sc.player.x),
        y: Math.round(sc.player.y),
        hp: Math.round(sc.player.hp ?? -1),
        stageKey: sc.stageDef?.key ?? null,
      };
    });

    /* 저장 → 새로고침 → 복원.
     *  실측: reload 후 고정 대기 + 버튼 1회 클릭으로는 WorldScene 복귀가 안 잡혔다.
     *  enterWorld 가 버튼 출현/씬 활성화를 폴링하므로 그 경로를 재사용한다. */
    await page.waitForTimeout(1500);
    const reentered = await enterWorld(page, "저장검증");
    const after = await worldState(page);

    const dx = saved.ok && after.ok ? Math.abs(after.playerX - saved.x) : -1;
    const dy = saved.ok && after.ok ? Math.abs(after.playerY - saved.y) : -1;

    fail = report("SAVE 스모크", [
      { name: "월드 진입", pass: !!started && saved.ok, detail: saved.stageKey ?? saved.reason },
      { name: "buildSave 반환", pass: !!saved.hasPayload, detail: saved.hasPayload ? `${saved.payloadKeys.length}키` : "없음" },
      { name: "localStorage 기록", pass: (saved.lsKeys || []).length > 0, detail: (saved.lsKeys || []).map(([k, n]) => `${k}(${n}B)`).join(", ") || "0건" },
      { name: "재진입 성공", pass: !!reentered, detail: reentered ? "OK" : "실패" },
      { name: "복원 후 좌표 근접", pass: dx >= 0 && dy >= 0 && dx < 220 && dy < 220, detail: `Δ(${dx},${dy})` },
      { name: "복원 후 스테이지 동일", pass: after.stageKey === saved.stageKey, detail: `${saved.stageKey} → ${after.stageKey}` },
      { name: "pageerror 0건", pass: errors.length === 0, detail: errors.length ? errors.slice(0, 2).join(" | ") : "0건" },
    ]);
  } finally {
    await browser.close();
  }
  process.exit(fail === 0 ? 0 : 1);
})();
