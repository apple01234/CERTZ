/**
 * 2026-11-16 — 외부 평가 P1 "멀티플레이 버전 호환성".
 *
 *  [문제] 49838da 에서 구역 식별자를 `howlrstone3x2` → `lilacworld3x2` 로 바꿨는데,
 *   방 배치는 클라가 보낸 stage 문자열을 그대로 키로 쓴다. 그래서 갱신하지 않은 구버전 APK
 *   사용자와 신버전 사용자가 **같은 자리에 있어도 서로 보이지 않는다**.
 *
 *  [해결] 서버(multiplayer/config.js)와 MQTT 경로(src/game/mpMqtt.ts)가 stage 를 받는 즉시
 *   새 이름으로 바꾼다. 이 테스트는 세 가지를 고정한다:
 *    ① 서버 정규화가 옛 키를 새 키로 모은다
 *    ② 두 경로(서버·클라)가 같은 결과를 낸다 — 어긋나면 여전히 다른 방에 갈라진다
 *    ③ 일반 단어를 건드리지 않는다 (help·shell 이 duskrealm 이 되면 안 된다)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { normalizeStage } = require('../multiplayer/stageAliases.js');
const { rekeyLegacy } = await import('../src/game/legacyKeys.ts');

/* 실제로 클라가 보내는 구역 키(옛 이름 → 새 이름). */
const STAGES = [
  ['howlrstone1x1', 'lilacworld1x1'],
  ['howlrstone3x2', 'lilacworld3x2'],
  ['howlrstone4x3', 'lilacworld4x3'],
  ['alfheim2x1', 'fairyglade2x1'],
  ['muspelheim1x3', 'emberland1x3'],
  ['niflheim4x1', 'frostland4x1'],
  ['nidavellir2x2', 'forgehall2x2'],
  ['hel3x1', 'duskrealm3x1'],
  ['youngprincess1x1', 'youngprincess1x1'],
  ['village', 'village'],
  ['lilacworld2x3', 'lilacworld2x3'],
];

test('서버가 옛 구역 키를 새 이름으로 모은다 (구버전과 신버전이 같은 방)', () => {
  for (const [oldKey, newKey] of STAGES) {
    assert.equal(normalizeStage(oldKey), newKey, `${oldKey} → ${normalizeStage(oldKey)}`);
  }
});

test('서버·클라이언트 두 경로가 같은 결과를 낸다 — 어긋나면 여전히 방이 갈라진다', () => {
  for (const [oldKey] of STAGES) {
    assert.equal(
      normalizeStage(oldKey),
      rekeyLegacy(oldKey),
      `경로 불일치: ${oldKey} — 서버 ${normalizeStage(oldKey)} / 클라 ${rekeyLegacy(oldKey)}`,
    );
  }
  /* 실제 클라 스테이지 키 전수에 대해서도 어긋나지 않아야 한다 */
  for (const key of ['lilacworld1x1', 'lilacworld8x5', 'dlcstargatev', 'village', 'dojang', 'contest']) {
    assert.equal(normalizeStage(key), key, `${key} 가 변형됐다`);
  }
});

test('일반 단어를 구역 이름으로 바꾸지 않는다 (help·shell·program)', () => {
  /* `hel` → `duskrealm` 규칙이 토큰 경계를 지켜야 한다. 안 지키면 셸·도움말 같은 단어가 깨진다. */
  for (const word of ['help', 'helmet', 'shell', 'program', 'held', 'shelter', 'nidhoggish']) {
    assert.equal(normalizeStage(word), word, `${word} → ${normalizeStage(word)}`);
  }
});

test('구역 키는 24자로 잘리고, 빈 값은 기본 구역으로 떨어진다', () => {
  assert.equal(normalizeStage(undefined), '');
  assert.equal(normalizeStage(null), '');
  assert.equal(normalizeStage(''), '');
  assert.ok(normalizeStage('a'.repeat(40)).length <= 24);
  /* 잘린 뒤에도 옛 이름이 남지 않아야 한다 — 앞부분이 howlrstone 이면 잘려도 새 이름이어야 */
  const long = normalizeStage('howlrstone123456789012345678901234567890');
  assert.ok(long.startsWith('lilacworld'), long);
  assert.ok(long.length <= 24, `${long.length}자`);
});

test('서버 join/state 경로가 정규화를 실제로 거친다 (소스 계약)', () => {
  const src = readFileSync('multiplayer/index.js', 'utf8');
  /* join — 클라가 처음 보내는 stage */
  assert.match(src, /const \{ normalizeStage \} = require\("\.\/stageAliases"\)/);
  assert.match(src, /stage: normalizeStage\(typeof p\.stage === "string" \? p\.stage : DEFAULT_STAGE\)/);
  /* state — 맵 이동마다 오는 stage */
  assert.match(src, /if \(typeof s\.stage === "string"\) p\.stage = normalizeStage\(s\.stage\)/);
  /* MQTT 경로도 같은 이관표를 쓴다 */
  const mq = readFileSync('src/game/mpMqtt.ts', 'utf8');
  assert.match(mq, /import \{ rekeyLegacy, legacyStageKeys \} from "\.\/legacyKeys"/);
  assert.match(mq, /const stageKey = \(s: unknown\): string => rekeyLegacy\(/);
});
