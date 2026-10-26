/**
 * tools/diag-cosload.js — tickBodyPending 이 실제로 도는지 추적
 *
 * verify-cosload 는 NG(texKey hero_idle1, bodyPrefix "")를 반복했다.
 * 시트는 28/28 도착하고 애님도 4/4 등록됐는데 적용만 안 된다.
 * 가설: ① tickBodyPending 미호출 ② 호출되지만 조기 반환 ③ applyBodyLook 이
 *       outfit 을 못 읽어 다시 기본으로 계산 ④ loadBodyPrefix 가 끝나기 전에
 *       8회 한도 소진. 계측으로 갈라낸다.
 *
 * 사용: node tools/diag-cosload.js
 */
const { launch, enterWorld } = require("../tests/smoke/lib");

const PREFIX = process.env.COS_PREFIX || "costm_valkyrie";

(async () => {
  const { browser, page, errors } = await launch();
  try {
    await enterWorld(page, "코스튬진단");

    const step1 = await page.evaluate((pfx) => {
      const g = window.__SERTZ_DEBUG__?.game;
      const sc = g?.scene?.getScenes(true)?.find((s) => s && s.player);
      if (!sc) return { ok: false };
      const p = sc.player;
      p.outfit = "outfit_" + pfx.replace(/^costm?_/, "");
      p.gender = pfx.startsWith("costm_") ? "m" : "f";
      /* 계측용 래퍼 — 실제 호출 여부와 반환 경로를 센다 */
      p.__diag = { tickCalls: 0, existsTrue: 0, applied: 0, lastPrefix: null, lastPending: null };
      const origTick = p.tickBodyPending.bind(p);
      p.tickBodyPending = function () {
        p.__diag.tickCalls++;
        p.__diag.lastPending = p.bodyPending;
        if (p.bodyPending && p.scene.textures.exists(`${p.bodyPending}_idle0`)) p.__diag.existsTrue++;
        const before = p.bodyPrefix;
        origTick();
        if (p.bodyPrefix && p.bodyPrefix !== before) { p.__diag.applied++; p.__diag.lastPrefix = p.bodyPrefix; }
      };
      p.applyBodyLook();
      return {
        ok: true,
        afterApply: { bodyPrefix: p.bodyPrefix, pending: p.bodyPending ?? null, outfit: p.outfit, gender: p.gender },
      };
    }, PREFIX);

    await page.waitForTimeout(9000);

    const step2 = await page.evaluate((pfx) => {
      const g = window.__SERTZ_DEBUG__?.game;
      const sc = g?.scene?.getScenes(true)?.find((s) => s && s.player);
      const p = sc?.player;
      if (!p) return { ok: false };
      return {
        ok: true,
        diag: p.__diag,
        bodyPrefix: p.bodyPrefix,
        bodyPending: p.bodyPending ?? null,
        outfit: p.outfit,
        gender: p.gender,
        bodyKickCount: p.bodyKickCount,
        texKey: p.frame?.texture?.key ?? null,
        idle0Exists: p.scene.textures.exists(`${pfx}_idle0`),
        animExists: p.scene.anims.exists(`${pfx}-idle`),
        worldActive: sc.scene?.isActive?.("world") ?? null,
        scenePaused: sc.scene?.isPaused?.("world") ?? null,
        sysPaused: sc.sys?.settings?.active ?? null,
        dialogsOpen: sc.dialoguing ?? null,
        transitioning: sc.transitioning ?? null,
        cutsceneBusy: sc.cutsceneBusy ?? null,
        sceneKey: sc.scene?.key ?? null,
        activeScenes: (window.__SERTZ_DEBUG__?.game?.scene?.getScenes(true) ?? []).map((x) => x.scene?.key),
      };
    }, PREFIX);

    console.log("── 코스튬 로드 진단 ──");
    console.log("① applyBodyLook 직후:", JSON.stringify(step1.afterApply));
    console.log("② 9초 후:");
    for (const [k, v] of Object.entries(step2)) if (k !== "ok") console.log(`   ${k}: ${JSON.stringify(v)}`);
    console.log("pageerror:", errors.length);
  } finally {
    await browser.close();
  }
})();
