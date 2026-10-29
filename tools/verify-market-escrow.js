/**
 * 거래소 에스크로 계약 검증 (v1.4.41 — 감사 #1 무한 복제)
 *
 * 실제 라우트를 돌리지 않고, mutateDb 의 mutator 본문과 동일한 규칙을 재현해
 * "등록 → 취소/구매 → 재등록" 사이클에서 아이템·골드 총량이 보존되는지 확인한다.
 * GitHub DB 없이 순수 함수로 돌므로 CI·로컬 어디서든 즉시 실행된다.
 *
 *   node tools/verify-market-escrow.js
 */
const assert = require("node:assert");

/* ---- sapi.ts 의 에스크로 헬퍼를 그대로 옮긴 것 (로직이 갈라지면 이 파일도 고친다) ---- */
function escrowedCounts(db, uid) {
  const out = {};
  for (const l of Object.values(db.market.listings)) {
    if (l.seller !== uid) continue;
    out[l.itemKey] = (out[l.itemKey] ?? 0) + (l.qty ?? 1);
  }
  return out;
}
function deductEscrow(save, esc) {
  const owned = Array.isArray(save.owned) ? save.owned : null;
  if (!owned) return 0;
  let removed = 0;
  for (const [key, qty] of Object.entries(esc)) {
    for (let i = 0; i < qty; i++) {
      const idx = owned.indexOf(key);
      if (idx < 0) break;
      owned.splice(idx, 1);
      removed++;
    }
  }
  return removed;
}
function creditOwned(db, uid, itemKey, qty, up) {
  const rec = db.saves[uid];
  if (!rec || !rec.data || typeof rec.data !== "object") return;
  const d = rec.data;
  const owned = Array.isArray(d.owned) ? d.owned : [];
  for (let i = 0; i < qty; i++) owned.push(itemKey);
  d.owned = owned;
  if (up > 0) d.accUp = { ...(d.accUp || {}), [itemKey]: up };
  rec.updatedAt = Date.now();
}
function countOf(db, uid, key) {
  const o = db.saves[uid]?.data?.owned;
  return Array.isArray(o) ? o.filter((k) => k === key).length : 0;
}

/* ---- 라우트 mutator 재현 ---- */
function listItem(db, uid, itemKey, price, qty, up = 0) {
  const own = countOf(db, uid, itemKey);
  if (own < qty) return { status: 403, error: "보유 수량 부족" };
  const rec = db.saves[uid];
  if (!rec?.data) return { status: 403, error: "세이브 없음" };
  deductEscrow(rec.data, { [itemKey]: qty });              // v1.4.41
  rec.updatedAt = Date.now();
  const id = `m${db.market.nextId++}`;
  db.market.listings[id] = { id, seller: uid, sellerName: uid, itemKey, up, price, qty, ts: Date.now() };
  return { status: 200, id };
}
function cancelItem(db, uid, id) {
  const l = db.market.listings[id];
  if (!l) return { status: 404 };
  if (l.seller !== uid) return { status: 403 };
  delete db.market.listings[id];
  creditOwned(db, uid, l.itemKey, l.qty ?? 1, l.up ?? 0);   // v1.4.41
  return { status: 200 };
}
function buyItem(db, buyer, id, units = 1) {
  const l = db.market.listings[id];
  if (!l) return { status: 404 };
  if (l.seller === buyer) return { status: 403 };
  const avail = l.qty ?? 1;
  if (avail < units) return { status: 409 };
  const left = avail - units;
  if (left <= 0) delete db.market.listings[id];
  else l.qty = left;
  db.payouts[l.seller] ||= { gold: 0, count: 0 };
  db.payouts[l.seller].gold += Math.floor((l.price * units * 90) / 100);
  db.payouts[l.seller].count += units;
  creditOwned(db, buyer, l.itemKey, units, l.up ?? 0);      // v1.4.41
  return { status: 200 };
}
function uploadSave(db, uid, owned) {
  // cloud-save POST 재현 — 에스크로분 재차감이 핵심
  const next = { data: { owned: [...owned] }, updatedAt: Date.now() };
  const esc = escrowedCounts(db, uid);
  if (Object.keys(esc).length) deductEscrow(next.data, esc);
  db.saves[uid] = next;
  return next;
}

/* ---- 검사 ---- */
const results = [];
function check(name, fn) {
  try { fn(); results.push(["PASS", name]); }
  catch (e) { results.push(["FAIL", name + " — " + e.message]); }
}

const fresh = () => ({
  users: { a: { id: "a" }, b: { id: "b" } },
  saves: {
    a: { data: { owned: ["sword", "sword", "sword"], accUp: {} }, updatedAt: 0 },
    b: { data: { owned: [], accUp: {} }, updatedAt: 0 },
  },
  market: { nextId: 1, listings: {} },
  payouts: {},
});

check("등록하면 세이브에서 실제로 빠진다 (수량만큼)", () => {
  const db = fresh();
  assert.strictEqual(countOf(db, "a", "sword"), 3);
  listItem(db, "a", "sword", 100, 2);
  assert.strictEqual(countOf(db, "a", "sword"), 1, "2개 등록 후 1개 남아야 함");
});

check("등록한 만큼만 등록 가능 — 초과 등록은 거부", () => {
  const db = fresh();
  const r = listItem(db, "a", "sword", 100, 5);
  assert.strictEqual(r.status, 403);
  assert.strictEqual(countOf(db, "a", "sword"), 3, "거부 시 세이브 불변");
});

check("취소하면 세이브로 돌아온다", () => {
  const db = fresh();
  const { id } = listItem(db, "a", "sword", 100, 2);
  assert.strictEqual(countOf(db, "a", "sword"), 1);
  cancelItem(db, "a", id);
  assert.strictEqual(countOf(db, "a", "sword"), 3, "취소 후 원복");
});

check("구매하면 구매자에게 지급되고 판매자 재고는 그대로 (복제 없음)", () => {
  const db = fresh();
  const { id } = listItem(db, "a", "sword", 100, 2);
  buyItem(db, "b", id, 2);
  assert.strictEqual(countOf(db, "a", "sword"), 1, "판매자 총 보유 = 1 (등록분 소멸)");
  assert.strictEqual(countOf(db, "b", "sword"), 2, "구매자 지급");
  const total = countOf(db, "a", "sword") + countOf(db, "b", "sword");
  assert.strictEqual(total, 3, `아이템 총량 보존 (실제 ${total})`);
});

check("★ 핵심: 등록 후 옛 세이브를 다시 올려도 복제되지 않는다", () => {
  const db = fresh();
  listItem(db, "a", "sword", 100, 2);          // 세이브 3 → 1
  assert.strictEqual(countOf(db, "a", "sword"), 1);
  uploadSave(db, "a", ["sword", "sword", "sword"]); // 예전 세이브로 되돌리기 시도
  assert.strictEqual(countOf(db, "a", "sword"), 1, "에스크로 재차감 — 여전히 1개");
  const total = countOf(db, "a", "sword");
  assert.strictEqual(total, 1, `복제 불가 (실제 ${total})`);
});

check("★ 핵심: 반복 복원 공격으로도 늘지 않는다", () => {
  const db = fresh();
  listItem(db, "a", "sword", 100, 2);
  for (let i = 0; i < 20; i++) uploadSave(db, "a", ["sword", "sword", "sword"]);
  assert.strictEqual(countOf(db, "a", "sword"), 1, "20회 복원 시도 후에도 1개");
});

check("취소 후 재등록 사이클에서 총량 불변", () => {
  const db = fresh();
  for (let i = 0; i < 10; i++) {
    const { id } = listItem(db, "a", "sword", 100, 2);
    assert.ok(id, `${i}회차 등록 실패`);
    cancelItem(db, "a", id);
  }
  assert.strictEqual(countOf(db, "a", "sword"), 3, "10회 사이클 후 원래 3개");
});

check("판매자 정산금 = 가격×수량×90%", () => {
  const db = fresh();
  const { id } = listItem(db, "a", "sword", 1000, 2);
  buyItem(db, "b", id, 2);
  assert.strictEqual(db.payouts.a.gold, 1800, `수수료 10% 절단 (${db.payouts.a.gold})`);
});

check("본인 등록은 구매 불가", () => {
  const db = fresh();
  const { id } = listItem(db, "a", "sword", 100, 2);
  assert.strictEqual(buyItem(db, "a", id).status, 403);
});

/* ---- 출력 ---- */
const fail = results.filter(([s]) => s === "FAIL");
for (const [s, n] of results) console.log(`  ${s === "PASS" ? "✓" : "✗"} ${n}`);
console.log(
  fail.length === 0
    ? `\nALL CHECKS PASS (${results.length}항목)`
    : `\n${fail.length}건 실패 / 총 ${results.length}항목`
);
process.exit(fail.length === 0 ? 0 : 1);
