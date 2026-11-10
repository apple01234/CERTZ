/**
 * 정본 보스 설계 계약 — 스토리 기획서 근거가 실제 코드에 붙어 있는가.
 *
 * [왜 필요한가]
 *  유저 요구 원문: "모든 주요 보스는 단순 체력 많은 몬스터가 되어서는 안 된다."
 *  vc288 이전에는 페이즈 전환 배너가 "2 페이즈!" / "최후의 힘을 해방한다!" 뿐이라
 *  유저는 **무엇으로 변했는지** 알 수 없었다. 형태 이름을 정본에서 가져와 붙였다.
 *
 *  이 테스트는 "정본 인용이 살아 있는가"를 기계적으로 확인한다:
 *   · 각 보스의 페이즈에 canon(파일:줄) 근거가 있는가
 *   · 인용한 파일이 실제로 존재하는가
 *   · HP 임계값이 내림차순인가(페이즈가 건너뛰지 않는가)
 *   · BossDef.key 와 정본 키가 일치하는가 (이름만 같고 키가 다르면 배너가 안 뜬다)
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import {
  CANON_BOSS_DESIGN,
  canonBossOf,
  canonPhaseIndex,
  canonPatternsAt,
} from "../src/game/entities/bossDesign.ts";
import { BOSS_DEFS } from "../src/game/stages.ts";

const CANON_DIR = "docs/handoff/evernote-approved";

test("정본 설계가 3종 이상 있다", () => {
  const keys = Object.keys(CANON_BOSS_DESIGN);
  assert.ok(keys.length >= 3, `정본 보스가 ${keys.length}종뿐이다`);
});

test("모든 페이즈에 정본 인용(파일:줄)이 있다", () => {
  for (const [key, d] of Object.entries(CANON_BOSS_DESIGN)) {
    assert.ok(d.motive.length > 10, `${key}: motive 이 비었다`);
    assert.ok(d.power.length > 2, `${key}: power 가 비었다`);
    assert.ok(d.phases.length >= 2, `${key}: 페이즈가 ${d.phases.length}개뿐이다`);
    for (const p of d.phases) {
      const m = /^(\d)\.txt:(\d+)(?:-(\d+))?$/.exec(p.canon);
      assert.ok(m, `${key}: canon 형식이 "N.txt:줄" 이 아니다 — ${p.canon}`);
      const path = `${CANON_DIR}/${m[1]}.txt`;
      assert.ok(existsSync(path), `${key}: 인용한 정본 ${path} 가 없다`);
      assert.ok(p.note.length > 4, `${key}/${p.form}: note 가 비었다`);
    }
  }
});

test("인용한 줄 번호가 실제 문서 범위 안이고, 그 대목에 정본 문구가 있다", () => {
  /* 주석에 적은 인용이 실제 문서와 어긋나면 "정본 근거"라는 주장 자체가 거짓이 된다.
   * 줄 번호만 맞고 내용이 다른 경우를 잡기 위해 핵심 어휘도 대조한다. */
  const KEYWORD = { harold: "해롤드", feron: "페르온|드래곤|엑스칼리버", scarlet: "스칼렛|보석|아이온" };
  for (const [key, d] of Object.entries(CANON_BOSS_DESIGN)) {
    for (const p of d.phases) {
      const m = /^(\d)\.txt:(\d+)(?:-(\d+))?$/.exec(p.canon);
      const lines = readFileSync(`${CANON_DIR}/${m[1]}.txt`, "utf8").split("\n");
      const start = Number(m[2]);
      const end = m[3] ? Number(m[3]) : start;
      assert.ok(start >= 1 && start <= lines.length, `${key}: ${p.canon} 시작 줄이 범위 밖(총 ${lines.length}줄)`);
      assert.ok(end <= lines.length, `${key}: ${p.canon} 끝 줄이 범위 밖(총 ${lines.length}줄)`);
      const span = lines.slice(start - 1, end).join("\n");
      assert.ok(span.trim().length > 0, `${key}: ${p.canon} 가 빈 줄이다`);
      assert.match(span, new RegExp(KEYWORD[key]), `${key}: ${p.canon} 대목에 "${KEYWORD[key]}" 가 없다`);
    }
  }
});

test("페이즈 임계값이 내림차순이다 (페이즈 건너뛰기 방지)", () => {
  for (const [key, d] of Object.entries(CANON_BOSS_DESIGN)) {
    for (let i = 1; i < d.phases.length; i++) {
      assert.ok(
        d.phases[i].at < d.phases[i - 1].at,
        `${key}: phases[${i}].at(${d.phases[i].at}) 이 이전(${d.phases[i - 1].at}) 이상이다`,
      );
    }
    assert.equal(d.phases[0].at, 1.0, `${key}: 첫 페이즈는 at=1.0 이어야 한다`);
  }
});

test("각 페이즈에 패턴이 1개 이상 있다", () => {
  for (const [key, d] of Object.entries(CANON_BOSS_DESIGN)) {
    for (const p of d.phases) {
      assert.ok(p.patterns.length >= 1, `${key}/${p.form}: 패턴이 없다`);
    }
  }
});

test("canonPhaseIndex 가 HP 경계에서 정확하다", () => {
  /* 스칼렛: at = [1.0, 0.66, 0.33] */
  assert.equal(canonPhaseIndex("scarlet", 1.0), 0);
  assert.equal(canonPhaseIndex("scarlet", 0.99), 0);
  assert.equal(canonPhaseIndex("scarlet", 0.67), 0);
  assert.equal(canonPhaseIndex("scarlet", 0.66), 1); // 경계값은 그 페이즈로 넘어간다
  assert.equal(canonPhaseIndex("scarlet", 0.34), 1);
  assert.equal(canonPhaseIndex("scarlet", 0.33), 2);
  assert.equal(canonPhaseIndex("scarlet", 0.0), 2);
  /* 해롤드는 2페이즈 */
  assert.equal(canonPhaseIndex("harold", 0.9), 0);
  assert.equal(canonPhaseIndex("harold", 0.5), 1);
  assert.equal(canonPhaseIndex("harold", 0.1), 1);
});

test("정본이 없는 보스는 -1 / 빈 배열을 돌려준다 (억지 생성 금지)", () => {
  assert.equal(canonPhaseIndex("unwritten-boss", 0.5), -1);
  assert.equal(canonBossOf("unwritten-boss"), null);
  assert.deepEqual(canonPatternsAt("unwritten-boss", 0.5), []);
});

test("canonPatternsAt 은 이전 페이즈 패턴을 유지한다", () => {
  const p1 = canonPatternsAt("harold", 1.0);
  const p2 = canonPatternsAt("harold", 0.4);
  assert.ok(p2.length > p1.length, "2페이즈에서 패턴이 늘지 않았다");
  for (const p of p1) assert.ok(p2.includes(p), `이전 페이즈 패턴 ${p} 가 사라졌다`);
});

test("정본 보스 키가 실제 BOSS_DEFS 에 존재한다", () => {
  /* 이게 깨지면 Boss.onPhaseChange 의 canonBossOf(def.key) 가 undefined 를 받아
   * 배너가 종전 문구로 조용히 되돌아간다 — 즉 정본 연결이 무효가 된다. */
  for (const key of Object.keys(CANON_BOSS_DESIGN)) {
    assert.ok(BOSS_DEFS[key], `정본 키 "${key}" 가 BOSS_DEFS 에 없다`);
    assert.equal(BOSS_DEFS[key].key, key, `${key}: BossDef.key 가 "${BOSS_DEFS[key].key}" 로 다르다`);
  }
});

test("정본 페이즈 수가 BossDef 패턴 단계 수와 어긋나지 않는다", () => {
  /* Boss.ts 는 phases[this.phase-1] 을 읽는다. 정본 페이즈가 BossDef 보다 적으면
   * 3페이즈 보스에서 배너가 undefined 가 되어 형태 이름이 사라진다. */
  for (const key of Object.keys(CANON_BOSS_DESIGN)) {
    const d = CANON_BOSS_DESIGN[key];
    const def = BOSS_DEFS[key];
    const defStages = def.patterns ? Object.keys(def.patterns).length : 0;
    assert.ok(
      d.phases.length <= defStages,
      `${key}: 정본 페이즈 ${d.phases.length}개 > BossDef 패턴 단계 ${defStages}개`,
    );
  }
});
