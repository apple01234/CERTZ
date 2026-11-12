/**
 * 2026-11-12 전 구간 밸런스 재조정 — 실측 밴드 고정.
 *
 * 자(ruler): 강화 0 전사의 기본공격(scripts/measure-combat-balance.mjs). 실제 유저는
 * 전직·스킬로 이보다 몇 배 강하므로, 여기 숫자는 "가장 약한 정상 유저" 기준이다.
 *
 * 재조정 전 실측(회귀하면 이 값들로 돌아간다):
 *  · 본편 보스 1,350 ~ 886만 타 (디오 설계 19,800 HP → 실제 178,200, 마지막 행성 약 246억)
 *  · 영프 10~14장 잡몹 1.3~1.9타(원킬), 그랜드 플레닛 구역 3→4 에서 4배 절벽, 최대 1,770타
 *  · 정상 플레이만으로 영프 종료 Lv154(게이트 128), 첫 행성에서 Lv219(게이트 130~140)
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mainChain, trajectory } from '../scripts/measure-combat-balance.mjs';
import { BOSS_STAGE_STATS, STAGES } from '../src/game/stages.ts';

const rows = mainChain();
const story = rows.filter(r => r.key.startsWith('howlrstone'));
const dlc = rows.filter(r => r.key.startsWith('dlc'));

test('본편 보스: 노말 전투 길이가 목표 밴드 안이다', () => {
  const bosses = rows.filter(r => r.bossHtk);
  assert.ok(bosses.length >= 20, '영프 10 + 그랜드 플레닛 10 보스');
  for (const r of bosses) {
    assert.ok(BOSS_STAGE_STATS[r.key], `${r.key}: 본편 보스는 실효 스탯 표에 있어야 한다`);
    const [lo, hi] = r.key.startsWith('dlc') ? [500, 1600] : [120, 500];
    assert.ok(r.bossHtk >= lo && r.bossHtk <= hi, `${r.key}: 기본공격 ${r.bossHtk}타 (목표 ${lo}~${hi})`);
    assert.ok(r.bossHitsToDie >= 3.5, `${r.key}: 보스에게 ${r.bossHitsToDie}대에 죽는다 (3.5대 이상)`);
  }
  // 표의 키는 전부 실제 보스 구역이어야 한다(오타 방지).
  for (const k of Object.keys(BOSS_STAGE_STATS)) assert.ok(STAGES[k]?.boss, `${k} 는 보스 구역이 아니다`);
});

test('영프 편 잡몹: 원킬도 노가다도 아니다', () => {
  for (const r of story.filter(r => r.mobHtk && !r.key.startsWith('howlrstone1x'))) {
    assert.ok(r.mobHtkMax >= 2.5, `${r.key}: 가장 단단한 몹도 ${r.mobHtkMax}타 — 원킬 구역 (2.5타 이상)`);
    assert.ok(r.mobHtk <= 5 && r.mobHtkMax <= 8, `${r.key}: 중앙값 ${r.mobHtk}타 / 최대 ${r.mobHtkMax}타 (5 / 8 이하)`);
  }
  // 1장은 Lv1~5 를 순식간에 지나므로 첫 구역만 느슨하게 본다(재조정 전 14.4타).
  assert.ok(story[0].mobHtk <= 9, `1-1: ${story[0].mobHtk}타`);
});

test('그랜드 플레닛 잡몹: 절벽 없이 완만하게 오른다', () => {
  for (const r of dlc.filter(r => r.mobHtk)) {
    assert.ok(r.mobHtk >= 4 && r.mobHtk <= 100, `${r.key}: 중앙값 ${r.mobHtk}타 (4~100)`);
    assert.ok(r.hitsToDie >= 3.5, `${r.key}: ${r.hitsToDie}대에 죽는다 (3.5대 이상)`);
  }
  // 같은 행성 안에서 이웃 구역끼리 2.6배를 넘게 뛰지 않는다(종전 구역 3→4 는 4.2배).
  for (let i = 1; i < dlc.length; i++) {
    const a = dlc[i - 1], b = dlc[i];
    if (!a.mobHtk || !b.mobHtk || a.key.replace(/\d+$/, '') !== b.key.replace(/\d+$/, '')) continue;
    assert.ok(b.mobHtkMax / a.mobHtkMax <= 2.6, `${a.key}→${b.key}: ${(b.mobHtkMax / a.mobHtkMax).toFixed(1)}배`);
  }
});

test('성장 궤적: 정상 플레이가 장별 게이트 밴드를 따라간다', () => {
  const t = trajectory();
  for (const c of t) {
    assert.ok(c.enterLv >= c.gateEnter, `${c.chapter}: Lv${c.enterLv} 로 게이트 ${c.gateEnter} 에 막힌다`);
    if (c.exitLv > c.enterLv) assert.ok(c.enterLv <= c.gateEnter + 3, `${c.chapter}: 입장 Lv${c.enterLv} 가 게이트 ${c.gateEnter} 를 3 넘게 앞선다(과속)`);
  }
  const last = t[t.length - 1];
  assert.ok(last.exitLv >= last.gateMid && last.exitLv <= 295, `마지막 행성 종료 Lv${last.exitLv} (만렙 299 미만)`);
});

test('그랜드 플레닛 퀘스트 골드가 몬스터 골드와 같은 자릿수다', async () => {
  /* 재조정 전: 행성당 퀘스트 골드 25억 ~ 111조 vs 몬스터 골드 약 100만 (CH_EXP 를 골드식에도 곱했다). */
  const { STAGES, ENEMIES, stageScale } = await import('../src/game/stages.ts');
  const { chapters } = await import('../scripts/measure-combat-balance.mjs');
  for (const c of chapters().filter(c => c.name.startsWith('dlc'))) {
    let quest = 0, mob = 0;
    for (const k of c.keys) {
      const d = STAGES[k];
      quest += (d.quests ?? []).reduce((t, q) => t + (q.reward ?? 0), 0);
      const kills = Math.max(d.enemies.reduce((t, g) => t + g.count, 0), (d.quests ?? []).filter(q => q.type === 'hunt').reduce((t, q) => t + (q.need ?? 0), 0));
      const avg = d.enemies.length ? d.enemies.reduce((t, g) => t + (ENEMIES[g.key].gold[0] + ENEMIES[g.key].gold[1]) / 2, 0) / d.enemies.length : 0;
      mob += kills * avg * stageScale(k, 0).gold;
    }
    assert.ok(quest / mob > 0.1 && quest / mob < 3, `${c.name}: 퀘스트 골드 ${Math.round(quest)} / 몬스터 골드 ${Math.round(mob)}`);
  }
});

test('골드 상점 성장의 책은 Lv100 요구치까지만 비례한다', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync('src/game/entities/Player.ts', 'utf8');
  assert.match(src, /GOLD_BOOK_LEVEL_CAP = 100/);
  assert.match(src, /key === "exp_book_s" \? expToNext\(Math\.min\(this\.lv, GOLD_BOOK_LEVEL_CAP\)\)/);
});
