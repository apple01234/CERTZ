/**
 * escrow.ts — 거래소 에스크로 순수 함수 (vc205, 감사 #6)
 *
 * 왜 분리했나
 *   이 함수들은 **틀리면 재화가 복제되는** 핵심 로직인데 `sapi.ts` 안에 있어서
 *   테스트하려면 NextRequest·@/game/data 같은 무거운 의존을 끌고 와야 했다.
 *   여기로 옮겨 의존을 0으로 만들면 `node --experimental-strip-types --test` 로 바로 검증된다.
 *
 * `sapi.ts` 는 이 모듈을 re-export 하므로 기존 호출부는 바뀌지 않는다.
 */

/** 내 활성 등록분의 아이템별 수량 합계 (에스크로 잔량) */
export function escrowedCounts(
  db: { market: { listings: Record<string, { seller: string; itemKey: string; qty?: number }> } },
  uid: string,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of Object.values(db.market.listings)) {
    if (l.seller !== uid) continue;
    out[l.itemKey] = (out[l.itemKey] ?? 0) + (l.qty ?? 1);
  }
  return out;
}

/** 세이브 owned 에서 에스크로 수량을 제거한다(보유량을 넘지 않게). 제거한 개수 반환.
 *  클라가 이미 로컬에서 뺀 경우 0개가 제거되고, 예전 세이브를 되올린 경우 정확히 다시 빠진다. */
export function deductEscrow(save: Record<string, unknown>, esc: Record<string, number>): number {
  const owned = Array.isArray(save.owned) ? (save.owned as unknown[]) : null;
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

/** 세이브에 수량을 되돌려 넣는다 (취소·구매 시). 세이브가 없으면 아무것도 하지 않는다. */
export function creditOwnedInto(
  save: Record<string, unknown>,
  itemKey: string,
  qty: number,
  up: number,
): void {
  const owned = Array.isArray(save.owned) ? (save.owned as unknown[]) : [];
  for (let i = 0; i < qty; i++) owned.push(itemKey);
  save.owned = owned;
  if (up > 0) {
    const accUp = (save.accUp && typeof save.accUp === "object" ? save.accUp : {}) as Record<string, number>;
    accUp[itemKey] = up;
    save.accUp = accUp;
  }
}
