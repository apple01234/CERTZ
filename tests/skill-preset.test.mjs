/**
 * 스킬 배치 프리셋 계약 (REVAMP_100 개편 후보 "스킬 프리셋 2~3개").
 *
 * [왜 필요한가]
 *  종전 프리셋은 **이동 스킴**(화살표/WASD) 2종뿐이었다. 그건 "손 위치"를 고르는
 *  것이지 "무엇을 먼저 누를지"를 고르는 것이 아니다. 보스전에서는 궁극기가 손에
 *  붙어 있어야 하고, 원거리는 달리면서 쏠 수 있어야 한다. 매번 키를 하나씩
 *  바꾸는 건 번거롭다 — 한 번에 갈아끼울 수 있어야 한다.
 *
 * [핵심 불변식]
 *  1. 프리셋은 **키 위치만** 바꾼다. 스킬 성능(데미지·쿨·판정)과 무관하다.
 *  2. 이동 키와 충돌하는 배정은 버린다. 안 그러면 이동이 막혀 게임이 안 된다.
 *  3. 어떤 프리셋이든 키맵은 **완전**하다 — 18개 액션이 전부 키를 가진다.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  keyMapForPreset,
  loadSkillPreset,
  writeSkillPreset,
  moveKeysFor,
  SKILL_PRESET_LABELS,
  SKILL_PRESET_HINTS,
  DEFAULT_KEYMAP,
  WASD_KEYMAP,
} from "../src/game/keymap.ts";

const PRESETS = ["combat", "boss", "ranged"];
const SCHEMES = ["arrows", "wasd"];

/* loadSkillPreset 은 window.localStorage 를 본다 — 테스트용 최소 스텁. */
if (!globalThis.window) {
  const store = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
    },
  };
}

test("프리셋이 3개이고 라벨·설명이 전부 있다", () => {
  for (const p of PRESETS) {
    assert.ok(SKILL_PRESET_LABELS[p], `${p} 라벨이 없다`);
    assert.ok(SKILL_PRESET_HINTS[p], `${p} 설명이 없다`);
  }
  assert.equal(PRESETS.length, 3, "프리셋이 3개가 아니다");
});

test("모든 프리셋 × 스킴 조합에서 키맵이 완전하다 (18개 액션 전부 키 보유)", () => {
  const base = DEFAULT_KEYMAP;
  const actions = Object.keys(base);
  assert.ok(actions.length >= 18, `액션이 ${actions.length}개뿐이다`);
  for (const p of PRESETS) {
    for (const s of SCHEMES) {
      const km = keyMapForPreset(p, s);
      for (const a of actions) {
        assert.ok(km[a], `${p}/${s}: ${a} 에 키가 없다`);
      }
    }
  }
});

test("이동 키와 충돌하는 배정은 버려진다 (이동이 막히면 게임이 안 된다)", () => {
  for (const p of PRESETS) {
    for (const s of SCHEMES) {
      const km = keyMapForPreset(p, s);
      const mv = moveKeysFor(s);
      const moveCodes = new Set([mv.left, mv.right, mv.up, mv.down]);
      for (const [action, key] of Object.entries(km)) {
        assert.ok(
          !moveCodes.has(key),
          `${p}/${s}: ${action} 이 이동키 ${key} 를 차지했다 — 이동이 막힌다`,
        );
      }
    }
  }
});

test("전투/보스/원거리 프리셋이 서로 실제로 다르다 (이름만 다른 껍데기가 아니다)", () => {
  const key = (p) => JSON.stringify(keyMapForPreset(p, "arrows"));
  assert.notEqual(key("combat"), key("boss"), "combat 과 boss 가 같다");
  assert.notEqual(key("combat"), key("ranged"), "combat 과 ranged 가 같다");
  assert.notEqual(key("boss"), key("ranged"), "boss 와 ranged 가 같다");
});

test("combat 프리셋은 스킴 기본값 그대로다 (기존 사용자 배치 보존)", () => {
  assert.deepEqual(keyMapForPreset("combat", "arrows"), { ...DEFAULT_KEYMAP });
  assert.deepEqual(keyMapForPreset("combat", "wasd"), { ...WASD_KEYMAP });
});

test("boss 프리셋은 궁극기를 물약보다 앞선 키에 둔다 (보스전은 궁극기 타이밍 싸움)", () => {
  const km = keyMapForPreset("boss", "arrows");
  /* 궁극기(5·5b)가 물약보다 왼손 홈열에 가까워야 한다.
   * 구체적 키 이름은 바뀔 수 있으므로 "물약과 다르다"만 고정한다. */
  assert.notEqual(km.skill5, km.potHp, "궁극기와 HP물약이 같은 키다");
  assert.notEqual(km.skill5b, km.potMp, "제2궁극기와 MP물약이 같은 키다");
});

test("저장/복원이 왕복한다", () => {
  writeSkillPreset("boss");
  assert.equal(loadSkillPreset(), "boss");
  writeSkillPreset("ranged");
  assert.equal(loadSkillPreset(), "ranged");
});

test("저장값이 이상하면 combat 으로 떨어진다 (깨진 값으로 게임이 멈추면 안 된다)", () => {
  window.localStorage.setItem("sertz_skillpreset_v1", "존재하지않는프리셋");
  assert.equal(loadSkillPreset(), "combat");
  window.localStorage.setItem("sertz_skillpreset_v1", "");
  assert.equal(loadSkillPreset(), "combat");
});

test("같은 키가 두 액션에 중복 배정되지 않는다", () => {
  for (const p of PRESETS) {
    for (const s of SCHEMES) {
      const km = keyMapForPreset(p, s);
      const seen = new Map();
      for (const [action, key] of Object.entries(km)) {
        /* 옵션(Escape)은 고정이라 제외 */
        if (key === "Escape") continue;
        assert.ok(!seen.has(key), `${p}/${s}: 키 ${key} 를 ${seen.get(key)} 와 ${action} 이 같이 쓴다`);
        seen.set(key, action);
      }
    }
  }
});
