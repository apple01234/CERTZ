import { boot, warp } from './browser-lib.mjs';
const HOLD1 = { warbringer: 24000, crusader: 24000, deadeye: 22000, skylord: 22000, arclord: 26000, eternal: 26000, shadowlord: 22000, blademaster: 22000, seaking: 28000, dreadnought: 30000 };
const slot = process.argv[2] || '5', TS = Number(process.argv[3] || 5);
const only = process.argv[4] ? process.argv[4].split(',') : Object.keys(HOLD1);
const { browser, page, errors } = await boot('궁검증');
const at = await warp(page, 'howlrstone3x1');
await page.waitForFunction(() => window.__SERTZ_SCENE__.enemies.some(x => x.active && x.alive), null, { timeout: 60000 }).catch(() => {});
const out = {};
for (const cls of only) {
  const cast = await page.evaluate(([k, slot, TS, process_atk]) => {
    const s = window.__SERTZ_SCENE__, p = s.player;
    s.canPlayerAction = () => true; Math.random = () => 0.999; s.time.timeScale = TS;
    let e = s.__tgt && s.__tgt.active && s.__tgt.alive ? s.__tgt : s.enemies.filter(x => x.active && x.alive).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    if (!e) return { ok: false, why: 'no enemy' };
    s.__tgt = e;
    if (!s.__pin) { s.__pin = true; s.events.on('update', () => { const t = s.__tgt, q = s.player; if (t && t.active && q) { t.setPosition(q.x + 150, q.y); t.setVelocity?.(0, 0); q.facing?.set?.(1, 0); } }); }
    for (const o of s.enemies) if (o !== e && o.active) { o.setPosition(-9000, -9000); if (o.body) o.body.enable = false; o.setActive(false); }
    e.maxHp = e.hp = 1e13; e.speed = 0; if (e.def) { e.def.atk = 0; e.def.speed = 0; }
    p.setPosition(Math.min(Math.max(p.x, 300), s.stageW - 300), p.y); e.setPosition(p.x + 150, p.y);
    if (!e.__hooked) { const proto = Object.getPrototypeOf(e); const orig = proto.takeDamage; e.takeDamage = function (d, ...a) { const before = this.hp; const r = orig.call(this, d, ...a); s.__log.push([Math.round(s.time.now - s.__t0), Math.round(before - this.hp), d]); this.hp = 1e13; return r; }; e.__hooked = true; }
    p.cls = k; p.clsBonus = { atkPct: 0, critAdd: 0, defAdd: 0, hpAdd: 0, mpAdd: 0, speedPct: 0, cdMult: 1, skillMult: 1, bossDmgPct: 0, mobDmgPct: 0 };
    p.selfAtkBuff = null; if (process_atk) Object.defineProperty(p, 'atkTotal', { get: () => process_atk, configurable: true });
    p.state = 'idle'; p.mp = p.maxMp = 99999; p.hp = p.maxHp = 1e9; p.skill5Cd = 0; p.skill5bCd = 0; p.lv = 200; p.fifth = true; p.iframes = 1e9;
    s.__log = []; s.__t0 = s.time.now;
    const budget = p.ultBudgetOf(slot === '5' ? 1 : 2);
    try { slot === '5' ? p.useSkill5() : p.useSkill5b(); } catch (er) { return { ok: false, why: String(er).slice(0, 200) }; }
    return { ok: true, atk: p.atkTotal, budget, cd: slot === '5' ? p.skill5Cd : p.skill5bCd };
  }, [cls, slot, TS, Number(process.env.ATK || 0)]);
  if (!cast.ok) { out[cls] = cast; console.error(cls, JSON.stringify(cast)); continue; }
  await page.waitForTimeout((HOLD1[cls] * (slot === '5' ? 1 : 2)) / TS + 3000);
  const log = await page.evaluate(() => window.__SERTZ_SCENE__.__log.slice());
  const applied = log.reduce((t, [, d]) => t + d, 0);
  out[cls] = { budget: cast.budget, atk: cast.atk, cd: cast.cd, applied, raw: log.reduce((t, r) => t + r[2], 0), hits: log.length, first: log[0]?.[0], last: log.at(-1)?.[0], max: Math.max(...log.map(r => r[1])), same: log.filter(r => r[1] === r[2]).map(r => r[0] + ':' + r[1]).join(' ') };
  console.error(cls, JSON.stringify(out[cls]));
}
console.log(JSON.stringify({ at, slot, TS, out, errors }));
await browser.close();
