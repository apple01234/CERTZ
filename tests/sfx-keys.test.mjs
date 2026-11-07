// node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs --test tests/sfx-keys.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 무음 사운드 재발 방지 — "조용히 실패하는" 키를 CI 에서 잡는다.
 *
 * [왜 이 테스트가 있는가]
 *  `src/game/audio.ts` 의 `sfx.skill()` 은 이렇게 시작한다:
 *      skill(key, rate) { const file = SKILL_SFX_FILES[key]; if (!file) return; ... }
 *  즉 **존재하지 않는 키를 넘기면 아무 소리도 없이 조용히 반환**한다. 예외도, 로그도,
 *  콘솔 경고도 없다. 그래서 없는 키를 써도 개발 중에는 알아채기 어렵고, 유저만
 *  "궁극기 소리가 안 난다"로 발견하게 된다.
 *
 *  실제로 이 저장소에서 다음이 이 상태로 방치돼 있었다(전부 무음):
 *    · ULT_FINALE 29개 중 13개 (cannon/slash/dagger/elemcast/roar)
 *    · useSkill5 · useSkill5b 각 4곳 (water/wave/cannon/explosion) — 세이킹·드레드노트
 *    · Boss.ts 방어막 전개 (shield)
 *  합계 22곳. 유저 요구 "궁극기 5단계 연출 = ①발동: 전용 사운드"를 정면으로 위반했다.
 *
 * [무엇을 고정하는가]
 *  `src` 전체를 스캔해 `sfxSkill("키")` 로 넘기는 모든 인자가 `SKILL_SFX_FILES` 에
 *  존재함을 강제한다. 앞으로 누가 오타를 내거나 새 사운드를 쓰려다 키를 잘못 적으면
 *  이 테스트가 즉시 실패한다. 소리 자체(음질/적절성)는 검증하지 않는다 — 사람의 청취 영역이다.
 */

const ROOT = path.resolve(import.meta.dirname, '..');

/** audio.ts 의 skill() 이 실제로 해석하는 키 집합 — 이 파일이 유일한 진실 원천 */
function skillSfxKeys() {
  const src = fs.readFileSync(path.join(ROOT, 'src/game/audio.ts'), 'utf8');
  const start = src.indexOf('const SKILL_SFX_FILES');
  assert.ok(start > 0, 'audio.ts 에서 SKILL_SFX_FILES 를 찾지 못했다');
  const end = src.indexOf('\n};', start);
  assert.ok(end > start, 'SKILL_SFX_FILES 블록의 끝을 찾지 못했다');
  const body = src.slice(start, end);
  return new Set([...body.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]));
}

/** src 아래 모든 .ts/.tsx 파일 */
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const VALID = skillSfxKeys();

/** `sfxSkill("...")` 호출을 파일:줄 과 함께 전부 모은다 */
function collectCalls() {
  const calls = [];
  for (const abs of walk(path.join(ROOT, 'src'))) {
    const src = fs.readFileSync(abs, 'utf8');
    if (!src.includes('sfxSkill(')) continue;
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    src.split('\n').forEach((line, i) => {
      /* 주석 줄은 제외 — 과거 사유에 잘못된 키가 적혀 있을 수 있다 */
      const t = line.trim();
      if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')) return;
      for (const m of line.matchAll(/sfxSkill\(\s*"(\w+)"/g)) {
        calls.push({ file: rel, line: i + 1, key: m[1] });
      }
    });
  }
  return calls;
}

const CALLS = collectCalls();

test('SKILL_SFX_FILES 를 읽었다(전제 확인)', () => {
  assert.ok(VALID.size >= 30, `스킬음 키가 ${VALID.size}개뿐이다 — 파싱 실패 의심`);
});

test('src 전체의 sfxSkill("...") 인자가 전부 실재하는 키다 (무음 0건)', () => {
  assert.ok(CALLS.length > 0, 'sfxSkill 호출을 하나도 찾지 못했다 — 파서 확인 필요');

  const silent = CALLS.filter((c) => !VALID.has(c.key));
  const list = silent.map((c) => `${c.file}:${c.line}  "${c.key}"`).join('\n  ');

  assert.deepEqual(
    silent.map((c) => `${c.file}:${c.line}:${c.key}`), [],
    `존재하지 않는 효과음 키가 ${silent.length}건 있다.\n` +
    `audio.sfx.skill() 은 없는 키를 **조용히 무음 처리**하므로 이 소리는 실제로 나지 않는다.\n` +
    `SKILL_SFX_FILES 에 있는 키로 바꾸거나, audio.ts 에 키를 추가할 것.\n  ${list}`,
  );

  const files = new Set(CALLS.map((c) => c.file)).size;
  console.log(
    `sfxSkill 전수 스캔: ${CALLS.length} 호출 / ${new Set(CALLS.map((c) => c.key)).size}종 키 / ` +
    `${files}개 파일 — 무음 ${silent.length}건`,
  );
});

test('고유 키 전수 대조 — 하나도 빠짐없이 SKILL_SFX_FILES 안에 있다', () => {
  const used = new Set(CALLS.map((c) => c.key));
  const bad = [...used].filter((k) => !VALID.has(k)).sort();
  assert.deepEqual(bad, [], `없는 키: ${bad.join(', ')}`);
  console.log(`고유 키 ${used.size}종 / 유효 ${VALID.size}종 — 전부 확인`);
});

/* 미래에 audio.sfx.skill("...") 를 직접 부르는 경로가 생기면 같은 버그가 재발한다.
 * 지금은 sfxSkill(scene 경유) 하나뿐이라 그 경로도 함께 잠근다. */
test('audio.sfx.skill() 직접 호출도 없는 키를 쓰지 않는다', () => {
  const bad = [];
  for (const abs of walk(path.join(ROOT, 'src'))) {
    const src = fs.readFileSync(abs, 'utf8');
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    src.split('\n').forEach((line, i) => {
      const t = line.trim();
      if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')) return;
      for (const m of line.matchAll(/sfx\.skill\(\s*"(\w+)"/g)) {
        if (!VALID.has(m[1])) bad.push(`${rel}:${i + 1} "${m[1]}"`);
      }
    });
  }
  assert.deepEqual(bad, [], `sfx.skill 직접 호출에 없는 키: ${bad.join(', ')}`);
});
