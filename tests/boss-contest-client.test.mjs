/**
 * vc274 — 보스 기록전 클라이언트 경계 회귀 고정.
 *
 * 서버 스토어(tests/boss-contest.test.mjs)가 권한·시각·중복·근거 검증을 담당한다.
 * 여기서는 **클라이언트가 그 검증을 우회하지 않는지**를 소스 계약으로 확인한다:
 *  1) 보스 HP·제한시간은 서버가 준 값으로 고정되고 클라이언트가 만들지 않는다.
 *  2) 클라이언트 보고는 승인 대기로만 저장되며 자동 승인/지급 경로가 없다.
 *  3) 기록전 전투는 기존 보스 파이프라인을 재사용한다(새 전투 엔진 없음).
 *  4) HUD 에서 기록전 패널로 들어갈 경로가 실제로 존재한다.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const scene = readFileSync('src/game/scenes/WorldScene.ts', 'utf8');
const store = readFileSync('src/lib/bossContestStore.ts', 'utf8');
const hud = readFileSync('src/components/game/HUD.tsx', 'utf8');

test('기록전 보스 HP는 서버가 준 값으로 덮어쓴다', () => {
  // spawnContestBoss 가 서버 bossHp 로 hp/maxHp 를 고정해야 한다.
  // 함수 본문 길이에 의존하지 않도록 다음 메서드 선언 전까지를 본문으로 본다.
  const m = /private spawnContestBoss\(bossHp: number\)\s*\{([\s\S]*?)\n  \}\n\n  \/\*\*/.exec(scene);
  assert.ok(m, 'spawnContestBoss 구현이 있어야 한다');
  const body = m[1];
  assert.match(body, /b\.hp = bossHp/, '서버가 준 HP 로 고정해야 한다');
  assert.match(body, /b\.maxHp = bossHp/);
  // 클라이언트가 HP 를 계산해 넣으면 서버 고정이 깨진다.
  assert.doesNotMatch(body, /hp\s*=\s*Math\.round\(/, '클라이언트가 HP 를 계산해 넣으면 안 된다');
});

test('기록전은 기존 보스 파이프라인을 재사용하고 서버 계약 보스를 쓴다', () => {
  /* vc282 — 종전엔 "현재 지역 보스" 를 띄워 고정 guardian 계약과 어긋났다.
   * 새 전투 엔진을 만들지 않고 기존 스폰 경로(spawnGmBoss)를 재사용하되,
   * 반드시 계약 보스(guardian)를 지정해야 한다. */
  const m = /private spawnContestBoss\(bossHp: number\)\s*\{([\s\S]*?)\n  \}\n\n  \/\*\*/.exec(scene);
  assert.ok(m, 'spawnContestBoss 구현이 있어야 한다');
  const body = m[1];
  assert.match(body, /this\.spawnGmBoss\("guardian"\)/,
    '기존 스폰 파이프라인을 재사용하되 계약 보스(guardian)를 지정해야 한다');
  assert.doesNotMatch(body.replace(/\/\*[\s\S]*?\*\//g, ''), /this\.spawnBoss\(true\)/,
    '현재 지역 보스를 그대로 쓰면 서버 계약과 어긋난다');
});

test('클라이언트 보고는 승인 대기로만 저장되고 자동 승인 경로가 없다', () => {
  // finish 는 pending 까지만 간다.
  assert.match(store, /a\.state = 'pending'/, '제출은 pending 으로만 저장되어야 한다');
  // 승인은 review 액션(관리자)에서만.
  assert.match(store, /if \(\['create', 'review', 'finalize', 'award'\]\.includes\(String\(action\)\)\) demand\(actor\.admin/,
    '검토·확정·지급은 관리자만 가능해야 한다');
  // 클라이언트 모듈에 자동 승인 호출이 없어야 한다.
  const client = readFileSync('src/game/bossContest.ts', 'utf8');
  assert.doesNotMatch(client, /action:\s*'review'/, '클라이언트가 스스로 승인하면 안 된다');
  assert.doesNotMatch(client, /action:\s*'award'/, '클라이언트가 스스로 지급하면 안 된다');
});

test('보스 처치 시에만 성공 보고가 나간다', () => {
  // onBossDead 안에서 defeated 보고 — 함수 본문 길이에 의존하지 않도록 넉넉히 잡는다.
  const start = scene.indexOf('onBossDead() {');
  assert.ok(start > -1, 'onBossDead 구현이 있어야 한다');
  const body = scene.slice(start, start + 2500);
  assert.match(body, /finishContest\("defeated"\)/, '보스 처치 시 성공 보고');
  assert.match(body, /if \(this\.contestRun\)/, '기록전 중일 때만 보고해야 한다');
  // 제한시간 초과는 실패 보고
  assert.match(scene, /finishContest\("failed"\)/, '시간 초과 시 실패 보고');
});

test('HUD 에 기록전 진입 경로가 있다', () => {
  assert.match(hud, /EventBus\.emit\("contest:toggle"\)/, 'HUD 가 기록전 패널을 열 수 있어야 한다');
  const panel = readFileSync('src/components/game/ClassroomPanel.tsx', 'utf8');
  assert.match(panel, /EventBus\.on\("contest:toggle"/, '패널이 그 이벤트를 받아야 한다');
});

test('리스너는 핸들러를 정의한 뒤에 등록한다', () => {
  /* 실제로 이 순서를 틀려서 "The listener must be a function" 으로 씬 초기화가
   * 통째로 실패했다(부팅 불가). EventBus.on 에 undefined 를 넘기면 안 된다. */
  const def = scene.indexOf('this.onContestStart = (v:');
  const reg = scene.indexOf('EventBus.on("contest:start", this.onContestStart');
  assert.ok(def > -1 && reg > -1, '핸들러 정의와 리스너 등록이 모두 있어야 한다');
  assert.ok(def < reg, '핸들러 정의가 리스너 등록보다 먼저여야 한다(undefined 등록 방지)');
});
