/**
 * vc278 — 부위별 파츠 레이어 (핸드오프 작업 A) 회귀 방지.
 *
 * 배경:
 *   vc277 까지 액세서리 배치는 WorldScene 의 `if (a.key === ...)` 하드코딩이었다.
 *   종류를 늘리려면 500KB 파일을 고쳐야 했고, 실제로 `rank_crown_gold` 가
 *   어느 분기도 타지 않아 **머리에 붙지 않는 버그**가 있었다.
 *
 * 고정하는 것:
 *  ① 그리기 순서가 핸드오프 지정 순서(뒤→앞)와 같다
 *  ② `parts` 미지정이면 **빈 배열** — 구 세이브가 지금과 100% 동일하게 동작한다
 *  ③ 기존 5종 장식의 좌표식이 vc277 하드코딩과 **수치까지 동일**하다
 *  ④ rank_crown_gold 가 머리에 붙는다 (버그 회귀 방지)
 *  ⑤ 날개/망토는 본체 뒤(-0.2), 나머지는 앞(+0.3)
 *  ⑥ 순수 함수다 — 같은 입력이면 같은 출력
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolvePartLayers,
  placePart,
  PART_ANCHORS,
  PART_DRAW_ORDER,
  PART_FALLBACK,
} from "../src/game/characterParts.ts";

/** vc277 하드코딩 분기를 그대로 옮긴 참조 구현 — 이 함수와 결과가 같아야 회귀가 아니다. */
function legacyPosition(key, ctx) {
  const { px, py, sx, sy, flipX, back, side, headTopY: ht, headHalfW: hw, bob, anchorY: an0 } = ctx;
  let wing = false;
  let x = px;
  let y = py;
  if (key === "acc_crown" || key === "rank_crown_gold") {
    x = px + (flipX ? 1 : -1);
    y = ht - 2 * sy;
  } else if (key === "acc_ribbon") {
    x = px + (flipX ? -1 : 1) * hw;
    y = ht + 4 * sy;
  } else if (key === "acc_halo") {
    x = px;
    y = ht - 9 * sy + bob;
  } else if (key === "acc_wings_devil" || key === "acc_wings_fairy") {
    const dy = back ? 2 : side ? -2 : -5;
    x = px;
    y = py + (an0 + 11 + dy - 32) * sy;
    wing = true;
  }
  return {
    x,
    y,
    scaleX: wing ? sx * 1.35 : sx,
    scaleY: wing ? sy * 1.35 : sy,
    depthBias: key.startsWith("acc_wings") ? -0.2 : 0.3,
  };
}

/** 대표적인 장면 값 몇 개 — 배율/반전/방향을 바꿔 가며 비교한다 */
const contexts = [
  { px: 100, py: 200, sx: 1, sy: 1, flipX: false, back: false, side: false, headTopY: 170, headHalfW: 12, bob: 0, anchorY: 15 },
  { px: 100, py: 200, sx: 1.5, sy: 1.5, flipX: true, back: true, side: false, headTopY: 160, headHalfW: 18, bob: 1.6, anchorY: 15 },
  { px: -40, py: 700.5, sx: 0.8, sy: 0.8, flipX: false, back: false, side: true, headTopY: 660, headHalfW: 9.6, bob: -1.2, anchorY: 11 },
  { px: 0, py: 0, sx: 2, sy: 2, flipX: true, back: false, side: false, headTopY: -10, headHalfW: 24, bob: 0.4, anchorY: 17 },
];

test("vc278 — 그리기 순서가 핸드오프 지정 순서(뒤→앞)와 같다", () => {
  /* 핸드오프 순서: leg_B → wing_B → cape_B → torso → arm_B → weapon → head
   *               → hair_B → face → hair_F → hat → arm_F → cape_F → wing_F
   * SERTZ 에 실재하는 레이어만 추린 상대 순서를 고정한다. */
  assert.deepEqual([...PART_DRAW_ORDER], ["cape", "wing", "weaponSkin", "hair", "face", "hat"]);

  const layers = resolvePartLayers({
    cape: "acc_cape_crimson",
    hat: "acc_crown",
    hair: "acc_hair_x",
    face: "acc_face_happy",
    weaponSkin: "acc_weapon_x",
  });
  assert.deepEqual(
    layers.map((l) => l.slot),
    ["cape", "weaponSkin", "hair", "face", "hat"],
    "지정한 부위는 순서 배열 순서대로 나와야 한다",
  );
});

test("vc278 — parts 미지정이면 빈 배열 (구 세이브 100% 호환)", () => {
  assert.deepEqual(resolvePartLayers(null), []);
  assert.deepEqual(resolvePartLayers(undefined), []);
  assert.deepEqual(resolvePartLayers({}), []);
  assert.deepEqual(
    resolvePartLayers({ hair: null, hat: null, cape: null, face: null, weaponSkin: null }),
    [],
    "전부 null 이면 아무 레이어도 만들지 않는다",
  );
});

test("vc278 — 기존 5종 장식 좌표식이 vc277 하드코딩과 수치까지 동일하다", () => {
  for (const key of ["acc_crown", "acc_ribbon", "acc_halo", "acc_wings_devil", "acc_wings_fairy"]) {
    const spec = PART_ANCHORS[key];
    assert.ok(spec, `${key} 사양이 테이블에 없다`);
    for (const ctx of contexts) {
      assert.deepEqual(
        placePart(spec, ctx),
        legacyPosition(key, ctx),
        `${key} 의 좌표/배율/depth 가 vc277 과 달라졌다 (ctx ${JSON.stringify(ctx)})`,
      );
    }
  }
});

test("vc278 — rank_crown_gold 도 머리에 붙는다 (vc277 버그 회귀 방지)", () => {
  /* vc277: 분기가 `a.key === "acc_crown"` 만 봐서 rank_crown_gold 는 어느 분기도
   * 타지 않았다 → 위치가 스폰 지점에 남았다. 지금은 acc_crown 과 같은 사양이어야 한다. */
  const spec = PART_ANCHORS.rank_crown_gold;
  assert.ok(spec, "rank_crown_gold 사양이 없다");
  for (const ctx of contexts) {
    assert.deepEqual(
      placePart(spec, ctx),
      legacyPosition("acc_crown", ctx),
      "rank_crown_gold 가 acc_crown 과 다르게 배치된다",
    );
  }
});

test("vc278 — 날개/망토는 본체 뒤(-0.2), 나머지는 앞(+0.3)", () => {
  const ctx = contexts[0];
  for (const key of ["acc_wings_devil", "acc_wings_fairy", "acc_cape_crimson", "acc_cape_royal"]) {
    assert.equal(placePart(PART_ANCHORS[key], ctx).depthBias, -0.2, `${key} 는 뒤여야 한다`);
  }
  for (const key of ["acc_crown", "acc_ribbon", "acc_halo", "rank_crown_gold"]) {
    assert.equal(placePart(PART_ANCHORS[key], ctx).depthBias, 0.3, `${key} 는 앞이어야 한다`);
  }
});

test("vc278 — 날개는 방향(뒤/옆/정면)에 따라 등 쪽으로 밀린다", () => {
  const spec = PART_ANCHORS.acc_wings_fairy;
  const base = { ...contexts[0] };
  const backY = placePart(spec, { ...base, back: true, side: false }).y;
  const sideY = placePart(spec, { ...base, back: false, side: true }).y;
  const frontY = placePart(spec, { ...base, back: false, side: false }).y;
  assert.ok(backY > sideY && sideY > frontY, `방향별 dy 순서가 틀렸다: back=${backY} side=${sideY} front=${frontY}`);
  /* vc277 실측 dy: 뒤 +2, 옆 −2, 정면 −5 — 배율 1 기준 간격이 4px, 3px */
  assert.equal(backY - sideY, 4);
  assert.equal(sideY - frontY, 3);
});

test("vc278 — hasTexture 로 없는 에셋을 걸러낸다", () => {
  const parts = { hat: "acc_crown", cape: "acc_cape_ghost" };
  const all = resolvePartLayers(parts);
  assert.equal(all.length, 2, "텍스처 필터가 없으면 둘 다 남는다");

  const filtered = resolvePartLayers(parts, (k) => k !== "acc_cape_ghost");
  assert.deepEqual(filtered.map((l) => l.key), ["acc_crown"]);
});

test("vc278 — 테이블에 없는 키도 위치가 튀지 않는다", () => {
  const layers = resolvePartLayers({ hat: "acc_unknown_thing" });
  assert.equal(layers.length, 1);
  const p = placePart(layers[0].spec, contexts[0]);
  /* 폴백은 부위 대표 사양을 물려받는다(hat → 테이블의 hat 계열). 좌표가 유한해야 한다. */
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
  assert.ok(Number.isFinite(p.scaleX) && Number.isFinite(p.scaleY));
});

test("vc278 — 순수 함수다 (같은 입력 → 같은 출력, 입력 불변)", () => {
  const parts = { hat: "acc_crown", cape: "acc_cape_royal", face: "happy" };
  const snapshot = JSON.stringify(parts);
  const a = resolvePartLayers(parts);
  const b = resolvePartLayers(parts);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(parts), snapshot, "resolvePartLayers 가 입력을 변형했다");

  const ctx = contexts[1];
  const ctxSnapshot = JSON.stringify(ctx);
  assert.deepEqual(placePart(PART_ANCHORS.acc_halo, ctx), placePart(PART_ANCHORS.acc_halo, ctx));
  assert.equal(JSON.stringify(ctx), ctxSnapshot, "placePart 가 입력을 변형했다");
});

test("vc278 — PART_FALLBACK 은 위치를 바꾸지 않는다", () => {
  const p = placePart(PART_FALLBACK, contexts[0]);
  assert.equal(p.x, contexts[0].px);
  assert.equal(p.y, contexts[0].py);
  assert.equal(p.depthBias, 0.3);
});

/* ── 망토 슬롯 승격 (지시서 NEXT_AI_vc284 작업 A) ─────────────────────────
 * 저장은 기존 accessory(모자·날개 1개) + cape 뿐이고, toCharacterParts 가 부위로 읽는다. */
import { readFileSync } from "node:fs";
import { toCharacterParts } from "../src/game/characterParts.ts";
import { COSMETIC_DEFS, ITEMS } from "../src/game/data.ts";

test("toCharacterParts: accessory 를 모자/날개로 가르고 망토를 따로 둔다", () => {
  assert.deepEqual(toCharacterParts({}), { cape: null, wing: null, hat: null });
  assert.deepEqual(toCharacterParts({ accessory: "acc_crown", cape: "acc_cape_royal" }),
    { cape: "acc_cape_royal", wing: null, hat: "acc_crown" });
  assert.deepEqual(toCharacterParts({ accessory: "acc_wings_devil" }),
    { cape: null, wing: "acc_wings_devil", hat: null });
  // rank_crown_gold 도 모자다(날개 접두사가 아니다).
  assert.equal(toCharacterParts({ accessory: "rank_crown_gold" }).hat, "rank_crown_gold");
});

test("모자 + 망토 동시 착용 시 망토가 먼저(뒤), 모자가 나중(앞)에 그려진다", () => {
  const hatCape = resolvePartLayers(toCharacterParts({ accessory: "acc_halo", cape: "acc_cape_crimson" }));
  assert.deepEqual(hatCape.map((l) => [l.slot, l.key]), [["cape", "acc_cape_crimson"], ["hat", "acc_halo"]]);
  assert.equal(hatCape[0].spec.behind, true);
  assert.equal(hatCape[1].spec.behind, false);
  const wingCape = resolvePartLayers(toCharacterParts({ accessory: "acc_wings_fairy", cape: "acc_cape_royal" }));
  assert.deepEqual(wingCape.map((l) => l.slot), ["cape", "wing"]);
  // 장식만 낀 구 세이브는 레이어 1개 — 종전과 같은 사양을 받는다.
  const only = resolvePartLayers(toCharacterParts({ accessory: "acc_crown" }));
  assert.equal(only.length, 1);
  assert.equal(only[0].spec, PART_ANCHORS.acc_crown);
});

test("망토는 상점·치장 정의가 있고 실제 그림이 있다", () => {
  for (const k of ["acc_cape_crimson", "acc_cape_royal"]) {
    assert.equal(COSMETIC_DEFS[k]?.slot, "cape");
    assert.equal(ITEMS[k]?.kind, "cosmetic");
    assert.ok(ITEMS[k].bmPrice > 0, "캐시상점 진열 자격");
    assert.ok(readFileSync(`public/assets/${k}.webp`).length > 0);
  }
});

test("망토 세이브 필드는 SaveData·복원·buildSave·UI 상태 4곳이 싱크다", () => {
  const cfg = readFileSync("src/game/config.ts", "utf8");
  const scene = readFileSync("src/game/scenes/WorldScene.ts", "utf8");
  assert.match(cfg, /cape\?: string \| null;/);
  assert.match(cfg, /if \(typeof d\.cape !== "string"\) d\.cape = null/);
  assert.match(scene, /this\.player\.cape = \(savedLook\.cape && COSMETIC_DEFS\[/);
  assert.equal((scene.match(/cape: this\.player\.cape/g) ?? []).length, 2, "emitRpgState + buildSave");
  // 렌더는 하드코딩 분기가 아니라 부위 해석 함수를 거친다.
  assert.match(scene, /resolvePartLayers\(toCharacterParts\(this\.player\)/);
});
