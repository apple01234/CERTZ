import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';

/**
 * 원격 DB 축소 가드 (vc261).
 *
 * [사고 실측]
 *  2026-11-05 05:37  accounts.enc = 14,100B  ← 계정 2명·토큰 9·세이브 1, 정상
 *  2026-11-05 07:31  accounts.enc =    964B  ← 시드 2계정만, **다른 키**로 암호화
 *  그 뒤 운영 전체 500 (`DB 복호화 실패 — 키 불일치?`).
 *
 *  vc245 가 넣은 isRemoteSafeKey 는 '키가 **없을** 때'만 막았다.
 *  이번엔 키가 *있는데 다른 값*이라 그 가드를 통과했다 — 전제가 틀렸던 것.
 */

const ROOT = path.resolve(import.meta.dirname, '..');

test('정상 성장(증가)은 통과한다', async () => {
  const { allowRemoteWrite } = await import('../src/lib/dbShrinkGuard.ts');
  assert.equal(allowRemoteWrite(14100, 'x'.repeat(14200)).ok, true);
  assert.equal(allowRemoteWrite(14100, 'x'.repeat(14100)).ok, true);
});

test('소폭 감소는 허용한다 (계정 삭제·정리)', async () => {
  const { allowRemoteWrite } = await import('../src/lib/dbShrinkGuard.ts');
  /* 20% 감소 — 실수나 정상적 정리 범위 */
  assert.equal(allowRemoteWrite(14100, 'x'.repeat(11280)).ok, true);
});

test('사고 재현: 14100B → 964B 는 차단된다', async () => {
  const { allowRemoteWrite } = await import('../src/lib/dbShrinkGuard.ts');
  const r = allowRemoteWrite(14100, 'x'.repeat(964));
  assert.equal(r.ok, false);
  assert.match(r.reason, /급감/);
  assert.match(r.reason, /14100B/);
});

test('절반 미만 축소는 모두 차단 (경계값 포함)', async () => {
  const { allowRemoteWrite, SHRINK_FLOOR_RATIO } = await import('../src/lib/dbShrinkGuard.ts');
  const prev = 10000;
  const justUnder = Math.floor(prev * SHRINK_FLOOR_RATIO) - 1;
  const justOver = Math.floor(prev * SHRINK_FLOOR_RATIO) + 1;
  assert.equal(allowRemoteWrite(prev, 'x'.repeat(justUnder)).ok, false, '경계 미만인데 통과');
  assert.equal(allowRemoteWrite(prev, 'x'.repeat(justOver)).ok, true, '경계 초과인데 차단');
});

test('원격에 파일이 없으면(첫 생성) 허용', async () => {
  const { allowRemoteWrite } = await import('../src/lib/dbShrinkGuard.ts');
  assert.equal(allowRemoteWrite(null, 'x'.repeat(5000)).ok, true);
  assert.equal(allowRemoteWrite(0, 'x'.repeat(5000)).ok, true);
});

test('빈 내용은 언제나 거부 (DB 소실 방지)', async () => {
  const { allowRemoteWrite } = await import('../src/lib/dbShrinkGuard.ts');
  assert.equal(allowRemoteWrite(null, '').ok, false);
  assert.equal(allowRemoteWrite(14100, 'x'.repeat(10)).ok, false);
});

test('의도적 초기화는 allowReset 으로 통과', async () => {
  const { allowRemoteWrite } = await import('../src/lib/dbShrinkGuard.ts');
  assert.equal(allowRemoteWrite(14100, 'x'.repeat(964), true).ok, true);
});

test('ghdb.ts 쓰기 경로에 가드가 실제로 연결됐다', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/lib/ghdb.ts'), 'utf8');
  /* import */
  assert.ok(src.includes('allowRemoteWrite'), '가드를 import 하지 않는다');
  /* ghPutRaw 안에서 호출 */
  const fn = src.slice(src.indexOf('async function ghPutRaw'), src.indexOf('if (r.ok) {', src.indexOf('async function ghPutRaw')));
  assert.ok(fn.includes('allowRemoteWrite'), 'ghPutRaw 가 가드를 호출하지 않는다');
  assert.ok(/prevBytes/.test(fn), '이전 크기를 받지 않는다');
  /* loadDb 가 원본 크기를 실제로 계산해야 한다 — 하드코딩 0 이면 가드가 무력화된다 */
  assert.ok(/encBytes:\s*raw\.enc\.length/.test(src), '원본 크기를 계산하지 않는다');
  assert.ok(/encBytes:\s*prevBytes/.test(src) || /encBytes\s*\}\s*=\s*await loadDb/.test(src),
    'mutateDb 가 loadDb 의 크기를 받지 않는다');
  /* 실패 시 쓰기를 계속하지 않아야 한다 */
  assert.ok(/if \(!chk\.ok\)[\s\S]{0,200}return \{ ok: false/.test(fn), '차단 후에도 쓰기를 계속한다');
});

test('차단은 예외가 아니라 PutResult 실패로 돌려준다 (mutateDb 재시도 경로 유지)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/lib/ghdb.ts'), 'utf8');
  const fn = src.slice(src.indexOf('async function ghPutRaw'), src.indexOf('const fileB64'));
  assert.ok(!/throw/.test(fn), '차단이 예외를 던지면 mutateDb 재시도 로직이 깨진다');
});
