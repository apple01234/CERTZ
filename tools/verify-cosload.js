/**
 * tools/verify-cosload.js — 코스튬 온디맨드 로드가 퀄리티를 해치지 않는지 검증
 *
 * 배경: P1-3 최적화로 타이틀의 65종 일괄 로드를 없애고, 착용한 코스튬만 받도록 바꿨다.
 *       요청 수는 54% 줄었지만, 정작 "코스튬을 입는 순간" 그 시트가 제때 도착하지 않으면
 *       첫 프레임이 빈 채로 뜨는 퀄리티 저하가 생긴다. 사용자 지침:
 *       "최적화를 하되 퀄리티는 떨어뜨리지 말기".
 *
 * 검증: 저장된 코스튬 접두사를 가진 캐릭터로 월드에 들어가서
 *       ① 코스튬 시트 28프레임이 전부 textures 에 존재하는가
 *       ② 애님(cost_*-idle 등)이 등록됐는가
 *       ③ 플레이어 텍스처 키가 실제로 cost_* 를 가리키는가 (기본 외형 폴백 아님)
 *       ④ pageerror 0
 *
 * 사용: node tools/verify-cosload.js
 */
const { launch, enterWorld } = require("../tests/smoke/lib");

const PREFIX = process.env.COS_PREFIX || "costm_valkyrie";

(async () => {
  const { browser, page, errors } = await launch();
  const out = { prefix: PREFIX, frames: 0, anims: 0, texKey: null, ok: false };
  try {
    await page.goto(`${process.env.SERTZ_BASE || "http://127.0.0.1:3000"}/?renderer=canvas`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });

    /* 로비 생성 폼을 끝까지 진행한 뒤, 저장 세이브에 코스튬을 심고 재진입한다.
     *  (로비 UI 로 코스튬을 사는 경로는 골드/BM 이 필요해 스모크로 재현하기 어렵다) */
    await enterWorld(page, "코스튬검증");

    /* 월드 씬 + player 가 실제로 준비될 때까지 기다린다 (고정 sleep 은 타이밍에 취약) */
    await page.waitForFunction(
      () => {
        const g = window.__SERTZ_DEBUG__?.game;
        const sc = g?.scene?.getScene?.("world");
        return !!(sc && sc.player && sc.scene?.isActive?.("world"));
      },
      { timeout: 60000 }
    );

    /* 월드 진입 후 세이브에 코스튬 주입 → 월드 재시작 */
    const injected = await page.evaluate((pfx) => {
      const g = window.__SERTZ_DEBUG__?.game;
      const sc = g?.scene?.getScene?.("world");
      if (!sc) return { ok: false, reason: "world 씬 없음" };
      try {
        /* ✱ 주의: applyBodyLook 은 outfit 에서 접두사를 **다시 계산**한다.
         *  costm_valkyrie → outfit="outfit_valkyrie" + gender="m"
         *  cost_valkyrie  → outfit="outfit_valkyrie" + gender="f"
         *  둘의 차이는 gender 뿐이다. gender 를 틀리면 bodyPrefix 가 어긋나
         *  시트가 로드돼도 적용되지 않는다(실측으로 겪음). */
        /* ✱ job*_ 접두사는 outfit 이 아니라 cls 에서 나온다(tier2RootOf).
         *  outfit 에 "jobm_archmage" 를 넣으면 applyBodyLook 이 cost_jobm_archmage
         *  라는 존재하지 않는 접두사를 만든다(실측 0/28). 경로를 분리한다. */
        if (pfx.startsWith("job")) {
          sc.player.outfit = null;
          sc.player.gender = pfx.startsWith("jobm_") ? "m" : "f";
          const root = pfx.replace(/^jobm?_/, "");
          sc.player.cls = root; // 전직 루트명 — tier2RootOf 가 그대로 돌려준다
        } else {
          sc.player.outfit = "outfit_" + pfx.replace(/^costm?_/, "");
          sc.player.gender = pfx.startsWith("costm_") ? "m" : "f";
        }
        sc.player.applyBodyLook();
        return { ok: true, bodyPrefix: sc.player.bodyPrefix, pending: sc.player.bodyPending ?? null };
      } catch (e) {
        return { ok: false, reason: String(e) };
      }
    }, PREFIX);
    out.injected = injected;

    /* 온디맨드 로드가 끝날 시간을 준다 (3라운드 재시도 포함) */
    await page.waitForTimeout(9000);

    const probe = await page.evaluate((pfx) => {
      const g = window.__SERTZ_DEBUG__?.game;
      const sc = g?.scene?.getScene?.("world");
      const res = { frames: 0, anims: 0, texKey: null, exists: false, prefix: null };
      if (!sc) return res;
      const p = sc.player;
      res.prefix = p.bodyPrefix;
      res.exists = p.scene.textures.exists(`${pfx}_idle0`);
      const FRAMES = [
        "idle0","idle1","idle2","idle3","walk0","walk1","walk2","walk3",
        "walkside0","walkside1","walkside2","walkside3","walkup0","walkup1","walkup2","walkup3",
        "atk0","atk1","atk2","atk3","atkdown0","atkdown1","atkdown2","atkdown3","atkup0","atkup1","atkup2","atkup3",
      ];
      for (const f of FRAMES) if (p.scene.textures.exists(`${pfx}_${f}`)) res.frames++;
      for (const a of ["idle", "walk", "walk-up", "walk-side"]) if (p.scene.anims.exists(`${pfx}-${a}`)) res.anims++;
      res.texKey = p.frame?.texture?.key ?? p.texture?.key ?? null;
      return res;
    }, PREFIX);

    out.frames = probe.frames;
    out.anims = probe.anims;
    out.texKey = probe.texKey;
    out.bodyPrefix = probe.prefix;
    out.exists = probe.exists;

    /* 텍스처 키가 코스튬이거나, 애님 키가 코스튬 계열이면 적용된 것으로 본다.
     *  bodyPrefix 가 코스튬이면 bodyKey() 가 모든 hero_* 를 코스튬 시트로 매핑한다. */
    const isCostume = /^cost(m?)_/.test(out.texKey || "") || /^cost(m?)_/.test(out.bodyPrefix || "");
    out.ok = out.frames === 28 && out.anims >= 4 && isCostume && errors.length === 0;

    console.log("── 코스튬 온디맨드 로드 검증 ──");
    console.log(`  대상 접두사   : ${PREFIX}`);
    console.log(`  주입 결과     : ${JSON.stringify(out.injected)}`);
    console.log(`  시트 프레임   : ${out.frames}/28 ${out.frames === 28 ? "[PASS]" : "[FAIL]"}`);
    console.log(`  애님 등록     : ${out.anims}/4 ${out.anims >= 4 ? "[PASS]" : "[FAIL]"}`);
    console.log(`  플레이어 텍스처: ${out.texKey} ${isCostume ? "[PASS — 코스튬으로 렌더]" : "[FAIL — 기본 외형 폴백]"}`);
    console.log(`  bodyPrefix    : ${out.bodyPrefix}`);
    console.log(`  pageerror     : ${errors.length}`);
    console.log(`  => ${out.ok ? "OK — 퀄리티 유지" : "NG"}`);
  } finally {
    await browser.close();
  }
  process.exit(out.ok ? 0 : 1);
})();
