/**
 * escrow.test.ts — 재화 복제 방지 핵심 로직 테스트 (감사 #6)
 *
 * 실행: node --test src/lib/__tests__/
 *
 * 이 파일이 지키는 것: "틀리면 재화가 복제되는" 두 함수.
 *  · deductEscrow — 등록 수량을 세이브 owned 에서 빼는 함수. 보유량보다 많이 요청해도 초과 제거하면 안 된다.
 *  · escrowedCounts — 내 활성 등록분의 아이템별 합계. 등록글마다 qty 를 더해야 한다.
 *
 * 프레임워크를 추가하지 않는다 — node:test 만 쓴다.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { deductEscrow, escrowedCounts } from "../escrow.ts";

/* deductEscrow/escrowedCounts 는 DbShape 의 일부만 읽는다. 테스트에서는 최소 형태만 만든다. */
type SaveLike = Record<string, unknown>;

function listing(seller: string, itemKey: string, qty: number) {
  return { id: "x", seller, sellerName: "s", itemKey, up: 0, price: 1, qty, ts: 0 };
}

test("deductEscrow: 보유량만큼만 제거한다", () => {
  const save: SaveLike = { owned: ["a", "a", "a", "b"] };
  const removed = deductEscrow(save, { a: 2 });
  assert.equal(removed, 2);
  assert.deepEqual(save.owned, ["a", "b"]);
});

test("deductEscrow: 보유량보다 많이 요청해도 초과 제거하지 않는다", () => {
  const save: SaveLike = { owned: ["a"] };
  const removed = deductEscrow(save, { a: 5 });
  assert.equal(removed, 1, "1개만 있으므로 1개만 빠져야 한다");
  assert.deepEqual(save.owned, []);
});

test("deductEscrow: owned 가 없으면 0을 반환하고 아무것도 하지 않는다", () => {
  const save: SaveLike = {};
  assert.equal(deductEscrow(save, { a: 3 }), 0);
  assert.equal(save.owned, undefined);
});

test("deductEscrow: 여러 아이템을 각각 계산한다", () => {
  const save: SaveLike = { owned: ["a", "b", "b", "b"] };
  assert.equal(deductEscrow(save, { a: 1, b: 2 }), 3);
  assert.deepEqual(save.owned, ["b"]);
});

test("escrowedCounts: 등록글 qty 를 아이템별로 합산한다", () => {
  const db = {
    market: {
      listings: {
        l1: listing("me", "a", 2),
        l2: listing("me", "a", 3),
        l3: listing("me", "b", 1),
        l4: listing("other", "a", 9), // 남의 등록은 제외
      },
    },
  };
  const out = escrowedCounts(db as never, "me");
  assert.deepEqual(out, { a: 5, b: 1 });
});

test("escrowedCounts: 등록이 없으면 빈 객체", () => {
  const db = { market: { listings: {} } };
  assert.deepEqual(escrowedCounts(db as never, "me"), {});
});

test("escrowedCounts: qty 가 없으면 1로 센다 (구버전 등록글 호환)", () => {
  const db = { market: { listings: { l1: { ...listing("me", "a", 1), qty: undefined } } } };
  const out = escrowedCounts(db as never, "me");
  assert.deepEqual(out, { a: 1 });
});
