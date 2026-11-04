/* 하루 v1 검증 — 상호작용 키 Space 통일.
 * 실제 브라우저 키보드 이벤트(page.keyboard)로 누른다. Phaser 의 JustDown 은
 * KeyboardPlugin 내부 Key 상태를 보므로 합성 emit 으로는 판정되지 않는다. */
import { chromium } from 'playwright';

const URL = process.env.QA_URL ?? 'http://127.0.0.1:3200';
const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ` (${detail})` : ''}`);
};

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e).split('\n')[0]));

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
/* 이 컨테이너에는 SERTZ_BACKUP_KEY 가 없어 /api/auth/* 가 500 을 낸다. 로비의 닉네임 검증이
 * 실패하면 캐릭터 생성이 막히므로, 로비가 읽는 슬롯/세이브를 직접 주입해 그 단계를 건너뛴다. */
await page.evaluate(() => {
  try {
    localStorage.clear();
    const id = 'cverify';
    localStorage.setItem('sertz_char_' + id, JSON.stringify({
      stage: 'village', lv: 1, exp: 0, maxHp: 100, atk: 10, cleared: false, maxMp: 60,
      playerName: '키검증', cls: null, startCls: null, gold: 30, lookTint: null,
      gender: 'm', skinIdx: 2, introSeen: true,
    }));
    localStorage.setItem('sertz_slots_v1', JSON.stringify({
      v: 1, slots: 3, activeId: null,
      chars: { [id]: { id, name: '키검증', cls: null, lv: 1, stage: 'village', cleared: false, lastSeen: Date.now(), createdAt: Date.now(), rebirths: 0, lookTint: null, gender: 'm', skinIdx: 2 } },
    }));
  } catch { /* 무시 */ }
});
await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });

await page.waitForFunction(
  () => [...document.querySelectorAll('button')].some(b => (b.textContent || '').includes('게임 시작')),
  undefined, { timeout: 120000 },
);
await page.locator('button', { hasText: '게임 시작' }).first().click({ timeout: 60000 });
await page.getByRole('button', { name: '이 캐릭터로 시작' }).first().click({ timeout: 90000 });
await page.waitForFunction(() => window.__SERTZ_SCENE__?.player, undefined, { timeout: 90000 });
await page.evaluate(() => {
  const s = window.__SERTZ_SCENE__;
  /* 인트로/튜토리얼 대화를 확실히 닫는다 — dialoguing 이 true 면 공격이 정상 차단되어
   * 키 입력 검증이 잘못 실패한다. */
  for (const o of [...s.children.list]) if (o.text === '건너뛰기') o.emit('pointerdown');
  s.tutorialDone = true; s.tutStep = -1;
  s.resumeFromDialogue?.();
});
await page.waitForTimeout(2000);
await page.evaluate(() => { window.__SERTZ_SCENE__.dialoguing = false; });
/* 키보드 입력을 캔버스로 보내기 위해 포커스 확보 */
await page.locator('canvas').first().click({ position: { x: 640, y: 400 } }).catch(() => {});
await page.waitForTimeout(500);
const idleState = await page.evaluate(() => {
  const s = window.__SERTZ_SCENE__;
  s.dialoguing = false;
  return { dialoguing: s.dialoguing, sleeping: s.sleeping, hp: s.player?.hp };
});
ok('검증 전제: 대화·수면 아님', idleState.dialoguing === false && idleState.sleeping === false, JSON.stringify(idleState));

/* ── 1. 키맵 ───────────────────────────────────────────────── */
const km = await page.evaluate(() => {
  const s = window.__SERTZ_SCENE__;
  return {
    interact: s.keymap?.interact, attack: s.keymap?.attack, skill1: s.keymap?.skill1,
    hasSpace: !!s.keys?.SPACE,
    resolvable: !!s.keyObjs?.[s.keymap?.interact] || !!s.keys?.[s.keymap?.interact],
  };
});
ok('상호작용 키 = SPACE', km.interact === 'SPACE', `interact=${km.interact}`);
ok('공격 키 = X', km.attack === 'X', `attack=${km.attack}`);
ok('스킬1 키 = Z', km.skill1 === 'Z', `skill1=${km.skill1}`);
ok('SPACE 키 객체 등록', km.hasSpace === true);
ok('interact 키 조회 가능(프리즈 방지)', km.resolvable === true);

/* ── 2. 실제 키 입력 — Space 는 공격을 큐잉하지 않아야 한다 ──────
 * Player 는 attack() 메서드가 아니라 update(dt, move, attackPressed) 로 공격을 받는다.
 * 씬의 attackQueued 는 매 프레임 false 로 리셋되므로, 프레임 사이에 관찰해야 한다. */
await page.evaluate(() => {
  const s = window.__SERTZ_SCENE__;
  s.__spaceAttack = 0;
  s.__xAttack = 0;
  if (!s.__hooked) {
    s.__hooked = true;
    const orig = s.player.update.bind(s.player);
    s.player.update = (dt, move, atk) => { if (atk) s.__xAttack += 1; return orig(dt, move, atk); };
  }
});
await page.waitForTimeout(300);

/* Space 연타 — 공격 큐가 한 번도 서면 안 된다 */
await page.keyboard.press('Space');
await page.waitForTimeout(120);
await page.keyboard.press('Space');
await page.waitForTimeout(500);
const spaceAtk = await page.evaluate(() => window.__SERTZ_SCENE__.__xAttack);
ok('Space 키 → 공격 미발동', spaceAtk === 0, `attackPressed 횟수=${spaceAtk}`);

/* X 는 공격을 큐잉해야 한다 */
await page.evaluate(() => { window.__SERTZ_SCENE__.__xAttack = 0; });
await page.keyboard.press('x');
await page.waitForTimeout(600);
const xAtk = await page.evaluate(() => window.__SERTZ_SCENE__.__xAttack);
ok('X 키 → 공격 발동', xAtk > 0, `attackPressed 횟수=${xAtk}`);

/* ── 3. 키 배지(eBubble)가 Space 를 표기하는지 ────────────────
 * 마을 NPC(960,595)로 실제 이동시킨 뒤 프롬프트를 갱신한다. */
const badge = await page.evaluate(async () => {
  const s = window.__SERTZ_SCENE__;
  s.dialoguing = false;
  const npc = (s.interactables || []).find(i => i.kind === 'talk');
  if (npc) s.player.setPosition(npc.x, npc.y + 30);
  await new Promise(r => setTimeout(r, 400));
  s.updateInteractPrompt();
  await new Promise(r => setTimeout(r, 400));
  return { txt: s.eBubbleText?.text ?? null, near: s.nearInteract?.kind ?? null, label: s.nearInteract?.label ?? null };
});
ok('키 배지 텍스트 = Space', badge.txt === 'Space', `badge=${badge.txt} near=${badge.near}`);

/* ── 4. Space 로 NPC 대화 실제 개시 ────────────────────────── */
await page.keyboard.press('Space');
await page.waitForTimeout(1200);
const dlgOpen = await page.evaluate(() => ({ open: !!window.__SERTZ_SCENE__.dialoguing, npc: window.__SERTZ_SCENE__.nearInteract?.label ?? null }));
ok('Space → NPC 대화창 열림', dlgOpen.open === true, `near=${badge.label} dialoguing=${dlgOpen.open}`);

/* ── 5. 인트로 스킵 후 Space 재입력 → 예외 없음 (이번에 고친 버그) ── */
const crashProbe = await page.evaluate(async () => {
  const s = window.__SERTZ_SCENE__;
  s.resumeFromDialogue?.();
  await new Promise(r => setTimeout(r, 300));
  try {
    s.showIntroOverlay?.(['테스트 1', '테스트 2'], () => {});
    await new Promise(r => setTimeout(r, 250));
    for (const o of [...s.children.list]) if (o.text === '건너뛰기') o.emit('pointerdown');
    await new Promise(r => setTimeout(r, 250));
    s.input.keyboard.emit('keydown-SPACE', { code: 'Space', keyCode: 32 });
    await new Promise(r => setTimeout(r, 350));
    return { ok: true };
  } catch (e) {
    return { ok: false, err: String(e).split('\n')[0] };
  }
});
ok('인트로 스킵 후 Space 재입력 → 예외 없음', crashProbe.ok === true, crashProbe.err ?? '');

ok('pageerror 0', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

await page.screenshot({ path: '/root/.hermes/cache/scratch/verify-haru-space.png' });
await browser.close();

const pass = results.filter(r => r.pass).length;
console.log(`\n=== ${pass}/${results.length} PASS ===`);
process.exit(pass === results.length ? 0 : 1);
