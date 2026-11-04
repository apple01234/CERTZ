import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 정본 명칭 회귀 가드 — docs/handoff/CANON_NAMES.md §12 기준.
 *
 * [왜 필요한가] 옛 서사(아뜰란티스/이그드라실) 제거 작업에서 부분 문자열 치환을 하다
 * '이그니션' → '안내인션' 으로 깨진 표기가 스토리 데이터 6곳에 남았다.
 * 「솔라플래임안내인션소드」처럼 한 단어 안에 다른 단어가 끼어들면 눈으로는 잘 안 보이고,
 * 빌드·타입검사·기존 테스트 어디에서도 걸리지 않는다(문자열이라서).
 * 그래서 "깨진 표기"와 "문서에 없는 창작 고유명"을 명시적으로 검사한다.
 */

const ROOT = path.resolve(import.meta.dirname, '..');
const GAME_FILES = [
  'src/game/data.ts',
  'src/game/howlrstone.ts',
  'src/game/lilacStory.ts',
  'src/game/lilacScenarios.ts',
  'src/game/grandPlanetCanon.ts',
  'src/game/stages.ts',
];

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('손상 표기 — 이그니션이 안내인션으로 깨진 곳이 없다', () => {
  const broken = [];
  for (const f of GAME_FILES) {
    const src = read(f);
    src.split('\n').forEach((line, i) => {
      if (line.includes('안내인션')) broken.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(broken, [], `손상 표기 발견: ${broken.join(', ')}`);
});

test('정본 무기명 — 솔라플래임이그니션소드 표기가 정확하다', () => {
  /* 4.txt:131 정본. 등장하는 곳은 반드시 이 표기여야 한다. */
  const data = read('src/game/data.ts') + read('src/game/howlrstone.ts') + read('src/game/lilacStory.ts');
  assert.ok(data.includes('솔라플래임이그니션소드'), '정본 표기가 사라졌다');
  /* 깨진 변형이 하나라도 있으면 실패 */
  for (const bad of ['솔라플레임이그니션', '솔라플래임안내인션', '솔라플래임이그니션소드소드']) {
    assert.equal(data.includes(bad), false, `깨진 변형: ${bad}`);
  }
});

test('옛 서사 잔재 — 금지 명칭이 코드에 없다', () => {
  /* 아뜰란티스/이그드라실 세계관은 폐기됐다. 스토리 파일에 다시 들어오면 안 된다. */
  const forbidden = ['아뜰란티스', '아틀란티스', '이그드라실', '세계수', '9개의 바다', '아홉 바다', '아홉 개의 바다'];
  const hits = [];
  for (const f of GAME_FILES) {
    const src = read(f);
    for (const word of forbidden) {
      if (src.includes(word)) hits.push(`${f}: ${word}`);
    }
  }
  assert.deepEqual(hits, [], `금지 명칭 발견: ${hits.join(', ')}`);
});

test('주인공 = 플레이어 — 기본 이름이 하루이고 닉네임 변경이 가능하다', () => {
  /* 사용자 지시: "하루 = 플레이어(닉네임 변경 가능)".
   *  1.txt:4 의 주인공 '하루'는 고정 NPC 가 아니라 **플레이어 본인**이다.
   *  따라서 ① 대사 치환 기본값이 하루여야 하고 ② 유저가 바꿀 수 있어야 한다.
   *  [주의] 종전 기본값이 "세르츠"(게임 제목)였는데, 이러면 이름을 정하기 전
   *  모든 대사가 '세르츠'로 치환돼 정본과 어긋난다. */
  const cfg = read('src/game/config.ts');
  const m = /export const DEFAULT_NAME\s*=\s*["']([^"']+)["']/.exec(cfg);
  assert.ok(m, 'DEFAULT_NAME 을 찾지 못했다');
  assert.equal(m[1], '하루', '기본 이름이 하루가 아니다');
  /* 닉네임 변경 경로가 살아 있어야 한다(하드코딩 금지) */
  assert.match(cfg, /export function setPlayerName/);
  assert.match(cfg, /let playerName = DEFAULT_NAME/);
  /* 저장 실패 폴백도 하루여야 한다 — 세르츠가 남아 있으면 그 경로에서만 이름이 튄다 */
  const slots = read('src/game/slots.ts');
  assert.equal(slots.includes('"세르츠"'), false, 'slots.ts 에 세르츠 폴백이 남아 있다');

  /* 스토리 연출의 화자도 하루 */
  const scen = read('src/game/lilacScenarios.ts');
  assert.ok(scen.includes('"하루"'), '연출 스크립트에 하루 화자가 없다');
  for (const bad of ['"카이"', '"리안"', '"시온"']) {
    assert.equal(scen.includes(bad), false, `다른 주인공 이름: ${bad}`);
  }
});

test('캐논 문서가 저장소에 존재한다', () => {
  const p = path.join(ROOT, 'docs/handoff/CANON_NAMES.md');
  assert.ok(fs.existsSync(p), 'CANON_NAMES.md 가 없다');
  const doc = fs.readFileSync(p, 'utf8');
  /* 핵심 항목이 실제로 문서화되어 있는지 */
  for (const must of ['하루', '라일락', '별빛을 담은 펜던트', '리엘', '스노리카']) {
    assert.ok(doc.includes(must), `캐논 문서에 ${must} 누락`);
  }
  /* 19화 이후 결말을 창작하지 않는다는 경계가 명시되어야 한다 */
  assert.match(doc, /19화/);
});
