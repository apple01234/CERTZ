import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 원격 백업 키 안전 가드 — vc245 회귀 방지.
 *
 * [실제 사고] 2026-11-04 21:50Z, SERTZ_BACKUP_KEY 없이 로컬 서버를 띄운 세션이
 *  db-backup/lilac-v2/accounts.enc 를 **소스에 공개된 기본 키**(sertz-accounts-backup::v1)로
 *  재암호화해 GitHub 에 푸시했다. 운영 Vercel 은 별도 키를 쓰고 있었으므로 복호화가 전부 실패,
 *  /api/auth/me · /api/auth/login 이 전면 500 이 됐다. (DB 5262B → 723B 로 축소)
 *
 * [교훈] 개발 모드 폴백은 "경고만 하고 계속"이면 안 된다. 공개 키로 원격에 쓰는 순간
 *  ① 기밀성이 0 이 되고 ② 운영 키와 불일치해 서비스 전체가 죽는다.
 *  → 키가 없으면 원격 쓰기를 **거부**해야 한다.
 */

const ROOT = path.resolve(import.meta.dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('개발 모드 폴백 키는 소스 공개 상수임을 명시한다', () => {
  const src = read('accounts/index.js');
  assert.ok(src.includes('DEFAULT_KEY_SECRET'), '기본 키 상수가 없다');
  /* 공개 상수를 그대로 쓰면 원격에 올리면 안 된다는 경고가 코드에 있어야 한다 */
  assert.match(src, /공개/);
});

test('원격 쓰기 경로가 키 미설정 시 차단된다', () => {
  const src = read('accounts/index.js');
  /* ghPutFile 진입부에 isRemoteSafeKey 가드가 있어야 한다 */
  const put = src.slice(src.indexOf('async function ghPutFile'));
  const body = put.slice(0, put.indexOf('\n}'));
  assert.ok(body.includes('isRemoteSafeKey()'), 'ghPutFile 에 키 가드가 없다');
  assert.match(body, /return false/, '차단 시 조용히 실패해야 한다(예외로 서버를 죽이지 않음)');
  /* 가드는 "키가 실제로 설정됐는가"만 본다 */
  const fn = src.slice(src.indexOf('function isRemoteSafeKey'));
  assert.ok(fn.slice(0, 200).includes('SERTZ_BACKUP_KEY'));
});

test('production 에서 키가 없으면 예외로 막는다', () => {
  const src = read('accounts/index.js');
  const fn = src.slice(src.indexOf('function currentKeySecret'));
  const body = fn.slice(0, fn.indexOf('\n}'));
  assert.ok(body.includes('NODE_ENV === "production"'), 'production 가드가 없다');
  assert.match(body, /throw new Error/, 'production 에서 키 없으면 던져야 한다');
});

test('ghdb(운영 경로)도 키 없으면 던진다', () => {
  const src = read('src/lib/ghdb.ts');
  const fn = src.slice(src.indexOf('function currentKeySecret'));
  const body = fn.slice(0, fn.indexOf('\n}'));
  assert.ok(body.includes('NODE_ENV === "production"'));
  assert.match(body, /throw new Error/);
});

test('SZBK1 컨테이너 포맷이 유지된다', () => {
  /* 포맷이 바뀌면 기존 원격 DB 를 못 읽어 같은 사고가 재발한다. */
  const acc = read('accounts/index.js');
  const gh = read('src/lib/ghdb.ts');
  for (const [name, src] of [['accounts/index.js', acc], ['ghdb.ts', gh]]) {
    assert.ok(src.includes('"SZBK1"') || src.includes("'SZBK1'"), `${name}: SZBK1 매직 없음`);
    assert.match(src, /aes-256-gcm/, `${name}: aes-256-gcm 아님`);
    /* 파일 내용은 base64 **텍스트**이고, PUT content 는 그 텍스트를 다시 base64 로 감싼다.
       이중 인코딩을 빠뜨리면 원격 파일이 깨져 역시 복호화 실패로 이어진다(실제로 겪음). */
    assert.match(src, /toString\("base64"\)/, `${name}: base64 인코딩 없음`);
  }
});
