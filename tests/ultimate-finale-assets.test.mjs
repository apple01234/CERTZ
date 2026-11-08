/**
 * ultimate-finale-assets.test.mjs — vc281 P6: 궁극기 마무리 연출의 "조용한 실패" 전수 차단
 *
 * [왜 필요한가] 지시서 §4-2 "조용히 실패하는 코드":
 *   - `audio.sfx.skill()` 은 없는 키를 **무음 처리**한다 → 궁극기 22개가 소리 없이 나갔다.
 *   - `textures.exists(tex)` 가드가 있으면 키 오타도 **조용히 그려지지 않는다**.
 *   기존 tests/ultimate-finale.test.mjs 는 `textures.exists: () => true` 로 목킹해
 *   "그린다"만 검증하고 **실제 에셋에 그 키가 있는지는 못 잡는다**.
 *   → 이 파일이 그 구멍을 메운다.
 *
 * [검증 방식] 엔진(Phaser) 없이 데이터만 본다:
 *   · ULT_FINALE 각 항목의 tex/tex2 → editorAssetManifest.ts 의 name 집합
 *   · sfx → audio.ts 의 SFX_VOLUMES 키 집합
 *   · shape → 실제 switch 에 구현된 7종
 *   소스를 vm 으로 돌리지 않고 정규식으로 항목을 파싱한다(Phaser 의존성 회피).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/game/fx/ultFinale.ts', import.meta.url), 'utf8');
const manifest = readFileSync(new URL('../src/game/editorAssetManifest.ts', import.meta.url), 'utf8');
const audio = readFileSync(new URL('../src/game/audio.ts', import.meta.url), 'utf8');

/** ULT_FINALE 항목을 정규식으로 파싱 — Phaser import 없이 데이터만 얻는다. */
function parseFinales() {
  const start = src.indexOf('export const ULT_FINALE');
  assert.ok(start >= 0, 'ULT_FINALE 정의를 찾지 못했다');
  const body = src.slice(start, src.indexOf('\nexport function finaleFallback'));
  /* 각 항목은 `  jobkey: {` 로 시작하고 `shape:` 를 포함한다.
   *  블록 경계를 중괄호로 세지 않고 **다음 `  jobkey: {` 앞까지**로 자른다 —
   *  정규식 중첩 매칭보다 단순하고, 주석 유무에 영향받지 않는다. */
  const starts = [...body.matchAll(/^ {2}(\w+):\s*\{/gm)];
  const out = [];
  for (let i = 0; i < starts.length; i++) {
    const job = starts[i][1];
    const from = starts[i].index ?? 0;
    const to = i + 1 < starts.length ? (starts[i + 1].index ?? body.length) : body.length;
    const block = body.slice(from, to);
    const shape = /shape:\s*"(\w+)"/.exec(block)?.[1];
    const tex = /tex:\s*"([\w]+)"/.exec(block)?.[1];
    const tex2 = /tex2:\s*"([\w]+)"/.exec(block)?.[1];
    const sfx = /sfx:\s*"([\w]+)"/.exec(block)?.[1];
    if (shape && tex && sfx) out.push({ job, shape, tex, tex2, sfx });
  }
  return out;
}

/** 에셋 매니페스트의 name 집합. */
function manifestNames() {
  const names = new Set();
  for (const m of manifest.matchAll(/name:\s*"([^"]+)"/g)) names.add(m[1]);
  return names;
}

/** 스킬 효과음 키 집합 — 오디오가 실제로 아는 키만.
 *
 *  두 표를 **모두** 봐야 한다:
 *   · SKILL_SFX_VOLUMES — 스킬 효과음(궁극기 sfx 가 여기 있다)
 *   · SFX_VOLUMES        — 기본 효과음(sfx_hit 등)
 *  한쪽만 보면 멀쩡한 키를 "없다"고 오판한다(실제로 그렇게 오판했다). */
function sfxKeys() {
  const keys = new Set();
  for (const name of ['SKILL_SFX_VOLUMES', 'SFX_VOLUMES']) {
    const start = audio.indexOf(`const ${name}`);
    assert.ok(start >= 0, `${name} 를 찾지 못했다`);
    /* 블록 끝은 `\n};` 로 찾는다 — '};' 는 값 안의 중괄호를 먼저 잡을 수 있다. */
    const end = audio.indexOf('\n};', start);
    assert.ok(end > start, `${name} 블록 끝을 찾지 못했다`);
    for (const m of audio.slice(start, end).matchAll(/([\w]+):\s*[\d.]+,/g)) keys.add(m[1]);
  }
  return keys;
}

const finales = parseFinales();

test('ULT_FINALE 파싱이 실제 항목 수를 얻는다', () => {
  /* 파싱이 조용히 0건이 되면 아래 테스트가 전부 무의미해진다 — 먼저 이것부터. */
  assert.ok(finales.length >= 30, `파싱된 궁극기 ${finales.length}개 — 파서가 깨졌다`);
});

test('모든 궁극기의 tex 가 에셋 매니페스트에 존재한다', () => {
  const names = manifestNames();
  const missing = finales.filter((f) => !names.has(f.tex));
  assert.deepEqual(
    missing.map((f) => `${f.job}:tex=${f.tex}`), [],
    `에셋에 없는 텍스처 — textures.exists 가드 때문에 조용히 안 그려진다:\n  ${missing.map((f) => `${f.job} → ${f.tex}`).join('\n  ')}`,
  );
});

test('모든 궁극기의 tex2 가 에셋 매니페스트에 존재한다', () => {
  const names = manifestNames();
  const missing = finales.filter((f) => f.tex2 && !names.has(f.tex2));
  assert.deepEqual(
    missing.map((f) => `${f.job}:tex2=${f.tex2}`), [],
    `에셋에 없는 보조 텍스처:\n  ${missing.map((f) => `${f.job} → ${f.tex2}`).join('\n  ')}`,
  );
});

test('모든 궁극기의 sfx 가 오디오 키 집합에 존재한다', () => {
  /* audio.sfx.skill() 은 없는 키를 무음 처리한다 — 이게 vc274 에서 22건이 나갔다. */
  const keys = sfxKeys();
  assert.ok(keys.size > 20, `SFX 키 ${keys.size}개 — 파서가 깨졌다`);
  const missing = finales.filter((f) => !keys.has(f.sfx));
  assert.deepEqual(
    missing.map((f) => `${f.job}:sfx=${f.sfx}`), [],
    `SFX_VOLUMES 에 없는 효과음 — 무음으로 나간다:\n  ${missing.map((f) => `${f.job} → ${f.sfx}`).join('\n  ')}`,
  );
});

test('모든 shape 이 switch 에 실제 구현돼 있다', () => {
  /* FinaleShape 에 타입만 추가하고 case 를 안 쓰면 default 로 흘러 연출이 빈다. */
  const shapes = new Set(finales.map((f) => f.shape));
  const cases = new Set([...src.matchAll(/case "(\w+)":/g)].map((m) => m[1]));
  const missing = [...shapes].filter((s) => !cases.has(s));
  assert.deepEqual(missing, [], `switch 에 case 가 없는 shape: ${missing.join(', ')}`);
  /* 7종 전부 실제로 쓰이는지 (죽은 shape 이 있으면 연출 다양성이 줄어든 것) */
  assert.equal(shapes.size, 7, `사용된 shape 종류 ${shapes.size} — 7종이어야 한다`);
});

test('궁극기 연출이 (shape, tex, sfx) 조합에서 서로 구별된다', () => {
  /* 지시서 P6: "35개가 데이터상 구별되지만..." — 최소한 시각/청각 조합은 겹치면 안 된다.
   *  완전히 같은 조합이면 같은 연출을 두 번 쓰는 것이다. */
  const seen = new Map();
  const dupes = [];
  for (const f of finales) {
    const key = `${f.shape}|${f.tex}|${f.sfx}`;
    if (seen.has(key)) dupes.push(`${seen.get(key)} ↔ ${f.job} (${key})`);
    else seen.set(key, f.job);
  }
  assert.deepEqual(dupes, [], `완전히 동일한 연출 조합:\n  ${dupes.join('\n  ')}`);
});

test('reach 와 shake 가 유효 범위 안에 있다', () => {
  /* reach 0 이면 판정이 없고, shake 강도 0.05 초과는 화면이 못 읽는다. */
  const start = src.indexOf('export const ULT_FINALE');
  const body = src.slice(start, src.indexOf('\nexport function finaleFallback'));
  const reaches = [...body.matchAll(/reach:\s*(\d+)/g)].map((m) => Number(m[1]));
  assert.ok(reaches.length >= 30, `reach 파싱 ${reaches.length}건`);
  for (const r of reaches) {
    assert.ok(r >= 200 && r <= 700, `reach ${r} 가 200~700 범위를 벗어난다`);
  }
  const shakes = [...body.matchAll(/shake:\s*\[(\d+),\s*([\d.]+)\]/g)].map((m) => [Number(m[1]), Number(m[2])]);
  assert.ok(shakes.length >= 30, `shake 파싱 ${shakes.length}건`);
  for (const [ms, mag] of shakes) {
    assert.ok(ms >= 60 && ms <= 600, `shake 시간 ${ms}ms 가 60~600 범위 밖`);
    assert.ok(mag > 0 && mag <= 0.05, `shake 강도 ${mag} 가 (0, 0.05] 범위 밖`);
  }
});
