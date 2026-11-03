import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createCampaignServer } from "../multiplayer/campaign/server.mjs";
import { signProof, verifyProof } from "../src/game/campaign/receipts.ts";
import { newCampaign } from "../src/game/campaign/progress.ts";
const base = process.env.BASE_URL ?? "http://localhost:3000",
  output = process.env.OATH_SCREENSHOTS ?? "/tmp/oath-playtest";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [];
async function go(page, x, y) {
  const box = await page.locator("canvas").boundingBox();
  await page.mouse.click(
    box.x + (x / 1024) * box.width,
    box.y + (y / 640) * box.height,
  );
}
async function skip(page) {
  await page.getByRole("dialog", { name: "이야기 대화" }).waitFor();
  await page.getByRole("button", { name: "건너뛰기" }).click();
}
const key = "sertz:memory-oath-v1:characters";
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.url().includes("/assets/") && r.status() >= 400)
      errors.push(`Asset ${r.status()}: ${r.url()}`);
  });
  await page.addInitScript(() => {
    if (!localStorage.getItem("sertz_save_v2"))
      localStorage.setItem("sertz_save_v2", ' {"stage":"forest1", "lv":99} ');
  });
  await page.goto(base);
  await page.getByRole("button", { name: "서약을 시작하다" }).waitFor();
  await page.waitForFunction(
    () =>
      document.querySelector(".oath-start-card > .oath-primary")?.disabled ===
      false,
  );
  await page.screenshot({ path: `${output}/title.png` });
  await page.getByLabel("캐릭터 이름").fill("별의증인");
  await page.getByRole("button", { name: "서약을 시작하다" }).click();
  await page.waitForTimeout(500);
  await go(page, 512, 300);
  await skip(page);
  for (const [i, [x, y]] of [
    [310, 330],
    [700, 250],
    [765, 470],
  ].entries()) {
    await go(page, x, y);
    await page.waitForFunction(
      ({ key, count }) => {
        const s = JSON.parse(localStorage.getItem(key));
        const p = s.characters.find((c) => c.characterId === s.activeId);
        return count === 3 ? p.objective === 2 : p.targets.length === count;
      },
      { key, count: i + 1 },
      { timeout: 6000 },
    );
  }
  await go(page, 512, 300);
  await skip(page);
  await page
    .getByRole("heading", { name: "다음 이야기가 기다립니다" })
    .waitFor();
  assert.equal(
    await page.evaluate(() => localStorage.getItem("sertz_save_v2")),
    ' {"stage":"forest1", "lv":99} ',
  );
  const save = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)),
    key,
  );
  const p = save.characters[0];
  assert.equal(p.coins, 60);
  assert.equal(p.inventory["memory-fragment"], 1);
  await page.screenshot({ path: `${output}/chapter-complete.png` });
  assert.equal(await page.locator(".oath-earned").count(), 1);
  await page.reload();
  await page.getByRole("button", { name: /별의증인/ }).click();
  await page
    .getByRole("heading", { name: "다음 이야기가 기다립니다" })
    .waitFor();
  const boss = newCampaign("도전의증인", "ranger", randomUUID());
  Object.assign(boss, {
    chapterId: "a1-03",
    objective: 2,
    completed: ["a1-01", "a1-02"],
    memories: ["a1-01", "a1-02"],
    coins: 120,
    inventory: { "memory-fragment": 2 },
  });
  await page.evaluate(
    ({ key, boss }) =>
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          activeId: boss.characterId,
          characters: [boss],
        }),
      ),
    { key, boss },
  );
  await page.reload();
  await page.getByRole("button", { name: /도전의증인/ }).click();
  await page.waitForTimeout(500);
  await go(page, 512, 240);
  await page.locator(".oath-boss-hud").waitFor();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${output}/boss.png` });
  await page.keyboard.down("Space");
  await page.keyboard.down("k");
  await page.evaluate(() => {
    window.__oathBattle = null;
    window.__SERTZ_EB__.on("campaign:view", (v) => {
      window.__oathBattle = v.battle;
    });
  });
  const pressed = new Set();
  const deadline = Date.now() + 35000;
  let won = false;
  while (Date.now() < deadline) {
    const state = await page.evaluate(
      (key) => ({
        battle: window.__oathBattle,
        objective: JSON.parse(localStorage.getItem(key)).characters[0]
          .objective,
      }),
      key,
    );
    if (state.objective === 3) {
      won = true;
      break;
    }
    const b = state.battle;
    if (b?.status === "lost")
      throw new Error("Boss playtest lost: telegraphs were not avoided");
    if (b) {
      const me = b.players[0],
        phase = ((b.time / 1000) * 0.6) % (2 * 2.44),
        angle = phase < 2.44 ? 2.79 - phase : 0.35 + (phase - 2.44),
        x = 512 + 300 * Math.cos(angle),
        y = 230 + 300 * Math.sin(angle),
        next = new Set();
      if (x - me.x > 10) next.add("d");
      if (x - me.x < -10) next.add("a");
      if (y - me.y > 10) next.add("s");
      if (y - me.y < -10) next.add("w");
      for (const k of pressed)
        if (!next.has(k)) {
          await page.keyboard.up(k);
          pressed.delete(k);
        }
      for (const k of next)
        if (!pressed.has(k)) {
          await page.keyboard.down(k);
          pressed.add(k);
        }
    }
    await page.waitForTimeout(100);
  }
  for (const k of pressed) await page.keyboard.up(k);
  assert.ok(won, "active boss playthrough must win");
  await page.keyboard.up("Space");
  await page.keyboard.up("k");
  await page.waitForTimeout(650);
  await go(page, 512, 300);
  await skip(page);
  await page
    .getByRole("heading", { name: "다음 이야기가 기다립니다" })
    .waitFor();
  await context.close();
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mp = await mobile.newPage();
  mp.on("pageerror", (e) => errors.push(e.message));
  await mp.goto(base);
  await mp.getByRole("button", { name: "서약을 시작하다" }).click();
  await mp.waitForTimeout(600);
  assert.equal(await mp.locator(".oath-touch").isVisible(), true);
  const canvas = await mp.locator("canvas").boundingBox();
  assert.ok(canvas.height > 800, "portrait playfield must fill the screen");
  await mp.screenshot({ path: `${output}/mobile.png` });
  await mp.getByRole("button", { name: "설정", exact: true }).click();
  await mp.screenshot({ path: `${output}/mobile-settings.png` });
  await mobile.close();
  const quotaContext = await browser.newContext();
  try {
    const quotaPage = await quotaContext.newPage();
    quotaPage.on("pageerror", (e) => errors.push(e.message));
    await quotaPage.addInitScript((key) => {
      const write = Storage.prototype.setItem;
      Storage.prototype.setItem = function (name, value) {
        if (name === key)
          throw new DOMException("Storage full", "QuotaExceededError");
        return write.call(this, name, value);
      };
    }, key);
    await quotaPage.goto(base);
    await quotaPage.getByRole("button", { name: "서약을 시작하다" }).click();
    await quotaPage
      .getByRole("alert")
      .filter({ hasText: "기기 저장에 실패했습니다" })
      .waitFor();
    await quotaPage.getByRole("button", { name: "저장 파일 보관하기" }).click();
    const download = quotaPage.waitForEvent("download");
    await quotaPage.getByRole("button", { name: "새 기록 내보내기" }).click();
    assert.equal((await download).suggestedFilename(), "memory-oath-save.json");
    assert.equal(await quotaPage.getByRole("alert").filter({ hasText: "기기 저장에 실패했습니다" }).count(), 1);
  } finally {
    await quotaContext.close();
  }
  // Browser → authenticated ticket → real Socket.IO service → shared simulation → receipt → UI restoration.
  const secret = "browser-test-secret-not-production-123456",
    server = createCampaignServer({ secret });
  await new Promise((resolve) => server.http.listen(0, "127.0.0.1", resolve));
  const serverUrl = `http://127.0.0.1:${server.http.address().port}`,
    partyPages = [],
    partyContexts = [];
  try {
    for (let i = 0; i < 3; i++) {
      const uid = `browser${i}`,
        member = newCampaign(`연합원${i + 1}`, "ranger", randomUUID());
      Object.assign(member, {
        chapterId: "a1-04",
        completed: ["a1-01", "a1-02", "a1-03"],
        memories: ["a1-01", "a1-02", "a1-03"],
        coins: 180,
        inventory: { "memory-fragment": 3 },
      });
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
      });
      partyContexts.push(context);
      const page = await context.newPage();
      partyPages.push(page);
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/api/auth/me", (route) =>
        route.fulfill({
          json: { user: { id: uid, name: member.name, provider: "local" } },
        }),
      );
      await page.route("**/api/campaign**", async (route) => {
        const request = route.request(),
          body = request.method() === "POST" ? request.postDataJSON() : null;
        const account = {
          characters: { [member.characterId]: member },
          revision: 0,
          slots: 8,
          claimed: [],
        };
        if (body?.action === "ticket")
          return route.fulfill({
            json: {
              ticket: signProof(
                {
                  uid,
                  characterId: member.characterId,
                  name: member.name,
                  family: member.family,
                  bosses: ["a1-03"],
                  exp: Date.now() + 60000,
                },
                secret,
              ),
            },
          });
        if (body?.action === "claim") {
          const proof = verifyProof(body.receipt, secret);
          assert.ok(
            proof.members.some(
              (m) => m.uid === uid && m.characterId === member.characterId,
            ),
          );
          return route.fulfill({ json: { account } });
        }
        return route.fulfill({
          json: {
            account,
            listings: [],
            records: [],
            onlineReady: true,
            purchasesReady: false,
            realtimeUrl: serverUrl,
          },
        });
      });
      await page.addInitScript(
        ({ key, member }) =>
          localStorage.setItem(
            key,
            JSON.stringify({
              version: 1,
              activeId: member.characterId,
              characters: [member],
            }),
          ),
        { key, member },
      );
      await page.goto(base);
      await page.getByRole("button", { name: new RegExp(member.name) }).click();
      await page.waitForTimeout(500);
      await page.getByRole("button", { name: "연합", exact: true }).click();
    }
    await partyPages[0]
      .getByRole("button", { name: "3인 파티 만들기" })
      .click();
    await partyPages[0].getByText(/파티 코드/).waitFor();
    const code = [...server.rooms.keys()][0];
    assert.ok(code);
    for (let i = 1; i < 3; i++) {
      await partyPages[i].getByLabel("파티 코드").fill(code);
      await partyPages[i]
        .getByRole("button", { name: "참가", exact: true })
        .click();
      await partyPages[i].getByText(/파티 코드/).waitFor();
    }
    await partyPages[0]
      .getByRole("button", { name: "전투 시작", exact: true })
      .click();
    for (const [i, page] of partyPages.entries()) {
      await page.locator(".oath-boss-hud").waitFor();
      await page.screenshot({ path: `${output}/coop-${i + 1}.png` });
    }
    const shared = server.rooms.get(code).battle;
    assert.equal(shared.players.length, 3);
    shared.boss.hp = 1;
    await partyPages[0].keyboard.down("Space");
    await partyPages[0]
      .getByRole("button", { name: "보상과 기록 수령" })
      .waitFor();
    await partyPages[0].keyboard.up("Space");
    await partyPages[0]
      .getByRole("button", { name: "보상과 기록 수령" })
      .click();
    await partyPages[0].getByRole("button", { name: "창 닫기" }).click();
    await partyPages[0]
      .locator(".oath-objective")
      .filter({ hasText: "석양으로 물든 바다" })
      .waitFor();
    assert.equal(await partyPages[0].locator(".oath-boss-hud").count(), 0);
    console.log(
      "PASS: 3 browser party, shared authoritative fight, signed receipt, and return to campaign.",
    );
  } finally {
    await Promise.all(partyContexts.map((context) => context.close()));
    await server.close();
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: chapter one, idempotent reward, legacy isolation, reload, real boss fight, portrait touch HUD; screenshots:",
    output,
  );
} finally {
  await browser.close();
}
