import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 튜토리얼 개편 — vc256 (지시 #9).
 *
 * [사용자 지적] "튜토리얼 너무 짜침(너무 글자만 도배 되어있고 초반에 너무 알림창이
 *  많이 뜸(스트레스 유발 원인!!)"
 *
 * [실측한 종전 상태]
 *  · 8단계 × 평균 115자 = **921자** 도배. desc 가 배너에도 그대로 찍혀 화면을 덮었다.
 *  · 알림 배너가 시작1 + 단계별 진입·완료 = **약 17회**.
 *  · ⑦⑧(쉐이더·고대비)은 설정 화면을 열어야 하는 부가 기능이라 첫 5분에 강제할 이유가 없다.
 *
 * [새 원칙]
 *  ① 글 대신 행동 — desc 한 문장(≤60자), 조작법은 키 배지로 분리
 *  ② 알림 최소화 — 단계 진입 배너 제거, 배너는 시작/완료/스킵 3회만
 *  ③ 단계 8 → 5
 *  ④ 진행 표시(pips)와 목표 카운트는 유지
 */

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src/game/Tutorial.ts');
const src = fs.readFileSync(SRC, 'utf8');

/** STEPS 배열의 desc 문자열만 뽑는다 */
function descs() {
  const start = src.indexOf('const STEPS: TutStep[] = [');
  const end = src.indexOf('];', start);
  const body = src.slice(start, end);
  return [...body.matchAll(/desc:\s*"([^"]+)"/g)].map((m) => m[1]);
}

test('단계 수가 8 → 5 로 줄었다', () => {
  const n = descs().length;
  assert.equal(n, 5, `단계가 ${n}개 — 5개여야 한다`);
});

test('설명이 한 문장으로 짧다 (도배 금지)', () => {
  const list = descs();
  const long = list.filter((d) => d.length > 60);
  assert.deepEqual(long, [], `60자 초과 설명: ${long.map((d) => `${d.slice(0, 20)}…(${d.length}자)`).join(', ')}`);
  const total = list.reduce((a, d) => a + d.length, 0);
  /* 종전 921자 → 지금은 200자 미만이어야 "도배"가 아니다 */
  assert.ok(total < 220, `설명 총합 ${total}자 — 여전히 많다`);
  console.log(`  설명 총합 ${total}자 (종전 921자)`);
});

test('알림 배너가 3회 이하다', () => {
  /* showBanner 호출: 시작 / 완료 / 스킵 */
  const calls = (src.match(/showBanner\(/g) || []).length;
  assert.ok(calls <= 3, `showBanner ${calls}회 — 단계별 배너가 남아 있다`);
});

test('단계 진입 시 배너를 띄우지 않는다', () => {
  /* advance() 안에 showBanner 가 있으면 단계마다 화면을 덮는다 */
  const adv = src.slice(src.indexOf('private advance()'), src.indexOf('/* ───────────────────── 프레임 갱신'));
  assert.equal(/showBanner\(/.test(adv), false, 'advance() 에 배너가 남아 있다');
  /* 패널만 갱신해야 한다 */
  assert.ok(adv.includes('this.refresh()'), 'advance 가 refresh 로 조용히 갱신하지 않는다');
});

test('조작법은 문장이 아니라 키 배지로 분리됐다', () => {
  assert.ok(src.includes('STEP_KEYS'), '키 배지 정의가 없다');
  assert.ok(src.includes('tKey'), '키 배지 텍스트 객체가 없다');
  /** 공격 = X, 스킬 = Z (실제 키맵과 일치) */
  assert.match(src, /kill:\s*"[^"]*X[^"]*"/);
  assert.match(src, /skill:\s*"[^"]*Z[^"]*"/);
  /* 설명문 안에 조작 설명이 섞여 있으면 다시 도배가 된다 */
  for (const d of descs()) {
    assert.equal(/PC는|모바일은|꾹 눌러|키\)/.test(d), false, `설명에 조작법이 섞였다: ${d}`);
  }
});

test('설정 강제 단계(쉐이더·고대비)가 튜토리얼에서 빠졌다', () => {
  assert.equal(/"shader"|"contrast"|"pot"/.test(src.slice(src.indexOf('type TutStepId'), src.indexOf(';', src.indexOf('type TutStepId')))), false);
  /* 설정 패널의 tut:notify 는 남아 있어도 무해(매칭 단계 없음) */
  const steps = src.slice(src.indexOf('const STEPS'), src.indexOf('];', src.indexOf('const STEPS')));
  assert.equal(/shader|contrast/.test(steps), false, '설정 단계가 STEPS 에 남아 있다');
});

test('진행 표시와 목표 카운트는 유지된다', () => {
  /* "얼마나 남았는지"는 스트레스가 아니라 안내다 */
  assert.ok(src.includes('tPips'), '진행 점 표시가 사라졌다');
  assert.match(src, /st\.goal > 1 \? `  \(\$\{this\.prog\}\/\$\{st\.goal\}\)`/);
});

test('구 세이브의 큰 tutStep 값도 안전하다', () => {
  /* 8단계 시절 세이브는 tutStep 5~7 을 갖고 있다. Clamp 로 5단계 범위에 맞춰야 한다. */
  assert.match(src, /Phaser\.Math\.Clamp\(resumeStep, 0, STEPS\.length - 1\)/);
});
