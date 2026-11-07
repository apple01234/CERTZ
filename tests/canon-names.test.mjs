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

/**
 * 소스에서 **주석을 걷어낸** 플레이어 노출 텍스트만 남긴다 (줄 번호 보존).
 *
 * 왜 정규식 한 줄로는 안 되나
 *   `const x = 1; // 메이플식` 처럼 **줄 끝 주석**이 붙은 코드는
 *   "주석 행" 필터에 걸리지 않아 실제로는 노출되지 않는 이름을 잡아낸다(오탐).
 *   반대로 `name: "발키리"` 같은 **문자열 리터럴**은 절대 지워선 안 된다(미탐).
 *   그래서 문자열 리터럴 상태를 추적하며 블록 주석과 줄 주석을 실제로 제거한다.
 */
const stripComments = (src) => {
  let out = '';
  let i = 0;
  let quote = null; // 현재 열린 문자열 리터럴 (" ' `)
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') { out += n ?? ''; i += 2; continue; }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; out += c; i++; continue; }
    if (c === '/' && n === '*') {
      const end = src.indexOf('*/', i + 2);
      const body = src.slice(i, end === -1 ? src.length : end + 2);
      out += body.replace(/[^\n]/g, ' '); // 줄 수 보존
      i = end === -1 ? src.length : end + 2;
      continue;
    }
    if (c === '/' && n === '/') {
      const end = src.indexOf('\n', i);
      i = end === -1 ? src.length : end;
      continue;
    }
    out += c;
    i++;
  }
  return out;
};

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** src/ 전체 .ts/.tsx 목록 (상대 경로, 정렬). 금지 고유명 전수 조사용. */
const ALL_SRC_FILES = (() => {
  const out = [];
  const walk = (abs) => {
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const p = path.join(abs, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(e.name)) out.push(path.relative(ROOT, p).replace(/\\/g, '/'));
    }
  };
  walk(path.join(ROOT, 'src'));
  return out.sort();
})();

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

/* ═══════════════════════════════════════════════════════════════════════════
 * vc267 (P7a 정본 감사) — 실존 인물명 · 타 작품 고유명 · 옛 신화 잔재 차단
 *
 * [왜 필요한가] 정본(1~8.txt)에 없는 고유명이 코드에 남아 있으면
 * ⓐ 타 작품/실존 인물의 것이 그대로 노출되고 ⓑ 세계관이 두 개로 갈라진다.
 * 문자열이라 tsc·eslint·기존 테스트 어디에서도 걸리지 않으므로 여기서 강제한다.
 *
 * [주의 — 부분 문자열 오탐] '아서'는 '여유분을'·'살아남은'에, '원피스'는 '스커트 원피스'에
 * 걸린다. 그래서 금지어는 **문자열 리터럴 안에서만**, 그것도 **단어 경계가 명확한 것만** 쓴다.
 * ═══════════════════════════════════════════════════════════════════════════ */

/** 주석을 걷어낸 뒤 남은 "실제 코드/문자열" 줄만 돌려준다. */
const playerFacingLines = (rel) =>
  stripComments(read(rel))
    .split('\n')
    .map((line, i) => ({ line, no: i + 1 }))
    .filter(({ line }) => line.trim() !== '');

/** 금지: 실존 인물 · 타 작품 고유명 · 정본에 없는 옛 신화 고유명. */
const FORBIDDEN_PROPER_NOUNS = [
  /* 타 작품 (게임) — 시스템 명칭까지 포함 */
  '메이플스토리', '메이플 스타포스', '스타포스식', 'MapleStory',
  '나루토', '드래곤볼', '포켓몬', '젤다', '마리오', '소닉',
  '스타워즈', '해리포터', '반지의 제왕', '원신', '붕괴3', '명일방주',
  /* 정본에 없는 옛 신화 고유명 — 세계수/운명의 여신/전사들의 전당 */
  '위그드라실', '이그드라실', '노른', '발홀', '아스가르드', '미드가르드',
  '요르문간드', '라그나로크', '발할라', '시구르드',
  /* 실존 창작자·브랜드 */
  'DeepSeek', 'ChatGPT', 'OpenAI', '넷플릭스',
  /* 옛 서사 잔재 */
  '아뜰란티스', '아틀란티스',
];

test('금지 고유명 — 플레이어 노출 문자열에 타작품/실존/옛신화 이름이 없다', () => {
  const hits = [];
  /* src 전체를 본다 — data.ts 만 보면 UnionPanel/Panels 같은 UI 에서 새는 것을 놓친다. */
  for (const f of ALL_SRC_FILES) {
    for (const { line, no } of playerFacingLines(f)) {
      for (const word of FORBIDDEN_PROPER_NOUNS) {
        if (line.includes(word)) hits.push(`${f}:${no} [${word}] ${line.trim().slice(0, 90)}`);
      }
    }
  }
  assert.deepEqual(hits, [], `금지 고유명 발견:\n${hits.join('\n')}`);
});

test('정본 가문 등록부 — 25가문이 3개 세계에 모두 존재한다', () => {
  const canon = path.join(ROOT, 'src/game/grandPlanetCanon.ts');
  assert.ok(fs.existsSync(canon), 'grandPlanetCanon.ts 가 없다');
  const src = fs.readFileSync(canon, 'utf8');
  assert.match(src, /export const CANON_FAMILIES/, 'CANON_FAMILIES 등록부가 없다');

  /* 7.txt 의 25가문 — 하나라도 빠지면 실패 (실측: 종전 14가문 누락) */
  const REQUIRED = [
    '에델리오나', '에스테반', '크렌렐브', '이덴미르', '에크레디트',
    '그래스트', '데스티니', '페이트', '카르리온', '아리아노',
    '플래임', '오르페우스', '셀리나', '이그니션', '질리언',
    '리버스', '페르티에스',
    '에버포스', '샌티널', '카르테르', '클로체스', '라바이즈', '유월', '하나사키',
  ];
  const missing = REQUIRED.filter((n) => !src.includes(n));
  assert.deepEqual(missing, [], `정본 가문 누락: ${missing.join(', ')}`);

  /* 세 세계가 모두 등록돼야 한다 — 제로세계가 통째로 빠졌던 회귀 방지 */
  for (const w of ['lilac', 'grand', 'zero']) {
    assert.match(src, new RegExp(`world: "${w}"`), `${w} 세계 가문이 없다`);
  }
});

test('정본 가문 등록부 — 원소는 기존 ElemKey 부분집합만 쓴다', () => {
  /* 새 원소를 발명하지 않았는지. 7.txt 의 '아트'·'조종'·'저울과 체스'·'반전'은
   * ElemKey 에 없으므로 element:"none" + power 표기로 남긴다. */
  const ALLOWED = new Set(['fire', 'water', 'wind', 'electric', 'earth', 'nature', 'ice', 'light', 'dark', 'none']);
  const src = fs.readFileSync(path.join(ROOT, 'src/game/grandPlanetCanon.ts'), 'utf8');
  const bad = [];
  for (const m of src.matchAll(/element: "([^"]+)"/g)) {
    if (!ALLOWED.has(m[1])) bad.push(m[1]);
  }
  assert.deepEqual(bad, [], `ElemKey 에 없는 원소: ${bad.join(', ')}`);
});

