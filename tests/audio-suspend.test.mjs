// node --experimental-strip-types tests/audio-suspend.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * vc270 (유저 지시 #11 "알트탭하면 소리가 겁나 크게 뭉쳐서 들림") 회귀 방지.
 *
 * [실제 원인 — 코드로 확인한 것]
 *  Phaser SoundManager 의 pauseOnBlur 기본값은 true 라, 창이 blur 되면 AudioContext 가
 *  suspend 된다. 그런데 알트탭(같은 탭, 다른 앱)에서는 document.hidden 이 false 라
 *  vc204 의 `document.hidden` 가드가 걸리지 않았고, rAF 도 계속 돌아 SFX 요청이 이어졌다.
 *  `WebAudioSound.createAndStartBufferSource` 는 시작 시각을
 *  `context.currentTime + delay` 로 예약하는데, suspend 중에는 currentTime 이 **멈춰 있다**.
 *  따라서 정지 동안 요청된 SFX 는 전부 같은 시각에 예약되고, 복귀해 context 가 resume 되는
 *  순간 한꺼번에 터진다 = "겁나 크게 뭉쳐서".
 *
 * [수정] play() 가 정지 상태에서 아예 요청을 만들지 않는다(예약 자체를 막는다).
 *  window blur/focus/pagehide/pageshow + visibilitychange 를 모두 정지 트리거로 본다.
 */

/* 이 테스트는 브라우저 없이 모듈을 import 하므로, Phaser 사운드 매니저를 최소 스텁으로
 * 대체한다. 검증 대상은 audio.ts 의 상태 전이(=예산/스로틀/재생 요청 여부)이지
 * 실제 음원 출력이 아니다. */
const calls = { play: [], stopAll: 0 };
const stubGame = {
  cache: { audio: { exists: () => true } },
  sound: {
    mute: false,
    play: (key, cfg) => { calls.play.push({ key, vol: cfg?.volume }); return true; },
    stopAll: () => { calls.stopAll++; },
    resumeAll: () => {},
    pauseAll: () => {},
    add: () => null,
  },
};

/* window/document/performance 스텁 — audio.ts 의 lifecycle 이 읽는 최소 표면만 */
let clock = 1000;
function makeDom() {
  const listeners = new Map();
  const target = (store) => ({
    addEventListener: (t, fn) => { if (!listeners.has(store + t)) listeners.set(store + t, []); listeners.get(store + t).push(fn); },
  });
  const doc = { hidden: false, ...target('doc:') };
  const win = { ...target('win:') };
  globalThis.document = doc;
  globalThis.window = win;
  /* 스로틀(SFX_THROTTLE_MS=55)에 가려 검증이 무력화되지 않도록 시계를 직접 통제한다.
   *  이렇게 해야 "정지라서 막혔다"와 "스로틀이라 막혔다"를 구분할 수 있다. */
  globalThis.performance = { now: () => clock };
  return {
    doc,
    win,
    fire: (store, type) => { for (const fn of listeners.get(store + type) ?? []) fn(); },
  };
}
/** 스로틀 구간을 확실히 넘긴다 */
const tick = (ms = 100) => { clock += ms; };

const dom = makeDom();
const audio = await import('../src/game/audio.ts');

audio.attachAudio(stubGame);

test('정지(blur) 중에는 SFX 재생 요청이 만들어지지 않는다', () => {
  calls.play.length = 0;
  tick();
  audio.sfx.uiClick();
  assert.equal(calls.play.length, 1, '정상 상태에서는 재생돼야 한다');

  /* 알트탭: 탭은 보이지만 창 포커스를 잃은 경우 → blur 만 온다 */
  dom.fire('win:', 'blur');
  calls.play.length = 0;
  for (let i = 0; i < 20; i++) { tick(); audio.sfx.uiClick(); }
  assert.equal(calls.play.length, 0, 'blur 중 SFX 요청이 예약되면 복귀 시 한꺼번에 터진다');
});

test('정지 중에는 document.hidden 이 false 여도 막힌다(핵심 회귀)', () => {
  /* 이 케이스가 vc204 가 놓친 지점이다 — 탭은 visible, 창만 unfocused */
  assert.equal(dom.doc.hidden, false, '전제: 알트탭이면 document.hidden 은 false 다');
  calls.play.length = 0;
  tick();
  audio.sfx.uiClick();
  assert.equal(calls.play.length, 0);
});

test('복귀(focus) 후에는 다시 재생되고, 스로틀이 새로 시작된다', () => {
  dom.fire('win:', 'focus');
  calls.play.length = 0;
  /* blur 동안 lastPlayed 를 비웠으므로 같은 키라도 즉시 재생돼야 한다(스로틀 대기 없음) */
  tick(1);
  audio.sfx.uiClick();
  assert.equal(calls.play.length, 1, 'focus 후 첫 SFX 는 즉시 재생');
});

test('blur/visibilitychange 가 겹쳐 와도 정지는 한 번만 일어난다(멱등)', () => {
  dom.fire('win:', 'blur');
  const afterFirst = calls.stopAll;
  /* 같은 알트탭에서 visibilitychange 도 함께 오는 경우 */
  dom.doc.hidden = true;
  dom.fire('doc:', 'visibilitychange');
  assert.equal(calls.stopAll, afterFirst, '이미 정지 상태면 다시 정지하지 않는다');

  /* 복귀도 마찬가지 — visible → focus 순으로 둘 다 와도 한 번만 해제된다 */
  dom.doc.hidden = false;
  dom.fire('doc:', 'visibilitychange');
  dom.fire('win:', 'focus');
  calls.play.length = 0;
  audio.sfx.uiClick();
  assert.equal(calls.play.length, 1, '복귀가 중복 처리돼도 재생은 정상');
});

test('탭만 숨긴 경우(visibilitychange 단독)도 정지한다', () => {
  dom.doc.hidden = true;
  dom.fire('doc:', 'visibilitychange');
  calls.play.length = 0;
  tick();
  audio.sfx.uiClick();
  assert.equal(calls.play.length, 0);

  dom.doc.hidden = false;
  dom.fire('doc:', 'visibilitychange');
  calls.play.length = 0;
  tick();
  audio.sfx.uiClick();
  assert.equal(calls.play.length, 1);
});

test('pagehide 에서 정지되고 pageshow 에서 풀린다', () => {
  dom.fire('win:', 'pagehide');
  calls.play.length = 0;
  tick();
  audio.sfx.uiClick();
  assert.equal(calls.play.length, 0);

  dom.fire('win:', 'pageshow');
  calls.play.length = 0;
  tick();
  audio.sfx.uiClick();
  assert.equal(calls.play.length, 1);
});

test('동시재생 상한이 정지 후 포화 상태로 남지 않는다(복귀 버스트 방지)', () => {
  /* 정지 중 대량 요청이 예산을 태우고, 1600ms 감소 타이머가 백그라운드에서 유실되면
   * 복귀 시 상한(12)이 꽉 차 새 SFX 가 전부 거부됐다가 한꺼번에 풀린다.
   *  정지 시점에 예산을 비우므로 복귀 직후 12개까지는 즉시 재생돼야 한다. */
  dom.fire('win:', 'blur');
  for (let i = 0; i < 50; i++) { tick(); audio.sfx.uiClick(); }
  dom.fire('win:', 'focus');

  calls.play.length = 0;
  /* 서로 다른 키를 써서 스로틀을 피한다. bossDie 는 내부에서 2개를 재생하므로 제외.
   *  기대값은 상한 그 자체(SFX_MAX_CONCURRENT=12) — 복귀 직후 12개가 **모두** 재생되면
   *  예산이 포화 상태로 남지 않았다는 뜻이다(포화됐다면 0개). */
  const distinct = ['swing', 'hit', 'spin', 'dash', 'hurt', 'pickup', 'questDone', 'levelup',
                    'portal', 'roar', 'enemyDie', 'coin'];
  for (const k of distinct) { tick(); audio.sfx[k](); }
  assert.equal(distinct.length, 12, '전제: 상한과 같은 개수');
  assert.equal(calls.play.length, 12, '복귀 후 예산이 새로 시작돼 12개 모두 재생');
});

console.log('audio suspend/resume: all checks passed');
