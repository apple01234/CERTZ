/**
 * vc282 — 보스 기록전 입장 흐름 회귀 고정.
 *
 * vc274 는 클라이언트 경계(HP 고정·승인 대기)만 잠갔다. 실제 출전 경로는 비어 있었다:
 *   ① prepare 직후 현재 지역에 보스가 스폰되고 서버 start 를 부르지 않아
 *      finish 가 "시작하지 않은 출전" 으로 전부 거부됐다.
 *   ② 현재 지역 보스를 써서 고정 guardian/normal 계약과 어긋났다.
 *   ③ 경기장 개념이 없어 필드 몬스터·랜덤 이벤트가 기록에 끼어들었다.
 * 여기서는 그 세 가지가 다시 비지 않도록 소스 계약으로 고정한다.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const scene = readFileSync('src/game/scenes/WorldScene.ts', 'utf8');
const stages = readFileSync('src/game/stages.ts', 'utf8');
const client = readFileSync('src/game/bossContest.ts', 'utf8');
const store = readFileSync('src/lib/bossContestStore.ts', 'utf8');

test('전용 경기장 구역이 정의돼 있다', () => {
  assert.match(stages, /STAGES\.contest = \{/, 'contest 경기장 정의가 필요하다');
  // 잡몹이 기록 시간·피해에 끼어들지 않아야 한다.
  const def = /STAGES\.contest = \{([\s\S]{0,900}?)\n\};/.exec(stages);
  assert.ok(def, 'contest 정의 본문을 찾을 수 있어야 한다');
  assert.match(def[1], /enemies: \[\]/, '기록전 경기장에는 잡몹을 두지 않는다');
  assert.match(def[1], /boss: false/, '보스는 서버 계약을 받아 따로 스폰한다');
  assert.match(stages, /NEXT_STAGE\.contest = null/, '전진 포탈 없음(체인 분리)');
});

test('출전은 서버 start 를 거쳐야 한다', () => {
  /* 서버 스토어는 start 이후에만 finish 를 받는다 — 이 연결이 없으면 제출이 전부 거부된다. */
  assert.match(store, /a\.state === 'ready' && now <= a\.readyUntil/, '서버 start 계약');
  assert.match(scene, /startBossContest\(a\.id\)/, 'scene 이 서버 start 를 호출해야 한다');
  // 시작 시각은 서버 응답을 쓴다(클라이언트 시계로 기록을 앞당길 수 없어야 함).
  assert.match(scene, /startBossContest\(a\.id\)[\s\S]{0,400}?expiresAt - startedAt/,
    '제한시간은 서버가 준 startedAt/expiresAt 기준이어야 한다');
});

test('입장 전 구역을 기록하고 복귀한다', () => {
  assert.match(scene, /private contestFrom: StageKey = "village"/, '복귀지 필드');
  assert.match(scene, /this\.contestFrom = from && STAGES\[from\][\s\S]{0,200}?startTransition\("contest"/,
    '경기장 진입 시 입장 전 구역을 기록해야 한다');
  /* 복귀지 해석은 contestReturnStage 한 곳에 모여 있고, 포탈·퇴장 관리인·세이브가
   * 모두 그 접근자를 써야 한다(중복 식이 다시 흩어지지 않게 개수를 고정). */
  assert.match(scene, /private contestReturnStage\(\): StageKey/, '복귀지 접근자가 있어야 한다');
  const uses = scene.match(/this\.contestReturnStage\(\)/g) ?? [];
  assert.ok(uses.length >= 4, '포탈·퇴장 관리인·세이브·종료 복귀가 모두 접근자를 써야 한다');
  /* 접근자 본문 1곳만 원시 식을 갖는다 — 호출부에 중복 기재되면 다시 흩어진다. */
  const raw = scene.match(/STAGES\[this\.contestFrom\]/g) ?? [];
  assert.equal(raw.length, 1, '복귀지 해석은 접근자 한 곳에만 있어야 한다');
  assert.match(scene, /stageDef\.key === "contest"\) stageOverride/, '경기장은 세이브 구역이 아니다');
});

test('중도 이탈은 abandoned 로 보고한다', () => {
  /* running 인 채로 남으면 그 대회의 순위 확정이 막힌다. */
  assert.match(scene, /stageDef\.key === "contest" && this\.contestRun\) this\.finishContest\("abandoned"\)/,
    '경기장 이탈 시 abandoned 보고');
});

test('타격 수와 피해를 실제 HP 감소분으로 집계한다', () => {
  assert.match(scene, /b\.onLandedHit = \(dealt: number\)/, '타격 훅을 배선해야 한다');
  assert.match(scene, /run\.hits \+= 1/, '타격 수를 세야 한다');
  assert.match(scene, /run\.damage \+= Math\.max\(0, Math\.round\(dealt\)\)/, '실제 피해를 누적해야 한다');
  // 연출·면역 타격을 세면 근거가 부풀려진다.
  assert.match(scene, /const dealt = Math\.max\(0, Math\.round\(run\.damage\)\)/,
    '제출 피해는 누적분을 쓴다');
});

test('클라이언트는 여전히 스스로 승인·지급하지 않는다', () => {
  assert.doesNotMatch(client, /action:\s*'review'/, '클라이언트 자가 승인 금지');
  assert.doesNotMatch(client, /action:\s*'award'/, '클라이언트 자가 지급 금지');
});
