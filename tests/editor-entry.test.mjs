import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 제작 도구 진입점 (vc263).
 *
 * [사고]
 *  `/editor`(맵 에디터)·`/skill-editor`(스킬 메이커)는 vc257·vc259 에서 완성돼
 *  HTTP 200 으로 **계속 살아 있었다.** 그런데 게임 안에 링크가 하나도 없어서
 *  URL 을 직접 입력하지 않는 한 닿을 수 없었고, 사용자는 "어디감?" 이라고 물었다.
 *  라우트 존재만 검사하던 종전 검증은 이 결함을 **통과시켰다.**
 *
 *  → 라우트가 있는지가 아니라 **게임 화면에서 닿을 수 있는지**를 고정한다.
 *
 * [주의]
 *  이 테스트는 소스 구조를 본다. 브라우저 실측은 `scripts/verify-lobby-tools.mjs`.
 *  둘 다 있어야 한다 — 소스만 보면 "렌더가 안 되는" 경우를 놓치고,
 *  브라우저만 보면 조건 분기(admin 전용)가 사라져도 통과할 수 있다.
 */

const ROOT = path.resolve(import.meta.dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('에디터 라우트 2종이 실제로 존재한다', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'src/app/editor/page.tsx')), '/editor 라우트 없음');
  assert.ok(fs.existsSync(path.join(ROOT, 'src/app/skill-editor/page.tsx')), '/skill-editor 라우트 없음');

  const map = read('src/app/editor/page.tsx');
  const skill = read('src/app/skill-editor/page.tsx');
  assert.ok(map.includes('TilemapEditor'), '/editor 가 TilemapEditor 를 렌더하지 않는다');
  assert.ok(skill.includes('SkillEditor'), '/skill-editor 가 SkillEditor 를 렌더하지 않는다');
});

test('로그인 패널(AuthPanel)에 두 에디터 링크가 있다 — 실제 진입점', () => {
  const src = read('src/components/game/AuthPanel.tsx');
  assert.ok(src.includes('href="/editor"'), 'AuthPanel 에 /editor 링크 없음');
  assert.ok(src.includes('href="/skill-editor"'), 'AuthPanel 에 /skill-editor 링크 없음');
});

test('에디터 링크는 admin 에게만 노출된다', () => {
  const src = read('src/components/game/AuthPanel.tsx');
  const i = src.indexOf('href="/editor"');
  assert.ok(i > 0, '/editor 링크를 찾을 수 없음');

  /* 링크를 감싸는 가장 가까운 role 검사가 admin 인지 — 앞쪽 3000자 안에서 확인 */
  const before = src.slice(Math.max(0, i - 3000), i);
  assert.ok(
    /user\.role\s*===\s*["']admin["']/.test(before),
    '에디터 링크가 admin 조건 밖에 있다 — 일반 플레이어에게도 노출된다'
  );
});

test('로비(Lobby)에도 진입점이 있다 — 타이틀 말고 로비에서도 닿아야 한다', () => {
  const src = read('src/components/game/Lobby.tsx');
  assert.ok(src.includes('href="/editor"'), 'Lobby 에 /editor 링크 없음');
  assert.ok(src.includes('href="/skill-editor"'), 'Lobby 에 /skill-editor 링크 없음');
  const i = src.indexOf('href="/editor"');
  const before = src.slice(Math.max(0, i - 2000), i);
  assert.ok(/gmOk|role\s*===\s*["']admin["']/.test(before), '로비 진입점이 admin 조건 밖에 있다');
});

test('에디터 페이지는 게임과 분리돼 있다 (Phaser 미사용, 정적 서빙 무해)', () => {
  for (const p of ['src/app/editor/page.tsx', 'src/app/skill-editor/page.tsx']) {
    const src = read(p);
    assert.ok(!/from\s+["']phaser["']/.test(src), `${p} 가 Phaser 를 import 한다`);
    assert.ok(!/GameRoot/.test(src), `${p} 가 게임 루트를 마운트한다`);
  }
});

test('토큰 저장 키가 일관된다 — 브라우저 검증이 엉뚱한 키를 쓰지 않도록', () => {
  const src = read('src/game/account.ts');
  const m = src.match(/TOKEN_KEY\s*=\s*["']([^"']+)["']/);
  assert.ok(m, 'TOKEN_KEY 정의를 찾을 수 없음');
  assert.equal(m[1], 'sertz.auth.token', '토큰 키가 바뀌었다 — verify-lobby-tools.mjs 도 함께 고쳐야 한다');

  /* 검증 스크립트가 같은 키를 쓰는지 */
  const vs = read('scripts/verify-lobby-tools.mjs');
  assert.ok(vs.includes("sertz.auth.token"), '검증 스크립트가 실제 토큰 키를 쓰지 않는다');
});
