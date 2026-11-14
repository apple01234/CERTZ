// 2026-11-14 — 유저 신고 "겹치는 음악 많은 버그" 회귀 고정.
// ① 챕터(DLC 10 + 영프 15)의 필드곡은 다른 챕터와 겹치지 않는다(재림 r1~r15 는 남는 곡이 없어 예외).
// ② 내용이 같은 음원 파일(이름만 다름) 두 개가 동시에 배정되지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const { STAGES } = await import('../src/game/data.ts');
const { stageTrack } = await import('../src/game/audio.ts');
const { HOWLRSTONE_CHAPTERS } = await import('../src/game/howlrstone.ts');

const chapterOf = (k) => /^(dlc[a-z]+)[1-9]$/.exec(k)?.[1]
  ?? (() => { const m = /^(howlrstone\d+)x(\d+)$/.exec(k); const c = m && HOWLRSTONE_CHAPTERS.find(h => h.key === m[1]); return c && Number(m[2]) < c.stages ? c.key : null; })();

test('챕터 필드곡은 다른 챕터와 겹치지 않는다', () => {
  const owner = new Map();
  for (const k of Object.keys(STAGES)) {
    const ch = chapterOf(k); if (!ch) continue;
    const t = stageTrack(k);
    assert.ok(!owner.has(t) || owner.get(t) === ch, `${t}: ${owner.get(t)} 와 ${ch} 가 같은 필드곡`);
    owner.set(t, ch);
  }
  assert.ok(owner.size >= 25);
});

test('내용이 같은 음원 두 개를 동시에 쓰지 않는다', () => {
  const used = new Set(Object.keys(STAGES).map(stageTrack));
  const byHash = new Map();
  for (const t of used) {
    const h = createHash('md5').update(readFileSync(`public/assets/audio/${t}.ogg`)).digest('hex');
    assert.ok(!byHash.has(h), `${t} 와 ${byHash.get(h)} 는 같은 파일`);
    byHash.set(h, t);
  }
});
