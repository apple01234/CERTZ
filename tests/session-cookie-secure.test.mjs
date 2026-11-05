import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * 세션 쿠키 Secure 스킴 판정 — vc251 (PC 클라이언트 로그인 불가 수리).
 *
 * [증상] Electron PC 클라이언트에서 로그인이 유지되지 않음.
 * [원인] Electron 은 게임을 `http://127.0.0.1:<port>` 오리진에서 띄우는데
 *   세션 쿠키에 항상 `Secure` 가 붙어 있었다. Chromium 은 Secure 쿠키를
 *   https(또는 localhost 예외)에서만 저장하므로 127.0.0.1 에서는 Set-Cookie 가
 *   조용히 버려지고, 새로고침/재실행마다 세션이 사라진다.
 *
 * [양방향 위험] 한쪽만 고치면 반대쪽이 깨진다:
 *  · http 에서 Secure 를 빼지 않으면 → PC 로그인 계속 불가(고치지 않은 것과 같음)
 *  · https 에서 Secure 를 빼면 → 세션 토큰이 평문 채널로 흐를 수 있음
 *  그래서 두 방향을 모두 고정한다.
 *
 * [구조] 판정·직렬화는 `src/lib/sessionCookie.ts`(순수 모듈)에 있다.
 *  sapi.ts 는 `next/server` 를 import 해 Node 테스트에서 로드할 수 없으므로 분리했다.
 */

const m = await import('../src/lib/sessionCookie.ts');
const { isHttpsRequest, sessionCookieString, clearCookieString, TOKEN_TTL_MS } = m;
const TOKEN = 'b'.repeat(64);

test('https 판정 — 프록시 헤더 우선, 없으면 URL 스킴', () => {
  const h = (v) => (n) => (n === 'x-forwarded-proto' ? v : null);
  assert.equal(isHttpsRequest(h('https'), 'http://x/api'), true);
  assert.equal(isHttpsRequest(h('https,http'), 'http://x/api'), true, '프록시 체인 첫 값');
  assert.equal(isHttpsRequest(h('http'), 'https://x/api'), false);
  assert.equal(isHttpsRequest(h(null), 'http://127.0.0.1:51234/api'), false);
  assert.equal(isHttpsRequest(h(null), 'https://sertz.vercel.app/api'), true);
  /* 판단 불가 → 안전한 쪽(https) */
  assert.equal(isHttpsRequest(() => null, undefined), true);
});

test('Electron(http) 쿠키에는 Secure 가 없다', () => {
  const c = sessionCookieString(TOKEN, false);
  assert.equal(/;\s*Secure/i.test(c), false, `Secure 가 붙었다: ${c}`);
  /* 보안 속성은 유지 */
  assert.match(c, /HttpOnly/);
  assert.match(c, /SameSite=Lax/);
  assert.match(c, /Path=\//);
});

test('운영/APK(https) 쿠키에는 Secure 가 있다', () => {
  for (const label of ['운영', 'APK']) {
    const c = sessionCookieString(TOKEN, true);
    assert.match(c, /;\s*Secure/i, `${label} 에 Secure 가 없다`);
    assert.match(c, /HttpOnly/);
  }
});

test('삭제 쿠키도 같은 Secure 규칙을 따른다', () => {
  /* 규칙이 다르면 http 오리진에서 로그아웃해도 쿠키가 안 지워진다(유령 세션) */
  assert.equal(/;\s*Secure/i.test(clearCookieString(false)), false);
  assert.match(clearCookieString(true), /;\s*Secure/i);
  assert.match(clearCookieString(false), /Max-Age=0/);
});

test('토큰·TTL·이름은 그대로 유지된다', () => {
  const c = sessionCookieString(TOKEN, false);
  assert.ok(c.includes(`sertz_auth=${TOKEN}`));
  assert.ok(c.includes(`Max-Age=${TOKEN_TTL_MS / 1000}`));
  assert.equal(TOKEN_TTL_MS, 14 * 24 * 3600 * 1000);
});

test('sapi.ts 가 순수 모듈을 단일 출처로 쓴다', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const root = path.resolve(import.meta.dirname, '..');
  const src = fs.readFileSync(path.join(root, 'src/lib/sapi.ts'), 'utf8');
  /* 쿠키 문자열을 sapi 안에서 다시 조립하면 두 곳이 갈라진다 */
  assert.ok(src.includes('from "./sessionCookie"'), '순수 모듈을 import 하지 않는다');
  assert.ok(src.includes('sessionCookieString('), 'sessionCookieString 미사용');
  assert.ok(src.includes('clearCookieString('), 'clearCookieString 미사용');
  /* issueToken 이 req 를 받아 스킴을 판정할 수 있어야 한다 */
  assert.match(src, /export function issueToken\([^)]*req\?: NextRequest/, 'issueToken 이 req 를 받지 않는다');
  /* 세션 발급 라우트가 실제로 req 를 넘기는지 — 안 넘기면 판정이 항상 "안전한 쪽"이 되어 PC 로그인이 다시 깨진다 */
  for (const f of ['login', 'register', 'google']) {
    const p = path.join(root, `src/app/api/auth/${f}/route.ts`);
    const route = fs.readFileSync(p, 'utf8');
    assert.match(route, /issueToken\([^)]*,\s*req\s*\)/, `${f} 라우트가 issueToken 에 req 를 넘기지 않는다`);
  }
  /* 로그아웃도 같은 규칙 */
  const logout = fs.readFileSync(path.join(root, 'src/app/api/auth/logout/route.ts'), 'utf8');
  assert.match(logout, /clearCookie\(req\)/, 'logout 이 clearCookie 에 req 를 넘기지 않는다');
});
