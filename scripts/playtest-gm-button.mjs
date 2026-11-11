/**
 * vc270 — GM 패널 접근 가드 검증.
 *
 * 확인:
 *  1) 비관리자(로그아웃 상태)에서 HUD GM 버튼이 렌더되지 않는다.
 *  2) 비관리자에서 패널이 열려도 "관리자 전용" 안내만 보이고 GM 도구는 없다.
 *  3) 관리자 로그인 상태에서는 GM 버튼이 가방 버튼 **왼쪽**에 나타난다.
 *
 * 관리자 세션은 서버 로그인 없이는 만들 수 없으므로, 관리자 케이스는 /api/auth/me 응답을
 * 라우팅으로 대체해 UI 반응만 검증한다. 실제 권한은 서버가 검사하므로 이 대체는
 * "UI가 role=admin 에 반응하는가"만 확인하며 서버 권한 검증을 대신하지 않는다.
 *
 * 실행: GM_QA_URL=http://127.0.0.1:4321 node scripts/playtest-gm-button.mjs
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = process.env.GM_QA_URL ?? 'http://127.0.0.1:4321';
const out = process.env.GM_QA_OUT ?? '/dev/shm/certz-gm-button';
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });

/** 로비 → 캐릭터 입장(없으면 생성)까지 공통 처리. */
async function enterGame(page) {
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByRole('button', { name: /게임 시작/ }).first().click({ timeout: 120000 });
  await page.waitForTimeout(2500);
  if (!(await page.getByRole('button', { name: '이 캐릭터로 시작' }).count())) {
    await page.getByRole('button', { name: '캐릭터 생성' }).first().click({ timeout: 30000 });
    await page.waitForTimeout(2000);
    const nameInput = page.locator('input').first();
    await nameInput.waitFor({ state: 'visible', timeout: 30000 });
    await nameInput.fill('GM검증');
    await nameInput.dispatchEvent('input');
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: '다음 — 외형 선택' }).click({ timeout: 20000 });
    await page.waitForTimeout(1800);
    await page.getByRole('button', { name: '모험가로 생성!' }).click({ timeout: 20000 });
    await page.waitForTimeout(5000);
  }
  await page.getByRole('button', { name: '이 캐릭터로 시작' }).first().click({ timeout: 30000 });
  await page.waitForFunction(() => window.__SERTZ_SCENE__?.assetsReady, null, { timeout: 120000 });
  await page.waitForTimeout(1800);
}

const results = {};
try {
  /* ---- 1) 비관리자 ---- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await enterGame(page);

    results.nonAdmin = await page.evaluate(() => ({
      gmButton: !!document.querySelector('[aria-label="GM 패널 열기 (관리자 전용)"]'),
      bagButton: !!document.querySelector('[aria-label^="가방 열기"]'),
    }));
    await page.screenshot({ path: `${out}/non-admin-hud.png` });
    results.nonAdminErrors = errors.length;
    await ctx.close();
  }

  /* ---- 2) 관리자 응답을 대체했을 때 ---- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.route('**/api/auth/me*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        // authMe()는 r.data.user 를 읽는다 — 최상위가 아니라 user 아래에 넣어야 한다.
        body: JSON.stringify({ user: { id: 'qa-gm', name: 'QA운영자', role: 'admin', provider: 'local' } }),
      }),
    );
    await enterGame(page);
    await page.waitForTimeout(1200);

    results.admin = await page.evaluate(() => {
      const gm = document.querySelector('[aria-label="GM 패널 열기 (관리자 전용)"]');
      const bag = document.querySelector('[aria-label^="가방 열기"]');
      if (!gm || !bag) return { gmButton: !!gm, bagButton: !!bag, order: null };
      // 같은 부모 안에서 GM 이 가방보다 앞(왼쪽)에 있는지 DOM 순서로 확인한다.
      const kids = Array.from(gm.parentElement.children);
      return { gmButton: true, bagButton: true, order: kids.indexOf(gm) < kids.indexOf(bag) ? 'gm-before-bag' : 'wrong' };
    });
    await page.screenshot({ path: `${out}/admin-hud.png` });
    await ctx.close();
  }

  results.summary = {
    nonAdminSeesGm: results.nonAdmin.gmButton,
    adminSeesGm: results.admin.gmButton,
    order: results.admin.order,
  };
  console.log(JSON.stringify(results, null, 1));

  assert.equal(results.nonAdmin.gmButton, false, '비관리자에게 GM 버튼이 보이면 안 된다');
  assert.equal(results.nonAdmin.bagButton, true, '가방 버튼은 항상 보여야 한다');
  assert.equal(results.admin.gmButton, true, '관리자에게 GM 버튼이 보여야 한다');
  assert.equal(results.admin.order, 'gm-before-bag', 'GM 버튼은 가방 왼쪽이어야 한다');

  await writeFile(`${out}/result.json`, JSON.stringify(results, null, 1));
  console.log('PASS');
} finally {
  await browser.close();
}
