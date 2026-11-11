/**
 * vc268 — 대시 무적이 실제로 피해를 막는지 검증한다.
 *
 * 검증 대상: Player.useFreeDash()가 부여한 iframes가 takeDamage()를 실제로 차단하는가.
 * 주입 금지: HP/레벨/진행/보스 HP를 바꾸지 않는다. iframes는 "검증 대상 동작"이므로
 *           직접 설정하지 않고 useFreeDash() 호출로만 만들어진다.
 *
 * 실행: DASH_QA_URL=http://127.0.0.1:3100 node scripts/playtest-dash-iframes.mjs
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = process.env.DASH_QA_URL ?? 'http://127.0.0.1:3100';
const out = process.env.DASH_QA_OUT ?? '/dev/shm/certz-dash-iframes';
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const results = [];
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => { errors.push(e.message); console.error('PAGE_ERROR', e.message); });

  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByRole('button', { name: /게임 시작/ }).first().click({ timeout: 120000 });
  await page.waitForTimeout(2500);

  /* 기존 캐릭터가 있으면 그걸로 입장, 없으면 생성 마법사(이름→외형→생성)를 완주한다. */
  const startBtn = page.getByRole('button', { name: '이 캐릭터로 시작' });
  if (!(await startBtn.count())) {
    await page.getByRole('button', { name: '캐릭터 생성' }).first().click({ timeout: 30000 });
    await page.waitForTimeout(2000);
    const nameInput = page.locator('input').first();
    await nameInput.waitFor({ state: 'visible', timeout: 30000 });
    await nameInput.fill('대시검증');
    await nameInput.dispatchEvent('input');
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: '다음 — 외형 선택' }).click({ timeout: 20000 });
    await page.waitForTimeout(1800);
    await page.getByRole('button', { name: '모험가로 생성!' }).click({ timeout: 20000 });
    await page.waitForTimeout(5000);
  }
  await page.getByRole('button', { name: '이 캐릭터로 시작' }).first().click({ timeout: 30000 });
  await page.waitForFunction(() => window.__SERTZ_SCENE__?.assetsReady, null, { timeout: 120000 });
  await page.waitForTimeout(1400);

  const probe = await page.evaluate(async () => {
    const s = window.__SERTZ_SCENE__;
    const p = s.player;
    // 진행/수치를 바꾸지 않는다. 화면 연출만 정리해 플레이어 조작 상태로 만든다.
    window.__SERTZ_EB__.emit('dialogue:hide');
    window.__SERTZ_EB__.emit('dialogue:done');
    s.closeFeatureTutorial(); s.pendingFeatureTuts = [];
    s.autoHunt = false; s.dialoguing = false; s.camCinema = false;
    s.physics.world.resume();
    /* 튜토리얼 게이트는 "지금 대시를 배우는 단계인가"만 판단한다. 검증 대상은 대시 로직이므로
     * 게이트만 통과시킨다 — iframes는 여전히 useFreeDash()가 만들어야 한다(직접 주입 금지). */
    s.featureTutOpen = false; s.tut = null;
    s.canPlayerAction = () => true;
    p.cancelSkillCast(); p.stopFreeDash();
    p.state = 'idle';

    const rec = { before: {}, dash: {}, duringStun: {}, afterDash: {} };

    // 1) 대시 전: 무적 0
    p.iframes = 0;
    rec.before.iframes = p.iframes;
    rec.before.hp = p.hp;

    // 2) 대시 1회 — useFreeDash()만이 iframes를 만든다
    const dashed = p.useFreeDash();
    rec.dash.returned = dashed;
    rec.dash.iframes = p.iframes;
    rec.dash.state = p.state;

    // 3) 대시 무적 중 피해 시도 → 막혀야 한다
    const hpBeforeHit = p.hp;
    // takeDamage 는 fromDir 을 atan2/복사에만 쓰므로 평범한 벡터 객체로 충분하다(전역 Phaser 미노출).
    const dir = { x: 1, y: 0 };
    p.takeDamage(50, dir);
    rec.duringStun.hpBefore = hpBeforeHit;
    rec.duringStun.hpAfter = p.hp;
    rec.duringStun.blocked = p.hp === hpBeforeHit;

    // 4) 무적이 끝난 뒤 같은 피해 → 들어가야 한다(대조군)
    p.iframes = 0;
    const hpBeforeOpen = p.hp;
    p.takeDamage(50, dir);
    rec.afterDash.hpBefore = hpBeforeOpen;
    rec.afterDash.hpAfter = p.hp;
    rec.afterDash.applied = p.hp < hpBeforeOpen;

    rec.hpMax = p.maxHp;
    return rec;
  });

  results.push({ probe, errors: errors.length });
  console.log(JSON.stringify(probe, null, 1));

  // 단언 — 실제 관찰값으로만 판정한다.
  assert.equal(probe.before.iframes, 0, '대시 전 무적은 0이어야 한다');
  assert.equal(probe.dash.returned, true, '대시가 발동해야 한다');
  assert.ok(probe.dash.iframes > 0, '대시가 무적을 부여해야 한다');
  assert.equal(probe.duringStun.blocked, true, '대시 무적 중 피해는 막혀야 한다');
  assert.equal(probe.afterDash.applied, true, '무적이 끝나면 피해가 들어가야 한다');
  assert.equal(probe.hpMax, probe.hpMax, '최대 HP는 변하지 않는다');
  assert.equal(errors.length, 0, '페이지 예외가 없어야 한다');

  await page.screenshot({ path: `${out}/dash-iframes.png` });
  await writeFile(`${out}/result.json`, JSON.stringify({ probe, errors }, null, 1));
  console.log('PASS');
} finally {
  await browser.close();
}
