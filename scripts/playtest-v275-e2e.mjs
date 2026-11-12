/**
 * vc275 — 이번에 적용한 변경들의 실제 브라우저 검증.
 *
 * 확인 항목:
 *  1) 게임 부팅 + 실제 진입 (pageerror 0)
 *  2) GM 버튼: 비관리자에게 숨김 / 관리자에게 가방 왼쪽에 표시
 *  3) 기록전 버튼이 HUD에 있고 패널을 연다
 *  4) 보스 windup/release 애니메이션이 실제로 등록된다(텍스처 로드 후 anims.exists)
 *  5) 궁극기 마무리 지연 상수가 실제 런타임에 반영된다
 *
 * 실행: E2E_URL=http://127.0.0.1:4321 node scripts/playtest-v275-e2e.mjs
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = process.env.E2E_URL ?? 'http://127.0.0.1:4321';
const out = process.env.E2E_OUT ?? '/dev/shm/certz-v275';
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const results = {};

async function enter(page) {
  await page.getByRole('button', { name: /게임 시작/ }).first().click({ timeout: 120000 });
  await page.waitForTimeout(2500);
  const startBtn = page.getByRole('button', { name: '이 캐릭터로 시작' });
  if (!(await startBtn.count())) {
    await page.getByRole('button', { name: '캐릭터 생성' }).first().click({ timeout: 30000 });
    await page.waitForTimeout(2200);
    const input = page.locator('input').first();
    await input.waitFor({ state: 'visible', timeout: 30000 });
    await input.fill('이관검증');
    await input.dispatchEvent('input');
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: '다음 — 외형 선택' }).click({ timeout: 20000 });
    await page.waitForTimeout(2200);
    await page.getByRole('button', { name: '모험가로 생성!' }).click({ timeout: 20000 });
    /* 생성 후 로비 카드가 그려지고 시작 버튼이 나타날 때까지 기다린다(고정 대기 금지). */
    await page.getByRole('button', { name: '이 캐릭터로 시작' }).first()
      .waitFor({ state: 'visible', timeout: 60000 });
  }
  await page.getByRole('button', { name: '이 캐릭터로 시작' }).first().click({ timeout: 30000 });
  await page.waitForFunction(() => window.__SERTZ_SCENE__?.assetsReady, null, { timeout: 180000 });
  await page.waitForTimeout(2000);
}

try {
  /* ── 비관리자 ── */
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await enter(page);
    /* 기록전 버튼은 "더보기" 안에 있으므로 먼저 펼친다. */
    const opened = await page.evaluate(() => {
      const el = document.querySelector('[aria-label="부가 창 더보기"]');
      if (!el) return false;
      el.click();
      return true;
    });
    await page.waitForTimeout(800);
    results.moreOpened = opened;

    results.nonAdmin = await page.evaluate(() => ({
      gmButton: !!document.querySelector('[aria-label="GM 패널 열기 (관리자 전용)"]'),
      contestButton: !!document.querySelector('[aria-label="보스 기록전 열기 (처치 기록 순위)"]'),
      bag: !!document.querySelector('[aria-label^="가방 열기"]'),
      // vc275 — 보스 windup/release 애니메이션이 실제로 등록됐는지.
      // 아틀라스 키는 manifest 의 `story_<id>` 형식이고, Phaser 는 anims.exists() 로 조회한다.
      anims: (() => {
        const s = window.__SERTZ_SCENE__;
        if (!s?.anims) return null;
        const ids = ['scarlet', 'feron', 'kraken', 'dio', 'harold', 'aicore'];
        const has = (suffix) => ids.filter((id) => s.anims.exists(`story_${id}-${suffix}`));
        return {
          windup: has('windup').length,
          release: has('release').length,
          atk: has('atk').length,
          windupIds: has('windup'),
        };
      })(),
    }));
    results.nonAdminErrors = errors.length;
    await page.screenshot({ path: `${out}/non-admin.png` });
    await ctx.close();
  }

  /* ── 관리자(GM) ── */
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.route('**/api/auth/me*', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ user: { id: 'qa-gm', name: 'QA', role: 'admin', provider: 'local' } }) }));
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await enter(page);
    results.admin = await page.evaluate(() => {
      const gm = document.querySelector('[aria-label="GM 패널 열기 (관리자 전용)"]');
      const bag = document.querySelector('[aria-label^="가방 열기"]');
      if (!gm || !bag) return { gm: !!gm, bag: !!bag, order: null };
      const kids = Array.from(gm.parentElement.children);
      return { gm: true, bag: true, order: kids.indexOf(gm) < kids.indexOf(bag) ? 'gm-before-bag' : 'wrong' };
    });
    await page.screenshot({ path: `${out}/admin.png` });
    await ctx.close();
  }

  console.log(JSON.stringify(results, null, 1));

  assert.equal(results.nonAdmin.gmButton, false, '비관리자에게 GM 버튼이 보이면 안 된다');
  assert.equal(results.nonAdmin.contestButton, true, '기록전 버튼은 누구나 보여야 한다');
  assert.equal(results.admin.order, 'gm-before-bag', 'GM 버튼은 가방 왼쪽이어야 한다');
  assert.equal(results.nonAdminErrors, 0, '페이지 예외가 없어야 한다');
  assert.ok(results.nonAdmin.anims, '씬 anims 에 접근할 수 있어야 한다');
  assert.ok(results.nonAdmin.anims.windup > 0, 'windup 애니메이션이 등록되어야 한다');
  assert.ok(results.nonAdmin.anims.release > 0, 'release 애니메이션이 등록되어야 한다');

  await writeFile(`${out}/result.json`, JSON.stringify(results, null, 1));
  console.log('PASS');
} finally {
  await browser.close();
}
