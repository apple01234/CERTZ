/**
 * tools/diag-frames.js — loadBodyPrefix 가 실제로 몇 프레임을 요청/실패하는지
 *
 * verify-cosload 가 계속 1/28 을 보고하는데 bodyPrefix 는 적용된다.
 * 즉 "적용은 되는데 시트가 1장뿐"이다. 원인 후보:
 *   ① loadBodyPrefix 가 아예 호출되지 않음 (bodyPending 이 관여하지 않는 경로)
 *   ② 호출되지만 fetch 가 404/실패
 *   ③ BODY_FRAME_NAMES 목록이 잘못돼 필요한 이름을 안 만든다
 *   ④ 파일이 실제로 1장만 존재한다
 * 계측으로 갈라낸다.
 *
 * 사용: node tools/diag-frames.js
 */
const { launch, enterWorld } = require("../tests/smoke/lib");
const PREFIX = process.env.COS_PREFIX || "cost_valkyrie";

(async () => {
  const { browser, page, errors } = await launch();
  try {
    await enterWorld(page, "프레임진단");

    /* ④ 파일 존재 여부를 네트워크로 직접 확인 */
    const fileCheck = await page.evaluate(async (pfx) => {
      const names = ["idle0", "idle1", "walk0", "walk1", "walkside0", "walkup0", "atk0", "atkdown0", "atkup0"];
      const out = {};
      for (const n of names) {
        try {
          const r = await fetch(`/assets/${pfx}_${n}.webp`, { method: "HEAD" });
          out[n] = r.status;
        } catch (e) {
          out[n] = "ERR:" + String(e).slice(0, 30);
        }
      }
      return out;
    }, PREFIX);

    /* ② 로더 계측 — loadImageRaw 가 실제로 도는지, 실패하는지 */
    const probe = await page.evaluate(async (pfx) => {
      const g = window.__SERTZ_DEBUG__?.game;
      const sc = g?.scene?.getScenes(true)?.find((s) => s && s.player);
      const p = sc.player;
      /* BODY_FRAME_NAMES 를 알 수 없으니, 존재 여부만 센다 */
      const FRAMES = [
        "idle0","idle1","idle2","idle3","walk0","walk1","walk2","walk3",
        "walkside0","walkside1","walkside2","walkside3","walkup0","walkup1","walkup2","walkup3",
        "atk0","atk1","atk2","atk3","atkdown0","atkdown1","atkdown2","atkdown3","atkup0","atkup1","atkup2","atkup3",
      ];
      const before = FRAMES.filter((f) => sc.textures.exists(`${pfx}_${f}`));

      /* applyBodyLook 을 태워 bodyPending 을 만든다 */
      p.outfit = "outfit_" + pfx.replace(/^costm?_/, "");
      p.gender = pfx.startsWith("costm_") ? "m" : "f";
      p.applyBodyLook();
      const afterApply = { pending: p.bodyPending ?? null, prefix: p.bodyPrefix };

      /* 9초 대기 (tickBodyPending 이 loadBodyPrefix 를 돌린다) */
      await new Promise((r) => setTimeout(r, 9000));
      const after = FRAMES.filter((f) => sc.textures.exists(`${pfx}_${f}`));
      return {
        beforeCount: before.length,
        beforeNames: before,
        afterApply,
        afterCount: after.length,
        afterNames: after,
        bodyKickCount: p.bodyKickCount,
        bodyLoadTried: p.bodyLoadTried ?? null,
        pendingNow: p.bodyPending ?? null,
        prefixNow: p.bodyPrefix,
      };
    }, PREFIX);

    console.log("── 프레임 로드 진단 ──");
    console.log(`접두사: ${PREFIX}`);
    console.log("④ 파일 HEAD:", JSON.stringify(fileCheck));
    console.log(`① 적용 전 존재: ${probe.beforeCount}/28 ${JSON.stringify(probe.beforeNames)}`);
    console.log(`① applyBodyLook 후: ${JSON.stringify(probe.afterApply)}`);
    console.log(`② 9초 후 존재: ${probe.afterCount}/28 ${JSON.stringify(probe.afterNames)}`);
    console.log(`   bodyKickCount: ${probe.bodyKickCount} / bodyLoadTried: ${probe.bodyLoadTried}`);
    console.log(`   pendingNow: ${probe.pendingNow} / prefixNow: ${probe.prefixNow}`);
    console.log("pageerror:", errors.length);
  } finally {
    await browser.close();
  }
})();
