import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pythonBin, pythonEnv } from './python.mjs';

/**
 * 초상화 파이프라인 — 정본 근거 + 파일 규격 (vc260).
 *
 * [사용자 지적 2건]
 *  ① "NPC들이 너무 서양 그림체임 (일본 애니 그림체(동양풍) ㄱㄱ)"
 *  ② "1~8 항목에 없는것들 지어내지마"
 *
 * [실제로 있었던 오류]
 *  · 초상화 명세에 **문서에 없는 인물(kayen)** 을 넣었다.
 *  · **아리스텔라를 아리와 별개 인물로** 만들어 이중 생성했다(정본은 동일인
 *    '아리스텔라 데스티니(아리)').
 *  · 아리=화염창 / 리안=은발 왕자 대검 / 아덴=안경 총리 / 제이드=도적 쌍단검 등
 *    정본과 다른 무기·직업으로 생성했다.
 *  · 배경 제거를 색 거리로 3번 시도하다 실패 → **마젠타 크로마키**로 전환.
 *
 * 이 테스트는 그 재발을 막는다.
 */

const ROOT = path.resolve(import.meta.dirname, '..');
const DOCS = path.join(ROOT, 'docs/handoff/evernote-approved');
const SPECS = path.join(ROOT, 'scripts/portrait_specs.json');
const PORTRAITS = path.join(ROOT, 'public/assets/npcportrait');
const MAP = path.join(PORTRAITS, '_map.json');

const specs = JSON.parse(fs.readFileSync(SPECS, 'utf8'));
const map = JSON.parse(fs.readFileSync(MAP, 'utf8'));

/** 정본 8문서 전체 텍스트 */
function corpus() {
  let s = '';
  for (let i = 1; i <= 8; i++) {
    try { s += fs.readFileSync(path.join(DOCS, `${i}.txt`), 'utf8'); } catch { /* 없음 */ }
  }
  return s;
}

test('명세의 모든 인물이 정본 8문서에 등장한다 (지어내기 금지)', () => {
  const text = corpus();
  assert.ok(text.length > 100000, '정본 문서를 읽지 못했다');

  const missing = [];
  for (const c of specs.characters) {
    /* 이름 전체 또는 대표 이름(괄호 앞)으로 확인 */
    const base = String(c.name).split(/[(\s]/)[0];
    const aliases = [c.name, base, ...(c.mapped_as ?? [])].filter(Boolean);
    const found = aliases.some((a) => text.includes(a));
    if (!found) missing.push(`${c.key}(${c.name})`);
  }
  assert.deepEqual(missing, [], `정본에 없는 인물: ${missing.join(', ')}`);
  console.log(`  인물 ${specs.characters.length}명 전부 정본에 존재`);
});

test('문서에 없던 인물(kayen)과 중복 인물(aristella)이 제거됐다', () => {
  const keys = specs.characters.map((c) => c.key);
  /* kayen 은 8문서 어디에도 없다 — 있었으면 지어낸 것 */
  assert.equal(corpus().includes('카이엔'), false, '카이엔이 정본에 있는데 제거했다면 재검토');
  assert.equal(keys.includes('kayen'), false, '문서에 없는 kayen 이 남아 있다');

  /* aristella 는 아리와 동일인 — 별개 항목으로 두면 같은 인물을 두 번 만든다 */
  assert.equal(keys.includes('aristella'), false, '아리스텔라가 별개 인물로 남아 있다');
  const ari = specs.characters.find((c) => c.key === 'ari');
  assert.ok(ari.mapped_as.includes('아리스텔라'), '아리의 별칭에 아리스텔라가 있어야 한다');
});

test('핵심 인물의 무기·원소가 정본과 일치한다', () => {
  const by = Object.fromEntries(specs.characters.map((c) => [c.key, c]));
  const check = (key, mustHave, label) => {
    const blob = `${by[key].prompt} ${by[key].canon}`.toLowerCase();
    for (const w of mustHave) {
      assert.ok(blob.includes(w.toLowerCase()), `${label}: '${w}' 누락 — ${blob.slice(0, 120)}`);
    }
  };
  /* 4.txt 근거 */
  check('ari', ['솔라플래임이그니션소드', '태양'], '아리=태양검');
  check('rian', ['차크람', '바람'], '리안=차크람+바람');
  check('aden', ['스태프', '눈'], '아덴=눈 스태프');
  check('cartel', ['삼지창', '물'], '카르텔=삼지창+물');
  check('feron', ['다크엑스칼리버', '암흑'], '페르온=다크엑스칼리버');
  check('lucy', ['지팡이', '생명'], '루시=나무 지팡이+생명');
  check('scarlet', ['빛과 어둠'], '스칼렛=빛과 어둠');
  check('haru', ['카타나', '복사'], '하루=카타나+복사');
  /* 이전 오류가 되살아나지 않았는지 */
  assert.equal(/화염창|spear/.test(by.ari.prompt), false, '아리가 다시 창을 들었다(정본은 태양검)');
  assert.equal(/greatsword/.test(by.rian.prompt), false, '리안이 다시 대검을 들었다(정본은 차크람)');
});

test('18명 초상화가 84×84 · 투명 배경 · 마젠타 잔여 0', () => {
  const code = `
import json, os
from PIL import Image
specs=json.load(open('scripts/portrait_specs.json',encoding='utf-8'))['characters']
rows=[]
for c in specs:
    p=f"public/assets/npcportrait/npc_{c['key']}.png"
    im=Image.open(p).convert('RGBA'); w,h=im.size
    a=im.split()[3]
    op=sum(1 for v in a.get_flattened_data() if v>0)/(w*h)
    px=im.load()
    corners=[px[x,y][3] for x,y in [(0,0),(w-1,0),(0,h-1),(w-1,h-1)]]
    mag=sum(1 for y in range(h) for x in range(w)
            if px[x,y][3]>0 and px[x,y][0]>150 and px[x,y][2]>150 and px[x,y][1]<110)
    rows.append([c['key'],w,h,round(op,3),max(corners),mag])
print(json.dumps(rows))
`;
  const out = JSON.parse(execFileSync(pythonBin(), ['-c', code], { cwd: ROOT, encoding: 'utf8', env: pythonEnv }).trim());
  assert.equal(out.length, specs.characters.length, `검사 ${out.length}개 ≠ 명세 ${specs.characters.length}개`);

  const bad = [];
  for (const [key, w, h, op, cornerAlpha, mag] of out) {
    if (w !== 84 || h !== 84) bad.push(`${key}: ${w}×${h}`);
    else if (!(op > 0.20 && op < 0.95)) bad.push(`${key}: 불투명 ${op}`);
    else if (cornerAlpha !== 0) bad.push(`${key}: 모서리 알파 ${cornerAlpha} — 배경 미제거`);
    else if (mag !== 0) bad.push(`${key}: 마젠타 잔여 ${mag}px`);
  }
  assert.deepEqual(bad, [], bad.join(' | '));
  console.log(`  18명 규격·투명도·마젠타 전부 통과`);
});

test('_map.json 이 정본 인물 별칭을 모두 등록했다', () => {
  const missing = [];
  for (const c of specs.characters) {
    for (const alias of c.mapped_as ?? []) {
      const e = map[alias];
      if (!e?.src) { missing.push(alias); continue; }
      if (!String(e.src).includes('/npc_')) missing.push(`${alias}(경로)`);
    }
  }
  assert.deepEqual(missing, [], `매핑 누락: ${missing.join(', ')}`);
});

test('대화창이 생성 초상화를 하드코딩 표보다 우선한다', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/components/game/DialogueBox.tsx'), 'utf8');
  /* portraitOf 안에서 portraitCrops(=_map.json) 조회가 NPC_PORTRAITS 보다 앞이어야 한다 */
  const fn = src.slice(src.indexOf('function portraitOf'), src.indexOf('/** 현재 월드의'));
  const genIdx = fn.indexOf('portraitCrops[speaker]');
  const tableIdx = fn.indexOf('NPC_PORTRAITS[speaker]');
  assert.ok(genIdx > 0, 'portraitOf 가 _map.json 을 조회하지 않는다');
  assert.ok(tableIdx > 0, 'NPC_PORTRAITS 폴백이 사라졌다');
  assert.ok(genIdx < tableIdx, '하드코딩 표가 생성 초상화보다 우선한다 — 서양풍 spum 이 이긴다');
});

test('크로마키 제거가 HSV 기반이다 (RGB 임계값 회귀 방지)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'scripts/chroma_key.py'), 'utf8');
  /* 실측: 모델이 순수 #FF00FF 를 안 주고 (187,37,88) 같은 연한 마젠타를 줬다.
   *  RGB 임계값(b>150)으로는 못 잡아 6명 배경이 남았다. */
  assert.ok(src.includes('colorsys'), 'HSV 판정이 없다');
  assert.ok(/290\s*<=\s*hd\s*<=\s*350/.test(src), '색상 범위 판정이 없다');
  assert.ok(!/return r > 150 and b > 150/.test(src), 'RGB 임계값 판정이 되살아났다');
});
