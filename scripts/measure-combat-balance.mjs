// node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs scripts/measure-combat-balance.mjs
//
// 전투 밸런스 실측 — "표준 육성" 캐릭터가 각 구역 몬스터/보스를 몇 대에 잡고 몇 대에 죽는지.
// 표준 육성 = 전사, AP 전부 주스탯, 강화·잠재·세트·유니온 0, 그 레벨에 낄 수 있는 골드 상점 최고 무기/방어구.
// (실제 유저는 이보다 강하다 — 여기 수치는 "가장 약한 정상 유저" 기준의 상한/하한이다.)
import { STAGES, ENEMIES, BOSS_DEFS, BOSS_DIFFS, BOSS_STAGE_STATS, QUEST_EXP_MUL, stageScale, chapterSpec, parseStage } from '../src/game/stages.ts';
import { expToNext } from '../src/game/expTable.ts';
import { ITEMS } from '../src/game/data.ts';
import { HOWLRSTONE_CHAPTERS } from '../src/game/howlrstone.ts';
import { mitigateEnemyDamage } from '../src/game/combat/defense.ts';

const gear = (kind, stat, lv) => Math.max(0, ...Object.values(ITEMS)
  .filter(i => i.kind === kind && !i.gmOnly && !i.bmOnly && !i.tradeLock && i.price > 0 && (i.reqLv ?? 0) <= lv && (!i.clsOnly || i.clsOnly.includes('warrior')))
  // 골드 제약 근사: 레벨×400G 이하만 산다고 본다
  .filter(i => i.price <= lv * 400)
  .map(i => i[stat] ?? 0));
export function player(lv) {
  const ap = 5 * (lv - 1);
  return { lv, atk: Math.round(12 + 3 * (lv - 1) + ap * 1.1 + gear('weapon', 'atk', lv)), hp: 100 + 18 * (lv - 1), def: gear('armor', 'def', lv) };
}
const CRIT = 1 + 0.08 * 0.7; // 기본 크리 8% × (1.7-1)
export function measure(key, lv) {
  const def = STAGES[key]; if (!def) return null;
  const p = player(lv), sc = stageScale(key, lv);
  const mobs = def.enemies.map(g => ENEMIES[g.key]).filter(Boolean);
  const row = { key, lv, pAtk: p.atk, pHp: p.hp };
  if (mobs.length) {
    const htk = mobs.map(e => (e.hp * sc.hp) / (mitigateEnemyDamage(p.atk, e) * CRIT)).sort((a, b) => a - b);
    const dmgIn = mobs.map(e => Math.max(1, Math.round(e.atk * sc.atk) - p.def)).sort((a, b) => a - b);
    row.mobHtk = +htk[htk.length >> 1].toFixed(1);            // 중앙값 몬스터를 기본공격 몇 대에 잡나
    row.mobHtkMax = +htk[htk.length - 1].toFixed(1);
    row.hitsToDie = +(p.hp / dmgIn[dmgIn.length >> 1]).toFixed(1); // 중앙값 몬스터에게 몇 대 맞으면 죽나
  }
  if (def.boss) {
    const b = BOSS_DEFS[def.bossKey ?? 'guardian'], dif = BOSS_DIFFS.normal, fixed = BOSS_STAGE_STATS[key];
    const hp = fixed ? fixed.hp : b.hp * 1.25 * Math.max(1, sc.hp * 1.6) * dif.hp;
    const atk = fixed?.atk ?? b.atk * Math.max(1, sc.atk * 1.15) * dif.atk;
    row.bossHp = Math.round(hp);
    row.bossHtk = Math.round(hp / (p.atk * CRIT));
    row.bossHitsToDie = +(p.hp / Math.max(1, atk - p.def * 0.5)).toFixed(1); // 보스는 방어 50% 관통
  }
  return row;
}
/** 본편 진행 순서의 장 목록(영프 15장 → 그랜드 플레닛 10행성). */
export function chapters() {
  return [
    ...HOWLRSTONE_CHAPTERS.map(c => ({ name: c.key, gate: c.lvGate, keys: Array.from({ length: c.stages }, (_, i) => `${c.key}x${i + 1}`) })),
    ...[...new Set(Object.keys(STAGES).map(k => chapterSpec(k)).filter(sp => sp?.lvGate))].map(sp => ({
      name: sp.key, gate: sp.lvGate, keys: Object.keys(STAGES).filter(k => chapterSpec(k) === sp && parseStage(k).sub > 0).sort((a, b) => parseStage(a).sub - parseStage(b).sub) })),
  ];
}
/** 정상 플레이 성장 궤적 — 구역마다 (스폰 1회 전멸 또는 사냥 퀘스트 요구량 중 큰 쪽)만큼 잡고 퀘스트를 전부 받는다.
 *  장별 { 입장 게이트, 실제 입장 레벨, 종료 레벨 } 을 돌려준다. 반복 의뢰·탑·경험치 책은 넣지 않는다(하한). */
export function trajectory() {
  let lv = 1, exp = 0;
  const gain = v => { exp += v; while (lv < 299 && exp >= expToNext(lv)) { exp -= expToNext(lv); lv++; } };
  return chapters().map(c => {
    const enterLv = lv;
    for (const key of c.keys) {
      const def = STAGES[key], mobs = def.enemies.map(g => ENEMIES[g.key]).filter(Boolean);
      const spawn = def.enemies.reduce((t, g) => t + g.count, 0);
      const need = (def.quests ?? []).filter(q => q.type === 'hunt').reduce((t, q) => t + (q.need ?? 0), 0);
      const avg = mobs.length ? mobs.reduce((t, e) => t + e.exp, 0) / mobs.length : 0;
      for (let k = 0; k < Math.max(spawn, need); k++) gain(Math.round(avg * stageScale(key, lv).exp * 1.35));
      for (const q of def.quests ?? []) gain((q.expReward ?? 0) * QUEST_EXP_MUL);
    }
    return { chapter: c.name, gateEnter: c.gate.enter, gateMid: c.gate.mid, enterLv, exitLv: lv };
  });
}
export function mainChain() {
  const out = [];
  for (const c of chapters()) c.keys.forEach((key, i) => {
    // 구역 진행에 따라 입장 레벨 → 권장 상한(mid)까지 선형으로 오른다고 본다(mid 초과 보정이 걸리지 않는 정상 진행)
    const lv = Math.round(c.gate.enter + (c.gate.mid - c.gate.enter) * i / Math.max(1, c.keys.length - 1));
    const r = measure(key, Math.max(1, lv)); if (r) out.push(r);
  });
  return out;
}
if (import.meta.url === `file://${process.argv[1]}`) { console.table(mainChain()); console.table(trajectory()); }
