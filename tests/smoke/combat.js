/**
 * tests/smoke/combat.js — 전투 스모크
 *
 * 판정(수치):
 *   ① 월드 진입 + WorldScene 존재
 *   ② 마을 테마가 D4 로딩됨(_vTheme.title 존재)
 *   ③ 적이 스폰된다
 *   ④ 적 HP 가 실제로 감소한다
 *   ⑤ 치명 pageerror 0건
 *
 * 주의: `takeDamage(dmg, dir: Vector2, knock, dmgPct: number)` 실측 시그니처.
 *        3번째·4번째 인자를 문자열/불리언으로 넘기면 TSC 는 통과해도 런타임에서 깨진다.
 *        여기서는 **플레이어 공격 경로만** 태워 판정한다(직접 호출은 시그니처 결합도가 높다).
 *
 * 사용: node tests/smoke/combat.js
 */
const { launch, enterWorld, worldState, report } = require("./lib");

(async () => {
  const { browser, page, errors } = await launch();
  let fail = 1;
  try {
    const started = await enterWorld(page, "전투검증");
    const st = await worldState(page);

    const combat = await page.evaluate(async () => {
      const D = window.__SERTZ_DEBUG__;
      const sc = D?.game?.scene?.getScenes(true)?.find((s) => s && s.player && s.stageDef);
      if (!sc) return { ok: false, reason: "WorldScene 없음" };

      /* 실측: sc.enemies 는 배열이다. 그룹 API(getChildren)를 쓰면 항상 0이 나온다. */
      const all = () => (Array.isArray(sc.enemies) ? sc.enemies : (sc.enemies?.getChildren?.() ?? []));
      const alive = () => all().filter((e) => e && e.alive !== false && e.active !== false && (e.hp ?? 0) > 0);
      let list = alive();

      /* 마을이면 적이 없다 → 사냥터로 이동.
       *  실측: WorldScene 은 scene.restart({ stage: StageKey }) 를 쓴다({stagesKey} 아님).
       *  후보는 골드/경험치가 낮은 초반 사냥터를 우선 선택한다(보스 즉사 방지). */
      let movedTo = null;
      if (list.length === 0) {
        const STAGES = D?.stages?.STAGES ?? {};
        const keys = Object.keys(STAGES).filter((k) => !STAGES[k]?.isVillage && !STAGES[k]?.isBoss);
        if (keys.length) {
          /* 실측 키 형식: village / forest1..forest10 / forestv(마을) — "_1" 이 아니라 "1" 로 끝난다 */
          const pick = keys.find((k) => /1$/.test(k)) ?? keys[0];
          try {
            sc.scene.restart({ stage: pick });
            movedTo = pick;
            await new Promise((r) => setTimeout(r, 11000));
          } catch (e) { return { ok: false, reason: "restart 실패: " + String(e), tried: pick }; }
        }
        list = alive();
      }
      if (list.length === 0) return { ok: false, reason: "적 스폰 실패", movedTo, stageNow: sc.stageDef?.key };

      /* 플레이어를 적 바로 옆으로 붙이고 자동사냥을 켜서 실제 전투 경로를 태운다 */
      const t = list[0];
      const hp0 = t.hp;
      /* 실측 공격 경로: EventBus.emit("input:attack") → scene.onAtk → player.doAttack().
       *  doAttack 은 private 이고 autoHunt 는 WorldScene 필드라 직접 호출이 불안정하다.
       *  실제 입력과 동일한 경로(EventBus)를 태우는 것이 회귀 검증으로도 옳다.
       *  EventBus 는 window.__SERTZ_EB__ 로 노출돼 있다. */
      const EB = window.__SERTZ_EB__;
      /* 실측 함정: 마을 진입 직후 dialoguing=true 면 Player.update 가 입력을 봉인해
       *  공격이 아예 실행되지 않는다(HP 84→84 로 계속 0). 대사/패널을 닫아야 한다. */
      try {
        sc.dialoguing = false;
        sc.sleeping = false;
        sc.attackQueued = false;
        if (typeof sc.closeDialogue === "function") sc.closeDialogue();
      } catch { /* 무시 */ }
      try {
        sc.player.setPosition(t.x - 44, t.y);
        sc.autoHunt = true;
      } catch { /* 위치 강제 실패는 무시 */ }

      /* 최대 약 10초 관찰 — 쿨다운(300ms)보다 긴 간격으로 반복 발사 */
      let hpNow = hp0;
      /* 실측: onAtk 는 씬의 attackQueued 플래그만 세우고, 실제 공격은
       *  Player.update 의 (attackPressed && atkCooldown<=0 && state==="idle") 에서 일어난다.
       *  atkCooldown 은 300ms 이므로 250ms 간격으로 쏘면 절반이 씹힌다 → 420ms 로 둔다. */
      for (let i = 0; i < 24; i++) {
        try { EB?.emit?.("input:attack"); } catch { /* 무시 */ }
        await new Promise((r) => setTimeout(r, 420));
        if (!t.active) { hpNow = 0; break; }
        hpNow = t.hp ?? hpNow;
        if (hpNow < hp0) break;
        /* 적이 멀어지면 다시 붙인다 */
        if (i % 6 === 5) {
          try { sc.player.setPosition(t.x - 44, t.y); sc.dialoguing = false; } catch { /* 무시 */ }
        }
      }
      return {
        ok: true,
        usedEventBus: !!EB,
        dialoguing: sc.dialoguing,
        enemyCount: list.length,
        hp0: Math.round(hp0),
        hpNow: Math.round(hpNow),
        dealt: Math.round(hp0 - hpNow),
        killed: !t.active,
      };
    });

    fail = report("COMBAT 스모크", [
      { name: "월드 진입", pass: !!started && st.ok, detail: st.stageKey ?? st.reason },
      { name: "마을 테마 로드(D4)", pass: !!st.theme, detail: st.theme ? `${st.theme.title} / ${st.theme.ground}` : "테마 없음(사냥터일 수 있음)" },
      { name: "플레이어 좌표 유효", pass: st.playerX >= 0 && st.playerY >= 0, detail: `${st.playerX},${st.playerY}` },
      { name: "적 스폰", pass: combat.ok && combat.enemyCount > 0, detail: combat.ok ? `${combat.enemyCount}마리${combat.usedEventBus ? "" : " (EB 미노출)"}` : combat.reason },
      { name: "적 HP 감소", pass: combat.ok && combat.dealt > 0, detail: combat.ok ? `HP ${combat.hp0}→${combat.hpNow} (${combat.dealt}${combat.killed ? ", 처치" : ""})` : "-" },
      { name: "pageerror 0건", pass: errors.length === 0, detail: errors.length ? errors.slice(0, 2).join(" | ") : "0건" },
    ]);
  } finally {
    await browser.close();
  }
  process.exit(fail === 0 ? 0 : 1);
})();
