/**
 * 2026-11-16 — 원격 궁극기 연출 동기화 (외부 평가 P1 "신규 궁극기 원격 연출 동기화 미구현").
 *
 *  우리가 쓰는 궁극기가 남의 화면에 그대로 보여야 한다. 종전 상태:
 *   ① 로컬 시전자만 pixelfx(시전·종결) 를 봤다 — 원격 화면에는 계열 근사 연출만 떴다.
 *   ② 서버 act 화이트리스트에 `s5b`(제2궁극기)가 없어, 소켓 서버 경유 시 제2궁극기는
 *      **아예 전달되지 않았다**(클라·MQTT 경로에만 있고 서버에만 빠짐).
 *
 *  이 테스트는 두 경로가 같은 종류 집합을 쓰는지, 원격 재생기가 pixelfx 를 부르는지,
 *  그리고 원격 연출이 **판정에 관여하지 않는지**(코스메틱 전용 계약)를 고정한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scene = readFileSync('src/game/scenes/WorldScene.ts', 'utf8');
const server = readFileSync('multiplayer/index.js', 'utf8');
const mqtt = readFileSync('src/game/mpMqtt.ts', 'utf8');
const netTs = readFileSync('src/game/net.ts', 'utf8');

const KINDS = ['atk', 's1', 's2', 's3', 's4', 's5', 's5b', 's5f', 's5bf'];

test('서버 act 화이트리스트에 모든 스킬 종류가 있다 — s5b 누락 회귀 방지', () => {
  const m = /const ACT_KINDS = new Set\(\[([^\]]+)\]\)/.exec(server);
  assert.ok(m, 'ACT_KINDS 를 찾을 수 없다');
  const kinds = m[1].split(',').map((s) => s.trim().replace(/^"|"$/g, '')).filter(Boolean);
  assert.deepEqual(kinds.sort(), [...KINDS].sort(), `서버 허용 종류: ${kinds.join(', ')}`);
});

test('클라·MQTT·서버 세 경로의 스킬 종류가 일치한다', () => {
  /* 클라 페이로드 타입 */
  const t = /kind: "atk" \| ([^;]+);/.exec(netTs);
  assert.ok(t, 'NetAction kind 유니언을 찾을 수 없다');
  const clientKinds = ['atk', ...t[1].split('|').map((s) => s.trim().replace(/"/g, ''))].filter(Boolean);
  /* MQTT 수신 필터 */
  const mq = /!\[([^\]]+)\]\.includes\(kind\)/.exec(mqtt);
  assert.ok(mq, 'MQTT kind 필터를 찾을 수 없다');
  const mqttKinds = mq[1].split(',').map((s) => s.trim().replace(/"/g, '')).filter(Boolean);
  /* 서버 */
  const sv = /const ACT_KINDS = new Set\(\[([^\]]+)\]\)/.exec(server);
  const serverKinds = sv[1].split(',').map((s) => s.trim().replace(/^"|"$/g, '')).filter(Boolean);

  for (const [name, list] of [['클라', clientKinds], ['MQTT', mqttKinds], ['서버', serverKinds]]) {
    assert.deepEqual([...list].sort(), [...KINDS].sort(), `${name} 경로 종류 불일치: ${list.join(', ')}`);
  }
});

test('원격 궁극기가 pixelfx 시전 연출을 재생한다 (로컬과 같은 그림)', () => {
  /* import 되어 있고 */
  assert.match(scene, /import \{ prefetchUltFx, playUltFx \} from "\.\.\/fx\/ultPixelFx"/);
  /* s5/s5b 분기에서 슬롯을 구분해 부른다 */
  const body = scene.slice(scene.indexOf('private playRemoteSkillFx('), scene.indexOf('/* ================= v4.1.0 — 긴급 귀환'));
  assert.match(body, /playUltFx\(this, cls, kind === "s5b" \? 2 : 1, "cast", x, y, !flip\)/);
  /* 실패해도 원격 연출 전체가 멈추지 않는다 */
  assert.match(body, /try \{ playUltFx\([\s\S]{0,120}\} catch \{ \/\* 연출 실패 무시 \*\/ \}/);
});

test('원격 연출은 판정·데미지·예산에 관여하지 않는다 (코스메틱 전용 계약)', () => {
  const body = scene.slice(scene.indexOf('private playRemoteSkillFx('), scene.indexOf('/* ================= v4.1.0 — 긴급 귀환'));
  for (const banned of ['takeDamage', 'notePlayerHit', 'ultCtx', 'createUltBudget', 'applyDamage']) {
    assert.equal(body.includes(banned), false, `원격 연출이 ${banned} 를 부른다 — 데미지가 두 번 들어간다`);
  }
});

test('원격 재생 경로가 스로틀 뒤에 있고, 자기 액션은 무시한다', () => {
  const fn = scene.slice(scene.indexOf('private playRemoteAction('), scene.indexOf('private playRemoteSkillFx('));
  assert.match(fn, /if \(!a \|\| a\.id === net\.netId\(\)\) return;/, '자기 액션이 원격으로 재생된다');
  assert.ok(fn.indexOf('lastRemoteActById') < fn.indexOf('playRemoteSkillFx'), '스로틀보다 먼저 재생한다');
  assert.match(fn, /playUltFx\(this, a\.cls \?\? cls, a\.kind === "s5bf" \? 2 : 1, "finale", x, y, !a\.flip\)/);
});
