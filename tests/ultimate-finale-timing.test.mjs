/**
 * vc273 — 궁극기 마무리 타이밍 회귀 고정.
 *
 * 실제 버그(인계 문서 지적):
 *  1) useSkill5 는 본타를 delayedCall(최대 2,220ms)로 예약해 두고 runUltFinale 를 **동기 호출**
 *     해서, 마무리 폭발이 첫 타보다 먼저 터지고 본타가 뒤따랐다.
 *  2) useSkill5b 는 `ult5bHoldOf - 620`(=10~60초) 뒤에 마무리를 재생해서, 실제 딜이 2초 안에
 *     끝나는데도 마무리가 44~60초 뒤에 늦게 터졌다.
 *
 * 헤드리스로 실제 렌더를 볼 수 없으므로 소스 계약과 순수 시퀀스로 검증한다.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { UltimateSequence } from '../src/game/combat/ultimateSequence.ts';

const player = readFileSync('src/game/entities/Player.ts', 'utf8');

test('1차 궁극기 마무리는 본타 뒤로 예약된다(동기 호출 아님)', () => {
  // useSkill5 안에서 scheduleUltFinale 를 호출해야 한다.
  assert.match(player, /this\.scheduleUltFinale\(\);/, 'useSkill5 가 마무리를 예약해야 한다');
  // 스케줄러는 delayedCall 로 미뤄야 한다.
  assert.match(player, /private scheduleUltFinale\(\)\s*\{[\s\S]{0,400}?this\.scene\.time\.delayedCall\(/,
    'scheduleUltFinale 는 delayedCall 로 미뤄야 한다');
  // 마무리 지연이 본타 최대 지연(2,220ms) 이상이어야 첫 타보다 늦다.
  const m = /const ultFinaleAt = ([\d\s+*]+);/.exec(player);
  assert.ok(m, 'ultFinaleAt 상수가 있어야 한다');
  const value = Function(`return (${m[1]});`)();
  assert.ok(value >= 2220, `마무리 지연 ${value}ms 는 본타 최대 지연 2220ms 이상이어야 한다`);
});

test('2차 궁극기 마무리는 실제 마지막 타격 직후로 고정된다', () => {
  // 종전의 10~60초 지연 계산이 실제 코드로 남아 있으면 안 된다(주석은 제외하고 검사).
  const codeOnly = player
    .split('\n')
    .filter((line) => !/^\s*(\*|\/\*|\/\/)/.test(line))
    .join('\n');
  assert.doesNotMatch(codeOnly, /ult5bHoldOf\([^)]*\)\s*-\s*620/,
    'ult5bHoldOf - 620 지연 경로가 남아 있으면 마무리가 수십 초 늦게 나간다');
  const m = /const ult5bFinaleAt = ([\d\s+*]+);/.exec(player);
  assert.ok(m, 'ult5bFinaleAt 상수가 있어야 한다');
  const value = Function(`return (${m[1]});`)();
  // 본타는 280 + i*430 (i<5) → 마지막 2,000ms. 그보다 뒤여야 한다.
  assert.ok(value > 2000, `2차 마무리 ${value}ms 는 마지막 타격 2000ms 뒤여야 한다`);
  assert.ok(value < 6000, `2차 마무리 ${value}ms 가 다시 수십 초로 늘어나면 안 된다`);
});

test('UltimateSequence 는 실제 타격이 모두 끝난 뒤에만 마무리를 낸다', () => {
  let now = 0;
  const timers = [];
  const clock = {
    get now() { return now; },
    delayedCall(ms, cb) { const e = { at: now + ms, cb }; timers.push(e); return e; },
  };
  const hits = [];
  const actor = { state: 'idle' };
  const seq = new UltimateSequence(clock, () => actor.state !== 'dead');
  const flush = () => {
    while (timers.length) {
      timers.sort((a, b) => a.at - b.at);
      const e = timers.shift();
      now = e.at;
      e.cb();
    }
  };

  seq.after(320, () => hits.push(['hit1', now]));
  seq.after(320 + 460, () => {
    hits.push(['hit2', now]);
    seq.after(200, () => hits.push(['hit3', now])); // 중첩 타격
  });
  seq.complete(() => hits.push(['finale', now, seq.phase]));
  flush();

  const finale = hits.find((h) => h[0] === 'finale');
  const lastHit = hits.filter((h) => h[0] !== 'finale').at(-1);
  assert.ok(finale && lastHit, '타격과 마무리가 모두 있어야 한다');
  assert.ok(finale[1] >= lastHit[1], '마무리는 마지막 타격보다 먼저 나가면 안 된다');
  assert.equal(finale[2], 'recovery');
  assert.equal(actor.state, 'idle', '궁극기는 조작 잠금을 만들지 않는다');
});

test('사망하면 남은 타격과 마무리가 취소된다', () => {
  let now = 0;
  const timers = [];
  const clock = { get now() { return now; }, delayedCall(ms, cb) { const e = { at: now + ms, cb }; timers.push(e); return e; } };
  let alive = true;
  let count = 0;
  const seq = new UltimateSequence(clock, () => alive);
  const flush = () => {
    while (timers.length) {
      timers.sort((a, b) => a.at - b.at);
      const e = timers.shift();
      now = e.at;
      e.cb();
    }
  };
  seq.after(100, () => count++);
  seq.after(300, () => count++);
  seq.complete(() => count++);
  clock.delayedCall(150, () => { alive = false; });
  flush();
  assert.equal(count, 1, '죽은 뒤에는 타격도 마무리도 실행되면 안 된다');
});
