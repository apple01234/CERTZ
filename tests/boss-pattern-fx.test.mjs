// 2026-11-15 — 보스 패턴 pixelfx 계약 (유저 지시 "/pixelfx → 보스 패턴").
// 모든 보스 패턴에 예고 또는 발동 이펙트가 있고, 시트가 실재하며 모바일 한도(13MB) 안이고,
// 보스가 생길 때 받고 정리될 때 내리는지 본다. 판정·타이밍은 건드리지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { STORY_ATTACKS } from '../src/game/entities/storyBossPatterns.ts';
import { TELEGRAPH_MS } from '../src/game/entities/bossPhases.ts';

const src = readFileSync('src/game/fx/bossPatternFx.ts', 'utf8');
const table = src.slice(src.indexOf('export const BOSS_PATTERN_FX'), src.indexOf('};', src.indexOf('export const BOSS_PATTERN_FX')));
const rows = Object.fromEntries([...table.matchAll(/^\s+(\w+): \{([^\n]*)\},?$/gm)].map(([, k, body]) => [k, [...body.matchAll(/key: "([\w-]+)", at: "(boss|target)"/g)].map(m => m[1])]));

const stages = readFileSync('src/game/stages.ts', 'utf8');
const union = stages.slice(stages.indexOf('export type BossAttackKind'), stages.indexOf(';', stages.indexOf('export type BossAttackKind')));
const KINDS = [...union.matchAll(/"([a-z]+)"/g)].map(m => m[1]);

const mb = (key) => { const h = readFileSync(`public/assets/fx/${key}.png`).subarray(16, 24); return (h.readUInt32BE(0) * h.readUInt32BE(4) * 4) / 1e6; };

test('보스 패턴(일반·시그니처·스토리) 전부에 이펙트가 있다', () => {
  assert.ok(KINDS.length >= 25, `${KINDS.length}`);
  for (const k of [...KINDS, ...STORY_ATTACKS]) assert.ok(rows[k]?.length, `${k} 이펙트 없음`);
});

test('시트가 실재하고 pixelfx 메타가 있으며 한 장 13MB 이하다(모바일)', () => {
  for (const key of new Set(Object.values(rows).flat())) {
    assert.ok(existsSync(`public/assets/fx/${key}.png`) && existsSync(`public/assets/fx/${key}.json`), key);
    assert.ok(JSON.parse(readFileSync(`public/assets/fx/${key}.json`, 'utf8')).meta?.pixelfx, `${key} 메타 없음`);
    assert.ok(mb(key) <= 13, `${key} ${mb(key).toFixed(1)}MB`);
  }
});

test('발동 이펙트는 예고 시간(telegraphMs) 뒤에 뜬다 — 판정 타이밍 표를 그대로 쓴다', () => {
  assert.match(src, /scene\.time\.delayedCall\(telegraphMs\(kind\), \(\) => \{/);
  assert.ok(TELEGRAPH_MS._default > 0);
});

test('보스가 생길 때 그 보스 패턴 시트만 받고, 정리될 때 내린다(궁극기와 겹치는 시트는 남김)', () => {
  const boss = readFileSync('src/game/entities/Boss.ts', 'utf8');
  assert.match(boss, /this\.def = def;\n\s+prefetchBossFx\(scene, def\.patterns\);/);
  assert.match(boss, /playBossPatternFx\(this\.scene, kind, this, player,/);
  const pool = boss.slice(boss.indexOf('  destroyPool() {'));
  assert.match(pool.slice(0, 300), /releaseBossFx\(this\.scene, this\.def\.patterns, this\.scene\.player\?\.cls\)/);
  assert.match(src, /const keep = new Set\(ultSheetsOf\(playerCls\)\);/);
});

test('지역에 들어올 때 지난 보스의 패턴 시트를 마저 정리한다', () => {
  const ws = readFileSync('src/game/scenes/WorldScene.ts', 'utf8');
  assert.match(ws, /sweepBossFx\(this, this\.player\.cls, this\.boss\?\.def\.patterns\)/);
  const sweep = src.slice(src.indexOf('export function sweepBossFx'));
  assert.match(sweep, /const keep = new Set\(\[\.\.\.ultSheetsOf\(playerCls\), \.\.\.\(currentBoss \? bossFxSheets\(currentBoss\) : \[\]\)\]\);/);
});
