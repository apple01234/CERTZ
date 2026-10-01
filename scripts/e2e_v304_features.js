/* v3.0.4 E2E — 8항목 검증
 *  [1] 활 회전 수정 — 조준 방향 = 활 회전각 (기존 +90° 오프셋 제거)
 *  [2] 스킬 겹침 제거 — SKILL3_KIND/SKILL4_KIND 값이 28클래스에서 전부 고유
 *  [3] 모바일 3/4차기 — input:skill3/4 이벤트 실제 발동 (v3.0.3에서 미수신 버그)
 *  [4] 전직마다 기존 스킬 강화 — 회전베기 반경/볼트 크기/화살 관통 티어별 증가
 *  [5] 3/4차 임팩트 상향 — 낙뢰 6타 / 신의 화살비 12발
 *  [6] 모바일 퀘스트 토글 — 헤더 탭으로 접기/펼치기
 *  [7] 모바일 스킬 버튼 축소 — 44px (기존 56px) + 4차 4버튼 2×2 그리드
 *  [8] itch.io 신규 몬스터 — 고블린/오르크 주술사/거대 시체 등 스폰 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const fs = require("fs");

const PORT = 3119;
const URL = `http://localhost:${PORT}`;
let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log(`  PASS — ${label}`); } else { fail++; console.log(`  FAIL — ${label}`); } };

async function enterWorld(page) {
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("text=새로운 모험", { timeout: 60000 });
  await page.click("text=새로운 모험");
  for (let i = 0; i < 40; i++) {
    const inWorld = await page.evaluate(() => !!(window.__SERTZ__?.game?.scene.getScene("world")?.player));
    if (inWorld) break;
    await page.mouse.click(640, 400); await page.keyboard.press("e"); await page.waitForTimeout(400);
  }
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.finishIntro("테스터");
  });
  await page.waitForTimeout(400);
  for (let i = 0; i < 5; i++) { await page.keyboard.press("Space"); await page.waitForTimeout(260); }
  /* v3.0.5 — 대사 완전 소진: 뒤늦게 열리는 intro 대사가 player.update를 막아
     skill3/4 발동 검증이 오염되는 것 방지 (dialoguing 연속 3회 false까지 drain) */
  let cleanStreak = 0;
  for (let i = 0; i < 20 && cleanStreak < 3; i++) {
    const dlg = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      if (w.dialoguing) { w.resumeFromDialogue(); return true; }
      return false;
    });
    if (dlg) cleanStreak = 0; else cleanStreak++;
    await page.waitForTimeout(300);
  }
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.dialoguing = false; w.introStep = -1; w.sleepPending = false;
  });
  await page.waitForTimeout(250);
}

async function restartWith(page, stage, patch) {
  await page.evaluate(([st, p]) => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const carry = w.buildSave(st);
    Object.assign(carry, p);
    w.scene.restart({ stage: st, save: carry });
  }, [stage, patch]);
  await page.waitForTimeout(1800);
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    if (w.dialoguing) w.resumeFromDialogue();
    w.dialoguing = false; w.introStep = -1; w.sleepPending = false;
    w.physics.world.resume();
  });
  await page.waitForTimeout(300);
}

/** GM으로 클래스/레벨/MP 설정 */
async function gmSet(page, job, lv) {
  await page.evaluate(([j, l]) => {
    const eb = window.__SERTZ_EB__;
    eb.emit("rpg:gm", { type: "job", value: j });
    eb.emit("rpg:gm", { type: "lv", value: l });
    eb.emit("rpg:gm", { type: "heal" });
  }, [job, lv]);
  await page.waitForTimeout(500);
}

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: process.cwd(), env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 500)); try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) break; } catch {} }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 200)));

  try {
    console.log("[1] 활 회전 — 조준 방향 = 활 각도 (지시 #1)");
    await enterWorld(page);
    await gmSet(page, "ranger", 15);
    const bowRot = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const p = w.player;
      // 오른쪽 조준
      p.facing.set(1, 0); p.flipX = false; p.setFlipX(false);
      w.syncWeaponSprite();
      const rotRight = w.weaponImg.rotation;
      // 왼쪽 조준
      p.facing.set(-1, 0); p.flipX = true; p.setFlipX(true);
      w.syncWeaponSprite();
      const rotLeft = w.weaponImg.rotation;
      p.facing.set(1, 0); p.flipX = false; p.setFlipX(false);
      w.syncWeaponSprite();
      return { rotRight, rotLeft, visible: w.weaponImg.visible };
    });
    ok(bowRot.visible, "활 이미지 렌더 중");
    ok(Math.abs(bowRot.rotRight) < 0.25, `오른쪽 조준 시 활 각도 ≈ 0 (실측 ${bowRot.rotRight.toFixed(3)}) — 기존 +90° 오프셋 제거`);
    ok(Math.abs(Math.abs(bowRot.rotLeft) - Math.PI) < 0.25, `왼쪽 조준 시 활 각도 ≈ 180° (실측 ${bowRot.rotLeft.toFixed(3)})`);

    console.log("[2] 스킬 겹침 제거 — 16개 상위직 3차기 전부 고유 (지시 #4)");
    {
      const src = fs.readFileSync("src/game/classes.ts", "utf8");
      const table = src.slice(src.indexOf("export const SKILL3_KIND"), src.indexOf("export const SKILL4_KIND"));
      const pairs = [...table.matchAll(/^\s*(\w+):\s*"(\w+)"/gm)].map((m) => [m[1], m[2]]);
      const vals = pairs.map(([, v]) => v);
      const dup = vals.filter((v, i) => vals.indexOf(v) !== i);
      ok(pairs.length === 16, `3차기 보유 클래스 16개 (실측 ${pairs.length})`);
      ok(dup.length === 0, `메커니즘 중복 0개 (중복: ${dup.join(",") || "없음"})`);
      const fourOnly = pairs.filter(([k]) => ["warbringer", "crusader", "deadeye", "skylord", "arclord", "eternal", "shadowlord", "blademaster"].includes(k));
      ok(fourOnly.length === 8 && fourOnly.every(([, v]) => ["bloodrage", "holynova", "arrowrain", "cyclone", "chainlight", "gravity", "shadowmine", "swordaura"].includes(v)), "4차 8직업 전부 신규 고유 메커니즘");
      // 4차기(B)도 고유
      const t4 = src.slice(src.indexOf("export const SKILL4_KIND"), src.indexOf("/** GM/전직 패널용"));
      const v4 = [...t4.matchAll(/"(\w+)"/g)].map((m) => m[1]);
      ok(new Set(v4).size === v4.length, `4차기(B) 8종도 전부 고유 (${v4.length}종)`);
    }

    console.log("[3] 모바일 3/4차기 발동 — input:skill3/4 수신 (지시 #7)");
    {
      await gmSet(page, "warbringer", 120);
      const s = await page.evaluate(() => {
        const eb = window.__SERTZ_EB__;
        const w = window.__SERTZ__.game.scene.getScene("world");
        const p = w.player;
        const u3ok = p.skill3Unlocked, u4ok = p.skill4Unlocked;
        eb.emit("input:skill3");
        const cd3 = p.skill3Cd;
        return new Promise((res) => {
          setTimeout(() => {
            // 3차기 연출(attack 310ms) 종료 후 발동 — 상태 플래키 제거
            const waitIdle = () => {
              if (p.state !== "idle") { setTimeout(waitIdle, 60); return; }
              eb.emit("input:skill4");
              setTimeout(() => res({ u3ok, u4ok, cd3, cd4: p.skill4Cd, cls: p.cls }), 120);
            };
            waitIdle();
          }, 120);
        });
      });
      ok(s.u3ok && s.u4ok, `4차 클래스 스킬 해금 (s3=${s.u3ok}, s4=${s.u4ok}, ${s.cls})`);
      ok(s.cd3 > 0, `input:skill3 이벤트로 3차기 발동 (cd=${s.cd3})`);
      ok(s.cd4 > 0, `input:skill4 이벤트로 4차기 발동 (cd=${s.cd4})`);
    }

    console.log("[4] 전직마다 기존 스킬 강화 (지시 #2)");
    {
      // 근접 — 회전베기 반경: 1차(134px) vs 4차(182px)
      await gmSet(page, "warrior", 12);
      await restartWith(page, "forest1", {});
      const spin = await page.evaluate(() => {
        const w = window.__SERTZ__.game.scene.getScene("world");
        const p = w.player;
        const wb = w.physics.world.bounds;
        const list = w.enemies.filter((e) => e.active && e.alive);
        const e = list[0];
        if (!e) return { t1: false };
        // 160px 거리에 배치 — 1차 반경(134) 밖, 4차 반경(182) 안. 이동 오염 방지 위해 기절
        const nx = Math.min(Math.max(p.x + 160, 80), wb.width - 80);
        const ny = Math.min(Math.max(p.y, 80), wb.height - 80);
        if (e.body && e.body.reset) e.body.reset(nx, ny); else { e.x = nx; e.y = ny; }
        e.applyStun?.(1600);
        const hp0 = e.hp;
        p.hp = p.maxHp; p.mp = p.maxMp;
        p.facing.set(1, 0);
        p.useSkill1();
        return new Promise((res) => setTimeout(() => res({ t1: e.hp < hp0, hp0, hp1: e.hp, d: Math.round(Math.hypot(e.x - p.x, e.y - p.y)) }), 450));
      });
      ok(spin.t1 === false, `1차 전사 회전베기 — 160px 밖(반경 134) 미명중 (거리 ${spin.d})`);
      await gmSet(page, "warbringer", 120);
      const spin4 = await page.evaluate(() => {
        const w = window.__SERTZ__.game.scene.getScene("world");
        const p = w.player;
        const wb = w.physics.world.bounds;
        const list = w.enemies.filter((e) => e.active && e.alive);
        const e = list[0];
        if (!e) return { hit: false };
        const nx = Math.min(Math.max(p.x + 160, 80), wb.width - 80);
        const ny = Math.min(Math.max(p.y, 80), wb.height - 80);
        if (e.body && e.body.reset) e.body.reset(nx, ny); else { e.x = nx; e.y = ny; }
        e.applyStun?.(1600);
        const hp0 = e.hp;
        p.hp = p.maxHp; p.mp = p.maxMp;
        p.facing.set(1, 0);
        p.useSkill1();
        return new Promise((res) => setTimeout(() => res({ hit: e.hp < hp0 || !e.active, d: Math.round(Math.hypot(e.x - p.x, e.y - p.y)) }), 450));
      });
      ok(spin4.hit === true, `4차 워브링어 회전베기 — 동일 160px 명중 (반경 182 강화, 거리 ${spin4.d})`);

      // 궁수 — v3.0.6 스킬 고유화: deadeye Z = snipe(즉발 히트스캔 저격 라인 — 화살 투사체 없음)
      await gmSet(page, "deadeye", 120);
      const arr = await page.evaluate(() => {
        const w = window.__SERTZ__.game.scene.getScene("world");
        const p = w.player;
        p.state = "idle"; p.skill1Cd = 0; p.mp = p.maxMp;
        p.facing.set(1, 0);
        const kind = window.__SERTZ_DEBUG__.classes.resolveSkill1Of(p.cls);
        p.useSkill1();
        return new Promise((res) => setTimeout(() => {
          const act = w.pProjPool.filter((x) => x.active);
          res({ kind, n: act.length });
        }, 350));
      });
      ok(arr.kind === "snipe" && arr.n === 0, `4차 데드아이 Z = snipe 히트스캔 저격 (kind ${arr.kind}, 투사체 ${arr.n}) — 계열 고유화`);

      // 마법사 — v3.0.6 스킬 고유화: arclord Z = arcbolt(착탄 폭발 볼트 scale 1.5)
      await gmSet(page, "arclord", 120);
      const bolt = await page.evaluate(() => {
        const w = window.__SERTZ__.game.scene.getScene("world");
        const p = w.player;
        p.state = "idle"; p.skill1Cd = 0; p.skill2Cd = 0; p.skill3Cd = 0; p.skill4Cd = 0;
        p.hp = p.maxHp; p.mp = p.maxMp;
        p.facing.set(1, 0);
        const kind = window.__SERTZ_DEBUG__.classes.resolveSkill1Of(p.cls);
        p.useSkill1();
        return new Promise((res) => setTimeout(() => {
          const act = w.pProjPool.filter((x) => x.active);
          res({ kind, scaleMax: Math.max(0, ...act.map((x) => x.scaleX)), tier: p.tier });
        }, 250));
      });
      ok(bolt.kind === "arcbolt" && bolt.scaleMax >= 1.4, `4차 아크로드 Z = arcbolt 착탄 폭발 볼트 (kind ${bolt.kind}, scale ${bolt.scaleMax.toFixed(2)}) — 계열 고유화`);
    }

    console.log("[5] 3/4차 임팩트 상향 (지시 #3)");
    {
      // 낙뢰: 6타 (기존 3타) — 먼저 재시작, 이후 GM 클래스 지정 (세이브 반영 순서)
      await restartWith(page, "forest1", {});
      await gmSet(page, "stormbringer", 60);
      const th = await page.evaluate(() => {
        const w = window.__SERTZ__.game.scene.getScene("world");
        const p = w.player;
        const wb = w.physics.world.bounds;
        const list = w.enemies.filter((e) => e.active && e.alive).slice(0, 5);
        list.forEach((e, i) => {
          const nx = Math.min(Math.max(p.x + 140 + i * 40, 80), wb.width - 80);
          const ny = Math.min(Math.max(p.y + (i % 2 ? 60 : -60), 80), wb.height - 80);
          if (e.body && e.body.reset) e.body.reset(nx, ny); else { e.x = nx; e.y = ny; }
          e.applyStun?.(2500);
        });
        const hps = list.map((e) => e.hp);
        p.hp = p.maxHp; p.mp = p.maxMp;
        p.useSkill3();
        return new Promise((res) => setTimeout(() => {
          const hit = list.filter((e, i) => !e.active || e.hp < hps[i]).length;
          res({ hit, placed: list.length });
        }, 1100));
      });
      ok(th.hit >= 5, `낙뢰 6타 강화 — 배치 ${th.placed} 전부 직격 (명중 ${th.hit}, 기존 3타 → 6타)`);

      // 신의 화살비: 12발 (기존 8발)
      await gmSet(page, "deadeye", 120);
      const ga = await page.evaluate(() => {
        const w = window.__SERTZ__.game.scene.getScene("world");
        const p = w.player;
        p.hp = p.maxHp; p.mp = p.maxMp;
        p.useSkill4();
        return new Promise((res) => setTimeout(() => {
          res({ n: w.pProjPool.filter((x) => x.active).length });
        }, 700));
      });
      ok(ga.n >= 12, `신의 화살비 12발 (기존 8 → 12, 실측 ${ga.n})`);
    }

    console.log("[6] 모바일 퀘스트 토글 (지시 #5)");
    {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(500);
      const st0 = await page.evaluate(() => localStorage.getItem("sertz.trackerOpen"));
      const btn = page.locator('[aria-label*="퀘스트 트래커"]').first();
      const visible = await btn.isVisible().catch(() => false);
      let toggled = null;
      if (visible) {
        await btn.click();
        await page.waitForTimeout(300);
        toggled = await page.evaluate(() => localStorage.getItem("sertz.trackerOpen"));
      }
      ok(visible, "모바일 뷰포트에서 퀘스트 트래커 헤더 표시");
      ok(toggled !== null && toggled !== st0, `헤더 탭 1회 → 토글 상태 변화 (${st0 ?? "null"} → ${toggled ?? "null"})`);
      if (toggled === "0") { await btn.click(); await page.waitForTimeout(200); } // 복원
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.waitForTimeout(300);
    }

    console.log("[7] 모바일 스킬 버튼 축소 + 4차 2×2 (지시 #6)");
    {
      await gmSet(page, "warbringer", 120);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(600);
      const sizes = await page.evaluate(() => {
        const labels = ["종언의 일격", "피의 격노", "전쟁의 회오리", "파멸 돌진"]; // Z/C/V/B 4스킬 (기본공격 버튼은 aria-label="공격")
        const out = [];
        for (const lb of labels) {
          const b = document.querySelector(`button[aria-label="${lb}"]`);
          if (b) { const r = b.getBoundingClientRect(); out.push({ lb, w: r.width, h: r.height }); }
        }
        return out;
      });
      ok(sizes.length === 4, `4차 클래스 스킬 버튼 4개 표시 (실측 ${sizes.length})`);
      ok(sizes.every((s) => s.w <= 48 && s.h <= 48), `모바일 스킬 버튼 ≤48px (기존 56px → 44px): ${sizes.map((s) => `${s.lb}:${Math.round(s.w)}x${Math.round(s.h)}`).join(", ")}`);
      // 2×2 그리드 — 같은 행에 2개
      if (sizes.length === 4) {
        const grid = await page.evaluate(() => {
          const labels = ["종언의 일격", "피의 격노", "전쟁의 회오리", "파멸 돌진"];
          const rs = labels.map((lb) => {
            const b = document.querySelector(`button[aria-label="${lb}"]`);
            return b ? b.getBoundingClientRect() : null;
          });
          if (rs.some((r) => !r)) return null;
          const rowSame = Math.abs(rs[0].top - rs[1].top) < 8 && Math.abs(rs[2].top - rs[3].top) < 8;
          const colSplit = rs[0].top < rs[2].top - 20;
          return { rowSame, colSplit };
        });
        ok(grid && grid.rowSame && grid.colSplit, "스킬 버튼 2×2 그리드 배치 (상위기 상단/기본기 하단)");
      }
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.waitForTimeout(300);
    }

    console.log("[8] itch.io 신규 몬스터 스폰 (지시 #8)");
    {
      await restartWith(page, "forest1", {});
      const z1 = await page.evaluate(() => {
        const w = window.__SERTZ__.game.scene.getScene("world");
        return [...new Set(w.enemies.filter((e) => e.active).map((e) => e.def.key))];
      });
      ok(z1.includes("x3_goblin"), `챕터1 고블린 약탈자 스폰 (${z1.join(",")})`);
      await restartWith(page, "abyss1", {});
      const z10 = await page.evaluate(() => {
        const w = window.__SERTZ__.game.scene.getScene("world");
        return [...new Set(w.enemies.filter((e) => e.active).map((e) => e.def.key))];
      });
      ok(z10.includes("x3_bigzombie"), `챕터10 거대 시체 스폰 (${z10.join(",")})`);
      ok(z10.length <= 7, `구역 종 다양성 유지 (${z10.length}종)`);
    }

    console.log(`\n===== v3.0.4 E2E 결과: ${pass} PASS / ${fail} FAIL =====`);
  } catch (e) {
    console.error("TEST ERROR:", e);
    fail++;
  } finally {
    await browser.close();
    srv.kill();
  }
  process.exit(fail > 0 ? 1 : 0);
})();
