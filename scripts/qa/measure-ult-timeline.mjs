import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message.slice(0, 200)));
await page.goto('http://127.0.0.1:3111', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.getByRole('button', { name: /게임 시작/ }).first().click({ timeout: 120000 });
await page.waitForTimeout(2500);
await page.getByRole('button', { name: '캐릭터 생성' }).first().click({ timeout: 30000 });
await page.waitForTimeout(2200);
const input = page.locator('input').first(); await input.fill('궁검증'); await input.dispatchEvent('input'); await page.waitForTimeout(700);
await page.getByRole('button', { name: '다음 — 외형 선택' }).click({ timeout: 20000 });
await page.waitForTimeout(2200);
await page.getByRole('button', { name: '모험가로 생성!' }).click({ timeout: 20000 });
await page.getByRole('button', { name: '이 캐릭터로 시작' }).first().waitFor({ state: 'visible', timeout: 60000 });
await page.getByRole('button', { name: '이 캐릭터로 시작' }).first().click({ timeout: 30000 });
await page.waitForFunction(() => window.__SERTZ_SCENE__?.assetsReady, null, { timeout: 240000 });
await page.waitForTimeout(3000);
for (let i = 0; i < 30; i++) { const busy = await page.evaluate(() => !!window.__SERTZ_SCENE__.dialoguing); if (!busy && i > 3) break; await page.keyboard.press('Escape'); await page.waitForTimeout(700); }
const classes = (process.argv[2] || 'warbringer,crusader,deadeye,skylord,arclord,eternal,shadowlord,blademaster,seaking,dreadnought').split(',');
const out = {};
for (const cls of classes) {
  const cast = await page.evaluate((k) => {
    const s = window.__SERTZ_SCENE__, p = s.player;
    s.tut = null; s.canPlayerAction = () => true;
    Math.random = () => 0.999; // 치명타 없음 — 계수 역산용
    s.__log = s.__log || []; const e = s.enemies.find(x => x.alive); if (e) { e.setActive(true).setVisible(true); if (e.body) e.body.enable = true; }
    if (!e) return { ok: false, why: "no enemy", sample: s.enemies.slice(0,3).map(x => ({ a: x.active, al: x.alive, v: x.visible, hp: x.hp, k: x.key ?? x.def?.key, dummy: x.dummy })), n: s.enemies.length, stage: s.stageDef.key, tut: s.tut?.currentId };
    for (const o of s.enemies) if (o !== e && o.active) { o.setPosition(-9000, -9000); o.body && (o.body.enable = false); }
    e.maxHp = e.hp = 1e13; e.atkCd = 1e9; e.def && (e.def.atk = 0);
    e.setPosition(p.x + 60, p.y); e.setVelocity?.(0, 0); if (e.body) { e.body.moves = false; }
    if (!e.__hooked) { const orig = e.takeDamage.bind(e); e.takeDamage = (d, ...a) => { s.__log.push([Math.round(s.time.now - s.__t0), d]); return orig(d, ...a); }; e.__hooked = true; }
    p.cls = k; p.clsBonus = { atkPct: 0, critAdd: 0, defAdd: 0, hpAdd: 0, mpAdd: 0, speedPct: 0, cdMult: 1, skillMult: 1, bossDmgPct: 0, mobDmgPct: 0 };
    p.state = 'idle'; p.mp = 99999; p.maxMp = 99999; p.hp = p.maxHp = 1e9; p.skill5Cd = 0; p.skill5Unlocked = true; p.lv = 200;
    p.facing?.set?.(1, 0);
    s.__log = []; s.__t0 = s.time.now;
    try { p.useSkill5(); } catch (er) { return { ok: false, why: String(er).slice(0, 200) }; }
    return { ok: true, atk: p.atkTotal, logAt0: s.__log.length, cd: p.skill5Cd };
  }, cls);
  if (!cast.ok) { out[cls] = { cast }; console.error(cls, JSON.stringify(cast)); break; }
  await page.waitForTimeout(33000);
  const log = await page.evaluate(() => window.__SERTZ_SCENE__.__log.slice());
  out[cls] = { cast, log };
  console.error(cls, cast.ok, log.length);
}
console.log(JSON.stringify({ out, errors }));
await browser.close();
