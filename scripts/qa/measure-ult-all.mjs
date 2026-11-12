import { boot, warp } from './browser-lib.mjs';
import fs from 'node:fs';
const HOLD = JSON.parse(process.argv[2]);
const only = process.argv[3] ? process.argv[3].split(',') : Object.keys(HOLD);
const { browser, page, errors } = await boot('궁검증');
const at = await warp(page, 'howlrstone3x1');
const out = {};
for (const cls of only) {
  const cast = await page.evaluate((k) => {
    const s = window.__SERTZ_SCENE__, p = s.player;
    s.canPlayerAction = () => true; Math.random = () => 0.999;
    let e = s.__tgt && s.__tgt.active && s.__tgt.alive ? s.__tgt : s.enemies.filter(x => x.active && x.alive).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    if (!e) return { ok: false, why: 'no enemy' };
    s.__tgt = e;
    if (!s.__pin) { s.__pin = true; s.events.on('update', () => { const t = s.__tgt, q = s.player; if (t && t.active && q) { t.setPosition(q.x + 150, q.y); t.setVelocity?.(0, 0); q.facing?.set?.(1, 0); } }); }
    p.facing?.set?.(1, 0);
    for (const o of s.enemies) if (o !== e && o.active) { o.setPosition(-9000, -9000); if (o.body) o.body.enable = false; o.setActive(false); }
    e.maxHp = e.hp = 1e13; e.speed = 0; if (e.def) { e.def.atk = 0; e.def.speed = 0; }
    p.setPosition(Math.min(Math.max(p.x, 300), s.stageW - 300), p.y); e.setPosition(p.x + 150, p.y); e.setVelocity?.(0, 0);
    if (!e.__hooked) { const orig = e.takeDamage.bind(e); e.takeDamage = (d, ...a) => { s.__log.push([Math.round(s.time.now - s.__t0), d]); const r = orig(d, ...a); e.hp = 1e13; e.setPosition(s.player.x + 150, s.player.y); return r; }; e.__hooked = true; }
    p.cls = k; p.clsBonus = { atkPct: 0, critAdd: 0, defAdd: 0, hpAdd: 0, mpAdd: 0, speedPct: 0, cdMult: 1, skillMult: 1, bossDmgPct: 0, mobDmgPct: 0 };
    p.buffs = p.buffs && Array.isArray(p.buffs) ? [] : p.buffs; p.selfAtkBuff = null;
    p.state = 'idle'; p.mp = p.maxMp = 99999; p.hp = p.maxHp = 1e9; p.skill5Cd = 0; p.skill5Unlocked = true; p.lv = 200; p.iframes = 1e9;
    s.__log = []; s.__t0 = s.time.now;
    try { p.useSkill5(); } catch (er) { return { ok: false, why: String(er).slice(0, 200) }; }
    return { ok: true, atk: p.atkTotal };
  }, cls);
  if (!cast.ok) { out[cls] = { cast }; console.error(cls, JSON.stringify(cast)); continue; }
  await page.waitForTimeout(HOLD[cls] + 2500);
  const log = await page.evaluate(() => window.__SERTZ_SCENE__.__log.slice());
  out[cls] = { cast, total: log.reduce((t, [, d]) => t + d, 0), hits: log.length, last: log.length ? log[log.length - 1][0] : null, log };
  console.error(cls, out[cls].total, out[cls].hits);
}
console.log(JSON.stringify({ at, out, errors }));
await browser.close();
